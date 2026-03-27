"use client";

import { useMemo } from "react";
import type { Player } from "@/types/player";
import {
  STAT_KEYS,
  PLAYER_COMPARE_COLORS,
  computeStatBounds,
  getComparisonValueClasses,
  getComparisonCellBg,
} from "@/lib/stat-utils";
import StatBar from "@/components/player/StatBar";
import StatComparisonDisplay from "@/components/player/StatComparisonDisplay";
import SwipeableCards from "@/components/player/SwipeableCards";
import MobilePlayerStatCard from "@/components/player/MobilePlayerStatCard";

interface PlayerCompareViewProps {
  players: Player[];
  onRemove?: (spid: number) => void;
}

/**
 * Full-featured player comparison view combining:
 * - StatComparisonDisplay: player cards with shared stat rows
 * - A stat comparison table with bar indicators (desktop) / swipeable stat cards (mobile)
 * - A grouped horizontal bar chart for visual comparison
 *
 * Responsive behaviour:
 * - **Mobile (< md):** Player cards are swipeable, stat table becomes
 *   swipeable per-player stat cards, grouped chart stays vertical.
 * - **Desktop (≥ md):** Side-by-side card grid, full comparison table,
 *   grouped bar chart.
 */
export default function PlayerCompareView({ players, onRemove }: PlayerCompareViewProps) {
  const statBounds = useMemo(() => computeStatBounds(players), [players]);

  if (players.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-gray-800 bg-gray-900">
        <p className="text-gray-500">비교할 선수를 선택해주세요</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Primary comparison: cards + shared stat rows ─── */}
      <StatComparisonDisplay players={players} onRemove={onRemove} />

      {/* ─── Detailed stat comparison: mobile swipeable cards / desktop table ─── */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400 md:hidden">
          선수별 스탯 상세
        </h3>

        {/* Mobile: swipeable per-player stat cards */}
        <div className="md:hidden">
          <SwipeableCards>
            {players.map((player, idx) => (
              <MobilePlayerStatCard
                key={player.spid}
                player={player}
                colorIdx={idx}
                statBounds={statBounds}
                onRemove={onRemove}
                index={idx + 1}
                total={players.length}
              />
            ))}
          </SwipeableCards>
        </div>

        {/* Desktop: side-by-side comparison table */}
        <div className="hidden overflow-x-auto rounded-xl border border-gray-800 bg-gray-900 md:block">
          <table className="w-full min-w-[400px]">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400">
                  스탯
                </th>
                {players.map((p) => (
                  <th key={p.spid} className="px-4 py-3 text-center text-xs font-semibold text-gray-300">
                    <span className="block truncate max-w-[120px]">{p.name}</span>
                    <span className="block text-[10px] text-gray-500">{p.position}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* OVR row */}
              <tr className="border-b border-gray-800/50">
                <td className="px-4 py-2.5 text-xs font-semibold text-gray-400">OVR</td>
                {players.map((p) => {
                  const isBest = p.stats.ovr === statBounds.best["ovr"];
                  const isWorst = p.stats.ovr === statBounds.worst["ovr"] && players.length > 2;
                  return (
                    <td
                      key={p.spid}
                      className={`px-4 py-2.5 text-center text-sm ${getComparisonCellBg(isBest)}`}
                    >
                      <span className={getComparisonValueClasses(isBest, isWorst)}>
                        {isBest && (
                          <span className="mr-1 text-[10px] text-yellow-500">&#9733;</span>
                        )}
                        {p.stats.ovr}
                      </span>
                    </td>
                  );
                })}
              </tr>

              {/* Individual stat rows */}
              {STAT_KEYS.map((stat) => {
                const best = statBounds.best[stat.key];
                const worst = statBounds.worst[stat.key];
                return (
                  <tr key={stat.key} className="border-b border-gray-800/50 last:border-b-0">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-400">{stat.label}</span>
                        <span className="text-[10px] text-gray-600">{stat.short}</span>
                      </div>
                    </td>
                    {players.map((p) => {
                      const val = p.stats[stat.key];
                      const isBest = val === best;
                      const isWorst = val === worst && players.length > 2;
                      return (
                        <td key={p.spid} className={`px-4 py-2.5 ${getComparisonCellBg(isBest)}`}>
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-sm ${getComparisonValueClasses(isBest, isWorst)}`}>
                              {isBest && (
                                <span className="mr-0.5 text-[10px] text-yellow-500">&#9733;</span>
                              )}
                              {val}
                            </span>
                            <StatBar
                              value={val}
                              color={stat.color}
                              size="sm"
                              isBest={isBest}
                              isWorst={isWorst}
                              className="max-w-[100px]"
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ─── Grouped horizontal bar chart ─── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
          스탯 비교 차트
        </h3>
        <div className="space-y-3">
          {STAT_KEYS.map((stat) => (
            <div key={stat.key}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-400">
                  {stat.label}
                  <span className="ml-1 text-gray-600">({stat.short})</span>
                </span>
              </div>
              <div className="space-y-1">
                {players.map((p, idx) => {
                  const val = p.stats[stat.key];
                  const isBest = val === statBounds.best[stat.key];
                  const isWorst = val === statBounds.worst[stat.key] && players.length > 2;
                  const playerColor = PLAYER_COMPARE_COLORS[idx % PLAYER_COMPARE_COLORS.length];
                  return (
                    <div
                      key={p.spid}
                      className={`flex items-center gap-2 rounded px-1 py-0.5 ${
                        isBest ? getComparisonCellBg(true) : ""
                      }`}
                    >
                      <span
                        className={`w-16 truncate text-[11px] ${
                          isWorst ? "text-gray-600" : isBest ? "text-gray-400 font-medium" : "text-gray-500"
                        }`}
                      >
                        {p.name}
                      </span>
                      <div className="flex-1">
                        <StatBar
                          value={val}
                          color={playerColor.bar}
                          size="lg"
                          isBest={isBest}
                          isWorst={isWorst}
                        />
                      </div>
                      <span
                        className={`w-7 text-right text-xs tabular-nums ${getComparisonValueClasses(isBest, isWorst)}`}
                      >
                        {val}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
