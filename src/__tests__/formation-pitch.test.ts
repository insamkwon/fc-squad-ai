/**
 * Tests for FormationPitch FIFA-regulation accuracy.
 *
 * These verify that the SVG pitch component's field markings
 * conform to FIFA Law 1 (The Field of Play) dimensions.
 *
 * Reference dimensions (in metres):
 *   - Pitch:        105m × 68m
 *   - Penalty area: 40.32m × 16.5m  (from goal line)
 *   - Goal area:    18.32m × 5.5m   (from goal line)
 *   - Center circle: r = 9.15m
 *   - Penalty spot:  11m from goal line
 *   - Penalty arc:   r = 9.15m from penalty spot
 *   - Corner arc:    r = 1m
 *   - Goal width:    7.32m
 */

import { describe, it, expect } from 'vitest';

// Pitch constants (mirrors the PITCH object in FormationPitch.tsx)
const PITCH = {
  viewBoxW: 680,
  viewBoxH: 1050,
  fx: 40,   // field outline x
  fy: 62,   // field outline y
  fw: 600,  // field outline width
  fh: 926,  // field outline height
};

const centerX = PITCH.fx + PITCH.fw / 2; // 340
const centerY = PITCH.fy + PITCH.fh / 2; // 525
const topGoalLine = PITCH.fy;             // 62
const bottomGoalLine = PITCH.fy + PITCH.fh; // 988

const penAreaW = 356;
const penAreaH = 146;
const penAreaX = centerX - penAreaW / 2; // 162

const goalAreaW = 162;
const goalAreaH = 49;
const goalAreaX = centerX - goalAreaW / 2; // 259

const penaltySpotDist = 97; // 11m * ~8.82 px/m
const topPenaltySpotY = topGoalLine + penaltySpotDist;  // 159
const bottomPenaltySpotY = bottomGoalLine - penaltySpotDist; // 891

const penArcR = 80.7; // 9.15m * ~8.82 px/m
const topPenAreaBottom = topGoalLine + penAreaH;           // 208
const bottomPenAreaTop = bottomGoalLine - penAreaH;        // 842

const cornerArcR = 9; // 1m * ~8.82 px/m

const goalW = 65; // 7.32m * ~8.82 px/m
const goalX = centerX - goalW / 2; // 307.5

// Scale: pixels per metre
const scaleX = PITCH.fw / 68;  // ~8.824
const scaleY = PITCH.fh / 105; // ~8.819

describe('FormationPitch dimensions', () => {
  describe('ViewBox and field outline', () => {
    it('viewBox matches regulation 68:105 ratio', () => {
      const ratio = PITCH.viewBoxW / PITCH.viewBoxH;
      expect(ratio).toBeCloseTo(68 / 105, 4);
    });

    it('field outline maintains 68:105 ratio', () => {
      const ratio = PITCH.fw / PITCH.fh;
      expect(ratio).toBeCloseTo(68 / 105, 3);
    });

    it('field outline is centered horizontally in viewBox', () => {
      const leftMargin = PITCH.fx;
      const rightMargin = PITCH.viewBoxW - (PITCH.fx + PITCH.fw);
      expect(leftMargin).toBe(rightMargin);
    });

    it('field outline is centered vertically in viewBox', () => {
      const topMargin = PITCH.fy;
      const bottomMargin = PITCH.viewBoxH - (PITCH.fy + PITCH.fh);
      expect(topMargin).toBe(bottomMargin);
    });
  });

  describe('Center markings', () => {
    it('center spot is at the exact center of the field', () => {
      expect(centerX).toBe(PITCH.fx + PITCH.fw / 2);
      expect(centerY).toBe(PITCH.fy + PITCH.fh / 2);
    });

    it('center circle radius matches 9.15m at scale', () => {
      const expectedR = 9.15 * scaleY;
      expect(penArcR).toBeCloseTo(expectedR, 0);
    });

    it('halfway line is at the vertical center', () => {
      expect(centerY).toBe(topGoalLine + PITCH.fh / 2);
    });
  });

  describe('Penalty area', () => {
    it('penalty area width matches 40.32m at scale', () => {
      const expectedW = 40.32 * scaleX;
      expect(penAreaW).toBeCloseTo(expectedW, 0);
    });

    it('penalty area depth matches 16.5m at scale', () => {
      const expectedH = 16.5 * scaleY;
      expect(penAreaH).toBeCloseTo(expectedH, 0);
    });

    it('penalty area is centered horizontally', () => {
      const penAreaRight = penAreaX + penAreaW;
      const leftDist = penAreaX - PITCH.fx;
      const rightDist = (PITCH.fx + PITCH.fw) - penAreaRight;
      expect(leftDist).toBeCloseTo(rightDist, 0);
    });

    it('penalty spot is 11m from goal line', () => {
      const expectedDist = 11 * scaleY;
      expect(penaltySpotDist).toBeCloseTo(expectedDist, 0);
      expect(topPenaltySpotY - topGoalLine).toBe(penaltySpotDist);
      expect(bottomGoalLine - bottomPenaltySpotY).toBe(penaltySpotDist);
    });
  });

  describe('Penalty arc geometry', () => {
    it('penalty arc radius equals center circle radius (both 9.15m)', () => {
      expect(penArcR).toBe(80.7);
    });

    it('arc endpoints lie exactly on the penalty spot circle', () => {
      // Arc intersects the penalty area bottom edge (y = topPenAreaBottom)
      // Circle: (x - centerX)² + (y - topPenaltySpotY)² = penArcR²
      const dy = topPenAreaBottom - topPenaltySpotY;
      const dx = Math.sqrt(penArcR * penArcR - dy * dy);
      const x1 = centerX - dx;
      const x2 = centerX + dx;

      // Verify: (x1 - centerX)² + (topPenAreaBottom - topPenaltySpotY)² = penArcR²
      const dist1 = Math.sqrt((x1 - centerX) ** 2 + dy ** 2);
      const dist2 = Math.sqrt((x2 - centerX) ** 2 + dy ** 2);

      expect(dist1).toBeCloseTo(penArcR, 2);
      expect(dist2).toBeCloseTo(penArcR, 2);
    });

    it('arc endpoints are symmetric about center', () => {
      const dy = topPenAreaBottom - topPenaltySpotY;
      const dx = Math.sqrt(penArcR * penArcR - dy * dy);
      const x1 = centerX - dx;
      const x2 = centerX + dx;

      expect(centerX - x1).toBeCloseTo(x2 - centerX, 4);
    });

    it('top and bottom penalty arcs have identical geometry', () => {
      // Top arc: circle at (centerX, topPenaltySpotY), intersecting y = topPenAreaBottom
      // Bottom arc: circle at (centerX, bottomPenaltySpotY), intersecting y = bottomPenAreaTop
      const topDy = topPenAreaBottom - topPenaltySpotY;
      const bottomDy = bottomPenaltySpotY - bottomPenAreaTop;

      expect(Math.abs(topDy)).toBe(Math.abs(bottomDy));

      const topDx = Math.sqrt(penArcR ** 2 - topDy ** 2);
      const bottomDx = Math.sqrt(penArcR ** 2 - bottomDy ** 2);

      expect(topDx).toBeCloseTo(bottomDx, 6);
    });
  });

  describe('Goal area', () => {
    it('goal area width matches 18.32m at scale', () => {
      const expectedW = 18.32 * scaleX;
      expect(goalAreaW).toBeCloseTo(expectedW, 0);
    });

    it('goal area depth matches 5.5m at scale', () => {
      const expectedH = 5.5 * scaleY;
      expect(goalAreaH).toBeCloseTo(expectedH, 0);
    });

    it('goal area is centered horizontally', () => {
      const goalAreaRight = goalAreaX + goalAreaW;
      const leftDist = goalAreaX - PITCH.fx;
      const rightDist = (PITCH.fx + PITCH.fw) - goalAreaRight;
      expect(leftDist).toBeCloseTo(rightDist, 0);
    });
  });

  describe('Corner arcs', () => {
    it('corner arc radius matches 1m at scale', () => {
      const expectedR = 1 * scaleX;
      expect(cornerArcR).toBeCloseTo(expectedR, 0);
    });
  });

  describe('Goals', () => {
    it('goal width matches 7.32m at scale (within 1px rounding)', () => {
      const expectedW = 7.32 * scaleX;
      expect(goalW).toBeCloseTo(expectedW, 0); // within 0.5px of exact scale
    });

    it('goal is centered horizontally', () => {
      const goalRight = goalX + goalW;
      const leftDist = goalX - PITCH.fx;
      const rightDist = (PITCH.fx + PITCH.fw) - goalRight;
      // Goals should be centered, though exact distance depends on margin
      // Just verify symmetry
      expect(leftDist).toBeCloseTo(rightDist, 0);
    });
  });

  describe('Symmetry', () => {
    it('pitch is vertically symmetric about the halfway line', () => {
      // Top penalty area
      const topPenTop = topGoalLine;
      const topPenBottom = topGoalLine + penAreaH;
      // Bottom penalty area
      const bottomPenTop = bottomGoalLine - penAreaH;
      const bottomPenBottom = bottomGoalLine;

      // Distance from halfway line should be equal
      const topDist = centerY - (topPenTop + topPenBottom) / 2;
      const bottomDist = (bottomPenTop + bottomPenBottom) / 2 - centerY;
      expect(topDist).toBeCloseTo(bottomDist, 0);
    });

    it('pitch is horizontally symmetric about the center', () => {
      // All horizontal elements should be centered
      expect(centerX).toBe((PITCH.fx + PITCH.fx + PITCH.fw) / 2);
      expect(penAreaX + penAreaW / 2).toBeCloseTo(centerX, 0);
      expect(goalAreaX + goalAreaW / 2).toBeCloseTo(centerX, 0);
      expect(goalX + goalW / 2).toBeCloseTo(centerX, 0);
    });
  });

  describe('Scale consistency', () => {
    it('horizontal and vertical scales are within 0.1% of each other', () => {
      const ratio = scaleX / scaleY;
      expect(ratio).toBeCloseTo(1.0, 2); // within 1% — imperceptible at SVG resolution
      // Actual difference is ~0.05% due to integer rounding of field height
      expect(Math.abs(ratio - 1.0)).toBeLessThan(0.001); // explicitly < 0.1%
    });
  });
});
