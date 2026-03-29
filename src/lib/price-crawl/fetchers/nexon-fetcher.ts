/**
 * Nexon Data Center price fetcher (v4).
 *
 * Uses the Nexon FC Online Data Center to fetch player market prices.
 * No API key required.
 *
 * Data sources:
 * 1. Bulk: `POST https://fconline.nexon.com/datacenter/PlayerList`
 *    Returns HTML with player cards containing `span_bp1`..`span_bp7` elements
 *    for each boost level. Each span has `alt="PRICE_VALUE"` with the BP price.
 *    Querying with `strSeason` filter returns different player sets per season.
 *    Returns max 200 players per request, no pagination.
 *
 * 2. Individual: `POST https://fconline.nexon.com/datacenter/PlayerPriceGraph`
 *    Returns HTML with current price + 365-day time series for one player.
 *    Used for dailytrade SPIDs to get accurate individual prices with history.
 *
 * 3. SPID discovery: `GET https://fconline.nexon.com/datacenter/dailytrade`
 *    Lists ~40 actively traded players with their SPIDs.
 *
 * Strategy:
 * - PlayerList with season filters provides broad coverage (120+ seasons)
 * - PlayerPriceGraph provides accurate individual prices for actively traded players
 * - Both sources are merged, with PlayerPriceGraph taking precedence
 */

import type { PriceEntry, FetcherResult } from '../types';
import type { NexonTradeDatum } from '../cross-verification';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DATA_CENTER_URL = 'https://fconline.nexon.com';
const PLAYER_PRICE_GRAPH_PATH = '/datacenter/PlayerPriceGraph';
const PLAYER_LIST_PATH = '/datacenter/PlayerList';
const DAILY_TRADE_PATH = '/datacenter/dailytrade';
const DAILY_SQUAD_PATH = '/datacenter/dailysquad';

const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const DEFAULT_REQUEST_TIMEOUT_MS = 25_000;
const DEFAULT_REQUEST_DELAY_MS = 200;
const DEFAULT_MAX_SPIDS = 50;
const DEFAULT_CONCURRENCY = 10;

/**
 * Concurrency for PlayerList season requests.
 * Parallel requests dramatically reduce total time.
 */
const PLAYERLIST_CONCURRENCY = 5;

/**
 * Max time budget for PlayerList Phase 1 (milliseconds).
 * Vercel serverless limit is 60s; we leave ~15s for Phase 2 + overhead.
 */
const PLAYERLIST_TIME_BUDGET_MS = 35_000;

/**
 * Max time budget for PlayerPriceGraph Phase 2 (milliseconds).
 * After Phase 1, we have ~15-18s left within the 60s Vercel limit.
 */
const PRICEGRAPH_TIME_BUDGET_MS = 15_000;

/**
 * Season IDs for PlayerList bulk queries.
 * Each season returns up to 200 players with BP prices for all boost levels.
 * Discovered from the Data Center UI season checkboxes.
 */
const SEASON_IDS = [
  100, 101, 110, 113, 114, 111, 200, 201, 202, 206, 207, 210, 211,
  213, 214, 216, 217, 218, 219, 220, 221, 222, 230, 231, 233, 234, 236,
  237, 238, 239, 240, 241, 242, 246, 247, 249, 250, 251, 252, 253, 254, 256,
  257, 258, 259, 260, 261, 262, 264, 265, 267, 268, 270, 272, 273, 274, 276,
  277, 278, 279, 280, 281, 283, 284, 287, 289, 290, 291, 293, 294, 295, 297,
  298, 500, 501, 502, 503, 504, 506, 507, 508, 510, 511, 513, 514, 515, 516, 517,
  801, 802, 804, 805, 806, 807, 808, 810, 811, 812, 813, 814, 815, 818, 820, 821,
  822, 825, 826, 827, 828, 829, 830, 831, 832, 834, 835, 836, 839, 840, 841,
  844, 845, 846, 848, 849, 850, 851, 852, 853, 854, 855, 856, 858,
  // TOTY / Legend / HERO seasons (high-value, limited cards)
  317, 318, 319, 320, 321, 322, 323, 324,
];

/**
 * Number of player DB SPIDs to probe per crawl cycle.
 * Combined with dailytrade SPIDs, this stays within the time budget.
 * A rotating hash of the crawl date ensures different SPIDs are tested each run.
 */
const DB_SPID_BATCH_SIZE = 20;

/**
 * OVR range for DB SPID probing — mid-tier cards are most likely to have
 * individual price data on Nexon Data Center. Very high OVR cards (ICONs, TOTY)
 * tend to only have cumulative trade sums.
 */
const DB_SPID_MIN_OVR = 70;
const DB_SPID_MAX_OVR = 99;

/**
 * Minimum fraction of direction changes in time series to classify as individual price.
 * Individual prices fluctuate (go up and down), cumulative trade sums only grow.
 * Empirically: individual card prices have >15% direction changes over 365 days.
 */
const MIN_DIRECTION_CHANGE_RATIO = 0.15;
/** Max reasonable price in BP — FC Online has high-end cards worth trillions */
const MAX_REASONABLE_PRICE = 1_000_000_000_000_000_000; // 1경 BP — FC Online high-end cards can cost hundreds of trillions
/** Min meaningful price in BP — filters out LIVE minimum-price noise (1,000 BP) */
const MIN_MEANINGFUL_PRICE = 10_000; // 1만 BP

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed price time series from PlayerPriceGraph */
interface PriceTimeSeries {
  spid: number;
  n1strong: number;
  /** Date strings like ["3.28", "3.29", ...] */
  time: string[];
  /** Price values in BP like ["218400", "200500", ...] */
  value: number[];
  /** Current price extracted from HTML header (현재가) — more reliable than last value */
  currentPrice: number;
  /** Min price in the series */
  minPrice: number;
  /** Max price in the series */
  maxPrice: number;
  /** Average price across the series */
  avgPrice: number;
  /** Whether this data represents an individual card price (true) or cumulative trade sum (false) */
  isIndividualPrice: boolean;
  /** Fraction of direction changes in time series (higher = more price fluctuation) */
  directionChangeRatio: number;
}

/** Parsed player BP data from PlayerList HTML */
interface PlayerListPrice {
  spid: number;
  /** BP price for each boost level (index 0 = no boost, 1 = +1강, ...) */
  boostPrices: Map<number, number>;
}

// ---------------------------------------------------------------------------
// Nexon Fetcher
// ---------------------------------------------------------------------------

export class NexonFetcher {
  private readonly timeoutMs: number;
  private readonly requestDelayMs: number;
  private readonly maxSpids: number;
  private readonly concurrency: number;
  private dbSpidProvider: (() => Array<{ spid: number; ovr: number }>) | null = null;

  constructor(config?: {
    timeoutMs?: number;
    requestDelayMs?: number;
    maxSpids?: number;
    concurrency?: number;
  }) {
    this.timeoutMs = config?.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.requestDelayMs = config?.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS;
    this.maxSpids = config?.maxSpids ?? DEFAULT_MAX_SPIDS;
    this.concurrency = config?.concurrency ?? DEFAULT_CONCURRENCY;
  }

  /**
   * Set a provider function that returns SPIDs from the player database
   * along with their OVR values for filtering.
   * Used to expand price coverage beyond the dailytrade page.
   */
  setDbSpidProvider(provider: () => Array<{ spid: number; ovr: number }>): void {
    this.dbSpidProvider = provider;
  }

  get name(): string {
    return 'nexon_trade';
  }

  /**
   * Whether the fetcher can work (always true — no API key needed).
   */
  get isConfigured(): boolean {
    return true;
  }

  /**
   * Fetch trade data from Nexon Data Center.
   *
   * Strategy:
   * 1. PlayerList with season filters — bulk BP prices for all boost levels
   * 2. PlayerPriceGraph for dailytrade SPIDs — accurate individual prices with history
   * 3. Merge: PlayerPriceGraph takes precedence (more accurate), PlayerList fills gaps
   */
  async fetch(): Promise<FetcherResult> {
    const startTime = Date.now();
    const entries: PriceEntry[] = [];
    const warnings: string[] = [];
    let errorCount = 0;

    try {
      // Phase 1: Bulk prices from PlayerList (broad coverage)
      console.log(`[NexonFetcher] Phase 1: Fetching PlayerList prices for ${SEASON_IDS.length} seasons`);
      const listEntries = await this.fetchPlayerListPrices();
      console.log(`[NexonFetcher] PlayerList returned ${listEntries.length} price entries`);
      entries.push(...listEntries);

      // Phase 2: Accurate prices from PlayerPriceGraph for dailytrade SPIDs
      const tradeSpids = await this.fetchDailyTradeSpids();
      if (tradeSpids.length > 0) {
        console.log(`[NexonFetcher] Phase 2: Fetching PlayerPriceGraph for ${tradeSpids.length} dailytrade SPIDs`);

        // Build set of already-covered (spid, boost) pairs from PlayerList
        const covered = new Set<string>();
        for (const e of entries) {
          covered.add(`${Math.floor(e.spid / 10)}_${e.spid % 10}`);
        }

        const BOOST_LEVELS = [1, 2, 3, 4, 5, 6, 7];
        const tradePairs: Array<{ spid: number; n1strong: number }> = [];
        for (const spid of tradeSpids) {
          for (const n1 of BOOST_LEVELS) {
            if (!covered.has(`${spid}_${n1}`)) {
              tradePairs.push({ spid, n1strong: n1 });
            }
          }
        }

        const phase2Start = Date.now();

        for (let i = 0; i < tradePairs.length; i += this.concurrency) {
          // Check time budget for Phase 2
          if (Date.now() - phase2Start > PRICEGRAPH_TIME_BUDGET_MS) {
            console.log(`[NexonFetcher] Phase 2: time budget reached after ${i}/${tradePairs.length} pairs`);
            break;
          }

          const batch = tradePairs.slice(i, i + this.concurrency);
          const results = await Promise.allSettled(
            batch.map(({ spid, n1strong }) => this.fetchPlayerPriceGraph(spid, n1strong)),
          );

          for (let j = 0; j < results.length; j++) {
            const { spid, n1strong } = batch[j];
            const result = results[j];

            if (result.status === 'fulfilled' && result.value) {
              const series = result.value;
              if (
                series.currentPrice > 0 &&
                series.currentPrice <= MAX_REASONABLE_PRICE &&
                series.currentPrice >= MIN_MEANINGFUL_PRICE &&
                series.isIndividualPrice
              ) {
                // Check if we already have this (spid, boost) from PlayerList
                const existingIdx = entries.findIndex(
                  (e) => Math.floor(e.spid / 10) === spid && e.spid % 10 === n1strong,
                );
                const entry = this.toPriceEntry(series);
                if (existingIdx >= 0) {
                  // Replace with more accurate PlayerPriceGraph data
                  entries[existingIdx] = entry;
                } else {
                  entries.push(entry);
                }
              } else {
                const reason = !series.isIndividualPrice ? 'cumulative trade sum' : 'price out of range';
                warnings.push(`SPID ${spid} +${n1strong}: ${series.currentPrice.toLocaleString()} BP — skipped (${reason})`);
              }
            } else {
              errorCount++;
            }
          }

          if (i + this.concurrency < tradePairs.length) {
            await this.delay(this.requestDelayMs);
          }
        }

        console.log(`[NexonFetcher] PlayerPriceGraph added entries, total: ${entries.length}`);
      }

      const durationMs = Date.now() - startTime;

      return {
        fetcher: this.name,
        entries,
        successCount: entries.length,
        errorCount,
        durationMs,
        warnings: entries.length === 0
          ? ['No price data from Nexon Data Center']
          : warnings,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMessage = err instanceof Error ? err.message : String(err);

      return {
        fetcher: this.name,
        entries: [],
        successCount: 0,
        errorCount: 1,
        durationMs,
        error: errorMessage,
        warnings: [`Nexon fetch error: ${errorMessage}`],
      };
    }
  }

  // -------------------------------------------------------------------------
  // PlayerList Bulk Fetching
  // -------------------------------------------------------------------------

  /**
   * Fetch bulk BP prices from PlayerList using parallel requests with season rotation.
   *
   * On each crawl, processes a rotating slice of seasons determined by the
   * current date. Seasons are fetched in parallel batches for speed.
   *
   * Rotation: dayOfYear % ceil(totalSeasons / seasonsPerRun) determines offset.
   * Each run processes ~20-30 seasons in ~30s with parallelism, leaving time for Phase 2.
   *
   * Returns PriceEntry[] with encoded spid (spid*10 + n1strong).
   */
  async fetchPlayerListPrices(): Promise<PriceEntry[]> {
    const entries: PriceEntry[] = [];
    const seenSpids = new Set<number>();
    const now = new Date().toISOString();
    const phaseStart = Date.now();

    // Determine how many seasons we can process per run.
    // With parallelism (5 concurrent), ~0.8s per season → ~40 seasons in 35s budget.
    // With 3 runs/day, full cycle = ceil(140 / 40) / 3 ≈ 1-2 days.
    const SEASONS_PER_RUN = 40;

    // Rotate starting season based on day of year for even coverage
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000,
    );
    const totalSlices = Math.ceil(SEASON_IDS.length / SEASONS_PER_RUN);
    const sliceIndex = dayOfYear % totalSlices;
    const startOffset = sliceIndex * SEASONS_PER_RUN;

    console.log(
      `[NexonFetcher] PlayerList: slice ${sliceIndex + 1}/${totalSlices}, ` +
      `concurrency=${PLAYERLIST_CONCURRENCY}`,
    );

    // Build the list of seasons to process for this run
    const seasonsToProcess: number[] = [];
    for (let s = 0; s < SEASON_IDS.length; s++) {
      seasonsToProcess.push(SEASON_IDS[(startOffset + s) % SEASON_IDS.length]);
    }

    // Process in parallel batches
    let processed = 0;
    for (let i = 0; i < seasonsToProcess.length; i += PLAYERLIST_CONCURRENCY) {
      // Check time budget before each batch
      if (Date.now() - phaseStart > PLAYERLIST_TIME_BUDGET_MS) {
        console.log(
          `[NexonFetcher] PlayerList: time budget reached after ${processed}/${seasonsToProcess.length} seasons`,
        );
        break;
      }

      const batch = seasonsToProcess.slice(i, i + PLAYERLIST_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (seasonId) => {
          const body = `strSeason=,${seasonId},&n1Strong=1`;
          const response = await this.fetchWithTimeout(
            `${DATA_CENTER_URL}${PLAYER_LIST_PATH}`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': DEFAULT_USER_AGENT,
                'Referer': `${DATA_CENTER_URL}/datacenter/`,
                'Origin': DATA_CENTER_URL,
              },
              body,
            },
          );

          if (!response.ok) return { seasonId, parsed: [] as PlayerListPrice[] };

          const html = await response.text();
          return { seasonId, parsed: this.parsePlayerListHtml(html) };
        }),
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        const seasonId = batch[j];

        if (result.status === 'rejected') {
          console.warn(`[NexonFetcher] season ${seasonId} failed:`, result.reason instanceof Error ? result.reason.message : result.reason);
          processed++;
          continue;
        }

        const { parsed } = result.value;
        for (const p of parsed) {
          if (seenSpids.has(p.spid)) continue;
          seenSpids.add(p.spid);

          for (let n1 = 1; n1 <= 7; n1++) {
            const price = p.boostPrices.get(n1);
            if (price === undefined || price <= 0) continue;
            if (price < MIN_MEANINGFUL_PRICE || price > MAX_REASONABLE_PRICE) continue;

            const encodedSpid = p.spid * 10 + n1;
            entries.push({
              spid: encodedSpid,
              price,
              source: 'nexon_trade' as const,
              recordedAt: now,
              confidence: 0.7,
              _meta: {
                minPrice: price,
                maxPrice: price,
                avgPrice: price,
                tradeCount: 0,
                date: '',
                n1strong: n1,
                originalSpid: p.spid,
                source: 'playerlist',
                seasonId,
              },
            } as unknown as PriceEntry);
          }
        }
        processed++;
      }

      // Small delay between batches
      if (i + PLAYERLIST_CONCURRENCY < seasonsToProcess.length) {
        await this.delay(this.requestDelayMs);
      }
    }

    const elapsed = ((Date.now() - phaseStart) / 1000).toFixed(1);
    console.log(`[NexonFetcher] PlayerList: done in ${elapsed}s, ${processed} seasons, ${entries.length} entries`);

    return entries;
  }

  /**
   * Parse PlayerList HTML to extract player SPIDs and BP prices.
   *
   * HTML structure per player:
   *   <div id="area_playerunit_{spid}"> ... </div>
   *   <span class="span_bp{level}" alt="PRICE" title="PRICE">
   *
   * We extract SPIDs from the area_playerunit div IDs and
   * BP prices from the span_bp{level} alt attributes.
   */
  private parsePlayerListHtml(html: string): PlayerListPrice[] {
    const results: PlayerListPrice[] = [];

    // Split by player unit divs and extract each player's data
    // Match: id="area_playerunit_{spid}" ... </div> blocks
    const playerBlockRegex = /id="area_playerunit_(\d+)"/g;
    let playerMatch: RegExpExecArray | null;

    const spidPositions: Array<{ spid: number; start: number }> = [];

    while ((playerMatch = playerBlockRegex.exec(html)) !== null) {
      spidPositions.push({
        spid: parseInt(playerMatch[1], 10),
        start: playerMatch.index,
      });
    }

    // Determine the end boundary for each player block (start of next block or end of string)
    for (let i = 0; i < spidPositions.length; i++) {
      const { spid, start } = spidPositions[i];
      const end = i + 1 < spidPositions.length
        ? spidPositions[i + 1].start
        : html.length;

      const block = html.substring(start, end);

      // Extract BP prices: span_bp{n} alt="PRICE"
      // bp0 = no price shown, bp1..bp7 = boost levels, bp8..bp13 = higher boosts
      const boostPrices = new Map<number, number>();
      const bpRegex = /class="span_bp(\d+)"[^>]*alt="([^"]+)"/g;
      let bpMatch: RegExpExecArray | null;

      while ((bpMatch = bpRegex.exec(block)) !== null) {
        const level = parseInt(bpMatch[1], 10);
        const priceStr = bpMatch[2].replace(/,/g, '');
        const price = parseInt(priceStr, 10);
        if (level >= 0 && price > 0) {
          boostPrices.set(level, price);
        }
      }

      if (boostPrices.size > 0) {
        results.push({ spid, boostPrices });
      }
    }

    return results;
  }

  // -------------------------------------------------------------------------
  // SPID Discovery
  // -------------------------------------------------------------------------

  /**
   * Fetch actively traded SPIDs from the Nexon Data Center dailytrade page.
   * Returns unique SPIDs found in links like `?spid=206200104`.
   */
  async fetchDailyTradeSpids(): Promise<number[]> {
    const response = await this.fetchWithTimeout(
      `${DATA_CENTER_URL}${DAILY_TRADE_PATH}`,
      {
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          'Accept': 'text/html',
          'Accept-Language': 'ko-KR,ko;q=0.9',
          'Referer': `${DATA_CENTER_URL}/datacenter/`,
        },
      },
    );

    if (!response.ok) {
      console.warn(`[NexonFetcher] dailytrade returned ${response.status}`);
      return [];
    }

    const html = await response.text();
    const spidSet = new Set<number>();
    const spidRegex = /spid=(\d+)/g;
    let match: RegExpExecArray | null;

    while ((match = spidRegex.exec(html)) !== null) {
      const spid = parseInt(match[1], 10);
      if (spid > 0) spidSet.add(spid);
    }

    // Limit to maxSpids to stay within time budget
    return Array.from(spidSet).slice(0, this.maxSpids);
  }

  /**
   * Fetch SPIDs from the Nexon Data Center dailysquad page.
   * Returns unique SPIDs found in links like `?spid=206200104`.
   * These are LIVE squad-related players — most have very high prices
   * (billions of BP) but a few may have usable individual prices.
   */
  async fetchDailySquadSpids(): Promise<number[]> {
    try {
      const response = await this.fetchWithTimeout(
        `${DATA_CENTER_URL}${DAILY_SQUAD_PATH}`,
        {
          headers: {
            'User-Agent': DEFAULT_USER_AGENT,
            'Accept': 'text/html',
            'Accept-Language': 'ko-KR,ko;q=0.9',
            'Referer': `${DATA_CENTER_URL}/datacenter/`,
          },
        },
      );

      if (!response.ok) {
        console.warn(`[NexonFetcher] dailysquad returned ${response.status}`);
        return [];
      }

      const html = await response.text();
      const spidSet = new Set<number>();
      const spidRegex = /spid=(\d+)/g;
      let match: RegExpExecArray | null;

      while ((match = spidRegex.exec(html)) !== null) {
        const spid = parseInt(match[1], 10);
        if (spid > 0) spidSet.add(spid);
      }

      return Array.from(spidSet);
    } catch (err) {
      console.warn('[NexonFetcher] dailysquad fetch failed:', err);
      return [];
    }
  }

  // -------------------------------------------------------------------------
  // Price Graph Fetching
  // -------------------------------------------------------------------------

  /**
   * Fetch price time series for a specific player from PlayerPriceGraph.
   *
   * POST to /datacenter/PlayerPriceGraph with spid and n1strong (boost level).
   * Returns HTML with embedded `json1 = { time: [...], value: [...] }`.
   */
  async fetchPlayerPriceGraph(
    spid: number,
    n1strong: number = 1,
  ): Promise<PriceTimeSeries | null> {
    const response = await this.fetchWithTimeout(
      `${DATA_CENTER_URL}${PLAYER_PRICE_GRAPH_PATH}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': DEFAULT_USER_AGENT,
          'Referer': `${DATA_CENTER_URL}/datacenter/`,
          'Origin': DATA_CENTER_URL,
        },
        body: `spid=${spid}&n1strong=${n1strong}`,
      },
    );

    if (!response.ok) {
      return null;
    }

    const html = await response.text();
    return this.parsePriceGraphHtml(html, spid, n1strong);
  }

  /**
   * Parse the PlayerPriceGraph HTML response to extract price time series.
   *
   * The response contains:
   * 1. Header with current price: `<span>현재가</span><strong alt="91500">`
   * 2. Embedded JS: `var json1 = { "time": [...], "value": [...] };`
   *
   * The `현재가` header value is the most reliable current price source.
   * We also analyze the time series to distinguish individual card prices
   * from cumulative trade sums.
   */
  parsePriceGraphHtml(
    html: string,
    spid: number,
    n1strong: number,
  ): PriceTimeSeries | null {
    // Extract current price from HTML header (현재가) — most reliable source
    const headerPriceMatch = html.match(/<span>현재가<\/span>\s*<strong alt="([^"]+)"/);
    const headerPrice = headerPriceMatch
      ? parseInt(headerPriceMatch[1].replace(/,/g, ''), 10)
      : 0;

    // Extract time array
    const timeMatch = html.match(/"time"\s*:\s*\[([\s\S]*?)\]/);
    // Extract value array
    const valueMatch = html.match(/"value"\s*:\s*\[([\s\S]*?)\]/);

    if (!timeMatch || !valueMatch) {
      return null;
    }

    // Parse time strings from the HTML
    const timeStrings: string[] = [];
    const timeItemRegex = /"([^"]+)"/g;
    let timeItem: RegExpExecArray | null;
    while ((timeItem = timeItemRegex.exec(timeMatch[1])) !== null) {
      timeStrings.push(timeItem[1]);
    }

    // Parse value numbers from the HTML
    const values: number[] = [];
    const valueItemRegex = /"(\d+)"/g;
    let valueItem: RegExpExecArray | null;
    while ((valueItem = valueItemRegex.exec(valueMatch[1])) !== null) {
      const v = parseInt(valueItem[1], 10);
      if (v > 0) values.push(v);
    }

    if (values.length === 0) {
      return null;
    }

    const minPrice = Math.min(...values);
    const maxPrice = Math.max(...values);
    const avgPrice = Math.round(values.reduce((a, b) => a + b, 0) / values.length);

    // Detect individual price vs cumulative trade sum using direction changes
    const { isIndividual, ratio } = this.detectIndividualPrice(values);

    // Use header price if available (more recent/accurate), fallback to last series value
    const currentPrice = headerPrice > 0 ? headerPrice : values[values.length - 1];

    return {
      spid,
      n1strong,
      time: timeStrings,
      value: values,
      currentPrice,
      minPrice,
      maxPrice,
      avgPrice,
      isIndividualPrice: isIndividual,
      directionChangeRatio: ratio,
    };
  }

  /**
   * Fetch prices for a batch of SPIDs (for use by CrawlEngine with known SPIDs).
   * Unlike fetch(), this takes an explicit list of SPIDs instead of scraping dailytrade.
   * Filters out cumulative trade data, keeping only individual card prices.
   */
  async fetchForSpids(spids: number[]): Promise<PriceEntry[]> {
    const entries: PriceEntry[] = [];

    for (let i = 0; i < spids.length; i += this.concurrency) {
      const batch = spids.slice(i, i + this.concurrency);
      const results = await Promise.allSettled(
        batch.map((spid) => this.fetchPlayerPriceGraph(spid, 1)),
      );

      for (const result of results) {
        if (
          result.status === 'fulfilled' &&
          result.value &&
          result.value.currentPrice > 0 &&
          result.value.currentPrice >= MIN_MEANINGFUL_PRICE &&
          result.value.isIndividualPrice
        ) {
          entries.push(this.toPriceEntry(result.value));
        }
      }

      if (i + this.concurrency < spids.length) {
        await this.delay(this.requestDelayMs);
      }
    }

    return entries;
  }

  // -------------------------------------------------------------------------
  // Conversion
  // -------------------------------------------------------------------------

  /**
   * Convert a PriceTimeSeries to a PriceEntry with metadata for cross-verification.
   */
  private toPriceEntry(series: PriceTimeSeries): PriceEntry {
    // Encode n1strong into spid to distinguish boost levels: spid*10 + n1strong
    // n1strong=1..7 → last digit 1..7; original spid = Math.floor(encoded / 10)
    const encodedSpid = series.spid * 10 + series.n1strong;
    return {
      spid: encodedSpid,
      price: series.currentPrice,
      source: 'nexon_trade' as const,
      recordedAt: new Date().toISOString(),
      confidence: 0.8, // Data Center is authoritative
      _meta: {
        minPrice: series.minPrice,
        maxPrice: series.maxPrice,
        avgPrice: series.avgPrice,
        tradeCount: series.value.length,
        date: series.time[series.time.length - 1] ?? '',
        n1strong: series.n1strong,
        originalSpid: series.spid,
        timeSeries: series.value,
        timeLabels: series.time,
      },
    } as unknown as PriceEntry;
  }

  // -------------------------------------------------------------------------
  // Data Quality Detection
  // -------------------------------------------------------------------------

  /**
   * Detect whether a price time series represents an individual card price
   * or a cumulative trade sum.
   *
   * Individual card prices fluctuate (go up and down) as market conditions change.
   * Cumulative trade sums only grow over time (monotonically increasing).
   *
   * We measure this by counting "direction changes" — points where the price
   * trend reverses (from increasing to decreasing or vice versa).
   *
   * Empirical threshold: >15% direction changes over 365 days = individual price.
   */
  private detectIndividualPrice(values: number[]): { isIndividual: boolean; ratio: number } {
    if (values.length < 10) {
      // Too few data points — can't reliably detect pattern
      return { isIndividual: true, ratio: 0.5 };
    }

    let directionChanges = 0;
    for (let i = 2; i < values.length; i++) {
      const prevDir = values[i - 1] - values[i - 2];
      const currDir = values[i] - values[i - 1];
      // Count only when direction actually reverses (skip zero-moves)
      if (prevDir !== 0 && currDir !== 0 && prevDir * currDir < 0) {
        directionChanges++;
      }
    }

    const ratio = directionChanges / (values.length - 2);
    return {
      isIndividual: ratio >= MIN_DIRECTION_CHANGE_RATIO,
      ratio,
    };
  }

  // -------------------------------------------------------------------------
  // Utilities
  // -------------------------------------------------------------------------

  private async fetchWithTimeout(
    url: string,
    options: RequestInit & { headers?: Record<string, string> } = {},
  ): Promise<Response> {
    return await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(this.timeoutMs),
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
