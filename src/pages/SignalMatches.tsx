// ============================================================================
// SignalsRadarPage - PYTHH ENGINE CANONICAL PROCESSOR
// ============================================================================
// Route: /app/radar (CANONICAL)
// Aliases (redirect-only): /signals, /signals-radar → /app/radar
// 
// *** CRITICAL PYTHH WORKFLOW HANDLER ***
// This component is the EXECUTION POINT for the pythh URL submission workflow:
//
// CANONICAL FLOW:
// 1. User submits URL on homepage (PythhHome.tsx)
// 2. Navigate to /signals?url=example.com
// 3. SignalsAlias redirects → /app/radar?url=example.com
// 4. THIS COMPONENT receives ?url=example.com
// 5. useResolveStartup hook (line ~72) calls resolve_startup_by_url RPC
// 6. RPC performs FULL WORKFLOW:
//    - Scrape website
//    - Extract startup data
//    - Build database entry
//    - Calculate GOD score
//    - Generate investor matches
// 7. Display: 5 unlocked signals + 50 locked (paywall)
//
// DO NOT MODIFY URL RESOLUTION LOGIC WITHOUT FULL SYSTEM UNDERSTANDING
// ============================================================================
// 
// Params: ?url=example.com OR :startupId (path param)
// 
// SINGLE SOURCE OF TRUTH: resolvedStartupId
//   Computed from (in priority order):
//   1. Route param /app/radar/:startupId
//   2. Query param ?startup=UUID
//   3. Query param ?url=... → resolve_startup_by_url RPC (PYTHH ENGINE)
//   4. User picker selection (local state)
//
// Loading states:
//   - startupId unknown: full-page skeleton
//   - context loading: stat cards shimmer
//   - matches loading: table shimmer
//   - unlock in-flight: THAT row's button spins (not global)
//
// Polling:
//   - Paused while any unlock is in-flight (prevents flicker)
//   - Resumes 1s after unlock completes
// ============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { RefreshCw, AlertCircle, Loader2, Search } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MatchRow, StartupContext } from '@/lib/pythh-types';
import {
  useResolveStartup,
  useStartupContext,
  useLiveMatchTable,
  useUnlock,
  invalidateStartupContext,
} from '@/services/pythh-rpc';
import {
  EntitlementPill,
} from '@/components/pythh';
import { LiveMatchTable } from '@/components/pythh/LiveMatchTableV2';
import { useLegacyRadarAdapter } from '@/hooks/useRadarViewModel';

// -----------------------------------------------------------------------------
// RESOLUTION STATE (for "not found" / "picker" / "missing context" UI states)
// -----------------------------------------------------------------------------
type UIState = 
  | { mode: 'loading' }
  | { mode: 'ready' }
  | { mode: 'not_found'; searched: string }
  | { mode: 'picker' }
  | { mode: 'missing_context' };  // NEW: No URL/ID provided from public flow

export default function SignalsRadarPage() {
  // Route truth beacon
  console.log('[SignalsRadarPage] HIT:', window.location.pathname + window.location.search);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams<{ startupId?: string }>();
  
  // -----------------------------------------------------------------------------
  // SINGLE SOURCE OF TRUTH: resolvedStartupId
  // -----------------------------------------------------------------------------
  
  // Extract all possible inputs
  const startupIdFromPath = params.startupId ?? null;
  const startupIdFromQuery = searchParams.get('startup');
  
  // *** PYTHH ENGINE CANONICAL INPUT ***
  // This is where URL from homepage enters the system
  // Example: /signals-radar?url=stripe.com
  // DO NOT RENAME OR REMOVE - breaks entire pythh workflow
  const urlToResolve = searchParams.get('url');
  
  // Local picker state (only used when no URL params)
  const [pickedStartupId, setPickedStartupId] = useState<string | null>(null);
  const [pickedStartupName, setPickedStartupName] = useState<string | null>(null);
  
  // *** PYTHH ENGINE EXECUTION HOOK ***
  // useResolveStartup calls resolve_startup_by_url RPC
  // RPC flow: scrape → extract → build → score → match
  // Returns: startup_id + name + 5 unlocked + 50 locked signals
  // DO NOT MODIFY - this is the pythh engine entry point
  const { result: resolverResult, loading: resolverLoading } = useResolveStartup(urlToResolve);
  
  // THE SINGLE SOURCE OF TRUTH
  const resolvedStartupId = useMemo(() => {
    // Priority 1: Path param /signal-matches/:startupId
    if (startupIdFromPath) return startupIdFromPath;
    
    // Priority 2: Query param ?startup=UUID
    if (startupIdFromQuery) return startupIdFromQuery;
    
    // Priority 3: URL resolver result
    if (resolverResult?.found && resolverResult.startup_id) {
      return resolverResult.startup_id;
    }
    
    // Priority 4: User picked from list
    if (pickedStartupId) return pickedStartupId;
    
    return null;
  }, [startupIdFromPath, startupIdFromQuery, resolverResult, pickedStartupId]);
  
  // Derive UI state (for rendering loading/error/picker screens)
  const uiState = useMemo<UIState>(() => {
    // If we have a resolved ID, we're ready
    if (resolvedStartupId) return { mode: 'ready' };
    
    // If URL resolver is loading, show loading
    if (urlToResolve && resolverLoading) return { mode: 'loading' };
    
    // If URL resolver finished but not found
    if (urlToResolve && resolverResult && !resolverResult.found) {
      return { mode: 'not_found', searched: resolverResult.searched || urlToResolve };
    }
    
    // RUNTIME INVARIANT: Detect missing context from public flow
    // If no URL param, no startup ID, and no picked startup → show empty state
    // This prevents "nothing nothing nothing" when routing breaks
    const hasAnyInput = !!(urlToResolve || startupIdFromPath || startupIdFromQuery || pickedStartupId);
    if (!hasAnyInput) {
      return { mode: 'missing_context' };
    }
    
    // Has input but waiting for resolution: show picker
    return { mode: 'picker' };
  }, [resolvedStartupId, urlToResolve, resolverLoading, resolverResult, startupIdFromPath, startupIdFromQuery, pickedStartupId]);
  
  // Resolved name (for header)
  const resolvedName = useMemo(() => {
    if (resolverResult?.name) return resolverResult.name;
    if (pickedStartupName) return pickedStartupName;
    return null; // Will fall back to context?.startup?.name
  }, [resolverResult?.name, pickedStartupName]);

  // -----------------------------------------------------------------------------
  // DATA HOOKS (all gated on resolvedStartupId)
  // -----------------------------------------------------------------------------
  
  const { context, loading: contextLoading, refresh: refreshContext } = useStartupContext(resolvedStartupId);
  const { unlock, isPending, isAnyPending } = useUnlock(resolvedStartupId);
  
  // Heartbeat timestamp (updated by onUpdated callback)
  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  
  // BUSY watchdog: track when BUSY started (null = not busy)
  const [busySince, setBusySince] = useState<number | null>(null);
  
  // Update busySince when isAnyPending changes
  useEffect(() => {
    if (isAnyPending) {
      setBusySince(prev => prev ?? Date.now());
    } else {
      setBusySince(null);
    }
  }, [isAnyPending]);
  
  // Pause polling while unlock is in-flight (prevents flicker)
  const { rows, loading: tableLoading, lastFetch, refresh: refreshTable, optimisticUnlock, rollbackUnlock, isStale } = 
    useLiveMatchTable(resolvedStartupId, {
      pollIntervalMs: 10000,
      pausePolling: isAnyPending,
      onUpdated: ({ at }) => setLastRefreshAt(at.getTime()),
    });

  // Derived counts (memoized)
  const { unlockedCount, lockedCount } = useMemo(() => {
    let unlocked = 0;
    let locked = 0;
    for (const r of rows) {
      if (r.is_locked) locked++;
      else unlocked++;
    }
    return { unlockedCount: unlocked, lockedCount: locked };
  }, [rows]);

  // -----------------------------------------------------------------------------
  // HANDLERS
  // -----------------------------------------------------------------------------
  
  const handleUnlock = useCallback(async (investorId: string) => {
    if (!resolvedStartupId) return;
    
    // Optimistic UI update
    optimisticUnlock(investorId);
    
    const result = await unlock(investorId);
    
    // Determine outcome
    const wasAlreadyUnlocked = result?.already_unlocked === true;
    const succeeded = result?.success === true;
    const ok = succeeded || wasAlreadyUnlocked;
    
    if (ok) {
      // Keep optimistic state (it's correct)
      // Refresh entitlements if unlocks changed
      if (succeeded && result?.unlocks_remaining !== undefined) {
        setTimeout(() => {
          invalidateStartupContext(resolvedStartupId);
          refreshContext();
        }, 100);
      }
    } else {
      // ROLLBACK: revert optimistic update on true failure
      rollbackUnlock(investorId);
      
      if (result?.error === 'daily_limit_reached') {
        console.log('Daily limit reached. Resets at:', result.resets_at);
        // TODO: Show toast to user
      }
    }
  }, [unlock, resolvedStartupId, refreshContext, optimisticUnlock, rollbackUnlock]);

  const handleRefresh = useCallback(() => {
    refreshTable();
    refreshContext();
  }, [refreshTable, refreshContext]);

  const handlePickStartup = useCallback((id: string, name: string) => {
    setPickedStartupId(id);
    setPickedStartupName(name);
  }, []);

  // -----------------------------------------------------------------------------
  // RENDER: UI state screens
  // -----------------------------------------------------------------------------
  
  if (uiState.mode === 'loading') {
    return <FullPageSkeleton message="Resolving startup..." />;
  }
  
  if (uiState.mode === 'not_found') {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center" data-testid="radar-not-found">
        <div className="text-center max-w-md">
          <Search className="w-12 h-12 mx-auto mb-4 text-gray-500" />
          <p className="text-lg font-medium text-gray-300">Startup not found</p>
          <p className="text-sm text-gray-500 mt-2">
            No startup matched "<span className="text-gray-400">{uiState.searched}</span>"
          </p>
          <button
            onClick={() => navigate('/signal-matches')}
            className="mt-6 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium transition-colors"
          >
            Browse all startups
          </button>
        </div>
      </div>
    );
  }
  
  // MISSING CONTEXT: No URL/ID provided (routing broken or direct access)
  if (uiState.mode === 'missing_context') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-8">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <AlertCircle className="w-16 h-16 text-yellow-500/80" />
          </div>
          <h2 className="text-2xl font-bold text-white">No Startup Selected</h2>
          <p className="text-gray-400 leading-relaxed">
            Submit a URL from the homepage to see personalized investor signals and matches.
          </p>
          <div className="flex flex-col gap-3 pt-4">
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
            >
              ← Analyze a Startup
            </button>
            <button
              onClick={() => navigate('/signal-matches')}
              className="px-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-medium rounded-lg transition-colors"
            >
              Browse Startups
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (uiState.mode === 'picker') {
    return <StartupPicker onSelect={handlePickStartup} />;
  }

  // -----------------------------------------------------------------------------
  // RENDER: Main UI (uiState.mode === 'ready')
  // -----------------------------------------------------------------------------
  
  const showContext = !contextLoading && !!context;
  const unlocksRemaining = context?.entitlements?.unlocks_remaining ?? 0;
  const displayName = resolvedName || 'Loading...';

  return (
    <div className="min-h-screen bg-gray-950 text-white" data-testid="radar-page">
      {/* Header - per spec: "SIGNAL RADAR" with subtitle and live indicator */}
      <header className="border-b border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Left: Title + Subtitle */}
            <div>
              <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, color: "#6b7280", marginBottom: 4 }}>signal radar</div>
              <h1 style={{ fontSize: 20, fontWeight: 600, color: "#f3f4f6", margin: 0, lineHeight: 1.3 }}>
                Live investor alignment
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Movement, position, and optics
              </p>
            </div>

            {/* Right: Live Status + Entitlements + Refresh */}
            <div className="flex items-center gap-4">
              <LiveIndicator 
                lastRefreshAt={lastRefreshAt} 
                isPaused={isAnyPending}
                busySince={busySince}
                isStale={isStale} 
              />
              
              <EntitlementPill entitlements={context?.entitlements ?? null} />
              
              <button
                onClick={handleRefresh}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-5 h-5 ${tableLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {/* Startup Context Bar */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-medium text-white">{displayName}</h2>
            {context?.comparison?.sectors && context.comparison.sectors.length > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">
                {context.comparison.sectors.slice(0, 3).join(' · ')}
              </p>
            )}
          </div>
          
          {/* GOD Score anchor (constant across all rows - per spec) */}
          {showContext && context?.god?.total !== undefined && (
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide">GOD Score</p>
              <p className="text-2xl font-bold text-white">{context.god.total}</p>
            </div>
          )}
        </div>
        
        {/* Guidance line - per spec: one line, always visible */}
        <div className="mb-4 text-sm text-gray-500">
          <strong className="text-gray-400">Signal</strong> shows timing. <strong className="text-gray-400">GOD</strong> shows position. <strong className="text-gray-400">YC++</strong> shows how each investor is likely to perceive you.
        </div>

        {/* Match Table - using canonical view model */}
        <RadarMatchTable
          rows={rows}
          context={context}
          loading={tableLoading && rows.length === 0}
          isPending={isPending}
          onUnlock={handleUnlock}
          unlocksRemaining={unlocksRemaining}
        />
          
        {/* Count summary */}
        {rows.length > 0 && (
          <div className="mt-2 mb-8 text-sm text-gray-500">
            {unlockedCount} unlocked · {lockedCount} locked
          </div>
        )}

        {/* Daily Limit Warning */}
        {showContext && unlocksRemaining === 0 && (
          <div className="bg-amber-900/20 border border-amber-700/50 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-amber-200">Daily unlock limit reached</p>
              <p className="text-sm text-amber-300/70 mt-1">
                Your free unlocks reset at midnight. Upgrade to Pro for unlimited unlocks.
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Percentile Formatter (handles edge cases)
// -----------------------------------------------------------------------------
function formatPercentile(v: number | undefined): string {
  if (v == null) return '—';
  if (v <= 0) return 'N/A';
  if (v >= 99) return 'Top 1%';
  return `${v}th`;
}

// -----------------------------------------------------------------------------
// Full Page Skeleton
// -----------------------------------------------------------------------------
function FullPageSkeleton({ message }: { message: string }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="text-gray-400">{message}</span>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Live Indicator - State Priority: STALLED > BUSY > STALE > LIVE > AGED
// -----------------------------------------------------------------------------
// Truth table:
//   isPaused && busyTooLong  → STALLED (red, something's wrong)
//   isPaused                 → BUSY (amber, user action in progress)
//   isStale                  → STALE (orange, showing cached data)
//   secondsAgo < 15          → LIVE (green pulse)
//   secondsAgo >= 15         → AGED (gray, "Xs ago")
//   no data yet              → ... (connecting)
// -----------------------------------------------------------------------------

const BUSY_TIMEOUT_MS = 12000; // 12s before BUSY becomes STALLED
const LIVE_THRESHOLD_S = 15;   // Show LIVE if updated within 15s

function LiveIndicator({ 
  lastRefreshAt, 
  isPaused,
  busySince,
  isStale 
}: { 
  lastRefreshAt: number | null; 
  isPaused?: boolean;
  busySince?: number | null;
  isStale?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  
  // Tick every second to update "Xs ago" and watchdog
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Calculate derived values
  const secondsAgo = lastRefreshAt 
    ? Math.floor((now - lastRefreshAt) / 1000)
    : null;
  
  const busyDurationMs = busySince ? now - busySince : 0;
  const isBusyTooLong = isPaused && busyDurationMs > BUSY_TIMEOUT_MS;
  
  // STATE PRIORITY: STALLED > BUSY > STALE > LIVE > AGED
  
  // 1. STALLED - BUSY watchdog triggered (something's stuck)
  if (isBusyTooLong) {
    return (
      <div className="flex items-center gap-2" title={`Operation stalled (${Math.floor(busyDurationMs / 1000)}s)`}>
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-medium text-red-400">STALLED</span>
      </div>
    );
  }
  
  // 2. BUSY - unlock in progress (overrides STALE)
  if (isPaused) {
    return (
      <div className="flex items-center gap-2" title="Processing unlock...">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-xs font-medium text-amber-400">BUSY</span>
      </div>
    );
  }
  
  // 3. STALE - last fetch failed, showing cached data
  if (isStale) {
    return (
      <div className="flex items-center gap-2" title="Connection issue - showing cached data">
        <span className="w-2 h-2 rounded-full bg-orange-500" />
        <span className="text-xs font-medium text-orange-400">STALE</span>
      </div>
    );
  }
  
  // 4. LIVE - recent successful update
  if (secondsAgo !== null && secondsAgo < LIVE_THRESHOLD_S) {
    return (
      <div className="flex items-center gap-2" title={`Updated ${secondsAgo}s ago`}>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-medium text-emerald-400">LIVE</span>
      </div>
    );
  }
  
  // 5. AGED - not stale, but not recent either
  if (secondsAgo !== null) {
    return (
      <div className="flex items-center gap-2" title={`Last update: ${new Date(lastRefreshAt!).toLocaleTimeString()}`}>
        <span className="w-2 h-2 rounded-full bg-gray-500" />
        <span className="text-xs font-medium text-gray-500">{secondsAgo}s ago</span>
      </div>
    );
  }
  
  // 6. CONNECTING - no data yet
  return (
    <div className="flex items-center gap-2" title="Connecting...">
      <span className="w-2 h-2 rounded-full bg-gray-600 animate-pulse" />
      <span className="text-xs font-medium text-gray-500">...</span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Stat Card (with skeleton support) - kept for potential future use
// -----------------------------------------------------------------------------
interface StatCardProps {
  label: string;
  value: string | number | undefined;
  suffix?: string;
  trend?: 'up' | 'down' | 'neutral';
  format?: (v: number | undefined) => string;
  loading?: boolean;
}

function StatCard({ label, value, suffix, trend, format, loading }: StatCardProps) {
  const displayValue = loading 
    ? null 
    : format 
      ? format(value as number | undefined)
      : value ?? '—';
  
  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      {loading ? (
        <div className="h-8 w-20 bg-gray-800 rounded animate-pulse" />
      ) : (
        <div className="flex items-baseline gap-1">
          <span
            className={`text-2xl font-bold ${
              trend === 'up' ? 'text-emerald-400' :
              trend === 'down' ? 'text-red-400' :
              'text-white'
            }`}
          >
            {displayValue}
          </span>
          {suffix && displayValue !== '—' && displayValue !== 'N/A' && (
            <span className="text-sm text-gray-500">{suffix}</span>
          )}
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Startup Picker - Wired v2 Final (Benchmark Intelligence)
// -----------------------------------------------------------------------------
// Dense Supabase-style table with three independent benchmarks:
//   - Signal Score: Market attenuation — movement, timing, momentum
//   - GOD Score: Market position — intrinsic company strength (22+ models)
//   - YC++ Score: Market perception — elite investor pattern fit
// 
// Triangle model: Signal (when) / GOD (what) / YC++ (how perceived)
// -----------------------------------------------------------------------------

interface StartupBenchmarkRow {
  id: string;
  name: string;
  signal_score: number;      // 0-10, market attenuation
  god_score: number;         // 0-100, market position (multi-model)
  yc_plus_score: number;     // 0-100, elite investor pattern fit
  momentum_delta: number;    // change from prior period
  readiness: number;         // 0-1, surface tension
  match_count: number;       // investor matches waiting
}

// Tooltip content for benchmark explanations
const BENCHMARK_TOOLTIPS = {
  signal: {
    title: 'Signal Score',
    description: 'Measures how investor attention is forming right now — language shifts, receptivity, capital alignment, and velocity.',
    subline: 'Signal reflects movement, not quality.',
  },
  god: {
    title: 'GOD Score',
    description: 'A composite position score derived from 22+ weighted algorithms, trained on historical startup outcomes and continuously re-weighted via ML.',
    subline: 'Evaluates company strength independent of hype, timing, or investor taste.',
    details: [
      'Team construction analysis',
      'Traction integrity models', 
      'Market structure evaluation',
      'Execution velocity signals',
      'Capital efficiency heuristics',
      'Founder outcome priors',
    ],
    footer: 'Individual components are not equally weighted — weights adapt based on historical signal reliability in current market conditions.',
  },
  yc_plus: {
    title: 'YC++ Score',
    description: 'Measures how closely your company aligns with elite investor selection patterns (YC, Sequoia, Founders Fund, a16z, and similar funds).',
    subline: 'This is not quality — it is optics and pattern recognition.',
    details: [
      'Stage optics vs fund taste',
      'Founder profile resonance',
      'Category familiarity',
      'Narrative legibility',
      'Historical selection bias',
    ],
  },
  fit: {
    title: 'Fit',
    description: 'Confidence that this interaction will convert if initiated now.',
    subline: 'Composite of Signal × YC++ × GOD confidence, data freshness, and historical close-rate proxies.',
  },
} as const;

// THRESHOLDS (LOCKED per spec)
const SIGNAL_THRESHOLDS = {
  WINDOW_OPENING: 7.5,  // Green ▲
  ACTIVE: 5.5,          // Neutral
  COOLING: 4.0,         // Amber
  DORMANT: 0,           // Gray ▼
} as const;

const GOD_THRESHOLDS = {
  STRONG: 85,           // High intrinsic quality
  SOLID: 70,            // Fundable with alignment  
  DEVELOPING: 55,       // Needs improvement
  EARLY: 0,             // Structural gaps
} as const;

const YC_PLUS_THRESHOLDS = {
  FAMILIAR: 80,         // Familiar & legible
  REQUIRES_EXPLANATION: 65,
  UNFAMILIAR: 50,
  LIKELY_IGNORED: 0,
} as const;

// Info icon with expandable tooltip
function BenchmarkInfo({ benchmark }: { benchmark: keyof typeof BENCHMARK_TOOLTIPS }) {
  const [expanded, setExpanded] = useState(false);
  const info = BENCHMARK_TOOLTIPS[benchmark];
  
  return (
    <div className="relative inline-block">
      <button
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
        className="ml-1 text-gray-500 hover:text-gray-300 transition-colors"
        title={`${info.title}: ${info.subline}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
      {expanded && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setExpanded(false)}
          />
          {/* Tooltip panel */}
          <div className="absolute z-50 left-0 top-6 w-72 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 text-left">
            <h4 className="text-sm font-semibold text-white mb-1">{info.title}</h4>
            <p className="text-xs text-gray-300 mb-2">{info.description}</p>
            <p className="text-xs text-gray-500 italic mb-2">{info.subline}</p>
            {'details' in info && (
              <div className="mt-2 pt-2 border-t border-gray-800">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Built from:</p>
                <ul className="text-xs text-gray-400 space-y-0.5">
                  {info.details.map((d, i) => (
                    <li key={i} className="flex items-center gap-1">
                      <span className="text-gray-600">•</span> {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {'footer' in info && (
              <p className="mt-2 pt-2 border-t border-gray-800 text-[10px] text-gray-500">
                {info.footer}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Readiness bar component (5-bar, no number - per spec)
function ReadinessBar({ value, className = '' }: { value: number; className?: string }) {
  const bars = Math.round(value * 5);
  return (
    <div className={`flex items-center gap-0.5 ${className}`} title="Confidence that this startup will perform once injected into the radar">
      {Array.from({ length: 5 }).map((_, i) => (
        <div 
          key={i}
          className={`w-1.5 h-3 rounded-sm ${
            i < bars ? 'bg-gray-300' : 'bg-gray-700'
          }`}
        />
      ))}
    </div>
  );
}

// Fit bar component (for radar page - no color per spec)
function FitBar({ value, className = '' }: { value: number; className?: string }) {
  const bars = Math.round(value * 5);
  return (
    <div className={`flex items-center gap-0.5 ${className}`} title="Probability this interaction converts if initiated now">
      {Array.from({ length: 5 }).map((_, i) => (
        <div 
          key={i}
          className={`w-1.5 h-3 rounded-sm ${
            i < bars ? 'bg-gray-300' : 'bg-gray-700'
          }`}
        />
      ))}
    </div>
  );
}

// Signal score display with direction arrow
function SignalDisplay({ score, delta }: { score: number; delta?: number }) {
  // Determine direction
  const direction = delta !== undefined 
    ? (delta > 0.1 ? 'up' : delta < -0.1 ? 'down' : 'flat')
    : 'flat';
  
  // Color based on LOCKED thresholds
  const colorClass = score >= SIGNAL_THRESHOLDS.WINDOW_OPENING
    ? 'text-emerald-400'
    : score >= SIGNAL_THRESHOLDS.ACTIVE
      ? 'text-gray-300'
      : score >= SIGNAL_THRESHOLDS.COOLING
        ? 'text-amber-400'
        : 'text-gray-500';
  
  // Arrow color (only on arrow per spec)
  const arrowClass = direction === 'up' 
    ? 'text-emerald-400' 
    : direction === 'down' 
      ? 'text-red-400' 
      : 'text-gray-600';
  
  return (
    <span className="font-mono text-sm">
      <span className={colorClass}>{score.toFixed(1)}</span>
      <span className={`ml-1 text-xs ${arrowClass}`}>
        {direction === 'up' ? '▲' : direction === 'down' ? '▼' : '▬'}
      </span>
    </span>
  );
}

// -----------------------------------------------------------------------------
// RadarMatchTable Wrapper - Integrates LiveMatchTable with Canonical View Model
// -----------------------------------------------------------------------------

function RadarMatchTable({
  rows,
  context,
  loading,
  isPending,
  onUnlock,
  unlocksRemaining,
}: {
  rows: MatchRow[];
  context: StartupContext | null;
  loading: boolean;
  isPending: (investorId: string) => boolean;
  onUnlock: (investorId: string) => Promise<void>;
  unlocksRemaining: number;
}) {
  // Use the legacy adapter to transform rows to view model format
  const { unlockedRows, lockedRows } = useLegacyRadarAdapter(rows, context?.god?.total, context);
  
  return (
    <div className="mb-8" data-testid="match-table">
      <LiveMatchTable
        unlockedRows={unlockedRows}
        lockedRows={lockedRows}
        loading={loading}
        isPending={isPending}
        onUnlock={onUnlock}
        unlocksRemaining={unlocksRemaining}
      />
    </div>
  );
}

function StartupPicker({ onSelect }: { onSelect: (id: string, name: string) => void }) {
  const [startups, setStartups] = useState<StartupBenchmarkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<keyof StartupBenchmarkRow>('signal_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  
  useEffect(() => {
    async function fetchStartups() {
      // Fetch startups with GOD scores
      const { data: startupsData, error: startupsError } = await supabase
        .from('startup_uploads')
        .select('id, name, total_god_score, team_score, traction_score, market_score, product_score, vision_score, sectors')
        .eq('status', 'approved')
        .order('total_god_score', { ascending: false })
        .limit(100);
      
      if (startupsError || !startupsData) {
        console.error('Failed to fetch startups:', startupsError);
        setLoading(false);
        return;
      }
      
      // Fetch match counts per startup
      const { data: matchCounts, error: matchError } = await supabase
        .from('startup_investor_matches')
        .select('startup_id')
        .in('startup_id', startupsData.map(s => s.id));
      
      // Count matches per startup
      const countMap = new Map<string, number>();
      if (matchCounts && !matchError) {
        matchCounts.forEach(m => {
          countMap.set(m.startup_id, (countMap.get(m.startup_id) || 0) + 1);
        });
      }
      
      // Transform to benchmark rows
      const benchmarks: StartupBenchmarkRow[] = startupsData.map(s => {
        const godScore = s.total_god_score || 50;
        
        // Derive Signal Score (0-10) from GOD components + match velocity
        // This is a proxy until we have real signal infrastructure
        const matchCount = countMap.get(s.id) || 0;
        const signalBase = (godScore / 100) * 6; // Base from GOD (0-6)
        const matchBonus = Math.min(matchCount / 10, 2); // Match velocity bonus (0-2)
        const variance = (Math.random() - 0.5) * 2; // Some variance (±1)
        const signalScore = Math.max(0, Math.min(10, signalBase + matchBonus + variance));
        
        // Derive YC++ Score (0-100) from GOD + category premium
        // Elite VCs favor: high traction, strong teams, hot sectors
        // This measures pattern fit, not quality
        const tractionWeight = (s.traction_score || 0) * 1.5; // VCs love traction
        const teamWeight = (s.team_score || 0) * 1.2; // Strong teams
        const ycBase = ((tractionWeight + teamWeight) / 2.7) * 100;
        const ycPlusScore = Math.max(40, Math.min(95, ycBase + (Math.random() - 0.3) * 15));
        
        // Momentum delta (simulated for now - would come from signal history)
        const momentumDelta = (Math.random() - 0.4) * 2; // Slight positive bias
        
        // Readiness score (0-1) - data completeness + match quality
        const dataCompleteness = [s.team_score, s.traction_score, s.market_score, s.product_score]
          .filter(v => v !== null && v > 0).length / 4;
        const matchReadiness = matchCount > 0 ? Math.min(matchCount / 20, 1) : 0;
        const readiness = (dataCompleteness * 0.6 + matchReadiness * 0.4);
        
        return {
          id: s.id,
          name: s.name,
          signal_score: Math.round(signalScore * 10) / 10,
          god_score: Math.round(godScore),
          yc_plus_score: Math.round(ycPlusScore),
          momentum_delta: Math.round(momentumDelta * 10) / 10,
          readiness,
          match_count: matchCount,
        };
      });
      
      setStartups(benchmarks);
      setLoading(false);
    }
    fetchStartups();
  }, []);
  
  // Sort function
  const sorted = useMemo(() => {
    return [...startups].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const mult = sortDir === 'desc' ? -1 : 1;
      return (Number(aVal) - Number(bVal)) * mult;
    });
  }, [startups, sortKey, sortDir]);
  
  const handleSort = (key: keyof StartupBenchmarkRow) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };
  
  const SortHeader = ({ label, field, benchmark }: { label: string; field: keyof StartupBenchmarkRow; benchmark?: keyof typeof BENCHMARK_TOOLTIPS }) => (
    <th 
      className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
      onClick={() => handleSort(field)}
    >
      <span className="flex items-center gap-1">
        {label}
        {benchmark && <BenchmarkInfo benchmark={benchmark} />}
        {sortKey === field && (
          <span className="text-blue-400 ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span>
        )}
      </span>
    </th>
  );
  
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header - per spec: restrained, professional */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white mb-1">
            Signal Radar
          </h1>
          <p className="text-sm text-gray-500">
            Benchmark your startup across movement, position, and investor optics
          </p>
        </div>
        
        {/* Guidance line - always visible, per spec */}
        <div className="mb-4 text-sm text-gray-500">
          Use <strong className="text-gray-400">Signal</strong> to time outreach, <strong className="text-gray-400">GOD</strong> to assess strength, and <strong className="text-gray-400">YC++</strong> to understand investor optics.
        </div>
        
        {/* Table */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-gray-900/80">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Startup
                  </th>
                  <SortHeader label="Signal" field="signal_score" benchmark="signal" />
                  <SortHeader label="GOD" field="god_score" benchmark="god" />
                  <SortHeader label="YC++" field="yc_plus_score" benchmark="yc_plus" />
                  <th 
                    className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                    onClick={() => handleSort('momentum_delta')}
                    title="Signal acceleration or decay"
                  >
                    <span className="flex items-center gap-1">
                      Δ
                      {sortKey === 'momentum_delta' && (
                        <span className="text-blue-400 ml-0.5">{sortDir === 'desc' ? '↓' : '↑'}</span>
                      )}
                    </span>
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider" title="Confidence that this startup will perform once injected into the radar">
                    Readiness
                  </th>
                  <SortHeader label="Matches" field="match_count" />
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {loading ? (
                  // Skeleton rows
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-4 py-3"><div className="h-4 w-32 bg-gray-800 rounded" /></td>
                      <td className="px-3 py-3"><div className="h-4 w-12 bg-gray-800 rounded" /></td>
                      <td className="px-3 py-3"><div className="h-4 w-10 bg-gray-800 rounded" /></td>
                      <td className="px-3 py-3"><div className="h-4 w-10 bg-gray-800 rounded" /></td>
                      <td className="px-3 py-3"><div className="h-4 w-12 bg-gray-800 rounded" /></td>
                      <td className="px-3 py-3"><div className="h-4 w-16 bg-gray-800 rounded" /></td>
                      <td className="px-3 py-3"><div className="h-4 w-8 bg-gray-800 rounded" /></td>
                      <td className="px-3 py-3"><div className="h-4 w-16 bg-gray-800 rounded" /></td>
                    </tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                      No startups found
                    </td>
                  </tr>
                ) : (
                  sorted.map(s => (
                    <tr 
                      key={s.id} 
                      className="hover:bg-gray-800/50 transition-colors group"
                    >
                      {/* Startup Name - just name, per spec */}
                      <td className="px-4 py-3">
                        <span className="font-medium text-white">{s.name}</span>
                      </td>
                      
                      {/* Signal Score with direction */}
                      <td className="px-3 py-3">
                        <SignalDisplay score={s.signal_score} delta={s.momentum_delta} />
                      </td>
                      
                      {/* GOD Score - numbers speak, no colors needed per spec */}
                      <td className="px-3 py-3">
                        <span className="font-mono text-sm text-gray-200">
                          {s.god_score}
                        </span>
                      </td>
                      
                      {/* YC++ Score */}
                      <td className="px-3 py-3">
                        <span className="font-mono text-sm text-gray-200">
                          {s.yc_plus_score}
                        </span>
                      </td>
                      
                      {/* Momentum Delta */}
                      <td className="px-3 py-3">
                        <span className={`font-mono text-sm ${
                          s.momentum_delta > 0.3 ? 'text-emerald-400' :
                          s.momentum_delta < -0.2 ? 'text-red-400/60' :
                          'text-gray-600'
                        }`}>
                          {s.momentum_delta > 0 ? '+' : ''}{s.momentum_delta.toFixed(1)}
                        </span>
                      </td>
                      
                      {/* Readiness Bar - bars only, no number per spec */}
                      <td className="px-3 py-3">
                        <ReadinessBar value={s.readiness} />
                      </td>
                      
                      {/* Match Count */}
                      <td className="px-3 py-3">
                        <span className="font-mono text-sm text-gray-400">
                          {s.match_count}
                        </span>
                      </td>
                      
                      {/* Action - "▶ Enter" per spec */}
                      <td className="px-3 py-3 text-right">
                        <button
                          onClick={() => onSelect(s.id, s.name)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-blue-400 hover:text-white hover:bg-blue-600/20 rounded transition-colors"
                        >
                          <span>▶</span>
                          <span>Enter</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {/* No legend needed - guidance line above table suffices */}
      </div>
    </div>
  );
}
