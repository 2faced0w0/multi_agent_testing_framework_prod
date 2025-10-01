import type { Database } from 'sqlite';

export interface WatchedRepoRow {
  id: string;
  full_name: string; // owner/repo
  default_branch: string;
  status: string; // pending | active | error
  note?: string | null;
  last_event?: string | null; // json
  created_at: string;
  updated_at: string;
}

export class WatchedRepoRepository {
  constructor(private db: Database) {}

  async listAll({ status, q }: { status?: string; q?: string } = {}): Promise<WatchedRepoRow[]> {
    const where: string[] = [];
    const params: any[] = [];
    if (status) { where.push('status = ?'); params.push(status); }
    if (q) { where.push('full_name LIKE ?'); params.push(`%${q}%`); }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    return this.db.all(`SELECT * FROM watched_repos ${clause} ORDER BY datetime(updated_at) DESC`, ...params);
  }

  async findById(id: string): Promise<WatchedRepoRow | null> {
    return (await this.db.get(`SELECT * FROM watched_repos WHERE id = ?`, id)) || null;
  }

  async findByFullName(full: string): Promise<WatchedRepoRow | null> {
    return (await this.db.get(`SELECT * FROM watched_repos WHERE full_name = ?`, full)) || null;
  }

  async create(row: WatchedRepoRow): Promise<WatchedRepoRow> {
    await this.db.run(
      `INSERT INTO watched_repos (id, full_name, default_branch, status, note, last_event, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.full_name,
      row.default_branch,
      row.status,
      row.note || null,
      row.last_event || null,
      row.created_at,
      row.updated_at
    );
    return row;
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.db.run(`UPDATE watched_repos SET status = ?, updated_at = ? WHERE id = ?`, status, new Date().toISOString(), id);
  }
}
