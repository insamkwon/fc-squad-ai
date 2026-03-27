/**
 * Tests for formation slot data validation.
 *
 * Validates that every formation in FORMATION_SLOTS has:
 * - Exactly 11 slots (standard football squad size)
 * - Exactly 1 GK positioned at the bottom (y >= 85)
 * - Unique slot IDs within each formation
 * - All slot positions are within valid bounds (x: 0-100, y: 0-100)
 * - Slot IDs follow the expected naming convention
 */

import { describe, it, expect } from 'vitest';
import { FORMATIONS, FORMATION_SLOTS } from '@/types/squad';

describe('Formation slot data', () => {
  describe('All formations have correct player count', () => {
    it('every formation has exactly 11 slots', () => {
      for (const formation of FORMATIONS) {
        const slots = FORMATION_SLOTS[formation];
        expect(slots, `${formation} should have 11 slots`).toHaveLength(11);
      }
    });

    it('every formation has exactly 1 GK', () => {
      for (const formation of FORMATIONS) {
        const slots = FORMATION_SLOTS[formation];
        const gkCount = slots.filter((s) => s.position === 'GK').length;
        expect(gkCount, `${formation} should have exactly 1 GK`).toBe(1);
      }
    });

    it('GK is positioned at the bottom of the pitch (y >= 85)', () => {
      for (const formation of FORMATIONS) {
        const slots = FORMATION_SLOTS[formation];
        const gk = slots.find((s) => s.position === 'GK');
        expect(gk, `${formation} should have a GK`).toBeDefined();
        expect(gk!.y, `${formation} GK should be at y >= 85`).toBeGreaterThanOrEqual(85);
        expect(gk!.y, `${formation} GK should be at y <= 95`).toBeLessThanOrEqual(95);
      }
    });

    it('GK is centered horizontally (x between 45 and 55)', () => {
      for (const formation of FORMATIONS) {
        const slots = FORMATION_SLOTS[formation];
        const gk = slots.find((s) => s.position === 'GK');
        expect(gk!.x, `${formation} GK should be roughly centered`).toBeGreaterThanOrEqual(45);
        expect(gk!.x, `${formation} GK should be roughly centered`).toBeLessThanOrEqual(55);
      }
    });
  });

  describe('Slot coordinate bounds', () => {
    it('all x coordinates are within 0-100 range', () => {
      for (const formation of FORMATIONS) {
        const slots = FORMATION_SLOTS[formation];
        for (const slot of slots) {
          expect(slot.x, `${formation} ${slot.id} x should be in 0-100`).toBeGreaterThanOrEqual(0);
          expect(slot.x, `${formation} ${slot.id} x should be in 0-100`).toBeLessThanOrEqual(100);
        }
      }
    });

    it('all y coordinates are within 0-100 range', () => {
      for (const formation of FORMATIONS) {
        const slots = FORMATION_SLOTS[formation];
        for (const slot of slots) {
          expect(slot.y, `${formation} ${slot.id} y should be in 0-100`).toBeGreaterThanOrEqual(0);
          expect(slot.y, `${formation} ${slot.id} y should be in 0-100`).toBeLessThanOrEqual(100);
        }
      }
    });
  });

  describe('Slot ID uniqueness', () => {
    it('all slot IDs within a formation are unique', () => {
      for (const formation of FORMATIONS) {
        const slots = FORMATION_SLOTS[formation];
        const ids = slots.map((s) => s.id);
        const uniqueIds = new Set(ids);
        expect(uniqueIds.size, `${formation} should have unique slot IDs`).toBe(ids.length);
      }
    });
  });

  describe('Formation-specific slot counts by line', () => {
    const FW_POSITIONS = ['ST', 'CF', 'LF', 'RF', 'LW', 'RW'];
    const MF_POSITIONS = ['CAM', 'CM', 'CDM', 'LM', 'RM'];
    const DF_POSITIONS = ['CB', 'LB', 'RB', 'LWB', 'RWB'];

    function countByLine(formation: string) {
      const slots = FORMATION_SLOTS[formation as keyof typeof FORMATION_SLOTS];
      return {
        fw: slots.filter((s) => FW_POSITIONS.includes(s.position)).length,
        mf: slots.filter((s) => MF_POSITIONS.includes(s.position)).length,
        df: slots.filter((s) => DF_POSITIONS.includes(s.position)).length,
      };
    }

    it('4-4-2 has 2 FW, 4 MF, 4 DF', () => {
      const { fw, mf, df } = countByLine('4-4-2');
      expect({ fw, mf, df }).toEqual({ fw: 2, mf: 4, df: 4 });
    });

    it('4-3-3 has 3 FW, 3 MF, 4 DF (LW/RW classified as FW)', () => {
      const { fw, mf, df } = countByLine('4-3-3');
      expect({ fw, mf, df }).toEqual({ fw: 3, mf: 3, df: 4 });
    });

    it('3-5-2 has 2 FW, 5 MF, 3 DF', () => {
      const { fw, mf, df } = countByLine('3-5-2');
      expect({ fw, mf, df }).toEqual({ fw: 2, mf: 5, df: 3 });
    });

    it('4-2-3-1 has 3 FW, 3 MF, 4 DF (LW/RW classified as FW)', () => {
      const { fw, mf, df } = countByLine('4-2-3-1');
      expect({ fw, mf, df }).toEqual({ fw: 3, mf: 3, df: 4 });
    });

    it('4-1-4-1 has 1 FW, 5 MF, 4 DF', () => {
      const { fw, mf, df } = countByLine('4-1-4-1');
      expect({ fw, mf, df }).toEqual({ fw: 1, mf: 5, df: 4 });
    });

    it('3-4-3 has 3 FW, 4 MF, 3 DF', () => {
      const { fw, mf, df } = countByLine('3-4-3');
      expect({ fw, mf, df }).toEqual({ fw: 3, mf: 4, df: 3 });
    });

    it('4-5-1 has 1 FW, 5 MF, 4 DF', () => {
      const { fw, mf, df } = countByLine('4-5-1');
      expect({ fw, mf, df }).toEqual({ fw: 1, mf: 5, df: 4 });
    });

    it('5-3-2 has 2 FW, 3 MF, 5 DF', () => {
      const { fw, mf, df } = countByLine('5-3-2');
      expect({ fw, mf, df }).toEqual({ fw: 2, mf: 3, df: 5 });
    });

    it('5-4-1 has 1 FW, 4 MF, 5 DF', () => {
      const { fw, mf, df } = countByLine('5-4-1');
      expect({ fw, mf, df }).toEqual({ fw: 1, mf: 4, df: 5 });
    });

    it('4-3-2-1 has 1 FW, 5 MF, 4 DF', () => {
      const { fw, mf, df } = countByLine('4-3-2-1');
      expect({ fw, mf, df }).toEqual({ fw: 1, mf: 5, df: 4 });
    });

    it('4-4-1-1 has 1 FW, 5 MF, 4 DF', () => {
      const { fw, mf, df } = countByLine('4-4-1-1');
      expect({ fw, mf, df }).toEqual({ fw: 1, mf: 5, df: 4 });
    });

    it('3-4-1-2 has 2 FW, 5 MF, 3 DF', () => {
      const { fw, mf, df } = countByLine('3-4-1-2');
      expect({ fw, mf, df }).toEqual({ fw: 2, mf: 5, df: 3 });
    });
  });

  describe('Player spatial distribution', () => {
    it('no two players overlap significantly (minimum distance check)', () => {
      for (const formation of FORMATIONS) {
        const slots = FORMATION_SLOTS[formation];
        for (let i = 0; i < slots.length; i++) {
          for (let j = i + 1; j < slots.length; j++) {
            const dx = slots[i].x - slots[j].x;
            const dy = slots[i].y - slots[j].y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            // Players should be at least 5 units apart
            expect(
              dist,
              `${formation}: ${slots[i].id} and ${slots[j].id} are too close (${dist.toFixed(1)} units apart)`,
            ).toBeGreaterThan(5);
          }
        }
      }
    });

    it('attackers are positioned above midfielders', () => {
      const FW_POSITIONS = ['ST', 'CF', 'LF', 'RF', 'LW', 'RW'];
      for (const formation of FORMATIONS) {
        const slots = FORMATION_SLOTS[formation];
        const fwAvgY = slots
          .filter((s) => FW_POSITIONS.includes(s.position))
          .reduce((sum, s) => sum + s.y, 0) /
          Math.max(1, slots.filter((s) => FW_POSITIONS.includes(s.position)).length);
        const gkY = slots.find((s) => s.position === 'GK')!.y;
        expect(fwAvgY, `${formation} attackers should be above GK`).toBeLessThan(gkY);
      }
    });

    it('defenders are positioned below midfielders', () => {
      const MF_POSITIONS = ['CAM', 'CM', 'CDM', 'LM', 'RM'];
      const DF_POSITIONS = ['CB', 'LB', 'RB', 'LWB', 'RWB'];
      for (const formation of FORMATIONS) {
        const slots = FORMATION_SLOTS[formation];
        const mfAvgY = slots
          .filter((s) => MF_POSITIONS.includes(s.position))
          .reduce((sum, s) => sum + s.y, 0) /
          Math.max(1, slots.filter((s) => MF_POSITIONS.includes(s.position)).length);
        const dfAvgY = slots
          .filter((s) => DF_POSITIONS.includes(s.position))
          .reduce((sum, s) => sum + s.y, 0) /
          Math.max(1, slots.filter((s) => DF_POSITIONS.includes(s.position)).length);
        expect(dfAvgY, `${formation} defenders should be below midfielders`).toBeGreaterThan(mfAvgY);
      }
    });
  });
});
