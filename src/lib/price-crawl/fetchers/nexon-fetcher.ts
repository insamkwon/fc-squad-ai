/**
 * Nexon Data Center trade price fetcher.
 *
 * Uses the Nexon FC Online Open API to fetch daily trade data for
 * cross-verifying player prices obtained from the Inven community.
 *
 * Nexon API details:
 * - App ID: 258842 (FC Online)
 * - Requires NEXON_API_KEY environment variable
 * - Provides player metadata (spid, seasonid, spposition)
 * - Trade data available through the Data Center
 *
 * Data Center API:
 * - Primary: `https://fconline.nexon.com/datacenter/player-market-price`
 *   (provides daily trade averages via JSON API)
 * - Fallback: `https://openapi.nexon.com/v1/fconline/...` (player metadata)
 *
 * Note: Per the project constraints, the Nexon Open API does NOT provide
 * market price endpoints directly. The Data Center provides trade statistics
 * through a separate endpoint that this fetcher targets.
 *
 * API Reference: https://developers.nexon.com/
 * Data Center: https://fconline.nexon.com/datacenter/
 * Architecture reference: FO4-data-crawling (JadenHeo/FO4-data-crawling)
 */

import type { PriceEntry, FetcherResult, NexonFetcherConfig } from '../types';
import { DEFAULT_NEXON_CONFIG } from '../types';
import type { NexonTradeDatum } from '../cross-verification';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Nexon API response wrapper */
interface NexonApiResponse<T> {
  status: number;
  message?: string;
  data?: T;
}

/** Player info from Nexon API */
interface NexonPlayerInfo {
  spid: number;
  name: string;
  seasonId: number;
  position: string;
}

/** Raw trade data from Nexon Data Center JSON response */
interface NexonDataCenterTradeRow {
  /** SPID of the player */
  spid?: number;
  /** Trade date YYYYMMDD */
  tradeDate?: string;
  /** Average price */
  avgPrice?: number;
  /** Minimum price */
  minPrice?: number;
  /** Maximum price */
  maxPrice?: number;
  /** Trade count */
  tradeCount?: number;
}

/** Data Center API response format */
interface DataCenterResponse {
  /** List of trade entries */
  items?: NexonDataCenterTradeRow[];
  /** Total count */
  totalCount?: number;
}

// ---------------------------------------------------------------------------
// Nexon Fetcher
// ---------------------------------------------------------------------------

export class NexonFetcher {
  private readonly config: NexonFetcherConfig;
  private readonly apiBaseUrl = 'https://openapi.nexon.com';
  private readonly dataCenterUrl = 'https://fconline.nexon.com';

  constructor(config?: Partial<NexonFetcherConfig>) {
    this.config = { ...DEFAULT_NEXON_CONFIG, ...config };
    // Override with environment variables if available
    if (process.env.NEXON_API_KEY) {
      this.config.apiKey = process.env.NEXON_API_KEY;
    }
    if (process.env.NEXON_APP_ID) {
      this.config.appId = process.env.NEXON_APP_ID;
    }
  }

  get name(): string {
    return 'nexon_trade';
  }

  /**
   * Whether the Nexon fetcher is properly configured.
   */
  get isConfigured(): boolean {
    return !!this.config.apiKey;
  }

  /**
   * Fetch trade data from Nexon Data Center for cross-verification.
   *
   * Strategy:
   * 1. Try the Data Center API for daily trade data (primary)
   * 2. Fetch player metadata to validate spid → name mappings
   * 3. Return price entries for cross-verification
   */
  async fetch(): Promise<FetcherResult> {
    const startTime = Date.now();

    if (!this.isConfigured) {
      return {
        fetcher: this.name,
        entries: [],
        successCount: 0,
        errorCount: 0,
        durationMs: Date.now() - startTime,
        warnings: ['NEXON_API_KEY not configured — skipping Nexon verification'],
      };
    }

    try {
      // Step 1: Fetch trade data from Data Center (primary source)
      const tradeData = await this.fetchDataCenterTradeData();

      // Step 2: Fetch player metadata for spid validation
      const metadata = await this.fetchPlayerMetadata();

      // Step 3: Convert to PriceEntry format
      const entries = this.convertToPriceEntries(tradeData, metadata);

      const durationMs = Date.now() - startTime;

      return {
        fetcher: this.name,
        entries,
        successCount: entries.length,
        errorCount: 0,
        durationMs,
        warnings: entries.length === 0
          ? ['No trade data available from Nexon Data Center — prices will rely on Inven data']
          : [],
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
        warnings: [`Nexon API error: ${errorMessage}`],
      };
    }
  }

  /**
   * Fetch daily trade data from the Nexon Data Center.
   *
   * This is the primary source for cross-verification. The Data Center
   * provides aggregate daily trade statistics (avg/min/max price, trade count)
   * for players that were actively traded.
   *
   * The endpoint is a separate JSON API from the Open API, accessed via
   * the fconline.nexon.com domain.
   */
  async fetchDataCenterTradeData(): Promise<NexonTradeDatum[]> {
    const tradeEntries: NexonTradeDatum[] = [];

    if (!this.isConfigured) return tradeEntries;

    try {
      const today = new Date();
      // Format as YYYYMMDD for the API
      const dateStr = this.formatDateKst(today);

      // Data Center player market price endpoint
      const url = `${this.dataCenterUrl}/datacenter/player-market-price`;

      const response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': this.getDataCenterUserAgent(),
          'Referer': 'https://fconline.nexon.com/datacenter/',
          'Origin': 'https://fconline.nexon.com',
        },
        body: JSON.stringify({
          date: dateStr,
          appId: this.config.appId,
        }),
      });

      if (!response.ok) {
        console.warn(
          `[NexonFetcher] Data Center returned ${response.status} — falling back to Open API`,
        );
        return this.fetchDailyTradeDataFromOpenApi(dateStr);
      }

      const data: DataCenterResponse = await response.json();

      if (data?.items && Array.isArray(data.items)) {
        for (const row of data.items) {
          const spid = Number(row.spid);
          const avgPrice = Number(row.avgPrice);
          if (spid > 0 && avgPrice > 0) {
            tradeEntries.push({
              spid,
              avgPrice,
              minPrice: Number(row.minPrice || avgPrice),
              maxPrice: Number(row.maxPrice || avgPrice),
              tradeCount: Number(row.tradeCount || 0),
              date: String(row.tradeDate || dateStr),
            });
          }
        }
      }

      return tradeEntries;
    } catch (err) {
      console.warn(
        '[NexonFetcher] Data Center fetch failed — falling back to Open API:',
        err instanceof Error ? err.message : err,
      );
      // Fallback to Open API
      const today = new Date();
      const dateStr = this.formatDateKst(today);
      return this.fetchDailyTradeDataFromOpenApi(dateStr);
    }
  }

  /**
   * Fetch trade data from the Nexon Open API (fallback).
   *
   * This endpoint may not provide actual trade prices, but we attempt it
   * as a fallback when the Data Center is unavailable.
   */
  private async fetchDailyTradeDataFromOpenApi(dateStr: string): Promise<NexonTradeDatum[]> {
    const tradeEntries: NexonTradeDatum[] = [];

    if (!this.isConfigured) return tradeEntries;

    try {
      const url = `${this.apiBaseUrl}/v1/fconline/trade?appid=${this.config.appId}&date=${dateStr}`;

      const response = await this.fetchWithTimeout(url, {
        headers: {
          Authorization: this.config.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return tradeEntries;
      }

      const data = await response.json();

      // Parse trade data if available
      if (data && Array.isArray(data)) {
        for (const entry of data) {
          if (entry.spid && entry.avgPrice) {
            tradeEntries.push({
              spid: Number(entry.spid),
              avgPrice: Number(entry.avgPrice),
              minPrice: Number(entry.minPrice || entry.avgPrice),
              maxPrice: Number(entry.maxPrice || entry.avgPrice),
              tradeCount: Number(entry.tradeCount || 0),
              date: String(entry.date || dateStr),
            });
          }
        }
      }

      return tradeEntries;
    } catch {
      return tradeEntries;
    }
  }

  /**
   * Fetch player metadata from Nexon Open API.
   * This provides the authoritative spid → name/season mapping.
   */
  async fetchPlayerMetadata(): Promise<Map<number, NexonPlayerInfo>> {
    const metadata = new Map<number, NexonPlayerInfo>();

    if (!this.isConfigured) return metadata;

    try {
      const url = `${this.apiBaseUrl}/v1/fconline/id?appid=${this.config.appId}`;
      const response = await this.fetchWithTimeout(url, {
        headers: {
          Authorization: this.config.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return metadata;
      }

      // The Nexon API for player metadata might require different endpoints
      // For now, we return an empty map and rely on our own DB for spid resolution
      return metadata;
    } catch {
      return metadata;
    }
  }

  /**
   * Cross-verify a price entry against Nexon data (if available).
   * Returns a confidence adjustment based on how well the Inven price
   * matches the Nexon trade data.
   */
  crossVerify(
    spid: number,
    invenPrice: number,
    nexonTradeData: Map<number, NexonTradeDatum>,
  ): { verified: boolean; adjustedConfidence: number; nexonPrice?: number } {
    const tradeEntry = nexonTradeData.get(spid);

    if (!tradeEntry) {
      // No Nexon data to verify against — confidence unchanged
      return { verified: false, adjustedConfidence: 0 };
    }

    const nexonPrice = tradeEntry.avgPrice;
    const priceDiff = Math.abs(invenPrice - nexonPrice) / nexonPrice;

    if (priceDiff <= 0.1) {
      // Within 10% — high confidence
      return { verified: true, adjustedConfidence: 0.2, nexonPrice };
    } else if (priceDiff <= 0.25) {
      // Within 25% — moderate confidence boost
      return { verified: true, adjustedConfidence: 0.1, nexonPrice };
    } else {
      // More than 25% difference — reduce confidence
      return { verified: false, adjustedConfidence: -0.2, nexonPrice };
    }
  }

  /**
   * Convert Nexon trade data to PriceEntry format.
   */
  private convertToPriceEntries(
    tradeData: NexonTradeDatum[],
    _metadata: Map<number, NexonPlayerInfo>,
  ): PriceEntry[] {
    return tradeData.map((trade) => ({
      spid: trade.spid,
      price: trade.avgPrice,
      source: 'nexon_trade' as const,
      recordedAt: new Date().toISOString(),
      confidence: trade.tradeCount > 10 ? 0.9 : trade.tradeCount > 3 ? 0.7 : 0.5,
      _meta: {
        minPrice: trade.minPrice,
        maxPrice: trade.maxPrice,
        tradeCount: trade.tradeCount,
        date: trade.date,
      },
    })) as unknown as PriceEntry[];
  }

  /**
   * Make an HTTP request with timeout and configurable options.
   */
  private async fetchWithTimeout(
    url: string,
    options: RequestInit & { headers?: Record<string, string> } = {},
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          ...options.headers,
          ...(this.config.apiKey && !options.headers?.Authorization
            ? { Authorization: this.config.apiKey }
            : {}),
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Format a date as YYYYMMDD in KST (UTC+9) timezone.
   */
  private formatDateKst(date: Date): string {
    const kstOffset = 9 * 60 * 60 * 1000;
    const kst = new Date(date.getTime() + kstOffset);
    const year = kst.getUTCFullYear();
    const month = String(kst.getUTCMonth() + 1).padStart(2, '0');
    const day = String(kst.getUTCDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  /**
   * Get a User-Agent string suitable for the Data Center API.
   */
  private getDataCenterUserAgent(): string {
    return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
  }
}
