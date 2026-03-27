/**
 * Synergy analysis utilities for squad team color synergy visualization.
 *
 * Provides detailed breakdowns of league/nation/club links between players
 * in a squad, with per-player connection info and distribution statistics.
 * Used by the SynergyPanel component for visual chemistry indicators.
 */

import type { Player } from '@/types/player';
import type { FormationSlot, SquadPlayer } from '@/types/squad';
import {
  getChemistryLinks,
  calculateLinkStrength,
} from '@/lib/squad-generator/chemistry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single connection between two players with link details */
export interface PlayerConnection {
  /** Index of the first player in the squad */
  playerIdx: number;
  /** Index of the second player in the squad */
  connectedIdx: number;
  /** Link type based on shared attributes */
  type: 'team' | 'league' | 'none';
  /** Raw link strength (3 = team, 2 = league, 0 = none) */
  strength: number;
  /** Shared attribute name for display (e.g. "Man City", "EPL") */
  sharedAttribute: string;
  /** Formation slot IDs for the connection */
  slotA: string;
  slotB: string;
}

/** Per-player synergy info including all connections and individual score */
export interface PlayerSynergyInfo {
  /** Player data */
  player: Player;
  /** Slot position in the formation */
  slotPosition: string;
  /** Index in the squad (0-10) */
  index: number;
  /** Individual chemistry score (0-100) */
  chemistry: number;
  /** All connections with adjacent placed players */
  connections: PlayerConnection[];
  /** Number of team links */
  teamLinkCount: number;
  /** Number of league links (excluding team links) */
  leagueLinkCount: number;
  /** Best link type this player has */
  bestLinkType: 'team' | 'league' | 'none';
}

/** Distribution item for team or league breakdown */
export interface DistributionItem {
  /** Team name or league name */
  name: string;
  /** Number of players from this team/league */
  count: number;
  /** Player indices belonging to this group */
  playerIndices: number[];
}

/** Complete synergy analysis result for a squad */
export interface SynergyAnalysis {
  /** Total number of adjacent links in the formation */
  totalLinks: number;
  /** Links where players share the same team */
  teamLinkCount: number;
  /** Links where players share the same league (but different team) */
  leagueLinkCount: number;
  /** Links where players share no attributes */
  deadLinkCount: number;
  /** Overall squad chemistry score (0-100) */
  chemistryScore: number;
  /** All connections (team + league) as a flat list */
  connections: PlayerConnection[];
  /** Per-player synergy breakdown */
  playerInfos: PlayerSynergyInfo[];
  /** Team distribution (how many players per team) */
  teamDistribution: DistributionItem[];
  /** League distribution (how many players per league) */
  leagueDistribution: DistributionItem[];
  /** Most represented team name */
  dominantTeam: string;
  /** Most represented league name */
  dominantLeague: string;
}

// ---------------------------------------------------------------------------
// Analysis Builder
// ---------------------------------------------------------------------------

/**
 * Build a complete synergy analysis for a squad.
 *
 * Analyzes all adjacent player pairs in the formation to determine:
 * - Team links (same teamId → 3pts)
 * - League links (same leagueId, different team → 2pts)
 * - Per-player chemistry scores and connection details
 * - Team and league distribution across the squad
 */
export function buildSynergyAnalysis(
  players: SquadPlayer[],
  slots: FormationSlot[],
): SynergyAnalysis {
  if (players.length === 0) {
    return emptyAnalysis();
  }

  const links = getChemistryLinks(slots);
  const playerMap = new Map<string, SquadPlayer>();
  const slotIndexMap = new Map<string, number>();

  for (let i = 0; i < players.length; i++) {
    playerMap.set(players[i].slotPosition, players[i]);
    slotIndexMap.set(players[i].slotPosition, i);
  }

  // Build all connections
  const connections: PlayerConnection[] = [];
  const playerConnectionMap = new Map<number, PlayerConnection[]>();

  for (const link of links) {
    const pA = playerMap.get(link.slotA);
    const pB = playerMap.get(link.slotB);
    if (!pA || !pB) continue;

    const idxA = slotIndexMap.get(link.slotA);
    const idxB = slotIndexMap.get(link.slotB);
    if (idxA === undefined || idxB === undefined) continue;

    const strength = calculateLinkStrength(pA.player, pB.player);
    const type = strength === 3 ? 'team' : strength === 2 ? 'league' : 'none';

    const connection: PlayerConnection = {
      playerIdx: idxA,
      connectedIdx: idxB,
      type,
      strength,
      sharedAttribute: type === 'team'
        ? pA.player.teamNameEn || pA.player.teamName
        : type === 'league'
          ? pA.player.leagueName
          : '-',
      slotA: link.slotA,
      slotB: link.slotB,
    };

    connections.push(connection);

    // Track per-player connections (both directions)
    if (!playerConnectionMap.has(idxA)) playerConnectionMap.set(idxA, []);
    if (!playerConnectionMap.has(idxB)) playerConnectionMap.set(idxB, []);
    playerConnectionMap.get(idxA)!.push({ ...connection });
    playerConnectionMap.get(idxB)!.push({
      ...connection,
      playerIdx: idxB,
      connectedIdx: idxA,
    });
  }

  // Compute per-player synergy info
  const maxLinksPerSlot = getMaxLinksPerSlot(links);
  const placedPlayers = new Map<string, SquadPlayer>();
  for (const p of players) {
    placedPlayers.set(p.slotPosition, p);
  }

  const playerInfos: PlayerSynergyInfo[] = players.map((sp, idx) => {
    const chem = calculatePlayerChem(
      sp.slotPosition,
      sp.player,
      placedPlayers,
      links,
      maxLinksPerSlot,
    );
    const pConns = playerConnectionMap.get(idx) || [];
    const teamCount = pConns.filter((c) => c.type === 'team').length;
    const leagueCount = pConns.filter((c) => c.type === 'league').length;
    const hasTeam = pConns.some((c) => c.type === 'team');
    const hasLeague = pConns.some((c) => c.type === 'league');

    return {
      player: sp.player,
      slotPosition: sp.slotPosition,
      index: idx,
      chemistry: chem,
      connections: pConns,
      teamLinkCount: teamCount,
      leagueLinkCount: leagueCount,
      bestLinkType: hasTeam ? 'team' : hasLeague ? 'league' : 'none',
    };
  });

  // Distributions
  const teamDistribution = buildDistribution(players, 'team');
  const leagueDistribution = buildDistribution(players, 'league');

  // Counts — team links are computed from connections (where both players placed)
  // League links exclude same-team links (same-team is a superset of same-league)
  const teamLinkCount = connections.filter(c => c.type === 'team').length;
  const leagueLinkCount = connections.filter(c => c.type === 'league').length;
  const deadLinkCount = connections.filter(c => c.type === 'none').length;
  const totalLinks = teamLinkCount + leagueLinkCount + deadLinkCount;
  const chemistryScore = playerInfos.length > 0
    ? Math.round(playerInfos.reduce((sum, pi) => sum + pi.chemistry, 0) / playerInfos.length)
    : 0;

  return {
    totalLinks,
    teamLinkCount,
    leagueLinkCount,
    deadLinkCount,
    chemistryScore,
    connections,
    playerInfos,
    teamDistribution,
    leagueDistribution,
    dominantTeam: teamDistribution[0]?.name ?? '-',
    dominantLeague: leagueDistribution[0]?.name ?? '-',
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyAnalysis(): SynergyAnalysis {
  return {
    totalLinks: 0,
    teamLinkCount: 0,
    leagueLinkCount: 0,
    deadLinkCount: 0,
    chemistryScore: 0,
    connections: [],
    playerInfos: [],
    teamDistribution: [],
    leagueDistribution: [],
    dominantTeam: '-',
    dominantLeague: '-',
  };
}

function buildDistribution(
  players: SquadPlayer[],
  key: 'team' | 'league',
): DistributionItem[] {
  const map = new Map<string, { count: number; indices: number[] }>();

  for (let i = 0; i < players.length; i++) {
    const sp = players[i];
    const name = key === 'team'
      ? (sp.player.teamNameEn || sp.player.teamName)
      : sp.player.leagueName;

    const entry = map.get(name) || { count: 0, indices: [] };
    entry.count++;
    entry.indices.push(i);
    map.set(name, entry);
  }

  return Array.from(map.entries())
    .map(([name, { count, indices }]) => ({ name, count, playerIndices: indices }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/**
 * Calculate per-player chemistry score (re-exported for convenience).
 * Mirrors the logic from chemistry.ts to avoid circular deps.
 */
function calculatePlayerChem(
  slotId: string,
  player: Player,
  placedPlayers: Map<string, SquadPlayer>,
  links: { slotA: string; slotB: string }[],
  maxLinksPerSlot: Map<string, number>,
): number {
  const adjacentLinks = links.filter(
    (link) => link.slotA === slotId || link.slotB === slotId,
  );

  if (adjacentLinks.length === 0) return 50;

  let totalStrength = 0;
  let placedCount = 0;

  for (const link of adjacentLinks) {
    const neighborSlotId = link.slotA === slotId ? link.slotB : link.slotA;
    const neighbor = placedPlayers.get(neighborSlotId);

    if (neighbor) {
      totalStrength += calculateLinkStrength(player, neighbor.player);
      placedCount++;
    }
  }

  if (placedCount === 0) return 50;

  const maxPossible = (maxLinksPerSlot.get(slotId) ?? 1) * 3;
  return Math.round((totalStrength / maxPossible) * 100);
}

function getMaxLinksPerSlot(
  links: { slotA: string; slotB: string }[],
): Map<string, number> {
  const count = new Map<string, number>();
  for (const link of links) {
    count.set(link.slotA, (count.get(link.slotA) ?? 0) + 1);
    count.set(link.slotB, (count.get(link.slotB) ?? 0) + 1);
  }
  return count;
}

/**
 * Get a color hex for a league name for visual consistency.
 * Returns a consistent color per league name.
 */
export function getLeagueColor(leagueName: string): string {
  const colors: Record<string, string> = {
    'EPL': '#3d195b',
    'LALIGA': '#ee8707',
    'SERIE A': '#024494',
    'BUNDESLIGA': '#d20515',
    'LIGUE 1': '#1a428a',
    'KLEAGUE': '#1a3c6e',
    'EREDIVISIE': '#e4002b',
    'PRIMEIRA LIGA': '#1d5a2d',
    'SUPER LIG': '#c8102e',
    'SCOTTISH PREMIERSHIP': '#2e0854',
    'MLS': '#00245d',
    'SAUDI PRO LEAGUE': '#006c35',
  };
  return colors[leagueName.toUpperCase()] || '#4a5568';
}
