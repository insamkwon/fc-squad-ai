import { NextRequest, NextResponse } from 'next/server';
import { playerStore } from '@/lib/player-store';
import { Position, POSITION_CATEGORIES, CARD_TYPES, CardType } from '@/types/player';

// ---------------------------------------------------------------------------
// GET /api/players — Search & filter players
// ---------------------------------------------------------------------------
//
// Query Parameters:
//   search      — Free-text query (Korean or English name, team name)
//   positions   — Comma-separated position filter (e.g. "ST,CF" or "FW")
//   teamId      — Numeric team ID filter
//   seasonId    — Numeric season ID filter
//   cardType    — Card type filter (BASE|SPECIAL|ICON|LIVE|MOM|POTW)
//   seasonYear  — Season year filter (e.g. "24/25")
//   minOvr      — Minimum OVR
//   maxOvr      — Maximum OVR
//   minPrice    — Minimum price (raw number, in BP)
//   maxPrice    — Maximum price (raw number, in BP)
//   minPace     — Minimum pace stat
//   maxPace     — Maximum pace stat
//   minShooting — Minimum shooting stat
//   maxShooting — Maximum shooting stat
//   minPassing  — Minimum passing stat
//   maxPassing  — Maximum passing stat
//   minDribbling — Minimum dribbling stat
//   maxDribbling — Maximum dribbling stat
//   minDefending — Minimum defending stat
//   maxDefending — Maximum defending stat
//   minPhysical — Minimum physical stat
//   maxPhysical — Maximum physical stat
//   limit       — Results per page (1–100, default 20)
//   offset      — Pagination offset (default 0)
//
// Response:
//   { results: Player[], total: number, limit: number, offset: number }
//
// When `search` is provided, uses the advanced bilingual search engine
// with relevance scoring. Otherwise, uses simple filter-only mode.
// ---------------------------------------------------------------------------

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 20;
const MAX_SEARCH_LENGTH = 100;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // --- Parse text search query ---
  const rawSearch = searchParams.get('search') ?? '';
  const search = rawSearch.slice(0, MAX_SEARCH_LENGTH).trim();

  // --- Parse pagination ---
  const rawLimit = searchParams.get('limit');
  const rawOffset = searchParams.get('offset');
  const limit = rawLimit ? Math.min(Math.max(Number(rawLimit), 1), MAX_LIMIT) : DEFAULT_LIMIT;
  const offset = rawOffset ? Math.max(Number(rawOffset), 0) : 0;

  // --- Parse position filter ---
  const rawPositions = searchParams.get('positions') ?? '';
  const positions: Position[] = rawPositions
    ? rawPositions
        .split(',')
        .map((s) => s.trim().toUpperCase() as Position)
        .filter((s) => {
          if (s in POSITION_CATEGORIES) return true;
          return ['ST','CF','LF','RF','LW','RW','CAM','CM','CDM','LM','RM','LB','RB','CB','LWB','RWB','GK'].includes(s);
        })
    : [];

  // --- Parse card type ---
  const rawCardType = searchParams.get('cardType');
  const cardType: CardType | undefined = rawCardType
    ? CARD_TYPES.includes(rawCardType.toUpperCase() as CardType)
      ? (rawCardType.toUpperCase() as CardType)
      : undefined
    : undefined;

  // --- Parse numeric filters (with validation) ---
  const parseNum = (val: string | null): number | undefined => {
    if (!val) return undefined;
    const n = Number(val);
    return Number.isFinite(n) ? n : undefined;
  };

  const teamId = parseNum(searchParams.get('teamId'));
  const seasonId = parseNum(searchParams.get('seasonId'));
  const seasonSlug = searchParams.get('seasonSlug')?.trim() || undefined;
  const seasonYear = searchParams.get('seasonYear')?.trim() || undefined;
  const minOvr = parseNum(searchParams.get('minOvr'));
  const maxOvr = parseNum(searchParams.get('maxOvr'));
  const minPrice = parseNum(searchParams.get('minPrice'));
  const maxPrice = parseNum(searchParams.get('maxPrice'));
  const minPace = parseNum(searchParams.get('minPace'));
  const maxPace = parseNum(searchParams.get('maxPace'));
  const minShooting = parseNum(searchParams.get('minShooting'));
  const maxShooting = parseNum(searchParams.get('maxShooting'));
  const minPassing = parseNum(searchParams.get('minPassing'));
  const maxPassing = parseNum(searchParams.get('maxPassing'));
  const minDribbling = parseNum(searchParams.get('minDribbling'));
  const maxDribbling = parseNum(searchParams.get('maxDribbling'));
  const minDefending = parseNum(searchParams.get('minDefending'));
  const maxDefending = parseNum(searchParams.get('maxDefending'));
  const minPhysical = parseNum(searchParams.get('minPhysical'));
  const maxPhysical = parseNum(searchParams.get('maxPhysical'));

  // --- Use advanced search when a text query is provided ---
  if (search) {
    const result = playerStore.searchPlayersAdvanced(
      search,
      {
        positions,
        teamId,
        seasonId,
        seasonSlug,
        cardType,
        seasonYear,
        minOvr,
        maxOvr,
        minPrice,
        maxPrice,
        minPace,
        maxPace,
        minShooting,
        maxShooting,
        minPassing,
        maxPassing,
        minDribbling,
        maxDribbling,
        minDefending,
        maxDefending,
        minPhysical,
        maxPhysical,
      },
      { limit, offset },
    );

    return NextResponse.json(result);
  }

  // --- No search query: use the basic filter-only path ---
  const filter = {
    search: '',
    positions,
    teamId,
    seasonId,
    seasonSlug,
    cardType,
    seasonYear,
    minOvr,
    maxOvr,
    minPrice,
    maxPrice,
    minPace,
    maxPace,
    minShooting,
    maxShooting,
    minPassing,
    maxPassing,
    minDribbling,
    maxDribbling,
    minDefending,
    maxDefending,
    minPhysical,
    maxPhysical,
  };

  const allResults = playerStore.searchPlayers(filter);
  const pagedResults = allResults.slice(offset, offset + limit);

  return NextResponse.json({
    results: pagedResults,
    total: allResults.length,
    limit,
    offset,
  });
}
