/**
 * Shared stat constants, colors, and utility functions used across
 * player cards, comparison views, and filter components.
 */

import type { PlayerStats } from "@/types/player";

/** The six face stats displayed on every player card and comparison view. */
export interface StatDef {
  /** Property key on PlayerStats */
  key: keyof Pick<PlayerStats, "pace" | "shooting" | "passing" | "dribbling" | "defending" | "physical">;
  /** Korean display label */
  label: string;
  /** Short English abbreviation (3 chars) */
  short: string;
  /** Tailwind background color class for bar fills */
  color: string;
}

/**
 * Canonical stat key definitions used throughout the application.
 * Always import from here instead of duplicating in components.
 */
export const STAT_KEYS: StatDef[] = [
  { key: "pace",      label: "페이스",   short: "PAC", color: "bg-emerald-500" },
  { key: "shooting",  label: "슈팅",     short: "SHO", color: "bg-blue-500" },
  { key: "passing",   label: "패스",     short: "PAS", color: "bg-amber-500" },
  { key: "dribbling", label: "드리블",   short: "DRI", color: "bg-red-500" },
  { key: "defending", label: "수비",     short: "DEF", color: "bg-orange-500" },
  { key: "physical",  label: "피지컬",   short: "PHY", color: "bg-purple-500" },
];

/**
 * Colors used to distinguish players in multi-player comparison views.
 * Indexed by player position (0, 1, 2).
 */
export const PLAYER_COMPARE_COLORS = [
  { bar: "bg-emerald-400",  text: "text-emerald-400",  border: "border-emerald-400/30" },
  { bar: "bg-sky-400",      text: "text-sky-400",      border: "border-sky-400/30" },
  { bar: "bg-rose-400",     text: "text-rose-400",     border: "border-rose-400/30" },
] as const;

/** Maximum possible stat value used to calculate bar percentages. */
export const MAX_STAT_VALUE = 99;

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Format a player price in Korean notation (경/조/억/만).
 *
 * Examples:
 *   formatPrice(15_100_000_000_000_000) → "1경 5,100조"
 *   formatPrice(310_000_000_000_000)    → "310조"
 *   formatPrice(5_200_000_000)          → "52.0억"
 *   formatPrice(35_000_000)             → "3,500만"
 *   formatPrice(0)                      → "-"
 */
export function formatPrice(price: number): string {
  if (!price || price <= 0) return '-';

  const gyeong = Math.floor(price / 1_000_000_000_000_000);
  const jo = Math.floor((price % 1_000_000_000_000_000) / 1_000_000_000_000);
  const eok = Math.floor((price % 1_000_000_000_000) / 100_000_000);
  const man = Math.floor((price % 100_000_000) / 10_000);

  if (gyeong > 0) {
    const parts: string[] = [];
    parts.push(`${gyeong}경`);
    if (jo > 0) parts.push(`${jo.toLocaleString()}조`);
    return parts.join(' ');
  }
  if (jo > 0) {
    return `${jo.toLocaleString()}조`;
  }
  if (eok > 0) {
    const eokRemainder = price % 100_000_000;
    if (eokRemainder === 0) {
      return `${eok.toLocaleString()}억`;
    }
    return `${eok}.${String(eokRemainder).padStart(8, '0').slice(0, 1)}억`;
  }
  if (man > 0) return `${man.toLocaleString()}만`;
  return `${price.toLocaleString()}`;
}

/**
 * Format a squad total cost in Korean notation (경/조/억/만) with "BP" suffix.
 * This is the canonical formatter for squad-level cost display.
 *
 * @param cost  Total squad cost in raw BP units
 */
export function formatCost(cost: number): string {
  if (!cost || cost <= 0) return '0 BP';
  return `${formatPrice(cost)} BP`;
}

/**
 * Calculate the total cost of a squad by summing individual player prices.
 * Provides a consistent, testable way to compute squad cost independent of
 * the generator's internal accumulator.
 *
 * @param players  Array of squad players (each has a `player.price` field)
 * @returns        Sum of all player prices in raw BP units
 */
export function calculateSquadCost(
  players: ReadonlyArray<{ player: { price: number } }>,
): number {
  return players.reduce((sum, sp) => sum + sp.player.price, 0);
}

// ---------------------------------------------------------------------------
// Color mapping helpers
// ---------------------------------------------------------------------------

/** Get Tailwind classes for OVR badge based on rating tier. */
export function getOvrBadgeColor(ovr: number): string {
  if (ovr >= 90) return "bg-yellow-500 text-gray-900";
  if (ovr >= 85) return "bg-yellow-600 text-gray-900";
  if (ovr >= 80) return "bg-green-600 text-white";
  if (ovr >= 75) return "bg-blue-600 text-white";
  return "bg-gray-600 text-white";
}

/** Get Tailwind background class for position badge color. */
export function getPositionColor(pos: string): string {
  if (pos === "ST" || pos === "CF" || pos === "LF" || pos === "RF") return "bg-red-600";
  if (pos === "LW" || pos === "RW") return "bg-orange-500";
  if (pos === "CAM" || pos === "CM" || pos === "CDM" || pos === "LM" || pos === "RM") return "bg-green-600";
  if (pos === "CB" || pos === "LB" || pos === "RB" || pos === "LWB" || pos === "RWB") return "bg-blue-600";
  if (pos === "GK") return "bg-yellow-600";
  return "bg-gray-600";
}

/**
 * Get a semantic color class for a stat value.
 * High (>=85) → green, Medium (>=70) → yellow, Low (<70) → default gray.
 */
export function getStatValueColor(val: number): string {
  if (val >= 85) return "text-emerald-400";
  if (val >= 70) return "text-yellow-400";
  return "text-gray-300";
}

/** Compute percentage width for a stat bar (0–100). */
export function statBarPercent(value: number, max: number = MAX_STAT_VALUE): number {
  return Math.min((value / max) * 100, 100);
}

// ---------------------------------------------------------------------------
// Stat comparison helpers (multi-player comparison highlighting)
// ---------------------------------------------------------------------------

/** Result of computing stat bounds across multiple players. */
export interface StatBounds {
  /** Keyed by stat name ("ovr", "pace", etc.) → highest value among compared players. */
  best: Record<string, number>;
  /** Keyed by stat name → lowest value among compared players. */
  worst: Record<string, number>;
}

/**
 * Compute best (max) and worst (min) values for OVR and all six face stats
 * across an array of players. Useful for comparison highlighting.
 *
 * Returns a `StatBounds` object where keys are `"ovr"` plus the six
 * `STAT_KEYS` entries.
 */
export function computeStatBounds(players: { stats: PlayerStats }[]): StatBounds {
  if (players.length === 0) {
    const empty: Record<string, number> = {};
    empty["ovr"] = 0;
    for (const stat of STAT_KEYS) empty[stat.key] = 0;
    return { best: { ...empty }, worst: { ...empty } };
  }

  const best: Record<string, number> = {};
  const worst: Record<string, number> = {};

  const ovrValues = players.map((p) => p.stats.ovr);
  best["ovr"] = Math.max(...ovrValues);
  worst["ovr"] = Math.min(...ovrValues);

  for (const stat of STAT_KEYS) {
    const values = players.map((p) => p.stats[stat.key]);
    best[stat.key] = Math.max(...values);
    worst[stat.key] = Math.min(...values);
  }

  return { best, worst };
}

/**
 * Returns Tailwind CSS class strings for styling a stat value in a comparison row.
 *
 * - **best**: bold gold text with a subtle background highlight
 * - **worst**: dimmed/muted text
 * - **neutral**: standard gray text
 *
 * @param isBest  Whether this value is the highest in the row
 * @param isWorst Whether this value is the lowest in the row
 */
export function getComparisonValueClasses(isBest: boolean, isWorst: boolean): string {
  if (isBest) return "font-extrabold text-yellow-300";
  if (isWorst) return "font-medium text-gray-500";
  return "font-semibold text-gray-300";
}

/**
 * Returns Tailwind CSS class string for a table cell background in comparison views.
 *
 * - **best**: subtle yellow-tinted background to draw the eye
 * - **worst**: no special background (value text is already dimmed)
 * - **neutral**: no background
 */
export function getComparisonCellBg(isBest: boolean): string {
  if (isBest) return "bg-yellow-500/5";
  return "";
}
