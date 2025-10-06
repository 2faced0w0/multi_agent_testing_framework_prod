import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { MessageQueue, type MessageQueueConfig } from '@communication/MessageQueue';
import { loadConfig } from '@api/config';
import { AgentMessage, AgentIdentifier } from '@app-types/communication';
import { metrics } from '@monitoring/Metrics';

function mqConfig(): MessageQueueConfig { return loadConfig().messageQueue; }

// Helper to send a message and return status breakdown similar to executions route
async function enqueue(message: Omit<AgentMessage,'id'|'timestamp'|'source'>, priority?: string) {
  const mq = new MessageQueue(mqConfig());
  let mqError: string | null = null;
  const full: AgentMessage = {
    id: uuidv4(),
    source: { type: 'api_gateway', instanceId: 'api', nodeId: 'localhost' } as AgentIdentifier,
    timestamp: new Date(),
    priority: (priority as any) || 'normal',
    ...message
  };
  try { await mq.initialize(); await mq.sendMessage(full); await mq.close(); }
  catch (e: any) { mqError = e?.message || 'unknown-mq-error'; }
  return { messageId: full.id, mqError };
}

const router = Router();

// Test Writer: generate a test
router.post('/test-writer/generate', async (req: Request, res: Response) => {
  const { repo, branch, headCommit, changedFiles, compareUrl, priority } = req.body || {};
  const { messageId, mqError } = await enqueue({
    target: { type: 'TestWriter' } as AgentIdentifier,
    messageType: 'TEST_GENERATION_REQUEST',
    payload: { repo, branch, headCommit, changedFiles, compareUrl }
  }, priority);
  const status = mqError ? 'accepted-without-queue' : 'queued';
  metrics.inc('api_agents_test_writer_generate_total');
  return res.status(202).json({ status, messageId, mqError: mqError || undefined });
});

// Locator Synthesis: synthesize locator candidates
router.post('/locator/synthesize', async (req: Request, res: Response) => {
  const { element, context, requestId, priority } = req.body || {};
  const { messageId, mqError } = await enqueue({
    target: { type: 'LocatorSynthesis' } as AgentIdentifier,
    messageType: 'LOCATOR_SYNTHESIS_REQUEST',
    payload: { element, context, requestId }
  }, priority);
  metrics.inc('api_agents_locator_synthesize_total');
  return res.status(202).json({ status: mqError ? 'accepted-without-queue' : 'queued', messageId, mqError: mqError || undefined });
});

// Context Manager: get context key (async event will be emitted)
router.post('/context/get', async (req: Request, res: Response) => {
  const { key, priority } = req.body || {};
  if (!key) return res.status(400).json({ error: 'Missing key' });
  const { messageId, mqError } = await enqueue({
    target: { type: 'ContextManager' } as AgentIdentifier,
    messageType: 'GET_CONTEXT',
    payload: { key }
  }, priority);
  metrics.inc('api_agents_context_get_total');
  return res.status(202).json({ status: mqError ? 'accepted-without-queue' : 'queued', messageId });
});

// Context Manager: update context
router.post('/context/update', async (req: Request, res: Response) => {
  const { key, value, ttl, priority } = req.body || {};
  if (!key) return res.status(400).json({ error: 'Missing key' });
  const { messageId, mqError } = await enqueue({
    target: { type: 'ContextManager' } as AgentIdentifier,
    messageType: 'UPDATE_CONTEXT',
    payload: { key, value, ttl }
  }, priority);
  metrics.inc('api_agents_context_update_total');
  return res.status(202).json({ status: mqError ? 'accepted-without-queue' : 'queued', messageId });
});

// Report Generator: force generate summary for executionId
router.post('/report/generate', async (req: Request, res: Response) => {
  const { executionId, priority } = req.body || {};
  if (!executionId) return res.status(400).json({ error: 'Missing executionId' });
  const { messageId, mqError } = await enqueue({
    target: { type: 'ReportGenerator' } as AgentIdentifier,
    messageType: 'GENERATE_REPORT',
    payload: { executionId }
  }, priority);
  metrics.inc('api_agents_report_generate_total');
  return res.status(202).json({ status: mqError ? 'accepted-without-queue' : 'queued', messageId });
});

// Optimizer: run analysis across recent executions
router.post('/optimizer/optimize', async (req: Request, res: Response) => {
  const { priority } = req.body || {};
  const { messageId, mqError } = await enqueue({
    target: { type: 'TestOptimizer' } as AgentIdentifier,
    messageType: 'OPTIMIZE_RECENT',
    payload: {}
  }, priority);
  metrics.inc('api_agents_optimizer_optimize_total');
  return res.status(202).json({ status: mqError ? 'accepted-without-queue' : 'queued', messageId });
});

// Logger: submit a custom log entry
router.post('/logger/log', async (req: Request, res: Response) => {
  const { level, message, context, tags, correlation_id, priority } = req.body || {};
  const { messageId, mqError } = await enqueue({
    target: { type: 'Logger' } as AgentIdentifier,
    messageType: 'LOG_ENTRY',
    payload: { level, message, context, tags, correlation_id }
  }, priority);
  metrics.inc('api_agents_logger_log_total');
  return res.status(202).json({ status: mqError ? 'accepted-without-queue' : 'queued', messageId });
});

// Logger: query logs (async event with count)
router.post('/logger/query', async (req: Request, res: Response) => {
  const { level, query, limit, priority } = req.body || {};
  const { messageId, mqError } = await enqueue({
    target: { type: 'Logger' } as AgentIdentifier,
    messageType: 'QUERY_LOGS',
    payload: { level, query, limit }
  }, priority);
  metrics.inc('api_agents_logger_query_total');
  return res.status(202).json({ status: mqError ? 'accepted-without-queue' : 'queued', messageId });
});

export default router;