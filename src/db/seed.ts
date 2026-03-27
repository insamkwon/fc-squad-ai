/**
 * CSV seed pipeline for populating the FC Online player database.
 *
 * Reads details.csv, parses each row into structured player data,
 * and inserts/upserts into the SQLite database via Drizzle ORM.
 *
 * Features:
 * - Idempotent: safe to run multiple times (uses INSERT OR REPLACE)
 * - Batched inserts for performance (500 rows per transaction)
 * - Schema auto-creation if tables don't exist
 * - Seed metadata tracking for audit/change detection
 * - File hash comparison to skip unnecessary re-seeding
 *
 * Usage:
 *   import { seedFromCsv } from '@/db/seed';
 *   await seedFromCsv({ csvPath: 'data/details.csv' });
 */

import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { getDb, resetDb } from './index';
import { players, schemaVersion, seedMeta, priceHistory } from './schema';
import type { NewPlayer } from './schema';
import { parseCsvFile } from './csv-parser';
import { classifySeason } from './season-classifier';
import { parseTeamColors, findTeam } from './team-resolver';

// ---------------------------------------------------------------------------
// Helper to extract the raw SQLite client from Drizzle's db wrapper
// ---------------------------------------------------------------------------

function getRawSqlite(db: ReturnType<typeof getDb>): any {
  return (db as any).$client;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of rows to insert per batch transaction */
const BATCH_SIZE = 500;

/** Current schema version — increment when schema changes require re-seeding */
const CURRENT_SCHEMA_VERSION = 1;

/** Valid positions in FC Online */
const VALID_POSITIONS = new Set([
  'ST', 'CF', 'LF', 'RF', 'LW', 'RW', 'CAM', 'CM',
  'CDM', 'LM', 'RM', 'LB', 'RB', 'CB', 'LWB', 'RWB', 'GK',
]);

/** Required CSV column names */
const REQUIRED_COLUMNS = [
  'player_code', 'player_name', 'salary', 'season', 'position', 'ovr', 'team_colors',
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SeedOptions {
  /** Path to the details.csv file (relative to project root or absolute) */
  csvPath?: string;
  /** Force re-seed even if the file hasn't changed */
  force?: boolean;
  /** Database path override (for testing) */
  dbPath?: string;
  /** Custom logger (defaults to console) */
  logger?: Pick<Console, 'log' | 'error' | 'warn'>;
  /** Callback for progress reporting */
  onProgress?: (phase: string, current: number, total: number) => void;
}

export interface SeedResult {
  /** Whether seeding was performed (false if skipped due to no changes) */
  seeded: boolean;
  /** Number of players successfully inserted/updated */
  playersProcessed: number;
  /** Number of CSV rows skipped (invalid data) */
  rowsSkipped: number;
  /** Number of unique seasons found */
  seasonsFound: number;
  /** ISO timestamp of when seeding completed */
  completedAt: string;
  /** Duration in milliseconds */
  durationMs: number;
  /** Whether the database schema was created fresh */
  schemaCreated: boolean;
  /** File hash for change detection */
  fileHash: string;
}

// ---------------------------------------------------------------------------
// Schema initialization
// ---------------------------------------------------------------------------

/**
 * Create all database tables if they don't exist.
 * Uses raw SQL for full control over index creation.
 */
function ensureSchema(db: ReturnType<typeof getDb>, logger: Pick<Console, 'log' | 'error' | 'warn'>): boolean {
  const sqlite = getRawSqlite(db);

  // Check if the players table already exists
  const tableExists = sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='players'")
    .get();

  if (tableExists) {
    logger.log('[seed] Database schema already exists');
    return false;
  }

  logger.log('[seed] Creating database schema...');

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS players (
      spid INTEGER PRIMARY KEY,
      pid INTEGER NOT NULL,
      name TEXT NOT NULL,
      name_en TEXT NOT NULL,
      season_id INTEGER NOT NULL,
      season_name TEXT NOT NULL,
      season_slug TEXT NOT NULL,
      card_type TEXT NOT NULL CHECK(card_type IN ('BASE', 'SPECIAL', 'ICON', 'LIVE', 'MOM', 'POTW')),
      season_year TEXT NOT NULL DEFAULT '',
      release_date TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL,
      team_id INTEGER NOT NULL DEFAULT 0,
      team_name TEXT NOT NULL DEFAULT '',
      team_name_en TEXT NOT NULL DEFAULT '',
      league_id INTEGER NOT NULL DEFAULT -1,
      league_name TEXT NOT NULL DEFAULT '',
      ovr INTEGER NOT NULL DEFAULT 0,
      pace INTEGER NOT NULL DEFAULT 0,
      shooting INTEGER NOT NULL DEFAULT 0,
      passing INTEGER NOT NULL DEFAULT 0,
      dribbling INTEGER NOT NULL DEFAULT 0,
      defending INTEGER NOT NULL DEFAULT 0,
      physical INTEGER NOT NULL DEFAULT 0,
      raw_stats TEXT NOT NULL DEFAULT '{}',
      price INTEGER NOT NULL DEFAULT 0,
      price_updated_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT '',
      price_source TEXT NOT NULL DEFAULT 'seed' CHECK(price_source IN ('seed', 'crawl'))
    );

    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS seed_meta (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      rows_processed INTEGER NOT NULL DEFAULT 0,
      rows_skipped INTEGER NOT NULL DEFAULT 0,
      seeded_at TEXT NOT NULL,
      file_hash TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS price_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      spid INTEGER NOT NULL,
      price INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'seed' CHECK(source IN ('seed', 'crawl', 'nexon_trade')),
      recorded_at TEXT NOT NULL
    );

    -- Indexes for common search/filter operations
    CREATE INDEX IF NOT EXISTS idx_players_pid ON players(pid);
    CREATE INDEX IF NOT EXISTS idx_players_name ON players(name);
    CREATE INDEX IF NOT EXISTS idx_players_name_en ON players(name_en);
    CREATE INDEX IF NOT EXISTS idx_players_position ON players(position);
    CREATE INDEX IF NOT EXISTS idx_players_team_id ON players(team_id);
    CREATE INDEX IF NOT EXISTS idx_players_season_id ON players(season_id);
    CREATE INDEX IF NOT EXISTS idx_players_card_type ON players(card_type);
    CREATE INDEX IF NOT EXISTS idx_players_season_year ON players(season_year);
    CREATE INDEX IF NOT EXISTS idx_players_ovr ON players(ovr);
    CREATE INDEX IF NOT EXISTS idx_players_price ON players(price);
    CREATE INDEX IF NOT EXISTS idx_players_position_ovr ON players(position, ovr);
    CREATE INDEX IF NOT EXISTS idx_players_team_position ON players(team_id, position);
    CREATE INDEX IF NOT EXISTS idx_players_position_price ON players(position, price);

    -- Price history indexes
    CREATE INDEX IF NOT EXISTS idx_price_history_spid ON price_history(spid);
    CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);
  `);

  // Record schema version
  sqlite
    .prepare(
      `INSERT OR REPLACE INTO schema_version (version, applied_at, description)
       VALUES (?, ?, ?)`,
    )
    .run(CURRENT_SCHEMA_VERSION, new Date().toISOString(), 'Initial schema from CSV seed pipeline');

  logger.log('[seed] Database schema created successfully');
  return true;
}

// ---------------------------------------------------------------------------
// File utilities
// ---------------------------------------------------------------------------

/**
 * Compute SHA-256 hash of a file for change detection.
 */
function computeFileHash(filePath: string): string {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

/**
 * Get the last seed metadata from the database.
 */
function getLastSeedMeta(db: ReturnType<typeof getDb>): { fileHash: string; source: string } | null {
  try {
    const sqlite = getRawSqlite(db);
    const row = sqlite
      .prepare('SELECT file_hash, source FROM seed_meta ORDER BY id DESC LIMIT 1')
      .get() as { file_hash: string; source: string } | undefined;
    return row ? { fileHash: row.file_hash, source: row.source } : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Row parsing
// ---------------------------------------------------------------------------

/**
 * Parse a CSV row object into a NewPlayer record for database insertion.
 * Returns null if the row should be skipped (invalid data).
 */
function parsePlayerRow(
  row: Record<string, string>,
  seasonIdMap: Map<string, number>,
  seasonIdCounter: { value: number },
  now: string,
): NewPlayer | null {
  const playerCode = parseInt(row['player_code'], 10);
  const playerName = row['player_name'];
  const salary = parseInt(row['salary'], 10) || 0;
  const seasonCode = row['season'];
  const position = row['position'];
  const ovr = parseInt(row['ovr'], 10) || 0;

  // Validate required fields
  if (!VALID_POSITIONS.has(position)) return null;
  if (!playerCode || !playerName || !seasonCode) return null;

  // Season info
  const seasonInfo = classifySeason(seasonCode);
  if (!seasonIdMap.has(seasonCode)) {
    seasonIdMap.set(seasonCode, seasonIdCounter.value++);
  }
  const seasonId = seasonIdMap.get(seasonCode)!;

  // Team info from team_colors
  const tcRaw = row['team_colors'];
  const teamColors = parseTeamColors(tcRaw);
  const team = findTeam(teamColors);

  // Parse individual stats
  const parseStat = (key: string) => parseInt(row[key], 10) || 0;

  const spd = parseStat('속력');
  const acc = parseStat('가속력');
  const fin = parseStat('골 결정력');
  const shp = parseStat('슛 파워');
  const lon = parseStat('중거리 슛');
  const pos = parseStat('위치 선정');
  const vol = parseStat('발리슛');
  const pen = parseStat('페널티 킥');
  const pas = parseStat('짧은 패스');
  const vis = parseStat('시야');
  const cro = parseStat('크로스');
  const lpas = parseStat('긴 패스');
  const fk = parseStat('프리킥');
  const cur = parseStat('커브');
  const dri = parseStat('드리블');
  const bal = parseStat('볼 컨트롤');
  const agi = parseStat('민첩성');
  const bal2 = parseStat('밸런스');
  const react = parseStat('반응 속도');
  const intc = parseStat('대인 수비');
  const tac = parseStat('태클');
  const intp = parseStat('가로채기');
  const hed = parseStat('헤더');
  const slid = parseStat('슬라이딩 태클');
  const phy = parseStat('몸싸움');
  const sta = parseStat('스태미너');
  const aggr = parseStat('적극성');
  const jmp = parseStat('점프');
  const com = parseStat('침착성');
  const gkDiving = parseStat('GK 다이빙');
  const gkHandling = parseStat('GK 핸들링');
  const gkKicking = parseStat('GK 킥');
  const gkReflexes = parseStat('GK 반응속도');
  const gkPositioning = parseStat('GK 위치 선정');

  // Compute composite stats
  const isGK = position === 'GK';
  const pace = isGK ? 0 : Math.round((spd + acc) / 2);
  const shooting = isGK ? 0 : Math.round((fin + shp + lon + pos + vol + pen) / 6);
  const passing = isGK ? 0 : Math.round((pas + vis + cro + lpas + fk + cur) / 6);
  const dribbling = isGK ? 0 : Math.round((dri + bal + agi + bal2 + react) / 5);
  const defending = isGK ? 0 : Math.round((intc + tac + intp + hed + slid) / 5);
  const physical = isGK ? 0 : Math.round((phy + sta + aggr + jmp + com) / 5);

  // Raw stats as JSON
  const rawStats = {
    속력: spd, 가속력: acc, '골 결정력': fin, '슛 파워': shp,
    '중거리 슛': lon, '위치 선정': pos, 발리슛: vol, '페널티 킥': pen,
    '짧은 패스': pas, 시야: vis, 크로스: cro, '긴 패스': lpas,
    프리킥: fk, 커브: cur, 드리블: dri, '볼 컨트롤': bal,
    민첩성: agi, 밸런스: bal2, '반응 속도': react, '대인 수비': intc,
    태클: tac, 가로채기: intp, 헤더: hed, '슬라이딩 태클': slid,
    몸싸움: phy, 스태미너: sta, 적극성: aggr, 점프: jmp, 침착성: com,
    'GK 다이빙': gkDiving, 'GK 핸들링': gkHandling, 'GK 킥': gkKicking,
    'GK 반응속도': gkReflexes, 'GK 위치 선정': gkPositioning,
  };

  return {
    spid: playerCode,
    pid: Math.floor(playerCode / 10000),
    name: playerName,
    nameEn: playerName, // CSV only has Korean names; fallback to same
    seasonId,
    seasonName: seasonInfo.name,
    seasonSlug: seasonCode.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    cardType: seasonInfo.cardType,
    seasonYear: seasonInfo.seasonYear,
    releaseDate: '',
    position,
    teamId: team.id,
    teamName: team.nameEn,
    teamNameEn: team.nameEn,
    leagueId: team.leagueId,
    leagueName: team.leagueName,
    ovr,
    pace,
    shooting,
    passing,
    dribbling,
    defending,
    physical,
    rawStats,
    price: salary > 0 ? salary * 100000 : 0,
    priceUpdatedAt: now,
    updatedAt: now,
    priceSource: 'seed',
  };
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

/**
 * Seed the player database from a details.csv file.
 *
 * This function is idempotent — running it multiple times with the same
 * CSV file will skip re-insertion (detected via file hash). Use `force: true`
 * to force a full re-seed.
 *
 * @param options - Configuration options
 * @returns Seed result with statistics
 */
export async function seedFromCsv(options: SeedOptions = {}): Promise<SeedResult> {
  const startTime = Date.now();
  const {
    csvPath = join(process.cwd(), 'data', 'details.csv'),
    force = false,
    logger = console,
    onProgress,
  } = options;

  const now = new Date().toISOString();

  // -----------------------------------------------------------------------
  // Phase 1: Validate CSV file
  // -----------------------------------------------------------------------
  onProgress?.('validating', 0, 1);

  if (!existsSync(csvPath)) {
    throw new Error(`CSV file not found: ${csvPath}`);
  }

  const fileHash = computeFileHash(csvPath);
  const fileSizeMB = (statSync(csvPath).size / 1024 / 1024).toFixed(1);
  logger.log(`[seed] CSV file: ${csvPath} (${fileSizeMB} MB, hash: ${fileHash})`);

  // -----------------------------------------------------------------------
  // Phase 2: Check if database already has this data
  // -----------------------------------------------------------------------
  let db = getDb();
  const schemaCreated = ensureSchema(db, logger);

  if (!force) {
    const lastMeta = getLastSeedMeta(db);
    if (lastMeta && lastMeta.fileHash === fileHash && lastMeta.source === csvPath) {
      const sqlite = getRawSqlite(db);
      const count = (sqlite.prepare('SELECT COUNT(*) as count FROM players').get() as { count: number }).count;
      logger.log(`[seed] Skipping — CSV unchanged (hash: ${fileHash}), ${count} players in DB`);
      return {
        seeded: false,
        playersProcessed: count,
        rowsSkipped: 0,
        seasonsFound: 0,
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startTime,
        schemaCreated,
        fileHash,
      };
    }
  }

  // -----------------------------------------------------------------------
  // Phase 3: Parse CSV
  // -----------------------------------------------------------------------
  onProgress?.('parsing', 0, 1);
  logger.log('[seed] Parsing CSV file...');

  const rows = parseCsvFile(csvPath);
  logger.log(`[seed] Parsed ${rows.length} data rows (+ 1 header)`);

  // Validate required columns
  if (rows.length > 0) {
    const headerKeys = Object.keys(rows[0]);
    for (const col of REQUIRED_COLUMNS) {
      if (!headerKeys.includes(col)) {
        throw new Error(`Missing required CSV column: ${col}. Found columns: ${headerKeys.join(', ')}`);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Phase 4: Transform rows to player records
  // -----------------------------------------------------------------------
  onProgress?.('transforming', 0, rows.length);
  logger.log('[seed] Transforming CSV rows to player records...');

  const playerRecords: NewPlayer[] = [];
  let skipped = 0;
  const seasonIdMap = new Map<string, number>();
  const seasonIdCounter = { value: 100 };

  for (let i = 0; i < rows.length; i++) {
    const record = parsePlayerRow(rows[i], seasonIdMap, seasonIdCounter, now);
    if (record) {
      playerRecords.push(record);
    } else {
      skipped++;
    }

    // Progress callback every 5000 rows
    if (i % 5000 === 0) {
      onProgress?.('transforming', i, rows.length);
    }
  }

  logger.log(
    `[seed] Transformed ${playerRecords.length} players (${skipped} skipped), ${seasonIdMap.size} unique seasons`,
  );

  // -----------------------------------------------------------------------
  // Phase 5: Insert into database (batched)
  // -----------------------------------------------------------------------
  onProgress?.('inserting', 0, playerRecords.length);
  logger.log(`[seed] Inserting ${playerRecords.length} players into database (batch size: ${BATCH_SIZE})...`);

  const sqlite = getRawSqlite(db);

  // Clear existing data for a clean re-seed
  if (force) {
    logger.log('[seed] Force mode — clearing existing player data...');
    sqlite.prepare('DELETE FROM price_history').run();
    sqlite.prepare('DELETE FROM players').run();
  }

  // Use INSERT OR REPLACE for idempotency (upsert by spid primary key)
  const insertStmt = sqlite.prepare(`
    INSERT OR REPLACE INTO players (
      spid, pid, name, name_en, season_id, season_name, season_slug,
      card_type, season_year, release_date, position, team_id, team_name,
      team_name_en, league_id, league_name, ovr, pace, shooting, passing,
      dribbling, defending, physical, raw_stats, price, price_updated_at,
      updated_at, price_source
    ) VALUES (
      @spid, @pid, @name, @nameEn, @seasonId, @seasonName, @seasonSlug,
      @cardType, @seasonYear, @releaseDate, @position, @teamId, @teamName,
      @teamNameEn, @leagueId, @leagueName, @ovr, @pace, @shooting, @passing,
      @dribbling, @defending, @physical, @rawStats, @price, @priceUpdatedAt,
      @updatedAt, @priceSource
    )
  `);

  // Batch insert using a transaction
  const insertMany = sqlite.transaction((records: NewPlayer[]) => {
    for (const record of records) {
      insertStmt.run({
        spid: record.spid,
        pid: record.pid,
        name: record.name,
        nameEn: record.nameEn,
        seasonId: record.seasonId,
        seasonName: record.seasonName,
        seasonSlug: record.seasonSlug,
        cardType: record.cardType,
        seasonYear: record.seasonYear,
        releaseDate: record.releaseDate,
        position: record.position,
        teamId: record.teamId,
        teamName: record.teamName,
        teamNameEn: record.teamNameEn,
        leagueId: record.leagueId,
        leagueName: record.leagueName,
        ovr: record.ovr,
        pace: record.pace,
        shooting: record.shooting,
        passing: record.passing,
        dribbling: record.dribbling,
        defending: record.defending,
        physical: record.physical,
        rawStats: JSON.stringify(record.rawStats),
        price: record.price,
        priceUpdatedAt: record.priceUpdatedAt,
        updatedAt: record.updatedAt,
        priceSource: record.priceSource,
      });
    }
  });

  // Process in batches
  let processed = 0;
  for (let i = 0; i < playerRecords.length; i += BATCH_SIZE) {
    const batch = playerRecords.slice(i, i + BATCH_SIZE);
    insertMany(batch);
    processed += batch.length;
    onProgress?.('inserting', processed, playerRecords.length);

    if (processed % 5000 === 0 || processed === playerRecords.length) {
      logger.log(`[seed] Inserted ${processed} / ${playerRecords.length} players`);
    }
  }

  // -----------------------------------------------------------------------
  // Phase 6: Record seed metadata
  // -----------------------------------------------------------------------
  sqlite
    .prepare(
      `INSERT INTO seed_meta (source, rows_processed, rows_skipped, seeded_at, file_hash)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(csvPath, playerRecords.length, skipped, now, fileHash);

  // -----------------------------------------------------------------------
  // Phase 7: Analyze the database for query optimization
  // -----------------------------------------------------------------------
  logger.log('[seed] Running ANALYZE for query optimization...');
  sqlite.exec('ANALYZE');

  const durationMs = Date.now() - startTime;
  logger.log(
    `[seed] ✅ Seeding complete: ${playerRecords.length} players in ${durationMs}ms (${(durationMs / 1000).toFixed(1)}s)`,
  );

  return {
    seeded: true,
    playersProcessed: playerRecords.length,
    rowsSkipped: skipped,
    seasonsFound: seasonIdMap.size,
    completedAt: now,
    durationMs,
    schemaCreated,
    fileHash,
  };
}

/**
 * Reset the database completely — drops all tables and re-creates.
 * Useful for testing or when a clean slate is needed.
 */
export async function resetDatabase(): Promise<void> {
  resetDb();
  const dbPath = join(process.cwd(), 'data', 'fc-squad.db');
  if (existsSync(dbPath)) {
    const { unlinkSync } = await import('node:fs');
    unlinkSync(dbPath);
  }
}

/**
 * Get basic database statistics.
 */
export async function getDbStats(): Promise<{
  playerCount: number;
  seasonCount: number;
  teamCount: number;
  avgPrice: number;
  lastSeedDate: string | null;
}> {
  const db = getDb();
  const sqlite = getRawSqlite(db);

  const playerCount = (sqlite.prepare('SELECT COUNT(*) as count FROM players').get() as { count: number }).count;
  const seasonCount = (sqlite.prepare('SELECT COUNT(DISTINCT season_id) as count FROM players').get() as { count: number }).count;
  const teamCount = (sqlite.prepare('SELECT COUNT(DISTINCT team_id) as count FROM players').get() as { count: number }).count;
  const avgPrice = (sqlite.prepare('SELECT AVG(price) as avg FROM players WHERE price > 0').get() as { avg: number }).avg || 0;
  const lastSeed = sqlite.prepare('SELECT seeded_at FROM seed_meta ORDER BY id DESC LIMIT 1').get() as { seeded_at: string } | undefined;

  return {
    playerCount,
    seasonCount,
    teamCount,
    avgPrice: Math.round(avgPrice),
    lastSeedDate: lastSeed?.seeded_at || null,
  };
}
