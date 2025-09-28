import request from 'supertest';
import app from '../../src/api/server';

describe('Smoke: health and metrics', () => {
  it('GET /api/v1/system/health returns 200', async () => {
    const res = await request(app).get('/api/v1/system/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status');
  });

  it('GET /metrics returns text/plain', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/plain');
    expect(res.text).toContain('# HELP');
  });
});
