import { Router, Request, Response } from 'express';
import { maybeAuth, maybeRequireRole } from '@api/middleware/auth';
import { ensureDatabaseInitialized, getDatabaseManager } from '@api/context';
import { WatchedRepoRepository } from '@database/repositories/WatchedRepoRepository';
import { ExecutionReportRepository } from '@database/repositories/ExecutionReportRepository';
import { TestExecutionRepository } from '@database/repositories/TestExecutionRepository';
import { TestCaseRepository } from '@database/repositories/TestCaseRepository';
import { ArtifactsRepository } from '@database/repositories/ArtifactsRepository';
import archiver from 'archiver';
import path from 'path';
import fs from 'fs';
import { loadConfig } from '@api/config';
import { MessageQueue } from '@communication/MessageQueue';
import type { AgentMessage } from '@app-types/communication';
import { v4 as uuidv4 } from 'uuid';
import { metrics } from '@monitoring/Metrics';
import send from 'send';

const router = Router();

function parseRepoUrl(url: string): { owner: string; repo: string } | null {
  try {
    const u = new URL(url);
    if (u.hostname !== 'github.com') return null;
    const parts = u.pathname.replace(/^\//, '').split('/');
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1].replace(/\.git$/, '') };
  } catch {
    return null;
  }
}

// List watchers
router.get('/watchers', maybeAuth, maybeRequireRole(['admin','ops','viewer']), async (req: Request, res: Response) => {
  await ensureDatabaseInitialized();
  const db = getDatabaseManager().getDatabase();
  const repo = new WatchedRepoRepository(db);
  const { status, q } = (req.query || {}) as any;
  const items = await repo.listAll({ status: status as string | undefined, q: q as string | undefined });
  return res.json({ items });
});

// Create watcher from URL
router.post('/watchers', maybeAuth, maybeRequireRole(['admin','ops']), async (req: Request, res: Response) => {
  const { repoUrl, branch, note } = req.body || {};
  if (!repoUrl) return res.status(400).json({ error: 'Missing repoUrl' });
  const parsed = parseRepoUrl(repoUrl);
  if (!parsed) return res.status(400).json({ error: 'Invalid GitHub repo URL' });
  await ensureDatabaseInitialized();
  const db = getDatabaseManager().getDatabase();
  const repo = new WatchedRepoRepository(db);
  const fullName = `${parsed.owner}/${parsed.repo}`;
  const exists = await repo.findByFullName(fullName);
  if (exists) return res.status(200).json({ item: exists, existed: true });
  const item = await repo.create({
    id: uuidv4(),
    full_name: fullName,
    default_branch: branch || 'main',
    status: 'pending',
    note: note || '',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    last_event: null,
  });
  return res.status(201).json({ item });
});

// Manually trigger analysis + test generation for a watcher
router.post('/watchers/:id/run', maybeAuth, maybeRequireRole(['admin','ops']), async (req: Request, res: Response) => {
  await ensureDatabaseInitialized();
  const db = getDatabaseManager().getDatabase();
  const repoRepo = new WatchedRepoRepository(db);
  const item = await repoRepo.findById(req.params.id);
  if (!item) return res.status(404).json({ error: 'Watcher not found' });

  const cfg = loadConfig();
  const mq = new MessageQueue(cfg.messageQueue);
  const msg: AgentMessage = {
    id: uuidv4(),
    source: { type: 'api', instanceId: 'api-1', nodeId: 'node-1' },
    target: { type: 'TestWriter' },
    timestamp: new Date(),
    messageType: 'TEST_GENERATION_REQUEST',
    priority: 'high',
    payload: {
      repo: item.full_name,
      branch: item.default_branch,
      reason: 'manual-trigger',
    },
  };
  try {
    await mq.initialize();
    await mq.sendMessage(msg);
    await mq.close();
    return res.status(202).json({ status: 'queued', messageId: msg.id });
  } catch (err: any) {
    return res.status(202).json({ status: 'accepted-without-queue', error: err?.message });
  }
});

// Remove/disengage a watcher
router.delete('/watchers/:id', maybeAuth, maybeRequireRole(['admin','ops']), async (req: Request, res: Response) => {
  try {
    await ensureDatabaseInitialized();
    const db = getDatabaseManager().getDatabase();
    const repo = new WatchedRepoRepository(db);
    const existing = await repo.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Watcher not found' });
    const changes = await repo.deleteById(req.params.id);
    metrics.inc('api_gui_watchers_delete_total');
    return res.json({ removed: changes > 0 });
  } catch (err: any) {
    metrics.inc('api_gui_watchers_delete_errors_total');
    return res.status(500).json({ error: 'Failed to remove watcher', details: err?.message });
  }
});

// Dashboard summary
router.get('/dashboard', maybeAuth, maybeRequireRole(['admin','ops','viewer']), async (_req: Request, res: Response) => {
  await ensureDatabaseInitialized();
  const db = getDatabaseManager().getDatabase();
  const execRepo = new TestExecutionRepository(db);
  const reportRepo = new ExecutionReportRepository(db);
  const testCaseRepo = new TestCaseRepository(db);
  const watcherRepo = new WatchedRepoRepository(db);

  const [executions, reports, tests, watchers, execCount] = await Promise.all([
    execRepo.getRecentExecutions(10),
    reportRepo.listRecent(10),
    testCaseRepo.list({ limit: 10 }),
    watcherRepo.listAll(),
    execRepo.countAll(),
  ]);

  const totals = {
    executions: execCount,
    reports: (reports as any[]).length,
    tests: (tests as any[]).length,
    watchers: watchers.length,
  } as any;

  return res.json({ totals, executions, reports, tests, watchers });
});

// Runtime/queue/execution status for dashboard live section
router.get('/runtime', maybeAuth, maybeRequireRole(['admin','ops','viewer']), async (_req: Request, res: Response) => {
  await ensureDatabaseInitialized();
  const db = getDatabaseManager().getDatabase();
  const execRepo = new TestExecutionRepository(db);
  let queues: Record<string, number> | null = null;
  try {
    const cfg = loadConfig();
    const mq = new MessageQueue(cfg.messageQueue);
    await mq.initialize();
    queues = await mq.getQueueStats();
    await mq.close();
  } catch {
    queues = null; // fail-open if Redis unavailable
  }
  const recent = await execRepo.getRecentExecutions(200);
  const running = recent.filter((e: any) => e.status === 'running');
  const queued = recent.filter((e: any) => e.status === 'queued');
  const counts = recent.reduce((acc: any, e: any) => { acc[e.status] = (acc[e.status]||0)+1; return acc; }, {} as Record<string, number>);
  return res.json({ queues, counts, running: running.slice(0, 20), queued: queued.slice(0, 20) });
});

// Reset/clear all queues & DLQ (admin/ops only)
router.post('/runtime/reset-queues', maybeAuth, maybeRequireRole(['admin','ops']), async (_req: Request, res: Response) => {
  try {
    const cfg = loadConfig();
    const mq = new MessageQueue(cfg.messageQueue);
    await mq.initialize();
    const result = await mq.resetAll();
    await mq.close();
    metrics.inc('api_gui_runtime_reset_queues_total');
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    metrics.inc('api_gui_runtime_reset_queues_errors_total');
    return res.status(500).json({ ok: false, error: err?.message || 'failed' });
  }
});

// Server-Sent Events stream for runtime updates
router.get('/runtime/stream', maybeAuth, maybeRequireRole(['admin','ops','viewer']), async (req: Request, res: Response) => {
  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let closed = false;
  req.on('close', () => { closed = true; });

  const send = (event: string, data: any) => {
    try {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    } catch { /* ignore */ }
  };

  // periodic push
  const intervalMs = 2000;
  const tick = async () => {
    if (closed) return;
    try {
      await ensureDatabaseInitialized();
      const db = getDatabaseManager().getDatabase();
      const execRepo = new TestExecutionRepository(db);
      let queues: Record<string, number> | null = null;
      try {
        const cfg = loadConfig();
        const mq = new MessageQueue(cfg.messageQueue);
        await mq.initialize();
        queues = await mq.getQueueStats();
        await mq.close();
      } catch { queues = null; }
      const recent = await execRepo.getRecentExecutions(200);
      const running = recent.filter((e: any) => e.status === 'running');
      const queued = recent.filter((e: any) => e.status === 'queued');
      const counts = recent.reduce((acc: any, e: any) => { acc[e.status] = (acc[e.status]||0)+1; return acc; }, {} as Record<string, number>);
      send('runtime', { queues, counts, running: running.slice(0, 20), queued: queued.slice(0, 20) });
    } catch (e: any) {
      send('error', { message: e?.message || 'tick-failed' });
    }
  };

  // heartbeats so proxies keep connection open
  const heart = setInterval(() => { if (!closed) res.write(':heartbeat\n\n'); }, 15000);
  const poll = setInterval(() => { void tick(); }, intervalMs);
  // initial push
  void tick();

  // cleanup when closed
  req.on('close', () => { clearInterval(poll); clearInterval(heart); try { res.end(); } catch {} });
});

export default router;

// Execution details
router.get('/executions/:id', maybeAuth, maybeRequireRole(['admin','ops','viewer']), async (req: Request, res: Response) => {
  await ensureDatabaseInitialized();
  const db = getDatabaseManager().getDatabase();
  const execRepo = new TestExecutionRepository(db);
  const repRepo = new ExecutionReportRepository(db);
  const artRepo = new ArtifactsRepository(db);
  const exec = await execRepo.findById(req.params.id);
  if (!exec) return res.status(404).json({ error: 'Not found' });
  const [reports, artifacts] = await Promise.all([
    repRepo.listByExecution(req.params.id),
    artRepo.listByExecution(req.params.id),
  ]);
  return res.json({ execution: exec, reports, artifacts });
});

// Download artifacts as a zip
router.get('/executions/:id/artifacts.zip', maybeAuth, maybeRequireRole(['admin','ops','viewer']), async (req: Request, res: Response) => {
  await ensureDatabaseInitialized();
  const db = getDatabaseManager().getDatabase();
  const artRepo = new ArtifactsRepository(db);
  const arts = await artRepo.listByExecution(req.params.id);

  // Resolve files relative to project dir and restrict to known folders
  const projectRoot = process.cwd();
  const allowRoots = [
    path.resolve(projectRoot, 'test_execution_reports'),
    path.resolve(projectRoot, 'generated_tests'),
    path.resolve(projectRoot, 'logs'),
  ];

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="artifacts-${req.params.id}.zip"`);
  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (_err: any) => { try { res.status(500).end(); } catch {} });
  archive.pipe(res);

  for (const a of arts) {
  const abs = path.resolve(projectRoot, a.path);
    if (!allowRoots.some((root) => abs.startsWith(root + path.sep))) continue; // skip outside
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      archive.file(abs, { name: path.join(req.params.id, path.basename(abs)) });
    }
  }
  await archive.finalize();
});

// Resolve an execution_report by id (for GUI viewers)
router.get('/reports/:id', maybeAuth, maybeRequireRole(['admin','ops','viewer']), async (req: Request, res: Response) => {
  await ensureDatabaseInitialized();
  const db = getDatabaseManager().getDatabase();
  const repRepo = new ExecutionReportRepository(db);
  const row = await repRepo.findById(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  return res.json({ report: row });
});

// Download an execution_report payload (HTML/JSON) by id
router.get('/reports/:id/download', maybeAuth, maybeRequireRole(['admin','ops','viewer']), async (req: Request, res: Response) => {
  await ensureDatabaseInitialized();
  const db = getDatabaseManager().getDatabase();
  const repRepo = new ExecutionReportRepository(db);
  const row: any = await repRepo.findById(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const projectRoot = process.cwd();
  const abs = path.resolve(projectRoot, row.report_path);
  return send(req, abs).pipe(res);
});

// Toggle/update a watcher status (soft deactivate/activate)
router.patch('/watchers/:id', maybeAuth, maybeRequireRole(['admin','ops']), async (req: Request, res: Response) => {
  try {
    const { status } = req.body || {};
    const allowed = new Set(['active','inactive','pending','error']);
    if (!status || !allowed.has(String(status))) return res.status(400).json({ error: 'Invalid status' });
    await ensureDatabaseInitialized();
    const db = getDatabaseManager().getDatabase();
    const repo = new WatchedRepoRepository(db);
    const existing = await repo.findById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Watcher not found' });
    await repo.updateStatus(req.params.id, status);
    metrics.inc('api_gui_watchers_patch_total');
    return res.json({ id: req.params.id, status });
  } catch (err: any) {
    metrics.inc('api_gui_watchers_patch_errors_total');
    return res.status(500).json({ error: 'Failed to update watcher', details: err?.message });
  }
});