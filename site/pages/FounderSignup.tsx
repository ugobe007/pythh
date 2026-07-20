/**
 * /signup/founder — OAuth-first founder account (gate + direct signup).
 * Gate users arrive from instant-match preview (save / intro / export).
 */

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, CheckCircle2, Loader2, Activity, Bell, Target } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import SharedNavbar from '@/components/SharedNavbar';
import FounderSocialAuth from '@/components/FounderSocialAuth';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  buildFounderGateOAuthReturnPath,
  consumeFounderGatePending,
  consumePostSignupPath,
  peekFounderGatePending,
  postSignupPathForAction,
  trackFounderGateCompleted,
  FOUNDER_GATE_ACTION_LABELS,
  type FounderGatedAction,
} from '@/lib/founderSignupGate';
import { isOAuthHandoffActive } from '@/lib/supabaseOAuth';
import { sendFounderWelcomeEmail, sendFounderSignupInviteEmail } from '@/lib/founderAccount';
import { fetchGrowthAssignment, trackGrowthEvent } from '@/lib/growthExperiment';
import { trackFunnelEvent } from '@/lib/matchEngagement';

function readQueryParam(key: string): string {
  if (typeof window === 'undefined') return '';
  return new URLSearchParams(window.location.search).get(key)?.trim() || '';
}

export default function FounderSignup() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const loginMutation = trpc.auth.login.useMutation();
  const startedRef = useRef(false);
  const oauthHandledRef = useRef(false);

  const [gate] = useState(() => peekFounderGatePending());
  const [url] = useState(
    () => sessionStorage.getItem('pythia_url') || readQueryParam('url'),
  );
  const [startupId] = useState(
    () =>
      sessionStorage.getItem('pythia_startup_id') ||
      readQueryParam('startup_id') ||
      readQueryParam('startupId'),
  );
  const fromGate = gate.pending && Boolean(gate.action);
  const gateAction = gate.action as FounderGatedAction | null;
  const gateLabel = gateAction ? FOUNDER_GATE_ACTION_LABELS[gateAction] : null;
  const oauthReturnPath = buildFounderGateOAuthReturnPath(startupId, url);

  const [email, setEmail] = useState(() => sessionStorage.getItem('pythia_email') || '');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading || !isAuthenticated || oauthHandledRef.current) return;
    const pendingGate = peekFounderGatePending();
    if (!isOAuthHandoffActive() && !pendingGate.pending) {
      oauthHandledRef.current = true;
      navigate('/account');
      return;
    }

    const finishAuth = async () => {
      oauthHandledRef.current = true;
      const pendingGate = peekFounderGatePending();
      const userEmail = user?.email ?? sessionStorage.getItem('pythia_email') ?? '';
      if (userEmail) sessionStorage.setItem('pythia_email', userEmail);

      if (pendingGate.pending && startupId) {
        const { action: consumedAction } = consumeFounderGatePending();
        const resolvedAction = consumedAction ?? pendingGate.action ?? gateAction ?? 'save';
        await trackFounderGateCompleted({
          url: url || '',
          email: userEmail || undefined,
          startupId,
          gatedAction: resolvedAction,
        });
        if (userEmail && startupId) {
          sendFounderWelcomeEmail({
            email: userEmail,
            startupId,
            source: 'founder_signup_gate_oauth',
          });
        }
        const post = postSignupPathForAction(resolvedAction, startupId);
        navigate(post.includes('?') ? `${post}&welcome=1` : `${post}?welcome=1`);
        return;
      }

      const post = consumePostSignupPath();
      if (post) {
        navigate(post.includes('?') ? `${post}&welcome=1` : `${post}?welcome=1`);
        return;
      }
      if (startupId) {
        navigate(`/activate?startup_id=${encodeURIComponent(startupId)}&welcome=1`);
        return;
      }
      navigate('/account?welcome=1');
    };

    void finishAuth();
  }, [authLoading, isAuthenticated, navigate, startupId, url, gateAction, user?.email]);

  const trackDirectSignup = async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    const assignment =
      (await fetchGrowthAssignment('founder')) ?? {
        experiment_id: 'founder_hero_entry',
        variant_key: 'direct_signup',
        audience: 'founder' as const,
        schema: {},
        copy: {},
      };
    await trackGrowthEvent(assignment, 'founder_signup_started', {
      intent: 'direct_signup',
      url: url || undefined,
      startup_id: startupId || undefined,
    });
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    oauthHandledRef.current = true;
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      if (!fromGate) await trackDirectSignup();

      await loginMutation.mutateAsync({ email: trimmed });
      sessionStorage.setItem('pythia_email', trimmed);

      const { action: consumedAction } = consumeFounderGatePending();
      const resolvedAction = consumedAction ?? gateAction;

      if (fromGate || resolvedAction) {
        await trackFounderGateCompleted({
          url: url || '',
          email: trimmed,
          startupId,
          gatedAction: resolvedAction,
        });
        void trackFunnelEvent('lookup_signup_completed', {
          url,
          source: 'founder_signup_page',
          gated_action: resolvedAction,
          startup_id: startupId,
        });
        if (startupId) {
          sendFounderWelcomeEmail({
            email: trimmed,
            startupId,
            source: 'founder_signup_gate',
          });
        } else {
          sendFounderSignupInviteEmail({
            email: trimmed,
            source: 'founder_signup_gate',
          });
        }
      } else {
        const assignment =
          (await fetchGrowthAssignment('founder')) ?? {
            experiment_id: 'founder_hero_entry',
            variant_key: 'direct_signup',
            audience: 'founder' as const,
            schema: {},
            copy: {},
          };
        await trackGrowthEvent(assignment, 'founder_signup_completed', {
          intent: 'direct_signup',
          url: url || undefined,
          startup_id: startupId || undefined,
          email_provided: true,
        });
        if (startupId) {
          sendFounderWelcomeEmail({
            email: trimmed,
            startupId,
            source: 'founder_signup_page',
          });
        } else {
          sendFounderSignupInviteEmail({
            email: trimmed,
            source: 'founder_signup_page',
          });
        }
      }

      const postPath = consumePostSignupPath();
      if (postPath) {
        navigate(postPath.includes('?') ? `${postPath}&welcome=1` : `${postPath}?welcome=1`);
        return;
      }
      if (startupId) {
        navigate(`/activate?startup_id=${encodeURIComponent(startupId)}&welcome=1`);
        return;
      }
      if (url) {
        navigate(`/matches?url=${encodeURIComponent(url)}`);
        return;
      }
      navigate('/account?welcome=1');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create account. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const headline = fromGate ? 'Save your investor matches' : 'Start your autonomous raise';
  const subline = fromGate
    ? gateLabel
      ? `One click to ${gateLabel}. We'll attach your shortlist to your account — manual copy & send stays free.`
      : "Continue with Google or GitHub — we'll save your ranked investors and open outreach drafts."
    : 'Free account — Oracle tracks readiness, qualifies investors, and prepares outreach toward meetings.';

  if (authLoading || (isAuthenticated && !oauthHandledRef.current && (isOAuthHandoffActive() || fromGate))) {
    return (
      <>
        <Helmet>
          <title>Sign up — Pythh</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <SharedNavbar />
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 pt-20" style={{ backgroundColor: 'oklch(0.13 0.01 264)' }}>
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'oklch(0.696 0.17 162.48)' }} />
          <p className="text-sm" style={{ color: 'oklch(0.55 0.01 264)' }}>Completing sign-in…</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Sign up — Pythh</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <SharedNavbar />
      <div
        className="min-h-screen flex flex-col items-center justify-center px-4 pt-20 pb-12"
        style={{ backgroundColor: 'oklch(0.13 0.01 264)' }}
      >
        <div className="w-full max-w-md">
          <h1
            className="font-display font-bold text-2xl sm:text-3xl mb-3 text-center"
            style={{ color: 'oklch(0.97 0.005 264)' }}
          >
            {headline}
          </h1>
          <p className="text-sm text-center mb-8 leading-relaxed" style={{ color: 'oklch(0.55 0.01 264)' }}>
            {subline}
          </p>

          {fromGate && url && (
            <div
              className="mb-4 px-4 py-3 rounded-lg text-xs text-center"
              style={{
                backgroundColor: 'oklch(0.696 0.17 162.48 / 0.1)',
                border: '1px solid oklch(0.696 0.17 162.48 / 0.25)',
                color: 'oklch(0.85 0.05 162.48)',
              }}
            >
              Matches loaded for {url.replace(/^https?:\/\//, '').split('/')[0]}
            </div>
          )}

          {fromGate && (
            <div className="grid gap-3 mb-6 text-left">
              {[
                { icon: Target, label: 'Your shortlist saved', detail: 'Track intros, exports, and outreach from one place.' },
                { icon: Bell, label: 'Match movement alerts', detail: 'See when investors move toward or away from your thesis.' },
                { icon: Activity, label: 'Outreach drafts unlocked', detail: 'Copy emails now — automate later with Scout if you want.' },
              ].map(({ icon: Icon, label, detail }) => (
                <div
                  key={label}
                  className="flex gap-3 px-4 py-3 rounded-lg"
                  style={{ backgroundColor: 'oklch(0.16 0.01 264)', border: '1px solid oklch(0.22 0.01 264)' }}
                >
                  <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'oklch(0.696 0.17 162.48)' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'oklch(0.94 0.005 264)' }}>{label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'oklch(0.5 0.01 264)' }}>{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!fromGate && (
            <div className="grid gap-3 mb-6 text-left">
              {[
                { icon: Target, label: 'Your raise plan', detail: 'Readiness gaps, qualified investors, and recommended campaign.' },
                { icon: Bell, label: 'Oracle progress updates', detail: 'Weekly summary of what Pythh completed and what needs your decision.' },
                { icon: Activity, label: 'Meeting pipeline', detail: 'Outreach and scheduling toward qualified investor meetings.' },
              ].map(({ icon: Icon, label, detail }) => (
                <div
                  key={label}
                  className="flex gap-3 px-4 py-3 rounded-lg"
                  style={{ backgroundColor: 'oklch(0.16 0.01 264)', border: '1px solid oklch(0.22 0.01 264)' }}
                >
                  <Icon className="w-4 h-4 shrink-0 mt-0.5" style={{ color: 'oklch(0.696 0.17 162.48)' }} />
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'oklch(0.94 0.005 264)' }}>{label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'oklch(0.5 0.01 264)' }}>{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div
            className="rounded-xl p-6 border"
            style={{ backgroundColor: 'oklch(0.16 0.01 264)', borderColor: 'oklch(0.25 0.01 264)' }}
          >
            <FounderSocialAuth
              returnPath={oauthReturnPath}
              disabled={submitting}
              onError={setError}
            />

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ backgroundColor: 'oklch(0.25 0.01 264)' }} />
              <span className="text-xs" style={{ color: 'oklch(0.45 0.01 264)' }}>or email</span>
              <div className="flex-1 h-px" style={{ backgroundColor: 'oklch(0.25 0.01 264)' }} />
            </div>

            <form onSubmit={handleEmailSubmit}>
              <label className="block text-xs font-semibold mb-2 tracking-widest" style={{ color: 'oklch(0.5 0.01 264)' }}>
                YOUR EMAIL
              </label>
              <input
                type="email"
                placeholder="you@yourstartup.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border text-sm mb-4 outline-none"
                style={{
                  backgroundColor: 'oklch(0.13 0.01 264)',
                  borderColor: error ? 'oklch(0.65 0.2 27)' : 'oklch(0.3 0.01 264)',
                  color: 'oklch(0.94 0.005 264)',
                }}
              />
              {error && (
                <p className="text-xs mb-4" style={{ color: 'oklch(0.65 0.2 27)' }}>
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={submitting || !email.trim().includes('@')}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-semibold text-sm transition-all disabled:opacity-60"
                style={{
                  backgroundColor: 'oklch(0.696 0.17 162.48 / 0.15)',
                  color: 'oklch(0.696 0.17 162.48)',
                  border: '1px solid oklch(0.696 0.17 162.48 / 0.35)',
                }}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {fromGate ? 'Continue with email' : 'Sign up with email'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs" style={{ color: 'oklch(0.4 0.01 264)' }}>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={11} style={{ color: 'oklch(0.696 0.17 162.48)' }} /> No credit card
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 size={11} style={{ color: 'oklch(0.696 0.17 162.48)' }} /> Free to copy & send
            </span>
            {fromGate && (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 size={11} style={{ color: 'oklch(0.696 0.17 162.48)' }} /> Matches stay saved
              </span>
            )}
          </div>

          <p className="text-center text-xs mt-8" style={{ color: 'oklch(0.45 0.01 264)' }}>
            Already have an account?{' '}
            <Link
              href={`/login?redirect=${encodeURIComponent(oauthReturnPath)}`}
              className="underline hover:no-underline"
              style={{ color: 'oklch(0.696 0.17 162.48)' }}
            >
              Sign in
            </Link>
            {startupId && url && (
              <>
                {' '}
                ·{' '}
                <Link
                  href={`/matches?url=${encodeURIComponent(url)}`}
                  className="underline hover:no-underline"
                  style={{ color: 'oklch(0.696 0.17 162.48)' }}
                >
                  Back to match preview
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </>
  );
}
