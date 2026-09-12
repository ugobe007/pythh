import { useEffect, useMemo, useState } from "react";
import { uniqueMatchPairs, useRecentMatches } from "@/components/RecentMatchesFeed";
import {
  LIVEWIRE_PAGE_SIZE,
  LivewireMatchPanel,
  firmLabel,
  livewireMeta,
  livewireTimeLabel,
} from "@/components/LivewireMatchPanel";

export const FEATURED_PAGE_SIZE = LIVEWIRE_PAGE_SIZE;
export const FEATURED_MATCH_POOL = 18;
export const FEATURED_MATCH_FETCH = 20;
export const FEATURED_MATCH_ROTATE_MS = 8000;

export { firmLabel, livewireMeta, livewireTimeLabel };

export default function HomeFeaturedMatch() {
  const { matches: raw, loading } = useRecentMatches(FEATURED_MATCH_FETCH);
  const matches = useMemo(() => uniqueMatchPairs(raw, FEATURED_MATCH_POOL), [raw]);
  const [paused, setPaused] = useState(false);
  const pageCount = matches.length > FEATURED_PAGE_SIZE
    ? Math.ceil(matches.length / FEATURED_PAGE_SIZE)
    : 1;

  const initialPage = useMemo(() => {
    if (pageCount < 2) return 0;
    return Math.floor(Date.now() / FEATURED_MATCH_ROTATE_MS) % pageCount;
  }, [pageCount]);

  const [page, setPage] = useState(initialPage);

  useEffect(() => {
    setPage(initialPage);
  }, [initialPage]);

  useEffect(() => {
    if (pageCount < 2 || paused) return;
    const reduce = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduce) return;
    const id = window.setInterval(() => {
      setPage((n) => (n + 1) % pageCount);
    }, FEATURED_MATCH_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [pageCount, paused]);

  return (
    <LivewireMatchPanel
      id="featured-match"
      matches={matches}
      loading={loading}
      page={page}
      pageCount={pageCount}
      onPage={setPage}
      onPause={setPaused}
    />
  );
}
