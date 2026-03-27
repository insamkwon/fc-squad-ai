/**
 * AI service layer types for parsing natural language squad requests.
 *
 * These types define the structured output that the AI extracts from
 * user's natural language input about squad building preferences.
 */

import type { Formation, Position } from '@/types';

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

/** Parsed budget constraint from user input */
export interface ParsedBudget {
  /** Maximum budget in game currency (BP/GP). null = no limit */
  max?: number;
  /** Minimum budget to spend (e.g., "spend at least 1M") */
  min?: number;
  /** How strict the budget constraint is */
  strictness: 'strict' | 'flexible' | 'none';
}

// ---------------------------------------------------------------------------
// Team / League / Nationality Preferences
// ---------------------------------------------------------------------------

export type PreferenceStrength = 'required' | 'preferred' | 'optional';

/** Parsed team preference */
export interface TeamPreference {
  /** Team name as identified (e.g., "Manchester City", "맨시티") */
  name: string;
  /** How strongly the user wants this team */
  strength: PreferenceStrength;
}

/** Parsed league preference */
export interface LeaguePreference {
  /** League ID or name (e.g., "EPL", "La Liga", "프리미어리그") */
  league: string;
  /** How strongly the user wants this league */
  strength: PreferenceStrength;
}

/** Parsed nationality preference */
export interface NationalityPreference {
  /** Nationality name (e.g., "Korean", "Brazilian", "영국") */
  nationality: string;
  /** How strongly the user wants this nationality */
  strength: PreferenceStrength;
}

// ---------------------------------------------------------------------------
// Player Preferences
// ---------------------------------------------------------------------------

/** A specific player the user wants included or referenced */
export interface PlayerPreference {
  /** Player name as stated by user (e.g., "Mbappé", "음바페", "Son Heung-min") */
  name: string;
  /** Whether the player must be in the squad */
  required: boolean;
  /** Notes about card version preference (e.g., "TOTNUCL card", "ICON version") */
  cardTypePreference?: string;
}

// ---------------------------------------------------------------------------
// Stat / Playstyle Preferences
// ---------------------------------------------------------------------------

/** Priority for specific player stats */
export type StatPriority =
  | 'pace'
  | 'shooting'
  | 'passing'
  | 'dribbling'
  | 'defending'
  | 'physical';

/** Squad playstyle */
export type Playstyle =
  | 'attacking'
  | 'defensive'
  | 'balanced'
  | 'possession'
  | 'counter-attack'
  | 'high-press'
  | 'park-the-bus';

/** Card type preferences */
export type CardTypePreference = 'BASE' | 'SPECIAL' | 'ICON' | 'LIVE' | 'MOM' | 'POTW';

// ---------------------------------------------------------------------------
// Chemistry Preferences
// ---------------------------------------------------------------------------

/** Chemistry/link preferences */
export interface ChemistryPreference {
  /** How important chemistry links are to the user */
  priority: 'low' | 'medium' | 'high' | 'max';
  /** Whether user wants same-team links */
  sameTeamLinks: boolean;
  /** Whether user wants same-league links */
  sameLeagueLinks: boolean;
  /** Whether user wants same-nationality links */
  sameNationalityLinks: boolean;
  /** Minimum acceptable chemistry score (0-100) */
  minChemistryScore?: number;
}

// ---------------------------------------------------------------------------
// Main Parsed Request
// ---------------------------------------------------------------------------

/**
 * The complete structured output from parsing a user's natural language
 * squad building request.
 *
 * Every field is optional — the AI should only fill fields that the user
 * actually mentioned or strongly implied.
 */
export interface ParsedSquadRequest {
  /** Extracted formation preference. null = user didn't specify */
  formation?: Formation | null;

  /** Budget constraint */
  budget?: ParsedBudget;

  /** Team preferences (may include multiple) */
  teams?: TeamPreference[];

  /** League preferences */
  leagues?: LeaguePreference[];

  /** Nationality preferences */
  nationalities?: NationalityPreference[];

  /** Specific players the user mentioned */
  players?: PlayerPreference[];

  /** Excluded teams */
  excludedTeams?: string[];

  /** Minimum OVR rating requirement */
  minOvr?: number;

  /** Maximum OVR rating (for budget squads) */
  maxOvr?: number;

  /** Stat priorities in order of importance */
  statPriorities?: StatPriority[];

  /** Preferred playstyle */
  playstyle?: Playstyle;

  /** Chemistry preferences */
  chemistry?: ChemistryPreference;

  /** Card type preferences */
  cardTypes?: CardTypePreference[];

  /** Position-specific preferences (e.g., "need a fast RW") */
  positionPreferences?: PositionPreference[];

  /** Any additional notes or constraints not captured above */
  additionalConstraints?: string[];

  /** How confident the AI is about the overall parse (0-1) */
  confidence: number;

  /** Warnings about ambiguous or potentially misunderstood inputs */
  warnings?: string[];
}

/** Position-specific preference */
export interface PositionPreference {
  /** The position this applies to */
  position: Position;
  /** Minimum stat requirements for this position */
  minStats?: Partial<Record<StatPriority, number>>;
  /** Preferred player names for this position */
  preferredPlayers?: string[];
  /** Description of what the user wants at this position */
  description?: string;
}

// ---------------------------------------------------------------------------
// Multi-Candidate Request (3 squad suggestions per user request)
// ---------------------------------------------------------------------------

/**
 * A single squad candidate specification returned by the AI.
 * Extends ParsedSquadRequest with a human-readable strategy description.
 */
export interface SquadCandidateSpec extends ParsedSquadRequest {
  /** Short description of this candidate's approach (e.g., "Balanced 4-3-3 with strong chemistry") */
  strategy: string;
}

/**
 * Result of parsing a user request into 3 distinct squad candidates.
 */
export interface MultiCandidateParseResult {
  /** Up to 3 squad candidate specifications, each with different strategies */
  candidates: SquadCandidateSpec[];
  /** Original user input */
  originalInput: string;
  /** Whether the parse was successful overall */
  success: boolean;
  /** If parsing failed, the error message */
  error?: string;
  /** The parsing method used (e.g., 'gemini', 'fallback') */
  method: 'gemini' | 'fallback';
  /** Time taken to parse in milliseconds */
  parseTimeMs: number;
}

// ---------------------------------------------------------------------------
// Parse Result
// ---------------------------------------------------------------------------

/**
 * The result of parsing a user request, including the parsed data
 * and metadata about the parsing process.
 */
export interface ParseResult {
  /** The parsed structured request */
  request: ParsedSquadRequest;

  /** Original user input */
  originalInput: string;

  /** Whether the parse was successful */
  success: boolean;

  /** If parsing failed, the error message */
  error?: string;

  /** The parsing method used (e.g., 'gemini', 'fallback') */
  method: 'gemini' | 'fallback';

  /** Time taken to parse in milliseconds */
  parseTimeMs: number;
}

// ---------------------------------------------------------------------------
// Vague Input Detection
// ---------------------------------------------------------------------------

/** Severity level of a vague input issue */
export type VagueSeverity = 'info' | 'suggestion' | 'warning';

/** A single missing or unclear constraint detected in user input */
export interface VagueInputIssue {
  /** The type of constraint that is missing or vague */
  type: 'formation' | 'budget' | 'league' | 'team' | 'playstyle' | 'position' | 'short_input' | 'no_constraints';
  /** Severity level — info = minor, suggestion = helpful to add, warning = significantly limits results */
  severity: VagueSeverity;
  /** Human-readable message in Korean describing the issue */
  messageKo: string;
  /** Human-readable message in English describing the issue */
  messageEn: string;
  /** Suggested follow-up prompts the user can click (bilingual) */
  suggestions: {
    ko: string;
    en: string;
  }[];
}

/** Result of analyzing a parsed request for vague/missing constraints */
export interface VagueInputAnalysis {
  /** Whether the input is considered vague (any issues with severity >= suggestion) */
  isVague: boolean;
  /** All detected issues, ordered by severity (warning > suggestion > info) */
  issues: VagueInputIssue[];
  /** Overall confidence level of the parsed input (derived from issues) */
  vaguenessLevel: 'clear' | 'somewhat_vague' | 'vague' | 'very_vague';
  /** A concise summary message about what's missing (for UI display) */
  summaryKo: string;
  summaryEn: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** All valid formations for reference in prompts */
export const VALID_FORMATIONS: Formation[] = [
  '4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '4-1-4-1',
  '3-4-3', '4-5-1', '5-3-2', '5-4-1', '4-3-2-1',
  '4-4-1-1', '3-4-1-2',
];

/** All valid positions */
export const VALID_POSITIONS: Position[] = [
  'ST', 'CF', 'LF', 'RF', 'LW', 'RW', 'CAM', 'CM',
  'CDM', 'LM', 'RM', 'LB', 'RB', 'CB', 'LWB', 'RWB', 'GK',
];

/** All valid stat priorities */
export const VALID_STAT_PRIORITIES: StatPriority[] = [
  'pace', 'shooting', 'passing', 'dribbling', 'defending', 'physical',
];

/** All valid playstyles */
export const VALID_PLAYSTYLES: Playstyle[] = [
  'attacking', 'defensive', 'balanced', 'possession',
  'counter-attack', 'high-press', 'park-the-bus',
];

/** All valid card types */
export const VALID_CARD_TYPES: CardTypePreference[] = [
  'BASE', 'SPECIAL', 'ICON', 'LIVE', 'MOM', 'POTW',
];
