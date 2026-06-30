/**
 * Post-signup founder hub — paste URL, track investors, open wizard.
 */

import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Activity, ArrowRight, Bell, Target } from 'lucide-react';
import { trackFunnelEvent } from '@/lib/matchEngagement';

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
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);

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
    navigate(`/matches?url=${encodeURIComponent(normalized)}`);
  };

  const firstName = userName?.split(' ')[0];

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
          Account created{firstName ? `, ${firstName}` : ''} — investor tracking is on. Paste your URL to load your shortlist.
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
          Track your investor matches
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'oklch(0.55 0.01 264)' }}>
          Paste your startup URL to see ranked investors, save your shortlist, and open your intro pipeline — free.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="rounded-xl p-5 border mb-6"
        style={{
          backgroundColor: 'oklch(0.14 0.01 264)',
          borderColor: error ? 'oklch(0.65 0.2 27 / 0.5)' : 'oklch(0.696 0.17 162.48 / 0.3)',
        }}
      >
        <label className="block text-xs font-bold tracking-widest mb-2" style={{ color: 'oklch(0.45 0.01 264)' }}>
          YOUR STARTUP URL
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
            autoFocus
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-sm font-semibold shrink-0"
            style={{ backgroundColor: 'oklch(0.696 0.17 162.48)', color: 'oklch(0.13 0.01 264)' }}
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
