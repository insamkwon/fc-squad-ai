#!/usr/bin/env npx tsx
/**
 * Build-time data export script.
 *
 * Exports player data (without raw_stats) to a JSON file at data/players.json.
 * This file is loaded by the PlayerStore at runtime on Vercel serverless
 * functions via fs.readFileSync, avoiding native module dependencies.
 *
 * raw_stats is excluded to reduce payload size (~18MB vs ~48MB).
 * raw_stats is not used in any API response or frontend component.
 *
 * Usage:
 *   node --import tsx scripts/export-data.ts
 */

import { join } from 'node:path';
import { writeFileSync, existsSync } from 'node:fs';
import Database from 'better-sqlite3';

const DB_PATH = join(process.cwd(), 'data', 'fc-squad.db');
const OUTPUT_PATH = join(process.cwd(), 'data', 'players.json');

function main() {
  console.log('═'.repeat(50));
  console.log('  FC Online — Build-time Data Export');
  console.log('═'.repeat(50));

  if (!existsSync(DB_PATH)) {
    console.error(`❌ Database not found at ${DB_PATH}`);
    console.error('   Run the seed script first: npm run seed');
    process.exit(1);
  }

  const sqlite = new Database(DB_PATH, { readonly: true });

  try {
    // Exclude raw_stats to reduce payload size
    const rows = sqlite
      .prepare(
        `SELECT spid, pid, name, name_en, season_id, season_name, season_slug,
                card_type, season_year, release_date, position, team_id, team_name,
                team_name_en, league_id, league_name, ovr, pace, shooting, passing,
                dribbling, defending, physical, price, price_updated_at
         FROM players
         ORDER BY ovr DESC`,
      )
      .all() as Array<Record<string, unknown>>;

    console.log(`  Players exported: ${rows.length.toLocaleString()}`);

    const json = JSON.stringify(rows);
    const sizeMB = (json.length / (1024 * 1024)).toFixed(1);
    console.log(`  JSON size: ${sizeMB} MB`);

    writeFileSync(OUTPUT_PATH, json, 'utf-8');
    console.log(`  Written to: ${OUTPUT_PATH}`);
    console.log('─'.repeat(50));
    console.log('  ✅ Export complete');
    console.log('─'.repeat(50));
  } finally {
    sqlite.close();
  }
}

main();
