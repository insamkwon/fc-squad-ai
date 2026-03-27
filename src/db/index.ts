/**
 * Database client module for the FC Online player database.
 *
 * Uses Drizzle ORM with better-sqlite3 (SQLite).
 * The database file is stored at `data/fc-squad.db` by default.
 *
 * Vercel compatibility:
 * - On Vercel's read-only filesystem, the DB is opened in read-only mode
 *   with journal_mode=MEMORY (no WAL/SHM files needed).
 * - The DB file is included via outputFileTracingIncludes in next.config.ts.
 *
 * Usage:
 *   import { db } from '@/db';
 *   import { players } from '@/db/schema';
 *   const allPlayers = await db.select().from(players);
 */

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import * as schema from './schema';

// ---------------------------------------------------------------------------
// Database path resolution
// ---------------------------------------------------------------------------

const IS_VERCEL = !!process.env.VERCEL;
const DB_DIR = join(/*turbopackIgnore: true*/ process.cwd(), 'data');
const DB_PATH = process.env.DATABASE_URL || join(DB_DIR, 'fc-squad.db');

// Ensure the data directory exists (local dev only; Vercel filesystem is read-only)
if (!IS_VERCEL && !existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Database connection (singleton)
// ---------------------------------------------------------------------------

let _db: ReturnType<typeof createDb> | null = null;

function createDb() {
  // On Vercel, the filesystem is read-only (except /tmp).
  // Copy the DB to /tmp so SQLite can create any auxiliary files it needs,
  // then open it with journal_mode=MEMORY to avoid WAL/SHM file creation.
  let effectivePath = DB_PATH;
  if (IS_VERCEL) {
    const tmpPath = '/tmp/fc-squad.db';
    if (existsSync(DB_PATH) && !existsSync(tmpPath)) {
      copyFileSync(DB_PATH, tmpPath);
    }
    effectivePath = tmpPath;
  }

  const sqlite = new Database(effectivePath, { readonly: IS_VERCEL });

  // Performance pragmas for the player database workload
  if (IS_VERCEL) {
    // On Vercel: use MEMORY journal (no auxiliary files on disk)
    sqlite.pragma('journal_mode = MEMORY');
  } else {
    // Local dev: WAL for concurrent reads during development
    sqlite.pragma('journal_mode = WAL');
  }
  sqlite.pragma('synchronous = NORMAL');        // Balance between safety and performance
  sqlite.pragma('cache_size = -64000');         // 64MB cache (negative = KB)
  sqlite.pragma('temp_store = MEMORY');         // Temporary tables in memory
  sqlite.pragma('mmap_size = 268435456');       // 256MB memory-mapped I/O

  return drizzle(sqlite, { schema });
}

/**
 * Get the database instance (lazy singleton).
 * Safe to call multiple times — returns the same connection.
 */
export function getDb() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

/**
 * Reset the database connection (useful for testing).
 * Closes the existing connection and creates a new one.
 */
export function resetDb() {
  if (_db) {
    const sqlite = (_db as any).$client;
    sqlite.close();
    _db = null;
  }
}

// Re-export schema for convenience
export { schema };
export type { PlayerRow, NewPlayer, SeedMetaRow, PriceHistoryRow } from './schema';
