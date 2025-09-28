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
      startTime TEXT,
      result TEXT,
      artifacts TEXT,
      logs TEXT,
      metrics TEXT,
      attemptNumber INTEGER,
      maxAttempts INTEGER,
      executedBy TEXT
    );`);
    await this.db.run(
      `INSERT INTO test_executions (
        id, testCaseId, executionId, environment, browser, device, status, startTime, result,
        artifacts, logs, metrics, attemptNumber, maxAttempts, executedBy
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      exec.id,
      exec.testCaseId,
      exec.executionId,
      exec.environment,
      exec.browser,
      exec.device,
      exec.status,
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
}
