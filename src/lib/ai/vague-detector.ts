/**
 * Vague input detection for the NLP/chat layer.
 *
 * Analyzes parsed squad requests to identify when formation, budget, or other
 * key constraints are unspecified in user messages. Provides actionable follow-up
 * suggestions to guide the user toward more specific input.
 *
 * Works with both AI-parsed and fallback-parsed ParsedSquadRequest objects.
 *
 * @example
 *   import { analyzeVagueInput } from '@/lib/ai/vague-detector';
 *
 *   const analysis = analyzeVagueInput(parsedRequest, userInput);
 *   if (analysis.isVague) {
 *     // Show suggestions to user
 *     console.log(analysis.summaryKo);
 *     for (const issue of analysis.issues) {
 *       console.log(issue.messageKo);
 *       for (const suggestion of issue.suggestions) {
 *         console.log(`  - ${suggestion.ko}`);
 *       }
 *     }
 *   }
 */

import type {
  ParsedSquadRequest,
  VagueInputIssue,
  VagueInputAnalysis,
  VagueSeverity,
} from './types';
import { VALID_FORMATIONS } from './types';
import { DEFAULT_FORMATION } from '@/constants/squad-defaults';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Minimum input length (in characters) below which the input is considered short */
const MIN_INPUT_LENGTH = 5;

/** Minimum input length (in characters) to consider the input "reasonably detailed" */
const GOOD_INPUT_LENGTH = 15;

/** Number of constraints needed to consider input "not vague" */
const MIN_CONSTRAINTS_FOR_CLEAR = 3;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze a parsed squad request and the original user input to detect
 * vague, missing, or unspecified constraints.
 *
 * @param request - The parsed squad request (from AI or fallback parser)
 * @param originalInput - The original user input string
 * @returns VagueInputAnalysis with detected issues and suggestions
 */
export function analyzeVagueInput(
  request: ParsedSquadRequest,
  originalInput: string,
): VagueInputAnalysis {
  const issues: VagueInputIssue[] = [];
  const input = originalInput.trim();

  // --- 1. Short input detection ---
  if (input.length > 0 && input.length < MIN_INPUT_LENGTH) {
    issues.push(createShortInputIssue(input));
  }

  // --- 2. Formation detection ---
  if (!request.formation) {
    issues.push(createFormationIssue(input));
  }

  // --- 3. Budget detection ---
  const budgetStatus = analyzeBudget(request, input);
  if (budgetStatus) {
    issues.push(budgetStatus);
  }

  // --- 4. League/team context detection ---
  const contextStatus = analyzeContext(request, input);
  if (contextStatus) {
    issues.push(contextStatus);
  }

  // --- 5. Playstyle detection ---
  const playstyleStatus = analyzePlaystyle(request, input);
  if (playstyleStatus) {
    issues.push(playstyleStatus);
  }

  // --- 6. No constraints at all ---
  const constraintCount = countConstraints(request);
  if (constraintCount === 0 && input.length >= MIN_INPUT_LENGTH) {
    issues.push(createNoConstraintsIssue(input));
  }

  // Sort issues by severity (warning > suggestion > info)
  issues.sort((a, b) => severityOrder(b.severity) - severityOrder(a.severity));

  // Build overall analysis
  return buildAnalysis(issues, constraintCount, input);
}

// ---------------------------------------------------------------------------
// Individual constraint analyzers
// ---------------------------------------------------------------------------

/**
 * Analyze budget constraint for vagueness.
 * Returns an issue if budget is missing, or if it's present but vague.
 */
function analyzeBudget(
  request: ParsedSquadRequest,
  input: string,
): VagueInputIssue | null {
  // No budget at all
  if (!request.budget) {
    // Check if the user used vague budget terms
    const vagueBudgetTerms = detectVagueBudgetTerms(input);
    if (vagueBudgetTerms.length > 0) {
      return {
        type: 'budget',
        severity: 'suggestion',
        messageKo: `예산이 명확하지 않습니다. "${vagueBudgetTerms.join(', ')}(이)라는 표현이 감지되었지만 구체적인 금액이 아닙니다.`,
        messageEn: `Budget is unclear. "${vagueBudgetTerms.join(', ')}" detected but no specific amount.`,
        suggestions: [
          { ko: '10억 이하로 짜줘', en: 'Build under 1B' },
          { ko: '50억 예산으로 구성해줘', en: 'Build with a 5B budget' },
          { ko: '100억으로 최고급 스쿼드', en: 'Premium squad with 10B budget' },
        ],
      };
    }

    return {
      type: 'budget',
      severity: 'suggestion',
      messageKo: '예산이 지정되지 않았습니다. 예산을 설정하면 더 적합한 스쿼드를 추천할 수 있습니다.',
      messageEn: 'No budget specified. Setting a budget helps recommend a more suitable squad.',
      suggestions: [
        { ko: '5억 이하로 짜줘', en: 'Build under 500M' },
        { ko: '10억 예산으로', en: 'Build with 1B budget' },
        { ko: '예산은 무제한이야', en: 'No budget limit' },
      ],
    };
  }

  // Budget present but no max value (only strictness or min)
  if (!request.budget.max && !request.budget.min) {
    return {
      type: 'budget',
      severity: 'info',
      messageKo: '예산 금액이 명확하지 않습니다.',
      messageEn: 'Budget amount is unclear.',
      suggestions: [
        { ko: '5억 이하 스쿼드', en: 'Squad under 500M' },
        { ko: '20억으로 최고급', en: 'Premium squad under 2B' },
      ],
    };
  }

  return null;
}

/**
 * Analyze league/team context for vagueness.
 */
function analyzeContext(
  request: ParsedSquadRequest,
  _input: string,
): VagueInputIssue | null {
  const hasTeam = request.teams && request.teams.length > 0;
  const hasLeague = request.leagues && request.leagues.length > 0;
  const hasNationality = request.nationalities && request.nationalities.length > 0;

  if (!hasTeam && !hasLeague && !hasNationality) {
    return {
      type: 'league',
      severity: 'info',
      messageKo: '리그나 팀이 지정되지 않았습니다. 선호하는 리그나 팀을 알려주시면 더 맞춤화된 스쿼드를 추천합니다.',
      messageEn: 'No league or team specified. Tell us your preferred league or team for more tailored recommendations.',
      suggestions: [
        { ko: '프리미어리그 스쿼드 짜줘', en: 'Build a Premier League squad' },
        { ko: '맨시티 위주로 구성', en: 'Build around Manchester City' },
        { ko: '라리가 선수들로 짜줘', en: 'Build with La Liga players' },
      ],
    };
  }

  return null;
}

/**
 * Analyze playstyle for vagueness.
 */
function analyzePlaystyle(
  request: ParsedSquadRequest,
  _input: string,
): VagueInputIssue | null {
  if (!request.playstyle) {
    return {
      type: 'playstyle',
      severity: 'info',
      messageKo: '선호하는 플레이스타일을 알려주시면 더 적합한 선수를 추천할 수 있습니다.',
      messageEn: 'Tell us your preferred playstyle for better player recommendations.',
      suggestions: [
        { ko: '공격적인 스쿼드로', en: 'Attacking squad' },
        { ko: '수비적인 밸런스로 짜줘', en: 'Defensive balanced squad' },
        { ko: '볼 점율 위주로', en: 'Possession-based squad' },
      ],
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Issue creators
// ---------------------------------------------------------------------------

function createShortInputIssue(input: string): VagueInputIssue {
  return {
    type: 'short_input',
    severity: 'warning',
    messageKo: `입력이 너무 짧습니다 ("${input}"). 포메이션, 예산, 선호 팀 등을 포함해보세요.`,
    messageEn: `Input is too short ("${input}"). Try including formation, budget, or preferred team.`,
    suggestions: [
      { ko: '4-3-3으로 프리미어리그 10억 이하 스쿼드 짜줘', en: 'Build a 4-3-3 EPL squad under 1B' },
      { ko: '맨시티 4-4-2 포메이션으로 20억 예산', en: 'Man City 4-4-2 formation with 2B budget' },
    ],
  };
}

function createFormationIssue(input: string): VagueInputIssue {
  return {
    type: 'formation',
    severity: 'suggestion',
    messageKo: `포메이션이 지정되지 않았습니다. 기본값(${DEFAULT_FORMATION})이 사용됩니다.`,
    messageEn: `No formation specified. Default (${DEFAULT_FORMATION}) will be used.`,
    suggestions: buildFormationSuggestions(input),
  };
}

function createNoConstraintsIssue(input: string): VagueInputIssue {
  return {
    type: 'no_constraints',
    severity: 'warning',
    messageKo: `구체적인 조건이 감지되지 않았습니다. "${input}"에서 어떤 스쿼드를 원하시는지 더 자세히 알려주세요.`,
    messageEn: `No specific constraints detected. Please provide more details about what squad you want.`,
    suggestions: [
      { ko: '4-3-3으로 프리미어리그 10억 이하 스쿼드 짜줘', en: 'Build a 4-3-3 EPL squad under 1B' },
      { ko: '맨시티 위주로 20억 예산 빠른 선수들로', en: 'Man City focused, 2B budget, fast players' },
      { ko: '라리가 5억 수비적인 스쿼드', en: 'La Liga, 500M, defensive squad' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detect vague budget terms in user input (e.g., "cheap", "expensive", "reasonable").
 */
function detectVagueBudgetTerms(input: string): string[] {
  const vagueTerms: { pattern: RegExp; term: string; termKo: string }[] = [
    { pattern: /\bcheap\b/i, term: 'cheap', termKo: '저렴한' },
    { pattern: /\bexpensive\b/i, term: 'expensive', termKo: '비싼' },
    { pattern: /\bbudget\b/i, term: 'budget', termKo: '가성비' },
    { pattern: /\breasonable\b/i, term: 'reasonable', termKo: '적당한' },
    { pattern: /\baffordable\b/i, term: 'affordable', termKo: '합리적인' },
    { pattern: /\bpremium\b/i, term: 'premium', termKo: '최고급' },
    { pattern: /\bmid[- ]?range\b/i, term: 'mid-range', termKo: '중급' },
    { pattern: /가성비/i, term: '가성비', termKo: '가성비' },
    { pattern: /저렴/i, term: '저렴한', termKo: '저렴한' },
    { pattern: /최고급/i, term: '최고급', termKo: '최고급' },
    { pattern: /적당/i, term: '적당한', termKo: '적당한' },
  ];

  const detected: string[] = [];
  for (const { pattern, term } of vagueTerms) {
    if (pattern.test(input)) {
      detected.push(term);
    }
  }
  return detected;
}

/**
 * Count how many meaningful constraints are present in a parsed request.
 */
function countConstraints(request: ParsedSquadRequest): number {
  let count = 0;
  if (request.formation) count++;
  if (request.budget && (request.budget.max || request.budget.min)) count++;
  if (request.teams && request.teams.length > 0) count++;
  if (request.leagues && request.leagues.length > 0) count++;
  if (request.nationalities && request.nationalities.length > 0) count++;
  if (request.players && request.players.length > 0) count++;
  if (request.playstyle) count++;
  if (request.statPriorities && request.statPriorities.length > 0) count++;
  if (request.chemistry) count++;
  if (request.cardTypes && request.cardTypes.length > 0) count++;
  if (request.minOvr !== undefined) count++;
  if (request.maxOvr !== undefined) count++;
  if (request.positionPreferences && request.positionPreferences.length > 0) count++;
  return count;
}

/**
 * Build formation-specific suggestions based on what other constraints are already present.
 */
function buildFormationSuggestions(input: string): { ko: string; en: string }[] {
  // Extract context hints from input for more contextual suggestions
  const hasBudget = /(\d+\s*(?:억|만|[mM]|[kK])|\d{1,3}(?:,\d{3})+)/.test(input);
  const hasLeague = /(?:프리미어리그|epl|라리가|laliga|분데스리가|bundesliga|리그\s*1|세리에|serie|k리그|kleague)/i.test(input);
  const hasTeam = false; // We don't re-detect teams here; suggestions are generic

  const suggestions: { ko: string; en: string }[] = [];

  if (hasLeague || hasBudget) {
    const budgetPart = hasBudget ? ' 10억으로' : '';
    suggestions.push(
      { ko: `${DEFAULT_FORMATION}${budgetPart} 짜줘`, en: `Use ${DEFAULT_FORMATION} formation` },
      { ko: `4-4-2${budgetPart} 짜줘`, en: 'Use 4-4-2 formation' },
      { ko: `3-5-2${budgetPart} 짜줘`, en: 'Use 3-5-2 formation' },
    );
  } else {
    suggestions.push(
      { ko: `${DEFAULT_FORMATION} 포메이션으로 짜줘`, en: `Build with ${DEFAULT_FORMATION} formation` },
      { ko: '4-2-3-1로 구성해줘', en: 'Build with 4-2-3-1 formation' },
      { ko: '3-5-2로 짜줘', en: 'Build with 3-5-2 formation' },
    );
  }

  return suggestions;
}

/**
 * Map severity string to numeric order for sorting.
 */
function severityOrder(severity: VagueSeverity): number {
  switch (severity) {
    case 'warning': return 3;
    case 'suggestion': return 2;
    case 'info': return 1;
  }
}

/**
 * Build the overall VagueInputAnalysis from detected issues.
 */
function buildAnalysis(
  issues: VagueInputIssue[],
  constraintCount: number,
  input: string,
): VagueInputAnalysis {
  // Determine if the input is vague (has any issues with severity >= suggestion)
  const hasSuggestionsOrWarnings = issues.some(
    (i) => i.severity === 'suggestion' || i.severity === 'warning',
  );
  const isVague = hasSuggestionsOrWarnings;

  // Determine vagueness level
  const hasWarnings = issues.some((i) => i.severity === 'warning');
  const hasOnlyInfo = issues.length > 0 && !hasSuggestionsOrWarnings;

  let vaguenessLevel: VagueInputAnalysis['vaguenessLevel'];
  if (issues.length === 0) {
    vaguenessLevel = 'clear';
  } else if (input.length === 0) {
    // Completely empty input is very vague
    vaguenessLevel = 'very_vague';
  } else if (hasOnlyInfo) {
    // Only info-level issues (e.g., missing playstyle/league but core constraints present)
    vaguenessLevel = constraintCount >= MIN_CONSTRAINTS_FOR_CLEAR ? 'clear' : 'somewhat_vague';
  } else if (hasWarnings) {
    vaguenessLevel = 'very_vague';
  } else if (constraintCount >= MIN_CONSTRAINTS_FOR_CLEAR && input.length >= GOOD_INPUT_LENGTH) {
    vaguenessLevel = 'somewhat_vague';
  } else {
    vaguenessLevel = 'vague';
  }

  // Build summary
  const { summaryKo, summaryEn } = buildSummary(issues, vaguenessLevel);

  return {
    isVague,
    issues,
    vaguenessLevel,
    summaryKo,
    summaryEn,
  };
}

/**
 * Build a concise summary of what's missing.
 */
function buildSummary(
  issues: VagueInputIssue[],
  vaguenessLevel: VagueInputAnalysis['vaguenessLevel'],
): { summaryKo: string; summaryEn: string } {
  if (vaguenessLevel === 'clear') {
    return {
      summaryKo: '',
      summaryEn: '',
    };
  }

  // Collect the types of missing constraints
  const missingTypes = issues
    .filter((i) => i.severity !== 'info' || vaguenessLevel === 'very_vague')
    .map((i) => i.type);

  const uniqueTypes = [...new Set(missingTypes)];

  // Map types to Korean/English labels
  const typeLabels: Record<string, { ko: string; en: string }> = {
    formation: { ko: '포메이션', en: 'formation' },
    budget: { ko: '예산', en: 'budget' },
    league: { ko: '리그/팀', en: 'league/team' },
    team: { ko: '팀', en: 'team' },
    playstyle: { ko: '플레이스타일', en: 'playstyle' },
    short_input: { ko: '상세 조건', en: 'details' },
    no_constraints: { ko: '조건', en: 'constraints' },
    position: { ko: '포지션', en: 'position' },
  };

  const labels = uniqueTypes.map((t) => typeLabels[t]).filter(Boolean);

  if (labels.length === 0) {
    return {
      summaryKo: '조금 더 구체적으로 알려주시면 더 좋은 추천을 드릴 수 있습니다.',
      summaryEn: 'A bit more detail would help us recommend better squads.',
    };
  }

  const koLabels = labels.map((l) => l.ko).join(', ');
  const enLabels = labels.map((l) => l.en).join(', ');

  if (vaguenessLevel === 'very_vague') {
    return {
      summaryKo: `⚠️ ${koLabels}이(가) 필요합니다. 구체적인 조건을 입력해주세요.`,
      summaryEn: `⚠️ ${enLabels} needed. Please provide specific constraints.`,
    };
  }

  return {
    summaryKo: `${koLabels}을(를) 추가하시면 더 맞춤화된 스쿼드를 추천해드릴 수 있습니다.`,
    summaryEn: `Adding ${enLabels} would help us recommend a more tailored squad.`,
  };
}

// ---------------------------------------------------------------------------
// Convenience: Analyze multi-candidate result
// ---------------------------------------------------------------------------

/**
 * Analyze vagueness across all candidates in a multi-candidate parse result.
 * Returns the analysis for the first (primary) candidate, which represents
 * the best interpretation of the user's intent.
 *
 * @param candidates - Array of SquadCandidateSpec from multi-candidate parsing
 * @param originalInput - The original user input string
 * @returns VagueInputAnalysis based on the primary candidate
 */
export function analyzeMultiCandidateVagueInput(
  candidates: { formation?: ParsedSquadRequest['formation']; budget?: ParsedSquadRequest['budget']; teams?: ParsedSquadRequest['teams']; leagues?: ParsedSquadRequest['leagues']; nationalities?: ParsedSquadRequest['nationalities']; playstyle?: ParsedSquadRequest['playstyle']; statPriorities?: ParsedSquadRequest['statPriorities']; chemistry?: ParsedSquadRequest['chemistry']; cardTypes?: ParsedSquadRequest['cardTypes']; players?: ParsedSquadRequest['players']; minOvr?: number; maxOvr?: number; positionPreferences?: ParsedSquadRequest['positionPreferences'] }[],
  originalInput: string,
): VagueInputAnalysis {
  if (candidates.length === 0) {
    return analyzeVagueInput(
      { confidence: 0 },
      originalInput,
    );
  }

  // Use the first candidate (best match) as the basis for analysis
  const primary = candidates[0];
  const request: ParsedSquadRequest = {
    ...primary,
    confidence: 0.5,
  };

  return analyzeVagueInput(request, originalInput);
}

// ---------------------------------------------------------------------------
// Convenience: Get quick follow-up prompts for UI display
// ---------------------------------------------------------------------------

/**
 * Get up to 3 quick follow-up suggestion prompts based on vague analysis.
 * Useful for displaying clickable suggestion chips in the UI.
 *
 * @param analysis - The vague input analysis result
 * @param lang - Language for suggestions ('ko' or 'en')
 * @returns Array of up to 3 suggestion strings
 */
export function getQuickSuggestions(
  analysis: VagueInputAnalysis,
  lang: 'ko' | 'en' = 'ko',
): string[] {
  if (!analysis.isVague || analysis.issues.length === 0) {
    return [];
  }

  // Collect suggestions from all issues, prioritizing by severity
  const allSuggestions: string[] = [];
  for (const issue of analysis.issues) {
    if (issue.severity === 'info') continue; // Skip info-level issues for quick suggestions
    for (const suggestion of issue.suggestions) {
      allSuggestions.push(suggestion[lang]);
    }
  }

  // Deduplicate and limit to 3
  const unique = [...new Set(allSuggestions)];
  return unique.slice(0, 3);
}
