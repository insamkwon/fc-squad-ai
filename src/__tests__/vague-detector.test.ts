/**
 * Unit tests for the vague input detection module.
 *
 * Tests cover:
 * 1. Basic vagueness detection (clear input)
 * 2. Missing formation detection
 * 3. Missing budget detection
 * 4. Vague budget terms detection (cheap, expensive, etc.)
 * 5. Missing league/team context detection
 * 6. Missing playstyle detection
 * 7. Short input detection
 * 8. No constraints detection
 * 9. Multi-constraint analysis (combined missing items)
 * 10. Vagueness level classification
 * 11. Quick suggestions extraction
 * 12. Multi-candidate vague analysis
 * 13. Korean and English message content
 */

import { describe, it, expect } from 'vitest';
import {
  analyzeVagueInput,
  analyzeMultiCandidateVagueInput,
  getQuickSuggestions,
} from '@/lib/ai/vague-detector';
import type { ParsedSquadRequest } from '@/lib/ai/types';
import type { Formation } from '@/types';

// ---------------------------------------------------------------------------
// 1. Clear Input — no issues
// ---------------------------------------------------------------------------

describe('analyzeVagueInput - clear input', () => {
  it('should return clear for a fully specified request', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      budget: { max: 5000000, strictness: 'flexible' },
      teams: [{ name: 'Manchester City', strength: 'preferred' }],
      leagues: [{ league: 'EPL', strength: 'preferred' }],
      playstyle: 'balanced',
      statPriorities: ['pace', 'shooting'],
      confidence: 0.9,
    };
    const analysis = analyzeVagueInput(request, '4-3-3으로 프리미어리그 맨시티 500만 예산 빠른 선수들로 짜줘');
    expect(analysis.isVague).toBe(false);
    expect(analysis.vaguenessLevel).toBe('clear');
    expect(analysis.issues).toHaveLength(0);
    expect(analysis.summaryKo).toBe('');
  });

  it('should return clear for request with formation, budget, and team', () => {
    const request: ParsedSquadRequest = {
      formation: '4-4-2',
      budget: { max: 1000000000, strictness: 'strict' },
      teams: [{ name: 'FC Barcelona', strength: 'required' }],
      confidence: 0.8,
    };
    const analysis = analyzeVagueInput(request, '바르셀로나 4-4-2 10억 이하로 짜줘');
    expect(analysis.isVague).toBe(false);
    expect(analysis.vaguenessLevel).toBe('clear');
  });
});

// ---------------------------------------------------------------------------
// 2. Missing Formation Detection
// ---------------------------------------------------------------------------

describe('analyzeVagueInput - missing formation', () => {
  it('should detect missing formation', () => {
    const request: ParsedSquadRequest = {
      budget: { max: 5000000, strictness: 'flexible' },
      teams: [{ name: 'Manchester City', strength: 'preferred' }],
      confidence: 0.7,
    };
    const analysis = analyzeVagueInput(request, '맨시티 500만으로 스쿼드 짜줘');
    expect(analysis.isVague).toBe(true);
    expect(analysis.issues.some((i) => i.type === 'formation')).toBe(true);
    expect(analysis.issues.find((i) => i.type === 'formation')?.severity).toBe('suggestion');
  });

  it('should provide formation suggestions', () => {
    const request: ParsedSquadRequest = { confidence: 0.5 };
    const analysis = analyzeVagueInput(request, 'EPL 스쿼드');
    const formationIssue = analysis.issues.find((i) => i.type === 'formation');
    expect(formationIssue).toBeDefined();
    expect(formationIssue!.suggestions.length).toBeGreaterThan(0);
    // Suggestions should be in both Korean and English
    expect(formationIssue!.suggestions[0].ko).toBeTruthy();
    expect(formationIssue!.suggestions[0].en).toBeTruthy();
  });

  it('should not flag formation if present', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.8,
    };
    const analysis = analyzeVagueInput(request, '4-3-3으로 짜줘');
    expect(analysis.issues.some((i) => i.type === 'formation')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Missing Budget Detection
// ---------------------------------------------------------------------------

describe('analyzeVagueInput - missing budget', () => {
  it('should detect missing budget', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      teams: [{ name: 'Real Madrid', strength: 'preferred' }],
      confidence: 0.7,
    };
    const analysis = analyzeVagueInput(request, '레알마드리드 4-3-3으로 짜줘');
    expect(analysis.isVague).toBe(true);
    expect(analysis.issues.some((i) => i.type === 'budget')).toBe(true);
    expect(analysis.issues.find((i) => i.type === 'budget')?.severity).toBe('suggestion');
  });

  it('should provide budget suggestions', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.7,
    };
    const analysis = analyzeVagueInput(request, '4-3-3 스쿼드 짜줘');
    const budgetIssue = analysis.issues.find((i) => i.type === 'budget');
    expect(budgetIssue).toBeDefined();
    expect(budgetIssue!.suggestions.length).toBeGreaterThan(0);
    expect(budgetIssue!.suggestions.some((s) => s.ko.includes('억'))).toBe(true);
  });

  it('should not flag budget if max is specified', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      budget: { max: 5000000, strictness: 'flexible' },
      confidence: 0.8,
    };
    const analysis = analyzeVagueInput(request, '4-3-3 500만 스쿼드');
    expect(analysis.issues.some((i) => i.type === 'budget')).toBe(false);
  });

  it('should not flag budget if min is specified', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      budget: { min: 1000000, strictness: 'none' },
      confidence: 0.8,
    };
    const analysis = analyzeVagueInput(request, '4-3-3 스쿼드');
    expect(analysis.issues.some((i) => i.type === 'budget')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Vague Budget Terms Detection
// ---------------------------------------------------------------------------

describe('analyzeVagueInput - vague budget terms', () => {
  it('should detect "cheap" as a vague budget term', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.6,
    };
    const analysis = analyzeVagueInput(request, 'cheap EPL squad');
    expect(analysis.issues.some((i) => i.type === 'budget')).toBe(true);
    const budgetIssue = analysis.issues.find((i) => i.type === 'budget');
    expect(budgetIssue!.messageEn).toContain('cheap');
  });

  it('should detect Korean vague budget terms', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.6,
    };
    const analysis = analyzeVagueInput(request, '가성비 좋은 스쿼드');
    expect(analysis.issues.some((i) => i.type === 'budget')).toBe(true);
    const budgetIssue = analysis.issues.find((i) => i.type === 'budget');
    expect(budgetIssue!.messageKo).toContain('가성비');
  });

  it('should detect "premium" as a vague budget term', () => {
    const request: ParsedSquadRequest = { confidence: 0.6 };
    const analysis = analyzeVagueInput(request, 'premium 4-3-3 squad');
    expect(analysis.issues.some((i) => i.type === 'budget')).toBe(true);
  });

  it('should detect multiple vague budget terms', () => {
    const request: ParsedSquadRequest = { confidence: 0.6 };
    const analysis = analyzeVagueInput(request, 'cheap but premium squad');
    const budgetIssue = analysis.issues.find((i) => i.type === 'budget');
    expect(budgetIssue).toBeDefined();
    // Should mention both terms
    expect(budgetIssue!.messageEn).toContain('cheap');
  });

  it('should not flag budget when specific amount is given even with vague terms', () => {
    const request: ParsedSquadRequest = {
      budget: { max: 500000, strictness: 'strict' },
      confidence: 0.8,
    };
    const analysis = analyzeVagueInput(request, 'cheap squad under 500k');
    expect(analysis.issues.some((i) => i.type === 'budget')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 5. Missing League/Team Context Detection
// ---------------------------------------------------------------------------

describe('analyzeVagueInput - missing league/team', () => {
  it('should detect missing league/team context', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      budget: { max: 5000000, strictness: 'flexible' },
      confidence: 0.7,
    };
    const analysis = analyzeVagueInput(request, '4-3-3 500만 스쿼드');
    expect(analysis.issues.some((i) => i.type === 'league')).toBe(true);
    // League/team missing is info-level, not vague by itself
    expect(analysis.issues.find((i) => i.type === 'league')?.severity).toBe('info');
  });

  it('should not flag league when team is specified', () => {
    const request: ParsedSquadRequest = {
      teams: [{ name: 'Manchester City', strength: 'preferred' }],
      confidence: 0.7,
    };
    const analysis = analyzeVagueInput(request, '맨시티 스쿼드');
    expect(analysis.issues.some((i) => i.type === 'league')).toBe(false);
  });

  it('should not flag league when league is specified', () => {
    const request: ParsedSquadRequest = {
      leagues: [{ league: 'EPL', strength: 'preferred' }],
      confidence: 0.7,
    };
    const analysis = analyzeVagueInput(request, 'EPL 스쿼드');
    expect(analysis.issues.some((i) => i.type === 'league')).toBe(false);
  });

  it('should not flag league when nationality is specified', () => {
    const request: ParsedSquadRequest = {
      nationalities: [{ nationality: 'Korean', strength: 'preferred' }],
      confidence: 0.7,
    };
    const analysis = analyzeVagueInput(request, '한국 선수들로 스쿼드');
    expect(analysis.issues.some((i) => i.type === 'league')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 6. Missing Playstyle Detection
// ---------------------------------------------------------------------------

describe('analyzeVagueInput - missing playstyle', () => {
  it('should detect missing playstyle', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      budget: { max: 5000000, strictness: 'flexible' },
      teams: [{ name: 'Manchester City', strength: 'preferred' }],
      confidence: 0.7,
    };
    const analysis = analyzeVagueInput(request, '4-3-3 맨시티 500만 스쿼드');
    expect(analysis.issues.some((i) => i.type === 'playstyle')).toBe(true);
    expect(analysis.issues.find((i) => i.type === 'playstyle')?.severity).toBe('info');
  });

  it('should not flag playstyle when specified', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      playstyle: 'attacking',
      confidence: 0.8,
    };
    const analysis = analyzeVagueInput(request, '4-3-3 공격적인 스쿼드');
    expect(analysis.issues.some((i) => i.type === 'playstyle')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. Short Input Detection
// ---------------------------------------------------------------------------

describe('analyzeVagueInput - short input', () => {
  it('should detect very short input (1-4 chars)', () => {
    const request: ParsedSquadRequest = { confidence: 0.3 };
    const analysis = analyzeVagueInput(request, '짜줘');
    expect(analysis.issues.some((i) => i.type === 'short_input')).toBe(true);
    expect(analysis.issues.find((i) => i.type === 'short_input')?.severity).toBe('warning');
  });

  it('should not flag 5+ character input as short', () => {
    const request: ParsedSquadRequest = { confidence: 0.5 };
    const analysis = analyzeVagueInput(request, '스쿼드 짜줘');
    expect(analysis.issues.some((i) => i.type === 'short_input')).toBe(false);
  });

  it('should include the input text in the warning message', () => {
    const request: ParsedSquadRequest = { confidence: 0.3 };
    const analysis = analyzeVagueInput(request, 'ㅋㅋ');
    const shortIssue = analysis.issues.find((i) => i.type === 'short_input');
    expect(shortIssue!.messageKo).toContain('ㅋㅋ');
    expect(shortIssue!.messageEn).toContain('ㅋㅋ');
  });

  it('should provide good suggestions for short input', () => {
    const request: ParsedSquadRequest = { confidence: 0.3 };
    const analysis = analyzeVagueInput(request, '짜줘');
    const shortIssue = analysis.issues.find((i) => i.type === 'short_input');
    expect(shortIssue!.suggestions.length).toBeGreaterThanOrEqual(2);
    // Suggestions should include formation + league + budget pattern
    expect(shortIssue!.suggestions.some((s) => s.ko.includes('4-3-3'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8. No Constraints Detection
// ---------------------------------------------------------------------------

describe('analyzeVagueInput - no constraints', () => {
  it('should detect when no constraints are specified', () => {
    const request: ParsedSquadRequest = { confidence: 0.3 };
    const analysis = analyzeVagueInput(request, '좋은 스쿼드 만들어줘');
    expect(analysis.issues.some((i) => i.type === 'no_constraints')).toBe(true);
    expect(analysis.issues.find((i) => i.type === 'no_constraints')?.severity).toBe('warning');
  });

  it('should not trigger no_constraints when at least one constraint exists', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.5,
    };
    const analysis = analyzeVagueInput(request, '4-3-3으로 짜줘');
    expect(analysis.issues.some((i) => i.type === 'no_constraints')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 9. Multi-Constraint Analysis (combined missing items)
// ---------------------------------------------------------------------------

describe('analyzeVagueInput - combined analysis', () => {
  it('should detect both missing formation and budget', () => {
    const request: ParsedSquadRequest = {
      teams: [{ name: 'Real Madrid', strength: 'preferred' }],
      confidence: 0.6,
    };
    const analysis = analyzeVagueInput(request, '레알마드리드 스쿼드 짜줘');
    expect(analysis.issues.some((i) => i.type === 'formation')).toBe(true);
    expect(analysis.issues.some((i) => i.type === 'budget')).toBe(true);
    expect(analysis.isVague).toBe(true);
  });

  it('should detect formation + budget + league missing together', () => {
    const request: ParsedSquadRequest = {
      playstyle: 'attacking',
      confidence: 0.5,
    };
    const analysis = analyzeVagueInput(request, '공격적인 스쿼드');
    expect(analysis.issues.some((i) => i.type === 'formation')).toBe(true);
    expect(analysis.issues.some((i) => i.type === 'budget')).toBe(true);
    expect(analysis.issues.some((i) => i.type === 'league')).toBe(true);
    expect(analysis.isVague).toBe(true);
  });

  it('should sort issues by severity (warning > suggestion > info)', () => {
    const request: ParsedSquadRequest = { confidence: 0.3 };
    const analysis = analyzeVagueInput(request, '좋은');
    // Short input is warning, no_constraints is warning, rest are suggestion/info
    let lastSeverity = 999;
    for (const issue of analysis.issues) {
      const order = issue.severity === 'warning' ? 3 : issue.severity === 'suggestion' ? 2 : 1;
      expect(order).toBeLessThanOrEqual(lastSeverity);
      lastSeverity = order;
    }
  });
});

// ---------------------------------------------------------------------------
// 10. Vagueness Level Classification
// ---------------------------------------------------------------------------

describe('vagueness level classification', () => {
  it('should be "clear" when no issues detected', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      budget: { max: 5000000, strictness: 'flexible' },
      teams: [{ name: 'Manchester City', strength: 'preferred' }],
      playstyle: 'balanced',
      statPriorities: ['pace'],
      confidence: 0.9,
    };
    const analysis = analyzeVagueInput(request, '4-3-3 맨시티 500만 빠른 선수들로');
    expect(analysis.vaguenessLevel).toBe('clear');
  });

  it('should be "somewhat_vague" when some suggestion-level issues but enough constraints', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      budget: { max: 5000000, strictness: 'flexible' },
      teams: [{ name: 'Manchester City', strength: 'preferred' }],
      confidence: 0.7,
    };
    const analysis = analyzeVagueInput(request, '4-3-3 맨시티 500만 스쿼드');
    // Missing playstyle and league are info-level, but we have 3 constraints
    expect(['clear', 'somewhat_vague']).toContain(analysis.vaguenessLevel);
  });

  it('should be "very_vague" when warning-level issues exist', () => {
    const request: ParsedSquadRequest = { confidence: 0.3 };
    const analysis = analyzeVagueInput(request, '짜줘');
    expect(analysis.vaguenessLevel).toBe('very_vague');
  });

  it('should be "vague" when multiple suggestion-level issues and few constraints', () => {
    const request: ParsedSquadRequest = {
      teams: [{ name: 'Manchester City', strength: 'preferred' }],
      confidence: 0.5,
    };
    const analysis = analyzeVagueInput(request, '맨시티 스쿼드');
    expect(['vague', 'very_vague']).toContain(analysis.vaguenessLevel);
  });
});

// ---------------------------------------------------------------------------
// 11. Quick Suggestions Extraction
// ---------------------------------------------------------------------------

describe('getQuickSuggestions', () => {
  it('should return empty array for clear input', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      budget: { max: 5000000, strictness: 'flexible' },
      confidence: 0.9,
    };
    const analysis = analyzeVagueInput(request, '4-3-3 500만');
    expect(getQuickSuggestions(analysis, 'ko')).toHaveLength(0);
  });

  it('should return Korean suggestions by default', () => {
    const request: ParsedSquadRequest = { confidence: 0.3 };
    const analysis = analyzeVagueInput(request, '짜줘');
    const suggestions = getQuickSuggestions(analysis, 'ko');
    expect(suggestions.length).toBeGreaterThan(0);
    // Should be Korean
    for (const suggestion of suggestions) {
      expect(/[ㄱ-힣]/.test(suggestion)).toBe(true);
    }
  });

  it('should return English suggestions when requested', () => {
    const request: ParsedSquadRequest = { confidence: 0.3 };
    const analysis = analyzeVagueInput(request, 'build squad');
    const suggestions = getQuickSuggestions(analysis, 'en');
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('should limit to 3 suggestions', () => {
    const request: ParsedSquadRequest = { confidence: 0.3 };
    const analysis = analyzeVagueInput(request, '짜줘');
    const suggestions = getQuickSuggestions(analysis, 'ko');
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it('should skip info-level issues for quick suggestions', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      budget: { max: 5000000, strictness: 'flexible' },
      teams: [{ name: 'Manchester City', strength: 'preferred' }],
      confidence: 0.7,
    };
    const analysis = analyzeVagueInput(request, '4-3-3 맨시티 500만 스쿼드');
    // Only info-level issues remain (playstyle, league)
    const suggestions = getQuickSuggestions(analysis, 'ko');
    expect(suggestions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 12. Multi-Candidate Vague Analysis
// ---------------------------------------------------------------------------

describe('analyzeMultiCandidateVagueInput', () => {
  it('should use the first candidate for analysis', () => {
    const candidates: ParsedSquadRequest[] = [
      { formation: '4-3-3' as Formation, confidence: 0.8 },
      { formation: '4-2-3-1' as Formation, confidence: 0.7 },
      { formation: '3-5-2' as Formation, confidence: 0.6 },
    ];
    const analysis = analyzeMultiCandidateVagueInput(candidates, 'EPL 스쿼드');
    // First candidate has formation, so no formation issue
    expect(analysis.issues.some((i) => i.type === 'formation')).toBe(false);
  });

  it('should detect missing constraints from candidates', () => {
    const candidates: ParsedSquadRequest[] = [
      { formation: '4-3-3' as Formation, confidence: 0.8 },
      { formation: '4-2-3-1' as Formation, confidence: 0.7 },
      { formation: '3-5-2' as Formation, confidence: 0.6 },
    ];
    const analysis = analyzeMultiCandidateVagueInput(candidates, '4-3-3으로 짜줘');
    // All candidates lack budget
    expect(analysis.issues.some((i) => i.type === 'budget')).toBe(true);
  });

  it('should handle empty candidates array', () => {
    const analysis = analyzeMultiCandidateVagueInput([], 'anything');
    expect(analysis.isVague).toBe(true);
  });

  it('should work with candidates that have budget', () => {
    const candidates: ParsedSquadRequest[] = [
      {
        formation: '4-3-3' as Formation,
        budget: { max: 5000000, strictness: 'flexible' },
        teams: [{ name: 'Manchester City', strength: 'preferred' }],
        confidence: 0.8,
      },
    ];
    const analysis = analyzeMultiCandidateVagueInput(candidates, '4-3-3 맨시티 500만');
    expect(analysis.isVague).toBe(false);
    expect(analysis.vaguenessLevel).toBe('clear');
  });
});

// ---------------------------------------------------------------------------
// 13. Korean and English Message Content
// ---------------------------------------------------------------------------

describe('bilingual messages', () => {
  it('should provide both Korean and English messages for all issues', () => {
    const request: ParsedSquadRequest = { confidence: 0.3 };
    const analysis = analyzeVagueInput(request, '스쿼드');
    for (const issue of analysis.issues) {
      expect(issue.messageKo).toBeTruthy();
      expect(issue.messageEn).toBeTruthy();
      for (const suggestion of issue.suggestions) {
        expect(suggestion.ko).toBeTruthy();
        expect(suggestion.en).toBeTruthy();
      }
    }
  });

  it('should provide Korean summary', () => {
    const request: ParsedSquadRequest = { confidence: 0.3 };
    const analysis = analyzeVagueInput(request, '짜줘');
    expect(analysis.summaryKo).toBeTruthy();
  });

  it('should provide English summary', () => {
    const request: ParsedSquadRequest = { confidence: 0.3 };
    const analysis = analyzeVagueInput(request, 'build squad');
    expect(analysis.summaryEn).toBeTruthy();
  });

  it('should have empty summaries for clear input', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      budget: { max: 5000000, strictness: 'flexible' },
      teams: [{ name: 'Manchester City', strength: 'preferred' }],
      confidence: 0.9,
    };
    const analysis = analyzeVagueInput(request, '4-3-3 맨시티 500만');
    expect(analysis.summaryKo).toBe('');
    expect(analysis.summaryEn).toBe('');
  });
});

// ---------------------------------------------------------------------------
// 14. Edge Cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('should handle empty input', () => {
    const request: ParsedSquadRequest = { confidence: 0 };
    const analysis = analyzeVagueInput(request, '');
    // Empty input has no constraints and no text, so no_constraints won't fire
    // (it requires input.length >= MIN_INPUT_LENGTH)
    expect(analysis.vaguenessLevel).toBe('very_vague');
  });

  it('should handle input with only formation (no other constraints)', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      confidence: 0.5,
    };
    const analysis = analyzeVagueInput(request, '4-3-3');
    expect(analysis.issues.some((i) => i.type === 'formation')).toBe(false);
    expect(analysis.issues.some((i) => i.type === 'budget')).toBe(true);
  });

  it('should handle input with only budget', () => {
    const request: ParsedSquadRequest = {
      budget: { max: 1000000000, strictness: 'flexible' },
      confidence: 0.5,
    };
    const analysis = analyzeVagueInput(request, '10억 예산');
    expect(analysis.issues.some((i) => i.type === 'formation')).toBe(true);
    expect(analysis.issues.some((i) => i.type === 'budget')).toBe(false);
  });

  it('should handle very long detailed input', () => {
    const request: ParsedSquadRequest = {
      formation: '4-3-3',
      budget: { max: 5000000, strictness: 'strict' },
      teams: [{ name: 'Manchester City', strength: 'required' }],
      leagues: [{ league: 'EPL', strength: 'preferred' }],
      playstyle: 'attacking',
      statPriorities: ['pace', 'shooting'],
      chemistry: {
        priority: 'high',
        sameTeamLinks: true,
        sameLeagueLinks: false,
        sameNationalityLinks: false,
      },
      confidence: 0.95,
    };
    const analysis = analyzeVagueInput(
      request,
      '4-3-3 포메이션으로 프리미어리그 맨시티 위주로 500만 이하 엄격하게 예산 지켜서 빠른 선수들과 슈팅 좋은 선수들 위주로 공격적인 스쿼드 팀켐 맞춰서 짜줘',
    );
    expect(analysis.vaguenessLevel).toBe('clear');
    expect(analysis.isVague).toBe(false);
  });

  it('should handle special characters and emoji in input', () => {
    const request: ParsedSquadRequest = { confidence: 0.3 };
    const analysis = analyzeVagueInput(request, '⚽ 스쿼드 🏆');
    expect(analysis.issues.length).toBeGreaterThan(0);
    expect(analysis.vaguenessLevel).not.toBe('clear');
  });

  it('should not crash on null fields in request', () => {
    const request: ParsedSquadRequest = {
      formation: null as unknown as undefined,
      confidence: 0.5,
    };
    const analysis = analyzeVagueInput(request, 'test');
    expect(analysis.vaguenessLevel).toBeDefined();
    expect(typeof analysis.isVague).toBe('boolean');
  });
});
