/**
 * Parser for AI response validation, normalization, and fallback parsing.
 *
 * This module handles:
 * 1. Validating the AI's JSON response against the expected schema
 * 2. Normalizing and cleaning up the parsed data
 * 3. Rule-based fallback parsing when AI is unavailable
 */

import {
  type ParsedSquadRequest,
  type ParseResult,
  type ParsedBudget,
  type ChemistryPreference,
  type TeamPreference,
  type LeaguePreference,
  type NationalityPreference,
  type PlayerPreference,
  type PositionPreference,
  type StatPriority,
  type Playstyle,
  type CardTypePreference,
  type SquadCandidateSpec,
  type MultiCandidateParseResult,
  VALID_FORMATIONS,
  VALID_POSITIONS,
  VALID_STAT_PRIORITIES,
  VALID_PLAYSTYLES,
  VALID_CARD_TYPES,
} from './types';

import { TEAMS, LEAGUES } from '@/constants/teams';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface ValidationError {
  path: string;
  message: string;
}

/**
 * Validate a raw parsed object against the ParsedSquadRequest schema.
 * Returns an array of validation errors (empty = valid).
 */
export function validateParsedRequest(raw: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!raw || typeof raw !== 'object') {
    errors.push({ path: 'root', message: 'Response is not an object' });
    return errors;
  }

  const obj = raw as Record<string, unknown>;

  // confidence is required
  if (obj.confidence === undefined || typeof obj.confidence !== 'number') {
    errors.push({ path: 'confidence', message: 'Missing or invalid confidence number' });
  } else if (obj.confidence < 0 || obj.confidence > 1) {
    errors.push({ path: 'confidence', message: 'Confidence must be between 0 and 1' });
  }

  // formation (optional, must be valid or null)
  if (obj.formation !== undefined && obj.formation !== null) {
    if (typeof obj.formation !== 'string' || !VALID_FORMATIONS.includes(obj.formation as typeof VALID_FORMATIONS[number])) {
      errors.push({
        path: 'formation',
        message: `Invalid formation "${obj.formation}". Must be one of: ${VALID_FORMATIONS.join(', ')}`,
      });
    }
  }

  // budget (optional object)
  if (obj.budget !== undefined && obj.budget !== null) {
    if (typeof obj.budget !== 'object' || obj.budget === null) {
      errors.push({ path: 'budget', message: 'Budget must be an object or null' });
    } else {
      const budget = obj.budget as Record<string, unknown>;
      if (budget.max !== undefined && budget.max !== null && typeof budget.max !== 'number') {
        errors.push({ path: 'budget.max', message: 'Budget max must be a number or null' });
      }
      if (budget.min !== undefined && budget.min !== null && typeof budget.min !== 'number') {
        errors.push({ path: 'budget.min', message: 'Budget min must be a number or null' });
      }
      if (budget.strictness !== undefined && !['strict', 'flexible', 'none'].includes(budget.strictness as string)) {
        errors.push({ path: 'budget.strictness', message: 'Budget strictness must be strict, flexible, or none' });
      }
    }
  }

  // teams (optional array)
  if (obj.teams !== undefined && obj.teams !== null) {
    if (!Array.isArray(obj.teams)) {
      errors.push({ path: 'teams', message: 'Teams must be an array or null' });
    } else {
      obj.teams.forEach((team, i) => {
        if (typeof team !== 'object' || team === null) {
          errors.push({ path: `teams[${i}]`, message: 'Team entry must be an object' });
        } else {
          const t = team as Record<string, unknown>;
          if (!t.name || typeof t.name !== 'string') {
            errors.push({ path: `teams[${i}].name`, message: 'Team name is required' });
          }
          if (t.strength && !['required', 'preferred', 'optional'].includes(t.strength as string)) {
            errors.push({ path: `teams[${i}].strength`, message: 'Team strength must be required, preferred, or optional' });
          }
        }
      });
    }
  }

  // leagues (optional array)
  if (obj.leagues !== undefined && obj.leagues !== null) {
    if (!Array.isArray(obj.leagues)) {
      errors.push({ path: 'leagues', message: 'Leagues must be an array or null' });
    } else {
      obj.leagues.forEach((league, i) => {
        if (typeof league !== 'object' || league === null) {
          errors.push({ path: `leagues[${i}]`, message: 'League entry must be an object' });
        } else {
          const l = league as Record<string, unknown>;
          if (!l.league || typeof l.league !== 'string') {
            errors.push({ path: `leagues[${i}].league`, message: 'League ID/name is required' });
          }
        }
      });
    }
  }

  // nationalities (optional array)
  if (obj.nationalities !== undefined && obj.nationalities !== null) {
    if (!Array.isArray(obj.nationalities)) {
      errors.push({ path: 'nationalities', message: 'Nationalities must be an array or null' });
    }
  }

  // players (optional array)
  if (obj.players !== undefined && obj.players !== null) {
    if (!Array.isArray(obj.players)) {
      errors.push({ path: 'players', message: 'Players must be an array or null' });
    } else {
      obj.players.forEach((player, i) => {
        if (typeof player !== 'object' || player === null) {
          errors.push({ path: `players[${i}]`, message: 'Player entry must be an object' });
        } else {
          const p = player as Record<string, unknown>;
          if (!p.name || typeof p.name !== 'string') {
            errors.push({ path: `players[${i}].name`, message: 'Player name is required' });
          }
        }
      });
    }
  }

  // minOvr, maxOvr (optional numbers)
  if (obj.minOvr !== undefined && obj.minOvr !== null) {
    if (typeof obj.minOvr !== 'number' || obj.minOvr < 0 || obj.minOvr > 150) {
      errors.push({ path: 'minOvr', message: 'minOvr must be a number between 0 and 150' });
    }
  }
  if (obj.maxOvr !== undefined && obj.maxOvr !== null) {
    if (typeof obj.maxOvr !== 'number' || obj.maxOvr < 0 || obj.maxOvr > 150) {
      errors.push({ path: 'maxOvr', message: 'maxOvr must be a number between 0 and 150' });
    }
  }

  // statPriorities (optional array of valid stats)
  if (obj.statPriorities !== undefined && obj.statPriorities !== null) {
    if (!Array.isArray(obj.statPriorities)) {
      errors.push({ path: 'statPriorities', message: 'statPriorities must be an array or null' });
    } else {
      const invalid = (obj.statPriorities as unknown[]).filter(
        (s) => typeof s !== 'string' || !VALID_STAT_PRIORITIES.includes(s as StatPriority),
      );
      if (invalid.length > 0) {
        errors.push({
          path: 'statPriorities',
          message: `Invalid stats: ${invalid.join(', ')}. Must be one of: ${VALID_STAT_PRIORITIES.join(', ')}`,
        });
      }
    }
  }

  // playstyle (optional, must be valid)
  if (obj.playstyle !== undefined && obj.playstyle !== null) {
    if (typeof obj.playstyle !== 'string' || !VALID_PLAYSTYLES.includes(obj.playstyle as Playstyle)) {
      errors.push({
        path: 'playstyle',
        message: `Invalid playstyle. Must be one of: ${VALID_PLAYSTYLES.join(', ')}`,
      });
    }
  }

  // chemistry (optional object)
  if (obj.chemistry !== undefined && obj.chemistry !== null) {
    if (typeof obj.chemistry !== 'object' || obj.chemistry === null) {
      errors.push({ path: 'chemistry', message: 'Chemistry must be an object or null' });
    } else {
      const chem = obj.chemistry as Record<string, unknown>;
      if (chem.priority && !['low', 'medium', 'high', 'max'].includes(chem.priority as string)) {
        errors.push({ path: 'chemistry.priority', message: 'Chemistry priority must be low, medium, high, or max' });
      }
    }
  }

  // cardTypes (optional array)
  if (obj.cardTypes !== undefined && obj.cardTypes !== null) {
    if (!Array.isArray(obj.cardTypes)) {
      errors.push({ path: 'cardTypes', message: 'cardTypes must be an array or null' });
    } else {
      const invalid = (obj.cardTypes as unknown[]).filter(
        (c) => typeof c !== 'string' || !VALID_CARD_TYPES.includes(c as CardTypePreference),
      );
      if (invalid.length > 0) {
        errors.push({
          path: 'cardTypes',
          message: `Invalid card types: ${invalid.join(', ')}. Must be one of: ${VALID_CARD_TYPES.join(', ')}`,
        });
      }
    }
  }

  // positionPreferences (optional array)
  if (obj.positionPreferences !== undefined && obj.positionPreferences !== null) {
    if (!Array.isArray(obj.positionPreferences)) {
      errors.push({ path: 'positionPreferences', message: 'positionPreferences must be an array or null' });
    } else {
      obj.positionPreferences.forEach((pp, i) => {
        if (typeof pp !== 'object' || pp === null) {
          errors.push({ path: `positionPreferences[${i}]`, message: 'Position preference must be an object' });
        } else {
          const p = pp as Record<string, unknown>;
          if (!p.position || typeof p.position !== 'string' || !VALID_POSITIONS.includes(p.position as typeof VALID_POSITIONS[number])) {
            errors.push({
              path: `positionPreferences[${i}].position`,
              message: `Invalid position "${p.position}". Must be one of: ${VALID_POSITIONS.join(', ')}`,
            });
          }
        }
      });
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize and clean up a validated parsed request.
 * Resolves team/league names to official names, ensures defaults, etc.
 */
export function normalizeParsedRequest(raw: Record<string, unknown>): ParsedSquadRequest {
  const result: ParsedSquadRequest = {
    confidence: typeof raw.confidence === 'number'
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0.5,
  };

  // formation
  if (raw.formation && typeof raw.formation === 'string' && VALID_FORMATIONS.includes(raw.formation as typeof VALID_FORMATIONS[number])) {
    result.formation = raw.formation as ParsedSquadRequest['formation'];
  }

  // budget
  if (raw.budget && typeof raw.budget === 'object' && raw.budget !== null) {
    const b = raw.budget as Record<string, unknown>;
    const budget: ParsedBudget = {
      strictness: ['strict', 'flexible', 'none'].includes(b.strictness as string)
        ? (b.strictness as ParsedBudget['strictness'])
        : 'flexible',
    };
    if (typeof b.max === 'number') budget.max = b.max;
    if (typeof b.min === 'number') budget.min = b.min;
    result.budget = budget;
  }

  // teams — resolve to official names
  if (Array.isArray(raw.teams) && raw.teams.length > 0) {
    result.teams = (raw.teams as unknown[]).map((t) => {
      const team = t as Record<string, unknown>;
      const resolvedName = resolveTeamName(String(team.name ?? ''));
      return {
        name: resolvedName,
        strength: ['required', 'preferred', 'optional'].includes(team.strength as string)
          ? (team.strength as TeamPreference['strength'])
          : 'preferred',
      };
    });
  }

  // leagues — resolve to league IDs
  if (Array.isArray(raw.leagues) && raw.leagues.length > 0) {
    result.leagues = (raw.leagues as unknown[]).map((l) => {
      const league = l as Record<string, unknown>;
      const resolvedId = resolveLeagueId(String(league.league ?? ''));
      return {
        league: resolvedId,
        strength: ['required', 'preferred', 'optional'].includes(league.strength as string)
          ? (league.strength as LeaguePreference['strength'])
          : 'preferred',
      };
    });
  }

  // nationalities
  if (Array.isArray(raw.nationalities) && raw.nationalities.length > 0) {
    result.nationalities = (raw.nationalities as unknown[]).map((n) => {
      const nat = n as Record<string, unknown>;
      return {
        nationality: String(nat.nationality ?? ''),
        strength: ['required', 'preferred', 'optional'].includes(nat.strength as string)
          ? (nat.strength as NationalityPreference['strength'])
          : 'preferred',
      };
    });
  }

  // players
  if (Array.isArray(raw.players) && raw.players.length > 0) {
    result.players = (raw.players as unknown[]).map((p) => {
      const player = p as Record<string, unknown>;
      const pref: PlayerPreference = {
        name: String(player.name ?? ''),
        required: player.required === true,
      };
      if (player.cardTypePreference && typeof player.cardTypePreference === 'string') {
        pref.cardTypePreference = String(player.cardTypePreference);
      }
      return pref;
    });
  }

  // excludedTeams — resolve names
  if (Array.isArray(raw.excludedTeams) && raw.excludedTeams.length > 0) {
    result.excludedTeams = (raw.excludedTeams as unknown[]).map((t) => resolveTeamName(String(t)));
  }

  // OVR
  if (typeof raw.minOvr === 'number') result.minOvr = Math.max(0, Math.min(150, raw.minOvr));
  if (typeof raw.maxOvr === 'number') result.maxOvr = Math.max(0, Math.min(150, raw.maxOvr));

  // stat priorities
  if (Array.isArray(raw.statPriorities) && raw.statPriorities.length > 0) {
    result.statPriorities = (raw.statPriorities as unknown[])
      .filter((s) => typeof s === 'string' && VALID_STAT_PRIORITIES.includes(s as StatPriority))
      .map((s) => s as StatPriority);
  }

  // playstyle
  if (typeof raw.playstyle === 'string' && VALID_PLAYSTYLES.includes(raw.playstyle as Playstyle)) {
    result.playstyle = raw.playstyle as Playstyle;
  }

  // chemistry
  if (raw.chemistry && typeof raw.chemistry === 'object' && raw.chemistry !== null) {
    const c = raw.chemistry as Record<string, unknown>;
    const chem: ChemistryPreference = {
      priority: ['low', 'medium', 'high', 'max'].includes(c.priority as string)
        ? (c.priority as ChemistryPreference['priority'])
        : 'medium',
      sameTeamLinks: c.sameTeamLinks === true,
      sameLeagueLinks: c.sameLeagueLinks === true,
      sameNationalityLinks: c.sameNationalityLinks === true,
    };
    if (typeof c.minChemistryScore === 'number') {
      chem.minChemistryScore = Math.max(0, Math.min(100, c.minChemistryScore));
    }
    result.chemistry = chem;
  }

  // card types
  if (Array.isArray(raw.cardTypes) && raw.cardTypes.length > 0) {
    result.cardTypes = (raw.cardTypes as unknown[])
      .filter((c) => typeof c === 'string' && VALID_CARD_TYPES.includes(c as CardTypePreference))
      .map((c) => c as CardTypePreference);
  }

  // position preferences
  if (Array.isArray(raw.positionPreferences) && raw.positionPreferences.length > 0) {
    result.positionPreferences = (raw.positionPreferences as unknown[])
      .filter((pp) => {
        const p = pp as Record<string, unknown>;
        return p.position && typeof p.position === 'string' && VALID_POSITIONS.includes(p.position as typeof VALID_POSITIONS[number]);
      })
      .map((pp) => {
        const p = pp as Record<string, unknown>;
        const pref: PositionPreference = { position: p.position as PositionPreference['position'] };
        if (p.minStats && typeof p.minStats === 'object') {
          pref.minStats = {};
          const stats = p.minStats as Record<string, unknown>;
          for (const [key, val] of Object.entries(stats)) {
            if (VALID_STAT_PRIORITIES.includes(key as StatPriority) && typeof val === 'number') {
              pref.minStats[key as StatPriority] = val;
            }
          }
        }
        if (Array.isArray(p.preferredPlayers)) {
          pref.preferredPlayers = (p.preferredPlayers as unknown[]).map(String);
        }
        if (p.description && typeof p.description === 'string') {
          pref.description = String(p.description);
        }
        return pref;
      });
  }

  // additional constraints
  if (Array.isArray(raw.additionalConstraints) && raw.additionalConstraints.length > 0) {
    result.additionalConstraints = (raw.additionalConstraints as unknown[]).map(String);
  }

  // warnings
  if (Array.isArray(raw.warnings) && raw.warnings.length > 0) {
    result.warnings = (raw.warnings as unknown[]).map(String);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Team/League Resolution Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a team name (English, Korean, or abbreviated) to the official English name.
 */
export function resolveTeamName(input: string): string {
  const normalized = input.toLowerCase().trim();
  if (!normalized) return input;

  // Common abbreviations → official names
  const abbreviations: Record<string, string> = {
    'man city': 'Manchester City',
    'man united': 'Manchester United',
    'man utd': 'Manchester United',
    'spurs': 'Tottenham Hotspur',
    'wolves': 'Wolverhampton',
    'villa': 'Aston Villa',
    'forest': 'Nottingham Forest',
    'saints': 'Southampton',
    'hammers': 'West Ham United',
    'magpies': 'Newcastle United',
    'toffees': 'Everton',
    'palace': 'Crystal Palace',
    'barca': 'FC Barcelona',
    'real': 'Real Madrid',
    'atleti': 'Atlético Madrid',
    'bayern': 'Bayern Munich',
    'dortmund': 'Borussia Dortmund',
    'leverkusen': 'Bayer Leverkusen',
    'levy': 'Bayer Leverkusen',
    'psg': 'Paris Saint-Germain',
    'lyon': 'Olympique Lyon',
    'inter': 'Inter Milan',
    'milan': 'AC Milan',
    'juve': 'Juventus',
    'napoli': 'SSC Napoli',
    'roma': 'AS Roma',
    'lazio': 'SS Lazio',
    'ajax': 'Ajax',
    'benfica': 'SL Benfica',
    'porto': 'FC Porto',
    'celtic': 'Celtic',
  };

  // Check abbreviations first
  if (abbreviations[normalized]) {
    return abbreviations[normalized];
  }

  // Try exact match (case-insensitive) on Korean and English
  const exactMatch = TEAMS.find(
    (t) =>
      t.name.toLowerCase() === normalized ||
      t.nameKo.toLowerCase() === normalized,
  );
  if (exactMatch) return exactMatch.name;

  // Try partial match (input contains team name or team name contains input)
  const partialMatch = TEAMS.find(
    (t) =>
      t.name.toLowerCase().includes(normalized) ||
      normalized.includes(t.name.toLowerCase()) ||
      t.nameKo.includes(normalized) ||
      normalized.includes(t.nameKo),
  );
  if (partialMatch) return partialMatch.name;

  // Return original if no match found
  return input;
}

/**
 * Resolve a league name (English, Korean, or ID) to the league ID.
 */
export function resolveLeagueId(input: string): string {
  const normalized = input.toLowerCase().trim();
  if (!normalized) return input;

  // Try exact ID match
  const idMatch = LEAGUES.find((l) => l.id.toLowerCase() === normalized);
  if (idMatch) return idMatch.id;

  // Try name match
  const nameMatch = LEAGUES.find(
    (l) =>
      l.name.toLowerCase() === normalized ||
      l.nameKo === normalized ||
      l.name.toLowerCase().includes(normalized) ||
      normalized.includes(l.name.toLowerCase()),
  );
  if (nameMatch) return nameMatch.id;

  // Common aliases
  const aliases: Record<string, string> = {
    'premier league': 'EPL',
    'epl': 'EPL',
    '프리미어리그': 'EPL',
    'la liga': 'LALIGA',
    'laliga': 'LALIGA',
    '라리가': 'LALIGA',
    'serie a': 'SERIEA',
    'seriea': 'SERIEA',
    '세리에a': 'SERIEA',
    'calcio': 'SERIEA',
    'bundeliga': 'BUNDESLIGA',
    'bundesliga': 'BUNDESLIGA',
    '분데스리가': 'BUNDESLIGA',
    'ligue 1': 'LIGUE1',
    'ligue1': 'LIGUE1',
    '리그1': 'LIGUE1',
    'k league': 'KLEAGUE',
    'kleague': 'KLEAGUE',
    'k리그': 'KLEAGUE',
    'eredivisie': 'EREDIVISIE',
    '에레디비지에': 'EREDIVISIE',
    'primeira liga': 'PRIMEIRALIGA',
    'portuguese league': 'PRIMEIRALIGA',
    '프리메이라리가': 'PRIMEIRALIGA',
    'turkish league': 'SUPERLIG',
    'süper lig': 'SUPERLIG',
    '쉬페르리그': 'SUPERLIG',
    'scottish premiership': 'SCOTPREM',
    'spl': 'SCOTPREM',
    'scottish': 'SCOTPREM',
    'mls': 'MLS',
    'saudi league': 'SPL',
    'saudi pro league': 'SPL',
    '사우디리그': 'SPL',
  };

  const resolved = aliases[normalized];
  return resolved ?? input;
}

// ---------------------------------------------------------------------------
// JSON Extraction
// ---------------------------------------------------------------------------

/**
 * Extract JSON from a potentially messy AI response.
 * Handles cases where the AI wraps JSON in markdown code fences or adds
 * extra text.
 */
export function extractJsonFromResponse(text: string): string | null {
  // Try direct parse first
  const trimmed = text.trim();
  try {
    JSON.parse(trimmed);
    return trimmed;
  } catch {
    // not direct JSON, try extraction
  }

  // Try extracting from markdown code fences: ```json ... ``` or ``` ... ```
  const codeFenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (codeFenceMatch) {
    try {
      JSON.parse(codeFenceMatch[1].trim());
      return codeFenceMatch[1].trim();
    } catch {
      // not valid JSON in code fence
    }
  }

  // Try finding JSON object boundaries: { ... }
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch {
      // not valid JSON
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Multi-Candidate Validation & Normalization
// ---------------------------------------------------------------------------

/**
 * Validate the AI response for the multi-candidate format.
 * Expects { candidates: [...] } with exactly 3 objects, each having
 * "strategy" (string) and "confidence" (number).
 */
export function validateMultiCandidateResponse(raw: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!raw || typeof raw !== 'object') {
    errors.push({ path: 'root', message: 'Response is not an object' });
    return errors;
  }

  const obj = raw as Record<string, unknown>;

  // Must have a "candidates" array
  if (!Array.isArray(obj.candidates)) {
    errors.push({ path: 'candidates', message: 'Response must have a "candidates" array' });
    return errors;
  }

  const candidates = obj.candidates;

  if (candidates.length === 0) {
    errors.push({ path: 'candidates', message: 'candidates array must not be empty' });
    return errors;
  }

  if (candidates.length < 3) {
    errors.push({ path: 'candidates', message: `Expected 3 candidates, got ${candidates.length}` });
  }

  // Validate each candidate
  candidates.forEach((candidate, i) => {
    if (typeof candidate !== 'object' || candidate === null) {
      errors.push({ path: `candidates[${i}]`, message: 'Candidate must be an object' });
      return;
    }

    const c = candidate as Record<string, unknown>;

    // strategy is required for multi-candidate
    if (!c.strategy || typeof c.strategy !== 'string') {
      errors.push({ path: `candidates[${i}].strategy`, message: 'Strategy is required and must be a string' });
    }

    // confidence is required
    if (c.confidence === undefined || typeof c.confidence !== 'number') {
      errors.push({ path: `candidates[${i}].confidence`, message: 'Missing or invalid confidence number' });
    } else if (c.confidence < 0 || c.confidence > 1) {
      errors.push({ path: `candidates[${i}].confidence`, message: 'Confidence must be between 0 and 1' });
    }

    // Delegate remaining fields to the existing single-candidate validator
    const fieldErrors = validateParsedRequest(candidate);
    for (const fieldError of fieldErrors) {
      // Skip the confidence error since we already handle it above
      if (fieldError.path === 'confidence') continue;
      errors.push({ path: `candidates[${i}].${fieldError.path}`, message: fieldError.message });
    }
  });

  return errors;
}

/**
 * Normalize a validated multi-candidate response into SquadCandidateSpec[].
 * Each candidate gets its fields normalized via normalizeParsedRequest,
 * plus the strategy field.
 */
export function normalizeMultiCandidateResponse(raw: Record<string, unknown>): SquadCandidateSpec[] {
  const candidates = (raw.candidates as unknown[]) ?? [];
  const specs: SquadCandidateSpec[] = [];

  for (const rawCandidate of candidates) {
    if (typeof rawCandidate !== 'object' || rawCandidate === null) continue;
    const c = rawCandidate as Record<string, unknown>;

    // Use the existing normalizer for the ParsedSquadRequest fields
    const normalized = normalizeParsedRequest(c);

    // Add the strategy field
    const spec: SquadCandidateSpec = {
      ...normalized,
      strategy: typeof c.strategy === 'string' ? c.strategy : 'Squad recommendation',
    };

    specs.push(spec);
  }

  return specs;
}

// ---------------------------------------------------------------------------
// Fallback: Rule-Based Parser
// ---------------------------------------------------------------------------

/**
 * Rule-based fallback parser for when AI is unavailable.
 * Uses regex patterns to extract basic constraints from user input.
 */
export function fallbackParse(userInput: string): ParseResult {
  const startTime = Date.now();
  const input = userInput.trim();
  const result: ParsedSquadRequest = {
    confidence: 0.3,
    warnings: ['AI unavailable — using rule-based fallback parsing with limited accuracy.'],
  };

  // --- Formation ---
  const formationRegex = /(\d-\d-\d(?:-\d)?)/;
  const formationMatch = input.match(formationRegex);
  if (formationMatch) {
    const f = formationMatch[1];
    if (VALID_FORMATIONS.includes(f as typeof VALID_FORMATIONS[number])) {
      result.formation = f as ParsedSquadRequest['formation'];
    }
  }

  // --- Budget ---
  // Order matters: more specific patterns first
  const budgetPatterns: { regex: RegExp; multiplier: number }[] = [
    { regex: /(\d+(?:,\d{3})*)\s*억/, multiplier: 100_000_000 },  // 10억
    { regex: /(\d+(?:,\d{3})*)\s*만/, multiplier: 10_000 },       // 500만
    { regex: /(\d+\.\d+)\s*[mM](?:\b|$|\s)/, multiplier: 1_000_000 }, // 1.5M (decimal)
    { regex: /(\d+)\s*[mM](?:\b|$|\s)/, multiplier: 1_000_000 },    // 10M (integer)
    { regex: /(\d+(?:,\d{3})*)\s*[kK](?:\b|$|\s)/, multiplier: 1_000 }, // 500k
    { regex: /(\d{1,3}(?:,\d{3})+)/, multiplier: 1 },               // 1,000,000
  ];

  for (const { regex, multiplier } of budgetPatterns) {
    const match = input.match(regex);
    if (match) {
      const numStr = match[1].replace(/,/g, '');
      const value = parseFloat(numStr) * multiplier;

      result.budget = { max: value, strictness: 'flexible' };

      // Detect "under", "below", "max", "이하", "미만"
      if (/(?:under|below|max|less\s+than|이하|미만|최대)/i.test(input)) {
        result.budget.strictness = 'strict';
      }
      // Detect "around", "about", "대략", "정도"
      else if (/(?:around|about|approximately|대략|정도)/i.test(input)) {
        result.budget.strictness = 'flexible';
      }
      break;
    }
  }

  // --- Teams ---
  result.teams = [];
  for (const team of TEAMS) {
    const escapedName = team.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameRegex = new RegExp(`(?:^|[\\s,.])${escapedName}(?:[\\s,.]|$)`, 'i');
    // Also check common abbreviations and Korean names
    if (
      nameRegex.test(input) ||
      input.includes(team.nameKo) ||
      input.toLowerCase().includes(team.nameKo.toLowerCase())
    ) {
      result.teams.push({ name: team.name, strength: 'preferred' });
    }
  }
  if (result.teams.length === 0) delete result.teams;

  // --- Leagues ---
  // Note: \b doesn't work with Korean characters, so we use broader matching
  const leagueAliases: Record<string, RegExp> = {
    EPL: /(?:premier\s*league|epl|프리미어리그)/i,
    LALIGA: /(?:la\s*liga|laliga|라리가)/i,
    SERIEA: /(?:serie\s*a|calcio|세리에)/i,
    BUNDESLIGA: /(?:bundesliga|분데스리가)/i,
    LIGUE1: /(?:ligue\s*1|리그[\s.]*1)/i,
    KLEAGUE: /(?:k[\s.]*league|k[\s.]*리그)/i,
  };

  result.leagues = [];
  for (const [leagueId, regex] of Object.entries(leagueAliases)) {
    if (regex.test(input)) {
      result.leagues.push({ league: leagueId, strength: 'preferred' });
    }
  }
  if (result.leagues.length === 0) delete result.leagues;

  // --- Chemistry ---
  // Note: \b doesn't work with Korean characters
  if (/(?:chem|chemistry|link|팀켐|리그켐|케미)/i.test(input)) {
    result.chemistry = {
      priority: /(?:full|max|최대|완전)/i.test(input) ? 'max' : 'high',
      sameTeamLinks: /(?:same\s*team|팀켐|같은\s*팀)/i.test(input),
      sameLeagueLinks: /(?:same\s*league|리그켐|같은\s*리그)/i.test(input),
      sameNationalityLinks: /(?:same\s*nationality|같은\s*국적)/i.test(input),
    };
  }

  // --- Playstyle ---
  // Order matters: more specific patterns first (counter before attack, high-press before press)
  if (/(?:defensive|수비|defend)/i.test(input)) {
    result.playstyle = 'defensive';
  } else if (/(?:counter[\s-]?attack|카운터어택|카운터)/i.test(input)) {
    result.playstyle = 'counter-attack';
  } else if (/(?:high[\s-]?press|하이프레싱)/i.test(input)) {
    result.playstyle = 'high-press';
  } else if (/(?:possession|볼[\s]*점유|티키타카|tiki[\s-]?taka)/i.test(input)) {
    result.playstyle = 'possession';
  } else if (/(?:attacking|공격|attack)/i.test(input)) {
    result.playstyle = 'attacking';
  } else if (/(?:press|프레싱)/i.test(input)) {
    result.playstyle = 'high-press';
  }

  // --- Stat priorities ---
  // Note: \b doesn't work with Korean characters
  result.statPriorities = [];
  if (/(?:fast|speed|pace|빠른|속도|페이스)/i.test(input)) {
    result.statPriorities.push('pace');
  }
  if (/(?:shoot|striker|골\s*결정력|슛팅|공격력|결정력)/i.test(input)) {
    result.statPriorities.push('shooting');
  }
  if (/(?:\bpass(?:ing)?|패스)/i.test(input)) {
    result.statPriorities.push('passing');
  }
  if (/(?:dribbl|드리블|볼컨트롤)/i.test(input)) {
    result.statPriorities.push('dribbling');
  }
  if (/(?:defend(?:ing)?|수비력|태클|방어)/i.test(input) && result.statPriorities.length === 0) {
    result.statPriorities.push('defending');
  }
  if (/(?:physical|strength|피지컬|몸싸움)/i.test(input)) {
    result.statPriorities.push('physical');
  }
  if (result.statPriorities.length === 0) delete result.statPriorities;

  return {
    request: result,
    originalInput: userInput,
    success: true,
    method: 'fallback',
    parseTimeMs: Date.now() - startTime,
  };
}
