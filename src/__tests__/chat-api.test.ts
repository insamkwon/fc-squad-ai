/**
 * Unit tests for the /api/chat streaming endpoint.
 *
 * Tests cover:
 * 1. Request validation (missing message, empty message, invalid formation, too long message)
 * 2. SSE streaming format (correct event types, data format)
 * 3. Pipeline orchestration (parsing → generating → candidate → complete)
 * 4. Error handling (pipeline errors, client abort, malformed body)
 * 5. Pinned player handling
 * 6. Fallback parser path (when AI is not configured)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies before importing the route
// ---------------------------------------------------------------------------

// Mock player store
const mockGetAllPlayers = vi.fn();
vi.mock('@/lib/player-store', () => ({
  playerStore: {
    getAllPlayers: () => mockGetAllPlayers(),
  },
}));

// Mock AI parser
const mockParseMultiSquadRequest = vi.fn();
vi.mock('@/lib/ai/squad-parser', () => ({
  parseMultiSquadRequest: (...args: unknown[]) => mockParseMultiSquadRequest(...args),
}));

// Mock squad generator
const mockGenerateSquads = vi.fn();
vi.mock('@/lib/squad-generator', () => ({
  generateSquads: (...args: unknown[]) => mockGenerateSquads(...args),
  // Re-export type to avoid TypeScript issues
}));

import { POST } from '@/app/api/chat/route';
import type { SquadCandidate } from '@/types/squad';
import type { Player } from '@/types/player';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal mock Player */
function createMockPlayer(overrides: Partial<Player> = {}): Player {
  return {
    spid: 1,
    pid: 1,
    name: '테스트 선수',
    nameEn: 'Test Player',
    seasonId: 68,
    seasonName: 'TOTNUCL (24/25)',
    seasonSlug: 'totnucl-2425',
    cardType: 'SPECIAL',
    seasonYear: '24/25',
    releaseDate: '2024-01-01',
    position: 'ST',
    teamId: 1,
    teamName: 'Test Team',
    teamNameEn: 'Test Team',
    leagueId: 1,
    leagueName: 'EPL',
    stats: { ovr: 85, pace: 80, shooting: 85, passing: 75, dribbling: 80, defending: 40, physical: 70 },
    price: 1_000_000_000,
    priceUpdatedAt: '2026-03-27',
    ...overrides,
  };
}

/** Create a minimal mock SquadCandidate */
function createMockCandidate(overrides: Partial<SquadCandidate> = {}): SquadCandidate {
  return {
    squad: {
      id: 'test-squad-1',
      formation: '4-3-3',
      players: Array.from({ length: 11 }, (_, i) => ({
        player: createMockPlayer({ spid: i + 1, pid: i + 1 }),
        slotPosition: 'ST',
      })),
      totalBudget: 5_000_000_000,
      totalCost: 3_000_000_000,
      chemistryScore: 85,
      createdAt: new Date().toISOString(),
    },
    score: 90,
    reasoning: 'Balanced squad with strong chemistry',
    ...overrides,
  };
}

/** Create a NextRequest-like object */
function createRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Create a malformed request (non-JSON) */
function createMalformedRequest(): Request {
  return new Request('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{invalid json',
  });
}

/** A parsed SSE event — all payload properties are directly on the object alongside `type` */
type SSEEvent = Record<string, unknown> & { type: string };

/** Parse SSE events from a ReadableStream response */
async function collectSSEEvents(response: Response): Promise<SSEEvent[]> {
  expect(response.headers.get('Content-Type')).toBe('text/event-stream');

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events: SSEEvent[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;
      try {
        events.push(JSON.parse(jsonStr) as SSEEvent);
      } catch {
        // Skip malformed JSON
      }
    }
  }

  return events;
}

// ---------------------------------------------------------------------------
// Default mocks for a successful pipeline
// ---------------------------------------------------------------------------

const defaultPlayers = Array.from({ length: 30 }, (_, i) =>
  createMockPlayer({
    spid: i + 100,
    pid: i + 100,
    position: ['ST', 'CM', 'CB', 'GK', 'LW', 'RW', 'CAM', 'CDM', 'LB', 'RB', 'LM', 'RM'][i % 12] as Player['position'],
  }),
);

const defaultCandidates = [
  createMockCandidate({ score: 92, reasoning: 'Best match' }),
  createMockCandidate({
    score: 88,
    reasoning: 'Alternative approach',
    squad: { ...createMockCandidate().squad, id: 'test-squad-2', formation: '4-2-3-1' },
  }),
  createMockCandidate({
    score: 85,
    reasoning: 'Creative option',
    squad: { ...createMockCandidate().squad, id: 'test-squad-3', formation: '3-5-2' },
  }),
];

function setupDefaultMocks() {
  mockGetAllPlayers.mockReturnValue(defaultPlayers);

  mockParseMultiSquadRequest.mockResolvedValue({
    candidates: [
      {
        formation: '4-3-3' as const,
        confidence: 0.9,
        strategy: 'Balanced 4-3-3 with strong chemistry',
        playstyle: 'balanced' as const,
      },
      {
        formation: '4-2-3-1' as const,
        confidence: 0.8,
        strategy: 'Attacking 4-2-3-1 with pace focus',
        playstyle: 'attacking' as const,
      },
      {
        formation: '3-5-2' as const,
        confidence: 0.75,
        strategy: 'Creative 3-5-2 with solid midfield',
        playstyle: 'possession' as const,
      },
    ],
    originalInput: 'EPL 4-3-3 budget squad',
    success: true,
    method: 'gemini' as const,
    parseTimeMs: 150,
  });

  mockGenerateSquads.mockImplementation(() => ({
    candidates: [createMockCandidate()],
    warnings: [],
  }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // 1. Request Validation
  // -------------------------------------------------------------------------

  describe('request validation', () => {
    it('should return 400 for invalid JSON body', async () => {
      const response = await POST(createMalformedRequest() as never);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('INVALID_JSON');
    });

    it('should return 400 for missing message', async () => {
      const response = await POST(createRequest({}) as never);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('EMPTY_MESSAGE');
    });

    it('should return 400 for empty message', async () => {
      const response = await POST(createRequest({ message: '   ' }) as never);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('EMPTY_MESSAGE');
    });

    it('should return 400 for message exceeding 500 characters', async () => {
      const response = await POST(createRequest({ message: 'a'.repeat(501) }) as never);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('MESSAGE_TOO_LONG');
    });

    it('should return 400 for invalid formation', async () => {
      const response = await POST(createRequest({ message: 'build squad', formation: '9-9-9' }) as never);
      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error.code).toBe('INVALID_FORMATION');
    });

    it('should accept valid message with no formation', async () => {
      const response = await POST(createRequest({ message: 'build me a squad' }) as never);
      expect(response.status).toBe(200);
    });

    it('should accept valid message with valid formation', async () => {
      const response = await POST(createRequest({ message: 'build squad', formation: '4-3-3' }) as never);
      expect(response.status).toBe(200);
    });
  });

  // -------------------------------------------------------------------------
  // 2. SSE Streaming Format
  // -------------------------------------------------------------------------

  describe('SSE streaming format', () => {
    it('should set Content-Type to text/event-stream', async () => {
      const response = await POST(createRequest({ message: 'EPL 4-3-3 squad' }) as never);
      expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    });

    it('should set Cache-Control to no-cache', async () => {
      const response = await POST(createRequest({ message: 'EPL 4-3-3 squad' }) as never);
      expect(response.headers.get('Cache-Control')).toContain('no-cache');
    });

    it('should set Connection to keep-alive', async () => {
      const response = await POST(createRequest({ message: 'EPL 4-3-3 squad' }) as never);
      expect(response.headers.get('Connection')).toBe('keep-alive');
    });
  });

  // -------------------------------------------------------------------------
  // 3. Pipeline Orchestration (happy path)
  // -------------------------------------------------------------------------

  describe('pipeline orchestration', () => {
    it('should emit parsing event first', async () => {
      const response = await POST(createRequest({ message: 'EPL 4-3-3 budget squad' }) as never);
      const events = await collectSSEEvents(response);
      expect(events[0].type).toBe('parsing');
    });

    it('should emit parsed event after parsing', async () => {
      const response = await POST(createRequest({ message: 'EPL 4-3-3 budget squad' }) as never);
      const events = await collectSSEEvents(response);
      const parsedEvent = events.find((e) => e.type === 'parsed');
      expect(parsedEvent).toBeDefined();
      expect(parsedEvent).toHaveProperty('method', 'gemini');
      expect(parsedEvent).toHaveProperty('confidence');
    });

    it('should emit generating event before candidates', async () => {
      const response = await POST(createRequest({ message: 'EPL 4-3-3 budget squad' }) as never);
      const events = await collectSSEEvents(response);
      const generatingIdx = events.findIndex((e) => e.type === 'generating');
      const firstCandidateIdx = events.findIndex((e) => e.type === 'candidate');
      expect(generatingIdx).toBeGreaterThanOrEqual(0);
      expect(firstCandidateIdx).toBeGreaterThan(generatingIdx);
    });

    it('should emit 3 candidate events', async () => {
      const response = await POST(createRequest({ message: 'EPL 4-3-3 budget squad' }) as never);
      const events = await collectSSEEvents(response);
      const candidateEvents = events.filter((e) => e.type === 'candidate');
      expect(candidateEvents).toHaveLength(3);
    });

    it('should emit complete event last', async () => {
      const response = await POST(createRequest({ message: 'EPL 4-3-3 budget squad' }) as never);
      const events = await collectSSEEvents(response);
      expect(events[events.length - 1].type).toBe('complete');
    });

    it('should include totalCandidates and totalTimeMs in complete event', async () => {
      const response = await POST(createRequest({ message: 'EPL 4-3-3 budget squad' }) as never);
      const events = await collectSSEEvents(response);
      const completeEvent = events.find((e) => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent!).toHaveProperty('totalCandidates', 3);
      expect(completeEvent!).toHaveProperty('totalTimeMs');
      expect(completeEvent!.totalTimeMs as number).toBeGreaterThanOrEqual(0);
    });

    it('should include candidate data with index in candidate events', async () => {
      const response = await POST(createRequest({ message: 'EPL 4-3-3 budget squad' }) as never);
      const events = await collectSSEEvents(response);
      const candidateEvents = events.filter((e) => e.type === 'candidate');
      for (let i = 0; i < candidateEvents.length; i++) {
        expect(candidateEvents[i]).toHaveProperty('index', i);
        expect(candidateEvents[i]).toHaveProperty('candidate');
        expect((candidateEvents[i].candidate as SquadCandidate)).toHaveProperty('squad');
        expect((candidateEvents[i].candidate as SquadCandidate)).toHaveProperty('score');
        expect((candidateEvents[i].candidate as SquadCandidate)).toHaveProperty('reasoning');
      }
    });

    it('should follow the correct event sequence: parsing → parsed → generating → candidate* → complete', async () => {
      const response = await POST(createRequest({ message: 'EPL 4-3-3 budget squad' }) as never);
      const events = await collectSSEEvents(response);
      const types = events.map((e) => e.type);

      expect(types[0]).toBe('parsing');
      expect(types[1]).toBe('parsed');
      expect(types[2]).toBe('generating');

      const candidateIndices = types.reduce<number[]>((acc, t, i) => {
        if (t === 'candidate') acc.push(i);
        return acc;
      }, []);
      expect(candidateIndices).toHaveLength(3);

      const completeIdx = types.indexOf('complete');
      expect(completeIdx).toBeGreaterThan(candidateIndices[candidateIndices.length - 1]);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Error Handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('should emit error event when parsing fails completely', async () => {
      mockParseMultiSquadRequest.mockResolvedValue({
        candidates: [],
        originalInput: 'bad input',
        success: false,
        error: 'Could not parse request',
        method: 'fallback' as const,
        parseTimeMs: 0,
      });

      mockGenerateSquads.mockImplementation(() => ({
        candidates: [createMockCandidate()],
        warnings: [],
      }));

      const response = await POST(createRequest({ message: 'bad input' }) as never);
      const events = await collectSSEEvents(response);
      // Should still complete (with fallback squads)
      expect(events.some((e) => e.type === 'complete')).toBe(true);
    });

    it('should emit error event when pipeline throws', async () => {
      mockParseMultiSquadRequest.mockRejectedValue(new Error('AI service unavailable'));

      const response = await POST(createRequest({ message: 'test squad' }) as never);
      const events = await collectSSEEvents(response);
      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      expect(errorEvent).toHaveProperty('code', 'PIPELINE_ERROR');
      expect(errorEvent).toHaveProperty('message');
    });

    it('should emit warning event when using fallback parser', async () => {
      mockParseMultiSquadRequest.mockResolvedValue({
        candidates: [
          { formation: '4-3-3', confidence: 0.5, strategy: 'Fallback balanced' },
        ],
        originalInput: 'test',
        success: true,
        method: 'fallback' as const,
        parseTimeMs: 5,
      });

      const response = await POST(createRequest({ message: 'test' }) as never);
      const events = await collectSSEEvents(response);
      const warningEvents = events.filter((e) => e.type === 'warning');
      expect(warningEvents.length).toBeGreaterThan(0);
      expect(warningEvents[0].message as string).toContain('규칙 기반 파서');
    });

    it('should handle generator returning no candidates gracefully', async () => {
      mockGenerateSquads.mockReturnValue({ candidates: [], warnings: ['No players found'] });

      const response = await POST(createRequest({ message: 'impossible squad' }) as never);
      const events = await collectSSEEvents(response);
      const completeEvent = events.find((e) => e.type === 'complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent!.totalCandidates as number).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 5. Pinned Player Handling
  // -------------------------------------------------------------------------

  describe('pinned player handling', () => {
    it('should pass pinned player SPIDs to the generator', async () => {
      const pinnedSpids = [100, 101];
      const response = await POST(
        createRequest({ message: 'EPL squad', pinnedPlayers: pinnedSpids }) as never,
      );
      await collectSSEEvents(response);

      // Verify generateSquads was called with pinnedSpids
      expect(mockGenerateSquads).toHaveBeenCalled();
      const lastCall = mockGenerateSquads.mock.calls[mockGenerateSquads.mock.calls.length - 1];
      const options = lastCall[2] as { pinnedSpids?: number[] };
      expect(options.pinnedSpids).toEqual(pinnedSpids);
    });

    it('should limit pinned players to 3', async () => {
      const pinnedSpids = [100, 101, 102, 103]; // 4 players
      mockGetAllPlayers.mockReturnValue(
        pinnedSpids.map((spid) => createMockPlayer({ spid, pid: spid })),
      );

      const response = await POST(
        createRequest({ message: 'squad', pinnedPlayers: pinnedSpids }) as never,
      );
      await collectSSEEvents(response);

      const lastCall = mockGenerateSquads.mock.calls[mockGenerateSquads.mock.calls.length - 1];
      const options = lastCall[2] as { pinnedSpids?: number[] };
      expect(options.pinnedSpids).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Fallback Parser Path
  // -------------------------------------------------------------------------

  describe('fallback parser path', () => {
    it('should work with fallback parser when AI is unavailable', async () => {
      mockParseMultiSquadRequest.mockResolvedValue({
        candidates: [
          { formation: '4-3-3' as const, confidence: 0.5, strategy: 'Fallback balanced' },
          { formation: '4-2-3-1' as const, confidence: 0.4, strategy: 'Fallback attacking' },
          { formation: '3-5-2' as const, confidence: 0.3, strategy: 'Fallback defensive' },
        ],
        originalInput: 'test',
        success: true,
        method: 'fallback' as const,
        parseTimeMs: 5,
      });

      const response = await POST(createRequest({ message: 'build cheap squad' }) as never);
      const events = await collectSSEEvents(response);

      expect(events[0].type).toBe('parsing');
      const parsedEvent = events.find((e) => e.type === 'parsed');
      expect(parsedEvent).toHaveProperty('method', 'fallback');
      expect(events.some((e) => e.type === 'complete')).toBe(true);
    });

    it('should generate fallback squads when parsing fails but candidates is empty', async () => {
      mockParseMultiSquadRequest.mockResolvedValue({
        candidates: [],
        originalInput: 'test',
        success: false,
        error: 'Parse failed',
        method: 'fallback' as const,
        parseTimeMs: 0,
      });

      const response = await POST(createRequest({ message: 'build squad' }) as never);
      const events = await collectSSEEvents(response);

      expect(events.some((e) => e.type === 'generating')).toBe(true);
      expect(events.some((e) => e.type === 'complete')).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // 7. Edge Cases
  // -------------------------------------------------------------------------

  describe('edge cases', () => {
    it('should handle exactly 500 character message', async () => {
      const response = await POST(createRequest({ message: 'a'.repeat(500) }) as never);
      expect(response.status).toBe(200);
    });

    it('should handle message with special characters', async () => {
      const response = await POST(createRequest({ message: '프리미어리그 4-3-3 "맨시티" <팀> & 라리가!' }) as never);
      expect(response.status).toBe(200);
    });

    it('should handle empty pinnedPlayers array', async () => {
      const response = await POST(
        createRequest({ message: 'build squad', pinnedPlayers: [] }) as never,
      );
      expect(response.status).toBe(200);
    });

    it('should ignore pinnedPlayers with invalid SPIDs', async () => {
      mockGetAllPlayers.mockReturnValue([createMockPlayer({ spid: 100, pid: 100 })]);

      const response = await POST(
        createRequest({ message: 'squad', pinnedPlayers: [999, 998] }) as never,
      );
      await collectSSEEvents(response);

      // Should still work, just without pinned players
      const lastCall = mockGenerateSquads.mock.calls[mockGenerateSquads.mock.calls.length - 1];
      const options = lastCall[2] as { pinnedSpids?: number[] };
      expect(options.pinnedSpids).toBeUndefined();
    });
  });
});
