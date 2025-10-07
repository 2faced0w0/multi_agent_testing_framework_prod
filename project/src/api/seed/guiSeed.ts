import { ensureDatabaseInitialized, getDatabaseManager } from '@api/context';
import { WatchedRepoRepository } from '@database/repositories/WatchedRepoRepository';
import { TestCaseRepository } from '@database/repositories/TestCaseRepository';
import { TestExecutionRepository } from '@database/repositories/TestExecutionRepository';
import { v4 as uuidv4 } from 'uuid';

/**
 * Seed minimal GUI data for local development.
 * Activated only when process.env.SEED_GUI === '1'.
 * Idempotent: will not duplicate if watchers/tests already exist.
 */
export async function seedGuiIfRequested() {
  if (process.env.SEED_GUI !== '1') return;
  try {
    await ensureDatabaseInitialized();
    const db = getDatabaseManager().getDatabase();
    const watcherRepo = new WatchedRepoRepository(db);
    const testCaseRepo = new TestCaseRepository(db);
    const execRepo = new TestExecutionRepository(db);

    const existingWatchers = await watcherRepo.listAll();
    if (existingWatchers.length === 0) {
      await watcherRepo.create({
        id: uuidv4(),
        full_name: 'example/sample-repo',
        default_branch: 'main',
        status: 'active',
        note: 'Seed watcher',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        last_event: null,
      });
    }

    const testCases = await testCaseRepo.list({ limit: 1 });
    if (testCases.length === 0) {
      const now = new Date().toISOString();
      await testCaseRepo.create({
        id: uuidv4(),
        title: 'Seeded login smoke',
        description: 'Auto-seeded test case for dashboard display',
        repo: 'example/sample-repo',
        path: 'playwright-generated/seed-login.pw.ts',
        status: 'active',
        created_at: now,
        updated_at: now,
        created_by: 'seed',
        metadata: { tags: ['seed','smoke'] },
      } as any);
      await testCaseRepo.create({
        id: uuidv4(),
        title: 'Seeded navigation smoke',
        description: 'Auto-seeded secondary test case',
        repo: 'example/sample-repo',
        path: 'playwright-generated/seed-nav.pw.ts',
        status: 'active',
        created_at: now,
        updated_at: now,
        created_by: 'seed',
        metadata: { tags: ['seed','nav'] },
      } as any);
    }

    const recentExecs = await execRepo.getRecentExecutions(1);
    if (recentExecs.length === 0) {
      const id = uuidv4();
      const now = new Date().toISOString();
      await execRepo.create({
        id,
        status: 'passed',
        startTime: now,
        endTime: now,
        browser: 'chromium',
        device: 'Desktop',
        testFiles: JSON.stringify(['playwright-generated/seed-login.pw.ts']),
        metadata: JSON.stringify({ seed: true }),
        created_at: now,
        updated_at: now,
      } as any);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[guiSeed] Seeding failed:', (e as any)?.message);
  }
}
