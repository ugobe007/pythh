import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { uniqueMatchPairs, useRecentMatches, type RecentMatch } from "@/components/RecentMatchesFeed";
import { BORDER, CARD, DIM, G, MUTED, PURPLE_ACCENT, PURPLE_BORDER, TEXT } from "@/lib/designTokens";

export const FEATURED_PAGE_SIZE = 3;
export const FEATURED_MATCH_POOL = 9;
export const FEATURED_MATCH_FETCH = 20;
export const FEATURED_MATCH_ROTATE_MS = 8000;

function firmLabel(m: RecentMatch) {
  if (m.investor_firm && m.investor_firm !== "-" && m.investor_firm !== m.investor_name) {
    return m.investor_firm;
  }
  return m.investor_name;
}

export default function HomeFeaturedMatch() {
  const { matches: raw, loading } = useRecentMatches(FEATURED_MATCH_FETCH);
  const matches = useMemo(() => uniqueMatchPairs(raw, FEATURED_MATCH_POOL), [raw]);
  const [paused, setPaused] = useState(false);
  const pageCount = matches.length ? Math.ceil(matches.length / FEATURED_PAGE_SIZE) : 0;

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

  const visible = matches.slice(
    page * FEATURED_PAGE_SIZE,
    page * FEATURED_PAGE_SIZE + FEATURED_PAGE_SIZE,
  );

  return (
    <aside
      id="featured-match"
      className="rounded-xl text-left flex flex-col"
      style={{ backgroundColor: CARD, border: `1px solid ${PURPLE_BORDER}`, minHeight: 280 }}
      aria-label="Rotating live investor matches"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: `1px solid ${BORDER}` }}>
        <p className="text-[11px] font-medium tracking-wide" style={{ color: PURPLE_ACCENT }}>
          Live matches
        </p>
        <span className="text-[12px] font-mono" style={{ color: DIM }}>
          {pageCount > 1 ? `${page + 1} of ${pageCount}` : "Live network"}
        </span>
      </div>

      {loading && visible.length === 0 ? (
        <div className="flex-1 px-5 py-4 space-y-3" aria-hidden>
          <div className="h-12 rounded animate-pulse" style={{ backgroundColor: BORDER }} />
          <div className="h-12 rounded animate-pulse" style={{ backgroundColor: BORDER }} />
          <div className="h-12 rounded animate-pulse" style={{ backgroundColor: BORDER }} />
        </div>
      ) : visible.length ? (
        <div className="flex-1" aria-live="polite">
          {visible.map((m, i) => (
            <Link
              key={`${m.match_id}-${i}`}
              href={m.startup_id ? `/startup/${encodeURIComponent(m.startup_id)}` : "/matches"}
              className="flex items-baseline justify-between gap-4 px-5 py-4"
              style={{ borderTop: i === 0 ? undefined : `1px solid ${BORDER}` }}
            >
              <span className="font-display font-bold text-[1.05rem] leading-tight truncate" style={{ color: TEXT }}>
                {m.startup_name}
              </span>
              <span className="text-[14px] truncate text-right flex-shrink-0 max-w-[55%]" style={{ color: MUTED }}>
                {firmLabel(m)}
              </span>
            </Link>
          ))}
          {pageCount > 1 ? (
            <div className="flex items-center gap-1.5 px-5 pb-4" role="tablist" aria-label="Rotate featured matches">
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={i === page}
                  aria-label={`Show matches page ${i + 1} of ${pageCount}`}
                  onClick={() => setPage(i)}
                  className="rounded-full"
                  style={{
                    width: i === page ? 14 : 6,
                    height: 6,
                    backgroundColor: i === page ? PURPLE_ACCENT : BORDER,
                  }}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="px-5 py-8 text-[15px] leading-relaxed" style={{ color: MUTED }}>
          Ranked investor matches appear here from the live network. Paste a URL to preview yours.
        </p>
      )}

      <Link
        href="/matches"
        className="flex items-center justify-between px-5 py-3 text-[14px]"
        style={{ borderTop: `1px solid ${BORDER}`, color: G }}
      >
        See all live matches <ArrowRight size={14} />
      </Link>
    </aside>
  );
}
