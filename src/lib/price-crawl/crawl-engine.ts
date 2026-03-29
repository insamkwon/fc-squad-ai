/**
 * Crawl engine — orchestrates the price crawl process.
 *
 * Responsibilities:
 * 1. Coordinate fetchers (Inven, Nexon) to run concurrently with rate limits
 * 2. Resolve player names to spids using the player database
 * 3. Cross-verify Inven prices against Nexon trade data (via CrossVerificationService)
 * 4. Merge results into the price cache with confidence scoring
 * 5. Enforce daily crawl limits (max 3x/day)
 * 6. Track crawl run history and status
 * 7. Save results to persistent storage
 *
 * Architecture:
 * - The engine is designed to run within Vercel serverless constraints
 *   (60s maxDuration, no persistent filesystem)
 * - It uses the PriceCacheStore for persistence (file-based locally,
 *   JSON-bundled on Vercel)
 * - The engine is idempotent — running the same crawl twice is safe
 */

import type {
  CrawlResult,
  FetcherResult,
  PriceEntry,
  CrawlEngineConfig,
} from './types';
import { DEFAULT_CRAWL_CONFIG } from './types';
import { InvenFetcher } from './fetchers/inven-fetcher';
import { NexonFetcher } from './fetchers/nexon-fetcher';
import { CrossVerificationService, getCrossVerificationService } from './cross-verification';
import type { NexonTradeDatum } from './cross-verification';
import { PriceCacheStore, getPriceCacheStore } from './price-cache';

// ---------------------------------------------------------------------------
// Player lookup function type
// ---------------------------------------------------------------------------

/** Function that resolves player names to spid matches */
export type PlayerLookupFn = (
  name: string,
) => Array<{ spid: number; name: string; seasonName: string }>;

// ---------------------------------------------------------------------------
// Crawl Engine
// ---------------------------------------------------------------------------

export class CrawlEngine {
  private readonly config: CrawlEngineConfig;
  private readonly invenFetcher: InvenFetcher;
  private readonly nexonFetcher: NexonFetcher;
  private readonly crossVerification: CrossVerificationService;
  private readonly priceCache: PriceCacheStore;
  private playerLookup: PlayerLookupFn | null = null;
  private isRunning = false;

  constructor(config?: Partial<CrawlEngineConfig>, priceCache?: PriceCacheStore) {
    this.config = { ...DEFAULT_CRAWL_CONFIG, ...config };
    this.invenFetcher = new InvenFetcher();
    this.nexonFetcher = new NexonFetcher();
    this.crossVerification = getCrossVerificationService();
    this.priceCache = priceCache ?? getPriceCacheStore();
  }

  /**
   * Set a provider that returns all player SPIDs from the database.
   * Used by NexonFetcher to expand price coverage beyond dailytrade.
   */
  setDbSpidProvider(provider: () => Array<{ spid: number; ovr: number }>): void {
    this.nexonFetcher.setDbSpidProvider(provider);
  }

  /**
   * Set the player lookup function for resolving names to spids.
   * Must be called before running the crawl if Inven data is used.
   */
  setPlayerLookup(fn: PlayerLookupFn): void {
    this.playerLookup = fn;
  }

  /**
   * Get the current crawl status.
   */
  get status(): 'idle' | 'running' {
    return this.isRunning ? 'running' : 'idle';
  }

  /**
   * Check if a crawl can be run (daily limit not exceeded).
   */
  canCrawl(): boolean {
    const crawlCountToday = this.priceCache.getCrawlCountToday();
    return crawlCountToday < this.config.maxCrawlsPerDay && !this.isRunning;
  }

  /**
   * Get the number of remaining crawls allowed today.
   */
  get remainingCrawlsToday(): number {
    const crawlCountToday = this.priceCache.getCrawlCountToday();
    return Math.max(0, this.config.maxCrawlsPerDay - crawlCountToday);
  }

  /**
   * Run a full crawl cycle.
   *
   * This is the main entry point for the crawl system. It:
   * 1. Checks daily rate limit
   * 2. Runs all configured fetchers concurrently (with limits)
   * 3. Resolves player names to spids
   * 4. Cross-verifies with Nexon data via CrossVerificationService
   * 5. Merges results into the price cache
   * 6. Records the crawl run in history
   * 7. Saves the price cache to disk
   *
   * @returns The crawl result with detailed statistics
   */
  async runCrawl(): Promise<CrawlResult> {
    // --- Rate limit check ---
    if (this.isRunning) {
      return this.createErrorResult('Crawl already in progress');
    }

    if (!this.canCrawl()) {
      return this.createErrorResult(
        `Daily crawl limit reached (${this.config.maxCrawlsPerDay} crawls/day)`,
      );
    }

    // --- Start crawl ---
    this.isRunning = true;
    const crawlId = this.generateCrawlId();
    const startedAt = new Date().toISOString();

    console.log(`[CrawlEngine] Starting crawl ${crawlId} at ${startedAt}`);

    try {
      // Step 1: Run fetchers concurrently
      const fetcherPromises: Promise<FetcherResult>[] = [];

      // InvenFetcher is currently non-functional (page structure changed) — skip
      // if (this.invenFetcher.isConfigured) {
      //   fetcherPromises.push(this.invenFetcher.fetch());
      // }

      if (this.config.enableNexonVerification) {
        fetcherPromises.push(this.nexonFetcher.fetch());
      }

      const fetcherResults = await Promise.allSettled(fetcherPromises);
      const resolvedResults: FetcherResult[] = [];

      for (const result of fetcherResults) {
        if (result.status === 'fulfilled') {
          resolvedResults.push(result.value);
        } else {
          resolvedResults.push({
            fetcher: 'unknown',
            entries: [],
            successCount: 0,
            errorCount: 1,
            durationMs: 0,
            error: result.reason?.message ?? String(result.reason),
            warnings: [],
          });
        }
      }

      // Step 2: Process Inven results (name resolution)
      let totalUpdated = 0;
      let totalUnchanged = 0;

      const invenResult = resolvedResults.find((r) => r.fetcher === 'inven');
      if (invenResult && invenResult.entries.length > 0 && this.playerLookup) {
        const nameEntries = invenResult.entries.map((e) => {
          const meta = (e as unknown as Record<string, unknown>)._meta as
            | Record<string, unknown>
            | undefined;
          return {
            playerName: meta ? String(meta.playerName ?? '') : '',
            price: e.price,
            source: 'inven' as const,
            confidence: e.confidence,
            seasonInfo: meta ? String(meta.seasonInfo ?? '') : undefined,
          };
        });

        const resolveResult = this.priceCache.resolveAndUpsert(
          nameEntries,
          this.playerLookup,
        );
        totalUpdated += resolveResult.resolved;
        totalUnchanged += resolveResult.unresolved;
      }

      // Step 3: Cross-verify using CrossVerificationService
      const nexonResult = resolvedResults.find((r) => r.fetcher === 'nexon_trade');
      let verificationSummary: string | null = null;

      if (nexonResult && nexonResult.entries.length > 0) {
        // Build Nexon trade data map from fetcher results
        const nexonTradeMap = this.buildNexonTradeMap(nexonResult.entries);

        if (nexonTradeMap.size > 0) {
          // Get all cached prices for verification
          const allPrices = this.priceCache.getAllPrices();

          // Build player name map from cached data
          const playerNameMap = this.buildPlayerNameMap(allPrices);

          // Run cross-verification
          const { discrepancies, summary } = this.crossVerification.verify(
            allPrices,
            nexonTradeMap,
            playerNameMap,
          );

          // Apply verification results to the price cache
          const updates = this.crossVerification.applyToCache(allPrices, discrepancies);
          if (updates.length > 0) {
            const upsertResult = this.priceCache.upsertPrices(updates);
            totalUpdated += upsertResult.updated;
            totalUnchanged += upsertResult.unchanged;
          }

          // Build verification summary for logging
          verificationSummary = this.formatVerificationSummary(summary);
          console.log(`[CrawlEngine] Cross-verification: ${verificationSummary}`);
        }

        // Also upsert Nexon prices directly as their own entries
        const upsertResult = this.priceCache.upsertPrices(nexonResult.entries);
        totalUpdated += upsertResult.updated;
        totalUnchanged += upsertResult.unchanged;
      }

      // Step 4: Filter out low-confidence entries
      this.filterLowConfidence();

      // Step 5: Save to disk
      this.priceCache.saveToFile();

      const completedAt = new Date().toISOString();
      const durationMs =
        new Date(completedAt).getTime() - new Date(startedAt).getTime();

      const success = resolvedResults.some((r) => r.successCount > 0);
      const summary = this.buildSummary(
        success,
        totalUpdated,
        totalUnchanged,
        resolvedResults,
        verificationSummary,
      );

      const crawlResult: CrawlResult = {
        crawlId,
        startedAt,
        completedAt,
        durationMs,
        fetcherResults: resolvedResults,
        totalUpdated,
        totalUnchanged,
        success,
        summary,
      };

      // Step 6: Record in history
      this.priceCache.recordCrawlRun(crawlResult);

      // Step 7: Apply price overlay to PlayerStore (in-memory)
      await this.applyPriceOverlay();

      console.log(`[CrawlEngine] Crawl ${crawlId} completed: ${summary}`);

      return crawlResult;
    } catch (err) {
      const errorResult = this.createErrorResult(
        err instanceof Error ? err.message : String(err),
        crawlId,
        startedAt,
      );
      this.priceCache.recordCrawlRun(errorResult);
      return errorResult;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run a partial crawl (only Inven, skip Nexon verification).
   * Useful when the Nexon API key is not configured.
   */
  async runInvenOnly(): Promise<CrawlResult> {
    const prevConfig = this.config.enableNexonVerification;
    this.config.enableNexonVerification = false;

    try {
      return await this.runCrawl();
    } finally {
      this.config.enableNexonVerification = prevConfig;
    }
  }

  /**
   * Run a manual crawl (bypasses daily limit check but still checks if running).
   * Intended for admin use or development/testing.
   */
  async runManualCrawl(): Promise<CrawlResult> {
    if (this.isRunning) {
      return this.createErrorResult('Crawl already in progress');
    }

    this.isRunning = true;
    const crawlId = this.generateCrawlId();
    const startedAt = new Date().toISOString();

    console.log(`[CrawlEngine] Manual crawl ${crawlId} started at ${startedAt}`);

    try {
      // Run fetchers (InvenFetcher skipped — page structure changed, non-functional)
      const fetcherResults = await Promise.allSettled([
        // this.invenFetcher.fetch(),
        this.config.enableNexonVerification
          ? this.nexonFetcher.fetch()
          : Promise.resolve({
              fetcher: 'nexon_trade',
              entries: [],
              successCount: 0,
              errorCount: 0,
              durationMs: 0,
              warnings: ['Skipped (not configured)'],
            } as FetcherResult),
      ]);

      const resolvedResults: FetcherResult[] = fetcherResults.map((r) =>
        r.status === 'fulfilled'
          ? r.value
          : {
              fetcher: 'unknown',
              entries: [],
              successCount: 0,
              errorCount: 1,
              durationMs: 0,
              error: r.reason?.message ?? String(r.reason),
              warnings: [],
            },
      );

      let totalUpdated = 0;
      let totalUnchanged = 0;

      // Process Inven results
      const invenResult = resolvedResults.find((r) => r.fetcher === 'inven');
      if (invenResult && invenResult.entries.length > 0 && this.playerLookup) {
        const nameEntries = invenResult.entries.map((e) => {
          const meta = (e as unknown as Record<string, unknown>)._meta as
            | Record<string, unknown>
            | undefined;
          return {
            playerName: meta ? String(meta.playerName ?? '') : '',
            price: e.price,
            source: 'inven' as const,
            confidence: e.confidence,
            seasonInfo: meta ? String(meta.seasonInfo ?? '') : undefined,
          };
        });

        const resolveResult = this.priceCache.resolveAndUpsert(
          nameEntries,
          this.playerLookup,
        );
        totalUpdated += resolveResult.resolved;
        totalUnchanged += resolveResult.unresolved;
      }

      // Process Nexon results via CrossVerificationService
      const nexonResult = resolvedResults.find(
        (r) => r.fetcher === 'nexon_trade',
      );
      let verificationSummary: string | null = null;

      if (nexonResult && nexonResult.entries.length > 0) {
        const nexonTradeMap = this.buildNexonTradeMap(nexonResult.entries);

        if (nexonTradeMap.size > 0) {
          const allPrices = this.priceCache.getAllPrices();
          const playerNameMap = this.buildPlayerNameMap(allPrices);

          const { discrepancies, summary } = this.crossVerification.verify(
            allPrices,
            nexonTradeMap,
            playerNameMap,
          );

          const updates = this.crossVerification.applyToCache(allPrices, discrepancies);
          if (updates.length > 0) {
            const upsertResult = this.priceCache.upsertPrices(updates);
            totalUpdated += upsertResult.updated;
            totalUnchanged += upsertResult.unchanged;
          }

          verificationSummary = this.formatVerificationSummary(summary);
          console.log(`[CrawlEngine] Cross-verification: ${verificationSummary}`);
        }

        const upsertResult = this.priceCache.upsertPrices(nexonResult.entries);
        totalUpdated += upsertResult.updated;
        totalUnchanged += upsertResult.unchanged;
      }

      this.filterLowConfidence();
      this.priceCache.saveToFile();

      const completedAt = new Date().toISOString();
      const durationMs =
        new Date(completedAt).getTime() - new Date(startedAt).getTime();
      const success = resolvedResults.some((r) => r.successCount > 0);

      const crawlResult: CrawlResult = {
        crawlId,
        startedAt,
        completedAt,
        durationMs,
        fetcherResults: resolvedResults,
        totalUpdated,
        totalUnchanged,
        success,
        summary: this.buildSummary(
          success,
          totalUpdated,
          totalUnchanged,
          resolvedResults,
          verificationSummary,
        ),
      };

      this.priceCache.recordCrawlRun(crawlResult);

      // Apply price overlay to PlayerStore
      await this.applyPriceOverlay();

      console.log(`[CrawlEngine] Manual crawl ${crawlId} completed`);

      return crawlResult;
    } catch (err) {
      const errorResult = this.createErrorResult(
        err instanceof Error ? err.message : String(err),
        crawlId,
        startedAt,
      );
      this.priceCache.recordCrawlRun(errorResult);
      return errorResult;
    } finally {
      this.isRunning = false;
    }
  }

  // -------------------------------------------------------------------------
  // Private Helpers
  // -------------------------------------------------------------------------

  /**
   * Build a NexonTradeDatum map from fetcher result entries.
   * Extracts trade metadata from the _meta field of Nexon PriceEntry objects.
   */
  private buildNexonTradeMap(entries: PriceEntry[]): Map<number, NexonTradeDatum> {
    const map = new Map<number, NexonTradeDatum>();

    for (const entry of entries) {
      const meta = (entry as unknown as Record<string, unknown>)._meta as
        | Record<string, unknown>
        | undefined;

      if (meta) {
        map.set(entry.spid, {
          spid: entry.spid,
          avgPrice: entry.price,
          minPrice: Number(meta.minPrice ?? entry.price),
          maxPrice: Number(meta.maxPrice ?? entry.price),
          tradeCount: Number(meta.tradeCount ?? 0),
          date: String(meta.date ?? ''),
        });
      } else {
        // Fallback: use price entry data without trade metadata
        map.set(entry.spid, {
          spid: entry.spid,
          avgPrice: entry.price,
          minPrice: entry.price,
          maxPrice: entry.price,
          tradeCount: 0,
          date: '',
        });
      }
    }

    return map;
  }

  /**
   * Build a spid → player name map from cached prices.
   * Used for human-readable verification reports.
   */
  private buildPlayerNameMap(
    allPrices: Map<number, PriceEntry>,
  ): Map<number, string> {
    const nameMap = new Map<number, string>();

    for (const [spid, entry] of allPrices) {
      const meta = (entry as unknown as Record<string, unknown>)._meta as
        | Record<string, unknown>
        | undefined;
      if (meta?.playerName) {
        nameMap.set(spid, String(meta.playerName));
      }
    }

    return nameMap;
  }

  /**
   * Format a verification summary into a human-readable string for logging.
   */
  private formatVerificationSummary(summary: { totalChecked: number; withNexonData: number; withoutNexonData: number; pricesAdjusted: number; flaggedForReview: number; avgRelativeDiff: number }): string {
    const parts: string[] = [];
    parts.push(`${summary.totalChecked} checked`);
    parts.push(`${summary.withNexonData} with Nexon data`);
    parts.push(`${summary.withoutNexonData} without`);
    parts.push(`${summary.pricesAdjusted} adjusted`);
    if (summary.flaggedForReview > 0) {
      parts.push(`${summary.flaggedForReview} flagged`);
    }
    parts.push(`avg diff ${(summary.avgRelativeDiff * 100).toFixed(1)}%`);
    return parts.join(', ');
  }

  /**
   * Remove entries with confidence below the minimum threshold.
   */
  private filterLowConfidence(): void {
    // This is a no-op by default — low confidence entries are kept
    // but ranked lower. The minConfidence config is used during
    // player resolution to prefer higher confidence matches.
  }

  /**
   * Apply the price cache overlay to the PlayerStore.
   * Updates in-memory player prices with the latest crawled data.
   */
  private async applyPriceOverlay(): Promise<void> {
    try {
      const allPrices = this.priceCache.getAllPrices();
      if (allPrices.size === 0) return;

      // Build price map keyed by ORIGINAL spid (not encoded spid).
      // Price cache stores encoded spid (spid*10 + n1strong), but PlayerStore
      // uses original spid. We decode and keep the best (lowest boost = most traded) price.
      const priceMap = new Map<number, { price: number; recordedAt: string }>();
      for (const [encodedSpid, entry] of allPrices) {
        if (entry.source !== 'seed') {
          const originalSpid = Math.floor(encodedSpid / 10);
          const existing = priceMap.get(originalSpid);
          // Prefer +1강 (most actively traded) — lowest boost level
          const boost = encodedSpid % 10;
          if (!existing || boost === 1 || (existing.price > entry.price && boost < 3)) {
            priceMap.set(originalSpid, {
              price: entry.price,
              recordedAt: entry.recordedAt,
            });
          }
        }
      }

      if (priceMap.size > 0) {
        const { playerStore } = await import('@/lib/player-store');
        playerStore.applyPriceOverlay(priceMap);
      }
    } catch (err) {
      console.warn(
        '[CrawlEngine] Could not apply price overlay:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Generate a unique crawl run ID.
   */
  private generateCrawlId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `crawl_${timestamp}_${random}`;
  }

  /**
   * Create an error crawl result.
   */
  private createErrorResult(
    error: string,
    crawlId?: string,
    startedAt?: string,
  ): CrawlResult {
    const now = new Date().toISOString();
    return {
      crawlId: crawlId ?? this.generateCrawlId(),
      startedAt: startedAt ?? now,
      completedAt: now,
      durationMs: 0,
      fetcherResults: [],
      totalUpdated: 0,
      totalUnchanged: 0,
      success: false,
      summary: `Crawl failed: ${error}`,
    };
  }

  /**
   * Build a human-readable summary of the crawl result.
   */
  private buildSummary(
    success: boolean,
    updated: number,
    unchanged: number,
    fetcherResults: FetcherResult[],
    verificationSummary?: string | null,
  ): string {
    const parts: string[] = [];

    if (success) {
      parts.push('Crawl completed successfully');
    } else {
      parts.push('Crawl completed with errors');
    }

    parts.push(`(${updated} updated, ${unchanged} unchanged)`);

    for (const result of fetcherResults) {
      if (result.error) {
        parts.push(`[${result.fetcher}] ERROR: ${result.error}`);
      } else if (result.warnings.length > 0) {
        parts.push(
          `[${result.fetcher}] ${result.successCount} prices, ${result.warnings.length} warnings`,
        );
      } else {
        parts.push(`[${result.fetcher}] ${result.successCount} prices`);
      }
    }

    if (verificationSummary) {
      parts.push(`[verification] ${verificationSummary}`);
    }

    return parts.join('. ');
  }
}

// ---------------------------------------------------------------------------
// Singleton instance
// ---------------------------------------------------------------------------

let engineInstance: CrawlEngine | null = null;

/**
 * Get the singleton CrawlEngine instance.
 * Safe to call from server-side code.
 */
export function getCrawlEngine(): CrawlEngine {
  if (!engineInstance) {
    engineInstance = new CrawlEngine();
  }
  return engineInstance;
}

/**
 * Reset the singleton (useful for testing).
 */
export function resetCrawlEngine(): void {
  engineInstance = null;
}
