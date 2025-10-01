import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from '@api/config';
import { MessageQueue } from '@communication/MessageQueue';
import type { AgentMessage } from '@app-types/communication';
import { extractChangedFiles, hasUIChanges } from '@api/routes/webhooks_utils';
import { ensureDatabaseInitialized, getDatabaseManager } from '@api/context';
import { WatchedRepoRepository } from '@database/repositories/WatchedRepoRepository';
import { metrics } from '@monitoring/Metrics';

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

  // Enforce JSON content-type
  const contentType = (req.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    metrics.inc('webhook_invalid_content_type_total');
    return res.status(415).json({ error: 'Unsupported Media Type' });
  }

  if (!verifyGitHubSignature(req, secret)) {
    metrics.inc('webhook_invalid_signature_total');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Only handle push events for now
  if (event !== 'push') {
    metrics.inc('webhook_ignored_event_total');
    return res.status(202).json({ status: 'ignored', event });
  }

  const payload: any = req.body || {};
  // Basic schema checks
  if (!payload.repository || !payload.ref || !payload.head_commit) {
    metrics.inc('webhook_invalid_schema_total');
    return res.status(400).json({ error: 'Invalid payload schema' });
  }

  // Optional repository allowlist
  const allowedRepos = (process.env.ALLOWED_REPOS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const repoFullName = payload?.repository?.full_name || '';
  if (allowedRepos.length > 0 && !allowedRepos.includes(repoFullName)) {
    metrics.inc('webhook_repo_disallowed_total');
    return res.status(403).json({ error: 'Repository not allowed' });
  }
  const changedFiles = extractChangedFiles(payload);
  const uiChanged = hasUIChanges(changedFiles);

  if (!uiChanged) {
    return res.status(202).json({ status: 'no-ui-change', delivery, filesConsidered: changedFiles.length });
  }

  const requireWatched = process.env.WEBHOOK_REQUIRE_WATCHED === 'true';
  await ensureDatabaseInitialized();
  const db = getDatabaseManager().getDatabase();
  const watcherRepo = new WatchedRepoRepository(db);
  const fullName = payload?.repository?.full_name || '';
  const watch = await watcherRepo.findByFullName(fullName);
  if (requireWatched && !watch) {
    metrics.inc('webhook_repo_not_watched_total');
    return res.status(202).json({ status: 'ignored-not-watched', delivery, filesConsidered: changedFiles.length });
  }

  // Record last event metadata
  try {
    const meta = {
      delivery,
      event,
      ref: payload?.ref,
      head: payload?.head_commit?.id,
      compare: payload?.compare,
      changedFiles,
      uiChanged,
      receivedAt: new Date().toISOString(),
    };
    if (watch) {
      await db.run(`UPDATE watched_repos SET last_event = ?, updated_at = ? WHERE id = ?`, JSON.stringify(meta), new Date().toISOString(), watch.id);
    }
  } catch {}

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
    metrics.inc('webhook_enqueue_success_total');
    await mq.close();
    return res.status(202).json({ status: 'queued', delivery, messageId: msg.id, files: changedFiles.length });
  } catch (err: any) {
    // Fail-open with acceptance so webhook retries don't hammer us
    metrics.inc('webhook_enqueue_error_total');
    return res.status(202).json({ status: 'accepted-without-queue', delivery, error: err?.message });
  }
});

export default router;
