/**
 * AI-powered squad request parser service.
 *
 * This is the main entry point for parsing natural language squad building
 * requests into structured parameters. It:
 *
 * 1. Calls the Gemini API with the user's input and a structured prompt
 * 2. Extracts and validates the JSON response
 * 3. Normalizes the parsed data (resolves team/league names, etc.)
 * 4. Falls back to rule-based parsing if AI is unavailable or fails
 *
 * Usage:
 *   import { parseSquadRequest } from '@/lib/ai/squad-parser';
 *   const result = await parseSquadRequest('Build me a cheap EPL 4-3-3 squad');
 *   // result.request.formation = '4-3-3'
 *   // result.request.leagues = [{ league: 'EPL', strength: 'preferred' }]
 *   // result.request.budget.max = 500000
 */

import { buildSystemPrompt, buildUserPrompt, buildRetryPrompt, buildMultiCandidateSystemPrompt, buildMultiCandidateUserPrompt, buildMultiCandidateRetryPrompt } from './prompts';
import { callGemini, isGeminiConfigured } from './gemini-client';
import {
  extractJsonFromResponse,
  validateParsedRequest,
  normalizeParsedRequest,
  fallbackParse,
  validateMultiCandidateResponse,
  normalizeMultiCandidateResponse,
} from './parser';
import type { ParseResult, ParsedSquadRequest, MultiCandidateParseResult, SquadCandidateSpec } from './types';
import type { Formation, SquadRequest } from '@/types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Maximum number of retry attempts for AI parsing */
const MAX_RETRIES = 1;

// ---------------------------------------------------------------------------
// Main Parse Function
// ---------------------------------------------------------------------------

/**
 * Parse a natural language squad building request into structured parameters.
 *
 * @param userInput - The user's natural language input (English or Korean)
 * @param options - Optional configuration overrides
 * @returns ParseResult with the structured request and metadata
 *
 * @example
 *   const result = await parseSquadRequest('4-3-3으로 프리미어리그 500만 이하 스쿼드');
 *   console.log(result.request.formation);    // '4-3-3'
 *   console.log(result.request.budget?.max);  // 5000000
 *   console.log(result.request.leagues);      // [{ league: 'EPL', strength: 'preferred' }]
 */
export async function parseSquadRequest(
  userInput: string,
  options?: {
    /** Model ID override (default: gemini-2.0-flash) */
    model?: string;
    /** Skip AI and use fallback parser only */
    forceFallback?: boolean;
  },
): Promise<ParseResult> {
  const trimmedInput = userInput.trim();

  // Empty input check
  if (!trimmedInput) {
    return {
      request: {
        confidence: 0,
        warnings: ['Empty input received.'],
      },
      originalInput: userInput,
      success: false,
      error: 'Input is empty',
      method: 'fallback',
      parseTimeMs: 0,
    };
  }

  // If AI not configured or forced fallback, use rule-based parser
  if (!isGeminiConfigured() || options?.forceFallback) {
    const fallbackResult = fallbackParse(trimmedInput);
    if (!isGeminiConfigured() && !options?.forceFallback) {
      fallbackResult.request.warnings = [
        ...(fallbackResult.request.warnings ?? []),
        'Gemini API key not configured. Using fallback parser. Set GOOGLE_GENERATIVE_AI_KEY for better results.',
      ];
    }
    return fallbackResult;
  }

  // --- AI Parsing Path ---

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt(trimmedInput);

  // First attempt
  let geminiResponse = await callGemini({
    model: options?.model,
    systemPrompt,
    userPrompt,
  });

  // If first attempt failed, try once more
  if (!geminiResponse.success && MAX_RETRIES > 0) {
    geminiResponse = await callGemini({
      model: options?.model,
      systemPrompt,
      userPrompt,
      temperature: 0.05, // Even more deterministic on retry
    });
  }

  // If Gemini failed completely, fall back to rule-based parser
  if (!geminiResponse.success) {
    const fallbackResult = fallbackParse(trimmedInput);
    fallbackResult.request.warnings = [
      ...(fallbackResult.request.warnings ?? []),
      `AI parsing failed: ${geminiResponse.error}`,
    ];
    return fallbackResult;
  }

  // Extract JSON from response
  const jsonText = extractJsonFromResponse(geminiResponse.text);
  if (!jsonText) {
    // Try to fix with retry prompt
    return await attemptRetryOrFallback(trimmedInput, geminiResponse.text, options?.model);
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    // JSON parse failed, try retry
    return await attemptRetryOrFallback(trimmedInput, geminiResponse.text, options?.model);
  }

  // Validate
  const errors = validateParsedRequest(parsed);
  if (errors.length > 0) {
    // Try retry with validation feedback
    return await attemptRetryOrFallback(trimmedInput, JSON.stringify(parsed, null, 2), options?.model, errors.map((e) => `${e.path}: ${e.message}`));
  }

  // Normalize
  const request = normalizeParsedRequest(parsed as Record<string, unknown>);

  return {
    request,
    originalInput: userInput,
    success: true,
    method: 'gemini',
    parseTimeMs: geminiResponse.durationMs,
  };
}

// ---------------------------------------------------------------------------
// Retry Logic
// ---------------------------------------------------------------------------

async function attemptRetryOrFallback(
  userInput: string,
  rawResponse: string,
  model?: string,
  validationErrors?: string[],
): Promise<ParseResult> {
  if (MAX_RETRIES <= 0) {
    return fallbackWithWarning(userInput, rawResponse, validationErrors);
  }

  // Build retry prompt
  const retryPrompt = validationErrors
    ? buildRetryPrompt(userInput, { errors: validationErrors, raw: rawResponse })
    : buildRetryPrompt(userInput, {
        errors: ['Could not extract valid JSON from your response.'],
        raw: rawResponse,
      });

  const retryResponse = await callGemini({
    model,
    systemPrompt: buildSystemPrompt(),
    userPrompt: retryPrompt,
    temperature: 0.05,
  });

  if (!retryResponse.success) {
    return fallbackWithWarning(userInput, rawResponse, validationErrors);
  }

  const jsonText = extractJsonFromResponse(retryResponse.text);
  if (!jsonText) {
    return fallbackWithWarning(userInput, rawResponse, validationErrors);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return fallbackWithWarning(userInput, rawResponse, validationErrors);
  }

  const errors = validateParsedRequest(parsed);
  if (errors.length > 0) {
    // Validation still failing after retry — use fallback
    return fallbackWithWarning(userInput, rawResponse, validationErrors);
  }

  const request = normalizeParsedRequest(parsed as Record<string, unknown>);

  return {
    request,
    originalInput: userInput,
    success: true,
    method: 'gemini',
    parseTimeMs: retryResponse.durationMs,
  };
}

function fallbackWithWarning(
  userInput: string,
  _rawResponse: string,
  _validationErrors?: string[],
): ParseResult {
  const fallbackResult = fallbackParse(userInput);
  fallbackResult.request.warnings = [
    ...(fallbackResult.request.warnings ?? []),
    'AI response validation failed after retry. Using fallback parser.',
  ];
  return fallbackResult;
}

// ---------------------------------------------------------------------------
// Multi-Candidate Parse Function (3 distinct squad suggestions)
// ---------------------------------------------------------------------------

/** Default strategy names for fallback-generated candidates */
const FALLBACK_STRATEGIES = [
  'Balanced squad focused on overall chemistry and synergy',
  'Attack-minded squad prioritizing pace and shooting',
  'Defense-oriented squad with strong midfield presence',
];

/** Formations to cycle through for diverse fallback candidates */
const DIVERSE_FORMATIONS: Formation[] = ['4-3-3', '4-2-3-1', '3-5-2'];

/** Playstyles for diverse fallback candidates */
const DIVERSE_PLAYSTYLES = ['balanced', 'attacking', 'defensive'];

/**
 * Parse a natural language squad request into 3 distinct squad candidate specs.
 * Uses the multi-candidate prompt that instructs the AI to generate diverse options.
 *
 * Falls back to generating 3 variations from a single fallback parse if AI is unavailable.
 *
 * @param userInput - The user's natural language input
 * @returns MultiCandidateParseResult with 3 SquadCandidateSpec objects
 */
export async function parseMultiSquadRequest(
  userInput: string,
  options?: {
    model?: string;
    forceFallback?: boolean;
  },
): Promise<MultiCandidateParseResult> {
  const trimmedInput = userInput.trim();

  if (!trimmedInput) {
    return {
      candidates: [],
      originalInput: userInput,
      success: false,
      error: 'Input is empty',
      method: 'fallback',
      parseTimeMs: 0,
    };
  }

  // If AI not configured or forced fallback, use rule-based parser with diversification
  if (!isGeminiConfigured() || options?.forceFallback) {
    return generateFallbackCandidates(trimmedInput, !isGeminiConfigured() && !options?.forceFallback);
  }

  // --- AI Parsing Path ---

  const systemPrompt = buildMultiCandidateSystemPrompt();
  const userPrompt = buildMultiCandidateUserPrompt(trimmedInput);

  // First attempt
  let geminiResponse = await callGemini({
    model: options?.model,
    systemPrompt,
    userPrompt,
    temperature: 0.7, // Higher temperature for creative diversity
  });

  // Retry once with lower temperature if failed
  if (!geminiResponse.success) {
    geminiResponse = await callGemini({
      model: options?.model,
      systemPrompt,
      userPrompt,
      temperature: 0.3,
    });
  }

  // If Gemini failed completely, fall back to rule-based diversification
  if (!geminiResponse.success) {
    return generateFallbackCandidates(trimmedInput, true, geminiResponse.error);
  }

  // Extract JSON
  const jsonText = extractJsonFromResponse(geminiResponse.text);
  if (!jsonText) {
    const retryResult = await attemptMultiCandidateRetry(trimmedInput, geminiResponse.text, options?.model);
    if (retryResult) return retryResult;
    return generateFallbackCandidates(trimmedInput, true);
  }

  // Parse JSON
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    const retryResult = await attemptMultiCandidateRetry(trimmedInput, geminiResponse.text, options?.model);
    if (retryResult) return retryResult;
    return generateFallbackCandidates(trimmedInput, true);
  }

  // Validate
  const errors = validateMultiCandidateResponse(parsed);
  if (errors.length > 0) {
    const retryResult = await attemptMultiCandidateRetry(
      trimmedInput,
      JSON.stringify(parsed, null, 2),
      options?.model,
      errors.map((e) => `${e.path}: ${e.message}`),
    );
    if (retryResult) return retryResult;
    return generateFallbackCandidates(trimmedInput, true);
  }

  // Normalize
  const candidates = normalizeMultiCandidateResponse(parsed as Record<string, unknown>);

  return {
    candidates,
    originalInput: userInput,
    success: true,
    method: 'gemini',
    parseTimeMs: geminiResponse.durationMs,
  };
}

/**
 * Retry multi-candidate parsing with error feedback.
 */
async function attemptMultiCandidateRetry(
  userInput: string,
  rawResponse: string,
  model?: string,
  validationErrors?: string[],
): Promise<MultiCandidateParseResult | null> {
  const retryPrompt = validationErrors
    ? buildMultiCandidateRetryPrompt(userInput, { errors: validationErrors, raw: rawResponse })
    : buildMultiCandidateRetryPrompt(userInput, {
        errors: ['Could not extract valid JSON from your response.'],
        raw: rawResponse,
      });

  const retryResponse = await callGemini({
    model,
    systemPrompt: buildMultiCandidateSystemPrompt(),
    userPrompt: retryPrompt,
    temperature: 0.3,
  });

  if (!retryResponse.success) return null;

  const jsonText = extractJsonFromResponse(retryResponse.text);
  if (!jsonText) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return null;
  }

  const errors = validateMultiCandidateResponse(parsed);
  if (errors.length > 0) return null;

  const candidates = normalizeMultiCandidateResponse(parsed as Record<string, unknown>);

  return {
    candidates,
    originalInput: userInput,
    success: true,
    method: 'gemini',
    parseTimeMs: retryResponse.durationMs,
  };
}

/**
 * Generate 3 fallback candidates from a single rule-based parse,
 * diversifying formations and playstyles.
 */
function generateFallbackCandidates(
  userInput: string,
  addApiKeyWarning: boolean,
  aiError?: string,
): MultiCandidateParseResult {
  const baseResult = fallbackParse(userInput);
  const baseRequest = baseResult.request;

  const candidates: SquadCandidateSpec[] = [];

  for (let i = 0; i < 3; i++) {
    const spec: SquadCandidateSpec = {
      ...baseRequest,
      strategy: FALLBACK_STRATEGIES[i],
    };

    // Diversify formations if user didn't specify one
    if (!baseRequest.formation) {
      spec.formation = DIVERSE_FORMATIONS[i];
    }

    // Diversify playstyles if user didn't specify one
    if (!baseRequest.playstyle) {
      spec.playstyle = DIVERSE_PLAYSTYLES[i] as SquadCandidateSpec['playstyle'];
    }

    // Vary stat priorities based on playstyle
    if (!baseRequest.statPriorities || baseRequest.statPriorities.length === 0) {
      if (i === 0) {
        spec.statPriorities = ['pace', 'passing'];
      } else if (i === 1) {
        spec.statPriorities = ['pace', 'shooting'];
      } else {
        spec.statPriorities = ['defending', 'physical'];
      }
    }

    // Adjust confidence per candidate
    spec.confidence = Math.max(0.1, baseRequest.confidence - i * 0.1);

    // Add warnings
    spec.warnings = [...(spec.warnings ?? [])];
    if (addApiKeyWarning) {
      spec.warnings.push('Gemini API key not configured. Using fallback parser with limited diversity.');
    }
    if (aiError) {
      spec.warnings.push(`AI parsing failed: ${aiError}. Using fallback.`);
    }

    candidates.push(spec);
  }

  return {
    candidates,
    originalInput: userInput,
    success: true,
    method: 'fallback',
    parseTimeMs: baseResult.parseTimeMs,
  };
}

// ---------------------------------------------------------------------------
// Convenience: Convert ParsedSquadRequest to SquadRequest
// ---------------------------------------------------------------------------

/**
 * Convert a ParsedSquadRequest into the SquadRequest format expected by
 * the /api/squad endpoint.
 */
export function toSquadRequest(parsed: ParsedSquadRequest): SquadRequest {
  const squadRequest: SquadRequest = {
    formation: parsed.formation ?? '4-3-3',
    prompt: parsed.additionalConstraints?.join(', '),
  };

  // Budget
  if (parsed.budget?.max) {
    squadRequest.budget = parsed.budget.max;
  }

  // Team color (first required/preferred team)
  const primaryTeam = parsed.teams?.find((t) => t.strength === 'required') ?? parsed.teams?.[0];
  if (primaryTeam) {
    squadRequest.teamColor = primaryTeam.name;
  }

  return squadRequest;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { isGeminiConfigured } from './gemini-client';
export { fallbackParse } from './parser';
export type { ParsedSquadRequest, ParseResult, ParsedBudget, TeamPreference, LeaguePreference, SquadCandidateSpec, MultiCandidateParseResult } from './types';
