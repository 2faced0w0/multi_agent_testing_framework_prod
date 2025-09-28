import type { Database } from 'sqlite';

export interface GeneratedTestRow {
  id: string;
  repo: string;
  branch: string;
  commit: string;
  path: string;
  title: string;
  created_at: string;
  created_by: string;
  metadata: any;
}

export class GeneratedTestRepository {
  constructor(private db: Database) {}

  async create(row: GeneratedTestRow) {
    await this.db.run(
      `INSERT INTO generated_tests (id, repo, branch, commit, path, title, created_at, created_by, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.repo,
      row.branch,
      row.commit,
      row.path,
      row.title,
      row.created_at,
      row.created_by,
      JSON.stringify(row.metadata || {})
    );
  }

  async findById(id: string) {
    const r = await this.db.get(`SELECT * FROM generated_tests WHERE id = ?`, id);
    if (!r) return null;
    return { ...r, metadata: r.metadata ? JSON.parse(r.metadata) : {} } as GeneratedTestRow;
  }

  async listRecent(limit = 50) {
    const rows = await this.db.all(`SELECT * FROM generated_tests ORDER BY datetime(created_at) DESC LIMIT ?`, limit);
    return rows.map((r: any) => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : {} }));
  }
}
