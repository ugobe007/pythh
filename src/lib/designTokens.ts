/**
 * PYTHH DESIGN TOKENS
 * ====================
 * Global constants for consistent styling
 * Import and use across all components
 */

export const PythhTokens = {
  // Backgrounds
  bg: {
    page: 'bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950',
    glasPanel: 'bg-white/5 border border-white/10 backdrop-blur',
    rowCard: 'bg-white/[0.03] border-2 border-white/30',
    error: 'bg-rose-500/10 border-rose-400/30',
    success: 'bg-emerald-500/10 border-emerald-400/30',
  },

  // Typography
  text: {
    hero: 'text-6xl sm:text-7xl font-bold tracking-tight',
    heroSmall: 'text-4xl sm:text-5xl font-bold tracking-tight',
    subhead: 'text-xl sm:text-2xl text-white/80',
    body: 'text-base text-white/90',
    label: 'text-xs text-white/50 uppercase tracking-wide',
    micro: 'text-[11px] text-white/40',
    rowFirm: 'text-3xl font-semibold tracking-tight',
    rowBracket: 'text-xl text-white/80',
  },

  // Layout
  container: {
    standard: 'max-w-6xl mx-auto px-6',
    dense: 'max-w-7xl mx-auto px-6',
  },

  // Spacing
  spacing: {
    page: 'px-6 pt-16 pb-20',
    section: 'mt-10 space-y-6',
  },

  // Buttons
  button: {
    primary: 'px-6 py-3 rounded-xl bg-orange-500 text-black font-semibold hover:bg-orange-400 transition shadow-lg',
    secondary: 'px-6 py-3 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 transition',
    ghost: 'px-4 py-2 text-white/70 hover:text-white hover:bg-white/5 transition rounded-lg',
  },

  // Borders
  border: {
    soft: 'border-white/10',
    medium: 'border-white/20',
    strong: 'border-white/30',
  },

  // Accents
  accent: {
    action: 'text-orange-500',
    science: 'text-cyan-400',
  },
} as const;

/**
 * Helper: Apply multiple token classes
 */
export function applyTokens(...tokenPaths: string[]): string {
  return tokenPaths.join(' ');
}
