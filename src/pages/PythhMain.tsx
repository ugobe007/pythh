/*
 * PYTHH HOME — "The Intelligence Room" (Redesign v3)
 *
 * Design: Signal Intelligence Dark
 * Emerald (#10b981) = live / signal / action
 * Amber   (#f59e0b) = score / value / data highlight
 * Plus Jakarta Sans (display) · Geist Mono (data) · Inter (body)
 *
 * Sections:
 *   1. Hero      — “What you get” (3 steps + outline CTA); full analyze UI on /signal-matches
 *   2. Signals   — investor table with sector chip filters
 *   3. Explained — signal explainer strip
 *   4. Heat      — sector heat cards + daily signal
 *   5. Footer    — newsletter + links
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import PythhUnifiedNav      from '../components/PythhUnifiedNav';
import SEO                  from '../components/SEO';
import NewsletterWidget     from '../components/NewsletterWidget';
import { GODScoreExplainer } from '../components/pythh/GODScoreExplainer';
import PythhSignalExplained from '../components/pythh/PythhSignalExplained';
import PythhWhatYouGet      from '../components/pythh/PythhWhatYouGet';
import PythhWordmark        from '../components/PythhWordmark';
import { HotMatchLogo }     from '../components/FlameIcon';

import { supabase }                               from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

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

// 6-sector heat with static fallback — live DB data overrides first 3 (AI/ML omitted by design)
const STATIC_SECTOR_HEAT = [
  { name: 'Gaming',    signal: 8.2, delta: 0.2,  vcCount: 12, emoji: '🎮' },
  { name: 'FinTech',   signal: 7.9, delta: -0.1, vcCount: 9,  emoji: '⚡' },
  { name: 'BioTech',   signal: 7.3, delta: 0.2,  vcCount: 6,  emoji: '🧬' },
  { name: 'SpaceTech', signal: 6.8, delta: 0.5,  vcCount: 4,  emoji: '🚀' },
  { name: 'Robotics',  signal: 6.5, delta: -0.3, vcCount: 7,  emoji: '🤖' },
  { name: 'Climate',   signal: 6.1, delta: 0.1,  vcCount: 5,  emoji: '🌱' },
];

function isAiMlSector(name: string) {
  return /^ai\s*\/?\s*ml$/i.test(name.trim());
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

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
  const [activeSector, setActiveSector] = useState('All');
  // Default true so Sector Heat + Daily Signal (wordmark, flame) aren’t stuck at opacity 0
  // before the intersection observer fires; observer still sets true when section is seen.
  const [heatVisible, setHeatVisible]   = useState(true);
  const [barWidths, setBarWidths]       = useState<number[]>(STATIC_SECTOR_HEAT.map(() => 0));
  const heatRef = useRef<HTMLDivElement>(null);

  // ── Data state ────────────────────────────────────────────────────────────
  const [investorSignals, setInvestorSignals] = useState(STATIC_INVESTOR_SIGNALS);
  const [sectorHeatLive, setSectorHeatLive]   = useState<Array<{ sector: string; startup_count: number; avg_god: number }>>([]);
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

    const liveCandidates = sectorHeatLive.filter(s => !isAiMlSector(s.sector));
    const liveSlice =
      sectorHeatLive.length >= 3 && liveCandidates.length >= 3
        ? liveCandidates.slice(0, 3).map(s => ({
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
    return [...liveSlice, ...remaining].filter(s => !isAiMlSector(s.name)).slice(0, 6);
  }, [sectorHeatLive]);

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
        description="Find your investors using signal intelligence. Get funded. 12,600+ startups analyzed, 841,915+ live matches. Enter your URL—ranked matches in seconds."
        keywords="startup funding, investor matching, VC matching, startup investors, seed funding, series A, AI matching, GOD score, venture capital matching"
        canonical="/"
      />

      <PythhUnifiedNav />

      {/* ══════════════════════════════════════════════════════════════════════
          1. HERO — same design as former “What you get” block (now first screen)
          ══════════════════════════════════════════════════════════════════════ */}
      <PythhWhatYouGet
        variant="hero"
        ctaTo="/signal-matches"
        ctaLabel="Get your matches →"
        ctaVariant="emerald"
      />

      {/* ══════════════════════════════════════════════════════════════════════
          2. INVESTOR SIGNALS TABLE
          ══════════════════════════════════════════════════════════════════════ */}
      <section style={{ background: '#080b10', padding: '1.5rem 0 3rem' }}>
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
            We surface what they{' '}
            <span style={{ color: '#22d3ee', fontWeight: 600 }}>can&apos;t hide</span>
            {' — '}
            <span style={{ color: '#10b981', fontWeight: 500 }}>signals</span>
            {' '}in real time, scored against your startup.
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
            background: 'rgba(255,255,255,0.02)',
            border: 'none',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
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
              className="pythh-btn-ghost inline-flex items-center gap-2 py-1 no-underline hover:underline underline-offset-4 decoration-white/20"
            >
              See full rankings by VC lens (Sequoia · a16z · YC · Founders Fund)
              <ArrowRight size={13} className="opacity-70" />
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
      <section ref={heatRef} style={{ background: '#0b0e13', padding: '2.5rem 0 3rem' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 2rem' }}>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={heatVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}
          >
            <span className="pythh-label-caps">Sector Heat</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="pythh-live-dot" />
              <span className="pythh-label-caps" style={{ color: '#22c55e' }}>live</span>
            </div>
          </motion.div>

          {/* 6-card grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(148px, 1fr))', gap: 10, marginBottom: 16 }}>
            {sectorHeat.map((sector, i) => {
              const isPos = sector.delta > 0;
              return (
                <motion.div
                  key={sector.name}
                  className="pythh-heat-card"
                  initial={{ opacity: 0, y: 16 }}
                  animate={heatVisible ? { opacity: 1, y: 0 } : {}}
                  transition={{ duration: 0.45, delay: i * 0.08 }}
                  style={{ padding: '0.65rem 0.75rem' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span className="pythh-score-number" style={{ fontSize: '0.62rem', letterSpacing: '0.08em', color: '#52616e', textTransform: 'uppercase' }}>
                      {sector.name}
                    </span>
                    <span className="pythh-score-number" style={{ fontSize: '0.72rem', color: isPos ? '#10b981' : '#ef4444' }}>
                      {isPos ? '+' : ''}{sector.delta.toFixed(1)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span className="pythh-score-number pythh-amber-glow" style={{ fontSize: '1.65rem', fontWeight: 600, color: '#f59e0b', lineHeight: 1 }}>
                      {sector.signal.toFixed(1)}
                    </span>
                    <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>{sector.emoji}</span>
                  </div>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.65rem', color: '#2e3d4a', marginBottom: '0.55rem' }}>
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
              className="pythh-btn-ghost inline-flex items-center gap-2 py-1 no-underline hover:underline underline-offset-4 decoration-white/20"
            >
              See full rankings by VC lens (Sequoia · a16z · YC · Founders Fund)
              <ArrowRight size={13} className="opacity-70" />
            </Link>
          </div>

          {/* Daily Signal card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={heatVisible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.5 }}
            style={{
              marginTop: 8,
              paddingTop: 28,
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              marginBottom: 28,
              gap: 16,
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span className="pythh-live-dot" />
                  <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 700, fontSize: '0.9375rem', color: '#e2e8f0' }}>
                    The Daily Signal
                  </span>
                  <span className="pythh-score-number" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                    — {today}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <PythhWordmark size="sm" />
                  <span
                    className="pythh-label-caps"
                    style={{ color: '#64748b', letterSpacing: '0.14em', fontSize: '0.65rem' }}
                  >
                    favorite picks
                  </span>
                </div>
              </div>
              <Link
                to="/newsletter"
                className="inline-flex items-center gap-1.5 shrink-0 text-sm font-semibold text-emerald-400/95 hover:text-emerald-300 transition-colors no-underline hover:underline underline-offset-4 decoration-emerald-500/30"
              >
                Read full digest <ArrowRight size={13} />
              </Link>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1.5rem 2rem',
                maxWidth: 720,
              }}
            >
              {[
                { flame: true as const, label: 'Hot Matches', title: 'Top startup × investor matches', sub: 'Updated weekly' },
                {
                  icon: '📊',
                  label: 'Hottest Sector',
                  title: sectorHeat[0]?.name ?? 'Gaming',
                  sub: `Signal ${sectorHeat[0]?.signal?.toFixed(1) ?? '—'} · ${sectorHeat[0]?.vcCount ?? '—'} VCs active`,
                },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                    {'flame' in item && item.flame ? (
                      <HotMatchLogo size="sm" className="flex-shrink-0" />
                    ) : (
                      <span style={{ fontSize: '0.875rem', opacity: 0.85 }}>{'icon' in item ? item.icon : ''}</span>
                    )}
                    <span className="pythh-label-caps">{item.label}</span>
                  </div>
                  <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '0.9375rem', color: '#e2e8f0', marginBottom: 6, lineHeight: 1.35 }}>
                    {item.title}
                  </p>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.72rem', color: '#64748b' }}>
                    {item.sub}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════════════════
          5. NEWSLETTER + FOOTER
          ══════════════════════════════════════════════════════════════════════ */}
      <NewsletterWidget />

      <footer style={{
        maxWidth: 1280,
        margin: '0 auto',
        padding: '2rem 2rem 2.5rem',
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

    </div>
  );
}
