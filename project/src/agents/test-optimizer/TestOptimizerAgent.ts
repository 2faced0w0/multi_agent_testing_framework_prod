import { v4 as uuidv4 } from 'uuid';
import BaseAgent, { type BaseAgentConfig } from '../base/BaseAgent';
import type { AgentMessage } from '@app-types/communication';
import { acquireGlobalDatabase } from '@database/GlobalDatabase';
import { RecommendationsRepository } from '@database/repositories/RecommendationsRepository';
import { generateFallbackSelectors } from '../locator-synthesis/fallback';

export type TestOptimizerAgentConfig = BaseAgentConfig & {
  analysis?: { lookbackExecutions: number };
  retryPolicy?: { maxAttempts: number; backoffMs: number };
};

export class TestOptimizerAgent extends BaseAgent {
  private repo!: RecommendationsRepository;
  private lookback = 5;
  private maxAttempts = 3;
  private backoffMs = 5000;

  constructor(cfg: TestOptimizerAgentConfig) {
    super({ ...cfg, agentType: 'TestOptimizer' });
    if (cfg.analysis?.lookbackExecutions !== undefined) this.lookback = cfg.analysis.lookbackExecutions;
    if (cfg.retryPolicy?.maxAttempts !== undefined) this.maxAttempts = cfg.retryPolicy.maxAttempts;
    if (cfg.retryPolicy?.backoffMs !== undefined) this.backoffMs = cfg.retryPolicy.backoffMs;
  }

  protected async onInitialize(): Promise<void> {
    const db = acquireGlobalDatabase(this['config'].database).getDatabase();
    this.repo = new RecommendationsRepository(db);
  }

  protected async onShutdown(): Promise<void> {
    // no-op
  }

  protected getConfigSchema(): object { return {}; }

  protected async processMessage(message: AgentMessage): Promise<void> {
    switch (message.messageType) {
      case 'EXECUTION_RESULT':
        await this.onExecutionResult(message);
        break;
      case 'OPTIMIZE_RECENT':
        await this.onOptimizeRecent();
        break;
      case 'OPTIMIZE_TEST_FILE':
        await this.onOptimizeTestFile(message);
        break;
      case 'LOCATOR_CANDIDATES':
        await this.onLocatorCandidates(message);
        break;
      default:
        this['log']('debug', 'Ignoring message', { messageType: message.messageType });
    }
  }

  private async onExecutionResult(message: AgentMessage) {
    const p: any = message.payload || {};
    const status = String(p.status || 'unknown');
    const execId = p.executionId;
    if (!execId) return;
    // If passed, clear attempts state and exit
    if (status === 'passed') {
      try { await this['sharedMemory'].set(`execAttempts:${execId}`, { attempts: 0 }, 3600); } catch {}
      return;
    }
    // Failed or skipped: track and re-enqueue up to maxAttempts
    try {
      const key = `execAttempts:${execId}`;
      const state = (await this['sharedMemory'].get<{ attempts: number }>(key)) || { attempts: 0 };
      const next = state.attempts + 1;
      if (next <= this.maxAttempts) {
        await this['sharedMemory'].set(key, { attempts: next }, 3600);
        // Optional backoff
        await new Promise(r => setTimeout(r, this.backoffMs));
        await this['sendMessage']({
          target: { type: 'TestExecutor' },
          messageType: 'EXECUTION_REQUEST',
          payload: { executionId: execId, rerunAttempt: next }
        });
      } else {
        // Exceeded attempts: create a recommendation and stop reruns
        const id = uuidv4();
        await this.repo.create({
          id,
          created_at: new Date().toISOString(),
          strategy: 'investigate-flaky',
          details: { reason: p.summary || 'repeated failure', executionId: execId, attempts: next - 1 },
          severity: 'high',
          applies_from: new Date().toISOString(),
          created_by: this['agentId'].type,
        });
        await this['publishEvent']('optimization.recommendation.created', { id, executionId: execId });
      }
    } catch (e) {
      this['log']('warn', 'Failed to schedule retry', { error: (e as Error)?.message });
    }
    // Also record a basic recommendation entry for the initial failure
    if (status !== 'passed') {
      const id = uuidv4();
      await this.repo.create({
        id,
        created_at: new Date().toISOString(),
        strategy: 'increase-retries',
        details: { reason: p.summary || 'failure detected', executionId: execId },
        severity: 'medium',
        applies_from: new Date().toISOString(),
        created_by: this['agentId'].type,
      });
      await this['publishEvent']('optimization.recommendation.created', { id, executionId: execId });
    }
  }

  private async onOptimizeRecent() {
    // Placeholder for future: analyze last N executions and produce recommendations
    await this['publishEvent']('optimization.analysis.completed', { lookback: this.lookback });
  }

  private async onOptimizeTestFile(message: AgentMessage) {
    const p: any = message.payload || {};
    const testFilePath: string | undefined = p.testFilePath;
    if (!testFilePath) return;
    const execId = p.executionId;
    const attemptNumber = Number(p.rerunAttempt || 0);
    // Retrieve last failure context
    let failureCtx: any = null;
    try { failureCtx = await this.sharedMemory.get(`ctx:lastFailure:${execId}`); } catch {}
    const originalSelector: string | undefined = p.originalSelector || failureCtx?.selectorGuess;
    // Build element approximation from selector guess
    const elementDesc: any = {};
    if (originalSelector) {
      if (/getByTestId\('([^']+)'\)/.test(originalSelector)) {
        elementDesc['data-testid'] = originalSelector.match(/getByTestId\('([^']+)'\)/)![1];
      } else if (/getByRole\(([^)]+)\)/.test(originalSelector)) {
        const roleArg = originalSelector.match(/getByRole\(([^)]+)\)/)![1];
        elementDesc.role = roleArg.split(',')[0].replace(/['"{} ]/g,'').split(':').pop();
      }
    }
    // Fallback hints
    elementDesc.tag = elementDesc.tag || 'header';
    // Persist pending optimization context
    const pendingKey = `opt:pending:${execId}`;
    // Preserve existing candidate state if present (so we can continue iterating on next failure)
    let existing: any = null;
    try { existing = await this.sharedMemory.get(pendingKey); } catch {}
    const stored = existing || { testFilePath, originalSelector, elementDesc, candidateIndex: 0, candidates: [] as string[] };
    // Update base fields in case they changed
    stored.testFilePath = testFilePath;
    stored.originalSelector = originalSelector;
    stored.elementDesc = elementDesc;
    stored.attemptNumber = attemptNumber;
    try { await this.sharedMemory.set(pendingKey, stored, 600); } catch {}
    // Ask locator synthesis (provide optimizationContext for correlation)
    try {
      await this.sendMessage({
        target: { type: 'LocatorSynthesis' },
        messageType: 'LOCATOR_SYNTHESIS_REQUEST',
        payload: { element: elementDesc, context: { optimizationContext: { execId, testFilePath, originalSelector, attemptNumber } } }
      });
    } catch {}
  }

  private async onLocatorCandidates(message: AgentMessage) {
    const p: any = message.payload || {};
    const ctx = p.context || {};
    const optCtx = ctx.optimizationContext || ctx;
    const execId = optCtx?.execId;
    const attemptNumber = Number(optCtx?.attemptNumber || 0);
    if (!execId) return;
    const pendingKey = `opt:pending:${execId}`;
    let pending: any = null;
    try { pending = await this.sharedMemory.get(pendingKey); } catch {}
    if (!pending) return;
    // Ignore stale candidate responses from earlier attempts
    if (typeof pending.attemptNumber === 'number' && attemptNumber < pending.attemptNumber) {
      this['log']('debug', 'Ignoring stale locator candidates', { execId, attemptNumber, storedAttempt: pending.attemptNumber });
      return;
    }
    const { testFilePath, originalSelector, elementDesc } = pending;
    // Merge newly received candidates with any cached ones (dedupe preserving order)
    const incoming: string[] = (p.candidates || []).filter((c: string) => !!c);
    const mergedSet = new Set<string>([...pending.candidates, ...incoming]);
    const merged = Array.from(mergedSet);
    pending.candidates = merged;

    // Pick candidate at candidateIndex
    let replacement: string | undefined = merged[pending.candidateIndex];
    if (!replacement) {
      // Exhausted synthesized candidates: compute fallback list and choose next fallback by offset
      const fallbacks = generateFallbackSelectors({ originalSelector, element: elementDesc });
      replacement = fallbacks[pending.candidateIndex - merged.length] || fallbacks[0];
    }
    if (!replacement || !testFilePath) {
      try { await this.sharedMemory.set(pendingKey, pending, 600); } catch {}
      return;
    }
    const fs = await import('fs/promises');
    try {
      const content = await fs.readFile(testFilePath, 'utf8');
      // Idempotency: if a line already contains our structured marker for this replacement, skip
      const marker = `// OPTIMIZER_PATCH:`;
      if (content.includes(`${marker} ${replacement}`)) {
        this['log']('debug', 'Replacement already applied, advancing index', { execId, replacement });
        pending.candidateIndex += 1;
        try { await this.sharedMemory.set(pendingKey, pending, 600); } catch {}
        return;
      }
      if (originalSelector && content.includes(originalSelector)) {
        const patched = content.replace(originalSelector, replacement) + `\n${marker} ${originalSelector} => ${replacement} [candidateIndex=${pending.candidateIndex}]\n`;
        await fs.writeFile(testFilePath, patched, 'utf8');
        // Advance index for next potential attempt
        pending.candidateIndex += 1;
        pending.lastApplied = replacement;
        pending.attemptNumber = attemptNumber;
        try { await this.sharedMemory.set(pendingKey, pending, 600); } catch {}
        await this.sendMessage({
          target: { type: 'TestExecutor' },
          messageType: 'EXECUTION_REQUEST',
          payload: { testFilePath, optimizationRerun: true, executionId: execId }
        });
      }
    } catch (e) {
      this['log']('warn', 'Failed applying locator candidates', { error: (e as Error)?.message });
    }
  }
}

export default TestOptimizerAgent;