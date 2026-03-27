/**
 * Type definitions for the price crawl system.
 *
 * The crawl system fetches player prices from multiple sources (Inven community,
 * Nexon Data Center) and maintains a price cache that overlays the seed data.
 */

// ---------------------------------------------------------------------------
// Price Data
// ---------------------------------------------------------------------------

/**
 * A single price data point for a player.
 * Maps spid (season-specific player ID) to a price value with metadata.
 */
export interface PriceEntry {
  /** FC Online season-specific player ID */
  spid: number;
  /** Current market price in BP (game currency) */
  price: number;
  /** Source of this price data */
  source: PriceSource;
  /** ISO timestamp of when this price was fetched/recorded */
  recordedAt: string;
  /** Confidence score 0-1 (higher = more reliable) */
  confidence: number;
}

/**
 * Price source enum identifying where price data originated.
 */
export type PriceSource = 'inven' | 'nexon_trade' | 'seed';

/**
 * Price history entry for tracking price changes over time.
 */
export interface PriceHistoryEntry {
  spid: number;
  price: number;
  source: PriceSource;
  recordedAt: string;
}

/**
 * Price cache snapshot — a collection of price entries at a point in time.
 */
export interface PriceCacheSnapshot {
  /** Map of spid → PriceEntry */
  prices: Record<number, PriceEntry>;
  /** ISO timestamp of when this snapshot was created */
  updatedAt: string;
  /** Number of price entries in this snapshot */
  count: number;
  /** Source breakdown: { inven: N, nexon_trade: N, seed: N } */
  sources: Record<PriceSource, number>;
}

// ---------------------------------------------------------------------------
// Crawl Results
// ---------------------------------------------------------------------------

/**
 * Result of a single fetcher's crawl operation.
 */
export interface FetcherResult {
  /** Name of the fetcher */
  fetcher: string;
  /** Price entries retrieved */
  entries: PriceEntry[];
  /** Number of entries successfully parsed */
  successCount: number;
  /** Number of entries that failed to parse */
  errorCount: number;
  /** Duration of the fetch in milliseconds */
  durationMs: number;
  /** Error message if the fetch failed entirely */
  error?: string;
  /** Partial errors encountered during parsing */
  warnings: string[];
}

/**
 * Aggregated result of a full crawl cycle (all fetchers).
 */
export interface CrawlResult {
  /** Unique crawl run identifier */
  crawlId: string;
  /** ISO timestamp of when the crawl started */
  startedAt: string;
  /** ISO timestamp of when the crawl completed */
  completedAt: string;
  /** Total duration in milliseconds */
  durationMs: number;
  /** Individual fetcher results */
  fetcherResults: FetcherResult[];
  /** Total number of new/updated prices */
  totalUpdated: number;
  /** Total number of prices that haven't changed */
  totalUnchanged: number;
  /** Whether the crawl succeeded (at least one fetcher worked) */
  success: boolean;
  /** Summary message */
  summary: string;
}

// ---------------------------------------------------------------------------
// Crawl Status & Scheduling
// ---------------------------------------------------------------------------

/**
 * Status of the crawl system.
 */
export type CrawlStatus = 'idle' | 'running' | 'completed' | 'failed';

/**
 * Information about a crawl run (for status monitoring).
 */
export interface CrawlRunInfo {
  /** Unique crawl run identifier */
  crawlId: string;
  /** Status of this crawl run */
  status: CrawlStatus;
  /** ISO timestamp of when the crawl started */
  startedAt: string;
  /** ISO timestamp of when the crawl completed (null if running) */
  completedAt: string | null;
  /** Result (null if still running) */
  result: CrawlResult | null;
}

/**
 * Overall crawl system status for the status API endpoint.
 */
export interface CrawlSystemStatus {
  /** Current system status */
  status: CrawlStatus;
  /** Information about the latest crawl run */
  latestRun: CrawlRunInfo | null;
  /** Number of successful crawls today */
  crawlCountToday: number;
  /** Maximum crawls allowed per day */
  maxCrawlsPerDay: number;
  /** ISO timestamp of the next scheduled crawl */
  nextScheduledCrawl: string;
  /** Price cache statistics */
  priceCache: {
    totalPrices: number;
    lastUpdated: string;
    sources: Record<PriceSource, number>;
  };
  /** Cron schedule configuration */
  schedule: {
    /** Cron expression (UTC) */
    expression: string;
    /** Human-readable times (KST) */
    times: string[];
  };
}

// ---------------------------------------------------------------------------
// Fetcher Configuration
// ---------------------------------------------------------------------------

/**
 * Configuration for the Inven FC Online fetcher.
 */
export interface InvenFetcherConfig {
  /** Base URL for Inven FC Online price pages */
  baseUrl: string;
  /** Delay between requests in ms (rate limiting) */
  requestDelayMs: number;
  /** Maximum number of pages to fetch per crawl */
  maxPages: number;
  /** Request timeout in ms */
  timeoutMs: number;
}

/**
 * Configuration for the Nexon Data Center fetcher.
 */
export interface NexonFetcherConfig {
  /** Nexon Open API key */
  apiKey: string;
  /** Nexon app ID */
  appId: string;
  /** Request timeout in ms */
  timeoutMs: number;
}

/**
 * Configuration for the crawl engine.
 */
export interface CrawlEngineConfig {
  /** Maximum crawls allowed per day */
  maxCrawlsPerDay: number;
  /** Maximum concurrent fetchers */
  maxConcurrentFetchers: number;
  /** Whether to run Nexon cross-verification */
  enableNexonVerification: boolean;
  /** Minimum confidence threshold to accept a price */
  minConfidence: number;
  /** Maximum price age in hours before re-crawl is needed */
  maxPriceAgeHours: number;
}

/**
 * Default configuration values.
 */
export const DEFAULT_INVEN_CONFIG: InvenFetcherConfig = {
  baseUrl: 'https://www.inven.co.kr/board/fc_online/5975',
  requestDelayMs: 1500,
  maxPages: 5,
  timeoutMs: 15000,
};

export const DEFAULT_NEXON_CONFIG: NexonFetcherConfig = {
  apiKey: '',
  appId: '258842',
  timeoutMs: 10000,
};

export const DEFAULT_CRAWL_CONFIG: CrawlEngineConfig = {
  maxCrawlsPerDay: 3,
  maxConcurrentFetchers: 2,
  enableNexonVerification: true,
  minConfidence: 0.3,
  maxPriceAgeHours: 24,
};

/** Cron schedule times in KST (UTC+9) */
export const CRAWL_SCHEDULE_KST = ['06:00', '14:00', '22:00'] as const;

/** Cron expression for Vercel (UTC) — 06:00/14:00/22:00 KST = 21:00/05:00/13:00 UTC */
export const CRAWL_CRON_UTC = '0 21,5,13 * * *';

// ---------------------------------------------------------------------------
// Cross-Verification
// ---------------------------------------------------------------------------

/**
 * Discrepancy severity levels for price cross-verification.
 */
export type DiscrepancyLevel = 'none' | 'minor' | 'moderate' | 'severe';

/**
 * Reconciliation strategy applied to a price discrepancy.
 */
export type ReconciliationStrategy =
  | 'confidence_adjust'   // Adjust Inven confidence up/down based on agreement
  | 'weighted_average'    // Blend Inven and Nexon prices (e.g., 0.7 * Nexon + 0.3 * Inven)
  | 'nexon_override'      // Use Nexon price when it has high trade count
  | 'inven_kept'          // Keep Inven price (no Nexon data or low trade count)
  | 'flagged'             // Flagged for manual review (severe discrepancy)
  | 'no_data'             // No Nexon data available for this spid
  | 'skipped';            // Skipped (e.g., seed-only data, no crawl data)

/**
 * A single price cross-verification result comparing Inven crawled price
 * against Nexon Data Center daily trade data.
 */
export interface PriceDiscrepancy {
  /** Player SPID */
  spid: number;
  /** Player name (if available from cache) */
  playerName?: string;
  /** Price from Inven crawl */
  invenPrice: number;
  /** Price from Nexon Data Center daily trade (0 if unavailable) */
  nexonPrice: number;
  /** Absolute price difference */
  priceDiff: number;
  /** Relative price difference (0–1+) */
  relativeDiff: number;
  /** Discrepancy severity */
  level: DiscrepancyLevel;
  /** Strategy applied to reconcile this discrepancy */
  strategy: ReconciliationStrategy;
  /** Reconciled/final price after applying the strategy */
  reconciledPrice: number;
  /** Original Inven confidence before verification */
  originalConfidence: number;
  /** Adjusted confidence after verification */
  adjustedConfidence: number;
  /** Nexon trade count (0 if no data) */
  nexonTradeCount: number;
  /** ISO timestamp of when this verification was performed */
  verifiedAt: string;
  /** Human-readable explanation of the verification result */
  explanation: string;
}

/**
 * Summary statistics from a cross-verification run.
 */
export interface VerificationSummary {
  /** Total number of prices compared */
  totalChecked: number;
  /** Number with Nexon data available */
  withNexonData: number;
  /** Number without Nexon data */
  withoutNexonData: number;
  /** Breakdown by discrepancy level */
  byLevel: Record<DiscrepancyLevel, number>;
  /** Breakdown by reconciliation strategy */
  byStrategy: Record<ReconciliationStrategy, number>;
  /** Average price difference for verified entries (those with Nexon data) */
  avgRelativeDiff: number;
  /** Number of prices that were adjusted */
  pricesAdjusted: number;
  /** Number of prices flagged for manual review */
  flaggedForReview: number;
  /** ISO timestamp of the verification run */
  verifiedAt: string;
}

/**
 * Configuration for the cross-verification service.
 */
export interface CrossVerificationConfig {
  /** Threshold for 'none' discrepancy (relative diff <= this) */
  minorThreshold: number;    // default: 0.10 (10%)
  /** Threshold for 'minor' discrepancy (relative diff <= this, > minorThreshold) */
  moderateThreshold: number;  // default: 0.25 (25%)
  /** Threshold for 'moderate' discrepancy (relative diff <= this, > moderateThreshold); above is 'severe' */
  severeThreshold: number;   // default: 0.50 (50%)
  /** Weight given to Nexon price in weighted average reconciliation */
  nexonWeight: number;        // default: 0.7
  /** Weight given to Inven price in weighted average reconciliation */
  invenWeight: number;        // default: 0.3
  /** Minimum Nexon trade count to trust Nexon data */
  minNexonTradeCount: number; // default: 3
  /** Trade count above which Nexon price is highly trusted */
  highConfidenceTradeCount: number; // default: 10
  /** Confidence boost for verified prices within minor threshold */
  verifiedConfidenceBoost: number;   // default: 0.15
  /** Confidence boost for prices within moderate threshold */
  moderateConfidenceBoost: number;   // default: 0.05
  /** Confidence penalty for prices with moderate discrepancy */
  moderateConfidencePenalty: number; // default: 0.15
  /** Confidence penalty for prices with severe discrepancy */
  severeConfidencePenalty: number;   // default: 0.25
  /** Confidence boost for Nexon-only prices with high trade count */
  nexonHighConfidenceBoost: number;  // default: 0.2
}

/**
 * Default cross-verification configuration.
 */
export const DEFAULT_CROSS_VERIFICATION_CONFIG: CrossVerificationConfig = {
  minorThreshold: 0.10,
  moderateThreshold: 0.25,
  severeThreshold: 0.50,
  nexonWeight: 0.7,
  invenWeight: 0.3,
  minNexonTradeCount: 3,
  highConfidenceTradeCount: 10,
  verifiedConfidenceBoost: 0.15,
  moderateConfidenceBoost: 0.05,
  moderateConfidencePenalty: 0.15,
  severeConfidencePenalty: 0.25,
  nexonHighConfidenceBoost: 0.2,
};
