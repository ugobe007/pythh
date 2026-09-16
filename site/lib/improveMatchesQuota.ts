/**
 * Anonymous improve-matches quota — two refinements per startup, then signup.
 * Counts live in this browser only; an account is what keeps the shortlist.
 */

export const ANON_IMPROVE_LIMIT = 2;
const STORAGE_KEY = 'pythh_improve_matches_count';

type QuotaMap = Record<string, number>;

function readMap(): QuotaMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as QuotaMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: QuotaMap) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function keyFor(startupId: string): string {
  return startupId.trim();
}

export function getImproveCount(startupId?: string | null): number {
  if (!startupId) return 0;
  const value = readMap()[keyFor(startupId)];
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function remainingAnonImproves(startupId?: string | null): number {
  return Math.max(0, ANON_IMPROVE_LIMIT - getImproveCount(startupId));
}

export function canImproveAnonymously(startupId?: string | null): boolean {
  return remainingAnonImproves(startupId) > 0;
}

export function recordImproveCompletion(startupId?: string | null): number {
  if (!startupId) return 0;
  const map = readMap();
  const next = getImproveCount(startupId) + 1;
  map[keyFor(startupId)] = next;
  writeMap(map);
  return next;
}
