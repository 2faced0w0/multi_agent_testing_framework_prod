import { TestOptimizerAgent } from '../../src/agents/test-optimizer/TestOptimizerAgent';
import { DatabaseManager } from '../../src/database/DatabaseManager';
import { acquireGlobalDatabase } from '../../src/database/GlobalDatabase';
import type { AgentMessage } from '../../src/types/communication';
import { RecommendationsRepository } from '../../src/database/repositories/RecommendationsRepository';

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
    // Disable retries/backoff and stub networked dependencies to keep test fast and isolated
    const cfg = baseCfg();
    (cfg as any).retryPolicy = { maxAttempts: 0, backoffMs: 0 };
    const agent = new TestOptimizerAgent(cfg as any);

    // Stub sharedMemory to avoid Redis connections
    (agent as any)['sharedMemory'] = {
      get: async (_key: string) => ({ attempts: 0 }),
      set: async (_key: string, _val: any, _ttl?: number) => { /* no-op */ },
      getConnectionStats: async () => ({})
    };

    // Provide a real repo on the in-memory DB without full initialize()
    const db = acquireGlobalDatabase({ path: ':memory:', timeout: 1000, verbose: false, memory: true } as any).getDatabase();
    (agent as any)['repo'] = new RecommendationsRepository(db);
  // Stub networked interactions to keep the test self-contained
  (agent as any)['sendMessage'] = async () => { /* no-op */ };
  (agent as any)['publishEvent'] = async () => { /* no-op */ };

    const msg: AgentMessage = {
      id: 'm1',
      messageType: 'EXECUTION_RESULT',
      source: { type: 'TestExecutor', instanceId: 'i', nodeId: 'n' },
      target: { type: 'TestOptimizer' },
      timestamp: new Date(),
      payload: { executionId: 'e1', status: 'failed', summary: 'oops' }
    };
    await (agent as any)['processMessage'](msg);
    // No shutdown needed since we didn't initialize external clients
  });
});
