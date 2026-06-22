/**
 * Public instant match preview — ?url= on /matches (founder_hero_entry matches_preview variant).
 */

import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { Loader2, ArrowRight, Lock } from 'lucide-react';
import { apiUrl } from '@/lib/apiConfig';
import { fetchGrowthAssignment, trackGrowthEvent, type GrowthAssignment } from '@/lib/growthExperiment';
import { recordMatchViewOnce, trackFunnelEvent, recordMatchEngagement } from '@/lib/matchEngagement';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const founderExpRef = useRef<GrowthAssignment | null>(null);

  useEffect(() => {
    fetchGrowthAssignment('founder')
      .then((a) => {
        founderExpRef.current = a;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
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
        if (founderExpRef.current) {
          void trackGrowthEvent(founderExpRef.current, 'instant_matches_viewed', {
            startup_id: startupId,
            url,
          });
        }

        for (const m of (data.matches || []).slice(0, 3)) {
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
        <Link href="/activate">
          <a className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm">
            Continue to full analysis <ArrowRight className="w-4 h-4" />
          </a>
        </Link>
      </div>
    );
  }

  const matches = preview.matches || [];
  const visible = matches.slice(0, 3);
  const hidden = Math.max(0, (preview.total_matches ?? matches.length) - visible.length);
  const startupName = preview.startup?.name || 'Your startup';

  return (
    <div className="mb-16">
      <div className="mb-8 text-center">
        <p className="text-[11px] uppercase tracking-[2px] text-emerald-400 mb-3">Instant preview</p>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          {startupName} — top investor matches
        </h1>
        <p className="text-sm text-zinc-400">
          {preview.total_matches?.toLocaleString() ?? matches.length} matches found · create a free account to save intros
        </p>
      </div>

      <div className="space-y-3 mb-8">
        {visible.map((m, i) => {
          const inv = m.investor;
          return (
            <div
              key={inv?.id || i}
              className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-zinc-500">#{i + 1}</span>
                  <span className="text-white font-medium truncate">
                    {inv?.name || 'Investor'}
                    {inv?.firm ? ` · ${inv.firm}` : ''}
                  </span>
                </div>
                {m.why_you_match && (
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{m.why_you_match}</p>
                )}
              </div>
              {typeof m.match_score === 'number' && (
                <span className="text-sm font-mono text-cyan-400 shrink-0">{Math.round(m.match_score)}% fit</span>
              )}
            </div>
          );
        })}

        {hidden > 0 && (
          <div className="p-4 rounded-xl border border-dashed border-zinc-700 flex items-center justify-center gap-2 text-zinc-500 text-sm">
            <Lock className="w-4 h-4" />
            +{hidden.toLocaleString()} more matches — sign up to unlock
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link href="/activate">
          <a
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm"
            onClick={() => {
              trackFunnelEvent('url_submitted', { url, source: 'instant_preview_cta' });
              const top = visible[0];
              const invId = top?.investor_id || top?.investor?.id;
              if (preview.startup?.id && invId) {
                void recordMatchEngagement(preview.startup.id, invId, 'intro', 'instant_preview_cta');
              }
              if (founderExpRef.current) {
                void trackGrowthEvent(founderExpRef.current, 'founder_signup_started', { url });
              }
            }}
          >
            Save matches &amp; get intros <ArrowRight className="w-4 h-4" />
          </a>
        </Link>
        <Link href={`/matches/preview/${preview.startup?.id}`}>
          <a className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-zinc-700 text-zinc-300 text-sm hover:border-zinc-500">
            Share preview link
          </a>
        </Link>
      </div>
    </div>
  );
}
