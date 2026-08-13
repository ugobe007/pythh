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
  allowWizardUnlockFlow,
  primePreviewSignupDestination,
  trackFounderGateStarted,
  type FounderGatedAction,
  type GatedInvestorContext,
} from '@/lib/founderSignupGate';
import MatchExplainBlock from '@/components/MatchExplainBlock';
import { normalizeWhyYouMatch } from '@/lib/normalizeWhyYouMatch';
import { recordAnonymousPreview } from '@/lib/anonymousPreviewSession';
import { pinActiveStartup } from '@/lib/activeStartupContext';
import type { OracleGapPayload } from '@/components/PreviewOracleGapTeaser';
import type { MatchMovement } from '@/components/PreviewSignalDeltaTeaser';
import PeterIntroPanel from '@/components/PeterIntroPanel';
import { founderSignupPath } from '@/lib/safeUrl';
import ImproveMatchesPanel from '@/components/ImproveMatchesPanel';
import PitchEventRecommendations from '@/components/PitchEventRecommendations';
import AngelGroupRecommendations from '@/components/AngelGroupRecommendations';

const PREVIEW_LIMIT = 5;

type InvestorMix = 'balanced' | 'vc' | 'angel';

const INVESTOR_MIX_OPTIONS: { id: InvestorMix; label: string }[] = [
  { id: 'balanced', label: 'Angels + VCs' },
  { id: 'vc', label: 'VCs only' },
  { id: 'angel', label: 'Angels only' },
];

function MatchWorkflowGuide({ startupName, shortlistSize, onStartOutreach }: {
  startupName: string;
  shortlistSize: number;
  onStartOutreach: () => void;
}) {
  const steps = [
    ['1', 'Company analyzed', 'Complete'],
    ['2', 'Confirm your shortlist', 'Now'],
    ['3', 'Start investor outreach', 'Next'],
  ];
  return (
    <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 sm:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[2px] text-emerald-400">Your fundraising workflow</p>
          <h2 className="mb-1 text-lg font-bold text-white">Choose who {startupName} should contact first</h2>
          <p className="text-xs text-zinc-400">Review the fit and signals below, then start outreach. Improving company data remains optional.</p>
        </div>
        <button type="button" onClick={onStartOutreach} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-black hover:bg-emerald-400">
          Create outreach for top {shortlistSize}<ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {steps.map(([number, title, state]) => (
          <div key={number} className={`rounded-xl border p-3 ${state === 'Now' ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-zinc-800 bg-zinc-950/35'}`}>
            <p className={`mb-1 text-[10px] uppercase tracking-wide ${state === 'Now' ? 'text-emerald-400' : 'text-zinc-500'}`}>{number} · {state}</p>
            <p className="text-sm font-semibold text-white">{title}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

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

function investorBriefing(match: PreviewMatch): {
  focus: string;
  stage: string;
  check: string;
  lead: string;
} {
  const investor = match.investor;
  const sectors = Array.isArray(investor?.sectors)
    ? investor.sectors.filter(Boolean).slice(0, 3).join(', ')
    : '';
  const stage = Array.isArray(investor?.stage)
    ? investor.stage.filter(Boolean).join(', ')
    : String(investor?.stage || '');
  const min = formatCheckSize(investor?.check_size_min);
  const max = formatCheckSize(investor?.check_size_max);
  const check = min && max ? `${min}–${max}` : min || max || 'Confirm before outreach';
  const why = normalizeWhyYouMatch(match.why_you_match);
  const lead = why
    ? why.split(/\s*[·•]\s*|\n+/).filter(Boolean)[0]
    : 'Lead with the strongest evidence connecting your company to their thesis.';

  return {
    focus: sectors || 'Broad technology investor',
    stage: stage || 'Confirm current stage preference',
    check,
    lead,
  };
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
  match_movement?: MatchMovement | null;
  oracle_gap?: OracleGapPayload | null;
};

function investorSignalPriorities(
  match: PreviewMatch,
  startup?: PreviewPayload['startup'],
): { label: string; detail: string; priority: 'Highest' | 'High' | 'Important' }[] {
  const investor = match.investor;
  const investorSectors = Array.isArray(investor?.sectors)
    ? investor.sectors.filter(Boolean)
    : [];
  const startupSectors = Array.isArray(startup?.sectors)
    ? startup.sectors.filter(Boolean)
    : [];
  const sharedSectors = investorSectors.filter((sector) =>
    startupSectors.some((startupSector) =>
      startupSector.toLowerCase().includes(sector.toLowerCase()) ||
      sector.toLowerCase().includes(startupSector.toLowerCase()),
    ),
  );
  const stage = Array.isArray(investor?.stage)
    ? investor.stage.filter(Boolean).join(', ')
    : String(investor?.stage || startup?.stage || '');
  const min = formatCheckSize(investor?.check_size_min);
  const max = formatCheckSize(investor?.check_size_max);
  const check = min && max ? `${min}–${max}` : min || max;
  const why = normalizeWhyYouMatch(match.why_you_match);

  return [
    {
      label: 'Thesis relevance',
      detail: sharedSectors.length
        ? `Show specific proof in ${sharedSectors.slice(0, 2).join(' and ')}.`
        : investorSectors.length
          ? `Connect the company directly to ${investorSectors.slice(0, 2).join(' and ')}.`
          : 'Make the sector and customer use case immediately legible.',
      priority: 'Highest',
    },
    {
      label: 'Stage evidence',
      detail: stage
        ? `Demonstrate the milestones expected for ${stage}.`
        : 'Lead with traction, product readiness, and the next fundable milestone.',
      priority: 'High',
    },
    {
      label: check ? 'Round fit' : 'Conviction signal',
      detail: check
        ? `Frame the raise and use of funds against a typical ${check} check.`
        : why
          ? why.split(/\s*[·•]\s*|\n+/).filter(Boolean)[0]
          : 'Use one measurable proof point that makes the timing credible.',
      priority: 'Important',
    },
  ];
}

interface Props {
  url: string;
}

export default function InstantMatchPreview({ url }: Props) {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [improveMatchesOpen, setImproveMatchesOpen] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('improve') === '1',
  );
  const refreshed =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('refreshed') === '1';
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
          recordAnonymousPreview(url);
          if (data.startup?.id) {
            pinActiveStartup(data.startup.id, url, data.startup.name ?? null);
          }

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

  const handleSignup = (action: FounderGatedAction = 'save', investor?: GatedInvestorContext | null) => {
    if (!preview?.startup?.id) return;

    if (isAuthenticated) {
      if (action === 'oracle_gap') {
        allowWizardUnlockFlow();
      } else {
        primePreviewSignupDestination(preview.startup.id, action);
      }
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

    void trackFounderGateStarted(
      action,
      { url, startupId: preview.startup.id, investor },
      founderExpRef.current,
      gateCtaRef.current,
      previewGateAssignment,
    );
    navigate(founderSignupPath({ startupId: preview.startup.id, url }));
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
    handleSignup(action, investor);
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center gap-4 text-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
        <p className="text-lg text-white font-medium">Finding your top investor matches…</p>
        <p className="text-sm text-zinc-500">Analyzing your startup against our capital graph — usually 20–60 seconds</p>
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="py-12 px-4 rounded-xl border border-red-500/30 bg-red-500/5 text-center max-w-lg mx-auto">
        <p className="text-red-300 text-sm mb-4">{error || 'Preview unavailable'}</p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm"
        >
          Try again <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  const matches = preview.matches || [];
  const visible = matches.slice(0, PREVIEW_LIMIT);
  const total = preview.total_matches ?? matches.length;
  const startupName = preview.startup?.name || 'Your startup';
  return (
    <div className="mb-16">
      <div className="mb-6 text-center">
        <p className="text-[11px] uppercase tracking-[2px] text-emerald-400 mb-3">Investor matches</p>
        <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
          {startupName} — your top {visible.length} matches
        </h1>
        <p className="text-sm text-zinc-400">
          {total.toLocaleString()} qualified investors in the capital graph
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

      <MatchWorkflowGuide startupName={startupName} shortlistSize={visible.length} onStartOutreach={() => void handleSignup('outreach')} />

      {refreshed && (
        <div className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center">
          <p className="text-sm font-semibold text-emerald-300">Matches refreshed with your new data</p>
          <p className="mt-1 text-xs text-zinc-400">The shortlist below has been reranked by the match engine.</p>
        </div>
      )}

      <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900/35 p-4">
        <p className="text-[10px] uppercase tracking-[1.5px] text-emerald-400 mb-3">
          How to use this shortlist
        </p>
        <div className="grid sm:grid-cols-3 gap-3 text-xs">
          <p className="text-zinc-400"><span className="text-white font-semibold">1. Read the fit.</span> Understand why the investor surfaced.</p>
          <p className="text-zinc-400"><span className="text-white font-semibold">2. Check their signals.</span> See what evidence they are likely screening.</p>
          <p className="text-zinc-400"><span className="text-white font-semibold">3. Tailor outreach.</span> Lead with the strongest relevant proof.</p>
        </div>
      </div>

      <div className={`mb-6 rounded-xl border p-4 ${
        preview.shortlist_mix?.funding_stage
          ? 'border-emerald-500/25 bg-emerald-500/5'
          : 'border-amber-500/25 bg-amber-500/5'
      }`}>
        <p className={`text-[10px] uppercase tracking-[1.5px] ${
          preview.shortlist_mix?.funding_stage ? 'text-emerald-400' : 'text-amber-300'
        }`}>
          Funding lifecycle
        </p>
        {preview.shortlist_mix?.funding_stage ? (
          <>
            <p className="mt-1 text-sm font-medium text-white">
              Matched for a {preview.shortlist_mix.funding_stage.replace(/-/g, ' ')} round
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Investors targeting this exact stage are prioritized before inferred early-stage fallbacks.
            </p>
          </>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="mt-1 text-sm font-medium text-white">Your current round is not confirmed.</p>
              <p className="mt-1 text-xs text-zinc-500">
                Pythh used available early-stage signals. Confirm pre-seed or seed to remove lifecycle mismatches.
              </p>
            </div>
            {isAuthenticated && (
              <button
                type="button"
                onClick={() => setImproveMatchesOpen(true)}
                className="shrink-0 rounded-lg bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 hover:bg-emerald-400"
              >
                Confirm my round
              </button>
            )}
          </div>
        )}
      </div>

      {isAuthenticated && preview.startup?.id && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[1.5px] text-emerald-400">Optional · Improve matches</p>
            <p className="mt-1 text-sm font-medium text-white">Add missing founder, funding, traction, or deck data.</p>
            <p className="mt-1 text-xs text-zinc-500">Then rerun the match engine for a more informed shortlist.</p>
          </div>
          <button
            type="button"
            onClick={() => setImproveMatchesOpen(true)}
            className="shrink-0 rounded-lg border border-emerald-500/40 px-4 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/10"
          >
            Improve matches →
          </button>
        </div>
      )}

      <div className="space-y-3 mb-6">
        {visible.map((m, i) => {
          const inv = m.investor;
          const briefing = investorBriefing(m);
          const signalPriorities = investorSignalPriorities(m, preview.startup);
          return (
            <div
              key={inv?.id || i}
              className={`p-5 rounded-xl border ${
                i === 0
                  ? 'border-emerald-500/40 bg-emerald-500/5'
                  : 'border-zinc-800 bg-zinc-900/40'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
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
                  {m.funding_lifecycle_fit?.level && (
                    <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                      m.funding_lifecycle_fit.level === 'exact'
                        ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                    }`}>
                      {m.funding_lifecycle_fit.level === 'exact'
                        ? `${(m.funding_lifecycle_fit.startupStage || 'Stage').replace(/-/g, ' ')} fit`
                        : 'Stage inferred'}
                    </span>
                  )}
                  <span className="text-white font-medium truncate">
                    {formatInvestorDisplayLabel(inv?.name, inv?.firm)}
                  </span>
                  </div>
                </div>
                {typeof (m.fitness_score ?? m.match_score) === 'number' && (
                  <div className="text-right shrink-0">
                    <span className="block text-sm font-mono font-semibold text-emerald-400">
                      {Math.round(m.fitness_score ?? m.match_score ?? 0)} Fitness
                    </span>
                    <span className="block text-[9px] uppercase tracking-wide text-zinc-600">
                      {m.fitness_confidence === 'high'
                        ? 'High confidence'
                        : m.fitness_confidence === 'medium'
                          ? 'Verified signals'
                          : 'Fitness building'}
                    </span>
                  </div>
                )}
              </div>

              {Array.isArray(m.fitness_factors) && m.fitness_factors.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.fitness_factors.slice(0, 3).map((factor) => (
                    <span
                      key={factor}
                      className="text-[10px] px-2 py-1 rounded-full border border-emerald-500/20 bg-emerald-500/5 text-emerald-200/80"
                    >
                      {factor}
                    </span>
                  ))}
                </div>
              )}

              <MatchExplainBlock
                startupId={preview.startup?.id || startupId || 'preview'}
                investorId={m.investor_id || inv?.id}
                investorName={formatInvestorDisplayLabel(inv?.name, inv?.firm)}
                whyYouMatch={
                  m.why_you_match ||
                  'Aligned by sector, stage, and investment thesis.'
                }
                matchScore={m.match_score}
                rank={i}
                source="instant_match_preview"
              />

              <div className="mt-4 pt-4 border-t border-zinc-800/80">
                <p className="text-[10px] uppercase tracking-[1.5px] text-zinc-500 mb-3">
                  Founder briefing
                </p>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-1">Investment focus</p>
                    <p className="text-xs text-zinc-300">{briefing.focus}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-1">Stage · typical check</p>
                    <p className="text-xs text-zinc-300">{briefing.stage} · {briefing.check}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-zinc-600 mb-1">What to lead with</p>
                    <p className="text-xs text-zinc-300 line-clamp-2">{briefing.lead}</p>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-800/80">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                    Investor signal priorities
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    Inferred from thesis and match evidence
                  </p>
                </div>
                <div className="grid sm:grid-cols-3 gap-3">
                  {signalPriorities.map((signal) => (
                    <div
                      key={signal.label}
                      className="rounded-lg border border-zinc-800 bg-zinc-950/45 p-3"
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-xs font-medium text-white">{signal.label}</p>
                        <span className="text-[9px] uppercase tracking-wide text-emerald-400">
                          {signal.priority}
                        </span>
                      </div>
                      <p className="text-[11px] leading-relaxed text-zinc-400">
                        {signal.detail}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {total > visible.length && (
        <p className="text-center text-xs text-zinc-500 mb-8">
          +{(total - visible.length).toLocaleString()} more qualified investors available as you build your shortlist
        </p>
      )}

      <PitchEventRecommendations
        startupId={preview.startup?.id || startupId || undefined}
        startupName={startupName}
        sectors={preview.startup?.sectors}
        stage={preview.startup?.stage}
      />

      <AngelGroupRecommendations
        startupId={preview.startup?.id || startupId || undefined}
        startupName={startupName}
        sectors={preview.startup?.sectors}
        stage={preview.startup?.stage}
        state={preview.startup?.state}
      />

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
