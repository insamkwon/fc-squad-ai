'use client';

import { useCallback, useRef, useState } from 'react';

interface PinchZoomState {
  scale: number;
  x: number;
  y: number;
}

interface UsePinchZoomOptions {
  /** Minimum zoom level (default: 1) */
  minScale?: number;
  /** Maximum zoom level (default: 2.5) */
  maxScale?: number;
  /** Zoom step for double-tap (default: 1.5) */
  doubleTapScale?: number;
  /** Whether pinch-to-zoom is enabled (default: false) */
  enabled?: boolean;
}

interface UsePinchZoomReturn {
  ref: React.RefObject<HTMLDivElement | null>;
  state: PinchZoomState;
  isZoomed: boolean;
  reset: () => void;
  toggleZoom: () => void;
  touchHandlers: React.HTMLAttributes<HTMLDivElement>;
}

/**
 * Hook for pinch-to-zoom and pan behavior on a container element.
 *
 * Supports:
 * - Pinch-to-zoom on touch devices (2-finger gesture)
 * - Double-tap to toggle zoom
 * - Pan while zoomed (1-finger drag when scale > 1)
 * - Zoom controls via `toggleZoom()` and `reset()`
 *
 * The container should have `touch-action: none` for proper behavior.
 */
export function usePinchZoom({
  minScale = 1,
  maxScale = 2.5,
  doubleTapScale = 1.5,
  enabled = false,
}: UsePinchZoomOptions = {}): UsePinchZoomReturn {
  const ref = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<PinchZoomState>({ scale: 1, x: 0, y: 0 });

  // Refs for tracking gesture state without causing re-renders
  const lastTouchDist = useRef(0);
  const lastTouchCenter = useRef({ x: 0, y: 0 });
  const lastTapTime = useRef(0);
  const gestureState = useRef<'idle' | 'pinch' | 'pan'>('idle');
  const baseState = useRef<PinchZoomState>({ scale: 1, x: 0, y: 0 });

  const clampScale = useCallback(
    (s: number) => Math.min(maxScale, Math.max(minScale, s)),
    [minScale, maxScale],
  );

  const reset = useCallback(() => {
    setState({ scale: 1, x: 0, y: 0 });
    baseState.current = { scale: 1, x: 0, y: 0 };
  }, []);

  const toggleZoom = useCallback(() => {
    setState((prev) => {
      if (prev.scale > 1) {
        baseState.current = { scale: 1, x: 0, y: 0 };
        return { scale: 1, x: 0, y: 0 };
      }
      baseState.current = { scale: doubleTapScale, x: 0, y: 0 };
      return { scale: doubleTapScale, x: 0, y: 0 };
    });
  }, [doubleTapScale]);

  const getTouchDistance = useCallback((touches: React.TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const getTouchCenter = useCallback((touches: React.TouchList) => ({
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  }), []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;

      if (e.touches.length === 2) {
        // Start pinch gesture
        e.preventDefault();
        gestureState.current = 'pinch';
        lastTouchDist.current = getTouchDistance(e.touches);
        lastTouchCenter.current = getTouchCenter(e.touches);
        baseState.current = { scale: state.scale, x: state.x, y: state.y };
      } else if (e.touches.length === 1 && state.scale > 1) {
        // Start pan gesture when zoomed
        gestureState.current = 'pan';
        lastTouchCenter.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        baseState.current = { scale: state.scale, x: state.x, y: state.y };
      } else if (e.touches.length === 1) {
        // Check for double-tap
        const now = Date.now();
        if (now - lastTapTime.current < 300) {
          toggleZoom();
        }
        lastTapTime.current = now;
      }
    },
    [enabled, state.scale, state.x, state.y, getTouchDistance, getTouchCenter, toggleZoom],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;

      if (gestureState.current === 'pinch' && e.touches.length === 2) {
        e.preventDefault();
        const dist = getTouchDistance(e.touches);
        const center = getTouchCenter(e.touches);

        const scaleFactor = dist / Math.max(lastTouchDist.current, 1);
        const newScale = clampScale(baseState.current.scale * scaleFactor);

        // Pan while pinching
        const dx = center.x - lastTouchCenter.current.x;
        const dy = center.y - lastTouchCenter.current.y;

        setState({
          scale: newScale,
          x: baseState.current.x + dx,
          y: baseState.current.y + dy,
        });
      } else if (gestureState.current === 'pan' && e.touches.length === 1) {
        e.preventDefault();
        const dx = e.touches[0].clientX - lastTouchCenter.current.x;
        const dy = e.touches[0].clientY - lastTouchCenter.current.y;

        setState({
          scale: baseState.current.scale,
          x: baseState.current.x + dx,
          y: baseState.current.y + dy,
        });
      }
    },
    [enabled, getTouchDistance, getTouchCenter, clampScale],
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;

      if (e.touches.length < 2) {
        if (gestureState.current === 'pinch') {
          // If scale is very close to 1, snap back
          setState((prev) => {
            if (Math.abs(prev.scale - 1) < 0.15) {
              baseState.current = { scale: 1, x: 0, y: 0 };
              return { scale: 1, x: 0, y: 0 };
            }
            return prev;
          });
        }
        gestureState.current = 'idle';
      }
    },
    [enabled],
  );

  const touchHandlers = enabled
    ? {
        onTouchStart: handleTouchStart,
        onTouchMove: handleTouchMove,
        onTouchEnd: handleTouchEnd,
      }
    : {};

  return {
    ref,
    state,
    isZoomed: state.scale > 1.05,
    reset,
    toggleZoom,
    touchHandlers,
  };
}
