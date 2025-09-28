import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ensureDatabaseInitialized, getDatabaseManager } from '@api/context';
import { TestExecutionRepository } from '@database/repositories/TestExecutionRepository';
import { MessageQueue } from '@communication/MessageQueue';
import { AgentMessage, AgentIdentifier, MessagePriority } from '@/types/communication';
import { ExecutionStatus } from '@/types/common';

// Load MQ config similarly to DatabaseManager via config json
import path from 'path';
import type { MessageQueueConfig } from '@communication/MessageQueue';

function loadMqConfig(): MessageQueueConfig {
  const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const config = require(path.resolve(process.cwd(), 'config', `${env}.json`));
  const mq: MessageQueueConfig = config.messageQueue;
  // Allow securing Redis via env at runtime
  if (process.env.REDIS_HOST) mq.redis.host = process.env.REDIS_HOST;
  if (process.env.REDIS_PORT) mq.redis.port = parseInt(process.env.REDIS_PORT, 10);
  if (process.env.REDIS_DB) mq.redis.db = parseInt(process.env.REDIS_DB, 10);
  if (process.env.REDIS_PASSWORD) (mq.redis as any).password = process.env.REDIS_PASSWORD;
  return mq;
}

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    await ensureDatabaseInitialized();
    const db = getDatabaseManager().getDatabase();
    const repo = new TestExecutionRepository(db);
    const items = await repo.getRecentExecutions(50);
    return res.json({ items });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to list executions', details: err?.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    await ensureDatabaseInitialized();
    const db = getDatabaseManager().getDatabase();
    const repo = new TestExecutionRepository(db);
    const exec = await repo.findById(req.params.id);
    if (!exec) return res.status(404).json({ error: 'Not found' });
    return res.json(exec);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch execution', details: err?.message });
  }
});

router.post('/', async (req: Request, res: Response) => {
  const { testCaseId, environment, browser, device, priority } = req.body || {};
  const errors: string[] = [];
  if (!testCaseId) errors.push('Missing field: testCaseId');
  if (!environment) errors.push('Missing field: environment');
  if (!browser) errors.push('Missing field: browser');
  if (!device) errors.push('Missing field: device');
  if (errors.length) return res.status(400).json({ error: 'Invalid input', details: errors });

  try {
    await ensureDatabaseInitialized();
    const db = getDatabaseManager().getDatabase();
    const repo = new TestExecutionRepository(db);

    const id = uuidv4();
    const executionId = uuidv4();
    const now = new Date();

    const execution = {
      id,
      testCaseId,
      executionId,
      environment,
      browser,
      device,
      status: 'queued' as ExecutionStatus,
      startTime: now,
      result: { passed: false, assertions: [] },
      artifacts: [],
      logs: [],
      metrics: {
        executionId: id,
        timestamp: now,
        coreWebVitals: { lcp: 0, fid: 0, cls: 0, fcp: 0, ttfb: 0 },
        navigationTiming: { domContentLoaded: 0, loadComplete: 0, firstPaint: 0, firstContentfulPaint: 0, domInteractive: 0 },
        resourceTiming: [],
        customMetrics: [],
        browserMetrics: { memoryUsage: { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 }, cpuUsage: 0, networkRequests: 0, jsErrors: 0, consoleErrors: [] },
        networkMetrics: { totalRequests: 0, failedRequests: 0, totalBytes: 0, averageResponseTime: 0 }
      },
      attemptNumber: 1,
      maxAttempts: 1,
      executedBy: 'api'
    };

    await repo.create(execution as any);

    // Enqueue execution request for Test Executor Agent
    const mq = new MessageQueue(loadMqConfig());
    await mq.initialize();
    const message: AgentMessage = {
      id: uuidv4(),
      source: { type: 'context_manager', instanceId: 'api', nodeId: 'localhost' } as AgentIdentifier,
      target: { type: 'test_executor', instanceId: 'any' } as AgentIdentifier,
      messageType: 'EXECUTION_REQUEST',
      payload: {
        action: 'execute',
        data: {
          testCaseId,
          executionId: id,
          environment,
          browser,
          device
        },
        metadata: {}
      },
      schema: '1.0.0',
      timestamp: new Date(),
      priority: (priority as MessagePriority) || 'normal',
      deliveryMode: 'at_least_once',
      retryPolicy: { maxRetries: 3, retryDelay: 1000, backoffMultiplier: 2 },
      retryCount: 0,
      encrypted: false
    };
    await mq.sendMessage(message);
    await mq.close();

    return res.status(202).json({ id, executionId });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create execution', details: err?.message });
  }
});

export default router;
