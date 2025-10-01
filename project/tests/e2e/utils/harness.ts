import path from 'path';
import fs from 'fs/promises';
import main from '../../../src/agents/bootstrap';

export type AgentProcess = { stop: () => Promise<void> };

let stopper: (() => Promise<void>) | null = null;

export async function startAgents(tmpDir: string): Promise<AgentProcess> {
  process.env.DATABASE_URL = path.resolve(tmpDir, 'framework.db');
  process.env.REDIS_PASSWORD = '';
  process.env.TEST_MODE = 'true';
  process.env.MQ_QUEUE_DEFAULT = `queue:default:e2e:${Date.now()}`;
  process.env.MQ_QUEUE_HIGH = `queue:high:e2e:${Date.now()}`;
  process.env.MQ_QUEUE_CRITICAL = `queue:critical:e2e:${Date.now()}`;
  process.env.MQ_DLQ = `queue:dead:e2e:${Date.now()}`;
  process.env.EB_CH_SYSTEM = `events:system:e2e:${Date.now()}`;
  process.env.SM_KEY_PREFIX = `sm:e2e:${Date.now()}`;
  process.env.TE_MODE = process.env.TE_MODE || 'simulate';
  await fs.mkdir(tmpDir, { recursive: true });
  // Run bootstrap; it installs a consumer and returns after initialization; capture stop via process signals simulation
  let stopped = false;
  const origExit = process.exit;
  (process as any).exit = ((code?: number) => { stopped = true; return code as any; }) as any;
  await main();
  (process as any).exit = origExit;
  stopper = async () => {
    if (!stopped) {
      const orig = process.exit;
      try {
        (process as any).exit = (() => undefined) as any; // swallow exit during shutdown
        process.emit('SIGINT');
        const g: any = (global as any).__MATF_SHUTDOWN__;
        if (g?.promise && typeof g.promise.then === 'function') {
          await g.promise;
        } else {
          await new Promise((r) => setTimeout(r, 1500));
        }
      } finally {
        (process as any).exit = orig;
      }
    }
  };
  return { stop: async () => { await stopper?.(); stopper = null; } };
}

export async function stopAgents(): Promise<void> { await stopper?.(); stopper = null; }
