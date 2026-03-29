/**
 * Test script for the bilingual player search API.
 * Run: npx tsx src/__tests__/search-api.test.ts
 *
 * Note: The real seed data (data/players.json) uses Korean names for both
 * `name` and `nameEn` fields. English names are typically the Korean
 * transliteration of the western name (e.g., "킬리안 음바페" for Mbappe).
 */
import { playerStore } from '../lib/player-store';
import { normalizeQuery, tokenize, romanizeKorean, scoreSearchMatch, buildSearchIndexEntry, SearchIndexEntry } from '../lib/search-utils';

// Simple test harness
let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName}`);
    failed++;
  }
}

function assertGt(actual: number, expected: number, testName: string) {
  if (actual > expected) {
    console.log(`  ✅ ${testName} (${actual} > ${expected})`);
    passed++;
  } else {
    console.log(`  ❌ ${testName} (${actual} <= ${expected})`);
    failed++;
  }
}

function assertEq(actual: unknown, expected: unknown, testName: string) {
  if (actual === expected) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.log(`  ❌ ${testName} (got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)})`);
    failed++;
  }
}

// ============================================================================
// Test 1: Korean name search (primary use case for real data)
// ============================================================================
console.log('\n🔍 Test 1: Korean name search');
{
  const result = playerStore.searchPlayersAdvanced('손흥민');
  assert(result.total > 0, '손흥민 (Korean) returns results');
  assert(result.results.length > 0, '손흥민 (Korean) has page results');
  assertEq(result.results[0].name, '손흥민', 'First result for 손흥민 is correct player');

  const partialResult = playerStore.searchPlayersAdvanced('손');
  assert(partialResult.total > 0, 'Partial Korean "손" returns results');
  assert(partialResult.total >= result.total, 'Partial match returns >= exact match count');

  const exactResult = playerStore.searchPlayersAdvanced('이강인');
  assert(exactResult.total > 0, '이강인 (Korean) returns results');
  assertEq(exactResult.results[0].name, '이강인', 'First result for 이강인 is correct');

  const kimResult = playerStore.searchPlayersAdvanced('김민재');
  assert(kimResult.total > 0, '김민재 (Korean) returns results');

  // Korean transliteration of western names
  const mbappeResult = playerStore.searchPlayersAdvanced('음바페');
  assert(mbappeResult.total > 0, '음바페 (Korean transliteration of Mbappe) returns results');

  const messiResult = playerStore.searchPlayersAdvanced('메시');
  assert(messiResult.total > 0, '메시 (Korean transliteration of Messi) returns results');

  const ronaldoResult = playerStore.searchPlayersAdvanced('호날두');
  assert(ronaldoResult.total > 0, '호날두 (Korean transliteration of Ronaldo) returns results');
}

// ============================================================================
// Test 2: English name search (via nameEn which is Korean transliteration)
// ============================================================================
console.log('\n🔍 Test 2: Korean transliterated name search');
{
  // In real data, nameEn for western players is also Korean
  // e.g., "킬리안 음바페" for Mbappe
  const mbappeEn = playerStore.searchPlayersAdvanced('킬리안 음바페');
  assert(mbappeEn.total > 0, 'Full transliterated name "킬리안 음바페" returns results');

  const partialEn = playerStore.searchPlayersAdvanced('킬리안');
  assert(partialEn.total > 0, 'Partial transliterated "킬리안" returns results');

  const salahEn = playerStore.searchPlayersAdvanced('모하메드 살라');
  assert(salahEn.total > 0, 'Full transliterated "모하메드 살라" returns results');

  const messiEn = playerStore.searchPlayersAdvanced('리오넬 메시');
  assert(messiEn.total > 0, 'Full transliterated "리오넬 메시" returns results');
}

// ============================================================================
// Test 3: Relevance scoring
// ============================================================================
console.log('\n🔍 Test 3: Relevance scoring');
{
  // Exact Korean name match should rank higher than partial
  const exactKr = playerStore.searchPlayersAdvanced('손흥민');
  const partialKr = playerStore.searchPlayersAdvanced('손');
  assert(exactKr.total > 0, 'Exact Korean search has results');
  assert(partialKr.total > 0, 'Partial Korean search has results');
  assert(exactKr.results[0].name === '손흥민', 'Exact match returns correct player as #1');

  // Full name match should rank highest
  const fullMatch = playerStore.searchPlayersAdvanced('손흥민');
  assert(fullMatch.results[0].name === '손흥민', 'Full name match ranks first');
}

// ============================================================================
// Test 4: Search with filters
// ============================================================================
console.log('\n🔍 Test 4: Search with position + other filters');
{
  const result = playerStore.searchPlayersAdvanced('손흥민', { positions: ['LW'] });
  assert(result.total > 0, '손흥민 + LW position returns results');

  // Filter by minimum OVR
  const highOvr = playerStore.searchPlayersAdvanced('손흥민', { minOvr: 100 });
  const anyOvr = playerStore.searchPlayersAdvanced('손흥민');
  assert(highOvr.total <= anyOvr.total, 'High OVR filter returns fewer or equal results');

  // Filter by card type
  const iconResult = playerStore.searchPlayersAdvanced('손흥민', { cardType: 'ICON' });
  assert(iconResult.total >= 0, 'ICON filter does not crash');
}

// ============================================================================
// Test 5: Pagination
// ============================================================================
console.log('\n🔍 Test 5: Pagination');
{
  const page1 = playerStore.searchPlayersAdvanced('손', {}, { limit: 2, offset: 0 });
  const page2 = playerStore.searchPlayersAdvanced('손', {}, { limit: 2, offset: 2 });
  assert(page1.results.length <= 2, 'Page 1 returns at most 2 results');
  assert(page2.results.length <= 2, 'Page 2 returns at most 2 results');
  assert(page1.total > 0, 'Total results > 0');

  if (page1.results.length > 0 && page2.results.length > 0) {
    assert(page1.results[0].spid !== page2.results[0].spid, 'Page 2 has different results from page 1');
  }

  // Test large limit cap
  const capped = playerStore.searchPlayersAdvanced('손', {}, { limit: 999 });
  assert(capped.results.length <= 100, 'Results capped at 100');
  assert(capped.limit === 100, 'Limit is capped to 100');
}

// ============================================================================
// Test 6: Team name search
// ============================================================================
console.log('\n🔍 Test 6: Team name search');
{
  // Check what teams exist in the data
  const allTeams = playerStore.getAllTeams();
  console.log(`  ℹ️  Total teams in data: ${allTeams.length}`);
  console.log(`  ℹ️  Sample teams: ${allTeams.slice(0, 5).map(t => t.name).join(', ')}`);

  // Search for a common team
  if (allTeams.length > 0) {
    const teamName = allTeams[0].name;
    const teamResult = playerStore.searchPlayersAdvanced(teamName);
    assert(teamResult.total > 0, `Team search for "${teamName}" returns results`);
  }

  // Search for Manchester City (if it exists)
  const cityResult = playerStore.searchPlayersAdvanced('맨체스터 시티');
  assert(cityResult.total > 0, 'Korean team name "맨체스터 시티" returns results');

  // Search for Liverpool (team name is in English in real data)
  const liverpoolResult = playerStore.searchPlayersAdvanced('Liverpool');
  assert(liverpoolResult.total > 0, 'Team name "Liverpool" returns results');
}

// ============================================================================
// Test 7: Autocomplete / Suggestions
// ============================================================================
console.log('\n🔍 Test 7: Autocomplete suggestions');
{
  const suggestions = playerStore.suggestPlayers('손');
  assert(suggestions.length > 0, 'Korean autocomplete for "손" returns suggestions');
  assert(suggestions.length <= 8, 'Suggestions limited to 8');

  // Deduplication: no duplicate pids
  const pids = new Set(suggestions.map(p => p.pid));
  assert(pids.size === suggestions.length, 'Suggestions are deduplicated by pid');

  // Suggestions for single character should work
  const singleChar = playerStore.suggestPlayers('김');
  assert(singleChar.length > 0, 'Single char "김" returns suggestions');
}

// ============================================================================
// Test 8: Edge cases
// ============================================================================
console.log('\n🔍 Test 8: Edge cases');
{
  // Empty query
  const empty = playerStore.searchPlayersAdvanced('');
  assert(empty.total >= 0, 'Empty query does not crash');
  assert(empty.results.length === 20, 'Empty query returns default page size (20)');

  // Whitespace query
  const whitespace = playerStore.searchPlayersAdvanced('   ');
  assert(whitespace.total >= 0, 'Whitespace query does not crash');

  // Non-existent player
  const notFound = playerStore.searchPlayersAdvanced('zzzzzzzzznonexistent');
  assert(notFound.total === 0, 'Non-existent player returns 0 results');

  // Case insensitivity (for Korean + English mixed)
  const mixedCase = playerStore.searchPlayersAdvanced('SON');
  assert(mixedCase.total >= 0, 'Uppercase query does not crash');

  // Very long query
  const longQuery = '손'.repeat(200);
  const longResult = playerStore.searchPlayersAdvanced(longQuery);
  assert(longResult.total >= 0, 'Very long query does not crash');
}

// ============================================================================
// Test 9: Combined search + multiple filters
// ============================================================================
console.log('\n🔍 Test 9: Combined search + multiple filters');
{
  const result = playerStore.searchPlayersAdvanced('손흥민', {
    minOvr: 80,
    maxPrice: 100000000000,
    positions: ['LW'],
  });
  assert(result.total >= 0, 'Combined search + OVR + price + position does not crash');

  const iconResult = playerStore.searchPlayersAdvanced('손흥민', { cardType: 'ICON' });
  if (iconResult.total > 0) {
    assert(iconResult.results.every(p => p.cardType === 'ICON'), 'All results are ICON cards');
  }
}

// ============================================================================
// Test 10: Romanization
// ============================================================================
console.log('\n🔍 Test 10: Korean romanization');
{
  const romanized = romanizeKorean('손흥민');
  console.log(`  ℹ️  손흥민 → "${romanized}"`);
  assert(romanized.length > 0, 'Romanization produces output for 손흥민');

  const romanized2 = romanizeKorean('이강인');
  console.log(`  ℹ️  이강인 → "${romanized2}"`);
  assert(romanized2.length > 0, 'Romanization produces output for 이강인');

  const compound = romanizeKorean('흥민');
  console.log(`  ℹ️  흥민 → "${compound}"`);
  assertEq(compound, 'heungmin', 'Compound lookup 흥민 → heungmin');

  // Test that romanized search works
  const romanizedSearch = playerStore.searchPlayersAdvanced('son heungmin');
  assert(romanizedSearch.total > 0, 'Romanized search "son heungmin" returns results');

  const romanizedSearch2 = playerStore.searchPlayersAdvanced('kangin lee');
  assert(romanizedSearch2.total > 0, 'Romanized search "kangin lee" returns results');
}

// ============================================================================
// Test 11: Text normalization
// ============================================================================
console.log('\n🔍 Test 11: Text normalization');
{
  assertEq(normalizeQuery('  손흥민  '), '손흥민', 'Trim preserves Korean');
  assertEq(normalizeQuery('Heungmin  Son'), 'heungmin son', 'Collapse spaces');

  const tokens = tokenize('Heungmin Son');
  assert(tokens.length === 2, 'Tokenize splits into 2 parts');
  assertEq(tokens[0], 'heungmin', 'First token is heungmin');
  assertEq(tokens[1], 'son', 'Second token is son');
}

// ============================================================================
// Test 12: Legacy searchPlayers still works
// ============================================================================
console.log('\n🔍 Test 12: Legacy searchPlayers compatibility');
{
  const result = playerStore.searchPlayers({ search: '손흥민', positions: [] });
  assert(result.length > 0, 'Legacy searchPlayers with Korean query works');

  const filterResult = playerStore.searchPlayers({ search: '', positions: ['ST'], minOvr: 90 });
  assert(filterResult.length > 0, 'Legacy searchPlayers with position + OVR filter works');

  const teamFilter = playerStore.searchPlayers({ search: '', positions: [], teamId: 1 });
  assert(teamFilter.length >= 0, 'Legacy searchPlayers with team filter works');
}

// ============================================================================
// Test 13: Scoring quality
// ============================================================================
console.log('\n🔍 Test 13: Scoring quality for search results');
{
  // When searching "손흥민", the top result should be the exact name match
  const result = playerStore.searchPlayersAdvanced('손흥민');
  if (result.results.length > 0) {
    assert(result.results[0].name === '손흥민', 'Top result for "손흥민" has exact name match');
  }

  // When searching "손", top results should all contain "손" in their name
  const partialResult = playerStore.searchPlayersAdvanced('손', {}, { limit: 5 });
  if (partialResult.results.length > 0) {
    const allContainSon = partialResult.results.every(p => p.name.includes('손'));
    assert(allContainSon, 'All top results for "손" contain "손" in name');
  }
}

// ============================================================================
// Test 14: Pagination metadata
// ============================================================================
console.log('\n🔍 Test 14: Response metadata structure');
{
  const result = playerStore.searchPlayersAdvanced('손흥민');
  assert('results' in result, 'Response has "results" field');
  assert('total' in result, 'Response has "total" field');
  assert('limit' in result, 'Response has "limit" field');
  assert('offset' in result, 'Response has "offset" field');
  assert(typeof result.total === 'number', 'total is a number');
  assert(typeof result.limit === 'number', 'limit is a number');
  assert(typeof result.offset === 'number', 'offset is a number');
}

// ============================================================================
// Summary
// ============================================================================
console.log(`\n${'='.repeat(50)}`);
console.log(`📊 Results: ${passed} passed, ${failed} failed`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
}
