/**
 * Goldilocks candidate detection — aligned with `portfolio_health` / maturityClassifier:
 * classic GOD band (60–75) plus maturity-vs-GOD alignment (not thin-signal).
 */

export const GOLDILOCKS_GOD_MIN = 60;
export const GOLDILOCKS_GOD_MAX = 75;
/** Added to 0–10 signal score when `isGoldilocksCandidate` */
export const GOLDILOCKS_SIGNAL_BONUS = 0.45;

const MATURITY_INDEX: Record<string, number> = {
  freshman: 0,
  sophomore: 1,
  junior: 2,
  senior: 3,
  graduate: 4,
  phd: 5,
};

/** Same breakpoints as lib/maturityClassifier.js step 1 + portfolio_health SQL */
export function godImpliedMaturityFloorIndex(god: number): number {
  if (god >= 80) return 4;
  if (god >= 65) return 3;
  if (god >= 52) return 2;
  if (god >= 32) return 1;
  return 0;
}

export function maturityDegreeIndex(level: string | null | undefined): number | null {
  if (!level) return null;
  const k = level.toLowerCase();
  return k in MATURITY_INDEX ? MATURITY_INDEX[k] : null;
}

export function goldilocksMaturityGap(
  totalGod: number | null | undefined,
  maturityLevel: string | null | undefined
): number | null {
  const mi = maturityDegreeIndex(maturityLevel);
  if (mi === null) return null;
  return mi - godImpliedMaturityFloorIndex(totalGod ?? 0);
}

export type GoldilocksAlignment = 'unknown' | 'thin_signals' | 'ahead_of_god' | 'aligned';

export function goldilocksAlignment(
  totalGod: number | null | undefined,
  maturityLevel: string | null | undefined
): GoldilocksAlignment {
  if (maturityLevel == null || String(maturityLevel).trim() === '') return 'unknown';
  const gap = goldilocksMaturityGap(totalGod, maturityLevel);
  if (gap === null) return 'unknown';
  if (gap <= -2) return 'thin_signals';
  if (gap >= 2) return 'ahead_of_god';
  return 'aligned';
}

/**
 * Sweet-spot listing: GOD in distribution band and maturity/signals match score (not thin).
 */
export function isGoldilocksCandidate(
  totalGod: number | null | undefined,
  maturityLevel: string | null | undefined
): boolean {
  const god = totalGod ?? 0;
  if (god < GOLDILOCKS_GOD_MIN || god > GOLDILOCKS_GOD_MAX) return false;
  const a = goldilocksAlignment(totalGod, maturityLevel);
  return a === 'aligned' || a === 'ahead_of_god';
}

export function applyGoldilocksSignalBonus(signalScore: number, candidate: boolean): number {
  const bumped = signalScore + (candidate ? GOLDILOCKS_SIGNAL_BONUS : 0);
  return Math.round(Math.min(10, Math.max(0, bumped)) * 10) / 10;
}
