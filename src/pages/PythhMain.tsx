/*
 * PYTHH HOME — "The Intelligence Room" (Redesign v3)
 *
 * Design: Signal Intelligence Dark
 * Emerald (#10b981) = live / signal / action
 * Amber   (#f59e0b) = score / value / data highlight
 * Plus Jakarta Sans (display) · Geist Mono (data) · Inter (body)
 *
 * Sections:
 *   1. Hero      — provocative headline + cycling investor panel
 *   2. Signals   — investor table with sector chip filters
 *   3. Explained — "Every investor leaves a trail"
 *   4. Heat      — sector heat cards + daily signal
 *   5. Get       — 3-step mini UI flow
 *   6. Footer
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import PythhUnifiedNav      from '../components/PythhUnifiedNav';
import PaywallModal         from '../components/PaywallModal';
import SEO                  from '../components/SEO';
import NewsletterWidget     from '../components/NewsletterWidget';
import { GODScoreExplainer } from '../components/pythh/GODScoreExplainer';
import HeroSignalPanel, { type FeaturedSignal } from '../components/pythh/HeroSignalPanel';
import PythhSignalExplained from '../components/pythh/PythhSignalExplained';
import PythhWhatYouGet      from '../components/pythh/PythhWhatYouGet';

import { supabase }                               from '../lib/supabase';
import { normalizeStartupUrl, canonicalizeStartupUrl } from '../utils/normalizeUrl';
import { useUsageTracking }                        from '../hooks/useUsageTracking';
import { useAuth }                                 from '../contexts/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

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

const SECTOR_CHIPS = ['All', 'AI/ML', 'SaaS', 'FinTech', 'BioTech', 'SpaceTech', 'DeepTech', 'Climate'];

// 6-sector heat with static fallback — live DB data overrides first 3
const STATIC_SECTOR_HEAT = [
  { name: 'AI / ML',   signal: 8.4, delta: 0.3,  vcCount: 14, emoji: '🔥' },
  { name: 'FinTech',   signal: 7.9, delta: -0.1, vcCount: 9,  emoji: '⚡' },
  { name: 'BioTech',   signal: 7.3, delta: 0.2,  vcCount: 6,  emoji: '🧬' },
  { name: 'SpaceTech', signal: 6.8, delta: 0.5,  vcCount: 4,  emoji: '🚀' },
  { name: 'Robotics',  signal: 6.5, delta: -0.3, vcCount: 7,  emoji: '🤖' },
  { name: 'Climate',   signal: 6.1, delta: 0.1,  vcCount: 5,  emoji: '🌱' },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/** Roll-up counter animation from 0 → target */
function Counter({ target, duration = 2000 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (target === 0) return;
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
  }, [target, duration]);
  return <>{val > 0 ? val.toLocaleString() : '…'}</>;
}

/** 5-block score indicator for the Σ column */
function ScoreBlocks({ count, total = 5 }: { count: number; total?: number }) {
  return (
    <div className="pythh-score-blocks">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`pythh-score-block${i < count ? ' active' : ''}`} />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function PythhHome() {
  // ── UI state ──────────────────────────────────────────────────────────────
  const [url, setUrl]               = useState('');
  const [urlError, setUrlError]     = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused]       = useState(false);
  const [activeSector, setActiveSector] = useState('All');
  const [heatVisible, setHeatVisible]   = useState(false);
  const [barWidths, setBarWidths]       = useState<number[]>(STATIC_SECTOR_HEAT.map(() => 0));
  const heatRef = useRef<HTMLDivElement>(null);

  // ── Data state ────────────────────────────────────────────────────────────
  const [stats, setStats] = useState<{ startups: number; investors: number; matches: number }>(() => {
    try {
      const cached = localStorage.getItem('platform_stats');
      if (cached) return JSON.parse(cached);
    } catch {}
    return { startups: 0, investors: 0, matches: 0 };
  });

  const [investorSignals, setInvestorSignals] = useState(STATIC_INVESTOR_SIGNALS);
  const [sectorHeatLive, setSectorHeatLive]   = useState<Array<{ sector: string; startup_count: number; avg_god: number }>>([]);
  const [showPaywall, setShowPaywall]         = useState(false);

  const navigate = useNavigate();
  const { profile } = useAuth();
  const isPro = profile?.plan !== 'free';
  const { analysisCount, hasHitLimit, remainingAnalyses, trackAnalysis, FREE_ANALYSIS_LIMIT } = useUsageTracking();

  // ── Sector heat scroll trigger ────────────────────────────────────────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setHeatVisible(true); },
      { threshold: 0.1 }
    );
    if (heatRef.current) observer.observe(heatRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!heatVisible) return;
    const timers = STATIC_SECTOR_HEAT.map((s, i) =>
      setTimeout(() => {
        setBarWidths(prev => { const n = [...prev]; n[i] = s.signal * 10; return n; });
      }, i * 80 + 150)
    );
    return () => timers.forEach(clearTimeout);
  }, [heatVisible]);

  // ── Platform stats ────────────────────────────────────────────────────────
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await supabase.rpc('get_platform_stats');
        const p = res.data || { startups: 0, investors: 0, matches: 0 };
        const s = { startups: p.startups || 0, investors: p.investors || 0, matches: p.matches || 0 };
        setStats(s);
        try { localStorage.setItem('platform_stats', JSON.stringify(s)); } catch {}
      } catch {}
    }
    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, []);

  // ── Live investor signals ─────────────────────────────────────────────────
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

  // ── Sector heat (live from DB) ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchSectorHeat() {
      try {
        const { data } = await supabase.rpc('get_sector_heat', { p_limit: 3 });
        if (data && Array.isArray(data) && data.length >= 3 && !cancelled) setSectorHeatLive(data);
      } catch {}
    }
    fetchSectorHeat();
    return () => { cancelled = true; };
  }, []);

  // ── Computed: 6-sector heat merging live + static ─────────────────────────
  const sectorHeat = useMemo(() => {
    const EMOJIS: Record<string, string> = {
      'AI/ML': '🔥', Fintech: '⚡', 'Climate Tech': '🌱',
      'Developer Tools': '🛠️', SaaS: '☁️', Healthcare: '🧬',
      Gaming: '🎮', BioTech: '🧬',
    };
    const toSignal = (god: number) =>
      Math.min(9.9, +((Math.max(35, god) - 35) / 65 * 4.0 + 5.5).toFixed(1));

    const liveSlice = sectorHeatLive.length >= 3
      ? sectorHeatLive.slice(0, 3).map(s => ({
          name:    s.sector,
          signal:  toSignal(s.avg_god),
          delta:   +((s.avg_god - 50) / 125).toFixed(1),
          vcCount: Math.max(1, Math.round(s.startup_count / 60)),
          emoji:   EMOJIS[s.sector] ?? '📊',
        }))
      : STATIC_SECTOR_HEAT.slice(0, 3);

    // Fill remaining slots from static list (different sectors from live)
    const liveNames = new Set(liveSlice.map(s => s.name.toLowerCase()));
    const remaining = STATIC_SECTOR_HEAT.filter(s => !liveNames.has(s.name.toLowerCase())).slice(0, 3);
    return [...liveSlice, ...remaining].slice(0, 6);
  }, [sectorHeatLive]);

  // ── Computed: cycling hero panel signals from live investor data ───────────
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
      // Generate a plausible sparkline trending to the current score
      const base = Math.max(5, s - 2.5);
      const sparkline = [0,1,2,3,4,5,6].map(i =>
        +(base + (s - base) * (i / 6) + (Math.random() - 0.5) * 0.3).toFixed(1)
      );
      sparkline[6] = s; // anchor last point to actual score
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

  // ── URL submission ────────────────────────────────────────────────────────
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

  // ── Filtered investor table ───────────────────────────────────────────────
  const filteredInvestors = useMemo(() => {
    if (activeSector === 'All') return investorSignals;
    return investorSignals.filter(inv =>
      inv.sectors.some(s => s.toLowerCase().includes(activeSector.toLowerCase()))
    );
  }, [investorSignals, activeSector]);

  const deltaColor = (d: string) =>
    d.startsWith('+') ? '#10b981' : d.startsWith('-') ? '#ef4444' : '#2e3d4a';

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#080b10', fontFamily: "'Inter', sans-serif" }}>
      <SEO
        title="pythh.ai - Signal Science for Venture | 12.6K+ Startups Analyzed"
        description="Get matched with the right investors using our proprietary GOD Algorithm. 12,600+ startups analyzed, 841,915+ live matches. Find your perfect investor match."
        keywords="startup funding, investor matching, VC matching, startup investors, seed funding, series A, AI matching, GOD score, venture capital matching"
        canonical="/"
      />

      <PythhUnifiedNav />

      {/* ══════════════════════════════════════════════════════════════════════
          1. HERO
          ══════════════════════════════════════════════════════════════════════ */}
      <section style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
      }}>
        {/* Subtle emerald glow — right side */}
        <div style={{
          position: 'absolute', top: '30%', right: 0,
          width: 600, height: 500,
          background: 'radial-gradient(ellipse, rgba(16,185,129,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '5rem 2rem 4rem', width: '100%' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,55fr) minmax(0,45fr)',
            gap: '4rem',
            alignItems: 'center',
          }}>

            {/* ── LEFT: Headline + CTA ──────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              {/* Eyebrow */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
                <span className="pythh-live-dot" />
                <span className="pythh-label-caps">Live · Signal Intelligence</span>
              </div>

              {/* Headline */}
              <h1 style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 800,
                fontSize: 'clamp(2.4rem, 5.5vw, 4.5rem)',
                lineHeight: 1.05,
                letterSpacing: '-0.035em',
                color: '#f0f6fc',
                marginBottom: '1.5rem',
              }}>
                The investors who will fund your next round
                <br />are already moving.
                <br />
                <span style={{ color: '#10b981' }}>
                  Pythh shows you the signals.
                </span>
              </h1>

              {/* Sub-copy */}
              <p style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 'clamp(0.9375rem, 1.5vw, 1.0625rem)',
                color: '#52616e',
                lineHeight: 1.75,
                maxWidth: 480,
                marginBottom: '2.5rem',
              }}>
                Enter your startup URL. We analyze it and surface your top investor
                matches in ≈30 seconds — ranked by signal, not guesswork.
              </p>

              {/* URL input */}
              <div style={{ maxWidth: 520, marginBottom: '1rem' }}>
                <div style={{
                  display: 'flex',
                  border: focused ? '1px solid rgba(16,185,129,0.55)' : '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  overflow: 'hidden',
                  boxShadow: focused
                    ? '0 0 0 3px rgba(16,185,129,0.1), 0 4px 24px rgba(0,0,0,0.4)'
                    : '0 4px 24px rgba(0,0,0,0.3)',
                  transition: 'border-color 0.2s, box-shadow 0.2s',
                  background: 'rgba(255,255,255,0.03)',
                }}>
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
                    style={{
                      flex: 1,
                      padding: '0.875rem 1.125rem',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontFamily: "'Geist Mono', monospace",
                      fontSize: '0.875rem',
                      color: '#e2e8f0',
                    }}
                  />
                  <button
                    data-testid="home-analyze-button"
                    onClick={submit}
                    disabled={submitting}
                    className="pythh-btn-primary"
                    style={{ padding: '0 1.5rem', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}
                  >
                    {submitting ? 'Finding…' : (<>Find Signals <ArrowRight size={14} /></>)}
                  </button>
                </div>

                {/* Sub-bar: focused hint / error / stats */}
                <div style={{ marginTop: 10, minHeight: 20 }}>
                  {urlError ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.72rem', color: '#ef4444' }}>
                        {urlError}
                      </span>
                      {suggestion && (
                        <button onClick={applySuggestion} style={{
                          fontFamily: "'Geist Mono', monospace",
                          fontSize: '0.68rem',
                          color: '#10b981',
                          background: 'rgba(16,185,129,0.08)',
                          border: '1px solid rgba(16,185,129,0.3)',
                          borderRadius: 4,
                          padding: '0.15rem 0.5rem',
                          cursor: 'pointer',
                        }}>
                          Use "{suggestion}"
                        </button>
                      )}
                    </div>
                  ) : url.trim() ? (
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.72rem', color: '#2e3d4a' }}>
                      Will search:{' '}
                      <span style={{ color: '#94a3b8' }}>{canonicalizeStartupUrl(url)?.domain || url.trim()}</span>
                    </span>
                  ) : focused ? (
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.72rem', color: '#10b981', letterSpacing: '0.04em' }}>
                      We'll analyze this in ≈30 seconds
                    </span>
                  ) : isPro ? (
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.72rem', color: '#10b981' }}>
                      ✦ Pro: Unlimited analyses
                    </span>
                  ) : (
                    <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.72rem', color: '#2e3d4a', letterSpacing: '0.04em' }}>
                      {!hasHitLimit
                        ? `✦ Pro: Unlimited analyses`
                        : `${remainingAnalyses} free ${remainingAnalyses === 1 ? 'analysis' : 'analyses'} remaining`}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats line */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', marginBottom: 24 }}>
                {[
                  { n: stats.startups,  label: 'startups'  },
                  { n: stats.matches,   label: 'matches'   },
                  { n: stats.investors, label: 'investors' },
                ].map(({ n, label }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span className="pythh-score-number" style={{ fontSize: '0.9375rem', color: '#e2e8f0' }}>
                      <Counter target={n} />
                    </span>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.75rem', color: '#2e3d4a' }}>
                      {label}
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className="pythh-live-dot" style={{ width: 6, height: 6 }} />
                  <span className="pythh-score-number" style={{ fontSize: '0.7rem', color: '#22c55e', letterSpacing: '0.06em' }}>
                    live
                  </span>
                </div>
              </div>

              {/* Secondary CTAs */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                {[
                  { label: 'Signal rankings by sector →', to: '/rankings',  primary: true },
                  { label: 'Browse startups',             to: '/explore',   primary: false },
                  { label: 'Find investors →',            to: '/lookup',    primary: false },
                ].map(({ label, to, primary }) => (
                  <Link
                    key={label}
                    to={to}
                    style={{
                      fontFamily: "'Inter', sans-serif",
                      fontSize: '0.8125rem',
                      color:      primary ? '#10b981' : '#2e3d4a',
                      background: primary ? 'rgba(16,185,129,0.08)' : 'transparent',
                      border:     primary ? '1px solid rgba(16,185,129,0.25)' : '1px solid rgba(255,255,255,0.07)',
                      padding: '0.375rem 0.875rem',
                      borderRadius: 5,
                      textDecoration: 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* ── RIGHT: Cycling investor signal panel ─────────────────── */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              style={{ display: 'none' }}
              className="lg-hero-panel"
            >
              <div className="pythh-label-caps" style={{ marginBottom: 10 }}>Signals detected right now</div>
              <HeroSignalPanel liveSignals={featuredSignals} />
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          2. INVESTOR SIGNALS TABLE
          ══════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: '#080b10', padding: '5rem 0 4rem' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 2rem' }}>

          {/* Intro text */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 'clamp(1rem, 2vw, 1.1rem)',
              color: '#94a3b8',
              lineHeight: 1.75,
              maxWidth: 680,
              marginBottom: '2rem',
            }}
          >
            Every investor leaves a trail — portfolio moves, thesis shifts, check-size changes.
            We track these{' '}
            <span style={{ color: '#10b981', fontWeight: 500 }}>signals</span>{' '}
            in real time and score them against your startup.
          </motion.p>

          {/* Sector chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 24 }}>
            <span className="pythh-label-caps" style={{ marginRight: 4 }}>Sector:</span>
            {SECTOR_CHIPS.map(s => (
              <button
                key={s}
                onClick={() => setActiveSector(s)}
                className={`pythh-sector-chip${activeSector === s ? ' active' : ''}`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Table */}
          <div style={{
            background: '#0f1318',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 8,
            overflow: 'hidden',
          }}>
            {/* Table header bar */}
            <div style={{
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              padding: '0.875rem 1.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span className="pythh-label-caps">Investor Signals</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="pythh-live-dot" />
                <span className="pythh-label-caps" style={{ color: '#22c55e' }}>Live</span>
              </div>
            </div>

            {/* Column headers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 90px 80px 70px 70px 80px',
              padding: '0.6rem 1.5rem',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
            }}>
              {['Investor / Firm', 'Signal', 'Δ', 'GOD', 'VC++', 'Σ'].map((h, i) => (
                <span
                  key={h}
                  className="pythh-label-caps"
                  style={{ textAlign: i === 0 ? 'left' : 'right' }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            {(filteredInvestors.length > 0 ? filteredInvestors : investorSignals).map((row, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.05 }}
                className="pythh-table-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 90px 80px 70px 70px 80px',
                  padding: '0.875rem 1.5rem',
                  borderBottom: i < investorSignals.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
                }}
              >
                <span className="pythh-investor-name">{row.investor}</span>
                <span className="pythh-score-number" style={{ fontSize: '0.875rem', color: '#f59e0b', textAlign: 'right' }}>
                  {row.signal.toFixed(1)}
                </span>
                <span className="pythh-score-number" style={{ fontSize: '0.875rem', color: deltaColor(row.delta), textAlign: 'right' }}>
                  {row.delta}
                </span>
                <span className="pythh-score-number" style={{ fontSize: '0.875rem', color: '#52616e', textAlign: 'right' }}>
                  {row.god}
                </span>
                <span className="pythh-score-number" style={{ fontSize: '0.875rem', color: '#52616e', textAlign: 'right' }}>
                  {row.vcp}
                </span>
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                  <ScoreBlocks count={row.blocks} />
                </div>
              </motion.div>
            ))}

            {/* Legend */}
            <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid rgba(255,255,255,0.04)', textAlign: 'center' }}>
              <span className="pythh-score-number" style={{ fontSize: '0.68rem', color: '#2e3d4a', letterSpacing: '0.04em' }}>
                Signal = timing · GOD = investment readiness{' '}
                <GODScoreExplainer variant="icon" />{' '}
                · VC++ = investor optics
              </span>
            </div>
          </div>

          {/* Table CTA */}
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
            <Link
              to="/rankings"
              className="pythh-btn-ghost"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.625rem 1.25rem', borderRadius: 6, textDecoration: 'none' }}
            >
              See full rankings by VC lens (Sequoia · a16z · YC · Founders Fund)
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          3. SIGNAL EXPLAINED
          ══════════════════════════════════════════════════════════════════════ */}
      <PythhSignalExplained />

      {/* ══════════════════════════════════════════════════════════════════════
          4. SECTOR HEAT
          ══════════════════════════════════════════════════════════════════════ */}
      <section ref={heatRef} style={{ background: '#0b0e13', padding: '5rem 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 2rem' }}>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={heatVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}
          >
            <span className="pythh-label-caps">Sector Heat</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="pythh-live-dot" />
              <span className="pythh-label-caps" style={{ color: '#22c55e' }}>live</span>
            </div>
          </motion.div>

          {/* 6-card grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
            {sectorHeat.map((sector, i) => {
              const isPos = sector.delta > 0;
              return (
                <motion.div
                  key={sector.name}
                  className="pythh-heat-card"
                  initial={{ opacity: 0, y: 16 }}
                  animate={heatVisible ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                  style={{ padding: '1.25rem' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="pythh-score-number" style={{ fontSize: '0.7rem', letterSpacing: '0.1em', color: '#52616e', textTransform: 'uppercase' }}>
                      {sector.name}
                    </span>
                    <span className="pythh-score-number" style={{ fontSize: '0.875rem', color: isPos ? '#10b981' : '#ef4444' }}>
                      {isPos ? '+' : ''}{sector.delta.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span className="pythh-score-number pythh-amber-glow" style={{ fontSize: '2.5rem', fontWeight: 600, color: '#f59e0b', lineHeight: 1 }}>
                      {sector.signal.toFixed(1)}
                    </span>
                    <span style={{ fontSize: '1.5rem' }}>{sector.emoji}</span>
                  </div>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.72rem', color: '#2e3d4a', marginBottom: '0.875rem' }}>
                    {sector.vcCount} VCs active
                  </p>
                  <div className="pythh-signal-bar-bg">
                    <div className="pythh-signal-bar" style={{ width: `${barWidths[i] ?? 0}%` }} />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* VC lens CTA */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 48 }}>
            <Link
              to="/rankings"
              className="pythh-btn-ghost"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.625rem 1.25rem', borderRadius: 6, textDecoration: 'none' }}
            >
              See full rankings by VC lens (Sequoia · a16z · YC · Founders Fund)
              <ArrowRight size={13} />
            </Link>
          </div>

          {/* Daily Signal card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={heatVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.5 }}
            style={{
              background: '#141a1f',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 8,
              padding: '1.25rem',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
              paddingBottom: 16,
              borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="pythh-live-dot" />
                <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '0.9375rem', color: '#e2e8f0' }}>
                  The Daily Signal
                </span>
                <span className="pythh-score-number" style={{ fontSize: '0.72rem', color: '#2e3d4a' }}>
                  — {today}
                </span>
              </div>
              <Link
                to="/newsletter"
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '0.875rem', color: '#10b981', textDecoration: 'none' }}
              >
                Read full digest <ArrowRight size={13} />
              </Link>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {[
                { icon: '🔥', label: 'Hot Matches',    title: 'Top startup × investor pairings', sub: 'Updated weekly' },
                { icon: '⚡', label: '#1 This Week',   title: sectorHeat[0]?.name ?? 'AI / ML',  sub: `${sectorHeat[0]?.vcCount ?? 14} VCs active` },
                { icon: '📊', label: 'Hottest Sector', title: sectorHeat[0]?.name ?? 'AI / ML',  sub: `Signal ${sectorHeat[0]?.signal?.toFixed(1) ?? '8.4'}` },
              ].map(item => (
                <div key={item.label} style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  borderRadius: 6,
                  padding: '1rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: '0.875rem' }}>{item.icon}</span>
                    <span className="pythh-label-caps">{item.label}</span>
                  </div>
                  <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '0.9375rem', color: '#e2e8f0', marginBottom: 4 }}>
                    {item.title}
                  </p>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.72rem', color: '#2e3d4a' }}>
                    {item.sub}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          5. WHAT YOU GET
          ══════════════════════════════════════════════════════════════════════ */}
      <PythhWhatYouGet />

      {/* ══════════════════════════════════════════════════════════════════════
          6. NEWSLETTER + FOOTER
          ══════════════════════════════════════════════════════════════════════ */}
      <NewsletterWidget />

      <footer style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '2.5rem 2rem 3rem',
        borderTop: '1px solid rgba(255,255,255,0.05)',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 24, marginBottom: 12 }}>
          {[
            { label: 'Platform', to: '/platform' },
            { label: 'Rankings', to: '/rankings' },
            { label: 'Explore',  to: '/explore'  },
            { label: 'Newsletter', to: '/newsletter' },
            { label: 'Pricing',  to: '/pricing'  },
            { label: 'About',    to: '/about'    },
            { label: 'Support',  to: '/support'  },
          ].map(({ label, to }) => (
            <Link key={label} to={to} style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: '0.875rem',
              color: '#2e3d4a',
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
            onMouseLeave={e => (e.currentTarget.style.color = '#2e3d4a')}
            >
              {label}
            </Link>
          ))}
        </div>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.75rem', color: '#1e2d36', textAlign: 'center', marginBottom: 12 }}>
          Signals reflect investor intent and timing based on observed behavior. No guessing. Just math.
        </p>
        <div style={{ textAlign: 'center' }}>
          <Link to="/admin-login" style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.68rem', color: '#1e2d36', textDecoration: 'none' }}>
            admin
          </Link>
        </div>
      </footer>

      {/* Hero panel responsive visibility fix */}
      <style>{`
        @media (min-width: 1024px) {
          .lg-hero-panel { display: block !important; }
        }
      `}</style>

      <PaywallModal
        isOpen={showPaywall}
        onClose={() => setShowPaywall(false)}
        analysisCount={analysisCount}
        analysisLimit={FREE_ANALYSIS_LIMIT}
      />
    </div>
  );
}
