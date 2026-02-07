// ============================================================================
// useOracleStartupId — Resolve startup context for Oracle pages
// ============================================================================
// Priority:
//   1. ?startup=UUID in URL
//   2. localStorage.pythh_startup_id (set by Pythh submission flow)
//   3. null (exploration mode)
// ============================================================================

import { useSearchParams } from 'react-router-dom';

export function useOracleStartupId(): string | null {
  const [searchParams] = useSearchParams();
  const fromUrl = searchParams.get('startup');
  if (fromUrl) return fromUrl;

  try {
    const fromStorage = localStorage.getItem('pythh_startup_id');
    if (fromStorage && fromStorage.trim().length > 0) return fromStorage.trim();
  } catch {
    // localStorage unavailable
  }

  return null;
}
