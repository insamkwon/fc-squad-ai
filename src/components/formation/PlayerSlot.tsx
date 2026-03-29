'use client';

import type { Player } from '@/types/player';
import type { FormationSlot } from '@/types/squad';
import CompactPlayerCard from '@/components/player/CompactPlayerCard';

interface PlayerSlotProps {
  player?: Player;
  slot: FormationSlot;
  /** Whether this player has any chemistry link with an adjacent teammate */
  showChemistryLink?: boolean;
  /** Type of chemistry link for color coding the indicator dot */
  chemistryType?: 'team' | 'league';
  onClick?: () => void;
  /** Whether the slot is in editing mode (visual feedback) */
  editing?: boolean;
  /**
   * Card display mode for responsive scaling.
   * - "pitch": Full pitch mode with stats (default)
   * - "micro": Ultra-compact for mobile chat contexts (OVR + position + name)
   */
  cardMode?: 'pitch' | 'micro';
}

/**
 * Color configuration for chemistry link indicator dots.
 */
const CHEM_DOT_STYLES: Record<string, string> = {
  team: 'bg-green-400 border-green-300 shadow-green-400/50',
  league: 'bg-yellow-400 border-yellow-300 shadow-yellow-400/50',
};

export default function PlayerSlot({
  player,
  slot,
  showChemistryLink = false,
  chemistryType,
  onClick,
  editing = false,
  cardMode = 'pitch',
}: PlayerSlotProps) {
  const isMicro = cardMode === 'micro';
  const dotStyle = chemistryType
    ? CHEM_DOT_STYLES[chemistryType]
    : 'bg-white/70 border-white/50 shadow-white/30';

  return (
    <div
      className="absolute transform -translate-x-1/2 -translate-y-1/2"
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
      }}
    >
      {/* Chemistry link indicator dot */}
      {showChemistryLink && player && (
        <div
          className={`absolute -top-1 -right-1 rounded-full border shadow-sm z-10 ${
            isMicro ? 'w-2 h-2' : 'w-2.5 h-2.5'
          } ${dotStyle}`}
          aria-label={
            chemistryType === 'team'
              ? 'Same team chemistry link'
              : chemistryType === 'league'
                ? 'Same league chemistry link'
                : 'Chemistry link'
          }
        />
      )}

      {/* Main card or empty slot */}
      {player ? (
        <button
          type="button"
          className={`
            cursor-pointer transition-transform duration-150 group
            ${editing ? 'hover:scale-110 active:scale-95 ring-1 ring-green-400/40 rounded-lg' : 'hover:scale-105 active:scale-95'}
            tap-target-formation
          `}
          onClick={onClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onClick?.();
            }
          }}
          aria-label={`${player.nameEn || player.name} - ${player.position} - OVR ${player.stats.ovr}${editing ? ' - 탭하여 교체' : ''}`}
        >
          <CompactPlayerCard player={player} mode={cardMode} />
          {/* Editing indicator overlay (hidden in micro mode for space) */}
          {editing && !isMicro && (
            <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/0 group-hover:bg-black/30 transition-colors pointer-events-none">
              <svg className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
            </div>
          )}
        </button>
      ) : (
        <button
          type="button"
          className={`
            relative rounded-full flex items-center justify-center cursor-pointer transition-all duration-150
            ${editing
              ? 'w-9 h-9 sm:w-10 sm:h-10 bg-green-500/10 border-2 border-dashed border-green-400/40 hover:bg-green-500/20 hover:border-green-400/60'
              : isMicro
                ? 'w-5 h-5 sm:w-6 sm:h-6 bg-white/10 border border-dashed border-white/25 hover:bg-white/20 hover:border-white/40'
                : 'w-7 h-7 sm:w-8 sm:h-8 bg-white/10 border-2 border-dashed border-white/30 hover:bg-white/20 hover:border-white/50'
            }
          `}
          onClick={onClick}
          aria-label={`${editing ? '선수 추가' : 'Add player'} at ${slot.position}`}
        >
          <svg
            width={isMicro ? 8 : 12}
            height={isMicro ? 8 : 12}
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={editing ? 'text-green-400' : 'text-white/50'}
          >
            <path
              d="M7 1v12M1 7h12"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          {/* Expanded touch area for mobile (invisible, ensures 44x44 min tap target) */}
          <span className="absolute -inset-2" />
        </button>
      )}
    </div>
  );
}
