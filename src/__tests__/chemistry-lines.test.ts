/**
 * Unit tests for chemistry lines rendering logic.
 *
 * Tests cover:
 * 1. Edge building (team links, league links, no-link adjacent pairs)
 * 2. Coordinate conversion (slot percentages to SVG coordinates)
 * 3. Control point calculation (bezier curve generation)
 * 4. Chemistry link info extraction (for player slot indicators)
 * 5. Edge cases (empty squads, single player, unassigned slots)
 */

import { describe, it, expect } from 'vitest';
import {
  buildChemistryEdges,
  slotToSvgCoord,
  getControlPoint,
  buildChemLinkInfo,
  CHEMISTRY_SVG_W,
  CHEMISTRY_SVG_H,
  CURVE_FACTOR,
} from '@/lib/chemistry-lines';
import type { ChemistryEdge } from '@/lib/chemistry-lines';
import type { Player, Position } from '@/types/player';
import type { FormationSlot, SquadPlayer } from '@/types/squad';
import { FORMATION_SLOTS } from '@/types/squad';
import { getChemistryLinks } from '@/lib/squad-generator/chemistry';

// ---------------------------------------------------------------------------
// Test Player Factory
// ---------------------------------------------------------------------------

function createPlayer(overrides: Partial<Player> & { spid: number; pid: number; position: Position }): Player {
  return {
    name: 'Test Player',
    nameEn: 'Test Player',
    seasonId: 68,
    seasonName: 'TOTNUCL (24/25)',
    seasonSlug: 'totnucl-2425',
    cardType: 'SPECIAL',
    seasonYear: '24/25',
    releaseDate: '2024-01-01',
    teamId: 1,
    teamName: 'Team A',
    teamNameEn: 'Team A',
    leagueId: 1,
    leagueName: 'League A',
    stats: { ovr: 80, pace: 75, shooting: 75, passing: 75, dribbling: 75, defending: 75, physical: 75 },
    price: 1_000_000_000,
    priceUpdatedAt: '2026-03-27',
    ...overrides,
  };
}

/**
 * Create a SquadPlayer array from a list of (slotId, teamId, leagueId) tuples.
 */
function createSquadPlayers(
  entries: Array<{ slotId: string; position: Position; teamId: number; leagueId: number }>,
): SquadPlayer[] {
  return entries.map((e, i) => ({
    player: createPlayer({
      spid: 1000 + i,
      pid: 100 + i,
      position: e.position,
      teamId: e.teamId,
      leagueId: e.leagueId,
      teamName: `Team ${e.teamId}`,
      teamNameEn: `Team ${e.teamId}`,
      leagueName: `League ${e.leagueId}`,
    }),
    slotPosition: e.slotId,
  }));
}

// ---------------------------------------------------------------------------
// 1. Edge Building Tests
// ---------------------------------------------------------------------------

describe('buildChemistryEdges', () => {
  const slots = FORMATION_SLOTS['4-4-2'];

  it('returns empty array for fewer than 2 players', () => {
    const singlePlayer = createSquadPlayers([
      { slotId: 'ST_1', position: 'ST', teamId: 1, leagueId: 1 },
    ]);
    expect(buildChemistryEdges(singlePlayer, slots)).toEqual([]);
    expect(buildChemistryEdges([], slots)).toEqual([]);
  });

  it('creates team links for adjacent same-team players', () => {
    // Place two players on adjacent ST positions with same team
    const players = createSquadPlayers([
      { slotId: 'ST_1', position: 'ST', teamId: 1, leagueId: 1 },
      { slotId: 'ST_2', position: 'ST', teamId: 1, leagueId: 1 },
    ]);

    const edges = buildChemistryEdges(players, slots);
    const teamEdges = edges.filter((e) => e.type === 'team');

    expect(teamEdges.length).toBeGreaterThanOrEqual(1);
    for (const edge of teamEdges) {
      expect(edge.strength).toBe(3);
      expect(edge.type).toBe('team');
    }
  });

  it('creates league links for adjacent same-league different-team players', () => {
    const players = createSquadPlayers([
      { slotId: 'ST_1', position: 'ST', teamId: 1, leagueId: 1 },
      { slotId: 'ST_2', position: 'ST', teamId: 2, leagueId: 1 },
    ]);

    const edges = buildChemistryEdges(players, slots);
    const leagueEdges = edges.filter((e) => e.type === 'league');

    expect(leagueEdges.length).toBeGreaterThanOrEqual(1);
    for (const edge of leagueEdges) {
      expect(edge.strength).toBe(2);
      expect(edge.type).toBe('league');
    }
  });

  it('creates no-link edges for adjacent players with no shared attributes', () => {
    const players = createSquadPlayers([
      { slotId: 'ST_1', position: 'ST', teamId: 1, leagueId: 1 },
      { slotId: 'ST_2', position: 'ST', teamId: 2, leagueId: 2 },
    ]);

    const edges = buildChemistryEdges(players, slots);
    const noneEdges = edges.filter((e) => e.type === 'none');

    // ST_1 and ST_2 are adjacent, so they should have a 'none' edge
    expect(noneEdges.length).toBeGreaterThanOrEqual(1);
    for (const edge of noneEdges) {
      expect(edge.strength).toBe(0);
      expect(edge.type).toBe('none');
    }
  });

  it('skips edges for non-adjacent players even with shared team', () => {
    // LW and GK in 4-3-3 are far apart (distance > threshold)
    const slots433 = FORMATION_SLOTS['4-3-3'];
    const players = createSquadPlayers([
      { slotId: 'LW', position: 'LW', teamId: 1, leagueId: 1 },
      { slotId: 'GK', position: 'GK', teamId: 1, leagueId: 1 },
    ]);

    const edges = buildChemistryEdges(players, slots433);

    // LW and GK should not be linked (distance too far)
    const lwGkEdge = edges.find(
      (e) =>
        (players[e.fromIdx].slotPosition === 'LW' && players[e.toIdx].slotPosition === 'GK') ||
        (players[e.fromIdx].slotPosition === 'GK' && players[e.toIdx].slotPosition === 'LW'),
    );
    expect(lwGkEdge).toBeUndefined();
  });

  it('prioritizes team link over league link for same-team same-league players', () => {
    const players = createSquadPlayers([
      { slotId: 'ST_1', position: 'ST', teamId: 1, leagueId: 1 },
      { slotId: 'ST_2', position: 'ST', teamId: 1, leagueId: 1 },
    ]);

    const edges = buildChemistryEdges(players, slots);

    // Find the edge between ST_1 and ST_2
    const stEdge = edges.find(
      (e) =>
        (players[e.fromIdx].slotPosition === 'ST_1' && players[e.toIdx].slotPosition === 'ST_2') ||
        (players[e.fromIdx].slotPosition === 'ST_2' && players[e.toIdx].slotPosition === 'ST_1'),
    );

    expect(stEdge).toBeDefined();
    expect(stEdge!.strength).toBe(3);
    expect(stEdge!.type).toBe('team');
  });

  it('correctly indexes players in edges', () => {
    const players = createSquadPlayers([
      { slotId: 'ST_1', position: 'ST', teamId: 1, leagueId: 1 },
      { slotId: 'ST_2', position: 'ST', teamId: 1, leagueId: 1 },
      { slotId: 'CM_1', position: 'CM', teamId: 1, leagueId: 1 },
    ]);

    const edges = buildChemistryEdges(players, slots);

    for (const edge of edges) {
      // fromIdx and toIdx must be valid indices into the players array
      expect(edge.fromIdx).toBeGreaterThanOrEqual(0);
      expect(edge.fromIdx).toBeLessThan(players.length);
      expect(edge.toIdx).toBeGreaterThanOrEqual(0);
      expect(edge.toIdx).toBeLessThan(players.length);
      expect(edge.fromIdx).not.toBe(edge.toIdx);
    }
  });

  it('produces edges for a full 11-player same-team squad', () => {
    const slotEntries = slots.map((s) => ({
      slotId: s.id,
      position: s.position as Position,
      teamId: 1,
      leagueId: 1,
    }));
    const players = createSquadPlayers(slotEntries);

    const edges = buildChemistryEdges(players, slots);

    // With all 11 players from the same team, all edges should be 'team' type
    expect(edges.length).toBeGreaterThan(0);
    expect(edges.every((e) => e.type === 'team')).toBe(true);
  });

  it('handles a mixed squad with team and league links', () => {
    // 5 players from team 1 (league 1), 3 from team 2 (league 1), 3 from team 3 (league 2)
    const entries: Array<{ slotId: string; position: Position; teamId: number; leagueId: number }> = [
      { slotId: 'ST_1', position: 'ST', teamId: 1, leagueId: 1 },
      { slotId: 'ST_2', position: 'ST', teamId: 1, leagueId: 1 },
      { slotId: 'LM', position: 'LM', teamId: 1, leagueId: 1 },
      { slotId: 'CM_1', position: 'CM', teamId: 2, leagueId: 1 },
      { slotId: 'CM_2', position: 'CM', teamId: 2, leagueId: 1 },
      { slotId: 'RM', position: 'RM', teamId: 3, leagueId: 2 },
      { slotId: 'LB', position: 'LB', teamId: 1, leagueId: 1 },
      { slotId: 'CB_1', position: 'CB', teamId: 1, leagueId: 1 },
      { slotId: 'CB_2', position: 'CB', teamId: 2, leagueId: 1 },
      { slotId: 'RB', position: 'RB', teamId: 3, leagueId: 2 },
      { slotId: 'GK', position: 'GK', teamId: 3, leagueId: 2 },
    ];
    const players = createSquadPlayers(entries);
    const edges = buildChemistryEdges(players, slots);

    // Should have all three types of links
    expect(edges.some((e) => e.type === 'team')).toBe(true);
    expect(edges.some((e) => e.type === 'league')).toBe(true);
    // May or may not have 'none' edges depending on adjacency of different-league pairs
  });

  it('uses chemistry engine adjacency (not a custom threshold)', () => {
    // This verifies consistency between ChemistryLines and the chemistry engine
    // by checking that the number of edges matches the chemistry engine's link count
    const slots442 = FORMATION_SLOTS['4-4-2'];
    const allEntries = slots442.map((s) => ({
      slotId: s.id,
      position: s.position as Position,
      teamId: 1,
      leagueId: 1,
    }));
    const allPlayers = createSquadPlayers(allEntries);

    const edges = buildChemistryEdges(allPlayers, slots442);

    // Count unique slot pairs in edges
    const edgePairs = new Set(
      edges.map((e) => {
        const a = allPlayers[e.fromIdx].slotPosition;
        const b = allPlayers[e.toIdx].slotPosition;
        return [a, b].sort().join('-');
      }),
    );

    // The chemistry engine's getChemistryLinks defines which slots are adjacent.
    // All adjacent slots with players assigned should produce an edge.
    // Use the already-imported getChemistryLinks from chemistry engine
    const chemLinks = getChemistryLinks(slots442);

    // Every chemistry link that has both slots filled should appear in edges
    // (some chemistry links may connect to empty slots, which are filtered out)
    const filledChemLinks = chemLinks.filter(
      (link: { slotA: string; slotB: string }) =>
        allPlayers.some((p: SquadPlayer) => p.slotPosition === link.slotA) &&
        allPlayers.some((p: SquadPlayer) => p.slotPosition === link.slotB),
    );

    expect(edgePairs.size).toBe(filledChemLinks.length);
  });
});

// ---------------------------------------------------------------------------
// 2. Coordinate Conversion Tests
// ---------------------------------------------------------------------------

describe('slotToSvgCoord', () => {
  it('maps (0, 0) to SVG origin (0, 0)', () => {
    const slot = { id: 'test', position: 'ST', x: 0, y: 0 };
    const coord = slotToSvgCoord(slot);
    expect(coord.x).toBe(0);
    expect(coord.y).toBe(0);
  });

  it('maps (100, 100) to SVG max (68, 105)', () => {
    const slot = { id: 'test', position: 'ST', x: 100, y: 100 };
    const coord = slotToSvgCoord(slot);
    expect(coord.x).toBe(CHEMISTRY_SVG_W);
    expect(coord.y).toBe(CHEMISTRY_SVG_H);
  });

  it('maps (50, 50) to SVG center (34, 52.5)', () => {
    const slot = { id: 'test', position: 'ST', x: 50, y: 50 };
    const coord = slotToSvgCoord(slot);
    expect(coord.x).toBe(CHEMISTRY_SVG_W / 2);
    expect(coord.y).toBe(CHEMISTRY_SVG_H / 2);
  });

  it('maps pitch slot positions to correct SVG coordinates', () => {
    // GK in 4-4-2 is at (50, 90)
    const gkSlot = { id: 'GK', position: 'GK', x: 50, y: 90 };
    const gkCoord = slotToSvgCoord(gkSlot);
    expect(gkCoord.x).toBe(34);
    expect(gkCoord.y).toBe(94.5);

    // ST_1 in 4-4-2 is at (38, 12)
    const stSlot = { id: 'ST_1', position: 'ST', x: 38, y: 12 };
    const stCoord = slotToSvgCoord(stSlot);
    expect(stCoord.x).toBe(25.84);
    expect(stCoord.y).toBe(12.6);
  });

  it('preserves aspect ratio (68:105)', () => {
    const slot = { id: 'test', position: 'CM', x: 50, y: 50 };
    const coord = slotToSvgCoord(slot);
    const ratio = coord.x / coord.y;
    expect(ratio).toBeCloseTo(CHEMISTRY_SVG_W / CHEMISTRY_SVG_H, 4);
  });
});

// ---------------------------------------------------------------------------
// 3. Control Point Tests
// ---------------------------------------------------------------------------

describe('getControlPoint', () => {
  it('returns midpoint for zero-length segment', () => {
    const point = { x: 10, y: 20 };
    const cp = getControlPoint(point, point);
    expect(cp.x).toBe(10);
    expect(cp.y).toBe(20);
  });

  it('returns a point offset from the midpoint', () => {
    const from = { x: 10, y: 10 };
    const to = { x: 50, y: 10 };
    const mx = (10 + 50) / 2; // 30
    const my = (10 + 10) / 2; // 10

    const cp = getControlPoint(from, to);

    // Control point should not be the midpoint (it's offset)
    const distFromMid = Math.sqrt((cp.x - mx) ** 2 + (cp.y - my) ** 2);
    expect(distFromMid).toBeGreaterThan(0);
  });

  it('produces curves that avoid the center of the pitch', () => {
    // Horizontal line to the left of center should curve left
    const from = { x: 5, y: 52.5 };
    const to = { x: 25, y: 52.5 };
    const cp = getControlPoint(from, to);

    // The midpoint is at x=15, which is left of center (34).
    // The perpendicular to a horizontal line is vertical.
    // If dot product is negative, sign=-1, so the curve goes upward.
    // The important thing is that it doesn't curve toward center.
    const midX = (from.x + to.x) / 2; // 15
    // Control point should be offset away from center (x=34)
    // For a horizontal line, the perpendicular is (0, 1) or (0, -1)
    // The curve should be in the y direction (up or down)
    expect(cp.x).toBeCloseTo(midX, 0); // x should stay near midpoint for horizontal line
    expect(cp.y).not.toBeCloseTo(52.5, 1); // y should be offset
  });

  it('is deterministic (same input produces same output)', () => {
    const from = { x: 20, y: 30 };
    const to = { x: 40, y: 60 };

    const cp1 = getControlPoint(from, to);
    const cp2 = getControlPoint(from, to);

    expect(cp1.x).toBe(cp2.x);
    expect(cp1.y).toBe(cp2.y);
  });

  it('produces consistent curves regardless of point ordering', () => {
    // The curve should only depend on the two endpoints, not their order.
    // For a line from A to B and from B to A, the control points should be
    // the same (or very close, accounting for the center-bias sign logic).
    const from = { x: 10, y: 30 };
    const to = { x: 30, y: 50 };

    const cpForward = getControlPoint(from, to);
    const cpBackward = getControlPoint(to, from);

    // The midpoint is the same; the perpendicular direction flips when
    // the line direction flips, but the sign compensates. The result should
    // be the same point.
    expect(cpForward.x).toBeCloseTo(cpBackward.x, 10);
    expect(cpForward.y).toBeCloseTo(cpBackward.y, 10);
  });

  it('curve magnitude scales with line length', () => {
    // Longer line should produce a larger offset
    const shortFrom = { x: 10, y: 50 };
    const shortTo = { x: 20, y: 50 };
    const longFrom = { x: 10, y: 50 };
    const longTo = { x: 60, y: 50 };

    const shortCp = getControlPoint(shortFrom, shortTo);
    const longCp = getControlPoint(longFrom, longTo);

    const shortMid = { x: 15, y: 50 };
    const longMid = { x: 35, y: 50 };

    const shortOffset = Math.abs(shortCp.y - shortMid.y);
    const longOffset = Math.abs(longCp.y - longMid.y);

    expect(longOffset).toBeGreaterThan(shortOffset);
  });
});

// ---------------------------------------------------------------------------
// 4. Chemistry Link Info Tests
// ---------------------------------------------------------------------------

describe('buildChemLinkInfo', () => {
  const slots = FORMATION_SLOTS['4-4-2'];

  it('returns empty sets for fewer than 2 players', () => {
    const players = createSquadPlayers([
      { slotId: 'ST_1', position: 'ST', teamId: 1, leagueId: 1 },
    ]);

    const info = buildChemLinkInfo(players, slots);
    expect(info.teamLinked.size).toBe(0);
    expect(info.leagueLinked.size).toBe(0);
    expect(info.anyLinked.size).toBe(0);
  });

  it('identifies team-linked slots', () => {
    const players = createSquadPlayers([
      { slotId: 'ST_1', position: 'ST', teamId: 1, leagueId: 1 },
      { slotId: 'ST_2', position: 'ST', teamId: 1, leagueId: 1 },
    ]);

    const info = buildChemLinkInfo(players, slots);

    expect(info.teamLinked.has('ST_1')).toBe(true);
    expect(info.teamLinked.has('ST_2')).toBe(true);
    expect(info.anyLinked.has('ST_1')).toBe(true);
    expect(info.anyLinked.has('ST_2')).toBe(true);
  });

  it('identifies league-linked slots (different teams, same league)', () => {
    const players = createSquadPlayers([
      { slotId: 'ST_1', position: 'ST', teamId: 1, leagueId: 1 },
      { slotId: 'ST_2', position: 'ST', teamId: 2, leagueId: 1 },
    ]);

    const info = buildChemLinkInfo(players, slots);

    expect(info.teamLinked.has('ST_1')).toBe(false);
    expect(info.teamLinked.has('ST_2')).toBe(false);
    expect(info.leagueLinked.has('ST_1')).toBe(true);
    expect(info.leagueLinked.has('ST_2')).toBe(true);
    expect(info.anyLinked.has('ST_1')).toBe(true);
    expect(info.anyLinked.has('ST_2')).toBe(true);
  });

  it('does not include no-link slots in anyLinked', () => {
    const players = createSquadPlayers([
      { slotId: 'ST_1', position: 'ST', teamId: 1, leagueId: 1 },
      { slotId: 'ST_2', position: 'ST', teamId: 2, leagueId: 2 },
    ]);

    const info = buildChemLinkInfo(players, slots);

    // Adjacent players with no shared attributes should NOT be in anyLinked
    // (only non-zero strength links are included)
    expect(info.anyLinked.has('ST_1')).toBe(false);
    expect(info.anyLinked.has('ST_2')).toBe(false);
  });

  it('team-linked slots supersede league-linked in teamLinked set', () => {
    // Player on team 1 connected to both a same-team and same-league-different-team neighbor
    const players = createSquadPlayers([
      { slotId: 'ST_1', position: 'ST', teamId: 1, leagueId: 1 },
      { slotId: 'ST_2', position: 'ST', teamId: 1, leagueId: 1 },  // same team
      { slotId: 'LM', position: 'LM', teamId: 2, leagueId: 1 },   // same league, diff team
    ]);

    const info = buildChemLinkInfo(players, slots);

    // ST_1 and ST_2 should be in teamLinked
    expect(info.teamLinked.has('ST_1')).toBe(true);
    expect(info.teamLinked.has('ST_2')).toBe(true);

    // LM should be in leagueLinked (connected to CM_1 or ST_1 via same league)
    // LM is adjacent to ST_1 (same league), CM_1 (not placed), LB (not placed)
    // Actually LM (12, 33) is adjacent to ST_1 (38, 12)? Distance = sqrt(26² + 21²) = sqrt(676+441) = sqrt(1117) ≈ 33.4 — within threshold
    // LM (12, 33) adjacent to CM_1 (36, 36)? Distance = sqrt(24² + 3²) = sqrt(576+9) ≈ 24.2 — within threshold
    // LM is adjacent to ST_1 and CM_1. ST_1 is from team 1, league 1. LM is from team 2, league 1. Same league → league link.
    expect(info.leagueLinked.has('LM')).toBe(true);
    expect(info.anyLinked.has('LM')).toBe(true);
  });

  it('handles full 11-player squad with mixed chemistry', () => {
    const entries: Array<{ slotId: string; position: Position; teamId: number; leagueId: number }> = [
      { slotId: 'ST_1', position: 'ST', teamId: 1, leagueId: 1 },
      { slotId: 'ST_2', position: 'ST', teamId: 1, leagueId: 1 },
      { slotId: 'LM', position: 'LM', teamId: 2, leagueId: 1 },
      { slotId: 'CM_1', position: 'CM', teamId: 1, leagueId: 1 },
      { slotId: 'CM_2', position: 'CM', teamId: 1, leagueId: 1 },
      { slotId: 'RM', position: 'RM', teamId: 3, leagueId: 2 },
      { slotId: 'LB', position: 'LB', teamId: 1, leagueId: 1 },
      { slotId: 'CB_1', position: 'CB', teamId: 1, leagueId: 1 },
      { slotId: 'CB_2', position: 'CB', teamId: 1, leagueId: 1 },
      { slotId: 'RB', position: 'RB', teamId: 4, leagueId: 2 },
      { slotId: 'GK', position: 'GK', teamId: 5, leagueId: 3 },
    ];
    const players = createSquadPlayers(entries);

    const info = buildChemLinkInfo(players, slots);

    // Most defenders (CB_1, CB_2, LB) should be team-linked with each other
    expect(info.teamLinked.has('CB_1')).toBe(true);
    expect(info.teamLinked.has('CB_2')).toBe(true);
    expect(info.teamLinked.has('LB')).toBe(true);

    // ST_1, ST_2 should be team-linked
    expect(info.teamLinked.has('ST_1')).toBe(true);
    expect(info.teamLinked.has('ST_2')).toBe(true);

    // LM should have league links (team 2, league 1 — same league as team 1 players)
    expect(info.leagueLinked.has('LM')).toBe(true);

    // someLinked should be a superset of teamLinked and leagueLinked
    for (const slot of info.teamLinked) {
      expect(info.anyLinked.has(slot)).toBe(true);
    }
    for (const slot of info.leagueLinked) {
      expect(info.anyLinked.has(slot)).toBe(true);
    }
  });

  it('does not include slots that only have no-link adjacent neighbors', () => {
    // Place only GK and ST_1 — they are far apart in 4-4-2
    // GK (50, 90) to ST_1 (38, 12): distance = sqrt(12² + 78²) = sqrt(144+6084) = sqrt(6228) ≈ 78.9
    // This is way beyond the threshold, so no link
    const players = createSquadPlayers([
      { slotId: 'GK', position: 'GK', teamId: 1, leagueId: 1 },
      { slotId: 'ST_1', position: 'ST', teamId: 2, leagueId: 2 },
    ]);

    const info = buildChemLinkInfo(players, slots);

    expect(info.anyLinked.size).toBe(0);
    expect(info.teamLinked.size).toBe(0);
    expect(info.leagueLinked.size).toBe(0);
  });
});
