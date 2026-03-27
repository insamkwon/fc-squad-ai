"use client";

import { useCallback, useMemo, useState } from "react";
import {
  SEASONS,
  CARD_TYPES,
  CARD_TYPE_LABELS,
  getSeasonsByCardType,
} from "@/types/player";
import type { Season, CardType } from "@/types/player";
import Dropdown from "@/components/ui/Dropdown";

interface SeasonFilterProps {
  selected: number[];
  onChange: (seasonIds: number[]) => void;
}

type SeasonTab = "all" | CardType;

export default function SeasonFilter({ selected, onChange }: SeasonFilterProps) {
  const [activeTab, setActiveTab] = useState<SeasonTab>("all");

  const isSelected = useCallback(
    (seasonId: number) => selected.includes(seasonId),
    [selected]
  );

  const toggle = useCallback(
    (seasonId: number) => {
      if (isSelected(seasonId)) {
        onChange(selected.filter((id) => id !== seasonId));
      } else {
        onChange([...selected, seasonId]);
      }
    },
    [selected, onChange, isSelected]
  );

  const clearAll = useCallback(() => onChange([]), [onChange]);

  /** Get sorted season list for current tab */
  const displayedSeasons = useMemo((): Season[] => {
    if (activeTab === "all") {
      return Object.values(SEASONS).sort((a, b) => b.id - a.id);
    }
    return getSeasonsByCardType(activeTab).sort((a, b) => b.id - a.id);
  }, [activeTab]);

  /** Count seasons by card type */
  const seasonCounts = useMemo(() => {
    const counts: Record<string, number> = { all: Object.keys(SEASONS).length };
    for (const ct of CARD_TYPES) {
      counts[ct] = getSeasonsByCardType(ct).length;
    }
    return counts;
  }, []);

  const tabs: { key: SeasonTab; label: string }[] = [
    { key: "all", label: "전체" },
    ...CARD_TYPES.map((ct) => ({ key: ct, label: CARD_TYPE_LABELS[ct] })),
  ];

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
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          <span className="whitespace-nowrap">
            {selected.length > 0 ? `${selected.length}개 시즌` : "시즌"}
          </span>
          {selected.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); clearAll(); }}
              className="ml-1 rounded-full bg-emerald-200 p-0.5 text-emerald-800 hover:bg-emerald-300"
              aria-label="Clear season filter"
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
    >
      <div className="p-2">
        {/* Header */}
        <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-2">
          <span className="text-xs font-semibold text-gray-500">시즌 선택</span>
          {selected.length > 0 && (
            <button onClick={clearAll} className="text-xs font-medium text-gray-400 hover:text-gray-600">
              초기화
            </button>
          )}
        </div>

        {/* Tabs: All / BASE / SPECIAL / ICON / LIVE / MOM / POTW */}
        <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-emerald-500 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {tab.label}
              <span className="ml-1 text-[10px] opacity-70">
                ({seasonCounts[tab.key] ?? 0})
              </span>
            </button>
          ))}
        </div>

        {/* Season list */}
        <div className="max-h-[300px] overflow-y-auto">
          {displayedSeasons.map((season) => (
            <button
              key={season.id}
              onClick={() => toggle(season.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                isSelected(season.id)
                  ? "bg-emerald-50 text-emerald-700"
                  : "hover:bg-gray-50 text-gray-700"
              }`}
            >
              <span
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] ${
                  isSelected(season.id)
                    ? "border-emerald-500 bg-emerald-500 text-white"
                    : "border-gray-300 bg-white"
                }`}
              >
                {isSelected(season.id) ? "✓" : ""}
              </span>
              <div className="flex flex-col">
                <span className="font-medium leading-tight">{season.name}</span>
                <span className="text-[11px] text-gray-400">{season.nameEn}</span>
              </div>
              {season.cardType !== "BASE" && (
                <span className="ml-auto shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                  {CARD_TYPE_LABELS[season.cardType]}
                </span>
              )}
            </button>
          ))}

          {displayedSeasons.length === 0 && (
            <div className="px-2 py-6 text-center text-sm text-gray-400">
              해당 카드 타입의 시즌이 없습니다
            </div>
          )}
        </div>
      </div>
    </Dropdown>
  );
}
