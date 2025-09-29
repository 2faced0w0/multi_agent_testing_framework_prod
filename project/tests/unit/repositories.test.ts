import { DatabaseManager } from '../../src/database/DatabaseManager';
import { LogsRepository } from '../../src/database/repositories/LogsRepository';
import { TestCaseRepository } from '../../src/database/repositories/TestCaseRepository';

describe('Repositories basic CRUD', () => {
  const dbm = new DatabaseManager({ path: ':memory:', timeout: 1000, verbose: false, memory: true });

  beforeAll(async () => {
    await dbm.initialize();
  });

  test('LogsRepository.create and list', async () => {
    const repo = new LogsRepository(dbm.getDatabase());
    await repo.create({
      id: 'log-1',
      timestamp: new Date().toISOString(),
      level: 'info',
      message: 'hello',
    } as any);
    const rows = await repo.list({});
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].message).toBe('hello');
  });

  test('TestCaseRepository CRUD', async () => {
    const repo = new TestCaseRepository(dbm.getDatabase());
    const id = 'tc-1';
    const created_at = new Date().toISOString();
    await repo.create({ id, title: 'A', created_at } as any);
    const got = await repo.findById(id);
    expect(got?.title).toBe('A');
    await repo.update({ id, title: 'B' });
    const got2 = await repo.findById(id);
    expect(got2?.title).toBe('B');
    await repo.delete(id);
    const gone = await repo.findById(id);
    expect(gone).toBeNull();
  });
});
