/**
 * DbHealthBanner — Visible warning when DB is unreachable
 * =========================================================
 * Shows a yellow/red banner at top of admin pages if Supabase
 * goes down. Auto-dismisses when connection is restored.
 */

import { useDbHealth } from "../hooks/useDbHealth";

export default function DbHealthBanner() {
  const { isConnected, lastChecked, error, startupCount, matchCount } = useDbHealth();

  // Still doing initial check
  if (isConnected === null) return null;

  // All good — show a subtle green pill in the corner
  if (isConnected && !error) {
    return (
      <div className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-800/50 rounded-full px-3 py-1 text-xs text-emerald-400 backdrop-blur-sm">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        DB live · {startupCount.toLocaleString()} startups · {matchCount.toLocaleString()} matches
      </div>
    );
  }

  // Degraded or disconnected — show banner
  const isWarning = isConnected && error; // connected but missing data
  return (
    <div className={`fixed top-0 left-0 right-0 z-[9999] px-4 py-2 text-sm font-medium flex items-center justify-between ${
      isWarning ? "bg-yellow-900/95 border-b border-yellow-700 text-yellow-200" : "bg-red-950/95 border-b border-red-700 text-red-200"
    } backdrop-blur-sm`}>
      <div className="flex items-center gap-2">
        <span>{isWarning ? "⚠️" : "🔴"}</span>
        <span>
          {isWarning ? "DB Warning" : "DB Disconnected"}: {error}
        </span>
      </div>
      {lastChecked && (
        <span className="text-xs opacity-60">
          Last check: {lastChecked.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}
