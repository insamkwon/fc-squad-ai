/**
 * Vercel Blob-backed price overlay persistence.
 *
 * After each crawl, the price overlay is saved to Vercel Blob so that all
 * serverless instances can serve fresh prices. The format stores ALL boost
 * levels per SPID so the API can serve prices for +5강, +8강, etc.
 *
 * Blob format:
 *   { "spid": { "5": { "p": price, "t": time }, "8": { ... } } }
 *
 * On local dev, falls back to a no-op (price-cache.json is used directly).
 */

import { put, list } from '@vercel/blob';

const BLOB_KEY = 'price-overlay.json';

/**
 * Multi-boost price map: spid → boostLevel → { price, recordedAt }.
 */
export type MultiBoostPriceMap = Map<
  number,
  Map<number, { price: number; recordedAt: string }>
>;

/**
 * Save a multi-boost price overlay to Vercel Blob.
 * Called after a successful crawl to persist prices across serverless instances.
 */
export async function savePriceOverlay(
  priceMap: MultiBoostPriceMap,
): Promise<void> {
  // Skip in development (price-cache.json is used directly)
  if (process.env.NODE_ENV === 'development') return;

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.warn('[price-blob] BLOB_READ_WRITE_TOKEN not set, skipping save');
    return;
  }

  // Build compact JSON: { "spid": { "5": { "p": 123, "t": "..." } } }
  const compact: Record<string, Record<string, { p: number; t: string }>> = {};
  for (const [spid, boosts] of priceMap) {
    const boostEntry: Record<string, { p: number; t: string }> = {};
    for (const [boost, { price, recordedAt }] of boosts) {
      if (price > 0) {
        boostEntry[String(boost)] = { p: price, t: recordedAt };
      }
    }
    if (Object.keys(boostEntry).length > 0) {
      compact[String(spid)] = boostEntry;
    }
  }

  const json = JSON.stringify(compact);
  const totalEntries = Object.values(compact).reduce(
    (sum, boosts) => sum + Object.keys(boosts).length,
    0,
  );
  console.log(`[price-blob] Saving price overlay: ${json.length} bytes (${priceMap.size} players, ${totalEntries} entries)`);

  await put(BLOB_KEY, json, {
    access: 'public',
    contentType: 'application/json',
    addRandomSuffix: false,
  });

  console.log('[price-blob] Price overlay saved successfully');
}

/**
 * Load the price overlay from Vercel Blob.
 * Returns null if no overlay exists or in development mode.
 */
export async function loadPriceOverlay(): Promise<MultiBoostPriceMap | null> {
  // In development, price-cache.json is loaded directly by PriceCacheStore
  if (process.env.NODE_ENV === 'development') return null;

  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;

  try {
    const { blobs } = await list({ prefix: BLOB_KEY });
    const blob = blobs.find((b) => b.pathname.endsWith(BLOB_KEY));

    if (!blob) {
      console.log('[price-blob] No price overlay found in Blob storage');
      return null;
    }

    const response = await fetch(blob.downloadUrl);
    const json = await response.text();
    console.log(`[price-blob] Loaded price overlay: ${json.length} bytes`);

    const compact = JSON.parse(
      json,
    ) as Record<string, Record<string, { p: number; t: string }>>;
    const priceMap: MultiBoostPriceMap = new Map();

    for (const [spid, boosts] of Object.entries(compact)) {
      const boostMap = new Map<number, { price: number; recordedAt: string }>();
      for (const [boost, { p, t }] of Object.entries(boosts)) {
        boostMap.set(Number(boost), { price: p, recordedAt: t });
      }
      priceMap.set(Number(spid), boostMap);
    }

    const totalEntries = [...priceMap.values()].reduce(
      (sum, m) => sum + m.size,
      0,
    );
    console.log(`[price-blob] Parsed ${priceMap.size} players, ${totalEntries} boost entries`);
    return priceMap;
  } catch (err) {
    console.warn(
      '[price-blob] Failed to load price overlay:',
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
