/**
 * Tests for the CSV seed pipeline.
 *
 * Tests cover:
 * - CSV parsing (quotes, BOM, edge cases)
 * - Season classification
 * - Team resolution
 * - Row transformation
 * - Full seed pipeline (database integration)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { parseCsvString } from '@/db/csv-parser';
import { classifySeason } from '@/db/season-classifier';
import { parseTeamColors, findTeam } from '@/db/team-resolver';
import { seedFromCsv, resetDatabase, getDbStats } from '@/db/seed';
import { getDb, resetDb } from '@/db';

// ---------------------------------------------------------------------------
// CSV Parser tests
// ---------------------------------------------------------------------------

describe('CSV Parser', () => {
  it('parses a simple CSV with headers', () => {
    const csv = 'name,age,city\nJohn,30,Seoul\nJane,25,Tokyo';
    const rows = parseCsvString(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: 'John', age: '30', city: 'Seoul' });
    expect(rows[1]).toEqual({ name: 'Jane', age: '25', city: 'Tokyo' });
  });

  it('handles UTF-8 BOM', () => {
    const bom = '\uFEFF';
    const csv = bom + 'name,value\ntest,123';
    const rows = parseCsvString(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('test');
  });

  it('handles quoted fields with commas', () => {
    const csv = 'name,traits\ntest,"trait1,trait2,trait3"';
    const rows = parseCsvString(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].traits).toBe('trait1,trait2,trait3');
  });

  it('handles escaped quotes inside quoted fields', () => {
    const csv = 'name,desc\ntest,"he said ""hello"" world"';
    const rows = parseCsvString(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].desc).toBe('he said "hello" world');
  });

  it('handles CRLF line endings', () => {
    const csv = 'name,value\r\na,1\r\nb,2';
    const rows = parseCsvString(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ name: 'a', value: '1' });
    expect(rows[1]).toEqual({ name: 'b', value: '2' });
  });

  it('returns empty array for empty input', () => {
    expect(parseCsvString('')).toEqual([]);
    expect(parseCsvString('\n\n')).toEqual([]);
  });

  it('handles rows with fewer fields than headers', () => {
    const csv = 'a,b,c\n1,2';
    const rows = parseCsvString(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].a).toBe('1');
    expect(rows[0].b).toBe('2');
    expect(rows[0].c).toBe('');
  });

  it('handles trailing newlines', () => {
    const csv = 'name,val\na,1\n\n';
    const rows = parseCsvString(csv);
    expect(rows).toHaveLength(1);
  });

  it('trims whitespace from fields', () => {
    const csv = 'name, city \n John , Seoul ';
    const rows = parseCsvString(csv);
    expect(rows[0].name).toBe('John');
    expect(rows[0].city).toBe('Seoul');
  });

  it('handles Korean characters correctly', () => {
    const csv = '이름,시즌,포지션\n기성용,24KL,CDM';
    const rows = parseCsvString(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].이름).toBe('기성용');
    expect(rows[0].시즌).toBe('24KL');
    expect(rows[0].포지션).toBe('CDM');
  });

  it('handles JSON-like fields with escaped quotes (team_colors)', () => {
    const csv = 'name,team_colors\ntest,"[""대한민국"",""FC 서울"",""FC Seoul""]"';
    const rows = parseCsvString(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].team_colors).toBe('["대한민국","FC 서울","FC Seoul"]');
  });
});

// ---------------------------------------------------------------------------
// Season classifier tests
// ---------------------------------------------------------------------------

describe('Season Classifier', () => {
  it('classifies ICON cards', () => {
    const result = classifySeason('ICON');
    expect(result.cardType).toBe('ICON');
  });

  it('classifies MCICON cards', () => {
    const result = classifySeason('MCICON');
    expect(result.cardType).toBe('ICON');
  });

  it('classifies LIVE cards', () => {
    const result = classifySeason('LIVE');
    expect(result.cardType).toBe('LIVE');
    expect(result.seasonYear).toBe('24/25');
  });

  it('classifies TOTY cards', () => {
    const result = classifySeason('TOTY24');
    expect(result.cardType).toBe('SPECIAL');
    expect(result.nameEn).toContain('Team of the Year');
  });

  it('classifies base seasons (2-digit year)', () => {
    const result = classifySeason('24');
    expect(result.cardType).toBe('BASE');
    expect(result.seasonYear).toBe('24');
  });

  it('classifies K League base', () => {
    const result = classifySeason('24KL');
    expect(result.cardType).toBe('BASE');
    expect(result.nameEn).toContain('K League');
  });

  it('classifies K League boost', () => {
    const result = classifySeason('24KLB');
    expect(result.cardType).toBe('SPECIAL');
    expect(result.nameEn).toContain('Boost');
  });

  it('classifies Premier League base', () => {
    const result = classifySeason('24PLA');
    expect(result.cardType).toBe('BASE');
    expect(result.nameEn).toContain('Premier League');
  });

  it('classifies known special event codes', () => {
    const result = classifySeason('HOT');
    expect(result.cardType).toBe('SPECIAL');
    expect(result.nameEn).toBe('Highlight of the Tournament');
  });

  it('classifies year-prefixed codes', () => {
    const result = classifySeason('22HR');
    expect(result.cardType).toBe('SPECIAL');
  });

  it('handles unknown codes gracefully', () => {
    const result = classifySeason('XYZ123');
    expect(result.cardType).toBe('SPECIAL');
    expect(result.name).toBe('XYZ123');
  });

  it('handles empty/null codes', () => {
    expect(classifySeason('').cardType).toBe('BASE');
  });
});

// ---------------------------------------------------------------------------
// Team resolver tests
// ---------------------------------------------------------------------------

describe('Team Resolver', () => {
  it('parses valid team_colors JSON', () => {
    const result = parseTeamColors('["대한민국","FC 서울","FC Seoul"]');
    expect(result).toEqual(['대한민국', 'FC 서울', 'FC Seoul']);
  });

  it('returns null for invalid or empty JSON', () => {
    expect(parseTeamColors('not json')).toBeNull();
    expect(parseTeamColors('')).toBeNull();
    // Empty array is valid JSON but has no team data
    expect(parseTeamColors('[]')).toEqual([]);
  });

  it('finds teams by exact Korean name match', () => {
    const team = findTeam(['대한민국', 'FC 서울', 'FC Seoul']);
    expect(team.nameEn).toBe('FC Seoul');
    expect(team.leagueName).toBe('KLEAGUE');
  });

  it('finds EPL teams', () => {
    const team = findTeam(['英格兰', '맨체스터 시티', 'Manchester City']);
    expect(team.nameEn).toBe('Manchester City');
    expect(team.leagueName).toBe('EPL');
  });

  it('finds La Liga teams', () => {
    const team = findTeam(['西班牙', '레알 마드리드', 'Real Madrid']);
    expect(team.nameEn).toBe('Real Madrid');
    expect(team.leagueName).toBe('LALIGA');
  });

  it('finds teams by partial match', () => {
    const team = findTeam(['意大利', '밀라노 FC', 'Inter Milan']);
    expect(team.nameEn).toBe('Inter Milan');
  });

  it('finds teams by English name', () => {
    const team = findTeam(['대한민국', '알힐랄', 'Al Hilal']);
    expect(team.nameEn).toBe('Al Hilal');
  });

  it('returns unknown for unrecognized teams', () => {
    const team = findTeam(['대한민국', '알 수 없는 팀', 'Unknown Team']);
    expect(team.nameEn).toBe('알 수 없는 팀');
    expect(team.leagueId).toBe(-1);
  });

  it('returns unknown for null/empty team colors', () => {
    expect(findTeam(null).nameEn).toBe('Unknown');
    expect(findTeam([]).nameEn).toBe('Unknown');
    expect(findTeam(['only']).nameEn).toBe('Unknown');
  });

  it('handles team_colors with escaped quotes', () => {
    const tcStr = '[""대한민국"",""FC 서울"",""FC Seoul""]';
    const parsed = parseTeamColors(tcStr);
    expect(parsed).not.toBeNull();
    expect(parsed![1]).toBe('FC 서울');
  });
});

// ---------------------------------------------------------------------------
// Full seed pipeline tests (with temporary database)
// ---------------------------------------------------------------------------

const SILENT_LOGGER = { log: () => {}, error: () => {}, warn: () => {} } as Pick<Console, 'log' | 'error' | 'warn'>;

const CSV_HEADER = 'player_code,player_name,salary,season,position,ovr,height,weight,skill,left_foot,right_foot,traits,team_colors,속력,가속력,골 결정력,슛 파워,중거리 슛,위치 선정,발리슛,페널티 킥,짧은 패스,시야,크로스,긴 패스,프리킥,커브,드리블,볼 컨트롤,민첩성,밸런스,반응 속도,대인 수비,태클,가로채기,헤더,슬라이딩 태클,몸싸움,스태미너,적극성,점프,침착성,GK 다이빙,GK 핸들링,GK 킥,GK 반응속도,GK 위치 선정';

const TEST_CSV_ROWS = [
  CSV_HEADER,
  '100001001,손흥민,28,24,ST,88,183,78,4,4,4,"유리몸","[""대한민국"",""토트넘 홋스퍼"",""Tottenham""]",91,88,90,85,82,92,78,80,82,80,78,75,80,82,90,85,78,86,40,42,60,65,55,40,72,75,68,78,45,40,40,42,45',
  '100001002,기성용,15,24KL,CDM,88,189,75,3,5,5,"유리몸","[""대한민국"",""FC 서울"",""FC Seoul""]",65,66,74,72,78,70,68,72,80,82,76,72,70,75,80,78,72,74,78,80,72,78,75,80,76,78,82,80,80,45,40,40,42,45',
  '100001003,이강인,30,24PLA,LW,86,173,67,5,5,4,"플레이메이커","[""대한민국"",""FC 바르셀로나"",""FC Barcelona""]",86,84,78,72,75,78,68,72,84,86,80,76,78,92,88,82,78,80,42,44,38,45,60,42,70,72,68,76,40,40,40,40,40',
  '100001004,김민재,20,24PLA,CB,85,190,83,3,5,5,"강한 태클","[""대한민국"",""바이에른 뮌헨"",""Bayern Munich""]",78,78,45,55,50,52,40,48,70,68,65,72,68,72,78,76,82,86,84,80,85,88,82,82,84,85,86,82,80,48,42,50,55,48',
].join('\n');

describe('Seed Pipeline (integration)', () => {
  let tmpDir: string;
  let csvPath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `fc-squad-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });

    csvPath = join(tmpDir, 'details.csv');
    writeFileSync(csvPath, TEST_CSV_ROWS);

    // Ensure clean database state before each test
    resetDb();
    const dbPath = join(process.cwd(), 'data', 'fc-squad.db');
    for (const ext of ['', '-wal', '-shm']) {
      const p = dbPath + ext;
      if (existsSync(p)) rmSync(p, { force: true });
    }
  });

  afterEach(() => {
    // Clean up temp directory
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }

    // Reset the database connection and delete the db file between tests
    resetDb();
    const dbPath = join(process.cwd(), 'data', 'fc-squad.db');
    for (const ext of ['', '-wal', '-shm']) {
      const p = dbPath + ext;
      if (existsSync(p)) rmSync(p, { force: true });
    }
  });

  it('seeds the database from a CSV file', async () => {
    const result = await seedFromCsv({
      csvPath,
      force: true,
      logger: SILENT_LOGGER,
    });

    expect(result.seeded).toBe(true);
    expect(result.playersProcessed).toBe(4);
    expect(result.rowsSkipped).toBe(0);
    expect(result.seasonsFound).toBeGreaterThanOrEqual(2);
    expect(result.schemaCreated).toBe(true);

    // Verify the database has the correct data
    const db = getDb();
    const sqlite = (db as any).$client;
    const count = (sqlite.prepare('SELECT COUNT(*) as c FROM players').get() as any).c;
    expect(count).toBe(4);

    // Verify specific player data
    const son = sqlite.prepare('SELECT * FROM players WHERE spid = 100001001').get() as any;
    expect(son.name).toBe('손흥민');
    expect(son.position).toBe('ST');
    expect(son.ovr).toBe(88);
    expect(son.team_name_en).toBe('Tottenham Hotspur');
    expect(son.price).toBe(2800000); // salary 28 * 100000
    expect(son.price_source).toBe('seed');
    expect(son.card_type).toBe('BASE');

    // Verify season classification
    const ki = sqlite.prepare('SELECT * FROM players WHERE spid = 100001002').get() as any;
    expect(ki.card_type).toBe('BASE');
    expect(ki.season_slug).toBe('24kl');
    expect(ki.team_name_en).toBe('FC Seoul');

    // Verify raw stats are stored as JSON
    const rawStats = JSON.parse(son.raw_stats);
    expect(rawStats.속력).toBe(91);
    expect(rawStats.가속력).toBe(88);
  });

  it('skips re-seeding when CSV hash matches', async () => {
    // First seed
    const result1 = await seedFromCsv({ csvPath, force: true, logger: SILENT_LOGGER });
    expect(result1.seeded).toBe(true);

    // Second seed (should skip)
    const result2 = await seedFromCsv({ csvPath, force: false, logger: SILENT_LOGGER });
    expect(result2.seeded).toBe(false);
    expect(result2.playersProcessed).toBe(4);
  });

  it('re-seeds when CSV content changes', async () => {
    // First seed
    const result1 = await seedFromCsv({ csvPath, force: true, logger: SILENT_LOGGER });
    expect(result1.seeded).toBe(true);

    // Modify the CSV — change OVR from 88 to 89
    writeFileSync(csvPath, [
      CSV_HEADER,
      '100001001,손흥민,30,24,ST,89,183,78,4,4,4,"유리몸","[""대한민국"",""토트넘 홋스퍼"",""Tottenham""]",91,88,90,85,82,92,78,80,82,80,78,75,80,82,90,85,78,86,40,42,60,65,55,40,72,75,68,78,45,40,40,42,45',
    ].join('\n'));

    // Second seed (should re-seed due to changed hash)
    const result2 = await seedFromCsv({ csvPath, force: false, logger: SILENT_LOGGER });
    expect(result2.seeded).toBe(true);
    expect(result2.playersProcessed).toBe(1);
  });

  it('records seed metadata', async () => {
    await seedFromCsv({ csvPath, force: true, logger: SILENT_LOGGER });

    const db = getDb();
    const sqlite = (db as any).$client;
    const meta = sqlite.prepare('SELECT * FROM seed_meta ORDER BY id DESC LIMIT 1').get() as any;

    expect(meta.rows_processed).toBe(4);
    expect(meta.rows_skipped).toBe(0);
    expect(meta.source).toBe(csvPath);
    expect(meta.file_hash).toBeTruthy();
    expect(meta.seeded_at).toBeTruthy();
  });

  it('throws error when CSV file does not exist', async () => {
    await expect(
      seedFromCsv({ csvPath: '/nonexistent/path/details.csv', logger: SILENT_LOGGER }),
    ).rejects.toThrow('CSV file not found');
  });

  it('handles rows with invalid positions gracefully', async () => {
    const badCsvPath = join(tmpDir, 'bad-details.csv');
    writeFileSync(badCsvPath, [
      CSV_HEADER,
      '100001001,손흥민,28,24,INVALID,88,183,78,4,4,4,"test","[""대한민국"",""토트넘"",""Tottenham""]",91,88,90,85,82,92,78,80,82,80,78,75,80,82,90,85,78,86,40,42,60,65,55,40,72,75,68,78,45,40,40,42,45',
    ].join('\n'));

    const result = await seedFromCsv({ csvPath: badCsvPath, force: true, logger: SILENT_LOGGER });
    expect(result.playersProcessed).toBe(0);
    expect(result.rowsSkipped).toBe(1);
  });

  it('computes composite stats correctly for outfield players', async () => {
    await seedFromCsv({ csvPath, force: true, logger: SILENT_LOGGER });

    const db = getDb();
    const sqlite = (db as any).$client;
    const son = sqlite.prepare('SELECT * FROM players WHERE spid = 100001001').get() as any;

    // 속력=91, 가속력=88 → pace = round((91+88)/2) = 90
    expect(son.pace).toBe(90);
    // 골 결정력=90, 슛 파워=85, 중거리 슛=82, 위치 선정=92, 발리슛=78, 페널티 킥=80 → round(507/6) = 85
    expect(son.shooting).toBe(85);
  });

  it('stores price as salary * 100000', async () => {
    await seedFromCsv({ csvPath, force: true, logger: SILENT_LOGGER });

    const db = getDb();
    const sqlite = (db as any).$client;
    const son = sqlite.prepare('SELECT * FROM players WHERE spid = 100001001').get() as any;
    // salary = 28 → price = 28 * 100000 = 2800000
    expect(son.price).toBe(2800000);
  });

  it('sets price to 0 when salary is 0 or missing', async () => {
    const zeroSalaryCsv = join(tmpDir, 'zero-salary.csv');
    writeFileSync(zeroSalaryCsv, [
      CSV_HEADER,
      '100001001,손흥민,0,24,ST,88,183,78,4,4,4,"유리몸","[""대한민국"",""토트넘"",""Tottenham""]",91,88,90,85,82,92,78,80,82,80,78,75,80,82,90,85,78,86,40,42,60,65,55,40,72,75,68,78,45,40,40,42,45',
    ].join('\n'));

    await seedFromCsv({ csvPath: zeroSalaryCsv, force: true, logger: SILENT_LOGGER });

    const db = getDb();
    const sqlite = (db as any).$client;
    const player = sqlite.prepare('SELECT price FROM players WHERE spid = 100001001').get() as any;
    expect(player.price).toBe(0);
  });

  it('supports idempotent upsert (INSERT OR REPLACE)', async () => {
    // First seed
    await seedFromCsv({ csvPath, force: true, logger: SILENT_LOGGER });

    // Re-seed with same data (force)
    await seedFromCsv({ csvPath, force: true, logger: SILENT_LOGGER });

    // Should still have exactly 4 players (not 8)
    const db = getDb();
    const sqlite = (db as any).$client;
    const count = (sqlite.prepare('SELECT COUNT(*) as c FROM players').get() as any).c;
    expect(count).toBe(4);
  });

  it('creates schema_version entry on first seed', async () => {
    await seedFromCsv({ csvPath, force: true, logger: SILENT_LOGGER });

    const db = getDb();
    const sqlite = (db as any).$client;
    const version = sqlite.prepare('SELECT * FROM schema_version').get() as any;

    expect(version.version).toBe(1);
    expect(version.description).toContain('CSV seed');
    expect(version.applied_at).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Database stats tests
// ---------------------------------------------------------------------------

describe('Database Stats', () => {
  it('returns correct stats after seeding', async () => {
    const tmpDir = join(tmpdir(), `fc-stats-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
    const csvPath = join(tmpDir, 'test.csv');
    writeFileSync(csvPath, [
      CSV_HEADER,
      '100001001,손흥민,28,24,ST,88,183,78,4,4,4,"유리몸","[""대한민국"",""토트넘"",""Tottenham""]",91,88,90,85,82,92,78,80,82,80,78,75,80,82,90,85,78,86,40,42,60,65,55,40,72,75,68,78,45,40,40,42,45',
      '100001002,이강인,30,24,LW,86,173,67,5,5,4,"플레이메이커","[""대한민국"",""FC 바르셀로나"",""FC Barcelona""]",86,84,78,72,75,78,68,72,84,86,80,76,78,92,88,82,78,80,42,44,38,45,60,42,70,72,68,76,40,40,40,40,40',
    ].join('\n'));

    try {
      await seedFromCsv({ csvPath, force: true, logger: SILENT_LOGGER });

      const stats = await getDbStats();
      expect(stats.playerCount).toBe(2);
      expect(stats.seasonCount).toBe(1);
      expect(stats.teamCount).toBe(2); // Tottenham + Barcelona
      expect(stats.avgPrice).toBeGreaterThan(0);
      expect(stats.lastSeedDate).toBeTruthy();
    } finally {
      resetDb();
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
