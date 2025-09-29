import { TestOptimizerAgent } from '../../src/agents/test-optimizer/TestOptimizerAgent';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { acquireGlobalDatabase } from '../../src/database/GlobalDatabase';
import type { AgentMessage } from '../../src/types/communication';

function baseCfg() {
  return {
    agentType: 'TestOptimizer',
    messageQueue: { redis: { host: 'localhost', port: 6379, db: 0 }, queues: { default: 'q', high: 'qh', critical: 'qc' }, deadLetterQueue: 'dlq', maxRetries: 3, retryDelay: 1000 },
    eventBus: { redis: { host: 'localhost', port: 6379, db: 0 }, channels: { system: 'es', agents: 'ea', executions: 'ee', health: 'eh' } },
    sharedMemory: { redis: { host: 'localhost', port: 6379, db: 0 }, keyPrefix: 't', defaultTtl: 60 },
    database: { path: ':memory:', timeout: 1000, verbose: false, memory: true },
    healthCheck: { intervalMs: 60000, timeoutMs: 1000, failureThreshold: 3, recoveryThreshold: 1 },
    lifecycle: { startupTimeoutMs: 5000, shutdownTimeoutMs: 5000, gracefulShutdownMs: 1000 },
    logging: { level: 'error', enableMetrics: false, enableTracing: false },
  } as any;
}

describe('TestOptimizerAgent', () => {
  beforeAll(async () => {
    // ensure DB initialized
    const dbm = acquireGlobalDatabase({ path: ':memory:', timeout: 1000, verbose: false, memory: true } as any);
    await dbm.initialize();
  });

  test('creates recommendation on failed execution', async () => {
    const agent = new TestOptimizerAgent(baseCfg());
    await agent.initialize();
    const msg: AgentMessage = {
      id: 'm1',
      messageType: 'EXECUTION_RESULT',
      source: { type: 'TestExecutor', instanceId: 'i', nodeId: 'n' },
      target: { type: 'TestOptimizer' },
      timestamp: new Date(),
      payload: { executionId: 'e1', status: 'failed', summary: 'oops' }
    };
    await agent['processMessage'](msg);
    await agent.shutdown();
  });
});
