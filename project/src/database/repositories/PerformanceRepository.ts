import type { Database } from 'sqlite';

export interface PerformanceRow {
  id: string;
  execution_id: string;
  metrics: any;
  created_at: string;
}

export class PerformanceRepository {
  constructor(private db: Database) {}

  async create(row: PerformanceRow) {
    await this.db.run(
      `INSERT INTO performance_metrics (id, execution_id, metrics, created_at)
       VALUES (?, ?, ?, ?)`,
      row.id,
      row.execution_id,
      JSON.stringify(row.metrics || {}),
      row.created_at
    );
  }

  async listByExecution(executionId: string) {
    const rows = await this.db.all(`SELECT * FROM performance_metrics WHERE execution_id = ? ORDER BY datetime(created_at) DESC`, executionId);
    return rows.map((r: any) => ({ ...r, metrics: r.metrics ? JSON.parse(r.metrics) : {} })) as PerformanceRow[];
  }
}
