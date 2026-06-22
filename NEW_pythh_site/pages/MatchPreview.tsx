/**
 * /matches/preview/:startupId — public shareable match preview (production site).
 */

import { useEffect, useState } from 'react';
import { Link, useRoute } from 'wouter';
import { Helmet } from 'react-helmet-async';
import { fetchPreviewReport, fetchTimeoutSignal } from '@/lib/apiConfig';
import { recordMatchViewOnce, trackFunnelEvent } from '@/lib/matchEngagement';

interface Investor {
  id: string;
  name: string;
  firm?: string | null;
  sectors?: string[] | string;
}

interface Match {
  match_score: number;
  why_you_match?: string;
  investor: Investor;
}

interface PreviewData {
  startup: {
    id: string;
    name: string;
    tagline?: string;
    website?: string;
    god_score?: number;
    percentile?: number;
  };
  total_matches: number;
  matches: Match[];
}

function scoreColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 55) return 'text-cyan-400';
  return 'text-zinc-400';
}

export default function MatchPreview() {
  const [, params] = useRoute('/matches/preview/:startupId');
  const startupId = params?.startupId;
  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!startupId) return;
    fetchPreviewReport(startupId, { signal: fetchTimeoutSignal(60_000) })
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'not_found' : 'error');
        return r.json();
      })
      .then((d: PreviewData) => {
        setData(d);
        trackFunnelEvent('instant_matches_viewed', { startup_id: startupId, source: 'share_preview' });
        for (const m of (d.matches || []).slice(0, 5)) {
          if (m.investor?.id) recordMatchViewOnce(startupId, m.investor.id, 'share_preview');
        }
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [startupId]);

  const previewUrl =
    typeof window !== 'undefined' && startupId
      ? `${window.location.origin}/matches/preview/${startupId}`
      : '';

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-xl text-white mb-4">
            {error === 'not_found' ? 'Startup not found' : 'Could not load preview'}
          </h1>
          <Link href="/activate">
            <a className="text-emerald-400 text-sm">Analyze your startup →</a>
          </Link>
        </div>
      </div>
    );
  }

  const { startup, total_matches, matches } = data;
  const visible = matches.slice(0, 5);
  const hidden = Math.max(0, total_matches - visible.length);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Helmet>
        <title>{startup.name} — investor matches — Pythh.ai</title>
      </Helmet>

      <nav className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <a className="text-lg font-bold">pythh</a>
          </Link>
          <Link href={`/activate?ref=preview&startup=${startupId}`}>
            <a className="px-4 py-1.5 rounded-lg bg-emerald-500 text-black text-sm font-semibold">
              Claim matches
            </a>
          </Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-4 py-10 space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold">{startup.name}</h1>
          {startup.tagline && <p className="text-zinc-400 text-sm">{startup.tagline}</p>}
          <div className="inline-flex gap-6 bg-zinc-900 border border-zinc-700 rounded-xl px-6 py-3 text-sm">
            {typeof startup.god_score === 'number' && (
              <span>
                GOD <strong className={scoreColor(startup.god_score)}>{startup.god_score}</strong>
              </span>
            )}
            <span>
              <strong className="text-emerald-400">{total_matches.toLocaleString()}</strong> matches
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {visible.map((m, i) => (
            <div
              key={m.investor.id}
              className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 flex justify-between gap-4"
            >
              <div>
                <span className="text-xs text-zinc-500 mr-2">#{i + 1}</span>
                <span className="font-medium">
                  {m.investor.name}
                  {m.investor.firm ? ` · ${m.investor.firm}` : ''}
                </span>
                {m.why_you_match && (
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{m.why_you_match}</p>
                )}
              </div>
              <span className={`text-sm font-mono shrink-0 ${scoreColor(m.match_score)}`}>
                {Math.round(m.match_score)}%
              </span>
            </div>
          ))}
        </div>

        {hidden > 0 && (
          <div className="text-center p-6 rounded-xl border border-dashed border-zinc-700">
            <p className="text-zinc-400 text-sm mb-3">+{hidden.toLocaleString()} more investors</p>
            <Link href={`/activate?ref=preview&startup=${startupId}`}>
              <a className="inline-block px-5 py-2 rounded-lg bg-emerald-500 text-black text-sm font-semibold">
                Unlock all matches
              </a>
            </Link>
          </div>
        )}

        {previewUrl && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => navigator.clipboard.writeText(previewUrl)}
              className="text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 px-3 py-1.5 rounded-md"
            >
              Copy share link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
