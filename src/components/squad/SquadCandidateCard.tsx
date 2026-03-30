'use client';

import { useState } from 'react';
import type { SquadCandidate, SquadPlayer, TeamColorSelection } from '@/types/squad';
import FormationView from '@/components/formation/FormationView';
import SquadSummary from '@/components/formation/SquadSummary';
import SynergyPanel from '@/components/formation/SynergyPanel';

interface SquadCandidateCardProps {
  candidate: SquadCandidate;
  index: number;
  isActive: boolean;
  onSelect: (index: number) => void;
  teamColors?: TeamColorSelection | null;
  compact?: boolean;
  /** Enable manual editing mode — slots become tappable */
  editing?: boolean;
  /** Called when a slot is clicked in editing mode */
  onSlotClick?: (slotId: string) => void;
  /** Override players when editing (from useSquadBuilder hook) */
  editablePlayers?: SquadPlayer[];
}

/**
 * Score badge styles based on score tier.
 */
function getScoreStyle(score: number) {
  if (score >= 85) return {
    badge: 'bg-gradient-to-r from-amber-400 to-yellow-300 text-gray-900 border-amber-300/50',
    ring: 'shadow-amber-400/20',
  };
  if (score >= 70) return {
    badge: 'bg-green-500/15 text-green-400 border-green-500/30',
    ring: '',
  };
  if (score >= 50) return {
    badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25',
    ring: '',
  };
  return {
    badge: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    ring: '',
  };
}

export default function SquadCandidateCard({
  candidate,
  index,
  isActive,
  onSelect,
  teamColors,
  compact = false,
  editing = false,
  onSlotClick,
  editablePlayers,
}: SquadCandidateCardProps) {
  const { squad, score, reasoning } = candidate;
  const [showSynergyDetail, setShowSynergyDetail] = useState(false);

  const displayPlayers = editing && editablePlayers ? editablePlayers : squad.players;
  const displaySquad = editing && editablePlayers
    ? { ...squad, players: editablePlayers }
    : squad;

  const scoreStyle = getScoreStyle(score);

  // When editing, the card is a div (not a button) so slot clicks work properly
  if (editing) {
    return (
      <div
        className={`
          w-full text-left rounded-xl border-2 transition-all duration-200 overflow-hidden relative
          border-yellow-500 bg-gray-800/80 shadow-lg shadow-yellow-500/10 ring-1 ring-yellow-500/20
          ${compact ? 'p-2' : 'p-3'}
        `}
      >
        {/* Header: Label + Formation + Score + Edit indicator */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-yellow-500 text-gray-900">
              {index + 1}
            </span>
            <span className="rounded-md bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 text-xs font-bold text-blue-300">
              {squad.formation}
            </span>
            <span className="flex items-center gap-1 rounded-full bg-green-500/10 border border-green-500/30 px-2 py-0.5 text-[10px] font-bold text-green-400">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
              </svg>
              편집
            </span>
          </div>

          <span className={`text-xs font-bold tabular-nums px-2.5 py-0.5 rounded-full border shadow-sm ${scoreStyle.badge} ${scoreStyle.ring}`}>
            {score}점
          </span>
        </div>

        <div className="flex items-center justify-center gap-1.5 mb-2">
          <svg className="w-3.5 h-3.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
          </svg>
          <span className="text-[10px] text-gray-500">포지션을 탭하여 선수를 추가/교체하세요</span>
        </div>

        <div className="mx-auto w-full">
          <FormationView
            formation={squad.formation}
            players={displayPlayers}
            onSlotClick={onSlotClick}
            teamColors={teamColors}
            compact={compact}
          />
        </div>

        <div className="mt-1">
          <SquadSummary
            squad={displaySquad}
            showSynergyDetail={showSynergyDetail}
            onToggleSynergyDetail={() => setShowSynergyDetail(!showSynergyDetail)}
          />
        </div>

        {showSynergyDetail && (
          <SynergyPanel squad={displaySquad} expanded />
        )}
      </div>
    );
  }

  // Default: non-editing card
  return (
    <button
      type="button"
      onClick={() => onSelect(index)}
      className={`
        w-full text-left rounded-xl border-2 transition-all duration-200 overflow-hidden relative
        ${
          isActive
            ? 'border-yellow-500/80 bg-gray-800/80 shadow-lg shadow-yellow-500/10 ring-1 ring-yellow-500/20'
            : 'border-gray-700/40 bg-gray-900/40 hover:border-gray-600/60 hover:bg-gray-800/40'
        }
        ${compact ? 'p-2' : 'p-3'}
      `}
    >
      {/* Header: Label + Formation + Score */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* Candidate number badge */}
          <span
            className={`
              inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold transition-all duration-200
              ${isActive
                ? 'bg-yellow-500 text-gray-900 shadow-md shadow-yellow-500/30'
                : 'bg-gray-700/80 text-gray-300'
              }
            `}
          >
            {index + 1}
          </span>

          {/* Formation badge */}
          <span className="rounded-md bg-blue-500/10 border border-blue-500/25 px-2 py-0.5 text-xs font-bold text-blue-300">
            {squad.formation}
          </span>
        </div>

        {/* Score badge */}
        <span className={`text-xs font-bold tabular-nums px-2.5 py-0.5 rounded-full border shadow-sm ${scoreStyle.badge} ${scoreStyle.ring}`}>
          {score}점
        </span>
      </div>

      {/* Formation Pitch */}
      <div className="mx-auto w-full">
        <FormationView
          formation={squad.formation}
          players={squad.players}
          teamColors={teamColors}
          compact={compact}
        />
      </div>

      {/* Squad Summary with synergy link counts */}
      <div className="mt-1">
        <SquadSummary
          squad={squad}
          showSynergyDetail={showSynergyDetail}
          onToggleSynergyDetail={() => setShowSynergyDetail(!showSynergyDetail)}
        />
      </div>

      {/* Expanded: Full synergy detail panel */}
      {showSynergyDetail && (
        <SynergyPanel squad={squad} expanded />
      )}

      {/* Reasoning (only when active or on desktop) */}
      <div className={`mt-2 ${isActive ? 'block' : 'hidden lg:block'}`}>
        <p className="text-xs text-gray-400 leading-relaxed line-clamp-2">
          {reasoning}
        </p>
      </div>

      {/* Active indicator dot */}
      {isActive && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-3 h-3 rounded-full bg-yellow-500 border-2 border-gray-950 shadow-sm shadow-yellow-500/50 hidden lg:block" />
      )}
    </button>
  );
}
