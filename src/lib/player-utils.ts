/**
 * Player-related utility functions.
 */

const NEXON_CDN_BASE =
  "https://fo4.dn.nexoncdn.co.kr/live/externalAssets/common";

/**
 * Returns the CDN URL for a player's face portrait.
 * Uses SPID (season-specific player ID) for the Nexon CDN.
 *
 * @param spid - Season-specific player ID (e.g., 110190043)
 */
export function getPlayerImageUrl(spid: number): string {
  return `${NEXON_CDN_BASE}/players/p${spid}.png`;
}
