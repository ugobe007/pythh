import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface SignalHistoryPoint {
  recorded_at: string;
  signal_strength: number;
  readiness: number;
  power_score: number;
  fundraising_window: 'Too Early' | 'Forming' | 'Prime' | 'Cooling';
}

export interface SignalHistoryData {
  history: SignalHistoryPoint[];
  deltaToday: number;
  transition: {
    from: string;
    to: string;
    daysAgo: number;
  } | null;
  lastUpdatedLabel: string;
  sparklineData: number[];
  loading: boolean;
  error: string | null;
}

/**
 * useSignalHistory - Fetch Power Score history for daily deltas + sparklines
 * 
 * Returns:
 * - history: Last N days of signal data (oldest → newest)
 * - deltaToday: Power Score change from yesterday to today
 * - transition: Window transition (e.g., "Forming → Prime (2 days ago)")
 * - lastUpdatedLabel: Formatted timestamp ("Updated Jan 20, 2026")
 * - sparklineData: Power scores for last 7 days (for tiny chart)
 */
export function useSignalHistory(
  startupId: string | null,
  days: number = 14
): SignalHistoryData {
  const [data, setData] = useState<SignalHistoryData>({
    history: [],
    deltaToday: 0,
    transition: null,
    lastUpdatedLabel: 'Updated today',
    sparklineData: [],
    loading: false,
    error: null,
  });

  useEffect(() => {
    if (!startupId) {
      setData({
        history: [],
        deltaToday: 0,
        transition: null,
        lastUpdatedLabel: 'Updated today',
        sparklineData: [],
        loading: false,
        error: null,
      });
      return;
    }

    let isMounted = true;

    async function fetchHistory() {
      setData(prev => ({ ...prev, loading: true, error: null }));

      try {
        const { data: historyData, error: historyError } = await supabase
          .from('startup_signal_history')
          .select('recorded_at, signal_strength, readiness, power_score, fundraising_window')
          .eq('startup_id', startupId)
          .order('recorded_at', { ascending: true })
          .limit(days);

        if (historyError) throw historyError;

        if (!isMounted) return;

        const history = (historyData || []) as SignalHistoryPoint[];

        // Compute delta (today vs yesterday)
        let deltaToday = 0;
        if (history.length >= 2) {
          const latest = history[history.length - 1];
          const previous = history[history.length - 2];
          deltaToday = latest.power_score - previous.power_score;
        }

        // Compute transition (window change)
        let transition: { from: string; to: string; daysAgo: number } | null = null;
        if (history.length >= 2) {
          const latest = history[history.length - 1];
          // Find most recent window change
          for (let i = history.length - 2; i >= 0; i--) {
            if (history[i].fundraising_window !== latest.fundraising_window) {
              const daysAgo = Math.floor(
                (new Date(latest.recorded_at).getTime() - new Date(history[i].recorded_at).getTime()) /
                (1000 * 60 * 60 * 24)
              );
              transition = {
                from: history[i].fundraising_window,
                to: latest.fundraising_window,
                daysAgo,
              };
              break;
            }
          }
        }

        // Last updated label
        let lastUpdatedLabel = 'Updated today';
        if (history.length > 0) {
          const latest = history[history.length - 1];
          const date = new Date(latest.recorded_at);
          const today = new Date();
          const isToday = date.toDateString() === today.toDateString();
          
          if (isToday) {
            lastUpdatedLabel = `Updated today`;
          } else {
            lastUpdatedLabel = `Updated ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
          }
        }

        // Sparkline data (last 7 days of power_score)
        const sparklineData = history.slice(-7).map(h => h.power_score);

        setData({
          history,
          deltaToday,
          transition,
          lastUpdatedLabel,
          sparklineData,
          loading: false,
          error: null,
        });
      } catch (err) {
        console.error('[useSignalHistory] Error fetching history:', err);
        if (!isMounted) return;
        setData(prev => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load signal history',
        }));
      }
    }

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [startupId, days]);

  return data;
}
