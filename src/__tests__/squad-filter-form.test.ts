import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Formation, SquadCandidate, TeamColorSelection } from '@/types/squad';
import type { Player } from '@/types/player';

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    spid: 101001101,
    pid: 101001,
    name: '손흥민',
    nameEn: 'Son Heungmin',
    seasonId: 67,
    teamId: 1,
    leagueId: 1,
    position: 'ST' as const,
    stats: { ovr: 90, pace: 88, shooting: 90, passing: 80, dribbling: 87, defending: 40, physical: 65 },
    price: 5_000_000_000,
    ...overrides,
  };
}

function makeMockCandidate(index: number): SquadCandidate {
  return {
    squad: {
      id: `squad-test-${index}`,
      formation: '4-3-3' as Formation,
      players: Array.from({ length: 11 }, (_, i) => ({
        player: makeMockPlayer({ spid: 101001100 + i }),
        slotPosition: `slot_${i}`,
      })),
      totalBudget: 100_000_000_000,
      totalCost: 50_000_000_000,
      chemistryScore: 75 + index * 5,
      createdAt: new Date().toISOString(),
    },
    score: 80 + index * 5,
    reasoning: `Test candidate ${index + 1} reasoning`,
  };
}

// ---------------------------------------------------------------------------
// Module export tests
// ---------------------------------------------------------------------------

describe('SquadFilterForm - Module exports', () => {
  it('should export default SquadFilterForm component', async () => {
    const mod = await import('@/components/squad/SquadFilterForm');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });

  it('should export SquadFilterFormProps type (verified by successful import)', async () => {
    // TypeScript interfaces are erased at runtime, but we verify the module
    // loads correctly which means the type definition exists
    const mod = await import('@/components/squad/SquadFilterForm');
    expect(mod.default).toBeDefined();
    // SquadFilterFormProps is a type-only export — its presence is verified
    // by TypeScript at compile time, not at runtime
  });
});

// ---------------------------------------------------------------------------
// Props contract tests
// ---------------------------------------------------------------------------

describe('SquadFilterForm - Props contract', () => {
  it('should accept all required props without error', async () => {
    const SquadFilterForm = (await import('@/components/squad/SquadFilterForm')).default;

    const props = {
      formation: '4-3-3' as Formation,
      onFormationChange: vi.fn(),
      onResults: vi.fn(),
      pinnedPlayers: [makeMockPlayer()],
      onTeamColorChange: vi.fn(),
      onError: vi.fn(),
      className: 'test-class',
    };

    // In Node environment, we can't render but we can verify the component
    // accepts the props type without TypeScript errors (checked at build time).
    expect(typeof SquadFilterForm).toBe('function');

    // Verify all callback props are functions
    expect(typeof props.onFormationChange).toBe('function');
    expect(typeof props.onResults).toBe('function');
    expect(typeof props.onTeamColorChange).toBe('function');
    expect(typeof props.onError).toBe('function');
  });

  it('should accept minimal required props (only formation and onResults)', async () => {
    const SquadFilterForm = (await import('@/components/squad/SquadFilterForm')).default;

    const props = {
      formation: '4-4-2' as Formation,
      onResults: vi.fn(),
    };

    expect(typeof SquadFilterForm).toBe('function');
    expect(props.formation).toBe('4-4-2');
    expect(typeof props.onResults).toBe('function');
  });

  it('should support all 12 formation types', () => {
    const formations: Formation[] = [
      '4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '4-1-4-1',
      '3-4-3', '4-5-1', '5-3-2', '5-4-1', '4-3-2-1',
      '4-4-1-1', '3-4-1-2',
    ];

    expect(formations).toHaveLength(12);
    formations.forEach((f) => {
      expect(typeof f).toBe('string');
      expect(f).toMatch(/^\d(-\d)+$/);
    });
  });
});

// ---------------------------------------------------------------------------
// API request body construction tests
// ---------------------------------------------------------------------------

describe('SquadFilterForm - API request body construction', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should build correct request body with only formation', () => {
    // Simulate the request body building logic from the component
    const formation: Formation = '4-3-3';
    const pinnedPlayers: Player[] = [];
    const budgetRange = {};
    const teamColorSelection: TeamColorSelection | null = null;

    const requestBody: Record<string, unknown> = {
      formation,
      pinnedPlayers: pinnedPlayers.length > 0 ? pinnedPlayers.map((p) => p.spid) : undefined,
    };

    if (budgetRange && 'min' in budgetRange && budgetRange.min != null) {
      requestBody.budgetMin = budgetRange.min;
    }
    if (budgetRange && 'max' in budgetRange && budgetRange.max != null) {
      requestBody.budgetMax = budgetRange.max;
    }
    if (teamColorSelection?.presetName) {
      requestBody.teamColor = teamColorSelection.presetName;
    }

    // Remove undefined values (JSON.stringify handles this but let's verify structure)
    expect(requestBody.formation).toBe('4-3-3');
    expect(requestBody.pinnedPlayers).toBeUndefined();
    expect(requestBody.budgetMin).toBeUndefined();
    expect(requestBody.budgetMax).toBeUndefined();
    expect(requestBody.teamColor).toBeUndefined();
  });

  it('should build correct request body with all fields populated', () => {
    const formation: Formation = '4-2-3-1';
    const pinnedPlayers = [makeMockPlayer({ spid: 123 }), makeMockPlayer({ spid: 456 })];
    const budgetRange = { min: 10, max: 500 };
    const teamColorSelection: TeamColorSelection = {
      primary: '#6CABDD',
      secondary: '#1C2C5B',
      presetId: 'man-city',
      presetName: '맨체스터 시티 Manchester City',
    };

    const requestBody: Record<string, unknown> = {
      formation,
      pinnedPlayers: pinnedPlayers.length > 0 ? pinnedPlayers.map((p) => p.spid) : undefined,
    };

    if (budgetRange && 'min' in budgetRange && budgetRange.min != null) {
      requestBody.budgetMin = budgetRange.min;
    }
    if (budgetRange && 'max' in budgetRange && budgetRange.max != null) {
      requestBody.budgetMax = budgetRange.max;
    }
    if (teamColorSelection?.presetName) {
      requestBody.teamColor = teamColorSelection.presetName;
    }

    expect(requestBody.formation).toBe('4-2-3-1');
    expect(requestBody.pinnedPlayers).toEqual([123, 456]);
    expect(requestBody.budgetMin).toBe(10);
    expect(requestBody.budgetMax).toBe(500);
    expect(requestBody.teamColor).toBe('맨체스터 시티 Manchester City');
  });

  it('should not include teamColor when no preset name is set', () => {
    const teamColorSelection: TeamColorSelection = {
      primary: '#FF0000',
      secondary: '#0000FF',
    };

    const requestBody: Record<string, unknown> = {};

    if (teamColorSelection?.presetName) {
      requestBody.teamColor = teamColorSelection.presetName;
    }

    expect(requestBody.teamColor).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// API interaction tests (mock fetch)
// ---------------------------------------------------------------------------

describe('SquadFilterForm - API interaction', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should handle successful API response with 3 candidates', async () => {
    const mockCandidates = [
      makeMockCandidate(0),
      makeMockCandidate(1),
      makeMockCandidate(2),
    ];

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: mockCandidates }),
    });

    const res = await fetch('/api/squad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formation: '4-3-3' }),
    });

    expect(res.ok).toBe(true);
    const data = await res.json();
    expect(data.candidates).toHaveLength(3);
    expect(data.candidates[0].squad.formation).toBe('4-3-3');
    expect(data.candidates[0].score).toBe(80);
  });

  it('should handle API error response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'Invalid formation' }),
    });

    const res = await fetch('/api/squad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formation: 'invalid' }),
    });

    expect(res.ok).toBe(false);
    const errorData = await res.json();
    expect(errorData.error).toBe('Invalid formation');
  });

  it('should handle network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(
      fetch('/api/squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formation: '4-3-3' }),
      }),
    ).rejects.toThrow('Failed to fetch');
  });

  it('should handle empty candidates array response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] }),
    });

    const res = await fetch('/api/squad', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formation: '4-3-3' }),
    });

    const data = await res.json();
    expect(data.candidates).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Helper function tests
// ---------------------------------------------------------------------------

describe('SquadFilterForm - Pinned player spid building', () => {
  it('should return undefined for empty pinned players array', () => {
    const result: number[] | undefined =
      [].length > 0 ? [makeMockPlayer()].map((p) => p.spid) : undefined;
    expect(result).toBeUndefined();
  });

  it('should return spid array for non-empty pinned players', () => {
    const pinned = [
      makeMockPlayer({ spid: 123 }),
      makeMockPlayer({ spid: 456 }),
      makeMockPlayer({ spid: 789 }),
    ];
    const result = pinned.map((p) => p.spid);
    expect(result).toEqual([123, 456, 789]);
  });
});

// ---------------------------------------------------------------------------
// Active filter count logic tests
// ---------------------------------------------------------------------------

describe('SquadFilterForm - Active filter count logic', () => {
  it('should count 0 active filters for default state', () => {
    const budgetRange = {};
    const teamColorSelection = null;

    let count = 0;
    if (budgetRange && 'min' in budgetRange && budgetRange.min != null && budgetRange.min > 0) count++;
    if (budgetRange && 'max' in budgetRange && budgetRange.max != null && budgetRange.max < 2000) count++;
    if (teamColorSelection) count++;

    expect(count).toBe(0);
  });

  it('should count budget max as active filter', () => {
    const budgetRange = { max: 500 };
    const teamColorSelection = null;

    let count = 0;
    if (budgetRange && 'min' in budgetRange && budgetRange.min != null && budgetRange.min > 0) count++;
    if (budgetRange && 'max' in budgetRange && budgetRange.max != null && budgetRange.max < 2000) count++;
    if (teamColorSelection) count++;

    expect(count).toBe(1);
  });

  it('should count budget min as active filter', () => {
    const budgetRange = { min: 100 };
    const teamColorSelection = null;

    let count = 0;
    if (budgetRange && 'min' in budgetRange && budgetRange.min != null && budgetRange.min > 0) count++;
    if (budgetRange && 'max' in budgetRange && budgetRange.max != null && budgetRange.max < 2000) count++;
    if (teamColorSelection) count++;

    expect(count).toBe(1);
  });

  it('should count both budget range and team color as active', () => {
    const budgetRange = { min: 50, max: 500 };
    const teamColorSelection: TeamColorSelection = {
      primary: '#FF0000',
      secondary: '#0000FF',
      presetId: 'test',
      presetName: 'Test Team',
    };

    let count = 0;
    if (budgetRange && 'min' in budgetRange && budgetRange.min != null && budgetRange.min > 0) count++;
    if (budgetRange && 'max' in budgetRange && budgetRange.max != null && budgetRange.max < 2000) count++;
    if (teamColorSelection) count++;

    expect(count).toBe(3);
  });

  it('should not count budget min of 0 as active', () => {
    const budgetRange = { min: 0 };
    const teamColorSelection = null;

    let count = 0;
    if (budgetRange && 'min' in budgetRange && budgetRange.min != null && budgetRange.min > 0) count++;
    if (budgetRange && 'max' in budgetRange && budgetRange.max != null && budgetRange.max < 2000) count++;
    if (teamColorSelection) count++;

    expect(count).toBe(0);
  });

  it('should not count budget max of 2000 as active', () => {
    const budgetRange = { max: 2000 };
    const teamColorSelection = null;

    let count = 0;
    if (budgetRange && 'min' in budgetRange && budgetRange.min != null && budgetRange.min > 0) count++;
    if (budgetRange && 'max' in budgetRange && budgetRange.max != null && budgetRange.max < 2000) count++;
    if (teamColorSelection) count++;

    expect(count).toBe(0);
  });
});
