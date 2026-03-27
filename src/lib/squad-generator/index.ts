/**
 * Squad generation engine for FC Online.
 *
 * This module provides AI-aware squad building that takes parsed natural
 * language parameters and produces optimized starting XI candidates with
 * chemistry links, position assignments, and budget compliance.
 *
 * @example
 * ```typescript
 * import { generateSquads } from '@/lib/squad-generator';
 * import { playerStore } from '@/lib/player-store';
 * import { parseSquadRequest } from '@/lib/ai';
 *
 * // Parse user input
 * const parsed = await parseSquadRequest('4-3-3 EPL budget 5억 with Son Heung-min');
 *
 * // Generate squads
 * const result = generateSquads(parsed.request, playerStore.getAllPlayers(), {
 *   count: 3,
 * });
 *
 * console.log(result.candidates); // 3 SquadCandidate objects sorted by quality
 * ```
 */

export { generateSquads } from './generator';
export type { GenerationStrategy, SelectionWeights, GenerationOptions } from './generator';

export {
  calculateLinkStrength,
  getChemistryLinks,
  calculateSquadChemistry,
  estimateChemistryPotential,
  countSameTeamLinks,
  countSameLeagueLinks,
} from './chemistry';
export type { ChemistryLink } from './chemistry';
