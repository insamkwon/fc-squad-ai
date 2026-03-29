"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { getPositionColor } from "@/lib/stat-utils";
import { getPlayerImageUrl } from "@/lib/player-utils";

interface PlayerImageProps {
  spid: number;
  name: string;
  nameEn: string;
  position: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Player image with graceful fallback.
 *
 * Attempts to load the player's face portrait from the Nexon CDN.
 * If the image fails (CDN anti-hotlinking returns 403), displays a
 * position-colored fallback with the player's initials.
 */
export default function PlayerImage({
  spid,
  name,
  nameEn,
  position,
  size = "md",
}: PlayerImageProps) {
  const [errored, setErrored] = useState(false);

  const handleError = useCallback(() => setErrored(true), []);

  // Initials: prefer English name first letter for readability
  const initial = (nameEn || name).charAt(0).toUpperCase();

  const sizeClasses = {
    sm: "h-10 w-10 text-sm",
    md: "h-12 w-12 text-base sm:h-14 sm:w-14 sm:text-lg",
    lg: "h-14 w-14 text-lg sm:h-20 sm:w-20 sm:text-xl",
  }[size];

  const sizesAttr = {
    sm: "40px",
    md: "48px",
    lg: "56px",
  }[size];

  if (errored) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg font-bold text-white/80 select-none ${sizeClasses} ${getPositionColor(position)}`}
      >
        {initial}
      </div>
    );
  }

  return (
    <Image
      src={getPlayerImageUrl(spid)}
      alt={name}
      fill
      sizes={sizesAttr}
      className="object-cover"
      unoptimized
      onError={handleError}
    />
  );
}
