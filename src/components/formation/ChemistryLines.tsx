'use client';

import { useMemo, useState, useId, useCallback } from 'react';
import type { FormationSlot, SquadPlayer } from '@/types/squad';
import {
  buildChemistryEdges,
  slotToSvgCoord,
  getControlPoint,
  STROKE,
  COLOR,
  DOT_RADIUS,
} from '@/lib/chemistry-lines';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChemistryLinesProps {
  slots: FormationSlot[];
  players: SquadPlayer[];
  /** Whether to use compact/thicker strokes for mobile small-pitch contexts */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Stroke multiplier for compact mode — thicker lines for small pitches */
const COMPACT_STROKE_MULT = 1.6;

/** Invisible hit area width multiplier around each line for touch targeting */
const TOUCH_HIT_AREA = 4;

// ---------------------------------------------------------------------------
// CSS Animation Keyframes (injected once)
// ---------------------------------------------------------------------------

const ANIMATION_STYLES = `
@keyframes chem-pulse {
  0%, 100% { opacity: 0.65; }
  50% { opacity: 0.85; }
}
@keyframes chem-pulse-glow {
  0%, 100% { opacity: 0.15; }
  50% { opacity: 0.3; }
}
@keyframes chem-highlight-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
`;

// ---------------------------------------------------------------------------
// Helper: Build tooltip label for a chemistry edge
// ---------------------------------------------------------------------------

function getEdgeLabel(
  fromIdx: number,
  toIdx: number,
  type: 'team' | 'league' | 'none',
  players: SquadPlayer[],
): string {
  const fromName = players[fromIdx].player.nameEn || players[fromIdx].player.name;
  const toName = players[toIdx].player.nameEn || players[toIdx].player.name;
  const typeLabel =
    type === 'team' ? '같은 클럽' : type === 'league' ? '같은 리그' : '링크 없음';
  return `${fromName} ↔ ${toName} (${typeLabel})`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChemistryLines({
  slots,
  players,
  compact = false,
}: ChemistryLinesProps) {
  const edges = useMemo(() => buildChemistryEdges(players, slots), [players, slots]);
  const instanceId = useId();

  // Touch interaction state: which edge is currently highlighted
  const [highlightedEdge, setHighlightedEdge] = useState<string | null>(null);

  const handleEdgePress = useCallback(
    (edgeKey: string) => {
      setHighlightedEdge((prev) => (prev === edgeKey ? null : edgeKey));
      // Haptic feedback on supported devices
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(8);
      }
    },
    [],
  );

  // Filter IDs for SVG glow filters
  const greenFilterId = `glow-team-${instanceId}`;
  const yellowFilterId = `glow-league-${instanceId}`;
  const highlightFilterId = `glow-highlight-${instanceId}`;

  // Count edges by type for conditional rendering
  const hasTeamLinks = edges.some((e) => e.type === 'team');
  const hasLeagueLinks = edges.some((e) => e.type === 'league');
  const hasNoneLinks = edges.some((e) => e.type === 'none');

  // Stroke multiplier for compact mode
  const strokeMult = compact ? COMPACT_STROKE_MULT : 1;

  if (edges.length === 0) return null;

  // Non-none edges for touch interaction
  const interactiveEdges = edges.filter((e) => e.type !== 'none');
  const showTouchTargets = interactiveEdges.length > 0;

  return (
    <>
      {/* Inject animation keyframes */}
      <style dangerouslySetInnerHTML={{ __html: ANIMATION_STYLES }} />

      <svg
        viewBox="0 0 68 105"
        className="absolute inset-0 w-full h-full pointer-events-none"
        preserveAspectRatio="xMidYMid meet"
        style={{ zIndex: 1 }}
        aria-hidden="true"
      >
        <defs>
          {/* Team link glow filter */}
          {hasTeamLinks && (
            <filter id={greenFilterId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}

          {/* League link glow filter */}
          {hasLeagueLinks && (
            <filter id={yellowFilterId} x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="0.3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}

          {/* Highlighted edge glow filter */}
          {showTouchTargets && (
            <filter id={highlightFilterId} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="0.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}
        </defs>

        {/* Layer 1: Weak links (no chemistry) — rendered first, behind everything */}
        {hasNoneLinks && (
          <g>
            {edges
              .filter((e) => e.type === 'none')
              .map(({ fromIdx, toIdx }) => {
                const fromSlot = slots.find((s) => s.id === players[fromIdx].slotPosition);
                const toSlot = slots.find((s) => s.id === players[toIdx].slotPosition);
                if (!fromSlot || !toSlot) return null;

                const from = slotToSvgCoord(fromSlot);
                const to = slotToSvgCoord(toSlot);
                const cp = getControlPoint(from, to);
                const edgeKey = `none-${fromIdx}-${toIdx}`;
                const isHighlighted = highlightedEdge === edgeKey;

                return (
                  <g key={edgeKey}>
                    <path
                      d={`M ${from.x} ${from.y} Q ${cp.x} ${cp.y} ${to.x} ${to.y}`}
                      fill="none"
                      stroke={isHighlighted ? 'rgba(255,255,255,0.2)' : COLOR.none}
                      strokeWidth={STROKE.none * strokeMult}
                      strokeLinecap="round"
                      strokeDasharray="0.8 0.6"
                      className={isHighlighted ? 'chem-line-interactive' : ''}
                      style={isHighlighted ? { animation: 'chem-highlight-pulse 1s ease-in-out infinite' } : undefined}
                    />
                    {/* Touch hit area (invisible, wider) */}
                    <path
                      d={`M ${from.x} ${from.y} Q ${cp.x} ${cp.y} ${to.x} ${to.y}`}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={TOUCH_HIT_AREA}
                      strokeLinecap="round"
                      className="pointer-events-auto cursor-pointer"
                      onClick={() => handleEdgePress(edgeKey)}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        handleEdgePress(edgeKey);
                      }}
                    >
                      <title>
                        {getEdgeLabel(fromIdx, toIdx, 'none', players)}
                      </title>
                    </path>
                  </g>
                );
              })}
          </g>
        )}

        {/* Layer 2: League links */}
        {hasLeagueLinks && (
          <g filter={`url(#${yellowFilterId})`}>
            {edges
              .filter((e) => e.type === 'league')
              .map(({ fromIdx, toIdx }) => {
                const fromSlot = slots.find((s) => s.id === players[fromIdx].slotPosition);
                const toSlot = slots.find((s) => s.id === players[toIdx].slotPosition);
                if (!fromSlot || !toSlot) return null;

                const from = slotToSvgCoord(fromSlot);
                const to = slotToSvgCoord(toSlot);
                const cp = getControlPoint(from, to);
                const edgeKey = `league-${fromIdx}-${toIdx}`;
                const isHighlighted = highlightedEdge === edgeKey;

                return (
                  <g key={edgeKey}>
                    {/* Glow layer */}
                    <path
                      d={`M ${from.x} ${from.y} Q ${cp.x} ${cp.y} ${to.x} ${to.y}`}
                      fill="none"
                      stroke={COLOR.leagueGlow}
                      strokeWidth={STROKE.league * 2.5 * strokeMult}
                      strokeLinecap="round"
                    />
                    {/* Main line */}
                    <path
                      d={`M ${from.x} ${from.y} Q ${cp.x} ${cp.y} ${to.x} ${to.y}`}
                      fill="none"
                      stroke={isHighlighted ? 'rgba(250, 204, 21, 0.9)' : COLOR.league}
                      strokeWidth={isHighlighted ? STROKE.league * 1.8 * strokeMult : STROKE.league * strokeMult}
                      strokeLinecap="round"
                      className="chem-line-interactive"
                      style={isHighlighted ? { animation: 'chem-highlight-pulse 1s ease-in-out infinite' } : undefined}
                    />
                    {/* Touch hit area */}
                    <path
                      d={`M ${from.x} ${from.y} Q ${cp.x} ${cp.y} ${to.x} ${to.y}`}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={TOUCH_HIT_AREA}
                      strokeLinecap="round"
                      className="pointer-events-auto cursor-pointer"
                      onClick={() => handleEdgePress(edgeKey)}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        handleEdgePress(edgeKey);
                      }}
                    >
                      <title>
                        {getEdgeLabel(fromIdx, toIdx, 'league', players)}
                      </title>
                    </path>
                  </g>
                );
              })}
          </g>
        )}

        {/* Layer 3: Team links — strongest, rendered on top */}
        {hasTeamLinks && (
          <g filter={`url(#${greenFilterId})`}>
            {edges
              .filter((e) => e.type === 'team')
              .map(({ fromIdx, toIdx }) => {
                const fromSlot = slots.find((s) => s.id === players[fromIdx].slotPosition);
                const toSlot = slots.find((s) => s.id === players[toIdx].slotPosition);
                if (!fromSlot || !toSlot) return null;

                const from = slotToSvgCoord(fromSlot);
                const to = slotToSvgCoord(toSlot);
                const cp = getControlPoint(from, to);
                const edgeKey = `team-${fromIdx}-${toIdx}`;
                const isHighlighted = highlightedEdge === edgeKey;

                return (
                  <g key={edgeKey}>
                    {/* Outer glow */}
                    <path
                      d={`M ${from.x} ${from.y} Q ${cp.x} ${cp.y} ${to.x} ${to.y}`}
                      fill="none"
                      stroke={COLOR.teamGlow}
                      strokeWidth={STROKE.team * 3 * strokeMult}
                      strokeLinecap="round"
                      style={
                        !isHighlighted
                          ? { animation: 'chem-pulse-glow 3s ease-in-out infinite' }
                          : undefined
                      }
                    />
                    {/* Main line */}
                    <path
                      d={`M ${from.x} ${from.y} Q ${cp.x} ${cp.y} ${to.x} ${to.y}`}
                      fill="none"
                      stroke={isHighlighted ? 'rgba(74, 222, 128, 1)' : COLOR.team}
                      strokeWidth={isHighlighted ? STROKE.team * 1.8 * strokeMult : STROKE.team * strokeMult}
                      strokeLinecap="round"
                      className="chem-line-interactive"
                      style={
                        isHighlighted
                          ? { animation: 'chem-highlight-pulse 1s ease-in-out infinite' }
                          : { animation: 'chem-pulse 3s ease-in-out infinite' }
                      }
                    />
                    {/* Touch hit area */}
                    <path
                      d={`M ${from.x} ${from.y} Q ${cp.x} ${cp.y} ${to.x} ${to.y}`}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={TOUCH_HIT_AREA}
                      strokeLinecap="round"
                      className="pointer-events-auto cursor-pointer"
                      onClick={() => handleEdgePress(edgeKey)}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        handleEdgePress(edgeKey);
                      }}
                    >
                      <title>
                        {getEdgeLabel(fromIdx, toIdx, 'team', players)}
                      </title>
                    </path>
                  </g>
                );
              })}
          </g>
        )}

        {/* Layer 4: Endpoint dots — rendered on top of all lines */}
        {edges
          .filter((e) => e.type !== 'none')
          .map(({ fromIdx, toIdx, type }) => {
            const fromSlot = slots.find((s) => s.id === players[fromIdx].slotPosition);
            const toSlot = slots.find((s) => s.id === players[toIdx].slotPosition);
            if (!fromSlot || !toSlot) return null;

            const from = slotToSvgCoord(fromSlot);
            const to = slotToSvgCoord(toSlot);
            const edgeKey = `${type}-${fromIdx}-${toIdx}`;
            const isHighlighted = highlightedEdge === edgeKey;
            const r = DOT_RADIUS[type] * (isHighlighted ? 1.5 : 1) * strokeMult;
            const dotColor = type === 'team' ? COLOR.team : COLOR.league;

            return (
              <g key={`dot-${fromIdx}-${toIdx}-${type}`}>
                <circle cx={from.x} cy={from.y} r={r} fill={dotColor} />
                <circle cx={to.x} cy={to.y} r={r} fill={dotColor} />
              </g>
            );
          })}
      </svg>

      {/* Touch tooltip: shows label for highlighted edge */}
      {highlightedEdge && (
        <div
          className="absolute bottom-1 left-1/2 -translate-x-1/2 z-30
            px-2 py-1 rounded-md
            bg-gray-900/95 border border-white/15
            text-[10px] text-white/80 whitespace-nowrap
            backdrop-blur-sm
            animate-in pointer-events-none"
          style={{ maxWidth: '90%' }}
        >
          {(() => {
            const parts = highlightedEdge.split('-');
            const type = parts[0];
            const fromIdx = parseInt(parts[1], 10);
            const toIdx = parseInt(parts[2], 10);
            return getEdgeLabel(fromIdx, toIdx, type as 'team' | 'league' | 'none', players);
          })()}
        </div>
      )}
    </>
  );
}
