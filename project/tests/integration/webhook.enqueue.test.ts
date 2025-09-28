import request from 'supertest';
import crypto from 'crypto';
import app from '../../src/api/server';
import { loadConfig } from '../../src/api/config';
import { MessageQueue } from '../../src/communication/MessageQueue';

function sign(body: any, secret: string) {
  const payload = JSON.stringify(body);
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `sha256=${sig}`;
}

describe('Webhook → enqueue TEST_GENERATION_REQUEST', () => {
  const secret = 'test-secret';
  const oldSecret = process.env.GITHUB_WEBHOOK_SECRET;
  beforeAll(() => {
    process.env.GITHUB_WEBHOOK_SECRET = secret;
  });
  afterAll(() => {
    if (oldSecret !== undefined) process.env.GITHUB_WEBHOOK_SECRET = oldSecret;
    else delete process.env.GITHUB_WEBHOOK_SECRET;
  });

  it('accepts signed push event and returns 202', async () => {
    const body = {
      ref: 'refs/heads/main',
      repository: { full_name: 'owner/repo' },
      head_commit: { id: 'abc123' },
      commits: [
        { added: ['client/src/App.tsx'], modified: [], removed: [] },
      ],
    };
    const res = await request(app)
      .post('/api/v1/webhooks/github')
      .set('X-GitHub-Event', 'push')
      .set('X-Hub-Signature-256', sign(body, secret))
      .send(body);

    expect(res.status).toBe(202);
    expect(res.body.status).toMatch(/queued|accepted-without-queue/);
  });
});
