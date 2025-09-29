import type { Database } from 'sqlite';

export interface LocatorCandidatesRow {
  id: string;
  request_id: string;
  element_description?: string;
  candidates: any[]; // array of candidate objects
  chosen?: any; // chosen candidate
  created_at: string;
  created_by?: string;
}

export class LocatorCandidatesRepository {
  constructor(private db: Database) {}

  async create(row: LocatorCandidatesRow) {
    await this.db.run(
      `INSERT INTO locator_candidates (id, request_id, element_description, candidates, chosen, created_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.request_id,
      row.element_description || null,
      JSON.stringify(row.candidates || []),
      JSON.stringify(row.chosen || null),
      row.created_at,
      row.created_by || null
    );
  }

  async listByRequest(requestId: string) {
    const rows = await this.db.all(`SELECT * FROM locator_candidates WHERE request_id = ? ORDER BY datetime(created_at) DESC`, requestId);
    return rows.map((r: any) => ({ ...r, candidates: JSON.parse(r.candidates || '[]'), chosen: r.chosen ? JSON.parse(r.chosen) : null })) as LocatorCandidatesRow[];
  }
}
