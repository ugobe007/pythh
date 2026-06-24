/**
 * /find-investors — SEO + awareness landing (first-time founders, no network).
 * Feeds the same preview funnel as /matches?url=
 */

import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'wouter';
import { ArrowRight, CheckCircle2, Users, Zap, Target } from 'lucide-react';
import SharedNavbar from '@/components/SharedNavbar';
import { trackFunnelEventOnce } from '@/lib/matchEngagement';
import { fetchGrowthAssignment, trackGrowthEvent } from '@/lib/growthExperiment';

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
}

export default function FindInvestors() {
  const [, navigate] = useLocation();
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    void trackFunnelEventOnce('pythh_find_investors_view', 'page_view', {
      path: '/find-investors',
      source: 'awareness_landing',
    });
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setError(true);
      return;
    }
    setError(false);
    const assignment = await fetchGrowthAssignment('founder').catch(() => null);
    if (assignment) {
      void trackGrowthEvent(assignment, 'founder_url_submitted', {
        url: normalized,
        source: 'find_investors_landing',
      });
    }
    navigate(`/matches?url=${encodeURIComponent(normalized)}`);
  };

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: 'oklch(0.09 0.01 264)', color: 'oklch(0.9 0.01 264)' }}
    >
      <Helmet>
        <title>Find investors for your startup — free match preview — Pythh</title>
        <meta
          name="description"
          content="First-time founder? No investor network? Paste your startup URL and see ranked VC and angel matches in ~60 seconds — free, no signup."
        />
        <meta
          name="keywords"
          content="find investors startup, first time founder fundraising, investor matching, no warm intro, free investor list"
        />
        <link rel="canonical" href="https://pythh.ai/find-investors" />
        <meta property="og:title" content="Find investors — free shortlist in 60 seconds" />
        <meta property="og:url" content="https://pythh.ai/find-investors" />
      </Helmet>

      <SharedNavbar activePath="/find-investors" />

      <main className="container max-w-3xl pt-28 pb-24 px-4">
        <p className="text-[11px] uppercase tracking-[2px] text-emerald-400 mb-4">
          No warm intro required
        </p>
        <h1 className="text-3xl sm:text-5xl font-bold text-white leading-tight mb-4">
          First-time founder? See who would actually fund you.
        </h1>
        <p className="text-lg text-zinc-400 mb-8 max-w-2xl leading-relaxed">
          Paste your startup URL. Pythh maps your thesis, stage, and traction against thousands of
          active investors — then shows your ranked shortlist before you create an account.
        </p>

        <form
          onSubmit={(e) => void submit(e)}
          className="p-6 sm:p-8 rounded-2xl mb-10"
          style={{
            backgroundColor: 'oklch(0.115 0.01 264)',
            border: `1px solid ${error ? 'oklch(0.65 0.2 27 / 0.5)' : 'oklch(0.696 0.17 162.48 / 0.35)'}`,
          }}
        >
          <label className="block text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">
            Your startup URL
          </label>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(false);
              }}
              placeholder="yourstartup.com"
              className="flex-1 px-4 py-3.5 rounded-lg text-sm bg-zinc-950 border border-zinc-700 text-white outline-none focus:border-emerald-500/50"
              autoFocus
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              Preview my matches
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-400 mt-2">Enter a valid startup URL to continue.</p>
          )}
          <p className="text-[11px] text-zinc-500 mt-4">Free · ~60 seconds · No credit card</p>
        </form>

        <div className="grid sm:grid-cols-3 gap-4 mb-12">
          {[
            { icon: Zap, title: '60-second preview', desc: 'Ranked investors with fit scores before signup' },
            { icon: Users, title: 'No network needed', desc: 'Built for founders without warm intros' },
            { icon: Target, title: 'Thesis-level matching', desc: 'Sector, stage, timing — not keyword search' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/40">
              <Icon className="w-5 h-5 text-emerald-400 mb-2" />
              <p className="text-sm font-semibold text-white mb-1">{title}</p>
              <p className="text-xs text-zinc-500 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>

        <ul className="space-y-2 text-sm text-zinc-400">
          {[
            'Full shortlist reveal — no account required',
            'Request intros or save your list with a free account',
            'Upgrade to Oracle for automated outreach and meeting prep',
          ].map((line) => (
            <li key={line} className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              {line}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
