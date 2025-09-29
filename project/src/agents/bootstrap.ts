import 'dotenv/config';
import { createClient, type RedisClientType } from 'redis';
import { loadConfig } from '@api/config';
import { TestWriterAgent, type TestWriterAgentConfig } from './test-writer/TestWriterAgent';
import { LocatorSynthesisAgent, type LocatorSynthesisAgentConfig } from './locator-synthesis/LocatorSynthesisAgent';
import { TestExecutorAgent, type TestExecutorAgentConfig } from './test-executor/TestExecutorAgent';
import type BaseAgent from './base/BaseAgent';
import type { AgentMessage } from '@app-types/communication';

type ShutdownHandler = () => Promise<void> | void;

async function main(): Promise<void> {
  const appCfg = loadConfig();

  // Build a BaseAgent configuration shared by all agents
  const baseAgentCfg = {
    agentType: 'Bootstrap', // will be overridden per agent
    instanceId: process.env.AGENT_INSTANCE_ID,
    nodeId: process.env.NODE_ID || 'localhost',
    messageQueue: appCfg.messageQueue,
    eventBus: appCfg.eventBus,
    sharedMemory: {
      redis: appCfg.messageQueue.redis,
      keyPrefix: process.env.SM_KEY_PREFIX || 'sm',
      defaultTtl: parseInt(process.env.SM_DEFAULT_TTL || '3600', 10),
    },
    database: appCfg.database,
    healthCheck: {
      intervalMs: parseInt(process.env.AGENT_HEALTH_INTERVAL_MS || '10000', 10),
      timeoutMs: parseInt(process.env.AGENT_HEALTH_TIMEOUT_MS || '3000', 10),
      failureThreshold: parseInt(process.env.AGENT_HEALTH_FAILURES || '3', 10),
      recoveryThreshold: parseInt(process.env.AGENT_HEALTH_RECOVERY || '2', 10),
    },
    lifecycle: {
      startupTimeoutMs: parseInt(process.env.AGENT_STARTUP_TIMEOUT_MS || '20000', 10),
      shutdownTimeoutMs: parseInt(process.env.AGENT_SHUTDOWN_TIMEOUT_MS || '20000', 10),
      gracefulShutdownMs: parseInt(process.env.AGENT_GRACEFUL_MS || '5000', 10),
    },
    logging: {
      level: (process.env.LOG_LEVEL as any) || 'info',
      enableMetrics: process.env.ENABLE_METRICS === 'true',
      enableTracing: process.env.ENABLE_TRACING === 'true',
    },
  } as const;

  // Instantiate agents
  const testWriterCfg: TestWriterAgentConfig = {
    ...baseAgentCfg,
    agentType: 'TestWriter',
    mistral: {
      apiKey: process.env.MISTRAL_API_KEY || '',
      model: process.env.MISTRAL_MODEL || 'mistral-small',
      maxTokens: parseInt(process.env.MISTRAL_MAX_TOKENS || '1024', 10),
      temperature: Number(process.env.MISTRAL_TEMP || 0.2),
      topP: Number(process.env.MISTRAL_TOP_P || 0.95),
    },
    testGeneration: {
      maxRetries: parseInt(process.env.TG_MAX_RETRIES || '2', 10),
      timeoutMs: parseInt(process.env.TG_TIMEOUT_MS || '30000', 10),
      enableOptimization: process.env.TG_ENABLE_OPTIMIZATION === 'true',
      enableValidation: process.env.TG_ENABLE_VALIDATION !== 'false',
      defaultBrowser: (process.env.TG_DEFAULT_BROWSER as any) || 'chromium',
      defaultViewport: {
        width: parseInt(process.env.TG_VP_WIDTH || '1280', 10),
        height: parseInt(process.env.TG_VP_HEIGHT || '800', 10),
      },
    },
    templates: {
      defaultTemplate: process.env.TG_DEFAULT_TEMPLATE || 'basic',
      customTemplates: {},
    },
  };
  const testWriter = new TestWriterAgent(testWriterCfg);

  const agents = new Map<string, BaseAgent>();
  agents.set('TestWriter', testWriter);

  const locatorCfg: LocatorSynthesisAgentConfig = {
    ...baseAgentCfg,
    agentType: 'LocatorSynthesis',
    heuristics: {
      preferDataTestId: process.env.LS_PREFER_DATA_TESTID !== 'false',
      preferRoleSelectors: process.env.LS_PREFER_ROLE === 'true',
    },
  };
  const locatorAgent = new LocatorSynthesisAgent(locatorCfg);
  agents.set('LocatorSynthesis', locatorAgent);

  const execCfg: TestExecutorAgentConfig = {
    ...baseAgentCfg,
    agentType: 'TestExecutor',
    execution: {
      mode: (process.env.TE_MODE as any) || 'simulate',
      timeoutMs: parseInt(process.env.TE_TIMEOUT_MS || '60000', 10),
      reportDir: process.env.TE_REPORT_DIR || 'test_execution_reports',
      testsDir: process.env.TE_TESTS_DIR || 'generated_tests',
      defaultBrowser: (process.env.TE_DEFAULT_BROWSER as any) || 'chromium',
    },
  };
  const testExecutor = new TestExecutorAgent(execCfg);
  agents.set('TestExecutor', testExecutor);

  // Initialize all agents
  await Promise.all(Array.from(agents.values()).map((a) => a.initialize()));

  // Start message consumer loop
  const consumer = await startQueueConsumer(appCfg.messageQueue, agents);

  // Handle graceful shutdown
  const shutdowns: ShutdownHandler[] = [
    async () => consumer.stop(),
    async () => Promise.all(Array.from(agents.values()).map((a) => a.shutdown())).then(() => undefined),
  ];

  const onSignal = async (sig: string) => {
    console.log(`[bootstrap] Caught ${sig}, shutting down...`);
    for (const s of shutdowns) {
      try { await s(); } catch (e) { console.error('[bootstrap] Shutdown step failed', e); }
    }
    process.exit(0);
  };

  process.on('SIGINT', () => onSignal('SIGINT'));
  process.on('SIGTERM', () => onSignal('SIGTERM'));

  console.log('[bootstrap] Agents running. Press Ctrl+C to exit.');
}

async function startQueueConsumer(mqCfg: import('@communication/MessageQueue').MessageQueueConfig, agentMap: Map<string, BaseAgent>) {
  const url = `redis://${mqCfg.redis.host}:${mqCfg.redis.port}`;
  const client: RedisClientType = createClient({ url, database: mqCfg.redis.db, password: mqCfg.redis.password });
  await client.connect();

  let stopped = false;
  const queueKey = mqCfg.queues.default;
  const dlqKey = mqCfg.deadLetterQueue;

  const loop = (async () => {
    while (!stopped) {
      try {
  const result = await client.blPop(queueKey, 5); // seconds
  if (!result) continue; // timeout
  const payload = result.element as string;
        let msg: AgentMessage | null = null;
        try {
          msg = JSON.parse(payload) as AgentMessage;
        } catch (e) {
          console.error('[consumer] Invalid message, sending to DLQ:', (e as Error)?.message);
          await client.lPush(dlqKey, payload);
          continue;
        }

        const targetType = msg.target?.type;
        const agentKey = normalizeTargetType(targetType || '');
        const agent = agentKey ? agentMap.get(agentKey) : undefined;
        if (!agent) {
          console.warn(`[consumer] No agent for target ${targetType} (normalized: ${agentKey}), sending to DLQ`);
          await client.lPush(dlqKey, JSON.stringify({
            error: 'no-agent', original: msg,
          }));
          continue;
        }

        await agent.handleIncomingMessage(msg);
      } catch (err) {
        console.error('[consumer] Error in loop:', (err as Error)?.message);
        // brief backoff
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  })();

  return {
    stop: async () => {
      stopped = true;
      try { await loop; } catch { /* ignore */ }
      await client.quit();
    }
  };
}

function normalizeTargetType(input: string): string | '' {
  if (!input) return '';
  const key = input.toLowerCase().replace(/[^a-z0-9]/g, '');
  switch (key) {
    case 'testwriter':
    case 'testwriteragent':
      return 'TestWriter';
    case 'testexecutor':
    case 'testexecutoragent':
      return 'TestExecutor';
    case 'locatorsynthesis':
    case 'locatorsynthesisagent':
      return 'LocatorSynthesis';
    default:
      return input; // fallback to provided key
  }
}

// Run main only when executed directly
if (require.main === module) {
  main().catch((err) => {
    console.error('[bootstrap] Fatal error:', err);
    process.exit(1);
  });
}

export default main;
