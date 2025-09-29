import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ensureDatabaseInitialized, getDatabaseManager } from '@api/context';
import { TestExecutionRepository } from '@database/repositories/TestExecutionRepository';
import { ExecutionReportRepository } from '@database/repositories/ExecutionReportRepository';
import { MessageQueue } from '@communication/MessageQueue';
import { AgentMessage, AgentIdentifier } from '@app-types/communication';
type MessagePriority = 'low' | 'normal' | 'high' | 'critical';
type ExecutionStatus = 'queued' | 'running' | 'passed' | 'failed' | 'canceled';

// Load MQ config similarly to DatabaseManager via config json
import type { MessageQueueConfig } from '@communication/MessageQueue';
import { loadConfig } from '@api/config';
import { metrics } from '@monitoring/Metrics';

function loadMqConfig(): MessageQueueConfig {
  return loadConfig().messageQueue;
}

const router = Router();

router.get('/', async (_req: Request, res: Response) => {
  try {
    await ensureDatabaseInitialized();
    const db = getDatabaseManager().getDatabase();
    const repo = new TestExecutionRepository(db);
    const items = await repo.getRecentExecutions(50);
    metrics.inc('api_test_exec_list_total');
    return res.json({ items });
  } catch (err: any) {
    metrics.inc('api_test_exec_list_errors_total');
    return res.status(500).json({ error: 'Failed to list executions', details: err?.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    await ensureDatabaseInitialized();
    const db = getDatabaseManager().getDatabase();
    const repo = new TestExecutionRepository(db);
    const exec = await repo.findById(req.params.id);
    if (!exec) { metrics.inc('api_test_exec_get_not_found_total'); return res.status(404).json({ error: 'Not found' }); }
    metrics.inc('api_test_exec_get_total');
    return res.json(exec);
  } catch (err: any) {
    metrics.inc('api_test_exec_get_errors_total');
    return res.status(500).json({ error: 'Failed to fetch execution', details: err?.message });
  }
});

// List execution results/reports
router.get('/:id/results', async (req: Request, res: Response) => {
  try {
    await ensureDatabaseInitialized();
    const db = getDatabaseManager().getDatabase();
    const repo = new ExecutionReportRepository(db);
    const reports = await repo.listByExecution(req.params.id);
    metrics.inc('api_test_exec_results_list_total');
    return res.json({ reports });
  } catch (err: any) {
    metrics.inc('api_test_exec_results_list_errors_total');
    return res.status(500).json({ error: 'Failed to list execution results', details: err?.message });
  }
});

// Fetch a specific report associated to an execution
router.get('/:id/results/:reportId', async (req: Request, res: Response) => {
  try {
    await ensureDatabaseInitialized();
    const db = getDatabaseManager().getDatabase();
    const repo = new ExecutionReportRepository(db);
    const report = await repo.findById(req.params.reportId);
    if (!report || report.execution_id !== req.params.id) { metrics.inc('api_test_exec_results_get_not_found_total'); return res.status(404).json({ error: 'Not found' }); }
    metrics.inc('api_test_exec_results_get_total');
    return res.json(report);
  } catch (err: any) {
    metrics.inc('api_test_exec_results_get_errors_total');
    return res.status(500).json({ error: 'Failed to fetch execution result', details: err?.message });
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

  // Generate IDs and execution payload first so we can fail-open gracefully
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

  let dbError: string | null = null;
  try {
    await ensureDatabaseInitialized();
    const db = getDatabaseManager().getDatabase();
    const repo = new TestExecutionRepository(db);
    await repo.create(execution as any);
  } catch (err: any) {
    dbError = err?.message || 'unknown-db-error';
  }

  // Enqueue execution request for Test Executor Agent (guarded)
  let mqError: string | null = null;
  const mq = new MessageQueue(loadMqConfig());
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
    timestamp: new Date(),
    priority: (priority as MessagePriority) || 'normal'
  };
  try {
    await mq.initialize();
    await mq.sendMessage(message);
    await mq.close();
  } catch (err: any) {
    mqError = err?.message || 'unknown-mq-error';
  }

  // Always accept with 202; report degraded status if any errors occurred
  let status: string = 'queued';
  if (dbError && mqError) status = 'accepted-degraded';
  else if (dbError) status = 'accepted-without-db';
  else if (mqError) status = 'accepted-without-queue';
  metrics.inc(`api_test_exec_enqueue_${status.replace(/-/g, '_')}_total`);
  return res.status(202).json({ id, executionId, status, dbError: dbError || undefined, mqError: mqError || undefined });
});

// Cancel a queued/running execution
router.post('/:id/cancel', async (req: Request, res: Response) => {
  const id = req.params.id;
  let mqError: string | null = null;
  try {
    const mq = new MessageQueue(loadMqConfig());
    await mq.initialize();
    const cancelMsg: AgentMessage = {
      id: uuidv4(),
      source: { type: 'context_manager', instanceId: 'api', nodeId: 'localhost' } as AgentIdentifier,
      target: { type: 'test_executor', instanceId: 'any' } as AgentIdentifier,
      messageType: 'EXECUTION_CANCEL',
      payload: { executionId: id },
      timestamp: new Date(),
      priority: 'high'
    };
    await mq.sendMessage(cancelMsg);
    await mq.close();
  } catch (err: any) {
    mqError = err?.message || 'unknown-mq-error';
  }
  const status = mqError ? 'cancel-accepted-degraded' : 'cancel-accepted';
  metrics.inc(`api_test_exec_cancel_${status.replace(/-/g, '_')}_total`);
  return res.status(202).json({ id, status, mqError: mqError || undefined });
});

export default router;
