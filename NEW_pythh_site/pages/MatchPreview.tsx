/**
 * /matches/preview/:startupId — public shareable match preview (production site).
 */

import { useEffect, useState } from 'react';
import { Link, useRoute, useLocation } from 'wouter';
import { Helmet } from 'react-helmet-async';
import { fetchPreviewReport, fetchTimeoutSignal } from '@/lib/apiConfig';
import { recordMatchViewOnce, trackFunnelEvent } from '@/lib/matchEngagement';
import { formatInvestorDisplayLabel } from '@/lib/formatInvestorDisplay';
import { trackFounderGateStarted, type GatedInvestorContext } from '@/lib/founderSignupGate';

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
  const [, navigate] = useLocation();
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
  const visible = matches.slice(0, 10);
  const hidden = Math.max(0, total_matches - visible.length);
  const startupUrl = startup.website || '';

  const handleGate = async (
    action: 'save' | 'intro' | 'export',
    investor?: GatedInvestorContext | null,
  ) => {
    if (startupUrl) sessionStorage.setItem('pythia_url', startupUrl);
    await trackFounderGateStarted(action, { url: startupUrl, startupId: startup.id, investor });
    navigate('/activate');
  };

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
          <button
            type="button"
            onClick={() => void handleGate('intro')}
            className="px-4 py-1.5 rounded-lg bg-emerald-500 text-black text-sm font-semibold"
          >
            Request intro
          </button>
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

        <div className="space-y-3 pb-24">
          {visible.map((m, i) => {
            const investor: GatedInvestorContext = {
              id: m.investor.id,
              name: m.investor.name,
              firm: m.investor.firm,
            };
            return (
            <div
              key={m.investor.id}
              className={`p-4 rounded-xl border flex justify-between gap-4 items-center ${
                i === 0 ? 'border-emerald-500/40 bg-emerald-500/5' : 'border-zinc-800 bg-zinc-900/50'
              }`}
            >
              <div className="min-w-0">
                <span className="text-xs text-zinc-500 mr-2">#{i + 1}</span>
                <span className="font-medium">
                  {formatInvestorDisplayLabel(m.investor.name, m.investor.firm)}
                </span>
                {m.why_you_match && (
                  <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{m.why_you_match}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-sm font-mono ${scoreColor(m.match_score)}`}>
                  {Math.round(m.match_score)}%
                </span>
                <button
                  type="button"
                  onClick={() => void handleGate('intro', investor)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-semibold whitespace-nowrap"
                >
                  Intro
                </button>
              </div>
            </div>
            );
          })}
        </div>

        {hidden > 0 && (
          <div className="text-center p-6 rounded-xl border border-dashed border-zinc-700 space-y-3">
            <p className="text-zinc-400 text-sm">+{hidden.toLocaleString()} more investors in your ranked list</p>
            <div className="flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => void handleGate('intro')}
                className="px-5 py-2 rounded-lg bg-emerald-500 text-black text-sm font-semibold"
              >
                Request intro
              </button>
              <button
                type="button"
                onClick={() => void handleGate('export')}
                className="px-5 py-2 rounded-lg border border-zinc-600 text-zinc-300 text-sm"
              >
                Export list
              </button>
            </div>
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

      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md px-4 py-3">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-zinc-400">
            {total_matches.toLocaleString()} matches · free account to request intros
          </p>
          <button
            type="button"
            onClick={() => void handleGate('intro', visible[0] ? {
              id: visible[0].investor.id,
              name: visible[0].investor.name,
              firm: visible[0].investor.firm,
            } : null)}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-emerald-500 text-black text-sm font-semibold"
          >
            Request intro to top match
          </button>
        </div>
      </div>
    </div>
  );
}
