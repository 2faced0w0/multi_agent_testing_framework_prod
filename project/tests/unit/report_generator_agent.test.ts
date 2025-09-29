import { ReportGeneratorAgent } from '../../src/agents/report-generator/ReportGeneratorAgent';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { acquireGlobalDatabase } from '../../src/database/GlobalDatabase';
import { ExecutionReportRepository } from '../../src/database/repositories/ExecutionReportRepository';
import type { AgentMessage } from '../../src/types/communication';

function cfg() {
  return {
    agentType: 'ReportGenerator',
    messageQueue: { redis: { host: 'localhost', port: 6379, db: 0 }, queues: { default: 'q', high: 'qh', critical: 'qc' }, deadLetterQueue: 'dlq', maxRetries: 3, retryDelay: 1000 },
    eventBus: { redis: { host: 'localhost', port: 6379, db: 0 }, channels: { system: 'es', agents: 'ea', executions: 'ee', health: 'eh' } },
    sharedMemory: { redis: { host: 'localhost', port: 6379, db: 0 }, keyPrefix: 't', defaultTtl: 60 },
    database: { path: ':memory:', timeout: 1000, verbose: false, memory: true },
    healthCheck: { intervalMs: 60000, timeoutMs: 1000, failureThreshold: 3, recoveryThreshold: 1 },
    lifecycle: { startupTimeoutMs: 5000, shutdownTimeoutMs: 5000, gracefulShutdownMs: 1000 },
    logging: { level: 'error', enableMetrics: false, enableTracing: false },
    outputDir: 'test_execution_reports'
  } as any;
}

describe('ReportGeneratorAgent', () => {
  beforeAll(async () => {
    const dbm = acquireGlobalDatabase({ path: ':memory:', timeout: 1000, verbose: false, memory: true } as any);
    await dbm.initialize();
    const repo = new ExecutionReportRepository(dbm.getDatabase());
    await repo.create({ id: 'r1', execution_id: 'e1', report_path: 'test_execution_reports/e1.html', summary: 'ok', status: 'passed', created_at: new Date().toISOString(), created_by: 'test' });
  });

  test('generate JSON summary', async () => {
    const agent = new ReportGeneratorAgent(cfg());
    await agent.initialize();
    const msg: AgentMessage = { id: 'm1', timestamp: new Date(), source: { type: 't', instanceId: 'i', nodeId: 'n' }, target: { type: 'ReportGenerator' }, messageType: 'GENERATE_REPORT', payload: { executionId: 'e1' } };
    await agent['processMessage'](msg);
    await agent.shutdown();
  });
});
