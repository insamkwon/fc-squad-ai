/**
 * Inven FC Online community price fetcher.
 *
 * Scrapes the Inven FC Online board for player price information.
 * Inven (inven.co.kr) is a major Korean gaming community where users post
 * player market prices and trade data.
 *
 * Architecture reference: FO4-data-crawling (JadenHeo/FO4-data-crawling)
 * - Uses HTTP requests with appropriate headers to mimic browser behavior
 * - Parses HTML responses to extract price data from posts/pages
 * - Implements rate limiting to respect the community site
 *
 * Price data is parsed from:
 * 1. Dedicated price board posts (most common format)
 * 2. Player name + price pairs in post content
 * 3. Structured price tables in community posts
 */

import type { PriceEntry, FetcherResult, InvenFetcherConfig } from '../types';
import { DEFAULT_INVEN_CONFIG } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parsed player price from Inven HTML content */
interface RawInvenPrice {
  /** Player name (Korean) — may need fuzzy matching */
  playerName: string;
  /** Season or card type identifier */
  seasonInfo?: string;
  /** Price in BP (game currency) */
  price: number;
  /** Whether this price looks reliable */
  isReliable: boolean;
}

/** Parsed Inven page data */
interface ParsedInvenPage {
  /** Prices found on this page */
  prices: RawInvenPrice[];
  /** Whether there are more pages to fetch */
  hasNextPage: boolean;
  /** Page number */
  pageNum: number;
  /** Warnings encountered during parsing */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Inven Fetcher
// ---------------------------------------------------------------------------

export class InvenFetcher {
  private readonly config: InvenFetcherConfig;

  constructor(config?: Partial<InvenFetcherConfig>) {
    this.config = { ...DEFAULT_INVEN_CONFIG, ...config };
  }

  get name(): string {
    return 'inven';
  }

  /**
   * Fetch prices from Inven FC Online community pages.
   * Crawls multiple pages to collect a comprehensive price dataset.
   */
  async fetch(): Promise<FetcherResult> {
    const startTime = Date.now();
    const allPrices: RawInvenPrice[] = [];
    const allWarnings: string[] = [];
    let totalErrorCount = 0;

    try {
      for (let page = 1; page <= this.config.maxPages; page++) {
        try {
          const pageResult = await this.fetchPage(page);
          allPrices.push(...pageResult.prices);
          allWarnings.push(...pageResult.warnings);

          if (!pageResult.hasNextPage) break;

          // Rate limiting: delay between page requests
          if (page < this.config.maxPages) {
            await this.delay(this.config.requestDelayMs);
          }
        } catch (err) {
          totalErrorCount++;
          allWarnings.push(
            `Page ${page} fetch failed: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }

      // Convert raw prices to PriceEntry format
      const entries = this.convertToPriceEntries(allPrices);

      const durationMs = Date.now() - startTime;

      return {
        fetcher: this.name,
        entries,
        successCount: entries.length,
        errorCount: totalErrorCount,
        durationMs,
        warnings: allWarnings,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      return {
        fetcher: this.name,
        entries: [],
        successCount: 0,
        errorCount: allPrices.length > 0 ? totalErrorCount : 1,
        durationMs,
        error: err instanceof Error ? err.message : String(err),
        warnings: allWarnings,
      };
    }
  }

  /**
   * Fetch a single page from Inven FC Online price board.
   */
  private async fetchPage(pageNum: number): Promise<ParsedInvenPage> {
    const url = `${this.config.baseUrl}?p=${pageNum}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: this.getRequestHeaders(),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      return this.parsePage(html, pageNum);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Parse HTML content from an Inven page to extract price data.
   *
   * Inven FC Online price posts typically contain:
   * - Player names in Korean followed by price values
   * - Structured tables with season, name, and price columns
   * - Free-form text with "playerName 가격: X" patterns
   */
  parsePage(html: string, pageNum: number): ParsedInvenPage {
    const prices: RawInvenPrice[] = [];
    const warnings: string[] = [];

    // Strategy 1: Extract from structured data / table patterns
    const tablePrices = this.parseTablePatterns(html);
    prices.push(...tablePrices);

    // Strategy 2: Extract from price post content patterns
    const postPrices = this.parsePostPatterns(html);
    prices.push(...postPrices);

    // Strategy 3: Extract from JSON-LD or structured script data
    const jsonData = this.parseStructuredData(html);
    prices.push(...jsonData);

    // Deduplicate by player name (keep lowest reliable price)
    const deduped = this.deduplicatePrices(prices);

    // Detect pagination
    const hasNextPage = this.detectNextPage(html);

    if (prices.length === 0) {
      warnings.push(`Page ${pageNum}: No prices found — page structure may have changed`);
    }

    return {
      prices: deduped,
      hasNextPage,
      pageNum,
      warnings,
    };
  }

  /**
   * Strategy 1: Parse structured table patterns from HTML.
   * Inven price posts often have tables with player name and price columns.
   */
  private parseTablePatterns(html: string): RawInvenPrice[] {
    const prices: RawInvenPrice[] = [];

    // Match table rows containing price data
    // Pattern: <td>playerName</td>...<td>price</td>
    const tableRowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = tableRowRegex.exec(html)) !== null) {
      const row = rowMatch[1];

      // Extract cells
      const cells: string[] = [];
      const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
      let cellMatch: RegExpExecArray | null;

      while ((cellMatch = cellRegex.exec(row)) !== null) {
        cells.push(this.stripHtml(cellMatch[1]).trim());
      }

      // Try to find a player name + price pair in the cells
      const priceData = this.extractPriceFromCells(cells);
      if (priceData) {
        prices.push(priceData);
      }
    }

    return prices;
  }

  /**
   * Strategy 2: Parse price information from post content patterns.
   * Matches common Korean text patterns like:
   * "선수명 가격: X", "선수명 X BP", etc.
   */
  private parsePostPatterns(html: string): RawInvenPrice[] {
    const prices: RawInvenPrice[] = [];

    // Remove HTML tags for text-based parsing
    const text = this.stripHtml(html);

    // Pattern: Korean name followed by price in BP
    // e.g., "손흥민 1,500,000 BP" or "메시 가격: 2,000,000"
    const pricePatterns = [
      // "이름 가격[: ] 숫자" format
      /([가-힣]{2,10}(?:\s[가-힣]{2,10})?)\s*(?:가격|시세|판매가|구매가)[:\s]*(\d[\d,]*)\s*(?:BP|bp)?/gi,
      // "이름 숫자 BP" format
      /([가-힣]{2,10}(?:\s[가-힣]{2,10})?)\s+(\d[\d,]*)\s*(?:BP|bp)/gi,
      // "이름 - 숫자" format (common in price lists)
      /(?:^|\n)\s*([가-힣]{2,10}(?:\s[가-힣]{2,10})?)\s*[-–—]\s*(\d[\d,]*)/gm,
    ];

    for (const pattern of pricePatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(text)) !== null) {
        const name = match[1].trim();
        const priceStr = match[2].replace(/,/g, '');
        const price = parseInt(priceStr, 10);

        if (name.length >= 2 && name.length <= 20 && price > 0 && price < 10_000_000_000) {
          prices.push({
            playerName: name,
            price,
            isReliable: true,
          });
        }
      }
    }

    return prices;
  }

  /**
   * Strategy 3: Parse structured JSON data embedded in the page.
   * Some Inven pages include JSON-LD or script-tag embedded data.
   */
  private parseStructuredData(html: string): RawInvenPrice[] {
    const prices: RawInvenPrice[] = [];

    // Look for JSON data in script tags
    const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = scriptRegex.exec(html)) !== null) {
      try {
        const data = JSON.parse(match[1]);
        const extracted = this.extractPricesFromJson(data);
        prices.push(...extracted);
      } catch {
        // Not valid JSON, skip
      }
    }

    return prices;
  }

  /**
   * Extract prices from parsed JSON data (JSON-LD or other structured data).
   */
  private extractPricesFromJson(data: unknown): RawInvenPrice[] {
    const prices: RawInvenPrice[] = [];

    if (!data || typeof data !== 'object') return prices;

    const obj = data as Record<string, unknown>;

    // Check if this looks like a price listing
    if (Array.isArray(obj.itemListElement)) {
      for (const item of obj.itemListElement) {
        if (typeof item === 'object' && item !== null) {
          const itemObj = item as Record<string, unknown>;
          const name = String(itemObj.name ?? '');
          const offers = itemObj.offers as Record<string, unknown> | undefined;
          const priceStr = String(offers?.price ?? itemObj.price ?? '');

          if (name && priceStr) {
            const price = parseInt(priceStr.replace(/[^\d]/g, ''), 10);
            if (price > 0) {
              prices.push({ playerName: name, price, isReliable: true });
            }
          }
        }
      }
    }

    return prices;
  }

  /**
   * Extract player name and price from table cells.
   */
  private extractPriceFromCells(cells: string[]): RawInvenPrice | null {
    if (cells.length < 2) return null;

    for (const cell of cells) {
      // Check if any cell contains a player name pattern
      if (/^[가-힣]{2,10}(?:\s[가-힣]{2,10})?$/.test(cell)) {
        // Find a price in another cell
        for (const otherCell of cells) {
          const price = parseInt(otherCell.replace(/[^\d]/g, ''), 10);
          if (price > 100 && price < 10_000_000_000) {
            return {
              playerName: cell,
              price,
              isReliable: true,
            };
          }
        }
      }
    }

    return null;
  }

  /**
   * Deduplicate prices for the same player.
   * When multiple prices exist, prefer the most recent reliable one.
   * For multiple prices with the same reliability, take the median.
   */
  private deduplicatePrices(prices: RawInvenPrice[]): RawInvenPrice[] {
    const map = new Map<string, RawInvenPrice[]>();

    for (const p of prices) {
      const key = p.playerName;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(p);
    }

    const result: RawInvenPrice[] = [];

    for (const [name, entries] of map) {
      const reliableEntries = entries.filter((e) => e.isReliable);

      if (reliableEntries.length > 0) {
        // Use median price from reliable entries
        const sortedPrices = reliableEntries
          .map((e) => e.price)
          .sort((a, b) => a - b);
        const medianPrice = sortedPrices[Math.floor(sortedPrices.length / 2)];

        result.push({
          playerName: name,
          price: medianPrice,
          seasonInfo: reliableEntries[0].seasonInfo,
          isReliable: true,
        });
      } else if (entries.length > 0) {
        // Use the first unreliable entry as fallback
        result.push(entries[0]);
      }
    }

    return result;
  }

  /**
   * Detect if there's a next page in the pagination.
   */
  private detectNextPage(html: string): boolean {
    // Check for common pagination patterns
    return (
      /class=["'][^"']*next[^"']*["']/.test(html) ||
      /다음\s*페이지/.test(html) ||
      /href=["'][^"']*\?p=\d+/.test(html)
    );
  }

  /**
   * Convert raw Inven prices to PriceEntry format.
   * Note: Inven provides names but not spids directly.
   * Name-to-spid resolution is handled by the crawl engine.
   */
  convertToPriceEntries(rawPrices: RawInvenPrice[]): PriceEntry[] {
    return rawPrices.map((raw) => ({
      spid: 0, // Will be resolved by crawl engine using player name matching
      price: raw.price,
      source: 'inven' as const,
      recordedAt: new Date().toISOString(),
      confidence: raw.isReliable ? 0.7 : 0.4,
      _meta: {
        playerName: raw.playerName,
        seasonInfo: raw.seasonInfo,
      },
    })) as unknown as PriceEntry[];
  }

  /**
   * Get HTTP headers for Inven requests.
   * Mimics a browser user-agent to avoid being blocked.
   */
  private getRequestHeaders(): Record<string, string> {
    return {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate',
      Connection: 'keep-alive',
      Referer: 'https://www.inven.co.kr/board/fc_online/',
    };
  }

  /**
   * Strip HTML tags from a string.
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Utility: delay execution for the specified number of milliseconds.
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
