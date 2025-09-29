import { Router, Request, Response } from 'express';
import { maybeAuth, maybeRequireRole } from '@api/middleware/auth';
import { getGlobalDatabase, acquireGlobalDatabase } from '@database/GlobalDatabase';
import { loadConfig } from '@api/config';
import { LogsRepository } from '@database/repositories/LogsRepository';

const router = Router();

router.get('/logs', maybeAuth, maybeRequireRole(['admin', 'ops', 'viewer']), async (req: Request, res: Response) => {
  try {
    const config = loadConfig();
    let dbm = getGlobalDatabase();
    if (!dbm) { dbm = acquireGlobalDatabase(config.database); await dbm.initialize(); }
    const db = dbm.getDatabase();
    const repo = new LogsRepository(db);

    const limitCap = parseInt(process.env.API_MAX_LOGS_LIMIT || '500', 10);
    const limit = Math.min(parseInt(String(req.query.limit || '100'), 10) || 100, limitCap);
    const level = req.query.level ? String(req.query.level) : undefined;
    const query = req.query.query ? String(req.query.query) : undefined;

    const logs = await repo.list({ level, query, limit });
    return res.json({ logs, count: logs.length });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch logs', details: err?.message });
  }
});

export default router;
