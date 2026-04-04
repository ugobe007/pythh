/**
 * LiveTeaser — Compact "Live" block showing recent matches with link to full feed
 * Conveys movement and activity; links to /hot-matches for the full waterfall.
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "../lib/apiConfig";
import { HotMatchLogo } from "./FlameIcon";

interface HotMatch {
  startup_name: string;
  investor_name: string;
  match_score: number;
  created_at: string;
}

function formatTimeAgo(ts: string) {
  const diffMins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  const diffHours = Math.floor(diffMins / 60);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function LiveTeaser() {
  const [matches, setMatches] = useState<HotMatch[]>([]);
  const [totalThisWeek, setTotalThisWeek] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/hot-matches?limit_count=10`);
        if (!res.ok) throw new Error("fetch failed");
        const json = await res.json();
        if (cancelled) return;
        setMatches(json.matches || []);
        setTotalThisWeek(json.totalThisWeek ?? null);
      } catch {
        if (!cancelled) setMatches([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const preview = matches.slice(0, 3);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs">
          <HotMatchLogo size="xs" className="flex-shrink-0 opacity-90" aria-hidden />
          <span className="uppercase tracking-widest font-semibold text-white/40">Live</span>
        </div>
        <div className="space-y-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-9 bg-white/[0.04] rounded-lg animate-pulse" />
          ))}
        </div>
        <Link
          to="/hot-matches"
          className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          View all →
        </Link>
      </div>
    );
  }

  if (preview.length === 0) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs">
          <HotMatchLogo size="xs" className="flex-shrink-0 opacity-90" aria-hidden />
          <span className="uppercase tracking-widest font-semibold text-white/40">Live</span>
        </div>
        <p className="text-xs text-zinc-500 italic">Match engine warming up…</p>
        <Link
          to="/hot-matches"
          className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          View Hot Matches →
        </Link>
      </div>
    );
  }

  return (
    <Link
      to="/hot-matches"
      className="block space-y-2 group"
    >
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs">
          <span className="w-1.5 h-1.5 rounded-full border border-emerald-500/80 bg-transparent" />
          <HotMatchLogo size="xs" className="flex-shrink-0 opacity-90" aria-hidden />
          <span className="uppercase tracking-widest font-semibold text-white/40 group-hover:text-white/60 transition-colors">
            Live
          </span>
        </div>
        {totalThisWeek != null && (
          <span className="text-[10px] text-white/25 tabular-nums">
            {totalThisWeek.toLocaleString()} this week
          </span>
        )}
      </div>
      <div className="space-y-1">
        {preview.map((m, i) => (
          <div
            key={`${m.startup_name}-${m.investor_name}-${i}`}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-transparent group-hover:border-zinc-600/35 transition-all"
          >
            <span className="text-[10px] font-mono font-bold text-orange-400/90">
              {Math.round(m.match_score)}
            </span>
            <span className="text-[11px] text-white/80 truncate flex-1">
              {m.startup_name}
            </span>
            <span className="text-white/20 text-[9px]">→</span>
            <span className="text-[11px] text-white/50 truncate max-w-[80px]">
              {m.investor_name}
            </span>
            <span className="text-[9px] text-white/20 tabular-nums flex-shrink-0">
              {formatTimeAgo(m.created_at)}
            </span>
          </div>
        ))}
      </div>
      <span className="inline-flex items-center gap-1 text-xs text-cyan-400 group-hover:text-cyan-300 transition-colors">
        View all Hot Matches
        <span className="group-hover:translate-x-0.5 transition-transform">→</span>
      </span>
    </Link>
  );
}
