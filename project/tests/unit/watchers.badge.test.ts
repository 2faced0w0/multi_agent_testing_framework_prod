import { WatchedRepoRepository } from '../../src/database/repositories/WatchedRepoRepository';
import { DatabaseManager } from '../../src/database/DatabaseManager';

describe('Watcher last_event uiChanged parsing', () => {
  it('stores and reads uiChanged flag from last_event JSON', async () => {
    const dbm = new DatabaseManager({ path: ':memory:', timeout: 1000, verbose: false, memory: true } as any);
    await dbm.initialize();
    const db = dbm.getDatabase();
    const repo = new WatchedRepoRepository(db);
    await db.run(`INSERT INTO watched_repos (id, full_name, default_branch, status, note, last_event, created_at, updated_at)
      VALUES ('1','owner/repo','main','active',NULL,NULL,datetime('now'),datetime('now'))`);
    const meta = { uiChanged: true };
    await db.run(`UPDATE watched_repos SET last_event = ? WHERE id = '1'`, JSON.stringify(meta));
    const w = await repo.findById('1');
    expect(w).toBeTruthy();
    const parsed = JSON.parse((w as any).last_event || '{}');
    expect(parsed.uiChanged).toBe(true);
  });
});
