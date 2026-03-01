/**
 * useFundingPrediction
 * Fetches a single funding prediction for a startup from /api/funding-predictions.
 * Results are cached in a module-level Map so repeated renders don't re-fetch.
 */

import { useState, useEffect } from 'react';

export interface FundingPredictionData {
  id: string;
  startup_id: string;
  god_score: number;
  confidence: number;
  confidence_label: 'Imminent' | 'Strong Signal' | 'Likely';
  window_start: string;
  window_end: string;
  window_days: number;
  signals_snapshot: {
    pedigree_tier?: string;
    has_raise_language?: boolean;
    signals_score?: number;
    momentum_score?: number;
    near_yc_demo_day?: boolean;
  } | null;
  status: 'active' | 'hit' | 'expired' | 'cancelled';
  startup_name?: string;
  startup_sectors?: string[];
  startup_stage?: string;
}

const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3002' : '');

// Module-level cache: startup_id → prediction or null
const predictionCache = new Map<string, FundingPredictionData | null>();
// In-flight requests to avoid duplicate fetches
const inFlight = new Map<string, Promise<FundingPredictionData | null>>();

async function fetchPrediction(startupId: string): Promise<FundingPredictionData | null> {
  if (inFlight.has(startupId)) {
    return inFlight.get(startupId)!;
  }

  const promise = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/funding-predictions?startup_id=${encodeURIComponent(startupId)}`);
      if (!res.ok) return null;
      const data = await res.json();
      // API returns array; grab first active one
      const predictions: FundingPredictionData[] = data.predictions ?? data ?? [];
      const active = predictions.find(p => p.status === 'active') ?? null;
      predictionCache.set(startupId, active);
      return active;
    } catch {
      predictionCache.set(startupId, null);
      return null;
    } finally {
      inFlight.delete(startupId);
    }
  })();

  inFlight.set(startupId, promise);
  return promise;
}

export function useFundingPrediction(startupId: string | number | null | undefined) {
  const id = startupId?.toString() ?? null;

  const [prediction, setPrediction] = useState<FundingPredictionData | null>(() => {
    if (!id) return null;
    return predictionCache.get(id) ?? null;
  });
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!id) {
      setPrediction(null);
      return;
    }

    // Already cached
    if (predictionCache.has(id)) {
      setPrediction(predictionCache.get(id) ?? null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fetchPrediction(id).then(result => {
      if (!cancelled) {
        setPrediction(result);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [id]);

  return { prediction, loading };
}
