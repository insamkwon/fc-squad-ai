"use client";

import { useCallback, useMemo, useState } from "react";
import type { Position } from "@/types/player";
import { ALL_POSITIONS } from "@/types/player";
import { SEASONS } from "@/types/player";
import { TEAMS } from "@/constants/teams";
import PositionFilter from "./PositionFilter";
import TeamFilter from "./TeamFilter";
import SeasonFilter from "./SeasonFilter";

/** Active filter state for the category filter bar */
export interface CategoryFilterState {
  positions: Position[];
  teamIds: string[];
  seasonIds: number[];
}

/** Default empty filter state */
export const DEFAULT_CATEGORY_FILTER: CategoryFilterState = {
  positions: [],
  teamIds: [],
  seasonIds: [],
};

interface FilterBarProps {
  filters?: CategoryFilterState;
  onFilterChange?: (filters: CategoryFilterState) => void;
}

export default function FilterBar({ filters: externalFilters, onFilterChange }: FilterBarProps) {
  const [internalFilters, setInternalFilters] = useState<CategoryFilterState>(DEFAULT_CATEGORY_FILTER);

  // Support both controlled and uncontrolled usage
  const filters = externalFilters ?? internalFilters;
  const setFilters = useCallback(
    (next: CategoryFilterState) => {
      if (!externalFilters) {
        setInternalFilters(next);
      }
      onFilterChange?.(next);
    },
    [externalFilters, onFilterChange]
  );

  const handlePositionsChange = useCallback(
    (positions: Position[]) => setFilters({ ...filters, positions }),
    [filters, setFilters]
  );

  const handleTeamsChange = useCallback(
    (teamIds: string[]) => setFilters({ ...filters, teamIds }),
    [filters, setFilters]
  );

  const handleSeasonsChange = useCallback(
    (seasonIds: number[]) => setFilters({ ...filters, seasonIds }),
    [filters, setFilters]
  );

  const resetAll = useCallback(() => {
    setFilters(DEFAULT_CATEGORY_FILTER);
  }, [setFilters]);

  const activeFilterCount =
    filters.positions.length +
    filters.teamIds.length +
    filters.seasonIds.length;

  // Lookup maps for rendering filter tag labels
  const teamMap = useMemo(() => new Map(TEAMS.map((t) => [t.id, t])), []);
  const seasonMap = useMemo(() => new Map(Object.entries(SEASONS).map(([k, v]) => [Number(k), v])), []);

  return (
    <div className="w-full">
      {/* Filter bar — horizontal scroll on mobile, flex-wrap on desktop */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        <PositionFilter selected={filters.positions} onChange={handlePositionsChange} />
        <TeamFilter selected={filters.teamIds} onChange={handleTeamsChange} />
        <SeasonFilter selected={filters.seasonIds} onChange={handleSeasonsChange} />

        {activeFilterCount > 0 && (
          <button
            onClick={resetAll}
            className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-600"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" />
            </svg>
            <span className="whitespace-nowrap">초기화</span>
          </button>
        )}
      </div>

      {/* Active filter tags (pill display below the bar) */}
      {activeFilterCount > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {filters.positions.map((pos) => (
            <FilterTag
              key={`pos-${pos}`}
              label={pos}
              onRemove={() => handlePositionsChange(filters.positions.filter((p) => p !== pos))}
            />
          ))}
          {filters.teamIds.map((teamId) => {
            const team = teamMap.get(teamId);
            if (!team) return null;
            return (
              <FilterTag
                key={`team-${teamId}`}
                label={team.nameKo}
                onRemove={() => handleTeamsChange(filters.teamIds.filter((id) => id !== teamId))}
              />
            );
          })}
          {filters.seasonIds.map((seasonId) => {
            const season = seasonMap.get(seasonId);
            if (!season) return null;
            return (
              <FilterTag
                key={`season-${seasonId}`}
                label={season.name}
                onRemove={() => handleSeasonsChange(filters.seasonIds.filter((id) => id !== seasonId))}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Small reusable pill tag for an active filter */
function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
      {label}
      <button
        onClick={onRemove}
        className="ml-0.5 text-emerald-500 hover:text-emerald-800"
        aria-label={`Remove ${label} filter`}
      >
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
        </svg>
      </button>
    </span>
  );
}
