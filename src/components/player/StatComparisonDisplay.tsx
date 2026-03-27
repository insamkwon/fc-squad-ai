"use client";

import { useMemo } from "react";
import type { Player } from "@/types/player";
import {
  STAT_KEYS,
  PLAYER_COMPARE_COLORS,
  formatPrice,
  getOvrBadgeColor,
  getPositionColor,
  computeStatBounds,
  getComparisonValueClasses,
  getComparisonCellBg,
} from "@/lib/stat-utils";
import SeasonBadge from "@/components/player/SeasonBadge";
import StatBar from "@/components/player/StatBar";
import SwipeableCards from "@/components/player/SwipeableCards";

export interface StatComparisonDisplayProps {
  /** Players to compare (2–3). */
  players: Player[];
  /** Callback when a player should be removed from the comparison. */
  onRemove?: (spid: number) => void;
  /** Additional CSS classes for the root element. */
  className?: string;
}

export default function StatComparisonDisplay({
  players,
  onRemove,
  className = "",
}: StatComparisonDisplayProps) {
  // Pre-compute best and worst values for each stat across all players.
  const statBounds = useMemo(() => computeStatBounds(players), [players]);

  if (players.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-gray-800 bg-gray-900">
        <p className="text-gray-500">비교할 선수를 선택해주세요</p>
      </div>
    );
  }

  const playerCards = players.map((player, idx) => (
    <PlayerCompareCard
      key={player.spid}
      player={player}
      colorIdx={idx}
      onRemove={onRemove}
      isBestOvr={player.stats.ovr === statBounds.best["ovr"]}
    />
  ));

  return (
    <div className={`space-y-6 ${className}`}>
      {/* ─── Player Cards: swipeable on mobile, grid on desktop ─── */}
      {/* Mobile: swipeable cards */}
      <div className="md:hidden">
        <SwipeableCards>{playerCards}</SwipeableCards>
      </div>
      {/* Desktop: side-by-side grid */}
      <div
        className={`hidden gap-4 md:grid ${
          players.length <= 2
            ? "md:grid-cols-2"
            : "md:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {playerCards}
      </div>

      {/* ─── Shared Stat Rows ─── */}
      <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 sm:p-6">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
          스탯 비교
        </h3>

        <div className="space-y-4">
          {/* OVR Row */}
          <StatRow
            label="전체 평점"
            short="OVR"
            players={players}
            getValue={(p) => p.stats.ovr}
            bestValue={statBounds.best["ovr"]}
            worstValue={statBounds.worst["ovr"]}
            customColor
          />

          {/* Individual stat rows */}
          {STAT_KEYS.map((stat) => (
            <StatRow
              key={stat.key}
              label={stat.label}
              short={stat.short}
              players={players}
              getValue={(p) => p.stats[stat.key]}
              bestValue={statBounds.best[stat.key]}
              worstValue={statBounds.worst[stat.key]}
              statColor={stat.color}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

/** Compact player card displayed at the top of the comparison. */
function PlayerCompareCard({
  player,
  colorIdx,
  onRemove,
  isBestOvr,
}: {
  player: Player;
  colorIdx: number;
  onRemove?: (spid: number) => void;
  isBestOvr: boolean;
}) {
  const colors = PLAYER_COMPARE_COLORS[colorIdx % PLAYER_COMPARE_COLORS.length];

  return (
    <div
      className={`relative rounded-xl border bg-gray-900 p-4 transition-colors ${colors.border}`}
    >
      {/* Remove button */}
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(player.spid)}
          className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-gray-800 text-gray-400 transition-colors hover:bg-gray-700 hover:text-gray-200"
          aria-label={`${player.name} 제거`}
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <div className="flex items-center gap-3">
        {/* OVR badge */}
        <span
          className={`flex h-12 w-12 flex-col items-center justify-center rounded-lg text-xs font-extrabold ${getOvrBadgeColor(player.stats.ovr)}`}
        >
          <span className="text-lg leading-none">{player.stats.ovr}</span>
          <span className="mt-0.5 text-[9px] font-semibold opacity-80">
            {player.position}
          </span>
        </span>

        {/* Player info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h3 className="truncate text-sm font-bold text-white">
              {player.name}
            </h3>
            {isBestOvr && (
              <span className="shrink-0 text-xs text-yellow-400">&#9733;</span>
            )}
          </div>
          <p className="truncate text-xs text-gray-400">{player.nameEn}</p>
          <p className="truncate text-[11px] text-gray-500">{player.teamName}</p>
          <div className="mt-1">
            <SeasonBadge
              cardType={player.cardType}
              seasonName={player.seasonName}
              compact
            />
          </div>
        </div>
      </div>

      {/* Position badge + Price */}
      <div className="mt-2 flex items-center justify-between text-xs">
        <span
          className={`inline-flex h-5 items-center rounded px-1.5 text-[10px] font-bold text-white ${getPositionColor(player.position)}`}
        >
          {player.position}
        </span>
        <span className="font-semibold text-yellow-400">
          {formatPrice(player.price)}
        </span>
      </div>
    </div>
  );
}

/** A single shared stat row showing values and bars for all players. */
function StatRow({
  label,
  short,
  players,
  getValue,
  bestValue,
  worstValue,
  statColor,
  customColor = false,
}: {
  label: string;
  short: string;
  players: Player[];
  getValue: (p: Player) => number;
  bestValue: number;
  worstValue: number;
  statColor?: string;
  customColor?: boolean;
}) {
  return (
    <div className="group">
      {/* Stat label header */}
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <span className="text-[10px] text-gray-600">{short}</span>
      </div>

      {/* Player bars */}
      <div className="space-y-1.5">
        {players.map((player, idx) => {
          const val = getValue(player);
          const isBest = val === bestValue;
          const isWorst = val === worstValue && players.length > 2;
          const colors = PLAYER_COMPARE_COLORS[idx % PLAYER_COMPARE_COLORS.length];

          // Use per-player color for OVR, per-stat color for other stats
          const barColor = customColor ? colors.bar : (statColor ?? colors.bar);

          return (
            <div
              key={player.spid}
              className={`flex items-center gap-2 rounded-md px-1 py-0.5 sm:gap-3 ${
                isBest ? getComparisonCellBg(true) : ""
              }`}
            >
              {/* Player name (truncated) */}
              <span
                className={`w-14 shrink-0 truncate text-[11px] sm:w-20 ${
                  isWorst ? "text-gray-600" : isBest ? "text-gray-300 font-medium" : "text-gray-500"
                }`}
              >
                {player.name}
              </span>

              {/* Stat bar */}
              <div className="flex-1">
                <StatBar
                  value={val}
                  color={barColor}
                  size="md"
                  isBest={isBest}
                  isWorst={isWorst}
                />
              </div>

              {/* Numeric value — bold/color the best, dim the worst */}
              <span
                className={`w-7 shrink-0 text-right text-xs tabular-nums ${getComparisonValueClasses(isBest, isWorst)}`}
              >
                {val}
              </span>

              {/* Best indicator */}
              {isBest && (
                <span className="w-3.5 shrink-0 text-center text-[10px] text-yellow-500">
                  &#9733;
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
