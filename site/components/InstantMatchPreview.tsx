/**
 * Public instant match preview — ?url= on /matches (founder_hero_entry matches_preview variant).
 * Value-first: full shortlist reveal, signup gate on save / intro / export only.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { apiUrl } from '@/lib/apiConfig';
import { fetchGrowthAssignment, trackGrowthEvent, type GrowthAssignment } from '@/lib/growthExperiment';
import { markFirstPreviewSeen } from '@/lib/funnelAttribution';
import { recordMatchViewOnce, trackFunnelEvent, trackFunnelEventOnce, recordMatchEngagement } from '@/lib/matchEngagement';
import { formatInvestorDisplayLabel } from '@/lib/formatInvestorDisplay';
import {
  postSignupPathForAction,
  primePreviewSignupDestination,
  trackFounderGateStarted,
  type FounderGatedAction,
  type GatedInvestorContext,
} from '@/lib/founderSignupGate';
import PreviewOracleProofStrip from '@/components/PreviewOracleProofStrip';
import PreviewEvidenceStrip from '@/components/PreviewEvidenceStrip';
import MatchExplainBlock from '@/components/MatchExplainBlock';
import { normalizeWhyYouMatch } from '@/lib/normalizeWhyYouMatch';
import PreviewOracleGapTeaser, { buildOracleGapCopy, type OracleGapPayload } from '@/components/PreviewOracleGapTeaser';
import type { MatchMovement } from '@/components/PreviewSignalDeltaTeaser';
import PeterIntroPanel, { PeterIntroStrip } from '@/components/PeterIntroPanel';

const PREVIEW_LIMIT = 10;

type InvestorMix = 'balanced' | 'vc' | 'angel';

const INVESTOR_MIX_OPTIONS: { id: InvestorMix; label: string }[] = [
  { id: 'balanced', label: 'Angels + VCs' },
  { id: 'vc', label: 'VCs only' },
  { id: 'angel', label: 'Angels only' },
];

function primarySignupLabel(): string {
  return 'Start my raise — free account';
}

type PreviewMatch = {
  investor_id?: string;
  match_score?: number;
  why_you_match?: string | null;
  investor_class?: 'angel' | 'vc';
  investor?: {
    id?: string;
    name?: string;
    firm?: string | null;
    sectors?: string[] | null;
  };
};

type ShortlistMix = {
  mode?: string;
  vc_count?: number;
  angel_count?: number;
};

type PreviewPayload = {
  startup?: { id?: string; name?: string; god_score?: number };
  total_matches?: number;
  matches?: PreviewMatch[];
  shortlist_mix?: ShortlistMix | null;
  match_movement?: MatchMovement | null;
  oracle_gap?: OracleGapPayload | null;
};

interface Props {
  url: string;
}

export default function InstantMatchPreview({ url }: Props) {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [startupId, setStartupId] = useState<string | null>(null);
  const [investorMix, setInvestorMix] = useState<InvestorMix>('balanced');
  const [mixLoading, setMixLoading] = useState(false);
  const founderExpRef = useRef<GrowthAssignment | null>(null);
  const gateCtaRef = useRef<GrowthAssignment | null>(null);
  const deltaExpRef = useRef<GrowthAssignment | null>(null);
  const oracleGapExpRef = useRef<GrowthAssignment | null>(null);
  const deltaTeaserTrackedRef = useRef(false);
  const oracleGapTeaserTrackedRef = useRef(false);
  const evidenceStripTrackedRef = useRef(false);
  const pricingStripRef = useRef<HTMLDivElement | null>(null);
  const pricingStripTrackedRef = useRef(false);
  const [deltaAssignment, setDeltaAssignment] = useState<GrowthAssignment | null>(null);
  const [oracleGapAssignment, setOracleGapAssignment] = useState<GrowthAssignment | null>(null);
  const [gateCopy, setGateCopy] = useState({
    save: 'Track shortlist',
    intro: 'Ask Peter',
    export: 'Export & track',
    footer: 'Free account — or ask Peter for thesis framing before you reach out.',
  });
  const [peterPanelOpen, setPeterPanelOpen] = useState(false);
  const [peterInvestor, setPeterInvestor] = useState<GatedInvestorContext | null>(null);
  const introIntentTrackedRef = useRef<Set<string>>(new Set());

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
    fetchGrowthAssignment('founder', 'founder_preview_signal_delta_gate')
      .then((a) => {
        deltaExpRef.current = a;
        if (a) setDeltaAssignment(a);
      })
      .catch(() => {});
    fetchGrowthAssignment('founder', 'founder_preview_oracle_gap_gate')
      .then((a) => {
        oracleGapExpRef.current = a;
        if (a) setOracleGapAssignment(a);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setStartupId(null);
    setPreview(null);
    setInvestorMix('balanced');
    deltaTeaserTrackedRef.current = false;
    oracleGapTeaserTrackedRef.current = false;
    evidenceStripTrackedRef.current = false;

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
          for (let i = 0; i < 8 && !cancelled; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const retry = await fetch(apiUrl('/api/instant/submit'), {
              method: 'POST',
              credentials: 'same-origin',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url, source: 'matches_preview' }),
            });
            const retryJson = await retry.json().catch(() => ({}));
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
      if (isMixRefetch) setMixLoading(true);
      else setLoading(true);

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
          const resolvedDelta =
            deltaExpRef.current ??
            (await fetchGrowthAssignment('founder', 'founder_preview_signal_delta_gate').catch(() => null));
          if (resolvedDelta) {
            deltaExpRef.current = resolvedDelta;
            setDeltaAssignment(resolvedDelta);
          }

          const resolvedOracleGap =
            oracleGapExpRef.current ??
            (await fetchGrowthAssignment('founder', 'founder_preview_oracle_gap_gate').catch(() => null));
          if (resolvedOracleGap) {
            oracleGapExpRef.current = resolvedOracleGap;
            setOracleGapAssignment(resolvedOracleGap);
          }

          if (
            data.oracle_gap &&
            (resolvedOracleGap == null || resolvedOracleGap.variant_key === 'oracle_gap_cliffhanger') &&
            !oracleGapTeaserTrackedRef.current
          ) {
            oracleGapTeaserTrackedRef.current = true;
            void trackFunnelEventOnce('pythh_preview_oracle_gap_teaser', 'preview_oracle_gap_teaser_viewed', {
              startup_id: startupId,
              url,
              current_god_score: data.oracle_gap.current_god_score,
              has_top_gap: Boolean(data.oracle_gap.top_gap),
              total_gaps: data.oracle_gap.total_gaps,
            });
            if (resolvedOracleGap) {
              void trackGrowthEvent(resolvedOracleGap, 'preview_oracle_gap_teaser_viewed', {
                startup_id: startupId,
                url,
                ...data.oracle_gap,
              });
            }
          }

          if (data.match_movement && !deltaTeaserTrackedRef.current) {
            deltaTeaserTrackedRef.current = true;
            void trackFunnelEventOnce('pythh_preview_delta_teaser', 'preview_delta_teaser_viewed', {
              startup_id: startupId,
              url,
              moved_toward_count: data.match_movement.moved_toward_count,
              moved_away_count: data.match_movement.moved_away_count,
              match_count: data.match_movement.match_count,
              signal_score_delta: data.match_movement.signal_score_delta,
              source: data.match_movement.source,
            });
            void trackGrowthEvent(resolvedDelta, 'preview_delta_teaser_viewed', {
              startup_id: startupId,
              url,
              ...data.match_movement,
            });
          }

          void trackFunnelEventOnce(`instant_matches_viewed:${startupId}`, 'instant_matches_viewed', {
            startup_id: startupId,
            url,
            match_count: data.matches?.length ?? 0,
            source: 'matches_preview',
            investor_mix: investorMix,
          });
          void trackFunnelEventOnce(`raise_plan_viewed:${startupId}`, 'raise_plan_viewed', {
            startup_id: startupId,
            url,
            qualified_count: data.matches?.length ?? 0,
            source: 'oracle_analysis_preview',
            investor_mix: investorMix,
          });
          markFirstPreviewSeen();

          if (!evidenceStripTrackedRef.current) {
            evidenceStripTrackedRef.current = true;
            void trackFunnelEventOnce('pythh_preview_evidence_strip', 'preview_evidence_strip_viewed', {
              startup_id: startupId,
              url,
              total_in_network: data.total_matches ?? data.matches?.length ?? 0,
              shown_count: Math.min(PREVIEW_LIMIT, data.matches?.length ?? 0),
            });
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
          setMixLoading(false);
        }
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [startupId, investorMix, url]);

  useEffect(() => {
    const el = pricingStripRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (pricingStripTrackedRef.current) return;
        const visible = entries.some((e) => e.isIntersecting);
        if (!visible) return;
        pricingStripTrackedRef.current = true;
        void trackFunnelEventOnce('pythh_preview_pricing_strip', 'pricing_strip_viewed', {
          path: '/matches',
          source: 'preview_sticky',
          startup_id: preview?.startup?.id,
        });
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [preview?.startup?.id]);

  const handleSignup = async (action: FounderGatedAction = 'save', investor?: GatedInvestorContext | null) => {
    if (!preview?.startup?.id) return;

    if (isAuthenticated) {
      primePreviewSignupDestination(preview.startup.id, action);
      const post = postSignupPathForAction(action, preview.startup.id);
      navigate(post.includes('?') ? `${post}&welcome=1` : `${post}?welcome=1`);
      return;
    }

    const previewGateAssignment =
      action === 'oracle_gap'
        ? oracleGapExpRef.current
        : action === 'delta'
          ? deltaExpRef.current
          : null;

    await trackFounderGateStarted(
      action,
      { url, startupId: preview.startup.id, investor },
      founderExpRef.current,
      gateCtaRef.current,
      previewGateAssignment,
    );
    navigate(`/signup/founder?startup_id=${encodeURIComponent(preview.startup.id)}`);
  };

  const handleGate = async (action: FounderGatedAction, investor?: GatedInvestorContext | null) => {
    if (!preview?.startup?.id) return;
    if (action === 'intro') {
      // Instrument intro INTENT on panel open. The dominant preview CTA ("Ask Peter"/per-match
      // "Intro") opened this panel with zero funnel events, leaving match_intro_requested and
      // intro_per_match_view structurally 0 despite live match views. Fire once per investor.
      const startupId = preview.startup.id;
      const investorId = investor?.id;
      const intentKey = investorId ? `intro:${startupId}:${investorId}` : `intro:${startupId}:top`;
      if (!introIntentTrackedRef.current.has(intentKey)) {
        introIntentTrackedRef.current.add(intentKey);
        void trackFunnelEvent('match_intro_requested', {
          startup_id: startupId,
          investor_id: investorId,
          investor_name: investor?.name,
          url,
          source: 'instant_preview_intro_intent',
          gated_action: 'intro',
        });
        if (investorId) {
          void recordMatchEngagement(startupId, investorId, 'intro', 'instant_match_preview');
        }
      }
      setPeterInvestor(investor ?? null);
      setPeterPanelOpen(true);
      return;
    }
    await handleSignup(action, investor);
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
        <p className="text-lg text-white font-medium">Oracle is analyzing your company…</p>
        <p className="text-sm text-zinc-500">Readiness, gaps, and qualified investors — usually 20–60 seconds</p>
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
  const showOracleGapTeaser =
    Boolean(preview.oracle_gap) &&
    (oracleGapAssignment == null || oracleGapAssignment.variant_key === 'oracle_gap_cliffhanger');
  const oracleGapCopy = preview.oracle_gap
    ? buildOracleGapCopy(preview.oracle_gap, oracleGapAssignment)
    : null;

  const primaryCta = primarySignupLabel();
  const topInvestor = investorFromMatch(visible[0] ?? {});
  const readinessScore = preview.oracle_gap?.current_god_score;

  return (
    <div className="mb-16 pb-28">
      <div className="mb-8 text-center">
        <p className="text-[11px] uppercase tracking-[2px] text-emerald-400 mb-3">Oracle · Initial analysis</p>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          {startupName} — your raise plan
        </h1>
        <p className="text-sm text-zinc-400">
          {typeof readinessScore === 'number' && (
            <>Readiness {readinessScore}/100 · </>
          )}
          {visible.length} qualified investors shown · {total.toLocaleString()} in capital graph
          {preview.shortlist_mix &&
            investorMix === 'balanced' &&
            typeof preview.shortlist_mix.vc_count === 'number' &&
            typeof preview.shortlist_mix.angel_count === 'number' && (
              <>
                {' '}
                · {preview.shortlist_mix.vc_count} VCs · {preview.shortlist_mix.angel_count} angels
              </>
            )}
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
        {INVESTOR_MIX_OPTIONS.map((opt) => {
          const active = investorMix === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              disabled={mixLoading}
              onClick={() => {
                if (opt.id === investorMix) return;
                setInvestorMix(opt.id);
                void trackFunnelEvent('preview_investor_mix_changed', {
                  mix: opt.id,
                  startup_id: preview.startup?.id,
                  source: 'instant_match_preview',
                });
              }}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                active
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                  : 'text-zinc-400 border-zinc-700 hover:border-zinc-500 hover:text-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
        {mixLoading && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
      </div>

      <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 text-center sm:text-left">
        <p className="text-sm text-zinc-300 leading-relaxed max-w-2xl mx-auto sm:mx-0">
          Oracle analyzed your company and qualified these investors for outreach.
          Start your raise to save your plan, close readiness gaps, and authorize campaigns toward meetings.
          {Math.max(total - visible.length, 0) > 0 && (
            <>
              {' '}
              <span className="text-zinc-500">
                +{Math.max(total - visible.length, 0).toLocaleString()} more in your full qualified pipeline after signup.
              </span>
            </>
          )}
        </p>
      </div>

      <PreviewOracleProofStrip />

      <PreviewEvidenceStrip
        totalInNetwork={total}
        shownCount={visible.length}
        startupName={startupName}
      />

      <PeterIntroStrip
        className="mb-6 border-zinc-800 bg-zinc-900/40"
        onAskPeter={() => {
          setPeterInvestor(topInvestor);
          setPeterPanelOpen(true);
        }}
        variant="secondary"
      />

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
                  {m.investor_class && (
                    <span
                      className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                        m.investor_class === 'angel'
                          ? 'bg-violet-500/10 text-violet-300 border-violet-500/30'
                          : 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                      }`}
                    >
                      {m.investor_class === 'angel' ? 'Angel' : 'VC'}
                    </span>
                  )}
                  <span className="text-white font-medium truncate">
                    {formatInvestorDisplayLabel(inv?.name, inv?.firm)}
                  </span>
                </div>
                {m.why_you_match && (
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-2 sm:hidden">
                    {normalizeWhyYouMatch(m.why_you_match)}
                  </p>
                )}
                {preview.startup?.id && (
                  <MatchExplainBlock
                    startupId={preview.startup.id}
                    investorId={inv?.id || m.investor_id}
                    investorName={inv?.name}
                    whyYouMatch={m.why_you_match}
                    matchScore={m.match_score}
                    rank={i}
                    source="instant_match_preview"
                    onIntro={gatedInvestor ? () => void handleGate('intro', gatedInvestor) : undefined}
                    introLabel={i === 0 ? `Ask for a warm intro to ${inv?.name?.split(' ')[0] || 'this partner'} →` : undefined}
                  />
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
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-400 border border-zinc-700 hover:border-zinc-500 hover:text-zinc-200 whitespace-nowrap"
                  >
                    {i === 0 ? 'Intro help' : 'Intro'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {total > visible.length && (
        <p className="text-center text-xs text-zinc-500 mb-6">
          +{(total - visible.length).toLocaleString()} more qualified investors in your pipeline after signup
        </p>
      )}

      {showOracleGapTeaser && preview.oracle_gap && oracleGapCopy && (
        <PreviewOracleGapTeaser gap={preview.oracle_gap} copy={oracleGapCopy} />
      )}

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

      <div
        ref={pricingStripRef}
        className="fixed bottom-0 inset-x-0 z-40 border-t border-emerald-500/20 bg-zinc-950/95 backdrop-blur-md px-4 py-3"
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-zinc-400 text-center sm:text-left max-w-md">
            Oracle plan ready · {visible.length} of {total.toLocaleString()} qualified investors shown
          </p>
          <button
            type="button"
            onClick={() => void handleSignup('save')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-900/30"
          >
            {primaryCta}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {preview.startup?.id && (
        <PeterIntroPanel
          open={peterPanelOpen}
          onClose={() => setPeterPanelOpen(false)}
          startupId={preview.startup.id}
          startupName={startupName}
          startupUrl={url}
          investor={peterInvestor}
          source="instant_match_preview"
        />
      )}
    </div>
  );
}
