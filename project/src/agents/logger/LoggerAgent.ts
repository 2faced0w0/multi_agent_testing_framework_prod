import { v4 as uuidv4 } from 'uuid';
import BaseAgent, { type BaseAgentConfig } from '../base/BaseAgent';
import type { AgentMessage } from '@app-types/communication';
import { acquireGlobalDatabase } from '@database/GlobalDatabase';
import { LogsRepository, type LogRow } from '@database/repositories/LogsRepository';

export interface LoggerAgentConfig extends BaseAgentConfig {
  retentionDays?: number;
}

export class LoggerAgent extends BaseAgent {
  private logsRepo!: LogsRepository;
  private retentionDays: number;

  constructor(cfg: LoggerAgentConfig) {
    super({ ...cfg, agentType: 'Logger' });
    this.retentionDays = cfg.retentionDays ?? 14;
  }

  protected async onInitialize(): Promise<void> {
    const db = acquireGlobalDatabase(this['config'].database).getDatabase();
    this.logsRepo = new LogsRepository(db);
  }

  protected async onShutdown(): Promise<void> {
    // No-op for now
  }

  protected getConfigSchema(): object { return {}; }

  protected async processMessage(message: AgentMessage): Promise<void> {
    switch (message.messageType) {
      case 'LOG_ENTRY':
        await this.handleLogEntry(message);
        break;
      case 'QUERY_LOGS':
        await this.handleQueryLogs(message);
        break;
      default:
        this['log']('warn', 'Unknown messageType for LoggerAgent', { messageType: message.messageType });
    }
  }

  private async handleLogEntry(message: AgentMessage) {
    const p: any = message.payload || {};
    const row: LogRow = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      level: (p.level || 'info').toLowerCase(),
      message: p.message || '',
      context: p.context || { source: message.source },
      source_service: p.source_service || 'framework',
      source_component: p.source_component || message.source.type,
      source_instance: p.source_instance || message.source.instanceId,
      tags: Array.isArray(p.tags) ? p.tags : undefined,
      correlation_id: p.correlation_id,
    } as any;
    await this.logsRepo.create(row);
    await this['publishEvent']('agent.log.received', { id: row.id, level: row.level });
  }

  private async handleQueryLogs(message: AgentMessage) {
    const p: any = message.payload || {};
    const logs = await this.logsRepo.list({ level: p.level, query: p.query, limit: p.limit });
    await this['publishEvent']('agent.log.query.completed', { count: logs.length });
  }
}

export default LoggerAgent;
