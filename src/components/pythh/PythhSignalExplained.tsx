/**
 * PythhSignalExplained — "Every investor leaves a trail. We follow it."
 *
 * 3-column data reveal showing the three signal dimensions:
 * TIMING · FIT · OPTICS
 * No icons, no illustrations — just the data and the numbers.
 * Scroll-triggered entrance via IntersectionObserver.
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

const DIMENSIONS = [
  {
    key: 'TIMING',
    value: '8.7',
    unit: '/ 10',
    label: 'Signal Score',
    desc: 'We track when VCs are actively deploying — portfolio velocity, LP updates, fund cycle position. Pitch when the window is open.',
    detail: 'Updated every 6 hours',
    color: '#10b981',
  },
  {
    key: 'FIT',
    value: '94',
    unit: '%',
    label: 'Thesis Match',
    desc: 'Every investor thesis is mapped across 40+ dimensions. Your startup is scored against each one — sector, stage, check size, geography.',
    detail: 'Across 5,513 investors',
    color: '#f59e0b',
  },
  {
    key: 'OPTICS',
    value: '88',
    unit: 'pts',
    label: 'VC++ Score',
    desc: 'How an investor is perceived by other VCs — co-investment history, portfolio reputation, founder NPS. Signal quality, not just quantity.',
    detail: 'Peer-weighted scoring',
    color: '#22d3ee',
  },
];

export default function PythhSignalExplained() {
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.12 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={ref} style={{ background: '#0b0e13', padding: '2rem 0 2.25rem' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 2rem' }}>

        {/* Headline + body inline when wide; stacks on narrow */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.55 }}
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            columnGap: '1.25rem',
            rowGap: '0.5rem',
            marginBottom: '1rem',
          }}
        >
          <h2 style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(1.2rem, 2.6vw, 1.95rem)',
            letterSpacing: '-0.03em',
            lineHeight: 1.15,
            color: '#f0f6fc',
            margin: 0,
            flex: '1 1 16rem',
          }}>
            Every investor leaves a trail.{' '}
            <span style={{ color: '#10b981' }}>We follow it.</span>
          </h2>
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.8125rem',
            color: '#52616e',
            lineHeight: 1.55,
            maxWidth: 420,
            margin: 0,
            flex: '1 1 220px',
          }}>
            A single data point is noise. A sequence of signals is a pattern.
            Pythh detects patterns across 40+ behavioral dimensions — 6 to 18 months
            before major funding events.
          </p>
        </motion.div>

        {/* 3-column data reveal */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
          gap: 1,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 8,
          overflow: 'hidden',
        }}>
          {DIMENSIONS.map((dim, i) => (
            <motion.div
              key={dim.key}
              initial={{ opacity: 0, y: 16 }}
              animate={visible ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6, delay: 0.15 + i * 0.12 }}
              style={{
                background: '#0f1318',
                padding: '0.95rem 0.95rem 0.85rem',
                position: 'relative',
              }}
            >
              {/* Top accent line */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, ${dim.color}66, transparent)`,
              }} />

              <span className="pythh-label-caps" style={{ color: dim.color, marginBottom: '0.45rem', display: 'block', fontSize: '0.65rem' }}>
                {dim.key}
              </span>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 2 }}>
                <span
                  className="pythh-score-number"
                  style={{
                    fontSize: '1.85rem',
                    color: dim.color,
                    lineHeight: 1,
                    textShadow: `0 0 18px ${dim.color}44`,
                  }}
                >
                  {dim.value}
                </span>
                <span className="pythh-score-number" style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.2)' }}>
                  {dim.unit}
                </span>
              </div>

              <p className="pythh-label-caps" style={{ marginBottom: '0.45rem', letterSpacing: '0.08em', fontSize: '0.65rem' }}>
                {dim.label}
              </p>

              <p style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '0.75rem',
                color: '#52616e',
                lineHeight: 1.5,
                marginBottom: '0.65rem',
              }}>
                {dim.desc}
              </p>

              <span style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: '0.6rem',
                color: '#2e3d4a',
                letterSpacing: '0.06em',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                paddingTop: '0.5rem',
                display: 'block',
              }}>
                {dim.detail}
              </span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
