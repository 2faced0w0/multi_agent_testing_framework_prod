import fs from 'fs/promises';
import path from 'path';
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

describe('TestExecutorAgent (simulate)', () => {
  it('writes a simple HTML report', async () => {
    const tmp = path.resolve(process.cwd(), 'project', 'tmp', 'reports');
    await fs.mkdir(tmp, { recursive: true });
    const agent = makeAgent();
    await agent.initialize();
    const before = Date.now();
    await agent.handleIncomingMessage({
      id: 'msg-1',
      source: { type: 'test', instanceId: 'i', nodeId: 'n' },
      target: { type: 'TestExecutor' },
      timestamp: new Date(),
      messageType: 'EXECUTION_REQUEST',
      payload: {},
    } as any);
  // look for a report created after the message (agent writes under cwd/test_execution_reports)
  const reportDir = path.resolve(process.cwd(), 'test_execution_reports');
    const files = await fs.readdir(reportDir);
    const statMatches: string[] = [];
    for (const f of files) {
      if (!f.endsWith('.html')) continue;
      const s = await fs.stat(path.join(reportDir, f));
      if (s.mtimeMs >= before) statMatches.push(f);
    }
    expect(statMatches.length).toBeGreaterThan(0);
    await agent.shutdown();
  });
});
