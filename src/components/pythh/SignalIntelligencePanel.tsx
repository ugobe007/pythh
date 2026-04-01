/**
 * SignalIntelligencePanel
 *
 * Three motivational panels that make signals feel powerful:
 *
 *   <WhatInvestorsSeePanel />  — narrative + cohort percentile + velocity status
 *   <SignalGapPanel />         — missing signals ranked by investor impact + projected lift
 *   <SignalVelocityPanel />    — 30-day signal count bar, trend label, and call to action
 *
 * All panels accept the `SignalIntelligence` object from useSignalIntelligence.
 * They are intentionally separated so they can be placed independently in any layout.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import type { SignalIntelligence, SignalGap } from '@/hooks/useSignalIntelligence';

// ─────────────────────────────────────────────────────────────────────────────
// SHARED PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'rgba(255,255,255,0.38)',
      marginBottom: 10,
    }}>
      {children}
    </div>
  );
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: '18px 20px',
      ...style,
    }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LOADING / EMPTY STATES
// ─────────────────────────────────────────────────────────────────────────────

export function SignalIntelligenceSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{
          height: 120,
          borderRadius: 14,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          animation: 'pulse 1.8s ease-in-out infinite',
        }} />
      ))}
      <style>{`@keyframes pulse { 0%,100%{opacity:.5} 50%{opacity:.9} }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. WHAT INVESTORS SEE PANEL
// ─────────────────────────────────────────────────────────────────────────────

const VELOCITY_CONFIG = {
  accelerating: { color: 'rgba(52,211,153,0.95)', icon: '↑↑', label: 'Accelerating' },
  stable:       { color: 'rgba(255,255,255,0.60)', icon: '→',  label: 'Steady' },
  stalling:     { color: 'rgba(251,191,36,0.95)',  icon: '↓',  label: 'Stalling' },
  silent:       { color: 'rgba(239,68,68,0.85)',   icon: '—',  label: 'Silent' },
};

function PercentileBar({ pct }: { pct: number }) {
  const color =
    pct >= 75 ? 'rgba(52,211,153,0.85)' :
    pct >= 40 ? 'rgba(251,191,36,0.85)' :
    'rgba(239,68,68,0.70)';

  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 5 }}>
        <span>Bottom</span>
        <span style={{ color, fontWeight: 700, fontSize: 13 }}>Top {100 - pct}%</span>
        <span>Top</span>
      </div>
      <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: color,
          borderRadius: 4,
          transition: 'width 0.8s ease-out',
        }} />
      </div>
    </div>
  );
}

export function WhatInvestorsSeePanel({ data }: { data: SignalIntelligence }) {
  const vel = VELOCITY_CONFIG[data.velocityLabel];

  return (
    <Panel>
      <Kicker>what investors see when they look at you</Kicker>

      {/* Narrative */}
      <p style={{
        fontSize: 13,
        lineHeight: 1.6,
        color: 'rgba(255,255,255,0.80)',
        margin: '0 0 16px',
      }}>
        {data.narrative}
      </p>

      {/* Three metrics row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {/* Cohort percentile */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 10,
          padding: '12px 14px',
        }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Cohort rank
          </div>
          {data.cohortPercentile !== null ? (
            <>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'rgba(255,255,255,0.92)' }}>
                {data.cohortPercentile}
                <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.45)' }}>th %ile</span>
              </div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>
                vs {data.cohortSize} {data.cohortLabel} peers
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', marginTop: 4 }}>
              Not enough cohort data yet
            </div>
          )}
        </div>

        {/* Signal completeness */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 10,
          padding: '12px 14px',
        }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Signal coverage
          </div>
          <div style={{
            fontSize: 22,
            fontWeight: 800,
            color: data.signalCompleteness >= 75 ? 'rgba(52,211,153,0.95)' :
                   data.signalCompleteness >= 40 ? 'rgba(251,191,36,0.95)' :
                   'rgba(239,68,68,0.85)',
          }}>
            {data.signalCompleteness}
            <span style={{ fontSize: 13, fontWeight: 400, color: 'rgba(255,255,255,0.45)' }}>%</span>
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>
            {data.presentClasses.length} of 8 core signals
          </div>
        </div>

        {/* Velocity */}
        <div style={{
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 10,
          padding: '12px 14px',
        }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
            Signal velocity
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, color: vel.color }}>
            {vel.icon}
          </div>
          <div style={{ fontSize: 11, color: vel.color, marginTop: 2, fontWeight: 600 }}>
            {vel.label}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 1 }}>
            {data.signalCountLast30} signals / 30d
          </div>
        </div>
      </div>

      {/* Cohort percentile bar */}
      {data.cohortPercentile !== null && (
        <PercentileBar pct={data.cohortPercentile} />
      )}
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SIGNAL GAP PANEL
// ─────────────────────────────────────────────────────────────────────────────

function GapRow({ gap, rank }: { gap: SignalGap; rank: number }) {
  const isTopGap = rank === 0;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      alignItems: 'start',
      gap: 12,
      padding: '12px 0',
      borderBottom: '1px solid rgba(255,255,255,0.05)',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          {isTopGap && (
            <span style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.1em',
              background: 'rgba(239,68,68,0.15)',
              color: 'rgba(239,68,68,0.9)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 4,
              padding: '1px 6px',
              textTransform: 'uppercase',
            }}>
              Highest impact
            </span>
          )}
          <span style={{ fontSize: 13, fontWeight: 650, color: 'rgba(255,255,255,0.88)' }}>
            {gap.label}
          </span>
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)', margin: 0, lineHeight: 1.45 }}>
          {gap.investorImpact}
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', margin: '4px 0 0', lineHeight: 1.4 }}>
          Fix: {gap.description}
        </p>
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: 750,
        color: 'rgba(52,211,153,0.90)',
        whiteSpace: 'nowrap',
        textAlign: 'right',
        paddingTop: 2,
      }}>
        +{gap.projectedMatchLift}pt
      </div>
    </div>
  );
}

export function SignalGapPanel({ data }: { data: SignalIntelligence }) {
  const totalLift = data.signalGaps.reduce((sum, g) => sum + g.projectedMatchLift, 0);

  if (data.signalGaps.length === 0) {
    return (
      <Panel>
        <Kicker>signal gaps</Kicker>
        <div style={{ fontSize: 13, color: 'rgba(52,211,153,0.90)', fontWeight: 600 }}>
          ✓ All 8 core signal classes detected
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
          Your signal profile is complete. Focus on increasing signal velocity and strength.
        </p>
      </Panel>
    );
  }

  // Show top 4 gaps only — ranked by impact
  const topGaps = [...data.signalGaps]
    .sort((a, b) => b.projectedMatchLift - a.projectedMatchLift)
    .slice(0, 4);

  return (
    <Panel>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Kicker>signal gaps — what's costing you matches</Kicker>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'rgba(52,211,153,0.90)',
          background: 'rgba(52,211,153,0.08)',
          border: '1px solid rgba(52,211,153,0.18)',
          borderRadius: 6,
          padding: '3px 8px',
          whiteSpace: 'nowrap',
          marginTop: -2,
        }}>
          +{totalLift}pt potential
        </div>
      </div>

      <div>
        {topGaps.map((gap, i) => (
          <GapRow key={gap.signalClass} gap={gap} rank={i} />
        ))}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.45 }}>
        Closing gaps generates new signals automatically — scrapers detect public announcements, press mentions, job posts, and product updates.{' '}
        <Link to="/app/playbook" style={{ color: 'rgba(219,234,254,0.7)' }}>
          Open playbook →
        </Link>
      </div>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. SIGNAL VELOCITY PANEL
// ─────────────────────────────────────────────────────────────────────────────

const VELOCITY_CTA: Record<SignalIntelligence['velocityLabel'], { headline: string; body: string }> = {
  accelerating: {
    headline: 'You\'re in the investor radar window',
    body: 'Accelerating signal output is the #1 predictor of inbound investor interest. Keep the momentum — post a milestone, announce a hire, publish metrics.',
  },
  stable: {
    headline: 'Steady but not standing out',
    body: 'Investors look for acceleration, not just presence. A cluster of 3–5 new signals in a 2-week window triggers "hot startup" visibility in investor feeds.',
  },
  stalling: {
    headline: 'Visibility is dropping',
    body: 'Signal velocity dropped 40%+ in the last 30 days. Investors reading market intelligence will interpret this as a stalled company. Publish something — anything — this week.',
  },
  silent: {
    headline: 'You\'re invisible to active investors',
    body: 'Zero signals in 30+ days means no presence in investor deal flow. Submit your URL, add company details, or publish a press mention to restart signal detection.',
  },
};

function VelocityBar({ last30, prev30 }: { last30: number; prev30: number }) {
  const max = Math.max(last30, prev30, 1);
  const lastPct = Math.round((last30 / max) * 100);
  const prevPct = Math.round((prev30 / max) * 100);
  const isUp = last30 >= prev30;

  return (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', marginBottom: 10 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Prev 30d
        </div>
        <div style={{ height: 40, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{
            width: '100%',
            height: `${prevPct}%`,
            background: 'rgba(255,255,255,0.18)',
            borderRadius: '4px 4px 0 0',
            minHeight: prev30 > 0 ? 4 : 0,
            transition: 'height 0.8s ease-out',
          }} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginTop: 4, textAlign: 'center' }}>
          {prev30}
        </div>
      </div>

      <div style={{ fontSize: 18, fontWeight: 800, color: isUp ? 'rgba(52,211,153,0.85)' : 'rgba(251,191,36,0.85)', marginBottom: 22 }}>
        {isUp ? '↑' : '↓'}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Last 30d
        </div>
        <div style={{ height: 40, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{
            width: '100%',
            height: `${lastPct}%`,
            background: isUp ? 'rgba(52,211,153,0.60)' : 'rgba(251,191,36,0.50)',
            borderRadius: '4px 4px 0 0',
            minHeight: last30 > 0 ? 4 : 0,
            transition: 'height 0.8s ease-out',
          }} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: isUp ? 'rgba(52,211,153,0.90)' : 'rgba(251,191,36,0.90)', marginTop: 4, textAlign: 'center' }}>
          {last30}
        </div>
      </div>
    </div>
  );
}

export function SignalVelocityPanel({ data }: { data: SignalIntelligence }) {
  const vel = VELOCITY_CONFIG[data.velocityLabel];
  const cta = VELOCITY_CTA[data.velocityLabel];
  const deltaAbs = Math.abs(data.velocityDelta);
  const deltaDir = data.velocityDelta >= 0 ? '+' : '-';

  return (
    <Panel>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <Kicker>signal velocity — 30-day trend</Kicker>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: vel.color,
          background: `${vel.color.replace('0.95)', '0.10)').replace('0.85)', '0.10)')}`,
          border: `1px solid ${vel.color.replace('0.95)', '0.20)').replace('0.85)', '0.20)')}`,
          borderRadius: 6,
          padding: '2px 8px',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>
          {vel.icon} {vel.label}
        </span>
      </div>

      <VelocityBar last30={data.signalCountLast30} prev30={data.signalCountPrev30} />

      {deltaAbs > 0 && (
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginBottom: 12 }}>
          {deltaDir}{deltaAbs} signals vs previous period
        </div>
      )}

      {/* CTA */}
      <div style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 10,
        padding: '12px 14px',
        borderLeft: `3px solid ${vel.color}`,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.88)', marginBottom: 4 }}>
          {cta.headline}
        </div>
        <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.50)', margin: 0, lineHeight: 1.5 }}>
          {cta.body}
        </p>
      </div>
    </Panel>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSITE EXPORT — drop all three panels in one import
// ─────────────────────────────────────────────────────────────────────────────

export function SignalIntelligencePanels({
  data,
  loading,
  error,
}: {
  data: SignalIntelligence | null;
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <SignalIntelligenceSkeleton />;

  if (error || !data) {
    return (
      <Panel>
        <Kicker>signal intelligence</Kicker>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.40)', margin: 0 }}>
          {error ?? 'No signal data available. Submit your startup URL to activate intelligence.'}
        </p>
      </Panel>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <WhatInvestorsSeePanel data={data} />
      <SignalGapPanel data={data} />
      <SignalVelocityPanel data={data} />
    </div>
  );
}

export default SignalIntelligencePanels;
