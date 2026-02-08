// ============================================================================
// useSignalsViewModel - Hook for Find Investor Signals Page
// ============================================================================
// Manages state machine and provides InvestorSignalRowViewModel[]
// All data transformation happens here, not in components
// ============================================================================

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
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
  const findSignals = useCallback(async (url: string) => {
    setPageState('analyzing');
    setError(null);
    setSignals([]);
    setStartupId(null);
    setStartupName(null);

    try {
      // Step 1: Extract domain for lookup
      const domain = extractDomainForLookup(url);
      if (!domain) {
        setPageState('not_found');
        return;
      }

      // Step 2: Try to find startup by URL/domain
      // Search in multiple fields that might contain the URL
      const { data: startups, error: startupError } = await supabase
        .from('startup_uploads')
        .select('id, name, sector, sectors, website, extracted_data')
        .eq('status', 'approved')
        .or(`website.ilike.%${domain}%,name.ilike.%${domain}%`)
        .limit(1);

      if (startupError) {
        throw new Error(`Failed to find startup: ${startupError.message}`);
      }

      if (!startups || startups.length === 0) {
        // Try a looser search in extracted_data
        const { data: fallbackStartups } = await supabase
          .from('startup_uploads')
          .select('id, name, sector, sectors, website, extracted_data')
          .eq('status', 'approved')
          .textSearch('name', domain.replace(/\./g, ' '), { type: 'websearch' })
          .limit(1);

        if (!fallbackStartups || fallbackStartups.length === 0) {
          setPageState('not_found');
          return;
        }

        // Use fallback result
        const startup = fallbackStartups[0];
        setStartupId(startup.id);
        setStartupName(startup.name);
        
        // Fetch matches for this startup
        await fetchMatchesForStartup(startup.id, startup.sectors || [startup.sector]);
        return;
      }

      const startup = startups[0];
      setStartupId(startup.id);
      setStartupName(startup.name);

      // Step 3: Fetch investor matches for this startup
      await fetchMatchesForStartup(startup.id, startup.sectors || [startup.sector]);

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
