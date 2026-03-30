"use client";

import type { Player } from "@/types/player";
import type { CardType } from "@/types/player";
import {
  STAT_KEYS,
  formatPrice,
  getOvrBadgeColor,
  getPositionColor,
  getStatValueColor,
} from "@/lib/stat-utils";
import PlayerImage from "@/components/player/PlayerImage";

interface CompactPlayerCardProps {
  player: Player;
  /**
   * Display mode controlling the level of detail.
   * - "full":  Standard variant for squad views and candidate cards
   * - "pitch": Compact variant for formation slots with inline stats
   * - "micro": Ultra-compact for mobile chat/embedded contexts (OVR + position + name only)
   *
   * Both "full" and "pitch" modes display the 6 key stats (pace, shooting,
   * passing, dribbling, defending, physical) directly within the card.
   * "micro" mode omits the stats grid and price for minimal footprint.
   * @default "full"
   */
  mode?: "pitch" | "full" | "micro";
  /** Additional CSS classes */
  className?: string;
  /** Whether the card is currently selected/highlighted */
  selected?: boolean;
  /** Click handler */
  onClick?: (player: Player) => void;
}

/**
 * Card type → top accent strip gradient.
 */
const CARD_TYPE_STRIP: Record<CardType, string> = {
  BASE: "from-gray-500/50 to-transparent",
  SPECIAL: "from-amber-400/70 to-transparent",
  ICON: "from-purple-400/70 to-transparent",
  LIVE: "from-emerald-400/70 to-transparent",
  MOM: "from-cyan-400/70 to-transparent",
  POTW: "from-sky-400/70 to-transparent",
};

/**
 * FUTBIN-style compact player card displaying OVR rating, key stats,
 * player name, position, and price.
 *
 * Supports three modes:
 * - **"full"** (default): Standard display — OVR, position, name, team,
 *   stats grid (6 face stats in 3×2 layout), and price.
 * - **"pitch"**: Compact variant for formation slots — same elements with
 *   tighter padding, still showing all 6 key stats inline.
 * - **"micro"**: Ultra-compact for mobile chat/embedded contexts — OVR,
 *   position, and name only (no stats grid, no price). Designed to fit
 *   within ~200-240px pitch containers without overlapping.
 */
export default function CompactPlayerCard({
  player,
  mode = "full",
  className = "",
  selected = false,
  onClick,
}: CompactPlayerCardProps) {
  const { stats } = player;

  const isPitch = mode === "pitch";
  const isMicro = mode === "micro";
  const strip = CARD_TYPE_STRIP[player.cardType] ?? CARD_TYPE_STRIP.BASE;

  const cardContent = (
    <div
      className={`
        overflow-hidden rounded-lg border transition-all duration-150
        ${selected
          ? "border-yellow-500 bg-gray-800/95 ring-1 ring-yellow-500/40"
          : "border-white/10 bg-gray-900/95 shadow-lg shadow-black/40"
        }
        ${isPitch ? "w-[72px] sm:w-20" : isMicro ? "w-[52px]" : ""}
        ${className}
      `}
    >
      {/* ── Card type accent strip (top edge) ── */}
      {!isMicro && (
        <div className={`h-[3px] w-full bg-gradient-to-r ${strip}`} />
      )}

      {/* ── Player image (full & pitch modes) ── */}
      {!isMicro && (
        <div className={`relative flex justify-center ${isPitch ? "pt-1 pb-0.5" : "pt-2 pb-1"}`}>
          <div className="relative h-12 w-12 overflow-hidden rounded-md sm:h-14 sm:w-14 ring-1 ring-white/10">
            <PlayerImage
              spid={player.spid}
              name={player.name}
              nameEn={player.nameEn}
              position={player.position}
              size="md"
            />
          </div>
        </div>
      )}

      {/* ── Top: OVR badge + position ── */}
      <div className={`flex items-start justify-between ${
        isMicro ? "px-1 pt-1 pb-0" : isPitch ? "px-1.5 pt-1 pb-0.5" : "px-2 pt-2 pb-1"
      }`}>
        {/* OVR badge */}
        <span
          className={`flex items-center justify-center rounded-md font-extrabold leading-none ${
            isMicro
              ? "h-5 w-5 text-[10px]"
              : isPitch
                ? "h-6 w-6 text-xs"
                : "h-7 w-7 text-xs"
          } ${getOvrBadgeColor(stats.ovr)}`}
        >
          {stats.ovr}
        </span>

        {/* Position badge */}
        <span
          className={`flex items-center justify-center rounded font-bold text-white ${
            isMicro
              ? "h-4 px-1 text-[8px]"
              : isPitch
                ? "h-5 px-1.5 text-[10px]"
                : "h-5 px-1.5 text-[10px]"
          } ${getPositionColor(player.position)}`}
        >
          {player.position}
        </span>
      </div>

      {/* ── Player name ── */}
      {!isMicro && (
        <div className={`min-w-0 ${isPitch ? "px-1.5 pb-0.5" : "px-2 pb-1"}`}>
          <p className={`truncate font-semibold text-white leading-tight ${isPitch ? "text-[11px]" : "text-xs"}`}>
            {player.name}
          </p>
          {isPitch && (
            <p className="truncate text-[9px] text-white/40 leading-tight">
              {player.nameEn}
            </p>
          )}
          {!isPitch && (
            <p className="truncate text-[10px] text-white/50 leading-tight">
              {player.teamNameEn || player.teamName}
            </p>
          )}
        </div>
      )}

      {/* Micro mode: single-line name below badges */}
      {isMicro && (
        <div className="min-w-0 px-1 pb-1">
          <p className="truncate text-[8px] font-semibold text-white leading-tight">
            {player.nameEn || player.name}
          </p>
        </div>
      )}

      {/* ── Stats grid (visible in pitch and full modes) ── */}
      {!isMicro && (
        <div className={`grid grid-cols-3 gap-x-1 gap-y-px border-t border-white/5 ${
          isPitch ? "px-1.5 py-0.5" : "px-2 py-1.5"
        }`}>
          {STAT_KEYS.map(({ key, short }) => (
            <div key={key} className="flex items-center justify-between gap-0.5">
              <span className={`font-medium text-white/40 uppercase tracking-wider ${
                isPitch ? "text-[7px]" : "text-[9px]"
              }`}>
                {short}
              </span>
              <span
                className={`font-bold tabular-nums leading-none ${getStatValueColor(stats[key])} ${
                  isPitch ? "text-[10px]" : "text-[10px]"
                }`}
              >
                {stats[key]}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Price (visible in pitch and full modes) ── */}
      {!isMicro && (
        <div className={`border-t border-white/5 ${isPitch ? "px-1.5 py-0.5" : "px-2 py-1.5"}`}>
          <p className={`font-bold tabular-nums text-yellow-400/90 ${
            isPitch ? "text-[10px]" : "text-[11px]"
          }`}>
            {formatPrice(player.price)}
          </p>
        </div>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={() => onClick(player)}
        className="cursor-pointer hover:scale-[1.03] active:scale-[0.97] transition-transform duration-100"
      >
        {cardContent}
      </button>
    );
  }

  return cardContent;
}
