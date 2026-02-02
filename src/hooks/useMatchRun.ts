/**
 * useMatchRun - Bulletproof matching hook
 * 
 * State machine that can't pulse incorrectly:
 * - idle → loading → polling → ready|error → idle
 * 
 * Usage:
 *   const { startMatch, matches, status, error } = useMatchRun();
 *   <button onClick={() => startMatch(url)}>Get Matches</button>
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export type MatchRunStatus = 'created' | 'queued' | 'processing' | 'ready' | 'error';

export interface MatchResult {
  investor_id: string;
  investor_name: string;
  firm: string;
  match_score: number;
  sectors?: string[];
  stage?: string;
  check_size_min?: number;
  check_size_max?: number;
}

export interface MatchRun {
  run_id: string;
  startup_id: string;
  startup_name: string;
  canonical_url: string;
  status: MatchRunStatus;
  step: string;
  match_count: number;
  error_code?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
  matches: MatchResult[];
}

type HookStatus = 'idle' | 'loading' | 'polling' | 'ready' | 'error';

export function useMatchRun() {
  const [status, setStatus] = useState<HookStatus>('idle');
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [matchCount, setMatchCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [startupName, setStartupName] = useState<string>('');
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentRunIdRef = useRef<string | null>(null);
  const pollCountRef = useRef<number>(0);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);
  
  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    pollCountRef.current = 0;
  }, []);
  
  // Poll for status
  const pollStatus = useCallback(async (runId: string) => {
    try {
      const response = await fetch(`/api/match/run/${runId}`);
      
      if (!response.ok) {
        if (response.status === 429) {
          console.warn('[useMatchRun] Rate limited - slowing down');
          return; // Don't throw, just skip this poll
        }
        throw new Error(`HTTP ${response.status}`);
      }
      
      const run: MatchRun = await response.json();
      
      console.log('[useMatchRun] Poll result:', run.status, 'count:', run.match_count);
      
      // CRITICAL: Stop polling IMMEDIATELY on terminal states
      if (run.status === 'ready') {
        stopPolling();
        setStatus('ready');
        setMatches(run.matches || []);
        setMatchCount(run.match_count);
        setStartupName(run.startup_name);
        return; // Exit immediately
      } 
      
      if (run.status === 'error') {
        stopPolling();
        setStatus('error');
        setError(run.error_message || run.error_code || 'Unknown error');
        return; // Exit immediately
      }
      
      // Still processing - keep polling
      setStatus('polling');
      
      // Soft timeout: after 15 polls (30s), slow down to 5s
      pollCountRef.current++;
      if (pollCountRef.current === 15) {
        stopPolling();
        console.log('[useMatchRun] Switching to slow poll (5s interval)');
        pollIntervalRef.current = setInterval(() => {
          if (currentRunIdRef.current) {
            pollStatus(currentRunIdRef.current);
          }
        }, 5000);
      }
      
      // After 30 polls (30s fast + 75s slow = 105s), switch to very slow (10s)
      if (pollCountRef.current === 30) {
        stopPolling();
        console.log('[useMatchRun] Switching to very slow poll (10s interval)');
        pollIntervalRef.current = setInterval(() => {
          if (currentRunIdRef.current) {
            pollStatus(currentRunIdRef.current);
          }
        }, 10000);
      }
      
      // Hard stop at 60 total polls (~3 minutes)
      if (pollCountRef.current > 60) {
        stopPolling();
        setStatus('error');
        setError('Timeout: Unable to complete matching. Please try again.');
      }
      
    } catch (err: any) {
      console.error('[useMatchRun] Poll error:', err);
      stopPolling();
      setStatus('error');
      setError(err.message || 'Failed to fetch status');
    }
  }, [stopPolling]);
  
  // Start match run
  const startMatch = useCallback(async (url: string) => {
    // Reset state
    stopPolling();
    setStatus('loading');
    setMatches([]);
    setMatchCount(0);
    setError(null);
    setStartupName('');
    currentRunIdRef.current = null;
    pollCountRef.current = 0;
    
    try {
      console.log('[useMatchRun] Starting match for:', url);
      
      const response = await fetch('/api/match/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }
      
      const run: MatchRun = await response.json();
      
      console.log('[useMatchRun] Run created:', run.run_id, 'status:', run.status);
      
      currentRunIdRef.current = run.run_id;
      setStartupName(run.startup_name);
      
      // If already ready (idempotent reuse), show immediately
      if (run.status === 'ready' && run.matches?.length > 0) {
        setStatus('ready');
        setMatches(run.matches);
        setMatchCount(run.match_count);
        return;
      }
      
      // If error, show immediately
      if (run.status === 'error') {
        setStatus('error');
        setError(run.error_message || run.error_code || 'Unknown error');
        return;
      }
      
      // Otherwise, start polling
      setStatus('polling');
      
      // Poll every 2 seconds
      pollIntervalRef.current = setInterval(() => {
        if (currentRunIdRef.current) {
          pollStatus(currentRunIdRef.current);
        }
      }, 2000);
      
      // Initial poll immediately
      pollStatus(run.run_id);
      
    } catch (err: any) {
      console.error('[useMatchRun] Start error:', err);
      setStatus('error');
      setError(err.message || 'Failed to start matching');
    }
  }, [stopPolling, pollStatus]);
  
  // Reset to idle
  const reset = useCallback(() => {
    stopPolling();
    setStatus('idle');
    setMatches([]);
    setMatchCount(0);
    setError(null);
    setStartupName('');
    currentRunIdRef.current = null;
  }, [stopPolling]);
  
  return {
    startMatch,
    reset,
    status,
    matches,
    matchCount,
    error,
    startupName,
    isLoading: status === 'loading' || status === 'polling',
    isReady: status === 'ready',
    isError: status === 'error',
    isIdle: status === 'idle'
  };
}
