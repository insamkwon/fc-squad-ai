"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Player, PlayerFilter } from "@/types/player";
import { usePlayerFilters } from "@/hooks/usePlayerFilters";
import PlayerCard from "@/components/player/PlayerCard";
import PlayerSearchBar from "@/components/player/PlayerSearchBar";
import PlayerFilterSidebar from "@/components/player/PlayerFilterSidebar";

const PAGE_SIZE = 24;

// ---------------------------------------------------------------------------
// API response type
// ---------------------------------------------------------------------------
interface PlayersApiResponse {
  results: Player[];
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// Convert PlayerFilter → URL query string for /api/players
// ---------------------------------------------------------------------------
function filterToQueryString(filter: PlayerFilter, limit: number, offset: number): string {
  const params = new URLSearchParams();

  if (filter.search) params.set("search", filter.search);
  if (filter.positions.length > 0) params.set("positions", filter.positions.join(","));
  if (filter.teamId !== undefined) params.set("teamId", String(filter.teamId));
  if (filter.seasonId !== undefined) params.set("seasonId", String(filter.seasonId));
  if (filter.seasonSlug !== undefined) params.set("seasonSlug", filter.seasonSlug);
  if (filter.cardType !== undefined) params.set("cardType", filter.cardType);
  if (filter.seasonYear !== undefined) params.set("seasonYear", filter.seasonYear);
  if (filter.minOvr !== undefined) params.set("minOvr", String(filter.minOvr));
  if (filter.maxOvr !== undefined) params.set("maxOvr", String(filter.maxOvr));
  if (filter.minPrice !== undefined) params.set("minPrice", String(filter.minPrice));
  if (filter.maxPrice !== undefined) params.set("maxPrice", String(filter.maxPrice));
  if (filter.minPace !== undefined) params.set("minPace", String(filter.minPace));
  if (filter.maxPace !== undefined) params.set("maxPace", String(filter.maxPace));
  if (filter.minShooting !== undefined) params.set("minShooting", String(filter.minShooting));
  if (filter.maxShooting !== undefined) params.set("maxShooting", String(filter.maxShooting));
  if (filter.minPassing !== undefined) params.set("minPassing", String(filter.minPassing));
  if (filter.maxPassing !== undefined) params.set("maxPassing", String(filter.maxPassing));
  if (filter.minDribbling !== undefined) params.set("minDribbling", String(filter.minDribbling));
  if (filter.maxDribbling !== undefined) params.set("maxDribbling", String(filter.maxDribbling));
  if (filter.minDefending !== undefined) params.set("minDefending", String(filter.minDefending));
  if (filter.maxDefending !== undefined) params.set("maxDefending", String(filter.maxDefending));
  if (filter.minPhysical !== undefined) params.set("minPhysical", String(filter.minPhysical));
  if (filter.maxPhysical !== undefined) params.set("maxPhysical", String(filter.maxPhysical));

  params.set("limit", String(limit));
  params.set("offset", String(offset));

  return params.toString();
}

// ---------------------------------------------------------------------------
// PlayersPageContent — server-driven filtering + pagination
// ---------------------------------------------------------------------------
export default function PlayersPageContent() {
  // ── Result state ──
  const [players, setPlayers] = useState<Player[]>([]);
  const [totalResults, setTotalResults] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Selection state ──
  const [selectedSpids, setSelectedSpids] = useState<Set<number>>(new Set());
  const [selectedPlayers, setSelectedPlayers] = useState<Player[]>([]);

  // ── UI state ──
  const [filterOpen, setFilterOpen] = useState(false);

  // ── URL-synced filter state ──
  const { filter, setFilter, resetFilters, activeFilterCount, isFilterActive } =
    usePlayerFilters();

  // Track how many pages we've loaded (cumulative players in state)
  const [loadedPage, setLoadedPage] = useState(1);

  // Abort controller ref so we can cancel in-flight requests when filter changes
  const abortRef = useRef<AbortController | null>(null);

  // ── Fetch players from API ──
  const fetchPlayers = useCallback(
    async (currentFilter: PlayerFilter, page: number, append: boolean) => {
      // Cancel any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      const offset = (page - 1) * PAGE_SIZE;
      const qs = filterToQueryString(currentFilter, PAGE_SIZE, offset);

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const res = await fetch(`/api/players?${qs}`, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        const data: PlayersApiResponse = await res.json();

        if (controller.signal.aborted) return;

        if (append) {
          setPlayers((prev) => [...prev, ...data.results]);
        } else {
          setPlayers(data.results);
        }
        setTotalResults(data.total);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("선수 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [],
  );

  // ── Initial fetch + refetch when filter changes ──
  useEffect(() => {
    setLoadedPage(1);
    fetchPlayers(filter, 1, false);
  }, [filter, fetchPlayers]);

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // ── Derived values ──
  const hasMore = players.length < totalResults;
  const remainingCount = totalResults - players.length;

  // ── Load more handler ──
  const handleLoadMore = useCallback(() => {
    const nextPage = loadedPage + 1;
    setLoadedPage(nextPage);
    fetchPlayers(filter, nextPage, true);
  }, [filter, loadedPage, fetchPlayers]);

  // ── Search handler — updates the filter (and URL) with debounced text ──
  const handleSearch = useCallback(
    (value: string) => {
      setFilter((prev) => ({ ...prev, search: value }));
    },
    [setFilter],
  );

  // ── Suggestion select handler — update search to the selected player's name ──
  const handleSuggestionSelect = useCallback(
    (player: Player) => {
      setFilter((prev) => ({ ...prev, search: player.nameEn }));
    },
    [setFilter],
  );

  // ── Toggle player selection ──
  const handleSelectPlayer = useCallback(
    (player: Player) => {
      setSelectedSpids((prev) => {
        const next = new Set(prev);
        if (next.has(player.spid)) {
          next.delete(player.spid);
          setSelectedPlayers((sp) => sp.filter((p) => p.spid !== player.spid));
        } else {
          if (next.size >= 3) return prev; // max 3
          next.add(player.spid);
          setSelectedPlayers((sp) => [...sp, player]);
        }
        return next;
      });
    },
    [],
  );

  // ── Go to compare page ──
  const handleCompare = useCallback(() => {
    const spids = Array.from(selectedSpids).join(",");
    window.location.href = `/compare?spids=${spids}`;
  }, [selectedSpids]);

  // ── Remove selected player ──
  const handleRemoveSelected = useCallback((spid: number) => {
    setSelectedSpids((prev) => {
      const next = new Set(prev);
      next.delete(spid);
      return next;
    });
    setSelectedPlayers((sp) => sp.filter((p) => p.spid !== spid));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-4">
      {/* Page header */}
      <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-white sm:text-2xl">선수 데이터베이스</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {loading
              ? "로딩 중..."
              : error
                ? "데이터를 불러올 수 없습니다"
                : `총 ${totalResults.toLocaleString()}명의 선수`}
          </p>
        </div>

        {/* Reset filters button — visible when any filter is active */}
        {isFilterActive && (
          <button
            type="button"
            onClick={resetFilters}
            className="flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200"
          >
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <span className="hidden sm:inline">필터 초기화</span>
            {activeFilterCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-yellow-500/20 px-1 text-[10px] font-bold text-yellow-500">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Search bar with autocomplete */}
      <div className="mb-3 sm:mb-4">
        <PlayerSearchBar
          value={filter.search}
          onChange={handleSearch}
          onSuggestionSelect={handleSuggestionSelect}
        />
      </div>

      {/* Selected players chips + compare button */}
      {selectedPlayers.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 sm:mb-4">
          {selectedPlayers.map((p) => (
            <span
              key={p.spid}
              className="inline-flex items-center gap-1.5 rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-2.5 py-1.5 text-xs font-medium text-yellow-400"
            >
              {p.name}
              <span className="text-yellow-600">({p.stats.ovr})</span>
              <button
                type="button"
                onClick={() => handleRemoveSelected(p.spid)}
                className="ml-0.5 text-yellow-500 hover:text-yellow-300"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={3}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          {selectedPlayers.length >= 2 && (
            <button
              type="button"
              onClick={handleCompare}
              className="rounded-lg bg-yellow-500 px-3 py-1.5 text-xs font-bold text-gray-900 transition-colors hover:bg-yellow-400 sm:px-4"
            >
              비교하기 ({selectedPlayers.length})
            </button>
          )}
        </div>
      )}

      {/* Main layout: filter sidebar + player grid */}
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        {/* Filter sidebar — mobile toggle + collapsible panel, desktop sticky sidebar */}
        <PlayerFilterSidebar
          filter={filter}
          onChange={setFilter}
          isOpen={filterOpen}
          onToggle={() => setFilterOpen((prev) => !prev)}
        />

        {/* Player grid */}
        <div className="min-w-0 flex-1">
          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <ErrorState message={error} onRetry={() => fetchPlayers(filter, 1, false)} />
          ) : players.length === 0 ? (
            <EmptyState onReset={resetFilters} />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
                {players.map((player) => (
                  <PlayerCard
                    key={player.spid}
                    player={player}
                    selected={selectedSpids.has(player.spid)}
                    onClick={handleSelectPlayer}
                  />
                ))}
              </div>

              {/* Load more */}
              {hasMore && (
                <div className="mt-5 flex justify-center sm:mt-6">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 py-2.5 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed sm:w-auto sm:px-8"
                  >
                    {loadingMore ? (
                      <span className="inline-flex items-center justify-center gap-2">
                        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        로딩 중...
                      </span>
                    ) : (
                      `더 보기 (${remainingCount.toLocaleString()}명 남음)`
                    )}
                  </button>
                </div>
              )}

              {/* Results summary */}
              <div className="mt-3 text-center text-xs text-gray-600">
                {players.length.toLocaleString()} / {totalResults.toLocaleString()}명 표시
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-gray-800 bg-gray-900">
          <div className="flex gap-3 p-3">
            <div className="h-14 w-14 rounded-lg bg-gray-800 sm:h-20 sm:w-20" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 rounded bg-gray-800" />
              <div className="h-3 w-20 rounded bg-gray-800" />
              <div className="h-3 w-16 rounded bg-gray-800" />
              <div className="h-4 w-14 rounded bg-gray-800" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-gray-800 px-3 py-2">
            {Array.from({ length: 6 }).map((_, j) => (
              <div key={j} className="flex items-center gap-1.5">
                <div className="h-3 w-5 rounded bg-gray-800" />
                <div className="h-1.5 flex-1 rounded-full bg-gray-800" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-gray-800 bg-gray-900 py-20">
      <svg
        className="mb-4 h-12 w-12 text-gray-700"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
        />
      </svg>
      <p className="text-sm font-medium text-gray-400">검색 결과가 없습니다</p>
      <p className="mt-1 text-xs text-gray-600">필터 조건을 변경해보세요</p>
      <button
        type="button"
        onClick={onReset}
        className="mt-3 rounded-lg border border-gray-700 px-4 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200"
      >
        필터 초기화
      </button>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-gray-800 bg-gray-900 py-20">
      <svg
        className="mb-4 h-12 w-12 text-red-700"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.5}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
        />
      </svg>
      <p className="text-sm font-medium text-gray-400">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg border border-gray-700 px-4 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200"
      >
        다시 시도
      </button>
    </div>
  );
}
