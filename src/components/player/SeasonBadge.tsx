"use client";

import type { CardType } from "@/types/player";
import { CARD_TYPE_LABELS } from "@/types/player";

/**
 * Visual style configuration for each card type.
 * Each card type has a unique color palette to make season variants
 * instantly distinguishable in search results.
 */
const CARD_TYPE_STYLES: Record<
  CardType,
  {
    /** Background gradient (left-to-right) */
    bg: string;
    /** Text color */
    text: string;
    /** Small icon SVG path (20x20 viewBox) */
    iconPath: string;
    /** Icon stroke color override (defaults to text color) */
    iconColor?: string;
  }
> = {
  BASE: {
    bg: "bg-gradient-to-r from-gray-600 to-gray-500",
    text: "text-gray-100",
    iconPath:
      "M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25",
  },
  SPECIAL: {
    bg: "bg-gradient-to-r from-amber-600 to-yellow-500",
    text: "text-gray-900",
    iconPath:
      "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z",
  },
  ICON: {
    bg: "bg-gradient-to-r from-violet-700 to-purple-500",
    text: "text-white",
    iconPath:
      "M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z",
  },
  LIVE: {
    bg: "bg-gradient-to-r from-emerald-600 to-green-500",
    text: "text-white",
    iconPath:
      "M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z",
  },
  MOM: {
    bg: "bg-gradient-to-r from-cyan-600 to-teal-400",
    text: "text-white",
    iconPath:
      "M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52A6.003 6.003 0 0 1 16.27 9.728M18.75 4.236V4.5c0 2.108-.966 3.99-2.48 5.228m0 0a6.003 6.003 0 0 1-4.52.672m4.52-.672a6.003 6.003 0 0 0-4.52.672",
  },
  POTW: {
    bg: "bg-gradient-to-r from-sky-600 to-blue-400",
    text: "text-white",
    iconPath:
      "M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z",
  },
};

export interface SeasonBadgeProps {
  /** Card type to determine visual styling */
  cardType: CardType;
  /** Season name to display (e.g., 'TOTNUCL (24/25)') */
  seasonName?: string;
  /** Render a smaller, more compact variant for tight spaces */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * A visually distinct badge that communicates the card type (season/version)
 * of a player card. Each card type uses a unique color gradient and icon
 * so users can instantly differentiate variants at a glance.
 *
 * - BASE: Gray gradient + book icon
 * - SPECIAL: Gold gradient + sparkle icon
 * - ICON: Purple gradient + star icon
 * - LIVE: Green gradient + lightning bolt icon
 * - MOM: Teal gradient + trophy icon
 * - POTW: Blue gradient + calendar icon
 */
export default function SeasonBadge({
  cardType,
  seasonName,
  compact = false,
  className = "",
}: SeasonBadgeProps) {
  const style = CARD_TYPE_STYLES[cardType];
  const label = CARD_TYPE_LABELS[cardType];

  if (compact) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold leading-tight ${style.bg} ${style.text} ${className}`}
      >
        <svg
          className="h-3 w-3 shrink-0"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d={style.iconPath} />
        </svg>
        {label}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-bold leading-tight ${style.bg} ${style.text} ${className}`}
    >
      <svg
        className="h-3.5 w-3.5 shrink-0"
        viewBox="0 0 20 20"
        fill="currentColor"
      >
        <path d={style.iconPath} />
      </svg>
      <span>{label}</span>
      {seasonName && (
        <span className="font-medium opacity-90">· {seasonName}</span>
      )}
    </span>
  );
}
