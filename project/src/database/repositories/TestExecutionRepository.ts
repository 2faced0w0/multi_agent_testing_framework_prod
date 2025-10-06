import type { Database } from 'sqlite';

export class TestExecutionRepository {
  constructor(private db: Database) {}

  async getRecentExecutions(limit: number) {
    return this.db.all(`SELECT * FROM test_executions ORDER BY datetime(startTime) DESC LIMIT ?`, limit);
  }

  async findById(id: string) {
    return this.db.get(`SELECT * FROM test_executions WHERE id = ?`, id);
  }

  async create(exec: any) {
    await this.db.exec(`CREATE TABLE IF NOT EXISTS test_executions (
      id TEXT PRIMARY KEY,
      testCaseId TEXT,
      executionId TEXT,
      environment TEXT,
      browser TEXT,
      device TEXT,
      status TEXT,
      progress REAL,
      startTime TEXT,
      result TEXT,
      artifacts TEXT,
      logs TEXT,
      metrics TEXT,
      attemptNumber INTEGER,
      maxAttempts INTEGER,
      executedBy TEXT
    );`);
    // Ensure 'progress' column exists for legacy DBs
    try {
      const cols: any[] = await (this.db as any).all(`PRAGMA table_info('test_executions')`);
      const hasProgress = Array.isArray(cols) && cols.some((c: any) => String(c.name) === 'progress');
      if (!hasProgress) {
        await this.db.exec(`ALTER TABLE test_executions ADD COLUMN progress REAL DEFAULT 0`);
      }
    } catch {
      // ignore
    }
    await this.db.run(
      `INSERT INTO test_executions (
        id, testCaseId, executionId, environment, browser, device, status, progress, startTime, result,
        artifacts, logs, metrics, attemptNumber, maxAttempts, executedBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      exec.id,
      exec.testCaseId,
      exec.executionId,
      exec.environment,
      exec.browser,
      exec.device,
      exec.status,
      typeof exec.progress === 'number' ? exec.progress : 0,
      new Date(exec.startTime).toISOString(),
      JSON.stringify(exec.result || {}),
      JSON.stringify(exec.artifacts || []),
      JSON.stringify(exec.logs || []),
      JSON.stringify(exec.metrics || {}),
      exec.attemptNumber,
      exec.maxAttempts,
      exec.executedBy
    );
  }

  async updateStatus(id: string, status: string) {
    await this.db.run(`UPDATE test_executions SET status = ? WHERE id = ?`, status, id);
  }

  async countAll(): Promise<number> {
    const r: any = await this.db.get(`SELECT COUNT(1) as c FROM test_executions`);
    return r?.c || 0;
  }

  async updateProgress(id: string, progress: number) {
    await this.db.run(`UPDATE test_executions SET progress = ? WHERE id = ?`, progress, id);
  }
}
