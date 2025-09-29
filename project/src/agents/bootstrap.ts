import 'dotenv/config';
import { createClient, type RedisClientType } from 'redis';
import { loadConfig } from '@api/config';
import { TestWriterAgent, type TestWriterAgentConfig } from './test-writer/TestWriterAgent';
import { LocatorSynthesisAgent, type LocatorSynthesisAgentConfig } from './locator-synthesis/LocatorSynthesisAgent';
import { TestExecutorAgent, type TestExecutorAgentConfig } from './test-executor/TestExecutorAgent';
import { LoggerAgent, type LoggerAgentConfig } from './logger/LoggerAgent';
import { TestOptimizerAgent, type TestOptimizerAgentConfig } from './test-optimizer/TestOptimizerAgent';
import { ReportGeneratorAgent, type ReportGeneratorAgentConfig } from './report-generator/ReportGeneratorAgent';
import { ContextManagerAgent, type ContextManagerAgentConfig } from './context-manager/ContextManagerAgent';
import type BaseAgent from './base/BaseAgent';
import type { AgentMessage } from '@app-types/communication';
import { MessageQueue, type MessageQueueConfig } from '@communication/MessageQueue';

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

  const loggerCfg: LoggerAgentConfig = {
    ...baseAgentCfg,
    agentType: 'Logger',
    retentionDays: parseInt(process.env.LOG_RETENTION_DAYS || '14', 10)
  } as any;
  const loggerAgent = new LoggerAgent(loggerCfg);
  agents.set('Logger', loggerAgent);

  const optCfg: TestOptimizerAgentConfig = {
    ...baseAgentCfg,
    agentType: 'TestOptimizer',
    analysis: { lookbackExecutions: parseInt(process.env.TO_LOOKBACK || '5', 10) }
  } as any;
  const optimizer = new TestOptimizerAgent(optCfg);
  agents.set('TestOptimizer', optimizer);

  const rgCfg: ReportGeneratorAgentConfig = {
    ...baseAgentCfg,
    agentType: 'ReportGenerator',
    outputDir: process.env.RG_OUTPUT_DIR || 'test_execution_reports'
  } as any;
  const reportGen = new ReportGeneratorAgent(rgCfg);
  agents.set('ReportGenerator', reportGen);

  const cmCfg: ContextManagerAgentConfig = {
    ...baseAgentCfg,
    agentType: 'ContextManager',
    namespace: process.env.CM_NAMESPACE || 'ctx'
  } as any;
  const contextMgr = new ContextManagerAgent(cmCfg);
  agents.set('ContextManager', contextMgr);

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

async function startQueueConsumer(mqCfg: MessageQueueConfig, agentMap: Map<string, BaseAgent>) {
  const mq = new MessageQueue(mqCfg);
  await mq.initialize();

  let stopped = false;
  const maxConcurrency = Math.max(1, parseInt(process.env.AGENT_MAX_CONCURRENCY || '4', 10));
  const inFlight = new Set<Promise<void>>();

  const pump = async () => {
    // keep filling up to maxConcurrency
    while (!stopped) {
      try {
        if (inFlight.size >= maxConcurrency) {
          await Promise.race(inFlight);
          continue;
        }
        const msg = await mq.consumeNext();
        if (!msg) continue; // timeout
        const targetType = msg.target?.type;
        const agentKey = normalizeTargetType(targetType || '');
        const agent = agentKey ? agentMap.get(agentKey) : undefined;
        if (!agent) {
          console.warn(`[consumer] No agent for target ${targetType} (normalized: ${agentKey}), failing message`);
          await mq.failMessage(msg.id, msg);
          continue;
        }
        const tracked = (async () => {
          try {
            await agent.handleIncomingMessage(msg);
          } finally {
            // no-op
          }
        })().finally(() => {
          inFlight.delete(tracked);
        });
        inFlight.add(tracked);
      } catch (err) {
        console.error('[consumer] Error in loop:', (err as Error)?.message);
        await new Promise((r) => setTimeout(r, 250));
      }
    }
  };
  const loop = pump();

  return {
    stop: async () => {
      stopped = true;
      const drainMs = Math.max(0, parseInt(process.env.AGENT_SHUTDOWN_DRAIN_MS || '2000', 10));
      const deadline = Date.now() + drainMs;
      // Drain in-flight tasks up to deadline
      while (inFlight.size > 0 && Date.now() < deadline) {
        try { await Promise.race(inFlight); } catch { /* ignore */ }
      }
      try { await loop; } catch { /* ignore */ }
      await mq.close();
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
    case 'logger':
    case 'loggeragent':
      return 'Logger';
    case 'testoptimizer':
    case 'testoptimizeragent':
      return 'TestOptimizer';
    case 'reportgenerator':
    case 'reportgeneratoragent':
      return 'ReportGenerator';
    case 'contextmanager':
    case 'contextmanageragent':
      return 'ContextManager';
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
