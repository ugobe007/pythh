/**
 * HeroSignalPanel — right column of the hero section
 *
 * Shows a featured investor cycling every 4s: firm name, large amber signal score,
 * sparkline trend, delta, "Why now?" one-liner, and a sector heat strip.
 * This is the "intrigue hook" — founders see exactly what the product delivers
 * before they submit a URL.
 *
 * Accepts live investor data from the parent (PythhMain already fetches it).
 * Falls back to hardcoded data if live data isn't ready yet.
 */

import { useState, useEffect, useId } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface FeaturedSignal {
  firm: string;
  signal: number;       // e.g. 8.7
  delta: number;        // e.g. +0.4
  sector: string;
  why: string;          // one-liner reason
  sparkline: number[];  // 7 values trending to `signal`
}

// ─────────────────────────────────────────────────────────────────────────────
// STATIC FALLBACK — used until live data is ready
// ─────────────────────────────────────────────────────────────────────────────

const FALLBACK_SIGNALS: FeaturedSignal[] = [
  {
    firm: 'Sequoia Capital',
    signal: 8.7,
    delta: +0.4,
    sector: 'AI/ML',
    why: 'Increased AI/ML deal activity +34% this quarter',
    sparkline: [5.8, 6.2, 6.9, 7.4, 7.9, 8.3, 8.7],
  },
  {
    firm: 'Andreessen Horowitz',
    signal: 8.1,
    delta: +0.6,
    sector: 'DeepTech',
    why: '3 new portfolio companies in infrastructure AI this month',
    sparkline: [6.1, 6.4, 6.8, 7.1, 7.5, 7.8, 8.1],
  },
  {
    firm: 'Founders Fund',
    signal: 7.7,
    delta: -0.2,
    sector: 'SpaceTech',
    why: 'Thesis shift detected: reducing consumer, increasing hard tech',
    sparkline: [8.1, 8.0, 7.9, 7.8, 7.8, 7.7, 7.7],
  },
];

const SECTOR_STRIP = [
  { name: 'AI/ML',   score: 8.4, delta: +0.3 },
  { name: 'BioTech', score: 7.3, delta: +0.2 },
  { name: 'FinTech', score: 7.9, delta: -0.1 },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Upsample 7 points → ~28 for a smoother polyline (less “jagged” steps). */
function upsampleLinear(values: number[], targetLen: number): number[] {
  if (values.length < 2) return values;
  const out: number[] = [];
  const n = values.length;
  for (let i = 0; i < targetLen; i++) {
    const t = (i / (targetLen - 1)) * (n - 1);
    const j = Math.floor(t);
    const f = t - j;
    const a = values[j];
    const b = values[Math.min(j + 1, n - 1)];
    out.push(a * (1 - f) + b * f);
  }
  return out;
}

/** Mini SVG sparkline — dense interpolated line + soft area fill. Down = amber (matches score accent), not red. */
function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const gradId = useId().replace(/:/g, '');
  const W = 88;
  const H = 32;
  const pad = 2;
  const smooth = upsampleLinear(values, 36);
  const min = Math.min(...smooth);
  const max = Math.max(...smooth);
  const range = max - min || 1;
  const coords = smooth.map((v, i) => {
    const x = pad + (i / (smooth.length - 1)) * (W - pad * 2);
    const y = pad + (1 - (v - min) / range) * (H - pad * 2);
    return { x, y };
  });
  const lineD = coords.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  const last = coords[coords.length - 1];
  const first = coords[0];
  const areaD = `${lineD} L ${last.x} ${H - pad} L ${first.x} ${H - pad} Z`;

  const line = positive ? '#34d399' : '#fbbf24';
  const fillTop = positive ? 'rgba(52,211,153,0.2)' : 'rgba(251,191,36,0.14)';

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" aria-hidden>
      <defs>
        <linearGradient id={`spark-grad-${gradId}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillTop} />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#spark-grad-${gradId})`} />
      <path
        d={lineD}
        stroke={line}
        strokeWidth={1.65}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx={last.x} cy={last.y} r={2.75} fill={line} />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  /** Live investor data from parent — mapped to FeaturedSignal format */
  liveSignals?: FeaturedSignal[];
}

export default function HeroSignalPanel({ liveSignals }: Props) {
  const signals = (liveSignals && liveSignals.length >= 2) ? liveSignals : FALLBACK_SIGNALS;
  const [idx, setIdx] = useState(0);

  // Auto-cycle every 4 seconds
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % signals.length), 4000);
    return () => clearInterval(t);
  }, [signals.length]);

  const featured = signals[idx];

  return (
    <div
      style={{
        background: 'rgba(15,19,24,0.88)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        overflow: 'hidden',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.06)',
      }}
    >
      {/* ── Panel header ────────────────────────────────────────────── */}
      <div style={{
        padding: '0.875rem 1.25rem',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span className="pythh-label-caps">Signal Intelligence Preview</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="pythh-live-dot" />
          <span className="pythh-label-caps" style={{ color: '#22c55e' }}>Live</span>
        </div>
      </div>

      {/* ── Featured investor (animated crossfade) ───────────────────── */}
      <div style={{ padding: '1.25rem' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
          >
            {/* Firm + sector + sparkline */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <p style={{
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                  fontWeight: 700,
                  fontSize: '1rem',
                  color: '#10b981',
                  marginBottom: 3,
                  lineHeight: 1.2,
                }}>
                  {featured.firm}
                </p>
                <span className="pythh-label-caps">{featured.sector}</span>
              </div>
              <Sparkline values={featured.sparkline} positive={featured.delta >= 0} />
            </div>

            {/* Score + delta */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 12 }}>
              <span
                className="pythh-score-number pythh-amber-glow"
                style={{ fontSize: '2.75rem', color: '#f59e0b', lineHeight: 1 }}
              >
                {featured.signal.toFixed(1)}
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 }}>
                <span className="pythh-score-number" style={{
                  fontSize: '0.72rem',
                  color: featured.delta >= 0 ? '#10b981' : '#ef4444',
                }}>
                  {featured.delta >= 0 ? '+' : ''}{featured.delta.toFixed(1)} this week
                </span>
                <span className="pythh-label-caps">Signal Score</span>
              </div>
            </div>

            {/* Why now */}
            <div style={{
              background: 'rgba(16,185,129,0.06)',
              border: '1px solid rgba(16,185,129,0.15)',
              borderRadius: 6,
              padding: '0.625rem 0.875rem',
              marginBottom: '1rem',
            }}>
              <p style={{
                fontFamily: "'Geist Mono', monospace",
                fontSize: '0.72rem',
                color: '#10b981',
                letterSpacing: '0.02em',
                lineHeight: 1.5,
                margin: 0,
              }}>
                ↑ {featured.why}
              </p>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Cycle indicator dots */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          {signals.map((_, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              style={{
                width: i === idx ? 18 : 6,
                height: 4,
                borderRadius: 2,
                background: i === idx ? '#10b981' : 'rgba(255,255,255,0.10)',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.3s ease',
              }}
            />
          ))}
          <span className="pythh-label-caps" style={{ marginLeft: 'auto', fontSize: '0.6rem', color: '#2e3d4a' }}>
            {idx + 1} / {signals.length}
          </span>
        </div>

        {/* Sector heat strip */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.875rem' }}>
          <span className="pythh-label-caps" style={{ display: 'block', marginBottom: 8 }}>Sector Heat</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {SECTOR_STRIP.map(s => (
              <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="pythh-label-caps" style={{ width: 48, flexShrink: 0 }}>{s.name}</span>
                <div className="pythh-signal-bar-bg" style={{ flex: 1 }}>
                  <div className="pythh-signal-bar" style={{ width: `${s.score * 10}%` }} />
                </div>
                <span className="pythh-score-number" style={{ fontSize: '0.8125rem', color: '#f59e0b', width: 28, textAlign: 'right' }}>
                  {s.score}
                </span>
                <span className="pythh-score-number" style={{
                  fontSize: '0.72rem',
                  color: s.delta >= 0 ? '#10b981' : '#ef4444',
                  width: 36,
                }}>
                  {s.delta >= 0 ? '+' : ''}{s.delta.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Panel footer ────────────────────────────────────────────── */}
      <div style={{
        padding: '0.75rem 1.25rem',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span className="pythh-score-number" style={{ fontSize: '0.68rem', color: '#2e3d4a', letterSpacing: '0.04em' }}>
          Signal = timing · GOD = readiness · VC++ = optics
        </span>
        <Link
          to="/rankings"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontFamily: "'Inter', sans-serif",
            fontSize: '0.75rem',
            color: '#10b981',
            textDecoration: 'none',
          }}
        >
          View all <ArrowRight size={11} />
        </Link>
      </div>
    </div>
  );
}
