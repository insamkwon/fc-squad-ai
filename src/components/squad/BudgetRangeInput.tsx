"use client";

import { useState, useCallback, useMemo } from "react";
import DualRangeSlider from "@/components/ui/DualRangeSlider";
import type { BudgetRange } from "@/types/filters";
import {
  BUDGET_BOUNDS,
  BUDGET_PRESETS,
} from "@/constants/squad-defaults";

/** Formatter: number → display string with 억 suffix */
function formatBudget(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toLocaleString()}천억`;
  }
  return `${value.toLocaleString()}억`;
}

/** Formatter for input placeholder */
function formatPlaceholder(value: number): string {
  return String(value);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface BudgetRangeInputProps {
  /** Current budget range state (min/max in 억 units) */
  value: BudgetRange;
  /** Called when the budget range changes */
  onChange: (range: BudgetRange) => void;
  /** Optional additional CSS class on the wrapper */
  className?: string;
}

export default function BudgetRangeInput({
  value,
  onChange,
  className = "",
}: BudgetRangeInputProps) {
  // Local input states for min/max text fields (synced from value props)
  const [minInput, setMinInput] = useState<string>(
    value.min != null ? formatPlaceholder(value.min) : "",
  );
  const [maxInput, setMaxInput] = useState<string>(
    value.max != null ? formatPlaceholder(value.max) : "",
  );

  // Validation error message
  const [error, setError] = useState<string>("");

  // Current slider values (fall back to bounds when undefined)
  const currentMin = value.min ?? BUDGET_BOUNDS.MIN;
  const currentMax = value.max ?? BUDGET_BOUNDS.MAX;

  // Whether the filter is actively set (not at default bounds)
  const isActive = useMemo(() => {
    const hasMin = value.min != null && value.min > BUDGET_BOUNDS.MIN;
    const hasMax = value.max != null && value.max < BUDGET_BOUNDS.MAX;
    return hasMin || hasMax;
  }, [value.min, value.max]);

  // Derived display string for the active range
  const displayRange = useMemo(() => {
    if (!isActive) return null;
    const minPart = value.min != null && value.min > BUDGET_BOUNDS.MIN
      ? formatBudget(value.min)
      : null;
    const maxPart = value.max != null && value.max < BUDGET_BOUNDS.MAX
      ? formatBudget(value.max)
      : null;
    if (minPart && maxPart) return `${minPart} ~ ${maxPart}`;
    if (minPart) return `${minPart} 이상`;
    if (maxPart) return `${maxPart} 이하`;
    return null;
  }, [isActive, value.min, value.max]);

  // ---------------------------------------------------------------------------
  // Validation helpers
  // ---------------------------------------------------------------------------

  const validateAndSet = useCallback(
    (rawMin: string, rawMax: string): BudgetRange | null => {
      const trimmedMin = rawMin.trim();
      const trimmedMax = rawMax.trim();

      // Both empty → clear filter
      if (!trimmedMin && !trimmedMax) {
        setError("");
        return {};
      }

      const parsedMin = trimmedMin ? Number(trimmedMin) : undefined;
      const parsedMax = trimmedMax ? Number(trimmedMax) : undefined;

      // Validate numeric
      if (trimmedMin && (isNaN(parsedMin!) || parsedMin! < 0)) {
        setError("최소 예산은 0 이상의 숫자여야 합니다");
        return null;
      }
      if (trimmedMax && (isNaN(parsedMax!) || parsedMax! < 0)) {
        setError("최대 예산은 0 이상의 숫자여야 합니다");
        return null;
      }

      // Validate min <= max
      if (
        parsedMin != null &&
        parsedMax != null &&
        parsedMin > parsedMax
      ) {
        setError("최소 예산이 최대 예산보다 클 수 없습니다");
        return null;
      }

      // Validate within bounds
      if (parsedMin != null && parsedMin > BUDGET_BOUNDS.MAX) {
        setError(`최소 예산은 ${BUDGET_BOUNDS.MAX}억 이하로 입력해주세요`);
        return null;
      }
      if (parsedMax != null && parsedMax > BUDGET_BOUNDS.MAX) {
        setError(`최대 예산은 ${BUDGET_BOUNDS.MAX}억 이하로 입력해주세요`);
        return null;
      }

      setError("");

      // Build result — omit values at bounds (means no filter)
      const result: BudgetRange = {};
      if (parsedMin != null && parsedMin > BUDGET_BOUNDS.MIN) {
        result.min = parsedMin;
      }
      if (parsedMax != null && parsedMax < BUDGET_BOUNDS.MAX) {
        result.max = parsedMax;
      }

      return result;
    },
    [],
  );

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /** Handle min input field change */
  const handleMinInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setMinInput(raw);
      const result = validateAndSet(raw, maxInput);
      if (result) onChange(result);
    },
    [maxInput, validateAndSet, onChange],
  );

  /** Handle max input field change */
  const handleMaxInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      setMaxInput(raw);
      const result = validateAndSet(minInput, raw);
      if (result) onChange(result);
    },
    [minInput, validateAndSet, onChange],
  );

  /** Handle min input blur — snap to bounds */
  const handleMinBlur = useCallback(() => {
    const parsed = Number(minInput);
    if (minInput && !isNaN(parsed)) {
      const clamped = Math.max(
        BUDGET_BOUNDS.MIN,
        Math.min(parsed, currentMax - BUDGET_BOUNDS.STEP),
      );
      setMinInput(clamped > BUDGET_BOUNDS.MIN ? formatPlaceholder(clamped) : "");
      if (clamped > BUDGET_BOUNDS.MIN) {
        onChange({ ...value, min: clamped });
      } else {
        const { min, ...rest } = value;
        onChange(rest);
      }
      setError("");
    }
  }, [minInput, currentMax, value, onChange]);

  /** Handle max input blur — snap to bounds */
  const handleMaxBlur = useCallback(() => {
    const parsed = Number(maxInput);
    if (maxInput && !isNaN(parsed)) {
      const clamped = Math.min(
        BUDGET_BOUNDS.MAX,
        Math.max(parsed, currentMin + BUDGET_BOUNDS.STEP),
      );
      setMaxInput(clamped < BUDGET_BOUNDS.MAX ? formatPlaceholder(clamped) : "");
      if (clamped < BUDGET_BOUNDS.MAX) {
        onChange({ ...value, max: clamped });
      } else {
        const { max, ...rest } = value;
        onChange(rest);
      }
      setError("");
    }
  }, [maxInput, currentMin, value, onChange]);

  /** Handle dual-range slider change */
  const handleSliderChange = useCallback(
    (sliderMin: number, sliderMax: number) => {
      // Sync text inputs
      setMinInput(sliderMin > BUDGET_BOUNDS.MIN ? formatPlaceholder(sliderMin) : "");
      setMaxInput(sliderMax < BUDGET_BOUNDS.MAX ? formatPlaceholder(sliderMax) : "");
      setError("");

      // Build result — omit values at bounds
      const result: BudgetRange = {};
      if (sliderMin > BUDGET_BOUNDS.MIN) result.min = sliderMin;
      if (sliderMax < BUDGET_BOUNDS.MAX) result.max = sliderMax;
      onChange(result);
    },
    [onChange],
  );

  /** Handle preset button click */
  const handlePresetClick = useCallback(
    (preset: number) => {
      setMinInput("");
      setMaxInput(formatPlaceholder(preset));
      setError("");
      // Setting only max = preset, min stays at default
      onChange({ max: preset });
    },
    [onChange],
  );

  /** Reset budget range to defaults */
  const handleReset = useCallback(() => {
    setMinInput("");
    setMaxInput("");
    setError("");
    onChange({});
  }, [onChange]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={className}>
      {/* Section header */}
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">
          예산 범위
        </label>
        {isActive && (
          <button
            type="button"
            onClick={handleReset}
            className="rounded px-1.5 py-0.5 text-[10px] font-medium text-yellow-500 transition-colors hover:bg-yellow-500/10 hover:text-yellow-400"
          >
            초기화
          </button>
        )}
      </div>

      {/* Quick preset buttons */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {BUDGET_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => handlePresetClick(preset)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              value.max === preset && value.min == null
                ? "bg-yellow-500 text-gray-900"
                : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
            }`}
          >
            {formatBudget(preset)}
          </button>
        ))}
      </div>

      {/* Min / Max number inputs */}
      <div className="mb-3 flex items-center gap-2">
        {/* Min input */}
        <div className="flex-1">
          <label
            htmlFor="budget-min"
            className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500"
          >
            최소
          </label>
          <div className="relative">
            <input
              id="budget-min"
              type="number"
              inputMode="numeric"
              min={0}
              max={BUDGET_BOUNDS.MAX}
              value={minInput}
              onChange={handleMinInputChange}
              onBlur={handleMinBlur}
              placeholder={formatPlaceholder(BUDGET_BOUNDS.MIN)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 pr-8 text-sm text-white placeholder-gray-600 focus:border-yellow-500 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
              억
            </span>
          </div>
        </div>

        {/* Separator */}
        <span className="mt-4 text-sm text-gray-600">~</span>

        {/* Max input */}
        <div className="flex-1">
          <label
            htmlFor="budget-max"
            className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-gray-500"
          >
            최대
          </label>
          <div className="relative">
            <input
              id="budget-max"
              type="number"
              inputMode="numeric"
              min={0}
              max={BUDGET_BOUNDS.MAX}
              value={maxInput}
              onChange={handleMaxInputChange}
              onBlur={handleMaxBlur}
              placeholder={formatPlaceholder(BUDGET_BOUNDS.MAX)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 pr-8 text-sm text-white placeholder-gray-600 focus:border-yellow-500 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">
              억
            </span>
          </div>
        </div>
      </div>

      {/* Validation error */}
      {error && (
        <p className="mb-2 text-xs text-rose-400">{error}</p>
      )}

      {/* Dual range slider */}
      <div className="px-1">
        <DualRangeSlider
          min={currentMin}
          max={currentMax}
          minBound={BUDGET_BOUNDS.MIN}
          maxBound={BUDGET_BOUNDS.MAX}
          step={BUDGET_BOUNDS.STEP}
          onChange={handleSliderChange}
          label="예산 범위 슬라이더"
          color="yellow"
        />
      </div>

      {/* Active range display */}
      {displayRange && (
        <p className="mt-1.5 text-center text-xs font-medium text-yellow-500">
          {displayRange}
        </p>
      )}
    </div>
  );
}
