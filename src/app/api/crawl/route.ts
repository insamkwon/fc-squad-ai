/**
 * GET/POST /api/crawl
 *
 * Vercel Cron endpoint — triggered 3x daily (06:00, 14:00, 22:00 KST).
 *
 * Can also be triggered manually via POST with an auth token.
 *
 * Workflow:
 * 1. Verify authorization (Vercel cron header or auth token)
 * 2. Check daily rate limit (max 3 crawls/day)
 * 3. Run the crawl engine (Inven + Nexon fetchers)
 * 4. Save results to price cache
 * 5. Return crawl result with statistics
 *
 * Security:
 * - Production: Requires x-vercel-cron header (set by Vercel cron)
 * - Manual: Requires Authorization header with CRAWL_AUTH_TOKEN env var
 * - Development: Allows all requests
 */

import { NextResponse } from 'next/server';
import type { CrawlResult } from '@/lib/price-crawl/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/crawl — Triggered by Vercel cron or for status checks.
 *
 * Query params:
 * - status: If present, returns crawl system status without running a crawl
 */
export async function GET(request: Request) {
  // Verify authorization
  const authError = verifyAuth(request);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);

  // If ?status is present, return crawl status without running
  if (searchParams.has('status')) {
    const { getPriceCacheStore } = await import('@/lib/price-crawl/price-cache');
    const systemStatus = getPriceCacheStore().getSystemStatus(3);
    return NextResponse.json(systemStatus);
  }

  // Run the crawl
  return executeCrawl();
}

/**
 * POST /api/crawl — Manual crawl trigger.
 *
 * Requires Authorization header with CRAWL_AUTH_TOKEN in production.
 * Body can optionally include:
 * - force: boolean — bypass daily rate limit
 * - invenOnly: boolean — skip Nexon verification
 */
export async function POST(request: Request) {
  // Verify authorization
  const authError = verifyAuth(request);
  if (authError) return authError;

  let body: { force?: boolean; invenOnly?: boolean } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    // Empty body is OK
  }

  const { getCrawlEngine } = await import('@/lib/price-crawl/crawl-engine');
  const engine = getCrawlEngine();

  // Set up player lookup for name resolution
  setupPlayerLookup(engine);

  if (body.force) {
    const result = await engine.runManualCrawl();
    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  }

  if (body.invenOnly) {
    const result = await engine.runInvenOnly();
    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  }

  return executeCrawl();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Execute the crawl and return the result.
 */
async function executeCrawl(): Promise<NextResponse<CrawlResult>> {
  const { getCrawlEngine } = await import('@/lib/price-crawl/crawl-engine');
  const engine = getCrawlEngine();

  // Set up player lookup for name resolution
  setupPlayerLookup(engine);

  // Check if we can crawl (rate limit)
  if (!engine.canCrawl()) {
    const rateLimitResult: CrawlResult = {
      crawlId: '',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      fetcherResults: [],
      totalUpdated: 0,
      totalUnchanged: 0,
      success: false,
      summary: `Daily crawl limit reached. ${engine.remainingCrawlsToday} crawls remaining today. Next scheduled crawl will run automatically.`,
    };
    return NextResponse.json(rateLimitResult, { status: 429 });
  }

  try {
    const result = await engine.runCrawl();

    // Trigger ISR revalidation for price-dependent pages
    if (result.success) {
      await triggerRevalidation();
    }

    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (err) {
    const errorResult: CrawlResult = {
      crawlId: '',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: 0,
      fetcherResults: [],
      totalUpdated: 0,
      totalUnchanged: 0,
      success: false,
      summary: `Crawl execution error: ${err instanceof Error ? err.message : String(err)}`,
    };
    return NextResponse.json(errorResult, { status: 500 });
  }
}

/**
 * Verify request authorization.
 * Returns an error response if unauthorized, or null if OK.
 */
function verifyAuth(request: Request): NextResponse | null {
  const cronHeader = request.headers.get('x-vercel-cron');
  const authHeader = request.headers.get('authorization');

  // Development: allow all
  if (process.env.NODE_ENV === 'development') {
    return null;
  }

  // Vercel cron: auto-authorized
  if (cronHeader) {
    return null;
  }

  // Manual trigger: check auth token
  const authToken = process.env.CRAWL_AUTH_TOKEN;
  if (authToken && authHeader === `Bearer ${authToken}`) {
    return null;
  }

  return NextResponse.json(
    { error: 'Unauthorized: this endpoint requires Vercel cron or auth token' },
    { status: 401 },
  );
}

/**
 * Set up player lookup on the crawl engine.
 * Uses the PlayerStore's search functionality to resolve names to spids.
 */
function setupPlayerLookup(engine: Awaited<ReturnType<typeof import('@/lib/price-crawl/crawl-engine').getCrawlEngine>>): void {
  if (engine.status === 'idle') {
    try {
      // Dynamic import to avoid circular dependencies and keep the module
      // tree clean for client-side bundling
      void import('@/lib/player-store').then(({ playerStore }) => {
        if (playerStore) {
          engine.setPlayerLookup((name: string) => {
            // Use suggestPlayers for name-based lookup
            const players = playerStore.suggestPlayers(name, 10);
            return players.map((p: { spid: number; name: string; seasonName: string }) => ({
              spid: p.spid,
              name: p.name,
              seasonName: p.seasonName,
            }));
          });
        }
      }).catch((err: unknown) => {
        console.warn(
          '[CrawlAPI] Could not set up player lookup:',
          err instanceof Error ? err.message : err,
        );
      });
    } catch (err) {
      console.warn(
        '[CrawlAPI] Could not set up player lookup:',
        err instanceof Error ? err.message : err,
      );
    }
  }
}

/**
 * Trigger ISR revalidation for price-dependent pages.
 * Uses Next.js revalidatePath/revalidateTag API.
 */
async function triggerRevalidation(): Promise<void> {
  try {
    // Revalidate pages that display price data
    const paths = ['/players', '/squad-builder'];

    for (const path of paths) {
      try {
        // Dynamic import of next/cache
        const { revalidatePath } = await import('next/cache');
        revalidatePath(path);
        console.log(`[CrawlAPI] Revalidated: ${path}`);
      } catch {
        // revalidatePath may not be available in all contexts
      }
    }
  } catch {
    // Non-critical — revalidation will happen on next request
  }
}
