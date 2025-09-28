import { createClient, RedisClientType } from 'redis';
import { SystemEvent } from '@app-types/communication';

export interface EventBusConfig {
  redis: { host: string; port: number; db: number; password?: string };
  channels: { system: string; agents: string; executions: string; health: string };
}

export class EventBus {
  private pub: RedisClientType | null = null;
  private sub: RedisClientType | null = null;
  constructor(private cfg: EventBusConfig) {}

  async initialize(): Promise<void> {
    const url = `redis://${this.cfg.redis.host}:${this.cfg.redis.port}`;
    this.pub = createClient({ url, database: this.cfg.redis.db, password: this.cfg.redis.password });
    this.sub = createClient({ url, database: this.cfg.redis.db, password: this.cfg.redis.password });
    await Promise.all([this.pub.connect(), this.sub.connect()]);
  }

  async publishEvent(e: SystemEvent): Promise<void> {
    if (!this.pub) throw new Error('EventBus not initialized');
    await this.pub.publish(this.cfg.channels.system, JSON.stringify(e));
  }

  async getSubscriptionStats(): Promise<Record<string, number>> {
    // Minimal stub: in prod, track real subscriptions
    return { [this.cfg.channels.system]: 1 };
  }

  async close(): Promise<void> {
    await Promise.all([this.pub?.quit(), this.sub?.quit()]);
    this.pub = this.sub = null;
  }
}
