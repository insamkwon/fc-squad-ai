"use client";

import { useCallback, useMemo } from "react";
import { type Position, ALL_POSITIONS, POSITION_CATEGORIES } from "@/types/player";
import Dropdown from "@/components/ui/Dropdown";

interface PositionFilterProps {
  selected: Position[];
  onChange: (positions: Position[]) => void;
}

/** Display metadata for each position category */
const CATEGORY_META: Record<string, { ko: string; en: string; color: string }> = {
  FW: { ko: "공격수", en: "Forwards", color: "bg-red-50 text-red-700" },
  MF: { ko: "미드필더", en: "Midfielders", color: "bg-green-50 text-green-700" },
  DF: { ko: "수비수", en: "Defenders", color: "bg-blue-50 text-blue-700" },
  GK: { ko: "골키퍼", en: "Goalkeeper", color: "bg-amber-50 text-amber-700" },
};

export default function PositionFilter({ selected, onChange }: PositionFilterProps) {
  const isSelected = useCallback(
    (pos: Position) => selected.includes(pos),
    [selected]
  );

  const toggle = useCallback(
    (pos: Position) => {
      if (isSelected(pos)) {
        onChange(selected.filter((p) => p !== pos));
      } else {
        onChange([...selected, pos]);
      }
    },
    [selected, onChange, isSelected]
  );

  const clearAll = useCallback(() => onChange([]), [onChange]);
  const selectAll = useCallback(
    () => onChange([...ALL_POSITIONS]),
    [onChange]
  );

  const toggleCategory = useCallback(
    (category: string) => {
      const positions = POSITION_CATEGORIES[category] ?? [];
      const allSelected = positions.every((p) => selected.includes(p));
      if (allSelected) {
        onChange(selected.filter((p) => !positions.includes(p)));
      } else {
        const merged = [...new Set([...selected, ...positions])];
        onChange(merged);
      }
    },
    [selected, onChange]
  );

  const countLabel = useMemo(() => {
    if (selected.length === 0) return "포지션";
    if (selected.length === ALL_POSITIONS.length) return "전체 포지션";
    return `${selected.length}개 포지션`;
  }, [selected.length]);

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
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
          </svg>
          <span className="whitespace-nowrap">{countLabel}</span>
          {selected.length > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); clearAll(); }}
              className="ml-1 rounded-full bg-emerald-200 p-0.5 text-emerald-800 hover:bg-emerald-300"
              aria-label="Clear position filter"
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
        {/* Header with select all / clear */}
        <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-2">
          <button onClick={selectAll} className="text-xs font-medium text-emerald-600 hover:text-emerald-800">
            전체 선택
          </button>
          <button onClick={clearAll} className="text-xs font-medium text-gray-400 hover:text-gray-600">
            초기화
          </button>
        </div>

        {/* Position groups */}
        {Object.entries(POSITION_CATEGORIES).map(([category, positions]) => {
          const meta = CATEGORY_META[category] ?? { ko: category, en: category, color: "bg-gray-50 text-gray-700" };
          const allCatSelected = positions.every((p) => selected.includes(p));

          return (
            <div key={category} className="mb-1">
              {/* Category header — click toggles entire group */}
              <button
                onClick={() => toggleCategory(category)}
                className={`mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors hover:bg-gray-50 ${meta.color}`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                    allCatSelected
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {allCatSelected ? "✓" : ""}
                </span>
                <span>{meta.ko}</span>
                <span className="text-gray-400 font-normal">({positions.length})</span>
              </button>

              {/* Individual position chips */}
              <div className="flex flex-wrap gap-1 px-2 pb-2">
                {positions.map((pos) => (
                  <button
                    key={pos}
                    onClick={() => toggle(pos)}
                    className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-all ${
                      isSelected(pos)
                        ? "border-emerald-500 bg-emerald-500 text-white shadow-sm"
                        : "border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:bg-emerald-50"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Dropdown>
  );
}
