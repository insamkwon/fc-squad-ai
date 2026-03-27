'use client';

import { useState, useCallback, useMemo } from 'react';
import type { TeamColorSelection } from '@/types/squad';
import {
  TEAM_COLOR_PRESETS,
  TEAM_COLOR_LEAGUES,
  getTeamColorPresetsByLeague,
} from '@/constants/team-colors';
import type { TeamColorPreset } from '@/constants/team-colors';

interface TeamColorPickerProps {
  /** Currently selected team colors (null = no selection) */
  value: TeamColorSelection | null;
  /** Callback when the user changes color selection */
  onChange: (colors: TeamColorSelection | null) => void;
  /** Optional CSS class for the outer container */
  className?: string;
}

/**
 * Mini jersey SVG preview that displays primary/secondary colors.
 */
function JerseyPreview({
  primary,
  secondary,
  size = 36,
}: {
  primary: string;
  secondary: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0"
    >
      {/* Jersey body */}
      <path
        d="M10 8 L6 14 L6 36 L34 36 L34 14 L30 8 L24 12 L20 6 L16 12 Z"
        fill={primary}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth="0.5"
      />
      {/* Collar / neckline */}
      <path
        d="M16 12 Q20 16 24 12"
        fill="none"
        stroke={secondary}
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Sleeve accents */}
      <rect x="6" y="14" width="5" height="8" rx="1" fill={secondary} opacity="0.8" />
      <rect x="29" y="14" width="5" height="8" rx="1" fill={secondary} opacity="0.8" />
      {/* Center stripe */}
      <rect x="18" y="16" width="4" height="18" rx="1" fill={secondary} opacity="0.5" />
    </svg>
  );
}

/**
 * Color swatch button with check indicator for selected state.
 */
function ColorSwatch({
  primary,
  secondary,
  selected,
  onClick,
  label,
}: {
  primary: string;
  secondary: string;
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`relative flex items-center justify-center rounded-lg p-1.5 transition-all duration-150 ${
        selected
          ? 'bg-white/15 ring-2 ring-yellow-500 scale-105'
          : 'bg-white/5 hover:bg-white/10 hover:scale-105'
      }`}
    >
      <JerseyPreview primary={primary} secondary={secondary} size={28} />
      {selected && (
        <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-yellow-500 rounded-full flex items-center justify-center">
          <svg className="w-2.5 h-2.5 text-gray-900" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
      )}
    </button>
  );
}

/**
 * Native color input styled to match the dark theme.
 */
function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-16 shrink-0">{label}</span>
      <div className="relative">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded-lg cursor-pointer border-2 border-white/20 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
        />
      </div>
      <input
        type="text"
        value={value.toUpperCase()}
        onChange={(e) => {
          const v = e.target.value;
          // Only update if it's a valid hex color
          if (/^#[0-9A-Fa-f]{6}$/.test(v) || v === '') {
            onChange(v);
          }
        }}
        maxLength={7}
        className="flex-1 min-w-0 rounded-md border border-white/10 bg-gray-800 px-2 py-1.5 text-xs text-white font-mono placeholder-gray-600 focus:border-yellow-500/50 focus:outline-none"
        placeholder="#FFFFFF"
      />
    </div>
  );
}

export default function TeamColorPicker({
  value,
  onChange,
  className = '',
}: TeamColorPickerProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLeague, setActiveLeague] = useState<string | null>(null);

  const presetsByLeague = useMemo(() => getTeamColorPresetsByLeague(), []);

  const filteredPresets = useMemo(() => {
    if (!searchQuery.trim()) return TEAM_COLOR_PRESETS;
    const q = searchQuery.toLowerCase().trim();
    return TEAM_COLOR_PRESETS.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.nameKo.includes(q) ||
        p.league.toLowerCase().includes(q),
    );
  }, [searchQuery]);

  const displayedLeagues = useMemo(() => {
    if (searchQuery.trim()) {
      const leagueIds = new Set(filteredPresets.map((p) => p.league));
      return TEAM_COLOR_LEAGUES.filter((l) => leagueIds.has(l.id));
    }
    return activeLeague
      ? TEAM_COLOR_LEAGUES.filter((l) => l.id === activeLeague)
      : TEAM_COLOR_LEAGUES;
  }, [searchQuery, filteredPresets, activeLeague]);

  const handlePresetSelect = useCallback(
    (preset: TeamColorPreset) => {
      const newVal: TeamColorSelection = {
        primary: preset.primary,
        secondary: preset.secondary,
        presetId: preset.id,
        presetName: `${preset.nameKo} ${preset.name}`,
      };
      // If already selected, deselect
      if (value?.presetId === preset.id) {
        onChange(null);
      } else {
        onChange(newVal);
      }
    },
    [value, onChange],
  );

  const handleCustomPrimary = useCallback(
    (hex: string) => {
      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        onChange({
          primary: hex,
          secondary: value?.secondary ?? '#FFFFFF',
        });
      }
    },
    [value, onChange],
  );

  const handleCustomSecondary = useCallback(
    (hex: string) => {
      if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
        onChange({
          primary: value?.primary ?? '#000000',
          secondary: hex,
        });
      }
    },
    [value, onChange],
  );

  const handleClear = useCallback(() => {
    onChange(null);
    setSearchQuery('');
    setActiveLeague(null);
  }, [onChange]);

  const isPresetSelected = useCallback(
    (presetId: string) => value?.presetId === presetId,
    [value],
  );

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header: current selection preview */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-300">팀컬러</label>
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
            초기화
          </button>
        )}
      </div>

      {/* Current selection preview / empty state */}
      {value ? (
        <div className="flex items-center gap-3 rounded-lg bg-gray-800/60 border border-white/8 p-3">
          <JerseyPreview primary={value.primary} secondary={value.secondary} size={42} />
          <div className="flex-1 min-w-0">
            {value.presetName && (
              <p className="text-sm font-medium text-white truncate">{value.presetName}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <div
                className="w-4 h-4 rounded-full border border-white/20"
                style={{ backgroundColor: value.primary }}
                title={`Primary: ${value.primary}`}
              />
              <div
                className="w-4 h-4 rounded-full border border-white/20"
                style={{ backgroundColor: value.secondary }}
                title={`Secondary: ${value.secondary}`}
              />
              <span className="text-[10px] text-gray-500 font-mono">
                {value.primary.toUpperCase()} / {value.secondary.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPresets(!showPresets)}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-600 bg-gray-800/30 p-3 text-sm text-gray-500 hover:border-gray-500 hover:text-gray-400 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008Z" />
          </svg>
          팀컬러 선택
        </button>
      )}

      {/* Expandable presets panel */}
      {showPresets && (
        <div className="rounded-lg bg-gray-800/80 border border-white/8 p-3 space-y-2.5">
          {/* Toggle button */}
          <button
            type="button"
            onClick={() => setShowPresets(false)}
            className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-gray-300 transition-colors"
          >
            <span className="font-medium">프리셋에서 선택</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
            </svg>
          </button>

          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500"
              fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="팀 이름 검색..."
              className="w-full rounded-md border border-white/10 bg-gray-900 py-1.5 pl-7 pr-7 text-xs text-white placeholder-gray-600 focus:border-yellow-500/50 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* League tabs */}
          {!searchQuery.trim() && (
            <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1">
              <button
                type="button"
                onClick={() => setActiveLeague(null)}
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  activeLeague === null
                    ? 'bg-yellow-500 text-gray-900'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                전체
              </button>
              {TEAM_COLOR_LEAGUES.map((league) => (
                <button
                  type="button"
                  key={league.id}
                  onClick={() => setActiveLeague(league.id === activeLeague ? null : league.id)}
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    activeLeague === league.id
                      ? 'bg-yellow-500 text-gray-900'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10'
                  }`}
                >
                  {league.nameKo}
                </button>
              ))}
            </div>
          )}

          {/* Preset grid */}
          <div className="max-h-[200px] overflow-y-auto space-y-2">
            {displayedLeagues.map((league) => {
              const leaguePresets = (presetsByLeague[league.id] || []).filter(
                (p) => !searchQuery.trim() || filteredPresets.includes(p),
              );
              if (leaguePresets.length === 0) return null;

              return (
                <div key={league.id}>
                  <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5 px-0.5">
                    {league.nameKo}
                  </div>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                    {leaguePresets.map((preset) => (
                      <div key={preset.id} className="flex flex-col items-center gap-0.5">
                        <ColorSwatch
                          primary={preset.primary}
                          secondary={preset.secondary}
                          selected={isPresetSelected(preset.id)}
                          onClick={() => handlePresetSelect(preset)}
                          label={`${preset.nameKo} ${preset.name}`}
                        />
                        <span className="text-[8px] text-gray-500 truncate max-w-[52px] text-center leading-tight">
                          {preset.nameKo}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {displayedLeagues.length === 0 && (
              <div className="py-4 text-center text-xs text-gray-500">
                검색 결과가 없습니다
              </div>
            )}
          </div>
        </div>
      )}

      {/* Custom color inputs */}
      {value && (
        <div className="rounded-lg bg-gray-800/40 border border-white/5 p-3 space-y-2">
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
            커스텀 색상
          </div>
          <ColorInput
            label="메인 색상"
            value={value.primary}
            onChange={handleCustomPrimary}
          />
          <ColorInput
            label="보조 색상"
            value={value.secondary}
            onChange={handleCustomSecondary}
          />
        </div>
      )}
    </div>
  );
}
