/**
 * Player-related utility functions.
 */

const NEXON_CDN_BASE = "https://fconline.nexon.com/live/externalAssets/common";

/**
 * Returns the Nexon CDN URL for a player's face portrait.
 * Uses PID (base player ID) since the face is the same across all season cards.
 *
 * @param pid - Base player ID (e.g., 101001)
 */
export function getPlayerImageUrl(pid: number): string {
  return `${NEXON_CDN_BASE}/players/p${pid}.png`;
}
