'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import type { SquadCandidate, SquadPlayer, TeamColorSelection } from '@/types/squad';
import SquadCandidateCard from './SquadCandidateCard';
import SquadComparisonSummary from './SquadComparisonSummary';

interface SquadCandidatesViewProps {
  candidates: SquadCandidate[];
  activeIndex: number;
  onActiveChange: (index: number) => void;
  teamColors?: TeamColorSelection | null;
  /** Enable editing mode for the active candidate */
  editing?: boolean;
  /** Called when a slot is clicked in editing mode */
  onSlotClick?: (slotId: string) => void;
  /** Override players for the active candidate when editing */
  editablePlayers?: SquadPlayer[];
}

/** Minimum swipe distance (px) to trigger a tab change */
const SWIPE_THRESHOLD = 50;

export default function SquadCandidatesView({
  candidates,
  activeIndex,
  onActiveChange,
  teamColors,
  editing = false,
  onSlotClick,
  editablePlayers,
}: SquadCandidatesViewProps) {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const [isScrolling, setIsScrolling] = useState(false);

  // Clamp active index within bounds
  const safeIndex = Math.max(0, Math.min(activeIndex, candidates.length - 1));

  // Scroll carousel to active card on index change (mobile)
  useEffect(() => {
    if (!carouselRef.current) return;
    const container = carouselRef.current;
    const cardWidth = container.scrollWidth / candidates.length;
    container.scrollTo({
      left: safeIndex * cardWidth,
      behavior: 'smooth',
    });
  }, [safeIndex, candidates.length]);

  // Touch handlers for swipeable carousel
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Don't start swipe if in editing mode (let slot clicks work)
    if (editing) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    setIsScrolling(false);
  }, [editing]);

  const handleTouchMove = useCallback(() => {
    if (editing) return;
    setIsScrolling(true);
  }, [editing]);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (editing) return;
      if (touchStartX.current === null || touchStartY.current === null) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX.current;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;

      // Only handle horizontal swipes (not diagonal scrolling)
      if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaY) > Math.abs(deltaX)) {
        touchStartX.current = null;
        touchStartY.current = null;
        return;
      }

      if (deltaX < 0 && safeIndex < candidates.length - 1) {
        // Swipe left → next
        onActiveChange(safeIndex + 1);
      } else if (deltaX > 0 && safeIndex > 0) {
        // Swipe right → previous
        onActiveChange(safeIndex - 1);
      }

      touchStartX.current = null;
      touchStartY.current = null;
    },
    [safeIndex, candidates.length, onActiveChange, editing],
  );

  // Handle snap after manual scroll
  const handleScroll = useCallback(() => {
    if (!carouselRef.current || !isScrolling || editing) return;
    const container = carouselRef.current;
    const cardWidth = container.scrollWidth / candidates.length;
    const newIndex = Math.round(container.scrollLeft / cardWidth);
    if (newIndex !== safeIndex && newIndex >= 0 && newIndex < candidates.length) {
      onActiveChange(newIndex);
    }
  }, [isScrolling, candidates.length, safeIndex, onActiveChange, editing]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editing) return;
      if (e.key === 'ArrowLeft' && safeIndex > 0) {
        e.preventDefault();
        onActiveChange(safeIndex - 1);
      } else if (e.key === 'ArrowRight' && safeIndex < candidates.length - 1) {
        e.preventDefault();
        onActiveChange(safeIndex + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [safeIndex, candidates.length, onActiveChange, editing]);

  if (candidates.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {/* Tab Navigation (always visible, acts as indicator on desktop too) */}
      <div className="relative mb-3 sm:mb-4">
        {/* Tab buttons */}
        <div className="flex rounded-xl bg-gray-800/80 p-1 gap-1">
          {candidates.map((candidate, i) => (
            <button
              key={candidate.squad.id}
              type="button"
              onClick={() => !editing && onActiveChange(i)}
              disabled={editing}
              className={`
                relative flex-1 rounded-lg px-2 py-2 sm:px-3 sm:py-2.5 text-sm font-medium transition-all duration-200 tap-target
                ${
                  i === safeIndex
                    ? 'text-gray-900'
                    : editing
                      ? 'text-gray-500 cursor-not-allowed'
                      : 'text-gray-400 hover:text-white'
                }
              `}
            >
              {/* Active background pill */}
              {i === safeIndex && (
                <span className="absolute inset-0 rounded-lg bg-yellow-500 shadow-md shadow-yellow-500/20 animate-in fade-in duration-200" />
              )}

              {/* Tab content */}
              <span className="relative flex items-center justify-center gap-2">
                {/* Number badge */}
                <span
                  className={`
                    inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold
                    ${i === safeIndex
                      ? 'bg-gray-900/20 text-gray-900'
                      : 'bg-gray-700 text-gray-400'
                    }
                  `}
                >
                  {i + 1}
                </span>

                {/* Formation + Score (hidden on very small screens) */}
                <span className="hidden sm:inline-flex items-center gap-1.5">
                  <span className="text-xs">{candidate.squad.formation}</span>
                  <span className={`text-[10px] ${i === safeIndex ? 'text-gray-900/70' : 'text-gray-500'}`}>
                    {candidate.score}점
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>

        {/* Progress dots (mobile only) */}
        <div className="flex sm:hidden justify-center gap-1.5 mt-2">
          {candidates.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => !editing && onActiveChange(i)}
              disabled={editing}
              className={`
                h-1.5 rounded-full transition-all duration-300
                ${i === safeIndex
                  ? 'w-6 bg-yellow-500'
                  : 'w-1.5 bg-gray-600 hover:bg-gray-500'
                }
              `}
              aria-label={`스쿼드 ${i + 1} 선택`}
            />
          ))}
        </div>
      </div>

      {/* Squad Comparison Summary (shown when 2+ candidates and not editing) */}
      {!editing && <SquadComparisonSummary candidates={candidates} />}

      {/* Desktop: 3-column grid layout */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-4">
        {candidates.map((candidate, i) => (
          <div key={candidate.squad.id} className="relative">
            <SquadCandidateCard
              candidate={candidate}
              index={i}
              isActive={i === safeIndex}
              onSelect={onActiveChange}
              teamColors={teamColors}
              editing={editing && i === safeIndex}
              onSlotClick={onSlotClick}
              editablePlayers={editing && i === safeIndex ? editablePlayers : undefined}
            />
          </div>
        ))}
      </div>

      {/* Mobile/Tablet: Swipeable horizontal carousel */}
      <div className="lg:hidden">
        <div
          ref={carouselRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
          style={{
            scrollbarWidth: 'none', // Firefox
            msOverflowStyle: 'none', // IE/Edge
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onScroll={handleScroll}
        >
          {candidates.map((candidate, i) => (
            <div
              key={candidate.squad.id}
              className="flex-shrink-0 w-full snap-center px-1"
            >
              <SquadCandidateCard
                candidate={candidate}
                index={i}
                isActive={i === safeIndex}
                onSelect={onActiveChange}
                teamColors={teamColors}
                compact
                editing={editing && i === safeIndex}
                onSlotClick={onSlotClick}
                editablePlayers={editing && i === safeIndex ? editablePlayers : undefined}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
