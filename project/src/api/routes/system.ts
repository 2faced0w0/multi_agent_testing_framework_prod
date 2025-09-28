import { Router, Request, Response } from 'express';
import { MessageQueue } from '@communication/MessageQueue';
import { EventBus } from '@communication/EventBus';
import path from 'path';
import { maybeAuth, maybeRequireRole } from '@api/middleware/auth';

const router = Router();

// Simple health endpoint; can be extended to include DB/Redis checks
router.get('/health', async (_req: Request, res: Response) => {
  const now = new Date();
  res.status(200).json({
    status: 'ok',
    service: 'multi-agent-testing-framework',
    version: '1.0.0',
    timestamp: now.toISOString(),
    uptimeSeconds: process.uptime()
  });
});

// Additional endpoint for messaging health and stats
router.get('/messaging', maybeAuth, maybeRequireRole(['admin', 'ops']), async (_req: Request, res: Response) => {
  try {
    const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require(path.resolve(process.cwd(), 'config', `${env}.json`));
    // Inject Redis overrides from env for secured deployments
    if (process.env.REDIS_PASSWORD) {
      config.messageQueue.redis.password = process.env.REDIS_PASSWORD;
      config.eventBus.redis.password = process.env.REDIS_PASSWORD;
    }

    const mq = new MessageQueue(config.messageQueue);
    await mq.initialize();
    const stats = await mq.getQueueStats();
    await mq.close();

    const eb = new EventBus(config.eventBus);
    await eb.initialize();
    const sub = await eb.getSubscriptionStats();
    await eb.close();

    return res.json({ queues: stats, subscriptions: sub });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to get messaging stats', details: err?.message });
  }
});

// Queue metrics (DB-backed) and event counters
router.get('/metrics/queues', maybeAuth, maybeRequireRole(['admin', 'ops', 'viewer']), async (_req: Request, res: Response) => {
  try {
    const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require(path.resolve(process.cwd(), 'config', `${env}.json`));

    // Prefer global DB if available
    const { getGlobalDatabase, acquireGlobalDatabase } = require('@database/GlobalDatabase');
    let dbm = getGlobalDatabase();
    if (!dbm) {
      dbm = acquireGlobalDatabase(config.database);
      await dbm.initialize();
    }
    const db = dbm.getDatabase();

    const [byPriority, processedCount, unprocessedCount, recentErrors, eventCounts] = await Promise.all([
      db.all(
        `SELECT priority, COUNT(*) as count
         FROM agent_messages
         GROUP BY priority`
      ),
      db.get(`SELECT COUNT(*) as c FROM agent_messages WHERE processed = 1`),
      db.get(`SELECT COUNT(*) as c FROM agent_messages WHERE processed = 0`),
      db.all(
        `SELECT id, message_type as messageType, error_message as errorMessage, timestamp
         FROM agent_messages
         WHERE error_message IS NOT NULL
         ORDER BY datetime(timestamp) DESC
         LIMIT 20`
      ),
      db.all(
        `SELECT event_type as eventType, COUNT(*) as count
         FROM system_events
         GROUP BY event_type
         ORDER BY count DESC
         LIMIT 20`
      )
    ]);

    const priorityMap: Record<string, number> = { low: 0, normal: 0, high: 0, critical: 0 };
    for (const row of byPriority) {
      priorityMap[row.priority] = row.count;
    }

    return res.json({
      agentMessages: {
        byPriority: priorityMap,
        processed: processedCount?.c || 0,
        unprocessed: unprocessedCount?.c || 0,
        recentErrors
      },
      systemEvents: {
        topEventTypes: eventCounts
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to get queue metrics', details: err?.message });
  }
});

// Recent system events endpoint
router.get('/events', maybeAuth, maybeRequireRole(['admin', 'ops', 'viewer']), async (req: Request, res: Response) => {
  try {
    const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const config = require(path.resolve(process.cwd(), 'config', `${env}.json`));

    // Prefer global DB if available to avoid separate connections during tests
    const { getGlobalDatabase, acquireGlobalDatabase } = require('@database/GlobalDatabase');
    let dbm = getGlobalDatabase();
    if (!dbm) {
      dbm = acquireGlobalDatabase(config.database);
      await dbm.initialize();
    }
    const db = dbm.getDatabase();

  const limitCap = parseInt(process.env.API_MAX_EVENTS_LIMIT || '200', 10);
  const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, limitCap);
    const eventType = req.query.type ? String(req.query.type) : undefined;
    const severity = req.query.severity ? String(req.query.severity) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;

    const where: string[] = [];
    const params: any[] = [];
    if (eventType) { where.push('event_type = ?'); params.push(eventType); }
    if (severity) { where.push('severity = ?'); params.push(severity); }
    if (category) { where.push('category = ?'); params.push(category); }

    const sql = `SELECT event_id as eventId, event_type as eventType, version, source_service as sourceService,
                        source_component as sourceComponent, source_instance as sourceInstance, source_version as sourceVersion,
                        timestamp, data, correlation_id as correlationId, causation_id as causationId, tags, severity, category
                 FROM system_events
                 ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY datetime(timestamp) DESC
                 LIMIT ?`;
    params.push(limit);

    const rows = await db.all(sql, params);
    // Parse JSON fields
    const events = rows.map((r: any) => ({
      ...r,
      data: r.data ? JSON.parse(r.data) : {},
      tags: r.tags ? JSON.parse(r.tags) : []
    }));

  // Do not close here to keep global DB alive for the app lifecycle
  return res.json({ events, count: events.length });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch system events', details: err?.message });
  }
});

export default router;
