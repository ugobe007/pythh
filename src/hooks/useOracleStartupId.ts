// ============================================================================
// useOracleStartupId — Resolve startup context for Oracle pages
// ============================================================================
// Priority:
//   1. ?startup=UUID in URL
//   2. localStorage.pythh_startup_id (set by Pythh submission flow)
//   3. null (exploration mode)
//
// Only returns a canonical UUID string. Garbage values would cause PostgREST 400
// on startup_id filters and RPC params.
// ============================================================================

import { useSearchParams } from 'react-router-dom';
import { isUuidString } from '@/lib/isUuid';

function normalizeStartupId(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const t = raw.trim();
  if (!t || !isUuidString(t)) return null;
  return t;
}

export function useOracleStartupId(): string | null {
  const [searchParams] = useSearchParams();
  const fromUrl = normalizeStartupId(searchParams.get('startup'));
  if (fromUrl) return fromUrl;

  try {
    const fromStorage = localStorage.getItem('pythh_startup_id');
    return normalizeStartupId(fromStorage);
  } catch {
    return null;
  }
}
