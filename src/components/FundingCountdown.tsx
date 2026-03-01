/**
 * FundingCountdown
 * =================
 * Displays a countdown clock to the end of a startup's predicted funding window.
 * 
 * Confidence tiers:
 *   Imminent    (≥80%) → amber pulse + "Funding Imminent"
 *   Strong Signal (≥60%) → cyan     + "Strong Funding Signal"
 *   Likely       (≥40%) → zinc      + "Likely to Raise"
 */

import { useEffect, useState } from 'react';
import type { FundingPredictionData } from '../hooks/useFundingPrediction';

export type { FundingPredictionData };

interface Props {
  prediction: FundingPredictionData;
  compact?: boolean; // true = one-liner for cards, false = expanded for detail view
}

function msUntil(isoDate: string): number {
  return new Date(isoDate).getTime() - Date.now();
}

function formatCountdown(ms: number): { value: string; unit: string } {
  if (ms <= 0) return { value: '0', unit: 'days' };
  const totalHours = ms / 3_600_000;
  if (totalHours < 48) {
    const h = Math.floor(totalHours);
    return { value: String(h), unit: h === 1 ? 'hour' : 'hours' };
  }
  const days = Math.ceil(totalHours / 24);
  return { value: String(days), unit: days === 1 ? 'day' : 'days' };
}

function buildWhyText(snap?: FundingPredictionData['signals_snapshot']): string | null {
  if (!snap) return null;
  const parts: string[] = [];
  if (snap.pedigree_tier === 'elite') parts.push('elite backing');
  else if (snap.pedigree_tier === 'top') parts.push('top-tier investor');
  if (snap.has_raise_language) parts.push('raising now');
  if (snap.near_yc_demo_day) parts.push('YC Demo Day');
  if (snap.signals_score && snap.signals_score >= 15) parts.push('high social signals');
  if (snap.momentum_score && snap.momentum_score >= 5) parts.push('strong momentum');
  return parts.length > 0 ? parts.slice(0, 3).join(' · ') : null;
}

export default function FundingCountdown({ prediction, compact = false }: Props) {
  const [remaining, setRemaining] = useState(() => msUntil(prediction.window_end));

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(msUntil(prediction.window_end));
    }, 60_000); // update every minute
    return () => clearInterval(id);
  }, [prediction.window_end]);

  if (remaining <= 0 || prediction.status !== 'active') return null;

  const countdown = formatCountdown(remaining);
  const why = buildWhyText(prediction.signals_snapshot);

  // Colour scheme per confidence tier
  const themes = {
    Imminent: {
      border: 'border-amber-500/50',
      bg: 'bg-amber-500/10',
      dot: 'bg-amber-500',
      label: 'text-amber-400',
      value: 'text-amber-300',
      unit: 'text-amber-500',
      icon: '🔴',
      badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
      pulse: true,
    },
    'Strong Signal': {
      border: 'border-cyan-500/40',
      bg: 'bg-cyan-500/8',
      dot: 'bg-cyan-400',
      label: 'text-cyan-400',
      value: 'text-cyan-300',
      unit: 'text-cyan-500',
      icon: '🟡',
      badge: 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/25',
      pulse: false,
    },
    Likely: {
      border: 'border-zinc-600/40',
      bg: 'bg-zinc-800/50',
      dot: 'bg-zinc-400',
      label: 'text-zinc-400',
      value: 'text-zinc-300',
      unit: 'text-zinc-500',
      icon: '⚪',
      badge: 'bg-zinc-700/50 text-zinc-400 border border-zinc-600/30',
      pulse: false,
    },
  } as const;

  const t = themes[prediction.confidence_label];

  if (compact) {
    // One-liner for startup cards
    return (
      <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${t.bg} border ${t.border}`}>
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${t.dot} ${t.pulse ? 'animate-pulse' : ''}`} />
        <span className={`text-[10px] font-bold uppercase tracking-wider ${t.label}`}>
          {prediction.confidence_label}
        </span>
        <span className="text-zinc-600 text-[10px]">·</span>
        <span className={`text-xs font-black ${t.value}`}>{countdown.value}</span>
        <span className={`text-[10px] ${t.unit}`}>{countdown.unit}</span>
        <span className="text-zinc-500 text-[10px]">left in window</span>
      </div>
    );
  }

  // Expanded version for detail panels
  return (
    <div className={`rounded-xl border ${t.border} ${t.bg} p-4 space-y-3`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${t.dot} ${t.pulse ? 'animate-pulse' : ''}`} />
          <span className={`text-xs font-bold uppercase tracking-wider ${t.label}`}>
            Funding Prediction
          </span>
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${t.badge}`}>
          {prediction.confidence_label}
        </span>
      </div>

      {/* Countdown */}
      <div className="flex items-baseline gap-2">
        <span className={`text-4xl font-black tabular-nums ${t.value}`}>{countdown.value}</span>
        <span className={`text-lg font-bold ${t.unit}`}>{countdown.unit}</span>
        <span className="text-zinc-500 text-sm">remaining in window</span>
      </div>

      {/* Confidence bar */}
      <div>
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-zinc-500">Confidence</span>
          <span className={t.label}>{Math.round(prediction.confidence * 100)}%</span>
        </div>
        <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              prediction.confidence_label === 'Imminent'
                ? 'bg-amber-500'
                : prediction.confidence_label === 'Strong Signal'
                ? 'bg-cyan-500'
                : 'bg-zinc-500'
            }`}
            style={{ width: `${prediction.confidence * 100}%` }}
          />
        </div>
      </div>

      {/* Why signals */}
      {why && (
        <p className="text-[10px] text-zinc-500">
          <span className="text-zinc-600 font-semibold uppercase tracking-wider">Signals: </span>
          {why}
        </p>
      )}
    </div>
  );
}
