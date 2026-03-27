/**
 * Unit tests for squad-defaults constants.
 *
 * Tests cover:
 * 1. DEFAULT_FORMATION is a valid formation
 * 2. META_FORMATIONS is a non-empty subset of all formations
 * 3. FORMATIONS_ORDERED puts meta formations before non-meta
 * 4. BUDGET_PRESETS are sorted ascending and within bounds
 * 5. BUDGET_TIERS are ordered by maxEok ascending
 * 6. AVERAGE_BUDGET_EOK is within budget bounds
 * 7. getFormationMeta returns correct metadata
 * 8. eokToBp / bpToEok conversions are correct
 */

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_FORMATION,
  DEFAULT_PLAYSTYLE,
  DEFAULT_BUDGET_STRICTNESS,
  META_FORMATIONS,
  FORMATIONS_ORDERED,
  ALL_FORMATIONS,
  FORMATION_META_LIST,
  BUDGET_BOUNDS,
  BUDGET_PRESETS,
  BUDGET_TIERS,
  AVERAGE_BUDGET_EOK,
  getFormationMeta,
  eokToBp,
  bpToEok,
  applySquadDefaults,
} from '@/constants/squad-defaults';
import type { ParsedSquadRequest } from '@/lib/ai/types';
import { FORMATIONS, FORMATION_SLOTS } from '@/types/squad';

// ---------------------------------------------------------------------------
// 1. DEFAULT_FORMATION
// ---------------------------------------------------------------------------

describe('DEFAULT_FORMATION', () => {
  it('should be "4-3-3"', () => {
    expect(DEFAULT_FORMATION).toBe('4-3-3');
  });

  it('should exist in the FORMATIONS type array', () => {
    expect(FORMATIONS).toContain(DEFAULT_FORMATION);
  });

  it('should have valid slot definitions', () => {
    const slots = FORMATION_SLOTS[DEFAULT_FORMATION];
    expect(slots).toBeDefined();
    expect(slots.length).toBe(11); // 10 outfield + 1 GK
  });
});

// ---------------------------------------------------------------------------
// 2. META_FORMATIONS
// ---------------------------------------------------------------------------

describe('META_FORMATIONS', () => {
  it('should be a non-empty array', () => {
    expect(Array.isArray(META_FORMATIONS)).toBe(true);
    expect(META_FORMATIONS.length).toBeGreaterThan(0);
  });

  it('should contain only valid formations', () => {
    for (const f of META_FORMATIONS) {
      expect(FORMATIONS).toContain(f);
    }
  });

  it('should be a proper subset of ALL_FORMATIONS', () => {
    expect(META_FORMATIONS.length).toBeLessThan(ALL_FORMATIONS.length);
  });

  it('should include the most popular FC Online formations', () => {
    expect(META_FORMATIONS).toContain('4-3-3');
    expect(META_FORMATIONS).toContain('4-2-3-1');
    expect(META_FORMATIONS).toContain('4-4-2');
  });
});

// ---------------------------------------------------------------------------
// 3. FORMATIONS_ORDERED
// ---------------------------------------------------------------------------

describe('FORMATIONS_ORDERED', () => {
  it('should contain all formations', () => {
    for (const f of FORMATIONS) {
      expect(ALL_FORMATIONS).toContain(f);
    }
  });

  it('should place meta formations before non-meta formations', () => {
    const lastMetaIndex = FORMATIONS_ORDERED.reduce((last, f, i) => {
      return META_FORMATIONS.includes(f) ? i : last;
    }, -1);
    const firstNonMetaIndex = FORMATIONS_ORDERED.findIndex(
      (f) => !META_FORMATIONS.includes(f),
    );

    // If there are both meta and non-meta, meta should come first
    if (lastMetaIndex >= 0 && firstNonMetaIndex >= 0) {
      expect(lastMetaIndex).toBeLessThan(firstNonMetaIndex);
    }
  });

  it('should start with the default formation', () => {
    expect(FORMATIONS_ORDERED[0]).toBe(DEFAULT_FORMATION);
  });
});

// ---------------------------------------------------------------------------
// 4. FORMATION_META_LIST
// ---------------------------------------------------------------------------

describe('FORMATION_META_LIST', () => {
  it('should have metadata for every formation', () => {
    expect(FORMATION_META_LIST.length).toBe(ALL_FORMATIONS.length);
  });

  it('each entry should have required fields', () => {
    for (const meta of FORMATION_META_LIST) {
      expect(meta.id).toBeTruthy();
      expect(meta.descriptionKo).toBeTruthy();
      expect(meta.descriptionEn).toBeTruthy();
      expect(typeof meta.isMeta).toBe('boolean');
      expect(Array.isArray(meta.playstyles)).toBe(true);
      expect(meta.playstyles.length).toBeGreaterThan(0);
    }
  });

  it('meta entries should have isMeta=true and non-meta should have isMeta=false', () => {
    const metaCount = FORMATION_META_LIST.filter((m) => m.isMeta).length;
    const nonMetaCount = FORMATION_META_LIST.filter((m) => !m.isMeta).length;
    expect(metaCount).toBe(META_FORMATIONS.length);
    expect(metaCount + nonMetaCount).toBe(FORMATION_META_LIST.length);
  });
});

// ---------------------------------------------------------------------------
// 5. BUDGET_PRESETS
// ---------------------------------------------------------------------------

describe('BUDGET_PRESETS', () => {
  it('should be a non-empty tuple of numbers', () => {
    expect(BUDGET_PRESETS.length).toBeGreaterThan(0);
    for (const p of BUDGET_PRESETS) {
      expect(typeof p).toBe('number');
    }
  });

  it('should be sorted in ascending order', () => {
    const sorted = [...BUDGET_PRESETS].sort((a, b) => a - b);
    expect([...BUDGET_PRESETS]).toEqual(sorted);
  });

  it('all presets should be within budget bounds', () => {
    for (const p of BUDGET_PRESETS) {
      expect(p).toBeGreaterThanOrEqual(BUDGET_BOUNDS.MIN);
      expect(p).toBeLessThanOrEqual(BUDGET_BOUNDS.MAX);
    }
  });

  it('should include common budget tiers', () => {
    expect(BUDGET_PRESETS).toContain(5);
    expect(BUDGET_PRESETS).toContain(50);
    expect(BUDGET_PRESETS).toContain(100);
  });
});

// ---------------------------------------------------------------------------
// 6. BUDGET_TIERS
// ---------------------------------------------------------------------------

describe('BUDGET_TIERS', () => {
  it('should be ordered by maxEok ascending', () => {
    for (let i = 1; i < BUDGET_TIERS.length; i++) {
      expect(BUDGET_TIERS[i].maxEok).toBeGreaterThanOrEqual(BUDGET_TIERS[i - 1].maxEok);
    }
  });

  it('should include a budget, mid, and unlimited tier', () => {
    const keys = BUDGET_TIERS.map((t) => t.key);
    expect(keys).toContain('budget');
    expect(keys).toContain('mid');
    expect(keys).toContain('unlimited');
  });

  it('unlimited tier should use BUDGET_BOUNDS.MAX', () => {
    const unlimited = BUDGET_TIERS.find((t) => t.key === 'unlimited');
    expect(unlimited?.maxEok).toBe(BUDGET_BOUNDS.MAX);
  });

  it('each tier should have Korean and English labels', () => {
    for (const tier of BUDGET_TIERS) {
      expect(tier.labelKo).toBeTruthy();
      expect(tier.labelEn).toBeTruthy();
    }
  });

  it('each tier should have vague term mappings', () => {
    for (const tier of BUDGET_TIERS) {
      expect(Array.isArray(tier.vagueTerms.ko)).toBe(true);
      expect(Array.isArray(tier.vagueTerms.en)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 7. BUDGET_BOUNDS & AVERAGE_BUDGET_EOK
// ---------------------------------------------------------------------------

describe('BUDGET_BOUNDS', () => {
  it('should have MIN=0, MAX=2000, STEP=1', () => {
    expect(BUDGET_BOUNDS.MIN).toBe(0);
    expect(BUDGET_BOUNDS.MAX).toBe(2000);
    expect(BUDGET_BOUNDS.STEP).toBe(1);
  });
});

describe('AVERAGE_BUDGET_EOK', () => {
  it('should be within budget bounds', () => {
    expect(AVERAGE_BUDGET_EOK).toBeGreaterThanOrEqual(BUDGET_BOUNDS.MIN);
    expect(AVERAGE_BUDGET_EOK).toBeLessThanOrEqual(BUDGET_BOUNDS.MAX);
  });

  it('should be a reasonable mid-range value', () => {
    // Average budget should be at least 1억 and at most 200억
    expect(AVERAGE_BUDGET_EOK).toBeGreaterThanOrEqual(1);
    expect(AVERAGE_BUDGET_EOK).toBeLessThanOrEqual(200);
  });
});

// ---------------------------------------------------------------------------
// 8. getFormationMeta
// ---------------------------------------------------------------------------

describe('getFormationMeta', () => {
  it('should return metadata for known formations', () => {
    const meta = getFormationMeta('4-3-3');
    expect(meta).toBeDefined();
    expect(meta!.id).toBe('4-3-3');
    expect(meta!.isMeta).toBe(true);
    expect(meta!.descriptionKo).toBeTruthy();
  });

  it('should return undefined for unknown formations', () => {
    const meta = getFormationMeta('1-0-0' as any);
    expect(meta).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 9. eokToBp / bpToEok
// ---------------------------------------------------------------------------

describe('eokToBp', () => {
  it('should convert 억 to BP correctly', () => {
    expect(eokToBp(1)).toBe(100_000_000);
    expect(eokToBp(10)).toBe(1_000_000_000);
    expect(eokToBp(0)).toBe(0);
  });
});

describe('bpToEok', () => {
  it('should convert BP to 억 correctly', () => {
    expect(bpToEok(100_000_000)).toBe(1);
    expect(bpToEok(1_000_000_000)).toBe(10);
    expect(bpToEok(0)).toBe(0);
  });

  it('should round to 1 decimal place', () => {
    expect(bpToEok(50_000_000)).toBe(0.5);
    expect(bpToEok(333_333_333)).toBe(3.3);
  });
});

describe('eokToBp / bpToEok roundtrip', () => {
  it('should roundtrip cleanly for whole 억 values', () => {
    const values = [1, 5, 10, 50, 100, 500, 1000];
    for (const v of values) {
      expect(bpToEok(eokToBp(v))).toBe(v);
    }
  });
});

// ---------------------------------------------------------------------------
// 10. DEFAULT_PLAYSTYLE & DEFAULT_BUDGET_STRICTNESS
// ---------------------------------------------------------------------------

describe('DEFAULT_PLAYSTYLE', () => {
  it('should be "balanced"', () => {
    expect(DEFAULT_PLAYSTYLE).toBe('balanced');
  });
});

describe('DEFAULT_BUDGET_STRICTNESS', () => {
  it('should be "flexible"', () => {
    expect(DEFAULT_BUDGET_STRICTNESS).toBe('flexible');
  });
});

// ---------------------------------------------------------------------------
// 11. applySquadDefaults
// ---------------------------------------------------------------------------

describe('applySquadDefaults', () => {
  // -----------------------------------------------------------------------
  // 11a. Both formation and budget missing → both get defaults
  // -----------------------------------------------------------------------
  it('should fill in default formation and budget when both are missing', () => {
    const request: ParsedSquadRequest = { confidence: 0.5 };
    const { request: result, applied } = applySquadDefaults(request);

    expect(result.formation).toBe(DEFAULT_FORMATION);
    expect(applied.formation).toBe(true);

    expect(result.budget).toBeDefined();
    expect(result.budget!.max).toBe(eokToBp(AVERAGE_BUDGET_EOK));
    expect(result.budget!.strictness).toBe(DEFAULT_BUDGET_STRICTNESS);
    expect(applied.budget).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 11b. Formation present, budget missing → only budget gets default
  // -----------------------------------------------------------------------
  it('should not override formation when it is already set', () => {
    const request: ParsedSquadRequest = {
      formation: '4-2-3-1',
      confidence: 0.7,
    };
    const { request: result, applied } = applySquadDefaults(request);

    expect(result.formation).toBe('4-2-3-1');
    expect(applied.formation).toBe(false);

    // Budget should still be filled
    expect(result.budget).toBeDefined();
    expect(result.budget!.max).toBe(eokToBp(AVERAGE_BUDGET_EOK));
    expect(applied.budget).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 11c. Budget present, formation missing → only formation gets default
  // -----------------------------------------------------------------------
  it('should not override budget when it is already set', () => {
    const request: ParsedSquadRequest = {
      budget: { max: 1_000_000_000, strictness: 'strict' },
      confidence: 0.8,
    };
    const { request: result, applied } = applySquadDefaults(request);

    expect(result.budget).toBeDefined();
    expect(result.budget!.max).toBe(1_000_000_000);
    expect(result.budget!.strictness).toBe('strict');
    expect(applied.budget).toBe(false);

    // Formation should still be filled
    expect(result.formation).toBe(DEFAULT_FORMATION);
    expect(applied.formation).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 11d. Both present → nothing gets overridden
  // -----------------------------------------------------------------------
  it('should not override anything when both formation and budget are set', () => {
    const request: ParsedSquadRequest = {
      formation: '3-5-2',
      budget: { max: 500_000_000, min: 100_000_000, strictness: 'none' },
      confidence: 0.9,
    };
    const { request: result, applied } = applySquadDefaults(request);

    expect(result.formation).toBe('3-5-2');
    expect(applied.formation).toBe(false);

    expect(result.budget!.max).toBe(500_000_000);
    expect(result.budget!.min).toBe(100_000_000);
    expect(result.budget!.strictness).toBe('none');
    expect(applied.budget).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 11e. Budget with min but no max is treated as "present"
  // -----------------------------------------------------------------------
  it('should treat budget with min but no max as present and not override', () => {
    const request: ParsedSquadRequest = {
      budget: { min: 100_000_000, strictness: 'flexible' },
      confidence: 0.6,
    };
    const { request: result, applied } = applySquadDefaults(request);

    expect(result.budget!.min).toBe(100_000_000);
    expect(applied.budget).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 11f. Budget with only strictness (no max, no min) → gets default
  // -----------------------------------------------------------------------
  it('should override budget that has only strictness but no max/min', () => {
    const request: ParsedSquadRequest = {
      budget: { strictness: 'strict' },
      confidence: 0.5,
    };
    const { request: result, applied } = applySquadDefaults(request);

    expect(applied.budget).toBe(true);
    expect(result.budget!.max).toBe(eokToBp(AVERAGE_BUDGET_EOK));
  });

  // -----------------------------------------------------------------------
  // 11g. Override formation when request doesn't have one
  // -----------------------------------------------------------------------
  it('should use override formation when request has no formation', () => {
    const request: ParsedSquadRequest = { confidence: 0.5 };
    const { request: result, applied } = applySquadDefaults(request, {
      formation: '4-4-2',
    });

    expect(result.formation).toBe('4-4-2');
    expect(applied.formation).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 11h. Override formation should NOT win over request's own formation
  // -----------------------------------------------------------------------
  it('should not use override formation when request already has one', () => {
    const request: ParsedSquadRequest = {
      formation: '5-3-2',
      confidence: 0.5,
    };
    const { request: result, applied } = applySquadDefaults(request, {
      formation: '4-4-2',
    });

    expect(result.formation).toBe('5-3-2');
    expect(applied.formation).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 11i. Override budget when request doesn't have one
  // -----------------------------------------------------------------------
  it('should use override budget when request has no budget', () => {
    const request: ParsedSquadRequest = { confidence: 0.5 };
    const { request: result, applied } = applySquadDefaults(request, {
      budgetMax: 2_000_000_000,
      budgetMin: 500_000_000,
    });

    expect(result.budget!.max).toBe(2_000_000_000);
    expect(result.budget!.min).toBe(500_000_000);
    expect(result.budget!.strictness).toBe(DEFAULT_BUDGET_STRICTNESS);
    expect(applied.budget).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 11j. Override budget should NOT win over request's own budget
  // -----------------------------------------------------------------------
  it('should not use override budget when request already has one', () => {
    const request: ParsedSquadRequest = {
      budget: { max: 3_000_000_000, strictness: 'strict' },
      confidence: 0.5,
    };
    const { request: result, applied } = applySquadDefaults(request, {
      budgetMax: 1_000_000_000,
    });

    expect(result.budget!.max).toBe(3_000_000_000);
    expect(result.budget!.strictness).toBe('strict');
    expect(applied.budget).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 11k. Default budget uses AVERAGE_BUDGET_EOK converted to raw BP
  // -----------------------------------------------------------------------
  it('should convert AVERAGE_BUDGET_EOK to raw BP for default budget', () => {
    const request: ParsedSquadRequest = { confidence: 0.5 };
    const { request: result } = applySquadDefaults(request);

    expect(result.budget!.max).toBe(AVERAGE_BUDGET_EOK * 100_000_000);
    expect(result.budget!.max).toBe(eokToBp(AVERAGE_BUDGET_EOK));
  });

  // -----------------------------------------------------------------------
  // 11l. Preserves all other fields from the original request
  // -----------------------------------------------------------------------
  it('should preserve all other fields from the original request', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      budget: { max: 1_000_000_000, strictness: 'flexible' },
      teams: [{ name: 'Manchester City', strength: 'required' }],
      leagues: [{ league: 'EPL', strength: 'preferred' }],
      playstyle: 'attacking',
      statPriorities: ['pace', 'shooting'],
      chemistry: { priority: 'high', sameTeamLinks: true, sameLeagueLinks: false, sameNationalityLinks: false },
      minOvr: 80,
      maxOvr: 95,
      confidence: 0.85,
      warnings: ['test warning'],
    };
    const { request: result } = applySquadDefaults(request);

    expect(result.formation).toBe('4-3-3');
    expect(result.budget!.max).toBe(1_000_000_000);
    expect(result.teams).toEqual([{ name: 'Manchester City', strength: 'required' }]);
    expect(result.leagues).toEqual([{ league: 'EPL', strength: 'preferred' }]);
    expect(result.playstyle).toBe('attacking');
    expect(result.statPriorities).toEqual(['pace', 'shooting']);
    expect(result.chemistry).toBeDefined();
    expect(result.chemistry!.priority).toBe('high');
    expect(result.minOvr).toBe(80);
    expect(result.maxOvr).toBe(95);
    expect(result.confidence).toBe(0.85);
    expect(result.warnings).toEqual(['test warning']);
  });

  // -----------------------------------------------------------------------
  // 11m. Fills in strictness when budget is present but missing strictness
  // -----------------------------------------------------------------------
  it('should fill in default strictness when budget has max but no strictness', () => {
    const request: ParsedSquadRequest = {
      budget: { max: 1_000_000_000 },
      confidence: 0.5,
    };
    const { request: result, applied } = applySquadDefaults(request);

    expect(result.budget!.max).toBe(1_000_000_000);
    expect(result.budget!.strictness).toBe(DEFAULT_BUDGET_STRICTNESS);
    // Budget was present (has max), so applied.budget should be false
    expect(applied.budget).toBe(false);
  });

  // -----------------------------------------------------------------------
  // 11n. Empty request (only confidence) gets full defaults
  // -----------------------------------------------------------------------
  it('should apply both defaults to a minimal request with only confidence', () => {
    const request: ParsedSquadRequest = { confidence: 0.5 };
    const { request: result, applied } = applySquadDefaults(request);

    expect(result.formation).toBe(DEFAULT_FORMATION);
    expect(result.budget).toBeDefined();
    expect(result.budget!.max).toBe(eokToBp(AVERAGE_BUDGET_EOK));
    expect(applied.formation).toBe(true);
    expect(applied.budget).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 11o. Null formation treated as missing
  // -----------------------------------------------------------------------
  it('should treat null formation as missing and apply default', () => {
    const request: ParsedSquadRequest = {
      formation: null,
      confidence: 0.5,
    };
    const { request: result, applied } = applySquadDefaults(request);

    expect(result.formation).toBe(DEFAULT_FORMATION);
    expect(applied.formation).toBe(true);
  });
});
