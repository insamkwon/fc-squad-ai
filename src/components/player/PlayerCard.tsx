"use client";

import Image from "next/image";
import type { Player } from "@/types/player";
import {
  STAT_KEYS,
  formatPrice,
  getOvrBadgeColor,
  getPositionColor,
} from "@/lib/stat-utils";
import { getPlayerImageUrl } from "@/lib/player-utils";
import SeasonBadge from "@/components/player/SeasonBadge";
import StatBar from "@/components/player/StatBar";

interface PlayerCardProps {
  player: Player;
  selected?: boolean;
  onClick?: (player: Player) => void;
}

export default function PlayerCard({ player, selected = false, onClick }: PlayerCardProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(player)}
      className={`
        w-full text-left rounded-xl border transition-all duration-150 active:scale-[0.98]
        ${
          selected
            ? "border-yellow-500 bg-gray-800/90 ring-1 ring-yellow-500/50"
            : "border-gray-800 bg-gray-900 hover:border-gray-600 active:bg-gray-800/80"
        }
      `}
    >
      {/* Top section: image placeholder + OVR + info */}
      <div className="flex gap-2.5 p-2.5 sm:gap-3 sm:p-3">
        {/* Player image */}
        <div className="relative flex-shrink-0">
          <div className="relative flex h-14 w-14 overflow-hidden rounded-lg bg-gradient-to-br from-gray-700 to-gray-800 sm:h-20 sm:w-20">
            <Image
              src={getPlayerImageUrl(player.pid)}
              alt={player.name}
              fill
              sizes="56px"
              className="sm:sizes-[80px] object-cover"
              unoptimized
            />
          </div>
          {/* Position badge */}
          <span
            className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white ${getPositionColor(player.position)}`}
          >
            {player.position}
          </span>
          {/* OVR badge */}
          <span
            className={`absolute -top-1.5 -left-1.5 flex h-6 w-6 items-center justify-center rounded-md text-[11px] font-extrabold sm:h-7 sm:w-7 sm:text-xs ${getOvrBadgeColor(player.stats.ovr)}`}
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
          <p className="mt-1.5 text-sm font-bold text-yellow-400">{formatPrice(player.price)}</p>
        </div>
      </div>

      {/* Stats bars */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-gray-800 px-2.5 py-2 sm:gap-x-6 sm:gap-y-1 sm:px-3">
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
