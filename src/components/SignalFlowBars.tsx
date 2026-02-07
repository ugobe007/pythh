/**
 * SignalFlowBars — 7 animated horizontal bars showing live signal data
 * Bars animate width changes with CSS transitions (Hot Match style)
 */

import { useState, useEffect } from 'react';

interface Signal {
  id: string;
  label: string;
  value: number; // 0-1
  delta: number; // change from previous
  description: string;
}

const SIGNAL_TYPES: Signal[] = [
  { id: 'funding', label: 'Funding Activity', value: 0.73, delta: 0.04, description: 'Recent funding rounds, term sheets, and investor meetings in your sector' },
  { id: 'hiring', label: 'Hiring Velocity', value: 0.81, delta: 0.12, description: 'Engineering and go-to-market hiring patterns across comparable startups' },
  { id: 'market', label: 'Market Momentum', value: 0.58, delta: -0.05, description: 'Overall sector interest from LPs, analysts, and trade publications' },
  { id: 'social', label: 'Social Proof', value: 0.71, delta: 0.08, description: 'Mentions, shares, and engagement from influential investors and founders' },
  { id: 'competition', label: 'Competition Heat', value: 0.54, delta: 0, description: 'Competitive landscape intensity and market consolidation signals' },
  { id: 'revenue', label: 'Revenue Signals', value: 0.66, delta: 0.03, description: 'B2B contract announcements, customer logos, and revenue milestones' },
  { id: 'product', label: 'Product Velocity', value: 0.85, delta: 0.15, description: 'Shipping cadence, feature launches, and product-market fit indicators' },
];

export default function SignalFlowBars() {
  const [signals, setSignals] = useState(SIGNAL_TYPES);

  // Simulate live updates every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSignals(prev => prev.map(s => {
        // Small random movement (-0.03 to +0.03)
        const movement = (Math.random() - 0.5) * 0.06;
        const newValue = Math.max(0.1, Math.min(0.95, s.value + movement));
        const newDelta = +(newValue - s.value).toFixed(2);
        return { ...s, value: +newValue.toFixed(2), delta: newDelta };
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-2">
      {signals.map(signal => (
        <SignalBar key={signal.id} signal={signal} />
      ))}
    </div>
  );
}

function SignalBar({ signal }: { signal: Signal }) {
  const { label, value, delta } = signal;
  
  // Color based on delta
  const deltaColor = delta > 0 
    ? 'text-emerald-400' 
    : delta < 0 
      ? 'text-red-400' 
      : 'text-zinc-500';
  
  const deltaSign = delta > 0 ? '+' : '';
  const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '→';
  
  // Bar color based on value
  const barColor = value >= 0.7 
    ? 'bg-gradient-to-r from-cyan-500 to-cyan-400' 
    : value >= 0.5 
      ? 'bg-gradient-to-r from-cyan-600 to-cyan-500' 
      : 'bg-gradient-to-r from-zinc-500 to-zinc-400';

  // Glow when increasing
  const glowClass = delta > 0 ? 'shadow-[0_0_8px_rgba(34,211,238,0.4)]' : '';

  return (
    <div className="flex items-center gap-3 group">
      {/* Label */}
      <div className="w-32 text-xs text-zinc-400 truncate">{label}</div>
      
      {/* Bar container */}
      <div className="flex-1 h-2 bg-zinc-800/50 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-700 ease-out ${barColor} ${glowClass}`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      
      {/* Value */}
      <div className="w-12 text-right font-mono text-xs text-white">
        {value.toFixed(2)}
      </div>
      
      {/* Delta */}
      <div className={`w-16 text-right font-mono text-xs ${deltaColor}`}>
        {arrow} {deltaSign}{Math.abs(delta).toFixed(2)}
      </div>
    </div>
  );
}
