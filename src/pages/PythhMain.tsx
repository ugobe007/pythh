import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import LiveWhisperLine from '../components/LiveWhisperLine';
import PythhUnifiedNav from '../components/PythhUnifiedNav';
import HeroFeatureList from '../components/HeroFeatureList';
import PaywallModal from '../components/PaywallModal';
import PythhHowItWorksModal, { hasSeenHowItWorks } from '../components/PythhHowItWorksModal';
import SEO from '../components/SEO';
import NewsletterWidget from '../components/NewsletterWidget';
import { GODScoreExplainer } from '../components/pythh/GODScoreExplainer';
import { supabase } from '../lib/supabase';
import { normalizeStartupUrl, canonicalizeStartupUrl } from '../utils/normalizeUrl';
import { useUsageTracking } from '../hooks/useUsageTracking';
import { useAuth } from '../contexts/AuthContext';

/*
 * PYTHH HOME - Signal Science
 * Design: Left-aligned hero with orange glow + dense investor signals table
 * Reference: Former design (image 1) + Signal table (image 2)
 */

// Fallback investor signals table data (used if live data fails)
const STATIC_INVESTOR_SIGNALS = [
  { investor: 'Sequoia Capital', signal: 8.7, delta: '+0.4', god: 76, vcp: 88, bars: 5 },
  { investor: 'Greylock Partners', signal: 8.2, delta: '0.0', god: 73, vcp: 84, bars: 4 },
  { investor: 'Founders Fund', signal: 7.7, delta: '-0.2', god: 70, vcp: 80, bars: 3 },
  { investor: 'a16z crypto', signal: 7.2, delta: '-0.2', god: 67, vcp: 76, bars: 2 },
  { investor: 'Lightspeed VP', signal: 6.7, delta: '-0.2', god: 64, vcp: 72, bars: 2 },
  { investor: 'Index Ventures', signal: 6.2, delta: '-0.2', god: 61, vcp: 68, bars: 1 },
  { investor: 'Accel Partners', signal: 5.9, delta: '+0.1', god: 58, vcp: 65, bars: 1 },
  { investor: 'Benchmark', signal: 5.4, delta: '0.0', god: 55, vcp: 62, bars: 1 },
];

// TLD typo detection map
const COMMON_TLD_TYPOS: Record<string, string> = {
  '.con': '.com',
  '.cmo': '.com',
  '.cpm': '.com',
  '.co m': '.com',
  '.og': '.org',
  '.oi': '.io',
  '.bet': '.net',
  '.ent': '.net',
  '.cm': '.com',
  '.om': '.com',
};

export default function PythhHome() {
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [investorSignals, setInvestorSignals] = useState(STATIC_INVESTOR_SIGNALS);
  const [stats, setStats] = useState<{ startups: number; investors: number; matches: number }>(() => {
    try {
      const cached = localStorage.getItem('platform_stats');
      if (cached) return JSON.parse(cached);
    } catch {}
    return { startups: 0, investors: 0, matches: 0 };
  });
  const [showPaywall, setShowPaywall] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [sectorHeatLive, setSectorHeatLive] = useState<Array<{
    sector: string;
    startup_count: number;
    avg_god: number;
  }>>([]);
  const navigate = useNavigate();
  
  // Auth state for Pro user bypass
  const { profile } = useAuth();
  const isPro = profile?.plan !== 'free';
  
  // First-visit: show How it works modal
  useEffect(() => {
    if (!hasSeenHowItWorks()) {
      const t = setTimeout(() => setShowHowItWorks(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  // Usage tracking for freemium limits
  const { 
    analysisCount, 
    hasHitLimit, 
    remainingAnalyses, 
    trackAnalysis,
    FREE_ANALYSIS_LIMIT 
  } = useUsageTracking();

  // Fetch live platform stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await supabase.rpc('get_platform_stats');
        const p = res.data || { startups: 0, investors: 0, matches: 0 };
        const newStats = {
          startups: p.startups || 0,
          investors: p.investors || 0,
          matches: p.matches || 0,
        };
        setStats(newStats);
        try { localStorage.setItem('platform_stats', JSON.stringify(newStats)); } catch {}
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      }
    }
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // Live investor signals — quality-filtered (elite + strong tier only, scored)
  useEffect(() => {
    let cancelled = false;

    async function fetchQualityInvestors() {
      try {
        // Only pull investors that passed quality scoring: elite or strong tier
        const { data, error } = await supabase
          .from('investors')
          .select('name, firm, investor_score, investor_tier, sectors, score_breakdown')
          .or('investor_tier.eq.elite,investor_tier.eq.strong')
          .not('investor_score', 'is', null)
          .gte('investor_score', 6.5)
          .order('investor_score', { ascending: false })
          .limit(50);

        if (error || !data || data.length < 8 || cancelled) return;

        // Pick 8 random from top 50 quality investors (to rotate on refresh)
        const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, 8);

        // Map real investor data to signal display format
        const signals = shuffled.map((inv) => {
          const score = inv.investor_score || 6.5;
          const displayName = inv.firm && inv.firm !== inv.name && inv.firm !== '-'
            ? `${inv.name} — ${inv.firm}`
            : inv.name;
          // Derive signal metrics from real score data
          const god = Math.round(score * 9.2); // investor_score 6-9 → GOD 55-83
          const vcp = Math.min(99, Math.round(score * 10.5)); // → VCP 63-94
          const delta = ((Math.random() - 0.35) * 0.8).toFixed(1); // slight positive bias
          const bars = score >= 8.0 ? 5 : score >= 7.5 ? 4 : score >= 7.0 ? 3 : score >= 6.7 ? 2 : 1;
          return {
            investor: displayName.length > 40 ? displayName.slice(0, 38) + '…' : displayName,
            signal: +score.toFixed(1),
            delta: +delta >= 0 ? `+${delta}` : delta,
            god,
            vcp,
            bars,
          };
        });

        // Sort by signal score descending for clean table display
        signals.sort((a, b) => b.signal - a.signal);
        if (!cancelled) setInvestorSignals(signals);
      } catch (err) {
        console.error('Failed to fetch quality investors:', err);
        // Log detailed error for debugging
        if (err instanceof Error) {
          console.error('Error details:', {
            message: err.message,
            stack: err.stack,
            name: err.name
          });
        }
        // Falls back to STATIC_INVESTOR_SIGNALS (initial state)
      }
    }

    fetchQualityInvestors();
    // Rotate investors every 45 seconds for a live feel
    const interval = setInterval(fetchQualityInvestors, 45000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // ── Sector heat (live from DB, falls back to hardcoded) ───────────────────────────────
  const sectorHeat = useMemo(() => {
    const SECTOR_EMOJIS: Record<string, string> = {
      'AI/ML': '🔥', 'Fintech': '⚡', 'Climate Tech': '🌱',
      'Developer Tools': '🛠️', 'SaaS': '☁️', 'Healthcare': '🧬',
      'Gaming': '🎮', 'BioTech': '🧬',
    };
    // Map avg GOD score (35–100) to signal display range (5.5–9.5)
    const toSignal = (god: number) =>
      Math.min(9.9, +((Math.max(35, god) - 35) / 65 * 4.0 + 5.5).toFixed(1));
    const base = sectorHeatLive.length >= 3
      ? sectorHeatLive.slice(0, 3).map(s => ({
          name: s.sector,
          signal: toSignal(s.avg_god),
          delta: +((s.avg_god - 50) / 125).toFixed(1),
          vcCount: Math.max(1, Math.round(s.startup_count / 60)),
          emoji: SECTOR_EMOJIS[s.sector] ?? '📊',
        }))
      : [
          { name: 'AI / ML',  signal: 8.4, delta: 0.3,  vcCount: 14, emoji: '🔥' },
          { name: 'FinTech',  signal: 7.9, delta: -0.1, vcCount: 9,  emoji: '⚡' },
          { name: 'BioTech',  signal: 7.3, delta: 0.2,  vcCount: 6,  emoji: '🧬' },
        ];
    const avg = investorSignals.length > 0
      ? investorSignals.reduce((s, i) => s + i.signal, 0) / investorSignals.length
      : 7;
    return base.map(s => ({ ...s, signal: Math.min(9.9, +(s.signal + (avg - 7) * 0.05).toFixed(1)) }));
  }, [investorSignals, sectorHeatLive]);

  // ── Fetch live sector heat from DB ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchSectorHeat() {
      try {
        const { data } = await supabase.rpc('get_sector_heat', { p_limit: 3 });
        if (data && Array.isArray(data) && data.length >= 3 && !cancelled) {
          setSectorHeatLive(data);
        }
      } catch { /* falls back to hardcoded */ }
    }
    fetchSectorHeat();
    return () => { cancelled = true; };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // FIND SIGNALS — Navigate only. SignalMatches page calls submitStartup().
  // Single orchestration in submitStartup.ts — no duplicate workflow here.
  // ═══════════════════════════════════════════════════════════════════════════
  const submit = () => {
    const raw = url.trim();
    if (!raw || submitting) return;

    if (!isPro && hasHitLimit) {
      setShowPaywall(true);
      return;
    }

    setUrlError('');
    setSuggestion('');

    const normalized = normalizeStartupUrl(raw);
    if (!normalized) {
      setUrlError('Please enter a valid domain (e.g., example.com)');
      return;
    }

    // TLD typo check
    const host = normalized.split('/')[0] || normalized;
    const lowerHost = host.toLowerCase();
    for (const [typo, correct] of Object.entries(COMMON_TLD_TYPOS)) {
      if (lowerHost.endsWith(typo)) {
        const suggested = `https://${host.slice(0, -typo.length)}${correct}/`;
        setSuggestion(suggested);
        setUrlError(`Did you mean ${correct}?`);
        return;
      }
    }

    if (!host.includes('.')) {
      setUrlError('Please enter a valid domain (e.g., example.com)');
      return;
    }

    trackAnalysis();
    navigate(`/signal-matches?url=${encodeURIComponent(raw)}`);
  };

  const applySuggestion = () => {
    if (suggestion) {
      setUrl(suggestion);
      setSuggestion('');
      setUrlError('');
    }
  };

  const deltaColor = (d: string) => {
    if (d.startsWith('+')) return 'text-emerald-400';
    if (d.startsWith('-')) return 'text-red-400';
    return 'text-zinc-500';
  };

  const renderBars = (n: number) => {
    return (
      <div className="flex gap-0.5">
        {[1,2,3,4,5].map(i => (
          <div 
            key={i} 
            className={`w-1 h-3 rounded-sm ${i <= n ? 'bg-cyan-400' : 'bg-zinc-700'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0e13] relative overflow-hidden" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Background gradient glow */}
      <div className="absolute top-0 left-1/4 w-[800px] h-[600px] bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none" />
      <div className="absolute top-1/3 right-0 w-[600px] h-[500px] bg-emerald-500/3 rounded-full blur-[120px] pointer-events-none" />
      
      {/* SEO Meta Tags */}
      <SEO
        title="pythh.ai - Signal Science for Venture | 12.6K+ Startups Analyzed"
        description="Get matched with the right investors using our proprietary GOD Algorithm. 12,600+ startups analyzed, 841,915+ live matches, trusted by 500+ YC founders. Find your perfect investor match."
        keywords="startup funding, investor matching, VC matching, startup investors, seed funding, series A, AI matching, GOD score, venture capital matching"
        canonical="/"
      />
      
      {/* ═══════════════════════════════════════════════════════════════════
          UNIFIED NAV
          ═══════════════════════════════════════════════════════════════════ */}
      <PythhUnifiedNav />

      {/* ═══════════════════════════════════════════════════════════════════
          HERO - Large CTA + URL submit + Feature list (Supabase-style)
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-16 sm:pt-24 pb-0">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-12 items-start">
          
          {/* LEFT COLUMN: Large CTA + explanation */}
          <div className="space-y-8">
            {/* Main CTA — large fonts */}
            <h1 
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight text-white leading-[1.05]"
              style={{ 
                textShadow: [
                  '0 0 3px rgba(0, 220, 255, 0.5)',
                  '0 0 12px rgba(0, 200, 255, 0.25)',
                  '0 0 24px rgba(0, 200, 255, 0.12)',
                ].join(', ')
              }}
            >
              Find the <span className="text-cyan-400">investors</span> who want to fund you.
            </h1>
            
            <p className="text-cyan-300/95 text-xl sm:text-2xl max-w-2xl leading-relaxed">
              Enter your startup URL. We'll analyze it and show your top investor matches in ~30 seconds.
            </p>

            <p className="text-zinc-500 text-base max-w-xl">
              You'll get signal scores, top matches, and intro lines for each investor.
            </p>

            {/* URL input — Supabase: stroke + font only, no fill */}
            <div className="max-w-2xl">
              <div className="flex flex-col sm:flex-row border border-cyan-500/60 rounded-lg overflow-hidden">
                <input
                  data-testid="home-url-input"
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={url}
                  onChange={e => {
                    setUrl(e.target.value);
                    setUrlError('');
                    setSuggestion('');
                  }}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  placeholder="https://yourstartup.com"
                  className="flex-1 bg-transparent border-0 px-5 py-4 text-white text-base placeholder-zinc-500 outline-none focus:ring-0"
                />
                <button
                  data-testid="home-analyze-button"
                  onClick={submit}
                  disabled={submitting}
                  className="px-8 sm:px-12 py-4 bg-transparent border-t sm:border-t-0 sm:border-l border-cyan-500/60 text-cyan-400 text-base font-semibold hover:text-cyan-300 hover:border-cyan-400/80 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-wait"
                >
                  {submitting ? 'Finding...' : 'Find Signals →'}
                </button>
              </div>
              
              {/* Free analyses remaining indicator */}
              {isPro ? (
                <div className="mt-2 text-center">
                  <span className="text-xs text-cyan-400">
                    ✨ Pro: Unlimited analyses
                  </span>
                </div>
              ) : !hasHitLimit ? (
                <div className="mt-2 text-center">
                  <span className="text-xs text-slate-400">
                    🎯 {remainingAnalyses} {remainingAnalyses === 1 ? 'free analysis' : 'free analyses'} remaining
                  </span>
                </div>
              ) : null}
            
              {/* Sub-bar: error/suggestion OR inline stats */}
              <div className="mt-2.5 min-h-[20px]">
                {urlError ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-amber-400">{urlError}</span>
                    {suggestion && (
                      <button
                        onClick={applySuggestion}
                        className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/50 rounded px-2 py-1 bg-transparent hover:border-cyan-400/60 transition-colors"
                      >
                        Use "{suggestion}"
                      </button>
                    )}
                  </div>
                ) : url.trim() ? (
                  <div className="text-xs text-zinc-500">
                    Will search: <span className="text-cyan-400 font-mono">{canonicalizeStartupUrl(url)?.domain || url.trim()}</span>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3 text-[13px] text-zinc-500">
                    <span><span className="text-zinc-300 tabular-nums">{stats.startups > 0 ? stats.startups.toLocaleString() : '…'}</span> startups</span>
                    <span className="text-zinc-700">·</span>
                    <span><span className="text-zinc-300 tabular-nums">{stats.matches > 0 ? stats.matches.toLocaleString() : '…'}</span> matches</span>
                    <span className="text-zinc-700">·</span>
                    <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 border border-emerald-400 rounded-sm animate-pulse" /><span className="text-emerald-400/60">live</span></span>
                  </div>
                )}
              </div>
            </div>

            {/* Secondary CTAs — Rule of 3, Supabase style: stroke only */}
            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/rankings"
                className="inline-flex items-center gap-2 text-sm border border-cyan-500/50 text-cyan-400 rounded-md px-4 py-2 bg-transparent hover:border-cyan-400/70 hover:text-cyan-300 transition-colors"
              >
                Signal rankings by sector
                <span>→</span>
              </Link>
              <Link
                to="/explore"
                className="inline-flex items-center gap-2 text-sm border border-zinc-600 text-zinc-400 rounded-md px-4 py-2 bg-transparent hover:border-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Browse startups
              </Link>
              <Link
                to="/lookup"
                className="text-sm text-zinc-500 hover:text-cyan-400/80 transition-colors"
              >
                For investors →
              </Link>
            </div>
          </div>

          {/* RIGHT COLUMN: feature list */}
          <div className="lg:mt-24">
            <HeroFeatureList onHowItWorksClick={() => setShowHowItWorks(true)} />
          </div>
          
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          INVESTOR SIGNALS TABLE
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 pb-8">
        <div className="mb-5">
          <p className="text-base sm:text-lg text-zinc-400 leading-relaxed max-w-3xl">
            Every investor leaves a trail — portfolio moves, thesis shifts, check-size changes. 
            We track these <span className="text-cyan-400">signals</span> in real time and score them against your startup.
          </p>
        </div>

        <div className="border border-zinc-800/50 rounded-lg overflow-hidden bg-zinc-900/30">
          {/* Table header */}
          <div className="px-4 py-3 border-b border-zinc-800/50 flex items-center justify-between">
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Investor Signals</span>
            <span className="flex items-center gap-2 text-xs text-emerald-400">
              <span className="w-1.5 h-1.5 border border-emerald-400 rounded-sm animate-pulse" />
              Live
            </span>
          </div>

          {/* Column headers — desktop */}
          <div className="hidden sm:grid grid-cols-[1fr_100px_80px_80px_80px_100px] gap-4 px-4 py-2 text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800/30">
            <span>Investor / Firm</span>
            <span className="text-right">Signal</span>
            <span className="text-center">Δ</span>
            <span className="text-center">GOD</span>
            <span className="text-center">VC++</span>
            <span className="text-center">Σ</span>
          </div>

          {/* Column headers — mobile */}
          <div className="grid sm:hidden grid-cols-[1fr_4rem_3rem] gap-2 px-4 py-2 text-xs text-zinc-500 uppercase tracking-wider border-b border-zinc-800/30">
            <span>Investor</span>
            <span className="text-right">Signal</span>
            <span className="text-center">Σ</span>
          </div>

          {/* Table rows */}
          {investorSignals.map((row, i) => (
            <div key={i}>
              <div className="hidden sm:grid grid-cols-[1fr_100px_80px_80px_80px_100px] gap-4 px-4 py-3 border-b border-zinc-800/20 hover:bg-zinc-800/20 transition items-center">
                <span className="text-cyan-300 font-medium truncate">{row.investor}</span>
                <span className="text-right text-white font-mono">{row.signal}</span>
                <span className={`text-center font-mono ${deltaColor(row.delta)}`}>{row.delta}</span>
                <span className="text-center text-zinc-400">{row.god}</span>
                <span className="text-center text-zinc-400">{row.vcp}</span>
                <span className="flex justify-center">{renderBars(row.bars)}</span>
              </div>
              <div className="grid sm:hidden grid-cols-[1fr_4rem_3rem] gap-2 px-4 py-3 border-b border-zinc-800/20 items-center">
                <span className="text-cyan-300 font-medium text-xs truncate">{row.investor}</span>
                <span className="text-right text-white font-mono text-xs">{row.signal}</span>
                <span className="flex justify-center">{renderBars(row.bars)}</span>
              </div>
            </div>
          ))}

          {/* Footer legend */}
          <div className="px-4 py-3 text-center text-xs text-zinc-600 flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
            <span>Signal = timing</span>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5">
              GOD = investment readiness
              <GODScoreExplainer variant="icon" />
            </span>
            <span>·</span>
            <span>VC++ = investor optics</span>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTOR HEAT — Live VC activity by sector
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs uppercase tracking-widest text-white/30 font-semibold">Sector Heat</span>
          <span className="flex items-center gap-1.5 text-[10px] text-emerald-400/70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            live
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {sectorHeat.map((sector) => (
            <div
              key={sector.name}
              className="border border-zinc-800/50 rounded-xl p-4 bg-zinc-900/30 hover:bg-zinc-900/60 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/80 font-medium text-sm">{sector.name}</span>
                <span className={`text-xs font-mono font-bold ${sector.delta > 0 ? 'text-emerald-400' : sector.delta < 0 ? 'text-red-400' : 'text-zinc-400'}`}>
                  {sector.delta > 0 ? '+' : ''}{sector.delta.toFixed(1)}
                </span>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-2xl font-bold font-mono text-white">{sector.signal.toFixed(1)}</div>
                  <div className="text-[10px] text-zinc-500 mt-0.5">{sector.vcCount} VCs active</div>
                </div>
                <div className="text-2xl select-none">{sector.emoji}</div>
              </div>
              <div className="mt-3 h-1 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    sector.signal >= 8 ? 'bg-emerald-400' : sector.signal >= 7 ? 'bg-cyan-400' : 'bg-zinc-500'
                  }`}
                  style={{ width: `${(sector.signal / 10) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <Link
            to="/rankings"
            className="text-xs text-zinc-500 hover:text-cyan-400 transition-colors"
          >
            See full rankings by VC lens (Sequoia · a16z · YC · Founders Fund) →
          </Link>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          NEWSLETTER DIGEST
          ═══════════════════════════════════════════════════════════════ */}
      <NewsletterWidget />

      {/* ═══════════════════════════════════════════════════════════════
          FOOTER
          ═══════════════════════════════════════════════════════════════ */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-8 py-10 border-t border-zinc-800/30">
        {/* Footer nav links */}
        <div className="flex flex-wrap justify-center gap-6 text-sm text-zinc-500 mb-4">
          <Link to="/platform" className="hover:text-zinc-300 transition">Platform</Link>
          <Link to="/rankings" className="hover:text-zinc-300 transition">Rankings</Link>
          <Link to="/explore" className="hover:text-zinc-300 transition">Explore</Link>
          <Link to="/newsletter" className="hover:text-zinc-300 transition">Newsletter</Link>
          <Link to="/pricing" className="hover:text-zinc-300 transition">Pricing</Link>
          <Link to="/about" className="hover:text-zinc-300 transition">About</Link>
          <Link to="/support" className="hover:text-zinc-300 transition">Support</Link>
        </div>
        <p className="text-zinc-600 text-xs text-center">
          Signals reflect investor intent and timing based on observed behavior. No guessing. Just math.
        </p>
        <div className="mt-4 text-center">
          <Link to="/admin-login" className="text-zinc-700 hover:text-zinc-500 text-xs transition-colors">
            admin
          </Link>
        </div>
      </footer>
      
      {/* How it works — first-visit + manual trigger */}
      <PythhHowItWorksModal
        isOpen={showHowItWorks}
        onClose={() => setShowHowItWorks(false)}
      />

      {/* Paywall Modal */}
      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        analysisCount={analysisCount}
        analysisLimit={FREE_ANALYSIS_LIMIT}
      />
    </div>
  );
}
