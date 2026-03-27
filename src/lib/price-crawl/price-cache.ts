/**
 * Price cache store for the crawl system.
 *
 * Manages persistent storage of price data crawled from external sources.
 * Uses a hybrid approach:
 *
 * - **Local development**: Reads/writes to `data/price-cache.json` file
 * - **Vercel runtime**: Uses in-memory cache with JSON import from bundled data
 * - **Build time**: Export script includes price cache in the build output
 *
 * The price cache stores:
 * - Current prices for all crawled players (spid → price)
 * - Price history entries for trend analysis
 * - Crawl run metadata (timestamps, status, counts)
 *
 * This ensures users never wait for crawl — data is served from cache
 * and updated in the background by cron jobs.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type {
  PriceEntry,
  PriceCacheSnapshot,
  PriceSource,
  CrawlRunInfo,
  CrawlSystemStatus,
} from './types';
import { CRAWL_SCHEDULE_KST, type CrawlResult } from './types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CACHE_DIR = 'data';
const CACHE_FILENAME = 'price-cache.json';
const HISTORY_FILENAME = 'crawl-history.json';

// ---------------------------------------------------------------------------
// Price Cache Store
// ---------------------------------------------------------------------------

export class PriceCacheStore {
  private cache: Map<number, PriceEntry>;
  private crawlHistory: CrawlRunInfo[];
  private readonly cacheFilePath: string;
  private readonly historyFilePath: string;
  private initialized = false;

  constructor(baseDir?: string) {
    const dataDir = baseDir || join(process.cwd(), CACHE_DIR);
    this.cacheFilePath = join(dataDir, CACHE_FILENAME);
    this.historyFilePath = join(dataDir, HISTORY_FILENAME);
    this.cache = new Map();
    this.crawlHistory = [];
  }

  // -------------------------------------------------------------------------
  // Initialization
  // -------------------------------------------------------------------------

  /**
   * Initialize the price cache by loading from disk.
   * Safe to call multiple times — only loads once.
   */
  init(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.loadFromFile();
  }

  /**
   * Ensure the store is initialized (lazy init).
   */
  private ensureInit(): void {
    if (!this.initialized) {
      this.init();
    }
  }

  // -------------------------------------------------------------------------
  // Price Operations
  // -------------------------------------------------------------------------

  /**
   * Get a price entry by spid.
   */
  getPrice(spid: number): PriceEntry | undefined {
    this.ensureInit();
    return this.cache.get(spid);
  }

  /**
   * Get multiple price entries by spid.
   */
  getPrices(spids: number[]): Map<number, PriceEntry> {
    this.ensureInit();
    const result = new Map<number, PriceEntry>();
    for (const spid of spids) {
      const entry = this.cache.get(spid);
      if (entry) {
        result.set(spid, entry);
      }
    }
    return result;
  }

  /**
   * Get all price entries.
   */
  getAllPrices(): Map<number, PriceEntry> {
    this.ensureInit();
    return new Map(this.cache);
  }

  /**
   * Get price entries by source.
   */
  getPricesBySource(source: PriceSource): PriceEntry[] {
    this.ensureInit();
    return Array.from(this.cache.values()).filter((e) => e.source === source);
  }

  /**
   * Upsert price entries into the cache.
   * Entries are merged — higher confidence entries take precedence for the same spid.
   * If confidence is equal, the more recent entry wins.
   */
  upsertPrices(entries: PriceEntry[]): {
    updated: number;
    unchanged: number;
  } {
    this.ensureInit();

    let updated = 0;
    let unchanged = 0;

    for (const entry of entries) {
      const existing = this.cache.get(entry.spid);

      if (!existing) {
        // New entry
        this.cache.set(entry.spid, entry);
        updated++;
      } else {
        // Existing entry — update if new data is better
        const shouldUpdate =
          entry.confidence > existing.confidence ||
          (entry.confidence === existing.confidence &&
            entry.recordedAt > existing.recordedAt) ||
          (entry.price !== existing.price &&
            entry.confidence >= existing.confidence * 0.8);

        if (shouldUpdate) {
          this.cache.set(entry.spid, entry);
          updated++;
        } else {
          unchanged++;
        }
      }
    }

    return { updated, unchanged };
  }

  /**
   * Resolve player names to spids and upsert the resolved entries.
   * This bridges the gap between Inven's name-based data and our spid-based system.
   */
  resolveAndUpsert(
    nameEntries: Array<{ playerName: string; price: number; source: PriceSource; confidence: number; seasonInfo?: string }>,
    playerLookup: (name: string) => Array<{ spid: number; name: string; seasonName: string }>,
  ): {
    resolved: number;
    unresolved: number;
    entries: PriceEntry[];
  } {
    this.ensureInit();

    const entries: PriceEntry[] = [];
    let resolved = 0;
    let unresolved = 0;

    for (const nameEntry of nameEntries) {
      const matches = playerLookup(nameEntry.playerName);

      if (matches.length > 0) {
        // If season info is provided, try to narrow down
        let bestMatch = matches[0];
        if (nameEntry.seasonInfo) {
          const seasonMatch = matches.find(
            (m) =>
              m.seasonName.includes(nameEntry.seasonInfo!) ||
              nameEntry.seasonInfo!.includes(m.seasonName),
          );
          if (seasonMatch) {
            bestMatch = seasonMatch;
          }
        }

        entries.push({
          spid: bestMatch.spid,
          price: nameEntry.price,
          source: nameEntry.source,
          recordedAt: new Date().toISOString(),
          confidence: nameEntry.confidence,
        });
        resolved++;
      } else {
        unresolved++;
      }
    }

    // Upsert all resolved entries
    this.upsertPrices(entries);

    return { resolved, unresolved, entries };
  }

  /**
   * Get the total number of cached prices.
   */
  get size(): number {
    this.ensureInit();
    return this.cache.size;
  }

  /**
   * Clear all cached prices.
   */
  clear(): void {
    this.cache.clear();
  }

  // -------------------------------------------------------------------------
  // Snapshot & Serialization
  // -------------------------------------------------------------------------

  /**
   * Create a snapshot of the current price cache.
   */
  getSnapshot(): PriceCacheSnapshot {
    this.ensureInit();

    const sources: Record<PriceSource, number> = {
      inven: 0,
      nexon_trade: 0,
      seed: 0,
    };

    const prices: Record<number, PriceEntry> = {};
    for (const [spid, entry] of this.cache) {
      prices[spid] = entry;
      sources[entry.source]++;
    }

    return {
      prices,
      updatedAt: new Date().toISOString(),
      count: this.cache.size,
      sources,
    };
  }

  /**
   * Export the price cache as a JSON string (for build-time bundling).
   */
  exportToJson(): string {
    const snapshot = this.getSnapshot();
    return JSON.stringify(snapshot, null, 2);
  }

  /**
   * Import price data from a JSON string (for loading bundled data).
   */
  importFromJson(json: string): void {
    this.ensureInit();

    try {
      const snapshot: PriceCacheSnapshot = JSON.parse(json);
      if (snapshot.prices) {
        for (const [spidStr, entry] of Object.entries(snapshot.prices)) {
          const spid = Number(spidStr);
          if (!isNaN(spid) && entry) {
            this.cache.set(spid, entry as PriceEntry);
          }
        }
      }
    } catch (err) {
      console.error('[PriceCache] Failed to import JSON:', err);
    }
  }

  /**
   * Load the price cache from the file system.
   */
  loadFromFile(): void {
    if (existsSync(this.cacheFilePath)) {
      try {
        const json = readFileSync(this.cacheFilePath, 'utf-8');
        this.importFromJson(json);
      } catch (err) {
        console.error('[PriceCache] Failed to load from file:', err);
      }
    }
  }

  /**
   * Save the price cache to the file system.
   */
  saveToFile(): void {
    try {
      const dir = dirname(this.cacheFilePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      const json = this.exportToJson();
      writeFileSync(this.cacheFilePath, json, 'utf-8');
    } catch (err) {
      console.error('[PriceCache] Failed to save to file:', err);
    }
  }

  // -------------------------------------------------------------------------
  // Crawl History
  // -------------------------------------------------------------------------

  /**
   * Record a crawl run in the history.
   */
  recordCrawlRun(result: CrawlResult): void {
    const runInfo: CrawlRunInfo = {
      crawlId: result.crawlId,
      status: result.success ? 'completed' : 'failed',
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      result,
    };

    this.crawlHistory.unshift(runInfo);

    // Keep only the last 100 crawl runs
    if (this.crawlHistory.length > 100) {
      this.crawlHistory = this.crawlHistory.slice(0, 100);
    }

    this.saveHistoryToFile();
  }

  /**
   * Get the latest crawl run info.
   */
  getLatestRun(): CrawlRunInfo | null {
    this.loadHistoryFromFile();
    return this.crawlHistory[0] ?? null;
  }

  /**
   * Get crawl history (most recent first).
   */
  getCrawlHistory(limit = 10): CrawlRunInfo[] {
    this.loadHistoryFromFile();
    return this.crawlHistory.slice(0, limit);
  }

  /**
   * Count successful crawls today (in KST timezone).
   */
  getCrawlCountToday(): number {
    this.loadHistoryFromFile();

    const now = new Date();
    // Convert to KST (UTC+9)
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);
    const todayStr = kstNow.toISOString().split('T')[0];

    return this.crawlHistory.filter((run) => {
      if (run.status !== 'completed') return false;
      // Convert completedAt to KST before comparing dates
      if (!run.completedAt) return false;
      const runKst = new Date(new Date(run.completedAt).getTime() + kstOffset);
      const runDateStr = runKst.toISOString().split('T')[0];
      return runDateStr === todayStr;
    }).length;
  }

  /**
   * Load crawl history from file.
   */
  private loadHistoryFromFile(): void {
    if (existsSync(this.historyFilePath)) {
      try {
        const json = readFileSync(this.historyFilePath, 'utf-8');
        const data = JSON.parse(json);
        if (Array.isArray(data)) {
          this.crawlHistory = data;
        }
      } catch {
        // Ignore — use empty history
      }
    }
  }

  /**
   * Save crawl history to file.
   */
  private saveHistoryToFile(): void {
    try {
      const dir = dirname(this.historyFilePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
      writeFileSync(this.historyFilePath, JSON.stringify(this.crawlHistory, null, 2), 'utf-8');
    } catch (err) {
      console.error('[PriceCache] Failed to save crawl history:', err);
    }
  }

  // -------------------------------------------------------------------------
  // System Status
  // -------------------------------------------------------------------------

  /**
   * Get the full crawl system status for the status API.
   */
  getSystemStatus(maxCrawlsPerDay: number): CrawlSystemStatus {
    this.ensureInit();

    const latestRun = this.getLatestRun();
    const crawlCountToday = this.getCrawlCountToday();

    const sources: Record<PriceSource, number> = {
      inven: 0,
      nexon_trade: 0,
      seed: 0,
    };

    for (const entry of this.cache.values()) {
      sources[entry.source]++;
    }

    // Calculate next scheduled crawl time
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);
    const currentHourKst = kstNow.getUTCHours();

    let nextHourKst: number = parseInt(CRAWL_SCHEDULE_KST[0].split(':')[0], 10);
    for (const time of CRAWL_SCHEDULE_KST) {
      const hour = parseInt(time.split(':')[0], 10);
      if (hour > currentHourKst) {
        nextHourKst = hour;
        break;
      }
    }

    const nextCrawlKst = new Date(kstNow);
    nextCrawlKst.setUTCHours(nextHourKst, 0, 0, 0);
    if (nextCrawlKst <= kstNow) {
      nextCrawlKst.setDate(nextCrawlKst.getDate() + 1);
    }

    const currentStatus: CrawlSystemStatus['status'] = latestRun
      ? latestRun.status === 'running'
        ? 'running'
        : 'idle'
      : 'idle';

    return {
      status: currentStatus,
      latestRun,
      crawlCountToday,
      maxCrawlsPerDay,
      nextScheduledCrawl: nextCrawlKst.toISOString(),
      priceCache: {
        totalPrices: this.cache.size,
        lastUpdated: this.cache.size > 0
          ? Array.from(this.cache.values())
              .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))[0]
              ?.recordedAt ?? ''
          : '',
        sources,
      },
      schedule: {
        expression: '0 21,5,13 * * *', // UTC equivalent
        times: [...CRAWL_SCHEDULE_KST],
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

let storeInstance: PriceCacheStore | null = null;

/**
 * Get the singleton PriceCacheStore instance.
 * Safe to call from server-side code (API routes, server components).
 */
export function getPriceCacheStore(): PriceCacheStore {
  if (!storeInstance) {
    storeInstance = new PriceCacheStore();
    storeInstance.init();
  }
  return storeInstance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetPriceCacheStore(): void {
  storeInstance = null;
}
