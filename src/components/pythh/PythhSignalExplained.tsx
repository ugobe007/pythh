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
    color: '#10b981',
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
    <section ref={ref} style={{ background: '#0b0e13', padding: '7rem 0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 2rem' }}>

        {/* The statement */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={visible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          style={{ marginBottom: '5rem' }}
        >
          <h2 style={{
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontWeight: 800,
            fontSize: 'clamp(1.75rem, 4vw, 3.25rem)',
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            color: '#f0f6fc',
            maxWidth: 640,
            margin: '0 0 1rem',
          }}>
            Every investor leaves a trail.
            <br />
            <span style={{ color: '#10b981' }}>We follow it.</span>
          </h2>
          <p style={{
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.9375rem',
            color: '#52616e',
            lineHeight: 1.75,
            maxWidth: 500,
            margin: 0,
          }}>
            A single data point is noise. A sequence of signals is a pattern.
            Pythh detects patterns across 40+ behavioral dimensions — 6 to 18 months
            before major funding events.
          </p>
        </motion.div>

        {/* 3-column data reveal */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 10,
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
                padding: '2.5rem 2rem',
                position: 'relative',
              }}
            >
              {/* Top accent line */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 2,
                background: `linear-gradient(90deg, ${dim.color}66, transparent)`,
              }} />

              <span className="pythh-label-caps" style={{ color: dim.color, marginBottom: '1.5rem', display: 'block' }}>
                {dim.key}
              </span>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                <span
                  className="pythh-score-number"
                  style={{
                    fontSize: '3.5rem',
                    color: dim.color,
                    lineHeight: 1,
                    textShadow: `0 0 32px ${dim.color}55`,
                  }}
                >
                  {dim.value}
                </span>
                <span className="pythh-score-number" style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.2)' }}>
                  {dim.unit}
                </span>
              </div>

              <p className="pythh-label-caps" style={{ marginBottom: '1.25rem', letterSpacing: '0.08em' }}>
                {dim.label}
              </p>

              <p style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: '0.875rem',
                color: '#52616e',
                lineHeight: 1.75,
                marginBottom: '1.5rem',
              }}>
                {dim.desc}
              </p>

              <span style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: '0.68rem',
                color: '#2e3d4a',
                letterSpacing: '0.06em',
                borderTop: '1px solid rgba(255,255,255,0.04)',
                paddingTop: '1rem',
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
