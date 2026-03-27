"use client";

import {
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from "react";

interface SwipeableCardsProps {
  /** Card elements to swipe between (2–3 recommended). */
  children: ReactNode[];
  /** Additional CSS classes for the root wrapper. */
  className?: string;
  /** Callback fired when the active card index changes. */
  onIndexChange?: (index: number) => void;
}

/**
 * Horizontal swipeable card container powered by CSS scroll-snap.
 *
 * On mobile, users can swipe left/right to navigate between cards.
 * Dot indicators below show which card is active and allow direct
 * navigation by tap.
 *
 * Uses native CSS scroll-snap for smooth, performant gesture handling
 * with zero JavaScript animation overhead.
 */
export default function SwipeableCards({
  children,
  className = "",
  onIndexChange,
}: SwipeableCardsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToIndex = useCallback((index: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const child = container.children[index] as HTMLElement | undefined;
    if (!child) return;
    container.scrollTo({ left: child.offsetLeft, behavior: "smooth" });
  }, []);

  const handleScroll = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const childWidth = container.offsetWidth;
    if (childWidth === 0) return;
    const newIndex = Math.round(container.scrollLeft / childWidth);
    if (newIndex !== activeIndex) {
      setActiveIndex(newIndex);
      onIndexChange?.(newIndex);
    }
  }, [activeIndex, onIndexChange]);

  return (
    <div className={className}>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="scrollbar-hide snap-x snap-mandatory flex overflow-x-auto"
      >
        {children.map((child, idx) => (
          <div
            key={idx}
            className="min-w-full shrink-0 snap-start"
          >
            {child}
          </div>
        ))}
      </div>

      {/* Dot pagination indicators */}
      {children.length > 1 && (
        <div
          className="mt-3 flex justify-center gap-2"
          role="tablist"
          aria-label="슬라이드 네비게이션"
        >
          {children.map((_, idx) => (
            <button
              key={idx}
              type="button"
              role="tab"
              aria-selected={idx === activeIndex}
              onClick={() => {
                setActiveIndex(idx);
                scrollToIndex(idx);
                onIndexChange?.(idx);
              }}
              className={`h-1.5 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400 tap-target ${
                idx === activeIndex
                  ? "w-5 bg-yellow-400"
                  : "w-1.5 bg-gray-600 hover:bg-gray-500"
              }`}
              aria-label={`선수 ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
