'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import type { Player } from '@/types/player';
import type { Formation, FormationSlot, SquadPlayer } from '@/types/squad';
import { getFormationSlots } from '@/lib/formation-layout';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SlotAction = 'add' | 'replace' | 'remove';

export interface SlotSelection {
  slotId: string;
  slot: FormationSlot;
  action: SlotAction;
  /** The current player in the slot (for replace/remove actions) */
  currentPlayer?: Player;
}

export interface UseSquadBuilderReturn {
  /** Current formation */
  formation: Formation;
  /** Change the formation */
  setFormation: (f: Formation) => void;
  /** All 11 formation slots */
  slots: FormationSlot[];
  /** Current squad players (may be fewer than 11 during editing) */
  squadPlayers: SquadPlayer[];
  /** Set the entire squad at once (e.g., from an AI candidate) */
  setSquadPlayers: (players: SquadPlayer[]) => void;
  /** The currently selected slot (for bottom sheet) */
  selectedSlot: SlotSelection | null;
  /** Open the player picker for a specific slot */
  selectSlot: (slotId: string) => void;
  /** Close the player picker / action sheet */
  clearSelection: () => void;
  /** Add or replace a player in a slot */
  assignPlayer: (player: Player) => void;
  /** Remove a player from a slot */
  removePlayer: (slotId: string) => void;
  /** Swap two players between slots */
  swapPlayers: (slotIdA: string, slotIdB: string) => void;
  /** Get the player currently assigned to a slot */
  getPlayerInSlot: (slotId: string) => Player | undefined;
  /** Whether a player is already in the squad */
  isPlayerInSquad: (spid: number) => boolean;
  /** Whether the squad has been modified from its initial state */
  isModified: boolean;
  /** Reset squad to initial state */
  resetSquad: () => void;
  /** Mark the current state as the new baseline (clears isModified) */
  commitSquad: () => void;
  /** Generate a unique squad ID */
  squadId: string;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages manual squad editing state.
 *
 * Handles formation slots, player assignment/removal, swap operations,
 * and modification tracking. Designed for the tap-to-add/edit mobile flow.
 */
export function useSquadBuilder(
  initialFormation: Formation,
  initialPlayers?: SquadPlayer[],
): UseSquadBuilderReturn {
  const [formation, setFormation] = useState<Formation>(initialFormation);
  const [squadPlayers, setSquadPlayersState] = useState<SquadPlayer[]>(initialPlayers ?? []);
  const [selectedSlot, setSelectedSlot] = useState<SlotSelection | null>(null);

  // Track initial state for modification detection
  const initialPlayersRef = useRef<SquadPlayer[]>(initialPlayers ?? []);
  const squadIdRef = useRef<string>(`squad-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  // Get all formation slots
  const slots = useMemo(() => getFormationSlots(formation), [formation]);

  // Build player map for quick lookups
  const playerMap = useMemo(() => {
    const map = new Map<string, SquadPlayer>();
    for (const sp of squadPlayers) {
      map.set(sp.slotPosition, sp);
    }
    return map;
  }, [squadPlayers]);

  // Check if squad has been modified
  const isModified = useMemo(() => {
    if (initialPlayersRef.current.length !== squadPlayers.length) return true;
    const initialSet = new Set(
      initialPlayersRef.current.map((sp) => `${sp.slotPosition}:${sp.player.spid}`),
    );
    const currentSet = new Set(
      squadPlayers.map((sp) => `${sp.slotPosition}:${sp.player.spid}`),
    );
    if (initialSet.size !== currentSet.size) return true;
    for (const key of currentSet) {
      if (!initialSet.has(key)) return true;
    }
    return false;
  }, [squadPlayers]);

  /**
   * Open the player picker for a slot.
   * Determines whether to show 'add', 'replace', or both actions.
   */
  const selectSlot = useCallback(
    (slotId: string) => {
      const slot = slots.find((s) => s.id === slotId);
      if (!slot) return;

      const currentPlayer = playerMap.get(slotId)?.player;
      const action: SlotAction = currentPlayer ? 'replace' : 'add';

      setSelectedSlot({ slotId, slot, action, currentPlayer });
    },
    [slots, playerMap],
  );

  /** Close any open bottom sheet */
  const clearSelection = useCallback(() => {
    setSelectedSlot(null);
  }, []);

  /** Add or replace a player in the selected slot */
  const assignPlayer = useCallback(
    (player: Player) => {
      if (!selectedSlot) return;

      setSquadPlayersState((prev) => {
        // Remove player from any other slot first (prevent duplicates)
        const filtered = prev.filter(
          (sp) => sp.player.spid !== player.spid && sp.slotPosition !== selectedSlot.slotId,
        );

        // Add the new player to the selected slot
        filtered.push({
          player,
          slotPosition: selectedSlot.slotId,
        });

        return filtered;
      });

      clearSelection();
    },
    [selectedSlot, clearSelection],
  );

  /** Remove a player from a specific slot */
  const removePlayer = useCallback((slotId: string) => {
    setSquadPlayersState((prev) => prev.filter((sp) => sp.slotPosition !== slotId));
    clearSelection();
  }, [clearSelection]);

  /** Swap players between two slots */
  const swapPlayers = useCallback((slotIdA: string, slotIdB: string) => {
    setSquadPlayersState((prev) => {
      const playerA = prev.find((sp) => sp.slotPosition === slotIdA);
      const playerB = prev.find((sp) => sp.slotPosition === slotIdB);

      const others = prev.filter(
        (sp) => sp.slotPosition !== slotIdA && sp.slotPosition !== slotIdB,
      );

      const result = [...others];
      if (playerA) result.push({ ...playerA, slotPosition: slotIdB });
      if (playerB) result.push({ ...playerB, slotPosition: slotIdA });

      return result;
    });
  }, []);

  /** Get the player in a specific slot */
  const getPlayerInSlot = useCallback(
    (slotId: string): Player | undefined => {
      return playerMap.get(slotId)?.player;
    },
    [playerMap],
  );

  /** Check if a player (by spid) is already in the squad */
  const isPlayerInSquad = useCallback(
    (spid: number): boolean => {
      return squadPlayers.some((sp) => sp.player.spid === spid);
    },
    [squadPlayers],
  );

  /** Set the entire squad at once */
  const setSquadPlayers = useCallback((players: SquadPlayer[]) => {
    setSquadPlayersState(players);
    initialPlayersRef.current = players;
  }, []);

  /** Reset to initial state */
  const resetSquad = useCallback(() => {
    setSquadPlayersState(initialPlayersRef.current);
    clearSelection();
  }, [clearSelection]);

  /** Commit current state as new baseline */
  const commitSquad = useCallback(() => {
    initialPlayersRef.current = squadPlayers;
  }, [squadPlayers]);

  return {
    formation,
    setFormation,
    slots,
    squadPlayers,
    setSquadPlayers,
    selectedSlot,
    selectSlot,
    clearSelection,
    assignPlayer,
    removePlayer,
    swapPlayers,
    getPlayerInSlot,
    isPlayerInSquad,
    isModified,
    resetSquad,
    commitSquad,
    squadId: squadIdRef.current,
  };
}
