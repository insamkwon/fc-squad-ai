/**
 * Formation-based positional layout system.
 *
 * Provides utilities for working with formation positions on the pitch,
 * including position classification, coordinate mapping, line structure
 * analysis, and validation.
 *
 * The pitch coordinate system uses percentage values (0-100) where:
 *   - (0, 0) = top-left corner of the pitch container
 *   - (100, 100) = bottom-right corner of the pitch container
 *   - Attackers are near y=10 (top of pitch)
 *   - Midfielders are around y=30-50
 *   - Defenders are around y=60-70
 *   - Goalkeeper is at y=90
 *
 * The SVG field area occupies a sub-region of the container (with margins
 * for rounded corners and visual padding). Player positions should stay
 * within the field bounds for visual accuracy.
 */

import type { Formation, FormationSlot } from '@/types/squad';
import { FORMATION_SLOTS } from '@/types/squad';

// ---------------------------------------------------------------------------
// Position Categories
// ---------------------------------------------------------------------------

/** Broad position category for classification */
export type PositionCategory = 'GK' | 'DEF' | 'MID' | 'FWD';

/** Maps specific position names to their broad category */
const POSITION_CATEGORY_MAP: Record<string, PositionCategory> = {
  GK: 'GK',
  CB: 'DEF',
  LB: 'DEF',
  RB: 'DEF',
  LWB: 'DEF',
  RWB: 'DEF',
  CDM: 'MID',
  CM: 'MID',
  CAM: 'MID',
  LM: 'MID',
  RM: 'MID',
  ST: 'FWD',
  CF: 'FWD',
  LW: 'FWD',
  RW: 'FWD',
  LF: 'FWD',
  RF: 'FWD',
};

/**
 * Classify a specific position into its broad category (GK/DEF/MID/FWD).
 *
 * @param position - Specific position string (e.g., "CB", "CAM", "ST")
 * @returns The broad category, or 'MID' as a safe default for unknown positions
 */
export function getPositionCategory(position: string): PositionCategory {
  return POSITION_CATEGORY_MAP[position] ?? 'MID';
}

/**
 * Get the color associated with a position category.
 * Used for position dots in formation previews and indicators.
 */
export function getPositionCategoryColor(category: PositionCategory): string {
  switch (category) {
    case 'GK': return '#ef4444';
    case 'DEF': return '#f59e0b';
    case 'MID': return '#3b82f6';
    case 'FWD': return '#22c55e';
    default: return '#ffffff';
  }
}

// ---------------------------------------------------------------------------
// Field Boundaries
// ---------------------------------------------------------------------------

/**
 * Field boundaries as percentages of the pitch container.
 *
 * Derived from the SVG FormationPitch constants:
 *   - ViewBox: 680 × 1050
 *   - Field area: x=40 to x=640 (width 600), y=62 to y=988 (height 926)
 *   - Left margin: 40/680 ≈ 5.88%
 *   - Right edge: 640/680 ≈ 94.12%
 *   - Top margin: 62/1050 ≈ 5.90%
 *   - Bottom edge: 988/1050 ≈ 94.10%
 */
export const FIELD_BOUNDS = {
  /** Left edge of playable field area (percentage of container) */
  left: 5.88,
  /** Right edge of playable field area (percentage of container) */
  right: 94.12,
  /** Top edge of playable field area (percentage of container) */
  top: 5.90,
  /** Bottom edge of playable field area (percentage of container) */
  bottom: 94.10,
  /** Usable width for player positioning (with small inner margin) */
  get usableLeft() { return this.left + 2; },   // ~7.88%
  /** Usable right boundary (with small inner margin) */
  get usableRight() { return this.right - 2; }, // ~92.12%
  /** Usable top boundary (with small inner margin) */
  get usableTop() { return this.top + 2; },     // ~7.90%
  /** Usable bottom boundary (with small inner margin) */
  get usableBottom() { return this.bottom - 2; }, // ~92.10%
} as const;

/**
 * Check if a position is within the playable field boundaries.
 *
 * @param x - X coordinate (0-100 percentage)
 * @param y - Y coordinate (0-100 percentage)
 * @param margin - Optional inner margin to add (default: 0)
 * @returns true if position is within field bounds
 */
export function isWithinFieldBounds(
  x: number,
  y: number,
  margin: number = 0,
): boolean {
  return (
    x >= FIELD_BOUNDS.left + margin &&
    x <= FIELD_BOUNDS.right - margin &&
    y >= FIELD_BOUNDS.top + margin &&
    y <= FIELD_BOUNDS.bottom - margin
  );
}

// ---------------------------------------------------------------------------
// Formation Line Structure
// ---------------------------------------------------------------------------

/** Information about a horizontal line in the formation */
export interface FormationLine {
  /** Line label (e.g., "Defense", "Midfield", "Attack") */
  label: string;
  labelKo: string;
  /** Category of positions in this line */
  category: PositionCategory;
  /** Average y-position of the line */
  y: number;
  /** Slot positions belonging to this line */
  slots: FormationSlot[];
  /** Player count in this line */
  count: number;
}

/**
 * Parse a formation string (e.g., "4-3-3") into its line structure.
 *
 * @param formation - Formation string
 * @returns Array of line counts from back to front (excluding GK)
 *
 * @example
 * parseFormationString("4-3-3")  // [4, 3, 3]
 * parseFormationString("4-2-3-1") // [4, 2, 3, 1]
 * parseFormationString("3-4-1-2") // [3, 4, 1, 2]
 */
export function parseFormationString(formation: string): number[] {
  return formation.split('-').map(Number);
}

/**
 * Get the formation line structure with positions grouped by horizontal lines.
 *
 * Lines are ordered from back (defense) to front (attack).
 * The goalkeeper is always a separate first line.
 *
 * @param formation - Formation identifier
 * @returns Array of FormationLine objects
 */
export function getFormationLineStructure(formation: Formation): FormationLine[] {
  const slots = FORMATION_SLOTS[formation];
  if (!slots) return [];

  const gkSlot = slots.find((s) => s.position === 'GK');
  const outfieldSlots = slots.filter((s) => s.position !== 'GK');

  // Group outfield slots by their position category
  const categoryGroups: Map<PositionCategory, FormationSlot[]> = new Map();
  for (const slot of outfieldSlots) {
    const cat = getPositionCategory(slot.position);
    if (!categoryGroups.has(cat)) categoryGroups.set(cat, []);
    categoryGroups.get(cat)!.push(slot);
  }

  const lines: FormationLine[] = [];

  // Always add GK line first
  if (gkSlot) {
    lines.push({
      label: 'Goalkeeper',
      labelKo: '골키퍼',
      category: 'GK',
      y: gkSlot.y,
      slots: [gkSlot],
      count: 1,
    });
  }

  // Add remaining lines in order: DEF → MID → FWD
  const lineOrder: PositionCategory[] = ['DEF', 'MID', 'FWD'];
  const lineLabels: Record<PositionCategory, { label: string; labelKo: string }> = {
    GK: { label: 'Goalkeeper', labelKo: '골키퍼' },
    DEF: { label: 'Defense', labelKo: '수비' },
    MID: { label: 'Midfield', labelKo: '미드필더' },
    FWD: { label: 'Attack', labelKo: '공격' },
  };

  for (const cat of lineOrder) {
    const group = categoryGroups.get(cat);
    if (group && group.length > 0) {
      const avgY = group.reduce((sum, s) => sum + s.y, 0) / group.length;
      lines.push({
        label: lineLabels[cat].label,
        labelKo: lineLabels[cat].labelKo,
        category: cat,
        y: avgY,
        slots: group,
        count: group.length,
      });
    }
  }

  return lines;
}

// ---------------------------------------------------------------------------
// Position Validation
// ---------------------------------------------------------------------------

/** Result of formation slot validation */
export interface ValidationResult {
  /** Whether all positions are valid */
  valid: boolean;
  /** Array of validation issues */
  issues: ValidationIssue[];
}

/** A single validation issue */
export interface ValidationIssue {
  /** Severity of the issue */
  severity: 'error' | 'warning';
  /** Human-readable message */
  message: string;
  /** Related slot ID */
  slotId?: string;
}

/** Minimum distance between two player positions (to prevent overlap) */
const MIN_POSITION_DISTANCE = 5;

/**
 * Validate all formation slots for a given formation.
 *
 * Checks:
 * 1. All positions are within field bounds
 * 2. No two positions are too close together (overlap detection)
 * 3. Exactly 11 players (including GK)
 * 4. Exactly 1 GK
 * 5. Formation line structure matches the formation string
 *
 * @param formation - Formation to validate
 * @returns Validation result with any issues found
 */
export function validateFormationSlots(formation: Formation): ValidationResult {
  const slots = FORMATION_SLOTS[formation];
  const issues: ValidationIssue[] = [];

  if (!slots) {
    return {
      valid: false,
      issues: [{ severity: 'error', message: `Unknown formation: ${formation}` }],
    };
  }

  // Check player count
  if (slots.length !== 11) {
    issues.push({
      severity: 'error',
      message: `Expected 11 players, got ${slots.length}`,
    });
  }

  // Check GK count
  const gkSlots = slots.filter((s) => s.position === 'GK');
  if (gkSlots.length === 0) {
    issues.push({ severity: 'error', message: 'No goalkeeper found' });
  } else if (gkSlots.length > 1) {
    issues.push({
      severity: 'error',
      message: `Expected 1 goalkeeper, found ${gkSlots.length}`,
    });
  }

  // Check field bounds
  for (const slot of slots) {
    if (!isWithinFieldBounds(slot.x, slot.y)) {
      issues.push({
        severity: 'warning',
        message: `Slot ${slot.id} (${slot.position}) at (${slot.x}, ${slot.y}) is outside field bounds`,
        slotId: slot.id,
      });
    }
  }

  // Check for overlapping positions
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const dist = Math.sqrt(
        (slots[i].x - slots[j].x) ** 2 + (slots[i].y - slots[j].y) ** 2,
      );
      if (dist < MIN_POSITION_DISTANCE) {
        issues.push({
          severity: 'warning',
          message: `Slots ${slots[i].id} and ${slots[j].id} are too close (distance: ${dist.toFixed(1)})`,
          slotId: slots[i].id,
        });
      }
    }
  }

  // Check formation line counts match the formation string
  const outfieldSlots = slots.filter((s) => s.position !== 'GK');
  const expectedLines = parseFormationString(formation);

  // Group outfield slots by y-coordinate proximity into lines
  // Sort by y descending (defense first)
  const sortedByY = [...outfieldSlots].sort((a, b) => b.y - a.y);

  // Cluster into lines by y-proximity (within 8 units)
  const lines: number[] = [];
  let currentLine: FormationSlot[] = [sortedByY[0]];

  for (let i = 1; i < sortedByY.length; i++) {
    const prevAvgY = currentLine.reduce((s, sl) => s + sl.y, 0) / currentLine.length;
    if (Math.abs(sortedByY[i].y - prevAvgY) <= 8) {
      currentLine.push(sortedByY[i]);
    } else {
      lines.push(currentLine.length);
      currentLine = [sortedByY[i]];
    }
  }
  lines.push(currentLine.length);

  // Compare line counts (may not always match perfectly due to creative formations)
  if (lines.length !== expectedLines.length) {
    issues.push({
      severity: 'warning',
      message: `Formation "${formation}" expects ${expectedLines.length} lines but found ${lines.length}`,
    });
  } else {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i] !== expectedLines[i]) {
        issues.push({
          severity: 'warning',
          message: `Line ${i + 1}: expected ${expectedLines[i]} players, found ${lines[i]}`,
        });
      }
    }
  }

  return {
    valid: issues.filter((i) => i.severity === 'error').length === 0,
    issues,
  };
}

// ---------------------------------------------------------------------------
// Formation Position Queries
// ---------------------------------------------------------------------------

/**
 * Get the formation slots for a given formation.
 * Convenience wrapper around FORMATION_SLOTS with type safety.
 *
 * @param formation - Formation identifier
 * @returns Array of 11 formation slots
 */
export function getFormationSlots(formation: Formation): FormationSlot[] {
  return FORMATION_SLOTS[formation];
}

/**
 * Get a specific slot by its ID within a formation.
 *
 * @param formation - Formation identifier
 * @param slotId - Slot ID (e.g., "ST_1", "CB_2", "GK")
 * @returns The formation slot, or undefined if not found
 */
export function getSlotById(
  formation: Formation,
  slotId: string,
): FormationSlot | undefined {
  return FORMATION_SLOTS[formation]?.find((s) => s.id === slotId);
}

/**
 * Get all slots for a given position within a formation.
 *
 * @param formation - Formation identifier
 * @param position - Position name (e.g., "CB", "CM", "ST")
 * @returns Array of matching slots
 */
export function getSlotsByPosition(
  formation: Formation,
  position: string,
): FormationSlot[] {
  return FORMATION_SLOTS[formation]?.filter((s) => s.position === position) ?? [];
}

/**
 * Calculate the Euclidean distance between two positions.
 *
 * @param a - First position
 * @param b - Second position
 * @returns Distance in percentage units
 */
export function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

/**
 * Get the horizontal symmetry score of a formation (0-1).
 * A perfectly symmetric formation scores 1.0.
 *
 * This checks if for each player at position (x, y), there is a corresponding
 * player at approximately (100-x, y) with the same position.
 *
 * @param formation - Formation identifier
 * @returns Symmetry score from 0 (asymmetric) to 1 (perfectly symmetric)
 */
export function getSymmetryScore(formation: Formation): number {
  const slots = FORMATION_SLOTS[formation];
  if (!slots) return 0;

  const outfieldSlots = slots.filter((s) => s.position !== 'GK');
  const gkSlot = slots.find((s) => s.position === 'GK');

  // GK should be centered
  if (gkSlot && Math.abs(gkSlot.x - 50) > 2) return 0;

  let matchedPairs = 0;
  const used = new Set<number>();

  for (let i = 0; i < outfieldSlots.length; i++) {
    if (used.has(i)) continue;

    const expectedMirrorX = 100 - outfieldSlots[i].x;
    const expectedMirrorY = outfieldSlots[i].y;

    // Find matching mirror slot
    for (let j = i + 1; j < outfieldSlots.length; j++) {
      if (used.has(j)) continue;

      const dx = Math.abs(outfieldSlots[j].x - expectedMirrorX);
      const dy = Math.abs(outfieldSlots[j].y - expectedMirrorY);

      if (dx <= 3 && dy <= 3) {
        matchedPairs++;
        used.add(i);
        used.add(j);
        break;
      }
    }
  }

  // Account for center players (self-mirroring)
  const centerPlayers = outfieldSlots.filter(
    (s) => !used.has(outfieldSlots.indexOf(s)) && Math.abs(s.x - 50) <= 5,
  );

  // Each pair counts as 2 matched players
  const matchedCount = matchedPairs * 2 + centerPlayers.length;
  return outfieldSlots.length > 0 ? matchedCount / outfieldSlots.length : 0;
}

/**
 * Check if a position is compatible with a formation slot.
 * Used when assigning players to formation positions.
 *
 * FC Online allows flexible position assignment, but some positions
 * are more natural fits for certain slots.
 *
 * @param playerPosition - The player's natural position
 * @param slotPosition - The formation slot's required position
 * @returns Compatibility score (0-1), where 1.0 is a perfect match
 */
export function getPositionCompatibility(
  playerPosition: string,
  slotPosition: string,
): number {
  // Perfect match
  if (playerPosition === slotPosition) return 1.0;

  // Define position compatibility groups
  const compatibilityGroups: Record<string, string[]> = {
    ST: ['ST', 'CF', 'CAM'],
    CF: ['CF', 'ST', 'CAM'],
    LW: ['LW', 'LM', 'LF', 'ST'],
    RW: ['RW', 'RM', 'RF', 'ST'],
    LF: ['LF', 'LW', 'ST', 'CF'],
    RF: ['RF', 'RW', 'ST', 'CF'],
    CAM: ['CAM', 'CM', 'CF'],
    CM: ['CM', 'CAM', 'CDM'],
    CDM: ['CDM', 'CM', 'CB'],
    LM: ['LM', 'LW', 'LB', 'CM'],
    RM: ['RM', 'RW', 'RB', 'CM'],
    LB: ['LB', 'LM', 'LWB', 'CB'],
    RB: ['RB', 'RM', 'RWB', 'CB'],
    LWB: ['LWB', 'LB', 'LM'],
    RWB: ['RWB', 'RB', 'RM'],
    CB: ['CB', 'CDM', 'LB', 'RB'],
    GK: ['GK'],
  };

  const compatible = compatibilityGroups[playerPosition] ?? [];
  const idx = compatible.indexOf(slotPosition);
  if (idx === -1) return 0.2; // Very low compatibility for completely unrelated positions

  // Higher index = less compatible
  return idx === 0 ? 0.95 : idx === 1 ? 0.8 : 0.6;
}

/**
 * Get a summary of the formation for display purposes.
 *
 * @param formation - Formation identifier
 * @returns Object with formation name, line counts, and position breakdown
 */
export function getFormationSummary(formation: Formation) {
  const slots = FORMATION_SLOTS[formation];
  if (!slots) return null;

  const positions = slots.reduce<Record<string, number>>((acc, slot) => {
    acc[slot.position] = (acc[slot.position] || 0) + 1;
    return acc;
  }, {});

  const categories = slots.reduce<Record<PositionCategory, number>>(
    (acc, slot) => {
      const cat = getPositionCategory(slot.position);
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    },
    { GK: 0, DEF: 0, MID: 0, FWD: 0 },
  );

  return {
    name: formation,
    lineCounts: parseFormationString(formation),
    positions,
    categories,
    slotCount: slots.length,
  };
}
