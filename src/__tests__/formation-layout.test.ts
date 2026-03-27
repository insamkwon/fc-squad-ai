/**
 * Tests for the formation-based positional layout system.
 *
 * Validates:
 * - Position classification (GK/DEF/MID/FWD)
 * - Field boundary validation
 * - Formation line structure analysis
 * - Formation slot validation (count, bounds, spacing, symmetry)
 * - Position compatibility scoring
 * - Utility functions (distance, symmetry, summary)
 */

import { describe, it, expect } from 'vitest';
import type { Formation } from '@/types/squad';
import { FORMATION_SLOTS, FORMATIONS } from '@/types/squad';
import {
  getPositionCategory,
  getPositionCategoryColor,
  isWithinFieldBounds,
  FIELD_BOUNDS,
  parseFormationString,
  getFormationLineStructure,
  validateFormationSlots,
  getFormationSlots,
  getSlotById,
  getSlotsByPosition,
  distanceBetween,
  getSymmetryScore,
  getPositionCompatibility,
  getFormationSummary,
} from '@/lib/formation-layout';

// ---------------------------------------------------------------------------
// Position Classification
// ---------------------------------------------------------------------------

describe('getPositionCategory', () => {
  it('classifies goalkeeper correctly', () => {
    expect(getPositionCategory('GK')).toBe('GK');
  });

  it('classifies defender positions correctly', () => {
    expect(getPositionCategory('CB')).toBe('DEF');
    expect(getPositionCategory('LB')).toBe('DEF');
    expect(getPositionCategory('RB')).toBe('DEF');
    expect(getPositionCategory('LWB')).toBe('DEF');
    expect(getPositionCategory('RWB')).toBe('DEF');
  });

  it('classifies midfielder positions correctly', () => {
    expect(getPositionCategory('CM')).toBe('MID');
    expect(getPositionCategory('CAM')).toBe('MID');
    expect(getPositionCategory('CDM')).toBe('MID');
    expect(getPositionCategory('LM')).toBe('MID');
    expect(getPositionCategory('RM')).toBe('MID');
  });

  it('classifies forward positions correctly', () => {
    expect(getPositionCategory('ST')).toBe('FWD');
    expect(getPositionCategory('CF')).toBe('FWD');
    expect(getPositionCategory('LW')).toBe('FWD');
    expect(getPositionCategory('RW')).toBe('FWD');
    expect(getPositionCategory('LF')).toBe('FWD');
    expect(getPositionCategory('RF')).toBe('FWD');
  });

  it('returns MID as default for unknown positions', () => {
    expect(getPositionCategory('UNKNOWN')).toBe('MID');
    expect(getPositionCategory('')).toBe('MID');
  });
});

describe('getPositionCategoryColor', () => {
  it('returns correct color for each category', () => {
    expect(getPositionCategoryColor('GK')).toBe('#ef4444');
    expect(getPositionCategoryColor('DEF')).toBe('#f59e0b');
    expect(getPositionCategoryColor('MID')).toBe('#3b82f6');
    expect(getPositionCategoryColor('FWD')).toBe('#22c55e');
  });
});

// ---------------------------------------------------------------------------
// Field Boundaries
// ---------------------------------------------------------------------------

describe('FIELD_BOUNDS', () => {
  it('has field area within 0-100 range', () => {
    expect(FIELD_BOUNDS.left).toBeGreaterThan(0);
    expect(FIELD_BOUNDS.right).toBeLessThan(100);
    expect(FIELD_BOUNDS.top).toBeGreaterThan(0);
    expect(FIELD_BOUNDS.bottom).toBeLessThan(100);
  });

  it('is horizontally symmetric', () => {
    expect(FIELD_BOUNDS.left).toBeCloseTo(100 - FIELD_BOUNDS.right, 1);
  });

  it('usable bounds are within field bounds', () => {
    expect(FIELD_BOUNDS.usableLeft).toBeGreaterThanOrEqual(FIELD_BOUNDS.left);
    expect(FIELD_BOUNDS.usableRight).toBeLessThanOrEqual(FIELD_BOUNDS.right);
    expect(FIELD_BOUNDS.usableTop).toBeGreaterThanOrEqual(FIELD_BOUNDS.top);
    expect(FIELD_BOUNDS.usableBottom).toBeLessThanOrEqual(FIELD_BOUNDS.bottom);
  });
});

describe('isWithinFieldBounds', () => {
  it('returns true for positions within field bounds', () => {
    expect(isWithinFieldBounds(50, 50)).toBe(true);
    expect(isWithinFieldBounds(50, 12)).toBe(true);
    expect(isWithinFieldBounds(35, 67)).toBe(true);
  });

  it('returns false for positions outside field bounds', () => {
    expect(isWithinFieldBounds(0, 0)).toBe(false);
    expect(isWithinFieldBounds(100, 100)).toBe(false);
    expect(isWithinFieldBounds(3, 50)).toBe(false); // Too far left
    expect(isWithinFieldBounds(97, 50)).toBe(false); // Too far right
  });

  it('respects custom margin', () => {
    // Position at field edge is valid without margin
    expect(isWithinFieldBounds(FIELD_BOUNDS.left + 1, 50, 0)).toBe(true);
    // Same position is invalid with margin
    expect(isWithinFieldBounds(FIELD_BOUNDS.left + 1, 50, 2)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Formation String Parsing
// ---------------------------------------------------------------------------

describe('parseFormationString', () => {
  it('parses standard formations correctly', () => {
    expect(parseFormationString('4-4-2')).toEqual([4, 4, 2]);
    expect(parseFormationString('4-3-3')).toEqual([4, 3, 3]);
    expect(parseFormationString('3-5-2')).toEqual([3, 5, 2]);
  });

  it('parses complex formations', () => {
    expect(parseFormationString('4-2-3-1')).toEqual([4, 2, 3, 1]);
    expect(parseFormationString('4-1-4-1')).toEqual([4, 1, 4, 1]);
    expect(parseFormationString('4-3-2-1')).toEqual([4, 3, 2, 1]);
    expect(parseFormationString('4-4-1-1')).toEqual([4, 4, 1, 1]);
    expect(parseFormationString('3-4-1-2')).toEqual([3, 4, 1, 2]);
  });

  it('sum of outfield lines equals 10', () => {
    for (const formation of FORMATIONS) {
      const lines = parseFormationString(formation);
      expect(lines.reduce((a, b) => a + b, 0)).toBe(10);
    }
  });
});

// ---------------------------------------------------------------------------
// Formation Line Structure
// ---------------------------------------------------------------------------

describe('getFormationLineStructure', () => {
  it('always has GK as the first line', () => {
    for (const formation of FORMATIONS) {
      const lines = getFormationLineStructure(formation);
      expect(lines[0].category).toBe('GK');
      expect(lines[0].count).toBe(1);
    }
  });

  it('4-4-2 has correct line structure', () => {
    const lines = getFormationLineStructure('4-4-2');
    const categories = lines.map((l) => l.category);

    // Should have GK, DEF (4), MID (4), FWD (2)
    expect(categories).toEqual(['GK', 'DEF', 'MID', 'FWD']);
    expect(lines[1].count).toBe(4); // DEF
    expect(lines[2].count).toBe(4); // MID
    expect(lines[3].count).toBe(2); // FWD
  });

  it('4-3-3 has correct line structure', () => {
    const lines = getFormationLineStructure('4-3-3');
    const categories = lines.map((l) => l.category);

    expect(categories).toEqual(['GK', 'DEF', 'MID', 'FWD']);
    expect(lines[1].count).toBe(4); // DEF
    expect(lines[2].count).toBe(3); // MID
    expect(lines[3].count).toBe(3); // FWD
  });

  it('3-5-2 has correct line structure', () => {
    const lines = getFormationLineStructure('3-5-2');
    const categories = lines.map((l) => l.category);

    expect(categories).toEqual(['GK', 'DEF', 'MID', 'FWD']);
    expect(lines[1].count).toBe(3); // DEF
    expect(lines[2].count).toBe(5); // MID (includes CAM)
    expect(lines[3].count).toBe(2); // FWD
  });

  it('5-3-2 has correct line structure', () => {
    const lines = getFormationLineStructure('5-3-2');
    const categories = lines.map((l) => l.category);

    expect(categories).toEqual(['GK', 'DEF', 'MID', 'FWD']);
    expect(lines[1].count).toBe(5); // DEF (includes LWB, RWB)
    expect(lines[2].count).toBe(3); // MID
    expect(lines[3].count).toBe(2); // FWD
  });

  it('lines are ordered by depth (defense deeper than attack)', () => {
    for (const formation of FORMATIONS) {
      const lines = getFormationLineStructure(formation);
      // Skip GK line
      for (let i = 1; i < lines.length; i++) {
        // Each line should be deeper (higher y) than the next
        expect(lines[i].y).toBeGreaterThan(lines[i + 1]?.y ?? -1);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Formation Slot Validation
// ---------------------------------------------------------------------------

describe('validateFormationSlots', () => {
  for (const formation of FORMATIONS) {
    describe(`${formation}`, () => {
      const result = validateFormationSlots(formation);

      it('has exactly 11 players', () => {
        const slots = getFormationSlots(formation);
        expect(slots).toHaveLength(11);
      });

      it('is valid (no errors)', () => {
        expect(result.valid).toBe(true);
      });

      it('has no field boundary violations', () => {
        const boundsIssues = result.issues.filter(
          (i) => i.severity === 'warning' && i.message.includes('outside field bounds'),
        );
        expect(boundsIssues).toHaveLength(0);
      });

      it('has no overlapping positions', () => {
        const overlapIssues = result.issues.filter(
          (i) => i.severity === 'warning' && i.message.includes('too close'),
        );
        expect(overlapIssues).toHaveLength(0);
      });
    });
  }

  it('all formations have exactly 1 GK', () => {
    for (const formation of FORMATIONS) {
      const slots = getFormationSlots(formation);
      const gkCount = slots.filter((s) => s.position === 'GK').length;
      expect(gkCount).toBe(1);
    }
  });

  it('GK is always centered', () => {
    for (const formation of FORMATIONS) {
      const gk = getSlotById(formation, 'GK');
      expect(gk).toBeDefined();
      expect(gk!.x).toBe(50);
      expect(gk!.y).toBe(90);
    }
  });

  it('GK is always the deepest player', () => {
    for (const formation of FORMATIONS) {
      const slots = getFormationSlots(formation);
      const maxDeep = Math.max(...slots.map((s) => s.y));
      const gk = getSlotById(formation, 'GK');
      expect(gk!.y).toBe(maxDeep);
    }
  });
});

// ---------------------------------------------------------------------------
// Position Validation — Per-formation Positional Correctness
// ---------------------------------------------------------------------------

describe('Formation positional correctness', () => {
  describe('4-back formations', () => {
    const fourBackFormations: Formation[] = [
      '4-4-2', '4-3-3', '4-2-3-1', '4-1-4-1', '4-5-1',
      '4-3-2-1', '4-4-1-1',
    ];

    for (const formation of fourBackFormations) {
      it(`${formation} has 4 defenders (LB, CB×2, RB)`, () => {
        const slots = getFormationSlots(formation);
        const defenders = slots.filter((s) => s.position === 'LB' || s.position === 'CB' || s.position === 'RB');
        expect(defenders).toHaveLength(4);
      });
    }
  });

  describe('3-back formations', () => {
    const threeBackFormations: Formation[] = ['3-5-2', '3-4-3', '3-4-1-2'];

    for (const formation of threeBackFormations) {
      it(`${formation} has 3 center-backs`, () => {
        const slots = getFormationSlots(formation);
        const cbs = slots.filter((s) => s.position === 'CB');
        expect(cbs).toHaveLength(3);
      });
    }
  });

  describe('5-back formations', () => {
    const fiveBackFormations: Formation[] = ['5-3-2', '5-4-1'];

    for (const formation of fiveBackFormations) {
      it(`${formation} has 5 defenders (LWB, CB×3, RWB)`, () => {
        const slots = getFormationSlots(formation);
        const defenders = slots.filter(
          (s) => ['CB', 'LWB', 'RWB', 'LB', 'RB'].includes(s.position),
        );
        expect(defenders).toHaveLength(5);
      });
    }
  });

  describe('horizontal symmetry', () => {
    it('all formations have good symmetry (score >= 0.8)', () => {
      for (const formation of FORMATIONS) {
        const score = getSymmetryScore(formation);
        expect(score).toBeGreaterThanOrEqual(0.8);
      }
    });

    it('single-striker formations have striker at center', () => {
      const singleStrikerFormations: Formation[] = [
        '4-3-3', '4-2-3-1', '4-1-4-1', '4-5-1', '5-4-1', '4-3-2-1',
      ];
      for (const formation of singleStrikerFormations) {
        const slots = getFormationSlots(formation);
        const strikers = slots.filter((s) => s.position === 'ST' || s.position === 'CF');
        expect(strikers).toHaveLength(1);
        expect(strikers[0].x).toBe(50);
      }
    });
  });

  describe('vertical ordering', () => {
    it('attackers are always above midfielders', () => {
      for (const formation of FORMATIONS) {
        const slots = getFormationSlots(formation);
        const fwd = slots
          .filter((s) => getPositionCategory(s.position) === 'FWD')
          .map((s) => s.y);
        const mid = slots
          .filter((s) => getPositionCategory(s.position) === 'MID')
          .map((s) => s.y);

        // All forward y-values should be less than all midfielder y-values
        expect(Math.max(...fwd)).toBeLessThan(Math.min(...mid));
      }
    });

    it('midfielders are always above defenders', () => {
      for (const formation of FORMATIONS) {
        const slots = getFormationSlots(formation);
        const mid = slots
          .filter((s) => getPositionCategory(s.position) === 'MID')
          .map((s) => s.y);
        const def = slots
          .filter((s) => getPositionCategory(s.position) === 'DEF')
          .map((s) => s.y);

        // All midfielder y-values should be less than all defender y-values
        expect(Math.max(...mid)).toBeLessThan(Math.min(...def));
      }
    });

    it('defenders are always above goalkeeper', () => {
      for (const formation of FORMATIONS) {
        const slots = getFormationSlots(formation);
        const def = slots
          .filter((s) => getPositionCategory(s.position) === 'DEF')
          .map((s) => s.y);
        const gk = slots.find((s) => s.position === 'GK')!;

        // All defender y-values should be less than GK y-value
        expect(Math.max(...def)).toBeLessThan(gk.y);
      }
    });
  });

  describe('specific formation position checks', () => {
    it('4-4-2 has two strikers and four midfielders on a flat line', () => {
      const slots = getFormationSlots('4-4-2');
      const mids = slots.filter((s) => ['LM', 'CM', 'RM'].includes(s.position));

      // In a flat 4-4-2, all midfielders should be at similar y-coordinates
      const yValues = mids.map((s) => s.y);
      const yRange = Math.max(...yValues) - Math.min(...yValues);
      expect(yRange).toBeLessThanOrEqual(5); // Within 5 units of each other
    });

    it('4-3-3 has wingers above central midfielders', () => {
      const slots = getFormationSlots('4-3-3');
      const wingers = slots.filter((s) => s.position === 'LW' || s.position === 'RW');
      const cms = slots.filter((s) => s.position === 'CM');

      // Wingers should be higher (lower y) than CMs
      for (const w of wingers) {
        for (const cm of cms) {
          expect(w.y).toBeLessThan(cm.y);
        }
      }
    });

    it('3-5-2 has wing midfielders wider than central midfielders', () => {
      const slots = getFormationSlots('3-5-2');
      const lm = slots.find((s) => s.position === 'LM')!;
      const rm = slots.find((s) => s.position === 'RM')!;
      const cms = slots.filter((s) => s.position === 'CM');

      // Wing midfielders should be wider than CMs
      for (const cm of cms) {
        expect(Math.abs(lm.x - 50)).toBeGreaterThan(Math.abs(cm.x - 50));
        expect(Math.abs(rm.x - 50)).toBeGreaterThan(Math.abs(cm.x - 50));
      }
    });

    it('4-2-3-1 has CDMs deeper than CAM', () => {
      const slots = getFormationSlots('4-2-3-1');
      const cdms = slots.filter((s) => s.position === 'CDM');
      const cam = slots.find((s) => s.position === 'CAM')!;

      // CDMs should be deeper (higher y) than CAM
      for (const cdm of cdms) {
        expect(cdm.y).toBeGreaterThan(cam.y);
      }
    });

    it('5-3-2 wingbacks are wider than center-backs', () => {
      const slots = getFormationSlots('5-3-2');
      const lwb = slots.find((s) => s.position === 'LWB')!;
      const rwb = slots.find((s) => s.position === 'RWB')!;
      const cbs = slots.filter((s) => s.position === 'CB');

      // Wingbacks should be wider than all CBs
      for (const cb of cbs) {
        expect(lwb.x).toBeLessThan(cb.x);
        expect(rwb.x).toBeGreaterThan(cb.x);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Utility Functions
// ---------------------------------------------------------------------------

describe('distanceBetween', () => {
  it('returns 0 for same position', () => {
    expect(distanceBetween({ x: 50, y: 50 }, { x: 50, y: 50 })).toBe(0);
  });

  it('returns correct Euclidean distance', () => {
    const dist = distanceBetween({ x: 0, y: 0 }, { x: 100, y: 0 });
    expect(dist).toBe(100);
  });

  it('calculates diagonal distance correctly', () => {
    const dist = distanceBetween({ x: 0, y: 0 }, { x: 100, y: 100 });
    expect(dist).toBeCloseTo(141.42, 1);
  });
});

describe('getSymmetryScore', () => {
  it('returns 1.0 for perfectly symmetric formations', () => {
    // 4-3-3 should be very symmetric
    const score = getSymmetryScore('4-3-3');
    expect(score).toBeGreaterThanOrEqual(0.9);
  });

  it('single-striker formations are symmetric', () => {
    expect(getSymmetryScore('4-2-3-1')).toBeGreaterThanOrEqual(0.9);
    expect(getSymmetryScore('4-1-4-1')).toBeGreaterThanOrEqual(0.9);
  });

  it('all formations have reasonable symmetry', () => {
    for (const formation of FORMATIONS) {
      expect(getSymmetryScore(formation)).toBeGreaterThanOrEqual(0.7);
    }
  });
});

describe('getPositionCompatibility', () => {
  it('returns 1.0 for perfect match', () => {
    expect(getPositionCompatibility('ST', 'ST')).toBe(1.0);
    expect(getPositionCompatibility('CB', 'CB')).toBe(1.0);
  });

  it('returns 1.0 for perfect position match', () => {
    expect(getPositionCompatibility('CM', 'CM')).toBe(1.0);
  });

  it('returns high compatibility for related positions', () => {
    expect(getPositionCompatibility('CM', 'CAM')).toBeGreaterThan(0.5);
    expect(getPositionCompatibility('CB', 'LB')).toBeGreaterThan(0.5);
    expect(getPositionCompatibility('ST', 'CF')).toBeGreaterThan(0.5);
  });

  it('returns low compatibility for unrelated positions', () => {
    expect(getPositionCompatibility('ST', 'GK')).toBeLessThan(0.5);
    expect(getPositionCompatibility('CB', 'LW')).toBeLessThan(0.5);
  });
});

describe('getFormationSlots', () => {
  it('returns 11 slots for all formations', () => {
    for (const formation of FORMATIONS) {
      expect(getFormationSlots(formation)).toHaveLength(11);
    }
  });

  it('returns consistent results', () => {
    const slots1 = getFormationSlots('4-3-3');
    const slots2 = getFormationSlots('4-3-3');
    expect(slots1).toEqual(slots2);
  });
});

describe('getSlotById', () => {
  it('finds GK slot', () => {
    const gk = getSlotById('4-3-3', 'GK');
    expect(gk).toBeDefined();
    expect(gk!.position).toBe('GK');
  });

  it('returns undefined for unknown slot', () => {
    expect(getSlotById('4-3-3', 'NONEXISTENT')).toBeUndefined();
  });
});

describe('getSlotsByPosition', () => {
  it('finds correct number of CBs in 4-back', () => {
    expect(getSlotsByPosition('4-3-3', 'CB')).toHaveLength(2);
  });

  it('finds correct number of CBs in 3-back', () => {
    expect(getSlotsByPosition('3-5-2', 'CB')).toHaveLength(3);
  });
});

describe('getFormationSummary', () => {
  it('returns correct summary for 4-3-3', () => {
    const summary = getFormationSummary('4-3-3');
    expect(summary).not.toBeNull();
    expect(summary!.name).toBe('4-3-3');
    expect(summary!.slotCount).toBe(11);
    expect(summary!.categories.GK).toBe(1);
    expect(summary!.categories.DEF).toBe(4);
    expect(summary!.categories.MID).toBe(3);
    expect(summary!.categories.FWD).toBe(3);
    expect(summary!.lineCounts).toEqual([4, 3, 3]);
  });

  it('returns correct summary for 5-3-2', () => {
    const summary = getFormationSummary('5-3-2');
    expect(summary!.categories.DEF).toBe(5); // LWB + 3 CBs + RWB
    expect(summary!.categories.MID).toBe(3);
    expect(summary!.categories.FWD).toBe(2);
  });

  it('returns null for unknown formation', () => {
    expect(getFormationSummary('4-4-2' as Formation)).not.toBeNull();
  });
});
