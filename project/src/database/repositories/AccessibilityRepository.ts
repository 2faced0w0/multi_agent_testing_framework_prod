import type { Database } from 'sqlite';

export interface AccessibilityRow {
  id: string;
  execution_id: string;
  results: any;
  score?: number;
  created_at: string;
}

export class AccessibilityRepository {
  constructor(private db: Database) {}

  async create(row: AccessibilityRow) {
    await this.db.run(
      `INSERT INTO accessibility_results (id, execution_id, results, score, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      row.id,
      row.execution_id,
      JSON.stringify(row.results || {}),
      row.score ?? null,
      row.created_at
    );
  }

  async listByExecution(executionId: string) {
    const rows = await this.db.all(`SELECT * FROM accessibility_results WHERE execution_id = ? ORDER BY datetime(created_at) DESC`, executionId);
    return rows.map((r: any) => ({ ...r, results: r.results ? JSON.parse(r.results) : {} })) as AccessibilityRow[];
  }
}
