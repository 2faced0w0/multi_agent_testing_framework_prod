import { acquireGlobalDatabase } from '@database/GlobalDatabase';
import type { DatabaseManager } from '@database/DatabaseManager';

let dbm: DatabaseManager | null = null;

export async function ensureDatabaseInitialized(): Promise<void> {
  if (!dbm) {
    dbm = acquireGlobalDatabase({
      path: process.env.DATABASE_URL?.replace('sqlite://', '') || './data/framework.db',
      timeout: 5000,
      verbose: process.env.NODE_ENV === 'development',
      memory: false
    } as any);
    await (dbm as any).initialize();
  }
}

export function getDatabaseManager(): DatabaseManager {
  if (!dbm) throw new Error('Database not initialized');
  return dbm as any;
}
