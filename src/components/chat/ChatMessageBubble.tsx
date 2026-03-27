'use client';

import type { ChatMessage } from '@/types/chat';
import type { TeamColorSelection } from '@/types/squad';
import ChatLoadingIndicator from './ChatLoadingIndicator';
import ChatSquadResult from './ChatSquadResult';

interface ChatMessageBubbleProps {
  message: ChatMessage;
  /** Optional team colors to pass through to squad results. */
  teamColors?: TeamColorSelection | null;
  /** Callback when user wants to view a squad in the full builder. */
  onViewInBuilder?: (messageId: string) => void;
}

/**
 * A single message bubble in the chat conversation.
 *
 * - **User messages**: right-aligned yellow bubble with plain text.
 * - **Assistant messages**: left-aligned dark bubble that may contain
 *   loading indicators, warnings, inline squad results, or error states.
 */
export default function ChatMessageBubble({
  message,
  teamColors,
  onViewInBuilder,
}: ChatMessageBubbleProps) {
  const isUser = message.role === 'user';

  // --- User message --------------------------------------------------------
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="
            max-w-[85%] sm:max-w-[70%] rounded-2xl rounded-br-sm sm:rounded-br-md
            bg-yellow-500 text-gray-900 px-3.5 py-2 sm:px-4 sm:py-2.5
            text-sm leading-relaxed
            shadow-sm shadow-yellow-500/10
          "
        >
          {message.content}
        </div>
      </div>
    );
  }

  // --- Assistant message ---------------------------------------------------
  const isLoading =
    message.stage === 'parsing' ||
    message.stage === 'parsed' ||
    message.stage === 'generating';

  const isError = message.stage === 'error';
  const isComplete = message.stage === 'complete';

  return (
    <div className="flex justify-start">
      <div className="max-w-[95%] sm:max-w-[85%] space-y-2 w-full min-w-0">
        {/* AI avatar + label */}
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-800 border border-gray-700">
            <svg
              className="w-3.5 h-3.5 text-yellow-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
              />
            </svg>
          </div>
          <span className="text-xs font-medium text-gray-400">FC Squad AI</span>

          {/* Processing time badge (after complete) */}
          {isComplete && message.totalTimeMs != null && (
            <span className="text-[10px] text-gray-500 tabular-nums ml-auto">
              {(message.totalTimeMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>

        {/* Message bubble */}
        <div className="rounded-2xl rounded-bl-md bg-gray-800 border border-gray-700/50 px-4 py-3 space-y-3">
          {/* Text content (greeting / status messages) */}
          {message.content && (
            <p className="text-sm text-gray-200 leading-relaxed">
              {message.content}
            </p>
          )}

          {/* Loading indicator (streaming) */}
          {isLoading && (
            <ChatLoadingIndicator
              stage={message.stage!}
              warnings={message.warnings}
            />
          )}

          {/* Completed squad results */}
          {isComplete && message.squadCandidates && message.squadCandidates.length > 0 && (
            <ChatSquadResult
              candidates={message.squadCandidates}
              teamColors={teamColors}
              onViewInBuilder={
                onViewInBuilder
                  ? () => onViewInBuilder(message.id)
                  : undefined
              }
            />
          )}

          {/* Completed warnings (shown after squad results) */}
          {isComplete &&
            message.warnings &&
            message.warnings.length > 0 &&
            !message.squadCandidates?.length && (
            <div className="space-y-1">
              {message.warnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 rounded-md bg-amber-950/20 border border-amber-500/20 px-2.5 py-1.5"
                >
                  <svg
                    className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                  <span className="text-[11px] text-amber-300 leading-relaxed">
                    {w}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Error state */}
          {isError && message.error && (
            <div className="flex items-start gap-2 rounded-lg bg-red-950/20 border border-red-500/20 px-3 py-2.5">
              <svg
                className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div>
                <p className="text-xs font-medium text-red-300">
                  {message.error.message}
                </p>
                {message.error.details && (
                  <p className="text-[10px] text-red-400/70 mt-0.5">
                    {message.error.details}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* No results message (complete but no candidates) */}
          {isComplete &&
            (!message.squadCandidates || message.squadCandidates.length === 0) &&
            !message.error && (
            <p className="text-xs text-gray-400">
              스쿼드를 생성하지 못했습니다. 다른 조건으로 다시 시도해주세요.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
