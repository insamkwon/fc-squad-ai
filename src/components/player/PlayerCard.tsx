"use client";

import type { Player } from "@/types/player";
import type { CardType } from "@/types/player";
import {
  STAT_KEYS,
  formatPrice,
  getOvrBadgeColor,
  getPositionColor,
} from "@/lib/stat-utils";
import SeasonBadge from "@/components/player/SeasonBadge";
import StatBar from "@/components/player/StatBar";
import PlayerImage from "@/components/player/PlayerImage";

interface PlayerCardProps {
  player: Player;
  selected?: boolean;
  onClick?: (player: Player) => void;
}

/**
 * Card type → left accent stripe color.
 * Gives each card type an instant visual identity without overwhelming the card.
 */
const CARD_TYPE_ACCENT: Record<CardType, string> = {
  BASE: "from-gray-500/60 to-gray-600/30",
  SPECIAL: "from-amber-400/80 to-yellow-500/30",
  ICON: "from-purple-400/80 to-violet-500/30",
  LIVE: "from-emerald-400/80 to-green-500/30",
  MOM: "from-cyan-400/80 to-teal-500/30",
  POTW: "from-sky-400/80 to-blue-500/30",
};

export default function PlayerCard({ player, selected = false, onClick }: PlayerCardProps) {
  const accent = CARD_TYPE_ACCENT[player.cardType] ?? CARD_TYPE_ACCENT.BASE;

  return (
    <button
      type="button"
      onClick={() => onClick?.(player)}
      className={`
        w-full text-left rounded-xl border transition-all duration-200 active:scale-[0.98]
        ${selected
          ? "border-yellow-500/70 bg-gray-800/95 ring-1 ring-yellow-500/30 shadow-lg shadow-yellow-500/5"
          : "border-gray-800/60 bg-gray-900/80 hover:border-gray-600/60 hover:bg-gray-800/60"
        }
      `}
    >
      {/* Top section: image + OVR + info */}
      <div className="flex gap-2.5 p-2.5 sm:gap-3 sm:p-3">
        {/* Player image with accent glow */}
        <div className="relative flex-shrink-0">
          {/* Accent gradient background behind image */}
          <div className={`absolute -inset-0.5 rounded-xl bg-gradient-to-br ${accent} blur-sm opacity-40`} />
          <div className="relative flex h-14 w-14 overflow-hidden rounded-xl sm:h-20 sm:w-20 ring-1 ring-white/10">
            <PlayerImage
              spid={player.spid}
              name={player.name}
              nameEn={player.nameEn}
              position={player.position}
              size="lg"
            />
          </div>
          {/* Position badge */}
          <span
            className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white ring-1 ring-black/30 ${getPositionColor(player.position)}`}
          >
            {player.position}
          </span>
          {/* OVR badge */}
          <span
            className={`absolute -top-1.5 -left-1.5 flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-extrabold sm:h-7 sm:w-7 sm:text-xs ring-1 ring-black/20 ${getOvrBadgeColor(player.stats.ovr)}`}
          >
            {player.stats.ovr}
          </span>
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-white sm:text-base">
            {player.name}
          </h3>
          <p className="truncate text-xs text-gray-400">{player.nameEn}</p>
          <p className="mt-0.5 truncate text-xs text-gray-500">{player.teamName}</p>
          <div className="mt-1">
            <SeasonBadge
              cardType={player.cardType}
              seasonName={player.seasonName}
            />
          </div>
          <p className="mt-1.5 text-sm font-bold tabular-nums text-yellow-400/90">{formatPrice(player.price)}</p>
        </div>
      </div>

      {/* Stats bars */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-white/5 px-2.5 py-2 sm:gap-x-6 sm:gap-y-1 sm:px-3">
        {STAT_KEYS.map(({ key, label, color }) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className="w-7 text-[10px] font-medium text-gray-500 sm:w-8">{label}</span>
            <StatBar
              value={player.stats[key]}
              color={color}
              size="sm"
              showValue
            />
          </div>
        ))}
      </div>
    </button>
  );
}
