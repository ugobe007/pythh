import { useState, useEffect, useCallback } from 'react';
import { LivePairing, LivePairingsState } from '../types/livePairings';
import { PlanTier, getLivePairingsLimit } from '../utils/plan';

/**
 * Hook to fetch live signal pairings from the API
 * 
 * @param plan - User's plan tier for server-side gating
 * @param enablePolling - Whether to poll for updates (default false - don't hammer the API)
 * @param pollingInterval - Polling interval in ms (default 30000 = 30s)
 */
export function useLivePairings(
  plan: PlanTier = 'free',
  enablePolling: boolean = false,
  pollingInterval: number = 30000
): LivePairingsState & { refetch: () => void } {
  const [data, setData] = useState<LivePairing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  
  // Get limit based on plan (server enforces this too, but reduces payload)
  const limit = getLivePairingsLimit(plan);

  const fetchPairings = useCallback(async () => {
    try {
      // Use relative URL in production, full URL in dev
      const baseUrl = import.meta.env.DEV 
        ? 'http://localhost:3002' 
        : '';
      
      const response = await fetch(`${baseUrl}/api/live-pairings?limit=${limit}`, {
        headers: {
          'Accept': 'application/json',
          // Pass plan via header for dev/testing (server also checks JWT in prod)
          'x-user-plan': plan,
        },
      });

      if (!response.ok) {
        // If 404, endpoint doesn't exist - fail silently in production
        if (response.status === 404) {
          console.warn('[useLivePairings] Endpoint not found (404) - feature may not be deployed');
          setData([]);
          setError(null); // Don't show error to user
          setLastUpdatedAt(new Date());
          return;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }

      setData(result);
      setError(null);
      setLastUpdatedAt(new Date());
    } catch (err) {
      console.error('[useLivePairings] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pairings');
      // Don't clear data on error - keep showing stale data
    } finally {
      setLoading(false);
    }
  }, [limit, plan]);

  // Initial fetch on mount
  useEffect(() => {
    fetchPairings();
  }, [fetchPairings]);

  // Optional polling (disabled by default)
  useEffect(() => {
    if (!enablePolling) return;

    const interval = setInterval(() => {
      fetchPairings();
    }, pollingInterval);

    return () => clearInterval(interval);
  }, [enablePolling, pollingInterval, fetchPairings]);

  return {
    data,
    loading,
    error,
    lastUpdatedAt,
    refetch: fetchPairings,
  };
}

export default useLivePairings;
