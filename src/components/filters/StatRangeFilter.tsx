"use client";

import { useCallback } from "react";
import { PlayerFilter, PlayerStats } from "@/types/player";
import DualRangeSlider from "@/components/ui/DualRangeSlider";

/** Stat definition with label, filter keys, and visual style */
interface StatDef {
  label: string;
  labelKo: string;
  minKey: keyof PlayerFilter;
  maxKey: keyof PlayerFilter;
  statKey: keyof PlayerStats;
  color: "emerald" | "yellow" | "blue" | "red";
  barColor: string; // Tailwind class for the colored bar indicator
}

const STAT_DEFINITIONS: StatDef[] = [
  {
    label: "OVR",
    labelKo: "오버롤",
    minKey: "minOvr",
    maxKey: "maxOvr",
    statKey: "ovr",
    color: "yellow",
    barColor: "bg-yellow-500",
  },
  {
    label: "PAC",
    labelKo: "페이스",
    minKey: "minPace",
    maxKey: "maxPace",
    statKey: "pace",
    color: "emerald",
    barColor: "bg-emerald-500",
  },
  {
    label: "SHO",
    labelKo: "슈팅",
    minKey: "minShooting",
    maxKey: "maxShooting",
    statKey: "shooting",
    color: "blue",
    barColor: "bg-blue-500",
  },
  {
    label: "PAS",
    labelKo: "패스",
    minKey: "minPassing",
    maxKey: "maxPassing",
    statKey: "passing",
    color: "yellow",
    barColor: "bg-amber-500",
  },
  {
    label: "DRI",
    labelKo: "드리블",
    minKey: "minDribbling",
    maxKey: "maxDribbling",
    statKey: "dribbling",
    color: "red",
    barColor: "bg-red-500",
  },
  {
    label: "DEF",
    labelKo: "수비",
    minKey: "minDefending",
    maxKey: "maxDefending",
    statKey: "defending",
    color: "yellow",
    barColor: "bg-orange-500",
  },
  {
    label: "PHY",
    labelKo: "피지컬",
    minKey: "minPhysical",
    maxKey: "maxPhysical",
    statKey: "physical",
    color: "blue",
    barColor: "bg-purple-500",
  },
];

/** Default bounds for stat sliders */
const MIN_BOUND = 0;
const MAX_BOUND = 99;

interface StatRangeFilterProps {
  filter: PlayerFilter;
  onChange: (filter: PlayerFilter) => void;
  /** When true, renders a compact version for mobile drawer */
  compact?: boolean;
}

export default function StatRangeFilter({
  filter,
  onChange,
}: StatRangeFilterProps) {
  /** Get the current min value for a stat, defaulting to the absolute min bound */
  const getMin = useCallback(
    (stat: StatDef) => (filter[stat.minKey] as number | undefined) ?? MIN_BOUND,
    [filter],
  );

  /** Get the current max value for a stat, defaulting to the absolute max bound */
  const getMax = useCallback(
    (stat: StatDef) => (filter[stat.maxKey] as number | undefined) ?? MAX_BOUND,
    [filter],
  );

  /** Update min/max for a stat, removing the filter when at bounds */
  const handleChange = useCallback(
    (stat: StatDef, minVal: number, maxVal: number) => {
      const patch: Record<string, number | undefined> = {};

      // Store "undefined" when the value equals the bound (inactive filter)
      patch[stat.minKey] = minVal <= MIN_BOUND ? undefined : minVal;
      patch[stat.maxKey] = maxVal >= MAX_BOUND ? undefined : maxVal;

      onChange({ ...filter, ...patch });
    },
    [filter, onChange],
  );

  /** Check if a stat filter is active (not at default bounds) */
  const isStatActive = useCallback(
    (stat: StatDef) => {
      const minVal = filter[stat.minKey] as number | undefined;
      const maxVal = filter[stat.maxKey] as number | undefined;
      return minVal !== undefined || maxVal !== undefined;
    },
    [filter],
  );

  /** Reset all stat ranges to defaults */
  const resetAllStats = useCallback(() => {
    const patch: Record<string, undefined> = {};
    for (const stat of STAT_DEFINITIONS) {
      patch[stat.minKey] = undefined;
      patch[stat.maxKey] = undefined;
    }
    onChange({ ...filter, ...patch });
  }, [filter, onChange]);

  /** Count how many stat filters are active */
  const activeCount = STAT_DEFINITIONS.filter(isStatActive).length;

  return (
    <div>
      {/* Section header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          스탯 범위
        </h3>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={resetAllStats}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-yellow-500 transition-colors hover:bg-yellow-500/10 hover:text-yellow-400"
          >
            초기화
          </button>
        )}
      </div>

      {/* Stat sliders */}
      <div className="space-y-4">
        {STAT_DEFINITIONS.map((stat) => {
          const currentMin = getMin(stat);
          const currentMax = getMax(stat);
          const active = isStatActive(stat);

          return (
            <div key={stat.statKey}>
              {/* Stat label row */}
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {/* Color indicator dot */}
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${stat.barColor}`}
                  />
                  <span className="text-xs font-semibold text-gray-300">
                    {stat.label}
                  </span>
                  <span className="text-[10px] text-gray-600">
                    {stat.labelKo}
                  </span>
                </div>
                {active && (
                  <span className="text-[10px] font-medium text-yellow-500">
                    {currentMin}–{currentMax}
                  </span>
                )}
              </div>

              {/* Slider */}
              <DualRangeSlider
                min={currentMin}
                max={currentMax}
                minBound={MIN_BOUND}
                maxBound={MAX_BOUND}
                step={1}
                onChange={(minVal, maxVal) => handleChange(stat, minVal, maxVal)}
                label={`${stat.label} (${stat.labelKo})`}
                color={stat.color}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
