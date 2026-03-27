/**
 * Unit tests for the synergy analysis utilities.
 *
 * Tests cover:
 * 1. buildSynergyAnalysis with full same-team squad
 * 2. buildSynergyAnalysis with mixed teams/leagues
 * 3. Per-player connection details
 * 4. Team and league distribution
 * 5. Empty edge cases
 * 6. getLeagueColor utility
 */

import { describe, it, expect } from 'vitest';
import {
  buildSynergyAnalysis,
  getLeagueColor,
} from '@/lib/synergy-analysis';
import type { Player, Position } from '@/types/player';
import type { SquadPlayer, FormationSlot } from '@/types/squad';
import { FORMATION_SLOTS } from '@/types/squad';

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

/** Create 11 SquadPlayer objects for a 4-3-3 formation */
function createSquadPlayers(opts: {
  teamId?: number;
  leagueId?: number;
  teamName?: string;
  teamNameEn?: string;
  leagueName?: string;
} = {}): SquadPlayer[] {
  const slots: FormationSlot[] = FORMATION_SLOTS['4-3-3'];
  const {
    teamId = 1,
    leagueId = 1,
    teamName = 'Man City',
    teamNameEn = 'Man City',
    leagueName = 'EPL',
  } = opts;

  return slots.map((slot, i) => ({
    player: createPlayer({
      spid: 1000 + i,
      pid: 100 + i,
      position: slot.position as Position,
      teamId,
      teamName,
      teamNameEn,
      leagueId,
      leagueName,
    }),
    slotPosition: slot.id,
  }));
}

/** Create a mixed squad with some same-team and some same-league players */
function createMixedSquad(): SquadPlayer[] {
  const slots: FormationSlot[] = FORMATION_SLOTS['4-3-3'];

  // Man City (EPL) players: LW, CM_1, CB_1, LB, RB, GK (6 players)
  const manCitySlots = ['LW', 'CM_1', 'CB_1', 'LB', 'RB', 'GK'];
  // Liverpool (EPL) players: ST, CM_2 (2 players)
  const liverpoolSlots = ['ST', 'CM_2'];
  // Real Madrid (La Liga) players: RW, CM_3 (2 players)
  const realMadridSlots = ['RW', 'CM_3'];
  // Bayern (Bundesliga) player: CB_2 (1 player)
  const bayernSlots = ['CB_2'];

  const teamMap: Record<string, { teamId: number; teamName: string; teamNameEn: string; leagueId: number; leagueName: string }> = {
    manCity: { teamId: 1, teamName: '맨시티', teamNameEn: 'Man City', leagueId: 1, leagueName: 'EPL' },
    liverpool: { teamId: 2, teamName: '리버풀', teamNameEn: 'Liverpool', leagueId: 1, leagueName: 'EPL' },
    realMadrid: { teamId: 3, teamName: '레알마드리드', teamNameEn: 'Real Madrid', leagueId: 2, leagueName: 'LALIGA' },
    bayern: { teamId: 4, teamName: '바이에른', teamNameEn: 'Bayern', leagueId: 3, leagueName: 'BUNDESLIGA' },
  };

  const slotToTeam: Record<string, string> = {};
  manCitySlots.forEach(s => slotToTeam[s] = 'manCity');
  liverpoolSlots.forEach(s => slotToTeam[s] = 'liverpool');
  realMadridSlots.forEach(s => slotToTeam[s] = 'realMadrid');
  bayernSlots.forEach(s => slotToTeam[s] = 'bayern');

  return slots.map((slot, i) => {
    const teamKey = slotToTeam[slot.id] || 'manCity';
    const team = teamMap[teamKey];
    return {
      player: createPlayer({
        spid: 2000 + i,
        pid: 200 + i,
        position: slot.position as Position,
        teamId: team.teamId,
        teamName: team.teamName,
        teamNameEn: team.teamNameEn,
        leagueId: team.leagueId,
        leagueName: team.leagueName,
      }),
      slotPosition: slot.id,
    };
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildSynergyAnalysis', () => {
  const slots: FormationSlot[] = FORMATION_SLOTS['4-3-3'];

  it('returns empty analysis for empty players', () => {
    const result = buildSynergyAnalysis([], slots);
    expect(result.totalLinks).toBe(0);
    expect(result.teamLinkCount).toBe(0);
    expect(result.leagueLinkCount).toBe(0);
    expect(result.connections).toHaveLength(0);
    expect(result.playerInfos).toHaveLength(0);
    expect(result.teamDistribution).toHaveLength(0);
    expect(result.leagueDistribution).toHaveLength(0);
  });

  it('returns empty analysis for single player', () => {
    const players = [createSquadPlayers().slice(0, 1)[0]];
    const result = buildSynergyAnalysis(players, slots);
    expect(result.totalLinks).toBe(0);
    expect(result.teamLinkCount).toBe(0);
    expect(result.leagueLinkCount).toBe(0);
  });

  it('detects maximum team links for same-team squad', () => {
    const players = createSquadPlayers();
    const result = buildSynergyAnalysis(players, slots);

    // All 11 players from same team → all adjacent links are team links
    expect(result.teamLinkCount).toBeGreaterThan(0);
    expect(result.leagueLinkCount).toBe(0);
    expect(result.deadLinkCount).toBe(0);

    // All connections should be team type
    expect(result.connections.every(c => c.type === 'team')).toBe(true);

    // Team distribution should have exactly 1 entry
    expect(result.teamDistribution).toHaveLength(1);
    expect(result.teamDistribution[0].count).toBe(11);

    // League distribution should have exactly 1 entry
    expect(result.leagueDistribution).toHaveLength(1);
    expect(result.leagueDistribution[0].count).toBe(11);
  });

  it('detects mixed team and league links for mixed squad', () => {
    const players = createMixedSquad();
    const result = buildSynergyAnalysis(players, slots);

    // Should have both team and league links
    expect(result.teamLinkCount).toBeGreaterThan(0);
    expect(result.leagueLinkCount).toBeGreaterThan(0);
    // Some dead links are possible
    expect(result.totalLinks).toBe(
      result.teamLinkCount + result.leagueLinkCount + result.deadLinkCount
    );

    // Team distribution: Man City (6), Liverpool (2), Real Madrid (2), Bayern (1)
    expect(result.teamDistribution).toHaveLength(4);
    expect(result.teamDistribution[0].name).toBe('Man City');
    expect(result.teamDistribution[0].count).toBe(6);

    // League distribution: EPL (8), LALIGA (2), BUNDESLIGA (1)
    expect(result.leagueDistribution).toHaveLength(3);
    expect(result.leagueDistribution[0].name).toBe('EPL');
    expect(result.leagueDistribution[0].count).toBe(8);
  });

  it('computes correct per-player chemistry scores', () => {
    const players = createSquadPlayers();
    const result = buildSynergyAnalysis(players, slots);

    expect(result.playerInfos).toHaveLength(11);

    // All players in same team should have high chemistry
    for (const info of result.playerInfos) {
      expect(info.chemistry).toBeGreaterThanOrEqual(50);
    }

    // All players should have at least one team link
    for (const info of result.playerInfos) {
      expect(info.bestLinkType).toBe('team');
    }
  });

  it('identifies dominant team and league', () => {
    const players = createMixedSquad();
    const result = buildSynergyAnalysis(players, slots);

    expect(result.dominantTeam).toBe('Man City');
    expect(result.dominantLeague).toBe('EPL');
  });

  it('computes overall chemistry score correctly', () => {
    const players = createSquadPlayers();
    const result = buildSynergyAnalysis(players, slots);

    // All same-team → high chemistry
    expect(result.chemistryScore).toBeGreaterThanOrEqual(60);
    expect(result.chemistryScore).toBeLessThanOrEqual(100);
  });

  it('connection sharedAttribute shows team name for team links', () => {
    const players = createSquadPlayers();
    const result = buildSynergyAnalysis(players, slots);

    const teamConnections = result.connections.filter(c => c.type === 'team');
    expect(teamConnections.length).toBeGreaterThan(0);
    for (const conn of teamConnections) {
      expect(conn.sharedAttribute).toBe('Man City');
    }
  });

  it('connection sharedAttribute shows league name for league links', () => {
    const players = createMixedSquad();
    const result = buildSynergyAnalysis(players, slots);

    const leagueConnections = result.connections.filter(c => c.type === 'league');
    expect(leagueConnections.length).toBeGreaterThan(0);
    for (const conn of leagueConnections) {
      expect(conn.sharedAttribute).toBe('EPL'); // Man City + Liverpool links
    }
  });

  it('per-player connection info is correct', () => {
    const players = createMixedSquad();
    const result = buildSynergyAnalysis(players, slots);

    // Find a Man City player (e.g., LW)
    const lwInfo = result.playerInfos.find(
      p => p.slotPosition === 'LW'
    );
    expect(lwInfo).toBeDefined();
    expect(lwInfo!.player.teamNameEn).toBe('Man City');

    // LW should have connections to adjacent players
    // In 4-3-3: LW(15,15) is adjacent to ST(50,10), CM_1(30,36)
    // ST is Liverpool (EPL link), CM_1 is Man City (team link)
    const teamConns = lwInfo!.connections.filter(c => c.type === 'team');
    const leagueConns = lwInfo!.connections.filter(c => c.type === 'league');
    expect(teamConns.length).toBeGreaterThanOrEqual(1);
  });

  it('handles squad with all different leagues and teams', () => {
    const slots: FormationSlot[] = FORMATION_SLOTS['4-3-3'];
    const leagues = [
      { leagueId: 1, leagueName: 'EPL' },
      { leagueId: 2, leagueName: 'LALIGA' },
      { leagueId: 3, leagueName: 'BUNDESLIGA' },
      { leagueId: 4, leagueName: 'LIGUE 1' },
      { leagueId: 5, leagueName: 'SERIE A' },
      { leagueId: 6, leagueName: 'KLEAGUE' },
      { leagueId: 7, leagueName: 'EREDIVISIE' },
      { leagueId: 8, leagueName: 'PRIMEIRA LIGA' },
      { leagueId: 9, leagueName: 'SUPER LIG' },
      { leagueId: 10, leagueName: 'MLS' },
      { leagueId: 11, leagueName: 'SAUDI PRO LEAGUE' },
    ];

    const players: SquadPlayer[] = slots.map((slot, i) => ({
      player: createPlayer({
        spid: 3000 + i,
        pid: 300 + i,
        position: slot.position as Position,
        teamId: 10 + i, // All different teams
        teamName: `Team ${i}`,
        teamNameEn: `Team ${i}`,
        leagueId: leagues[i].leagueId,
        leagueName: leagues[i].leagueName,
      }),
      slotPosition: slot.id,
    }));

    const result = buildSynergyAnalysis(players, slots);

    // No team links (all different teams)
    expect(result.teamLinkCount).toBe(0);
    // No league links (all different leagues)
    expect(result.leagueLinkCount).toBe(0);
    // All links are dead
    expect(result.deadLinkCount).toBe(result.totalLinks);

    // Per-player chemistry should all be 0 or 50 (no links active)
    for (const info of result.playerInfos) {
      expect(info.teamLinkCount).toBe(0);
      expect(info.leagueLinkCount).toBe(0);
      expect(info.bestLinkType).toBe('none');
    }
  });
});

describe('getLeagueColor', () => {
  it('returns consistent colors for known leagues', () => {
    expect(getLeagueColor('EPL')).toBe('#3d195b');
    expect(getLeagueColor('LALIGA')).toBe('#ee8707');
    expect(getLeagueColor('SERIE A')).toBe('#024494');
    expect(getLeagueColor('BUNDESLIGA')).toBe('#d20515');
    expect(getLeagueColor('LIGUE 1')).toBe('#1a428a');
    expect(getLeagueColor('KLEAGUE')).toBe('#1a3c6e');
  });

  it('is case-insensitive', () => {
    expect(getLeagueColor('epl')).toBe('#3d195b');
    expect(getLeagueColor('Epl')).toBe('#3d195b');
    expect(getLeagueColor('laliga')).toBe('#ee8707');
  });

  it('returns default color for unknown leagues', () => {
    const result = getLeagueColor('UNKNOWN LEAGUE');
    expect(result).toBe('#4a5568');
  });
});
