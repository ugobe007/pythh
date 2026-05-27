/** Shared design tokens — terminal / data-noir palette for pythh.ai */

export const G = "oklch(0.696 0.17 162.48)";
export const CYAN = "#22d3ee";
export const AMBER = "oklch(0.78 0.14 65)";
export const GOLD = "oklch(0.769 0.188 70.08)";
export const PURPLE = "#a855f7";
export const VIOLET = "#a78bfa";
export const VIOLET_HOVER = "#c4b5fd";
export const VIOLET_BORDER = "#7c3aed";
export const G_HOVER = "oklch(0.78 0.17 162.48)";
export const G_SUBTLE = "oklch(0.696 0.17 162.48 / 0.12)";
export const G_BORDER = "oklch(0.696 0.17 162.48 / 0.35)";
export const MUTED = "oklch(0.55 0.01 264)";
export const DIM = "oklch(0.42 0.01 264)";
export const BORDER = "oklch(0.2 0.01 264)";
export const CARD = "oklch(0.12 0.01 264)";
export const PAGE = "oklch(0.09 0.01 264)";
export const TEXT = "oklch(0.94 0.005 264)";
export const SEPARATOR = "oklch(0.28 0.01 264)";

export function godScoreColor(score: number | null | undefined): string {
  if (score == null) return MUTED;
  if (score >= 80) return G;
  if (score >= 65) return CYAN;
  if (score >= 50) return AMBER;
  return MUTED;
}

export function deltaColor(delta: number): string {
  if (delta > 0) return G;
  if (delta < 0) return AMBER;
  return TEXT;
}

export function moicColor(moic: number): string {
  if (moic > 1.05) return G;
  if (moic < 0.95) return AMBER;
  return TEXT;
}

export function tierColor(tier: string): string {
  if (tier === "core") return G;
  if (tier === "watch" || tier === "review") return AMBER;
  return MUTED;
}

export function tierLabel(tier: string): string {
  const map: Record<string, string> = {
    core: "Core",
    watch: "Watch",
    review: "Review",
    exited: "Exited",
  };
  return map[tier] ?? tier;
}

/** 0–10 PYTHIA signal score */
export function signalScoreColor(score: number | null | undefined): string {
  if (score == null) return MUTED;
  if (score >= 8) return G;
  if (score >= 6) return CYAN;
  if (score >= 4) return GOLD;
  return MUTED;
}
