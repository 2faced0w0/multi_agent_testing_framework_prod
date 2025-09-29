import type { Database } from 'sqlite';

export interface LogRow {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: any;
  source_service?: string;
  source_component?: string;
  source_instance?: string;
  tags?: string[];
  correlation_id?: string;
}

export class LogsRepository {
  constructor(private db: Database) {}

  async create(row: LogRow) {
    await this.db.run(
      `INSERT INTO logs (id, timestamp, level, message, context, source_service, source_component, source_instance, tags, correlation_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      row.timestamp,
      row.level,
      row.message,
      JSON.stringify(row.context || {}),
      row.source_service || null,
      row.source_component || null,
      row.source_instance || null,
      row.tags ? JSON.stringify(row.tags) : null,
      row.correlation_id || null
    );
  }

  async list({ level, query, limit = 100 }: { level?: string; query?: string; limit?: number }) {
    const conditions: string[] = [];
    const params: any[] = [];
    if (level) { conditions.push('level = ?'); params.push(level); }
    if (query) { conditions.push('(message LIKE ? OR context LIKE ?)'); params.push(`%${query}%`, `%${query}%`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const rows = await this.db.all(
      `SELECT * FROM logs ${where} ORDER BY datetime(timestamp) DESC LIMIT ?`,
      ...params,
      limit
    );
    return rows.map((r: any) => ({
      ...r,
      context: r.context ? JSON.parse(r.context) : {},
      tags: r.tags ? JSON.parse(r.tags) : [],
    })) as LogRow[];
  }
}
