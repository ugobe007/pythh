/**
 * Oracle GOD-gap cliffhanger — preview_cliffhanger loop (signup → wizard).
 */

import { Lock, Sparkles, ArrowRight } from 'lucide-react';
import type { GrowthAssignment } from '@/lib/growthExperiment';

export type OracleGapTop = {
  task_key?: string;
  component?: string;
  title?: string;
  impact_points?: number;
  partner_objection?: string;
  investors_unlocked_estimate?: number;
};

export type OracleGapPayload = {
  current_god_score: number;
  projected_god_score?: number;
  projected_god_if_top_fix?: number;
  god_points_if_top_fix?: number;
  investors_unlocked_if_top_fix?: number;
  total_gaps?: number;
  total_investors_unlocked?: number;
  weakest_component?: string | null;
  weakest_component_label?: string | null;
  top_gap?: OracleGapTop | null;
  headline?: string;
  subline?: string;
};

type Props = {
  gap: OracleGapPayload;
  copy?: {
    headline?: string;
    picky?: string;
    cta?: string;
    footer?: string;
    trial_cta?: string;
  };
  /** When false, show Oracle insight only — no competing signup button. */
  showActions?: boolean;
  onUnlock?: () => void;
  /** Click the top-gap row → wizard / signup to improve GOD score. */
  onGapClick?: () => void;
  onTrial?: () => void;
};

function interpolate(template: string, gap: OracleGapPayload): string {
  const top = gap.top_gap;
  return template
    .replace(/\{god_score\}/g, String(gap.current_god_score ?? 0))
    .replace(/\{god_points\}/g, String(gap.god_points_if_top_fix ?? top?.impact_points ?? 0))
    .replace(/\{investors_unlocked\}/g, String(gap.investors_unlocked_if_top_fix ?? top?.investors_unlocked_estimate ?? 0))
    .replace(/\{projected_god\}/g, String(gap.projected_god_if_top_fix ?? gap.projected_god_score ?? gap.current_god_score))
    .replace(/\{component\}/g, gap.weakest_component_label || gap.weakest_component || 'signal')
    .replace(/\{total_gaps\}/g, String(gap.total_gaps ?? 0));
}

function defaultCopy(gap: OracleGapPayload) {
  const top = gap.top_gap;
  if (!top) {
    return {
      headline: `Oracle read: GOD ${gap.current_god_score}`,
      picky: 'Your GOD profile is strong. Unlock personalized outreach drafts for your top matches.',
      cta: 'Create free account — see outreach preview',
      footer: 'Free account · then start a 7-day Oracle trial for automated outreach.',
      trial_cta: 'Start 7-day Oracle trial',
    };
  }
  return {
    headline: `GOD ${gap.current_god_score} — +${gap.god_points_if_top_fix ?? top.impact_points} unlocks ~${gap.investors_unlocked_if_top_fix ?? top.investors_unlocked_estimate} investors`,
    picky: top.partner_objection
      ? `Partners screening you: ${top.partner_objection}`
      : `Oracle flagged a ${gap.weakest_component_label || 'signal'} gap — ${top.title}.`,
    cta: 'Close this gap — improve GOD score',
    footer: 'Tap the unlock below to start closing this gap — free account saves your full gap map.',
    trial_cta: '',
  };
}

export function buildOracleGapCopy(gap: OracleGapPayload, assignment?: GrowthAssignment | null) {
  const c = assignment?.copy as Props['copy'] | undefined;
  const base = defaultCopy(gap);
  if (!c) return base;
  return {
    headline: c.headline ? interpolate(c.headline, gap) : base.headline,
    picky: c.picky ? interpolate(c.picky, gap) : base.picky,
    cta: c.cta || base.cta,
    footer: c.footer ? interpolate(c.footer, gap) : base.footer,
    trial_cta: c.trial_cta || base.trial_cta,
  };
}

export default function PreviewOracleGapTeaser({
  gap,
  copy,
  showActions = false,
  onUnlock,
  onGapClick,
  onTrial,
}: Props) {
  const text = copy?.headline
    ? {
        ...defaultCopy(gap),
        ...copy,
        headline: copy.headline ? interpolate(copy.headline, gap) : defaultCopy(gap).headline,
        picky: copy.picky ? interpolate(copy.picky, gap) : defaultCopy(gap).picky,
      }
    : defaultCopy(gap);

  const projected = gap.projected_god_if_top_fix ?? gap.projected_god_score ?? gap.current_god_score;

  return (
    <div className="mb-8 rounded-xl border border-violet-500/40 bg-gradient-to-br from-violet-600/15 via-zinc-900/80 to-zinc-950 p-5 md:p-6">
      <div className="flex items-start gap-3 mb-3">
        <div className="p-2 rounded-lg bg-violet-500/15 border border-violet-500/30 shrink-0">
          <Sparkles className="w-5 h-5 text-violet-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[2px] text-violet-400/90 mb-1">Oracle read</p>
          <h2 className="text-lg font-bold text-white leading-snug">{text.headline}</h2>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] uppercase tracking-wide text-zinc-500 mb-0.5">GOD score</p>
          <p className="text-sm font-mono text-amber-400 tabular-nums">
            {gap.current_god_score}
            {gap.top_gap && (
              <span className="text-zinc-500">
                {' '}
                → <span className="text-cyan-400">{projected}</span>
              </span>
            )}
          </p>
        </div>
      </div>

      <p className="text-sm text-zinc-300 leading-relaxed mb-4">{text.picky}</p>

      {gap.top_gap?.title && (
        onGapClick ? (
          <button
            type="button"
            onClick={onGapClick}
            className="mb-4 w-full flex items-start gap-2 rounded-lg border border-violet-500/45 bg-zinc-950/60 px-3 py-2.5 text-left transition hover:border-violet-400/70 hover:bg-violet-500/10 group cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0 group-hover:text-violet-300" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-white group-hover:text-violet-50">{gap.top_gap.title}</p>
              {gap.investors_unlocked_if_top_fix != null && (
                <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">
                  ~{gap.investors_unlocked_if_top_fix} investors unlocked · +{gap.god_points_if_top_fix ?? gap.top_gap.impact_points} GOD
                </p>
              )}
              <p className="text-[11px] text-violet-400/90 mt-1.5 font-medium">Tap to close this gap →</p>
            </div>
            <ArrowRight className="w-4 h-4 text-violet-500/70 mt-0.5 shrink-0 group-hover:text-violet-300 group-hover:translate-x-0.5 transition" />
          </button>
        ) : (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-zinc-700/80 bg-zinc-950/60 px-3 py-2.5">
            <Lock className="w-3.5 h-3.5 text-violet-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-white">{gap.top_gap.title}</p>
              {gap.investors_unlocked_if_top_fix != null && (
                <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">
                  ~{gap.investors_unlocked_if_top_fix} investors unlocked · +{gap.god_points_if_top_fix ?? gap.top_gap.impact_points} GOD
                </p>
              )}
            </div>
          </div>
        )
      )}

      {showActions && onUnlock ? (
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={onUnlock}
            className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-violet-600 hover:bg-violet-500 text-white font-bold text-sm shadow-lg shadow-violet-900/30"
          >
            {text.cta}
            <ArrowRight className="w-4 h-4" />
          </button>
          {onTrial && text.trial_cta ? (
            <button
              type="button"
              onClick={onTrial}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-sm font-semibold whitespace-nowrap"
            >
              {text.trial_cta}
            </button>
          ) : null}
        </div>
      ) : (
        <p className="text-[11px] text-zinc-500">
          {onGapClick
            ? (text.footer || 'Tap the unlock above to start closing your top GOD gap.')
            : (text.footer || 'Use the green button below to create your free account and see your full match list.')}
        </p>
      )}
      {showActions && text.footer ? (
        <p className="text-[11px] text-zinc-500 mt-3">{text.footer}</p>
      ) : null}
    </div>
  );
}
