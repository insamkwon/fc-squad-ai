import { NextRequest, NextResponse } from 'next/server';
import { playerStore } from '@/lib/player-store';

export async function POST(request: NextRequest) {
  let body: { spids: number[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { spids } = body;

  if (!Array.isArray(spids) || spids.length === 0 || spids.length > 3) {
    return NextResponse.json(
      { error: 'spids must be an array of 1-3 player spids' },
      { status: 400 },
    );
  }

  const players = spids
    .map((spid) => playerStore.getPlayerBySpid(spid))
    .filter((p): p is NonNullable<typeof p> => p !== undefined);

  if (players.length !== spids.length) {
    const found = new Set(players.map((p) => p.spid));
    const missing = spids.filter((s) => !found.has(s));
    return NextResponse.json(
      { error: `Players not found for spids: ${missing.join(', ')}` },
      { status: 404 },
    );
  }

  // Attach stat radar data (6-key array: pace, shooting, passing, dribbling, defending, physical)
  const compareItems = players.map((player) => ({
    player,
    statRadar: [
      player.stats.pace,
      player.stats.shooting,
      player.stats.passing,
      player.stats.dribbling,
      player.stats.defending,
      player.stats.physical,
    ],
  }));

  return NextResponse.json(compareItems);
}
