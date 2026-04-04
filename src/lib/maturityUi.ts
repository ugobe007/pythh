/**
 * Display labels for Pythh maturity (trajectory) levels.
 * Internal DB keys stay academic for stability; UI uses investor-native language
 * (exploring → apex) so it reads as trajectory, not a grade.
 */

export type MaturityLevelKey =
  | 'freshman'
  | 'sophomore'
  | 'junior'
  | 'senior'
  | 'graduate'
  | 'phd';

export const MATURITY_SHORT: Record<MaturityLevelKey, { label: string; hint: string }> = {
  freshman:  { label: 'Exploring',  hint: 'Validating thesis & market' },
  sophomore: { label: 'Building',   hint: 'Product & team taking shape' },
  junior:    { label: 'Traction',     hint: 'Live in market' },
  senior:    { label: 'Momentum',     hint: 'Revenue & growth signals' },
  graduate:  { label: 'Scaling',      hint: 'Institutional trajectory' },
  phd:       { label: 'Apex',         hint: 'Category-defining signals' },
};

const LEVEL_BADGE_CLASS: Record<MaturityLevelKey, string> = {
  freshman:  'bg-zinc-700/50 text-zinc-200 border-zinc-600/50',
  sophomore: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  junior:    'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  senior:    'bg-amber-500/15 text-amber-300 border-amber-500/30',
  graduate:  'bg-violet-500/15 text-violet-300 border-violet-500/30',
  phd:       'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

export function maturityBadgeClass(level: string | null | undefined): string {
  if (!level || !(level in MATURITY_SHORT)) return 'bg-zinc-700/50 text-zinc-300 border-zinc-600/50';
  return LEVEL_BADGE_CLASS[level as MaturityLevelKey];
}

export function formatMaturityGapLine(gaps: unknown): string | null {
  if (!gaps) return null;
  let arr: string[] = [];
  if (Array.isArray(gaps)) {
    arr = gaps.filter((g): g is string => typeof g === 'string');
  } else if (typeof gaps === 'string') {
    try {
      const parsed = JSON.parse(gaps);
      if (Array.isArray(parsed)) arr = parsed.filter((g): g is string => typeof g === 'string');
    } catch {
      return null;
    }
  }
  const first = arr.find(
    (g) => g && !/^top tier/i.test(g.trim()) && !/^no gaps/i.test(g.trim())
  );
  if (!first) return null;
  const t = first.trim();
  return t.length > 140 ? `${t.slice(0, 137)}…` : t;
}

export function normalizeMaturityLevel(level: string | null | undefined): MaturityLevelKey | null {
  if (!level) return null;
  const k = level.toLowerCase() as MaturityLevelKey;
  return k in MATURITY_SHORT ? k : null;
}
