/**
 * Public instant match preview — ?url= on /matches (founder_hero_entry matches_preview variant).
 * Value-first: full shortlist reveal, signup gate on save / intro / export only.
 */

import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { apiUrl } from '@/lib/apiConfig';
import { fetchGrowthAssignment, type GrowthAssignment } from '@/lib/growthExperiment';
import { markFirstPreviewSeen } from '@/lib/funnelAttribution';
import { recordMatchViewOnce, trackFunnelEventOnce } from '@/lib/matchEngagement';
import { formatInvestorDisplayLabel } from '@/lib/formatInvestorDisplay';
import {
  postSignupPathForAction,
  trackFounderGateStarted,
  completePreviewGateIfPending,
  peekFounderGatePending,
  type FounderGatedAction,
  type GatedInvestorContext,
} from '@/lib/founderSignupGate';
import { persistFounderStartup } from '@/lib/founderAccount';
import MatchExplainBlock from '@/components/MatchExplainBlock';
import { normalizeWhyYouMatch } from '@/lib/normalizeWhyYouMatch';
import { recordAnonymousPreview } from '@/lib/anonymousPreviewSession';
import { pinActiveStartup } from '@/lib/activeStartupContext';
import { founderSignupPath } from '@/lib/safeUrl';
import ImproveMatchesPanel from '@/components/ImproveMatchesPanel';
import InlineMeta from '@/components/design/InlineMeta';
import { G, AMBER, DIM, MUTED, TEXT } from '@/lib/designTokens';

const PREVIEW_LIMIT = 5;

type InvestorMix = 'balanced' | 'vc' | 'angel';

type PreviewMatch = {
  investor_id?: string;
  match_score?: number;
  why_you_match?: string | null;
  fitness_score?: number;
  fitness_confidence?: 'high' | 'medium' | 'building';
  fitness_factors?: string[];
  fitness_components?: {
    alignment?: number;
    lifecycle?: number;
    reachability?: number;
    profile?: number;
    behavior?: number | null;
  };
  investor_class?: 'angel' | 'vc';
  funding_lifecycle_fit?: {
    eligible?: boolean;
    level?: 'exact' | 'compatible' | 'inferred' | 'unknown';
    startupStage?: string | null;
    investorStages?: string[];
  } | null;
  investor?: {
    id?: string;
    name?: string;
    firm?: string | null;
    sectors?: string[] | null;
    stage?: string | string[] | null;
    check_size_min?: number | null;
    check_size_max?: number | null;
    investor_tier?: string | null;
  };
};

function formatCheckSize(value?: number | null): string | null {
  if (value == null || !Number.isFinite(Number(value))) return null;
  const amount = Number(value);
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 1 })}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000).toLocaleString()}K`;
  return `$${amount.toLocaleString()}`;
}

type ShortlistMix = {
  mode?: string;
  vc_count?: number;
  angel_count?: number;
  funding_stage?: string | null;
  lifecycle_filtered?: boolean;
};

type PreviewPayload = {
  startup?: {
    id?: string;
    name?: string;
    god_score?: number;
    sectors?: string[] | null;
    stage?: string | null;
    state?: string | null;
  };
  total_matches?: number;
  matches?: PreviewMatch[];
  shortlist_mix?: ShortlistMix | null;
};

function investorStageLabel(match: PreviewMatch): string | null {
  const investor = match.investor;
  const stage = Array.isArray(investor?.stage)
    ? investor.stage.filter(Boolean).join(', ')
    : String(investor?.stage || '');
  return stage.trim() || null;
}

function investorCheckLabel(match: PreviewMatch): string | null {
  const investor = match.investor;
  const min = formatCheckSize(investor?.check_size_min);
  const max = formatCheckSize(investor?.check_size_max);
  if (min && max) return `${min}–${max}`;
  return min || max || null;
}

interface Props {
  url: string;
}

export default function InstantMatchPreview({ url }: Props) {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [shortlistSaved, setShortlistSaved] = useState(false);
  const [improveMatchesOpen, setImproveMatchesOpen] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('improve') === '1',
  );
  const refreshed =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('refreshed') === '1';
  const [startupId, setStartupId] = useState<string | null>(null);
  const [investorMix] = useState<InvestorMix>('balanced');
  const founderExpRef = useRef<GrowthAssignment | null>(null);
  const gateCtaRef = useRef<GrowthAssignment | null>(null);
  const gateCompletedRef = useRef(false);

  useEffect(() => {
    fetchGrowthAssignment('founder', 'founder_hero_entry')
      .then((a) => {
        founderExpRef.current = a;
      })
      .catch(() => {});
    fetchGrowthAssignment('founder', 'founder_preview_gate_cta')
      .then((a) => {
        if (a) gateCtaRef.current = a;
      })
      .catch(() => {});
  }, []);

  const persistShortlist = async (id: string, name?: string | null) => {
    await persistFounderStartup({ startupId: id, companyUrl: url, companyName: name });
    if (peekFounderGatePending().pending) {
      await completePreviewGateIfPending({
        url,
        startupId: id,
        email: user?.email,
      });
    }
    setShortlistSaved(true);
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated || !preview?.startup?.id || gateCompletedRef.current) return;
    gateCompletedRef.current = true;
    void persistShortlist(preview.startup.id, preview.startup.name);
  }, [authLoading, isAuthenticated, preview?.startup?.id, preview?.startup?.name, url, user?.email]);

  useEffect(() => {
    let cancelled = false;
    setStartupId(null);
    setPreview(null);
    setShortlistSaved(false);
    gateCompletedRef.current = false;

    async function submitUrl() {
      setLoading(true);
      setError(null);
      try {
        const submitRes = await fetch(apiUrl('/api/instant/submit'), {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, source: 'matches_preview' }),
        });
        const submitJson = await submitRes.json().catch(() => ({}));
        if (!submitRes.ok && submitRes.status !== 202) {
          throw new Error(submitJson.message || submitJson.error || 'Could not analyze startup URL');
        }

        let id = submitJson.startup_id || submitJson.id;
        if (!id && submitJson.status === 'queued') {
          for (let i = 0; i < 30 && !cancelled; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const retry = await fetch(apiUrl('/api/instant/submit'), {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url, source: 'matches_preview' }),
            });
            const retryJson = await retry.json().catch(() => ({}));
            if (!retry.ok && retry.status !== 202) {
              throw new Error(retryJson.message || retryJson.error || 'Could not analyze startup URL');
            }
            id = retryJson.startup_id || retryJson.id;
            if (id) break;
          }
        }
        if (!id) throw new Error('Still analyzing — try again in a moment');
        if (!cancelled) setStartupId(id);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Preview failed');
          setLoading(false);
        }
      }
    }

    void submitUrl();
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (!startupId) return;
    let cancelled = false;

    async function loadPreview() {
      const isMixRefetch = preview != null;
      if (!isMixRefetch) setLoading(true);

      try {
        const assignment = await fetchGrowthAssignment('founder', 'founder_hero_entry');
        if (assignment) founderExpRef.current = assignment;

        const previewRes = await fetch(
          apiUrl(`/api/preview/${startupId}?source=matches_preview&investor_class=${investorMix}`),
        );
        if (!previewRes.ok) throw new Error('Match preview not ready yet');
        const data = (await previewRes.json()) as PreviewPayload;
        if (cancelled) return;

        setPreview(data);

        if (!isMixRefetch) {
          void trackFunnelEventOnce(`instant_matches_viewed:${startupId}`, 'instant_matches_viewed', {
            startup_id: startupId,
            url,
            match_count: data.matches?.length ?? 0,
            source: 'matches_preview',
            investor_mix: investorMix,
          });
          markFirstPreviewSeen();
          if (!authLoading && !isAuthenticated) {
            recordAnonymousPreview(url);
          }
          if (data.startup?.id) {
            pinActiveStartup(data.startup.id, url, data.startup.name ?? null);
          }
        }

        for (const m of (data.matches || []).slice(0, PREVIEW_LIMIT)) {
          const invId = m.investor_id || m.investor?.id;
          if (invId) recordMatchViewOnce(startupId, invId, 'instant_match_preview');
        }
      } catch (e) {
        if (!cancelled && !isMixRefetch) {
          setError(e instanceof Error ? e.message : 'Preview failed');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [startupId, investorMix, url]);

  const handleSignup = (action: FounderGatedAction = 'save', investor?: GatedInvestorContext | null) => {
    if (!preview?.startup?.id) return;

    if (isAuthenticated) {
      if (action === 'save') {
        void persistShortlist(preview.startup.id, preview.startup.name);
        return;
      }
      navigate(postSignupPathForAction(action, preview.startup.id, { url }));
      return;
    }

    void trackFounderGateStarted(
      action,
      { url, startupId: preview.startup.id, investor },
      founderExpRef.current,
      gateCtaRef.current,
      null,
    );
    navigate(founderSignupPath({ startupId: preview.startup.id, url, intent: 'matches' }));
  };

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center gap-3 text-center">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: G }} />
        <p className="text-sm font-medium" style={{ color: TEXT }}>Finding your top investor matches…</p>
        <p className="text-xs" style={{ color: DIM }}>Usually 20–60 seconds</p>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="py-8 text-center max-w-lg mx-auto">
        <p className="text-sm mb-3" style={{ color: AMBER }}>{error || 'Preview unavailable'}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 text-xs font-semibold underline"
          style={{ color: G }}
        >
          Try again <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const matches = preview.matches || [];
  const visible = matches.slice(0, PREVIEW_LIMIT);
  const total = preview.total_matches ?? matches.length;
  const startupName = preview.startup?.name || 'Your startup';
  const godScore =
    typeof preview.startup?.god_score === 'number' ? Math.round(preview.startup.god_score) : null;
  const fundingStage = preview.shortlist_mix?.funding_stage?.replace(/-/g, ' ');

  return (
    <div className="mb-12 max-w-3xl mx-auto">
      <div className="mb-4">
        <h1 className="text-xl font-bold mb-1" style={{ color: TEXT }}>
          {startupName} — top {visible.length} matches
        </h1>
        <InlineMeta
          items={[
            { text: `${total.toLocaleString()} in network`, color: MUTED },
            ...(godScore != null ? [{ text: `GOD ${godScore}`, color: G }] : []),
            ...(preview.shortlist_mix?.vc_count != null && preview.shortlist_mix?.angel_count != null
              ? [{ text: `${preview.shortlist_mix.vc_count} VCs · ${preview.shortlist_mix.angel_count} angels`, color: MUTED }]
              : []),
            ...(fundingStage
              ? [{ text: `${fundingStage} round`, color: G }]
              : [{ text: 'Round not confirmed', color: AMBER }]),
          ]}
        />
        {refreshed && (
          <p className="mt-2 text-xs" style={{ color: G }}>Shortlist reranked with your latest data.</p>
        )}
      </div>

      {!isAuthenticated && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <button
            type="button"
            onClick={() => handleSignup('save')}
            className="text-sm font-semibold inline-flex items-center gap-1.5"
            style={{ color: G }}
          >
            Save top {visible.length} — free account
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs" style={{ color: DIM }}>No card · outreach optional later</span>
        </div>
      )}
      {isAuthenticated && shortlistSaved && (
        <p className="mb-4 text-xs" style={{ color: G }}>Shortlist saved to your account.</p>
      )}

      <ul className="mb-4 divide-y" style={{ borderColor: 'oklch(0.2 0.01 264)' }}>
        {visible.map((m, i) => {
          const inv = m.investor;
          const fitness = Math.round(m.fitness_score ?? m.match_score ?? 0);
          const stage = investorStageLabel(m);
          const check = investorCheckLabel(m);
          const why = normalizeWhyYouMatch(m.why_you_match);
          return (
            <li key={inv?.id || i} className="py-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium truncate min-w-0" style={{ color: TEXT }}>
                  <span className="font-mono text-xs mr-2" style={{ color: DIM }}>#{i + 1}</span>
                  {formatInvestorDisplayLabel(inv?.name, inv?.firm)}
                </p>
                <span className="text-xs font-mono shrink-0" style={{ color: G }}>
                  {fitness} fit
                </span>
              </div>
              <InlineMeta
                items={[
                  ...(m.investor_class ? [{ text: m.investor_class === 'angel' ? 'Angel' : 'VC', color: MUTED }] : []),
                  ...(stage ? [{ text: stage, color: MUTED }] : []),
                  ...(check ? [{ text: check, color: MUTED }] : []),
                  ...(why ? [{ text: why.split(/\s*[·•]\s*|\n+/).filter(Boolean)[0], color: DIM }] : []),
                ]}
              />
              {i === 0 && why && (
                <div className="mt-1">
                  <MatchExplainBlock
                    startupId={preview.startup?.id || startupId || 'preview'}
                    investorId={m.investor_id || inv?.id}
                    investorName={formatInvestorDisplayLabel(inv?.name, inv?.firm)}
                    whyYouMatch={m.why_you_match}
                    matchScore={m.match_score}
                    rank={i}
                    source="instant_match_preview"
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {total > visible.length && (
        <p className="text-xs mb-4" style={{ color: DIM }}>
          +{(total - visible.length).toLocaleString()} more after you save
        </p>
      )}

      {isAuthenticated && preview.startup?.id && !preview.shortlist_mix?.funding_stage && (
        <button
          type="button"
          onClick={() => setImproveMatchesOpen(true)}
          className="text-xs underline"
          style={{ color: MUTED }}
        >
          Confirm your round to improve fit
        </button>
      )}

      {improveMatchesOpen && preview.startup?.id && (
        <ImproveMatchesPanel
          startupId={preview.startup.id}
          startupUrl={url}
          currentGodScore={preview.startup.god_score}
          onClose={() => setImproveMatchesOpen(false)}
        />
      )}
    </div>
  );
}
