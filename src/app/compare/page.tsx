"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Player } from "@/types/player";
import PlayerCompareView from "@/components/player/PlayerCompareView";

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="mb-6">
            <div className="h-8 w-48 animate-pulse rounded bg-gray-800" />
            <div className="mt-2 h-4 w-32 animate-pulse rounded bg-gray-800" />
          </div>
          <div className="flex h-[400px] items-center justify-center rounded-xl border border-gray-800 bg-gray-900">
            <p className="text-gray-500">로딩 중...</p>
          </div>
        </div>
      }
    >
      <ComparePageInner />
    </Suspense>
  );
}

function ComparePageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const spids = useMemo(() => {
    const raw = searchParams.get("spids");
    if (!raw) return [];
    return raw
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => !isNaN(n) && n > 0);
  }, [searchParams]);

  useEffect(() => {
    async function loadPlayers() {
      if (spids.length < 2) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch("/api/players/compare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spids }),
        });
        if (res.ok) {
          const data = await res.json();
          setPlayers(data.players ?? []);
        }
      } catch {
        // Silently fail — players stays empty
      } finally {
        setLoading(false);
      }
    }
    loadPlayers();
  }, [spids]);

  useEffect(() => {
    if (!loading && spids.length < 2) {
      router.replace("/players");
    }
  }, [loading, spids.length, router]);

  const handleRemove = useCallback(
    (spid: number) => {
      const remaining = spids.filter((id) => id !== spid);
      if (remaining.length < 2) {
        router.replace("/players");
        return;
      }
      router.replace(`/compare?spids=${remaining.join(",")}`);
    },
    [spids, router],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-800" />
          <div className="mt-2 h-4 w-32 animate-pulse rounded bg-gray-800" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-xl border border-gray-800 bg-gray-900 p-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-gray-800" />
                <div className="space-y-2">
                  <div className="h-4 w-24 rounded bg-gray-800" />
                  <div className="h-3 w-20 rounded bg-gray-800" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 animate-pulse rounded-xl border border-gray-800 bg-gray-900 p-6">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-16 rounded bg-gray-800" />
                <div className="flex gap-4">
                  <div className="h-6 flex-1 rounded bg-gray-800" />
                  <div className="h-6 flex-1 rounded bg-gray-800" />
                  <div className="h-6 flex-1 rounded bg-gray-800" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (spids.length < 2) {
    return null;
  }

  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      <div className="mb-4 sm:mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-white sm:text-xl">선수 비교</h1>
          <p className="mt-0.5 text-xs text-gray-500">
            {players.length}명의 선수를 비교 중 (최대 3명)
          </p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/players")}
          className="flex-shrink-0 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:bg-gray-700 active:bg-gray-600 tap-target"
        >
          선수 목록으로
        </button>
      </div>
      <PlayerCompareView players={players} onRemove={handleRemove} />
    </div>
  );
}
