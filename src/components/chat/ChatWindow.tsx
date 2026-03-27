'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '@/types/chat';
import { generateMessageId } from '@/types/chat';
import type { SquadCandidate, TeamColorSelection } from '@/types/squad';
import type { ChatStreamEvent, ChatPipelineStage } from '@/hooks/useChatStream';
import ChatMessageBubble from './ChatMessageBubble';
import ChatInput from './ChatInput';

interface ChatWindowProps {
  /** Optional team colors to pass through to squad results. */
  teamColors?: TeamColorSelection | null;
  /** Optional override formation for squad generation. */
  formation?: string;
  /** Optional pinned player SPIDs. */
  pinnedPlayers?: number[];
  /** Called when user wants to view a squad in the full builder. */
  onViewInBuilder?: (candidates: SquadCandidate[]) => void;
  /** Additional CSS class names for the outer wrapper. */
  className?: string;
}

/** Quick suggestion prompts to show when conversation is empty. */
const QUICK_SUGGESTIONS = [
  '500억으로 맨시티 스쿼드 짜줘',
  '100억으로 433 공격적인 스쿼드',
  '프리미어리그 선수들로 442 스쿼드',
  '메시, 호날두 고정해서 스쿼드 만들어줘',
];

/**
 * Full chat window component with conversation history, streaming integration,
 * auto-scroll, and welcome screen with quick suggestions.
 *
 * Internally manages the SSE stream to `/api/chat` and updates the conversation
 * history in real-time as squad candidates stream in.
 */
export default function ChatWindow({
  teamColors,
  formation,
  pinnedPlayers,
  onViewInBuilder,
  className = '',
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Store streaming assistant message ref for real-time updates
  const assistantMsgRef = useRef<ChatMessage | null>(null);
  const candidatesRef = useRef<SquadCandidate[]>([]);
  const warningsRef = useRef<string[]>([]);

  // --- Auto-scroll to bottom when messages change --------------------------
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({
      top: container.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  // --- Send a user message and start streaming -----------------------------
  const sendMessage = useCallback(
    (content: string) => {
      if (isLoading || !content.trim()) return;

      // 1. Add user message
      const userMsg: ChatMessage = {
        id: generateMessageId(),
        role: 'user',
        content: content.trim(),
        timestamp: Date.now(),
      };

      // 2. Create placeholder assistant message
      const assistantMsgId = generateMessageId();
      const assistantMsg: ChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
        stage: 'idle',
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      // 3. Reset streaming refs
      assistantMsgRef.current = assistantMsg;
      candidatesRef.current = [];
      warningsRef.current = [];
      setIsLoading(true);

      // 4. Abort any existing stream
      abortRef.current?.abort();
      const abortController = new AbortController();
      abortRef.current = abortController;

      // 5. Build request body
      const body: Record<string, unknown> = { message: content.trim() };
      if (formation) body.formation = formation;
      if (pinnedPlayers && pinnedPlayers.length > 0) body.pinnedPlayers = pinnedPlayers;

      // 6. Start SSE streaming
      (async () => {
        try {
          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: abortController.signal,
          });

          if (!response.ok) {
            let errorMessage = '요청 처리 중 오류가 발생했습니다.';
            try {
              const errorData = await response.json();
              errorMessage = errorData.error?.message ?? errorMessage;
            } catch {
              // ignore
            }
            updateAssistantMessage(assistantMsgId, {
              stage: 'error',
              error: { code: `HTTP_${response.status}`, message: errorMessage },
            });
            setIsLoading(false);
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            updateAssistantMessage(assistantMsgId, {
              stage: 'error',
              error: { code: 'NO_STREAM', message: '응답 스트림을 읽을 수 없습니다.' },
            });
            setIsLoading(false);
            return;
          }

          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              let event: ChatStreamEvent;
              try {
                event = JSON.parse(jsonStr);
              } catch {
                continue;
              }

              handleStreamEvent(assistantMsgId, event);
            }
          }

          // Ensure complete if stream ended without explicit complete event
          if (candidatesRef.current.length > 0) {
            const msg = assistantMsgRef.current;
            if (msg && msg.stage !== 'error' && msg.stage !== 'complete') {
              updateAssistantMessage(assistantMsgId, {
                stage: 'complete',
                totalTimeMs: 0,
              });
            }
          }
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          updateAssistantMessage(assistantMsgId, {
            stage: 'error',
            error: {
              code: 'FETCH_ERROR',
              message: '네트워크 오류가 발생했습니다.',
              details: err instanceof Error ? err.message : undefined,
            },
          });
        } finally {
          setIsLoading(false);
          abortRef.current = null;
        }
      })();
    },
    [isLoading, formation, pinnedPlayers],
  );

  // --- Update the assistant message in-place in the messages array ----------
  const updateAssistantMessage = useCallback(
    (msgId: string, updates: Partial<ChatMessage>) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, ...updates } : m)),
      );
      // Also update the ref
      if (assistantMsgRef.current?.id === msgId) {
        assistantMsgRef.current = { ...assistantMsgRef.current, ...updates };
      }
    },
    [],
  );

  // --- Handle a single SSE stream event ------------------------------------
  const handleStreamEvent = useCallback(
    (msgId: string, event: ChatStreamEvent) => {
      switch (event.type) {
        case 'parsing':
          updateAssistantMessage(msgId, { stage: 'parsing' });
          break;

        case 'parsed':
          updateAssistantMessage(msgId, {
            stage: 'parsed',
            parseInfo: {
              method: event.method,
              confidence: event.confidence,
              formation: event.formation,
            },
          });
          if (event.warnings) {
            const newWarnings = [...warningsRef.current, ...event.warnings];
            warningsRef.current = newWarnings;
            updateAssistantMessage(msgId, { warnings: [...newWarnings] });
          }
          break;

        case 'generating':
          updateAssistantMessage(msgId, { stage: 'generating' });
          break;

        case 'candidate':
          if (event.candidate) {
            const newCandidates = [...candidatesRef.current, event.candidate];
            candidatesRef.current = newCandidates;
            updateAssistantMessage(msgId, {
              squadCandidates: [...newCandidates],
              stage: 'generating', // Still generating until complete
            });
          }
          break;

        case 'complete':
          updateAssistantMessage(msgId, {
            stage: 'complete',
            totalTimeMs: event.totalTimeMs ?? null,
            squadCandidates: [...candidatesRef.current],
            warnings: warningsRef.current.length > 0
              ? [...warningsRef.current]
              : undefined,
          });
          break;

        case 'warning':
          if (event.message) {
            const newWarnings = [...warningsRef.current, event.message];
            warningsRef.current = newWarnings;
            updateAssistantMessage(msgId, { warnings: [...newWarnings] });
          }
          break;

        case 'error':
          updateAssistantMessage(msgId, {
            stage: 'error',
            error: {
              code: event.code ?? 'UNKNOWN',
              message: event.message ?? '알 수 없는 오류',
              details: event.details,
            },
          });
          break;
      }
    },
    [updateAssistantMessage],
  );

  // --- Handle "view in builder" from a specific message --------------------
  const handleViewInBuilder = useCallback(
    (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (msg?.squadCandidates && onViewInBuilder) {
        onViewInBuilder(msg.squadCandidates);
      }
    },
    [messages, onViewInBuilder],
  );

  // --- Handle suggestion click ---------------------------------------------
  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      sendMessage(suggestion);
    },
    [sendMessage],
  );

  // --- Cleanup on unmount --------------------------------------------------
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // --- Determine if the welcome screen should be shown ---------------------
  const hasMessages = messages.length > 0;

  return (
    <div
      className={`flex flex-col ${className}`}
      style={{ height: 'calc(100dvh - 3.5rem - env(safe-area-inset-bottom, 0px))' }}
    >
      {/* --- Messages area (scrollable) ------------------------------------ */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4 scroll-smooth-mobile"
      >
        {!hasMessages ? (
          /* Welcome screen */
          <WelcomeScreen onSuggestionClick={handleSuggestionClick} />
        ) : (
          /* Conversation history */
          <div className="space-y-3 sm:space-y-4">
            {messages.map((msg) => (
              <ChatMessageBubble
                key={msg.id}
                message={msg}
                teamColors={teamColors}
                onViewInBuilder={handleViewInBuilder}
              />
            ))}
          </div>
        )}
      </div>

      {/* --- Input area (fixed at bottom) ---------------------------------- */}
      <div className="border-t border-gray-800 bg-gray-950/80 backdrop-blur-sm px-3 sm:px-4 py-2.5 sm:py-3 safe-bottom">
        <ChatInput
          onSubmit={sendMessage}
          isLoading={isLoading}
          placeholder="예: 500억으로 맨시티 팀컬러 442 스쿼드 짜줘"
        />
        <p className="text-center text-[10px] text-gray-600 mt-1 hidden sm:block">
          Enter로 전송 · Shift+Enter로 줄바꿈
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Welcome Screen (shown when conversation is empty)
// ---------------------------------------------------------------------------

function WelcomeScreen({
  onSuggestionClick,
}: {
  onSuggestionClick: (suggestion: string) => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full py-8">
      <div className="text-center max-w-md mx-auto">
        {/* Logo / Title */}
        <div className="mb-6">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center mb-4">
            <svg
              className="w-7 h-7 text-yellow-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-1">AI 스쿼드 빌더</h2>
          <p className="text-sm text-gray-400">
            자연어로 스쿼드 조건을 입력하면 AI가 추천해드립니다
          </p>
        </div>

        {/* Quick suggestions */}
        <div className="space-y-2">
          <p className="text-xs text-gray-500 font-medium">빠른 시작</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {QUICK_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestionClick(suggestion)}
                className="
                  text-left rounded-lg border border-gray-700/50 bg-gray-800/40
                  px-3 py-2.5 text-xs text-gray-300 leading-relaxed
                  hover:border-yellow-500/30 hover:bg-gray-800/80 hover:text-white
                  transition-all duration-200
                "
              >
                <span className="text-yellow-500 mr-1.5">✦</span>
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
