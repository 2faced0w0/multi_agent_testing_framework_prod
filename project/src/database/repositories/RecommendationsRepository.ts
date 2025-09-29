import type { Database } from 'sqlite';

export interface RecommendationRow {
  id: string;
  test_case_id?: string;
  created_at: string;
  strategy: string; // e.g., 'retries', 'stabilize-locators'
  details: any;
  severity?: 'low' | 'medium' | 'high';
  applies_from?: string;
  created_by?: string;
}

export class RecommendationsRepository {
  constructor(private db: Database) {}

  async create(row: RecommendationRow) {
    await this.db.run(
      `INSERT INTO optimization_recommendations (id, test_case_id, created_at, strategy, details, severity, applies_from, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.test_case_id || null,
      row.created_at,
      row.strategy,
      JSON.stringify(row.details || {}),
      row.severity || null,
      row.applies_from || null,
      row.created_by || null
    );
  }

  async listRecent(limit = 100) {
    const rows = await this.db.all(`SELECT * FROM optimization_recommendations ORDER BY datetime(created_at) DESC LIMIT ?`, limit);
    return rows.map((r: any) => ({ ...r, details: r.details ? JSON.parse(r.details) : {} })) as RecommendationRow[];
  }
}
