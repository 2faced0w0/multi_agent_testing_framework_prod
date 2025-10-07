import BaseAgent, { type BaseAgentConfig } from '../base/BaseAgent';
import type { AgentMessage } from '@app-types/communication';

export type ContextManagerAgentConfig = BaseAgentConfig & {
  namespace?: string; // prefix in shared memory
};

export class ContextManagerAgent extends BaseAgent {
  private ns: string;
  constructor(cfg: ContextManagerAgentConfig) {
    super({ ...cfg, agentType: 'ContextManager' });
    this.ns = cfg.namespace || 'ctx';
  }

  protected async onInitialize(): Promise<void> { /* no-op */ }
  protected async onShutdown(): Promise<void> { /* no-op */ }
  protected getConfigSchema(): object { return {}; }

  protected async processMessage(message: AgentMessage): Promise<void> {
    const p: any = message.payload || {};
    switch (message.messageType) {
      case 'GET_CONTEXT':
        await this.handleGet(p);
        break;
      case 'UPDATE_CONTEXT':
        await this.handleUpdate(p);
        break;
      case 'EXECUTION_FAILURE':
        await this.handleExecutionFailure(p);
        break;
      case 'EXECUTION_RESULT':
        // Extended: if failed and includes failedTests array, persist richer context then dispatch optimize request
        if (p.status === 'failed' && Array.isArray(p.failedTests) && p.failedTests.length > 0) {
          const ft = p.failedTests[0];
          const selectorGuess: string | undefined = ft.selectorGuess;
          const failureContext = {
            executionId: p.executionId,
            file: ft.file,
            selectorGuess,
            errorSnippet: ft.errorSnippet,
            summary: p.summary,
            ts: Date.now()
          };
          try {
            await this.sharedMemory.set(this.key(`lastFailure:${p.executionId}`), failureContext, 3600);
          } catch {}
          // Derive a short testCaseId / file identity for optimizer
          const optimizePayload = {
            executionId: p.executionId,
            testFilePath: ft.file,
            originalSelector: selectorGuess,
            attempt: 1
          };
          try {
            await this.sendMessage({
              target: { type: 'TestOptimizer' },
              messageType: 'OPTIMIZE_TEST_FILE',
              payload: optimizePayload
            });
          } catch {}
        }
        break;
      default:
        this['log']('debug', 'Ignoring message', { messageType: message.messageType });
    }
  }

  private async handleGet(p: any) {
    const key = this.key(p.key || 'default');
    const val = await this.sharedMemory.get(key);
    await this.publishEvent('context.get.completed', { key, found: val !== null });
  }

  private async handleUpdate(p: any) {
    const key = this.key(p.key || 'default');
    const ttl = typeof p.ttl === 'number' ? p.ttl : undefined;
    await this.sharedMemory.set(key, p.value, ttl);
    await this.publishEvent('context.update.completed', { key });
  }

  private key(k: string) { return `${this.ns}:${k}`; }

  private async handleExecutionFailure(p: any) {
    const execId = p.executionId;
    const summary = p.summary || '';
    if (!execId) return;
    // Record last failure context
    try { await this.sharedMemory.set(this.key(`lastFailure:${execId}`), { summary, ts: Date.now() }, 3600); } catch {}
    // Ask optimizer to schedule a re-run/regeneration cycle
    try {
      await this['publishEvent']('context.execution.failure', { executionId: execId, summary });
      await this['sendMessage']({
        target: { type: 'TestOptimizer' },
        messageType: 'EXECUTION_RESULT',
        payload: { executionId: execId, status: 'failed', summary }
      });
    } catch {}
  }
}

export default ContextManagerAgent;
