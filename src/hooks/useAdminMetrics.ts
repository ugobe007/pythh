/**
 * useAdminMetrics - Hook for fetching admin metrics dashboard data
 * 
 * Uses admin session token for secure access (not exposing ADMIN_KEY to client)
 * Token is HMAC-signed, 10 minute expiry, fetched via POST /api/admin/session
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'https://pythh.ai';

// Types
export interface FunnelMetrics {
  pricing_viewed: number;
  upgrade_cta_clicked: number;
  upgrade_started: number;
  upgrade_completed: number;
  cvr_view_to_complete: string;
  cvr_cta_to_complete: string;
}

export interface LoopMetrics {
  alerts_created: number;
  emails_sent: number;
  emails_clicked: number;
  shares_opened: number;
  matches_viewed: number;
}

export interface UserMetrics {
  active_users: number;
  new_users: number;
}

export interface OverviewData {
  range_days: number;
  cutoff: string;
  funnel: FunnelMetrics;
  loop: LoopMetrics;
  users: UserMetrics;
}

export interface SourceData {
  source: string;
  pricing_views: number;
  cta_clicked: number;
  upgrades_started: number;
  upgrades_completed: number;
  revenue_estimate: string;
  cvr_view_to_complete: string;
}

export interface SourcesResponse {
  range_days: number;
  cutoff: string;
  sources: SourceData[];
  total_revenue: string;
}

export interface DailyRow {
  day: string;
  pricing_viewed: number;
  upgrade_cta_clicked: number;
  upgrade_started: number;
  upgrade_completed: number;
  alerts_created: number;
  emails_sent: number;
  emails_clicked: number;
  shares_opened: number;
  matches_viewed: number;
}

export interface DailyResponse {
  range_days: number;
  cutoff: string;
  daily: DailyRow[];
}

interface AdminToken {
  token: string;
  expires_at: string;
}

// Token cache
let cachedToken: AdminToken | null = null;

export function useAdminMetrics(rangeDays: number = 7) {
  const { user, profile } = useAuth();
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [sources, setSources] = useState<SourcesResponse | null>(null);
  const [daily, setDaily] = useState<DailyResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is admin
  const isAdmin = profile?.role === 'admin';

  // Get admin session token
  const getAdminToken = useCallback(async (): Promise<string | null> => {
    // Check cached token
    if (cachedToken && new Date(cachedToken.expires_at) > new Date()) {
      return cachedToken.token;
    }

    if (!user?.id || !isAdmin) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE}/api/admin/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-key': import.meta.env.VITE_ADMIN_KEY || ''
        },
        body: JSON.stringify({ userId: user.id })
      });

      if (!response.ok) {
        throw new Error('Failed to get admin session');
      }

      const data: AdminToken = await response.json();
      cachedToken = data;
      return data.token;
    } catch (err) {
      console.error('[useAdminMetrics] Failed to get admin token:', err);
      return null;
    }
  }, [user?.id, isAdmin]);

  // Fetch with admin token
  const fetchWithToken = useCallback(async (endpoint: string) => {
    const token = await getAdminToken();
    if (!token) {
      throw new Error('Not authorized');
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }, [getAdminToken]);

  // Fetch all metrics
  const fetchMetrics = useCallback(async () => {
    if (!isAdmin) {
      setError('Admin access required');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch all endpoints in parallel
      const [overviewData, sourcesData, dailyData] = await Promise.all([
        fetchWithToken(`/api/admin/metrics/v2/overview?days=${rangeDays}`),
        fetchWithToken(`/api/admin/metrics/v2/sources?days=${rangeDays}`),
        fetchWithToken(`/api/admin/metrics/v2/daily?days=${rangeDays}`)
      ]);

      setOverview(overviewData);
      setSources(sourcesData);
      setDaily(dailyData);

      // Log view event
      fetchWithToken('/api/admin/metrics/log-view').catch(() => {});
    } catch (err: any) {
      console.error('[useAdminMetrics] Error:', err);
      setError(err.message || 'Failed to fetch metrics');
    } finally {
      setLoading(false);
    }
  }, [isAdmin, rangeDays, fetchWithToken]);

  // Fetch on mount and when range changes
  useEffect(() => {
    if (user && isAdmin) {
      fetchMetrics();
    }
  }, [user, isAdmin, rangeDays, fetchMetrics]);

  // Manual refresh
  const refresh = useCallback(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    overview,
    sources,
    daily,
    loading,
    error,
    refresh,
    isAdmin
  };
}

export default useAdminMetrics;
