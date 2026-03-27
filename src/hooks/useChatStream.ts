"use client";

import { useCallback, useRef, useState } from "react";
import type { Formation, SquadCandidate } from "@/types/squad";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** All possible SSE event types from the /api/chat endpoint */
export type ChatEventType =
  | "parsing"
  | "parsed"
  | "generating"
  | "candidate"
  | "complete"
  | "warning"
  | "error";

/** Parsed SSE event from the streaming API */
export interface ChatStreamEvent {
  type: ChatEventType;
  input?: string;
  method?: "gemini" | "fallback";
  confidence?: number;
  formation?: string;
  warnings?: string[];
  candidateCount?: number;
  index?: number;
  candidate?: SquadCandidate;
  totalCandidates?: number;
  totalTimeMs?: number;
  message?: string;
  code?: string;
  details?: string;
}

/** Current state of the chat streaming pipeline */
export type ChatPipelineStage =
  | "idle"
  | "parsing"
  | "parsed"
  | "generating"
  | "complete"
  | "error";

/** Options for starting a chat stream */
export interface UseChatStreamOptions {
  /** Optional override formation */
  formation?: Formation;
  /** Optional pinned player SPIDs */
  pinnedPlayers?: number[];
  /** Callback invoked for each event (for custom handling) */
  onEvent?: (event: ChatStreamEvent) => void;
}

/** Return value of the useChatStream hook */
export interface UseChatStreamReturn {
  /** Current pipeline stage */
  stage: ChatPipelineStage;
  /** All accumulated squad candidates */
  candidates: SquadCandidate[];
  /** Warnings accumulated during the pipeline */
  warnings: string[];
  /** Error information (if stage === "error") */
  error: { code: string; message: string; details?: string } | null;
  /** Parsing metadata (method, confidence, formation) */
  parseInfo: { method?: string; confidence?: number; formation?: string } | null;
  /** Total processing time in ms (available after complete) */
  totalTimeMs: number | null;
  /** Whether a request is in flight */
  isLoading: boolean;
  /** Send a chat message and start the streaming pipeline */
  sendMessage: (message: string) => void;
  /** Reset state to idle */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * React hook for consuming the streaming /api/chat endpoint.
 *
 * Manages the SSE connection lifecycle and accumulates squad candidates
 * as they stream in, providing a clean interface for UI components.
 *
 * @example
 * ```tsx
 * const { stage, candidates, warnings, sendMessage, reset } = useChatStream({
 *   formation: "4-3-3",
 *   pinnedPlayers: [12345],
 * });
 *
 * return (
 *   <div>
 *     {stage === "parsing" && <p>분석 중...</p>}
 *     {stage === "generating" && <p>스쿼드 생성 중...</p>}
 *     {candidates.map((c, i) => <SquadCard key={i} candidate={c} />)}
 *   </div>
 * );
 * ```
 */
export function useChatStream(options: UseChatStreamOptions = {}): UseChatStreamReturn {
  const { formation, pinnedPlayers, onEvent } = options;

  const [stage, setStage] = useState<ChatPipelineStage>("idle");
  const [candidates, setCandidates] = useState<SquadCandidate[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<{ code: string; message: string; details?: string } | null>(null);
  const [parseInfo, setParseInfo] = useState<{ method?: string; confidence?: number; formation?: string } | null>(null);
  const [totalTimeMs, setTotalTimeMs] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Use refs to avoid stale closures in the streaming handler
  const abortRef = useRef<AbortController | null>(null);
  const candidatesRef = useRef<SquadCandidate[]>([]);
  const warningsRef = useRef<string[]>([]);

  const reset = useCallback(() => {
    setStage("idle");
    setCandidates([]);
    candidatesRef.current = [];
    setWarnings([]);
    warningsRef.current = [];
    setError(null);
    setParseInfo(null);
    setTotalTimeMs(null);
    setIsLoading(false);
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const sendMessage = useCallback(
    (message: string) => {
      // Abort any existing stream
      abortRef.current?.abort();

      // Reset state
      setCandidates([]);
      candidatesRef.current = [];
      setWarnings([]);
      warningsRef.current = [];
      setError(null);
      setParseInfo(null);
      setTotalTimeMs(null);
      setIsLoading(true);

      const abortController = new AbortController();
      abortRef.current = abortController;

      // Build request body
      const body: Record<string, unknown> = { message };
      if (formation) body.formation = formation;
      if (pinnedPlayers && pinnedPlayers.length > 0) body.pinnedPlayers = pinnedPlayers;

      // Start streaming
      (async () => {
        try {
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: abortController.signal,
          });

          // Handle non-OK responses (validation errors)
          if (!response.ok) {
            let errorMessage = "요청 처리 중 오류가 발생했습니다.";
            try {
              const errorData = await response.json();
              errorMessage = errorData.error?.message ?? errorMessage;
            } catch {
              // ignore JSON parse error
            }
            setStage("error");
            setError({
              code: `HTTP_${response.status}`,
              message: errorMessage,
            });
            setIsLoading(false);
            return;
          }

          // Process SSE stream
          const reader = response.body?.getReader();
          if (!reader) {
            setStage("error");
            setError({ code: "NO_STREAM", message: "응답 스트림을 읽을 수 없습니다." });
            setIsLoading(false);
            return;
          }

          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });

            // Parse SSE events (each event is "data: {...}\n\n")
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? ""; // Keep incomplete line in buffer

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;

              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              let event: ChatStreamEvent;
              try {
                event = JSON.parse(jsonStr);
              } catch {
                continue; // Skip malformed JSON
              }

              // Invoke custom handler
              onEvent?.(event);

              // Update state based on event type
              switch (event.type) {
                case "parsing":
                  setStage("parsing");
                  break;

                case "parsed":
                  setStage("parsed");
                  setParseInfo({
                    method: event.method,
                    confidence: event.confidence,
                    formation: event.formation,
                  });
                  if (event.warnings) {
                    const newWarnings = [...warningsRef.current, ...event.warnings];
                    setWarnings(newWarnings);
                    warningsRef.current = newWarnings;
                  }
                  break;

                case "generating":
                  setStage("generating");
                  break;

                case "candidate":
                  if (event.candidate) {
                    const newCandidates = [
                      ...candidatesRef.current,
                      event.candidate,
                    ];
                    candidatesRef.current = newCandidates;
                    setCandidates(newCandidates);
                  }
                  break;

                case "complete":
                  setStage("complete");
                  setTotalTimeMs(event.totalTimeMs ?? null);
                  if (event.warnings) {
                    const newWarnings = [...warningsRef.current, ...event.warnings];
                    setWarnings(newWarnings);
                    warningsRef.current = newWarnings;
                  }
                  break;

                case "warning":
                  if (event.message) {
                    const newWarnings = [...warningsRef.current, event.message];
                    setWarnings(newWarnings);
                    warningsRef.current = newWarnings;
                  }
                  break;

                case "error":
                  setStage("error");
                  setError({
                    code: event.code ?? "UNKNOWN",
                    message: event.message ?? "알 수 없는 오류",
                    details: event.details,
                  });
                  break;
              }
            }
          }

          // If stream ended without explicit complete/error, mark as complete
          // (in case the stream was interrupted cleanly)
          if (candidatesRef.current.length > 0 && stage !== "error") {
            setStage("complete");
            setTotalTimeMs(Date.now() - Date.now()); // approximate
          }
        } catch (err) {
          // Ignore abort errors
          if (err instanceof DOMException && err.name === "AbortError") {
            return;
          }
          setStage("error");
          setError({
            code: "FETCH_ERROR",
            message: "네트워크 오류가 발생했습니다.",
            details: err instanceof Error ? err.message : undefined,
          });
        } finally {
          setIsLoading(false);
          abortRef.current = null;
        }
      })();
    },
    [formation, pinnedPlayers, onEvent, stage],
  );

  return {
    stage,
    candidates,
    warnings,
    error,
    parseInfo,
    totalTimeMs,
    isLoading,
    sendMessage,
    reset,
  };
}
