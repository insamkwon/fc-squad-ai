/**
 * POST /api/chat
 *
 * Streaming chat endpoint that orchestrates the NL parsing → squad generation
 * pipeline and streams progress events back to the client via Server-Sent
 * Events (SSE).
 *
 * Event types emitted:
 *   - `parsing`   — NL parsing has started (with input preview)
 *   - `parsed`    — NL parsing complete (parsed request metadata)
 *   - `generating` — squad generation has started (candidate count)
 *   - `candidate`  — a single squad candidate is ready (index + data)
 *   - `complete`   — all candidates are ready (summary stats)
 *   - `warning`    — non-critical warning (e.g. fallback parser used)
 *   - `error`      — a critical error occurred (pipeline aborted)
 *
 * Request body:
 *   {
 *     message: string,          // natural language input (required)
 *     formation?: Formation,    // optional override formation
 *     pinnedPlayers?: number[]  // optional pinned player spids
 *   }
 */

import { NextRequest } from 'next/server';
import { playerStore } from '@/lib/player-store';
import { Player, Formation } from '@/types';
import { generateSquads, type GenerationStrategy } from '@/lib/squad-generator';
import { parseMultiSquadRequest } from '@/lib/ai/squad-parser';
import type { ParsedSquadRequest, SquadCandidateSpec } from '@/lib/ai/types';
import { FORMATIONS } from '@/types/squad';
import type { SquadCandidate } from '@/types/squad';
import { applySquadDefaults, DEFAULT_FORMATION } from '@/constants/squad-defaults';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChatRequestBody {
  message: string;
  formation?: Formation;
  pinnedPlayers?: number[];
}

/** Discriminated union of all SSE event payloads */
type ChatEvent =
  | { type: 'parsing'; input: string }
  | { type: 'parsed'; method: 'gemini' | 'fallback'; confidence: number; formation?: string; warnings?: string[] }
  | { type: 'generating'; candidateCount: number }
  | { type: 'candidate'; index: number; candidate: SquadCandidate }
  | { type: 'complete'; totalCandidates: number; totalTimeMs: number; warnings?: string[] }
  | { type: 'warning'; message: string }
  | { type: 'error'; code: string; message: string; details?: string };

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  // -- Parse request body ---------------------------------------------------
  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return errorResponse('INVALID_JSON', '요청 본문이 올바른 JSON이 아닙니다.', 400);
  }

  const { message, formation: requestedFormation, pinnedPlayers: pinnedSpids } = body;

  // -- Validate required fields ---------------------------------------------
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return errorResponse('EMPTY_MESSAGE', '메시지를 입력해주세요.', 400);
  }

  if (message.trim().length > 500) {
    return errorResponse('MESSAGE_TOO_LONG', '메시지는 500자 이내로 입력해주세요.', 400);
  }

  const userMessage = message.trim();

  // Validate optional formation
  if (requestedFormation && !FORMATIONS.includes(requestedFormation)) {
    return errorResponse(
      'INVALID_FORMATION',
      `올바르지 않은 포메이션입니다. 가능한 포메이션: ${FORMATIONS.join(', ')}`,
      400,
    );
  }

  // Resolve pinned players (max 3)
  const pinned = resolvePinnedPlayers(pinnedSpids);

  // -- Start streaming response ----------------------------------------------
  const encoder = new TextEncoder();
  const startTime = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: ChatEvent) => {
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        } catch {
          // Stream may have been closed by client — silently ignore
        }
      };

      try {
        // ---- Stage 1: Parsing ---------------------------------------------
        send({ type: 'parsing', input: userMessage });

        const parseResult = await parseMultiSquadRequest(userMessage);
        const parseTimeMs = Date.now() - startTime;

        // Emit warnings from parsing
        const allWarnings: string[] = [];
        if (parseResult.method === 'fallback') {
          const msg = 'AI 모델을 사용할 수 없어 규칙 기반 파서를 사용합니다. 더 나은 결과를 위해 API 키를 설정해주세요.';
          allWarnings.push(msg);
          send({ type: 'warning', message: msg });
        }

        // Emit parsed event — use DEFAULT_FORMATION constant for the fallback
        const mainFormation = requestedFormation ?? parseResult.candidates[0]?.formation ?? DEFAULT_FORMATION;
        const mainConfidence = parseResult.candidates.reduce(
          (acc, c) => acc + (c.confidence ?? 0),
          0,
        ) / Math.max(parseResult.candidates.length, 1);

        send({
          type: 'parsed',
          method: parseResult.method,
          confidence: Math.round(mainConfidence * 100) / 100,
          formation: mainFormation,
          warnings: parseResult.candidates.flatMap((c) => c.warnings ?? []),
        });

        // ---- Stage 2: Squad Generation ------------------------------------
        const allPlayers = playerStore.getAllPlayers();

        if (parseResult.success && parseResult.candidates.length > 0) {
          const candidateCount = Math.min(3, parseResult.candidates.length);
          send({ type: 'generating', candidateCount });

          const finalCandidates: SquadCandidate[] = [];

          for (let i = 0; i < candidateCount; i++) {
            const spec = parseResult.candidates[i];

            // Apply pipeline defaults for any fields that remain unresolved
            const { request: enriched } = applySquadDefaults(spec, {
              formation: mainFormation,
            });

            // Map playstyle to generation strategy
            const playstyleStrategy = mapPlaystyleToStrategy(spec.playstyle);

            const { candidates: genCandidates, warnings: specWarnings } = generateSquads(
              enriched,
              allPlayers,
              {
                count: 1,
                strategies: [playstyleStrategy],
                pinnedSpids: pinned?.map((p) => p.spid),
              },
            );

            if (genCandidates.length > 0) {
              const candidate: SquadCandidate = {
                ...genCandidates[0],
                reasoning: spec.strategy || genCandidates[0].reasoning,
                score: Math.round((spec.confidence ?? 0.5) * genCandidates[0].score),
              };
              finalCandidates.push(candidate);

              // Stream each candidate as it's ready
              send({ type: 'candidate', index: i, candidate });
            }

            if (specWarnings.length > 0) {
              for (const w of specWarnings) {
                send({ type: 'warning', message: w });
                allWarnings.push(w);
              }
            }
          }

          // Pad to 3 candidates if AI returned fewer
          while (finalCandidates.length < 3) {
            const { request: fallback } = applySquadDefaults({
              formation: mainFormation,
              confidence: 0.5,
            });
            const { candidates: fallbackCandidates } = generateSquads(fallback, allPlayers, {
              count: 1,
              strategies: ['balanced'],
              pinnedSpids: pinned?.map((p) => p.spid),
            });
            if (fallbackCandidates.length > 0) {
              const idx = finalCandidates.length;
              finalCandidates.push(fallbackCandidates[0]);
              send({ type: 'candidate', index: idx, candidate: fallbackCandidates[0] });
            } else {
              break; // No more players available
            }
          }

          // Add pinned player reasoning
          if (pinned && pinned.length > 0) {
            const pinnedNames = pinned.map((p) => p.name).join(', ');
            allWarnings.push(`${pinnedNames} 선수가 고정으로 포함되었습니다.`);
          }

          const totalTimeMs = Date.now() - startTime;
          send({
            type: 'complete',
            totalCandidates: finalCandidates.length,
            totalTimeMs,
            warnings: allWarnings.length > 0 ? allWarnings : undefined,
          });
        } else {
          // Parsing failed — generate fallback squads with defaults applied
          send({ type: 'generating', candidateCount: 3 });

          const { request: fallbackParsed } = applySquadDefaults({
            formation: mainFormation,
            confidence: 0.3,
          });

          if (parseResult.error) {
            allWarnings.push(`파싱 오류: ${parseResult.error}`);
          }

          const { candidates, warnings } = generateSquads(fallbackParsed, allPlayers, {
            count: 3,
            strategies: ['chemistry', 'ovr', 'value'],
            pinnedSpids: pinned?.map((p) => p.spid),
          });

          if (warnings.length > 0) {
            allWarnings.push(...warnings);
          }

          for (let i = 0; i < candidates.length; i++) {
            send({ type: 'candidate', index: i, candidate: candidates[i] });
          }

          const totalTimeMs = Date.now() - startTime;
          send({
            type: 'complete',
            totalCandidates: candidates.length,
            totalTimeMs,
            warnings: allWarnings.length > 0 ? allWarnings : undefined,
          });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
        send({
          type: 'error',
          code: 'PIPELINE_ERROR',
          message: '스쿼드 생성 중 오류가 발생했습니다.',
          details: errorMessage,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering (Vercel/proxy)
    },
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
      return 'ovr';
    case 'defensive':
    case 'park-the-bus':
      return 'chemistry';
    case 'possession':
      return 'chemistry';
    case 'high-press':
      return 'balanced';
    case 'balanced':
    default:
      return 'balanced';
  }
}

/**
 * Resolve pinned player SPIDs to full Player objects.
 */
function resolvePinnedPlayers(pinnedSpids: unknown): Player[] | undefined {
  if (!pinnedSpids || !Array.isArray(pinnedSpids) || pinnedSpids.length === 0) {
    return undefined;
  }
  const allPlayers = playerStore.getAllPlayers();
  const pinned = pinnedSpids
    .map((spid: number) => allPlayers.find((p: Player) => p.spid === spid))
    .filter((p): p is Player => p !== undefined);
  if (pinned.length > 3) return pinned.slice(0, 3);
  return pinned.length > 0 ? pinned : undefined;
}

/**
 * Return a JSON error response for validation / client errors (non-streaming).
 */
function errorResponse(code: string, message: string, status: number) {
  return new Response(
    JSON.stringify({ error: { code, message } }),
    {
      status,
      headers: { 'Content-Type': 'application/json' },
    },
  );
}
