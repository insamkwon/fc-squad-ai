'use client';

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { type Formation, type SquadCandidate, type TeamColorSelection } from '@/types/squad';
import type { Player } from '@/types/player';
import type { VagueInputAnalysis } from '@/lib/ai/types';
import { DEFAULT_FORMATION } from '@/constants/squad-defaults';
import FormationSelector from '@/components/squad/FormationSelector';
import SquadCandidatesView from '@/components/squad/SquadCandidatesView';
import SquadFilterForm from '@/components/squad/SquadFilterForm';
import PlayerMultiSelect from '@/components/player/PlayerMultiSelect';
import PlayerPickerSheet from '@/components/squad/PlayerPickerSheet';
import { useSquadBuilder } from '@/hooks/useSquadBuilder';

type Tab = 'chat' | 'filter';

export default function SquadBuilderPage() {
  const [tab, setTab] = useState<Tab>('chat');
  const [chatInput, setChatInput] = useState('');
  const [formation, setFormation] = useState<Formation>(DEFAULT_FORMATION);
  const [teamColorSelection, setTeamColorSelection] = useState<TeamColorSelection | null>(null);
  const [candidates, setCandidates] = useState<SquadCandidate[]>([]);
  const [activeCandidate, setActiveCandidate] = useState(0);
  const [loading, setLoading] = useState(false);
  const [pinnedPlayers, setPinnedPlayers] = useState<Player[]>([]);
  const [vagueAnalysis, setVagueAnalysis] = useState<VagueInputAnalysis | null>(null);
  const [quickSuggestions, setQuickSuggestions] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Squad builder hook for manual editing
  const squadBuilder = useSquadBuilder(
    candidates[activeCandidate]?.squad.formation ?? formation,
    candidates[activeCandidate]?.squad.players,
  );

  // Derive current squad players for "pick from squad" feature
  const currentCandidate = candidates[activeCandidate];
  const currentSquadPlayers = useMemo(
    () => currentCandidate?.squad.players ?? [],
    [currentCandidate],
  );

  // When editing mode changes, sync the squad builder with the active candidate
  useEffect(() => {
    if (editing && currentCandidate) {
      squadBuilder.setSquadPlayers(currentCandidate.squad.players);
      squadBuilder.setFormation(currentCandidate.squad.formation);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, activeCandidate]);

  // When squad builder's players change while editing, sync back
  // (This allows the candidate card to reflect the edited players)
  const editedPlayers = editing ? squadBuilder.squadPlayers : undefined;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [candidates]);

  const buildPinnedSpids = (): number[] | undefined => {
    if (pinnedPlayers.length === 0) return undefined;
    return pinnedPlayers.map((p) => p.spid);
  };

  const handleChatSubmit = async () => {
    if (!chatInput.trim() || loading) return;
    setLoading(true);
    setVagueAnalysis(null);
    setQuickSuggestions([]);
    // Exit editing mode when generating new squads
    setEditing(false);
    try {
      const res = await fetch('/api/squad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formation,
          prompt: chatInput,
          pinnedPlayers: buildPinnedSpids(),
        }),
      });
      const data = await res.json();
      setCandidates(data.candidates || []);
      setActiveCandidate(0);
      // Capture vague input analysis for UI feedback
      if (data.vagueAnalysis) {
        setVagueAnalysis(data.vagueAnalysis);
      }
      if (data.quickSuggestions) {
        setQuickSuggestions(data.quickSuggestions);
      }
    } catch {
      console.error('Failed to generate squads');
    } finally {
      setLoading(false);
    }
  };

  /** Handle clicking a quick suggestion chip */
  const handleSuggestionClick = (suggestion: string) => {
    setChatInput(suggestion);
  };

  /** Handle filter form results */
  const handleFilterResults = useCallback((filterCandidates: SquadCandidate[]) => {
    setCandidates(filterCandidates);
    setActiveCandidate(0);
    setEditing(false);
  }, []);

  /** Handle team color change from filter form (sync for formation view) */
  const handleFilterTeamColorChange = useCallback((colors: TeamColorSelection | null) => {
    setTeamColorSelection(colors);
  }, []);

  /** Toggle editing mode */
  const toggleEditing = useCallback(() => {
    setEditing((prev) => !prev);
  }, []);

  /** Handle slot click — opens the player picker */
  const handleSlotClick = useCallback((slotId: string) => {
    if (!editing) return;
    squadBuilder.selectSlot(slotId);
  }, [editing, squadBuilder]);

  /** Handle player selection from the picker */
  const handlePlayerSelect = useCallback((player: Player) => {
    squadBuilder.assignPlayer(player);
  }, [squadBuilder]);

  /** Handle player removal */
  const handlePlayerRemove = useCallback((slotId: string) => {
    squadBuilder.removePlayer(slotId);
  }, [squadBuilder]);

  /** Check if a player is already in the squad */
  const handleIsPlayerInSquad = useCallback((spid: number) => {
    return squadBuilder.isPlayerInSquad(spid);
  }, [squadBuilder]);

  /** Handle formation change from the squad builder */
  const handleFormationChange = useCallback((f: Formation) => {
    setFormation(f);
    if (editing) {
      squadBuilder.setFormation(f);
    }
  }, [editing, squadBuilder]);

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      <h1 className="text-xl font-bold mb-4 sm:text-2xl sm:mb-6">AI 스쿼드 빌더</h1>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-6">
        {/* Left: Input Panel (2/5 on desktop) */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {/* Tab Toggle */}
          <div className="flex rounded-lg bg-gray-800 p-1">
            <button
              onClick={() => setTab('chat')}
              className={`flex-1 rounded-md px-3 py-2 sm:px-4 text-sm font-medium transition-colors tap-target ${
                tab === 'chat' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              자연어 입력
            </button>
            <button
              onClick={() => setTab('filter')}
              className={`flex-1 rounded-md px-3 py-2 sm:px-4 text-sm font-medium transition-colors tap-target ${
                tab === 'filter' ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              조건 선택
            </button>
          </div>

          {/* Player Multi-Select (always visible) */}
          <PlayerMultiSelect
            selected={pinnedPlayers}
            onChange={setPinnedPlayers}
            maxSelect={3}
            squadPlayers={currentSquadPlayers}
            label="고정 선수 (최대 3명)"
            placeholder="포함할 선수 검색..."
            className="rounded-lg bg-gray-900 p-3"
          />

          {/* Chat Tab */}
          {tab === 'chat' && (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">포메이션</label>
                <FormationSelector
                  value={editing ? squadBuilder.formation : formation}
                  onChange={handleFormationChange}
                />
              </div>

              {/* Active candidate reasoning (inline preview) */}
              {currentCandidate && !editing && (
                <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-sm font-bold text-yellow-400">
                      추천 {activeCandidate + 1}
                    </span>
                    <span className="rounded bg-gray-700 px-1.5 py-0.5 text-xs font-medium text-blue-300">
                      {currentCandidate.squad.formation}
                    </span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {currentCandidate.score}점
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    {currentCandidate.reasoning}
                  </p>
                </div>
              )}

              {/* Quick candidate list (compact, when multiple exist and not editing) */}
              {candidates.length > 1 && !editing && (
                <div className="space-y-1.5">
                  {candidates.map((c, i) => (
                    <button
                      key={c.squad.id}
                      type="button"
                      onClick={() => setActiveCandidate(i)}
                      className={`w-full text-left rounded-lg border p-2 transition-colors ${
                        i === activeCandidate
                          ? 'border-yellow-500/50 bg-gray-800/80'
                          : 'border-gray-700/50 hover:border-gray-600 bg-gray-900/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
                              i === activeCandidate
                                ? 'bg-yellow-500 text-gray-900'
                                : 'bg-gray-700 text-gray-400'
                            }`}
                          >
                            {i + 1}
                          </span>
                          <span className="text-xs text-gray-300 font-medium">
                            {c.squad.formation}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500">
                          {c.score}점
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Editing panel (shown when in edit mode) */}
              {editing && (
                <div className="rounded-lg border border-green-500/30 bg-green-950/10 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-green-400">수동 편집 모드</span>
                    <div className="flex items-center gap-2">
                      {squadBuilder.isModified && (
                        <button
                          type="button"
                          onClick={squadBuilder.resetSquad}
                          className="text-[11px] text-gray-400 hover:text-gray-200 px-2 py-1 rounded-md hover:bg-gray-800 transition-colors"
                        >
                          초기화
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">
                    포메이션 위의 선수 슬롯을 탭하여 선수를 추가하거나 교체할 수 있습니다.
                  </p>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-yellow-500" />
                      빈 슬롯: 선수 추가
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      선수 탭: 교체/제거
                    </span>
                  </div>
                </div>
              )}

              <div className="min-h-[100px] max-h-[200px] overflow-y-auto rounded-lg bg-gray-900 p-3 space-y-2">
                {candidates.length === 0 && !vagueAnalysis && (
                  <p className="text-sm text-gray-500">
                    예: &quot;500억으로 맨시티 팀컬러 442 짜줘&quot;
                  </p>
                )}

                {/* Vague input feedback */}
                {vagueAnalysis && vagueAnalysis.isVague && (
                  <div className={`rounded-lg border p-2.5 ${
                    vagueAnalysis.vaguenessLevel === 'very_vague'
                      ? 'border-amber-500/40 bg-amber-950/20'
                      : 'border-blue-500/30 bg-blue-950/20'
                  }`}>
                    <p className={`text-xs leading-relaxed ${
                      vagueAnalysis.vaguenessLevel === 'very_vague'
                        ? 'text-amber-300'
                        : 'text-blue-300'
                    }`}>
                      {vagueAnalysis.summaryKo}
                    </p>
                    {vagueAnalysis.issues.filter(i => i.severity !== 'info').map((issue, idx) => (
                      <p key={idx} className="text-[11px] text-gray-400 mt-1">
                        • {issue.messageKo}
                      </p>
                    ))}
                  </div>
                )}

                {/* Quick suggestion chips */}
                {quickSuggestions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {quickSuggestions.map((suggestion, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="rounded-full border border-gray-700 bg-gray-800 px-2.5 py-1 text-[11px] text-gray-300 hover:border-blue-500/50 hover:text-blue-300 hover:bg-gray-750 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleChatSubmit()}
                  placeholder="예: 500억으로 맨시티 팀컬러 442 짜줘"
                  enterKeyHint="send"
                  className="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-white placeholder-gray-500 focus:border-yellow-500 focus:outline-none"
                />
                <button
                  onClick={handleChatSubmit}
                  disabled={loading}
                  className="rounded-lg bg-yellow-500 px-5 py-2.5 sm:px-6 sm:py-3 font-medium text-gray-900 hover:bg-yellow-400 active:scale-95 disabled:opacity-50 transition-all tap-target"
                >
                  {loading ? '생성 중...' : '생성'}
                </button>
              </div>
            </div>
          )}

          {/* Filter Tab — uses SquadFilterForm container */}
          {tab === 'filter' && (
            <SquadFilterForm
              formation={editing ? squadBuilder.formation : formation}
              onFormationChange={handleFormationChange}
              pinnedPlayers={pinnedPlayers}
              onResults={handleFilterResults}
              onTeamColorChange={handleFilterTeamColorChange}
            />
          )}
        </div>

        {/* Right: Squad Candidates Display (3/5 on desktop) */}
        <div className="lg:col-span-3">
          {candidates.length > 0 ? (
            <div className="space-y-3">
              {/* Edit toggle button */}
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={toggleEditing}
                  className={`
                    flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all active:scale-95
                    ${editing
                      ? 'bg-green-500 text-gray-900 shadow-md shadow-green-500/20'
                      : 'bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 hover:text-white'
                    }
                  `}
                >
                  {editing ? (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      편집 완료
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                      선수 편집
                    </>
                  )}
                </button>
              </div>

              <SquadCandidatesView
                candidates={candidates}
                activeIndex={activeCandidate}
                onActiveChange={(idx) => {
                  // When switching candidates while editing, update the squad builder
                  if (editing) {
                    squadBuilder.setSquadPlayers(candidates[idx].squad.players);
                    squadBuilder.setFormation(candidates[idx].squad.formation);
                    setFormation(candidates[idx].squad.formation);
                  }
                  setActiveCandidate(idx);
                }}
                teamColors={teamColorSelection}
                editing={editing}
                onSlotClick={handleSlotClick}
                editablePlayers={editedPlayers}
              />
            </div>
          ) : (
            <div className="flex h-full min-h-[400px] items-center justify-center rounded-xl border border-gray-800 bg-gray-900">
              <div className="text-center space-y-3 px-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm">
                  조건을 입력하면 스쿼드가 표시됩니다
                </p>
                <p className="text-gray-600 text-xs">
                  자연어 또는 조건 선택으로 3개의 추천 스쿼드를 생성합니다
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Player Picker Bottom Sheet (mobile-optimized) */}
      <PlayerPickerSheet
        selection={squadBuilder.selectedSlot}
        onSelectPlayer={handlePlayerSelect}
        onRemovePlayer={handlePlayerRemove}
        onClose={squadBuilder.clearSelection}
        isPlayerInSquad={handleIsPlayerInSquad}
      />
    </div>
  );
}
