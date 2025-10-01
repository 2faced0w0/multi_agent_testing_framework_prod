import type { Database } from 'sqlite';

export interface ExecutionReportRow {
  id: string;
  execution_id: string;
  report_path: string;
  summary: string;
  status: string;
  created_at: string;
  created_by: string;
}

export class ExecutionReportRepository {
  constructor(private db: Database) {}

  async create(row: ExecutionReportRow) {
    await this.db.run(
      `INSERT INTO execution_reports (id, execution_id, report_path, summary, status, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.execution_id,
      row.report_path,
      row.summary,
      row.status,
      row.created_at,
      row.created_by
    );
  }

  async findById(id: string) {
    return this.db.get(`SELECT * FROM execution_reports WHERE id = ?`, id);
  }

  async listByExecution(executionId: string) {
    return this.db.all(`SELECT * FROM execution_reports WHERE execution_id = ? ORDER BY datetime(created_at) DESC`, executionId);
  }

  async listRecent(limit: number) {
    return this.db.all(`SELECT * FROM execution_reports ORDER BY datetime(created_at) DESC LIMIT ?`, limit);
  }
}
