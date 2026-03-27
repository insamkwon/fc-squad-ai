/**
 * Unit tests for the AI squad request parser.
 *
 * Tests cover:
 * 1. Fallback parser (rule-based, no API key needed)
 * 2. JSON extraction from AI responses
 * 3. Validation of parsed requests
 * 4. Normalization of parsed requests
 * 5. Team/league name resolution
 * 6. Integration: parseSquadRequest with forced fallback
 */

import { describe, it, expect } from 'vitest';
import {
  fallbackParse,
  extractJsonFromResponse,
  validateParsedRequest,
  normalizeParsedRequest,
  resolveTeamName,
  resolveLeagueId,
} from '@/lib/ai/parser';
import { parseSquadRequest, toSquadRequest } from '@/lib/ai/squad-parser';
import { isGeminiConfigured } from '@/lib/ai/gemini-client';
import type { ParsedSquadRequest } from '@/lib/ai/types';

// ---------------------------------------------------------------------------
// 1. Fallback Parser Tests
// ---------------------------------------------------------------------------

describe('fallbackParse', () => {
  it('should parse formation from numeric format', () => {
    const result = fallbackParse('Build me a 4-3-3 squad');
    expect(result.request.formation).toBe('4-3-3');
    expect(result.success).toBe(true);
    expect(result.method).toBe('fallback');
  });

  it('should parse 4-4-2 formation', () => {
    const result = fallbackParse('I want a 4-4-2');
    expect(result.request.formation).toBe('4-4-2');
  });

  it('should parse 4-2-3-1 formation', () => {
    const result = fallbackParse('4-2-3-1 포메이션으로 만들어줘');
    expect(result.request.formation).toBe('4-2-3-1');
  });

  it('should not set formation if not mentioned', () => {
    const result = fallbackParse('Build me a cheap squad');
    expect(result.request.formation).toBeUndefined();
  });

  it('should parse budget with K suffix', () => {
    const result = fallbackParse('Build me a squad under 500k');
    expect(result.request.budget).toBeDefined();
    expect(result.request.budget?.max).toBe(500000);
  });

  it('should parse budget with M suffix', () => {
    const result = fallbackParse('1M budget squad');
    expect(result.request.budget).toBeDefined();
    expect(result.request.budget?.max).toBe(1000000);
  });

  it('should parse budget with decimal M suffix', () => {
    const result = fallbackParse('1.5M budget');
    expect(result.request.budget).toBeDefined();
    expect(result.request.budget?.max).toBe(1500000);
  });

  it('should parse Korean budget (만)', () => {
    const result = fallbackParse('500만 이하 스쿼드');
    expect(result.request.budget).toBeDefined();
    expect(result.request.budget?.max).toBe(5000000); // 500만 = 5,000,000
  });

  it('should set budget strictness to strict for "under/below/이하"', () => {
    const result = fallbackParse('Build a squad under 500k');
    expect(result.request.budget?.strictness).toBe('strict');
  });

  it('should set budget strictness to flexible for "around/정도"', () => {
    const result = fallbackParse('Build a squad around 1M');
    expect(result.request.budget?.strictness).toBe('flexible');
  });

  it('should detect team preferences (English)', () => {
    const result = fallbackParse('Build me a Manchester City squad');
    expect(result.request.teams).toBeDefined();
    expect(result.request.teams).toHaveLength(1);
    expect(result.request.teams![0].name).toBe('Manchester City');
    expect(result.request.teams![0].strength).toBe('preferred');
  });

  it('should detect team preferences (Korean)', () => {
    const result = fallbackParse('바르셀로나 스쿼드 만들어줘');
    expect(result.request.teams).toBeDefined();
    expect(result.request.teams).toHaveLength(1);
    expect(result.request.teams![0].name).toBe('FC Barcelona');
  });

  it('should detect multiple teams', () => {
    const result = fallbackParse('Compare squads with Real Madrid and Liverpool');
    expect(result.request.teams).toBeDefined();
    expect(result.request.teams!.length).toBeGreaterThanOrEqual(2);
  });

  it('should detect league preferences (English)', () => {
    const result = fallbackParse('Build me a Premier League squad');
    expect(result.request.leagues).toBeDefined();
    expect(result.request.leagues![0].league).toBe('EPL');
  });

  it('should detect league preferences (Korean)', () => {
    const result = fallbackParse('라리가 스쿼드 짜줘');
    expect(result.request.leagues).toBeDefined();
    expect(result.request.leagues![0].league).toBe('LALIGA');
  });

  it('should detect chemistry preferences', () => {
    const result = fallbackParse('Build me a squad with good chemistry links');
    expect(result.request.chemistry).toBeDefined();
    expect(result.request.chemistry?.priority).toBe('high');
  });

  it('should detect same-team chemistry (Korean)', () => {
    const result = fallbackParse('팀켐 맞춰서 스쿼드 만들어줘');
    expect(result.request.chemistry).toBeDefined();
    expect(result.request.chemistry?.sameTeamLinks).toBe(true);
  });

  it('should detect same-league chemistry (Korean)', () => {
    const result = fallbackParse('리그켐으로 스쿼드 구성');
    expect(result.request.chemistry).toBeDefined();
    expect(result.request.chemistry?.sameLeagueLinks).toBe(true);
  });

  it('should detect attacking playstyle', () => {
    const result = fallbackParse('Build an attacking squad');
    expect(result.request.playstyle).toBe('attacking');
  });

  it('should detect defensive playstyle (Korean)', () => {
    const result = fallbackParse('수비적인 스쿼드');
    expect(result.request.playstyle).toBe('defensive');
  });

  it('should detect possession playstyle', () => {
    const result = fallbackParse('Build a possession-based squad');
    expect(result.request.playstyle).toBe('possession');
  });

  it('should detect counter-attack playstyle', () => {
    const result = fallbackParse('I want a counter-attacking team');
    expect(result.request.playstyle).toBe('counter-attack');
  });

  it('should detect high-press playstyle (Korean)', () => {
    const result = fallbackParse('하이프레싱으로 짜줘');
    expect(result.request.playstyle).toBe('high-press');
  });

  it('should detect pace stat priority', () => {
    const result = fallbackParse('I need fast players');
    expect(result.request.statPriorities).toContain('pace');
  });

  it('should detect shooting stat priority (Korean)', () => {
    const result = fallbackParse('골 결정력 좋은 선수들로');
    expect(result.request.statPriorities).toContain('shooting');
  });

  it('should detect passing stat priority', () => {
    const result = fallbackParse('Good passers needed');
    expect(result.request.statPriorities).toContain('passing');
  });

  it('should detect dribbling stat priority (Korean)', () => {
    const result = fallbackParse('드리블 좋은 선수 위주로');
    expect(result.request.statPriorities).toContain('dribbling');
  });

  it('should detect physical stat priority (Korean)', () => {
    const result = fallbackParse('피지컬 좋은 선수들로');
    expect(result.request.statPriorities).toContain('physical');
  });

  it('should handle complex combined request', () => {
    const result = fallbackParse('4-3-3으로 프리미어리그 500만 이하 빠른 선수 위주 스쿼드 만들어줘');
    expect(result.request.formation).toBe('4-3-3');
    expect(result.request.leagues).toBeDefined();
    expect(result.request.leagues![0].league).toBe('EPL');
    expect(result.request.budget?.max).toBe(5000000);
    expect(result.request.budget?.strictness).toBe('strict');
    expect(result.request.statPriorities).toContain('pace');
    expect(result.success).toBe(true);
  });

  it('should handle English complex request', () => {
    const result = fallbackParse('Build me a cheap EPL 4-3-3 squad with fast players under 500k');
    expect(result.request.formation).toBe('4-3-3');
    expect(result.request.leagues).toBeDefined();
    expect(result.request.leagues![0].league).toBe('EPL');
    expect(result.request.budget?.max).toBe(500000);
    expect(result.request.statPriorities).toContain('pace');
  });

  it('should return low confidence for fallback', () => {
    const result = fallbackParse('Build me a squad');
    expect(result.request.confidence).toBeLessThanOrEqual(0.5);
  });

  it('should include warnings for fallback', () => {
    const result = fallbackParse('Build me a squad');
    expect(result.request.warnings).toBeDefined();
    expect(result.request.warnings!.length).toBeGreaterThan(0);
  });

  it('should record parse time', () => {
    const result = fallbackParse('4-3-3 squad');
    expect(result.parseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('should handle empty input gracefully', async () => {
    const result = await parseSquadRequest('', { forceFallback: true });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Input is empty');
  });

  it('should handle whitespace-only input gracefully', async () => {
    const result = await parseSquadRequest('   ', { forceFallback: true });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Input is empty');
  });
});

// ---------------------------------------------------------------------------
// 2. JSON Extraction Tests
// ---------------------------------------------------------------------------

describe('extractJsonFromResponse', () => {
  it('should extract plain JSON', () => {
    const json = '{"formation": "4-3-3", "confidence": 0.9}';
    expect(extractJsonFromResponse(json)).toBe(json);
  });

  it('should extract JSON from markdown code fences', () => {
    const response = '```json\n{"formation": "4-3-3", "confidence": 0.9}\n```';
    const result = extractJsonFromResponse(response);
    expect(result).toBe('{"formation": "4-3-3", "confidence": 0.9}');
  });

  it('should extract JSON from code fences without language tag', () => {
    const response = '```\n{"formation": "4-3-3"}\n```';
    const result = extractJsonFromResponse(response);
    expect(result).toBe('{"formation": "4-3-3"}');
  });

  it('should extract JSON from text with leading/trailing content', () => {
    const response = 'Here is the result:\n{"formation": "4-3-3", "confidence": 0.8}\nHope this helps!';
    const result = extractJsonFromResponse(response);
    expect(result).toBe('{"formation": "4-3-3", "confidence": 0.8}');
  });

  it('should return null for non-JSON content', () => {
    const response = 'This is just plain text with no JSON at all';
    expect(extractJsonFromResponse(response)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(extractJsonFromResponse('')).toBeNull();
  });

  it('should extract JSON even with newlines inside', () => {
    const response = `{
  "formation": "4-3-3",
  "budget": {"max": 500000, "strictness": "flexible"},
  "confidence": 0.9
}`;
    const result = extractJsonFromResponse(response);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.formation).toBe('4-3-3');
  });

  it('should handle JSON wrapped in explanatory text', () => {
    const response = `I analyzed your request. Here's the structured output:
\`\`\`json
{"formation":"4-3-3","confidence":0.85}
\`\`\`
Let me know if you need anything else!`;
    const result = extractJsonFromResponse(response);
    expect(result).not.toBeNull();
    const parsed = JSON.parse(result!);
    expect(parsed.formation).toBe('4-3-3');
  });
});

// ---------------------------------------------------------------------------
// 3. Validation Tests
// ---------------------------------------------------------------------------

describe('validateParsedRequest', () => {
  it('should validate a correct minimal request', () => {
    const errors = validateParsedRequest({ confidence: 0.9 });
    expect(errors).toHaveLength(0);
  });

  it('should validate a full correct request', () => {
    const request = {
      formation: '4-3-3',
      confidence: 0.85,
      budget: { max: 500000, min: null, strictness: 'flexible' },
      teams: [{ name: 'Manchester City', strength: 'preferred' }],
      leagues: [{ league: 'EPL', strength: 'preferred' }],
      nationalities: [{ nationality: 'Brazilian', strength: 'optional' }],
      players: [{ name: 'Haaland', required: true }],
      excludedTeams: ['Chelsea'],
      minOvr: 80,
      maxOvr: 95,
      statPriorities: ['pace', 'shooting'],
      playstyle: 'attacking',
      chemistry: {
        priority: 'high',
        sameTeamLinks: true,
        sameLeagueLinks: false,
        sameNationalityLinks: false,
        minChemistryScore: 80,
      },
      cardTypes: ['SPECIAL'],
      positionPreferences: [{ position: 'ST', minStats: { pace: 85 } }],
      additionalConstraints: ['No RB players'],
      warnings: [],
    };
    const errors = validateParsedRequest(request);
    expect(errors).toHaveLength(0);
  });

  it('should reject invalid formation', () => {
    const errors = validateParsedRequest({ confidence: 0.9, formation: '4-2-4' });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].path).toBe('formation');
  });

  it('should reject confidence outside 0-1 range', () => {
    const errors1 = validateParsedRequest({ confidence: 1.5 });
    expect(errors1.length).toBeGreaterThan(0);
    expect(errors1[0].path).toBe('confidence');

    const errors2 = validateParsedRequest({ confidence: -0.1 });
    expect(errors2.length).toBeGreaterThan(0);
    expect(errors2[0].path).toBe('confidence');
  });

  it('should reject missing confidence', () => {
    const errors = validateParsedRequest({});
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.path === 'confidence')).toBe(true);
  });

  it('should reject non-object budget', () => {
    const errors = validateParsedRequest({ confidence: 0.9, budget: '500k' });
    expect(errors.some((e) => e.path === 'budget')).toBe(true);
  });

  it('should reject invalid budget strictness', () => {
    const errors = validateParsedRequest({
      confidence: 0.9,
      budget: { max: 500000, strictness: 'very_strict' },
    });
    expect(errors.some((e) => e.path === 'budget.strictness')).toBe(true);
  });

  it('should reject non-array teams', () => {
    const errors = validateParsedRequest({ confidence: 0.9, teams: 'Manchester City' });
    expect(errors.some((e) => e.path === 'teams')).toBe(true);
  });

  it('should reject team entry without name', () => {
    const errors = validateParsedRequest({
      confidence: 0.9,
      teams: [{ strength: 'preferred' }],
    });
    expect(errors.some((e) => e.path.includes('name'))).toBe(true);
  });

  it('should reject invalid playstyle', () => {
    const errors = validateParsedRequest({ confidence: 0.9, playstyle: 'aggressive' });
    expect(errors.some((e) => e.path === 'playstyle')).toBe(true);
  });

  it('should reject invalid stat priorities', () => {
    const errors = validateParsedRequest({
      confidence: 0.9,
      statPriorities: ['speed', 'goals'],
    });
    expect(errors.some((e) => e.path === 'statPriorities')).toBe(true);
  });

  it('should reject invalid card types', () => {
    const errors = validateParsedRequest({
      confidence: 0.9,
      cardTypes: ['GOLD', 'SILVER'],
    });
    expect(errors.some((e) => e.path === 'cardTypes')).toBe(true);
  });

  it('should reject invalid position in positionPreferences', () => {
    const errors = validateParsedRequest({
      confidence: 0.9,
      positionPreferences: [{ position: 'GOALIE' }],
    });
    expect(errors.some((e) => e.path.includes('position'))).toBe(true);
  });

  it('should reject null root', () => {
    const errors = validateParsedRequest(null);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject non-object root', () => {
    const errors = validateParsedRequest('just a string');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should accept null optional fields', () => {
    const errors = validateParsedRequest({
      confidence: 0.5,
      formation: null,
      budget: null,
      teams: null,
      leagues: null,
      chemistry: null,
    });
    expect(errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 4. Normalization Tests
// ---------------------------------------------------------------------------

describe('normalizeParsedRequest', () => {
  it('should normalize a valid request', () => {
    const raw = {
      confidence: 0.9,
      formation: '4-3-3',
      budget: { max: 500000, strictness: 'strict' },
      teams: [{ name: '맨시티', strength: 'preferred' }],
      statPriorities: ['pace', 'shooting', 'defending'],
    };
    const result = normalizeParsedRequest(raw);
    expect(result.formation).toBe('4-3-3');
    expect(result.budget?.max).toBe(500000);
    expect(result.budget?.strictness).toBe('strict');
    expect(result.teams![0].name).toBe('Manchester City'); // Korean resolved to English
    expect(result.statPriorities).toEqual(['pace', 'shooting', 'defending']);
  });

  it('should default confidence to 0.5 when missing', () => {
    const result = normalizeParsedRequest({});
    expect(result.confidence).toBe(0.5);
  });

  it('should clamp confidence to 0-1 range', () => {
    const result1 = normalizeParsedRequest({ confidence: 1.5 });
    expect(result1.confidence).toBe(1.0);

    const result2 = normalizeParsedRequest({ confidence: -0.5 });
    expect(result2.confidence).toBe(0.0);
  });

  it('should default budget strictness to flexible', () => {
    const result = normalizeParsedRequest({
      confidence: 0.9,
      budget: { max: 500000 },
    });
    expect(result.budget?.strictness).toBe('flexible');
  });

  it('should default team strength to preferred', () => {
    const result = normalizeParsedRequest({
      confidence: 0.9,
      teams: [{ name: 'Arsenal' }],
    });
    expect(result.teams![0].strength).toBe('preferred');
  });

  it('should default chemistry priority to medium', () => {
    const result = normalizeParsedRequest({
      confidence: 0.9,
      chemistry: { sameTeamLinks: true, sameLeagueLinks: false, sameNationalityLinks: false },
    });
    expect(result.chemistry?.priority).toBe('medium');
  });

  it('should filter out invalid stat priorities', () => {
    const result = normalizeParsedRequest({
      confidence: 0.9,
      statPriorities: ['pace', 'speed', 'shooting'],
    });
    expect(result.statPriorities).toEqual(['pace', 'shooting']);
  });

  it('should filter out invalid card types', () => {
    const result = normalizeParsedRequest({
      confidence: 0.9,
      cardTypes: ['SPECIAL', 'GOLD', 'ICON'],
    });
    expect(result.cardTypes).toEqual(['SPECIAL', 'ICON']);
  });

  it('should filter out invalid position preferences', () => {
    const result = normalizeParsedRequest({
      confidence: 0.9,
      positionPreferences: [
        { position: 'ST', minStats: { pace: 90 } },
        { position: 'GOALIE' }, // invalid
      ],
    });
    expect(result.positionPreferences).toHaveLength(1);
    expect(result.positionPreferences![0].position).toBe('ST');
  });

  it('should resolve Korean team names to English', () => {
    const result = normalizeParsedRequest({
      confidence: 0.9,
      teams: [{ name: '맨유', strength: 'required' }],
    });
    expect(result.teams![0].name).toBe('Manchester United');
  });

  it('should resolve Korean league names to IDs', () => {
    const result = normalizeParsedRequest({
      confidence: 0.9,
      leagues: [{ league: '라리가', strength: 'preferred' }],
    });
    expect(result.leagues![0].league).toBe('LALIGA');
  });

  it('should not set fields for null values', () => {
    const result = normalizeParsedRequest({
      confidence: 0.9,
      formation: null,
      budget: null,
      teams: null,
    });
    expect(result.formation).toBeUndefined();
    expect(result.budget).toBeUndefined();
    expect(result.teams).toBeUndefined();
  });

  it('should clamp OVR values to valid range', () => {
    const result = normalizeParsedRequest({
      confidence: 0.9,
      minOvr: -10,
      maxOvr: 200,
    });
    expect(result.minOvr).toBe(0);
    expect(result.maxOvr).toBe(150);
  });

  it('should clamp chemistry min score to 0-100', () => {
    const result = normalizeParsedRequest({
      confidence: 0.9,
      chemistry: {
        priority: 'max',
        sameTeamLinks: true,
        sameLeagueLinks: true,
        sameNationalityLinks: false,
        minChemistryScore: 150,
      },
    });
    expect(result.chemistry?.minChemistryScore).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// 5. Team/League Resolution Tests
// ---------------------------------------------------------------------------

describe('resolveTeamName', () => {
  it('should resolve exact English team name', () => {
    expect(resolveTeamName('Manchester City')).toBe('Manchester City');
  });

  it('should resolve Korean team name', () => {
    expect(resolveTeamName('맨시티')).toBe('Manchester City');
    expect(resolveTeamName('바르셀로나')).toBe('FC Barcelona');
    expect(resolveTeamName('토트넘')).toBe('Tottenham Hotspur');
  });

  it('should resolve partial team name', () => {
    expect(resolveTeamName('Man City')).toBe('Manchester City');
    expect(resolveTeamName('Barcelona')).toBe('FC Barcelona');
  });

  it('should return original for unknown team', () => {
    expect(resolveTeamName('Some Random Club')).toBe('Some Random Club');
  });

  it('should handle empty input', () => {
    expect(resolveTeamName('')).toBe('');
  });

  it('should resolve K League teams', () => {
    expect(resolveTeamName('전북현대')).toBe('Jeonbuk Hyundai Motors');
    expect(resolveTeamName('FC서울')).toBe('FC Seoul');
  });
});

describe('resolveLeagueId', () => {
  it('should resolve by full name', () => {
    expect(resolveLeagueId('Premier League')).toBe('EPL');
    expect(resolveLeagueId('La Liga')).toBe('LALIGA');
  });

  it('should resolve by abbreviation', () => {
    expect(resolveLeagueId('EPL')).toBe('EPL');
    expect(resolveLeagueId('LALIGA')).toBe('LALIGA');
  });

  it('should resolve by Korean name', () => {
    expect(resolveLeagueId('프리미어리그')).toBe('EPL');
    expect(resolveLeagueId('라리가')).toBe('LALIGA');
    expect(resolveLeagueId('분데스리가')).toBe('BUNDESLIGA');
    expect(resolveLeagueId('K리그')).toBe('KLEAGUE');
  });

  it('should handle empty input', () => {
    expect(resolveLeagueId('')).toBe('');
  });

  it('should return original for unknown league', () => {
    expect(resolveLeagueId('J-League')).toBe('J-League');
  });

  it('should resolve case-insensitive', () => {
    expect(resolveLeagueId('premier league')).toBe('EPL');
    expect(resolveLeagueId('epl')).toBe('EPL');
    expect(resolveLeagueId('BUNDESLIGA')).toBe('BUNDESLIGA');
  });
});

// ---------------------------------------------------------------------------
// 6. toSquadRequest Conversion Tests
// ---------------------------------------------------------------------------

describe('toSquadRequest', () => {
  it('should convert minimal parsed request with default formation', () => {
    const parsed: ParsedSquadRequest = { confidence: 0.8 };
    const squadRequest = toSquadRequest(parsed);
    expect(squadRequest.formation).toBe('4-3-3');
    expect(squadRequest.budget).toBeUndefined();
  });

  it('should convert with formation', () => {
    const parsed: ParsedSquadRequest = { confidence: 0.8, formation: '4-4-2' };
    const squadRequest = toSquadRequest(parsed);
    expect(squadRequest.formation).toBe('4-4-2');
  });

  it('should convert budget', () => {
    const parsed: ParsedSquadRequest = {
      confidence: 0.8,
      budget: { max: 1000000, strictness: 'flexible' },
    };
    const squadRequest = toSquadRequest(parsed);
    expect(squadRequest.budget).toBe(1000000);
  });

  it('should convert team preference to teamColor', () => {
    const parsed: ParsedSquadRequest = {
      confidence: 0.8,
      teams: [{ name: 'Manchester City', strength: 'preferred' }],
    };
    const squadRequest = toSquadRequest(parsed);
    expect(squadRequest.teamColor).toBe('Manchester City');
  });

  it('should prefer required team over preferred for teamColor', () => {
    const parsed: ParsedSquadRequest = {
      confidence: 0.8,
      teams: [
        { name: 'Arsenal', strength: 'preferred' },
        { name: 'Real Madrid', strength: 'required' },
      ],
    };
    const squadRequest = toSquadRequest(parsed);
    expect(squadRequest.teamColor).toBe('Real Madrid');
  });

  it('should convert additional constraints to prompt', () => {
    const parsed: ParsedSquadRequest = {
      confidence: 0.8,
      additionalConstraints: ['Must have fast wingers', 'Korean players preferred'],
    };
    const squadRequest = toSquadRequest(parsed);
    expect(squadRequest.prompt).toBe('Must have fast wingers, Korean players preferred');
  });
});

// ---------------------------------------------------------------------------
// 7. Integration: parseSquadRequest with forceFallback
// ---------------------------------------------------------------------------

describe('parseSquadRequest (forced fallback)', () => {
  it('should use fallback when forceFallback is true', async () => {
    const result = await parseSquadRequest('4-3-3 EPL 500k squad', { forceFallback: true });
    expect(result.method).toBe('fallback');
    expect(result.success).toBe(true);
  });

  it('should parse Korean input with forced fallback', async () => {
    const result = await parseSquadRequest('4-3-3으로 프리미어리그 스쿼드 만들어줘', { forceFallback: true });
    expect(result.method).toBe('fallback');
    expect(result.request.formation).toBe('4-3-3');
    expect(result.request.leagues).toBeDefined();
    expect(result.request.leagues![0].league).toBe('EPL');
  });

  it('should add API key warning when not configured', async () => {
    if (isGeminiConfigured()) {
      // Skip if API key is actually configured
      return;
    }
    const result = await parseSquadRequest('4-3-3 squad');
    expect(result.method).toBe('fallback');
    expect(result.request.warnings).toBeDefined();
    expect(result.request.warnings!.some((w) => w.includes('API key'))).toBe(true);
  });

  it('should handle very long input', async () => {
    const longInput = 'Build '.repeat(100) + '4-3-3 EPL';
    const result = await parseSquadRequest(longInput, { forceFallback: true });
    expect(result.success).toBe(true);
    expect(result.request.formation).toBe('4-3-3');
  });

  it('should handle special characters', async () => {
    const result = await parseSquadRequest('4-3-3 <script>alert("xss")</script>', { forceFallback: true });
    expect(result.success).toBe(true);
  });

  it('should handle emoji', async () => {
    const result = await parseSquadRequest('⚽ 4-3-3 EPL squad 🏆', { forceFallback: true });
    expect(result.success).toBe(true);
    expect(result.request.formation).toBe('4-3-3');
    expect(result.request.leagues![0].league).toBe('EPL');
  });
});

// ---------------------------------------------------------------------------
// 8. Edge Cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('should handle request with only budget', () => {
    const result = fallbackParse('500k');
    expect(result.request.budget).toBeDefined();
    expect(result.request.budget?.max).toBe(500000);
  });

  it('should handle request with only formation', () => {
    const result = fallbackParse('4-2-3-1');
    expect(result.request.formation).toBe('4-2-3-1');
    expect(result.request.budget).toBeUndefined();
    expect(result.request.teams).toBeUndefined();
  });

  it('should handle request with only team name', () => {
    const result = fallbackParse('맨시티');
    expect(result.request.teams).toBeDefined();
    expect(result.request.teams![0].name).toBe('Manchester City');
  });

  it('should handle budget in billions (억)', () => {
    const result = fallbackParse('10억 예산으로');
    expect(result.request.budget?.max).toBe(1000000000); // 10억 = 1,000,000,000
  });

  it('should not confuse team names with common words', () => {
    const result = fallbackParse('a balanced team with good chemistry');
    // "team" should not be matched to any specific team
    const teamNames = result.request.teams?.map((t) => t.name) ?? [];
    // Should not contain random teams from the word "team"
    expect(teamNames.length).toBe(0);
  });
});
