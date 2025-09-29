import type { Database } from 'sqlite';

export interface TestCaseRow {
  id: string;
  title: string;
  description?: string;
  repo?: string;
  path?: string;
  status?: 'active' | 'deprecated' | 'draft';
  created_at: string;
  updated_at?: string;
  created_by?: string;
  metadata?: any;
}

export class TestCaseRepository {
  constructor(private db: Database) {}

  async create(row: TestCaseRow) {
    await this.db.run(
      `INSERT INTO test_cases (id, title, description, repo, path, status, created_at, updated_at, created_by, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.title,
      row.description || null,
      row.repo || null,
      row.path || null,
      row.status || 'active',
      row.created_at,
      row.updated_at || row.created_at,
      row.created_by || null,
      JSON.stringify(row.metadata || {})
    );
  }

  async update(row: Partial<TestCaseRow> & { id: string }) {
    const current = await this.findById(row.id);
    if (!current) throw new Error('test case not found');
    const merged: TestCaseRow = {
      ...current,
      ...row,
      metadata: row.metadata ?? current.metadata
    };
    await this.db.run(
      `UPDATE test_cases SET title=?, description=?, repo=?, path=?, status=?, created_at=?, updated_at=?, created_by=?, metadata=? WHERE id=?`,
      merged.title,
      merged.description || null,
      merged.repo || null,
      merged.path || null,
      merged.status || 'active',
      merged.created_at,
      merged.updated_at || new Date().toISOString(),
      merged.created_by || null,
      JSON.stringify(merged.metadata || {}),
      merged.id
    );
  }

  async delete(id: string) {
    await this.db.run(`DELETE FROM test_cases WHERE id = ?`, id);
  }

  async findById(id: string) {
    const r = await this.db.get(`SELECT * FROM test_cases WHERE id = ?`, id);
    if (!r) return null;
    return { ...r, metadata: r.metadata ? JSON.parse(r.metadata) : {} } as TestCaseRow;
  }

  async list({ limit = 100, status }: { limit?: number; status?: string } = {}) {
    const where = status ? 'WHERE status = ?' : '';
    const rows = await this.db.all(
      `SELECT * FROM test_cases ${where} ORDER BY datetime(updated_at) DESC LIMIT ?`,
      ...(status ? [status] : []),
      limit
    );
    return rows.map((r: any) => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : {} })) as TestCaseRow[];
  }
}
