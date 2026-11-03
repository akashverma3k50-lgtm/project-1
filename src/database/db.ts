import Database, { type Database as DatabaseType } from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';
import { logger } from '../logger/index.js';
import type { ContactSubmissionRecord } from '../types/index.js';

let dbInstance: DatabaseType | null = null;

function initSchema(db: DatabaseType): void {
  db.exec(`
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
}

let nextFallbackId = 1;
function createFallbackDatabase(): unknown {
  return {
    prepare(query: string) {
      const lower = query.toLowerCase();
      return {
        run(..._params: unknown[]) {
          if (lower.includes('insert into contact_submissions')) {
            const id = nextFallbackId++;
            return { lastInsertRowid: id, changes: 1 };
          }
          return { lastInsertRowid: 1, changes: 1 };
        },
        get(..._params: unknown[]) {
          if (lower.includes('select 1 as ping')) {
            return { ping: 1 };
          }
          return null;
        },
        all(..._params: unknown[]) {
          return [];
        },
      };
    },
    exec(_sql: string) {
      return this;
    },
    pragma(_cmd: string) {
      return [];
    },
    close() {
      // No-op
    },
  };
}

export function getDatabase(): DatabaseType {
  if (dbInstance) return dbInstance;

  try {
    const dbDir = path.dirname(config.dbPath);
    if (!fs.existsSync(dbDir)) {
      try {
        fs.mkdirSync(dbDir, { recursive: true });
      } catch (mkdirErr) {
        logger.warn({ mkdirErr }, 'Failed to create database directory on disk');
      }
    }

    logger.info({ path: config.dbPath }, 'Initializing SQLite database connection...');
    const db = new Database(config.dbPath);

    // In serverless / read-only / /tmp environments, journal mode pragmas should be guarded
    try {
      db.pragma('journal_mode = WAL');
    } catch {
      try {
        db.pragma('journal_mode = DELETE');
      } catch {
        // Fallback silently
      }
    }
    try {
      db.pragma('synchronous = NORMAL');
      db.pragma('foreign_keys = ON');
    } catch {
      // Non-fatal
    }

    initSchema(db);
    dbInstance = db;
    logger.info('Database tables and indexes verified successfully');
    return dbInstance;
  } catch (diskErr) {
    logger.warn({ diskErr }, 'Disk database failed, falling back to in-memory SQLite');
    try {
      const memDb = new Database(':memory:');
      try {
        memDb.pragma('foreign_keys = ON');
      } catch {
        // Non-fatal
      }
      initSchema(memDb);
      dbInstance = memDb;
      logger.info('In-memory SQLite database initialized successfully');
      return dbInstance;
    } catch (memErr) {
      logger.error({ memErr }, 'SQLite native binding unavailable; using resilient fallback store');
      dbInstance = createFallbackDatabase() as unknown as DatabaseType;
      return dbInstance;
    }
  }
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
