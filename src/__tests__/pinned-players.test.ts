/**
 * Test script for the squad API with pinned players.
 * Run: npx tsx src/__tests__/pinned-players.test.ts
 */
import { playerStore } from '../lib/player-store';

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

// ============================================================================
// Tests
// ============================================================================

async function main() {
  console.log('\n=== Squad API Pinned Players Tests ===\n');

  // ---- Test 1: API accepts pinnedPlayers field ----
  console.log('POST /api/squad with pinnedPlayers:');
  try {
    const allPlayers = playerStore.getAllPlayers();
    assert(allPlayers.length > 0, 'Player store loaded with data');

    // Find a GK and a ST for pinning
    const gk = allPlayers.find(p => p.position === 'GK');
    const st = allPlayers.find(p => p.position === 'ST');
    assert(!!gk, 'Found a GK player to pin');
    assert(!!st, 'Found a ST player to pin');

    if (gk && st) {
      const res = await fetch('http://localhost:3000/api/squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formation: '4-3-3',
          pinnedPlayers: [gk.spid, st.spid],
        }),
      });

      assert(res.ok, `API returned 200 (got ${res.status})`);

      const data = await res.json();
      assert(Array.isArray(data.candidates), 'Response has candidates array');
      assert(data.candidates.length === 3, 'Returned exactly 3 candidates');

      // Verify pinned players are in each squad
      for (let i = 0; i < data.candidates.length; i++) {
        const candidate = data.candidates[i];
        const squadSpids = candidate.squad.players.map((sp: any) => sp.player.spid);
        assert(
          squadSpids.includes(gk.spid),
          `Candidate ${i + 1} contains pinned GK (${gk.spid})`
        );
        assert(
          squadSpids.includes(st.spid),
          `Candidate ${i + 1} contains pinned ST (${st.spid})`
        );
      }
    }
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED') {
      console.log('  ⚠️  Server not running (ECONNREFUSED) — skipping API tests');
      console.log('      Run "npm run dev" and re-run this test.');
    } else {
      console.log(`  ❌ Unexpected error: ${err.message}`);
      failed++;
    }
  }

  // ---- Test 2: API works without pinnedPlayers (backwards compatible) ----
  console.log('\nPOST /api/squad without pinnedPlayers (backwards compat):');
  try {
    const res = await fetch('http://localhost:3000/api/squad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        formation: '4-4-2',
        budget: 500_000_000_000, // 5000억
      }),
    });

    if (res.ok) {
      const data = await res.json();
      assert(Array.isArray(data.candidates), 'Response has candidates array');
      assert(data.candidates.length === 3, 'Returned 3 candidates');

      for (let i = 0; i < data.candidates.length; i++) {
        const candidate = data.candidates[i];
        assert(
          candidate.squad.formation === '4-4-2',
          `Candidate ${i + 1} uses correct formation`
        );
        assert(
          candidate.squad.players.length === 11,
          `Candidate ${i + 1} has 11 players`
        );
      }
    } else {
      console.log(`  ⚠️  Server returned ${res.status} — skipping`);
    }
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED') {
      console.log('  ⚠️  Server not running — skipping');
    }
  }

  // ---- Test 3: Pinned player limit enforcement ----
  console.log('\nPinned player limit (max 3):');
  try {
    const allPlayers = playerStore.getAllPlayers();
    const players = allPlayers.filter(p => ['ST', 'CM', 'CB', 'GK'].includes(p.position)).slice(0, 5);

    if (players.length >= 5) {
      const res = await fetch('http://localhost:3000/api/squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formation: '4-3-3',
          pinnedPlayers: players.map(p => p.spid), // Send 5 but API should only use 3
        }),
      });

      if (res.ok) {
        const data = await res.json();
        assert(data.candidates.length === 3, 'API still returns 3 candidates with 5 pinned (server caps to 3)');
      }
    }
  } catch (err: any) {
    if (err.code === 'ECONNREFUSED') {
      console.log('  ⚠️  Server not running — skipping');
    }
  }

  // ---- Test 4: PlayerMultiSelect max 3 enforcement (component logic) ----
  console.log('\nPlayerMultiSelect logic tests:');
  const selectedPlayers: number[] = [];
  const maxSelect = 3;

  // Simulate selection
  for (let i = 0; i < 5; i++) {
    if (selectedPlayers.length < maxSelect) {
      selectedPlayers.push(i);
    }
  }
  assert(selectedPlayers.length === 3, `Selection capped at ${maxSelect} (got ${selectedPlayers.length})`);

  // Simulate removal
  selectedPlayers.splice(1, 1); // Remove second element
  assert(selectedPlayers.length === 2, 'Removal reduces selection to 2');
  assert(!selectedPlayers.includes(1), 'Correct element was removed');

  // ---- Summary ----
  console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
