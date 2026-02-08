// ============================================================================
// useSignalsViewModel - Hook for Find Investor Signals Page
// ============================================================================
// Manages state machine and provides InvestorSignalRowViewModel[]
// All data transformation happens here, not in components
//
// Now uses unified submitStartup() so that "Find Signals" can also
// create and score startups — not just look up existing ones.
// ============================================================================

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { submitStartup } from '@/services/submitStartup';
import { 
  SignalsPageState,
  InvestorSignalRowViewModel, 
  InvestorSignalRawData,
  mapRawToInvestorSignalRow,
  extractDomainForLookup,
} from '@/lib/signals-view-model';

// -----------------------------------------------------------------------------
// HOOK RETURN TYPE
// -----------------------------------------------------------------------------

interface UseSignalsViewModelResult {
  pageState: 'idle' | 'analyzing' | 'live' | 'not_found' | 'error';
  signals: InvestorSignalRowViewModel[];
  error: string | null;
  startupId: string | null;
  startupName: string | null;
  findSignals: (url: string) => Promise<void>;
  reset: () => void;
}

// -----------------------------------------------------------------------------
// HOOK
// -----------------------------------------------------------------------------

export function useSignalsViewModel(): UseSignalsViewModelResult {
  const [pageState, setPageState] = useState<'idle' | 'analyzing' | 'live' | 'not_found' | 'error'>('idle');
  const [signals, setSignals] = useState<InvestorSignalRowViewModel[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [startupId, setStartupId] = useState<string | null>(null);
  const [startupName, setStartupName] = useState<string | null>(null);

  // Find signals for a given URL
  // Uses unified submitStartup() so it can create + score new startups too
  const findSignals = useCallback(async (url: string) => {
    setPageState('analyzing');
    setError(null);
    setSignals([]);
    setStartupId(null);
    setStartupName(null);

    try {
      // Step 1: Resolve startup via unified service (creates if needed)
      const result = await submitStartup(url);

      if (!result.startup_id || result.status === 'not_found' || result.status === 'error') {
        setPageState('not_found');
        return;
      }

      setStartupId(result.startup_id);
      setStartupName(result.name || null);

      // Step 2: Get sector info for fallback
      const { data: startupRow } = await supabase
        .from('startup_uploads')
        .select('sectors, sector')
        .eq('id', result.startup_id)
        .single();

      const sectors = startupRow?.sectors || (startupRow?.sector ? [startupRow.sector] : []);

      // Step 3: Fetch investor matches for this startup
      await fetchMatchesForStartup(result.startup_id, sectors);

    } catch (err) {
      console.error('[Signals] Error finding signals:', err);
      setError(err instanceof Error ? err.message : 'Failed to find investor signals');
      setPageState('error');
    }
  }, []);

  // Fetch matches for a startup
  const fetchMatchesForStartup = async (startupId: string, sectors: string[]) => {
    try {
      // Get existing matches
      const { data: matches, error: matchError } = await supabase
        .from('startup_investor_matches')
        .select(`
          id,
          investor_id,
          match_score,
          semantic_similarity,
          investors!inner(id, name, firm, sectors, stage)
        `)
        .eq('startup_id', startupId)
        .order('match_score', { ascending: false })
        .limit(50);

      if (matchError) {
        throw matchError;
      }

      if (!matches || matches.length === 0) {
        // No existing matches - try to find similar investors by sector
        const { data: investors, error: investorError } = await supabase
          .from('investors')
          .select('id, name, firm, sectors, stage')
          .overlaps('sectors', sectors)
          .limit(30);

        if (investorError || !investors || investors.length === 0) {
          setPageState('not_found');
          return;
        }

        // Create pseudo-signals from sector-matched investors
        const rawSignals: InvestorSignalRawData[] = investors.map((inv) => ({
          id: `signal-${inv.id}`,
          investor_id: inv.id,
          investor_name: inv.name,
          signal_score: 5.0, // Base score for sector match
          signal_delta: null,
          fit_tier: 3,
          reason: `Sector match: ${inv.sectors?.[0] || 'Unknown'}`,
          sector_match: inv.sectors?.[0] || null,
          updated_at: new Date().toISOString(),
        }));

        const signalRows = rawSignals
          .map(mapRawToInvestorSignalRow)
          .filter((row): row is InvestorSignalRowViewModel => row !== null);

        setSignals(signalRows);
        setPageState(signalRows.length > 0 ? 'live' : 'not_found');
        return;
      }

      // Transform matches to signal view models
      const rawSignals: InvestorSignalRawData[] = matches.map((m) => {
        const investor = Array.isArray(m.investors) ? m.investors[0] : m.investors;
        return {
          id: m.id,
          investor_id: m.investor_id,
          investor_name: investor?.name || 'Unknown',
          signal_score: m.semantic_similarity || 5.0,
          signal_delta: null,
          fit_tier: Math.ceil((m.match_score || 50) / 20),
          reason: null,
          sector_match: investor?.sectors?.[0] || null,
          updated_at: new Date().toISOString(),
        };
      });

      const signalRows = rawSignals
        .map(mapRawToInvestorSignalRow)
        .filter((row): row is InvestorSignalRowViewModel => row !== null);

      setSignals(signalRows);
      setPageState(signalRows.length > 0 ? 'live' : 'not_found');

    } catch (err) {
      console.error('[Signals] Error fetching matches:', err);
      throw err;
    }
  };

  // Reset to idle state
  const reset = useCallback(() => {
    setPageState('idle');
    setSignals([]);
    setError(null);
    setStartupId(null);
    setStartupName(null);
  }, []);

  return {
    pageState,
    signals,
    error,
    startupId,
    startupName,
    findSignals,
    reset,
  };
}
