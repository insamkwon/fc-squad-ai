"use client";

import { useCallback, useMemo, useState } from "react";
import { TEAMS, LEAGUES, getTeamsByLeague } from "@/constants/teams";
import type { TeamInfo } from "@/types/filters";
import Dropdown from "@/components/ui/Dropdown";

interface TeamFilterProps {
  selected: string[];
  onChange: (teamIds: string[]) => void;
}

export default function TeamFilter({ selected, onChange }: TeamFilterProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeLeague, setActiveLeague] = useState<string | null>(null);

  const teamsByLeague = useMemo(() => getTeamsByLeague(), []);

  const filteredTeams = useMemo(() => {
    if (!searchQuery.trim()) return TEAMS;
    const q = searchQuery.toLowerCase().trim();
    return TEAMS.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.nameKo.includes(q) ||
        t.league.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const isSelected = useCallback(
    (teamId: string) => selected.includes(teamId),
    [selected]
  );

  const toggle = useCallback(
    (teamId: string) => {
      if (isSelected(teamId)) {
        onChange(selected.filter((id) => id !== teamId));
      } else {
        onChange([...selected, teamId]);
      }
    },
    [selected, onChange, isSelected]
  );

  const clearAll = useCallback(() => {
    onChange([]);
    setSearchQuery("");
  }, [onChange]);

  const displayedLeagues = useMemo(() => {
    if (searchQuery.trim()) {
      const leaguesWithMatches = new Set(filteredTeams.map((t) => t.league));
      return LEAGUES.filter((l) => leaguesWithMatches.has(l.id));
    }
    return activeLeague ? LEAGUES.filter((l) => l.id === activeLeague) : LEAGUES;
  }, [searchQuery, filteredTeams, activeLeague]);

  return (
    <Dropdown
      trigger={
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
            selected.length > 0
              ? "border-emerald-500 bg-emerald-50 text-emerald-700 font-medium"
              : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
          }`}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
          </svg>
          <span className="whitespace-nowrap">
            {selected.length > 0 ? `${selected.length}개 팀` : "팀"}
          </span>
          {selected.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); clearAll(); }}
              className="ml-1 rounded-full bg-emerald-200 p-0.5 text-emerald-800 hover:bg-emerald-300"
              aria-label="Clear team filter"
            >
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      }
      className="min-w-[280px] sm:min-w-[320px]"
    >
      <div className="p-2">
        {/* Header */}
        <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-2">
          <span className="text-xs font-semibold text-gray-500">팀 선택</span>
          {selected.length > 0 && (
            <button onClick={clearAll} className="text-xs font-medium text-gray-400 hover:text-gray-600">
              초기화
            </button>
          )}
        </div>

        {/* Search input */}
        <div className="relative mb-2">
          <svg
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
            fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="팀 이름 검색 (한/영)..."
            className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-8 text-sm outline-none transition-colors placeholder:text-gray-400 focus:border-emerald-400 focus:bg-white"
            autoFocus={false}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* League tabs (hidden during search) */}
        {!searchQuery.trim() && (
          <div className="mb-2 flex gap-1 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveLeague(null)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                activeLeague === null
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              전체
            </button>
            {LEAGUES.map((league) => {
              const teamCount = (teamsByLeague[league.id] || []).length;
              return (
                <button
                  key={league.id}
                  onClick={() => setActiveLeague(league.id === activeLeague ? null : league.id)}
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    activeLeague === league.id
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                  }`}
                >
                  {league.nameKo}
                  <span className="ml-1 text-[10px] opacity-70">{teamCount}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Team list grouped by league */}
        <div className="max-h-[300px] overflow-y-auto">
          {displayedLeagues.map((league) => {
            const leagueTeams = (teamsByLeague[league.id] || []).filter(
              (t) => !searchQuery.trim() || filteredTeams.includes(t)
            );
            if (leagueTeams.length === 0) return null;

            return (
              <div key={league.id} className="mb-2">
                <div className="px-2 py-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                  {league.nameKo} ({league.name})
                </div>
                <div className="flex flex-col gap-0.5 px-1">
                  {leagueTeams.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => toggle(team.id)}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition-colors ${
                        isSelected(team.id)
                          ? "bg-emerald-50 text-emerald-700"
                          : "hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                          isSelected(team.id)
                            ? "border-emerald-500 bg-emerald-500 text-white"
                            : "border-gray-300 bg-white"
                        }`}
                      >
                        {isSelected(team.id) ? "✓" : ""}
                      </span>
                      <span className="font-medium">{team.nameKo}</span>
                      <span className="text-xs text-gray-400 truncate">{team.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}

          {displayedLeagues.length === 0 && (
            <div className="px-2 py-6 text-center text-sm text-gray-400">
              검색 결과가 없습니다
            </div>
          )}
        </div>
      </div>
    </Dropdown>
  );
}
