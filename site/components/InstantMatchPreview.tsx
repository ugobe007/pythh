/**
 * Public instant match preview — ?url= on /matches (founder_hero_entry matches_preview variant).
 * Value-first: full shortlist reveal, signup gate on save / intro / export only.
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { hasPaidRaiseAccess } from '@/lib/pricingPlans';
import { apiUrl } from '@/lib/apiConfig';
import { fetchGrowthAssignment, type GrowthAssignment } from '@/lib/growthExperiment';
import { markFirstPreviewSeen } from '@/lib/funnelAttribution';
import { recordMatchViewOnce, trackFunnelEventOnce } from '@/lib/matchEngagement';
import {
  postSignupPathForAction,
  savedMatchesPath,
  trackFounderGateStarted,
  completePreviewGateIfPending,
  peekFounderGatePending,
  type FounderGatedAction,
  type GatedInvestorContext,
} from '@/lib/founderSignupGate';
import { persistFounderStartup, readJoinEmail, sendSavedMatchesEmail } from '@/lib/founderAccount';
import { recordAnonymousPreview } from '@/lib/anonymousPreviewSession';
import { pinActiveStartup } from '@/lib/activeStartupContext';
import {
  ANON_IMPROVE_LIMIT,
  canImproveAnonymously,
  clearImproveOptOut,
  getImproveCount,
  hasOptedOutOfImprove,
  optOutOfImprove,
  recordImproveCompletion,
} from '@/lib/improveMatchesQuota';
import { founderSignupPath } from '@/lib/safeUrl';
import ImproveMatchesPanel from '@/components/ImproveMatchesPanel';
import MatchInvestorLead, { type LeadMatch } from '@/components/MatchInvestorLead';
import InlineMeta from '@/components/design/InlineMeta';
import { fetchLeadUnlocks } from '@/lib/matchLeadRelay';
import { G, G_HOVER, AMBER, DIM, MUTED, PURPLE_ACCENT, PURPLE_HOVER, TEXT } from '@/lib/designTokens';

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
  investor?: LeadMatch['investor'];
};

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

const NEXT_STEP_CTA_CLASS =
  'inline-flex items-center justify-center gap-2 w-full px-7 rounded-lg text-[15px] font-semibold';
const NEXT_STEP_CTA_STYLE = {
  backgroundColor: G,
  border: `1px solid ${G}`,
  color: 'oklch(0.1 0.02 162.48)',
  minHeight: 50,
} as const;
const IMPROVE_CTA_STYLE = {
  backgroundColor: PURPLE_ACCENT,
  border: `1px solid ${PURPLE_ACCENT}`,
  color: 'oklch(0.14 0.03 305)',
  minHeight: 50,
} as const;

function paintNextStepCta(el: HTMLElement, hover: boolean) {
  el.style.backgroundColor = hover ? G_HOVER : G;
  el.style.borderColor = hover ? G_HOVER : G;
}

function paintImproveCta(el: HTMLElement, hover: boolean) {
  el.style.backgroundColor = hover ? PURPLE_HOVER : PURPLE_ACCENT;
  el.style.borderColor = hover ? PURPLE_HOVER : PURPLE_ACCENT;
}

interface Props {
  url: string;
}

export default function InstantMatchPreview({ url }: Props) {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { data: subscription } = trpc.stripe.getSubscription.useQuery(undefined, {
    enabled: Boolean(isAuthenticated),
    retry: false,
  });
  const isPaid = hasPaidRaiseAccess({
    plan: subscription?.plan,
    status: subscription?.status,
    role: user?.role,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [shortlistSaved, setShortlistSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [improveMatchesOpen, setImproveMatchesOpen] = useState(false);
  const [improveUsed, setImproveUsed] = useState(0);
  const [improveOptedOut, setImproveOptedOut] = useState(false);
  const refreshed =
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('refreshed') === '1';
  const [startupId, setStartupId] = useState<string | null>(null);
  const [investorMix] = useState<InvestorMix>('balanced');
  const [unlockedIds, setUnlockedIds] = useState<string[]>([]);
  const founderExpRef = useRef<GrowthAssignment | null>(null);
  const gateCtaRef = useRef<GrowthAssignment | null>(null);
  const gateCompletedRef = useRef(false);
  const emailedRef = useRef(false);
  const emailPromiseRef = useRef<Promise<void> | null>(null);

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
    const ok = await persistFounderStartup({ startupId: id, companyUrl: url, companyName: name });
    if (peekFounderGatePending().pending) {
      await completePreviewGateIfPending({
        url,
        startupId: id,
        email: user?.email,
      });
    }
    if (!ok) throw new Error('Could not save matches to your account. Try again.');
    setShortlistSaved(true);
  };

  const emailReadyShortlist = async (id: string, name?: string | null) => {
    const email = (user?.email || readJoinEmail()).trim();
    if (!email.includes('@')) return;
    
    // If already sent or in progress, wait for existing attempt
    if (emailedRef.current || emailPromiseRef.current) {
      await emailPromiseRef.current;
      return;
    }
    
    // Mark as emailed immediately to prevent concurrent sends
    emailedRef.current = true;
    const topInvestors = (preview?.matches || []).slice(0, 5).map((m) => ({
      name: m.investor?.name || m.investor?.firm || '',
      firm: m.investor?.firm || null,
    }));
    
    const sendPromise = (async () => {
      try {
        await sendSavedMatchesEmail({
          email,
          startupId: id,
          startupUrl: url,
          startupName: name,
          matchCount: preview?.total_matches ?? topInvestors.length,
          topInvestors,
          source: 'instant_match_preview',
        });
      } catch (err) {
        console.warn('[preview] email shortlist failed:', err);
        // Reset flag on failure so retry is allowed
        emailedRef.current = false;
        throw err;
      } finally {
        emailPromiseRef.current = null;
      }
    })();
    
    emailPromiseRef.current = sendPromise;
    await sendPromise;
  };

  const finishAuthenticatedSave = async () => {
    const id = preview?.startup?.id || startupId;
    if (!id) {
      setSaveError('Matches are still loading. Try again in a moment.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await persistShortlist(id, preview?.startup?.name);
      await emailReadyShortlist(id, preview?.startup?.name);
      navigate(savedMatchesPath());
    } catch (reason) {
      setSaveError(reason instanceof Error ? reason.message : 'Could not save matches. Try again.');
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (authLoading || !isAuthenticated || !preview?.startup?.id || gateCompletedRef.current) return;
    gateCompletedRef.current = true;
    void persistShortlist(preview.startup.id, preview.startup.name).catch(() => {
      gateCompletedRef.current = false;
    });
  }, [authLoading, isAuthenticated, preview?.startup?.id, preview?.startup?.name, url, user?.email]);

  useEffect(() => {
    const id = preview?.startup?.id;
    if (!id || loading || !preview?.matches?.length) return;
    emailReadyShortlist(id, preview.startup?.name);
  }, [preview?.startup?.id, preview?.startup?.name, preview?.matches?.length, loading, user?.email]);

  useEffect(() => {
    let cancelled = false;
    setStartupId(null);
    setPreview(null);
    setShortlistSaved(false);
    setImproveUsed(0);
    setImproveOptedOut(false);
    setUnlockedIds([]);
    gateCompletedRef.current = false;
    emailedRef.current = false;
    emailPromiseRef.current = null;
    setSaveError(null);
    setSaving(false);

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
        if (!cancelled) {
          setStartupId(id);
          setImproveUsed(getImproveCount(id));
          setImproveOptedOut(hasOptedOutOfImprove(id));
        }
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

  useEffect(() => {
    if (!startupId || authLoading || !isAuthenticated || !isPaid) return;
    let cancelled = false;
    fetchLeadUnlocks(startupId)
      .then((ids) => {
        if (!cancelled) setUnlockedIds(ids);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [startupId, authLoading, isAuthenticated, isPaid]);

  const openImproveOrSignup = () => {
    const id = preview?.startup?.id || startupId;
    if (isAuthenticated || canImproveAnonymously(id)) {
      clearImproveOptOut(id);
      setImproveOptedOut(false);
      setImproveMatchesOpen(true);
      return;
    }
    handleSignup('save');
  };

  const skipImprove = () => {
    const id = preview?.startup?.id || startupId;
    optOutOfImprove(id);
    setImproveOptedOut(true);
    setImproveMatchesOpen(false);
    if (!isAuthenticated) handleSignup('save');
    else void finishAuthenticatedSave();
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('improve') !== '1') return;
    const id = preview?.startup?.id || startupId;
    if (!id || hasOptedOutOfImprove(id)) return;
    if (isAuthenticated || canImproveAnonymously(id)) {
      setImproveMatchesOpen(true);
    }
  }, [isAuthenticated, preview?.startup?.id, startupId]);

  const handleSignup = (action: FounderGatedAction = 'save', investor?: GatedInvestorContext | null) => {
    const startupIdForGate = preview?.startup?.id;
    if (isAuthenticated && startupIdForGate) {
      if (action === 'save') {
        void finishAuthenticatedSave();
        return;
      }
      navigate(postSignupPathForAction(action, startupIdForGate, { url }));
      return;
    }

    if (startupIdForGate) {
      void trackFounderGateStarted(
        action,
        { url, startupId: startupIdForGate, investor },
        founderExpRef.current,
        gateCtaRef.current,
        null,
      );
    } else if (url) {
      sessionStorage.setItem('pythia_url', url);
    }
    navigate(founderSignupPath({ startupId: startupIdForGate, url, intent: 'matches' }));
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
  const canConfirmRound = Boolean(isAuthenticated && preview.startup?.id && !fundingStage);
  const improveLeft = Math.max(0, ANON_IMPROVE_LIMIT - improveUsed);
  const canImproveNow = Boolean(!improveOptedOut && (isAuthenticated || improveLeft > 0));
  const nextCopy = !isAuthenticated
    ? canImproveNow
      ? `These ${visible.length} matches are ready. Improving is optional — skip if you want to keep this shortlist as-is. You can still refine ${improveLeft} more time${improveLeft === 1 ? '' : 's'} without an account.`
      : improveOptedOut
        ? `You skipped improve. Create a free account to keep these ${visible.length} matches on your profile — open Account from the nav anytime you come back.`
        : `You've refined this shortlist twice. Create a free account to keep these ${visible.length} matches on your profile — open Account from the nav anytime you come back.`
    : canConfirmRound
      ? 'These five are ranked without a confirmed round. Confirm seed / A / B so we can rerank who sits on top. Improving the rest of the profile is optional.'
      : improveOptedOut
        ? 'You kept this shortlist. Save it to your profile and we email the list so you can come back from your inbox.'
        : shortlistSaved
          ? 'These matches are saved to your account. Improving is optional — skip if these five are enough.'
          : 'These matches are ready. Improving is optional — skip if you want to keep this shortlist as-is.';

  return (
    <div className="mb-12 max-w-3xl mx-auto">
      <div className="grid grid-cols-3 gap-2 mb-6" aria-label="Match save progress">
        {[
          ['1', 'Matches ready'],
          ['2', 'Save matches'],
          ['3', 'Inbox + profile'],
        ].map(([step, label], index) => (
          <div key={step} className="text-center">
            <div
              className="h-1 rounded-full mb-2"
              style={{ backgroundColor: index <= 1 ? G : 'oklch(0.25 0.01 264)' }}
            />
            <p className="text-[10px]" style={{ color: index <= 1 ? G : DIM }}>
              {step}. {label}
            </p>
          </div>
        ))}
      </div>
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

      {isAuthenticated && shortlistSaved && (
        <p className="mb-4 text-xs" style={{ color: G }}>
          Saved to your account.{' '}
          <Link href={savedMatchesPath()} className="underline underline-offset-2">
            Open your saved matches
          </Link>
          .
        </p>
      )}

      <ul className="mb-4 divide-y" style={{ borderColor: 'oklch(0.2 0.01 264)' }}>
        {visible.map((m, i) => {
          const investorId = m.investor_id || m.investor?.id || '';
          return (
            <MatchInvestorLead
              key={investorId || i}
              match={m}
              rank={i}
              startupId={preview.startup?.id || startupId || ''}
              startupName={startupName}
              defaultOpen={i === 0}
              isAuthenticated={Boolean(isAuthenticated)}
              isPaid={isPaid}
              unlocked={Boolean(investorId && unlockedIds.includes(investorId))}
              replyTo={user?.email}
              onUnlocked={(id) => setUnlockedIds((prev) => (prev.includes(id) ? prev : [...prev, id]))}
              onNeedSignup={(id, name, firm) => handleSignup('save', { id, name, firm })}
              onNeedPlan={() => navigate('/pricing')}
            />
          );
        })}
      </ul>

      <div
        className="mt-2 pt-5"
        style={{ borderTop: '1px solid oklch(0.2 0.01 264)' }}
      >
        <p className="text-sm mb-4" style={{ color: TEXT }}>
          {nextCopy}
        </p>
        {canImproveNow && (
          <button
            type="button"
            onClick={openImproveOrSignup}
            className={`${NEXT_STEP_CTA_CLASS} mb-3`}
            style={IMPROVE_CTA_STYLE}
            onMouseEnter={(e) => paintImproveCta(e.currentTarget, true)}
            onMouseLeave={(e) => paintImproveCta(e.currentTarget, false)}
          >
            Improve my matches
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          disabled={saving}
          onClick={canImproveNow ? skipImprove : canConfirmRound ? openImproveOrSignup : () => handleSignup('save')}
          className={NEXT_STEP_CTA_CLASS}
          style={{ ...NEXT_STEP_CTA_STYLE, opacity: saving ? 0.7 : 1 }}
          onMouseEnter={(e) => paintNextStepCta(e.currentTarget, true)}
          onMouseLeave={(e) => paintNextStepCta(e.currentTarget, false)}
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : canImproveNow ? (
            isAuthenticated ? (
              'Skip — save my matches'
            ) : (
              'Skip — save my matches'
            )
          ) : canConfirmRound ? (
            'Confirm your round'
          ) : (
            'Save my matches'
          )}
          {!saving && <ArrowRight className="w-4 h-4" />}
        </button>
        {saveError && (
          <p className="mt-3 text-xs text-center" style={{ color: AMBER }}>
            {saveError}
          </p>
        )}
        <p className="mt-3 text-xs text-center" style={{ color: DIM }}>
          {isAuthenticated
            ? 'Saving keeps this shortlist on your profile and emails the ranked list to you.'
            : 'Saving creates a free account, emails this shortlist, and keeps it under Account.'}
        </p>
      </div>

      {improveMatchesOpen && preview.startup?.id && (
        <ImproveMatchesPanel
          startupId={preview.startup.id}
          startupUrl={url}
          currentGodScore={preview.startup.god_score}
          onClose={() => setImproveMatchesOpen(false)}
          onSkip={skipImprove}
          onCompleted={() => {
            if (!isAuthenticated) {
              setImproveUsed(recordImproveCompletion(preview.startup?.id));
            }
          }}
        />
      )}
    </div>
  );
}
