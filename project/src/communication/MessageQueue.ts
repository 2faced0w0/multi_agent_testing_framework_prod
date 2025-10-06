import { createClient, RedisClientType } from 'redis';
import { AgentMessage } from '@app-types/communication';
import { metrics } from '@monitoring/Metrics';
import { mqMessagesTotal, queueWaitDuration } from '@monitoring/promMetrics';

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
  private auditListKey = 'audit:agent-comm';
  private auditMaxLen = 1000;
  constructor(private cfg: MessageQueueConfig) {}

  async initialize(): Promise<void> {
    const url = `redis://${this.cfg.redis.host}:${this.cfg.redis.port}`;
    this.client = createClient({ url, database: this.cfg.redis.db, password: this.cfg.redis.password });
    await this.client.connect();
  }

  /**
   * Returns true if the underlying Redis client is connected and open.
   */
  isConnected(): boolean {
    return !!this.client?.isOpen;
  }

  async sendMessage(msg: AgentMessage & { idempotencyKey?: string }): Promise<void> {
    if (!this.client || !this.client.isOpen) throw new Error('MQ not initialized');
    // Idempotency guard
    if (msg.idempotencyKey) {
      const idemKey = this.idempotencyPrefix + msg.idempotencyKey;
      const wasSet = await this.client.set(idemKey, '1', { NX: true, PX: 1000 * 60 * 60 }); // 1h
      if (wasSet !== 'OK') return; // duplicate, drop silently
    }
    // Priority routing
    const pri = (msg.priority || 'normal') as any;
    const queue = pri === 'critical' ? this.cfg.queues.critical : pri === 'high' ? this.cfg.queues.high : this.cfg.queues.default;
    const payload = { ...msg, enqueuedAt: Date.now() };
    await this.client.lPush(queue, JSON.stringify(payload));
    // Audit log
  await this.client.lPush(this.auditListKey, JSON.stringify({ type: 'send', ts: Date.now(), queue, msgId: (msg as any).id, target: msg.target, messageType: (msg as any).messageType }));
    await this.client.lTrim(this.auditListKey, 0, this.auditMaxLen - 1);
  metrics.inc('mq_enqueue_total');
  try { mqMessagesTotal.inc({ action: 'enqueued' }); } catch {}
  }

  async acknowledgeMessage(messageId: string): Promise<void> {
    if (!this.client || !this.client.isOpen) throw new Error('MQ not initialized');
    await this.client.del(this.processingPrefix + messageId);
    await this.client.del(this.attemptsPrefix + messageId);
    await this.client.lPush(this.auditListKey, JSON.stringify({ type: 'ack', ts: Date.now(), messageId }));
    await this.client.lTrim(this.auditListKey, 0, this.auditMaxLen - 1);
  metrics.inc('mq_ack_total');
  try { mqMessagesTotal.inc({ action: 'acked' }); } catch {}
  }

  // BLPOP with retry and DLQ handling for a set of queues in priority order
  async consumeNext(queues?: string[], timeoutSeconds = 5): Promise<AgentMessage | null> {
    if (!this.client || !this.client.isOpen) throw new Error('MQ not initialized');
    const keys = queues && queues.length ? queues : [this.cfg.queues.critical, this.cfg.queues.high, this.cfg.queues.default];
  const res = await this.client.blPop(keys, timeoutSeconds);
  if (!res) return null;
    const { key, element } = res as any;
    const msg: AgentMessage & { id?: string; enqueuedAt?: number } = JSON.parse(element);
    // Observe queue wait if we have the original enqueue timestamp
    if (msg.enqueuedAt && typeof msg.enqueuedAt === 'number') {
      const waitSeconds = (Date.now() - msg.enqueuedAt) / 1000;
      try { queueWaitDuration.observe(waitSeconds); } catch {}
    }
    const messageId = msg.id || `${Date.now()}-${Math.random()}`;
  await this.client.set(this.processingPrefix + messageId, JSON.stringify({ key, element, startedAt: Date.now() }), { PX: 1000 * 60 * 10 });
  await this.client.lPush(this.auditListKey, JSON.stringify({ type: 'consume', ts: Date.now(), queue: key, messageId }));
  await this.client.lTrim(this.auditListKey, 0, this.auditMaxLen - 1);
    // track attempts
    const attemptsKey = this.attemptsPrefix + messageId;
    const attempts = Number((await this.client.incr(attemptsKey)) || 1);
    await this.client.expire(attemptsKey, 60 * 60);
    (msg as any)._mq = { messageId, attempts, sourceQueue: key };
  metrics.inc('mq_consume_total');
  try { mqMessagesTotal.inc({ action: 'consumed' }); } catch {}
    return msg as AgentMessage;
  }

  async failMessage(messageId: string, msg: AgentMessage): Promise<void> {
    if (!this.client || !this.client.isOpen) throw new Error('MQ not initialized');
    const attemptsKey = this.attemptsPrefix + messageId;
    const attempts = Number((await this.client.get(attemptsKey)) || 1);
    if (attempts >= this.cfg.maxRetries) {
      await this.client.lPush(this.cfg.deadLetterQueue, JSON.stringify({ msg, failedAt: Date.now(), attempts }));
      await this.client.lPush(this.auditListKey, JSON.stringify({ type: 'dlq', ts: Date.now(), messageId, attempts }));
      await this.client.lTrim(this.auditListKey, 0, this.auditMaxLen - 1);
  metrics.inc('mq_dlq_total');
  try { mqMessagesTotal.inc({ action: 'dlq' }); } catch {}
      await this.acknowledgeMessage(messageId);
      return;
    }
    // exponential backoff using a delay list + worker-side polling could be added; here we simple requeue
    const pri = (msg.priority || 'normal') as any;
    const queue = pri === 'critical' ? this.cfg.queues.critical : pri === 'high' ? this.cfg.queues.high : this.cfg.queues.default;
    await this.client.lPush(queue, JSON.stringify({ ...msg, retriedAt: Date.now(), attempts }));
    await this.client.lPush(this.auditListKey, JSON.stringify({ type: 'retry', ts: Date.now(), queue, messageId, attempts }));
    await this.client.lTrim(this.auditListKey, 0, this.auditMaxLen - 1);
  metrics.inc('mq_retry_total');
  try { mqMessagesTotal.inc({ action: 'retried' }); } catch {}
    await this.client.del(this.processingPrefix + messageId);
  }

  async getQueueStats(): Promise<Record<string, number>> {
    if (!this.client || !this.client.isOpen) throw new Error('MQ not initialized');
    const keys = [this.cfg.queues.default, this.cfg.queues.high, this.cfg.queues.critical, this.cfg.deadLetterQueue];
    const lens = await Promise.all(keys.map((k) => this.client!.lLen(k)));
    return Object.fromEntries(keys.map((k, i) => [k, Number(lens[i])])) as Record<string, number>;
  }

  async close(): Promise<void> {
    await this.client?.quit();
    this.client = null;
  }

  /**
   * Clear a list by key and return the number of items removed.
   */
  private async clearList(key: string): Promise<number> {
    if (!this.client || !this.client.isOpen) throw new Error('MQ not initialized');
    const len = Number(await this.client.lLen(key));
    await this.client.del(key);
    return len;
  }

  /**
   * Delete keys by scanning with a given prefix. Returns number of deleted keys.
   */
  private async deleteByPrefix(prefix: string): Promise<number> {
    if (!this.client || !this.client.isOpen) throw new Error('MQ not initialized');
    let count = 0;
    for await (const key of this.client.scanIterator({ MATCH: prefix + '*' })) {
      await this.client.del(key as string);
      count++;
    }
    return count;
  }

  /**
   * Reset queues, DLQ, processing, attempts and audit log. Returns before/after stats and counts deleted.
   */
  async resetAll(): Promise<{ before: Record<string, number>; deleted: Record<string, number>; after: Record<string, number> }> {
    if (!this.client || !this.client.isOpen) throw new Error('MQ not initialized');
    const before = await this.getQueueStats();
    const deleted: Record<string, number> = {};
    // Clear queues and DLQ
    deleted[this.cfg.queues.default] = await this.clearList(this.cfg.queues.default);
    deleted[this.cfg.queues.high] = await this.clearList(this.cfg.queues.high);
    deleted[this.cfg.queues.critical] = await this.clearList(this.cfg.queues.critical);
    deleted[this.cfg.deadLetterQueue] = await this.clearList(this.cfg.deadLetterQueue);
    // Clear processing and attempts and audit
    deleted['processing'] = await this.deleteByPrefix(this.processingPrefix);
    deleted['attempts'] = await this.deleteByPrefix(this.attemptsPrefix);
    deleted['audit'] = await this.clearList(this.auditListKey);
    const after = await this.getQueueStats();
    return { before, deleted, after };
  }
}
