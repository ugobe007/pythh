/**
 * STARTUP STATUS BAR - "Where Am I In The Capital Universe?"
 * ==========================================================
 */

import type { StatusMetrics } from '../../types/convergence';
import { TrendingUp, Users, Zap, Target } from 'lucide-react';

interface Props {
  status: StatusMetrics;
}

export function StartupStatusBar({ status }: Props) {
  return (
    <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-8 py-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
          
          {/* Velocity Class */}
          <div className="flex items-start gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400 mt-0.5" />
            <div>
              <p className="text-gray-500 text-xs mb-1">Velocity Class</p>
              <VelocityClassPill velocityClass={status.velocity_class} />
            </div>
          </div>
          
          {/* Signal Strength */}
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 text-cyan-400 mt-0.5" />
            <div>
              <p className="text-gray-500 text-xs mb-1">Signal Strength</p>
              <SignalStrengthGauge value={status.signal_strength_0_10} />
            </div>
          </div>
          
          {/* FOMO State */}
          <div className="flex items-start gap-2">
            <Target className="w-4 h-4 text-cyan-400 mt-0.5" />
            <div>
              <p className="text-gray-500 text-xs mb-1">FOMO State</p>
              <FOMOStateBadge state={status.fomo_state} />
            </div>
          </div>
          
          {/* Observers */}
          <div className="flex items-start gap-2">
            <Users className="w-4 h-4 text-cyan-400 mt-0.5" />
            <div>
              <p className="text-gray-500 text-xs mb-1">Observers (7d)</p>
              <ObserversCount count={status.observers_7d} />
            </div>
          </div>
          
          {/* Comparable Tier */}
          <div className="col-span-2 flex items-start gap-2">
            <div className="w-4 h-4 text-cyan-400 mt-0.5">📊</div>
            <div>
              <p className="text-gray-500 text-xs mb-1">Comparable Tier</p>
              <ComparableTierChip tier={status.comparable_tier} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VelocityClassPill({ velocityClass }: { velocityClass: string }) {
  const labels = {
    fast_feedback: 'Fast Feedback',
    building: 'Building',
    early: 'Early',
    regulated_long: 'Regulated'
  };
  
  return (
    <span className="text-white font-mono text-sm">
      {labels[velocityClass as keyof typeof labels] || velocityClass}
    </span>
  );
}

function SignalStrengthGauge({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-cyan-400 font-mono text-sm">{value.toFixed(1)}</span>
      <span className="text-gray-500 text-xs">/ 10</span>
    </div>
  );
}

function FOMOStateBadge({ state }: { state: string }) {
  const config = {
    breakout: { emoji: '🚀', label: 'Breakout', color: 'text-red-400' },
    surge: { emoji: '🔥', label: 'Surge', color: 'text-orange-400' },
    warming: { emoji: '🌡', label: 'Warming', color: 'text-yellow-400' },
    watch: { emoji: '👀', label: 'Watch', color: 'text-blue-400' }
  };
  
  const cfg = config[state as keyof typeof config] || config.watch;
  
  return (
    <span className={`font-mono text-sm ${cfg.color}`}>
      {cfg.emoji} {cfg.label}
    </span>
  );
}

function ObserversCount({ count }: { count: number }) {
  return (
    <span className="text-white font-mono text-sm">
      {count} investors
    </span>
  );
}

function ComparableTierChip({ tier }: { tier: string }) {
  const labels = {
    top_5: 'Top 5% of startups this month',
    top_12: 'Top 12% of startups this month',
    top_25: 'Top 25% of startups this month',
    unranked: 'Emerging tier'
  };
  
  return (
    <span className="text-white font-mono text-sm">
      {labels[tier as keyof typeof labels] || 'Unranked'}
    </span>
  );
}
