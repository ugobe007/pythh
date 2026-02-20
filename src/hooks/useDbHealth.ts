/**
 * useDbHealth — Real-time Supabase connectivity watchdog
 * =========================================================
 * Runs a lightweight heartbeat every 60s. Triggers an immediate
 * visible warning in the admin panel and console if the DB goes
 * unreachable. Auto-recovers when connection returns.
 *
 * Usage:
 *   const { isConnected, lastChecked, error } = useDbHealth();
 */

import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

interface DbHealthState {
  isConnected: boolean | null; // null = initial/unknown
  lastChecked: Date | null;
  error: string | null;
  startupCount: number;
  matchCount: number;
}

const HEARTBEAT_INTERVAL_MS = 60_000; // check every 60 seconds
const TIMEOUT_MS = 8_000;             // fail if query takes > 8s

export function useDbHealth(): DbHealthState {
  const [state, setState] = useState<DbHealthState>({
    isConnected: null,
    lastChecked: null,
    error: null,
    startupCount: 0,
    matchCount: 0,
  });
  const isMounted = useRef(true);

  const runCheck = async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      // Lightweight check: count approved startups (fast index scan)
      const { count: startupCount, error: sErr } = await supabase
        .from("startup_uploads")
        .select("*", { count: "exact", head: true })
        .eq("status", "approved")
        .abortSignal(controller.signal);

      clearTimeout(timeoutId);

      if (sErr) throw sErr;

      // Also get match count
      const { count: matchCount } = await supabase
        .from("startup_investor_matches")
        .select("*", { count: "exact", head: true });

      if (!isMounted.current) return;

      const connected = (startupCount || 0) > 0;
      if (!connected) {
        console.warn("[DB Watchdog] Connected but 0 approved startups — DB may be empty or RLS is blocking anon access");
      }

      setState({
        isConnected: true,
        lastChecked: new Date(),
        error: connected ? null : "DB connected but 0 approved startups — check RLS or data",
        startupCount: startupCount || 0,
        matchCount: matchCount || 0,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (!isMounted.current) return;

      const message = err?.name === "AbortError" ? "DB heartbeat timed out" : (err?.message || "DB unreachable");
      console.error("[DB Watchdog] ❌", message);

      setState((prev) => ({
        ...prev,
        isConnected: false,
        lastChecked: new Date(),
        error: message,
      }));
    }
  };

  useEffect(() => {
    isMounted.current = true;
    runCheck(); // immediate check on mount

    const interval = setInterval(runCheck, HEARTBEAT_INTERVAL_MS);
    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
