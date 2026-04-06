/** Portfolio health tiers from `portfolio_health` view (API + DB). */

export type HealthTier = 'core' | 'watch' | 'review' | 'exited';

export function healthTierLabel(tier: string): string {
  const m: Record<string, string> = {
    core: 'Core',
    watch: 'Watch',
    review: 'Review',
    exited: 'Exited',
  };
  return m[tier] ?? tier;
}

export function healthTierChipClass(tier: string): string {
  const map: Record<string, string> = {
    core: 'border-emerald-400/60 text-emerald-400 bg-emerald-400/10',
    watch: 'border-amber-400/60 text-amber-400 bg-amber-400/10',
    review: 'border-red-400/70 text-red-300 bg-red-400/10',
    exited: 'border-white/20 text-white/50 bg-white/5',
  };
  return map[tier] ?? map.core;
}
