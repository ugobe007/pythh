// ============================================================================
// useRadarViewModel Hook
// ============================================================================
// Combines RPC data into canonical RadarViewModel.
// This is the ONLY place where data transformation happens for RADAR.
// 
// Contract:
//   1. GOD score comes from useStartupContext (startup_uploads.total_god_score)
//   2. Rows come from useLiveMatchTable (get_live_match_table RPC)
//   3. View model is built once per data update
//   4. Validation runs in dev mode
// ============================================================================

import { useMemo, useEffect } from 'react';
import type { MatchRow, StartupContext } from '@/lib/pythh-types';
import { 
  buildRadarViewModel, 
  validateRadarViewModel,
  mapMatchRowToRadarRow,
  type RadarViewModel 
} from '@/lib/radar-view-model';

// -----------------------------------------------------------------------------
// HOOK INTERFACE
// -----------------------------------------------------------------------------

interface UseRadarViewModelOptions {
  /** Startup ID */
  startupId: string | null;
  /** Raw rows from useLiveMatchTable */
  rows: MatchRow[];
  /** Context from useStartupContext */
  context: StartupContext | null;
  /** Startup name for display */
  startupName?: string | null;
  /** Enable validation logging (dev mode) */
  enableValidation?: boolean;
}

interface UseRadarViewModelResult {
  /** The canonical view model */
  viewModel: RadarViewModel | null;
  /** GOD score (for display outside table) */
  godScore: number | null;
  /** Validation issues (empty if valid) */
  issues: string[];
}

// -----------------------------------------------------------------------------
// HOOK
// -----------------------------------------------------------------------------

export function useRadarViewModel({
  startupId,
  rows,
  context,
  startupName = null,
  enableValidation = import.meta.env.DEV,
}: UseRadarViewModelOptions): UseRadarViewModelResult {
  
  // Build view model (memoized)
  const viewModel = useMemo(() => {
    if (!startupId) return null;
    
    return buildRadarViewModel(
      startupId,
      rows,
      context,
      startupName
    );
  }, [startupId, rows, context, startupName]);
  
  // Validate in dev mode
  const issues = useMemo(() => {
    if (!viewModel || !enableValidation) return [];
    return validateRadarViewModel(viewModel);
  }, [viewModel, enableValidation]);
  
  // Log validation issues (dev only)
  useEffect(() => {
    if (issues.length > 0) {
      console.warn('[RadarViewModel Validation]', issues);
    }
  }, [issues]);
  
  // Extract GOD score for display outside table
  const godScore = viewModel?.godScore ?? null;
  
  return { viewModel, godScore, issues };
}

// -----------------------------------------------------------------------------
// LEGACY ADAPTER
// -----------------------------------------------------------------------------
// Adapts old MatchRow[] + godScore props to new view model format
// Use this during migration, then remove.

export function useLegacyRadarAdapter(
  rows: MatchRow[],
  godScore: number | undefined,
  context: StartupContext | null
): { unlockedRows: import('@/lib/radar-view-model').RadarRowViewModel[]; lockedRows: import('@/lib/radar-view-model').RadarRowViewModel[] } {
  return useMemo(() => {
    const effectiveGodScore = godScore ?? context?.god?.total ?? 50;
    
    const mapped = rows.map(row => mapMatchRowToRadarRow(row, effectiveGodScore));
    
    return {
      unlockedRows: mapped.filter(r => !r.entity.isLocked),
      lockedRows: mapped.filter(r => r.entity.isLocked),
    };
  }, [rows, godScore, context]);
}
