/**
 * PythhWhatYouGet — "From URL to top investors in 30 seconds."
 *
 * Supabase-style: hairline borders, transparent surfaces, stroke + type only (no fills).
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

import { fetchPlatformStats } from '../../lib/platformStats';

function Counter({
  target,
  duration = 2000,
  ready = true,
}: {
  target: number;
  duration?: number;
  /** When false, show placeholder until first successful fetch */
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

const MOCK_INVESTORS = [
  { name: 'Sequoia Capital',  signal: 8.7, blocks: 5 },
  { name: 'Greylock Partners', signal: 8.2, blocks: 4 },
  { name: 'Founders Fund',    signal: 7.7, blocks: 4 },
];

function ScoreBlocks({ count, total = 5 }: { count: number; total?: number }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className={`pythh-score-block${i < count ? ' active' : ''}`} />
      ))}
    </div>
  );
}

const BORDER = '1px solid rgba(255, 255, 255, 0.09)';
const MUTED = '#64748b';

const stepCard: React.CSSProperties = {
  background: 'transparent',
  border: BORDER,
  borderRadius: 8,
  overflow: 'hidden',
};

const stepHeader: React.CSSProperties = {
  padding: '0.65rem 1rem',
  borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
  display: 'flex',
  alignItems: 'center',
  gap: '0.625rem',
};

export type PythhWhatYouGetProps = {
  /** `hero` = first screen on home (same UI as section, no scroll-in delay). */
  variant?: 'section' | 'hero';
  ctaTo?: string;
  ctaLabel?: string;
  /** `amber` = orange outline + text (e.g. Get your matches). Default emerald outline. */
  ctaVariant?: 'emerald' | 'amber';
};

export default function PythhWhatYouGet({
  variant = 'section',
  ctaTo = '/explore',
  ctaLabel = 'Explore the platform',
  ctaVariant = 'emerald',
}: PythhWhatYouGetProps) {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(variant === 'hero');
  const [stats, setStats] = useState({ startups: 0, investors: 0, matches: 0 });
  const [statsReady, setStatsReady] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const goToMatches = () => {
    const raw = urlInput.trim();
    if (!raw) {
      navigate('/signal-matches');
      return;
    }
    navigate(`/signal-matches?url=${encodeURIComponent(raw)}`);
  };

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
    if (variant === 'hero') return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [variant]);

  const sectionShell =
    variant === 'hero'
      ? {
          background: '#000000' as const,
          padding: 'clamp(2rem, 5vh, 3rem) 0 1rem',
        }
      : {
          background: '#000000' as const,
          padding: '4rem 0 5rem',
        };

  const shellMax = variant === 'hero' ? 1280 : 1200;

  return (
    <section ref={ref} style={sectionShell}>
      <div style={{ maxWidth: shellMax, margin: '0 auto', padding: '0 2rem' }}>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          style={{ marginBottom: variant === 'hero' ? '1.35rem' : '1.75rem' }}
        >
          <span className="pythh-label-caps" style={{ display: 'block', marginBottom: 10, color: MUTED }}>
            What you get
          </span>
          <h2 style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(1.65rem, 3.2vw, 2.65rem)',
            letterSpacing: '-0.03em',
            color: '#fafafa',
            lineHeight: 1.12,
            maxWidth: variant === 'hero' ? 'none' : 720,
            margin: 0,
          }}>
            From URL to top{' '}
            <span style={{ color: '#10b981' }}>investors</span>
            {' '}in 30 seconds.
          </h2>
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 'clamp(0.9rem, 1.5vw, 1rem)',
              color: MUTED,
              lineHeight: 1.6,
              maxWidth: variant === 'hero' ? 'none' : 640,
              margin: '0.85rem 0 0',
            }}
          >
            We scrape your site to build a full startup signal profile then match you with top investors.
          </p>
        </motion.div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
          alignItems: 'stretch',
        }}>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={visible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{ ...stepCard, display: 'flex', flexDirection: 'column', height: '100%' }}
          >
            <div style={stepHeader}>
              <span className="pythh-number-badge">01</span>
              <span className="pythh-label-caps" style={{ color: MUTED }}>Submit your URL</span>
            </div>
            <div style={{
              padding: '1rem',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(16, 185, 129, 0.45)',
                  borderRadius: 6,
                  padding: '0.35rem 0.5rem 0.35rem 0.75rem',
                  marginBottom: '0.65rem',
                }}
              >
                <input
                  type="text"
                  inputMode="url"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && goToMatches()}
                  placeholder="https://acme.ai"
                  aria-label="Startup website URL"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontFamily: "'Geist Mono', monospace",
                    fontSize: '0.8rem',
                    color: '#e2e8f0',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    padding: '0.35rem 0',
                  }}
                />
                <button
                  type="button"
                  onClick={goToMatches}
                  aria-label="Find matches for this URL"
                  className="flex shrink-0 items-center justify-center rounded p-1.5 transition-colors"
                  style={{
                    color: '#10b981',
                    background: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                  }}
                >
                  <ArrowRight size={15} strokeWidth={2} />
                </button>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '0.65rem 1.1rem',
                  marginBottom: '0.75rem',
                }}
              >
                {([
                  { n: stats.startups, label: 'startups', numColor: '#34d399', glow: 'rgba(52, 211, 153, 0.35)' },
                  { n: stats.matches, label: 'matches', numColor: '#22d3ee', glow: 'rgba(34, 211, 238, 0.35)' },
                  { n: stats.investors, label: 'investors', numColor: '#fbbf24', glow: 'rgba(251, 191, 36, 0.3)' },
                ] as const).map(({ n, label, numColor, glow }) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span
                      className="pythh-score-number tabular-nums"
                      style={{ fontSize: '0.875rem', color: numColor, textShadow: `0 0 12px ${glow}` }}
                    >
                      <Counter target={n} ready={statsReady} />
                    </span>
                    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.72rem', color: '#2e3d4a' }}>
                      {label}
                    </span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span className="pythh-live-dot" style={{ width: 6, height: 6 }} />
                  <span className="pythh-score-number" style={{ fontSize: '0.68rem', letterSpacing: '0.06em', color: '#10b981' }}>live</span>
                </div>
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.78rem', color: MUTED, lineHeight: 1.65, marginTop: 'auto', marginBottom: 0 }}>
                We read your public site, then enrich from news and web sources (no LinkedIn login).
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={visible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.22 }}
            style={{ ...stepCard, display: 'flex', flexDirection: 'column', height: '100%' }}
          >
            <div style={stepHeader}>
              <span className="pythh-number-badge">02</span>
              <span className="pythh-label-caps" style={{ color: MUTED }}>Top 50 matches scored</span>
            </div>
            <div style={{
              padding: '0.75rem 1rem 1rem',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}>
              <div style={{ flex: 1 }}>
                {MOCK_INVESTORS.map((inv, i) => (
                  <div key={inv.name} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0',
                    borderBottom: i < MOCK_INVESTORS.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}>
                    <span style={{
                      fontFamily: "'Plus Jakarta Sans', sans-serif",
                      fontWeight: 600,
                      fontSize: '0.8125rem',
                      color: '#10b981',
                    }}>
                      {inv.name}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className="pythh-score-number" style={{ fontSize: '0.8125rem', color: '#f59e0b' }}>
                        {inv.signal}
                      </span>
                      <ScoreBlocks count={inv.blocks} />
                    </div>
                  </div>
                ))}
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.75rem', color: MUTED, marginTop: 'auto', paddingTop: '0.75rem', lineHeight: 1.5, marginBottom: 0 }}>
                Ranked by thesis fit, timing, and stage. No spray-and-pray.
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={visible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.34 }}
            style={{ ...stepCard, display: 'flex', flexDirection: 'column', height: '100%' }}
          >
            <div style={stepHeader}>
              <span className="pythh-number-badge">03</span>
              <span className="pythh-label-caps" style={{ color: MUTED }}>Ready-to-send intro line</span>
            </div>
            <div style={{
              padding: '1rem',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <p style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 600,
                  fontSize: '0.8125rem',
                  color: '#10b981',
                  marginBottom: '0.5rem',
                  marginTop: 0,
                }}>
                  Sequoia Capital · Signal 8.7
                </p>
                <div style={{
                  background: 'transparent',
                  border: '1px solid rgba(16, 185, 129, 0.28)',
                  borderRadius: 6,
                  padding: '0.75rem',
                  marginBottom: 0,
                }}>
                  <p style={{
                    fontFamily: "'Inter', sans-serif",
                    fontSize: '0.8rem',
                    color: '#94a3b8',
                    lineHeight: 1.65,
                    fontStyle: 'italic',
                    margin: 0,
                  }}>
                    &ldquo;Hi [Partner] — Acme.ai is building infrastructure for real-time AI inference.
                    Given Sequoia&apos;s recent moves in AI/ML infrastructure (Harvey, Mistral), I think
                    there&apos;s strong thesis alignment...&rdquo;
                  </p>
                </div>
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.75rem', color: MUTED, lineHeight: 1.5, margin: 'auto 0 0', paddingTop: '0.75rem' }}>
                Copy-paste outreach, written to their thesis. Get the meeting.
              </p>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={visible ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          style={{ display: 'flex', justifyContent: 'center', marginTop: '1.15rem' }}
        >
          <Link
            to={ctaTo}
            className={
              ctaVariant === 'amber'
                ? 'pythh-btn-amber-outline'
                : 'pythh-btn-outline-sm'
            }
          >
            {ctaLabel} <ArrowRight size={13} strokeWidth={2} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
