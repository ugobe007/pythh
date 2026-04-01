/**
 * LiveSignalPulse — hero right column
 *
 * Design intent: intelligence terminal, not a dashboard widget.
 * Each row shows a real signal event with a confidence arc ring —
 * an SVG arc whose sweep angle maps to signal_strength.
 * This gives instant visual differentiation at different confidence levels
 * without the "tachometer" feel of a bar chart.
 *
 * Color rules:
 *   >= 0.80 → orange (#f97316) — high conviction
 *   >= 0.60 → emerald (#10b981) — solid signal
 *    < 0.60 → zinc (#6b7280)   — weak/speculative
 *   direction == 'down' → red (#ef4444)
 */

import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface PulseRow {
  id: string;
  sector: string;
  stage: string | null;
  signalClass: string;
  strength: number;
  detectedAt: string;
  direction: 'up' | 'flat' | 'down';
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STAGE_LABELS: Record<number, string> = {
  1: 'Pre-Seed', 2: 'Seed', 3: 'Series A', 4: 'Series B', 5: 'Series C+',
};

const SIGNAL_META: Record<string, { label: string; color: string }> = {
  fundraising_signal:     { label: 'Raise intent',  color: '#f97316' },
  growth_signal:          { label: 'Growth',        color: '#10b981' },
  revenue_signal:         { label: 'Revenue',       color: '#10b981' },
  product_signal:         { label: 'Product ship',  color: '#a78bfa' },
  hiring_signal:          { label: 'Hiring',        color: '#60a5fa' },
  buyer_pain_signal:      { label: 'Demand',        color: '#f97316' },
  expansion_signal:       { label: 'Expansion',     color: '#10b981' },
  market_position_signal: { label: 'Market move',  color: '#a78bfa' },
  efficiency_signal:      { label: 'Efficiency',    color: '#94a3b8' },
  distress_signal:        { label: 'Distress',      color: '#f87171' },
  enterprise_signal:      { label: 'Enterprise',    color: '#60a5fa' },
  gtm_signal:             { label: 'GTM',           color: '#f97316' },
  partnership_signal:     { label: 'Partnership',   color: '#10b981' },
  acquisition_signal:     { label: 'M&A',           color: '#f87171' },
};

// Deliberately spread across the full 0.38–0.91 range
// so the confidence rings look clearly different from each other
const FALLBACK_ROWS: PulseRow[] = [
  { id: 'f1', sector: 'AI/ML',       stage: 'Seed',     signalClass: 'fundraising_signal',  strength: 0.91, detectedAt: new Date(Date.now() - 1 * 60000).toISOString(),  direction: 'up'   },
  { id: 'f2', sector: 'SaaS',        stage: 'Series A', signalClass: 'growth_signal',        strength: 0.74, detectedAt: new Date(Date.now() - 4 * 60000).toISOString(),  direction: 'up'   },
  { id: 'f3', sector: 'HealthTech',  stage: 'Pre-Seed', signalClass: 'product_signal',       strength: 0.83, detectedAt: new Date(Date.now() - 9 * 60000).toISOString(),  direction: 'up'   },
  { id: 'f4', sector: 'Fintech',     stage: 'Seed',     signalClass: 'hiring_signal',        strength: 0.55, detectedAt: new Date(Date.now() - 13 * 60000).toISOString(), direction: 'flat' },
  { id: 'f5', sector: 'Climate',     stage: 'Series A', signalClass: 'expansion_signal',     strength: 0.67, detectedAt: new Date(Date.now() - 22 * 60000).toISOString(), direction: 'flat' },
  { id: 'f6', sector: 'DevTools',    stage: 'Seed',     signalClass: 'buyer_pain_signal',    strength: 0.42, detectedAt: new Date(Date.now() - 38 * 60000).toISOString(), direction: 'down' },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  return hrs < 24 ? `${hrs}h` : `${Math.floor(hrs / 24)}d`;
}

function arcColor(strength: number, direction: PulseRow['direction']): string {
  if (direction === 'down' || strength < 0.40) return '#ef4444';
  if (strength >= 0.80) return '#f97316';
  if (strength >= 0.60) return '#10b981';
  return '#6b7280';
}

/**
 * ConfidenceRing — SVG arc showing strength as a sweep of a circle.
 * 0.91 = nearly complete arc; 0.42 = less than half arc.
 * The gap and curvature make it read as "precision confidence",
 * not a speed gauge.
 */
function ConfidenceRing({ strength, direction }: { strength: number; direction: PulseRow['direction'] }) {
  const R = 12;
  const SW = 2.5;
  const SIZE = 32;
  const CX = SIZE / 2;
  const CY = SIZE / 2;
  const C = 2 * Math.PI * R;
  const filled = Math.max(0, Math.min(1, strength)) * C;
  const color = arcColor(strength, direction);

  return (
    <svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ flexShrink: 0 }}
      aria-label={`Signal confidence: ${Math.round(strength * 100)}%`}
    >
      {/* Background ring */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke="rgba(255,255,255,0.07)"
        strokeWidth={SW}
      />
      {/* Confidence arc — rotated so it starts from 12 o'clock */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke={color}
        strokeWidth={SW}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${C}`}
        style={{
          transform: 'rotate(-90deg)',
          transformOrigin: `${CX}px ${CY}px`,
          filter: `drop-shadow(0 0 3px ${color}80)`,
          transition: 'stroke-dasharray 0.6s ease-out',
        }}
      />
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function LiveSignalPulse() {
  const [rows, setRows] = useState<PulseRow[]>(FALLBACK_ROWS);
  const [isLive, setIsLive] = useState(false);
  const [newIdx, setNewIdx] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const { data: signals } = await supabase
          .from('pythh_signal_events')
          .select(`
            id,
            primary_signal,
            signal_strength,
            detected_at,
            pythh_entities!entity_id (
              startup_upload_id
            )
          `)
          .not('primary_signal', 'is', null)
          .not('signal_strength', 'is', null)
          .order('detected_at', { ascending: false })
          .limit(40);

        if (!signals || signals.length === 0 || cancelled) return;

        const uploadIds = (signals as any[])
          .map(s => s.pythh_entities?.startup_upload_id)
          .filter(Boolean);

        const sectorMap: Record<string, { sectors: string[] | null; stage: number | null }> = {};
        if (uploadIds.length > 0) {
          const CHUNK = 25;
          for (let i = 0; i < uploadIds.length; i += CHUNK) {
            const { data: uploads } = await supabase
              .from('startup_uploads')
              .select('id, sectors, stage')
              .in('id', uploadIds.slice(i, i + CHUNK));
            for (const u of uploads ?? []) {
              sectorMap[u.id] = { sectors: u.sectors, stage: u.stage };
            }
          }
        }

        const built: PulseRow[] = [];
        for (const s of signals as any[]) {
          if (built.length >= 7) break;
          const uploadId = s.pythh_entities?.startup_upload_id;
          const meta = uploadId ? sectorMap[uploadId] : null;
          const sector = (Array.isArray(meta?.sectors) && meta!.sectors[0]) ?? null;
          if (!sector) continue;

          const strength = +(s.signal_strength ?? 0.5).toFixed(2);
          built.push({
            id: s.id,
            sector,
            stage: meta?.stage ? (STAGE_LABELS[meta.stage] ?? null) : null,
            signalClass: s.primary_signal,
            strength,
            detectedAt: s.detected_at,
            direction: strength >= 0.78 ? 'up' : strength >= 0.55 ? 'flat' : 'down',
          });
        }

        if (built.length >= 4 && !cancelled) {
          setRows(prev => {
            const prevId = prev[0]?.id;
            if (built[0]?.id !== prevId) setNewIdx(0);
            return built;
          });
          setIsLive(true);
        }
      } catch {
        // stays on fallback
      }
    }

    load();
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  // Clear flash after 1s
  useEffect(() => {
    if (newIdx === null) return;
    const t = setTimeout(() => setNewIdx(null), 1000);
    return () => clearTimeout(t);
  }, [newIdx]);

  const meta = (cls: string) =>
    SIGNAL_META[cls] ?? { label: cls.replace(/_signal$/, '').replace(/_/g, ' '), color: '#94a3b8' };

  return (
    <div
      style={{
        background: '#0e1015',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14,
        overflow: 'hidden',
      }}
    >
      {/* ── Header ───────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 15px',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.13em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
          Signal Activity
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: isLive ? '#10b981' : 'rgba(255,255,255,0.20)' }}>
          <span style={{
            width: 5, height: 5, borderRadius: '50%',
            background: isLive ? '#10b981' : 'rgba(255,255,255,0.15)',
            boxShadow: isLive ? '0 0 5px #10b98170' : 'none',
            animation: isLive ? 'sp-pulse 2.5s ease-in-out infinite' : 'none',
          }} />
          {isLive ? 'Live' : 'Recent'}
        </span>
      </div>

      {/* ── Column labels ──────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 10,
        padding: '6px 15px 4px',
        borderBottom: '1px solid rgba(255,255,255,0.03)',
      }}>
        {['Sector · Signal', 'Confidence', ''].map((label, i) => (
          <span key={i} style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.10em', color: 'rgba(255,255,255,0.18)', textAlign: i === 1 ? 'right' : 'left' }}>
            {label}
          </span>
        ))}
      </div>

      {/* ── Signal rows ────────────────────────────────────────────────── */}
      <div>
        {rows.slice(0, 6).map((row, idx) => {
          const m = meta(row.signalClass);
          const scoreColor = arcColor(row.strength, row.direction);
          const isNew = idx === newIdx;

          return (
            <div
              key={row.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                alignItems: 'center',
                gap: 10,
                padding: '9px 15px',
                borderBottom: idx < rows.slice(0, 6).length - 1 ? '1px solid rgba(255,255,255,0.035)' : 'none',
                background: isNew ? 'rgba(249,115,22,0.04)' : 'transparent',
                transition: 'background 0.6s ease',
              }}
            >
              {/* Left: sector + stage + signal type + time */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 600,
                    color: 'rgba(255,255,255,0.85)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {row.sector}
                  </span>
                  {row.stage && (
                    <span style={{
                      fontSize: 9, color: 'rgba(255,255,255,0.25)',
                      background: 'rgba(255,255,255,0.04)',
                      borderRadius: 3, padding: '1px 4px', flexShrink: 0,
                    }}>
                      {row.stage}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: m.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.50)', fontWeight: 400 }}>
                    {m.label}
                  </span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>
                    {timeAgo(row.detectedAt)}
                  </span>
                </div>
              </div>

              {/* Score: number + direction */}
              <div style={{ textAlign: 'right', minWidth: 48 }}>
                <div style={{
                  fontSize: 16, fontWeight: 800,
                  color: scoreColor,
                  lineHeight: 1,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: '-0.02em',
                }}>
                  {row.strength.toFixed(2)}
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 600, marginTop: 2,
                  color: row.direction === 'up'   ? '#10b981'
                       : row.direction === 'down' ? '#ef4444'
                       : 'rgba(255,255,255,0.20)',
                }}>
                  {row.direction === 'up' ? '↑' : row.direction === 'down' ? '↓' : '→'}
                </div>
              </div>

              {/* Confidence arc ring */}
              <ConfidenceRing strength={row.strength} direction={row.direction} />
            </div>
          );
        })}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────── */}
      <div style={{
        padding: '8px 15px',
        borderTop: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.17)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
          Companies anonymised
        </span>
        <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.17)' }}>
          Updates every 30s
        </span>
      </div>

      <style>{`
        @keyframes sp-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.35; }
        }
      `}</style>
    </div>
  );
}
