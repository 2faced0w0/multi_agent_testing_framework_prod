import 'dotenv/config';
import 'module-alias/register';
import 'tsconfig-paths/register';
import { TestExecutorAgent, type TestExecutorAgentConfig } from '../src/agents/test-executor/TestExecutorAgent';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  const execCfg: TestExecutorAgentConfig = {
    agentType: 'TestExecutor',
    instanceId: `texec-inline-${Date.now()}`,
    nodeId: 'local-inline',
    messageQueue: { redis: { host: 'localhost', port: 6379, db: 0 }, queues: { default: 'q:def', high: 'q:hi', critical: 'q:crit' }, deadLetterQueue: 'q:dlq', maxRetries: 0, retryDelay: 1000 },
    eventBus: { redis: { host: 'localhost', port: 6379, db: 0 }, channels: { system: 'ev:sys', agents: 'ev:agt', executions: 'ev:exec', health: 'ev:hlth' } },
    sharedMemory: { redis: { host: 'localhost', port: 6379, db: 0 }, keyPrefix: 'framework:shared', defaultTtl: 300 },
    database: { path: './data/framework.db', timeout: 5000, verbose: false, memory: false },
    healthCheck: { intervalMs: 30000, timeoutMs: 5000, failureThreshold: 3, recoveryThreshold: 2 },
    lifecycle: { startupTimeoutMs: 60000, shutdownTimeoutMs: 30000, gracefulShutdownMs: 10000 },
    logging: { level: 'info', enableMetrics: false, enableTracing: false },
    execution: {
      mode: 'playwright-cli',
      timeoutMs: 90000,
      reportDir: 'test_execution_reports',
      testsDir: 'playwright-generated',
      defaultBrowser: 'chromium',
      pipeline: { browsers: ['chromium'], headless: true, retries: 0, workers: 1 }
    }
  };

  const agent = new TestExecutorAgent(execCfg);
  await agent.initialize();

  // Craft an EXECUTION_REQUEST directly
  const executionId = uuidv4();
  const message: any = {
    id: uuidv4(),
    source: { type: 'inline', instanceId: 'exec', nodeId: 'local' },
    target: { type: 'TestExecutor' },
    timestamp: new Date(),
    messageType: 'EXECUTION_REQUEST',
    payload: {
      executionId,
      grep: 'AdminHeader',
      testFilePath: 'playwright-generated/manual-sample.pw.ts'
    }
  };

  console.log('Dispatching EXECUTION_REQUEST for manual-sample.pw.ts ...');
  await agent['processMessage'](message);
  console.log('Execution complete. Check test_execution_reports for HTML report (playwright index).');

  await agent.shutdown();
}

main().catch(e => { console.error(e); process.exit(1); });
