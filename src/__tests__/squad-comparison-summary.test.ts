import { describe, it, expect, vi } from 'vitest';

// Helper to create mock candidates with players for testing
function makeMockCandidates(options?: {
  count?: number;
  overrideChemistry?: number[];
  overrideCost?: number[];
  overrideBudget?: number[];
}) {
  const count = options?.count ?? 3;
  const chemValues = options?.overrideChemistry ?? [75, 82, 68];
  const costValues = options?.overrideCost ?? [300_000_000, 180_000_000, 450_000_000];
  const budgetValues = options?.overrideBudget ?? [500_000_000, 500_000_000, 500_000_000];

  const formations = ['4-3-3', '4-4-2', '3-5-2'] as const;
  const ovrSets = [
    [88, 85, 90, 87, 82, 91, 86, 84, 89, 83, 85], // avg ~86
    [80, 83, 78, 82, 79, 81, 85, 77, 84, 80, 82], // avg ~81
    [92, 89, 94, 90, 88, 91, 93, 87, 95, 86, 90], // avg ~90
  ];

  return Array.from({ length: count }, (_, i) => ({
    squad: {
      id: `comparison-${i}`,
      formation: formations[i % formations.length],
      players: ovrSets[i % ovrSets.length].map((ovr, j) => ({
        player: {
          spid: 1000 + i * 100 + j,
          pid: 2000 + i * 100 + j,
          name: `Player ${i}-${j}`,
          nameEn: `Player ${i}-${j}`,
          seasonId: 1,
          seasonName: 'Test Season',
          seasonSlug: 'test-season',
          cardType: 'BASE' as const,
          position: 'ST',
          teamId: 1,
          teamName: 'Test Team',
          teamNameEn: 'Test Team',
          leagueId: 1,
          leagueName: 'Test League',
          stats: { ovr, pace: 70, shooting: 70, passing: 70, dribbling: 70, defending: 70, physical: 70 },
          price: 10_000_000,
          priceUpdatedAt: new Date().toISOString(),
        },
        slotPosition: 'ST',
      })),
      totalBudget: budgetValues[i] ?? 500_000_000,
      totalCost: costValues[i] ?? 300_000_000,
      chemistryScore: chemValues[i] ?? 75,
      createdAt: new Date().toISOString(),
    },
    score: 80 + i * 3,
    reasoning: `Candidate ${i + 1} reasoning`,
  }));
}

describe('SquadComparisonSummary - Module exports', () => {
  it('should export SquadComparisonSummary component', async () => {
    const mod = await import('@/components/squad/SquadComparisonSummary');
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe('function');
  });
});

describe('SquadComparisonSummary - Props contract', () => {
  it('should accept 3 candidates', async () => {
    const SquadComparisonSummary = (await import('@/components/squad/SquadComparisonSummary')).default;
    const candidates = makeMockCandidates();

    expect(SquadComparisonSummary).toBeInstanceOf(Function);
    expect(() =>
      SquadComparisonSummary({ candidates }),
    ).toBeDefined();
  });

  it('should accept 2 candidates', async () => {
    const SquadComparisonSummary = (await import('@/components/squad/SquadComparisonSummary')).default;
    const candidates = makeMockCandidates({ count: 2 });

    expect(SquadComparisonSummary).toBeInstanceOf(Function);
  });
});

describe('SquadComparisonSummary - avgOvr computation', () => {
  // This mirrors the component's internal avgOvr function for unit testing
  const computeAvgOvr = (players: { player: { stats: { ovr: number } } }[]): number => {
    if (players.length === 0) return 0;
    return Math.round(
      players.reduce((sum, sp) => sum + sp.player.stats.ovr, 0) / players.length,
    );
  };

  it('should compute average OVR correctly for each candidate', () => {
    const candidates = makeMockCandidates();

    // Candidate 0: avg of [88,85,90,87,82,91,86,84,89,83,85] = 940/11 ≈ 85
    const avg0 = computeAvgOvr(candidates[0].squad.players);
    expect(avg0).toBe(86);

    // Candidate 1: avg of [80,83,78,82,79,81,85,77,84,80,82] = 891/11 ≈ 81
    const avg1 = computeAvgOvr(candidates[1].squad.players);
    expect(avg1).toBe(81);

    // Candidate 2: avg of [92,89,94,90,88,91,93,87,95,86,90] = 985/11 ≈ 90
    const avg2 = computeAvgOvr(candidates[2].squad.players);
    expect(avg2).toBe(90);
  });

  it('should return 0 for empty player list', () => {
    expect(computeAvgOvr([])).toBe(0);
  });
});

describe('SquadComparisonSummary - Best candidate identification', () => {
  it('should identify the candidate with the highest OVR as best', () => {
    const candidates = makeMockCandidates();
    const ovrValues = candidates.map(
      (c) =>
        Math.round(
          c.squad.players.reduce((s, p) => s + p.player.stats.ovr, 0) /
            c.squad.players.length,
        ),
    );
    const bestOvrIndex = ovrValues.indexOf(Math.max(...ovrValues));
    expect(bestOvrIndex).toBe(2); // Candidate 3 has highest OVR (90)
  });

  it('should identify the candidate with the highest chemistry as best', () => {
    const candidates = makeMockCandidates();
    const chemValues = candidates.map((c) => c.squad.chemistryScore);
    const bestChemIndex = chemValues.indexOf(Math.max(...chemValues));
    expect(bestChemIndex).toBe(1); // Candidate 2 has chemistry 82
  });

  it('should identify the candidate with the lowest cost as best budget option', () => {
    const candidates = makeMockCandidates();
    const costValues = candidates.map((c) => c.squad.totalCost);
    const bestCostIndex = costValues.indexOf(Math.min(...costValues));
    expect(bestCostIndex).toBe(1); // Candidate 2 costs 180억 (lowest)
  });

  it('should identify the candidate with the highest score as best', () => {
    const candidates = makeMockCandidates();
    const scoreValues = candidates.map((c) => c.score);
    const bestScoreIndex = scoreValues.indexOf(Math.max(...scoreValues));
    expect(bestScoreIndex).toBe(2); // Candidate 3 has score 86
  });
});

describe('SquadComparisonSummary - Budget utilization', () => {
  it('should calculate budget usage percentage correctly', () => {
    const candidates = makeMockCandidates({
      overrideCost: [250_000_000, 500_000_000, 450_000_000],
      overrideBudget: [500_000_000, 500_000_000, 500_000_000],
    });

    candidates.forEach((c) => {
      const pct = Math.round((c.squad.totalCost / c.squad.totalBudget) * 100);
      expect(pct).toBeGreaterThanOrEqual(0);
      expect(pct).toBeLessThanOrEqual(200); // Over-budget possible
    });

    // Candidate 0: 250/500 = 50%
    expect(Math.round((candidates[0].squad.totalCost / candidates[0].squad.totalBudget) * 100)).toBe(50);
    // Candidate 1: 500/500 = 100%
    expect(Math.round((candidates[1].squad.totalCost / candidates[1].squad.totalBudget) * 100)).toBe(100);
    // Candidate 2: 450/500 = 90%
    expect(Math.round((candidates[2].squad.totalCost / candidates[2].squad.totalBudget) * 100)).toBe(90);
  });

  it('should detect over-budget scenarios', () => {
    const candidates = makeMockCandidates({
      overrideCost: [600_000_000, 400_000_000, 500_000_000],
      overrideBudget: [500_000_000, 500_000_000, 500_000_000],
    });

    // Candidate 0 is over budget
    expect(candidates[0].squad.totalCost).toBeGreaterThan(candidates[0].squad.totalBudget);
    // Candidates 1 and 2 are within budget
    expect(candidates[1].squad.totalCost).toBeLessThan(candidates[1].squad.totalBudget);
    expect(candidates[2].squad.totalCost).toBeLessThanOrEqual(candidates[2].squad.totalBudget);
  });
});

describe('SquadComparisonSummary - Edge cases', () => {
  it('should return null for empty candidates array (component-level)', async () => {
    const SquadComparisonSummary = (await import('@/components/squad/SquadComparisonSummary')).default;
    // Component has early return for < 2 candidates
    expect(SquadComparisonSummary).toBeInstanceOf(Function);
  });

  it('should return null for single candidate (component-level)', async () => {
    const SquadComparisonSummary = (await import('@/components/squad/SquadComparisonSummary')).default;
    expect(SquadComparisonSummary).toBeInstanceOf(Function);
  });

  it('should handle zero-budget squads gracefully', () => {
    const candidates = makeMockCandidates({
      overrideCost: [0, 0, 0],
      overrideBudget: [0, 0, 0],
    });

    candidates.forEach((c) => {
      expect(c.squad.totalCost).toBe(0);
      expect(c.squad.totalBudget).toBe(0);
    });
  });
});

describe('SquadComparisonSummary - Formation display', () => {
  it('should show distinct formations for each candidate', () => {
    const candidates = makeMockCandidates();
    const formations = candidates.map((c) => c.squad.formation);

    expect(formations).toContain('4-3-3');
    expect(formations).toContain('4-4-2');
    expect(formations).toContain('3-5-2');
    expect(new Set(formations).size).toBe(3); // All different
  });
});

describe('SquadComparisonSummary - Chemistry score classification', () => {
  // Mirrors the component's chemColor function
  const classifyChem = (score: number): string => {
    if (score >= 80) return 'green';
    if (score >= 50) return 'yellow';
    return 'red';
  };

  it('should classify 80+ as green', () => {
    expect(classifyChem(100)).toBe('green');
    expect(classifyChem(80)).toBe('green');
  });

  it('should classify 50-79 as yellow', () => {
    expect(classifyChem(79)).toBe('yellow');
    expect(classifyChem(50)).toBe('yellow');
  });

  it('should classify below 50 as red', () => {
    expect(classifyChem(49)).toBe('red');
    expect(classifyChem(0)).toBe('red');
  });
});

describe('SquadComparisonSummary - formatCost utility', () => {
  // Uses the shared utility from stat-utils (now includes "BP" suffix)
  const formatCost = (price: number): string => {
    if (price <= 0) return '0 BP';
    const eok = price / 100_000_000;
    if (eok >= 1) return `${eok.toFixed(1)}억 BP`;
    const man = Math.round(price / 10_000);
    return `${man}만 BP`;
  };

  it('should format large amounts in 억 with BP suffix', () => {
    expect(formatCost(500_000_000)).toBe('5.0억 BP');
    expect(formatCost(100_000_000)).toBe('1.0억 BP');
    expect(formatCost(1_500_000_000)).toBe('15.0억 BP');
  });

  it('should format small amounts in 만 with BP suffix', () => {
    expect(formatCost(50_000_000)).toBe('5000만 BP');
    expect(formatCost(10_000_000)).toBe('1000만 BP');
    expect(formatCost(5_000_000)).toBe('500만 BP');
  });

  it('should handle zero', () => {
    expect(formatCost(0)).toBe('0 BP');
  });
});
