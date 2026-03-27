'use client';

import { useState, useRef, useCallback } from 'react';

interface ChatInputProps {
  /** Called when the user submits a message. */
  onSubmit: (message: string) => void;
  /** Whether the AI is currently processing a request. */
  isLoading: boolean;
  /** Optional placeholder text. */
  placeholder?: string;
  /** Optional max character length. */
  maxLength?: number;
  /** Additional CSS class names. */
  className?: string;
}

/**
 * Chat message input with auto-growing textarea, send button,
 * character count, and keyboard shortcut (Enter to send, Shift+Enter for newline).
 */
export default function ChatInput({
  onSubmit,
  isLoading,
  placeholder = '예: 500억으로 맨시티 팀컬러 442 스쿼드 짜줘',
  maxLength = 500,
  className = '',
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSubmit = value.trim().length > 0 && !isLoading;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit(value.trim());
    setValue('');
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [canSubmit, onSubmit, value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter without Shift → submit
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      if (newValue.length <= maxLength) {
        setValue(newValue);
      }
    },
    [maxLength],
  );

  // Auto-grow textarea
  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  return (
    <div
      className={`
        flex items-end gap-2 rounded-xl border border-gray-700 bg-gray-900 p-2
        transition-colors focus-within:border-yellow-500/50
        ${className}
      `}
    >
      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder={placeholder}
        disabled={isLoading}
        rows={1}
        maxLength={maxLength}
        enterKeyHint="send"
        className={`
          flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-white
          placeholder-gray-500 focus:outline-none disabled:opacity-50
          max-h-[120px] leading-relaxed min-h-[2.25rem]
        `}
      />

      {/* Character count (shows when approaching limit) */}
      {value.length > maxLength * 0.8 && (
        <span
          className={`
            self-center text-[10px] tabular-nums mr-1
            ${value.length >= maxLength ? 'text-red-400' : 'text-gray-500'}
          `}
        >
          {value.length}/{maxLength}
        </span>
      )}

      {/* Send button */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit}
        aria-label="메시지 전송"
        className={`
          flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-lg
          transition-all duration-200
          ${canSubmit
            ? 'bg-yellow-500 text-gray-900 hover:bg-yellow-400 active:scale-95 shadow-md shadow-yellow-500/20'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        {isLoading ? (
          /* Spinning loader */
          <svg
            className="w-4 h-4 animate-spin"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="3"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          /* Send arrow icon */
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M5 12h14" />
            <path d="M13 6l6 6-6 6" />
          </svg>
        )}
      </button>
    </div>
  );
}
