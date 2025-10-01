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