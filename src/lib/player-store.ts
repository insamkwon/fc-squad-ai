import { Player, PlayerFilter, PlayerRawStats, Position, POSITION_CATEGORIES } from '@/types/player';
import { generateMockPlayers } from '@/data/mock-players';
import {
  SearchIndexEntry,
  SearchResult,
  PaginatedResult,
  PaginationOptions,
  normalizeQuery,
  tokenize,
  buildSearchIndexEntry,
  scoreSearchMatch,
  paginateResults,
} from '@/lib/search-utils';

// ---------------------------------------------------------------------------
// Runtime data loading strategies
// ---------------------------------------------------------------------------

/** Raw row shape from the SQLite database / data bundle */
interface PlayerRow {
  spid: number;
  pid: number;
  name: string;
  name_en: string;
  season_id: number;
  season_name: string;
  season_slug: string;
  card_type: string;
  season_year: string;
  release_date: string;
  position: string;
  team_id: number;
  team_name: string;
  team_name_en: string;
  league_id: number;
  league_name: string;
  ovr: number;
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  raw_stats?: string;
  price: number;
  price_updated_at: string;
}

/**
 * Convert a raw DB row to a Player object.
 * raw_stats is optional — excluded from the Vercel build export to save space.
 */
function rowToPlayer(row: PlayerRow): Player {
  return {
    spid: row.spid,
    pid: row.pid,
    name: row.name,
    nameEn: row.name_en,
    seasonId: row.season_id,
    seasonName: row.season_name,
    seasonSlug: row.season_slug,
    cardType: row.card_type as Player['cardType'],
    seasonYear: row.season_year,
    releaseDate: row.release_date,
    position: row.position as Position,
    teamId: row.team_id,
    teamName: row.team_name,
    teamNameEn: row.team_name_en,
    leagueId: row.league_id,
    leagueName: row.league_name,
    stats: {
      ovr: row.ovr,
      pace: row.pace,
      shooting: row.shooting,
      passing: row.passing,
      dribbling: row.dribbling,
      defending: row.defending,
      physical: row.physical,
    },
    raw: row.raw_stats
      ? JSON.parse(row.raw_stats) as PlayerRawStats
      : undefined,
    price: row.price,
    priceUpdatedAt: row.price_updated_at,
  };
}

/**
 * Load players from a JSON file exported at build time.
 * This is the preferred path on Vercel / serverless deployments where
 * native modules (better-sqlite3) may not be available.
 *
 * The export script writes to data/players.json during the build step.
 */
function loadFromJsonFile(): Player[] | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFileSync, existsSync } = require('node:fs') as typeof import('node:fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('node:path') as typeof import('node:path');
    const jsonPath = join(process.cwd(), 'data', 'players.json');

    if (!existsSync(jsonPath)) return null;

    const raw = readFileSync(jsonPath, 'utf-8');
    const rows: PlayerRow[] = JSON.parse(raw);
    return rows.map(rowToPlayer);
  } catch {
    return null;
  }
}

/**
 * Load players from the SQLite database (local development).
 * This requires better-sqlite3 which is a native module.
 */
function loadFromDatabase(): Player[] | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDb } = require('@/db');
    const db = getDb();
    const sqlite = (db as any).$client;
    const rows = sqlite
      .prepare(
        `SELECT spid, pid, name, name_en, season_id, season_name, season_slug,
                card_type, season_year, release_date, position, team_id, team_name,
                team_name_en, league_id, league_name, ovr, pace, shooting, passing,
                dribbling, defending, physical, raw_stats, price, price_updated_at
         FROM players ORDER BY ovr DESC`,
      )
      .all() as PlayerRow[];
    return rows.map(rowToPlayer);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Singleton Player Store
// ---------------------------------------------------------------------------

class PlayerStore {
  private players: Player[];
  private searchIndex: Map<number, SearchIndexEntry>;
  private initialized = false;

  constructor() {
    this.players = [];
    this.searchIndex = new Map();
  }

  /** Lazy-initialise the store. Tries JSON file first, then DB, then mock data. */
  private ensureInit(): void {
    if (this.initialized) return;

    // Strategy 1: Load from build-time JSON file (preferred on Vercel — no native deps)
    const jsonPlayers = loadFromJsonFile();
    if (jsonPlayers && jsonPlayers.length > 0) {
      this.players = jsonPlayers;
      console.log(`[player-store] Loaded ${this.players.length} players from JSON file`);
    } else {
      // Strategy 2: Load from SQLite database (local dev fallback)
      const dbPlayers = loadFromDatabase();
      if (dbPlayers && dbPlayers.length > 0) {
        this.players = dbPlayers;
        console.log(`[player-store] Loaded ${this.players.length} players from SQLite database`);
      } else {
        // Strategy 3: Mock data (last resort)
        console.log('[player-store] No data source available, using mock data');
        console.log('[player-store] Run "npm run seed" to populate the database from details.csv');
        this.players = generateMockPlayers(200);
      }
    }

    this.buildSearchIndex();
    this.initialized = true;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Search & filter players.
   *
   * Returns a new array every call.  **No deduplication by player name is
   * performed** — every matching season card variant appears as a separate
   * result entry so users can compare different card versions of the same
   * real-world player.
   *
   * Results are sorted by OVR descending, then grouped by base player (pid)
   * so that all season variants of a given player appear together.
   */
  searchPlayers(filter: PlayerFilter): Player[] {
    this.ensureInit();

    const filtered = this.players.filter((p) => {
      // --- text search (Korean + English, case-insensitive, partial) ---
      if (filter.search) {
        const q = filter.search.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesNameEn = p.nameEn.toLowerCase().includes(q);
        if (!matchesName && !matchesNameEn) return false;
      }

      // --- position filter (exact match or category match) ---
      if (filter.positions && filter.positions.length > 0) {
        if (!this.matchesPosition(p.position, filter.positions)) return false;
      }

      // --- team / season ---
      if (filter.teamId !== undefined && p.teamId !== filter.teamId) return false;
      if (filter.seasonId !== undefined && p.seasonId !== filter.seasonId) return false;
      if (filter.seasonSlug !== undefined && p.seasonSlug !== filter.seasonSlug) return false;

      // --- card type filter ---
      if (filter.cardType !== undefined && p.cardType !== filter.cardType) return false;

      // --- season year filter ---
      if (filter.seasonYear !== undefined && p.seasonYear !== filter.seasonYear) return false;

      // --- ovr range ---
      if (filter.minOvr !== undefined && p.stats.ovr < filter.minOvr) return false;
      if (filter.maxOvr !== undefined && p.stats.ovr > filter.maxOvr) return false;

      // --- price range ---
      if (filter.minPrice !== undefined && p.price < filter.minPrice) return false;
      if (filter.maxPrice !== undefined && p.price > filter.maxPrice) return false;

      // --- individual stat ranges ---
      if (filter.minPace !== undefined && p.stats.pace < filter.minPace) return false;
      if (filter.maxPace !== undefined && p.stats.pace > filter.maxPace) return false;
      if (filter.minShooting !== undefined && p.stats.shooting < filter.minShooting) return false;
      if (filter.maxShooting !== undefined && p.stats.shooting > filter.maxShooting) return false;
      if (filter.minPassing !== undefined && p.stats.passing < filter.minPassing) return false;
      if (filter.maxPassing !== undefined && p.stats.passing > filter.maxPassing) return false;
      if (filter.minDribbling !== undefined && p.stats.dribbling < filter.minDribbling) return false;
      if (filter.maxDribbling !== undefined && p.stats.dribbling > filter.maxDribbling) return false;
      if (filter.minDefending !== undefined && p.stats.defending < filter.minDefending) return false;
      if (filter.maxDefending !== undefined && p.stats.defending > filter.maxDefending) return false;
      if (filter.minPhysical !== undefined && p.stats.physical < filter.minPhysical) return false;
      if (filter.maxPhysical !== undefined && p.stats.physical > filter.maxPhysical) return false;

      return true;
    });

    // Sort: highest OVR first, then group by base player (pid) so all season
    // card variants of the same player appear adjacent in results.
    filtered.sort((a, b) => {
      // Primary sort: OVR descending
      if (b.stats.ovr !== a.stats.ovr) return b.stats.ovr - a.stats.ovr;
      // Secondary sort: group by base player pid
      if (a.pid !== b.pid) return a.pid - b.pid;
      // Tertiary sort: seasonId descending (newer seasons first)
      return b.seasonId - a.seasonId;
    });

    return filtered;
  }

  /**
   * Advanced search with bilingual matching, relevance scoring, and pagination.
   *
   * Matches queries against:
   * - Korean player names (exact, prefix, contains)
   * - English player names (tokenized for "son heungmin" or just "heungmin")
   * - Romanized Korean names (한글 → Latin transliteration)
   * - Korean team names
   * - English team names
   *
   * Results are scored by relevance and returned with pagination metadata.
   */
  searchPlayersAdvanced(
    query: string,
    filter?: Omit<PlayerFilter, 'search'>,
    pagination?: PaginationOptions,
  ): PaginatedResult<Player> {
    this.ensureInit();

    const normalizedQuery = normalizeQuery(query);
    const queryTokens = tokenize(normalizedQuery);

    // Skip empty queries — return empty result (or apply filters only)
    if (!normalizedQuery) {
      const baseFiltered = filter
        ? this.searchPlayers({ ...filter, search: '' })
        : this.players;
      const sorted = [...baseFiltered].sort((a, b) => b.stats.ovr - a.stats.ovr);
      const limit = Math.min(Math.max(pagination?.limit ?? 20, 1), 100);
      const offset = Math.max(pagination?.offset ?? 0, 0);
      return {
        results: sorted.slice(offset, offset + limit),
        total: sorted.length,
        limit,
        offset,
      };
    }

    // Score all players against the query
    const scored: SearchResult<Player>[] = [];

    for (const player of this.players) {
      const entry = this.searchIndex.get(player.spid);
      if (!entry) continue;

      const score = scoreSearchMatch(entry, normalizedQuery, queryTokens);

      // Only include results with a non-zero score (i.e., actually matched)
      if (score > 0) {
        scored.push({ item: player, score });
      }
    }

    // Apply additional filters to the scored results
    const filterFn = filter
      ? (p: Player): boolean => {
          // Apply all filters except search (already handled by scoring)
          if (filter.positions && filter.positions.length > 0) {
            if (!this.matchesPosition(p.position, filter.positions)) return false;
          }
          if (filter.teamId !== undefined && p.teamId !== filter.teamId) return false;
          if (filter.seasonId !== undefined && p.seasonId !== filter.seasonId) return false;
          if (filter.seasonSlug !== undefined && p.seasonSlug !== filter.seasonSlug) return false;
          if (filter.cardType !== undefined && p.cardType !== filter.cardType) return false;
          if (filter.seasonYear !== undefined && p.seasonYear !== filter.seasonYear) return false;
          if (filter.minOvr !== undefined && p.stats.ovr < filter.minOvr) return false;
          if (filter.maxOvr !== undefined && p.stats.ovr > filter.maxOvr) return false;
          if (filter.minPrice !== undefined && p.price < filter.minPrice) return false;
          if (filter.maxPrice !== undefined && p.price > filter.maxPrice) return false;
          if (filter.minPace !== undefined && p.stats.pace < filter.minPace) return false;
          if (filter.maxPace !== undefined && p.stats.pace > filter.maxPace) return false;
          if (filter.minShooting !== undefined && p.stats.shooting < filter.minShooting) return false;
          if (filter.maxShooting !== undefined && p.stats.shooting > filter.maxShooting) return false;
          if (filter.minPassing !== undefined && p.stats.passing < filter.minPassing) return false;
          if (filter.maxPassing !== undefined && p.stats.passing > filter.maxPassing) return false;
          if (filter.minDribbling !== undefined && p.stats.dribbling < filter.minDribbling) return false;
          if (filter.maxDribbling !== undefined && p.stats.dribbling > filter.maxDribbling) return false;
          if (filter.minDefending !== undefined && p.stats.defending < filter.minDefending) return false;
          if (filter.maxDefending !== undefined && p.stats.defending > filter.maxDefending) return false;
          if (filter.minPhysical !== undefined && p.stats.physical < filter.minPhysical) return false;
          if (filter.maxPhysical !== undefined && p.stats.physical > filter.maxPhysical) return false;
          return true;
        }
      : () => true;

    const filtered = scored.filter((r) => filterFn(r.item));

    return paginateResults(filtered, pagination);
  }

  /**
   * Quick autocomplete suggestions (lightweight, returns top N).
   * Used for typeahead/autocomplete in search bars.
   */
  suggestPlayers(query: string, limit: number = 8): Player[] {
    this.ensureInit();

    const normalizedQuery = normalizeQuery(query);
    if (!normalizedQuery) return [];

    const queryTokens = tokenize(normalizedQuery);
    const scored: SearchResult<Player>[] = [];

    for (const player of this.players) {
      const entry = this.searchIndex.get(player.spid);
      if (!entry) continue;

      const score = scoreSearchMatch(entry, normalizedQuery, queryTokens);
      if (score > 0) {
        scored.push({ item: player, score });
      }
    }

    // Sort by score desc and return top N (deduplicate by pid to avoid
    // showing multiple season variants in autocomplete)
    scored.sort((a, b) => b.score - a.score);

    const seen = new Set<number>();
    const suggestions: Player[] = [];
    for (const result of scored) {
      if (seen.has(result.item.pid)) continue;
      seen.add(result.item.pid);
      suggestions.push(result.item);
      if (suggestions.length >= limit) break;
    }

    return suggestions;
  }

  /** Lookup a single player by their spid. */
  getPlayerBySpid(spid: number): Player | undefined {
    this.ensureInit();
    return this.players.find((p) => p.spid === spid);
  }

  /** Return a deduplicated list of {id, name} for every team in the store. */
  getAllTeams(): { id: number; name: string }[] {
    this.ensureInit();
    const map = new Map<number, string>();
    for (const p of this.players) {
      if (!map.has(p.teamId)) {
        map.set(p.teamId, p.teamName);
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.id - b.id);
  }

  /** Return a deduplicated list of {id, name} for every season in the store. */
  getAllSeasons(): { id: number; name: string }[] {
    this.ensureInit();
    const map = new Map<number, string>();
    for (const p of this.players) {
      if (!map.has(p.seasonId)) {
        map.set(p.seasonId, p.seasonName);
      }
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.id - b.id);
  }

  /** Access the full player list (read-only). Useful for squad generation. */
  getAllPlayers(): Player[] {
    this.ensureInit();
    return this.players;
  }

  /**
   * Apply crawled price overlay from the price cache.
   * Updates player prices in-memory with the most recent crawled data.
   * This is called after crawl completion to ensure fresh prices are served.
   */
  applyPriceOverlay(
    priceMap: Map<number, { price: number; recordedAt: string }>,
  ): { updated: number } {
    this.ensureInit();

    let updated = 0;
    for (const player of this.players) {
      const cached = priceMap.get(player.spid);
      if (cached && cached.price > 0) {
        // Only update if crawled price is more recent or different
        if (
          cached.price !== player.price ||
          cached.recordedAt > player.priceUpdatedAt
        ) {
          player.price = cached.price;
          player.priceUpdatedAt = cached.recordedAt;
          updated++;
        }
      }
    }

    if (updated > 0) {
      console.log(`[player-store] Applied ${updated} crawled price updates`);
    }

    return { updated };
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  /**
   * Build a search index for all players.
   * Called once during initialization.
   */
  private buildSearchIndex(): void {
    for (const player of this.players) {
      this.searchIndex.set(
        player.spid,
        buildSearchIndexEntry({
          name: player.name,
          nameEn: player.nameEn,
          teamName: player.teamName,
          teamNameEn: player.teamNameEn,
        }),
      );
    }
  }

  /**
   * A position filter value may be an exact position (e.g. 'ST') or a
   * position-category key (e.g. 'FW').  We match against both.
   */
  private matchesPosition(playerPos: Position, filterPositions: Position[]): boolean {
    for (const fp of filterPositions) {
      // Direct match
      if (fp === playerPos) return true;

      // Category match (e.g. filter 'FW' matches 'ST')
      const categoryPositions = POSITION_CATEGORIES[fp];
      if (categoryPositions && categoryPositions.includes(playerPos)) return true;
    }
    return false;
  }
}

// Module-level singleton
export const playerStore = new PlayerStore();
