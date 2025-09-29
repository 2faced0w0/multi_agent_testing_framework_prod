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

// Prometheus metrics exposition
app.get('/metrics', (_req, res) => {
  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics.toText());
});

// Root
app.get('/', (_req, res) => res.send('Multi-Agent Testing Framework API'));

// Only start server if executed directly (not during tests importing app)
if (require.main === module) {
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`API server listening on http://localhost:${PORT}`);
  });
}

export default app;
