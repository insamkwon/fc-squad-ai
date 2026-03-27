/**
 * GET /api/crawl/prices
 *
 * Query the price cache for player prices.
 * Returns crawled price data that overlays the seed data.
 *
 * Query params:
 * - spid: comma-separated list of spids to query
 * - source: filter by source (inven, nexon_trade, seed)
 * - page: page number (default: 1)
 * - limit: items per page (default: 100, max: 1000)
 * - minPrice: minimum price filter
 * - maxPrice: maximum price filter
 * - updatedAt: only return prices updated after this ISO timestamp
 */

import { NextResponse } from 'next/server';
import type { PriceEntry, PriceSource } from '@/lib/price-crawl/types';

// Dynamic import to avoid Next.js client stub issues with server-only modules
async function getStore() {
  const { getPriceCacheStore } = await import('@/lib/price-crawl/price-cache');
  return getPriceCacheStore();
}

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const priceCache = await getStore();

  // Parse query parameters
  const spidParam = searchParams.get('spid');
  const sourceParam = searchParams.get('source');
  const page = Math.max(parseInt(searchParams.get('page') ?? '1', 10) || 1, 1);
  const limit = Math.min(
    Math.max(parseInt(searchParams.get('limit') ?? '100', 10) || 100, 1),
    1000,
  );
  const minPrice = parseInt(searchParams.get('minPrice') ?? '0', 10) || 0;
  const maxPrice = parseInt(searchParams.get('maxPrice') ?? '0', 10) || 0;
  const updatedAtParam = searchParams.get('updatedAt');

  let entries: PriceEntry[];

  if (spidParam) {
    // Query specific spids
    const spids = spidParam
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((s): s is number => !isNaN(s) && s > 0);
    entries = Array.from(priceCache.getPrices(spids).values());
  } else {
    // Query all prices
    entries = Array.from(priceCache.getAllPrices().values());
  }

  // Filter by source
  const validSources = ['inven', 'nexon_trade', 'seed'] as const;
  if (sourceParam && validSources.includes(sourceParam as PriceSource)) {
    entries = entries.filter((e) => e.source === sourceParam);
  }

  // Filter by price range
  if (minPrice > 0) {
    entries = entries.filter((e) => e.price >= minPrice);
  }
  if (maxPrice > 0) {
    entries = entries.filter((e) => e.price <= maxPrice);
  }

  // Filter by updated time
  if (updatedAtParam) {
    const since = new Date(updatedAtParam).getTime();
    if (!isNaN(since)) {
      entries = entries.filter(
        (e) => new Date(e.recordedAt).getTime() >= since,
      );
    }
  }

  // Sort by price descending
  entries.sort((a, b) => b.price - a.price);

  // Pagination
  const total = entries.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const paginatedResults = entries.slice(offset, offset + limit);

  return NextResponse.json({
    prices: paginatedResults.map((e) => ({
      spid: e.spid,
      price: e.price,
      source: e.source,
      recordedAt: e.recordedAt,
      confidence: e.confidence,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
    filters: {
      source: sourceParam ?? 'all',
      minPrice: minPrice > 0 ? minPrice : undefined,
      maxPrice: maxPrice > 0 ? maxPrice : undefined,
      updatedSince: updatedAtParam ?? undefined,
    },
  });
}
