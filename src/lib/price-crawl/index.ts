/**
 * Price crawl system — barrel exports.
 *
 * This module provides the complete price crawl system for FC Online:
 * - Types: All type definitions for the crawl system
 * - Fetchers: Inven and Nexon price data fetchers
 * - PriceCacheStore: Persistent price data storage
 * - CrawlEngine: Orchestration with rate limiting and scheduling
 *
 * Usage:
 * ```ts
 * import { getCrawlEngine, getPriceCacheStore } from '@/lib/price-crawl';
 *
 * // Get the crawl engine singleton
 * const engine = getCrawlEngine();
 *
 * // Set up player lookup for name resolution
 * engine.setPlayerLookup((name) => store.searchPlayers(name));
 *
 * // Run a crawl
 * const result = await engine.runCrawl();
 * ```
 */

// Types
export type {
  PriceEntry,
  PriceSource,
  PriceHistoryEntry,
  PriceCacheSnapshot,
  FetcherResult,
  CrawlResult,
  CrawlStatus,
  CrawlRunInfo,
  CrawlSystemStatus,
  InvenFetcherConfig,
  NexonFetcherConfig,
  CrawlEngineConfig,
  // Cross-verification types
  DiscrepancyLevel,
  ReconciliationStrategy,
  PriceDiscrepancy,
  VerificationSummary,
  CrossVerificationConfig,
} from './types';

export {
  DEFAULT_INVEN_CONFIG,
  DEFAULT_NEXON_CONFIG,
  DEFAULT_CRAWL_CONFIG,
  CRAWL_SCHEDULE_KST,
  CRAWL_CRON_UTC,
  DEFAULT_CROSS_VERIFICATION_CONFIG,
} from './types';

// Fetchers
export { InvenFetcher } from './fetchers/inven-fetcher';
export { NexonFetcher } from './fetchers/nexon-fetcher';

// Cross-Verification
export {
  CrossVerificationService,
  getCrossVerificationService,
  resetCrossVerificationService,
} from './cross-verification';
export type { NexonTradeDatum } from './cross-verification';

// Price Cache
export { PriceCacheStore, getPriceCacheStore, resetPriceCacheStore } from './price-cache';

// Crawl Engine
export {
  CrawlEngine,
  getCrawlEngine,
  resetCrawlEngine,
  type PlayerLookupFn,
} from './crawl-engine';
