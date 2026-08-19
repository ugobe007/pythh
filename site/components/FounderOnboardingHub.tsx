/**
 * Post-signup founder hub — resume matches, outreach, or improvements, or analyze a new URL.
 */

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Activity, ArrowRight, Bell, Sparkles, Target, Zap } from 'lucide-react';
import { trackFunnelEvent } from '@/lib/matchEngagement';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/_core/hooks/useAuth';
import {
  getPinnedStartupId,
  getPinnedStartupName,
  getPinnedStartupUrl,
  pinActiveStartup,
} from '@/lib/activeStartupContext';
import {
  allowWizardUnlockFlow,
  improvementsPath,
  matchesPathForUrl,
  outreachPath,
} from '@/lib/founderSignupGate';

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

type Props = {
  userName?: string | null;
  welcome?: boolean;
};

export default function FounderOnboardingHub({ userName, welcome }: Props) {
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();
  const { data: profile } = trpc.profile.get.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const [localPinned] = useState(() => ({
    id: getPinnedStartupId(),
    url: getPinnedStartupUrl(),
    name: getPinnedStartupName(),
  }));
  const pinned = {
    id: localPinned.id || profile?.startupId || null,
    url: localPinned.url || profile?.companyUrl || null,
    name: localPinned.name || profile?.companyName || null,
  };
  const hasPinnedStartup = Boolean(pinned.id && pinned.url);

  useEffect(() => {
    if (!localPinned.id && profile?.startupId) {
      pinActiveStartup(profile.startupId, profile.companyUrl || undefined, profile.companyName || undefined);
    }
  }, [localPinned.id, profile?.startupId, profile?.companyUrl, profile?.companyName]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError(true);
      return;
    }
    setError(false);
    sessionStorage.setItem('pythia_url', normalized);
    void trackFunnelEvent('url_submitted', {
      url: normalized,
      source: 'account_onboarding',
    });
    navigate(matchesPathForUrl(normalized));
  };

  const firstName = userName?.split(' ')[0];
  const companyLabel = pinned.name || 'your startup';

  return (
    <div className="max-w-xl mx-auto w-full">
      {welcome && (
        <div
          className="mb-6 px-4 py-3 rounded-xl text-sm text-center"
          style={{
            backgroundColor: 'oklch(0.696 0.17 162.48 / 0.1)',
            border: '1px solid oklch(0.696 0.17 162.48 / 0.25)',
            color: 'oklch(0.85 0.05 162.48)',
          }}
        >
          Account created{firstName ? `, ${firstName}` : ''}
          {hasPinnedStartup
            ? ` — ${companyLabel} is saved. Pick up matches, outreach, or optional improvements.`
            : ' — investor tracking is on. Paste your URL to load your shortlist.'}
        </div>
      )}

      <div className="text-center mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5"
          style={{
            backgroundColor: 'oklch(0.696 0.17 162.48 / 0.1)',
            border: '1px solid oklch(0.696 0.17 162.48 / 0.25)',
          }}
        >
          <Activity size={26} style={{ color: 'oklch(0.696 0.17 162.48)' }} />
        </div>
        <h2 className="font-display font-bold text-2xl mb-2" style={{ color: 'oklch(0.97 0.005 264)' }}>
          {hasPinnedStartup ? `Continue with ${companyLabel}` : 'Track your investor matches'}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'oklch(0.55 0.01 264)' }}>
          {hasPinnedStartup
            ? 'Matches stay the primary path. Outreach and Oracle improvements are optional and never restart your shortlist.'
            : 'Paste your startup URL to see ranked investors, save your shortlist, and open outreach drafts — free.'}
        </p>
      </div>

      {hasPinnedStartup && pinned.id && pinned.url && (
        <div className="grid gap-2 mb-8">
          <button
            type="button"
            onClick={() => navigate(matchesPathForUrl(pinned.url))}
            className="flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-left"
            style={{ backgroundColor: 'oklch(0.696 0.17 162.48)', color: 'oklch(0.13 0.01 264)' }}
          >
            <span>
              <span className="block text-sm font-semibold">Open match list</span>
              <span className="block text-[11px] opacity-80">Review ranked investors and continue to outreach</span>
            </span>
            <Target size={16} />
          </button>
          <button
            type="button"
            onClick={() => navigate(outreachPath(pinned.id!))}
            className="flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-left border"
            style={{ backgroundColor: 'oklch(0.14 0.01 264)', borderColor: 'oklch(0.22 0.01 264)', color: 'oklch(0.9 0.005 264)' }}
          >
            <span>
              <span className="block text-sm font-semibold">Open outreach drafts</span>
              <span className="block text-[11px]" style={{ color: 'oklch(0.5 0.01 264)' }}>Personalize and send investor emails</span>
            </span>
            <Zap size={16} style={{ color: 'oklch(0.696 0.17 162.48)' }} />
          </button>
          <button
            type="button"
            onClick={() => {
              allowWizardUnlockFlow();
              navigate(improvementsPath(pinned.id!, 'matches'));
            }}
            className="flex items-center justify-between gap-3 rounded-xl px-4 py-3.5 text-left border"
            style={{ backgroundColor: 'oklch(0.14 0.01 264)', borderColor: 'rgba(34,211,238,0.25)', color: 'oklch(0.9 0.005 264)' }}
          >
            <span>
              <span className="block text-sm font-semibold">Optional Oracle improvements</span>
              <span className="block text-[11px]" style={{ color: 'oklch(0.5 0.01 264)' }}>Three priorities — returns to your match list</span>
            </span>
            <Sparkles size={16} style={{ color: '#22d3ee' }} />
          </button>
        </div>
      )}

      <form
        onSubmit={submit}
        className="rounded-xl p-5 border mb-6"
        style={{
          backgroundColor: 'oklch(0.14 0.01 264)',
          borderColor: error ? 'oklch(0.65 0.2 27 / 0.5)' : 'oklch(0.696 0.17 162.48 / 0.3)',
        }}
      >
        <label className="block text-xs font-bold tracking-widest mb-2" style={{ color: 'oklch(0.45 0.01 264)' }}>
          {hasPinnedStartup ? 'ANALYZE A DIFFERENT COMPANY' : 'YOUR STARTUP URL'}
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(false);
            }}
            placeholder="yourstartup.com"
            className="flex-1 px-4 py-3 rounded-lg text-sm outline-none border"
            style={{
              backgroundColor: 'oklch(0.11 0.01 264)',
              borderColor: 'oklch(0.25 0.01 264)',
              color: 'oklch(0.94 0.005 264)',
            }}
            autoFocus={!hasPinnedStartup}
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold shrink-0"
            style={{ backgroundColor: hasPinnedStartup ? 'oklch(0.18 0.01 264)' : 'oklch(0.696 0.17 162.48)', color: hasPinnedStartup ? 'oklch(0.9 0.005 264)' : 'oklch(0.13 0.01 264)' }}
          >
            See matches
            <ArrowRight size={15} />
          </button>
        </div>
        {error && (
          <p className="text-xs mt-2" style={{ color: 'oklch(0.65 0.2 27)' }}>
            Enter a valid startup URL.
          </p>
        )}
      </form>

      {!hasPinnedStartup && (
      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        {[
          { icon: Target, label: 'Ranked shortlist', detail: 'Thesis-fit investors with scores' },
          { icon: Bell, label: 'Movement alerts', detail: 'Watch when matches shift' },
          { icon: Activity, label: 'Intro pipeline', detail: 'Queue warm intros from wizard' },
        ].map(({ icon: Icon, label, detail }) => (
          <div
            key={label}
            className="p-3 rounded-lg border text-left"
            style={{ backgroundColor: 'oklch(0.12 0.01 264)', borderColor: 'oklch(0.2 0.01 264)' }}
          >
            <Icon size={14} className="mb-1.5" style={{ color: 'oklch(0.696 0.17 162.48)' }} />
            <p className="text-xs font-semibold" style={{ color: 'oklch(0.9 0.005 264)' }}>{label}</p>
            <p className="text-[10px] mt-0.5 leading-relaxed" style={{ color: 'oklch(0.45 0.01 264)' }}>{detail}</p>
          </div>
        ))}
      </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        <Link href="/find-investors">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium border"
            style={{
              borderColor: 'oklch(0.25 0.01 264)',
              color: 'oklch(0.65 0.01 264)',
              backgroundColor: 'transparent',
            }}
          >
            Learn how matching works
          </button>
        </Link>
        <Link href="/pricing">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium"
            style={{ color: 'oklch(0.769 0.188 70.08)' }}
          >
            Upgrade to Oracle
            <ArrowRight size={14} />
          </button>
        </Link>
      </div>
    </div>
  );
}
