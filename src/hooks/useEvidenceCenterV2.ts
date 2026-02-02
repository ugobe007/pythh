/**
 * useEvidenceCenterV2 — Canonical hook for V2 evidence center data
 * 
 * Fetches from GET /api/evidence-center/:startupId
 * Returns: { data, loading, error, refresh, resolveInconsistency }
 * 
 * Data shape (EvidenceCenterVM):
 *   - connectedSources: SourceConnection[]
 *   - pendingEvidence: PendingEvidence[]
 *   - inconsistencies: Inconsistency[]
 *   - stats: { total, verified, pending }
 */

import { useCallback, useEffect, useState, useRef } from 'react';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export interface SourceConnection {
  id: string;
  source_type: string;
  source_name: string;
  status: 'connected' | 'pending' | 'error' | 'expired';
  last_sync: string | null;
  connected_at: string;
}

export interface PendingEvidence {
  id: string;
  evidence_type: string;
  claim_text: string;
  source_url: string | null;
  uploaded_at: string;
  verification_status: 'pending' | 'verified' | 'rejected' | 'expired';
  action_id: string | null;
}

export interface Inconsistency {
  id: string;
  type: 'conflict' | 'stale' | 'duplicate';
  description: string;
  sources: string[];
  action_id: string;
  suggested_resolution: string;
  created_at: string;
}

export interface EvidenceCenterStats {
  totalSources: number;
  verifiedSources: number;
  pendingEvidence: number;
  inconsistencies: number;
}

export interface EvidenceCenterVM {
  connectedSources: SourceConnection[];
  pendingEvidence: PendingEvidence[];
  inconsistencies: Inconsistency[];
  stats: EvidenceCenterStats;
  startupId: string;
  startupName: string;
}

interface UseEvidenceCenterResult {
  data: EvidenceCenterVM | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  resolveInconsistency: (actionId: string, resolution: 'keep_existing' | 'use_new' | 'manual_override', override?: object) => Promise<boolean>;
}

// ═══════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════

export function useEvidenceCenterV2(startupId: string | undefined): UseEvidenceCenterResult {
  const [data, setData] = useState<EvidenceCenterVM | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fetchEvidenceCenter = useCallback(async () => {
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
      const response = await fetch(`/api/evidence-center/${startupId}`, {
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

      // Map API response to EvidenceCenterVM
      const vm: EvidenceCenterVM = {
        connectedSources: json.connectedSources || [],
        pendingEvidence: json.pendingEvidence || [],
        inconsistencies: json.inconsistencies || [],
        stats: json.stats || {
          totalSources: 0,
          verifiedSources: 0,
          pendingEvidence: 0,
          inconsistencies: 0,
        },
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
      console.error('[useEvidenceCenterV2] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [startupId]);

  // Initial fetch and refetch on ID change
  useEffect(() => {
    fetchEvidenceCenter();

    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [fetchEvidenceCenter]);

  const refresh = useCallback(async () => {
    await fetchEvidenceCenter();
  }, [fetchEvidenceCenter]);

  const resolveInconsistency = useCallback(async (
    actionId: string,
    resolution: 'keep_existing' | 'use_new' | 'manual_override',
    override?: object
  ): Promise<boolean> => {
    try {
      const response = await fetch(`/api/actions/${actionId}/resolve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          resolution,
          ...(override ? { override } : {}),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[resolveInconsistency] Error:', errorData);
        return false;
      }

      const json = await response.json();

      if (json.ok) {
        // Refresh evidence center data after resolution
        await fetchEvidenceCenter();
        return true;
      }

      return false;
    } catch (err) {
      console.error('[resolveInconsistency] Error:', err);
      return false;
    }
  }, [fetchEvidenceCenter]);

  return { data, loading, error, refresh, resolveInconsistency };
}

export default useEvidenceCenterV2;
