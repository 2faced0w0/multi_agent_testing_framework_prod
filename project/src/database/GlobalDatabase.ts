import { DatabaseManager, type DatabaseConfig } from './DatabaseManager';

let globalDb: DatabaseManager | null = null;

export function acquireGlobalDatabase(cfg: DatabaseConfig): DatabaseManager {
  if (!globalDb) {
    globalDb = new DatabaseManager(cfg);
  }
  return globalDb;
}

export function getGlobalDatabase(): DatabaseManager | null {
  return globalDb;
}

export async function releaseGlobalDatabase(): Promise<void> {
  // For sqlite 'open', there's no explicit close in this stub; rely on process exit.
  globalDb = null;
}
