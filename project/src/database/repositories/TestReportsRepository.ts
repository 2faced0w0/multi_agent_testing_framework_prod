import type { Database } from 'sqlite';

export interface TestReportRow {
  id: string;
  execution_id: string;
  type: string; // html | json | junit
  path: string;
  summary?: string;
  created_at: string;
  created_by?: string;
}

export class TestReportsRepository {
  constructor(private db: Database) {}

  async create(row: TestReportRow) {
    await this.db.run(
      `INSERT INTO test_reports (id, execution_id, type, path, summary, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.execution_id,
      row.type,
      row.path,
      row.summary || null,
      row.created_at,
      row.created_by || null
    );
  }

  async listByExecution(executionId: string) {
    return this.db.all(`SELECT * FROM test_reports WHERE execution_id = ? ORDER BY datetime(created_at) DESC`, executionId);
  }
}
