import type { Database } from 'sqlite';

export interface ArtifactRow {
  id: string;
  execution_id: string;
  type: string;
  path: string;
  created_at: string;
  metadata?: any;
}

export class ArtifactsRepository {
  constructor(private db: Database) {}

  async create(row: ArtifactRow) {
    await this.db.run(
      `INSERT INTO test_artifacts (id, execution_id, type, path, created_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      row.id,
      row.execution_id,
      row.type,
      row.path,
      row.created_at,
      JSON.stringify(row.metadata || {})
    );
  }

  async listByExecution(executionId: string) {
    const rows = await this.db.all(`SELECT * FROM test_artifacts WHERE execution_id = ? ORDER BY datetime(created_at) DESC`, executionId);
    return rows.map((r: any) => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : {} })) as ArtifactRow[];
  }
}
