"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Player } from "@/types/player";
import { formatPrice } from "@/lib/stat-utils";
import SeasonBadge from "@/components/player/SeasonBadge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlayerSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Called when user selects a suggestion — navigates or triggers action */
  onSuggestionSelect?: (player: Player) => void;
  /** Extra CSS classes for the outer wrapper */
  className?: string;
  /** Whether the search bar should be compact (e.g., in header) */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPositionColor(pos: string): string {
  if (pos === "ST" || pos === "CF" || pos === "LF" || pos === "RF")
    return "bg-red-600";
  if (pos === "LW" || pos === "RW") return "bg-orange-500";
  if (
    pos === "CAM" ||
    pos === "CM" ||
    pos === "CDM" ||
    pos === "LM" ||
    pos === "RM"
  )
    return "bg-green-600";
  if (
    pos === "CB" ||
    pos === "LB" ||
    pos === "RB" ||
    pos === "LWB" ||
    pos === "RWB"
  )
    return "bg-blue-600";
  if (pos === "GK") return "bg-yellow-600";
  return "bg-gray-600";
}

function getOvrBadgeColor(ovr: number): string {
  if (ovr >= 90) return "bg-yellow-500 text-gray-900";
  if (ovr >= 85) return "bg-yellow-600 text-gray-900";
  if (ovr >= 80) return "bg-green-600 text-white";
  if (ovr >= 75) return "bg-blue-600 text-white";
  return "bg-gray-600 text-white";
}

/**
 * Highlight matching text in a string by wrapping the matched portion
 * in a <span> with highlight styling.
 */
function HighlightMatch({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!query.trim()) return <>{text}</>;

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase().trim();
  const idx = lowerText.indexOf(lowerQuery);

  if (idx === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, idx)}
      <span className="text-yellow-400 font-semibold">
        {text.slice(idx, idx + query.trim().length)}
      </span>
      {text.slice(idx + query.trim().length)}
    </>
  );
}

// ---------------------------------------------------------------------------
// Suggestion Item Component
// ---------------------------------------------------------------------------

function SuggestionItem({
  player,
  query,
  onSelect,
  isActive,
  onActive,
}: {
  player: Player;
  query: string;
  onSelect: (player: Player) => void;
  isActive: boolean;
  onActive: () => void;
}) {
  const s = player.stats;

  return (
    <button
      type="button"
      onClick={() => onSelect(player)}
      onMouseEnter={onActive}
      className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors sm:gap-3 ${
        isActive
          ? "bg-yellow-500/10"
          : "hover:bg-gray-700/50 active:bg-gray-700/80"
      }`}
    >
      {/* OVR badge */}
      <span
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-extrabold sm:h-9 sm:w-9 sm:text-xs ${getOvrBadgeColor(s.ovr)}`}
      >
        {s.ovr}
      </span>

      {/* Player info — bilingual display */}
      <div className="min-w-0 flex-1">
        {/* Name row: Korean name (primary) + English name (secondary) */}
        <div className="flex items-baseline gap-2">
          <span className="truncate text-sm font-semibold text-white">
            <HighlightMatch text={player.name} query={query} />
          </span>
          <span className="truncate text-xs text-gray-400">
            <HighlightMatch text={player.nameEn} query={query} />
          </span>
        </div>

        {/* Meta row: Position · Team (KR) / Team (EN) · Season · Price */}
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {/* Position badge */}
          <span
            className={`inline-flex items-center rounded px-1 py-px text-[9px] font-bold text-white ${getPositionColor(player.position)}`}
          >
            {player.position}
          </span>

          {/* Team name — hide English team name on mobile */}
          <span className="truncate text-[11px] text-gray-400">
            {player.teamName}
            <span className="hidden sm:inline">
              {player.teamName !== player.teamNameEn && (
                <span className="text-gray-600"> / {player.teamNameEn}</span>
              )}
            </span>
          </span>

          {/* Price */}
          <span className="text-[11px] font-medium text-yellow-400/80">
            {formatPrice(player.price)}
          </span>
        </div>
      </div>

      {/* Season badge — hidden on mobile to save space */}
      <div className="flex-shrink-0 hidden sm:block">
        <SeasonBadge
          cardType={player.cardType}
          seasonName={player.seasonName}
          compact
        />
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Loading Spinner
// ---------------------------------------------------------------------------

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-6">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-600 border-t-yellow-400" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main PlayerSearchBar Component
// ---------------------------------------------------------------------------

export default function PlayerSearchBar({
  value,
  onChange,
  placeholder = "선수 이름 검색 (한국어 / English)",
  onSuggestionSelect,
  className = "",
  compact = false,
}: PlayerSearchBarProps) {
  const [localValue, setLocalValue] = useState(value);
  const [suggestions, setSuggestions] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // ------ Click outside to close dropdown ------
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ------ Keyboard: Escape to close ------
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        setActiveIndex(-1);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // ------ Fetch autocomplete suggestions ------
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);

    const trimmed = localValue.trim();

    if (!trimmed) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    timerRef.current = setTimeout(async () => {
      setLoading(true);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const params = new URLSearchParams({
          q: trimmed,
          limit: "8",
        });
        const res = await fetch(`/api/players/suggest?${params}`, {
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data: Player[] = await res.json();
        // Sort by OVR descending
        data.sort((a, b) => b.stats.ovr - a.stats.ovr);
        setSuggestions(data);
        setActiveIndex(-1);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("Failed to fetch suggestions:", err);
        }
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [localValue]);

  // ------ Cleanup on unmount ------
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ------ Debounced onChange (for full search) ------
  const debouncedOnChange = useCallback(
    (val: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onChange(val);
      }, 300);
    },
    [onChange],
  );

  // ------ Input change handler ------
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const next = e.target.value;
      setLocalValue(next);
      setIsOpen(true);
      debouncedOnChange(next);
    },
    [debouncedOnChange],
  );

  // ------ Focus handler ------
  const handleFocus = useCallback(() => {
    if (localValue.trim() && suggestions.length > 0) {
      setIsOpen(true);
    }
  }, [localValue, suggestions]);

  // ------ Clear handler ------
  const handleClear = useCallback(() => {
    setLocalValue("");
    setSuggestions([]);
    setIsOpen(false);
    setActiveIndex(-1);
    onChange("");
    inputRef.current?.focus();
  }, [onChange]);

  // ------ Suggestion select handler ------
  const handleSuggestionSelect = useCallback(
    (player: Player) => {
      // Set the search to the player's English name for clear display
      setLocalValue(player.nameEn);
      onChange(player.nameEn);
      setIsOpen(false);
      setActiveIndex(-1);
      onSuggestionSelect?.(player);
    },
    [onChange, onSuggestionSelect],
  );

  // ------ Keyboard navigation ------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : 0,
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : suggestions.length - 1,
          );
          break;
        case "Enter":
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < suggestions.length) {
            handleSuggestionSelect(suggestions[activeIndex]);
          }
          break;
      }
    },
    [isOpen, suggestions, activeIndex, handleSuggestionSelect],
  );

  // ------ Scroll active item into view ------
  const activeItemRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      node.scrollIntoView({ block: "nearest" });
    }
  }, []);

  // Deduplicate suggestions by pid (avoid showing multiple season variants)
  const deduplicatedSuggestions = useMemo(() => {
    const seen = new Set<number>();
    return suggestions.filter((p) => {
      if (seen.has(p.pid)) return false;
      seen.add(p.pid);
      return true;
    });
  }, [suggestions]);

  // Should we show the dropdown?
  const showDropdown =
    isOpen && localValue.trim().length > 0 && (loading || deduplicatedSuggestions.length > 0);

  return (
    <div className={`relative w-full ${className}`} ref={containerRef}>
      {/* Search icon */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3.5">
        <svg
          className={`text-gray-500 ${compact ? "h-4 w-4" : "h-5 w-5"}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </div>

      <input
        ref={inputRef}
        type="text"
        value={localValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
        aria-autocomplete="list"
        aria-controls="search-suggestions"
        className={`w-full rounded-xl border bg-gray-800 text-white placeholder-gray-500 outline-none transition-colors focus:border-yellow-500/60 focus:ring-1 focus:ring-yellow-500/30 ${
          compact ? "py-2.5 pl-10 pr-10 text-sm" : "py-3 pl-11 pr-10 text-base sm:py-3 sm:text-sm"
        } ${
          isOpen && showDropdown
            ? "border-yellow-500/60 ring-1 ring-yellow-500/30"
            : "border-gray-700 hover:border-gray-600"
        }`}
      />

      {/* Action button: loading spinner or clear */}
      {localValue.length > 0 ? (
        <button
          type="button"
          onClick={handleClear}
          className="absolute inset-y-0 right-0 z-10 flex items-center pr-3.5 text-gray-500 transition-colors hover:text-gray-300"
          aria-label="검색어 지우기"
        >
          {loading ? (
            <svg
              className="h-4 w-4 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          ) : (
            <svg
              className={`h-5 w-5 ${compact ? "h-4 w-4" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}
        </button>
      ) : null}

      {/* Autocomplete suggestions dropdown */}
      {showDropdown && (
        <div
          id="search-suggestions"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-xl shadow-black/50"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
              검색 결과
            </span>
            <span className="text-[10px] text-gray-600">
              {loading
                ? "검색 중..."
                : `${deduplicatedSuggestions.length}명의 선수`}
            </span>
          </div>

          {/* Suggestions list */}
          <div className="max-h-80 overflow-y-auto overscroll-contain">
            {loading && deduplicatedSuggestions.length === 0 && (
              <LoadingSpinner />
            )}

            {!loading && deduplicatedSuggestions.length === 0 && (
              <div className="px-4 py-8 text-center">
                <svg
                  className="mx-auto mb-2 h-8 w-8 text-gray-700"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z"
                  />
                </svg>
                <p className="text-sm text-gray-500">
                  &quot;{localValue.trim()}&quot;에 대한 검색 결과가 없습니다
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  한국어 또는 영어로 선수 이름을 입력해 보세요
                </p>
              </div>
            )}

            {deduplicatedSuggestions.map((player, index) => (
              <div key={player.spid} ref={index === activeIndex ? activeItemRef : undefined}>
                <SuggestionItem
                  player={player}
                  query={localValue.trim()}
                  onSelect={handleSuggestionSelect}
                  isActive={index === activeIndex}
                  onActive={() => setActiveIndex(index)}
                />
              </div>
            ))}
          </div>

          {/* Footer: keyboard hint — hidden on mobile */}
          {deduplicatedSuggestions.length > 0 && (
            <div className="hidden items-center justify-center gap-3 border-t border-gray-800 px-3 py-2 sm:flex">
              <span className="flex items-center gap-1 text-[10px] text-gray-600">
                <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 font-mono text-[9px]">
                  ↑
                </kbd>
                <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 font-mono text-[9px]">
                  ↓
                </kbd>
                탐색
              </span>
              <span className="flex items-center gap-1 text-[10px] text-gray-600">
                <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 font-mono text-[9px]">
                  Enter
                </kbd>
                선택
              </span>
              <span className="flex items-center gap-1 text-[10px] text-gray-600">
                <kbd className="rounded border border-gray-700 bg-gray-800 px-1 py-0.5 font-mono text-[9px]">
                  Esc
                </kbd>
                닫기
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
