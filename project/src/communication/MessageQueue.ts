import { createClient, RedisClientType } from 'redis';
import { AgentMessage } from '@app-types/communication';

export interface MessageQueueConfig {
  redis: { host: string; port: number; db: number; password?: string };
  queues: { default: string; high: string; critical: string };
  deadLetterQueue: string;
  maxRetries: number;
  retryDelay: number;
}

export class MessageQueue {
  private client: RedisClientType | null = null;
  constructor(private cfg: MessageQueueConfig) {}

  async initialize(): Promise<void> {
    const url = `redis://${this.cfg.redis.host}:${this.cfg.redis.port}`;
    this.client = createClient({ url, database: this.cfg.redis.db, password: this.cfg.redis.password });
    await this.client.connect();
  }

  async sendMessage(msg: AgentMessage): Promise<void> {
    if (!this.client) throw new Error('MQ not initialized');
    const key = this.cfg.queues.default;
    await this.client.lPush(key, JSON.stringify(msg));
  }

  async acknowledgeMessage(_id: string): Promise<void> {
    // Stub: a real impl would remove from processing list
  }

  async getQueueStats(): Promise<Record<string, number>> {
    if (!this.client) throw new Error('MQ not initialized');
    const keys = [this.cfg.queues.default, this.cfg.queues.high, this.cfg.queues.critical, this.cfg.deadLetterQueue];
    const lens = await Promise.all(keys.map((k) => this.client!.lLen(k)));
    return Object.fromEntries(keys.map((k, i) => [k, Number(lens[i])])) as Record<string, number>;
  }

  async close(): Promise<void> {
    await this.client?.quit();
    this.client = null;
  }
}
