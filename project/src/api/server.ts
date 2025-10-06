import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import systemRoutes from './routes/system';
import testCasesRoutes from './routes/test-cases';
import reportsRoutes from './routes/reports';
import logsRoutes from './routes/logs';
import testExecutionsRoutes from './routes/test-executions';
import webhookRoutes, { rawBodySaver } from './routes/webhooks';
import guiRoutes from './routes/gui';
import agentsRoutes from './routes/agents';
import { metrics } from '@monitoring/Metrics';
// Prom-client metrics
import { register, httpRequestsTotal, httpRequestDuration, httpRequestErrorsTotal, normalizeRoute, queueDepthGauge, executionsRunningGauge, executionsQueuedGauge } from '@monitoring/promMetrics';
import { MessageQueue } from '@communication/MessageQueue';
import { loadConfig } from './config';

const app = express();

app.use(helmet());

// CORS: allow only configured origins when provided
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

if (allowedOrigins.length > 0) {
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('Not allowed by CORS'));
      },
      credentials: true,
    })
  );
} else {
  // Default permissive CORS for development if no origins are set
  app.use(cors());
}

// Optional basic rate limiting (enable via RATE_LIMIT_ENABLED=true)
if (process.env.RATE_LIMIT_ENABLED === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const rateLimit = require('express-rate-limit');
  const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
  const max = parseInt(process.env.RATE_LIMIT_MAX || '300', 10);
  app.use(
    rateLimit({
      windowMs,
      max,
      standardHeaders: true,
      legacyHeaders: false,
    })
  );
}
app.use(express.json({ verify: rawBodySaver }));
app.use(morgan('dev'));

// HTTP metrics middleware (basic; executed after morgan for simplicity)
app.use((req, res, next) => {
  const start = process.hrtime.bigint();
  const method = req.method;
  // Use originalUrl early (may include query) then sanitize path only
  const rawRoute = req.path || req.url || '';
  const route = normalizeRoute(rawRoute) || rawRoute || 'unknown';
  res.on('finish', () => {
    try {
      const status = String(res.statusCode);
      const end = process.hrtime.bigint();
      const durSeconds = Number(end - start) / 1e9;
      httpRequestsTotal.inc({ method, route, status });
      httpRequestDuration.observe({ method, route, status }, durSeconds);
      if (status.startsWith('5')) {
        httpRequestErrorsTotal.inc({ route });
      }
    } catch { /* swallow metric errors */ }
  });
  next();
});

// Mount routes
app.use('/api/v1/system', systemRoutes);
app.use('/api/v1/system', logsRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/tests/cases', testCasesRoutes);
app.use('/api/v1/tests/executions', testExecutionsRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/gui', guiRoutes);
app.use('/api/v1/agents', agentsRoutes);

// Prometheus metrics exposition (legacy + prom-client). Prefer prom-client output; append legacy simple counters.
app.get('/metrics', async (_req, res) => {
  try {
    const promText = await register.metrics();
    const legacy = metrics.toText();
    res.set('Content-Type', register.contentType);
    res.send(promText + '\n# LEGACY_METRICS\n' + legacy);
  } catch (e: any) {
    res.status(500).type('text/plain').send(`# metrics collection error: ${e?.message || 'unknown'}`);
  }
});

// Static dashboard (served from public/)
app.use(express.static('public', { index: ['index.html'] }));
// Read-only static access to generated reports (for HTML viewing)
// Relax CSP only for this route to allow Playwright report's inline scripts/styles
app.use('/reports-static', (_req, res, next) => {
  // Allow inline scripts/styles and data: URIs specifically for reports
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'self'",
    ].join('; ')
  );
  next();
});
app.use('/reports-static', express.static('test_execution_reports'));

// Only start server if executed directly (not during tests importing app)
if (require.main === module) {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API server listening on http://localhost:${PORT}`);
  });

  // Periodic queue depth + execution state sampling
  const cfg = loadConfig();
  const samplerInterval = parseInt(process.env.METRICS_SAMPLER_INTERVAL_MS || '10000', 10);
  const sample = async () => {
    try {
      const mq = new MessageQueue(cfg.messageQueue);
      await mq.initialize();
      const stats = await mq.getQueueStats();
      await mq.close();
      Object.entries(stats || {}).forEach(([q, depth]) => {
        try { queueDepthGauge.set({ queue: q }, depth as number); } catch { /* ignore */ }
      });
    } catch { /* ignore */ }
    // Execution gauges derived from DB recent list (best-effort)
    try {
      const dbm = require('@api/context');
      if (dbm?.ensureDatabaseInitialized) {
        await dbm.ensureDatabaseInitialized();
        const mgr = dbm.getDatabaseManager();
        const rows = await mgr.getDatabase().all(`SELECT status FROM test_executions ORDER BY datetime(startTime) DESC LIMIT 500`);
        const running = rows.filter((r: any) => r.status === 'running').length;
        const queued = rows.filter((r: any) => r.status === 'queued').length;
        executionsRunningGauge.set(running);
        executionsQueuedGauge.set(queued);
      }
    } catch { /* ignore */ }
  };
  setInterval(() => { void sample(); }, samplerInterval);
  void sample();
}

export default app;
