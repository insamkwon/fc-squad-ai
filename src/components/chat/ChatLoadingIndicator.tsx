'use client';

import type { ChatPipelineStage } from '@/hooks/useChatStream';

interface ChatLoadingIndicatorProps {
  /** Current pipeline stage. */
  stage: ChatPipelineStage;
  /** Warnings accumulated so far. */
  warnings?: string[];
}

/** Human-readable labels for each pipeline stage (Korean). */
const STAGE_LABELS: Record<string, { label: string; description: string }> = {
  idle: { label: '대기', description: '' },
  parsing: {
    label: '입력 분석 중',
    description: '자연어를 파싱하여 조건을 추출하고 있어요...',
  },
  parsed: {
    label: '분석 완료',
    description: '조건을 확인했어요. 스쿼드를 생성합니다...',
  },
  generating: {
    label: '스쿼드 생성 중',
    description: 'AI가 최적의 스쿼드를 조합하고 있어요...',
  },
  complete: { label: '완료', description: '' },
  error: { label: '오류', description: '' },
};

/**
 * Animated pipeline loading indicator showing the current stage of the
 * AI squad-generation pipeline (parsing → parsed → generating → complete).
 *
 * Displays a step progress bar, pulsing dot animation, and stage description.
 */
export default function ChatLoadingIndicator({
  stage,
  warnings,
}: ChatLoadingIndicatorProps) {
  if (stage === 'idle' || stage === 'complete' || stage === 'error') {
    return null;
  }

  const info = STAGE_LABELS[stage];
  const stageOrder: ChatPipelineStage[] = ['parsing', 'parsed', 'generating'];
  const currentIdx = stageOrder.indexOf(stage);

  return (
    <div className="space-y-2.5">
      {/* Step progress bar */}
      <div className="flex items-center gap-1.5">
        {stageOrder.map((s, i) => {
          const isActive = i === currentIdx;
          const isPast = i < currentIdx;

          return (
            <div key={s} className="flex items-center gap-1.5 flex-1">
              {/* Step dot */}
              <div className="relative flex items-center justify-center">
                <div
                  className={`
                    w-2 h-2 rounded-full transition-all duration-300
                    ${isPast
                      ? 'bg-green-500'
                      : isActive
                        ? 'bg-yellow-500 animate-pulse'
                        : 'bg-gray-600'
                    }
                  `}
                />
                {isActive && (
                  <div className="absolute w-2 h-2 rounded-full bg-yellow-500/40 animate-ping" />
                )}
              </div>

              {/* Step label */}
              <span
                className={`
                  text-[10px] font-medium whitespace-nowrap transition-colors
                  ${isPast
                    ? 'text-green-400'
                    : isActive
                      ? 'text-yellow-400'
                      : 'text-gray-600'
                  }
                `}
              >
                {STAGE_LABELS[s].label}
              </span>

              {/* Connector line */}
              {i < stageOrder.length - 1 && (
                <div
                  className={`
                    flex-1 h-px mx-1 transition-colors duration-300
                    ${isPast ? 'bg-green-500/50' : 'bg-gray-700'}
                  `}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Stage description */}
      <p className="text-xs text-gray-400">{info.description}</p>

      {/* Inline warnings */}
      {warnings && warnings.length > 0 && (
        <div className="space-y-1">
          {warnings.map((w, i) => (
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
    </div>
  );
}
