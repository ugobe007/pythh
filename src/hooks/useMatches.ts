/**
 * useMatches Hook
 * 
 * Fetches investor matches for a startup with plan-based gating.
 * Uses the server-side /api/matches endpoint which handles:
 * - Plan detection (JWT or dev header)
 * - Limit enforcement (free=3, pro=10, elite=50)
 * - Field masking (free hides names, pro hides reasons, elite shows all)
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPlan, PlanTier, getMatchesLimit, getMatchVisibility, getMatchUpgradeCTA } from '../utils/plan';

// Match response type from server
export interface InvestorMatch {
  investor_id: string;
  investor_name: string | null;
  investor_name_masked: boolean;
  firm: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  match_score: number;
  sectors: string[];
  stage: string[];
  type: string | null;
  check_size_min: number | null;
  check_size_max: number | null;
  notable_investments: string[] | null;
  investment_thesis: string | null;
  reasoning: string | null;
  confidence_level: 'high' | 'medium' | 'low' | null;
  why_you_match: string[] | null;
  fit_analysis: {
    stage_fit: boolean;
    sector_fit: boolean;
    check_size_fit: boolean;
    geography_fit: boolean;
  } | null;
}

export interface StartupSummary {
  id: string;
  name: string;
  sectors: string[];
  stage: string;
  tagline: string | null;
}

export interface MatchesResponse {
  plan: PlanTier;
  startup: StartupSummary;
  limit: number;
  showing: number;
  total: number;
  data: InvestorMatch[];
}

export interface UseMatchesResult {
  matches: InvestorMatch[];
  startup: StartupSummary | null;
  loading: boolean;
  error: string | null;
  plan: PlanTier;
  showing: number;
  total: number;
  visibility: ReturnType<typeof getMatchVisibility>;
  upgradeCTA: ReturnType<typeof getMatchUpgradeCTA>;
  refetch: () => void;
}

// API base URL (same origin in prod, localhost in dev)
const API_BASE = import.meta.env.DEV 
  ? 'http://localhost:3002' 
  : '';

export function useMatches(startupId: string | null | undefined): UseMatchesResult {
  const { user, session } = useAuth();
  const [matches, setMatches] = useState<InvestorMatch[]>([]);
  const [startup, setStartup] = useState<StartupSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanTier>('free');
  const [showing, setShowing] = useState(0);
  const [total, setTotal] = useState(0);
  
  const fetchMatches = useCallback(async () => {
    if (!startupId) {
      setMatches([]);
      setStartup(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Add auth token if available (production flow)
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      // DEV ONLY: Send plan header for testing (ignored in production)
      if (import.meta.env.DEV) {
        const devPlan = getPlan(user);
        // Server derives plan from JWT - removed x-user-plan header
        // headers['x-user-plan'] = devPlan;
      }
      
      const res = await fetch(
        `${API_BASE}/api/matches?startup_id=${encodeURIComponent(startupId)}`,
        { headers }
      );
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
      
      const data: MatchesResponse = await res.json();
      
      setMatches(data.data || []);
      setStartup(data.startup || null);
      setPlan(data.plan || 'free');
      setShowing(data.showing || 0);
      setTotal(data.total || 0);
      
    } catch (err) {
      console.error('[useMatches] Error:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch matches');
      setMatches([]);
    } finally {
      setLoading(false);
    }
  }, [startupId, user, session]);
  
  // Fetch on mount and when startupId changes
  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);
  
  // Compute visibility and CTA based on current plan
  const visibility = getMatchVisibility(plan);
  const upgradeCTA = getMatchUpgradeCTA(plan, total);
  
  return {
    matches,
    startup,
    loading,
    error,
    plan,
    showing,
    total,
    visibility,
    upgradeCTA,
    refetch: fetchMatches,
  };
}

/**
 * Format check size range for display
 */
export function formatCheckSize(min: number | null, max: number | null): string {
  if (!min && !max) return 'Undisclosed';
  
  const formatAmount = (amt: number) => {
    if (amt >= 1000000) return `$${(amt / 1000000).toFixed(0)}M`;
    if (amt >= 1000) return `$${(amt / 1000).toFixed(0)}K`;
    return `$${amt}`;
  };
  
  const minStr = min ? formatAmount(min) : '$0';
  const maxStr = max ? formatAmount(max) : '$10M+';
  return `${minStr} - ${maxStr}`;
}

/**
 * Get match score color/style
 */
export function getScoreStyle(score: number): string {
  if (score >= 90) return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
  if (score >= 80) return 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30';
  if (score >= 70) return 'text-violet-400 bg-violet-500/20 border-violet-500/30';
  return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
}
