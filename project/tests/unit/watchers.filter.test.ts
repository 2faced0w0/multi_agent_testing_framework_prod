import { DatabaseManager } from '../../src/database/DatabaseManager';
import { WatchedRepoRepository } from '../../src/database/repositories/WatchedRepoRepository';

describe('WatchedRepoRepository filters', () => {
  it('filters by status and q substring', async () => {
    const dbm = new DatabaseManager({ path: ':memory:', timeout: 1000, verbose: false, memory: true } as any);
    await dbm.initialize();
    const db = dbm.getDatabase();
    const repo = new WatchedRepoRepository(db);
    await db.run(`INSERT INTO watched_repos (id, full_name, default_branch, status, note, last_event, created_at, updated_at) VALUES
      ('1','owner/app','main','active',NULL,NULL,datetime('now'),datetime('now')),
      ('2','owner/site','main','pending',NULL,NULL,datetime('now'),datetime('now')),
      ('3','acme/app','develop','error',NULL,NULL,datetime('now'),datetime('now'))
    `);

    const all = await repo.listAll();
    expect(all.length).toBe(3);

    const onlyActive = await repo.listAll({ status: 'active' });
    expect(onlyActive.map(r=>r.full_name)).toEqual(['owner/app']);

    const qApp = await repo.listAll({ q: 'app' });
    expect(qApp.map(r=>r.full_name).sort()).toEqual(['acme/app','owner/app']);

    const combo = await repo.listAll({ status: 'pending', q: 'site' });
    expect(combo.map(r=>r.full_name)).toEqual(['owner/site']);
  });
});
