import { useState, useEffect, useCallback } from 'react';
import { PlanTier, getTrendingLimit } from '../utils/plan';

/**
 * Trending startup data from API
 */
export interface TrendingStartup {
  id: string;
  name: string;
  sector_key: string;
  investor_state_sector: 'hot' | 'warm' | 'watch' | 'cold';
  // Pro+ fields
  investor_signal_sector_0_10?: number;
  // Elite fields
  sector_rank?: number;
  sector_momentum_0_10?: number;
  sector_evidence_0_10?: number;
  sector_narrative_0_10?: number;
  primary_reason?: string;
  risk_flag?: string;
}

interface TrendingResponse {
  plan: PlanTier;
  limit: number;
  total: number;
  data: TrendingStartup[];
}

interface UseTrendingState {
  data: TrendingStartup[];
  loading: boolean;
  error: string | null;
  plan: PlanTier;
  limit: number;
  total: number;
}

/**
 * Hook to fetch trending/sector data with plan gating
 * 
 * @param plan - User's plan tier
 * @param sector - Optional sector filter
 */
export function useTrending(
  plan: PlanTier = 'free',
  sector?: string
): UseTrendingState & { refetch: () => void } {
  const [data, setData] = useState<TrendingStartup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responsePlan, setResponsePlan] = useState<PlanTier>('free');
  const [limit, setLimit] = useState(3);
  const [total, setTotal] = useState(0);
  
  const requestLimit = getTrendingLimit(plan);

  const fetchTrending = useCallback(async () => {
    try {
      setLoading(true);
      
      // Use relative URL in production, full URL in dev
      const baseUrl = import.meta.env.DEV 
        ? 'http://localhost:3002' 
        : '';
      
      let url = `${baseUrl}/api/trending?limit=${requestLimit}`;
      if (sector) {
        url += `&sector=${encodeURIComponent(sector)}`;
      }
      
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          // Server derives plan from JWT - removed x-user-plan header
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: TrendingResponse = await response.json();
      
      if ((result as any).error) {
        throw new Error((result as any).error);
      }

      setData(result.data);
      setResponsePlan(result.plan);
      setLimit(result.limit);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      console.error('[useTrending] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load trending data');
    } finally {
      setLoading(false);
    }
  }, [plan, sector, requestLimit]);

  // Initial fetch on mount
  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  return {
    data,
    loading,
    error,
    plan: responsePlan,
    limit,
    total,
    refetch: fetchTrending,
  };
}
