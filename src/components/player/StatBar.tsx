"use client";

import { statBarPercent } from "@/lib/stat-utils";

export interface StatBarProps {
  /** Current stat value (0–99) */
  value: number;
  /** Fill color – Tailwind bg-* class (e.g. "bg-emerald-500") */
  color?: string;
  /** Bar height preset */
  size?: "sm" | "md" | "lg";
  /** Whether this bar represents the best value among compared players */
  isBest?: boolean;
  /** Whether this bar represents the worst value among compared players */
  isWorst?: boolean;
  /** Whether to show the numeric value label to the right of the bar */
  showValue?: boolean;
  /** Additional CSS classes for the outer wrapper */
  className?: string;
  /** Custom max value (defaults to 99) */
  max?: number;
  /** Animate the bar fill on mount */
  animate?: boolean;
}

const SIZE_CLASSES = {
  sm: "h-1.5",
  md: "h-2.5",
  lg: "h-3.5",
} as const;

/**
 * A single horizontal stat bar indicator with an optional numeric value.
 *
 * Used inside player cards and comparison views to visualize individual
 * player stats (pace, shooting, etc.) as colored progress bars.
 */
export default function StatBar({
  value,
  color = "bg-gray-500",
  size = "sm",
  isBest = false,
  isWorst = false,
  showValue = false,
  className = "",
  max = 99,
  animate = false,
}: StatBarProps) {
  const percent = statBarPercent(value, max);

  // Highlight classes for the fill bar
  const bestClasses = "ring-1 ring-yellow-400/60 shadow-[0_0_6px_rgba(250,204,21,0.25)]";
  const worstClasses = "opacity-40";

  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <div className={`w-full rounded-full bg-gray-800 ${SIZE_CLASSES[size]}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${color} ${
            isBest ? bestClasses : isWorst ? worstClasses : ""
          } ${animate ? "origin-left animate-[grow_0.6s_ease-out]" : ""}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showValue && (
        <span
          className={`w-6 shrink-0 text-right text-[10px] tabular-nums sm:w-7 ${
            isBest
              ? "font-bold text-yellow-300"
              : isWorst
                ? "font-medium text-gray-500"
                : "font-semibold text-gray-300"
          }`}
        >
          {value}
        </span>
      )}
    </div>
  );
}
