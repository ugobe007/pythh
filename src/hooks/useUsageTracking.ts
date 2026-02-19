/**
 * Usage Tracking Hook - Freemium Analytics
 * Tracks local usage count for free tier limits (5 analyses)
 * Stores in localStorage with date stamps for analytics
 */

import { useState, useEffect, useCallback } from 'react';

interface UsageData {
  analysisCount: number;
  lastAnalysisAt: string | null;
  firstAnalysisAt: string | null;
}

const STORAGE_KEY = 'pythh_usage_data';
const FREE_ANALYSIS_LIMIT = 5;

export function useUsageTracking() {
  const [usageData, setUsageData] = useState<UsageData>({
    analysisCount: 0,
    lastAnalysisAt: null,
    firstAnalysisAt: null,
  });

  // Load usage data from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setUsageData(parsed);
      } catch (error) {
        console.error('Failed to parse usage data:', error);
      }
    }
  }, []);

  // Save usage data to localStorage whenever it changes
  const saveUsageData = useCallback((data: UsageData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setUsageData(data);
  }, []);

  // Increment analysis count
  const trackAnalysis = useCallback(() => {
    const now = new Date().toISOString();
    const newData: UsageData = {
      analysisCount: usageData.analysisCount + 1,
      lastAnalysisAt: now,
      firstAnalysisAt: usageData.firstAnalysisAt || now,
    };
    saveUsageData(newData);
    return newData;
  }, [usageData, saveUsageData]);

  // Check if user has hit the free limit
  const hasHitLimit = usageData.analysisCount >= FREE_ANALYSIS_LIMIT;

  // Get remaining analyses
  const remainingAnalyses = Math.max(0, FREE_ANALYSIS_LIMIT - usageData.analysisCount);

  // Reset usage (for testing or admin purposes)
  const resetUsage = useCallback(() => {
    const resetData: UsageData = {
      analysisCount: 0,
      lastAnalysisAt: null,
      firstAnalysisAt: null,
    };
    saveUsageData(resetData);
  }, [saveUsageData]);

  // Check if user should see paywall (hit limit and not pro)
  const shouldShowPaywall = useCallback((isPro: boolean = false) => {
    return !isPro && hasHitLimit;
  }, [hasHitLimit]);

  return {
    analysisCount: usageData.analysisCount,
    lastAnalysisAt: usageData.lastAnalysisAt,
    firstAnalysisAt: usageData.firstAnalysisAt,
    hasHitLimit,
    remainingAnalyses,
    trackAnalysis,
    resetUsage,
    shouldShowPaywall,
    FREE_ANALYSIS_LIMIT,
  };
}

// Export hook for checking if analysis is allowed (without tracking)
export function useCanAnalyze(isPro: boolean = false): boolean {
  const { hasHitLimit } = useUsageTracking();
  return isPro || !hasHitLimit;
}
