/**
 * Squad generation engine for FC Online.
 *
 * This module takes parsed AI parameters (ParsedSquadRequest) and produces
 * optimized starting XI squads with:
 *
 * - **Position assignments**: Players placed in formation slots with
 *   compatible positions
 * - **Chemistry links**: Players selected to maximize same-team and
 *   same-league connections
 * - **Budget compliance**: Total squad cost respects budget constraints
 * - **Stat prioritization**: Players selected based on playstyle/stat
 *   preferences
 *
 * The generator produces multiple candidates using different strategies:
 * - `chemistry`: Maximize chemistry links between players
 * - `ovr`: Maximize average overall rating
 * - `value`: Maximize OVR per unit of price spent
 * - `balanced`: Equal weight across all factors
 */

import type { Player, Position } from '@/types/player';
import type {
  Formation,
  FormationSlot,
  Squad,
  SquadCandidate,
  SquadPlayer,
} from '@/types/squad';
import { FORMATION_SLOTS } from '@/types/squad';
import type {
  ParsedSquadRequest,
  ParsedBudget,
  ChemistryPreference,
  StatPriority,
  Playstyle,
  CardTypePreference,
  PositionPreference,
} from '@/lib/ai/types';

import {
  getChemistryLinks,
  getMaxLinksPerSlot,
  calculateSquadChemistry,
  estimateChemistryPotential,
  countSameTeamLinks,
  countSameLeagueLinks,
} from './chemistry';
import { formatPrice } from '@/lib/stat-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Strategy for generating a squad candidate */
export type GenerationStrategy = 'chemistry' | 'ovr' | 'value' | 'balanced';

/** Weight configuration for scoring players during selection */
export interface SelectionWeights {
  ovr: number;
  chemistry: number;
  statPriority: number;
  priceEfficiency: number;
  positionFit: number;
}

/**
 * Mutable build context that accumulates state during squad generation.
 * A fresh context is created for each candidate generation.
 */
interface BuildContext {
  formation: Formation;
  slots: FormationSlot[];
  allPlayers: Player[];
  usedSpids: Set<number>;
  usedPids: Set<number>;
  totalCost: number;
  placedPlayers: Map<string, SquadPlayer>;

  // Resolved preferences
  requiredTeamIds: Set<number>;
  preferredTeamIds: Set<number>;
  requiredLeagueNames: Set<string>;
  preferredLeagueNames: Set<string>;
  excludedTeamIds: Set<number>;

  // Filters
  budget: ParsedBudget | undefined;
  minOvr: number | undefined;
  maxOvr: number | undefined;
  statPriorities: StatPriority[];
  playstyle: Playstyle | undefined;
  chemistry: ChemistryPreference | undefined;
  cardTypes: CardTypePreference[];
  positionPreferences: PositionPreference[];
  pinnedPlayers: Player[];

  // Precomputed chemistry data
  links: ReturnType<typeof getChemistryLinks>;
  maxLinksPerSlot: ReturnType<typeof getMaxLinksPerSlot>;
}

/** Options for the squad generation */
export interface GenerationOptions {
  /** Number of candidates to generate (default: 3) */
  count?: number;
  /** Custom strategies to use (default: all 4 strategies) */
  strategies?: GenerationStrategy[];
  /** Additional pinned players by spid (from UI interactions) */
  pinnedSpids?: number[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maps formation slot positions to compatible Player positions.
 * First position = direct match (preferred), rest = compatible alternatives.
 */
const SLOT_POSITION_MAP: Record<string, Position[]> = {
  ST: ['ST', 'CF'],
  CF: ['CF', 'ST'],
  LF: ['LF', 'LW', 'ST'],
  RF: ['RF', 'RW', 'ST'],
  LW: ['LW', 'LF', 'RW'],
  RW: ['RW', 'RF', 'LW'],
  CAM: ['CAM', 'CM'],
  CM: ['CM', 'CAM', 'CDM'],
  CDM: ['CDM', 'CM'],
  LM: ['LM', 'LW', 'CAM'],
  RM: ['RM', 'RW', 'CAM'],
  LB: ['LB', 'LWB'],
  RB: ['RB', 'RWB'],
  CB: ['CB'],
  LWB: ['LWB', 'LB'],
  RWB: ['RWB', 'RB'],
  GK: ['GK'],
};

/** Category priority for slot fill order (back to front) */
const POSITION_CATEGORY_PRIORITY: Record<string, number> = {
  GK: 0,
  CB: 1, LWB: 1, RWB: 1, LB: 2, RB: 2,
  CDM: 3, CM: 4, CAM: 5, LM: 6, RM: 6,
  ST: 7, CF: 8, LW: 9, RW: 9, LF: 10, RF: 10,
};

/** Playstyle → default stat priorities (used when no explicit priorities) */
const PLAYSTYLE_STATS: Record<Playstyle, StatPriority[]> = {
  attacking: ['pace', 'shooting'],
  defensive: ['defending', 'physical'],
  balanced: [],
  possession: ['passing', 'dribbling'],
  'counter-attack': ['pace', 'shooting', 'physical'],
  'high-press': ['pace', 'physical', 'defending'],
  'park-the-bus': ['defending', 'physical'],
};

/** Pre-defined weight presets for each generation strategy */
const STRATEGY_WEIGHTS: Record<GenerationStrategy, SelectionWeights> = {
  chemistry: { ovr: 0.20, chemistry: 0.40, statPriority: 0.10, priceEfficiency: 0.05, positionFit: 0.25 },
  ovr:       { ovr: 0.40, chemistry: 0.10, statPriority: 0.15, priceEfficiency: 0.05, positionFit: 0.30 },
  value:     { ovr: 0.10, chemistry: 0.15, statPriority: 0.10, priceEfficiency: 0.50, positionFit: 0.15 },
  balanced:  { ovr: 0.25, chemistry: 0.25, statPriority: 0.15, priceEfficiency: 0.10, positionFit: 0.25 },
};

// ---------------------------------------------------------------------------
// Team / League Resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a team name to actual team IDs from the player database.
 * Matches against both teamName and teamNameEn fields.
 */
function resolveTeamNameToIds(
  teamName: string,
  allPlayers: Player[],
): Set<number> {
  const ids = new Set<number>();
  const lowerName = teamName.toLowerCase();

  for (const p of allPlayers) {
    const pName = p.teamName.toLowerCase();
    const pNameEn = p.teamNameEn.toLowerCase();

    if (
      pName === lowerName ||
      pNameEn === lowerName ||
      pName.includes(lowerName) ||
      pNameEn.includes(lowerName) ||
      lowerName.includes(pNameEn) ||
      lowerName.includes(pName)
    ) {
      ids.add(p.teamId);
    }
  }

  return ids;
}

/**
 * Resolve a league name to actual league IDs from the player database.
 */
function resolveLeagueNameToIds(
  leagueName: string,
  allPlayers: Player[],
): Set<string> {
  const ids = new Set<string>();
  const upperLeague = leagueName.toUpperCase();

  for (const p of allPlayers) {
    if (p.leagueName.toUpperCase() === upperLeague) {
      ids.add(p.leagueName);
    }
  }

  return ids;
}

// ---------------------------------------------------------------------------
// Player Resolution (for pinned players from AI parser)
// ---------------------------------------------------------------------------

/**
 * Resolve a player name preference to an actual Player object.
 * Searches by name/nameEn, picks the best matching card version.
 */
function resolvePlayerByName(
  name: string,
  allPlayers: Player[],
  cardTypePreference?: string,
): Player | undefined {
  const lowerName = name.toLowerCase();

  // Find all matching players
  const matches = allPlayers.filter((p) => {
    const nameMatch = p.name.toLowerCase() === lowerName;
    const nameEnMatch = p.nameEn.toLowerCase() === lowerName;
    const partialMatch =
      p.name.toLowerCase().includes(lowerName) ||
      p.nameEn.toLowerCase().includes(lowerName);
    return nameMatch || nameEnMatch || partialMatch;
  });

  if (matches.length === 0) return undefined;

  // Deduplicate by pid, keep highest OVR version
  const bestByPid = new Map<number, Player>();
  for (const p of matches) {
    const existing = bestByPid.get(p.pid);
    if (!existing || p.stats.ovr > existing.stats.ovr) {
      bestByPid.set(p.pid, p);
    }
  }

  const candidates = Array.from(bestByPid.values());
  candidates.sort((a, b) => b.stats.ovr - a.stats.ovr);

  // If card type preference specified, try to find matching version
  if (cardTypePreference) {
    const cardType = cardTypePreference.toUpperCase();
    const cardMatch = candidates.find(
      (p) =>
        p.cardType === cardType ||
        p.seasonName.toUpperCase().includes(cardType) ||
        p.seasonSlug.toUpperCase().includes(cardType.toLowerCase()),
    );
    if (cardMatch) return cardMatch;
  }

  return candidates[0];
}

// ---------------------------------------------------------------------------
// Context Building
// ---------------------------------------------------------------------------

/**
 * Create a fresh BuildContext from parsed AI parameters and the player database.
 */
function buildBuildContext(
  params: ParsedSquadRequest,
  allPlayers: Player[],
  pinnedSpids?: number[],
): { context: BuildContext; warnings: string[] } {
  const warnings: string[] = [];
  const formation = params.formation ?? '4-3-3';

  const slots = FORMATION_SLOTS[formation];

  // Precompute chemistry links
  const links = getChemistryLinks(slots);
  const maxLinksPerSlot = getMaxLinksPerSlot(links);

  // Resolve team preferences to team IDs
  const requiredTeamIds = new Set<number>();
  const preferredTeamIds = new Set<number>();

  if (params.teams) {
    for (const teamPref of params.teams) {
      const ids = resolveTeamNameToIds(teamPref.name, allPlayers);
      if (ids.size === 0) {
        warnings.push(`Team "${teamPref.name}" not found in player database`);
        continue;
      }

      if (teamPref.strength === 'required') {
        for (const id of ids) requiredTeamIds.add(id);
      } else {
        for (const id of ids) preferredTeamIds.add(id);
      }
    }
  }

  // Resolve league preferences to league IDs
  const requiredLeagueNames = new Set<string>();
  const preferredLeagueNames = new Set<string>();

  if (params.leagues) {
    for (const leaguePref of params.leagues) {
      const ids = resolveLeagueNameToIds(leaguePref.league, allPlayers);
      if (ids.size === 0) {
        warnings.push(`League "${leaguePref.league}" not found in player database`);
        continue;
      }

      if (leaguePref.strength === 'required') {
        for (const id of ids) requiredLeagueNames.add(id);
      } else {
        for (const id of ids) preferredLeagueNames.add(id);
      }
    }
  }

  // Resolve excluded teams
  const excludedTeamIds = new Set<number>();
  if (params.excludedTeams) {
    for (const teamName of params.excludedTeams) {
      const ids = resolveTeamNameToIds(teamName, allPlayers);
      for (const id of ids) excludedTeamIds.add(id);
    }
  }

  // Resolve pinned players from name preferences
  const pinnedPlayers: Player[] = [];
  if (params.players) {
    for (const playerPref of params.players) {
      if (!playerPref.required) continue;
      const resolved = resolvePlayerByName(
        playerPref.name,
        allPlayers,
        playerPref.cardTypePreference,
      );
      if (resolved) {
        pinnedPlayers.push(resolved);
      } else {
        warnings.push(`Required player "${playerPref.name}" not found in database`);
      }
    }
  }

  // Resolve pinned players from spid array (from UI)
  if (pinnedSpids && pinnedSpids.length > 0) {
    for (const spid of pinnedSpids) {
      const found = allPlayers.find((p) => p.spid === spid);
      if (found && !pinnedPlayers.some((p) => p.spid === spid)) {
        pinnedPlayers.push(found);
      }
    }
  }

  // Combine stat priorities from explicit + playstyle defaults
  let statPriorities = params.statPriorities ?? [];
  if (params.playstyle && statPriorities.length === 0) {
    statPriorities = PLAYSTYLE_STATS[params.playstyle] ?? [];
  }

  return {
    context: {
      formation,
      slots,
      allPlayers,
      usedSpids: new Set(),
      usedPids: new Set(),
      totalCost: 0,
      placedPlayers: new Map(),

      requiredTeamIds,
      preferredTeamIds,
      requiredLeagueNames,
      preferredLeagueNames,
      excludedTeamIds,

      budget: params.budget,
      minOvr: params.minOvr,
      maxOvr: params.maxOvr,
      statPriorities,
      playstyle: params.playstyle,
      chemistry: params.chemistry,
      cardTypes: params.cardTypes ?? [],
      positionPreferences: params.positionPreferences ?? [],
      pinnedPlayers,

      links,
      maxLinksPerSlot,
    },
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Player Pool Construction
// ---------------------------------------------------------------------------

/**
 * Get compatible positions for a formation slot position.
 */
function getCompatiblePositions(slotPosition: string): Position[] {
  return SLOT_POSITION_MAP[slotPosition] ?? [slotPosition as Position];
}

/**
 * Base filter that applies to all candidates regardless of strategy.
 * These are hard constraints that must be satisfied.
 */
function baseFilter(p: Player, context: BuildContext, compatiblePositions: Position[]): boolean {
  // Already used (same card or same base player)
  if (context.usedSpids.has(p.spid)) return false;
  if (context.usedPids.has(p.pid)) return false;

  // Position compatibility
  if (!compatiblePositions.includes(p.position)) return false;

  // Excluded teams
  if (context.excludedTeamIds.has(p.teamId)) return false;

  // OVR range
  if (context.minOvr !== undefined && p.stats.ovr < context.minOvr) return false;
  if (context.maxOvr !== undefined && p.stats.ovr > context.maxOvr) return false;

  // Card type filter
  if (context.cardTypes.length > 0 && !context.cardTypes.includes(p.cardType as CardTypePreference)) {
    return false;
  }

  return true;
}

/**
 * Build a position-specific player pool with tiered fallback.
 *
 * Tier 1: Required teams only
 * Tier 2: Required + preferred teams
 * Tier 3: Required leagues
 * Tier 4: Required + preferred leagues
 * Tier 5: All players (fallback)
 *
 * Budget filtering is applied based on strictness:
 * - strict: filter out players that would exceed budget
 * - flexible/none: don't filter, use scoring penalty instead
 */
function buildPositionPool(slotPosition: string, context: BuildContext): Player[] {
  const compatiblePositions = getCompatiblePositions(slotPosition);

  // Budget check for strict mode
  const budgetFilter = (p: Player): boolean => {
    if (context.budget?.strictness === 'strict' && context.budget.max) {
      return context.totalCost + p.price <= context.budget.max;
    }
    return true;
  };

  const makeFilter = (teamFilter?: Set<number>, leagueFilter?: Set<string>) =>
    (p: Player): boolean =>
      baseFilter(p, context, compatiblePositions) &&
      budgetFilter(p) &&
      (!teamFilter || teamFilter.has(p.teamId)) &&
      (!leagueFilter || leagueFilter.has(p.leagueName));

  // Tier 1: Required teams only
  if (context.requiredTeamIds.size > 0) {
    const pool = context.allPlayers.filter(makeFilter(context.requiredTeamIds));
    if (pool.length > 0) return pool;
  }

  // Tier 2: Required + preferred teams
  if (context.requiredTeamIds.size > 0 || context.preferredTeamIds.size > 0) {
    const combined = new Set([...context.requiredTeamIds, ...context.preferredTeamIds]);
    const pool = context.allPlayers.filter(makeFilter(combined));
    if (pool.length > 0) return pool;
  }

  // Tier 3: Required leagues
  if (context.requiredLeagueNames.size > 0) {
    const pool = context.allPlayers.filter(makeFilter(undefined, context.requiredLeagueNames));
    if (pool.length > 0) return pool;
  }

  // Tier 4: Required + preferred leagues
  const allLeagues = new Set([...context.requiredLeagueNames, ...context.preferredLeagueNames]);
  if (allLeagues.size > 0) {
    const pool = context.allPlayers.filter(makeFilter(undefined, allLeagues));
    if (pool.length > 0) return pool;
  }

  // Tier 5: No team/league restriction (fallback)
  let pool = context.allPlayers.filter(makeFilter());
  if (pool.length === 0 && context.budget?.max && context.budget.strictness !== 'strict') {
    // Budget-relaxed fallback: allow exceeding budget (only for flexible/none)
    pool = context.allPlayers.filter((p) =>
      baseFilter(p, context, compatiblePositions)
    );
  }

  return pool;
}

// ---------------------------------------------------------------------------
// Player Scoring
// ---------------------------------------------------------------------------

/**
 * Score a candidate player for a formation slot.
 *
 * The total score is a weighted combination of:
 * - **OVR**: Player's overall rating (0-150 in FC Online, normalized)
 * - **Chemistry**: Estimated chemistry with already-placed players (0-100)
 * - **Stat Fit**: Match against stat priorities (0-100)
 * - **Price Efficiency**: Budget compliance and value (0-100)
 * - **Position Fit**: Direct position match vs compatible alternative (0-100)
 */
function scoreCandidate(
  player: Player,
  slotId: string,
  context: BuildContext,
  weights: SelectionWeights,
): number {
  const ovrScore = scoreOvr(player);
  const chemScore = estimateChemistryPotential(
    player,
    slotId,
    context.placedPlayers,
    context.links,
  );
  const statScore = scoreStatFit(player, context.statPriorities);
  const priceScore = scorePriceEfficiency(player, context);
  const posFitScore = scorePositionFit(player, slotId, context);

  return (
    ovrScore * weights.ovr +
    chemScore * weights.chemistry +
    statScore * weights.statPriority +
    priceScore * weights.priceEfficiency +
    posFitScore * weights.positionFit
  );
}

/** Score based on player OVR (normalized to 0-100) */
function scoreOvr(player: Player): number {
  // FC Online OVR ranges from ~40 to ~130+
  // Normalize: 70 → 0, 130 → 100
  return Math.max(0, Math.min(100, ((player.stats.ovr - 70) / 60) * 100));
}

/** Score based on stat priority fit (0-100) */
function scoreStatFit(player: Player, priorities: StatPriority[]): number {
  if (priorities.length === 0) return 50; // Neutral when no priorities

  const statValues: Record<StatPriority, number> = {
    pace: player.stats.pace,
    shooting: player.stats.shooting,
    passing: player.stats.passing,
    dribbling: player.stats.dribbling,
    defending: player.stats.defending,
    physical: player.stats.physical,
  };

  // Weighted average of priority stats (earlier priorities have higher weight)
  let totalWeight = 0;
  let weightedSum = 0;

  for (let i = 0; i < priorities.length; i++) {
    const weight = priorities.length - i; // First = highest weight
    weightedSum += statValues[priorities[i]] * weight;
    totalWeight += weight;
  }

  const avgStat = weightedSum / totalWeight;

  // Normalize: FC Online stats range ~30-140, center around 80
  return Math.max(0, Math.min(100, ((avgStat - 40) / 90) * 100));
}

/**
 * Score based on position fit and position-specific preferences.
 *
 * - Direct position match: 100
 * - Compatible alternative: 70
 * - Position-specific minStat bonus/penalty
 */
function scorePositionFit(
  player: Player,
  slotId: string,
  context: BuildContext,
): number {
  const slot = context.slots.find((s) => s.id === slotId);
  if (!slot) return 50;

  const compatiblePositions = getCompatiblePositions(slot.position);
  const isDirectMatch = compatiblePositions[0] === player.position;
  let baseScore = isDirectMatch ? 100 : 70;

  // Check position-specific preferences
  const posPref = context.positionPreferences.find(
    (pp) => pp.position === slot.position || compatiblePositions.includes(pp.position),
  );

  if (posPref?.minStats) {
    for (const [stat, minVal] of Object.entries(posPref.minStats)) {
      const actualVal = player.stats[stat as keyof typeof player.stats];
      if (actualVal < minVal) {
        baseScore -= 15; // Penalty for not meeting position-specific stat requirement
      } else {
        baseScore += 5; // Bonus for meeting requirement
      }
    }
  }

  return Math.max(0, Math.min(100, baseScore));
}

/**
 * Score based on price efficiency and budget compliance.
 *
 * - Within budget: score based on how much of remaining budget is used
 * - Over budget: penalty based on budget strictness
 * - No budget: neutral score
 */
function scorePriceEfficiency(player: Player, context: BuildContext): number {
  if (!context.budget?.max) return 50; // No budget constraint

  const wouldExceed = context.totalCost + player.price > context.budget.max;

  if (wouldExceed) {
    // Penalty based on strictness
    switch (context.budget.strictness) {
      case 'strict':
        return 0;
      case 'flexible':
        return 15;
      default: // 'none'
        return 35;
    }
  }

  // Within budget: favor cheaper players (more room for other positions)
  const budgetRatio = player.price / context.budget.max;

  if (budgetRatio < 0.03) return 100; // Very cheap
  if (budgetRatio < 0.06) return 90;
  if (budgetRatio < 0.10) return 80;
  if (budgetRatio < 0.15) return 70;
  if (budgetRatio < 0.25) return 60;
  if (budgetRatio < 0.40) return 45;
  return 30; // Expensive
}

/**
 * Apply scoring bonus for preferred team/league membership.
 */
function applyPreferenceBonus(
  player: Player,
  score: number,
  context: BuildContext,
): number {
  let bonus = 0;

  // Preferred team bonus
  if (context.preferredTeamIds.has(player.teamId)) {
    bonus += 5;
  }

  // Preferred league bonus
  if (context.preferredLeagueNames.has(player.leagueName)) {
    bonus += 3;
  }

  return score + bonus;
}

// ---------------------------------------------------------------------------
// Slot Fill Order
// ---------------------------------------------------------------------------

/**
 * Determine the order in which to fill formation slots.
 *
 * Strategy: Fill from back to front (GK → DF → MF → FW), and within each
 * category, fill positions with fewer compatible options first (hardest to fill).
 */
function getSlotFillOrder(
  slots: FormationSlot[],
  placedSlotIds: Set<string>,
): number[] {
  const remaining = slots
    .map((slot, index) => ({
      index,
      position: slot.position,
      filled: placedSlotIds.has(slot.id),
    }))
    .filter((s) => !s.filled);

  remaining.sort((a, b) => {
    // Primary: category priority (back to front)
    const aPriority = POSITION_CATEGORY_PRIORITY[a.position] ?? 5;
    const bPriority = POSITION_CATEGORY_PRIORITY[b.position] ?? 5;
    if (aPriority !== bPriority) return aPriority - bPriority;

    // Secondary: fewer compatible positions = fill first
    const aCompat = (SLOT_POSITION_MAP[a.position] ?? [a.position]).length;
    const bCompat = (SLOT_POSITION_MAP[b.position] ?? [b.position]).length;
    return aCompat - bCompat;
  });

  return remaining.map((s) => s.index);
}

// ---------------------------------------------------------------------------
// Single Squad Building
// ---------------------------------------------------------------------------

/**
 * Build a single squad candidate using the specified selection strategy.
 */
function buildSingleSquad(
  context: BuildContext,
  weights: SelectionWeights,
  strategy: GenerationStrategy,
  seedOffset: number,
): { squad: Squad; score: number; reasoning: string } | null {
  // Reset context state
  context.usedSpids = new Set();
  context.usedPids = new Set();
  context.totalCost = 0;
  context.placedPlayers = new Map();

  const squadPlayers: SquadPlayer[] = [];

  // ---- Step 1: Place pinned players ----
  const pinnedSlots: { player: Player; slotIndex: number; compatScore: number }[] = [];

  for (const pinned of context.pinnedPlayers) {
    let bestSlotIdx = -1;
    let bestCompatScore = -1;

    for (let si = 0; si < context.slots.length; si++) {
      if (context.placedPlayers.has(context.slots[si].id)) continue;

      const compatiblePositions = getCompatiblePositions(context.slots[si].position);
      const isDirectMatch = compatiblePositions[0] === pinned.position;
      const score = isDirectMatch ? 100 : compatiblePositions.includes(pinned.position) ? 60 : 0;

      if (score > bestCompatScore) {
        bestCompatScore = score;
        bestSlotIdx = si;
      }
    }

    if (bestSlotIdx >= 0 && bestCompatScore > 0) {
      pinnedSlots.push({ player: pinned, slotIndex: bestSlotIdx, compatScore: bestCompatScore });
    }
  }

  // Sort pinned players by compatibility (direct matches first)
  pinnedSlots.sort((a, b) => b.compatScore - a.compatScore);

  for (const ps of pinnedSlots) {
    const slot = context.slots[ps.slotIndex];
    context.usedSpids.add(ps.player.spid);
    context.usedPids.add(ps.player.pid);
    context.totalCost += ps.player.price;
    context.placedPlayers.set(slot.id, { player: ps.player, slotPosition: slot.id });
    squadPlayers.push({ player: ps.player, slotPosition: slot.id });
  }

  // ---- Step 2: Fill remaining slots ----
  const fillOrder = getSlotFillOrder(context.slots, new Set(context.placedPlayers.keys()));

  for (const slotIndex of fillOrder) {
    const slot = context.slots[slotIndex];

    // Build position pool with fallback
    let pool = buildPositionPool(slot.position, context);

    if (pool.length === 0) {
      // Last resort: find any compatible player, still respecting hard filters
      // (card type, OVR range, excluded teams) and budget (for strict mode)
      const compatiblePositions = getCompatiblePositions(slot.position);
      const strictBudget = context.budget?.strictness === 'strict' && context.budget.max;
      pool = context.allPlayers.filter((p) => {
        if (context.usedSpids.has(p.spid) || context.usedPids.has(p.pid)) return false;
        if (!compatiblePositions.includes(p.position)) return false;
        if (context.excludedTeamIds.has(p.teamId)) return false;
        if (context.minOvr !== undefined && p.stats.ovr < context.minOvr) return false;
        if (context.maxOvr !== undefined && p.stats.ovr > context.maxOvr) return false;
        if (context.cardTypes.length > 0 && !context.cardTypes.includes(p.cardType as CardTypePreference)) return false;
        if (strictBudget && context.totalCost + p.price > (context.budget?.max ?? Infinity)) return false;
        return true;
      });
    }

    if (pool.length === 0) continue; // No player available for this slot

    // Score all candidates
    const scored = pool.map((player) => ({
      player,
      totalScore: applyPreferenceBonus(
        player,
        scoreCandidate(player, slot.id, context, weights),
        context,
      ),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.totalScore - a.totalScore);

    // Pick from top candidates with seed-based variation for diversity
    const variation = Math.min(
      Math.floor(seededRandom(slotIndex + seedOffset * 100 + strategy.length) * 4),
      scored.length - 1,
    );
    const chosen = scored[variation] ?? scored[0];

    // Place the chosen player
    context.usedSpids.add(chosen.player.spid);
    context.usedPids.add(chosen.player.pid);
    context.totalCost += chosen.player.price;
    context.placedPlayers.set(slot.id, {
      player: chosen.player,
      slotPosition: slot.id,
    });
    squadPlayers.push({ player: chosen.player, slotPosition: slot.id });
  }

  // ---- Step 3: Build the Squad object ----
  const chemistryScore = calculateSquadChemistry(
    context.placedPlayers,
    context.links,
    context.maxLinksPerSlot,
  );

  const squad: Squad = {
    id: `squad-${Date.now()}-${seedOffset}`,
    formation: context.formation,
    players: squadPlayers,
    totalBudget: context.budget?.max ?? 0,
    totalCost: context.totalCost,
    teamColor: context.requiredTeamIds.size > 0
      ? Array.from(context.requiredTeamIds)[0].toString()
      : context.preferredTeamIds.size > 0
        ? Array.from(context.preferredTeamIds)[0].toString()
        : undefined,
    chemistryScore,
    createdAt: new Date().toISOString(),
  };

  // ---- Step 4: Calculate composite quality score ----
  const avgOvr =
    squadPlayers.length > 0
      ? squadPlayers.reduce((sum, sp) => sum + sp.player.stats.ovr, 0) / squadPlayers.length
      : 0;

  const budgetCompliance = context.budget?.max
    ? context.totalCost <= context.budget.max
      ? 100
      : Math.max(0, 100 - ((context.totalCost - context.budget.max) / context.budget.max) * 100)
    : 50;

  // Composite score: OVR + chemistry + budget compliance (all normalized 0-100)
  const ovrNorm = Math.max(0, Math.min(100, ((avgOvr - 70) / 60) * 100));
  const compositeScore = Math.round(
    ovrNorm * 0.4 + chemistryScore * 0.3 + budgetCompliance * 0.2 + (squadPlayers.length / 11) * 100 * 0.1,
  );

  // ---- Step 5: Generate reasoning string ----
  const sameTeamCount = countSameTeamLinks(context.placedPlayers, context.links);
  const sameLeagueCount = countSameLeagueLinks(context.placedPlayers, context.links);
  const budgetStr = context.budget?.max ? formatPrice(context.totalCost) : 'no limit';

  const strategyLabel: Record<GenerationStrategy, string> = {
    chemistry: 'Chemistry-focused',
    ovr: 'OVR-maximized',
    value: 'Best value',
    balanced: 'Balanced',
  };

  const pinnedNames = context.pinnedPlayers.length > 0
    ? ` with ${context.pinnedPlayers.map((p) => p.name).join(', ')} included`
    : '';

  const reasoning = [
    `${strategyLabel[strategy]} ${context.formation}${pinnedNames}`,
    `Avg OVR: ${avgOvr.toFixed(1)} | Chemistry: ${chemistryScore}`,
    `Cost: ${budgetStr} | Links: ${sameTeamCount} same-team, ${sameLeagueCount} same-league`,
  ].join('. ');

  return { squad, score: compositeScore, reasoning };
}

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

/** Deterministic pseudo-random based on seed */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// Main Entry Point
// ---------------------------------------------------------------------------

/**
 * Generate optimized squad candidates based on parsed AI parameters.
 *
 * @param params - Parsed squad request with all user preferences
 * @param allPlayers - Complete player database
 * @param options - Generation options (count, strategies, pinned spids)
 * @returns Object containing generated candidates and any warnings
 *
 * @example
 * ```typescript
 * import { generateSquads } from '@/lib/squad-generator';
 * import { playerStore } from '@/lib/player-store';
 *
 * const result = generateSquads(parsedRequest, playerStore.getAllPlayers(), {
 *   count: 3,
 *   pinnedSpids: [100190042],
 * });
 *
 * console.log(result.candidates); // 3 SquadCandidate objects
 * console.log(result.warnings);   // Any issues during generation
 * ```
 */
export function generateSquads(
  params: ParsedSquadRequest,
  allPlayers: Player[],
  options?: GenerationOptions,
): { candidates: SquadCandidate[]; warnings: string[] } {
  const count = Math.min(options?.count ?? 3, 5);
  const strategies = options?.strategies ?? (['chemistry', 'ovr', 'value'] as GenerationStrategy[]);

  // Build the context (shared structure, state reset per candidate)
  const { context: baseContext, warnings } = buildBuildContext(
    params,
    allPlayers,
    options?.pinnedSpids,
  );

  // Generate candidates with different strategies
  const candidates: SquadCandidate[] = [];

  for (let i = 0; i < count; i++) {
    const strategy = strategies[i % strategies.length];
    const weights = STRATEGY_WEIGHTS[strategy];

    // Create a fresh context copy for this candidate
    const context: BuildContext = {
      ...baseContext,
      usedSpids: new Set(),
      usedPids: new Set(),
      totalCost: 0,
      placedPlayers: new Map(),
      // Clone sets to avoid mutation across candidates
      requiredTeamIds: new Set(baseContext.requiredTeamIds),
      preferredTeamIds: new Set(baseContext.preferredTeamIds),
      requiredLeagueNames: new Set(baseContext.requiredLeagueNames),
      preferredLeagueNames: new Set(baseContext.preferredLeagueNames),
      excludedTeamIds: new Set(baseContext.excludedTeamIds),
      pinnedPlayers: [...baseContext.pinnedPlayers],
    };

    const result = buildSingleSquad(context, weights, strategy, i);

    if (result) {
      candidates.push({
        squad: result.squad,
        score: result.score,
        reasoning: result.reasoning,
      });
    }
  }

  // Sort candidates by composite score descending
  candidates.sort((a, b) => b.score - a.score);

  return { candidates, warnings };
}
