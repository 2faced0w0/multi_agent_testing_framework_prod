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
import { metrics } from '@monitoring/Metrics';

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

// Mount routes
app.use('/api/v1/system', systemRoutes);
app.use('/api/v1/system', logsRoutes);
app.use('/api/v1/reports', reportsRoutes);
app.use('/api/v1/tests/cases', testCasesRoutes);
app.use('/api/v1/tests/executions', testExecutionsRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/gui', guiRoutes);

// Prometheus metrics exposition
app.get('/metrics', (_req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics.toText());
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
}

export default app;
