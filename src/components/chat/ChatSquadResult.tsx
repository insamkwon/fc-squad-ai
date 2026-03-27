'use client';

import { useState } from 'react';
import type { SquadCandidate, TeamColorSelection } from '@/types/squad';
import FormationView from '@/components/formation/FormationView';
import SquadSummary from '@/components/formation/SquadSummary';
import SynergyPanel from '@/components/formation/SynergyPanel';

interface ChatSquadResultProps {
  /** Squad candidates to display. */
  candidates: SquadCandidate[];
  /** Optional team colors for the pitch. */
  teamColors?: TeamColorSelection | null;
  /** Optional callback when user clicks "자세히 보기" (view in full builder). */
  onViewInBuilder?: () => void;
}

/**
 * Compact inline squad results rendered within the chat conversation.
 *
 * Shows tab navigation between candidates, a compact formation pitch,
 * squad summary stats, and a link to the full squad builder.
 *
 * Designed to fit within the chat message flow without overwhelming the UI.
 */
export default function ChatSquadResult({
  candidates,
  teamColors,
  onViewInBuilder,
}: ChatSquadResultProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [showSynergyDetail, setShowSynergyDetail] = useState(false);

  if (candidates.length === 0) return null;

  const active = candidates[activeIdx];
  if (!active) return null;

  return (
    <div className="space-y-3">
      {/* Candidate tab navigation */}
      {candidates.length > 1 && (
        <div className="flex gap-1">
          {candidates.map((c, i) => (
            <button
              key={c.squad.id}
              type="button"
              onClick={() => setActiveIdx(i)}
              className={`
                flex-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200
                ${i === activeIdx
                  ? 'bg-yellow-500 text-gray-900 shadow-sm'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
                }
              `}
            >
              <span className="flex items-center justify-center gap-1.5">
                <span className="font-bold">{i + 1}</span>
                <span>{c.squad.formation}</span>
                <span className={i === activeIdx ? 'text-gray-900/70' : 'text-gray-500'}>
                  {c.score}점
                </span>
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Active candidate card */}
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 overflow-hidden">
        {/* Candidate header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-700/30">
          <div className="flex items-center gap-2">
            {/* Number badge */}
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-yellow-500 text-gray-900 text-[10px] font-bold">
              {activeIdx + 1}
            </span>
            {/* Formation badge */}
            <span className="rounded bg-blue-500/15 border border-blue-500/30 px-1.5 py-0.5 text-[10px] font-bold text-blue-300">
              {active.squad.formation}
            </span>
            {/* Score */}
            <span
              className={`
                text-[10px] font-bold px-1.5 py-0.5 rounded-full
                ${active.score >= 80
                  ? 'bg-green-500/15 text-green-400 border border-green-500/30'
                  : active.score >= 60
                    ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                    : 'bg-gray-500/15 text-gray-400 border border-gray-500/30'
                }
              `}
            >
              {active.score}점
            </span>
          </div>
        </div>

        {/* Formation pitch (compact) */}
        <div className="flex justify-center py-2">
          <div className="w-full max-w-[240px] sm:max-w-[280px]">
            <FormationView
              formation={active.squad.formation}
              players={active.squad.players}
              teamColors={teamColors}
              compact
            />
          </div>
        </div>

        {/* Squad summary */}
        <div className="px-2 pb-2">
          <SquadSummary
            squad={active.squad}
            showSynergyDetail={showSynergyDetail}
            onToggleSynergyDetail={() => setShowSynergyDetail(!showSynergyDetail)}
          />
        </div>

        {/* Expanded synergy detail */}
        {showSynergyDetail && (
          <div className="px-2 pb-2">
            <SynergyPanel squad={active.squad} expanded />
          </div>
        )}

        {/* Reasoning */}
        {active.reasoning && (
          <div className="px-3 pb-2">
            <p className="text-[11px] text-gray-400 leading-relaxed">
              {active.reasoning}
            </p>
          </div>
        )}
      </div>

      {/* "View in builder" link */}
      {onViewInBuilder && (
        <button
          type="button"
          onClick={onViewInBuilder}
          className="
            w-full rounded-lg border border-gray-700/50 bg-gray-800/30 px-3 py-2
            text-xs text-gray-400 hover:text-white hover:border-gray-600
            transition-colors flex items-center justify-center gap-1.5
          "
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
          스쿼드 빌더에서 자세히 보기
        </button>
      )}
    </div>
  );
}
