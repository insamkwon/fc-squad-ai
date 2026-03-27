'use client';

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import type { Player } from '@/types/player';
import type { SquadPlayer } from '@/types/squad';
import { formatPrice } from '@/lib/stat-utils';
import SelectedPlayerChip from './SelectedPlayerChip';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayerMultiSelectProps {
  /** Currently selected players (controlled) */
  selected: Player[];
  /** Callback when selection changes */
  onChange: (players: Player[]) => void;
  /** Maximum number of selectable players (default: 3) */
  maxSelect?: number;
  /** Players from existing squad that can also be selected */
  squadPlayers?: SquadPlayer[];
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Label text shown above the component */
  label?: string;
  /** Extra CSS classes for the outer wrapper */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPositionColor(pos: string): string {
  if (pos === 'ST' || pos === 'CF' || pos === 'LF' || pos === 'RF') return 'bg-red-600';
  if (pos === 'LW' || pos === 'RW') return 'bg-orange-500';
  if (pos === 'CAM' || pos === 'CM' || pos === 'CDM' || pos === 'LM' || pos === 'RM') return 'bg-green-600';
  if (pos === 'CB' || pos === 'LB' || pos === 'RB' || pos === 'LWB' || pos === 'RWB') return 'bg-blue-600';
  if (pos === 'GK') return 'bg-yellow-600';
  return 'bg-gray-600';
}

function getOvrBadgeColor(ovr: number): string {
  if (ovr >= 90) return 'bg-yellow-500 text-gray-900';
  if (ovr >= 85) return 'bg-yellow-600 text-gray-900';
  if (ovr >= 80) return 'bg-green-600 text-white';
  if (ovr >= 75) return 'bg-blue-600 text-white';
  return 'bg-gray-600 text-white';
}

// ---------------------------------------------------------------------------
// Search Result Item
// ---------------------------------------------------------------------------

function SearchResultItem({
  player,
  selected,
  onSelect,
}: {
  player: Player;
  selected: boolean;
  onSelect: (player: Player) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(player)}
      disabled={selected}
      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
        selected
          ? 'bg-yellow-500/10 cursor-default'
          : 'hover:bg-gray-700/60 cursor-pointer'
      }`}
    >
      {/* Mini OVR badge */}
      <span
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md text-xs font-extrabold ${getOvrBadgeColor(player.stats.ovr)}`}
      >
        {player.stats.ovr}
      </span>

      {/* Player info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-white">
            {player.name}
          </span>
          <span className="text-[10px] text-gray-500">{player.nameEn}</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span
            className={`inline-flex items-center rounded px-1 py-px text-[9px] font-bold text-white ${getPositionColor(player.position)}`}
          >
            {player.position}
          </span>
          <span className="truncate text-[11px] text-gray-400">
            {player.teamName}
          </span>
          <span className="text-[11px] text-yellow-400/80 font-medium">
            {formatPrice(player.price)}
          </span>
        </div>
      </div>

      {/* Check indicator */}
      <div className="flex-shrink-0">
        {selected ? (
          <svg className="h-5 w-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
        )}
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function PlayerMultiSelect({
  selected,
  onChange,
  maxSelect = 3,
  squadPlayers = [],
  placeholder = '선수 이름 검색 (한국어 / English)',
  label,
  className = '',
}: PlayerMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'squad'>('search');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const isAtMax = selected.length >= maxSelect;
  const selectedSpids = useMemo(
    () => new Set(selected.map((p) => p.spid)),
    [selected],
  );

  // Derive available squad players (exclude already selected)
  const availableSquadPlayers = useMemo(() => {
    if (!squadPlayers || squadPlayers.length === 0) return [];
    return squadPlayers.filter((sp) => !selectedSpids.has(sp.player.spid));
  }, [squadPlayers, selectedSpids]);

  // Show squad tab only when there are squad players to pick from
  const showSquadTab = squadPlayers.length > 0;

  // ------ Click outside to close ------
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ------ Escape key to close ------
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, []);

  // ------ Fetch suggestions ------
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    if (!query.trim()) {
      setSuggestions([]);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      // Abort previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const params = new URLSearchParams({
          q: query.trim(),
          limit: '12',
        });
        const res = await fetch(`/api/players/suggest?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data: Player[] = await res.json();
        // Sort by OVR descending
        data.sort((a, b) => b.stats.ovr - a.stats.ovr);
        setSuggestions(data);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Failed to fetch suggestions:', err);
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query]);

  // ------ Cleanup on unmount ------
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ------ Handlers ------
  const handleSelect = useCallback(
    (player: Player) => {
      if (selectedSpids.has(player.spid) || isAtMax) return;
      onChange([...selected, player]);
    },
    [selected, selectedSpids, isAtMax, onChange],
  );

  const handleRemove = useCallback(
    (player: Player) => {
      onChange(selected.filter((p) => p.spid !== player.spid));
    },
    [selected, onChange],
  );

  const handleClearAll = useCallback(() => {
    onChange([]);
  }, [onChange]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setQuery(val);
      // Auto-switch to search tab when typing
      if (val.trim()) setActiveTab('search');
    },
    [],
  );

  const handleFocus = useCallback(() => {
    setIsOpen(true);
  }, []);

  // ------ Filter search results to exclude already selected ------
  const filteredSuggestions = useMemo(
    () => suggestions.filter((p) => !selectedSpids.has(p.spid)),
    [suggestions, selectedSpids],
  );

  // ------ Render ------
  return (
    <div className={className} ref={containerRef}>
      {/* Label */}
      {label && (
        <div className="mb-2 flex items-center justify-between">
          <label className="text-sm font-medium text-gray-300">{label}</label>
          <span className="text-xs text-gray-500">
            {selected.length}/{maxSelect} 선택됨
          </span>
        </div>
      )}

      {/* Selected players chips */}
      {selected.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selected.map((player, index) => (
            <SelectedPlayerChip
              key={player.spid}
              player={player}
              index={index}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Search input trigger */}
      <div className="relative">
        {/* Search icon */}
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 z-10">
          <svg
            className="h-4 w-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={isAtMax ? `최대 ${maxSelect}명까지 선택 가능` : placeholder}
          disabled={isAtMax}
          readOnly={isAtMax}
          className={`w-full rounded-xl border bg-gray-800 py-3 pl-10 pr-10 text-sm text-white placeholder-gray-500 outline-none transition-colors sm:py-2.5 ${
            isOpen
              ? 'border-yellow-500/60 ring-1 ring-yellow-500/30'
              : 'border-gray-700 hover:border-gray-600'
          } ${isAtMax ? 'opacity-60 cursor-not-allowed' : ''}`}
        />

        {/* Clear input button */}
        {query.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-500 transition-colors hover:text-gray-300 z-10"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}

        {/* Dropdown */}
        {isOpen && !isAtMax && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-lg shadow-black/40">
            {/* Tabs: Search | Squad (only if squad players available) */}
            {showSquadTab && (
              <div className="flex border-b border-gray-800">
                <button
                  type="button"
                  onClick={() => setActiveTab('search')}
                  className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
                    activeTab === 'search'
                      ? 'border-b-2 border-yellow-500 text-yellow-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  검색
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('squad')}
                  className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
                    activeTab === 'squad'
                      ? 'border-b-2 border-yellow-500 text-yellow-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  스쿼드에서 선택
                </button>
              </div>
            )}

            {/* Search tab content */}
            {activeTab === 'search' && (
              <div className="max-h-72 overflow-y-auto overscroll-contain">
                {loading && (
                  <div className="flex items-center justify-center py-6">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-yellow-400" />
                  </div>
                )}

                {!loading && query.trim() && filteredSuggestions.length === 0 && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-gray-500">검색 결과가 없습니다</p>
                  </div>
                )}

                {!loading && !query.trim() && (
                  <div className="px-4 py-6 text-center">
                    <svg className="mx-auto mb-2 h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                    </svg>
                    <p className="text-xs text-gray-500">선수 이름을 입력하세요</p>
                  </div>
                )}

                {filteredSuggestions.map((player) => (
                  <SearchResultItem
                    key={player.spid}
                    player={player}
                    selected={selectedSpids.has(player.spid)}
                    onSelect={handleSelect}
                  />
                ))}
              </div>
            )}

            {/* Squad tab content */}
            {activeTab === 'squad' && showSquadTab && (
              <div className="max-h-72 overflow-y-auto overscroll-contain">
                {availableSquadPlayers.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <p className="text-sm text-gray-500">선택 가능한 선수가 없습니다</p>
                  </div>
                ) : (
                  availableSquadPlayers.map((sp) => (
                    <SearchResultItem
                      key={sp.player.spid}
                      player={sp.player}
                      selected={selectedSpids.has(sp.player.spid)}
                      onSelect={handleSelect}
                    />
                  ))
                )}
              </div>
            )}

            {/* Footer with clear all */}
            {selected.length > 0 && (
              <div className="border-t border-gray-800 px-3 py-2">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="w-full rounded-lg px-3 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-gray-200"
                >
                  전체 해제
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
