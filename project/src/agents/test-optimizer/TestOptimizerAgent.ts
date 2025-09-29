import { v4 as uuidv4 } from 'uuid';
import BaseAgent, { type BaseAgentConfig } from '../base/BaseAgent';
import type { AgentMessage } from '@app-types/communication';
import { acquireGlobalDatabase } from '@database/GlobalDatabase';
import { RecommendationsRepository } from '@database/repositories/RecommendationsRepository';

export type TestOptimizerAgentConfig = BaseAgentConfig & {
  analysis?: {
    lookbackExecutions: number;
  };
};

export class TestOptimizerAgent extends BaseAgent {
  private repo!: RecommendationsRepository;
  private lookback = 5;

  constructor(cfg: TestOptimizerAgentConfig) {
    super({ ...cfg, agentType: 'TestOptimizer' });
    if (cfg.analysis?.lookbackExecutions) this.lookback = cfg.analysis.lookbackExecutions;
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
    // Simple heuristic: if failed, suggest retries and stabilization
    if (status !== 'passed') {
      const id = uuidv4();
      await this.repo.create({
        id,
        created_at: new Date().toISOString(),
        strategy: 'increase-retries',
        details: { reason: p.summary || 'failure detected', executionId: p.executionId },
        severity: 'medium',
        applies_from: new Date().toISOString(),
        created_by: this['agentId'].type,
      });
      await this['publishEvent']('optimization.recommendation.created', { id, executionId: p.executionId });
    }
  }

  private async onOptimizeRecent() {
    // Placeholder for future: analyze last N executions and produce recommendations
    await this['publishEvent']('optimization.analysis.completed', { lookback: this.lookback });
  }
}

export default TestOptimizerAgent;