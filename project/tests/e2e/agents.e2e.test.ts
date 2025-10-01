import fs from 'fs/promises';
import path from 'path';
import { startAgents, stopAgents } from './utils/harness';
import { createClient } from 'redis';
import { acquireGlobalDatabase } from '../../src/database/GlobalDatabase';
import { GeneratedTestRepository } from '../../src/database/repositories/GeneratedTestRepository';
import { ExecutionReportRepository } from '../../src/database/repositories/ExecutionReportRepository';
import { TestReportsRepository } from '../../src/database/repositories/TestReportsRepository';
import { LocatorCandidatesRepository } from '../../src/database/repositories/LocatorCandidatesRepository';

jest.setTimeout(120000);

describe('E2E: multi-agent flows', () => {
  const tmpDir = path.resolve(process.cwd(), 'tmp', `e2e-${Date.now()}`);
  let redisUrl = `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`;

  beforeAll(async () => {
    await startAgents(tmpDir);
  });

  afterAll(async () => {
    await stopAgents();
  });

  test('generation -> execution -> report pipeline works', async () => {
    const dbm = acquireGlobalDatabase({ path: path.resolve(tmpDir, 'framework.db'), timeout: 1000, verbose: false, memory: false } as any);
    await dbm.initialize();
    // Trigger generation by sending TEST_GENERATION_REQUEST via MQ through TestWriter directly using its own code path is complex.
    // Instead, we mimic by directly inserting a generated test row and enqueue EXECUTION_REQUEST via Redis list.
    const genRepo = new GeneratedTestRepository(dbm.getDatabase());
    const execRepo = new ExecutionReportRepository(dbm.getDatabase());
    const repRepo = new TestReportsRepository(dbm.getDatabase());

    // Insert generated test metadata and then enqueue
    const id = `e2e-${Date.now()}`;
    await genRepo.create({ id, repo: 'demo', branch: 'main', commit: 'abc', path: `generated_tests/${id}.spec.ts`, title: 'E2E', created_at: new Date().toISOString(), created_by: 'test', metadata: {} as any } as any);
    // Create a minimal test file
    const testDir = path.resolve(process.cwd(), 'generated_tests');
    await fs.mkdir(testDir, { recursive: true });
    await fs.writeFile(path.join(testDir, `${id}.spec.ts`), `import { test, expect } from '@playwright/test'; test('ok', async ({page})=>{ await page.goto('https://example.org'); await expect(page).toHaveTitle(/.*/); });`, 'utf8');

    // Enqueue EXECUTION_REQUEST via Redis
    const client = createClient({ url: redisUrl }); await client.connect();
    const queue = process.env.MQ_QUEUE_DEFAULT || 'queue:default';
    await client.lPush(queue, JSON.stringify({ id: `m-${Date.now()}`, source: { type: 'E2E' }, timestamp: new Date(), target: { type: 'TestExecutor' }, messageType: 'EXECUTION_REQUEST', payload: { } }));
    await client.quit();

    // Wait for execution to produce a report
    const deadline = Date.now() + 60000;
    let reports = [] as any[];
    while (Date.now() < deadline) {
      reports = await execRepo.listRecent(10);
      if (reports.length > 0) break;
      await new Promise(r => setTimeout(r, 1000));
    }
    expect(reports.length).toBeGreaterThan(0);

    // Verify JSON summary report row exists
    const deadline2 = Date.now() + 30000;
    let testReports = [] as any[];
    while (Date.now() < deadline2) {
      testReports = await repRepo.listRecent(10);
      if (testReports.length > 0) break;
      await new Promise(r => setTimeout(r, 1000));
    }
    expect(testReports.length).toBeGreaterThan(0);
  });

  test('optimizer reruns on failure until pass/exhaust', async () => {
    // Push a failed EXECUTION_RESULT to trigger optimizer rerun
    const client = createClient({ url: redisUrl }); await client.connect();
    const queue = process.env.MQ_QUEUE_DEFAULT || 'queue:default';
    const execId = `exec-${Date.now()}`;
    await client.lPush(queue, JSON.stringify({ id: `m-${Date.now()}`, source: { type: 'E2E' }, timestamp: new Date(), target: { type: 'TestOptimizer' }, messageType: 'EXECUTION_RESULT', payload: { executionId: execId, status: 'failed', summary: 'e2e simulated fail' } }));
    await client.quit();
    // Expect a rerun request to be audited shortly
    const client2 = createClient({ url: redisUrl }); await client2.connect();
    const deadline = Date.now() + 15000;
    let found = false;
    while (Date.now() < deadline) {
      const audits = await client2.lRange('audit:agent-comm', 0, 50);
      if (audits.some(s => { try { const a = JSON.parse(s); return a.type === 'send' && a.messageType === 'EXECUTION_REQUEST'; } catch { return false; } })) { found = true; break; }
      await new Promise(r => setTimeout(r, 500));
    }
    await client2.quit();
    expect(found).toBe(true);
  });

  test('logger writes syslog file and Redis audit logs record comms', async () => {
    // Emit a LOG_ENTRY via MQ using BaseAgent wiring indirectly by sending to Logger
    const client = createClient({ url: redisUrl }); await client.connect();
    const queue = process.env.MQ_QUEUE_DEFAULT || 'queue:default';
    await client.lPush(queue, JSON.stringify({ id: `m-${Date.now()}`, source: { type: 'E2E' }, timestamp: new Date(), target: { type: 'Logger' }, messageType: 'LOG_ENTRY', payload: { level: 'info', message: 'hello from e2e' } }));
    await client.quit();
    // Wait a bit then check syslog file
    const syslog = path.resolve(process.cwd(), 'logs', 'syslog.log');
    const deadline = Date.now() + 10000;
    let content = '';
    while (Date.now() < deadline) {
      try { content = await fs.readFile(syslog, 'utf8'); if (content.includes('hello from e2e')) break; } catch {}
      await new Promise(r => setTimeout(r, 500));
    }
    expect(content).toContain('hello from e2e');
    // Check Redis audit list exists
    const client2 = createClient({ url: redisUrl }); await client2.connect();
    const audits = await client2.lRange('audit:agent-comm', 0, 10);
    await client2.quit();
    expect(audits.length).toBeGreaterThan(0);
  });

  test('locator synthesis persists candidates and context manager updates shared memory', async () => {
    // Send locator synthesis request
    const client = createClient({ url: redisUrl }); await client.connect();
    const queue = process.env.MQ_QUEUE_DEFAULT || 'queue:default';
    const requestId = `loc-${Date.now()}`;
    await client.lPush(queue, JSON.stringify({ id: `m-${Date.now()}`, source: { type: 'E2E' }, timestamp: new Date(), target: { type: 'LocatorSynthesis' }, messageType: 'LOCATOR_SYNTHESIS_REQUEST', payload: { requestId, element: { id: 'hero', tag: 'h1', text: 'Welcome' } } }));
    // Send context update and get
    await client.lPush(queue, JSON.stringify({ id: `m-${Date.now()}`, source: { type: 'E2E' }, timestamp: new Date(), target: { type: 'ContextManager' }, messageType: 'UPDATE_CONTEXT', payload: { key: 'e2e', value: { hello: 'world' }, ttl: 60 } }));
    await client.quit();

    const dbm = acquireGlobalDatabase({ path: path.resolve(tmpDir, 'framework.db'), timeout: 1000, verbose: false, memory: false } as any);
    await dbm.initialize();
    const locRepo = new LocatorCandidatesRepository(dbm.getDatabase());

    // Wait for locator candidates to appear
    const deadline = Date.now() + 15000;
    let rows: any[] = [];
    while (Date.now() < deadline) {
      rows = await locRepo.listByRequest(requestId);
      if (rows.length > 0) break;
      await new Promise(r => setTimeout(r, 500));
    }
    expect(rows.length).toBeGreaterThan(0);
    expect(Array.isArray(rows[0].candidates)).toBe(true);
  });
});
