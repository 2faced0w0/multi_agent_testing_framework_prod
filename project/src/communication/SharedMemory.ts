import { createClient, RedisClientType } from 'redis';

export interface SharedMemoryConfig {
  redis: { host: string; port: number; db: number; password?: string };
  keyPrefix: string;
  defaultTtl: number; // seconds
}

export class SharedMemory {
  private client: RedisClientType | null = null;
  constructor(private cfg: SharedMemoryConfig) {}

  async initialize(): Promise<void> {
    const url = `redis://${this.cfg.redis.host}:${this.cfg.redis.port}`;
    this.client = createClient({ url, database: this.cfg.redis.db, password: this.cfg.redis.password });
    await this.client.connect();
  }

  async set<T>(key: string, value: T, ttlSec?: number): Promise<void> {
    if (!this.client) throw new Error('SharedMemory not initialized');
    const k = `${this.cfg.keyPrefix}:${key}`;
    const v = JSON.stringify(value);
    if (ttlSec || this.cfg.defaultTtl > 0) {
      await this.client.set(k, v, { EX: ttlSec || this.cfg.defaultTtl });
    } else {
      await this.client.set(k, v);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    if (!this.client) throw new Error('SharedMemory not initialized');
    const k = `${this.cfg.keyPrefix}:${key}`;
    const v = await this.client.get(k);
    return v ? (JSON.parse(v) as T) : null;
  }

  async getConnectionStats(): Promise<{ mode: string }> {
    return { mode: 'redis' };
  }

  async close(): Promise<void> {
    await this.client?.quit();
    this.client = null;
  }
}
