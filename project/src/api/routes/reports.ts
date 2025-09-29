import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { maybeAuth, maybeRequireRole } from '@api/middleware/auth';
import { getGlobalDatabase, acquireGlobalDatabase } from '@database/GlobalDatabase';
import { loadConfig } from '@api/config';

const router = Router();

router.get('/', maybeAuth, maybeRequireRole(['admin', 'ops', 'viewer']), async (_req: Request, res: Response) => {
  try {
    const config = loadConfig();
    let dbm = getGlobalDatabase();
    if (!dbm) { dbm = acquireGlobalDatabase(config.database); await dbm.initialize(); }
    const db = dbm.getDatabase();
    const rows = await db.all(`SELECT * FROM test_reports ORDER BY datetime(created_at) DESC LIMIT 200`);
    return res.json({ items: rows });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to list reports', details: err?.message });
  }
});

router.get('/:id/download', maybeAuth, maybeRequireRole(['admin', 'ops', 'viewer']), async (req: Request, res: Response) => {
  try {
    const config = loadConfig();
    let dbm = getGlobalDatabase();
    if (!dbm) { dbm = acquireGlobalDatabase(config.database); await dbm.initialize(); }
    const db = dbm.getDatabase();
    const row = await db.get(`SELECT * FROM test_reports WHERE id = ?`, req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const projectRoot = process.cwd();
    const fullPath = path.resolve(projectRoot, 'project', row.path);
    const data = await fs.readFile(fullPath);
    res.setHeader('Content-Type', row.type === 'json' ? 'application/json' : 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fullPath)}"`);
    return res.send(data);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to download report', details: err?.message });
  }
});

export default router;
