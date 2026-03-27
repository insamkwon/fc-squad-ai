"use client";

import type { Player } from "@/types/player";
import type { StatBounds } from "@/lib/stat-utils";
import {
  STAT_KEYS,
  PLAYER_COMPARE_COLORS,
  formatPrice,
  getOvrBadgeColor,
  getPositionColor,
  getComparisonValueClasses,
} from "@/lib/stat-utils";
import SeasonBadge from "@/components/player/SeasonBadge";
import StatBar from "@/components/player/StatBar";

interface MobilePlayerStatCardProps {
  /** Player data to display. */
  player: Player;
  /** Color index for comparison color palette (0, 1, or 2). */
  colorIdx: number;
  /** Pre-computed best/worst stat bounds across all compared players. */
  statBounds: StatBounds;
  /** Callback when a player should be removed. */
  onRemove?: (spid: number) => void;
  /** Player index label (1-based). Displayed in the header badge. */
  index?: number;
  /** Total number of players being compared (for worst-value dimming logic). */
  total?: number;
}

/**
 * Mobile-optimized full stat comparison card for a single player.
 *
 * Designed to be used inside a {@link SwipeableCards} container on mobile
 * screens. Each card shows:
 * - Player header with OVR badge, name, team, season, and position
 * - Price display
 * - All 6 face stats with color-coded bars and best/worst highlighting
 *
 * On mobile this replaces the wide side-by-side comparison table,
 * giving each player a dedicated full-width card that users can swipe
 * between.
 */
export default function MobilePlayerStatCard({
  player,
  colorIdx,
  statBounds,
  onRemove,
  index = 1,
  total = 2,
}: MobilePlayerStatCardProps) {
  const colors = PLAYER_COMPARE_COLORS[colorIdx % PLAYER_COMPARE_COLORS.length];
  const isBestOvr = player.stats.ovr === statBounds.best["ovr"];

  return (
    <div className={`rounded-xl border bg-gray-900 ${colors.border}`}>
      {/* ─── Player Header ─── */}
      <div className="relative p-4 pb-3">
        {/* Remove button */}
        {onRemove && (
          <button
            type="button"
            onClick={() => onRemove(player.spid)}
            className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-full bg-gray-800 text-gray-400 transition-colors active:bg-gray-700 active:text-gray-200"
            aria-label={`${player.name} 제거`}
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}

        <div className="flex items-center gap-3">
          {/* OVR badge */}
          <span
            className={`flex h-14 w-14 flex-col items-center justify-center rounded-lg text-xs font-extrabold ${getOvrBadgeColor(player.stats.ovr)}`}
          >
            <span className="text-xl leading-none">{player.stats.ovr}</span>
            <span className="mt-0.5 text-[10px] font-semibold opacity-80">
              {player.position}
            </span>
          </span>

          {/* Player info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h3 className="truncate text-base font-bold text-white">
                {player.name}
              </h3>
              {isBestOvr && (
                <span className="shrink-0 text-sm text-yellow-400">
                  &#9733;
                </span>
              )}
            </div>
            <p className="truncate text-xs text-gray-400">{player.nameEn}</p>
            <p className="truncate text-[11px] text-gray-500">{player.teamName}</p>
            <div className="mt-1.5 flex items-center gap-2">
              <SeasonBadge
                cardType={player.cardType}
                seasonName={player.seasonName}
                compact
              />
              <span
                className={`inline-flex h-5 items-center rounded px-1.5 text-[10px] font-bold text-white ${getPositionColor(player.position)}`}
              >
                {player.position}
              </span>
            </div>
          </div>
        </div>

        {/* Price row */}
        <div className="mt-3 border-t border-gray-800/60 pt-2">
          <span className="text-sm font-semibold text-yellow-400">
            {formatPrice(player.price)}
          </span>
          {/* Comparison index badge */}
          {total > 1 && (
            <span
              className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${colors.text} bg-gray-800`}
            >
              {index}/{total}
            </span>
          )}
        </div>
      </div>

      {/* ─── Stats Section ─── */}
      <div className="space-y-2 border-t border-gray-800/60 px-4 py-3">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          스탯 상세
        </h4>
        {STAT_KEYS.map((stat) => {
          const val = player.stats[stat.key];
          const isBest = val === statBounds.best[stat.key];
          const isWorst = val === statBounds.worst[stat.key] && total > 2;

          return (
            <div
              key={stat.key}
              className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${
                isBest ? "bg-yellow-500/5" : ""
              }`}
            >
              {/* Stat label */}
              <span className="w-8 shrink-0 text-[11px] font-medium text-gray-400">
                {stat.short}
              </span>

              {/* Stat bar */}
              <div className="flex-1">
                <StatBar
                  value={val}
                  color={stat.color}
                  size="md"
                  isBest={isBest}
                  isWorst={isWorst}
                />
              </div>

              {/* Numeric value */}
              <span
                className={`w-7 shrink-0 text-right text-sm tabular-nums ${getComparisonValueClasses(isBest, isWorst)}`}
              >
                {isBest && (
                  <span className="mr-0.5 text-[10px] text-yellow-500">
                    &#9733;
                  </span>
                )}
                {val}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
