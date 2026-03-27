import { Player } from './player';

export interface Squad {
  id: string;
  formation: Formation;
  players: SquadPlayer[];
  totalBudget: number;
  totalCost: number;
  teamColor?: string;
  chemistryScore: number;
  createdAt: string;
}

export interface SquadPlayer {
  player: Player;
  slotPosition: string;
}

export type Formation =
  | '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1' | '4-1-4-1'
  | '3-4-3' | '4-5-1' | '5-3-2' | '5-4-1' | '4-3-2-1'
  | '4-4-1-1' | '3-4-1-2';

export const FORMATIONS: Formation[] = [
  '4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '4-1-4-1',
  '3-4-3', '4-5-1', '5-3-2', '5-4-1', '4-3-2-1',
  '4-4-1-1', '3-4-1-2',
];

export interface FormationSlot {
  id: string;
  position: string;
  x: number; // 0-100 percentage
  y: number; // 0-100 percentage
}

/**
 * Formation slot positions for all supported formations.
 *
 * Coordinate system: percentage-based (0-100) where:
 *   - (0, 0) = top-left, (100, 100) = bottom-right
 *   - Attackers near y=10-15 (top = opponent's goal)
 *   - Midfielders around y=22-50
 *   - Defenders around y=54-68
 *   - Goalkeeper at y=90
 *
 * Standardized positions ensure:
 *   1. Horizontal symmetry around x=50 (mirror positions)
 *   2. Realistic line depth and spacing
 *   3. Consistent back-line positions across formations
 *      - 4-back: LB(y=62), CBs(y=67), RB(y=62)
 *      - 3-back: CBs arc at y=64/68/64
 *      - 5-back: WBs(y=54), CBs arc at y=65/68/65
 */
export const FORMATION_SLOTS: Record<Formation, FormationSlot[]> = {
  '4-4-2': [
    { id: 'ST_1', position: 'ST', x: 38, y: 12 },
    { id: 'ST_2', position: 'ST', x: 62, y: 12 },
    { id: 'LM', position: 'LM', x: 12, y: 33 },
    { id: 'CM_1', position: 'CM', x: 36, y: 36 },
    { id: 'CM_2', position: 'CM', x: 64, y: 36 },
    { id: 'RM', position: 'RM', x: 88, y: 33 },
    { id: 'LB', position: 'LB', x: 10, y: 62 },
    { id: 'CB_1', position: 'CB', x: 35, y: 67 },
    { id: 'CB_2', position: 'CB', x: 65, y: 67 },
    { id: 'RB', position: 'RB', x: 90, y: 62 },
    { id: 'GK', position: 'GK', x: 50, y: 90 },
  ],
  '4-3-3': [
    { id: 'LW', position: 'LW', x: 15, y: 15 },
    { id: 'ST', position: 'ST', x: 50, y: 10 },
    { id: 'RW', position: 'RW', x: 85, y: 15 },
    { id: 'CM_1', position: 'CM', x: 30, y: 36 },
    { id: 'CM_2', position: 'CM', x: 50, y: 42 },
    { id: 'CM_3', position: 'CM', x: 70, y: 36 },
    { id: 'LB', position: 'LB', x: 10, y: 62 },
    { id: 'CB_1', position: 'CB', x: 35, y: 67 },
    { id: 'CB_2', position: 'CB', x: 65, y: 67 },
    { id: 'RB', position: 'RB', x: 90, y: 62 },
    { id: 'GK', position: 'GK', x: 50, y: 90 },
  ],
  '3-5-2': [
    { id: 'ST_1', position: 'ST', x: 38, y: 12 },
    { id: 'ST_2', position: 'ST', x: 62, y: 12 },
    { id: 'LM', position: 'LM', x: 10, y: 38 },
    { id: 'CM_1', position: 'CM', x: 30, y: 36 },
    { id: 'CAM', position: 'CAM', x: 50, y: 28 },
    { id: 'CM_2', position: 'CM', x: 70, y: 36 },
    { id: 'RM', position: 'RM', x: 90, y: 38 },
    { id: 'CB_1', position: 'CB', x: 25, y: 64 },
    { id: 'CB_2', position: 'CB', x: 50, y: 68 },
    { id: 'CB_3', position: 'CB', x: 75, y: 64 },
    { id: 'GK', position: 'GK', x: 50, y: 90 },
  ],
  '4-2-3-1': [
    { id: 'CF', position: 'CF', x: 50, y: 12 },
    { id: 'LW', position: 'LW', x: 18, y: 24 },
    { id: 'CAM', position: 'CAM', x: 50, y: 28 },
    { id: 'RW', position: 'RW', x: 82, y: 24 },
    { id: 'CDM_1', position: 'CDM', x: 38, y: 46 },
    { id: 'CDM_2', position: 'CDM', x: 62, y: 46 },
    { id: 'LB', position: 'LB', x: 10, y: 62 },
    { id: 'CB_1', position: 'CB', x: 35, y: 67 },
    { id: 'CB_2', position: 'CB', x: 65, y: 67 },
    { id: 'RB', position: 'RB', x: 90, y: 62 },
    { id: 'GK', position: 'GK', x: 50, y: 90 },
  ],
  '4-1-4-1': [
    { id: 'CF', position: 'CF', x: 50, y: 12 },
    { id: 'LM', position: 'LM', x: 12, y: 34 },
    { id: 'CM_1', position: 'CM', x: 34, y: 36 },
    { id: 'CM_2', position: 'CM', x: 66, y: 36 },
    { id: 'RM', position: 'RM', x: 88, y: 34 },
    { id: 'CDM', position: 'CDM', x: 50, y: 50 },
    { id: 'LB', position: 'LB', x: 10, y: 62 },
    { id: 'CB_1', position: 'CB', x: 35, y: 67 },
    { id: 'CB_2', position: 'CB', x: 65, y: 67 },
    { id: 'RB', position: 'RB', x: 90, y: 62 },
    { id: 'GK', position: 'GK', x: 50, y: 90 },
  ],
  '3-4-3': [
    { id: 'LW', position: 'LW', x: 15, y: 15 },
    { id: 'ST', position: 'ST', x: 50, y: 10 },
    { id: 'RW', position: 'RW', x: 85, y: 15 },
    { id: 'LM', position: 'LM', x: 15, y: 38 },
    { id: 'CM_1', position: 'CM', x: 38, y: 38 },
    { id: 'CM_2', position: 'CM', x: 62, y: 38 },
    { id: 'RM', position: 'RM', x: 85, y: 38 },
    { id: 'CB_1', position: 'CB', x: 25, y: 64 },
    { id: 'CB_2', position: 'CB', x: 50, y: 68 },
    { id: 'CB_3', position: 'CB', x: 75, y: 64 },
    { id: 'GK', position: 'GK', x: 50, y: 90 },
  ],
  '4-5-1': [
    { id: 'ST', position: 'ST', x: 50, y: 10 },
    { id: 'LM', position: 'LM', x: 12, y: 30 },
    { id: 'CM_1', position: 'CM', x: 32, y: 28 },
    { id: 'CAM', position: 'CAM', x: 50, y: 22 },
    { id: 'CM_2', position: 'CM', x: 68, y: 28 },
    { id: 'RM', position: 'RM', x: 88, y: 30 },
    { id: 'LB', position: 'LB', x: 10, y: 62 },
    { id: 'CB_1', position: 'CB', x: 35, y: 67 },
    { id: 'CB_2', position: 'CB', x: 65, y: 67 },
    { id: 'RB', position: 'RB', x: 90, y: 62 },
    { id: 'GK', position: 'GK', x: 50, y: 90 },
  ],
  '5-3-2': [
    { id: 'ST_1', position: 'ST', x: 38, y: 12 },
    { id: 'ST_2', position: 'ST', x: 62, y: 12 },
    { id: 'CM_1', position: 'CM', x: 30, y: 38 },
    { id: 'CM_2', position: 'CM', x: 50, y: 42 },
    { id: 'CM_3', position: 'CM', x: 70, y: 38 },
    { id: 'LWB', position: 'LWB', x: 8, y: 54 },
    { id: 'CB_1', position: 'CB', x: 30, y: 65 },
    { id: 'CB_2', position: 'CB', x: 50, y: 68 },
    { id: 'CB_3', position: 'CB', x: 70, y: 65 },
    { id: 'RWB', position: 'RWB', x: 92, y: 54 },
    { id: 'GK', position: 'GK', x: 50, y: 90 },
  ],
  '5-4-1': [
    { id: 'ST', position: 'ST', x: 50, y: 10 },
    { id: 'LM', position: 'LM', x: 15, y: 32 },
    { id: 'CM_1', position: 'CM', x: 38, y: 36 },
    { id: 'CM_2', position: 'CM', x: 62, y: 36 },
    { id: 'RM', position: 'RM', x: 85, y: 32 },
    { id: 'LWB', position: 'LWB', x: 8, y: 54 },
    { id: 'CB_1', position: 'CB', x: 30, y: 65 },
    { id: 'CB_2', position: 'CB', x: 50, y: 68 },
    { id: 'CB_3', position: 'CB', x: 70, y: 65 },
    { id: 'RWB', position: 'RWB', x: 92, y: 54 },
    { id: 'GK', position: 'GK', x: 50, y: 90 },
  ],
  '4-3-2-1': [
    { id: 'CF', position: 'CF', x: 50, y: 10 },
    { id: 'CAM_1', position: 'CAM', x: 35, y: 24 },
    { id: 'CAM_2', position: 'CAM', x: 65, y: 24 },
    { id: 'CM_1', position: 'CM', x: 24, y: 42 },
    { id: 'CM_2', position: 'CM', x: 50, y: 45 },
    { id: 'CM_3', position: 'CM', x: 76, y: 42 },
    { id: 'LB', position: 'LB', x: 10, y: 62 },
    { id: 'CB_1', position: 'CB', x: 35, y: 67 },
    { id: 'CB_2', position: 'CB', x: 65, y: 67 },
    { id: 'RB', position: 'RB', x: 90, y: 62 },
    { id: 'GK', position: 'GK', x: 50, y: 90 },
  ],
  '4-4-1-1': [
    { id: 'CF', position: 'CF', x: 50, y: 10 },
    { id: 'CAM', position: 'CAM', x: 50, y: 24 },
    { id: 'LM', position: 'LM', x: 12, y: 40 },
    { id: 'CM_1', position: 'CM', x: 35, y: 40 },
    { id: 'CM_2', position: 'CM', x: 65, y: 40 },
    { id: 'RM', position: 'RM', x: 88, y: 40 },
    { id: 'LB', position: 'LB', x: 10, y: 62 },
    { id: 'CB_1', position: 'CB', x: 35, y: 67 },
    { id: 'CB_2', position: 'CB', x: 65, y: 67 },
    { id: 'RB', position: 'RB', x: 90, y: 62 },
    { id: 'GK', position: 'GK', x: 50, y: 90 },
  ],
  '3-4-1-2': [
    { id: 'ST_1', position: 'ST', x: 38, y: 10 },
    { id: 'ST_2', position: 'ST', x: 62, y: 10 },
    { id: 'CAM', position: 'CAM', x: 50, y: 26 },
    { id: 'LM', position: 'LM', x: 12, y: 40 },
    { id: 'CM_1', position: 'CM', x: 35, y: 40 },
    { id: 'CM_2', position: 'CM', x: 65, y: 40 },
    { id: 'RM', position: 'RM', x: 88, y: 40 },
    { id: 'CB_1', position: 'CB', x: 25, y: 64 },
    { id: 'CB_2', position: 'CB', x: 50, y: 68 },
    { id: 'CB_3', position: 'CB', x: 75, y: 64 },
    { id: 'GK', position: 'GK', x: 50, y: 90 },
  ],
};

/** Team color selection with primary/secondary kit colors */
export interface TeamColorSelection {
  /** Primary kit color (hex, e.g. "#6CABDD") */
  primary: string;
  /** Secondary/accent kit color (hex, e.g. "#1C2C5B") */
  secondary: string;
  /** Optional preset team ID if selected from presets */
  presetId?: string;
  /** Optional preset team name for display */
  presetName?: string;
}

export interface SquadRequest {
  formation: Formation;
  /** Single budget value (legacy, in raw BP units) */
  budget?: number;
  /** Minimum budget in 억 units (multiplied by 100,000,000 server-side) */
  budgetMin?: number;
  /** Maximum budget in 억 units (multiplied by 100,000,000 server-side) */
  budgetMax?: number;
  teamColor?: string;
  prompt?: string;
  /** Array of player spid values that must be included in the generated squad */
  pinnedPlayers?: number[];
}

export interface SquadCandidate {
  squad: Squad;
  score: number;
  reasoning: string;
}
