#!/usr/bin/env npx tsx
/**
 * Database seed script — reads details.csv and populates the SQLite database.
 *
 * Usage:
 *   node --import tsx scripts/seed-db.ts            # Standard seed (skip if unchanged)
 *   node --import tsx scripts/seed-db.ts --force      # Force full re-seed
 *   node --import tsx scripts/seed-db.ts --stats      # Show database stats
 *   node --import tsx scripts/seed-db.ts --reset      # Reset database completely
 *
 * This script replaces the old csv-to-json.mjs pipeline.
 * The database (data/fc-squad.db) is the new source of truth for player data.
 */

import { resolve } from 'node:path';
import { seedFromCsv, resetDatabase, getDbStats } from '../src/db/seed';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
FC Online Player Database Seed Script

Usage:
  node --import tsx scripts/seed-db.ts            Seed from CSV (skip if unchanged)
  node --import tsx scripts/seed-db.ts --force    Force full re-seed
  node --import tsx scripts/seed-db.ts --stats    Show database statistics
  node --import tsx scripts/seed-db.ts --reset    Reset database completely
  node --import tsx scripts/seed-db.ts --csv <path>  Use custom CSV path

Options:
  --force    Force re-seeding even if the CSV file hasn't changed
  --stats    Display database statistics without seeding
  --reset    Drop all tables and remove the database file
  --csv      Specify a custom CSV file path (default: data/details.csv)
  --help     Show this help message
`);
    process.exit(0);
  }

  // Handle --reset
  if (args.includes('--reset')) {
    console.log('Resetting database...');
    await resetDatabase();
    console.log('Database reset complete.');
    process.exit(0);
  }

  // Handle --stats
  if (args.includes('--stats')) {
    try {
      const stats = await getDbStats();
      console.log('\n📊 Database Statistics');
      console.log('─'.repeat(40));
      console.log(`  Players:      ${stats.playerCount.toLocaleString()}`);
      console.log(`  Seasons:      ${stats.seasonCount}`);
      console.log(`  Teams:        ${stats.teamCount}`);
      console.log(`  Avg Price:    ${stats.avgPrice.toLocaleString()} BP`);
      console.log(`  Last Seeded:  ${stats.lastSeedDate || 'Never'}`);
      console.log('─'.repeat(40));
    } catch (err) {
      console.error('Error reading database stats:', err);
      console.log('\nDatabase may not exist yet. Run the seed script first.');
    }
    process.exit(0);
  }

  // Parse options
  const force = args.includes('--force');
  const csvIdx = args.indexOf('--csv');
  const csvPath = csvIdx >= 0 && args[csvIdx + 1]
    ? resolve(args[csvIdx + 1])
    : resolve('data', 'details.csv');

  console.log('═'.repeat(50));
  console.log('  FC Online Player Database Seeder');
  console.log('═'.repeat(50));

  try {
    const result = await seedFromCsv({
      csvPath,
      force,
      onProgress: (phase, current, total) => {
        if (total > 0 && phase === 'inserting' && current % 5000 === 0) {
          process.stdout.write(`  [${phase}] ${current}/${total} (${((current / total) * 100).toFixed(0)}%)\r`);
        }
      },
    });

    console.log('\n─'.repeat(50));
    console.log(`  Players processed: ${result.playersProcessed.toLocaleString()}`);
    console.log(`  Rows skipped:      ${result.rowsSkipped}`);
    console.log(`  Seasons found:     ${result.seasonsFound}`);
    console.log(`  Schema created:    ${result.schemaCreated ? 'Yes (fresh)' : 'No (existed)'}`);
    console.log(`  File hash:         ${result.fileHash}`);
    console.log(`  Duration:          ${(result.durationMs / 1000).toFixed(1)}s`);
    console.log(`  Seeded:            ${result.seeded ? '✅ Yes' : '⏭️  Skipped (no changes)'}`);
    console.log('─'.repeat(50));
  } catch (err) {
    console.error('\n❌ Seed failed:', err);
    process.exit(1);
  }
}

main();
