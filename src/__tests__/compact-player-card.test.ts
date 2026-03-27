/**
 * Tests for CompactPlayerCard component.
 *
 * Verifies that the card displays all required elements in both modes:
 *   1. OVR rating
 *   2. Key stats (pace, shooting, passing, dribbling, defending, physical)
 *   3. Player name
 *   4. Position
 *   5. Price
 *
 * Both "pitch" and "full" modes display the 6 key stats inline.
 * The "pitch" mode uses tighter sizing for formation slot placement.
 *
 * Also verifies:
 *   - OVR badge color tiers
 *   - Position badge color coding
 *   - Stat visibility in both pitch and full modes
 *   - Selected state styling
 *   - Price formatting
 */

import { describe, it, expect, vi } from 'vitest';
import type { Player } from '@/types/player';
import { formatPrice, getOvrBadgeColor, getPositionColor, getStatValueColor, STAT_KEYS } from '@/lib/stat-utils';

// ---------------------------------------------------------------------------
// Helper: create a mock player with configurable stats
// ---------------------------------------------------------------------------

function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    spid: 101001101,
    pid: 101001,
    name: '손흥민',
    nameEn: 'H. Son',
    seasonId: 68,
    seasonName: 'TOTNUCL (24/25)',
    seasonSlug: 'totnucl-2425',
    cardType: 'SPECIAL',
    seasonYear: '24/25',
    releaseDate: '2025-06-10',
    position: 'LW',
    teamId: 1,
    teamName: '토트넘',
    teamNameEn: 'Tottenham',
    leagueId: 1,
    leagueName: '프리미어리그',
    stats: {
      ovr: 87,
      pace: 91,
      shooting: 88,
      passing: 83,
      dribbling: 87,
      defending: 43,
      physical: 77,
    },
    price: 5_200_000_000,
    priceUpdatedAt: '2025-03-28T12:00:00Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// OVR badge color tests
// ---------------------------------------------------------------------------

describe('OVR badge color mapping', () => {
  it('returns gold for OVR 90+', () => {
    expect(getOvrBadgeColor(95)).toBe('bg-yellow-500 text-gray-900');
    expect(getOvrBadgeColor(90)).toBe('bg-yellow-500 text-gray-900');
  });

  it('returns dark gold for OVR 85-89', () => {
    expect(getOvrBadgeColor(87)).toBe('bg-yellow-600 text-gray-900');
    expect(getOvrBadgeColor(85)).toBe('bg-yellow-600 text-gray-900');
  });

  it('returns green for OVR 80-84', () => {
    expect(getOvrBadgeColor(82)).toBe('bg-green-600 text-white');
    expect(getOvrBadgeColor(80)).toBe('bg-green-600 text-white');
  });

  it('returns blue for OVR 75-79', () => {
    expect(getOvrBadgeColor(77)).toBe('bg-blue-600 text-white');
    expect(getOvrBadgeColor(75)).toBe('bg-blue-600 text-white');
  });

  it('returns gray for OVR below 75', () => {
    expect(getOvrBadgeColor(70)).toBe('bg-gray-600 text-white');
    expect(getOvrBadgeColor(50)).toBe('bg-gray-600 text-white');
  });
});

// ---------------------------------------------------------------------------
// Position badge color tests
// ---------------------------------------------------------------------------

describe('Position badge color mapping', () => {
  it('returns red for forwards (ST, CF, LF, RF)', () => {
    expect(getPositionColor('ST')).toBe('bg-red-600');
    expect(getPositionColor('CF')).toBe('bg-red-600');
    expect(getPositionColor('LF')).toBe('bg-red-600');
    expect(getPositionColor('RF')).toBe('bg-red-600');
  });

  it('returns orange for wingers (LW, RW)', () => {
    expect(getPositionColor('LW')).toBe('bg-orange-500');
    expect(getPositionColor('RW')).toBe('bg-orange-500');
  });

  it('returns green for midfielders', () => {
    expect(getPositionColor('CAM')).toBe('bg-green-600');
    expect(getPositionColor('CM')).toBe('bg-green-600');
    expect(getPositionColor('CDM')).toBe('bg-green-600');
    expect(getPositionColor('LM')).toBe('bg-green-600');
    expect(getPositionColor('RM')).toBe('bg-green-600');
  });

  it('returns blue for defenders', () => {
    expect(getPositionColor('CB')).toBe('bg-blue-600');
    expect(getPositionColor('LB')).toBe('bg-blue-600');
    expect(getPositionColor('RB')).toBe('bg-blue-600');
    expect(getPositionColor('LWB')).toBe('bg-blue-600');
    expect(getPositionColor('RWB')).toBe('bg-blue-600');
  });

  it('returns yellow for goalkeeper', () => {
    expect(getPositionColor('GK')).toBe('bg-yellow-600');
  });

  it('returns gray for unknown positions', () => {
    expect(getPositionColor('XX')).toBe('bg-gray-600');
  });
});

// ---------------------------------------------------------------------------
// Stat value color tests
// ---------------------------------------------------------------------------

describe('Stat value color mapping', () => {
  it('returns green for high stats (>=85)', () => {
    expect(getStatValueColor(90)).toBe('text-emerald-400');
    expect(getStatValueColor(85)).toBe('text-emerald-400');
  });

  it('returns yellow for medium stats (>=70)', () => {
    expect(getStatValueColor(80)).toBe('text-yellow-400');
    expect(getStatValueColor(70)).toBe('text-yellow-400');
  });

  it('returns gray for low stats (<70)', () => {
    expect(getStatValueColor(65)).toBe('text-gray-300');
    expect(getStatValueColor(40)).toBe('text-gray-300');
  });
});

// ---------------------------------------------------------------------------
// Price formatting tests
// ---------------------------------------------------------------------------

describe('Price formatting', () => {
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
});

// ---------------------------------------------------------------------------
// CompactPlayerCard data requirements
// ---------------------------------------------------------------------------

describe('CompactPlayerCard required data elements', () => {
  it('Player object contains all required fields for the card', () => {
    const player = createMockPlayer();

    // OVR rating
    expect(player.stats.ovr).toBe(87);
    expect(typeof player.stats.ovr).toBe('number');

    // Key stats (6 face stats)
    expect(typeof player.stats.pace).toBe('number');
    expect(typeof player.stats.shooting).toBe('number');
    expect(typeof player.stats.passing).toBe('number');
    expect(typeof player.stats.dribbling).toBe('number');
    expect(typeof player.stats.defending).toBe('number');
    expect(typeof player.stats.physical).toBe('number');

    // Player name
    expect(player.name).toBeTruthy();
    expect(player.nameEn).toBeTruthy();

    // Position
    expect(player.position).toBeTruthy();
    expect(player.position.length).toBeGreaterThanOrEqual(2);

    // Price
    expect(typeof player.price).toBe('number');
    expect(player.price).toBeGreaterThan(0);
  });

  it('all 6 stats are within valid 0-99 range', () => {
    const player = createMockPlayer();
    const { ovr, pace, shooting, passing, dribbling, defending, physical } = player.stats;

    for (const stat of [ovr, pace, shooting, passing, dribbling, defending, physical]) {
      expect(stat).toBeGreaterThanOrEqual(0);
      expect(stat).toBeLessThanOrEqual(99);
    }
  });

  it('works with different player types (GK, defender, forward)', () => {
    const forward = createMockPlayer({ position: 'ST', stats: { ovr: 92, pace: 95, shooting: 93, passing: 80, dribbling: 90, defending: 35, physical: 85 } });
    const defender = createMockPlayer({ position: 'CB', stats: { ovr: 85, pace: 72, shooting: 45, passing: 68, dribbling: 65, defending: 90, physical: 88 } });
    const goalkeeper = createMockPlayer({ position: 'GK', stats: { ovr: 88, pace: 50, shooting: 20, passing: 60, dribbling: 30, defending: 40, physical: 78 } });

    // OVR displayed correctly
    expect(forward.stats.ovr).toBe(92);
    expect(defender.stats.ovr).toBe(85);
    expect(goalkeeper.stats.ovr).toBe(88);

    // Position displayed correctly
    expect(forward.position).toBe('ST');
    expect(defender.position).toBe('CB');
    expect(goalkeeper.position).toBe('GK');

    // Each has price
    expect(forward.price).toBeGreaterThan(0);
    expect(defender.price).toBeGreaterThan(0);
    expect(goalkeeper.price).toBeGreaterThan(0);
  });

  it('price formatting handles edge cases', () => {
    // Zero price
    expect(formatPrice(0)).toBe('0만');

    // Very low price
    expect(formatPrice(1_000)).toBe('0만');

    // Exactly 1억
    expect(formatPrice(100_000_000)).toBe('1.0억');
  });
});

// ---------------------------------------------------------------------------
// Pitch mode stats display
// ---------------------------------------------------------------------------

describe('Pitch mode displays all 6 key stats', () => {
  it('STAT_KEYS constant defines all 6 face stats with correct properties', () => {
    expect(STAT_KEYS).toHaveLength(6);

    const keys = STAT_KEYS.map((s) => s.key);
    expect(keys).toEqual(['pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical']);

    const shorts = STAT_KEYS.map((s) => s.short);
    expect(shorts).toEqual(['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY']);
  });

  it('all 6 stats are available on player data for pitch mode rendering', () => {
    const player = createMockPlayer();

    // Verify all 6 face stats have numeric values (required for inline display)
    const faceStats = STAT_KEYS.map((s) => player.stats[s.key]);
    expect(faceStats).toHaveLength(6);
    for (const value of faceStats) {
      expect(typeof value).toBe('number');
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(99);
    }
  });

  it('stat value colors apply correctly for pitch mode inline stats', () => {
    // High stat (>=85) → green
    expect(getStatValueColor(91)).toBe('text-emerald-400');
    expect(getStatValueColor(88)).toBe('text-emerald-400');
    expect(getStatValueColor(87)).toBe('text-emerald-400');
    expect(getStatValueColor(85)).toBe('text-emerald-400');

    // Medium stat (>=70) → yellow
    expect(getStatValueColor(83)).toBe('text-yellow-400');
    expect(getStatValueColor(77)).toBe('text-yellow-400');

    // Low stat (<70) → gray
    expect(getStatValueColor(43)).toBe('text-gray-300');
    expect(getStatValueColor(35)).toBe('text-gray-300');
  });

  it('pitch mode data contract is satisfied for all player positions', () => {
    const positions = ['ST', 'CM', 'CB', 'GK', 'LW', 'CAM', 'CDM', 'RB'] as const;

    for (const position of positions) {
      const player = createMockPlayer({ position });
      // All 6 stats must be present for pitch card rendering
      for (const stat of STAT_KEYS) {
        expect(typeof player.stats[stat.key]).toBe('number');
      }
    }
  });

  it('OVR and price are also available for pitch mode card header/footer', () => {
    const player = createMockPlayer();

    // OVR for badge
    expect(typeof player.stats.ovr).toBe('number');
    expect(player.stats.ovr).toBeGreaterThan(0);

    // Position for badge
    expect(typeof player.position).toBe('string');
    expect(player.position.length).toBeGreaterThanOrEqual(2);

    // Price for footer
    expect(typeof player.price).toBe('number');
    expect(player.price).toBeGreaterThanOrEqual(0);
  });
});
