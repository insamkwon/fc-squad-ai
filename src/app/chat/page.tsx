'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { SquadCandidate, TeamColorSelection } from '@/types/squad';
import ChatWindow from '@/components/chat/ChatWindow';

/**
 * Chat page — the primary conversational interface for AI squad building.
 *
 * Provides a full-screen chat experience with:
 * - Natural language input for squad requests
 * - Streaming pipeline progress (parsing → generating → complete)
 * - Inline squad results with formation visualization
 * - Link to full squad builder for detailed view
 */
export default function ChatPage() {
  const router = useRouter();
  const [teamColors] = useState<TeamColorSelection | null>(null);

  /** Navigate to squad builder with pre-loaded candidates (via URL state) */
  const handleViewInBuilder = useCallback(
    (candidates: SquadCandidate[]) => {
      // Store candidates in sessionStorage for the squad builder to pick up
      try {
        sessionStorage.setItem(
          'chat-squad-candidates',
          JSON.stringify(candidates),
        );
      } catch {
        // sessionStorage might not be available; navigate anyway
      }
      router.push('/squad-builder');
    },
    [router],
  );

  return (
    <div className="mx-auto max-w-3xl px-0">
      <ChatWindow
        teamColors={teamColors}
        onViewInBuilder={handleViewInBuilder}
      />
    </div>
  );
}
