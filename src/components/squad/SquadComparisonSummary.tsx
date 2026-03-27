'use client';

import { useState, useMemo } from 'react';
import type { SquadCandidate } from '@/types/squad';
import { formatCost } from '@/lib/stat-utils';

interface SquadComparisonSummaryProps {
  candidates: SquadCandidate[];
}

/**
 * Compute average OVR for a squad.
 */
function avgOvr(players: SquadCandidate['squad']['players']): number {
  if (players.length === 0) return 0;
  return Math.round(
    players.reduce((sum, sp) => sum + sp.player.stats.ovr, 0) / players.length,
  );
}

/** Color tier for chemistry score */
function chemColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

/** Background color for chemistry score */
function chemBg(score: number): string {
  if (score >= 80) return 'bg-green-500/10 border-green-500/20';
  if (score >= 50) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

interface MetricRow {
  label: string;
  icon: React.ReactNode;
  values: (number | string)[];
  bestIndex: number | null;
  /** For non-numeric values (formation), no "best" highlighting */
  isBest?: (idx: number) => boolean;
}

/**
 * Squad comparison summary showing key differences between candidates.
 * Highlights the best candidate for each metric.
 */
export default function SquadComparisonSummary({
  candidates,
}: SquadComparisonSummaryProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const metrics = useMemo<MetricRow[]>(() => {
    if (candidates.length === 0) return [];

    const ovrValues = candidates.map((c) => avgOvr(c.squad.players));
    const chemValues = candidates.map((c) => c.squad.chemistryScore);
    const costValues = candidates.map((c) => c.squad.totalCost);
    const scoreValues = candidates.map((c) => c.score);
    const formations = candidates.map((c) => c.squad.formation);

    const bestOvr = Math.max(...ovrValues);
    const bestChem = Math.max(...chemValues);
    const bestCost = Math.min(...costValues.filter((c) => c > 0));
    const bestScore = Math.max(...scoreValues);

    return [
      {
        label: '평균 OVR',
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ),
        values: ovrValues,
        bestIndex: ovrValues.indexOf(bestOvr),
      },
      {
        label: '케미',
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
        ),
        values: chemValues,
        bestIndex: chemValues.indexOf(bestChem),
      },
      {
        label: '예산',
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
          </svg>
        ),
        values: costValues,
        bestIndex: costValues.length > 0 ? costValues.indexOf(bestCost) : null,
      },
      {
        label: '평가 점수',
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ),
        values: scoreValues,
        bestIndex: scoreValues.indexOf(bestScore),
      },
      {
        label: '포메이션',
        icon: (
          <svg className="w-3.5 h-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        ),
        values: formations,
        bestIndex: null,
      },
    ];
  }, [candidates]);

  // Don't render if fewer than 2 candidates
  if (candidates.length < 2) return null;

  return (
    <div className="w-full mb-4">
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-lg bg-gray-800/60 border border-gray-700/50 hover:border-gray-600/60 transition-colors group"
      >
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-blue-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.7 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-semibold text-white/80 group-hover:text-white transition-colors">
            스쿼드 비교
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {/* Comparison content */}
      {isExpanded && (
        <div className="mt-2 rounded-lg border border-gray-700/40 bg-gray-900/60 overflow-hidden">
          {/* Mobile: Stacked card layout */}
          <div className="block lg:hidden">
            {/* Candidate selector pills */}
            <div className="flex gap-2 px-3 pt-3 pb-2">
              {candidates.map((c, i) => (
                <div
                  key={c.squad.id}
                  className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md bg-gray-800/80 border border-gray-700/50"
                >
                  <span className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold bg-blue-500/20 text-blue-300">
                    {i + 1}
                  </span>
                  <span className="text-xs font-medium text-blue-300">
                    {c.squad.formation}
                  </span>
                </div>
              ))}
            </div>

            {/* Metric rows */}
            <div className="divide-y divide-gray-800/60">
              {metrics.map((metric) => (
                <div key={metric.label} className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-white/40">{metric.icon}</span>
                    <span className="text-[11px] font-medium text-white/50">
                      {metric.label}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {metric.values.map((val, i) => {
                      const isBest =
                        metric.bestIndex !== null && i === metric.bestIndex;
                      return (
                        <div
                          key={i}
                          className={`
                            flex-1 text-center px-2 py-1.5 rounded-md text-sm font-bold tabular-nums transition-colors
                            ${
                              isBest
                                ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-300'
                                : 'bg-gray-800/40 border border-transparent text-white/60'
                            }
                          `}
                        >
                          {/* Special rendering for different metrics */}
                          {metric.label === '케미' ? (
                            <span className={chemColor(val as number)}>
                              {val as number}
                            </span>
                          ) : metric.label === '예산' ? (
                            <span>{formatCost(val as number)}</span>
                          ) : metric.label === '포메이션' ? (
                            <span className="font-semibold text-white/70 text-xs">
                              {val as string}
                            </span>
                          ) : (
                            <span>{val}</span>
                          )}

                          {isBest && (
                            <span className="ml-1 text-[9px] text-yellow-400/70">
                              BEST
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Budget utilization bar */}
            <BudgetUtilBars candidates={candidates} />
          </div>

          {/* Desktop: Table grid layout */}
          <div className="hidden lg:block">
            {/* Table header */}
            <div className="grid grid-cols-4 border-b border-gray-700/40">
              {/* Metric label column */}
              <div className="px-4 py-2.5 text-xs font-medium text-white/40">
                구분
              </div>
              {/* Candidate columns */}
              {candidates.map((c, i) => (
                <div
                  key={c.squad.id}
                  className="px-4 py-2.5 text-center text-xs font-medium"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                      {i + 1}
                    </span>
                    <span className="text-blue-300 font-semibold">
                      {c.squad.formation}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Metric rows */}
            {metrics.map((metric) => (
              <div
                key={metric.label}
                className="grid grid-cols-4 border-b border-gray-800/40 last:border-b-0"
              >
                {/* Label */}
                <div className="px-4 py-2.5 flex items-center gap-2">
                  <span className="text-white/30">{metric.icon}</span>
                  <span className="text-xs font-medium text-white/50">
                    {metric.label}
                  </span>
                </div>
                {/* Values */}
                {metric.values.map((val, i) => {
                  const isBest =
                    metric.bestIndex !== null && i === metric.bestIndex;
                  return (
                    <div
                      key={i}
                      className={`
                        px-4 py-2.5 text-center
                        ${isBest ? 'bg-yellow-500/5' : ''}
                      `}
                    >
                      <span
                        className={`
                          text-sm font-bold tabular-nums
                          ${
                            isBest
                              ? 'text-yellow-300'
                              : 'text-white/60'
                          }
                        `}
                      >
                        {metric.label === '케미' ? (
                          <span className={chemColor(val as number)}>
                            {val as number}
                          </span>
                        ) : metric.label === '예산' ? (
                          <span>{formatCost(val as number)}</span>
                        ) : metric.label === '포메이션' ? (
                          <span className="font-semibold text-white/70">
                            {val as string}
                          </span>
                        ) : (
                          <span>{val}</span>
                        )}
                      </span>
                      {isBest && (
                        <span className="ml-1.5 text-[9px] font-semibold text-yellow-500/70 uppercase tracking-wide">
                          Best
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}

            {/* Budget utilization bar (desktop) */}
            <BudgetUtilBars candidates={candidates} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Budget utilization bar showing how much of the budget each candidate uses.
 */
function BudgetUtilBars({ candidates }: { candidates: SquadCandidate[] }) {
  // Find the max budget across all candidates to use as reference
  const maxBudget = Math.max(
    ...candidates.map((c) => c.squad.totalBudget),
    ...candidates.map((c) => c.squad.totalCost),
  );

  if (maxBudget <= 0) return null;

  return (
    <div className="px-3 py-2.5 lg:px-4 lg:py-3 border-t border-gray-800/40 bg-gray-800/20">
      <div className="flex items-center gap-1.5 mb-2">
        <svg
          className="w-3 h-3 text-white/30"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M4 4a2 2 0 00-2 2v1h20V6a2 2 0 00-2-2H4z" />
          <path
            fillRule="evenodd"
            d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
            clipRule="evenodd"
          />
        </svg>
        <span className="text-[11px] font-medium text-white/40">
          예산 사용률
        </span>
      </div>
      <div className="space-y-1.5">
        {candidates.map((c, i) => {
          const budget = c.squad.totalBudget;
          const cost = c.squad.totalCost;
          const pct = budget > 0 ? Math.round((cost / budget) * 100) : 0;
          const isOverBudget = budget > 0 && cost > budget;

          return (
            <div key={c.squad.id} className="flex items-center gap-2">
              <span className="w-4 text-[10px] font-bold text-white/40">
                {i + 1}
              </span>
              <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isOverBudget
                      ? 'bg-red-500/70'
                      : pct > 80
                        ? 'bg-yellow-500/70'
                        : 'bg-green-500/60'
                  }`}
                  style={{ width: `${Math.min(pct, 100)}%` }}
                />
              </div>
              <span
                className={`text-[10px] font-semibold tabular-nums w-10 text-right ${
                  isOverBudget
                    ? 'text-red-400'
                    : pct > 80
                      ? 'text-yellow-400'
                      : 'text-green-400'
                }`}
              >
                {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
