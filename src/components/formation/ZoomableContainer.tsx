'use client';

import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

interface ZoomableContainerProps {
  children: ReactNode;
  /** Whether zoom is enabled (default: true on mobile, false on desktop) */
  enableZoom?: boolean;
  /** Minimum zoom scale (default: 1) */
  minScale?: number;
  /** Maximum zoom scale (default: 2.5) */
  maxScale?: number;
  /** Additional CSS classes for the outer container */
  className?: string;
}

/**
 * Container that provides pinch-to-zoom and double-tap-to-zoom for mobile
 * formation views.
 *
 * - On mobile: enables touch-based pinch zoom with smooth transitions
 * - On desktop: zoom controls are available but touch gestures are disabled
 * - Includes a floating zoom toggle button
 * - Uses CSS `transform` for GPU-accelerated scaling
 * - Properly manages scroll containment when zoomed
 */
export default function ZoomableContainer({
  children,
  enableZoom = true,
  minScale = 1,
  maxScale = 2.5,
  className = '',
}: ZoomableContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isZoomed, setIsZoomed] = useState(false);

  // Gesture tracking refs (not state to avoid re-renders during gestures)
  const gestureRef = useRef<'idle' | 'pinch' | 'pan'>('idle');
  const lastDist = useRef(0);
  const lastCenter = useRef({ x: 0, y: 0 });
  const baseTransform = useRef({ scale: 1, x: 0, y: 0 });
  const lastTapRef = useRef(0);
  const animFrameRef = useRef(0);

  const resetZoom = useCallback(() => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
    setIsZoomed(false);
    baseTransform.current = { scale: 1, x: 0, y: 0 };
  }, []);

  const toggleZoom = useCallback(() => {
    if (scale > 1.05) {
      resetZoom();
    } else {
      const targetScale = Math.min(1.8, maxScale);
      setScale(targetScale);
      setTranslate({ x: 0, y: 0 });
      setIsZoomed(true);
      baseTransform.current = { scale: targetScale, x: 0, y: 0 };
    }
  }, [scale, maxScale, resetZoom]);

  const clampScale = useCallback(
    (s: number) => Math.min(maxScale, Math.max(minScale, s)),
    [minScale, maxScale],
  );

  const getDist = (t1: React.Touch, t2: React.Touch) => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getCenter = (t1: React.Touch, t2: React.Touch) => ({
    x: (t1.clientX + t2.clientX) / 2,
    y: (t1.clientY + t2.clientY) / 2,
  });

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enableZoom) return;

      if (e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();
        gestureRef.current = 'pinch';
        lastDist.current = getDist(e.touches[0], e.touches[1]);
        lastCenter.current = getCenter(e.touches[0], e.touches[1]);
        baseTransform.current = { scale, x: translate.x, y: translate.y };
      } else if (e.touches.length === 1 && isZoomed) {
        gestureRef.current = 'pan';
        lastCenter.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        baseTransform.current = { scale, x: translate.x, y: translate.y };
      } else if (e.touches.length === 1 && !isZoomed) {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          toggleZoom();
        }
        lastTapRef.current = now;
      }
    },
    [enableZoom, scale, translate.x, translate.y, isZoomed, toggleZoom],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enableZoom) return;

      if (gestureRef.current === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        e.stopPropagation();

        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = requestAnimationFrame(() => {
          const dist = getDist(e.touches[0], e.touches[1]);
          const center = getCenter(e.touches[0], e.touches[1]);
          const scaleFactor = dist / Math.max(lastDist.current, 1);
          const newScale = clampScale(baseTransform.current.scale * scaleFactor);

          const dx = center.x - lastCenter.current.x;
          const dy = center.y - lastCenter.current.y;

          setScale(newScale);
          setTranslate({
            x: baseTransform.current.x + dx,
            y: baseTransform.current.y + dy,
          });
        });
      } else if (gestureRef.current === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        e.stopPropagation();

        cancelAnimationFrame(animFrameRef.current);
        animFrameRef.current = requestAnimationFrame(() => {
          const dx = e.touches[0].clientX - lastCenter.current.x;
          const dy = e.touches[0].clientY - lastCenter.current.y;

          setTranslate({
            x: baseTransform.current.x + dx,
            y: baseTransform.current.y + dy,
          });
        });
      }
    },
    [enableZoom, clampScale],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enableZoom) return;

      if (e.touches.length < 2 && gestureRef.current === 'pinch') {
        // Snap to 1x if close
        if (Math.abs(scale - 1) < 0.15) {
          resetZoom();
        } else {
          setIsZoomed(true);
        }
      }
      gestureRef.current = 'idle';
    },
    [enableZoom, scale, resetZoom],
  );

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  const touchHandlers = enableZoom
    ? {
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
      }
    : {};

  return (
    <div className={`relative ${className}`}>
      {/* Zoomable area */}
      <div
        ref={containerRef}
        className={`
          relative overflow-hidden rounded-xl transition-transform duration-200 ease-out
          ${isZoomed ? 'z-10' : ''}
        `}
        style={{
          transform: scale > 1.01 ? `translate(${translate.x}px, ${translate.y}px) scale(${scale})` : undefined,
          transformOrigin: 'center center',
          touchAction: enableZoom ? 'none' : 'auto',
        }}
        {...touchHandlers}
      >
        {children}
      </div>

      {/* Zoom toggle button */}
      {enableZoom && (
        <button
          type="button"
          onClick={toggleZoom}
          className={`
            absolute bottom-2 right-2 z-20
            flex items-center justify-center
            w-8 h-8 rounded-full
            bg-gray-800/80 border border-white/15
            backdrop-blur-sm
            text-white/70 hover:text-white hover:bg-gray-700/90
            transition-all duration-150
            shadow-lg
            tap-target
          `}
          aria-label={isZoomed ? '축소' : '확대'}
        >
          {isZoomed ? (
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM7.346 6.346a.75.75 0 00-1.092 1.028L8.628 10l-2.374 2.626a.75.75 0 101.092 1.028L10 11.058l2.654 2.596a.75.75 0 001.092-1.028L11.372 10l2.374-2.626a.75.75 0 00-1.092-1.028L10 8.942 7.346 6.346z"
                clipRule="evenodd"
              />
            </svg>
          ) : (
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
