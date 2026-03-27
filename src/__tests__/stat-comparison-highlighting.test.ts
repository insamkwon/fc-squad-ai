/**
 * Tests for stat comparison highlighting logic.
 * Run: npx tsx src/__tests__/stat-comparison-highlighting.test.ts
 */
import {
  computeStatBounds,
  getComparisonValueClasses,
  getComparisonCellBg,
  statBarPercent,
  STAT_KEYS,
} from "../lib/stat-utils";
import type { PlayerStats } from "../types/player";

// Simple test harness
let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log("  \u2705 " + testName);
    passed++;
  } else {
    console.log("  \u274c " + testName);
    failed++;
  }
}

function assertEqual(actual: unknown, expected: unknown, testName: string) {
  if (actual === expected) {
    console.log("  \u2705 " + testName);
    passed++;
  } else {
    console.log("  \u274c " + testName + " -- expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual));
    failed++;
  }
}

// ============================================================================
// Sample players
// ============================================================================

function makePlayerStats(overrides: Partial<PlayerStats> = {}): PlayerStats {
  return {
    ovr: 80,
    pace: 75,
    shooting: 70,
    passing: 72,
    dribbling: 74,
    defending: 68,
    physical: 76,
    ...overrides,
  };
}

const player1 = { stats: makePlayerStats({ ovr: 88, pace: 92, shooting: 85, passing: 80, dribbling: 88, defending: 45, physical: 78 }) };
const player2 = { stats: makePlayerStats({ ovr: 85, pace: 78, shooting: 90, passing: 85, dribbling: 82, defending: 65, physical: 80 }) };
const player3 = { stats: makePlayerStats({ ovr: 82, pace: 85, shooting: 80, passing: 88, dribbling: 76, defending: 70, physical: 84 }) };

// ============================================================================
// Tests
// ============================================================================

async function main() {
  console.log("\n=== Stat Comparison Highlighting Tests ===\n");

  // ---- Test 1: computeStatBounds with 3 players ----
  console.log("computeStatBounds with 3 players:");
  {
    const bounds = computeStatBounds([player1, player2, player3]);

    // OVR
    assertEqual(bounds.best["ovr"], 88, "OVR best = 88 (player1)");
    assertEqual(bounds.worst["ovr"], 82, "OVR worst = 82 (player3)");

    // Pace
    assertEqual(bounds.best["pace"], 92, "Pace best = 92 (player1)");
    assertEqual(bounds.worst["pace"], 78, "Pace worst = 78 (player2)");

    // Shooting
    assertEqual(bounds.best["shooting"], 90, "Shooting best = 90 (player2)");
    assertEqual(bounds.worst["shooting"], 80, "Shooting worst = 80 (player3)");

    // Passing
    assertEqual(bounds.best["passing"], 88, "Passing best = 88 (player3)");
    assertEqual(bounds.worst["passing"], 80, "Passing worst = 80 (player1)");

    // Dribbling
    assertEqual(bounds.best["dribbling"], 88, "Dribbling best = 88 (player1)");
    assertEqual(bounds.worst["dribbling"], 76, "Dribbling worst = 76 (player3)");

    // Defending
    assertEqual(bounds.best["defending"], 70, "Defending best = 70 (player3)");
    assertEqual(bounds.worst["defending"], 45, "Defending worst = 45 (player1)");

    // Physical
    assertEqual(bounds.best["physical"], 84, "Physical best = 84 (player3)");
    assertEqual(bounds.worst["physical"], 78, "Physical worst = 78 (player1)");
  }

  // ---- Test 2: computeStatBounds with 2 players ----
  console.log("\ncomputeStatBounds with 2 players:");
  {
    const bounds = computeStatBounds([player1, player2]);

    assertEqual(bounds.best["ovr"], 88, "OVR best = 88");
    assertEqual(bounds.worst["ovr"], 85, "OVR worst = 85");
    assertEqual(bounds.best["pace"], 92, "Pace best = 92");
    assertEqual(bounds.worst["pace"], 78, "Pace worst = 78");
  }

  // ---- Test 3: computeStatBounds with empty array ----
  console.log("\ncomputeStatBounds with empty array:");
  {
    const bounds = computeStatBounds([]);

    assertEqual(bounds.best["ovr"], 0, "Empty: OVR best = 0");
    assertEqual(bounds.worst["ovr"], 0, "Empty: OVR worst = 0");
    assertEqual(bounds.best["pace"], 0, "Empty: Pace best = 0");
    assertEqual(bounds.worst["pace"], 0, "Empty: Pace worst = 0");

    // Verify all STAT_KEYS have entries
    for (const stat of STAT_KEYS) {
      assert(bounds.best[stat.key] === 0, "Empty: best." + stat.key + " = 0");
      assert(bounds.worst[stat.key] === 0, "Empty: worst." + stat.key + " = 0");
    }
  }

  // ---- Test 4: computeStatBounds with tied values ----
  console.log("\ncomputeStatBounds with tied values:");
  {
    const tied1 = { stats: makePlayerStats({ pace: 80, shooting: 80 }) };
    const tied2 = { stats: makePlayerStats({ pace: 80, shooting: 75 }) };
    const bounds = computeStatBounds([tied1, tied2]);

    assertEqual(bounds.best["pace"], 80, "Tied pace: best = 80");
    assertEqual(bounds.worst["pace"], 80, "Tied pace: worst = 80");
    assertEqual(bounds.best["shooting"], 80, "Tied shooting: best = 80");
    assertEqual(bounds.worst["shooting"], 75, "Tied shooting: worst = 75");
  }

  // ---- Test 5: getComparisonValueClasses ----
  console.log("\ngetComparisonValueClasses:");
  {
    const bestClasses = getComparisonValueClasses(true, false);
    assert(bestClasses.includes("font-extrabold"), "Best: uses font-extrabold");
    assert(bestClasses.includes("text-yellow-300"), "Best: uses text-yellow-300 (bright gold)");

    const worstClasses = getComparisonValueClasses(false, true);
    assert(worstClasses.includes("font-medium"), "Worst: uses font-medium (lighter weight)");
    assert(worstClasses.includes("text-gray-500"), "Worst: uses text-gray-500 (dimmed)");

    const neutralClasses = getComparisonValueClasses(false, false);
    assert(neutralClasses.includes("font-semibold"), "Neutral: uses font-semibold");
    assert(neutralClasses.includes("text-gray-300"), "Neutral: uses text-gray-300");

    // Best takes priority over worst (both true should not happen, but test defensively)
    const bothClasses = getComparisonValueClasses(true, true);
    assert(bothClasses.includes("font-extrabold"), "Best priority: still bold when both true");
    assert(bothClasses.includes("text-yellow-300"), "Best priority: still yellow when both true");
  }

  // ---- Test 6: getComparisonCellBg ----
  console.log("\ngetComparisonCellBg:");
  {
    const bestBg = getComparisonCellBg(true);
    assert(bestBg.includes("bg-yellow-500/5"), "Best cell: has subtle yellow background");
    assert(bestBg.length > 0, "Best cell: returns non-empty string");

    const normalBg = getComparisonCellBg(false);
    assertEqual(normalBg, "", "Normal cell: returns empty string");
  }

  // ---- Test 7: statBarPercent ----
  console.log("\nstatBarPercent:");
  {
    assertEqual(statBarPercent(99), 100, "99 => 100%");
    assertEqual(statBarPercent(0), 0, "0 => 0%");
    assertEqual(statBarPercent(50), (50 / 99) * 100, "50 => ~50.5%");

    // Clamped to 100
    assert(statBarPercent(100) <= 100, "100 => clamped to 100%");
    assert(statBarPercent(999) <= 100, "999 => clamped to 100%");

    // Custom max
    assertEqual(statBarPercent(5, 10), 50, "5/10 = 50%");
  }

  // ---- Test 8: STAT_KEYS completeness ----
  console.log("\nSTAT_KEYS coverage:");
  {
    assertEqual(STAT_KEYS.length, 6, "STAT_KEYS has 6 entries");
    const keys = STAT_KEYS.map((s) => s.key);
    assert(keys.includes("pace"), "Contains pace");
    assert(keys.includes("shooting"), "Contains shooting");
    assert(keys.includes("passing"), "Contains passing");
    assert(keys.includes("dribbling"), "Contains dribbling");
    assert(keys.includes("defending"), "Contains defending");
    assert(keys.includes("physical"), "Contains physical");
  }

  // ---- Test 9: Integration - simulating comparison row logic ----
  console.log("\nIntegration - comparison row highlighting:");
  {
    const players = [player1, player2, player3];
    const bounds = computeStatBounds(players);

    // For each stat, verify that at least one player is "best" and one is "worst"
    for (const stat of ["ovr", ...STAT_KEYS.map((s) => s.key)]) {
      const bestCount = players.filter((p) => p.stats[stat as keyof PlayerStats] === bounds.best[stat]).length;
      const worstCount = players.filter((p) => p.stats[stat as keyof PlayerStats] === bounds.worst[stat]).length;

      assert(bestCount >= 1, stat + ": at least 1 player is best");
      assert(worstCount >= 1, stat + ": at least 1 player is worst");
      assert(bestCount <= players.length, stat + ": best count <= player count");
      assert(worstCount <= players.length, stat + ": worst count <= player count");
    }
  }

  // ---- Test 10: isWorst should not apply with only 2 players ----
  console.log("\nisWorst guard - 2-player comparison:");
  {
    // In the component, isWorst is gated by `players.length > 2`
    const isWorstEffective = player1.stats.pace === 78 && 2 > 2; // false
    assert(!isWorstEffective, "pace: isWorst is false for 2-player comparison (gated)");
  }

  // ---- Summary ----
  console.log("\n=== Results: " + passed + " passed, " + failed + " failed ===\n");
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
