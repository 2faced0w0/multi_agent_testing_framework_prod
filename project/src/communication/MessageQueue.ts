import { createClient, RedisClientType } from 'redis';
import { AgentMessage } from '@app-types/communication';
import { metrics } from '@monitoring/Metrics';

export interface MessageQueueConfig {
  redis: { host: string; port: number; db: number; password?: string };
  queues: { default: string; high: string; critical: string };
  deadLetterQueue: string;
  maxRetries: number;
  retryDelay: number;
}

export class MessageQueue {
  private client: RedisClientType | null = null;
  private processingPrefix = 'processing:';
  private attemptsPrefix = 'attempts:';
  private idempotencyPrefix = 'idem:';
  constructor(private cfg: MessageQueueConfig) {}

  async initialize(): Promise<void> {
    const url = `redis://${this.cfg.redis.host}:${this.cfg.redis.port}`;
    this.client = createClient({ url, database: this.cfg.redis.db, password: this.cfg.redis.password });
    await this.client.connect();
  }

  async sendMessage(msg: AgentMessage & { idempotencyKey?: string }): Promise<void> {
    if (!this.client) throw new Error('MQ not initialized');
    // Idempotency guard
    if (msg.idempotencyKey) {
      const idemKey = this.idempotencyPrefix + msg.idempotencyKey;
      const wasSet = await this.client.set(idemKey, '1', { NX: true, PX: 1000 * 60 * 60 }); // 1h
      if (wasSet !== 'OK') return; // duplicate, drop silently
    }
    // Priority routing
    const pri = (msg.priority || 'normal') as any;
    const queue = pri === 'critical' ? this.cfg.queues.critical : pri === 'high' ? this.cfg.queues.high : this.cfg.queues.default;
    await this.client.lPush(queue, JSON.stringify({ ...msg, enqueuedAt: Date.now() }));
    metrics.inc('mq_enqueue_total');
  }

  async acknowledgeMessage(messageId: string): Promise<void> {
    if (!this.client) throw new Error('MQ not initialized');
    await this.client.del(this.processingPrefix + messageId);
    await this.client.del(this.attemptsPrefix + messageId);
    metrics.inc('mq_ack_total');
  }

  // BLPOP with retry and DLQ handling for a set of queues in priority order
  async consumeNext(queues?: string[], timeoutSeconds = 5): Promise<AgentMessage | null> {
    if (!this.client) throw new Error('MQ not initialized');
    const keys = queues && queues.length ? queues : [this.cfg.queues.critical, this.cfg.queues.high, this.cfg.queues.default];
    const res = await this.client.blPop(keys, timeoutSeconds);
  if (!res) return null;
    const { key, element } = res as any;
    const msg: AgentMessage & { id?: string } = JSON.parse(element);
    const messageId = msg.id || `${Date.now()}-${Math.random()}`;
    await this.client.set(this.processingPrefix + messageId, JSON.stringify({ key, element, startedAt: Date.now() }), { PX: 1000 * 60 * 10 });
    // track attempts
    const attemptsKey = this.attemptsPrefix + messageId;
    const attempts = Number((await this.client.incr(attemptsKey)) || 1);
    await this.client.expire(attemptsKey, 60 * 60);
    (msg as any)._mq = { messageId, attempts, sourceQueue: key };
    metrics.inc('mq_consume_total');
    return msg as AgentMessage;
  }

  async failMessage(messageId: string, msg: AgentMessage): Promise<void> {
    if (!this.client) throw new Error('MQ not initialized');
    const attemptsKey = this.attemptsPrefix + messageId;
    const attempts = Number((await this.client.get(attemptsKey)) || 1);
    if (attempts >= this.cfg.maxRetries) {
      await this.client.lPush(this.cfg.deadLetterQueue, JSON.stringify({ msg, failedAt: Date.now(), attempts }));
      metrics.inc('mq_dlq_total');
      await this.acknowledgeMessage(messageId);
      return;
    }
    // exponential backoff using a delay list + worker-side polling could be added; here we simple requeue
    const pri = (msg.priority || 'normal') as any;
    const queue = pri === 'critical' ? this.cfg.queues.critical : pri === 'high' ? this.cfg.queues.high : this.cfg.queues.default;
    await this.client.lPush(queue, JSON.stringify({ ...msg, retriedAt: Date.now(), attempts }));
    metrics.inc('mq_retry_total');
    await this.client.del(this.processingPrefix + messageId);
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
