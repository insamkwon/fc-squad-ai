'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { FORMATION_SLOTS, type Formation } from '@/types/squad';
import {
  FORMATIONS_ORDERED,
  getFormationMeta,
} from '@/constants/squad-defaults';
import { getPositionCategory, getPositionCategoryColor } from '@/lib/formation-layout';

interface FormationSelectorProps {
  /** Currently selected formation */
  value: Formation;
  /** Callback when a new formation is selected */
  onChange: (formation: Formation) => void;
  /** Additional CSS classes */
  className?: string;
  /** Compact mode for embedded use (default: false) */
  compact?: boolean;
}

/** Position dot colors by line category */
function getDotColor(position: string): string {
  const category = getPositionCategory(position);
  return getPositionCategoryColor(category);
}

/** Mini pitch SVG showing formation layout */
function MiniPitch({ formation }: { formation: Formation }) {
  const slots = FORMATION_SLOTS[formation];

  return (
    <svg viewBox="0 0 100 120" className="w-full h-full" aria-hidden="true">
      {/* Pitch background */}
      <rect x="0" y="0" width="100" height="120" rx="4" fill="#1a5c2a" />
      {/* Pitch outline */}
      <rect x="2" y="2" width="96" height="116" rx="3" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
      {/* Center line */}
      <line x1="2" y1="60" x2="98" y2="60" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
      {/* Center circle */}
      <circle cx="50" cy="60" r="12" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" />
      {/* Top penalty area */}
      <rect x="25" y="2" width="50" height="22" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
      {/* Bottom penalty area */}
      <rect x="25" y="96" width="50" height="22" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.6" />
      {/* Top goal area */}
      <rect x="37" y="2" width="26" height="10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />
      {/* Bottom goal area */}
      <rect x="37" y="108" width="26" height="10" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" />

      {/* Player dots */}
      {slots.map((slot) => (
        <circle
          key={slot.id}
          cx={slot.x}
          cy={slot.y}
          r="3"
          fill={getDotColor(slot.position)}
          opacity="0.9"
        />
      ))}
    </svg>
  );
}

export default function FormationSelector({
  value,
  onChange,
  className = '',
  compact = false,
}: FormationSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);
  const close = useCallback(() => setIsOpen(false), []);

  const handleSelect = useCallback(
    (f: Formation) => {
      onChange(f);
      close();
    },
    [onChange, close],
  );

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, close]);

  // Close on Escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, close]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        ref={buttonRef}
        onClick={toggle}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`포메이션 선택: ${value}`}
        className="flex w-full items-center gap-3 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white transition-colors hover:border-gray-600 focus:border-yellow-500 focus:outline-none"
      >
        {/* Mini pitch preview of selected formation */}
        <div className="h-8 w-6 flex-shrink-0">
          <MiniPitch formation={value} />
        </div>
        <span className="flex-1 text-left font-medium">{value}</span>
        {getFormationMeta(value)?.isMeta && (
          <span className="rounded bg-yellow-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-yellow-400">
            META
          </span>
        )}
        <svg
          className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown grid of formations */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="포메이션 목록"
          className="absolute z-50 mt-2 w-full max-w-[320px] rounded-xl border border-gray-700 bg-gray-900 p-3 shadow-lg shadow-black/30 sm:left-0 sm:w-auto sm:min-w-[360px]"
        >
          <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-gray-500">
            포메이션 선택
          </p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {FORMATIONS_ORDERED.map((f) => {
              const isSelected = f === value;
              const meta = getFormationMeta(f);
              const isMeta = meta?.isMeta ?? false;
              return (
                <button
                  key={f}
                  role="option"
                  aria-selected={isSelected}
                  title={meta?.descriptionKo}
                  onClick={() => handleSelect(f)}
                  className={`group flex flex-col items-center gap-1.5 rounded-lg p-2 transition-all ${
                    isSelected
                      ? 'bg-yellow-500/15 ring-1 ring-yellow-500'
                      : 'bg-gray-800 hover:bg-gray-750 hover:ring-1 hover:ring-gray-600'
                  }`}
                >
                  {/* Mini pitch */}
                  <div className="h-12 w-10 sm:h-14 sm:w-12">
                    <MiniPitch formation={f} />
                  </div>
                  {/* Formation label */}
                  <span
                    className={`text-xs font-semibold ${
                      isSelected ? 'text-yellow-400' : 'text-gray-300 group-hover:text-white'
                    }`}
                  >
                    {f}
                  </span>
                  {/* Meta badge */}
                  {isMeta && !isSelected && (
                    <span className="text-[8px] font-bold uppercase tracking-wider text-yellow-500/70">
                      META
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
