/**
 * Signal-delta cliffhanger — picky + motivating gate card (preview_cliffhanger loop).
 */

import { TrendingUp, TrendingDown, Lock } from 'lucide-react';
import type { GrowthAssignment } from '@/lib/growthExperiment';

export type MatchMovement = {
  moved_toward_count: number;
  moved_away_count: number;
  match_count: number;
  screened_out_count?: number;
  signal_score_delta?: number | null;
  source?: string;
  window_days?: number;
};

type Props = {
  movement: MatchMovement;
  copy?: {
    picky?: string;
    headline?: string;
    cta?: string;
    footer?: string;
  };
  onUnlock: () => void;
};

function interpolate(template: string, movement: MatchMovement): string {
  return template
    .replace(/\{match_count\}/g, String(movement.match_count ?? 0))
    .replace(/\{moved_toward_count\}/g, String(movement.moved_toward_count ?? 0))
    .replace(/\{moved_away_count\}/g, String(movement.moved_away_count ?? 0))
    .replace(/\{screened_out_count\}/g, String(movement.screened_out_count ?? 0));
}

function defaultCopy(movement: MatchMovement) {
  const screened = Math.max(0, (movement.match_count ?? 0) - movement.moved_toward_count);
  return {
    headline: 'Your matches moved this week.',
    picky: `We screened ${movement.match_count.toLocaleString()} investors; ${movement.moved_toward_count} shifted thesis-fit toward you this week${movement.moved_away_count ? ` and ${movement.moved_away_count} cooled` : ''}.`,
    cta: 'See which moved — create a free account',
    footer: `Free account unlocks the full delta, the why, and the warm intro${screened > 0 ? ` — ${screened.toLocaleString()} screened out` : ''}.`,
  };
}

export function buildDeltaCopy(
  movement: MatchMovement,
  assignment?: GrowthAssignment | null,
) {
  const c = assignment?.copy as Props['copy'] | undefined;
  const base = defaultCopy(movement);
  if (!c) return base;
  return {
    headline: c.headline || base.headline,
    picky: c.picky ? interpolate(c.picky, movement) : base.picky,
    cta: c.cta || base.cta,
    footer: c.footer ? interpolate(c.footer, movement) : base.footer,
  };
}

export default function PreviewSignalDeltaTeaser({ movement, copy, onUnlock }: Props) {
  const text = copy?.headline ? { ...defaultCopy(movement), ...copy, picky: copy.picky ? interpolate(copy.picky, movement) : defaultCopy(movement).picky } : defaultCopy(movement);

  return (
    <div className="mb-8 rounded-xl border border-amber-500/35 bg-gradient-to-br from-amber-500/10 via-zinc-900/80 to-zinc-950 p-5 md:p-6">
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 shrink-0">
          <Lock className="w-5 h-5 text-amber-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[2px] text-amber-400/90 mb-1">Live signal delta</p>
          <h2 className="text-lg font-bold text-white">{text.headline}</h2>
        </div>
      </div>

      <p className="text-sm text-zinc-300 leading-relaxed mb-4">{text.picky}</p>

      <div className="flex flex-wrap gap-4 mb-5 text-xs">
        {movement.moved_toward_count > 0 && (
          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-mono">
            <TrendingUp className="w-3.5 h-3.5" />
            +{movement.moved_toward_count} toward you
          </span>
        )}
        {movement.moved_away_count > 0 && (
          <span className="inline-flex items-center gap-1.5 text-zinc-500 font-mono">
            <TrendingDown className="w-3.5 h-3.5" />
            {movement.moved_away_count} cooled
          </span>
        )}
        {movement.signal_score_delta != null && movement.signal_score_delta !== 0 && (
          <span className="text-cyan-400/90 font-mono">
            Signal score {movement.signal_score_delta > 0 ? '+' : ''}
            {movement.signal_score_delta} (7d)
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onUnlock}
        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm shadow-lg shadow-amber-900/30"
      >
        {text.cta}
      </button>
      <p className="text-[11px] text-zinc-500 mt-3">{text.footer}</p>
    </div>
  );
}
