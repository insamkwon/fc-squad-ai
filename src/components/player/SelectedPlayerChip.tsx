'use client';

import type { Player } from '@/types/player';
import SeasonBadge from '@/components/player/SeasonBadge';

interface SelectedPlayerChipProps {
  player: Player;
  index: number;
  onRemove: (player: Player) => void;
}

/**
 * Compact chip displaying a selected player in the multi-select context.
 * Shows OVR badge, position, name, team, season badge, and a remove button.
 * Designed to be space-efficient while conveying key player info at a glance.
 */
export default function SelectedPlayerChip({
  player,
  index,
  onRemove,
}: SelectedPlayerChipProps) {
  return (
    <div className="group relative flex items-center gap-2 rounded-lg border border-yellow-500/40 bg-gray-800/90 px-2.5 py-2 transition-all hover:border-yellow-500/70">
      {/* Selection order badge */}
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-yellow-500/20 text-[10px] font-bold text-yellow-400">
        {index + 1}
      </span>

      {/* OVR badge */}
      <span
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-xs font-extrabold ${
          player.stats.ovr >= 90
            ? 'bg-yellow-500 text-gray-900'
            : player.stats.ovr >= 85
              ? 'bg-yellow-600 text-gray-900'
              : player.stats.ovr >= 80
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white'
        }`}
      >
        {player.stats.ovr}
      </span>

      {/* Player info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-semibold text-white">
            {player.name}
          </span>
          <span className="flex-shrink-0 rounded px-1 py-px text-[9px] font-bold text-white bg-gray-700">
            {player.position}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="truncate text-[10px] text-gray-400">
            {player.teamName}
          </span>
          <span className="flex-shrink-0 text-[10px] text-gray-600">·</span>
          <SeasonBadge
            cardType={player.cardType}
            compact
          />
        </div>
      </div>

      {/* Remove button */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove(player);
        }}
        className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-red-500/20 hover:text-red-400 active:bg-red-500/30"
        aria-label={`${player.name} 선택 해제`}
      >
        <svg
          className="h-3.5 w-3.5"
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
    </div>
  );
}
