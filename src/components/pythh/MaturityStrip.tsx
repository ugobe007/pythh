// Trajectory band display (Exploring→Apex) for startup card + match table chrome

import {
  MATURITY_SHORT,
  maturityBadgeClass,
  formatMaturityGapLine,
  normalizeMaturityLevel,
  type MaturityLevelKey,
} from '@/lib/maturityUi';

export interface MaturityStripProps {
  level: string | null | undefined;
  score?: number | null;
  gaps?: unknown;
  /** 'card' = stacked with gap line; 'inline' = single row above match table */
  variant?: 'card' | 'inline';
  className?: string;
}

export function MaturityStrip({
  level,
  score,
  gaps,
  variant = 'card',
  className = '',
}: MaturityStripProps) {
  const key = normalizeMaturityLevel(level);
  if (!key) return null;

  const meta = MATURITY_SHORT[key];
  const gapLine = formatMaturityGapLine(gaps);
  const badgeClass = maturityBadgeClass(key);

  if (variant === 'inline') {
    return (
      <div className={`flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] ${className}`}>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md border font-medium ${badgeClass}`}
          title="Trajectory — where you are on the capital path (not a grade)"
        >
          {meta.label}
        </span>
        <span className="text-zinc-500">·</span>
        <span className="text-zinc-400">{meta.hint}</span>
        {score != null && (
          <>
            <span className="text-zinc-600">·</span>
            <span className="text-zinc-500 tabular-nums">Trajectory {score}</span>
          </>
        )}
        {gapLine && (
          <>
            <span className="text-zinc-600 hidden sm:inline">·</span>
            <span className="text-amber-400/85 w-full sm:w-auto sm:inline" title={gapLine}>
              Next: {gapLine}
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center px-2.5 py-1 rounded-md border text-xs font-semibold ${badgeClass}`}
          title="Trajectory — Exploring through Apex (capital readiness, not a grade)"
        >
          {meta.label}
        </span>
        <span className="text-xs text-zinc-400">{meta.hint}</span>
        {score != null && (
          <span className="text-[10px] text-zinc-500 tabular-nums ml-auto sm:ml-0">
            Trajectory score {score}
          </span>
        )}
      </div>
      {gapLine && (
        <p className="text-[11px] text-amber-400/90 leading-snug border-l-2 border-amber-500/30 pl-2">
          <span className="text-zinc-500 font-medium mr-1">Tip:</span>
          {gapLine}
        </p>
      )}
    </div>
  );
}

/** Map raw DB level string to display label (fallback) */
export function maturityLabelForKey(level: string | null | undefined): string | null {
  const k = normalizeMaturityLevel(level) as MaturityLevelKey | null;
  if (!k) return null;
  return MATURITY_SHORT[k].label;
}
