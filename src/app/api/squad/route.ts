import { NextRequest, NextResponse } from 'next/server';
import { playerStore } from '@/lib/player-store';
import { Player, Position } from '@/types/player';
import { Formation } from '@/types/squad';
import { generateSquads, type GenerationStrategy } from '@/lib/squad-generator';
import { parseMultiSquadRequest } from '@/lib/ai/squad-parser';
import { analyzeMultiCandidateVagueInput, getQuickSuggestions } from '@/lib/ai/vague-detector';
import type { ParsedSquadRequest, SquadCandidateSpec } from '@/lib/ai/types';
import { applySquadDefaults } from '@/constants/squad-defaults';

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  let body: {
    formation: string;
    budget?: number;
    budgetMin?: number;
    budgetMax?: number;
    teamColor?: string;
    prompt?: string;
    pinnedPlayers?: number[];
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    formation: rawFormation,
    budget,
    budgetMin,
    budgetMax,
    teamColor,
    prompt,
    pinnedPlayers: pinnedSpids,
  } = body;

  // Resolve budget: budgetMin/budgetMax are in 억 units, convert to raw
  const resolvedBudgetMin = budgetMin != null ? Number(budgetMin) * 100_000_000 : undefined;
  const resolvedBudgetMax = budgetMax != null ? Number(budgetMax) * 100_000_000 : undefined;
  const resolvedBudget = budget ?? resolvedBudgetMax;

  // Validate pinned players (max 3)
  let pinned: Player[] | undefined;
  if (pinnedSpids && Array.isArray(pinnedSpids) && pinnedSpids.length > 0) {
    const allPlayersForPin = playerStore.getAllPlayers();
    pinned = pinnedSpids
      .map((spid: number) => allPlayersForPin.find((p: Player) => p.spid === spid))
      .filter((p): p is Player => p !== undefined);
    if (pinned.length > 3) pinned = pinned.slice(0, 3);
  }

  // Validate formation
  const allFormations: Formation[] = [
    '4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '4-1-4-1',
    '3-4-3', '4-5-1', '5-3-2', '5-4-1', '4-3-2-1',
    '4-4-1-1', '3-4-1-2',
  ];
  if (!rawFormation || !allFormations.includes(rawFormation as Formation)) {
    return NextResponse.json(
      { error: `Invalid formation. Must be one of: ${allFormations.join(', ')}` },
      { status: 400 },
    );
  }
  const formation = rawFormation as Formation;

  const allPlayers = playerStore.getAllPlayers();

  // ---------------------------------------------------------------------------
  // Path 1: AI prompt provided — use multi-candidate parser + generator
  // ---------------------------------------------------------------------------
  if (prompt && prompt.trim().length > 0) {
    try {
      const parseResult = await parseMultiSquadRequest(prompt.trim());

      if (parseResult.success && parseResult.candidates.length > 0) {
        const candidates = [];

        // Generate one squad per AI candidate spec
        for (let i = 0; i < Math.min(3, parseResult.candidates.length); i++) {
          const spec = parseResult.candidates[i];

          // Build enriched ParsedSquadRequest from the spec, merging AI
          // budget with user-provided budget, then apply pipeline defaults
          // for any fields that remain unresolved.
          const merged: ParsedSquadRequest = {
            ...spec,
            // Merge AI budget with user-provided budget
            budget: spec.budget
              ? { ...spec.budget, max: spec.budget.max ?? resolvedBudget }
              : resolvedBudget
                ? { max: resolvedBudget, min: resolvedBudgetMin, strictness: 'flexible' }
                : undefined,
          };
          const { request: enriched } = applySquadDefaults(merged, {
            formation,  // UI-selected formation as override
          });

          // Map playstyle to generation strategy for better results
          const playstyleStrategy = mapPlaystyleToStrategy(spec.playstyle);

          const { candidates: genCandidates, warnings: specWarnings } = generateSquads(
            enriched,
            allPlayers,
            {
              count: 1,
              strategies: [playstyleStrategy],
              pinnedSpids: pinnedSpids,
            },
          );

          if (genCandidates.length > 0) {
            const candidate = genCandidates[0];
            candidates.push({
              ...candidate,
              // Use the AI's strategy description for reasoning
              reasoning: spec.strategy || candidate.reasoning,
              score: Math.round(spec.confidence * candidate.score),
            });
          }

          if (specWarnings.length > 0) {
            console.warn(`[squad-generator] Warnings for candidate ${i}:`, specWarnings);
          }
        }

        // Pad to 3 candidates if AI returned fewer
        while (candidates.length < 3) {
          const i = candidates.length;
          const { request: fallback } = applySquadDefaults({
            formation,
            budget: resolvedBudget ? { max: resolvedBudget, min: resolvedBudgetMin, strictness: 'flexible' } : undefined,
            confidence: 0.5,
          });
          const { candidates: fallbackCandidates } = generateSquads(fallback, allPlayers, {
            count: 1,
            strategies: ['balanced'],
            pinnedSpids: pinnedSpids,
          });
          if (fallbackCandidates.length > 0) {
            candidates.push(fallbackCandidates[0]);
          }
        }

        // Analyze vague input for UI feedback
        const vagueAnalysis = analyzeMultiCandidateVagueInput(
          parseResult.candidates,
          prompt.trim(),
        );
        const quickSuggestions = getQuickSuggestions(vagueAnalysis, 'ko');

        return NextResponse.json({
          candidates,
          vagueAnalysis: vagueAnalysis.isVague ? vagueAnalysis : undefined,
          quickSuggestions: quickSuggestions.length > 0 ? quickSuggestions : undefined,
        });
      }
    } catch (error) {
      console.error('AI parsing failed, falling back to generator:', error);
    }
  }

  // ---------------------------------------------------------------------------
  // Path 2: No prompt — use generator directly with request params
  // ---------------------------------------------------------------------------

  // Build ParsedSquadRequest from basic request params
  const baseParsed: ParsedSquadRequest = {
    formation,
    confidence: 0.6,
  };

  // Budget (from request body, if provided)
  if (resolvedBudget) {
    baseParsed.budget = {
      max: resolvedBudget,
      min: resolvedBudgetMin,
      strictness: 'flexible',
    };
  }

  // Team preference from teamColor
  if (teamColor) {
    baseParsed.teams = [{ name: teamColor, strength: 'preferred' }];
  }

  // Apply pipeline defaults for any fields that remain unresolved
  const { request: parsed } = applySquadDefaults(baseParsed);

  const { candidates, warnings } = generateSquads(parsed, allPlayers, {
    count: 3,
    strategies: ['chemistry', 'ovr', 'value'],
    pinnedSpids: pinnedSpids,
  });

  // Enrich reasoning with pinned player info
  const enrichedCandidates = candidates.map((c) => ({
    ...c,
    reasoning: pinned && pinned.length > 0
      ? `${c.reasoning} with ${pinned.map((p) => p.name).join(', ')} pinned`
      : c.reasoning,
  }));

  return NextResponse.json({
    candidates: enrichedCandidates,
    warnings,
    vagueAnalysis: undefined,
    quickSuggestions: undefined,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a playstyle to the best matching generation strategy.
 */
function mapPlaystyleToStrategy(
  playstyle: ParsedSquadRequest['playstyle'],
): GenerationStrategy {
  switch (playstyle) {
    case 'attacking':
    case 'counter-attack':
      return 'ovr'; // Maximize individual quality
    case 'defensive':
    case 'park-the-bus':
      return 'chemistry'; // Team cohesion matters for defense
    case 'possession':
      return 'chemistry'; // Passing networks benefit from chemistry
    case 'high-press':
      return 'balanced';
    case 'balanced':
    default:
      return 'balanced';
  }
}
