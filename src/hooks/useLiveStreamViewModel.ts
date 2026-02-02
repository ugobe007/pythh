// ============================================================================
// useLiveStreamViewModel - Hook for Home Live Tape
// ============================================================================
// Provides LiveStreamRowViewModel[] to pure render components
// All data transformation happens here, not in components
// ============================================================================

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  LiveStreamRowViewModel, 
  LiveStreamViewModel,
  LiveStreamRawEvent,
  mapRawToLiveStreamRow,
  createPlaceholderRows,
} from '@/lib/live-stream-view-model';

// -----------------------------------------------------------------------------
// HOOK RETURN TYPE (extends LiveStreamViewModel for component use)
// -----------------------------------------------------------------------------

interface UseLiveStreamViewModelResult {
  rows: LiveStreamRowViewModel[];
  isLive: boolean;
  lastUpdateAt: Date | null;
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// -----------------------------------------------------------------------------
// HOOK
// -----------------------------------------------------------------------------

export function useLiveStreamViewModel(limit: number = 20): UseLiveStreamViewModelResult {
  const [rows, setRows] = useState<LiveStreamRowViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdateAt, setLastUpdateAt] = useState<Date | null>(null);

  // Fetch recent events
  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch recent matches (the primary "event" type for live stream)
      const { data: matches, error: matchError } = await supabase
        .from('startup_investor_matches')
        .select(`
          id,
          startup_id,
          investor_id,
          match_score,
          semantic_similarity,
          created_at,
          startup_uploads!inner(id, name, sectors),
          investors!inner(id, name, sectors)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (matchError) {
        throw new Error(`Failed to fetch matches: ${matchError.message}`);
      }

      if (!matches || matches.length === 0) {
        // Show placeholder rows when no data
        setRows(createPlaceholderRows());
        setLoading(false);
        return;
      }

      // Transform matches to LiveStreamRawEvent format
      const rawEvents: LiveStreamRawEvent[] = matches.map((m) => {
        // Get startup data with type safety
        const startupData = Array.isArray(m.startup_uploads) 
          ? m.startup_uploads[0] 
          : m.startup_uploads;
        const investorData = Array.isArray(m.investors) 
          ? m.investors[0] 
          : m.investors;
        
        // Get sector for context
        const sector = startupData?.sectors?.[0] || investorData?.sectors?.[0] || null;
        
        return {
          id: m.id,
          created_at: m.created_at,
          event_type: 'match' as const,
          investor_id: m.investor_id,
          investor_name: investorData?.name || null,
          startup_id: m.startup_id,
          startup_name: startupData?.name || null,
          signal_score: m.semantic_similarity || 5.0,
          fit_tier: Math.ceil((m.match_score || 50) / 20) as 1 | 2 | 3 | 4 | 5,
          has_delta: false,
          reason: null,
          sector: sector,
          stage: null,
        };
      });

      // Map to view models using the canonical mapper
      const viewModelRows = rawEvents
        .map(raw => mapRawToLiveStreamRow(raw))
        .filter((row): row is LiveStreamRowViewModel => row !== null);

      setRows(viewModelRows);
      setLastUpdateAt(new Date());

    } catch (err) {
      console.error('[LiveStream] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load live stream');
      // Show placeholder rows on error
      setRows(createPlaceholderRows());
    } finally {
      setLoading(false);
    }
  }, [limit]);

  // Initial fetch
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Refresh function
  const refresh = useCallback(() => {
    fetchEvents();
  }, [fetchEvents]);

  return {
    rows,
    isLive: !loading && !error,
    lastUpdateAt,
    connectionStatus: error ? 'disconnected' : loading ? 'reconnecting' : 'connected',
    loading,
    error,
    refresh,
  };
}

// -----------------------------------------------------------------------------
// Polling version for real-time feel
// -----------------------------------------------------------------------------

export function useLiveStreamViewModelWithPolling(
  limit: number = 20,
  pollIntervalMs: number = 30000 // 30 seconds default
): UseLiveStreamViewModelResult & { lastUpdated: Date | null } {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const baseViewModel = useLiveStreamViewModel(limit);

  // Set up polling
  useEffect(() => {
    if (baseViewModel.loading) return;
    
    setLastUpdated(new Date());
    
    const interval = setInterval(() => {
      baseViewModel.refresh();
      setLastUpdated(new Date());
    }, pollIntervalMs);

    return () => clearInterval(interval);
  }, [baseViewModel.loading, baseViewModel.refresh, pollIntervalMs]);

  return {
    ...baseViewModel,
    lastUpdated,
  };
}
