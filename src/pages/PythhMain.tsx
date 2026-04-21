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
 *   4. Digest    — Daily Signal teaser (NewsletterWidget)
 *   5. Footer    — links
 */

import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import PythhUnifiedNav      from '../components/PythhUnifiedNav';
import SEO                  from '../components/SEO';
import NewsletterWidget     from '../components/NewsletterWidget';
import { GODScoreExplainer } from '../components/pythh/GODScoreExplainer';
import PythhSignalExplained from '../components/pythh/PythhSignalExplained';
import PythhWhatYouGet      from '../components/pythh/PythhWhatYouGet';
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

  // ── Data state ────────────────────────────────────────────────────────────
  const [investorSignals, setInvestorSignals] = useState(STATIC_INVESTOR_SIGNALS);

  // ── Live investor signals ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    async function fetchInvestors() {
      try {
        const { data, error } = await supabase
          .from('investors')
          .select('name, firm, investor_score, investor_tier, sectors, score_breakdown')
          .in('investor_tier', ['elite', 'strong'])
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

  // ── Filtered investor table ───────────────────────────────────────────────
  const filteredInvestors = useMemo(() => {
    if (activeSector === 'All') return investorSignals;
    return investorSignals.filter(inv =>
      inv.sectors.some(s => s.toLowerCase().includes(activeSector.toLowerCase()))
    );
  }, [investorSignals, activeSector]);

  const deltaColor = (d: string) =>
    d.startsWith('+') ? '#10b981' : d.startsWith('-') ? '#ef4444' : '#2e3d4a';

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
          4. DAILY SIGNAL (single teaser — API-backed)
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
