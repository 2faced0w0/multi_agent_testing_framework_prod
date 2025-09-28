import type { MessageQueueConfig } from '@communication/MessageQueue';
import type { EventBusConfig } from '@communication/EventBus';
import type { DatabaseConfig } from '@database/DatabaseManager';

export interface AppConfig {
  messageQueue: MessageQueueConfig;
  eventBus: EventBusConfig;
  database: DatabaseConfig;
}

function num(v: string | undefined, d: number): number {
  const n = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(n) ? n : d;
}

export function loadConfig(): AppConfig {
  const redis = {
    host: process.env.REDIS_HOST || 'localhost',
    port: num(process.env.REDIS_PORT, 6379),
    db: num(process.env.REDIS_DB, 0),
    password: process.env.REDIS_PASSWORD || undefined,
  };

  const messageQueue: MessageQueueConfig = {
    redis,
    queues: {
      default: process.env.MQ_QUEUE_DEFAULT || 'queue:default',
      high: process.env.MQ_QUEUE_HIGH || 'queue:high',
      critical: process.env.MQ_QUEUE_CRITICAL || 'queue:critical',
    },
    deadLetterQueue: process.env.MQ_DLQ || 'queue:dead',
    maxRetries: num(process.env.MQ_MAX_RETRIES, 3),
    retryDelay: num(process.env.MQ_RETRY_DELAY_MS, 5000),
  };

  const eventBus: EventBusConfig = {
    redis,
    channels: {
      system: process.env.EB_CH_SYSTEM || 'events:system',
      agents: process.env.EB_CH_AGENTS || 'events:agents',
      executions: process.env.EB_CH_EXECUTIONS || 'events:executions',
      health: process.env.EB_CH_HEALTH || 'events:health',
    },
  };

  const dbPath = (process.env.DATABASE_URL || './data/framework.db').replace('sqlite://', '');
  const database: DatabaseConfig = {
    path: dbPath,
    timeout: num(process.env.DB_TIMEOUT_MS, 5000),
    verbose: process.env.NODE_ENV === 'development',
    memory: false,
  } as any;

  return { messageQueue, eventBus, database };
}
