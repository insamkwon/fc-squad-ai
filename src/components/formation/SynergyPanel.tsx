'use client';

import { useMemo } from 'react';
import type { Squad } from '@/types/squad';
import { FORMATION_SLOTS } from '@/types/squad';
import { buildSynergyAnalysis, getLeagueColor } from '@/lib/synergy-analysis';
import type { SynergyAnalysis, PlayerSynergyInfo } from '@/lib/synergy-analysis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SynergyPanelProps {
  squad: Squad;
  /** Whether to show the expanded detail view (per-player connections) */
  expanded?: boolean;
  /** Called when user toggles expansion */
  onToggleExpand?: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Visual legend explaining chemistry line colors */
function SynergyLegend() {
  return (
    <div className="flex items-center gap-3 text-[10px] text-white/50">
      <div className="flex items-center gap-1">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-400 border border-green-300/60" />
        <span>동일 클럽 (3pt)</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-400 border border-yellow-300/60" />
        <span>동일 리그 (2pt)</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-500/40 border border-gray-500/30" />
        <span>없음 (0pt)</span>
      </div>
    </div>
  );
}

/** Link statistics summary badges */
function LinkStats({ analysis }: { analysis: SynergyAnalysis }) {
  const items = [
    {
      label: '클럽',
      count: analysis.teamLinkCount,
      color: 'bg-green-500/15 text-green-400 border-green-500/30',
      dotColor: 'bg-green-400',
    },
    {
      label: '리그',
      count: analysis.leagueLinkCount,
      color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
      dotColor: 'bg-yellow-400',
    },
    {
      label: '연결없음',
      count: analysis.deadLinkCount,
      color: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      dotColor: 'bg-gray-500/50',
    },
  ];

  return (
    <div className="flex items-center gap-2">
      {items.map(({ label, count, color, dotColor }) => (
        <div
          key={label}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border ${color}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
          <span className="font-medium">{label}</span>
          <span className="font-bold tabular-nums">{count}</span>
        </div>
      ))}
      <span className="text-[10px] text-white/30 tabular-nums">
        / {analysis.totalLinks}
      </span>
    </div>
  );
}

/** League distribution pills with color coding */
function LeagueDistribution({ analysis }: { analysis: SynergyAnalysis }) {
  if (analysis.leagueDistribution.length <= 1) return null;

  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
        리그 분포
      </h4>
      <div className="flex flex-wrap gap-1">
        {analysis.leagueDistribution.map(({ name, count }) => (
          <div
            key={name}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-white/8 bg-white/5"
          >
            {/* League color dot */}
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: getLeagueColor(name) }}
            />
            <span className="text-[10px] font-medium text-white/70">{name}</span>
            <span className="text-[10px] font-bold text-white/90 tabular-nums">{count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Team distribution pills showing club representation */
function TeamDistribution({ analysis }: { analysis: SynergyAnalysis }) {
  if (analysis.teamDistribution.length <= 1) return null;

  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
        클럽 분포
      </h4>
      <div className="flex flex-wrap gap-1">
        {analysis.teamDistribution.map(({ name, count }) => (
          <span
            key={name}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-white/5 border border-white/8 text-white/60"
          >
            <span className="font-semibold text-white/80">{count}</span>
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Per-player connection detail row */
function PlayerConnectionRow({ info }: { info: PlayerSynergyInfo }) {
  const { player, chemistry, teamLinkCount, leagueLinkCount, connections } = info;
  const name = player.nameEn || player.name;

  const chemColor = chemistry >= 80
    ? 'text-green-400 bg-green-500/10'
    : chemistry >= 50
      ? 'text-yellow-400 bg-yellow-500/10'
      : 'text-red-400 bg-red-500/10';

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
      {/* Player name + position */}
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <span className="text-[10px] font-bold px-1 py-0.5 rounded bg-blue-500/15 text-blue-300 shrink-0">
          {player.position}
        </span>
        <span className="text-[11px] font-medium text-white/80 truncate">{name}</span>
      </div>

      {/* Connection counts */}
      <div className="flex items-center gap-1 shrink-0">
        {teamLinkCount > 0 && (
          <span className="text-[10px] font-bold text-green-400 tabular-nums">
            {teamLinkCount}T
          </span>
        )}
        {leagueLinkCount > 0 && (
          <span className="text-[10px] font-bold text-yellow-400 tabular-nums">
            {leagueLinkCount}L
          </span>
        )}
      </div>

      {/* Chemistry score */}
      <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded ${chemColor}`}>
        {chemistry}
      </span>
    </div>
  );
}

/** Per-player connection details list */
function PlayerConnectionList({ analysis }: { analysis: SynergyAnalysis }) {
  const sortedInfos = [...analysis.playerInfos].sort((a, b) => {
    // Sort by: best link type (team > league > none), then by chemistry desc
    const typeOrder = { team: 0, league: 1, none: 2 };
    const tDiff = typeOrder[a.bestLinkType] - typeOrder[b.bestLinkType];
    if (tDiff !== 0) return tDiff;
    return b.chemistry - a.chemistry;
  });

  return (
    <div className="mt-2 rounded-lg bg-gray-900/50 border border-white/5 overflow-hidden">
      <div className="flex items-center gap-2 px-2 py-1.5 bg-white/3 border-b border-white/5">
        <h4 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
          선수별 시너지
        </h4>
      </div>
      <div className="divide-y divide-white/3">
        {sortedInfos.map((info) => (
          <div key={info.index} className="px-2">
            <PlayerConnectionRow info={info} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SynergyPanel({
  squad,
  expanded = false,
  onToggleExpand,
}: SynergyPanelProps) {
  const analysis = useMemo(() => {
    const slots = FORMATION_SLOTS[squad.formation as keyof typeof FORMATION_SLOTS] || [];
    return buildSynergyAnalysis(squad.players, slots);
  }, [squad]);

  if (squad.players.length < 2) return null;

  return (
    <div className="w-full max-w-lg mx-auto mt-2 px-1">
      {/* Synergy header */}
      <div className="rounded-lg bg-gray-800/40 border border-white/5 px-3 py-2.5 space-y-2.5">
        {/* Title row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="w-3.5 h-3.5 text-blue-400/70"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 17v1h-3zM4.75 14.094A5.973 5.973 0 004 17v1H1v-1a3 3 0 013.75-2.906z" />
            </svg>
            <span className="text-xs font-semibold text-white/70">팀 컬러 시너지</span>
          </div>

          {/* Expand/collapse toggle */}
          {onToggleExpand && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-[10px] text-white/40 hover:text-white/60 transition-colors flex items-center gap-0.5"
            >
              <span>{expanded ? '접기' : '상세보기'}</span>
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>

        {/* Legend */}
        <SynergyLegend />

        {/* Link stats */}
        <LinkStats analysis={analysis} />

        {/* Dominant team/league badges */}
        <div className="flex items-center gap-2">
          {analysis.dominantTeam !== '-' && (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-green-500/8 border border-green-500/15 text-green-300/70">
              <span className="text-[9px]">주력클럽</span>
              <span className="font-semibold">{analysis.dominantTeam}</span>
            </div>
          )}
          {analysis.dominantLeague !== '-' && (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/8 border border-yellow-500/15 text-yellow-300/70">
              <span className="text-[9px]">주력리그</span>
              <span className="font-semibold">{analysis.dominantLeague}</span>
            </div>
          )}
        </div>

        {/* League distribution */}
        <LeagueDistribution analysis={analysis} />

        {/* Team distribution */}
        <TeamDistribution analysis={analysis} />
      </div>

      {/* Expanded: Per-player connection details */}
      {expanded && <PlayerConnectionList analysis={analysis} />}
    </div>
  );
}
