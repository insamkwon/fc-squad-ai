/**
 * Full crawl script — runs without time budget to populate ALL seasons.
 * Run locally: node scripts/full-crawl.mjs
 *
 * This bypasses Vercel's 60s limit and fetches all 140 seasons.
 * Expected time: ~5-10 minutes depending on network speed.
 */

const DATA_CENTER_URL = 'https://fconline.nexon.com';
const PLAYER_LIST_PATH = '/datacenter/PlayerList';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const MIN_PRICE = 10_000;
const MAX_PRICE = 1_000_000_000_000_000_000; // 1경 BP
const CONCURRENCY = 8;

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
  // TOTY / Legend / HERO / etc.
  317, 318, 319, 320, 321, 322, 323, 324,
];

function parsePlayerListHtml(html) {
  const results = [];
  // Match each player unit block
  const unitRegex = /id="area_playerunit_(\d+)"/g;
  let unitMatch;

  while ((unitMatch = unitRegex.exec(html)) !== null) {
    const spid = parseInt(unitMatch[1], 10);
    // Find the parent div for this player
    const unitStart = unitMatch.index;
    const nextUnit = html.indexOf('id="area_playerunit_', unitStart + 1);
    const unitHtml = nextUnit === -1
      ? html.slice(unitStart)
      : html.slice(unitStart, nextUnit);

    // Extract boost prices: <span class="span_bp{level}" alt="PRICE">
    const priceMap = new Map();
    const bpRegex = /class="span_bp(\d+)"[^>]*\s+alt="([^"]+)"/g;
    let bpMatch;
    while ((bpMatch = bpRegex.exec(unitHtml)) !== null) {
      const level = parseInt(bpMatch[1], 10);
      const price = parseInt(bpMatch[2].replace(/[^0-9]/g, ''), 10);
      if (!isNaN(price) && price > 0) {
        priceMap.set(level, price);
      }
    }

    if (priceMap.size > 0) {
      results.push({ spid, boostPrices: priceMap });
    }
  }

  return results;
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchSeason(seasonId) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);

  try {
    const res = await fetch(`${DATA_CENTER_URL}${PLAYER_LIST_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
        'Referer': `${DATA_CENTER_URL}/datacenter/`,
        'Origin': DATA_CENTER_URL,
      },
      body: `strSeason=,${seasonId},&n1Strong=1`,
      signal: controller.signal,
    });

    if (!res.ok) return { seasonId, parsed: [], status: res.status };

    const html = await res.text();
    return { seasonId, parsed: parsePlayerListHtml(html), status: 200 };
  } catch (err) {
    return { seasonId, parsed: [], error: err.message };
  } finally {
    clearTimeout(timeout);
  }
}

async function main() {
  console.log(`Starting full crawl of ${SEASON_IDS.length} seasons...`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  const startTime = Date.now();

  const allEntries = new Map(); // encodedSpid -> price data
  let totalProcessed = 0;
  let totalFailed = 0;
  let totalPlayers = 0;

  for (let i = 0; i < SEASON_IDS.length; i += CONCURRENCY) {
    const batch = SEASON_IDS.slice(i, i + CONCURRENCY);
    const batchNum = Math.floor(i / CONCURRENCY) + 1;
    const totalBatches = Math.ceil(SEASON_IDS.length / CONCURRENCY);

    process.stdout.write(
      `[${batchNum}/${totalBatches}] Fetching seasons ${batch.join(', ')}... `
    );

    const results = await Promise.allSettled(batch.map(fetchSeason));

    let batchEntries = 0;
    let batchPlayers = 0;

    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      const sid = batch[j];

      if (r.status === 'rejected') {
        process.stdout.write(`E`);
        totalFailed++;
        totalProcessed++;
        continue;
      }

      const { parsed, status, error } = r.value;
      if (error || status !== 200) {
        process.stdout.write(`E`);
        totalFailed++;
        totalProcessed++;
        continue;
      }

      process.stdout.write(`.`);
      totalProcessed++;

      for (const p of parsed) {
        totalPlayers++;
        for (let n1 = 1; n1 <= 7; n1++) {
          const price = p.boostPrices.get(n1);
          if (price === undefined || price < MIN_PRICE || price > MAX_PRICE) continue;

          const encodedSpid = p.spid * 10 + n1;
          // Keep best price per encoded SPID
          const existing = allEntries.get(encodedSpid);
          if (!existing || price < existing.price) {
            allEntries.set(encodedSpid, {
              spid: encodedSpid,
              price,
              source: 'nexon_trade',
              recordedAt: new Date().toISOString(),
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
                seasonId: sid,
              },
            });
          }
          batchEntries++;
        }
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    process.stdout.write(` ${batchEntries} entries (${elapsed}s)\n`);

    // Small delay between batches to avoid rate limiting
    if (i + CONCURRENCY < SEASON_IDS.length) {
      await delay(100);
    }
  }

  // Count unique SPIDs
  const uniqueSpids = new Set();
  for (const [encoded] of allEntries) {
    uniqueSpids.add(Math.floor(encoded / 10));
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n=== Full Crawl Complete ===');
  console.log(`Seasons processed: ${totalProcessed}/${SEASON_IDS.length}`);
  console.log(`Seasons failed: ${totalFailed}`);
  console.log(`Total player entries: ${totalPlayers}`);
  console.log(`Unique SPIDs: ${uniqueSpids.size}`);
  console.log(`Total price entries: ${allEntries.size}`);
  console.log(`Time: ${elapsed}s`);

  // Save to price-cache.json
  const cachePath = new URL('../data/price-cache.json', import.meta.url).pathname;
  const fs = await import('node:fs');

  // Load existing cache and merge
  let existingCache = { prices: {}, crawlHistory: [] };
  try {
    const raw = fs.readFileSync(cachePath, 'utf-8');
    existingCache = JSON.parse(raw);
    console.log(`Existing cache: ${Object.keys(existingCache.prices || {}).length} entries`);
  } catch {
    console.log('No existing cache, creating new one');
  }

  // Merge: new data overwrites old
  const prices = { ...(existingCache.prices || {}) };
  for (const [key, entry] of allEntries) {
    prices[key] = entry;
  }

  const output = {
    ...existingCache,
    prices,
    lastUpdated: new Date().toISOString(),
    _fullCrawl: {
      timestamp: new Date().toISOString(),
      seasonsProcessed: totalProcessed,
      uniqueSpids: uniqueSpids.size,
      totalEntries: allEntries.size,
    },
  };

  fs.writeFileSync(cachePath, JSON.stringify(output, null, 0));
  console.log(`Saved ${Object.keys(prices).length} entries to ${cachePath}`);

  // File size
  const stats = fs.statSync(cachePath);
  console.log(`Cache file size: ${(stats.size / 1024 / 1024).toFixed(1)} MB`);
}

main().catch(console.error);
