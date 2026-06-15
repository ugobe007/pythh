/**
 * SignalFlowBars — animated horizontal signal bars
 * Greyscale base · Emerald highlight for active/high signals
 * Delta: emerald (up) · grey (flat/down — no red)
 */

import { useState, useEffect } from 'react';

interface Signal {
  id: string;
  label: string;
  value: number; // 0-1
  delta: number;
  description: string;
}

const SIGNAL_TYPES: Signal[] = [
  { id: 'funding',     label: 'Funding Activity',  value: 0.73, delta: 0.04,  description: 'Recent funding rounds, term sheets, and investor meetings in your sector' },
  { id: 'hiring',      label: 'Hiring Velocity',   value: 0.81, delta: 0.12,  description: 'Engineering and go-to-market hiring patterns across comparable startups' },
  { id: 'market',      label: 'Market Momentum',   value: 0.58, delta: -0.05, description: 'Overall sector interest from LPs, analysts, and trade publications' },
  { id: 'social',      label: 'Social Proof',      value: 0.71, delta: 0.08,  description: 'Mentions, shares, and engagement from influential investors and founders' },
  { id: 'competition', label: 'Competition Heat',  value: 0.54, delta: 0,     description: 'Competitive landscape intensity and market consolidation signals' },
  { id: 'revenue',     label: 'Revenue Signals',   value: 0.66, delta: 0.03,  description: 'B2B contract announcements, customer logos, and revenue milestones' },
  { id: 'product',     label: 'Product Velocity',  value: 0.85, delta: 0.15,  description: 'Shipping cadence, feature launches, and product-market fit indicators' },
];

export default function SignalFlowBars() {
  const [signals, setSignals] = useState(SIGNAL_TYPES);

  useEffect(() => {
    const interval = setInterval(() => {
      setSignals(prev => prev.map(s => {
        const movement = (Math.random() - 0.5) * 0.06;
        const newValue = Math.max(0.1, Math.min(0.95, s.value + movement));
        const newDelta = +(newValue - s.value).toFixed(2);
        return { ...s, value: +newValue.toFixed(2), delta: newDelta };
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-2.5">
      {signals.map(signal => (
        <SignalBar key={signal.id} signal={signal} />
      ))}
    </div>
  );
}

function SignalBar({ signal }: { signal: Signal }) {
  const { label, value, delta } = signal;

  // Greyscale bar that turns emerald when high
  const barStyle: React.CSSProperties = {
    width: `${value * 100}%`,
    height: '100%',
    borderRadius: 999,
    transition: 'width 700ms cubic-bezier(0.4,0,0.2,1)',
    background: value >= 0.7
      ? 'linear-gradient(90deg, #10b981, rgba(16,185,129,0.4))'
      : value >= 0.5
        ? 'linear-gradient(90deg, rgba(255,255,255,0.35), rgba(255,255,255,0.12))'
        : 'linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.06))',
    boxShadow: value >= 0.7 && delta > 0
      ? '0 0 8px rgba(16,185,129,0.35)'
      : 'none',
  };

  // Delta display: emerald for up, grey for flat/down (no red)
  const deltaColor = delta > 0 ? '#34d399' : 'rgba(255,255,255,0.25)';
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '→';
  const deltaSign = delta > 0 ? '+' : '';

  return (
    <div className="flex items-center gap-3">
      {/* Label */}
      <div
        className="shrink-0 truncate"
        style={{
          width: 120,
          fontFamily: "'Geist Mono', monospace",
          fontSize: '0.7rem',
          color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.03em',
        }}
      >
        {label}
      </div>

      {/* Bar track */}
      <div
        className="flex-1 overflow-hidden"
        style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.06)' }}
      >
        <div style={barStyle} />
      </div>

      {/* Value */}
      <div
        style={{
          width: 38,
          textAlign: 'right',
          fontFamily: "'Geist Mono', monospace",
          fontSize: '0.72rem',
          color: value >= 0.7 ? '#34d399' : 'rgba(255,255,255,0.5)',
        }}
      >
        {value.toFixed(2)}
      </div>

      {/* Delta */}
      <div
        style={{
          width: 54,
          textAlign: 'right',
          fontFamily: "'Geist Mono', monospace",
          fontSize: '0.68rem',
          color: deltaColor,
        }}
      >
        {arrow} {deltaSign}{Math.abs(delta).toFixed(2)}
      </div>
    </div>
  );
}
