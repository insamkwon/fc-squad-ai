/**
 * Tests for squad cost calculation and formatting utilities.
 *
 * Verifies:
 *   1. calculateSquadCost correctly sums individual player prices
 *   2. formatCost produces properly formatted Korean currency output with "BP" suffix
 *   3. formatPrice continues to work for individual player prices (억/만 notation)
 *   4. Edge cases: zero cost, negative, very large values
 */

import { describe, it, expect } from 'vitest';
import { formatCost, formatPrice, calculateSquadCost } from '@/lib/stat-utils';

// ---------------------------------------------------------------------------
// calculateSquadCost
// ---------------------------------------------------------------------------

describe('calculateSquadCost', () => {
  it('returns 0 for an empty player list', () => {
    expect(calculateSquadCost([])).toBe(0);
  });

  it('returns the single player price for a one-player squad', () => {
    const players = [{ player: { price: 5_000_000_000 } }];
    expect(calculateSquadCost(players)).toBe(5_000_000_000);
  });

  it('sums multiple player prices correctly', () => {
    const players = [
      { player: { price: 1_000_000_000 } }, // 10억
      { player: { price: 2_500_000_000 } }, // 25억
      { player: { price: 500_000_000 } },   // 5억
    ];
    expect(calculateSquadCost(players)).toBe(4_000_000_000); // 40억
  });

  it('sums all 11 players for a full squad', () => {
    const players = Array.from({ length: 11 }, (_, i) => ({
      player: { price: 1_000_000_000 * (i + 1) }, // 1억, 2억, ..., 11억
    }));
    // Sum = (1+2+...+11) * 1억 = 66 * 1억 = 66억 = 66,000,000,000
    expect(calculateSquadCost(players)).toBe(66_000_000_000);
  });

  it('handles players with zero price', () => {
    const players = [
      { player: { price: 5_000_000_000 } },
      { player: { price: 0 } },
      { player: { price: 3_000_000_000 } },
    ];
    expect(calculateSquadCost(players)).toBe(8_000_000_000);
  });

  it('works with SquadPlayer-shaped objects (player property)', () => {
    const squadPlayers = [
      { player: { price: 100_000_000, name: 'A' } },
      { player: { price: 200_000_000, name: 'B' } },
    ];
    expect(calculateSquadCost(squadPlayers)).toBe(300_000_000);
  });
});

// ---------------------------------------------------------------------------
// formatCost (squad total cost with "BP" suffix)
// ---------------------------------------------------------------------------

describe('formatCost', () => {
  it('returns "0 BP" for zero or negative values', () => {
    expect(formatCost(0)).toBe('0 BP');
    expect(formatCost(-1)).toBe('0 BP');
  });

  it('formats amounts >= 1억 in 억 notation with BP suffix', () => {
    expect(formatCost(100_000_000)).toBe('1.0억 BP');     // exactly 1억
    expect(formatCost(500_000_000)).toBe('5.0억 BP');     // 5억
    expect(formatCost(1_000_000_000)).toBe('10.0억 BP');  // 10억
    expect(formatCost(1_500_000_000)).toBe('15.0억 BP');  // 15억
    expect(formatCost(52_000_000_000)).toBe('520.0억 BP'); // 520억
  });

  it('formats amounts < 1억 in 만 notation with BP suffix', () => {
    expect(formatCost(50_000_000)).toBe('5000만 BP');     // 5000만
    expect(formatCost(10_000_000)).toBe('1000만 BP');     // 1000만
    expect(formatCost(5_000_000)).toBe('500만 BP');       // 500만
    expect(formatCost(100_000)).toBe('10만 BP');          // 10만
  });

  it('handles large squad totals correctly', () => {
    // Realistic expensive squad: 11 players averaging ~15억 each ≈ 165억 total
    expect(formatCost(16_500_000_000)).toBe('165.0억 BP');
  });

  it('handles budget squad totals', () => {
    // Budget squad: 11 players averaging ~2000만 each ≈ 2.2억 total
    expect(formatCost(220_000_000)).toBe('2.2억 BP');
  });
});

// ---------------------------------------------------------------------------
// formatPrice (individual player price, no "BP" suffix)
// ---------------------------------------------------------------------------

describe('formatPrice', () => {
  it('formats prices >= 1억 with decimal', () => {
    expect(formatPrice(5_200_000_000)).toBe('52.0억');
    expect(formatPrice(1_000_000_000)).toBe('10.0억');
    expect(formatPrice(1_500_000_000)).toBe('15.0억');
  });

  it('formats prices < 1억 in 만 units', () => {
    expect(formatPrice(35_000_000)).toBe('3500만');
    expect(formatPrice(500_000)).toBe('50만');
    expect(formatPrice(10_000)).toBe('1만');
  });

  it('handles edge cases', () => {
    expect(formatPrice(0)).toBe('0만');
    expect(formatPrice(1_000)).toBe('0만');
    expect(formatPrice(100_000_000)).toBe('1.0억');
  });

  it('uses Math.round for 만 values', () => {
    // 15,500,000 / 10,000 = 1,550 → rounds to 1550
    expect(formatPrice(15_500_000)).toBe('1550만');
    // 15,499,999 / 10,000 = 1549.9999 → rounds to 1550
    expect(formatPrice(15_499_999)).toBe('1550만');
  });
});

// ---------------------------------------------------------------------------
// Integration: calculateSquadCost + formatCost
// ---------------------------------------------------------------------------

describe('Squad cost integration', () => {
  it('calculates and formats a realistic squad total', () => {
    // 11 Premier League players with varying prices
    const players = [
      { player: { price: 8_000_000_000 } },  // ST: 80억
      { player: { price: 5_500_000_000 } },  // ST: 55억
      { player: { price: 3_000_000_000 } },  // LW: 30억
      { player: { price: 4_200_000_000 } },  // CM: 42억
      { player: { price: 2_800_000_000 } },  // CM: 28억
      { player: { price: 6_000_000_000 } },  // CM: 60억
      { player: { price: 3_500_000_000 } },  // LB: 35억
      { player: { price: 7_000_000_000 } },  // CB: 70억
      { player: { price: 6_500_000_000 } },  // CB: 65억
      { player: { price: 4_000_000_000 } },  // RB: 40억
      { player: { price: 2_000_000_000 } },  // GK: 20억
    ];

    const total = calculateSquadCost(players);
    expect(total).toBe(52_500_000_000); // 525억

    const formatted = formatCost(total);
    expect(formatted).toBe('525.0억 BP');
  });

  it('formats a budget squad total correctly', () => {
    const players = Array.from({ length: 11 }, () => ({
      player: { price: 45_000_000 }, // ~4500만 each
    }));

    const total = calculateSquadCost(players);
    expect(total).toBe(495_000_000); // 4.95억

    const formatted = formatCost(total);
    expect(formatted).toBe('5.0억 BP');
  });
});
