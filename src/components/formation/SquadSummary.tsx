'use client';

import { useMemo } from 'react';
import type { Squad } from '@/types/squad';
import { FORMATION_SLOTS } from '@/types/squad';
import { formatCost, calculateSquadCost } from '@/lib/stat-utils';
import { buildSynergyAnalysis, getLeagueColor } from '@/lib/synergy-analysis';
import ChemistryIndicator from './ChemistryIndicator';

interface SquadSummaryProps {
  squad: Squad;
  /** Whether to show the full synergy detail section */
  showSynergyDetail?: boolean;
  /** Called when user toggles synergy detail expansion */
  onToggleSynergyDetail?: () => void;
}

/**
 * Compute team color synergy: count of players per team.
 */
function buildTeamBreakdown(
  squad: Squad,
): { teamName: string; count: number }[] {
  const map = new Map<string, number>();
  for (const sp of squad.players) {
    const name = sp.player.teamNameEn || sp.player.teamName;
    map.set(name, (map.get(name) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([teamName, count]) => ({ teamName, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Compute league distribution: count of players per league.
 */
function buildLeagueBreakdown(
  squad: Squad,
): { leagueName: string; count: number }[] {
  const map = new Map<string, number>();
  for (const sp of squad.players) {
    const name = sp.player.leagueName;
    map.set(name, (map.get(name) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([leagueName, count]) => ({ leagueName, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Determine budget status for styling.
 * Returns an object with color classes and a status label.
 */
function getBudgetStatus(
  totalCost: number,
  totalBudget: number,
): {
  pct: number;
  isOver: boolean;
  isNear: boolean;
  barColor: string;
  textColor: string;
  bgColor: string;
} {
  const pct = totalBudget > 0 ? Math.round((totalCost / totalBudget) * 100) : 0;
  const isOver = totalBudget > 0 && totalCost > totalBudget;
  const isNear = totalBudget > 0 && pct > 80 && !isOver;

  return {
    pct,
    isOver,
    isNear,
    barColor: isOver ? 'bg-red-500/70' : isNear ? 'bg-yellow-500/70' : 'bg-green-500/60',
    textColor: isOver ? 'text-red-400' : isNear ? 'text-yellow-400' : 'text-green-400',
    bgColor: isOver ? 'bg-red-500/10 border-red-500/20' : isNear ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-green-500/10 border-green-500/20',
  };
}

export default function SquadSummary({
  squad,
  showSynergyDetail = false,
  onToggleSynergyDetail,
}: SquadSummaryProps) {
  const avgOvr =
    squad.players.length > 0
      ? Math.round(
          squad.players.reduce((sum, sp) => sum + sp.player.stats.ovr, 0) /
            squad.players.length,
        )
      : 0;

  const teamBreakdown = buildTeamBreakdown(squad);
  const leagueBreakdown = buildLeagueBreakdown(squad);

  // Recalculate total cost from individual player prices for accuracy
  const computedTotalCost = useMemo(
    () => calculateSquadCost(squad.players),
    [squad.players],
  );

  // Use the generator's totalCost (may differ if calculated differently)
  // but verify with our own calculation for display
  const displayCost = computedTotalCost;

  const budgetStatus = useMemo(
    () => getBudgetStatus(displayCost, squad.totalBudget),
    [displayCost, squad.totalBudget],
  );

  const hasBudget = squad.totalBudget > 0;

  // Compute synergy analysis for link counts
  const synergy = useMemo(() => {
    const slots = FORMATION_SLOTS[squad.formation as keyof typeof FORMATION_SLOTS] || [];
    return buildSynergyAnalysis(squad.players, slots);
  }, [squad]);

  const hasMultipleTeams = teamBreakdown.length > 1;
  const hasMultipleLeagues = leagueBreakdown.length > 1;
  const showBreakdown = hasMultipleTeams || hasMultipleLeagues;

  return (
    <div className="w-full max-w-lg mx-auto mt-3 px-1">
      {/* Top row: formation name + stats */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <h3 className="text-sm font-bold text-white/90 tracking-wide">
          {squad.formation}
        </h3>

        <div className="flex items-center gap-2">
          {/* Average OVR */}
          <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-gray-800/80 border border-white/10">
            <span className="text-[10px] text-white/50 font-medium">AVG</span>
            <span className="text-sm font-bold text-white tabular-nums">
              {avgOvr}
            </span>
          </div>

          {/* Chemistry */}
          <ChemistryIndicator score={squad.chemistryScore} />
        </div>
      </div>

      {/* Total Squad Cost Banner */}
      <div className="rounded-lg bg-gray-800/60 border border-white/10 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          {/* Left: player count + currency icon + label */}
          <div className="flex items-center gap-1.5">
            <svg
              className="w-3.5 h-3.5 text-yellow-400/80 shrink-0"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
            </svg>
            <span className="text-[11px] font-medium text-white/50">
              총 비용
            </span>
            <span className="text-[10px] text-white/30">
              {squad.players.length}/11
            </span>
          </div>

          {/* Right: formatted total cost */}
          <span className="text-sm font-bold text-yellow-400 tabular-nums tracking-tight">
            {formatCost(displayCost)}
          </span>
        </div>

        {/* Budget utilization bar (when budget is set) */}
        {hasBudget && (
          <div className="mt-1.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/35">
                예산 대비
              </span>
              <span className={`text-[10px] font-semibold tabular-nums ${budgetStatus.textColor}`}>
                {budgetStatus.isOver ? '초과' : `${budgetStatus.pct}% 사용`}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-700/60 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${budgetStatus.barColor}`}
                style={{ width: `${Math.min(budgetStatus.pct, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Synergy link counts */}
      {squad.players.length >= 2 && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {/* Team link count */}
          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-green-500/12 text-green-400 border border-green-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
            <span className="font-medium">클럽</span>
            <span className="font-bold tabular-nums">{synergy.teamLinkCount}</span>
          </div>

          {/* League link count */}
          <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-yellow-500/12 text-yellow-400 border border-yellow-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            <span className="font-medium">리그</span>
            <span className="font-bold tabular-nums">{synergy.leagueLinkCount}</span>
          </div>

          {/* Dead link count */}
          {synergy.deadLinkCount > 0 && (
            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-gray-500/8 text-gray-400 border border-gray-500/15">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500/50" />
              <span className="font-medium">없음</span>
              <span className="font-bold tabular-nums">{synergy.deadLinkCount}</span>
            </div>
          )}

          {/* Synergy detail toggle button */}
          {onToggleSynergyDetail && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleSynergyDetail();
              }}
              className="inline-flex items-center gap-0.5 ml-auto text-[10px] text-white/40 hover:text-white/60 transition-colors"
            >
              <span>{showSynergyDetail ? '접기' : '상세'}</span>
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${showSynergyDetail ? 'rotate-180' : ''}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </div>
      )}

      {/* League breakdown (only when multiple leagues) */}
      {showBreakdown && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {/* League pills */}
          {leagueBreakdown.map(({ leagueName, count }) => (
            <div
              key={leagueName}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border border-white/5"
              style={{
                backgroundColor: `${getLeagueColor(leagueName)}20`,
                borderColor: `${getLeagueColor(leagueName)}40`,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-sm shrink-0"
                style={{ backgroundColor: getLeagueColor(leagueName) }}
              />
              <span className="font-medium" style={{ color: `${getLeagueColor(leagueName)}cc` }}>
                {leagueName}
              </span>
              <span className="font-bold text-white/80 tabular-nums">{count}</span>
            </div>
          ))}

          {/* Team pills */}
          {teamBreakdown.map(({ teamName, count }) => (
            <span
              key={teamName}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-white/5 border border-white/8 text-white/60"
            >
              <span className="font-semibold text-white/80">{count}</span>
              {teamName}
            </span>
          ))}
        </div>
      )}

      {/* Simple team breakdown when only one team */}
      {!showBreakdown && teamBreakdown.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {teamBreakdown.map(({ teamName, count }) => (
            <span
              key={teamName}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-white/5 border border-white/8 text-white/60"
            >
              <span className="font-semibold text-white/80">{count}</span>
              {teamName}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
