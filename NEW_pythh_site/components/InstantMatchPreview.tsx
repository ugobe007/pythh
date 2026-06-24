/**
 * Public instant match preview — ?url= on /matches (founder_hero_entry matches_preview variant).
 * Value-first: full shortlist reveal, signup gate on save / intro / export only.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Loader2, ArrowRight, Download, Bookmark, Send } from 'lucide-react';
import { apiUrl } from '@/lib/apiConfig';
import { fetchGrowthAssignment, type GrowthAssignment } from '@/lib/growthExperiment';
import { recordMatchViewOnce, trackFunnelEvent, trackFunnelEventOnce, recordMatchEngagement } from '@/lib/matchEngagement';
import { formatInvestorDisplayLabel } from '@/lib/formatInvestorDisplay';
import { trackFounderGateStarted, type FounderGatedAction, type GatedInvestorContext } from '@/lib/founderSignupGate';
import PreviewEmailCapture from '@/components/PreviewEmailCapture';

const PREVIEW_LIMIT = 10;

type PreviewMatch = {
  investor_id?: string;
  match_score?: number;
  why_you_match?: string;
  investor?: {
    id?: string;
    name?: string;
    firm?: string | null;
    sectors?: string[] | null;
  };
};

type PreviewPayload = {
  startup?: { id?: string; name?: string; god_score?: number };
  total_matches?: number;
  matches?: PreviewMatch[];
};

interface Props {
  url: string;
}

export default function InstantMatchPreview({ url }: Props) {
  const [, navigate] = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const founderExpRef = useRef<GrowthAssignment | null>(null);
  const gateCtaRef = useRef<GrowthAssignment | null>(null);
  const [gateCopy, setGateCopy] = useState({
    save: 'Save shortlist',
    intro: 'Request intro',
    export: 'Export list',
    footer: 'Create a free account to save, request intros, or export — your shortlist stays unlocked.',
  });

  useEffect(() => {
    fetchGrowthAssignment('founder', 'founder_hero_entry')
      .then((a) => {
        founderExpRef.current = a;
      })
      .catch(() => {});
    fetchGrowthAssignment('founder', 'founder_preview_gate_cta')
      .then((a) => {
        if (!a) return;
        gateCtaRef.current = a;
        const c = a.copy as { save?: string; intro?: string; export?: string; footer?: string };
        setGateCopy({
          save: c.save || gateCopy.save,
          intro: c.intro || gateCopy.intro,
          export: c.export || gateCopy.export,
          footer: c.footer || gateCopy.footer,
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const assignment = await fetchGrowthAssignment('founder', 'founder_hero_entry');
        if (assignment) founderExpRef.current = assignment;

        const submitRes = await fetch(apiUrl('/api/instant/submit'), {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const submitJson = await submitRes.json().catch(() => ({}));
        if (!submitRes.ok && submitRes.status !== 202) {
          throw new Error(submitJson.message || submitJson.error || 'Could not analyze startup URL');
        }

        let startupId = submitJson.startup_id || submitJson.id;
        if (!startupId && submitJson.status === 'queued') {
          for (let i = 0; i < 8 && !cancelled; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const retry = await fetch(apiUrl('/api/instant/submit'), {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url }),
            });
            const retryJson = await retry.json().catch(() => ({}));
            startupId = retryJson.startup_id || retryJson.id;
            if (startupId) break;
          }
        }
        if (!startupId) throw new Error('Still analyzing — try again in a moment');

        const previewRes = await fetch(apiUrl(`/api/preview/${startupId}`));
        if (!previewRes.ok) throw new Error('Match preview not ready yet');
        const data = (await previewRes.json()) as PreviewPayload;
        if (cancelled) return;

        setPreview(data);
        trackFunnelEvent('instant_matches_viewed', {
          startup_id: startupId,
          url,
          match_count: data.matches?.length ?? 0,
        });

        for (const m of (data.matches || []).slice(0, PREVIEW_LIMIT)) {
          const invId = m.investor_id || m.investor?.id;
          if (invId) recordMatchViewOnce(startupId, invId, 'instant_match_preview');
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Preview failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const handlePricingFromPreview = () => {
    void trackFunnelEventOnce('pythh_preview_pricing_click', 'pricing_viewed', {
      path: '/pricing',
      source: 'preview_sticky',
      startup_id: preview?.startup?.id,
    });
  };

  const handleGate = async (action: FounderGatedAction, investor?: GatedInvestorContext | null) => {
    if (!preview?.startup?.id) return;
    if (action === 'intro' && investor?.id) {
      void recordMatchEngagement(preview.startup.id, investor.id, 'intro', 'instant_preview_gate');
    }
    await trackFounderGateStarted(
      action,
      { url, startupId: preview.startup.id, investor },
      founderExpRef.current,
      gateCtaRef.current,
    );
    navigate('/activate');
  };

  const investorFromMatch = (m: PreviewMatch): GatedInvestorContext | null => {
    const id = m.investor_id || m.investor?.id;
    const name = m.investor?.name;
    if (!id || !name) return null;
    return { id, name, firm: m.investor?.firm };
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center gap-4 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-lg text-white font-medium">Finding your investor matches…</p>
        <p className="text-sm text-zinc-500">Usually 20–60 seconds</p>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="py-12 px-4 rounded-xl border border-red-500/30 bg-red-500/5 text-center max-w-lg mx-auto">
        <p className="text-red-300 text-sm mb-4">{error || 'Preview unavailable'}</p>
        <button
          type="button"
          onClick={() => navigate('/activate')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm"
        >
          Continue to full analysis <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const matches = preview.matches || [];
  const visible = matches.slice(0, PREVIEW_LIMIT);
  const total = preview.total_matches ?? matches.length;
  const startupName = preview.startup?.name || 'Your startup';

  return (
    <div className="mb-16 pb-28">
      <div className="mb-8 text-center">
        <p className="text-[11px] uppercase tracking-[2px] text-emerald-400 mb-3">Instant preview</p>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          {startupName} — your investor shortlist
        </h1>
        <p className="text-sm text-zinc-400">
          {total.toLocaleString()} matches in network · showing top {visible.length} — free, no account required
        </p>
      </div>

      <div className="space-y-3 mb-8">
        {visible.map((m, i) => {
          const inv = m.investor;
          const gatedInvestor = investorFromMatch(m);
          return (
            <div
              key={inv?.id || i}
              className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-3 ${
                i === 0
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-zinc-800 bg-zinc-900/40'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono text-zinc-500">#{i + 1}</span>
                  {i === 0 && (
                    <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                      Top match
                    </span>
                  )}
                  <span className="text-white font-medium truncate">
                    {formatInvestorDisplayLabel(inv?.name, inv?.firm)}
                  </span>
                </div>
                {m.why_you_match && (
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{m.why_you_match}</p>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {typeof m.match_score === 'number' && (
                  <span className="text-sm font-mono text-cyan-400">{Math.round(m.match_score)}% fit</span>
                )}
                {gatedInvestor && (
                  <button
                    type="button"
                    onClick={() => void handleGate('intro', gatedInvestor)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {i === 0 ? gateCopy.intro : 'Intro'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {total > visible.length && (
        <p className="text-center text-xs text-zinc-500 mb-6">
          +{(total - visible.length).toLocaleString()} more ranked investors in your full list after signup
        </p>
      )}

      {preview.startup?.id && (
        <PreviewEmailCapture
          startupId={preview.startup.id}
          startupUrl={url}
          startupName={startupName}
          totalMatches={total}
          topInvestors={visible.map((m) => ({
            name: m.investor?.name || 'Investor',
            firm: m.investor?.firm,
          }))}
          source="instant_match_preview"
        />
      )}

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 justify-center mb-4">
        <button
          type="button"
          onClick={() => void handleGate('intro', investorFromMatch(visible[0] ?? {}))}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm shadow-lg shadow-emerald-900/30"
        >
          <Send className="w-4 h-4" />
          {gateCopy.intro}
        </button>
        <button
          type="button"
          onClick={() => void handleGate('save')}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-sm border border-zinc-600"
        >
          <Bookmark className="w-4 h-4" />
          {gateCopy.save}
        </button>
        <button
          type="button"
          onClick={() => void handleGate('export')}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-500"
        >
          <Download className="w-4 h-4" />
          {gateCopy.export}
        </button>
      </div>

      <p className="text-center text-xs text-zinc-500 mb-6">
        {gateCopy.footer}
      </p>

      {preview.startup?.id && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => navigate(`/matches/preview/${preview.startup!.id}`)}
            className="text-xs text-zinc-500 hover:text-zinc-300 underline-offset-2 hover:underline"
          >
            Share preview link
          </button>
        </div>
      )}

      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-md px-4 py-3">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-zinc-400 text-center sm:text-left">
            {total.toLocaleString()} ranked investors ·{' '}
            <Link href="/pricing" onClick={handlePricingFromPreview} className="text-amber-400/90 hover:text-amber-300 underline-offset-2 hover:underline">
              Automate outreach with Oracle
            </Link>
          </p>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => void handleGate('intro', investorFromMatch(visible[0] ?? {}))}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold"
            >
              <Send className="w-4 h-4" />
              {gateCopy.intro}
            </button>
            <button
              type="button"
              onClick={() => void handleGate('save')}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-zinc-600 text-zinc-200 text-sm font-medium hover:border-zinc-400"
            >
              <Bookmark className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
