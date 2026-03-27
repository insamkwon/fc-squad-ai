import { Suspense } from "react";
import PlayersPageContent from "./PlayersPageContent";

/**
 * Player Database page — wrapped in Suspense because the inner content
 * uses `useSearchParams()` which requires a Suspense boundary during
 * prerendering.
 */
export default function PlayersPage() {
  return (
    <Suspense fallback={<PlayersPageSkeleton />}>
      <PlayersPageContent />
    </Suspense>
  );
}

function PlayersPageSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">
      <div className="mb-4">
        <div className="h-7 w-48 animate-pulse rounded bg-gray-800" />
        <div className="mt-2 h-3 w-32 animate-pulse rounded bg-gray-800" />
      </div>
      <div className="mb-4 h-12 w-full animate-pulse rounded-xl bg-gray-800" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-xl border border-gray-800 bg-gray-900">
            <div className="flex gap-3 p-3">
              <div className="h-16 w-16 rounded-lg bg-gray-800 sm:h-20 sm:w-20" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 rounded bg-gray-800" />
                <div className="h-3 w-20 rounded bg-gray-800" />
                <div className="h-3 w-16 rounded bg-gray-800" />
                <div className="h-4 w-14 rounded bg-gray-800" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 border-t border-gray-800 px-3 py-2">
              {Array.from({ length: 6 }).map((_, j) => (
                <div key={j} className="flex items-center gap-1.5">
                  <div className="h-3 w-5 rounded bg-gray-800" />
                  <div className="h-1.5 flex-1 rounded-full bg-gray-800" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
