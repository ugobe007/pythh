/**
 * Rich “analyze” hero — URL field, live stats, signal preview panel.
 * Used on /signal-matches when no startup is connected (marketing entry to the tool).
 */

import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import PaywallModal from '../PaywallModal';
import HeroSignalPanel, { type FeaturedSignal } from './HeroSignalPanel';
import PythhWordmark from '../PythhWordmark';
import { HotMatchLogo } from '../FlameIcon';

import { supabase } from '../../lib/supabase';
import { fetchPlatformStats } from '../../lib/platformStats';
import { normalizeStartupUrl, canonicalizeStartupUrl } from '../../utils/normalizeUrl';
import { useUsageTracking } from '../../hooks/useUsageTracking';
import { useAuth } from '../../contexts/AuthContext';

const COMMON_TLD_TYPOS: Record<string, string> = {
  '.con': '.com', '.cmo': '.com', '.cpm': '.com', '.co m': '.com',
  '.og': '.org', '.oi': '.io', '.bet': '.net', '.ent': '.net',
  '.cm': '.com', '.om': '.com',
};

const STATIC_INVESTOR_SIGNALS = [
  { investor: 'Sequoia Capital',   signal: 8.7, delta: '+0.4', god: 76, vcp: 88, blocks: 5, sectors: ['AI/ML'] },
  { investor: 'Greylock Partners', signal: 8.2, delta: '0.0',  god: 73, vcp: 84, blocks: 4, sectors: ['SaaS'] },
  { investor: 'Founders Fund',     signal: 7.7, delta: '-0.2', god: 70, vcp: 80, blocks: 4, sectors: ['SpaceTech'] },
  { investor: 'a16z crypto',       signal: 7.2, delta: '-0.2', god: 67, vcp: 76, blocks: 3, sectors: ['FinTech'] },
  { investor: 'Lightspeed VP',     signal: 6.7, delta: '-0.2', god: 64, vcp: 72, blocks: 3, sectors: ['SaaS'] },
  { investor: 'Index Ventures',    signal: 6.2, delta: '-0.2', god: 61, vcp: 68, blocks: 2, sectors: ['DeepTech'] },
  { investor: 'Accel Partners',    signal: 5.9, delta: '+0.1', god: 58, vcp: 65, blocks: 2, sectors: ['SaaS'] },
  { investor: 'Benchmark',         signal: 5.4, delta: '0.0',  god: 55, vcp: 62, blocks: 2, sectors: ['AI/ML'] },
];

function Counter({
  target,
  duration = 2000,
  ready = true,
}: {
  target: number;
  duration?: number;
  ready?: boolean;
}) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!ready) return;
    if (target === 0) {
      setVal(0);
      return;
    }
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    const raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, ready]);
  if (!ready) return <>…</>;
  return <>{val.toLocaleString()}</>;
}

export default function PythhAnalyzeEntryHero() {
  const [url, setUrl]               = useState('');
  const [urlError, setUrlError]     = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused]       = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const [stats, setStats] = useState({ startups: 0, investors: 0, matches: 0 });
  const [statsReady, setStatsReady] = useState(false);
  const [investorSignals, setInvestorSignals] = useState(STATIC_INVESTOR_SIGNALS);

  const navigate = useNavigate();
  const { profile, refreshProfile } = useAuth();
  const { analysisCount, hasHitLimit, remainingAnalyses, trackAnalysis, FREE_ANALYSIS_LIMIT, isProFromServer } = useUsageTracking();
  const isPro = isProFromServer !== null ? isProFromServer : (profile?.plan !== 'free');

  useEffect(() => { refreshProfile(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    async function load() {
      const p = await fetchPlatformStats();
      setStats(p);
      setStatsReady(true);
    }
    load();
    const interval = setInterval(async () => {
      const p = await fetchPlatformStats();
      setStats(p);
      setStatsReady(true);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchInvestors() {
      try {
        const { data, error } = await supabase
          .from('investors')
          .select('name, firm, investor_score, investor_tier, sectors, score_breakdown')
          .or('investor_tier.eq.elite,investor_tier.eq.strong')
          .not('investor_score', 'is', null)
          .gte('investor_score', 6.5)
          .order('investor_score', { ascending: false })
          .limit(50);

        if (error || !data || data.length < 8 || cancelled) return;

        const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, 8);
        const signals = shuffled.map(inv => {
          const score = inv.investor_score || 6.5;
          const displayName = inv.firm && inv.firm !== inv.name && inv.firm !== '-'
            ? `${inv.name} — ${inv.firm}` : inv.name;
          const god    = Math.round(score * 9.2);
          const vcp    = Math.min(99, Math.round(score * 10.5));
          const delta  = ((Math.random() - 0.35) * 0.8).toFixed(1);
          const blocks = score >= 8.0 ? 5 : score >= 7.5 ? 4 : score >= 7.0 ? 3 : score >= 6.7 ? 2 : 1;
          return {
            investor: displayName.length > 40 ? displayName.slice(0, 38) + '…' : displayName,
            signal:   +score.toFixed(1),
            delta:    +delta >= 0 ? `+${delta}` : delta,
            god,
            vcp,
            blocks,
            sectors: Array.isArray(inv.sectors) ? inv.sectors : [],
          };
        });
        signals.sort((a, b) => b.signal - a.signal);
        if (!cancelled) setInvestorSignals(signals);
      } catch {}
    }
    fetchInvestors();
    const interval = setInterval(fetchInvestors, 45000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  const featuredSignals: FeaturedSignal[] = useMemo(() => {
    const WHY: Record<string, string> = {
      'AI/ML':    'Increased AI/ML deal activity +34% this quarter',
      SaaS:       'Enterprise SaaS valuations recovering — Series B window open',
      FinTech:    '3 new portfolio companies in payments infrastructure this month',
      BioTech:    'FDA fast-track trends driving early-stage BioTech interest',
      SpaceTech:  'Thesis shift detected: increasing hard tech, reducing consumer',
      DeepTech:   'Deep tech infrastructure thesis accelerating — 6 new LPs active',
      Climate:    'Climate tech fund cycle at deployment peak through Q3',
      Default:    'Active deployment signals detected across portfolio companies',
    };
    const top3 = investorSignals.slice(0, 3);
    return top3.map(inv => {
      const sector = inv.sectors?.[0] ?? 'AI/ML';
      const s = inv.signal;
      const base = Math.max(5, s - 2.5);
      const sparkline = [0, 1, 2, 3, 4, 5, 6].map(i =>
        +(base + (s - base) * (i / 6) + (Math.random() - 0.5) * 0.3).toFixed(1)
      );
      sparkline[6] = s;
      return {
        firm:      inv.investor,
        signal:    s,
        delta:     parseFloat(inv.delta) || 0,
        sector,
        why:       WHY[sector] ?? WHY.Default,
        sparkline,
      };
    });
  }, [investorSignals]);

  const submit = () => {
    const raw = url.trim();
    if (!raw || submitting) return;
    if (!isPro && hasHitLimit) { setShowPaywall(true); return; }

    setUrlError('');
    setSuggestion('');

    const normalized = normalizeStartupUrl(raw);
    if (!normalized) { setUrlError('Please enter a valid domain (e.g., example.com)'); return; }

    const host = normalized.split('/')[0] || normalized;
    const lowerHost = host.toLowerCase();
    for (const [typo, correct] of Object.entries(COMMON_TLD_TYPOS)) {
      if (lowerHost.endsWith(typo)) {
        setSuggestion(`https://${host.slice(0, -typo.length)}${correct}/`);
        setUrlError(`Did you mean ${correct}?`);
        return;
      }
    }
    if (!host.includes('.')) { setUrlError('Please enter a valid domain (e.g., example.com)'); return; }

    trackAnalysis();
    navigate(`/signal-matches?url=${encodeURIComponent(raw)}`);
  };

  const applySuggestion = () => {
    if (suggestion) { setUrl(suggestion); setSuggestion(''); setUrlError(''); }
  };

  return (
    <>
      <section
        className="relative flex min-h-[min(100vh,920px)] items-center overflow-hidden"
        style={{ background: '#080b10' }}
      >
        <div
          className="pointer-events-none absolute top-[30%] right-0 h-[500px] w-[600px]"
          style={{
            background: 'radial-gradient(ellipse, rgba(16,185,129,0.05) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-[1] mx-auto w-full max-w-[1280px] px-8 py-16 sm:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:gap-16">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <div
                id="pythh-analyze-hero-brand"
                className="mb-7 flex flex-wrap items-center gap-2.5"
              >
                <HotMatchLogo size="xs" className="flex-shrink-0" aria-hidden />
                <PythhWordmark size="sm" className="text-white/90" />
                <span className="pythh-live-dot" />
                <span className="pythh-label-caps">Live · Signal Intelligence</span>
              </div>

              <h1
                className="mb-6 font-extrabold tracking-tight text-[#f0f6fc]"
                style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontSize: 'clamp(2rem, 5vw, 3.75rem)',
                  lineHeight: 1.05,
                  letterSpacing: '-0.035em',
                }}
              >
                Find your investors using signal intelligence.
                <br />
                <span style={{ color: '#10b981' }}>Get funded.</span>
              </h1>

              <p
                className="mb-10 max-w-[480px] text-[clamp(0.9375rem,1.5vw,1.0625rem)] leading-relaxed"
                style={{ fontFamily: "'Inter', sans-serif", color: '#52616e' }}
              >
                Enter your startup URL. We analyze it and surface your top investor matches in ≈30 seconds — ranked by signal, not guesswork.
              </p>

              <div className="mb-4 max-w-[520px]">
                <div
                  className="flex overflow-hidden rounded-lg transition-[border-color,box-shadow]"
                  style={{
                    border: focused ? '1px solid rgba(16,185,129,0.55)' : '1px solid rgba(255,255,255,0.1)',
                    boxShadow: focused
                      ? '0 0 0 3px rgba(16,185,129,0.1), 0 4px 24px rgba(0,0,0,0.4)'
                      : '0 4px 24px rgba(0,0,0,0.3)',
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <input
                    data-testid="home-url-input"
                    type="text"
                    inputMode="url"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={url}
                    onChange={e => { setUrl(e.target.value); setUrlError(''); setSuggestion(''); }}
                    onKeyDown={e => e.key === 'Enter' && submit()}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    placeholder="https://yourstartup.com"
                    className="min-w-0 flex-1 border-0 bg-transparent px-4 py-3.5 outline-none"
                    style={{
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: '0.875rem',
                      color: '#e2e8f0',
                    }}
                  />
                  <button
                    data-testid="home-analyze-button"
                    type="button"
                    onClick={submit}
                    disabled={submitting}
                    className="pythh-btn-primary flex shrink-0 items-center gap-2 px-6"
                  >
                    {submitting ? 'Finding…' : (<>Find Signals <ArrowRight size={14} /></>)}
                  </button>
                </div>

                <div className="mt-2.5 min-h-[20px]">
                  {urlError ? (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-[0.72rem] text-red-500">{urlError}</span>
                      {suggestion && (
                        <button
                          type="button"
                          onClick={applySuggestion}
                          className="cursor-pointer rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[0.68rem] text-emerald-400"
                        >
                          Use &quot;{suggestion}&quot;
                        </button>
                      )}
                    </div>
                  ) : url.trim() ? (
                    <span className="font-mono text-[0.72rem]" style={{ color: '#2e3d4a' }}>
                      Will search:{' '}
                      <span style={{ color: '#94a3b8' }}>{canonicalizeStartupUrl(url)?.domain || url.trim()}</span>
                    </span>
                  ) : focused ? (
                    <span className="font-mono text-[0.72rem] tracking-wide text-emerald-500">
                      We&apos;ll analyze this in ≈30 seconds
                    </span>
                  ) : isPro ? (
                    <span className="font-mono text-[0.72rem] text-emerald-500">✦ Pro: Unlimited analyses</span>
                  ) : (
                    <span className="font-mono text-[0.72rem] tracking-wide" style={{ color: '#2e3d4a' }}>
                      {!hasHitLimit
                        ? '✦ Pro: Unlimited analyses'
                        : `${remainingAnalyses} free ${remainingAnalyses === 1 ? 'analysis' : 'analyses'} remaining`}
                    </span>
                  )}
                </div>
              </div>

              <div className="mb-6 flex flex-wrap items-center gap-5">
                {[
                  { n: stats.startups,  label: 'startups'  },
                  { n: stats.matches,   label: 'matches'   },
                  { n: stats.investors, label: 'investors' },
                ].map(({ n, label }) => (
                  <div key={label} className="flex items-baseline gap-1.5">
                    <span className="pythh-score-number text-[0.9375rem] text-[#e2e8f0]">
                      <Counter target={n} ready={statsReady} />
                    </span>
                    <span className="font-[family-name:Inter] text-[0.75rem]" style={{ color: '#2e3d4a' }}>
                      {label}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-1.5">
                  <span className="pythh-live-dot h-1.5 w-1.5" />
                  <span className="pythh-score-number text-[0.7rem] tracking-wide text-emerald-500">live</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {[
                  { label: 'Signal rankings by sector →', to: '/rankings',  primary: true },
                  { label: 'Browse startups',             to: '/explore',   primary: false },
                  { label: 'Find investors →',            to: '/lookup',    primary: false },
                ].map(({ label, to, primary }) => (
                  <Link
                    key={label}
                    to={to}
                    className="rounded-md px-2 py-1 text-[0.8125rem] no-underline transition-colors"
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      color: primary ? '#34d399' : '#64748b',
                      background: primary ? 'rgba(16,185,129,0.1)' : 'transparent',
                    }}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="hidden lg:block"
            >
              <div className="pythh-label-caps mb-2.5">Signals detected right now</div>
              <HeroSignalPanel liveSignals={featuredSignals} />
            </motion.div>
          </div>
        </div>
      </section>

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        analysisCount={analysisCount}
        analysisLimit={FREE_ANALYSIS_LIMIT}
      />
    </>
  );
}
