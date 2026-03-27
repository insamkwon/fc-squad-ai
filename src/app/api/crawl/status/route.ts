/**
 * GET /api/crawl/status
 *
 * Returns the current status of the crawl system:
 * - Whether a crawl is running
 * - Latest crawl result and history
 * - Price cache statistics
 * - Next scheduled crawl time
 * - Daily crawl count and limit
 *
 * This endpoint is public (no auth required) as it only reads status.
 */

import { NextResponse } from 'next/server';

// Dynamic import to avoid Next.js client stub issues with server-only modules
async function getStore() {
  const { getPriceCacheStore } = await import('@/lib/price-crawl/price-cache');
  return getPriceCacheStore();
}

export const runtime = 'nodejs';
export const maxDuration = 10;

/**
 * GET /api/crawl/status
 *
 * Query params:
 * - history: "true" to include recent crawl history (default: false)
 * - limit: number of history entries to return (default: 10, max: 50)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeHistory = searchParams.get('history') === 'true';
  const limitParam = searchParams.get('limit');
  const limit = Math.min(Math.max(parseInt(limitParam ?? '10', 10) || 10, 1), 50);

  const priceCache = await getStore();
  const systemStatus = priceCache.getSystemStatus(3);

  const response: Record<string, unknown> = {
    ...systemStatus,
  };

  if (includeHistory) {
    response.history = priceCache.getCrawlHistory(limit);
  }

  return NextResponse.json(response);
}
