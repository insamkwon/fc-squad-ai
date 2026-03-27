/**
 * Filter-related type definitions for the FC Online Squad Builder.
 *
 * Position and PlayerStats are imported from player.ts to avoid duplication.
 * CardType is also imported for card-based filtering.
 */

import type { Position, PlayerStats, CardType } from './player';

// Re-export for convenience of consumers that only import from filters.ts
export type { Position, PlayerStats, CardType } from './player';

/** Team information for filtering and display */
export interface TeamInfo {
  id: string;
  name: string;
  nameKo: string;
  league: string;
}

/** League information */
export interface LeagueInfo {
  id: string;
  name: string;
  nameKo: string;
}

/** Stat range filter */
export interface StatRange {
  min?: number;
  max?: number;
}

/** Player search filters */
export interface PlayerFilters {
  query?: string;
  position?: Position;
  teamId?: string;
  seasonId?: string;
  seasonSlug?: string;
  cardType?: CardType;
  statRanges?: Partial<Record<keyof PlayerStats, StatRange>>;
  sortBy?: keyof PlayerStats;
  sortOrder?: "asc" | "desc";
}

/** Formation type */
export type Formation =
  | "4-4-2"
  | "4-3-3"
  | "3-5-2"
  | "4-2-3-1"
  | "4-1-4-1"
  | "3-4-3"
  | "4-5-1"
  | "5-3-2"
  | "5-4-1"
  | "4-3-2-1"
  | "4-4-1-1"
  | "3-4-1-2";

/** Budget range for squad building */
export interface BudgetRange {
  min?: number;
  max?: number;
}

/** Squad builder form inputs */
export interface SquadBuilderFilters {
  formation: Formation;
  budget: BudgetRange;
  teamColorId?: string;
  preferredPositions?: Position[];
}
