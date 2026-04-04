/**
 * Usage Tracking Hook — Freemium Analytics
 *
 * Hybrid: localStorage for instant UI feedback + server-side counter for
 * logged-in users so clearing localStorage cannot reset the free limit.
 *
 * Priority order for analysis_count:
 *   1. Server count (if logged in)  ← bypass-proof
 *   2. localStorage count           ← instant / anonymous users
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface UsageData {
  analysisCount: number;
  lastAnalysisAt: string | null;
  firstAnalysisAt: string | null;
}

const STORAGE_KEY       = 'pythh_usage_data';
const FREE_ANALYSIS_LIMIT = 5;
const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

export function useUsageTracking() {
  const [usageData, setUsageData] = useState<UsageData>({
    analysisCount:  0,
    lastAnalysisAt: null,
    firstAnalysisAt: null,
  });
  const [serverCount,    setServerCount]    = useState<number | null>(null);
  const [serverPlan,     setServerPlan]     = useState<string | null>(null);
  const [serverChecked,  setServerChecked]  = useState(false);

  // ── Load localStorage on mount ────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setUsageData(JSON.parse(stored)); } catch { /* ignore */ }
    }
  }, []);

  // ── Load server-side count for logged-in users ────────────────────────────
  useEffect(() => {
    async function fetchServerUsage() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) { setServerChecked(true); return; }

        const res = await fetch(`${API_BASE}/api/usage`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const json = await res.json();
          setServerCount(json.analysis_count ?? 0);
          setServerPlan(json.plan ?? 'free');
          // Also bring localStorage in sync (never lower it)
          const stored = localStorage.getItem(STORAGE_KEY);
          const local  = stored ? JSON.parse(stored) : null;
          if (!local || (json.analysis_count > (local.analysisCount ?? 0))) {
            const synced: UsageData = {
              analysisCount:  json.analysis_count,
              lastAnalysisAt: local?.lastAnalysisAt ?? null,
              firstAnalysisAt: local?.firstAnalysisAt ?? null,
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(synced));
            setUsageData(synced);
          }
        }
      } catch { /* network error — fall through to localStorage */ }
      finally  { setServerChecked(true); }
    }
    fetchServerUsage();
  }, []);

  // ── Effective count: server wins for logged-in users ──────────────────────
  const effectiveCount = serverChecked && serverCount !== null
    ? Math.max(serverCount, usageData.analysisCount)
    : usageData.analysisCount;

  // ── isPro from server plan (overrides stale localStorage plan) ────────────
  const isProFromServer = serverPlan ? serverPlan !== 'free' : null;

  const saveUsageData = useCallback((data: UsageData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setUsageData(data);
  }, []);

  // Increment both localStorage and server counter
  const trackAnalysis = useCallback(async () => {
    const now  = new Date().toISOString();
    const next: UsageData = {
      analysisCount:  usageData.analysisCount + 1,
      lastAnalysisAt: now,
      firstAnalysisAt: usageData.firstAnalysisAt || now,
    };
    saveUsageData(next);

    // Fire-and-forget server increment for logged-in users
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        await fetch(`${API_BASE}/api/usage/increment`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        setServerCount(c => (c ?? 0) + 1);
      }
    } catch { /* non-critical */ }

    return next;
  }, [usageData, saveUsageData]);

  const hasHitLimit       = effectiveCount >= FREE_ANALYSIS_LIMIT;
  const remainingAnalyses = Math.max(0, FREE_ANALYSIS_LIMIT - effectiveCount);

  const resetUsage = useCallback(() => {
    const reset: UsageData = { analysisCount: 0, lastAnalysisAt: null, firstAnalysisAt: null };
    saveUsageData(reset);
    setServerCount(0);
  }, [saveUsageData]);

  const shouldShowPaywall = useCallback((isPro: boolean = false) => {
    return !isPro && hasHitLimit;
  }, [hasHitLimit]);

  return {
    analysisCount:    effectiveCount,
    lastAnalysisAt:   usageData.lastAnalysisAt,
    firstAnalysisAt:  usageData.firstAnalysisAt,
    hasHitLimit,
    remainingAnalyses,
    trackAnalysis,
    resetUsage,
    shouldShowPaywall,
    FREE_ANALYSIS_LIMIT,
    isProFromServer,   // use in PythhMain to cross-check plan
  };
}

export function useCanAnalyze(isPro: boolean = false): boolean {
  const { hasHitLimit } = useUsageTracking();
  return isPro || !hasHitLimit;
}
