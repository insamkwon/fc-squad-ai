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

/** Stat range filter */
export interface StatRange {
  min?: number;
  max?: number;
}

/** Budget range for squad building */
export interface BudgetRange {
  min?: number;
  max?: number;
}
