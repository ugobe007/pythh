/**
 * STATE MACHINE FOR MATCH LOADING
 * Prevents "no matches found" bug by properly managing load states
 * 
 * HARD CORRECTNESS RULES:
 * 1. Empty state ONLY shown when: state === 'ready' AND matchCount === 0 AND requestId matches
 * 2. Stale-while-revalidate: NEVER clear matches during poll/refresh
 * 3. Response de-staling: Every response checked against currentRequestId
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// State machine states
export type MatchState = 
  | 'idle'           // No URL yet, waiting for user input
  | 'resolving'      // URL → startup_id lookup
  | 'loading'        // Fetching matches from DB
  | 'ready'          // Backend confirmed ready, matches loaded
  | 'empty'          // Backend confirmed ready + count=0 (STRICT GATE)
  | 'error';         // Real failure (network, auth, etc.)

// Pipeline state from backend (authoritative)
export type PipelineState = 'processing' | 'ready' | 'error';

interface MatchStateData<T> {
  state: MatchState;
  matches: T[];
  error: string | null;
  startupId: string | null;
  requestId: number;
  
  // Actions
  setIdle: () => void;
  setResolving: () => void;
  setLoading: (startupId?: string) => void;
  setReady: (matches: T[], requestId: number) => void;
  setEmpty: (requestId: number) => void;
  setError: (error: string, requestId: number) => void;
  
  // Request management
  getNextRequestId: () => number;
  isStaleResponse: (responseRequestId: number) => boolean;
  
  // Helpers
  isLoading: boolean;
  canShowMatches: boolean;
}

/**
 * Custom hook for managing match loading state machine
 * 
 * Key rules:
 * - EMPTY STATE GATE: Only show empty when state === 'ready' AND matchCount === 0 AND requestId matches
 * - STALE-WHILE-REVALIDATE: Keep previous matches while revalidating, never clear
 * - RESPONSE DE-STALING: Check requestId on every response, discard stale ones
 */
export function useMatchState<T = any>(): MatchStateData<T> {
  const [state, setState] = useState<MatchState>('idle');
  const [matches, setMatches] = useState<T[]>([]);
  const [lastGoodMatches, setLastGoodMatches] = useState<T[]>([]); // Backup for stale-while-revalidate
  const [error, setErrorMsg] = useState<string | null>(null);
  const [startupId, setStartupId] = useState<string | null>(null);
  
  // REQUEST ID: Increment on each new request to detect stale responses
  // NOTE: Using ref only, no state updates, to avoid triggering re-renders
  const requestIdRef = useRef(0);

  // Actions
  const setIdle = useCallback(() => {
    setState('idle');
    setErrorMsg(null);
    // Keep matches for back navigation
  }, []);

  const setResolving = useCallback(() => {
    setState('resolving');
    setErrorMsg(null);
    // STALE-WHILE-REVALIDATE: Keep matches visible
  }, []);

  const setLoading = useCallback((id?: string) => {
    setState('loading');
    setErrorMsg(null);
    if (id) setStartupId(id);
    // STALE-WHILE-REVALIDATE: Keep matches visible
  }, []);

  const setReady = useCallback((newMatches: T[], requestId: number) => {
    // RESPONSE DE-STALING: Ignore stale responses
    if (requestId !== requestIdRef.current) {
      console.warn(`[useMatchState] Ignoring stale response (requestId ${requestId} !== current ${requestIdRef.current})`);
      return;
    }
    
    // EMPTY STATE GATE: Only set empty if authoritative ready + count=0
    if (newMatches && newMatches.length > 0) {
      setMatches(newMatches);
      setLastGoodMatches(newMatches); // Save as last good
      setState('ready');
      setErrorMsg(null);
    } else {
      // Backend says ready but no matches → STRICT EMPTY STATE
      setState('empty');
      setMatches([]);
      setErrorMsg(null);
    }
  }, []);

  const setEmpty = useCallback((requestId: number) => {
    // RESPONSE DE-STALING: Ignore stale responses
    if (requestId !== requestIdRef.current) {
      console.warn(`[useMatchState] Ignoring stale empty response (requestId ${requestId} !== current ${requestIdRef.current})`);
      return;
    }
    
    // STRICT EMPTY: Only callable when backend confirms ready + count=0
    setState('empty');
    setMatches([]);
    setErrorMsg(null);
  }, []);

  const setError = useCallback((err: string, requestId: number) => {
    // RESPONSE DE-STALING: Ignore stale responses
    if (requestId !== requestIdRef.current) {
      console.warn(`[useMatchState] Ignoring stale error response (requestId ${requestId} !== current ${requestIdRef.current})`);
      return;
    }
    
    setState('error');
    setErrorMsg(err);
    // STALE-WHILE-REVALIDATE: Keep matches visible on error
  }, []);

  // Request management
  const getNextRequestId = useCallback(() => {
    requestIdRef.current += 1;
    console.log(`[useMatchState] Generated requestId: ${requestIdRef.current}`);
    return requestIdRef.current;
  }, []);

  const isStaleResponse = useCallback((responseRequestId: number) => {
    const isstale = responseRequestId !== requestIdRef.current;
    if (isstale) {
      console.log(`[useMatchState] Stale check: ${responseRequestId} !== ${requestIdRef.current}`);
    }
    return isstale;
  }, []);

  // Computed flags
  const isLoading = state === 'resolving' || state === 'loading';
  const canShowMatches = (state === 'ready' && matches.length > 0) || (isLoading && lastGoodMatches.length > 0);

  return {
    state,
    matches: matches.length > 0 ? matches : lastGoodMatches, // Always prefer last good matches
    error,
    startupId,
    requestId: requestIdRef.current, // Read directly from ref, no state
    
    setIdle,
    setResolving,
    setLoading,
    setReady,
    setEmpty,
    setError,
    
    getNextRequestId,
    isStaleResponse,
    
    isLoading,
    canShowMatches,
  };
}

/**
 * Helper to determine what UI to show
 * 
 * EMPTY STATE GATE: Only showEmpty when state === 'empty' (backend confirmed ready + count=0)
 */
export function getMatchUIState(state: MatchState, matchCount: number): {
  showLoading: boolean;
  showMatches: boolean;
  showEmpty: boolean;  // STRICT: Only true when state === 'empty'
  showError: boolean;
  loadingMessage: string;
} {
  switch (state) {
    case 'idle':
      return {
        showLoading: false,
        showMatches: false,
        showEmpty: false,
        showError: false,
        loadingMessage: '',
      };
      
    case 'resolving':
      return {
        showLoading: true,
        showMatches: matchCount > 0, // Show stale matches while resolving
        showEmpty: false, // NEVER empty during resolving
        showError: false,
        loadingMessage: 'Resolving startup...',
      };
      
    case 'loading':
      return {
        showLoading: true,
        showMatches: matchCount > 0, // Show stale matches while loading
        showEmpty: false, // NEVER empty during loading
        showError: false,
        loadingMessage: 'Scanning signals...',
      };
      
    case 'ready':
      return {
        showLoading: false,
        showMatches: matchCount > 0,
        showEmpty: matchCount === 0, // Only show empty if count is truly 0
        showError: false,
        loadingMessage: '',
      };
      
    case 'empty':
      // STRICT GATE: This state means backend confirmed ready + count=0
      return {
        showLoading: false,
        showMatches: false,
        showEmpty: true, // ONLY show empty in this state
        showError: false,
        loadingMessage: '',
      };
      
    case 'error':
      return {
        showLoading: false,
        showMatches: matchCount > 0, // Keep showing matches if we have them
        showEmpty: false,
        showError: true,
        loadingMessage: '',
      };
      
    default:
      return {
        showLoading: false,
        showMatches: false,
        showEmpty: false,
        showError: false,
        loadingMessage: '',
      };
  }
}

/**
 * Validate empty state gating
 * HARD RULE: Only return true when ALL conditions met:
 * - state === 'ready' (authoritative from backend)
 * - matchCount === 0
 * - requestId matches current (not stale response)
 */
export function shouldShowEmptyState(
  state: MatchState,
  matchCount: number,
  currentRequestId: number,
  responseRequestId: number
): boolean {
  return (
    state === 'empty' && 
    matchCount === 0 && 
    responseRequestId === currentRequestId
  );
}
