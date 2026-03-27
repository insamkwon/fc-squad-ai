/**
 * Prompt engineering templates for the AI squad request parser.
 *
 * The system prompt is designed to extract structured parameters from
 * natural language squad building requests in FC Online.
 * Supports both Korean and English input.
 */

import { TEAMS, LEAGUES } from '@/constants/teams';

// ---------------------------------------------------------------------------
// Team/league reference data for prompt context
// ---------------------------------------------------------------------------

/** Build a compact team/league reference string for the prompt */
function buildReferenceData(): string {
  const teamsByLeague = new Map<string, string[]>();
  for (const team of TEAMS) {
    const existing = teamsByLeague.get(team.league) ?? [];
    existing.push(`${team.name} (${team.nameKo})`);
    teamsByLeague.set(team.league, existing);
  }

  let ref = '## Available Leagues and Teams\n\n';
  for (const league of LEAGUES) {
    const teams = teamsByLeague.get(league.id) ?? [];
    ref += `### ${league.name} (${league.nameKo}) [ID: ${league.id}]\n`;
    ref += `Teams: ${teams.join(', ')}\n\n`;
  }
  return ref;
}

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

/**
 * The main system prompt for squad request parsing.
 * Instructs the AI to act as a FC Online squad analysis expert and
 * extract structured JSON from natural language input.
 */
export function buildSystemPrompt(): string {
  const referenceData = buildReferenceData();

  return `You are an expert FC Online (FIFA Online) squad building assistant. Your task is to analyze a user's natural language squad request and extract structured parameters for squad generation.

You MUST respond with ONLY a valid JSON object — no markdown, no explanation, no code fences. Just raw JSON.

## Supported Languages
- English (e.g., "Build me a cheap EPL squad")
- Korean (e.g., "프리미어리그 500만 이하 스쿼드 만들어줘")
- Mixed (e.g., "4-3-3 포메이션으로 맨시티 위주로 짜줘")

## Output Schema

\`\`\`
{
  "formation": "<Formation | null>",
  "budget": {
    "max": <number | null>,
    "min": <number | null>,
    "strictness": "<strict | flexible | none>"
  } | null,
  "teams": [
    { "name": "<team name>", "strength": "<required | preferred | optional>" }
  ] | null,
  "leagues": [
    { "league": "<league ID>", "strength": "<required | preferred | optional>" }
  ] | null,
  "nationalities": [
    { "nationality": "<nationality>", "strength": "<required | preferred | optional>" }
  ] | null,
  "players": [
    { "name": "<player name>", "required": <boolean>, "cardTypePreference": "<optional card type>" }
  ] | null,
  "excludedTeams": ["<team name>"] | null,
  "minOvr": <number | null>,
  "maxOvr": <number | null>,
  "statPriorities": ["<stat>"] | null,
  "playstyle": "<playstyle | null>",
  "chemistry": {
    "priority": "<low | medium | high | max>",
    "sameTeamLinks": <boolean>,
    "sameLeagueLinks": <boolean>,
    "sameNationalityLinks": <boolean>,
    "minChemistryScore": <number | null>
  } | null,
  "cardTypes": ["<card type>"] | null,
  "positionPreferences": [
    {
      "position": "<position>",
      "minStats": { "<stat>": <number> },
      "preferredPlayers": ["<name>"],
      "description": "<what user wants at this position>"
    }
  ] | null,
  "additionalConstraints": ["<constraint>"] | null,
  "confidence": <0.0 to 1.0>,
  "warnings": ["<warning message>"] | null
}
\`\`\`

## Valid Values

### Formations
4-4-2, 4-3-3, 3-5-2, 4-2-3-1, 4-1-4-1, 3-4-3, 4-5-1, 5-3-2, 5-4-1, 4-3-2-1, 4-4-1-1, 3-4-1-2

### Positions
ST, CF, LF, RF, LW, RW, CAM, CM, CDM, LM, RM, LB, RB, CB, LWB, RWB, GK

### Stats
pace, shooting, passing, dribbling, defending, physical

### Playstyles
attacking, defensive, balanced, possession, counter-attack, high-press, park-the-bus

### Card Types
BASE, SPECIAL, ICON, LIVE, MOM, POTW

## Parsing Rules

1. **Budget**: Parse amounts like "500k", "1M", "500만", "1000 BP". Convert to numeric values. "Cheap" = ~500k, "Budget" = ~1M, "Expensive" = 5M+, "Unlimited" = no limit.
2. **Teams/Leagues**: Match to the reference data below. Use the official English team/league name. Accept common abbreviations and Korean names.
3. **Nationalities**: Extract from context (e.g., "Korean players", "Brazilian squad", "영국 선수").
4. **Formation**: Recognize numeric patterns (4-3-3) and common formation names (e.g., "diamond" = 4-1-2-1-2 which maps to 4-4-1-1, "Christmas tree" = 4-3-2-1).
5. **Chemistry**: "Chem links", "same team", "full chem", "팀켐", "리그켐" map to chemistry preferences.
6. **Stat priorities**: "Fast players" = pace priority, "good shooters" = shooting priority, etc.
7. **Playstyle**: "Defensive" = defensive, "tiki-taka" = possession, "park the bus" = park-the-bus, etc.
8. **Only include fields** the user actually mentioned. Leave unmentioned fields as null.
9. **Confidence**: 0.0-1.0 based on how clear and unambiguous the request is. Lower confidence for vague or contradictory requests.
10. **Warnings**: Add warnings for ambiguous inputs, contradictions, or impossible constraints.
11. **Korean input**: Korean team names (맨시티=Manchester City, 바르셀로나=FC Barcelona, etc.) should be resolved to official English names.

${referenceData}`;
}

// ---------------------------------------------------------------------------
// User Prompt Template
// ---------------------------------------------------------------------------

/**
 * Wraps the user's natural language input with context for the AI.
 */
export function buildUserPrompt(userInput: string): string {
  return `Parse this squad building request into structured parameters:

"${userInput}"

Remember: Respond with ONLY valid JSON. No markdown, no code fences, no explanation.`;
}

// ---------------------------------------------------------------------------
// Multi-Candidate System Prompt (3 distinct squad suggestions)
// ---------------------------------------------------------------------------

/**
 * System prompt for generating 3 distinct squad candidate specifications
 * from a single user request. Each candidate should differ in formation,
 * player selection strategy, or playstyle.
 */
export function buildMultiCandidateSystemPrompt(): string {
  const referenceData = buildReferenceData();

  return `You are an expert FC Online (FIFA Online) squad building assistant. Your task is to analyze a user's natural language squad request and generate exactly 3 DISTINCT squad candidate specifications.

Each candidate must differ meaningfully from the others — use different formations, playstyles, team focuses, or player selection strategies. For example, if the user wants an EPL squad, suggest:
- Candidate 1: A balanced 4-3-3 with strong chemistry links
- Candidate 2: An attacking 3-4-3 with pace-focused wingers
- Candidate 3: A defensive 4-5-1 with a solid midfield

You MUST respond with ONLY a valid JSON object — no markdown, no explanation, no code fences. Just raw JSON.

## Output Schema

\`\`\`
{
  "candidates": [
    {
      "strategy": "<Short description of this candidate's approach>",
      "formation": "<Formation | null>",
      "budget": {
        "max": <number | null>,
        "min": <number | null>,
        "strictness": "<strict | flexible | none>"
      } | null,
      "teams": [
        { "name": "<team name>", "strength": "<required | preferred | optional>" }
      ] | null,
      "leagues": [
        { "league": "<league ID>", "strength": "<required | preferred | optional>" }
      ] | null,
      "nationalities": [
        { "nationality": "<nationality>", "strength": "<required | preferred | optional>" }
      ] | null,
      "players": [
        { "name": "<player name>", "required": <boolean>, "cardTypePreference": "<optional card type>" }
      ] | null,
      "excludedTeams": ["<team name>"] | null,
      "minOvr": <number | null>,
      "maxOvr": <number | null>,
      "statPriorities": ["<stat>"] | null,
      "playstyle": "<playstyle | null>",
      "chemistry": {
        "priority": "<low | medium | high | max>",
        "sameTeamLinks": <boolean>,
        "sameLeagueLinks": <boolean>,
        "sameNationalityLinks": <boolean>,
        "minChemistryScore": <number | null>
      } | null,
      "cardTypes": ["<card type>"] | null,
      "positionPreferences": [
        {
          "position": "<position>",
          "minStats": { "<stat>": <number> },
          "preferredPlayers": ["<name>"],
          "description": "<what user wants at this position>"
        }
      ] | null,
      "additionalConstraints": ["<constraint>"] | null,
      "confidence": <0.0 to 1.0>,
      "warnings": ["<warning message>"] | null
    },
    // ... exactly 3 candidates total
  ]
}
\`\`\`

## Critical Rules for Diversity

1. **All 3 candidates must be meaningfully different**. Do NOT return 3 identical specs.
2. **Vary formations** when possible (e.g., 4-3-3, 3-5-2, 4-2-3-1).
3. **Vary playstyles** (e.g., balanced, attacking, defensive).
4. **Vary stat priorities** based on the playstyle (e.g., pace+shooting vs defending+physical).
5. **Preserve user constraints** across all candidates — budget, required teams, required players must be respected.
6. **Each candidate gets its own confidence score** based on how well it matches the user's request.
7. **The "strategy" field** must be a concise, descriptive summary (1-2 sentences) explaining why this candidate is a good fit.

## Candidate Strategy Guidelines

- **Candidate 1** should be the "best match" — closest to what the user explicitly asked for.
- **Candidate 2** should be an "alternative approach" — different formation or playstyle, still respecting constraints.
- **Candidate 3** should be a "creative option" — might use a less obvious formation or focus on different player attributes, but still meets budget and core requirements.

${referenceData}`;
}

// ---------------------------------------------------------------------------
// Multi-Candidate User Prompt Template
// ---------------------------------------------------------------------------

/**
 * Wraps user input for multi-candidate squad generation.
 */
export function buildMultiCandidateUserPrompt(userInput: string): string {
  return `Analyze this squad building request and generate exactly 3 distinct squad candidate specifications:

"${userInput}"

Remember: Respond with ONLY valid JSON containing a "candidates" array with exactly 3 objects. Each candidate must have a different approach (formation, playstyle, or strategy). No markdown, no code fences, no explanation.`;
}

// ---------------------------------------------------------------------------
// Multi-Candidate Retry Prompt
// ---------------------------------------------------------------------------

/**
 * Prompt used when the multi-candidate parse result fails validation.
 */
export function buildMultiCandidateRetryPrompt(
  userInput: string,
  validationResult: { errors: string[]; raw: string },
): string {
  return `Your previous response was invalid. Please fix the following errors and try again.

## Original Request
"${userInput}"

## Errors Found
${validationResult.errors.map((e) => `- ${e}`).join('\n')}

## Your Previous Response
${validationResult.raw}

Respond with ONLY valid JSON. The response must have a "candidates" array with exactly 3 objects. Each must have a "strategy" string and "confidence" number. Fix the errors listed above.`;
}

// ---------------------------------------------------------------------------
// Validation / Retry Prompt (single candidate, preserved for backward compat)
// ---------------------------------------------------------------------------

/**
 * Prompt used when the initial parse result fails validation.
 * Includes the problematic output and specific validation errors.
 */
export function buildRetryPrompt(
  userInput: string,
  validationResult: { errors: string[]; raw: string },
): string {
  return `Your previous response was invalid. Please fix the following errors and try again.

## Original Request
"${userInput}"

## Errors Found
${validationResult.errors.map((e) => `- ${e}`).join('\n')}

## Your Previous Response
${validationResult.raw}

Respond with ONLY valid JSON. Fix the errors listed above.`;
}

// ---------------------------------------------------------------------------
// Fallback: Rule-based extraction prompt (no AI)
// ---------------------------------------------------------------------------

/**
 * Build a fallback prompt hint for the regex-based parser.
 * This is used internally and NOT sent to any AI.
 */
export function getBudgetHintPatterns(): RegExp[] {
  return [
    // "500k", "500K", "500,000"
    /(\d{1,3}[,.]?\d{0,3})\s*[kK]/,
    // "1M", "1m", "1.5M"
    /(\d{1,2}[.,]\d)\s*[mM]/,
    /(\d+)\s*[mM]/,
    // "500000", "500,000"
    /(\d{1,3}(?:,\d{3})+)/,
    // "500만", "10억"
    /(\d+)\s*만/,
    /(\d+)\s*억/,
  ];
}
