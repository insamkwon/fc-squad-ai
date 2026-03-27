"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PlayerFilter, Position } from "@/types/player";

/** Empty filter state used as the default / reset target */
export const DEFAULT_FILTER: PlayerFilter = {
  search: "",
  positions: [],
};

// ─── Serialization helpers ──────────────────────────────────────────
// These map between `PlayerFilter` fields and URL search param keys.

const NUMERIC_FILTER_KEYS: (keyof PlayerFilter)[] = [
  "teamId",
  "seasonId",
  "minOvr",
  "maxOvr",
  "minPrice",
  "maxPrice",
  "minPace",
  "maxPace",
  "minShooting",
  "maxShooting",
  "minPassing",
  "maxPassing",
  "minDribbling",
  "maxDribbling",
  "minDefending",
  "maxDefending",
  "minPhysical",
  "maxPhysical",
] as const;

/** Parse a URLSearchParams into a PlayerFilter */
function parseFilterFromParams(params: URLSearchParams): PlayerFilter {
  const filter: PlayerFilter = { ...DEFAULT_FILTER };

  // Text search
  const search = params.get("search");
  if (search) filter.search = search;

  // Positions (comma-separated)
  const positions = params.get("positions");
  if (positions) {
    const parsed = positions
      .split(",")
      .map((p) => p.trim() as Position)
      .filter(Boolean);
    filter.positions = parsed;
  }

  // Numeric fields
  for (const key of NUMERIC_FILTER_KEYS) {
    const raw = params.get(key);
    if (raw) {
      const num = Number(raw);
      if (!isNaN(num)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (filter as any)[key] = num;
      }
    }
  }

  // String fields
  const seasonSlug = params.get("seasonSlug");
  if (seasonSlug) filter.seasonSlug = seasonSlug;

  const cardType = params.get("cardType");
  if (cardType) filter.cardType = cardType as PlayerFilter["cardType"];

  const seasonYear = params.get("seasonYear");
  if (seasonYear) filter.seasonYear = seasonYear;

  return filter;
}

/** Serialize a PlayerFilter into URLSearchParams (only non-default values) */
function filterToParams(filter: PlayerFilter): URLSearchParams {
  const params = new URLSearchParams();

  if (filter.search) params.set("search", filter.search);

  if (filter.positions.length > 0) {
    params.set("positions", filter.positions.join(","));
  }

  for (const key of NUMERIC_FILTER_KEYS) {
    const val = filter[key];
    if (val !== undefined) {
      params.set(key, String(val));
    }
  }

  if (filter.seasonSlug) params.set("seasonSlug", filter.seasonSlug);
  if (filter.cardType) params.set("cardType", filter.cardType);
  if (filter.seasonYear) params.set("seasonYear", filter.seasonYear);

  return params;
}

/**
 * Count how many filter criteria are active (i.e., non-default).
 * The `search` field is intentionally excluded from the count since
 * it's displayed separately in the search bar.
 */
function countActiveFilters(filter: PlayerFilter): number {
  let count = 0;
  if (filter.positions.length > 0) count++;
  if (filter.teamId !== undefined) count++;
  if (filter.seasonId !== undefined) count++;
  if (filter.seasonSlug !== undefined) count++;
  if (filter.cardType !== undefined) count++;
  if (filter.seasonYear !== undefined) count++;
  if (filter.minOvr !== undefined) count++;
  if (filter.maxOvr !== undefined) count++;
  if (filter.minPrice !== undefined) count++;
  if (filter.maxPrice !== undefined) count++;
  if (filter.minPace !== undefined) count++;
  if (filter.maxPace !== undefined) count++;
  if (filter.minShooting !== undefined) count++;
  if (filter.maxShooting !== undefined) count++;
  if (filter.minPassing !== undefined) count++;
  if (filter.maxPassing !== undefined) count++;
  if (filter.minDribbling !== undefined) count++;
  if (filter.maxDribbling !== undefined) count++;
  if (filter.minDefending !== undefined) count++;
  if (filter.maxDefending !== undefined) count++;
  if (filter.minPhysical !== undefined) count++;
  if (filter.maxPhysical !== undefined) count++;
  return count;
}

// ─── Hook ───────────────────────────────────────────────────────────

export interface UsePlayerFiltersReturn {
  /** Current filter state (always reflects the latest URL params) */
  filter: PlayerFilter;
  /** Update the filter — also syncs URL via router.replace */
  setFilter: (filter: PlayerFilter | ((prev: PlayerFilter) => PlayerFilter)) => void;
  /** Reset all filters to defaults and clear URL params */
  resetFilters: () => void;
  /** Number of active filter criteria (excludes search text) */
  activeFilterCount: number;
  /** Whether any filter is active (includes search text) */
  isFilterActive: boolean;
}

/**
 * Manages player filter state synchronized with URL search params.
 *
 * - On mount, the initial filter is read from the current URL.
 * - Every `setFilter` call updates both React state and the URL
 *   (via `router.replace` so the browser history is not polluted).
 * - `resetFilters` clears everything and navigates to the clean URL.
 *
 * This hook calls `useSearchParams()`, so the consuming component
 * **must** be wrapped in a `<Suspense>` boundary.
 */
export function usePlayerFilters(): UsePlayerFiltersReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // ── Internal state ──
  // We keep a ref to the *last* filter we pushed to the URL so we can
  // differentiate between "the URL changed because we pushed" vs
  // "the URL changed because the user hit Back / navigated".
  const lastPushedRef = useRef<string | null>(null);

  // Derive filter from URL params. This runs on every render when
  // searchParams change (navigation, back/forward, initial load).
  const filterFromUrl = useMemo(
    () => parseFilterFromParams(searchParams),
    [searchParams],
  );

  // Keep a stable filter state that we can pass around.
  const [filter, setFilterState] = useState<PlayerFilter>(filterFromUrl);

  // Sync from URL into state when the URL changes externally
  // (e.g. browser back/forward, or initial hydration).
  useEffect(() => {
    // Skip if this change originated from our own push
    const currentUrlStr = searchParams.toString();
    if (lastPushedRef.current === currentUrlStr) return;
    setFilterState(filterFromUrl);
  }, [filterFromUrl, searchParams]);

  // ── setFilter ──
  const setFilter = useCallback(
    (updater: PlayerFilter | ((prev: PlayerFilter) => PlayerFilter)) => {
      setFilterState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        const params = filterToParams(next);
        const queryString = params.toString();

        // Track what we pushed so the sync effect can ignore it
        lastPushedRef.current = queryString;

        const url = queryString ? `${pathname}?${queryString}` : pathname;
        router.replace(url, { scroll: false });

        return next;
      });
    },
    [router, pathname],
  );

  // ── resetFilters ──
  const resetFilters = useCallback(() => {
    lastPushedRef.current = "";
    router.replace(pathname, { scroll: false });
    setFilterState({ ...DEFAULT_FILTER });
  }, [router, pathname]);

  // ── Derived values ──
  const activeFilterCount = useMemo(() => countActiveFilters(filter), [filter]);
  const isFilterActive = useMemo(
    () => activeFilterCount > 0 || filter.search.length > 0,
    [activeFilterCount, filter.search],
  );

  return { filter, setFilter, resetFilters, activeFilterCount, isFilterActive };
}
