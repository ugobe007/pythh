/**
 * useStartupScorecardV2 — Canonical hook for V2 scorecard data
 * 
 * Fetches from GET /api/scorecard/:startupId
 * Returns: { data, loading, error, refresh }
 * 
 * Data shape (ScorecardVM):
 *   - signal: { value, delta }
 *   - god: { value, delta }  
 *   - verification: { tier, multiplier }
 *   - features: { teamCredibility, tractionQuality, ... }
 *   - movers: ActionEvent[] (actions that moved score)
 *   - blockers: BlockerWarning[] (what's capping score)
 */

import { useCallback, useEffect, useState, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface ScorecardFeature {
  key: string;
  label: string;
  value: number;
  weight: number;
  contribution: number;
  verificationTier: 'unverified' | 'soft_verified' | 'verified' | 'trusted';
}

export interface ActionMover {
  id: string;
  action_type: string;
  claim_text: string;
  delta_signal: number;
  created_at: string;
  verification_tier: string;
}

export interface BlockerWarning {
  code: string;
  feature: string;
  message: string;
  impact: string;
  suggestedAction: string;
}

export interface ScorecardVM {
  signal: { value: number; delta: number };
  god: { value: number; delta: number };
  verification: { tier: string; multiplier: number };
  features: ScorecardFeature[];
  movers: ActionMover[];
  blockers: BlockerWarning[];
  lastUpdated: string;
  startupId: string;
  startupName: string;
}

interface UseScorecardResult {
  data: ScorecardVM | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════

export function useStartupScorecardV2(startupId: string | undefined): UseScorecardResult {
  const [data, setData] = useState<ScorecardVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchScorecard = useCallback(async () => {
    if (!startupId) {
      setLoading(false);
      setError('No startup ID provided');
      return;
    }

    // Abort previous request if still pending
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/scorecard/${startupId}`, {
        signal: abortRef.current.signal,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const json = await response.json();

      if (!json.ok) {
        throw new Error(json.error || 'API returned error');
      }

      // Map API response to ScorecardVM
      const vm: ScorecardVM = {
        signal: json.signal || { value: 0, delta: 0 },
        god: json.god || { value: 0, delta: 0 },
        verification: json.verification || { tier: 'unverified', multiplier: 0.35 },
        features: json.features || [],
        movers: json.movers || [],
        blockers: json.blockers || [],
        lastUpdated: json.lastUpdated || new Date().toISOString(),
        startupId: json.startupId || startupId,
        startupName: json.startupName || 'Unknown',
      };

      setData(vm);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        // Request was cancelled, don't update state
        return;
      }
      console.error('[useStartupScorecardV2] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startupId]);

  // Initial fetch and refetch on ID change
  useEffect(() => {
    fetchScorecard();

    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [fetchScorecard]);

  const refresh = useCallback(async () => {
    await fetchScorecard();
  }, [fetchScorecard]);

  return { data, loading, error, refresh };
}

export default useStartupScorecardV2;
