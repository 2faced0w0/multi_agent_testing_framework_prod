import { createClient } from 'redis';
import { MessageQueue, type MessageQueueConfig } from '../../src/communication/MessageQueue';

function makeCfg(suffix: string): MessageQueueConfig {
  return {
    redis: { host: '127.0.0.1', port: 6379, db: 0 },
    queues: {
      default: `it:mq:${suffix}:default`,
      high: `it:mq:${suffix}:high`,
      critical: `it:mq:${suffix}:critical`,
    },
    deadLetterQueue: `it:mq:${suffix}:dlq`,
    maxRetries: 1,
    retryDelay: 50,
  };
}

describe('MessageQueue priority and ack/fail', () => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const cfg = makeCfg(suffix);
  const ids = {
    normal: `m-normal-${suffix}`,
    high: `m-high-${suffix}`,
    critical: `m-critical-${suffix}`,
  };

  it('consumes in priority order and routes failures to DLQ', async () => {
    // Clean up any leftovers
    const rc = createClient({ url: `redis://${cfg.redis.host}:${cfg.redis.port}`, database: cfg.redis.db });
    await rc.connect();
  await rc.del([cfg.queues.default, cfg.queues.high, cfg.queues.critical, cfg.deadLetterQueue] as any);

    const mq = new MessageQueue(cfg);
    await mq.initialize();

    const mkMsg = (id: string, priority: 'low'|'normal'|'high'|'critical') => ({
      id,
      source: { type: 'test', instanceId: 'i', nodeId: 'n' },
      target: { type: 'noop' },
      messageType: 'NOOP',
      payload: {},
      timestamp: new Date(),
      priority,
    } as any);

    // Enqueue in reverse-priority insertion to ensure consumer honors queue priority
    await mq.sendMessage(mkMsg(ids.normal, 'normal'));
    await mq.sendMessage(mkMsg(ids.high, 'high'));
    await mq.sendMessage(mkMsg(ids.critical, 'critical'));

    const consumed: string[] = [];

    // First consume should be critical
    const m1 = await mq.consumeNext();
    expect(m1).toBeTruthy();
    consumed.push((m1 as any).id);
    await mq.acknowledgeMessage((m1 as any).id);

    // Second consume should be high; fail it to DLQ
    const m2 = await mq.consumeNext();
    expect(m2).toBeTruthy();
    consumed.push((m2 as any).id);
    await mq.failMessage((m2 as any).id, m2 as any);

    // Third consume should be normal
    const m3 = await mq.consumeNext();
    expect(m3).toBeTruthy();
    consumed.push((m3 as any).id);
    await mq.acknowledgeMessage((m3 as any).id);

    expect(consumed).toEqual([ids.critical, ids.high, ids.normal]);

    const stats = await mq.getQueueStats();
    expect(stats[cfg.deadLetterQueue]).toBe(1);
    expect(stats[cfg.queues.default]).toBe(0);
    expect(stats[cfg.queues.high]).toBe(0);
    expect(stats[cfg.queues.critical]).toBe(0);

    await mq.close();
    await rc.quit();
  }, 15000);
});
