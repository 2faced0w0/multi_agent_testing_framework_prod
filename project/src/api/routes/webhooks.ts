import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from '@api/config';
import { MessageQueue } from '@communication/MessageQueue';
import type { AgentMessage } from '@app-types/communication';
import { extractChangedFiles, hasUIChanges } from './webhooks_utils';

const router = Router();

function verifyGitHubSignature(req: Request, secret?: string): boolean {
  if (!secret) return true; // permissive if no secret configured
  const sigHeader = req.header('X-Hub-Signature-256') || '';
  const [algo, signature] = sigHeader.split('=');
  if (algo !== 'sha256' || !signature) return false;
  const body = (req as any).rawBody ?? JSON.stringify(req.body || {});
  const hmac = crypto.createHmac('sha256', secret);
  const digest = hmac.update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    return false;
  }
}

// Ensure we capture raw body for signature validation
export function rawBodySaver(req: any, res: any, buf: Buffer, encoding: BufferEncoding): void {
  if (buf && buf.length) {
    req.rawBody = buf.toString(encoding || 'utf8');
  }
}

router.post('/github', async (req: Request, res: Response) => {
  const event = req.header('X-GitHub-Event') || 'unknown';
  const delivery = req.header('X-GitHub-Delivery') || uuidv4();
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!verifyGitHubSignature(req, secret)) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Only handle push events for now
  if (event !== 'push') {
    return res.status(202).json({ status: 'ignored', event });
  }

  const payload: any = req.body || {};
  const changedFiles = extractChangedFiles(payload);
  const uiChanged = hasUIChanges(changedFiles);

  if (!uiChanged) {
    return res.status(202).json({ status: 'no-ui-change', delivery, filesConsidered: changedFiles.length });
  }

  const cfg = loadConfig();
  const mq = new MessageQueue(cfg.messageQueue);

  const msg: AgentMessage = {
    id: uuidv4(),
    source: { type: 'api', instanceId: 'api-1', nodeId: 'node-1' },
    target: { type: 'TestWriter' },
    timestamp: new Date(),
    messageType: 'TEST_GENERATION_REQUEST',
    priority: 'normal',
    payload: {
      repo: payload?.repository?.full_name || 'unknown',
      branch: payload?.ref || '',
      compareUrl: payload?.compare || '',
      headCommit: payload?.head_commit?.id || '',
      pusher: payload?.pusher?.name || '',
      changedFiles,
    },
  };

  try {
    await mq.initialize();
    await mq.sendMessage(msg);
    await mq.close();
    return res.status(202).json({ status: 'queued', delivery, messageId: msg.id, files: changedFiles.length });
  } catch (err: any) {
    // Fail-open with acceptance so webhook retries don't hammer us
    return res.status(202).json({ status: 'accepted-without-queue', delivery, error: err?.message });
  }
});

export default router;
