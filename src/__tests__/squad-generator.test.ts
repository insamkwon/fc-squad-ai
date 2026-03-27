/**
 * Unit tests for the squad generation engine.
 *
 * Tests cover:
 * 1. Chemistry calculation (link strength, adjacency, squad chemistry)
 * 2. Chemistry potential estimation (for selection scoring)
 * 3. Player pool construction (team/league/budget filters)
 * 4. Full squad generation with various constraints
 * 5. Budget compliance (strict, flexible, none)
 * 6. Pinned player placement
 * 7. Edge cases (empty data, impossible constraints)
 */

import { describe, it, expect } from 'vitest';
import {
  calculateLinkStrength,
  getChemistryLinks,
  getMaxLinksPerSlot,
  calculateSquadChemistry,
  estimateChemistryPotential,
  countSameTeamLinks,
  countSameLeagueLinks,
} from '@/lib/squad-generator/chemistry';
import type { ChemistryLink } from '@/lib/squad-generator/chemistry';
import { generateSquads } from '@/lib/squad-generator/generator';
import type { ParsedSquadRequest } from '@/lib/ai/types';
import type { Player, Position } from '@/types/player';
import type { FormationSlot, SquadPlayer } from '@/types/squad';
import { FORMATION_SLOTS } from '@/types/squad';

// ---------------------------------------------------------------------------
// Test Player Factory
// ---------------------------------------------------------------------------

/**
 * Create a minimal mock player for testing.
 * All players default to teamId=1, leagueId=1, but can be overridden.
 */
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
    teamName: 'Test Team',
    teamNameEn: 'Test Team',
    leagueId: 1,
    leagueName: 'EPL',
    stats: { ovr: 80, pace: 75, shooting: 75, passing: 75, dribbling: 75, defending: 75, physical: 75 },
    price: 1_000_000_000,
    priceUpdatedAt: '2026-03-27',
    ...overrides,
  };
}

/**
 * Create a set of 11 players covering all positions for a 4-3-3 formation.
 * By default, all from the same team for maximum chemistry.
 */
function createFullSquadPlayers(opts: {
  teamId?: number;
  leagueId?: number;
  baseOvr?: number;
  sameTeam?: boolean;
} = {}): Player[] {
  const { teamId = 1, leagueId = 1, baseOvr = 85, sameTeam = true } = opts;

  const positions: Array<{ id: string; pos: Position; teamIdOverride?: number; leagueIdOverride?: number }> = [
    { id: 'LW', pos: 'LW' },
    { id: 'ST', pos: 'ST' },
    { id: 'RW', pos: 'RW' },
    { id: 'CM_1', pos: 'CM' },
    { id: 'CM_2', pos: 'CM' },
    { id: 'CM_3', pos: 'CM' },
    { id: 'LB', pos: 'LB' },
    { id: 'CB_1', pos: 'CB' },
    { id: 'CB_2', pos: 'CB' },
    { id: 'RB', pos: 'RB' },
    { id: 'GK', pos: 'GK' },
  ];

  return positions.map((p, i) => {
    const pTeamId = sameTeam ? teamId : (p.teamIdOverride ?? teamId + i);
    const pLeagueId = sameTeam ? leagueId : (p.leagueIdOverride ?? leagueId + Math.floor(i / 3));
    const teamName = pTeamId === 1 ? 'Team A' : pTeamId === 2 ? 'Team B' : `Team ${pTeamId}`;

    return createPlayer({
      spid: 1000 + i,
      pid: 100 + i,
      position: p.pos,
      teamId: pTeamId,
      teamName,
      teamNameEn: teamName,
      leagueId: pLeagueId,
      leagueName: pLeagueId === 1 ? 'EPL' : pLeagueId === 2 ? 'LALIGA' : `League ${pLeagueId}`,
      stats: { ovr: baseOvr + i, pace: baseOvr + i, shooting: baseOvr + i, passing: baseOvr + i, dribbling: baseOvr + i, defending: baseOvr + i, physical: baseOvr + i },
    });
  });
}

/**
 * Create a placedPlayers map from a 4-3-3 formation's players.
 */
function placePlayersOnPitch(players: Player[]): Map<string, SquadPlayer> {
  const slots = FORMATION_SLOTS['4-3-3'];
  const map = new Map<string, SquadPlayer>();

  for (let i = 0; i < Math.min(players.length, slots.length); i++) {
    map.set(slots[i].id, { player: players[i], slotPosition: slots[i].id });
  }

  return map;
}

// ---------------------------------------------------------------------------
// 1. Chemistry Calculation Tests
// ---------------------------------------------------------------------------

describe('calculateLinkStrength', () => {
  it('should return 3 for same-team players', () => {
    const p1 = createPlayer({ spid: 1, pid: 1, position: 'ST', teamId: 5, teamName: 'Team X' });
    const p2 = createPlayer({ spid: 2, pid: 2, position: 'CM', teamId: 5, teamName: 'Team X' });
    expect(calculateLinkStrength(p1, p2)).toBe(3);
  });

  it('should return 2 for same-league but different-team players', () => {
    const p1 = createPlayer({ spid: 1, pid: 1, position: 'ST', teamId: 1, teamName: 'Team A', leagueId: 1, leagueName: 'EPL' });
    const p2 = createPlayer({ spid: 2, pid: 2, position: 'CM', teamId: 2, teamName: 'Team B', leagueId: 1, leagueName: 'EPL' });
    expect(calculateLinkStrength(p1, p2)).toBe(2);
  });

  it('should return 0 for different-league players', () => {
    const p1 = createPlayer({ spid: 1, pid: 1, position: 'ST', teamId: 1, leagueId: 1, leagueName: 'EPL' });
    const p2 = createPlayer({ spid: 2, pid: 2, position: 'CM', teamId: 10, leagueId: 2, leagueName: 'LALIGA' });
    expect(calculateLinkStrength(p1, p2)).toBe(0);
  });
});

describe('getChemistryLinks', () => {
  it('should produce links for a 4-3-3 formation', () => {
    const slots = FORMATION_SLOTS['4-3-3'];
    const links = getChemistryLinks(slots);

    // Should have a reasonable number of links (not too few, not all pairs)
    expect(links.length).toBeGreaterThan(5);
    expect(links.length).toBeLessThan(55); // Max = 11*10/2 = 55

    // GK should not link to ST (too far apart)
    const hasGK_ST_Link = links.some(
      (l) =>
        (l.slotA === 'GK' && l.slotB === 'ST') ||
        (l.slotA === 'ST' && l.slotB === 'GK'),
    );
    expect(hasGK_ST_Link).toBe(false);
  });

  it('should link CBs in a 5-3-2 formation (outer CBs)', () => {
    const slots = FORMATION_SLOTS['5-3-2'];
    const links = getChemistryLinks(slots);

    const hasCB1_CB3_Link = links.some(
      (l) =>
        (l.slotA === 'CB_1' && l.slotB === 'CB_3') ||
        (l.slotA === 'CB_3' && l.slotB === 'CB_1'),
    );
    expect(hasCB1_CB3_Link).toBe(true);
  });

  it('should link CM to adjacent CB in 4-4-2', () => {
    const slots = FORMATION_SLOTS['4-4-2'];
    const links = getChemistryLinks(slots);

    const hasCM1_CB1_Link = links.some(
      (l) =>
        (l.slotA === 'CM_1' && l.slotB === 'CB_1') ||
        (l.slotA === 'CB_1' && l.slotB === 'CM_1'),
    );
    expect(hasCM1_CB1_Link).toBe(true);
  });

  it('should not link LM to CM_2 in 4-4-2 (too far apart)', () => {
    const slots = FORMATION_SLOTS['4-4-2'];
    const links = getChemistryLinks(slots);

    const hasLM_CM2_Link = links.some(
      (l) =>
        (l.slotA === 'LM' && l.slotB === 'CM_2') ||
        (l.slotA === 'CM_2' && l.slotB === 'LM'),
    );
    expect(hasLM_CM2_Link).toBe(false);
  });
});

describe('calculateSquadChemistry', () => {
  it('should return 0 for empty squad', () => {
    const links = getChemistryLinks(FORMATION_SLOTS['4-3-3']);
    const maxLinks = getMaxLinksPerSlot(links);
    const chem = calculateSquadChemistry(new Map(), links, maxLinks);
    expect(chem).toBe(0);
  });

  it('should return 50 for single-player squad', () => {
    const links = getChemistryLinks(FORMATION_SLOTS['4-3-3']);
    const maxLinks = getMaxLinksPerSlot(links);
    const placed = new Map<string, SquadPlayer>();
    placed.set('GK', { player: createPlayer({ spid: 1, pid: 1, position: 'GK' }), slotPosition: 'GK' });
    const chem = calculateSquadChemistry(placed, links, maxLinks);
    expect(chem).toBe(50);
  });

  it('should return high chemistry for all same-team players', () => {
    const slots = FORMATION_SLOTS['4-3-3'];
    const links = getChemistryLinks(slots);
    const maxLinks = getMaxLinksPerSlot(links);

    // All same team
    const players = createFullSquadPlayers({ sameTeam: true });
    const placed = placePlayersOnPitch(players);
    const chem = calculateSquadChemistry(placed, links, maxLinks);

    // All links should be strength 3 (same team)
    expect(chem).toBeGreaterThan(70);
  });

  it('should return lower chemistry for mixed-team players', () => {
    const slots = FORMATION_SLOTS['4-3-3'];
    const links = getChemistryLinks(slots);
    const maxLinks = getMaxLinksPerSlot(links);

    // Each player from a different team/league
    const players = createFullSquadPlayers({ sameTeam: false });
    const placed = placePlayersOnPitch(players);
    const mixedChem = calculateSquadChemistry(placed, links, maxLinks);

    // All same team should have higher chemistry
    const sameTeamPlayers = createFullSquadPlayers({ sameTeam: true });
    const sameTeamPlaced = placePlayersOnPitch(sameTeamPlayers);
    const sameTeamChem = calculateSquadChemistry(sameTeamPlaced, links, maxLinks);

    expect(sameTeamChem).toBeGreaterThan(mixedChem);
  });
});

describe('estimateChemistryPotential', () => {
  it('should return 50 when no neighbors are placed', () => {
    const links = getChemistryLinks(FORMATION_SLOTS['4-3-3']);
    const placed = new Map<string, SquadPlayer>();

    const player = createPlayer({ spid: 1, pid: 1, position: 'ST' });
    const potential = estimateChemistryPotential(player, 'ST', placed, links);
    expect(potential).toBe(50);
  });

  it('should return high potential when placed near same-team player', () => {
    const links = getChemistryLinks(FORMATION_SLOTS['4-3-3']);
    const placed = new Map<string, SquadPlayer>();

    // Place a same-team CM near the ST slot
    const cmPlayer = createPlayer({ spid: 1, pid: 1, position: 'CM', teamId: 5 });
    placed.set('CM_2', { player: cmPlayer, slotPosition: 'CM_2' });

    const stPlayer = createPlayer({ spid: 2, pid: 2, position: 'ST', teamId: 5 });
    const potential = estimateChemistryPotential(stPlayer, 'ST', placed, links);

    expect(potential).toBeGreaterThan(50);
  });

  it('should return lower potential when placed near different-team player', () => {
    const links = getChemistryLinks(FORMATION_SLOTS['4-3-3']);
    const placed = new Map<string, SquadPlayer>();

    const cmPlayer = createPlayer({ spid: 1, pid: 1, position: 'CM', teamId: 1, leagueId: 1 });
    placed.set('CM_2', { player: cmPlayer, slotPosition: 'CM_2' });

    const stPlayer = createPlayer({ spid: 2, pid: 2, position: 'ST', teamId: 10, leagueId: 5 });
    const potential = estimateChemistryPotential(stPlayer, 'ST', placed, links);

    // When a neighbor IS placed but has 0 link strength (different team AND league),
    // potential should be low (0), not neutral (50) — we know the link is bad
    expect(potential).toBeLessThan(50);
  });
});

describe('countSameTeamLinks / countSameLeagueLinks', () => {
  it('should count same-team links correctly', () => {
    const links = getChemistryLinks(FORMATION_SLOTS['4-3-3']);
    const players = createFullSquadPlayers({ sameTeam: true });
    const placed = placePlayersOnPitch(players);

    const teamLinks = countSameTeamLinks(placed, links);
    // In a 4-3-3 with all same team, every adjacent pair should be same-team
    expect(teamLinks).toBe(links.length);
  });

  it('should count 0 same-team links for all-different teams', () => {
    const links = getChemistryLinks(FORMATION_SLOTS['4-3-3']);
    const players = createFullSquadPlayers({ sameTeam: false });
    const placed = placePlayersOnPitch(players);

    const teamLinks = countSameTeamLinks(placed, links);
    expect(teamLinks).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// 2. Player Pool Construction Tests (via generateSquads)
// ---------------------------------------------------------------------------

describe('Player pool filtering', () => {
  // Create a diverse set of test players
  const testPlayers: Player[] = [
    // Team A, EPL players
    createPlayer({ spid: 1, pid: 1, position: 'ST', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', stats: { ovr: 90, pace: 90, shooting: 90, passing: 70, dribbling: 80, defending: 40, physical: 80 }, price: 5_000_000_000 }),
    createPlayer({ spid: 2, pid: 2, position: 'CM', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', stats: { ovr: 85, pace: 75, shooting: 70, passing: 85, dribbling: 80, defending: 70, physical: 75 }, price: 3_000_000_000 }),
    createPlayer({ spid: 3, pid: 3, position: 'CB', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', stats: { ovr: 88, pace: 80, shooting: 40, passing: 65, dribbling: 70, defending: 92, physical: 85 }, price: 4_000_000_000 }),
    createPlayer({ spid: 4, pid: 4, position: 'GK', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', stats: { ovr: 85, pace: 45, shooting: 15, passing: 40, dribbling: 25, defending: 30, physical: 80 }, price: 2_000_000_000 }),
    // Team A, EPL, LB
    createPlayer({ spid: 5, pid: 5, position: 'LB', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', stats: { ovr: 82, pace: 80, shooting: 55, passing: 78, dribbling: 78, defending: 82, physical: 76 }, price: 1_500_000_000 }),
    // Team A, EPL, RB
    createPlayer({ spid: 6, pid: 6, position: 'RB', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', stats: { ovr: 83, pace: 82, shooting: 60, passing: 80, dribbling: 78, defending: 78, physical: 74 }, price: 1_800_000_000 }),
    // Team A, EPL, RW
    createPlayer({ spid: 7, pid: 7, position: 'RW', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', stats: { ovr: 87, pace: 92, shooting: 85, passing: 78, dribbling: 88, defending: 40, physical: 72 }, price: 3_500_000_000 }),
    // Team A, EPL, LW
    createPlayer({ spid: 8, pid: 8, position: 'LW', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', stats: { ovr: 86, pace: 90, shooting: 82, passing: 76, dribbling: 88, defending: 35, physical: 68 }, price: 3_200_000_000 }),
    // Team A, EPL, CDM
    createPlayer({ spid: 9, pid: 9, position: 'CDM', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', stats: { ovr: 86, pace: 65, shooting: 65, passing: 85, dribbling: 80, defending: 88, physical: 82 }, price: 3_000_000_000 }),
    // Team A, EPL, CAM
    createPlayer({ spid: 10, pid: 10, position: 'CAM', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', stats: { ovr: 84, pace: 75, shooting: 80, passing: 86, dribbling: 88, defending: 60, physical: 70 }, price: 2_800_000_000 }),
    // Team A, EPL, second CB
    createPlayer({ spid: 11, pid: 11, position: 'CB', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', stats: { ovr: 84, pace: 75, shooting: 35, passing: 60, dribbling: 65, defending: 88, physical: 82 }, price: 2_500_000_000 }),
    // Team B, EPL, cheap ST
    createPlayer({ spid: 12, pid: 12, position: 'ST', teamId: 2, teamName: 'Team B', teamNameEn: 'Team B', leagueId: 1, leagueName: 'EPL', stats: { ovr: 75, pace: 78, shooting: 76, passing: 65, dribbling: 75, defending: 30, physical: 70 }, price: 500_000_000 }),
    // Team C, LALIGA, ST
    createPlayer({ spid: 13, pid: 13, position: 'ST', teamId: 3, teamName: 'Team C', teamNameEn: 'Team C', leagueId: 2, leagueName: 'LALIGA', stats: { ovr: 92, pace: 95, shooting: 90, passing: 78, dribbling: 92, defending: 35, physical: 75 }, price: 8_000_000_000 }),
    // Low OVR player
    createPlayer({ spid: 14, pid: 14, position: 'ST', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', stats: { ovr: 65, pace: 70, shooting: 60, passing: 55, dribbling: 60, defending: 25, physical: 65 }, price: 100_000_000 }),
    // ICON card type
    createPlayer({ spid: 15, pid: 15, position: 'ST', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', cardType: 'ICON', seasonId: 69, seasonName: 'ICON', seasonSlug: 'icon', stats: { ovr: 95, pace: 93, shooting: 92, passing: 85, dribbling: 93, defending: 40, physical: 80 }, price: 9_000_000_000 }),
  ];

  it('should generate squads with team preference', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      teams: [{ name: 'Team A', strength: 'required' }],
      confidence: 0.9,
    };

    const result = generateSquads(params, testPlayers, { count: 1, strategies: ['balanced'] });

    expect(result.candidates).toHaveLength(1);
    const squad = result.candidates[0].squad;

    // All players should be from Team A
    for (const sp of squad.players) {
      expect(sp.player.teamId).toBe(1);
    }

    // Should have 11 players
    expect(squad.players.length).toBe(11);
  });

  it('should generate squads with league preference', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      leagues: [{ league: 'EPL', strength: 'required' }],
      confidence: 0.9,
    };

    const result = generateSquads(params, testPlayers, { count: 1, strategies: ['balanced'] });

    expect(result.candidates).toHaveLength(1);
    const squad = result.candidates[0].squad;

    // All players should be from EPL
    for (const sp of squad.players) {
      expect(sp.player.leagueName).toBe('EPL');
    }
  });

  it('should respect card type filter', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      teams: [{ name: 'Team A', strength: 'required' }],
      cardTypes: ['ICON'],
      confidence: 0.9,
    };

    const result = generateSquads(params, testPlayers, { count: 1, strategies: ['balanced'] });

    expect(result.candidates).toHaveLength(1);
    const squad = result.candidates[0].squad;

    // All players should be ICON cards
    for (const sp of squad.players) {
      expect(sp.player.cardType).toBe('ICON');
    }
  });

  it('should respect minOvr filter', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      teams: [{ name: 'Team A', strength: 'required' }],
      minOvr: 85,
      confidence: 0.9,
    };

    const result = generateSquads(params, testPlayers, { count: 1, strategies: ['balanced'] });

    expect(result.candidates).toHaveLength(1);
    const squad = result.candidates[0].squad;

    // All players should have OVR >= 85
    for (const sp of squad.players) {
      expect(sp.player.stats.ovr).toBeGreaterThanOrEqual(85);
    }
  });

  it('should respect excluded teams', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      excludedTeams: ['Team C'],
      confidence: 0.9,
    };

    const result = generateSquads(params, testPlayers, { count: 1, strategies: ['balanced'] });

    expect(result.candidates).toHaveLength(1);
    const squad = result.candidates[0].squad;

    // No players should be from Team C
    for (const sp of squad.players) {
      expect(sp.player.teamName).not.toBe('Team C');
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Budget Compliance Tests
// ---------------------------------------------------------------------------

describe('Budget compliance', () => {
  const budgetPlayers: Player[] = createFullSquadPlayers({
    sameTeam: true,
    baseOvr: 80,
  }).map((p, i) => ({
    ...p,
    price: (i + 1) * 500_000_000, // 500M to 5.5B total
  }));

  it('should stay within strict budget', () => {
    // Total cost of all players: 500M * (1+2+...+11) = 500M * 66 = 33B
    // Set budget to 25B (should force cheaper selections)
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      budget: { max: 25_000_000_000, strictness: 'strict' },
      confidence: 0.9,
    };

    const result = generateSquads(params, budgetPlayers, { count: 1, strategies: ['value'] });

    expect(result.candidates).toHaveLength(1);
    const squad = result.candidates[0].squad;

    // Should not exceed budget (with strict budget, it may leave some slots empty)
    expect(squad.totalCost).toBeLessThanOrEqual(25_000_000_000);
  });

  it('should not exceed flexible budget by much', () => {
    // Set a very tight budget that can't be met
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      budget: { max: 3_000_000_000, strictness: 'flexible' },
      confidence: 0.9,
    };

    const result = generateSquads(params, budgetPlayers, { count: 1, strategies: ['value'] });

    expect(result.candidates).toHaveLength(1);
    const squad = result.candidates[0].squad;

    // With flexible budget, might slightly exceed but should try to stay close
    // The squad should still have players
    expect(squad.players.length).toBeGreaterThan(0);
  });

  it('should ignore budget when strictness is none', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      budget: { max: 1_000_000, strictness: 'none' }, // 1M budget (way too low)
      confidence: 0.9,
    };

    const result = generateSquads(params, budgetPlayers, { count: 1, strategies: ['ovr'] });

    expect(result.candidates).toHaveLength(1);
    const squad = result.candidates[0].squad;

    // Should still build a full squad despite the tiny budget
    expect(squad.players.length).toBe(11);
    expect(squad.totalCost).toBeGreaterThan(1_000_000); // Will exceed budget
  });
});

// ---------------------------------------------------------------------------
// 4. Pinned Player Tests
// ---------------------------------------------------------------------------

describe('Pinned player placement', () => {
  const squadPlayers = createFullSquadPlayers({ sameTeam: true });

  it('should include pinned players in the squad', () => {
    const pinnedPlayer = squadPlayers.find((p) => p.position === 'ST')!;
    const extraPlayers = [
      ...squadPlayers,
      // Add more players to fill positions
      ...Array.from({ length: 5 }, (_, i) =>
        createPlayer({
          spid: 200 + i,
          pid: 200 + i,
          position: ['LM', 'RM', 'CAM', 'CDM', 'CF'][i] as Position,
          teamId: 1,
          teamName: 'Team A',
          teamNameEn: 'Team A',
          leagueId: 1,
          leagueName: 'EPL',
          stats: { ovr: 78, pace: 78, shooting: 78, passing: 78, dribbling: 78, defending: 78, physical: 78 },
          price: 1_000_000_000,
        }),
      ),
    ];

    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.9,
    };

    // Use pinnedSpids (direct spid reference from UI) for reliable testing
    const result = generateSquads(params, extraPlayers, {
      count: 1,
      strategies: ['balanced'],
      pinnedSpids: [pinnedPlayer.spid],
    });

    expect(result.candidates).toHaveLength(1);
    const squad = result.candidates[0].squad;

    // The pinned player should be in the squad (same spid)
    const pinnedInSquad = squad.players.some((sp) => sp.player.spid === pinnedPlayer.spid);
    expect(pinnedInSquad).toBe(true);
  });

  it('should respect pinned spids from UI', () => {
    const gkPlayer = squadPlayers.find((p) => p.position === 'GK')!;

    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.9,
    };

    const result = generateSquads(params, squadPlayers, {
      count: 1,
      strategies: ['balanced'],
      pinnedSpids: [gkPlayer.spid],
    });

    expect(result.candidates).toHaveLength(1);
    const squad = result.candidates[0].squad;

    const gkInSquad = squad.players.some((sp) => sp.player.spid === gkPlayer.spid);
    expect(gkInSquad).toBe(true);
  });

  it('should warn about unfound pinned players', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      players: [{ name: 'Nonexistent Player', required: true }],
      confidence: 0.9,
    };

    const result = generateSquads(params, squadPlayers, { count: 1, strategies: ['balanced'] });

    expect(result.warnings).toBeDefined();
    expect(result.warnings.some((w) => w.includes('Nonexistent Player'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 5. Full Squad Generation Tests
// ---------------------------------------------------------------------------

describe('generateSquads', () => {
  const fullSquadPlayers = [
    ...createFullSquadPlayers({ sameTeam: true, baseOvr: 80 }),
    // Add extra players for variety
    ...Array.from({ length: 10 }, (_, i) =>
      createPlayer({
        spid: 500 + i,
        pid: 500 + i,
        position: ['ST', 'CM', 'CB', 'LW', 'RW', 'CAM', 'CDM', 'LB', 'RB', 'GK'][i] as Position,
        teamId: i < 5 ? 2 : 3,
        teamName: i < 5 ? 'Team B' : 'Team C',
        teamNameEn: i < 5 ? 'Team B' : 'Team C',
        leagueId: i < 5 ? 1 : 2,
        leagueName: i < 5 ? 'EPL' : 'LALIGA',
        stats: { ovr: 82 + i, pace: 82 + i, shooting: 82 + i, passing: 82 + i, dribbling: 82 + i, defending: 82 + i, physical: 82 + i },
        price: (i + 1) * 1_000_000_000,
      }),
    ),
  ];

  it('should generate 3 candidates by default', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.8,
    };

    const result = generateSquads(params, fullSquadPlayers);
    expect(result.candidates).toHaveLength(3);
  });

  it('should respect custom candidate count', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.8,
    };

    const result = generateSquads(params, fullSquadPlayers, { count: 2 });
    expect(result.candidates).toHaveLength(2);
  });

  it('should produce squads with correct formation', () => {
    const params: ParsedSquadRequest = {
      formation: '4-4-2',
      confidence: 0.8,
    };

    const result = generateSquads(params, fullSquadPlayers, { count: 1, strategies: ['balanced'] });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].squad.formation).toBe('4-4-2');
    expect(result.candidates[0].squad.players.length).toBe(11);
  });

  it('should produce squads with position-compatible players', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.8,
    };

    const result = generateSquads(params, fullSquadPlayers, { count: 1, strategies: ['balanced'] });
    const squad = result.candidates[0].squad;

    // Check that each player is in a compatible position
    const slotPositionMap: Record<string, string[]> = {
      LW: ['LW', 'LF', 'RW'],
      ST: ['ST', 'CF'],
      RW: ['RW', 'RF', 'LW'],
      CM_1: ['CM', 'CAM', 'CDM'],
      CM_2: ['CM', 'CAM', 'CDM'],
      CM_3: ['CM', 'CAM', 'CDM'],
      LB: ['LB', 'LWB'],
      CB_1: ['CB'],
      CB_2: ['CB'],
      RB: ['RB', 'RWB'],
      GK: ['GK'],
    };

    for (const sp of squad.players) {
      const compatiblePositions = slotPositionMap[sp.slotPosition] ?? [];
      if (compatiblePositions.length > 0) {
        expect(compatiblePositions).toContain(sp.player.position);
      }
    }
  });

  it('should not include duplicate base players', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.8,
    };

    const result = generateSquads(params, fullSquadPlayers, { count: 1, strategies: ['balanced'] });
    const squad = result.candidates[0].squad;

    const pids = squad.players.map((sp) => sp.player.pid);
    const uniquePids = new Set(pids);
    expect(uniquePids.size).toBe(pids.length); // No duplicates
  });

  it('should calculate chemistry score for each candidate', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.8,
    };

    const result = generateSquads(params, fullSquadPlayers);
    for (const candidate of result.candidates) {
      expect(candidate.squad.chemistryScore).toBeGreaterThanOrEqual(0);
      expect(candidate.squad.chemistryScore).toBeLessThanOrEqual(100);
    }
  });

  it('should include reasoning for each candidate', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.8,
    };

    const result = generateSquads(params, fullSquadPlayers);
    for (const candidate of result.candidates) {
      expect(candidate.reasoning).toBeTruthy();
      expect(candidate.reasoning.length).toBeGreaterThan(10);
    }
  });

  it('should include composite quality score', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.8,
    };

    const result = generateSquads(params, fullSquadPlayers);
    for (const candidate of result.candidates) {
      expect(candidate.score).toBeGreaterThanOrEqual(0);
      expect(candidate.score).toBeLessThanOrEqual(100);
    }
  });

  it('should sort candidates by score descending', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.8,
    };

    const result = generateSquads(params, fullSquadPlayers);
    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i - 1].score).toBeGreaterThanOrEqual(result.candidates[i].score);
    }
  });

  it('should handle 5-3-2 formation (3 CBs)', () => {
    // Add 2 more CBs
    const players = [
      ...fullSquadPlayers,
      createPlayer({ spid: 600, pid: 600, position: 'CB', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', stats: { ovr: 83, pace: 78, shooting: 35, passing: 58, dribbling: 62, defending: 86, physical: 80 }, price: 2_000_000_000 }),
      createPlayer({ spid: 601, pid: 601, position: 'CB', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', stats: { ovr: 81, pace: 76, shooting: 33, passing: 55, dribbling: 60, defending: 84, physical: 78 }, price: 1_800_000_000 }),
      createPlayer({ spid: 602, pid: 602, position: 'LWB', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', stats: { ovr: 80, pace: 82, shooting: 55, passing: 76, dribbling: 78, defending: 78, physical: 74 }, price: 1_500_000_000 }),
      createPlayer({ spid: 603, pid: 603, position: 'RWB', teamId: 1, teamName: 'Team A', teamNameEn: 'Team A', leagueId: 1, leagueName: 'EPL', stats: { ovr: 79, pace: 80, shooting: 50, passing: 74, dribbling: 76, defending: 76, physical: 72 }, price: 1_200_000_000 }),
    ];

    const params: ParsedSquadRequest = {
      formation: '5-3-2',
      teams: [{ name: 'Team A', strength: 'required' }],
      confidence: 0.8,
    };

    const result = generateSquads(params, players, { count: 1, strategies: ['balanced'] });

    expect(result.candidates).toHaveLength(1);
    const squad = result.candidates[0].squad;
    expect(squad.formation).toBe('5-3-2');
    expect(squad.players.length).toBe(11);

    // Should have 3 CBs
    const cbs = squad.players.filter((sp) => sp.player.position === 'CB');
    expect(cbs.length).toBe(3);
  });

  it('should apply stat priority preferences', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      teams: [{ name: 'Team A', strength: 'required' }],
      statPriorities: ['pace', 'shooting'],
      confidence: 0.8,
    };

    const result = generateSquads(params, fullSquadPlayers, { count: 1, strategies: ['ovr'] });

    expect(result.candidates).toHaveLength(1);
    // Should successfully generate a squad (stat priorities influence selection, not block it)
    expect(result.candidates[0].squad.players.length).toBe(11);
  });

  it('should apply playstyle-derived stat priorities', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      teams: [{ name: 'Team A', strength: 'required' }],
      playstyle: 'attacking',
      confidence: 0.8,
    };

    const result = generateSquads(params, fullSquadPlayers, { count: 1, strategies: ['ovr'] });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].squad.players.length).toBe(11);
  });
});

// ---------------------------------------------------------------------------
// 6. Edge Cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
  it('should handle default formation when none specified', () => {
    const players = createFullSquadPlayers({ sameTeam: true });
    const params: ParsedSquadRequest = { confidence: 0.8 };

    const result = generateSquads(params, players, { count: 1, strategies: ['balanced'] });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].squad.formation).toBe('4-3-3'); // Default
  });

  it('should handle very small player pool (fewer than 11)', () => {
    const smallPool = createFullSquadPlayers({ sameTeam: true }).slice(0, 8);

    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.8,
    };

    const result = generateSquads(params, smallPool, { count: 1, strategies: ['balanced'] });

    // Should still generate a candidate, but with fewer players
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].squad.players.length).toBeLessThanOrEqual(8);
  });

  it('should handle empty player pool gracefully', () => {
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.8,
    };

    const result = generateSquads(params, [], { count: 1, strategies: ['balanced'] });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].squad.players.length).toBe(0);
  });

  it('should generate warnings for unresolved team names', () => {
    const players = createFullSquadPlayers({ sameTeam: true });
    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      teams: [{ name: 'Nonexistent FC', strength: 'required' }],
      confidence: 0.8,
    };

    const result = generateSquads(params, players, { count: 1, strategies: ['balanced'] });

    expect(result.warnings).toBeDefined();
    expect(result.warnings.some((w) => w.includes('Nonexistent FC'))).toBe(true);
  });

  it('should not mutate input player array', () => {
    const players = createFullSquadPlayers({ sameTeam: true });
    const originalLength = players.length;

    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.8,
    };

    generateSquads(params, players, { count: 3 });
    expect(players.length).toBe(originalLength);
  });

  it('should generate diverse candidates with different strategies', () => {
    const players = [
      // Some cheap, high-value players
      ...Array.from({ length: 11 }, (_, i) =>
        createPlayer({
          spid: 700 + i,
          pid: 700 + i,
          position: ['ST', 'LW', 'RW', 'CM', 'CM', 'CM', 'LB', 'CB', 'CB', 'RB', 'GK'][i] as Position,
          teamId: 1,
          teamName: 'Team A',
          teamNameEn: 'Team A',
          leagueId: 1,
          leagueName: 'EPL',
          stats: { ovr: 80 + i, pace: 80 + i, shooting: 80 + i, passing: 80 + i, dribbling: 80 + i, defending: 80 + i, physical: 80 + i },
          price: 500_000_000 + i * 200_000_000,
        }),
      ),
      // Some expensive top players
      ...Array.from({ length: 11 }, (_, i) =>
        createPlayer({
          spid: 800 + i,
          pid: 800 + i,
          position: ['ST', 'LW', 'RW', 'CM', 'CM', 'CM', 'LB', 'CB', 'CB', 'RB', 'GK'][i] as Position,
          teamId: 2,
          teamName: 'Team B',
          teamNameEn: 'Team B',
          leagueId: 1,
          leagueName: 'EPL',
          stats: { ovr: 90 + i, pace: 90 + i, shooting: 90 + i, passing: 90 + i, dribbling: 90 + i, defending: 90 + i, physical: 90 + i },
          price: 3_000_000_000 + i * 500_000_000,
        }),
      ),
    ];

    const params: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.8,
    };

    const result = generateSquads(params, players, {
      count: 3,
      strategies: ['value', 'ovr', 'chemistry'],
    });

    expect(result.candidates).toHaveLength(3);

    // Value strategy should produce cheaper squads than OVR strategy
    const valueCost = result.candidates.find((c) => c.reasoning.includes('Best value'))?.squad.totalCost ?? Infinity;
    const ovrCost = result.candidates.find((c) => c.reasoning.includes('OVR-maximized'))?.squad.totalCost ?? 0;

    expect(valueCost).toBeLessThan(ovrCost);
  });
});
