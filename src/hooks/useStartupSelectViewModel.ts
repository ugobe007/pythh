// ============================================================================
// useStartupSelectViewModel - Hook for Startup Select Page
// ============================================================================
// Provides StartupSelectRowViewModel[] to pure render components
// All data transformation happens here, not in components
// ============================================================================

import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  StartupSelectRowViewModel, 
  SortKey,
  StartupSelectRawData,
  mapRawToStartupSelectRow,
  sortStartupSelectRows,
  validateStartupSelectViewModel,
} from '@/lib/startup-select-view-model';

// -----------------------------------------------------------------------------
// HOOK RETURN TYPE
// -----------------------------------------------------------------------------

interface UseStartupSelectViewModelResult {
  rows: StartupSelectRowViewModel[];
  loading: boolean;
  error: string | null;
  sortKey: SortKey;
  sortDirection: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
}

// -----------------------------------------------------------------------------
// HOOK
// -----------------------------------------------------------------------------

export function useStartupSelectViewModel(): UseStartupSelectViewModelResult {
  const [rows, setRows] = useState<StartupSelectRowViewModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('readiness');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Fetch and transform data
  const fetchStartups = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Fetch approved startups with GOD scores
      const { data: startups, error: startupError } = await supabase
        .from('startup_uploads')
        .select(`
          id,
          name,
          sector,
          sectors,
          total_god_score,
          yc_plus_plus_score,
          team_score,
          traction_score,
          market_score,
          product_score,
          vision_score,
          created_at,
          updated_at
        `)
        .eq('status', 'approved')
        .order('total_god_score', { ascending: false });

      if (startupError) {
        throw new Error(`Failed to fetch startups: ${startupError.message}`);
      }

      if (!startups || startups.length === 0) {
        setRows([]);
        setLoading(false);
        return;
      }

      // Step 2: Fetch match counts per startup
      const startupIds = startups.map((s) => s.id);
      const { data: matchCounts, error: matchError } = await supabase
        .from('startup_investor_matches')
        .select('startup_id')
        .in('startup_id', startupIds);

      if (matchError) {
        console.warn('[StartupSelect] Failed to fetch match counts:', matchError.message);
      }

      // Build match count map
      const matchCountMap = new Map<string, number>();
      if (matchCounts) {
        for (const match of matchCounts) {
          const current = matchCountMap.get(match.startup_id) || 0;
          matchCountMap.set(match.startup_id, current + 1);
        }
      }

      // Step 3: Fetch score history for delta calculation (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: scoreHistory } = await supabase
        .from('score_history')
        .select('startup_id, old_score, new_score, created_at')
        .in('startup_id', startupIds)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: true });

      // Build delta map (difference from 7 days ago)
      const deltaMap = new Map<string, number>();
      if (scoreHistory && scoreHistory.length > 0) {
        for (const entry of scoreHistory) {
          const existingDelta = deltaMap.get(entry.startup_id);
          // First entry for this startup sets the old score reference
          // Last entry sets the current score - calculate delta
          if (existingDelta === undefined && entry.old_score !== null) {
            // Store old score as negative so we can calculate delta later
            deltaMap.set(entry.startup_id, entry.new_score - entry.old_score);
          }
        }
      }

      // Step 4: Transform to view models using canonical raw data structure
      const rawData: StartupSelectRawData[] = startups.map((s) => ({
        id: s.id,
        name: s.name,
        sectors: Array.isArray(s.sectors) ? s.sectors : s.sector ? [s.sector] : null,
        stage: null, // TODO: Wire to actual stage field when available
        total_god_score: s.total_god_score,
        signal_score: null, // TODO: Wire to actual signal when available
        signal_delta_7d: deltaMap.get(s.id) || null,
        yc_plus_plus: s.yc_plus_plus_score,
        readiness_tier: null, // Let view model calculate
        match_count: matchCountMap.get(s.id) || 0,
      }));

      const viewModelRows = rawData
        .map(mapRawToStartupSelectRow)
        .filter((row): row is StartupSelectRowViewModel => row !== null);

      // Step 5: Validate
      const issues = validateStartupSelectViewModel({ 
        rows: viewModelRows, 
        sortedBy: sortKey, 
        sortDirection, 
        totalCount: viewModelRows.length,
        loading: false 
      });
      if (issues.length > 0) {
        console.warn('[StartupSelect] Validation issues:', issues);
      }

      // Step 6: Sort
      const sortedRows = sortStartupSelectRows(viewModelRows, sortKey, sortDirection);
      setRows(sortedRows);

    } catch (err) {
      console.error('[StartupSelect] Fetch error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load startups');
    } finally {
      setLoading(false);
    }
  }, [sortKey, sortDirection]);

  // Initial fetch
  useEffect(() => {
    fetchStartups();
  }, [fetchStartups]);

  // Sort handler
  const handleSort = useCallback((key: SortKey) => {
    if (key === sortKey) {
      setSortDirection(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDirection('desc');
    }
  }, [sortKey]);

  // Re-sort when sort params change (without refetching)
  const sortedRows = useMemo(() => {
    return sortStartupSelectRows(rows, sortKey, sortDirection);
  }, [rows, sortKey, sortDirection]);

  return {
    rows: sortedRows,
    loading,
    error,
    sortKey,
    sortDirection,
    onSort: handleSort,
  };
}
