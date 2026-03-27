'use client';

import { useState, useCallback, useMemo } from 'react';
import type { Formation, SquadCandidate, TeamColorSelection } from '@/types/squad';
import type { Player } from '@/types/player';
import type { BudgetRange } from '@/types/filters';
import FormationSelector from '@/components/squad/FormationSelector';
import BudgetRangeInput from '@/components/squad/BudgetRangeInput';
import TeamColorPicker from '@/components/squad/TeamColorPicker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SquadFilterFormProps {
  /** Currently selected formation (controlled — shared with chat tab) */
  formation: Formation;
  /** Called when the user changes the formation */
  onFormationChange: (formation: Formation) => void;

  /** Pinned players to include in the squad (max 3). Managed by parent. */
  pinnedPlayers?: Player[];

  /**
   * Called when squad candidates have been successfully generated.
   * The parent is responsible for displaying the results.
   */
  onResults: (candidates: SquadCandidate[]) => void;

  /**
   * Called when team color selection changes.
   * The parent can use this to sync team color for the formation view.
   */
  onTeamColorChange?: (colors: TeamColorSelection | null) => void;

  /**
   * Called when an error occurs during generation.
   * If not provided, errors are logged to console.
   */
  onError?: (error: string) => void;

  /** Optional additional CSS class on the wrapper */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build pinned player spid array for the API request. */
function buildPinnedSpids(pinnedPlayers?: Player[]): number[] | undefined {
  if (!pinnedPlayers || pinnedPlayers.length === 0) return undefined;
  return pinnedPlayers.map((p) => p.spid);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SquadFilterForm({
  formation,
  onFormationChange,
  pinnedPlayers,
  onResults,
  onTeamColorChange,
  onError,
  className = '',
}: SquadFilterFormProps) {
  // Internal state for budget and team color (not shared with chat tab)
  const [budgetRange, setBudgetRange] = useState<BudgetRange>({});
  const [teamColorSelection, setTeamColorSelectionInternal] = useState<TeamColorSelection | null>(null);

  /** Wrapper that syncs team color back to parent via callback. */
  const setTeamColorSelection = useCallback(
    (colors: TeamColorSelection | null) => {
      setTeamColorSelectionInternal(colors);
      onTeamColorChange?.(colors);
    },
    [onTeamColorChange],
  );

  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Derive active filter count (how many non-default filters are set)
  const activeFilterCount = useMemo(() => {
    let count = 0;
    // Budget: active if min > 0 or max < 2000
    if (budgetRange.min != null && budgetRange.min > 0) count++;
    if (budgetRange.max != null && budgetRange.max < 2000) count++;
    // Team color: active if a selection is made
    if (teamColorSelection) count++;
    return count;
  }, [budgetRange, teamColorSelection]);

  // Whether any filter is non-default
  const hasActiveFilters = activeFilterCount > 0;

  // -------------------------------------------------------------------------
  // Submit handler — calls the recommendation API
  // -------------------------------------------------------------------------

  const handleSubmit = useCallback(async () => {
    if (loading) return;

    setLoading(true);
    setSubmitError(null);

    try {
      const pinnedSpids = buildPinnedSpids(pinnedPlayers);

      const requestBody: Record<string, unknown> = {
        formation,
        pinnedPlayers: pinnedSpids,
      };

      // Only include budget fields when they are set
      if (budgetRange.min != null) {
        requestBody.budgetMin = budgetRange.min;
      }
      if (budgetRange.max != null) {
        requestBody.budgetMax = budgetRange.max;
      }

      // Team color: use preset name for server-side team matching
      if (teamColorSelection?.presetName) {
        requestBody.teamColor = teamColorSelection.presetName;
      }

      const res = await fetch('/api/squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const message =
          (errorData as { error?: string }).error ||
          `요청 실패 (${res.status})`;
        throw new Error(message);
      }

      const data = await res.json();
      const candidates: SquadCandidate[] = data.candidates || [];

      if (candidates.length === 0) {
        const msg = '조건에 맞는 스쿼드를 생성하지 못했습니다. 조건을 변경해보세요.';
        setSubmitError(msg);
        onError?.(msg);
        return;
      }

      onResults(candidates);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : '스쿼드 생성 중 오류가 발생했습니다.';
      setSubmitError(message);
      onError?.(message);
      console.error('SquadFilterForm: submit failed', err);
    } finally {
      setLoading(false);
    }
  }, [formation, budgetRange, teamColorSelection, pinnedPlayers, loading, onResults, onError]);

  // -------------------------------------------------------------------------
  // Reset handler
  // -------------------------------------------------------------------------

  const handleReset = useCallback(() => {
    setBudgetRange({});
    setTeamColorSelection(null);
    setSubmitError(null);
  }, [setTeamColorSelection]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className={`space-y-3 sm:space-y-4 rounded-lg bg-gray-900 p-3 sm:p-4 ${className}`}>
      {/* Formation Selector */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">
          포메이션
        </label>
        <FormationSelector
          value={formation}
          onChange={onFormationChange}
        />
      </div>

      {/* Budget Range */}
      <BudgetRangeInput
        value={budgetRange}
        onChange={setBudgetRange}
      />

      {/* Team Color Picker */}
      <TeamColorPicker
        value={teamColorSelection}
        onChange={setTeamColorSelection}
      />

      {/* Error message */}
      {submitError && (
        <div className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2.5">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0 text-rose-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-rose-300">{submitError}</p>
            <p className="mt-0.5 text-xs text-rose-400/70">
              예산이나 포메이션을 변경한 후 다시 시도해보세요.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            className="shrink-0 text-rose-400/60 hover:text-rose-300 transition-colors"
            aria-label="에러 메시지 닫기"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex gap-2">
        {/* Reset button (visible when filters are active) */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm font-medium text-gray-300 transition-colors hover:border-gray-600 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            초기화
          </button>
        )}

        {/* Submit button */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 rounded-lg bg-yellow-500 py-3 font-medium text-gray-900 transition-all hover:bg-yellow-400 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed tap-target"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              {/* Spinner */}
              <svg
                className="h-4 w-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              생성 중...
            </span>
          ) : (
            '스쿼드 추천'
          )}
        </button>
      </div>

      {/* Active filter count badge */}
      {hasActiveFilters && !loading && (
        <p className="text-center text-xs text-gray-500">
          {activeFilterCount}개 조건 활성화
        </p>
      )}
    </div>
  );
}
