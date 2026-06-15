/**
 * Live recent startup↔investor matches from /api/recent-matches.
 * Home: compact snippet. /matches: highlighted feed at top.
 */

import { useEffect, useState, useRef } from "react";
import { Link } from "wouter";
import { ArrowRight, CircleDot } from "lucide-react";
import { G, G_BORDER, AMBER, MUTED, DIM, BORDER, TEXT, CARD } from "@/lib/designTokens";

export interface RecentMatch {
  match_id: string;
  startup_id: string;
  investor_id: string;
  startup_name: string;
  startup_god_score: number | null;
  investor_name: string;
  investor_firm: string | null;
  match_score: number;
  created_at: string;
  time_ago: string;
}

function formatTimeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function mapHotMatch(raw: Record<string, unknown>): RecentMatch {
  const created = String(raw.created_at || "");
  return {
    match_id: String(raw.match_id || raw.id || ""),
    startup_id: String(raw.startup_id || ""),
    investor_id: String(raw.investor_id || ""),
    startup_name: String(raw.startup_name || "Startup"),
    startup_god_score:
      typeof raw.startup_god_score === "number" ? raw.startup_god_score : null,
    investor_name: String(raw.investor_name || "Investor"),
    investor_firm: raw.investor_firm ? String(raw.investor_firm) : null,
    match_score: Math.round(Number(raw.match_score) || 0),
    created_at: created,
    time_ago: created ? formatTimeAgo(created) : "recent",
  };
}

async function fetchRecentMatches(limit: number): Promise<RecentMatch[]> {
  try {
    const r = await fetch(`/api/recent-matches?limit=${limit}`);
    if (r.ok) {
      const d = await r.json();
      const list = Array.isArray(d.matches) ? d.matches : [];
      if (list.length > 0) return list as RecentMatch[];
    }
  } catch {
    // fall through
  }

  try {
    const r = await fetch(`/api/hot-matches?limit_count=${limit}`);
    if (r.ok) {
      const d = await r.json();
      const list = Array.isArray(d.matches) ? d.matches : [];
      if (list.length > 0) return list.map((m) => mapHotMatch(m as Record<string, unknown>));
    }
  } catch {
    // fall through
  }

  return [];
}

export function useRecentMatches(limit = 5) {
  const [matches, setMatches] = useState<RecentMatch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const maxWait = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 12_000);

    fetchRecentMatches(limit)
      .then((list) => {
        if (!cancelled) setMatches(list);
      })
      .catch(() => {
        if (!cancelled) setMatches([]);
      })
      .finally(() => {
        if (!cancelled) {
          clearTimeout(maxWait);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
      clearTimeout(maxWait);
    };
  }, [limit]);

  return { matches, loading };
}

function investorLabel(m: RecentMatch) {
  if (m.investor_firm && m.investor_firm !== m.investor_name && m.investor_firm !== "-") {
    return `${m.investor_name} · ${m.investor_firm}`;
  }
  return m.investor_name;
}

const cardStyle = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  padding: "0.85rem 1rem",
} as const;

/** Visible card when live data is still loading or unavailable */
export function LatestMatchPlaceholder() {
  return (
    <Link
      href="/matches"
      className="block rounded-xl transition-all group"
      style={cardStyle}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className="text-[10px] font-mono font-semibold tracking-widest uppercase flex items-center gap-1.5"
          style={{ color: G }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: G }} />
          Live match network
        </span>
      </div>
      <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
        Startup-investor pairings ranked by thesis fit, timing, and GOD score.
      </p>
      <p
        className="text-[10px] font-mono mt-2 flex items-center gap-1 group-hover:opacity-100 transition-opacity"
        style={{ color: G }}
      >
        View live matches <ArrowRight size={11} />
      </p>
    </Link>
  );
}

/** Compact link card for hero — latest match only */
export function LatestMatchSnippet({ match }: { match: RecentMatch }) {
  return (
    <Link
      href={`/matches?highlight=${encodeURIComponent(match.match_id)}`}
      className="block rounded-xl transition-all group"
      style={cardStyle}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className="text-[10px] font-mono font-semibold tracking-widest uppercase flex items-center gap-1.5"
          style={{ color: G }}
        >
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: G }} />
          Latest match
        </span>
        <span className="text-[10px] font-mono" style={{ color: DIM }}>
          {match.time_ago}
        </span>
      </div>
      <p className="text-sm font-semibold leading-snug mb-0.5 group-hover:underline" style={{ color: TEXT }}>
        {match.startup_name}
        <span style={{ color: MUTED, fontWeight: 500 }}> → </span>
        {investorLabel(match)}
      </p>
      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="text-[10px] font-mono" style={{ color: DIM }}>
          {match.startup_god_score != null ? `GOD ${match.startup_god_score}` : "Thesis aligned"}
        </span>
        <span
          className="text-xs font-mono font-bold px-2 py-0.5 rounded"
          style={{ color: AMBER, background: "oklch(0.769 0.188 70.08 / 0.12)", border: `1px solid oklch(0.769 0.188 70.08 / 0.25)` }}
        >
          {match.match_score}
        </span>
      </div>
      <p
        className="text-[10px] font-mono mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: G }}
      >
        View on matches <ArrowRight size={11} />
      </p>
    </Link>
  );
}

/** Hero panel — always renders a card below the CTA */
export function LatestMatchPanel({
  match,
  loading,
}: {
  match: RecentMatch | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div
        className="rounded-xl animate-pulse"
        style={{ ...cardStyle, height: "5.75rem" }}
      />
    );
  }
  if (match) return <LatestMatchSnippet match={match} />;
  return <LatestMatchPlaceholder />;
}

/** Full feed for /matches — highlight param pinned to top */
export function RecentMatchesList({
  highlightId,
  limit = 8,
}: {
  highlightId?: string | null;
  limit?: number;
}) {
  const { matches, loading } = useRecentMatches(limit);
  const highlightRef = useRef<HTMLDivElement>(null);

  const ordered = (() => {
    if (!highlightId || matches.length === 0) return matches;
    const idx = matches.findIndex((m) => m.match_id === highlightId);
    if (idx <= 0) return matches;
    return [matches[idx], ...matches.slice(0, idx), ...matches.slice(idx + 1)];
  })();

  useEffect(() => {
    if (!highlightId || loading) return;
    const t = setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
    return () => clearTimeout(t);
  }, [highlightId, loading, ordered.length]);

  if (loading) {
    return (
      <p className="text-sm font-mono py-6" style={{ color: DIM }}>
        Loading latest matches…
      </p>
    );
  }

  if (ordered.length === 0) {
    return (
      <p className="text-sm py-6" style={{ color: MUTED }}>
        Live matches will appear here as the network pairs startups with investors.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {ordered.map((m) => {
        const isHighlight = highlightId === m.match_id;
        return (
          <div
            key={m.match_id}
            ref={isHighlight ? highlightRef : undefined}
            className="rounded-xl transition-all"
            style={{
              background: isHighlight ? "oklch(0.696 0.17 162.48 / 0.06)" : CARD,
              border: isHighlight ? `1px solid ${G_BORDER}` : `1px solid ${BORDER}`,
              boxShadow: isHighlight ? "0 0 32px oklch(0.696 0.17 162.48 / 0.12)" : undefined,
              padding: "1rem 1.15rem",
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <CircleDot size={12} style={{ color: isHighlight ? G : MUTED }} />
                  <span className="text-sm font-semibold text-white truncate">{m.startup_name}</span>
                  {isHighlight && (
                    <span
                      className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded"
                      style={{ color: G, border: `1px solid ${G_BORDER}`, background: "oklch(0.696 0.17 162.48 / 0.1)" }}
                    >
                      highlighted
                    </span>
                  )}
                </div>
                <p className="text-xs truncate" style={{ color: MUTED }}>
                  Matched with {investorLabel(m)}
                </p>
                <p className="text-[10px] font-mono mt-1" style={{ color: DIM }}>
                  {m.time_ago}
                  {m.startup_god_score != null ? ` · GOD ${m.startup_god_score}` : ""}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-lg font-bold font-mono" style={{ color: isHighlight ? G : AMBER }}>
                  {m.match_score}
                </div>
                <div className="text-[10px] font-mono" style={{ color: DIM }}>
                  match
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
