/**
 * PythhWhatYouGet — "From a URL to your top investor list in 30 seconds."
 *
 * 3-step horizontal mini UI mockup flow replacing the old bullet-point list.
 * Step 01 → Step 02 → Step 03, each showing the actual product UI.
 * Scroll-triggered entrance.
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

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

const STEP_CARD: React.CSSProperties = {
  background: '#0f1318',
  border: '1px solid rgba(255,255,255,0.07)',
  borderRadius: 10,
  overflow: 'hidden',
};

const STEP_HEADER: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderBottom: '1px solid rgba(255,255,255,0.05)',
  display: 'flex',
  alignItems: 'center',
  gap: '0.625rem',
};

export default function PythhWhatYouGet() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} style={{ background: '#080b10', padding: '7rem 0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 2rem' }}>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          style={{ marginBottom: '4rem' }}
        >
          <span className="pythh-label-caps" style={{ display: 'block', marginBottom: 12 }}>What you get</span>
          <h2 style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)',
            letterSpacing: '-0.03em',
            color: '#f0f6fc',
            lineHeight: 1.1,
            maxWidth: 520,
            margin: 0,
          }}>
            From a URL to your top
            <br />
            <span style={{ color: '#10b981' }}>investor list</span> in 30 seconds.
          </h2>
        </motion.div>

        {/* 3-step flow — stacked on mobile, row on desktop */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
          alignItems: 'start',
        }}>

          {/* Step 01 — Submit URL */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={visible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={STEP_CARD}
          >
            <div style={STEP_HEADER}>
              <span className="pythh-number-badge">01</span>
              <span className="pythh-label-caps">Submit your URL</span>
            </div>
            <div style={{ padding: '1.25rem' }}>
              {/* Mock focused input */}
              <div style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(16,185,129,0.4)',
                borderRadius: 6,
                padding: '0.625rem 0.875rem',
                marginBottom: '0.75rem',
                boxShadow: '0 0 0 3px rgba(16,185,129,0.06)',
              }}>
                <span style={{ fontFamily: "'Geist Mono', monospace", fontSize: '0.8rem', color: '#e2e8f0' }}>
                  https://acme.ai
                  <span style={{
                    display: 'inline-block',
                    width: 1,
                    height: 13,
                    background: '#10b981',
                    marginLeft: 2,
                    verticalAlign: 'middle',
                    animation: 'pythh-blink 1s step-end infinite',
                  }} />
                </span>
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.78rem', color: '#2e3d4a', lineHeight: 1.65, margin: 0 }}>
                We scrape your site, LinkedIn, press releases, and job posts to build a full startup signal profile.
              </p>
            </div>
          </motion.div>

          {/* Step 02 — Score grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={visible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.22 }}
            style={STEP_CARD}
          >
            <div style={STEP_HEADER}>
              <span className="pythh-number-badge">02</span>
              <span className="pythh-label-caps">Top 50 matches scored</span>
            </div>
            <div style={{ padding: '0.875rem 1rem' }}>
              {MOCK_INVESTORS.map((inv, i) => (
                <div key={inv.name} style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 0',
                  borderBottom: i < MOCK_INVESTORS.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
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
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.75rem', color: '#2e3d4a', marginTop: '0.75rem', lineHeight: 1.5 }}>
                Ranked by thesis fit, timing, and stage. No spray-and-pray.
              </p>
            </div>
          </motion.div>

          {/* Step 03 — Intro line */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={visible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.34 }}
            style={STEP_CARD}
          >
            <div style={STEP_HEADER}>
              <span className="pythh-number-badge">03</span>
              <span className="pythh-label-caps">Ready-to-send intro line</span>
            </div>
            <div style={{ padding: '1.25rem' }}>
              <p style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                fontWeight: 600,
                fontSize: '0.8125rem',
                color: '#10b981',
                marginBottom: '0.5rem',
              }}>
                Sequoia Capital · Signal 8.7
              </p>
              <div style={{
                background: 'rgba(255,255,255,0.025)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 6,
                padding: '0.75rem',
                marginBottom: '0.75rem',
              }}>
                <p style={{
                  fontFamily: "'Inter', sans-serif",
                  fontSize: '0.8rem',
                  color: '#94a3b8',
                  lineHeight: 1.65,
                  fontStyle: 'italic',
                  margin: 0,
                }}>
                  "Hi [Partner] — Acme.ai is building infrastructure for real-time AI inference.
                  Given Sequoia's recent moves in AI/ML infrastructure (Harvey, Mistral), I think
                  there's strong thesis alignment..."
                </p>
              </div>
              <p style={{ fontFamily: "'Inter', sans-serif", fontSize: '0.75rem', color: '#2e3d4a', lineHeight: 1.5, margin: 0 }}>
                Copy-paste outreach, written to their thesis. Get the meeting.
              </p>
            </div>
          </motion.div>
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={visible ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.5 }}
          style={{ display: 'flex', justifyContent: 'center', marginTop: '3rem' }}
        >
          <Link
            to="/explore"
            className="pythh-btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0.75rem 1.5rem', borderRadius: 6, textDecoration: 'none' }}
          >
            Explore the platform <ArrowRight size={14} />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
