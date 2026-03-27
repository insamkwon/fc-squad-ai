"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PlayerFilter, Position, POSITION_CATEGORIES } from "@/types/player";
import { TEAMS } from "@/constants/teams";
import StatRangeFilter from "@/components/filters/StatRangeFilter";

const POSITION_GROUP_LABELS: Record<string, string> = {
  FW: "공격수",
  MF: "미드필더",
  DF: "수비수",
  GK: "골키퍼",
};

const SEASONS = [
  { id: 69, name: "ICON" },
  { id: 68, name: "TOTNUCL (24/25)" },
  { id: 67, name: "TOTNUCL (23/24)" },
  { id: 60, name: "HOT" },
  { id: 70, name: "KFA" },
];

function formatEok(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num) || value === "") return "";
  return `${(num * 100_000_000).toLocaleString()}`;
}

function parseEok(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "";
  return `${num}`;
}

interface PlayerFilterSidebarProps {
  filter: PlayerFilter;
  onChange: (filter: PlayerFilter) => void;
  isOpen?: boolean;
  onToggle?: () => void;
}

export default function PlayerFilterSidebar({
  filter,
  onChange,
  isOpen = true,
  onToggle,
}: PlayerFilterSidebarProps) {
  const [teamSearch, setTeamSearch] = useState("");

  const filteredTeams = useMemo(() => {
    const q = teamSearch.toLowerCase().trim();
    if (!q) return TEAMS.slice(0, 20);
    return TEAMS.filter(
      (t) =>
        t.nameKo.includes(q) ||
        t.name.toLowerCase().includes(q) ||
        t.league.toLowerCase().includes(q),
    ).slice(0, 20);
  }, [teamSearch]);

  const activePositions = useMemo(() => {
    const active: string[] = [];
    for (const [cat, positions] of Object.entries(POSITION_CATEGORIES)) {
      if (filter.positions.length > 0 && positions.every((p) => filter.positions.includes(p))) {
        active.push(cat);
      }
    }
    return active;
  }, [filter.positions]);

  const togglePositionCategory = useCallback(
    (category: string) => {
      const positions = POSITION_CATEGORIES[category] as Position[];
      const isAllSelected = positions.every((p) => filter.positions.includes(p));

      let next: Position[];
      if (isAllSelected) {
        next = filter.positions.filter((p) => !positions.includes(p));
      } else {
        const existing = new Set(filter.positions);
        for (const p of positions) existing.add(p);
        next = Array.from(existing);
      }
      onChange({ ...filter, positions: next });
    },
    [filter, onChange],
  );

  const updateFilter = useCallback(
    (patch: Partial<PlayerFilter>) => {
      onChange({ ...filter, ...patch });
    },
    [filter, onChange],
  );

  const clearFilters = useCallback(() => {
    onChange({
      search: "",
      positions: [],
      minOvr: undefined,
      maxOvr: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      minPace: undefined,
      maxPace: undefined,
      minShooting: undefined,
      maxShooting: undefined,
      minPassing: undefined,
      maxPassing: undefined,
      minDribbling: undefined,
      maxDribbling: undefined,
      minDefending: undefined,
      maxDefending: undefined,
      minPhysical: undefined,
      maxPhysical: undefined,
    });
  }, [onChange]);

  const isFilterActive = useMemo(() => {
    return (
      filter.positions.length > 0 ||
      filter.teamId !== undefined ||
      filter.seasonId !== undefined ||
      filter.minOvr !== undefined ||
      filter.maxOvr !== undefined ||
      filter.minPrice !== undefined ||
      filter.maxPrice !== undefined ||
      filter.minPace !== undefined ||
      filter.maxPace !== undefined ||
      filter.minShooting !== undefined ||
      filter.maxShooting !== undefined ||
      filter.minPassing !== undefined ||
      filter.maxPassing !== undefined ||
      filter.minDribbling !== undefined ||
      filter.maxDribbling !== undefined ||
      filter.minDefending !== undefined ||
      filter.maxDefending !== undefined ||
      filter.minPhysical !== undefined ||
      filter.maxPhysical !== undefined
    );
  }, [filter]);

  const filterContent = (
    <div className="space-y-5">
      {/* Position filter */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">포지션</h3>
        <div className="grid grid-cols-4 gap-1.5">
          {Object.entries(POSITION_CATEGORIES).map(([cat]) => (
            <button
              key={cat}
              type="button"
              onClick={() => togglePositionCategory(cat)}
              className={`rounded-lg px-2 py-2 text-xs font-semibold transition-colors ${
                activePositions.includes(cat)
                  ? "bg-yellow-500 text-gray-900"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Team filter */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">팀</h3>
        <div className="relative">
          <input
            type="text"
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            placeholder="팀 검색..."
            className="mb-1.5 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-gray-600"
          />
          {filter.teamId !== undefined && (
            <button
              type="button"
              onClick={() => updateFilter({ teamId: undefined })}
              className="mb-1.5 ml-2 text-[10px] text-yellow-500 hover:text-yellow-400"
            >
              해제
            </button>
          )}
        </div>
        <div className="max-h-32 overflow-y-auto rounded-lg border border-gray-800 bg-gray-800/50">
          {filteredTeams.map((team) => (
            <button
              key={team.id}
              type="button"
              onClick={() => updateFilter({ teamId: Number(team.id) })}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors ${
                filter.teamId === Number(team.id)
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "text-gray-300 hover:bg-gray-700/50"
              }`}
            >
              <span className="font-medium">{team.nameKo}</span>
              <span className="text-gray-600">{team.league}</span>
            </button>
          ))}
          {filteredTeams.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-600">검색 결과 없음</p>
          )}
        </div>
      </div>

      {/* Season filter */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">시즌</h3>
        <select
          value={filter.seasonId ?? ""}
          onChange={(e) =>
            updateFilter({ seasonId: e.target.value ? Number(e.target.value) : undefined })
          }
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-white outline-none focus:border-gray-600"
        >
          <option value="">전체 시즌</option>
          {SEASONS.map((season) => (
            <option key={season.id} value={season.id}>
              {season.name}
            </option>
          ))}
        </select>
      </div>

      {/* OVR range */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">OVR 범위</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={99}
            placeholder="최소"
            value={filter.minOvr ?? ""}
            onChange={(e) =>
              updateFilter({ minOvr: e.target.value ? Number(e.target.value) : undefined })
            }
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-gray-600"
          />
          <span className="text-gray-600">~</span>
          <input
            type="number"
            min={0}
            max={99}
            placeholder="최대"
            value={filter.maxOvr ?? ""}
            onChange={(e) =>
              updateFilter({ maxOvr: e.target.value ? Number(e.target.value) : undefined })
            }
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-gray-600"
          />
        </div>
      </div>

      {/* Stat range sliders */}
      <StatRangeFilter filter={filter} onChange={onChange} />

      {/* Price range */}
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">가격 범위 (억)</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            step={0.1}
            placeholder="최소"
            value={filter.minPrice != null ? parseEok((filter.minPrice / 100_000_000).toFixed(1)) : ""}
            onChange={(e) =>
              updateFilter({
                minPrice: e.target.value ? Number(formatEok(e.target.value)) : undefined,
              })
            }
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-gray-600"
          />
          <span className="text-gray-600">~</span>
          <input
            type="number"
            min={0}
            step={0.1}
            placeholder="최대"
            value={filter.maxPrice != null ? parseEok((filter.maxPrice / 100_000_000).toFixed(1)) : ""}
            onChange={(e) =>
              updateFilter({
                maxPrice: e.target.value ? Number(formatEok(e.target.value)) : undefined,
              })
            }
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs text-white placeholder-gray-600 outline-none focus:border-gray-600"
          />
        </div>
      </div>

      {/* Clear filters */}
      {isFilterActive && (
        <button
          type="button"
          onClick={clearFilters}
          className="w-full rounded-lg border border-gray-700 py-2 text-xs font-medium text-gray-400 transition-colors hover:border-gray-600 hover:text-gray-200"
        >
          필터 초기화
        </button>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile filter section — full width above the grid */}
      <div className="w-full flex-shrink-0 lg:hidden">
        {/* Toggle button */}
        <button
          type="button"
          onClick={onToggle}
          className={`flex w-full items-center justify-between rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
            isOpen
              ? "border-yellow-500/40 bg-yellow-500/5 text-yellow-400"
              : "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
              />
            </svg>
            <span>필터</span>
            {isFilterActive && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-yellow-500 px-1.5 text-[10px] font-bold text-gray-900">
                {activePositions.length +
                  (filter.teamId !== undefined ? 1 : 0) +
                  (filter.seasonId !== undefined ? 1 : 0) +
                  (filter.minOvr !== undefined || filter.maxOvr !== undefined ? 1 : 0) +
                  (filter.minPrice !== undefined || filter.maxPrice !== undefined ? 1 : 0)}
              </span>
            )}
          </div>
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>

        {/* Collapsible panel */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-4 mt-2">
            {filterContent}
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="sticky top-20 rounded-xl border border-gray-800 bg-gray-900 p-4">
          {filterContent}
        </div>
      </aside>
    </>
  );
}
