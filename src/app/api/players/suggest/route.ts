import { NextRequest, NextResponse } from 'next/server';
import { playerStore } from '@/lib/player-store';

// ---------------------------------------------------------------------------
// GET /api/players/suggest — Autocomplete suggestions
// ---------------------------------------------------------------------------
//
// Query Parameters:
//   q      — Search query (required, Korean or English)
//   limit  — Max suggestions to return (1–20, default 8)
//
// Response:
//   Player[] — Deduplicated suggestions sorted by relevance.
//   Only one season variant per player (pid) is returned.
//
// This is a lightweight endpoint designed for typeahead/autocomplete.
// ---------------------------------------------------------------------------

const MAX_QUERY_LENGTH = 50;
const MAX_LIMIT = 20;
const DEFAULT_LIMIT = 8;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const rawQuery = searchParams.get('q') ?? '';
  const query = rawQuery.slice(0, MAX_QUERY_LENGTH).trim();

  if (!query) {
    return NextResponse.json([]);
  }

  const rawLimit = searchParams.get('limit');
  const limit = rawLimit ? Math.min(Math.max(Number(rawLimit), 1), MAX_LIMIT) : DEFAULT_LIMIT;

  const suggestions = playerStore.suggestPlayers(query, limit);

  return NextResponse.json(suggestions);
}
