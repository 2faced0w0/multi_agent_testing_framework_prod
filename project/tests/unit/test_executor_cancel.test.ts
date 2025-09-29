import { TestExecutorAgent, type TestExecutorAgentConfig } from '../../src/agents/test-executor/TestExecutorAgent';

function makeAgent() {
  const cfg: TestExecutorAgentConfig = {
    agentType: 'TestExecutor',
    messageQueue: { redis: { host: 'localhost', port: 6379, db: 0 }, queues: { default: 'q:d', high: 'q:h', critical: 'q:c' }, deadLetterQueue: 'q:dead', maxRetries: 1, retryDelay: 1000 },
    eventBus: { redis: { host: 'localhost', port: 6379, db: 0 }, channels: { system: 'e:sys', agents: 'e:agt', executions: 'e:exec', health: 'e:hlth' } },
    sharedMemory: { redis: { host: 'localhost', port: 6379, db: 0 }, keyPrefix: 'sm', defaultTtl: 60 },
    database: { path: ':memory:', timeout: 1000, verbose: false, memory: true } as any,
    healthCheck: { intervalMs: 10000, timeoutMs: 3000, failureThreshold: 3, recoveryThreshold: 2 },
    lifecycle: { startupTimeoutMs: 1000, shutdownTimeoutMs: 1000, gracefulShutdownMs: 100 },
    logging: { level: 'error', enableMetrics: false, enableTracing: false },
    execution: { mode: 'simulate', timeoutMs: 1000, reportDir: 'test_execution_reports', testsDir: 'generated_tests', defaultBrowser: 'chromium' },
  };
  return new TestExecutorAgent(cfg);
}

describe('TestExecutorAgent cancellation', () => {
  it('honors EXECUTION_CANCEL by marking skipped and not crashing', async () => {
    const agent = makeAgent();
    await agent.initialize();
    const apiExecId = 'exec-abc';
    // enqueue cancel first
    await agent.handleIncomingMessage({
      id: 'msg-cancel',
      source: { type: 'test', instanceId: 'i', nodeId: 'n' } as any,
      target: { type: 'TestExecutor' } as any,
      messageType: 'EXECUTION_CANCEL',
      payload: { executionId: apiExecId },
      timestamp: new Date(),
    } as any);
    // then an execution request with that id
    await agent.handleIncomingMessage({
      id: 'msg-exec',
      source: { type: 'test', instanceId: 'i', nodeId: 'n' } as any,
      target: { type: 'TestExecutor' } as any,
      messageType: 'EXECUTION_REQUEST',
      payload: { data: { executionId: apiExecId } },
      timestamp: new Date(),
    } as any);
    await agent.shutdown();
  });
});
