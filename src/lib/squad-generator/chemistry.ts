/**
 * Chemistry calculation engine for FC Online squad building.
 *
 * FC Online chemistry is based on links between adjacent players in the
 * formation. Link strength depends on shared attributes:
 *   - Same team (strong link): 3 points
 *   - Same league (medium link): 2 points
 *   - No shared attributes: 0 points
 *
 * Each player's chemistry = sum of link strengths with adjacent placed players,
 * normalized by the maximum possible links for that position in the formation.
 *
 * Squad chemistry = average of all player chemistries (0-100).
 */

import type { Player } from '@/types/player';
import type { FormationSlot, SquadPlayer } from '@/types/squad';
import { distanceBetween } from '@/lib/formation-layout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A chemistry link between two formation slots */
export interface ChemistryLink {
  slotA: string;
  slotB: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum distance (in pitch percentage units) for two slots to be considered
 * adjacent/linked. The pitch coordinate system uses 0-100 for both x and y.
 *
 * Chosen empirically to produce reasonable adjacency graphs across all 12
 * formations. At this threshold:
 *   - CB-CB pairs in 5-back formations are linked (~40 units)
 *   - LW/CB pairs in 4-3-3 are NOT linked (~46 units)
 *   - CM/CB pairs in 4-4-2 ARE linked (~35 units)
 */
const LINK_DISTANCE_THRESHOLD = 40;

/** Maximum link strength between two players */
const MAX_LINK_STRENGTH = 3;

// ---------------------------------------------------------------------------
// Link Strength Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the chemistry link strength between two players.
 *
 * - Same team: 3 points (strong link)
 * - Same league (but different team): 2 points (medium link)
 * - No shared attributes: 0 points
 */
export function calculateLinkStrength(playerA: Player, playerB: Player): number {
  if (playerA.teamId === playerB.teamId) return 3;
  if (playerA.leagueId === playerB.leagueId) return 2;
  return 0;
}

// ---------------------------------------------------------------------------
// Adjacency Calculation
// ---------------------------------------------------------------------------

/**
 * Precompute all chemistry links for a formation based on slot positions.
 *
 * Two slots are linked if their Euclidean distance on the pitch is within
 * the LINK_DISTANCE_THRESHOLD. The links are cached per formation to avoid
 * recomputation during squad generation.
 */
export function getChemistryLinks(slots: FormationSlot[]): ChemistryLink[] {
  const links: ChemistryLink[] = [];

  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const distance = distanceBetween(slots[i], slots[j]);

      if (distance <= LINK_DISTANCE_THRESHOLD) {
        links.push({ slotA: slots[i].id, slotB: slots[j].id });
      }
    }
  }

  return links;
}

/**
 * Count the number of adjacent links for each slot in a formation.
 * Used to normalize per-player chemistry scores.
 */
export function getMaxLinksPerSlot(
  links: ChemistryLink[],
): Map<string, number> {
  const count = new Map<string, number>();

  for (const link of links) {
    count.set(link.slotA, (count.get(link.slotA) ?? 0) + 1);
    count.set(link.slotB, (count.get(link.slotB) ?? 0) + 1);
  }

  return count;
}

// ---------------------------------------------------------------------------
// Chemistry Score Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate the per-player chemistry for a single placed player.
 *
 * Chemistry = sum of link strengths with all placed adjacent players,
 * normalized by the maximum possible (numLinks * MAX_LINK_STRENGTH).
 *
 * @returns Chemistry score 0-100
 */
export function calculatePlayerChemistry(
  slotId: string,
  player: Player,
  placedPlayers: Map<string, SquadPlayer>,
  links: ChemistryLink[],
  maxLinksPerSlot: Map<string, number>,
): number {
  const adjacentLinks = links.filter(
    (link) => link.slotA === slotId || link.slotB === slotId,
  );

  if (adjacentLinks.length === 0) return 50; // Isolated player, neutral

  let totalStrength = 0;
  let placedCount = 0;

  for (const link of adjacentLinks) {
    const neighborSlotId =
      link.slotA === slotId ? link.slotB : link.slotA;
    const neighbor = placedPlayers.get(neighborSlotId);

    if (neighbor) {
      totalStrength += calculateLinkStrength(player, neighbor.player);
      placedCount++;
    }
  }

  // If no neighbors are placed yet, return neutral score
  if (placedCount === 0) return 50;

  // Normalize by the max possible chemistry for this slot
  const maxPossible = (maxLinksPerSlot.get(slotId) ?? 1) * MAX_LINK_STRENGTH;
  return Math.round((totalStrength / maxPossible) * 100);
}

/**
 * Calculate the overall squad chemistry score.
 *
 * Squad chemistry = average of all individual player chemistry scores (0-100).
 * Players without any placed neighbors get a neutral 50 score.
 *
 * @returns Chemistry score 0-100
 */
export function calculateSquadChemistry(
  squadPlayers: Map<string, SquadPlayer>,
  links: ChemistryLink[],
  maxLinksPerSlot: Map<string, number>,
): number {
  if (squadPlayers.size === 0) return 0;
  if (squadPlayers.size === 1) return 50;

  let totalChemistry = 0;
  let playerCount = 0;

  for (const [slotId, squadPlayer] of squadPlayers) {
    totalChemistry += calculatePlayerChemistry(
      slotId,
      squadPlayer.player,
      squadPlayers,
      links,
      maxLinksPerSlot,
    );
    playerCount++;
  }

  return Math.round(totalChemistry / playerCount);
}

// ---------------------------------------------------------------------------
// Chemistry Potential Estimation (for selection scoring)
// ---------------------------------------------------------------------------

/**
 * Estimate the chemistry potential for placing a candidate player in a slot.
 *
 * This is used during squad building to predict how well a player would
 * connect with already-placed teammates. It considers:
 *
 * 1. **Actual links** with placed neighbors (concrete chemistry contribution)
 * 2. **Placement coverage** — how many of the slot's total links have
 *    placed neighbors (weights reliability of the estimate)
 *
 * The score is 0-100, with 50 being neutral (no placed neighbors).
 *
 * @param player - Candidate player to evaluate
 * @param slotId - Formation slot where the player would be placed
 * @param placedPlayers - Currently placed players in the squad
 * @param links - Precomputed chemistry links for the formation
 */
export function estimateChemistryPotential(
  player: Player,
  slotId: string,
  placedPlayers: Map<string, SquadPlayer>,
  links: ChemistryLink[],
): number {
  const adjacentLinks = links.filter(
    (link) => link.slotA === slotId || link.slotB === slotId,
  );

  if (adjacentLinks.length === 0) return 50; // No links possible

  let totalStrength = 0;
  let placedCount = 0;

  for (const link of adjacentLinks) {
    const neighborSlotId =
      link.slotA === slotId ? link.slotB : link.slotA;
    const neighbor = placedPlayers.get(neighborSlotId);

    if (neighbor) {
      totalStrength += calculateLinkStrength(player, neighbor.player);
      placedCount++;
    }
  }

  // No placed neighbors → neutral estimate
  if (placedCount === 0) return 50;

  // Average link quality (0-3 scale → 0-100)
  const avgLinkQuality = (totalStrength / placedCount / MAX_LINK_STRENGTH) * 100;

  // Reliability factor: more placed neighbors = more reliable estimate
  // Range: 0.5 (1 neighbor) to 1.0 (all neighbors)
  const placementRatio = placedCount / adjacentLinks.length;
  const reliabilityFactor = 0.5 + 0.5 * placementRatio;

  return Math.round(avgLinkQuality * reliabilityFactor);
}

/**
 * Count the number of chemistry links between players of the same team
 * in a completed squad. Used for reasoning/description.
 */
export function countSameTeamLinks(
  squadPlayers: Map<string, SquadPlayer>,
  links: ChemistryLink[],
): number {
  let count = 0;

  for (const link of links) {
    const playerA = squadPlayers.get(link.slotA);
    const playerB = squadPlayers.get(link.slotB);

    if (playerA && playerB && playerA.player.teamId === playerB.player.teamId) {
      count++;
    }
  }

  return count;
}

/**
 * Count the number of chemistry links between players of the same league
 * in a completed squad. Used for reasoning/description.
 */
export function countSameLeagueLinks(
  squadPlayers: Map<string, SquadPlayer>,
  links: ChemistryLink[],
): number {
  let count = 0;

  for (const link of links) {
    const playerA = squadPlayers.get(link.slotA);
    const playerB = squadPlayers.get(link.slotB);

    if (playerA && playerB && playerA.player.leagueId === playerB.player.leagueId) {
      count++;
    }
  }

  return count;
}
