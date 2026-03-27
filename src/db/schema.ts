/**
 * Drizzle ORM schema for the FC Online player database.
 *
 * The players table stores all player metadata, stats, and price data
 * sourced from details.csv (initial seed) and updated via crawling.
 *
 * Key design decisions:
 * - Composite stats (pace, shooting, etc.) are stored as dedicated columns
 *   for efficient range filtering in WHERE clauses.
 * - Raw stats are stored as a JSON blob for detailed stat views.
 * - spid is the primary key (unique per season card variant).
 * - Indexes on commonly filtered/sorted columns for query performance.
 */

import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';

/** Player season card variants (one row per season-specific player) */
export const players = sqliteTable(
  'players',
  {
    // -----------------------------------------------------------------------
    // Identity
    // -----------------------------------------------------------------------

    /** FC Online season-specific player ID — unique per card version */
    spid: integer('spid').primaryKey(),

    /** Base player ID shared across all card versions */
    pid: integer('pid').notNull(),

    /** Player name in Korean */
    name: text('name').notNull(),

    /** Player name in English */
    nameEn: text('name_en').notNull(),

    // -----------------------------------------------------------------------
    // Season / Card info
    // -----------------------------------------------------------------------

    /** Numeric season ID referencing the Season.id */
    seasonId: integer('season_id').notNull(),

    /** Season display name (e.g., 'TOTNUCL (24/25)') */
    seasonName: text('season_name').notNull(),

    /** URL-friendly season slug (e.g., 'totnucl-2425') */
    seasonSlug: text('season_slug').notNull(),

    /** Card type classification: BASE | SPECIAL | ICON | LIVE | MOM | POTW */
    cardType: text('card_type', { enum: ['BASE', 'SPECIAL', 'ICON', 'LIVE', 'MOM', 'POTW'] }).notNull(),

    /** Season year/period (e.g., '24/25', '23') */
    seasonYear: text('season_year').notNull().default(''),

    /** ISO date string for card release */
    releaseDate: text('release_date').notNull().default(''),

    // -----------------------------------------------------------------------
    // Position & Team
    // -----------------------------------------------------------------------

    /** Primary position (e.g., 'ST', 'CAM', 'GK') */
    position: text('position').notNull(),

    /** Team numeric ID */
    teamId: integer('team_id').notNull().default(0),

    /** Team display name */
    teamName: text('team_name').notNull().default(''),

    /** Team name in English */
    teamNameEn: text('team_name_en').notNull().default(''),

    /** League numeric ID (-1 = OTHER) */
    leagueId: integer('league_id').notNull().default(-1),

    /** League display name (e.g., 'EPL', 'LALIGA') */
    leagueName: text('league_name').notNull().default(''),

    // -----------------------------------------------------------------------
    // Composite stats (FIFA-style overview)
    // -----------------------------------------------------------------------

    ovr: integer('ovr').notNull().default(0),
    pace: integer('pace').notNull().default(0),
    shooting: integer('shooting').notNull().default(0),
    passing: integer('passing').notNull().default(0),
    dribbling: integer('dribbling').notNull().default(0),
    defending: integer('defending').notNull().default(0),
    physical: integer('physical').notNull().default(0),

    // -----------------------------------------------------------------------
    // Raw detailed stats (30 Korean-named stats stored as JSON)
    // -----------------------------------------------------------------------

    /**
     * JSON object with 30 key-value pairs (Korean stat names → number).
     * Example: {"속력": 85, "가속력": 78, "골 결정력": 82, ...}
     */
    rawStats: text('raw_stats', { mode: 'json' }).notNull().default({}),

    // -----------------------------------------------------------------------
    // Price data
    // -----------------------------------------------------------------------

    /** Current market price in BP (game currency) */
    price: integer('price').notNull().default(0),

    /** ISO timestamp of last price update */
    priceUpdatedAt: text('price_updated_at').notNull().default(''),

    // -----------------------------------------------------------------------
    // Metadata
    // -----------------------------------------------------------------------

    /** ISO timestamp of when this record was last updated */
    updatedAt: text('updated_at').notNull().default(''),

    /** Source of the price data: 'seed' (CSV) or 'crawl' (Inven/Nexon) */
    priceSource: text('price_source', { enum: ['seed', 'crawl'] }).notNull().default('seed'),
  },
  (table) => [
    // Indexes for common search/filter operations
    index('idx_players_pid').on(table.pid),
    index('idx_players_name').on(table.name),
    index('idx_players_name_en').on(table.nameEn),
    index('idx_players_position').on(table.position),
    index('idx_players_team_id').on(table.teamId),
    index('idx_players_season_id').on(table.seasonId),
    index('idx_players_card_type').on(table.cardType),
    index('idx_players_season_year').on(table.seasonYear),
    index('idx_players_ovr').on(table.ovr),
    index('idx_players_price').on(table.price),
    // Composite index for common position + ovr filtering
    index('idx_players_position_ovr').on(table.position, table.ovr),
    // Composite index for team + position filtering (squad builder)
    index('idx_players_team_position').on(table.teamId, table.position),
    // Composite index for position + price filtering (budget squad)
    index('idx_players_position_price').on(table.position, table.price),
  ],
);

/** Schema version / migration tracking table */
export const schemaVersion = sqliteTable('schema_version', {
  /** Version number (monotonically increasing integer) */
  version: integer('version').primaryKey(),
  /** ISO timestamp of when this version was applied */
  appliedAt: text('applied_at').notNull(),
  /** Human-readable description of what this version does */
  description: text('description').notNull(),
});

/**
 * Price history log for tracking price changes over time.
 * Each row represents a price snapshot for a player at a given time.
 */
export const priceHistory = sqliteTable(
  'price_history',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /** Player SPID reference */
    spid: integer('spid').notNull(),
    /** Price at this point in time */
    price: integer('price').notNull(),
    /** Source of this price data point */
    source: text('source', { enum: ['seed', 'crawl', 'nexon_trade'] }).notNull().default('seed'),
    /** ISO timestamp of when this price was recorded */
    recordedAt: text('recorded_at').notNull(),
  },
  (table) => [
    index('idx_price_history_spid').on(table.spid),
    index('idx_price_history_recorded_at').on(table.recordedAt),
  ],
);

/** Seed metadata — tracks when CSV seed was last loaded */
export const seedMeta = sqliteTable('seed_meta', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** Source file path or URL */
  source: text('source').notNull(),
  /** Number of rows processed from the CSV */
  rowsProcessed: integer('rows_processed').notNull().default(0),
  /** Number of rows skipped (invalid data) */
  rowsSkipped: integer('rows_skipped').notNull().default(0),
  /** ISO timestamp of when this seed was applied */
  seededAt: text('seeded_at').notNull(),
  /** CSV file hash for change detection */
  fileHash: text('file_hash').notNull().default(''),
});

// ---------------------------------------------------------------------------
// Type exports for insert/select
// ---------------------------------------------------------------------------

export type NewPlayer = typeof players.$inferInsert;
export type PlayerRow = typeof players.$inferSelect;
export type NewSeedMeta = typeof seedMeta.$inferInsert;
export type SeedMetaRow = typeof seedMeta.$inferSelect;
export type NewPriceHistory = typeof priceHistory.$inferInsert;
export type PriceHistoryRow = typeof priceHistory.$inferSelect;
