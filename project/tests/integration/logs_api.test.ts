import request from 'supertest';
import app from '../../src/api/server';
import { acquireGlobalDatabase } from '../../src/database/GlobalDatabase';
import { LogsRepository } from '../../src/database/repositories/LogsRepository';

describe('GET /api/v1/system/logs', () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = 'sqlite://:memory:';
    const dbm = acquireGlobalDatabase({ path: ':memory:', timeout: 1000, verbose: false, memory: true } as any);
    await dbm.initialize();
    const repo = new LogsRepository(dbm.getDatabase());
    await repo.create({ id: 'l1', timestamp: new Date().toISOString(), level: 'info', message: 'hello world' } as any);
  });

  test('returns logs list', async () => {
    const res = await request(app).get('/api/v1/system/logs');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.logs)).toBe(true);
    expect(res.body.logs.length).toBeGreaterThan(0);
  });
});
