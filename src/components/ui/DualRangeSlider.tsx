"use client";

import {
  useCallback,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

interface DualRangeSliderProps {
  /** Current minimum value (controlled) */
  min: number;
  /** Current maximum value (controlled) */
  max: number;
  /** Absolute minimum bound of the slider */
  minBound: number;
  /** Absolute maximum bound of the slider */
  maxBound: number;
  /** Step size between values */
  step?: number;
  /** Called when either handle moves */
  onChange: (min: number, max: number) => void;
  /** Optional label for screen readers */
  label?: string;
  /** Track color theme — defaults to emerald */
  color?: "emerald" | "yellow" | "blue" | "red";
}

const COLOR_MAP = {
  emerald: {
    track: "bg-emerald-500",
    thumb: "border-emerald-400 bg-emerald-500 shadow-emerald-500/30",
    thumbActive: "border-emerald-300 bg-emerald-400",
    fill: "bg-emerald-500/30",
  },
  yellow: {
    track: "bg-yellow-500",
    thumb: "border-yellow-400 bg-yellow-500 shadow-yellow-500/30",
    thumbActive: "border-yellow-300 bg-yellow-400",
    fill: "bg-yellow-500/30",
  },
  blue: {
    track: "bg-blue-500",
    thumb: "border-blue-400 bg-blue-500 shadow-blue-500/30",
    thumbActive: "border-blue-300 bg-blue-400",
    fill: "bg-blue-500/30",
  },
  red: {
    track: "bg-red-500",
    thumb: "border-red-400 bg-red-500 shadow-red-500/30",
    thumbActive: "border-red-300 bg-red-400",
    fill: "bg-red-500/30",
  },
};

export default function DualRangeSlider({
  min,
  max,
  minBound,
  maxBound,
  step = 1,
  onChange,
  label,
  color = "emerald",
}: DualRangeSliderProps) {
  const id = useId();
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeThumb, setActiveThumb] = useState<"min" | "max" | null>(null);
  const colors = COLOR_MAP[color];

  // Convert value to percentage position on track
  const valueToPercent = useCallback(
    (value: number) => {
      const range = maxBound - minBound;
      if (range === 0) return 0;
      return ((value - minBound) / range) * 100;
    },
    [minBound, maxBound],
  );

  // Convert percentage to snapped value
  const percentToValue = useCallback(
    (percent: number) => {
      const raw = minBound + (percent / 100) * (maxBound - minBound);
      const stepped = Math.round(raw / step) * step;
      return Math.max(minBound, Math.min(maxBound, stepped));
    },
    [minBound, maxBound, step],
  );

  // Track fill range (between the two thumbs)
  const fillStart = useMemo(() => valueToPercent(min), [valueToPercent, min]);
  const fillEnd = useMemo(() => valueToPercent(max), [valueToPercent, max]);

  // Resolve pointer/touch position to a value
  const resolveValue = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const percent = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
      const value = percentToValue(percent);
      return value;
    },
    [percentToValue],
  );

  // Handle pointer down on a thumb
  const handlePointerDown = useCallback(
    (thumb: "min" | "max") => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setActiveThumb(thumb);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [],
  );

  // Handle pointer move — update whichever thumb is active
  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!activeThumb) return;
      const value = resolveValue(e.clientX);
      if (value === undefined) return;

      if (activeThumb === "min") {
        onChange(Math.min(value, max - step), max);
      } else {
        onChange(min, Math.max(value, min + step));
      }
    },
    [activeThumb, resolveValue, min, max, step, onChange],
  );

  // Handle pointer up — release active thumb
  const handlePointerUp = useCallback(() => {
    setActiveThumb(null);
  }, []);

  // Handle click on the track — move the closest thumb
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (activeThumb) return; // Don't interfere with drag
      const value = resolveValue(e.clientX);
      if (value === undefined) return;

      // Move whichever thumb is closer
      const distToMin = Math.abs(value - min);
      const distToMax = Math.abs(value - max);
      if (distToMin <= distToMax) {
        onChange(Math.min(value, max - step), max);
      } else {
        onChange(min, Math.max(value, min + step));
      }
    },
    [activeThumb, resolveValue, min, max, step, onChange],
  );

  return (
    <div className="w-full">
      {/* Accessible label (visually hidden) */}
      {label && (
        <label className="sr-only" htmlFor={id}>
          {label}
        </label>
      )}

      {/* Min/Max value display */}
      <div className="mb-1.5 flex items-center justify-between">
        <span className="min-w-[2.5rem] rounded bg-gray-800 px-2 py-0.5 text-center text-xs font-bold text-gray-300">
          {min}
        </span>
        <span className="text-[10px] text-gray-600">~</span>
        <span className="min-w-[2.5rem] rounded bg-gray-800 px-2 py-0.5 text-center text-xs font-bold text-gray-300">
          {max}
        </span>
      </div>

      {/* Slider track */}
      <div
        ref={trackRef}
        id={id}
        role="group"
        aria-label={label ?? "Range slider"}
        onClick={handleTrackClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="relative h-7 touch-none select-none"
      >
        {/* Full track background */}
        <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gray-700" />

        {/* Filled range between thumbs */}
        <div
          className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${colors.fill}`}
          style={{ left: `${fillStart}%`, width: `${fillEnd - fillStart}%` }}
        />

        {/* Active fill (brighter, between thumbs) */}
        <div
          className={`absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full ${colors.track} opacity-70`}
          style={{ left: `${fillStart}%`, width: `${fillEnd - fillStart}%` }}
        />

        {/* Min thumb */}
        <div
          role="slider"
          aria-valuenow={min}
          aria-valuemin={minBound}
          aria-valuemax={maxBound}
          tabIndex={0}
          onPointerDown={handlePointerDown("min")}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onChange(Math.min(min + step, max - step), max);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange(Math.max(minBound, min - step), max);
            }
          }}
          className={`absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 cursor-grab transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:cursor-grabbing ${colors.thumb} ${activeThumb === "min" ? colors.thumbActive : ""}`}
          style={{ left: `${fillStart}%`, width: 18, height: 18 }}
        />

        {/* Max thumb */}
        <div
          role="slider"
          aria-valuenow={max}
          aria-valuemin={minBound}
          aria-valuemax={maxBound}
          tabIndex={0}
          onPointerDown={handlePointerDown("max")}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowUp") {
              e.preventDefault();
              onChange(min, Math.min(max + step, maxBound));
            } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
              e.preventDefault();
              onChange(min, Math.max(min + step, max - step));
            }
          }}
          className={`absolute left-0 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 cursor-grab transition-colors duration-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 active:cursor-grabbing ${colors.thumb} ${activeThumb === "max" ? colors.thumbActive : ""}`}
          style={{ left: `${fillEnd}%`, width: 18, height: 18 }}
        />
      </div>
    </div>
  );
}
