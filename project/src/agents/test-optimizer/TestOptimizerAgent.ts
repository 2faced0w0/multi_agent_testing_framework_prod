import { v4 as uuidv4 } from 'uuid';
import BaseAgent, { type BaseAgentConfig } from '../base/BaseAgent';
import type { AgentMessage } from '@app-types/communication';
import { acquireGlobalDatabase } from '@database/GlobalDatabase';
import { RecommendationsRepository } from '@database/repositories/RecommendationsRepository';

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
}

export default TestOptimizerAgent;