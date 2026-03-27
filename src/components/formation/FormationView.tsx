'use client';

import { useMemo } from 'react';
import type { Formation, FormationSlot, SquadPlayer, TeamColorSelection } from '@/types/squad';
import { getFormationSlots } from '@/lib/formation-layout';
import { buildChemLinkInfo } from '@/lib/chemistry-lines';
import FormationPitch from './FormationPitch';
import PlayerSlot from './PlayerSlot';
import ChemistryLines from './ChemistryLines';
import ZoomableContainer from './ZoomableContainer';

interface FormationViewProps {
  formation: Formation;
  players?: SquadPlayer[];
  onSlotClick?: (slotId: string) => void;
  /** Optional team colors to display on the pitch */
  teamColors?: TeamColorSelection | null;
  /** Whether the formation is in editing mode (enables slot interactions) */
  editing?: boolean;
  /**
   * Compact display mode for mobile/embedded contexts.
   * When true, uses micro-sized player cards (OVR + position + name only)
   * and enables pinch-to-zoom for inspection.
   * @default false
   */
  compact?: boolean;
}

/**
 * Build a lookup from slotPosition id to SquadPlayer for quick access.
 */
function buildPlayerMap(players: SquadPlayer[]): Map<string, SquadPlayer> {
  const map = new Map<string, SquadPlayer>();
  for (const sp of players) {
    map.set(sp.slotPosition, sp);
  }
  return map;
}

export default function FormationView({
  formation,
  players = [],
  onSlotClick,
  teamColors,
  editing = false,
  compact = false,
}: FormationViewProps) {
  const slots: FormationSlot[] = getFormationSlots(formation);
  const playerMap = useMemo(() => buildPlayerMap(players), [players]);
  const { teamLinked, anyLinked } = useMemo(
    () => buildChemLinkInfo(players, slots),
    [players, slots],
  );

  const isInteractive = editing || !!onSlotClick;
  const cardMode = compact ? 'micro' : 'pitch';

  // Compact mode uses tighter max-width constraints
  const pitchClassName = compact
    ? 'w-full max-w-[200px] sm:max-w-[240px]'
    : 'w-full max-w-[calc(100vw-2rem)] sm:max-w-[28rem] md:max-w-[32rem] lg:max-w-[36rem]';

  const editingRing = editing ? 'ring-1 ring-green-400/20 rounded-xl' : '';

  const pitchContent = (
    <FormationPitch className={`${pitchClassName} ${editingRing}`} teamColors={teamColors}>
      {/* Chemistry lines layer — rendered behind player slots */}
      {players.length > 1 && (
        <ChemistryLines slots={slots} players={players} compact={compact} />
      )}

      {/* Player slots layer — each positioned directly within the overlay */}
      {slots.map((slot) => {
        const squadPlayer = playerMap.get(slot.id);
        // Show colored dot for same-team/league links
        const hasChemLink = anyLinked.has(slot.id);
        const hasTeamLink = teamLinked.has(slot.id);

        return (
          <PlayerSlot
            key={slot.id}
            slot={slot}
            player={squadPlayer?.player}
            showChemistryLink={hasChemLink}
            chemistryType={hasTeamLink ? 'team' : hasChemLink ? 'league' : undefined}
            onClick={isInteractive ? () => onSlotClick?.(slot.id) : undefined}
            editing={editing}
            cardMode={cardMode}
          />
        );
      })}
    </FormationPitch>
  );

  return (
    <ZoomableContainer
      enableZoom={compact}
      minScale={1}
      maxScale={2.5}
      className="w-full"
    >
      {pitchContent}
    </ZoomableContainer>
  );
}
