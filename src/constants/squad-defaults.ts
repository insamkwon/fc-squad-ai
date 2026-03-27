/**
 * Application-level defaults for squad building.
 *
 * Centralises the default formation, meta formation ordering,
 * budget presets/tiers, and budget slider bounds so that every
 * component and module reads from a single source of truth.
 */

import type { Formation } from '@/types/squad';
import { FORMATIONS } from '@/types/squad';
import type { ParsedSquadRequest, Playstyle } from '@/lib/ai/types';

// ---------------------------------------------------------------------------
// Default Formation
// ---------------------------------------------------------------------------

/** The formation selected when the user has not specified one. */
export const DEFAULT_FORMATION: Formation = '4-3-3';

// ---------------------------------------------------------------------------
// Meta Formations
// ---------------------------------------------------------------------------

/**
 * Metadata for a formation: a short Korean description and playstyle tags
 * that help the AI and UI present the formation to the user.
 */
export interface FormationMeta {
  /** The formation identifier (e.g. "4-3-3") */
  id: Formation;
  /** Short Korean description of the formation's style */
  descriptionKo: string;
  /** Short English description */
  descriptionEn: string;
  /** Whether this formation is considered "meta" (widely popular) */
  isMeta: boolean;
  /** Playstyle tags for AI matching */
  playstyles: string[];
}

/**
 * Ordered list of formations with metadata.
 * Meta formations appear first; the remaining follow.
 */
export const FORMATION_META_LIST: FormationMeta[] = [
  // ── Meta (popular / highly used) ────────────────────────────────────
  {
    id: '4-3-3',
    descriptionKo: '가장 인기 있는 공격 포메이션. 윙어와 중앙 미드필더의 밸런스가 좋음',
    descriptionEn: 'Most popular attacking formation. Balanced wingers and central midfield.',
    isMeta: true,
    playstyles: ['attacking', 'balanced', 'counter-attack'],
  },
  {
    id: '4-2-3-1',
    descriptionKo: '밸런스형 포메이션. 더블 앵커와 공격형 미드필더 조합',
    descriptionEn: 'Balanced formation. Double pivot with attacking midfielders.',
    isMeta: true,
    playstyles: ['balanced', 'possession', 'counter-attack'],
  },
  {
    id: '4-4-2',
    descriptionKo: '두 명의 스트라이커를 활용한 전통적인 공격 포메이션',
    descriptionEn: 'Classic two-striker formation with wide midfielders.',
    isMeta: true,
    playstyles: ['attacking', 'balanced', 'counter-attack'],
  },
  {
    id: '3-5-2',
    descriptionKo: '윙백을 활용한 공격적인 측면 전개',
    descriptionEn: 'Wing-back based attacking formation with two strikers.',
    isMeta: true,
    playstyles: ['attacking', 'counter-attack'],
  },
  {
    id: '4-1-4-1',
    descriptionKo: '수비형 미드필더 한 명이 중앙을 커버하는 안정적인 포메이션',
    descriptionEn: 'Defensive midfield anchor with a flat four behind a lone striker.',
    isMeta: true,
    playstyles: ['defensive', 'balanced', 'possession'],
  },
  {
    id: '3-4-3',
    descriptionKo: '3백과 윙어를 활용한 공격 위주 포메이션',
    descriptionEn: 'Three centre-backs with attacking wingers.',
    isMeta: true,
    playstyles: ['attacking', 'high-press'],
  },
  // ── Non-meta (less common / situational) ──────────────────────────
  {
    id: '4-5-1',
    descriptionKo: '미드필더를 5명 배치하여 볼 점유율을 높이는 포메이션',
    descriptionEn: 'Five midfielders for ball control and pressing.',
    isMeta: false,
    playstyles: ['possession', 'defensive'],
  },
  {
    id: '4-3-2-1',
    descriptionKo: '좁은 크리스마스 트리 형태의 미드필드 배치',
    descriptionEn: 'Narrow "Christmas tree" midfield shape.',
    isMeta: false,
    playstyles: ['possession', 'balanced'],
  },
  {
    id: '4-4-1-1',
    descriptionKo: '세컨드 스트라이커를 둔 4-4-2 변형',
    descriptionEn: '4-4-2 variant with a second striker behind the main forward.',
    isMeta: false,
    playstyles: ['balanced', 'possession'],
  },
  {
    id: '3-4-1-2',
    descriptionKo: '3백 위주로 공격 미드필더와 두 스트라이커를 활용',
    descriptionEn: 'Three-back with CAM and two strikers.',
    isMeta: false,
    playstyles: ['balanced', 'attacking'],
  },
  {
    id: '5-3-2',
    descriptionKo: '5백 체제로 수비를 튼튼하게 하는 포메이션',
    descriptionEn: 'Five-back defensive formation with two strikers.',
    isMeta: false,
    playstyles: ['defensive', 'park-the-bus'],
  },
  {
    id: '5-4-1',
    descriptionKo: '최대 수비력을 자랑하는 초수비형 포메이션',
    descriptionEn: 'Ultra-defensive five-back with a lone striker.',
    isMeta: false,
    playstyles: ['park-the-bus', 'defensive'],
  },
];

/** Shorthand: only the meta formation identifiers (in popularity order). */
export const META_FORMATIONS: Formation[] = FORMATION_META_LIST
  .filter((m) => m.isMeta)
  .map((m) => m.id);

/**
 * Look up formation metadata by ID.
 * Returns `undefined` for unknown formations.
 */
export function getFormationMeta(id: Formation): FormationMeta | undefined {
  return FORMATION_META_LIST.find((m) => m.id === id);
}

/**
 * Formations ordered for display: meta first, then non-meta.
 * This is the same order as `FORMATION_META_LIST` but as a plain array of IDs.
 */
export const FORMATIONS_ORDERED: Formation[] = FORMATION_META_LIST.map((m) => m.id);

/**
 * All formations, including any that exist in the type system but may not yet
 * have explicit metadata.  Guaranteed to be a superset of `FORMATIONS_ORDERED`.
 */
export const ALL_FORMATIONS: Formation[] = [...new Set([...FORMATIONS_ORDERED, ...FORMATIONS])];

// ---------------------------------------------------------------------------
// Budget Configuration
// ---------------------------------------------------------------------------

/** Absolute slider bounds (in 억 / 100M units). */
export const BUDGET_BOUNDS = {
  /** Minimum selectable budget */
  MIN: 0,
  /** Maximum selectable budget */
  MAX: 2000,
  /** Slider step increment */
  STEP: 1,
} as const;

/**
 * Quick-select budget preset buttons.
 * Values are in 억 (1억 = 100,000,000 BP).
 */
export const BUDGET_PRESETS = [5, 10, 50, 100, 500, 1000] as const;

/**
 * Budget tier definitions with labels and descriptions.
 * Useful for AI prompt context and UI display.
 */
export interface BudgetTier {
  /** Internal tier key */
  key: string;
  /** Display label (Korean) */
  labelKo: string;
  /** Display label (English) */
  labelEn: string;
  /** Maximum budget in 억 */
  maxEok: number;
  /** Vague-term mapping: words that map to this tier */
  vagueTerms: { ko: string[]; en: string[] };
}

export const BUDGET_TIERS: BudgetTier[] = [
  {
    key: 'budget',
    labelKo: '가성비 (5억 이하)',
    labelEn: 'Budget (≤500M)',
    maxEok: 5,
    vagueTerms: { ko: ['가성비', '저렴', '싸게'], en: ['cheap', 'budget', 'affordable'] },
  },
  {
    key: 'low',
    labelKo: '보급형 (10억 이하)',
    labelEn: 'Entry (≤1B)',
    maxEok: 10,
    vagueTerms: { ko: ['보급', '입문'], en: ['starter', 'entry', 'low-end'] },
  },
  {
    key: 'mid',
    labelKo: '중급형 (50억 이하)',
    labelEn: 'Mid (≤5B)',
    maxEok: 50,
    vagueTerms: { ko: ['중급', '적당'], en: ['mid-range', 'reasonable', 'mid'] },
  },
  {
    key: 'high',
    labelKo: '고급형 (100억 이하)',
    labelEn: 'High (≤10B)',
    maxEok: 100,
    vagueTerms: { ko: ['고급', '좋은'], en: ['good', 'high-end', 'quality'] },
  },
  {
    key: 'premium',
    labelKo: '최고급 (500억 이하)',
    labelEn: 'Premium (≤50B)',
    maxEok: 500,
    vagueTerms: { ko: ['최고급', '프리미엄'], en: ['premium', 'top', 'expensive'] },
  },
  {
    key: 'unlimited',
    labelKo: '무제한',
    labelEn: 'Unlimited',
    maxEok: BUDGET_BOUNDS.MAX,
    vagueTerms: { ko: ['무제한', '상관없어', '예산무제한'], en: ['unlimited', 'no limit', 'any budget'] },
  },
];

/**
 * The average / recommended default budget for first-time users (in 억).
 * Used as the initial value when no budget is specified.
 */
export const AVERAGE_BUDGET_EOK = 50;

/**
 * Convert 억 units to raw BP (multiply by 100,000,000).
 */
export function eokToBp(eok: number): number {
  return eok * 100_000_000;
}

/**
 * Convert raw BP to 억 units (divide by 100,000,000, rounded to 1 decimal).
 */
export function bpToEok(bp: number): number {
  return Math.round((bp / 100_000_000) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Pipeline Default Application
// ---------------------------------------------------------------------------

/** Default playstyle when the user hasn't specified one. */
export const DEFAULT_PLAYSTYLE: Playstyle = 'balanced';

/** Default budget strictness when auto-applying defaults. */
export const DEFAULT_BUDGET_STRICTNESS: 'strict' | 'flexible' | 'none' = 'flexible';

/**
 * Result of applying defaults, indicating which fields were filled in.
 * Useful for UI feedback (e.g., "Using default formation 4-3-3").
 */
export interface AppliedDefaults {
  /** Formation was auto-filled */
  formation: boolean;
  /** Budget was auto-filled */
  budget: boolean;
}

/**
 * Apply default values to a `ParsedSquadRequest` so that the squad generator
 * always receives a complete set of parameters.
 *
 * This function is the **single source of truth** for pipeline defaults. It
 * should be called once, right before the recommendation engine runs, in
 * both `/api/squad` and `/api/chat` routes.
 *
 * Resolution order (highest priority first):
 *   1. Values already present on the request
 *   2. UI-selected overrides passed via `overrides`
 *   3. Application-level constants (`DEFAULT_FORMATION`, `AVERAGE_BUDGET_EOK`, …)
 *
 * @param request - The parsed squad request (may have missing fields)
 * @param overrides - Optional UI-selected values that take precedence over defaults
 *   but lower precedence than values already on the request
 * @returns A new `ParsedSquadRequest` with all defaults filled in, plus a record
 *   of which fields were auto-filled
 */
export function applySquadDefaults(
  request: ParsedSquadRequest,
  overrides?: {
    formation?: Formation;
    budgetMax?: number;   // in raw BP (not 억)
    budgetMin?: number;   // in raw BP
  },
): { request: ParsedSquadRequest; applied: AppliedDefaults } {
  const applied: AppliedDefaults = { formation: false, budget: false };

  // --- Formation ---
  // Priority: request.formation > overrides.formation > DEFAULT_FORMATION
  let resolvedFormation: Formation;
  if (request.formation) {
    resolvedFormation = request.formation;
  } else if (overrides?.formation) {
    resolvedFormation = overrides.formation;
    applied.formation = true;
  } else {
    resolvedFormation = DEFAULT_FORMATION;
    applied.formation = true;
  }

  // --- Budget ---
  // Budget is considered "present" if it has a max or min value.
  // Priority: request.budget > overrides budget > AVERAGE_BUDGET_EOK default
  let resolvedBudget = request.budget;
  const hasBudget = resolvedBudget && (resolvedBudget.max != null || resolvedBudget.min != null);

  if (!hasBudget) {
    const overrideMax = overrides?.budgetMax != null ? overrides.budgetMax : undefined;
    const overrideMin = overrides?.budgetMin != null ? overrides.budgetMin : undefined;

    if (overrideMax != null || overrideMin != null) {
      resolvedBudget = {
        max: overrideMax,
        min: overrideMin,
        strictness: DEFAULT_BUDGET_STRICTNESS,
      };
      applied.budget = true;
    } else {
      // Apply the application-level default budget
      resolvedBudget = {
        max: eokToBp(AVERAGE_BUDGET_EOK),
        strictness: DEFAULT_BUDGET_STRICTNESS,
      };
      applied.budget = true;
    }
  } else if (resolvedBudget && resolvedBudget.strictness == null) {
    // Budget was provided by the request but missing strictness — fill it
    resolvedBudget = { ...resolvedBudget, strictness: DEFAULT_BUDGET_STRICTNESS };
  }

  // --- Build enriched request ---
  const enriched: ParsedSquadRequest = {
    ...request,
    formation: resolvedFormation,
    budget: resolvedBudget,
  };

  return { request: enriched, applied };
}
