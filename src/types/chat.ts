/**
 * Chat types for the conversational squad-building UI.
 *
 * Each user message produces a user ChatMessage followed by an
 * assistant ChatMessage (which may contain inline squad results).
 */

import type { SquadCandidate } from './squad';
import type { ChatPipelineStage } from '@/hooks/useChatStream';

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

/** A single message in the conversation (user or assistant). */
export interface ChatMessage {
  /** Unique identifier (for React keys). */
  id: string;
  /** Who sent the message. */
  role: 'user' | 'assistant';
  /** Plain-text content of the message. */
  content: string;
  /** ISO timestamp when the message was created. */
  timestamp: number;

  // --- Assistant-specific fields (all optional) ---------------------------

  /** Squad candidates returned by the AI pipeline. */
  squadCandidates?: SquadCandidate[];

  /** Current pipeline stage (for streaming / loading state). */
  stage?: ChatPipelineStage;

  /** Non-critical warnings accumulated during processing. */
  warnings?: string[];

  /** Error information (when stage === 'error'). */
  error?: { code: string; message: string; details?: string };

  /** Parse metadata (method, confidence, detected formation). */
  parseInfo?: { method?: string; confidence?: number; formation?: string };

  /** Total processing time in ms (available after complete). */
  totalTimeMs?: number | null;
}

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------

/** The full conversation state (array of messages + metadata). */
export interface Conversation {
  messages: ChatMessage[];
  /** Auto-generated conversation title (for future use). */
  title?: string;
  /** When the conversation was started. */
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a simple unique ID for chat messages. */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
