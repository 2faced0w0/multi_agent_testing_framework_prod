import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';

export interface DatabaseConfig {
  path: string;
  timeout: number;
  verbose: boolean;
  memory: boolean;
}

export class DatabaseManager {
  private db: Database | null = null;
  constructor(private cfg: DatabaseConfig) {}

  async initialize(): Promise<void> {
    this.db = await open({ filename: this.cfg.path, driver: sqlite3.Database });
    await this.db.exec(`CREATE TABLE IF NOT EXISTS system_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT,
      version TEXT,
      source_service TEXT,
      source_component TEXT,
      source_instance TEXT,
      source_version TEXT,
      timestamp TEXT,
      data TEXT,
      tags TEXT,
      severity TEXT,
      category TEXT,
      correlation_id TEXT,
      causation_id TEXT
    );`);
    await this.db.exec(`CREATE TABLE IF NOT EXISTS agent_messages (
      id TEXT PRIMARY KEY,
      message_type TEXT,
      priority TEXT,
      processed INTEGER,
      error_message TEXT,
      timestamp TEXT
    );`);
    await this.db.exec(`CREATE TABLE IF NOT EXISTS generated_tests (
      id TEXT PRIMARY KEY,
      repo TEXT,
      branch TEXT,
      commit_sha TEXT,
      path TEXT,
      title TEXT,
      created_at TEXT,
      created_by TEXT,
      metadata TEXT
    );`);
    await this.db.exec(`CREATE TABLE IF NOT EXISTS execution_reports (
      id TEXT PRIMARY KEY,
      execution_id TEXT,
      report_path TEXT,
      summary TEXT,
      status TEXT,
      created_at TEXT,
      created_by TEXT
    );`);
    // Ensure test_executions exists early so read endpoints don't fail before first insert
    await this.db.exec(`CREATE TABLE IF NOT EXISTS test_executions (
      id TEXT PRIMARY KEY,
      testCaseId TEXT,
      executionId TEXT,
      environment TEXT,
      browser TEXT,
      device TEXT,
      status TEXT,
      startTime TEXT,
      result TEXT,
      artifacts TEXT,
      logs TEXT,
      metrics TEXT,
      attemptNumber INTEGER,
      maxAttempts INTEGER,
      executedBy TEXT
    );`);
  }

  async healthCheck(): Promise<boolean> {
    if (!this.db) return false;
    await this.db.get('SELECT 1');
    return true;
  }

  getDatabase(): Database {
    if (!this.db) throw new Error('DB not initialized');
    return this.db;
  }
}
