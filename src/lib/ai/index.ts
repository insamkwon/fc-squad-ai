/**
 * AI service layer for FC Online squad building.
 *
 * This module provides natural language parsing of squad building requests
 * using the Gemini API with rule-based fallback.
 *
 * @example
 *   import { parseSquadRequest, toSquadRequest } from '@/lib/ai';
 *
 *   // Parse natural language input
 *   const result = await parseSquadRequest('Build a cheap EPL 4-3-3 squad with fast players');
 *
 *   // Convert to SquadRequest for the API
 *   const squadRequest = toSquadRequest(result.request);
 */

export { parseSquadRequest, toSquadRequest, parseMultiSquadRequest, isGeminiConfigured, fallbackParse } from './squad-parser';

export { analyzeVagueInput, analyzeMultiCandidateVagueInput, getQuickSuggestions } from './vague-detector';

export type {
  ParsedSquadRequest,
  ParseResult,
  ParsedBudget,
  TeamPreference,
  LeaguePreference,
  NationalityPreference,
  PlayerPreference,
  ChemistryPreference,
  PositionPreference,
  StatPriority,
  Playstyle,
  CardTypePreference,
  PreferenceStrength,
  SquadCandidateSpec,
  MultiCandidateParseResult,
  VagueInputIssue,
  VagueInputAnalysis,
  VagueSeverity,
} from './types';

export {
  VALID_FORMATIONS,
  VALID_POSITIONS,
  VALID_STAT_PRIORITIES,
  VALID_PLAYSTYLES,
  VALID_CARD_TYPES,
} from './types';
