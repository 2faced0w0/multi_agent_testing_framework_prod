import request from 'supertest';
import app from '../../src/api/server';

describe('GUI routes', () => {
  it('GET /api/v1/gui/dashboard returns 200 and json (or 401 if auth enforced)', async () => {
    const res = await request(app).get('/api/v1/gui/dashboard');
    expect([200, 401]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body).toHaveProperty('totals');
      expect(res.body).toHaveProperty('executions');
      expect(res.body).toHaveProperty('watchers');
    }
  });

  it('POST /api/v1/gui/watchers validates repoUrl', async () => {
    const res = await request(app).post('/api/v1/gui/watchers').send({});
    expect([400, 401]).toContain(res.status);
  });
});
