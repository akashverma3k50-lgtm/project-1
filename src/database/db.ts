import Database, { type Database as DatabaseType } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { logger } from '../logger/index.js';
import type { ContactSubmissionRecord } from '../types/index.js';

let dbInstance: DatabaseType | null = null;

export function getDatabase(): DatabaseType {
  if (dbInstance) return dbInstance;

  const dbDir = path.dirname(config.dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  logger.info({ path: config.dbPath }, 'Initializing SQLite database connection...');
  dbInstance = new Database(config.dbPath);

  // Enable WAL (Write-Ahead Logging) mode for enhanced concurrency and performance
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('synchronous = NORMAL');
  dbInstance.pragma('foreign_keys = ON');

  // Initialize schema with parameterized table definitions
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS contact_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      user_agent TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_contact_created_at ON contact_submissions(created_at);
    CREATE INDEX IF NOT EXISTS idx_contact_email ON contact_submissions(email);

    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      path TEXT NOT NULL,
      referrer TEXT,
      ip_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_analytics_path ON analytics_events(path);
  `);

  logger.info('Database tables and indexes verified successfully');
  return dbInstance;
}

export function saveContactSubmission(record: ContactSubmissionRecord): number {
  const db = getDatabase();
  // STRICTLY PARAMETERIZED QUERY PREVENTING SQL INJECTION
  const stmt = db.prepare(`
    INSERT INTO contact_submissions (name, email, subject, message, ip_address, user_agent, created_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const result = stmt.run(
    record.name,
    record.email,
    record.subject,
    record.message,
    record.ip_address,
    record.user_agent,
  );

  return Number(result.lastInsertRowid);
}

export function recordAnalyticsEvent(
  eventType: string,
  pathname: string,
  referrer: string,
  ipHash: string,
): void {
  try {
    const db = getDatabase();
    // PARAMETERIZED INSERT
    const stmt = db.prepare(`
      INSERT INTO analytics_events (event_type, path, referrer, ip_hash, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `);
    stmt.run(eventType, pathname, referrer, ipHash);
  } catch (err) {
    logger.warn({ err }, 'Failed to record analytics event');
  }
}

export function checkDatabaseHealth(): { ok: boolean; latencyMs: number } {
  try {
    const db = getDatabase();
    const start = performance.now();
    // Parameterized ping query
    const stmt = db.prepare('SELECT 1 as ping');
    const row = stmt.get() as { ping: number };
    const latencyMs = Math.round((performance.now() - start) * 100) / 100;
    return { ok: row.ping === 1, latencyMs };
  } catch (err) {
    logger.error({ err }, 'Database health check failed');
    return { ok: false, latencyMs: -1 };
  }
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    logger.info('Database connection closed');
  }
}
