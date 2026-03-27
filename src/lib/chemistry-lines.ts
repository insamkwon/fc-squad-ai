/**
 * Pure logic utilities for chemistry line rendering.
 *
 * These functions are extracted from the ChemistryLines React component
 * for testability. The React component delegates to these functions.
 */

import type { FormationSlot, SquadPlayer } from '@/types/squad';
import {
  getChemistryLinks,
  calculateLinkStrength,
} from '@/lib/squad-generator/chemistry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A chemistry edge between two players with strength information */
export interface ChemistryEdge {
  /** Index into the players array */
  fromIdx: number;
  /** Index into the players array */
  toIdx: number;
  /** 3 = same team (strong), 2 = same league (medium), 0 = no link (weak) */
  strength: number;
  /** Human-readable link type */
  type: 'team' | 'league' | 'none';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Chemistry lines SVG viewBox dimensions (68:105 pitch aspect ratio) */
export const CHEMISTRY_SVG_W = 68;
export const CHEMISTRY_SVG_H = 105;

/** Bezier curvature factor — controls how much lines curve */
export const CURVE_FACTOR = 0.08;

/** Stroke dimensions (relative to viewBox) for each link type */
export const STROKE = {
  /** Team links — thick, prominent */
  team: 0.55,
  /** League links — medium */
  league: 0.4,
  /** Adjacent but no shared attributes — faint */
  none: 0.15,
} as const;

/** Colors for each link type */
export const COLOR = {
  team: 'rgba(74, 222, 128, 0.65)',
  teamGlow: 'rgba(74, 222, 128, 0.25)',
  league: 'rgba(250, 204, 21, 0.55)',
  leagueGlow: 'rgba(250, 204, 21, 0.2)',
  none: 'rgba(255, 255, 255, 0.08)',
} as const;

/** Endpoint dot radius for each link type */
export const DOT_RADIUS = {
  team: 0.6,
  league: 0.45,
  none: 0,
} as const;

// ---------------------------------------------------------------------------
// Edge Building
// ---------------------------------------------------------------------------

/**
 * Build chemistry edges between adjacent players using the chemistry engine.
 *
 * Uses `getChemistryLinks` for adjacency detection and `calculateLinkStrength`
 * for link strength, ensuring consistency with the squad generation chemistry
 * calculations.
 *
 * @returns Array of ChemistryEdge objects sorted: none edges first, then league, then team
 */
export function buildChemistryEdges(
  players: SquadPlayer[],
  slots: FormationSlot[],
): ChemistryEdge[] {
  const edges: ChemistryEdge[] = [];

  if (players.length < 2) return edges;

  const links = getChemistryLinks(slots);

  const playerMap = new Map<string, SquadPlayer>();
  for (const p of players) {
    playerMap.set(p.slotPosition, p);
  }

  const slotIndexMap = new Map<string, number>();
  for (let i = 0; i < players.length; i++) {
    slotIndexMap.set(players[i].slotPosition, i);
  }

  for (const link of links) {
    const playerA = playerMap.get(link.slotA);
    const playerB = playerMap.get(link.slotB);

    if (!playerA || !playerB) continue;

    const idxA = slotIndexMap.get(link.slotA);
    const idxB = slotIndexMap.get(link.slotB);
    if (idxA === undefined || idxB === undefined) continue;

    const strength = calculateLinkStrength(playerA.player, playerB.player);

    edges.push({
      fromIdx: idxA,
      toIdx: idxB,
      strength,
      type: strength === 3 ? 'team' : strength === 2 ? 'league' : 'none',
    });
  }

  return edges;
}

// ---------------------------------------------------------------------------
// Coordinate Conversion
// ---------------------------------------------------------------------------

/**
 * Convert slot percentage coordinates (0-100) to SVG viewBox coordinates
 * matching the pitch aspect ratio (68:105).
 */
export function slotToSvgCoord(slot: FormationSlot): { x: number; y: number } {
  return {
    x: (slot.x / 100) * CHEMISTRY_SVG_W,
    y: (slot.y / 100) * CHEMISTRY_SVG_H,
  };
}

// ---------------------------------------------------------------------------
// Curve Calculation
// ---------------------------------------------------------------------------

/**
 * Calculate a quadratic bezier control point for a curved line between two points.
 *
 * The curve is offset perpendicular to the midpoint, curving away from the
 * center of the pitch to improve readability and avoid overlapping with
 * player cards.
 */
export function getControlPoint(
  from: { x: number; y: number },
  to: { x: number; y: number },
): { x: number; y: number } {
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return { x: mx, y: my };

  const nx = -dy / len;
  const ny = dx / len;
  const offset = len * CURVE_FACTOR;

  // Bias the curve away from the center of the pitch (34, 52.5)
  const centerX = CHEMISTRY_SVG_W / 2;
  const dotProduct = (mx - centerX) * nx + (my - CHEMISTRY_SVG_H / 2) * ny;
  const sign = dotProduct >= 0 ? 1 : -1;

  return {
    x: mx + nx * offset * sign,
    y: my + ny * offset * sign,
  };
}

// ---------------------------------------------------------------------------
// Chemistry Link Info (for PlayerSlot indicators)
// ---------------------------------------------------------------------------

/**
 * Determine which slots have chemistry links of each type.
 *
 * Returns sets of slot IDs categorized by their best link type.
 */
export function buildChemLinkInfo(
  players: SquadPlayer[],
  slots: FormationSlot[],
): {
  teamLinked: Set<string>;
  leagueLinked: Set<string>;
  anyLinked: Set<string>;
} {
  const teamLinked = new Set<string>();
  const leagueLinked = new Set<string>();
  const anyLinked = new Set<string>();

  if (players.length < 2) {
    return { teamLinked, leagueLinked, anyLinked };
  }

  const links = getChemistryLinks(slots);
  const playerMap = new Map<string, SquadPlayer>();
  for (const p of players) {
    playerMap.set(p.slotPosition, p);
  }

  for (const link of links) {
    const pA = playerMap.get(link.slotA);
    const pB = playerMap.get(link.slotB);
    if (!pA || !pB) continue;

    const strength = calculateLinkStrength(pA.player, pB.player);
    if (strength === 0) continue;

    anyLinked.add(link.slotA);
    anyLinked.add(link.slotB);

    if (strength === 3) {
      teamLinked.add(link.slotA);
      teamLinked.add(link.slotB);
    } else if (strength === 2) {
      leagueLinked.add(link.slotA);
      leagueLinked.add(link.slotB);
    }
  }

  return { teamLinked, leagueLinked, anyLinked };
}
