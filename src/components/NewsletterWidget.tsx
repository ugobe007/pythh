// NewsletterWidget — compact digest teaser for the front page
// Shows top match + top startup + hottest sector, links to /newsletter

import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3002' : '');

interface DigestPreview {
  hotMatch: {
    match_score: number;
    startup:  { name: string; sectors: string[] } | null;
    investor: { name: string; firm_name: string } | null;
  } | null;
  topStartup: { name: string; total_god_score: number; sectors: string[] } | null;
  hotSector:  { sector: string; count: number; avg_score: number } | null;
  date: string;
}

export default function NewsletterWidget() {
  const [preview, setPreview] = useState<DigestPreview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/newsletter/today`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        setPreview({
          hotMatch:   d.hotMatches?.[0]   ?? null,
          topStartup: d.leaderboard?.[0]  ?? null,
          hotSector:  d.sectorTrends?.[0] ?? null,
          date:       d.date,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Don't render if nothing interesting to show
  if (!loading && !preview) return null;

  const formattedDate = preview?.date
    ? new Date(preview.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-900/30 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/40">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-white text-sm font-medium">The Daily Signal</span>
            {formattedDate && (
              <span className="text-zinc-600 text-xs">— {formattedDate}</span>
            )}
          </div>
          <Link
            to="/newsletter"
            className="text-xs text-cyan-400 hover:text-cyan-300 transition"
          >
            Read full digest →
          </Link>
        </div>

        {/* Content */}
        {loading ? (
          <div className="px-5 py-5 flex items-center gap-2 text-zinc-600 text-sm">
            <div className="w-3.5 h-3.5 border border-zinc-600 border-t-transparent rounded-full animate-spin" />
            Loading signals…
          </div>
        ) : (
          <div className="grid sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800/40">

            {/* Hot match */}
            {preview?.hotMatch && (
              <div className="px-5 py-4">
                <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-2">🔥 Hot Match</p>
                <p className="text-white text-sm font-medium truncate">
                  {preview.hotMatch.startup?.name}
                  <span className="text-zinc-600 mx-1.5">×</span>
                  <span className="text-cyan-400">{preview.hotMatch.investor?.firm_name || preview.hotMatch.investor?.name}</span>
                </p>
                <p className="text-emerald-400 font-mono text-xs mt-1">
                  {preview.hotMatch.match_score}% match signal
                </p>
              </div>
            )}

            {/* Top startup */}
            {preview?.topStartup && (
              <div className="px-5 py-4">
                <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-2">⚡ #1 This Week</p>
                <p className="text-white text-sm font-medium truncate">{preview.topStartup.name}</p>
                <p className="text-cyan-400 font-mono text-xs mt-1">
                  GOD {preview.topStartup.total_god_score}
                  {(preview.topStartup.sectors || [])[0] && (
                    <span className="text-zinc-600 ml-2">{preview.topStartup.sectors[0]}</span>
                  )}
                </p>
              </div>
            )}

            {/* Hot sector */}
            {preview?.hotSector && (
              <div className="px-5 py-4">
                <p className="text-zinc-600 text-[10px] uppercase tracking-widest mb-2">📈 Hottest Sector</p>
                <p className="text-white text-sm font-medium">{preview.hotSector.sector}</p>
                <p className="text-zinc-500 text-xs mt-1">
                  {preview.hotSector.count} startups · avg score {preview.hotSector.avg_score}
                </p>
              </div>
            )}

          </div>
        )}
      </div>
    </section>
  );
}
