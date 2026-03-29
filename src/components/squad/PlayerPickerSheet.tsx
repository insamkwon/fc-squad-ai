'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { Player } from '@/types/player';
import type { SlotSelection } from '@/hooks/useSquadBuilder';
import { getPositionCompatibility } from '@/lib/formation-layout';
import {
  formatPrice,
  getOvrBadgeColor,
  getStatValueColor,
} from '@/lib/stat-utils';
import PlayerImage from '@/components/player/PlayerImage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayerPickerSheetProps {
  /** The currently selected slot (null = sheet closed) */
  selection: SlotSelection | null;
  /** Called when user taps a player to assign them to the slot */
  onSelectPlayer: (player: Player) => void;
  /** Called when user wants to remove the current player */
  onRemovePlayer: (slotId: string) => void;
  /** Called when user closes the sheet without action */
  onClose: () => void;
  /** Check if a player is already in the squad (to show "already added" state) */
  isPlayerInSquad: (spid: number) => boolean;
}

// ---------------------------------------------------------------------------
// Position compatibility helpers
// ---------------------------------------------------------------------------

/** Get all positions compatible with the slot position, sorted by compatibility */
function getCompatiblePositions(slotPosition: string): string[] {
  const ALL_POSITIONS: string[] = [
    'ST', 'CF', 'LF', 'RF', 'LW', 'RW', 'CAM', 'CM',
    'CDM', 'LM', 'RM', 'LB', 'RB', 'CB', 'LWB', 'RWB', 'GK',
  ];

  return ALL_POSITIONS.map((pos) => ({
    pos,
    score: getPositionCompatibility(pos, slotPosition),
  }))
    .filter((p) => p.score >= 0.6) // Only show reasonably compatible positions
    .sort((a, b) => b.score - a.score)
    .map((p) => p.pos);
}

/** Group positions into categories for chip display */
function getPositionChips(slotPosition: string): { label: string; positions: string[] }[] {
  const compatible = getCompatiblePositions(slotPosition);
  const categoryMap: Record<string, { label: string; positions: string[] }> = {
    '정포지션': { label: '정포지션', positions: [] },
    '유사': { label: '유사', positions: [] },
  };

  for (const pos of compatible) {
    const score = getPositionCompatibility(pos, slotPosition);
    if (score >= 0.95) {
      categoryMap['정포지션'].positions.push(pos);
    } else {
      categoryMap['유사'].positions.push(pos);
    }
  }

  // Add "전체" option
  return [
    { label: '전체', positions: [] },
    ...Object.values(categoryMap).filter((c) => c.positions.length > 0),
  ];
}

// ---------------------------------------------------------------------------
// Player search response type
// ---------------------------------------------------------------------------

interface PlayerSearchResult {
  results: Player[];
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PlayerPickerSheet({
  selection,
  onSelectPlayer,
  onRemovePlayer,
  onClose,
  isPlayerInSquad,
}: PlayerPickerSheetProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPositions, setSelectedPositions] = useState<string[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const PAGE_SIZE = 20;

  // Position chips based on slot position
  const positionChips = useMemo(() => {
    if (!selection) return [];
    return getPositionChips(selection.slot.position);
  }, [selection]);

  // Determine which positions to filter by
  const activeFilterPositions = useMemo(() => {
    if (selectedPositions.length === 0) {
      // Default: use compatible positions for the slot
      return getCompatiblePositions(selection?.slot.position ?? '');
    }
    return selectedPositions;
  }, [selectedPositions, selection]);

  // Fetch players when search/filter changes
  const fetchPlayers = useCallback(
    async (query: string, positions: string[], startOffset = 0, append = false) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);

      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set('search', query.trim());
        if (positions.length > 0) params.set('positions', positions.join(','));
        params.set('limit', String(PAGE_SIZE));
        params.set('offset', String(startOffset));
        // Sort by OVR descending
        params.set('minOvr', '1');

        const res = await fetch(`/api/players?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;

        const data: PlayerSearchResult = await res.json();
        // Sort by OVR desc
        data.results.sort((a, b) => b.stats.ovr - a.stats.ovr);

        if (append) {
          setPlayers((prev) => {
            // Deduplicate by spid
            const existingSpids = new Set(prev.map((p) => p.spid));
            const newPlayers = data.results.filter((p) => !existingSpids.has(p.spid));
            return [...prev, ...newPlayers];
          });
        } else {
          setPlayers(data.results);
        }
        setTotal(data.total);
        setHasMore(startOffset + data.results.length < data.total);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Failed to fetch players:', err);
        }
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Initial fetch and refetch on filter changes
  useEffect(() => {
    if (!selection) return;

    // Reset state when selection changes
    setSearchQuery('');
    setSelectedPositions([]);
    setOffset(0);

    const compatible = getCompatiblePositions(selection.slot.position);
    fetchPlayers('', compatible, 0);
  }, [selection, fetchPlayers]);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!selection) return;

    searchTimerRef.current = setTimeout(() => {
      setOffset(0);
      fetchPlayers(searchQuery, activeFilterPositions, 0);
    }, 250);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [searchQuery, activeFilterPositions, selection, fetchPlayers]);

  // Focus search input when sheet opens
  useEffect(() => {
    if (selection) {
      // Delay focus to let the animation start
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        // Close mobile keyboard if on mobile (don't auto-focus on very small screens)
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [selection]);

  // Cleanup
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  // Load more players (infinite scroll)
  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;
    const newOffset = offset + PAGE_SIZE;
    setOffset(newOffset);
    fetchPlayers(searchQuery, activeFilterPositions, newOffset, true);
  }, [loading, hasMore, offset, searchQuery, activeFilterPositions, fetchPlayers]);

  // Handle position chip toggle
  const togglePositionFilter = useCallback((positions: string[]) => {
    setSelectedPositions((prev) => {
      if (positions.length === 0) {
        // "All" chip
        return [];
      }
      // Toggle: if same positions are already selected, deselect; otherwise select
      const key = positions.join(',');
      const prevKey = prev.join(',');
      if (prevKey === key) return [];
      return positions;
    });
  }, []);

  // Handle player selection
  const handleSelectPlayer = useCallback(
    (player: Player) => {
      // Vibrate feedback if available (mobile)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
      onSelectPlayer(player);
    },
    [onSelectPlayer],
  );

  // Close on backdrop tap
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  if (!selection) return null;

  const slotLabel = `${selection.slot.position} 포지션`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-label={`${slotLabel} 선수 선택`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-backdrop-fade" />

      {/* Sheet */}
      <div className="relative w-full max-w-lg bg-gray-900 rounded-t-2xl border-t border-gray-700 shadow-2xl animate-slide-up max-h-[88vh] flex flex-col safe-bottom">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-600" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-500/15 border border-blue-500/30 text-xs font-bold text-blue-300">
              {selection.slot.position}
            </span>
            <span className="text-sm font-semibold text-white">{slotLabel} 선수 선택</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Remove button (only for replace mode) */}
            {selection.currentPlayer && (
              <button
                type="button"
                onClick={() => onRemovePlayer(selection.slotId)}
                className="flex items-center gap-1 rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 active:bg-red-500/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                제거
              </button>
            )}

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-gray-800 text-gray-400 hover:text-white active:bg-gray-700 transition-colors"
              aria-label="닫기"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3 flex-shrink-0">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3">
              <svg className="h-4.5 w-4.5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
            </div>
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="선수 이름 검색..."
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              className="w-full rounded-xl border border-gray-700 bg-gray-800 py-3 pl-10 pr-10 text-sm text-white placeholder-gray-500 outline-none transition-colors focus:border-yellow-500/60 focus:ring-1 focus:ring-yellow-500/30"
            />
            {searchQuery.length > 0 && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 z-10 flex items-center pr-3 text-gray-500 hover:text-gray-300"
                aria-label="검색어 지우기"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Position filter chips */}
        {positionChips.length > 1 && (
          <div className="px-4 pb-3 flex-shrink-0">
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              {positionChips.map((chip) => {
                const isActive =
                  chip.positions.length === 0
                    ? selectedPositions.length === 0
                    : chip.positions.join(',') === selectedPositions.join(',');

                return (
                  <button
                    key={chip.label}
                    type="button"
                    onClick={() => togglePositionFilter(chip.positions)}
                    className={`flex-shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors active:scale-95 ${
                      isActive
                        ? 'bg-yellow-500 text-gray-900'
                        : 'bg-gray-800 text-gray-400 border border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    {chip.positions.length === 0 ? '전체' : chip.label}
                    {chip.positions.length > 0 && (
                      <span className="ml-1 opacity-70">{chip.positions.length}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Results count */}
        <div className="px-4 pb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-gray-500">
              {loading ? '검색 중...' : `총 ${total}명`}
            </span>
            {searchQuery && (
              <span className="text-[11px] text-gray-600">
                &quot;{searchQuery}&quot; 검색 결과
              </span>
            )}
          </div>
        </div>

        {/* Player list (scrollable) */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto overscroll-contain px-2 pb-4 min-h-0"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
              loadMore();
            }
          }}
        >
          {loading && players.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-yellow-400" />
            </div>
          )}

          {!loading && players.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <svg className="w-10 h-10 text-gray-700 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
              </svg>
              <p className="text-sm text-gray-500">검색 결과가 없습니다</p>
              <p className="text-xs text-gray-600 mt-1">다른 포지션이나 검색어를 시도해 보세요</p>
            </div>
          )}

          {players.map((player) => {
            const alreadyInSquad = isPlayerInSquad(player.spid);
            const isCurrentPlayer = selection.currentPlayer?.spid === player.spid;
            const compatScore = getPositionCompatibility(player.position, selection.slot.position);
            const isPerfectMatch = compatScore >= 0.95;

            return (
              <button
                key={player.spid}
                type="button"
                onClick={() => handleSelectPlayer(player)}
                disabled={alreadyInSquad && !isCurrentPlayer}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all active:scale-[0.98] mb-1 ${
                  alreadyInSquad && !isCurrentPlayer
                    ? 'opacity-40 cursor-not-allowed'
                    : 'hover:bg-gray-800/80 active:bg-gray-800'
                } ${isCurrentPlayer ? 'bg-blue-500/10 border border-blue-500/20' : ''}`}
              >
                {/* Player image + OVR badge */}
                <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg">
                  <PlayerImage
                    spid={player.spid}
                    name={player.name}
                    nameEn={player.nameEn}
                    position={player.position}
                    size="sm"
                  />
                  <span
                    className={`absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-sm text-[8px] font-extrabold ${getOvrBadgeColor(player.stats.ovr)}`}
                  >
                    {player.stats.ovr}
                  </span>
                </div>

                {/* Player info */}
                <div className="min-w-0 flex-1">
                  {/* Name row */}
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold text-white">
                      {player.nameEn || player.name}
                    </span>
                    {/* Compatibility indicator */}
                    {!isPerfectMatch && (
                      <span className="flex-shrink-0 text-[9px] text-gray-500 bg-gray-800 rounded px-1">
                        유사
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-gray-400 mt-0.5">
                    {player.teamNameEn || player.teamName}
                  </p>
                  {/* Stats row - top 3 key stats */}
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[10px] font-bold ${getStatValueColor(player.stats.pace)}`}>
                      PAC {player.stats.pace}
                    </span>
                    <span className={`text-[10px] font-bold ${getStatValueColor(player.stats.shooting)}`}>
                      SHO {player.stats.shooting}
                    </span>
                    <span className={`text-[10px] font-bold ${getStatValueColor(player.stats.passing)}`}>
                      PAS {player.stats.passing}
                    </span>
                  </div>
                </div>

                {/* Price + action */}
                <div className="flex-shrink-0 text-right">
                  <p className="text-xs font-bold text-yellow-400">
                    {formatPrice(player.price)}
                  </p>
                  {alreadyInSquad && !isCurrentPlayer ? (
                    <span className="text-[9px] text-gray-500 mt-0.5 block">이미 포함</span>
                  ) : isCurrentPlayer ? (
                    <span className="text-[9px] text-blue-400 mt-0.5 block">현재 선수</span>
                  ) : (
                    <span className="text-[9px] text-gray-500 mt-0.5 block">선택</span>
                  )}
                </div>
              </button>
            );
          })}

          {/* Load more indicator */}
          {loading && players.length > 0 && (
            <div className="flex items-center justify-center py-4">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-yellow-400" />
            </div>
          )}

          {hasMore && !loading && (
            <button
              type="button"
              onClick={loadMore}
              className="w-full py-3 text-center text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              더 보기 ({total - players.length - offset}명 남음)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
