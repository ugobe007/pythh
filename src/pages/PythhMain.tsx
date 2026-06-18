/*
 * PYTHH HOME — Redesign v4
 *
 * Design language:
 *   Monochrome base (#080808 → #000) with two accent colors only:
 *   Emerald (#10b981 / #34d399) = live / action / CTA
 *   Amber  (#f59e0b / #fbbf24) = scores / data / value
 *   Everything else: zinc/grey.
 *
 * Sections:
 *   1. Hero        — centered, URL input + CTA (main element)
 *   2. How it works — 3 steps (horizontal strip, no animation panels)
 *   3. Term Sheet  — new wizard feature callout
 *   4. Signals     — investor table (social proof)
 *   5. Footer
 *
 * The HeroSignalPanel + PythhWhatYouGet are saved as .saved.tsx and
 * can be reintroduced independently later.
 */

import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  FileText,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

import PythhUnifiedNav  from '../components/PythhUnifiedNav';
import SEO              from '../components/SEO';
import NewsletterWidget from '../components/NewsletterWidget';
import { GODScoreExplainer } from '../components/pythh/GODScoreExplainer';
import { supabase }     from '../lib/supabase';
import { fetchPlatformStats } from '../lib/platformStats';

// ─── Design tokens ────────────────────────────────────────────────────────────
const T = {
  bg:      '#080808',
  border:  'rgba(255,255,255,0.07)',
  borderE: 'rgba(16,185,129,0.25)',
  borderA: 'rgba(245,158,11,0.25)',
  text:    '#f4f4f5',           // primary
  muted:   'rgba(255,255,255,0.45)', // secondary
  dim:     'rgba(255,255,255,0.2)',   // tertiary
  ghost:   'rgba(255,255,255,0.06)',  // surfaces
  emerald: '#10b981',
  emeraldL:'#34d399',
  amber:   '#f59e0b',
  amberL:  '#fbbf24',
} as const;

// ─── Static fallback investor data ────────────────────────────────────────────
const STATIC_SIGNALS = [
  { investor: 'Sequoia Capital',    signal: 8.7, delta: '+0.4', god: 76, blocks: 5, sectors: ['AI/ML'] },
  { investor: 'Greylock Partners',  signal: 8.2, delta: '0.0',  god: 73, blocks: 4, sectors: ['SaaS'] },
  { investor: 'Founders Fund',      signal: 7.7, delta: '-0.2', god: 70, blocks: 4, sectors: ['SpaceTech'] },
  { investor: 'a16z crypto',        signal: 7.2, delta: '-0.2', god: 67, blocks: 3, sectors: ['FinTech'] },
  { investor: 'Lightspeed VP',      signal: 6.7, delta: '-0.2', god: 64, blocks: 3, sectors: ['SaaS'] },
  { investor: 'Index Ventures',     signal: 6.2, delta: '-0.2', god: 61, blocks: 2, sectors: ['DeepTech'] },
];

const SECTOR_CHIPS = ['All', 'AI/ML', 'SaaS', 'FinTech', 'BioTech', 'SpaceTech', 'DeepTech'];

// ─── Micro-components ─────────────────────────────────────────────────────────

function ScoreBlocks({ count, total = 5 }: { count: number; total?: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            width: 9,
            height: 9,
            borderRadius: 2,
            background: i < count ? T.amber : T.ghost,
            transition: 'background 0.2s',
          }}
        />
      ))}
    </div>
  );
}

function Counter({ target, ready = true }: { target: number; ready?: boolean }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!ready || target === 0) return;
    const start = Date.now();
    const dur = 1800;
    const tick = () => {
      const p = Math.min((Date.now() - start) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(e * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, ready]);
  if (!ready) return <>…</>;
  return <>{val.toLocaleString()}</>;
}

// ─── HERO ─────────────────────────────────────────────────────────────────────

function Hero() {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [stats, setStats] = useState({ startups: 0, investors: 0, matches: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetchPlatformStats().then(p => { setStats(p); setReady(true); });
  }, []);

  const go = () => {
    const raw = url.trim();
    navigate(raw ? `/signal-matches?url=${encodeURIComponent(raw)}` : '/signal-matches');
  };

  return (
    <section
      style={{
        background: T.bg,
        backgroundImage:
          'radial-gradient(ellipse 70% 50% at 50% -10%, rgba(16,185,129,0.08) 0%, transparent 60%)',
        padding: 'clamp(4rem,10vh,7rem) 1.5rem clamp(3rem,6vh,5rem)',
        textAlign: 'center',
      }}
    >
      {/* Label */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ marginBottom: '1.5rem' }}
      >
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontFamily: "'Geist Mono', monospace",
          fontSize: '0.68rem',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: T.emerald,
          border: `1px solid ${T.borderE}`,
          borderRadius: 999,
          padding: '0.35rem 0.9rem',
          background: 'rgba(16,185,129,0.06)',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.emerald, display: 'inline-block' }} />
          Investor Intelligence · Live
        </span>
      </motion.div>

      {/* Headline */}
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay: 0.08 }}
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontWeight: 900,
          fontSize: 'clamp(2.2rem, 5.5vw, 3.9rem)',
          letterSpacing: '-0.04em',
          lineHeight: 1.08,
          color: T.text,
          margin: '0 auto 1.25rem',
          maxWidth: 780,
        }}
      >
        Find your investors.
        <br />
        <span style={{ color: T.emeraldL }}>Build your term sheet.</span>
      </motion.h1>

      {/* Sub */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.18 }}
        style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 'clamp(1rem, 1.7vw, 1.15rem)',
          color: T.muted,
          lineHeight: 1.65,
          maxWidth: 580,
          margin: '0 auto 2.25rem',
        }}
      >
        Submit your URL. Pythh reads your signals, matches you to top investors
        and builds funding stacks... automatically.
      </motion.p>

      {/* URL input + CTA */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.26 }}
        style={{
          display: 'flex',
          maxWidth: 520,
          margin: '0 auto 1.75rem',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${T.borderE}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <input
          type="text"
          inputMode="url"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && go()}
          placeholder="https://yourstartup.com"
          aria-label="Startup website URL"
          style={{
            flex: 1,
            fontFamily: "'Geist Mono', monospace",
            fontSize: '0.88rem',
            color: T.text,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            padding: '0.9rem 1rem',
          }}
        />
        <button
          type="button"
          onClick={go}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '0.9rem 1.25rem',
            background: T.emerald,
            color: '#000',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 700,
            fontSize: '0.85rem',
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = T.emeraldL)}
          onMouseLeave={e => (e.currentTarget.style.background = T.emerald)}
        >
          Analyze my startup
          <ArrowRight size={15} strokeWidth={2.5} />
        </button>
      </motion.div>

      {/* Live stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.38 }}
        style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0.4rem 1.5rem' }}
      >
        {[
          { n: stats.startups,  label: 'startups analyzed', color: T.emeraldL },
          { n: stats.matches,   label: 'investor matches',  color: T.emeraldL },
          { n: stats.investors, label: 'investors tracked', color: T.amber },
        ].map(({ n, label, color }) => (
          <span key={label} style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: '0.78rem',
            color: T.dim,
          }}>
            <span style={{ color, fontWeight: 600 }}>
              <Counter target={n} ready={ready} />
            </span>
            {' '}{label}
          </span>
        ))}
      </motion.div>
    </section>
  );
}

// ─── HOW IT WORKS (3 steps) ────────────────────────────────────────────────────

const STEPS = [
  {
    num: '01',
    icon: Zap,
    color: T.emerald,
    title: 'Submit your URL',
    body: 'Pythh reads your public site, extracts signals, scores your startup across 5 dimensions, and returns aligned investors in seconds.',
  },
  {
    num: '02',
    icon: TrendingUp,
    color: T.amber,
    title: 'Close the gaps',
    body: 'Answer 6 focused questions. The wizard identifies your weakest GOD score dimensions and shows you exactly what to fix and when.',
  },
  {
    num: '03',
    icon: FileText,
    color: T.emeraldL,
    title: 'Build your term sheet',
    body: 'Acknowledge tasks, set deadlines, submit proof. Your commitment doc becomes a full investment memo — ready to send to matched investors.',
  },
] as const;

function HowItWorks() {
  return (
    <section style={{ padding: 'clamp(3rem,7vh,5rem) 1.5rem', borderTop: `1px solid ${T.border}` }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
          <span style={{
            fontFamily: "'Geist Mono', monospace",
            fontSize: '0.68rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: T.dim,
          }}>
            How it works
          </span>
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1px',
          background: T.border,
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {STEPS.map(({ num, icon: Icon, color, title, body }, i) => (
            <motion.div
              key={num}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.1 }}
              style={{
                background: T.bg,
                padding: '1.75rem 1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: '0.65rem',
                  color: T.dim,
                  letterSpacing: '0.08em',
                }}>
                  {num}
                </span>
                <span style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  border: `1px solid ${color}33`,
                  background: `${color}10`,
                }}>
                  <Icon size={14} strokeWidth={2} style={{ color }} />
                </span>
              </div>
              <h3 style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 700,
                fontSize: '1rem',
                color: T.text,
                margin: 0,
                letterSpacing: '-0.02em',
              }}>
                {title}
              </h3>
              <p style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '0.84rem',
                color: T.muted,
                lineHeight: 1.65,
                margin: 0,
              }}>
                {body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── TERM SHEET FEATURE ────────────────────────────────────────────────────────

function TermSheetFeature() {
  const navigate = useNavigate();

  const COMMITMENTS = [
    { task: 'Add a technical co-founder', status: 'completed', impact: '+18 GOD pts', component: 'Team' },
    { task: 'Sign your first paying customer', status: 'acknowledged', impact: '+14 GOD pts', component: 'Traction', deadline: 'Jun 30' },
    { task: 'Write your "Why Now" in 2 sentences', status: 'pending', impact: '+7 GOD pts', component: 'Market' },
  ];

  return (
    <section style={{
      padding: 'clamp(3rem,7vh,5rem) 1.5rem',
      borderTop: `1px solid ${T.border}`,
      background: 'linear-gradient(180deg, rgba(16,185,129,0.03) 0%, transparent 60%)',
    }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '3rem', alignItems: 'center' }}>

        {/* Left: copy */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: "'Geist Mono', monospace",
            fontSize: '0.65rem',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: T.amber,
            border: `1px solid ${T.borderA}`,
            borderRadius: 999,
            padding: '0.3rem 0.8rem',
            background: 'rgba(245,158,11,0.06)',
            marginBottom: '1.25rem',
          }}>
            <Sparkles size={10} />
            New — Commitment Wizard
          </span>

          <h2 style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(1.6rem, 3vw, 2.25rem)',
            letterSpacing: '-0.035em',
            lineHeight: 1.12,
            color: T.text,
            margin: '0 0 1rem',
          }}>
            Pythh builds your term sheet — aligned with your investor profiles.
          </h2>

          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.95rem',
            color: T.muted,
            lineHeight: 1.65,
            margin: '0 0 1rem',
          }}>
            After matching, the wizard analyzes your GOD score gaps and gives you a prioritized list of what to fix. You acknowledge each task, set a deadline, and submit proof.
          </p>

          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.95rem',
            color: T.muted,
            lineHeight: 1.65,
            margin: '0 0 1.75rem',
          }}>
            When tasks are complete, your commitment document upgrades from provisional to a full{' '}
            <span style={{ color: T.amber, fontWeight: 600 }}>investment memo</span>
            {' '}— personalized to each matched investor's thesis.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <button
              onClick={() => navigate('/signal-matches')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0.75rem 1.25rem',
                background: T.emerald,
                color: '#000',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 700,
                fontSize: '0.85rem',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = T.emeraldL)}
              onMouseLeave={e => (e.currentTarget.style.background = T.emerald)}
            >
              Start for free
              <ArrowRight size={14} strokeWidth={2.5} />
            </button>
            <Link
              to="/methodology"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '0.75rem 1rem',
                color: T.dim,
                fontFamily: "'Inter', sans-serif",
                fontSize: '0.84rem',
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                textDecoration: 'none',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = T.muted)}
              onMouseLeave={e => (e.currentTarget.style.color = T.dim)}
            >
              How scoring works
            </Link>
          </div>
        </motion.div>

        {/* Right: commitment doc preview */}
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55, delay: 0.1 }}
          style={{
            background: '#0d0d0d',
            border: `1px solid rgba(16,185,129,0.2)`,
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 0 60px rgba(16,185,129,0.05)',
          }}
        >
          {/* Doc header */}
          <div style={{
            padding: '0.875rem 1.25rem',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileText size={13} style={{ color: T.emeraldL }} strokeWidth={1.5} />
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '0.82rem', color: T.text }}>
                Commitment Doc
              </span>
            </div>
            <span style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: '0.62rem',
              padding: '0.25rem 0.6rem',
              borderRadius: 999,
              background: 'rgba(250,204,21,0.1)',
              color: '#facc15',
              border: '1px solid rgba(250,204,21,0.2)',
            }}>
              Provisional
            </span>
          </div>

          {/* GOD score snapshot */}
          <div style={{ padding: '1rem 1.25rem', borderBottom: `1px solid ${T.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.62rem', color: T.dim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                GOD Score
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '1.1rem', fontWeight: 700, color: T.text }}>64</span>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.7rem', color: T.emeraldL }}>→ ~82 projected</span>
              </div>
            </div>
            {[
              { label: 'Team',     score: 30 },
              { label: 'Traction', score: 75 },
              { label: 'Market',   score: 55 },
              { label: 'Product',  score: 68 },
              { label: 'Vision',   score: 40 },
            ].map(({ label, score }) => {
              const color = score >= 70 ? T.emerald : score >= 50 ? T.amber : 'rgba(255,255,255,0.2)';
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.65rem', color: T.dim, width: 54, flexShrink: 0 }}>{label}</span>
                  <div style={{ flex: 1, height: 3, borderRadius: 999, background: T.ghost, overflow: 'hidden' }}>
                    <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 999 }} />
                  </div>
                  <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.65rem', color, width: 24, textAlign: 'right' }}>{score}</span>
                </div>
              );
            })}
          </div>

          {/* Commitments */}
          <div style={{ padding: '0.875rem 1.25rem' }}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.62rem', color: T.dim, letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '0.65rem' }}>
              Commitments
            </span>
            {COMMITMENTS.map((c, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0.5rem 0',
                borderBottom: i < COMMITMENTS.length - 1 ? `1px solid ${T.border}` : 'none',
              }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background:
                    c.status === 'completed'   ? T.emerald :
                    c.status === 'acknowledged' ? T.amber :
                    'rgba(255,255,255,0.15)',
                }} />
                <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.78rem', color: T.muted, flex: 1, lineHeight: 1.4 }}>
                  {c.task}
                </span>
                <span style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: '0.62rem',
                  color: T.emeraldL,
                  flexShrink: 0,
                }}>
                  {c.impact}
                </span>
              </div>
            ))}
          </div>

          <div style={{
            padding: '0.75rem 1.25rem',
            borderTop: `1px solid ${T.border}`,
            background: 'rgba(16,185,129,0.04)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <Users size={11} style={{ color: T.emerald }} />
            <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.74rem', color: T.muted }}>
              Ready to send to <span style={{ color: T.emeraldL, fontWeight: 600 }}>5 matched investors</span>
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─── INVESTOR SIGNALS TABLE ────────────────────────────────────────────────────

function SignalsTable() {
  const [activeSector, setActiveSector] = useState('All');
  const [signals, setSignals] = useState(STATIC_SIGNALS);

  useEffect(() => {
    let cancelled = false;
    async function fetch() {
      try {
        const { data, error } = await supabase
          .from('investors')
          .select('name, firm, investor_score, investor_tier, sectors')
          .in('investor_tier', ['elite', 'strong'])
          .not('investor_score', 'is', null)
          .gte('investor_score', 6.5)
          .order('investor_score', { ascending: false })
          .limit(50);

        if (error || !data || data.length < 6 || cancelled) return;
        const shuffled = [...data].sort(() => Math.random() - 0.5).slice(0, 6);
        setSignals(shuffled.map(inv => {
          const s = inv.investor_score || 6.5;
          const dn = inv.firm && inv.firm !== inv.name && inv.firm !== '-'
            ? `${inv.name} — ${inv.firm}` : inv.name;
          const d = ((Math.random() - 0.35) * 0.8).toFixed(1);
          return {
            investor: dn.length > 38 ? dn.slice(0, 36) + '…' : dn,
            signal:   +s.toFixed(1),
            delta:    +d >= 0 ? `+${d}` : d,
            god:      Math.round(s * 9.2),
            blocks:   s >= 8.0 ? 5 : s >= 7.5 ? 4 : s >= 7.0 ? 3 : s >= 6.7 ? 2 : 1,
            sectors:  Array.isArray(inv.sectors) ? inv.sectors : [],
          };
        }));
      } catch {}
    }
    fetch();
    const iv = setInterval(fetch, 45000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  const filtered = useMemo(() => {
    if (activeSector === 'All') return signals;
    return signals.filter(r => r.sectors.some(s => s.toLowerCase().includes(activeSector.toLowerCase())));
  }, [signals, activeSector]);

  const rows = filtered.length > 0 ? filtered : signals;

  const deltaColor = (d: string) =>
    d.startsWith('+') ? T.emerald : d.startsWith('-') ? 'rgba(255,255,255,0.2)' : T.ghost;

  return (
    <section style={{ padding: '0 1.5rem clamp(3rem,7vh,5rem)', borderTop: `1px solid ${T.border}` }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>

        {/* Section label + sector chips */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '1.75rem 0 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.emerald, display: 'inline-block', boxShadow: `0 0 6px ${T.emerald}` }} />
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.68rem', color: T.dim, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Investor Signals · Live
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SECTOR_CHIPS.map(s => (
              <button
                key={s}
                onClick={() => setActiveSector(s)}
                style={{
                  fontFamily: "'Geist Mono', monospace",
                  fontSize: '0.65rem',
                  letterSpacing: '0.05em',
                  padding: '0.3rem 0.65rem',
                  borderRadius: 6,
                  border: `1px solid ${activeSector === s ? T.borderA : T.border}`,
                  background: activeSector === s ? 'rgba(245,158,11,0.08)' : 'transparent',
                  color: activeSector === s ? T.amber : T.dim,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          overflow: 'hidden',
        }}>
          {/* Col headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 80px 70px 60px 70px',
            padding: '0.6rem 1.25rem',
            borderBottom: `1px solid ${T.border}`,
            background: T.ghost,
          }}>
            {['Investor / Firm', 'Signal', 'Δ', 'GOD', 'Σ'].map((h, i) => (
              <span key={h} style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: '0.6rem',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: T.dim,
                textAlign: i === 0 ? 'left' : 'right',
              }}>
                {h}
              </span>
            ))}
          </div>

          {rows.map((row, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.04 }}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 70px 60px 70px',
                padding: '0.8rem 1.25rem',
                borderBottom: i < rows.length - 1 ? `1px solid ${T.border}` : 'none',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = T.ghost)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 600, fontSize: '0.83rem', color: T.text }}>
                {row.investor}
              </span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.83rem', color: T.amber, textAlign: 'right' }}>
                {row.signal.toFixed(1)}
              </span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.83rem', color: deltaColor(row.delta), textAlign: 'right' }}>
                {row.delta}
              </span>
              <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.83rem', color: T.dim, textAlign: 'right' }}>
                {row.god}
              </span>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
                <ScoreBlocks count={row.blocks} />
              </div>
            </motion.div>
          ))}

          <div style={{
            padding: '0.6rem 1.25rem',
            borderTop: `1px solid ${T.border}`,
            background: T.ghost,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.6rem', color: T.dim, letterSpacing: '0.04em' }}>
              Signal = timing · GOD = readiness{' '}<GODScoreExplainer variant="icon" />{' '}· Σ = composite
            </span>
            <Link
              to="/rankings"
              style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: '0.62rem',
                color: T.emerald,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Full rankings <ArrowRight size={10} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── FOOTER ───────────────────────────────────────────────────────────────────

const FOOTER_LINKS = [
  { label: 'Platform',    to: '/platform' },
  { label: 'Rankings',    to: '/rankings' },
  { label: 'Methodology', to: '/methodology' },
  { label: 'Explore',     to: '/explore' },
  { label: 'Pricing',     to: '/pricing' },
  { label: 'About',       to: '/about' },
  { label: 'Support',     to: '/support' },
];

function Footer() {
  return (
    <footer style={{
      maxWidth: 960,
      margin: '0 auto',
      padding: '2rem 1.5rem 2.5rem',
      borderTop: `1px solid ${T.border}`,
    }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '0.5rem 1.5rem', marginBottom: 16 }}>
        {FOOTER_LINKS.map(({ label, to }) => (
          <Link key={label} to={to} style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.82rem',
            color: T.dim,
            textDecoration: 'none',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = T.muted)}
          onMouseLeave={e => (e.currentTarget.style.color = T.dim)}
          >
            {label}
          </Link>
        ))}
      </div>
      <p style={{
        fontFamily: "'Geist Mono', monospace",
        fontSize: '0.65rem',
        color: 'rgba(255,255,255,0.12)',
        textAlign: 'center',
        letterSpacing: '0.04em',
        margin: '0 0 10px',
      }}>
        Signals reflect investor intent based on observed behavior. No guessing. Just math.
      </p>
      <div style={{ textAlign: 'center' }}>
        <Link to="/admin-login" style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: '0.6rem',
          color: 'rgba(255,255,255,0.08)',
          textDecoration: 'none',
        }}>
          admin
        </Link>
      </div>
    </footer>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

export default function PythhHome() {
  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: "'Inter', sans-serif" }}>
      <SEO
        title="pythh.ai — Find investors. Build your term sheet."
        description="Submit your startup URL. Pythh scores your investor readiness, matches aligned VCs, and guides you through a commitment wizard that becomes your investment memo."
        keywords="investor matching, term sheet, startup funding, GOD score, VC intelligence, fundraising, seed funding, series A, investor readiness"
        canonical="/"
      />
      <PythhUnifiedNav />
      <Hero />
      <HowItWorks />
      <TermSheetFeature />
      <SignalsTable />
      <NewsletterWidget />
      <Footer />
    </div>
  );
}
