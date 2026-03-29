/**
 * GET /api/crawl/verification
 *
 * Returns cross-verification results comparing crawled prices (Inven)
 * against Nexon Data Center daily trade data.
 *
 * Query params:
 * - spid: comma-separated list of spids to verify (optional, verifies all if omitted)
 * - level: filter by discrepancy level (none, minor, moderate, severe)
 * - strategy: filter by reconciliation strategy
 * - flagged: "true" to return only flagged discrepancies
 * - limit: max results (default: 100, max: 1000)
 * - offset: pagination offset (default: 0)
 *
 * The endpoint performs a live cross-verification using the current
 * price cache data and the latest Nexon trade data. This is useful for:
 * - Debugging price discrepancies
 * - Monitoring verification health
 * - Identifying players that need manual price review
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 15;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VerificationQueryParams {
  spid?: string;
  level?: string;
  strategy?: string;
  flagged?: string;
  limit?: string;
  offset?: string;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

/**
 * GET /api/crawl/verification
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    // Dynamic import to avoid Next.js client stub issues
    const { getPriceCacheStore } = await import('@/lib/price-crawl/price-cache');
    const { getCrossVerificationService, resetCrossVerificationService } = await import(
      '@/lib/price-crawl/cross-verification'
    );
    const { NexonFetcher } = await import('@/lib/price-crawl/fetchers/nexon-fetcher');

    const priceCache = getPriceCacheStore();
    const allPrices = priceCache.getAllPrices();

    // If price cache is empty, return early
    if (allPrices.size === 0) {
      return NextResponse.json({
        discrepancies: [],
        summary: null,
        message: 'No crawled price data available for verification.',
        pagination: { limit: 0, offset: 0, total: 0 },
      });
    }

    // Fetch Nexon trade data for verification
    const nexonFetcher = new NexonFetcher();
    let nexonTradeData: Map<number, { spid: number; avgPrice: number; minPrice: number; maxPrice: number; tradeCount: number; date: string }> =
      new Map();

    try {
      const result = await nexonFetcher.fetch();
      for (const entry of result.entries) {
        const meta = (entry as unknown as Record<string, unknown>)._meta as
          | Record<string, unknown>
          | undefined;
        nexonTradeData.set(entry.spid, {
          spid: entry.spid,
          avgPrice: Number(meta?.avgPrice ?? entry.price),
          minPrice: Number(meta?.minPrice ?? entry.price),
          maxPrice: Number(meta?.maxPrice ?? entry.price),
          tradeCount: Number(meta?.tradeCount ?? 0),
          date: String(meta?.date ?? ''),
        });
      }
    } catch {
      // Nexon data unavailable — verification will show all as 'no_data'
      console.warn('[VerificationAPI] Could not fetch Nexon trade data for verification.');
    }

    // Filter spids if requested
    let pricesToVerify = allPrices;
    const spidParam = searchParams.get('spid');
    if (spidParam) {
      const requestedSpids = spidParam
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((s): s is number => !isNaN(s) && s > 0);
      pricesToVerify = new Map(
        Array.from(allPrices).filter(([spid]) => requestedSpids.includes(spid)),
      );
    }

    // Run cross-verification
    const crossVerification = getCrossVerificationService();
    const { discrepancies, summary } = crossVerification.verify(
      pricesToVerify,
      nexonTradeData,
    );

    // Apply filters
    let filtered = discrepancies;

    const levelParam = searchParams.get('level');
    if (levelParam) {
      filtered = filtered.filter((d) => d.level === levelParam);
    }

    const strategyParam = searchParams.get('strategy');
    if (strategyParam) {
      filtered = filtered.filter((d) => d.strategy === strategyParam);
    }

    const flaggedParam = searchParams.get('flagged');
    if (flaggedParam === 'true') {
      filtered = filtered.filter((d) => d.strategy === 'flagged');
    }

    // Sort: severe first, then moderate, then minor, then none
    const levelOrder: Record<string, number> = { severe: 0, moderate: 1, minor: 2, none: 3 };
    filtered.sort((a, b) => {
      const levelDiff = (levelOrder[a.level] ?? 4) - (levelOrder[b.level] ?? 4);
      if (levelDiff !== 0) return levelDiff;
      return b.relativeDiff - a.relativeDiff;
    });

    // Pagination
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '100', 10) || 100, 1), 1000);
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);
    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      discrepancies: paginated,
      summary,
      filters: {
        spid: spidParam ?? undefined,
        level: levelParam ?? undefined,
        strategy: strategyParam ?? undefined,
        flagged: flaggedParam === 'true' ? true : undefined,
      },
      pagination: { limit, offset, total },
      nexonDataAvailable: nexonTradeData.size > 0,
    });
  } catch (err) {
    console.error('[VerificationAPI] Error:', err);
    return NextResponse.json(
      {
        error: 'Verification failed',
        message: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
