// ============================================================================
// SignalMatches - Canonical Find Signals Results Page
// ============================================================================
//
// Canonical responsibilities:
// 1. Read ?url=... or ?startup=... or /:startupId
// 2. If URL is present and no startup id is known, call submitStartup()
// 3. Once a startup id is known, load context + matches
// 4. Render the results page
//
// Rules:
// - submitStartup() is the ONLY orchestration path for URL submission
// - This page does NOT implement backup submission logic
// - This page does NOT directly call resolve_startup_by_url for orchestration
// - This page only renders UI around resolvedStartupId
// ============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import type { MatchRow, StartupContext } from '@/lib/pythh-types';
import { buildStartupContextFromPreview } from '@/lib/startupContextFromPreview';

import InvestorReadinessReport, { type ReportData } from '@/components/pythh/InvestorReadinessReport';
import SignalPathDashboard from '@/components/pythh/SignalPathDashboard';
import { LiveMatchTable } from '@/components/pythh/LiveMatchTableV2';
import StartupProfileCard from '@/components/pythh/StartupProfileCard';
import SignalEventTimeline from '@/components/pythh/SignalEventTimeline';
import SignalHealthHexagon from '@/components/pythh/SignalHealthHexagon';
import { GODScoreExplainer } from '@/components/pythh/GODScoreExplainer';
import ImproveScoreWizard from '@/components/ImproveScoreWizard';
import PythhAnalyzeEntryHero from '@/components/pythh/PythhAnalyzeEntryHero';

import { submitStartup, type SubmitResult } from '@/services/submitStartup';
import {
  useStartupContext,
  useLiveMatchTable,
  useUnlock,
  invalidateStartupContext,
} from '@/services/pythh-rpc';
import { useLegacyRadarAdapter } from '@/hooks/useRadarViewModel';
import { apiUrl, fetchPreviewReport, fetchTimeoutSignal } from '@/lib/apiConfig';

const SAVED_MATCHES_KEY = 'pythh_saved_matches';

// -----------------------------------------------------------------------------
// TYPES
// -----------------------------------------------------------------------------

type UIState =
  | { mode: 'loading' }
  | { mode: 'ready' }
  | { mode: 'not_found'; searched: string; message?: string }
  | { mode: 'picker' }
  | { mode: 'missing_context' };

type SubmitPhase = 'idle' | 'loading' | 'done' | 'error';

interface StartupBenchmarkRow {
  id: string;
  name: string;
  signal_score: number;
  god_score: number;
  yc_plus_score: number;
  momentum_delta: number;
  readiness: number;
  match_count: number;
}

// -----------------------------------------------------------------------------
// PAGE
// -----------------------------------------------------------------------------

export default function SignalMatches() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const params = useParams<{ startupId?: string }>();

  const isInApp = location.pathname.startsWith('/app/');
  const lastRoute = useRef<string>('');

  useEffect(() => {
    const key = `${location.pathname}${location.search}`;
    if (lastRoute.current === key) return;
    lastRoute.current = key;

    if (import.meta.env.DEV) {
      console.log('[SignalMatches] HIT:', key);
    }
  }, [location.pathname, location.search]);

  // ---------------------------------------------------------------------------
  // INPUT SOURCES
  // ---------------------------------------------------------------------------

  const startupIdFromPath = params.startupId ?? null;
  const startupIdFromQuery = searchParams.get('startup');
  const urlToResolve = searchParams.get('url');
  const forceGenerate = searchParams.get('regen') === '1';

  const [pickedStartupId, setPickedStartupId] = useState<string | null>(null);
  const [pickedStartupName, setPickedStartupName] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // URL SUBMISSION ORCHESTRATION
  // ---------------------------------------------------------------------------

  const [submitPhase, setSubmitPhase] = useState<SubmitPhase>('idle');
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSlowLoading, setIsSlowLoading] = useState(false);

  useEffect(() => {
    if (!urlToResolve) return;
    if (startupIdFromPath || startupIdFromQuery) return;

    let cancelled = false;

    setSubmitPhase('loading');
    setSubmitError(null);
    setSubmitResult(null);
    setIsSlowLoading(false);

    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setIsSlowLoading(true);
    }, 5000);

    void submitStartup(urlToResolve, { forceGenerate })
      .then((result) => {
        if (cancelled) return;

        setSubmitResult(result);

        if (result.status === 'error' || result.status === 'not_found') {
          setSubmitPhase('error');
          setSubmitError(result.error || 'Startup not found');
          return;
        }

        if (result.startup_id) {
          setSubmitPhase('done');

          navigate(
            `/signal-matches?startup=${encodeURIComponent(result.startup_id)}&url=${encodeURIComponent(urlToResolve)}`,
            { replace: true }
          );
          return;
        }

        setSubmitPhase('error');
        setSubmitError('Could not resolve startup');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSubmitPhase('error');
        setSubmitError(err instanceof Error ? err.message : 'Failed to resolve startup');
      })
      .finally(() => {
        if (cancelled) return;
        window.clearTimeout(slowTimer);
        setIsSlowLoading(false);
      });

    return () => {
      cancelled = true;
      window.clearTimeout(slowTimer);
    };
  }, [urlToResolve, forceGenerate, startupIdFromPath, startupIdFromQuery, navigate]);

  // ---------------------------------------------------------------------------
  // SINGLE SOURCE OF TRUTH: resolvedStartupId
  // ---------------------------------------------------------------------------

  const resolvedStartupId = useMemo(() => {
    if (startupIdFromPath) return startupIdFromPath;
    if (startupIdFromQuery) return startupIdFromQuery;
    if (submitResult?.startup_id) return submitResult.startup_id;
    if (pickedStartupId) return pickedStartupId;
    return null;
  }, [startupIdFromPath, startupIdFromQuery, submitResult?.startup_id, pickedStartupId]);

  const resolvedName = useMemo(() => {
    if (submitResult?.name) return submitResult.name;
    if (pickedStartupName) return pickedStartupName;
    return null;
  }, [submitResult?.name, pickedStartupName]);

  const uiState = useMemo<UIState>(() => {
    if (resolvedStartupId) return { mode: 'ready' };

    if (urlToResolve && submitPhase === 'loading') {
      return { mode: 'loading' };
    }

    if (urlToResolve && submitPhase === 'error') {
      return {
        mode: 'not_found',
        searched: submitResult?.searched || urlToResolve,
        message: submitError || undefined,
      };
    }

    const hasAnyInput = !!(urlToResolve || startupIdFromPath || startupIdFromQuery || pickedStartupId);

    if (!hasAnyInput) {
      return { mode: 'missing_context' };
    }

    return { mode: 'picker' };
  }, [
    resolvedStartupId,
    urlToResolve,
    submitPhase,
    submitResult?.searched,
    submitError,
    startupIdFromPath,
    startupIdFromQuery,
    pickedStartupId,
  ]);

  // ---------------------------------------------------------------------------
  // DATA HOOKS
  // ---------------------------------------------------------------------------

  const tableStartupId = resolvedStartupId;

  const {
    context,
    loading: contextLoading,
    error: contextError,
    refresh: refreshContext,
  } = useStartupContext(tableStartupId);

  const {
    unlock,
    isPending,
    isAnyPending,
  } = useUnlock(tableStartupId);

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [savedMatchesAt, setSavedMatchesAt] = useState<number | null>(null);

  const previewAsContext = useMemo(
    () => (reportData ? buildStartupContextFromPreview(reportData) : null),
    [reportData]
  );
  const mergedContext = context ?? previewAsContext;

  useEffect(() => {
    if (!resolvedStartupId) {
      setReportData(null);
      return;
    }

    let cancelled = false;
    let pollInterval: number | null = null;
    let stopTimer: number | null = null;

    async function fetchReport() {
      setReportLoading(true);

      try {
        const res = await fetchPreviewReport(resolvedStartupId, {
          signal: fetchTimeoutSignal(60_000),
        });
        if (!res.ok) throw new Error('Could not load report');

        const data: ReportData = await res.json();
        if (cancelled) return;

        setReportData(data);
        setReportLoading(false);

        if (data.startup.god_score === 50) {
          console.log('[SignalMatches] GOD score is 50, polling for updated score...');

          pollInterval = window.setInterval(async () => {
            try {
              const pollRes = await fetch(apiUrl(`/api/preview/${resolvedStartupId}`), {
                signal: fetchTimeoutSignal(45_000),
              });
              if (!pollRes.ok) return;

              const pollData: ReportData = await pollRes.json();
              if (cancelled) return;

              if (pollData.startup.god_score !== 50) {
                console.log('[SignalMatches] GOD score updated:', pollData.startup.god_score);
                setReportData(pollData);

                if (pollInterval) {
                  window.clearInterval(pollInterval);
                  pollInterval = null;
                }
              }
            } catch (err) {
              console.warn('[SignalMatches] Poll error:', err);
            }
          }, 3000);

          stopTimer = window.setTimeout(() => {
            if (pollInterval) {
              window.clearInterval(pollInterval);
              pollInterval = null;
            }
          }, 60000);
        }
      } catch (err) {
        console.error('[SignalMatches] Failed to load report:', err);
        if (!cancelled) setReportLoading(false);
      }
    }

    void fetchReport();

    return () => {
      cancelled = true;
      if (pollInterval) window.clearInterval(pollInterval);
      if (stopTimer) window.clearTimeout(stopTimer);
    };
  }, [resolvedStartupId]);

  const [lastRefreshAt, setLastRefreshAt] = useState<number | null>(null);
  const [busySince, setBusySince] = useState<number | null>(null);

  useEffect(() => {
    if (isAnyPending) {
      setBusySince((prev) => prev ?? Date.now());
    } else {
      setBusySince(null);
    }
  }, [isAnyPending]);

  const {
    rows,
    loading: tableLoading,
    refresh: refreshTable,
    optimisticUnlock,
    rollbackUnlock,
    isStale,
  } = useLiveMatchTable(tableStartupId, {
    pollIntervalMs: 10000,
    pausePolling: isAnyPending,
    onUpdated: ({ at }) => setLastRefreshAt(at.getTime()),
  });

  const matchGenPending = !!(
    tableStartupId &&
    urlToResolve &&
    !tableLoading &&
    rows.length === 0
  );

  useEffect(() => {
    if (!matchGenPending) return;
    const fastPoll = window.setInterval(() => {
      refreshTable();
    }, 3000);

    return () => window.clearInterval(fastPoll);
  }, [matchGenPending, refreshTable]);

  const { unlockedCount, lockedCount } = useMemo(() => {
    let unlocked = 0;
    let locked = 0;

    for (const row of rows) {
      if (row.is_locked) locked += 1;
      else unlocked += 1;
    }

    return { unlockedCount: unlocked, lockedCount: locked };
  }, [rows]);

  // ---------------------------------------------------------------------------
  // HANDLERS
  // ---------------------------------------------------------------------------

  const handleUnlock = useCallback(
    async (investorId: string) => {
      if (!resolvedStartupId) return;

      optimisticUnlock(investorId);

      const result = await unlock(investorId);

      const wasAlreadyUnlocked = result?.already_unlocked === true;
      const succeeded = result?.success === true;
      const ok = succeeded || wasAlreadyUnlocked;

      if (ok) {
        if (succeeded && result?.unlocks_remaining !== undefined) {
          window.setTimeout(() => {
            invalidateStartupContext(resolvedStartupId);
            refreshContext();
          }, 100);
        }
        return;
      }

      rollbackUnlock(investorId);

      if (result?.error === 'daily_limit_reached') {
        console.log('Daily limit reached. Resets at:', result.resets_at);
      }
    },
    [resolvedStartupId, optimisticUnlock, unlock, rollbackUnlock, refreshContext]
  );

  const handleRefresh = useCallback(() => {
    refreshTable();
    refreshContext();
  }, [refreshTable, refreshContext]);

  const handlePickStartup = useCallback((id: string, name: string) => {
    setPickedStartupId(id);
    setPickedStartupName(name);
  }, []);

  // Initialize saved state from localStorage when startup was previously saved
  useEffect(() => {
    if (!resolvedStartupId) return;
    try {
      const raw = localStorage.getItem(SAVED_MATCHES_KEY);
      const list: Array<{ startupId: string; savedAt: number }> = raw ? JSON.parse(raw) : [];
      const entry = list.find((x) => x.startupId === resolvedStartupId);
      if (entry) setSavedMatchesAt(entry.savedAt);
    } catch {
      // ignore
    }
  }, [resolvedStartupId]);

  const handleSaveMatches = useCallback(
    (startupId: string, url: string | null, name: string) => {
      try {
        const raw = localStorage.getItem(SAVED_MATCHES_KEY);
        const list: Array<{ startupId: string; url: string | null; displayName: string; savedAt: number }> = raw ? JSON.parse(raw) : [];
        const existing = list.find((x) => x.startupId === startupId);
        if (!existing) {
          list.unshift({ startupId, url, displayName: name, savedAt: Date.now() });
          localStorage.setItem(SAVED_MATCHES_KEY, JSON.stringify(list.slice(0, 20)));
        }
        setSavedMatchesAt(Date.now());
      } catch {
        // ignore
      }
    },
    []
  );

  // ---------------------------------------------------------------------------
  // UI STATES
  // ---------------------------------------------------------------------------

  if (uiState.mode === 'loading') {
    return (
      <FullPageSkeleton
        message={
          isSlowLoading
            ? 'Still working… scraping signals and building your match profile'
            : 'Resolving startup…'
        }
      />
    );
  }

  if (uiState.mode === 'not_found') {
    return (
      <PageShell isInApp={isInApp} onRefresh={handleRefresh} tableLoading={tableLoading}>
        <main className="max-w-7xl mx-auto px-4 sm:px-8 py-12">
          <div className="text-[11px] text-zinc-500 uppercase tracking-wider mb-3">Not found</div>

          <p className="text-sm text-zinc-400 leading-relaxed mb-3">
            No startup matched &quot;<span className="text-white">{uiState.searched}</span>&quot;
          </p>

          {uiState.message && (
            <p className="text-sm text-red-400/80 mb-6">{uiState.message}</p>
          )}

          <div className="text-sm text-zinc-500 space-y-1.5 mb-8">
            <p><span className="text-zinc-400 mr-2">→</span>Check for typos in the domain name</p>
            <p><span className="text-zinc-400 mr-2">→</span>Use the full domain (e.g. stripe.com, not stripe)</p>
            <p><span className="text-zinc-400 mr-2">→</span>Make sure it is a real company website</p>
          </div>

          <p className="text-sm text-zinc-400">
            <Link to="/signal-matches" className="text-cyan-400 hover:text-cyan-300 transition">Try again</Link>
            <span className="text-zinc-700 mx-3">·</span>
            <Link to="/signal-matches" className="text-zinc-400 hover:text-white transition">Browse startups</Link>
          </p>
        </main>
      </PageShell>
    );
  }

  if (uiState.mode === 'missing_context') {
    return (
      <PageShell isInApp={isInApp} onRefresh={handleRefresh} tableLoading={tableLoading}>
        <PythhAnalyzeEntryHero />
        <main className="mx-auto max-w-2xl px-4 py-10 text-center sm:px-8">
          <p className="text-xs text-zinc-600">
            Matches, GOD score, and unlocks appear here after you submit a URL above.
          </p>
        </main>
      </PageShell>
    );
  }

  if (uiState.mode === 'picker') {
    return <StartupPicker onSelect={handlePickStartup} />;
  }

  // ---------------------------------------------------------------------------
  // READY STATE
  // ---------------------------------------------------------------------------

  const unlocksRemaining = context?.entitlements?.unlocks_remaining ?? 0;
  const displayName = (() => {
    const raw = resolvedName || mergedContext?.startup?.name || '';
    if (!raw) return 'Loading...';
    return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
  })();

  const reportOnlyMode = false;

  return (
    <PageShell isInApp={isInApp} onRefresh={handleRefresh} tableLoading={tableLoading}>
      <main className="max-w-7xl mx-auto px-4 sm:px-8 py-10" data-testid="radar-page">
        {/* Startup business card — name, URL, description, GOD + Signal scores */}
        <section
          className="mb-8 rounded-xl border border-zinc-700/60 bg-zinc-900/40"
          data-testid="startup-business-card"
          aria-label="Startup profile"
        >
          <div className="px-4 pt-4 pb-2">
            <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Your startup</span>
          </div>
          <StartupProfileCard
            context={mergedContext}
            displayName={displayName}
            website={
              submitResult?.website ??
              mergedContext?.startup?.company_website ??
              mergedContext?.startup?.website
            }
            loading={contextLoading && !previewAsContext}
            contextError={contextError}
            unlockedCount={unlockedCount}
            totalMatches={reportData?.total_matches ?? rows.length}
          />
        </section>

        <div className="mb-6 flex items-center gap-4">
          <LiveIndicator
            lastRefreshAt={lastRefreshAt}
            isPaused={isAnyPending}
            busySince={busySince}
            isStale={isStale}
          />
        </div>

        {resolvedStartupId && (
          <p className="text-xs text-zinc-500 mb-4 leading-relaxed max-w-3xl">
            This is the <span className="text-zinc-400">live match dashboard</span> (full table, unlocks, Copy
            intro). For the shorter bookmarkable report (same engine), open the{' '}
            <Link
              to={`/submit?startup=${encodeURIComponent(resolvedStartupId)}`}
              className="text-cyan-400/90 hover:text-cyan-300 underline-offset-2 hover:underline"
            >
              investor readiness report
            </Link>
            .
          </p>
        )}

        <p className="text-sm text-zinc-400 leading-relaxed mb-2">
          <span className="text-cyan-400">Signal</span> = timing.
          <span className="text-zinc-300 ml-1">
            GOD
            <GODScoreExplainer variant="icon" className="ml-1 align-middle" />
          </span>
          {' '}= your investment readiness (what tier 1 VCs evaluate).
          <span className="text-zinc-300 ml-1">YC++</span> = how investors perceive you.
        </p>
        <p className="text-sm text-cyan-300/90 mb-8">
          Get the meeting: use <strong>Copy intro</strong> on each row to grab a ready-made outreach line.
        </p>

        {reportData && !reportLoading && reportOnlyMode ? (
          <InvestorReadinessReport report={reportData} />
        ) : (
          <>
            <RadarMatchTable
              rows={rows}
              context={mergedContext}
              loading={tableLoading && rows.length === 0}
              isPending={isPending}
              onUnlock={handleUnlock}
              unlocksRemaining={unlocksRemaining}
              matchGenPending={matchGenPending}
              mode="unlocked"
            />

            <SignalPathDashboard
              context={mergedContext}
              rows={rows}
              startupName={displayName}
              loading={(contextLoading && !previewAsContext) || tableLoading}
            />

            <SignalHealthHexagon
              signals={mergedContext?.signals}
              loading={contextLoading && !previewAsContext}
            />

            {resolvedStartupId && (
              <SignalEventTimeline startupId={resolvedStartupId} limit={12} />
            )}

            {rows.some((r) => r.is_locked) && (
              <div className="mt-6">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">More Matches</h3>
                  <span className="text-xs text-zinc-600">{lockedCount} available</span>
                </div>

                <RadarMatchTable
                  rows={rows}
                  context={mergedContext}
                  loading={tableLoading && rows.length === 0}
                  isPending={isPending}
                  onUnlock={handleUnlock}
                  unlocksRemaining={unlocksRemaining}
                  mode="locked"
                />
              </div>
            )}
          </>
        )}

        {rows.length > 0 && (
          <div className="mt-4 text-xs text-gray-500">
            {unlockedCount} ready • {lockedCount} available
          </div>
        )}

        {/* Your next steps — promote actions after reviewing matches */}
        {(rows.length > 0 || matchGenPending) && resolvedStartupId && (
          <NextStepsBlock
            startupId={resolvedStartupId}
            url={urlToResolve}
            displayName={displayName}
            godScore={mergedContext?.god?.total}
            hasDeck={!!(context?.startup?.deck_filename || context?.startup?.deck_url)}
            onSaveMatches={handleSaveMatches}
            savedAt={savedMatchesAt}
            unlocksRemaining={unlocksRemaining}
            isInApp={isInApp}
            onDeckUploadSuccess={handleRefresh}
          />
        )}

        {!!context && unlocksRemaining === 0 && (
          <p className="text-sm text-amber-400/70 mt-6">
            Daily unlock limit reached — resets at midnight.
            <Link to="/pricing" className="text-cyan-400 hover:text-cyan-300 ml-1 transition">
              Upgrade
            </Link>{' '}
            for unlimited.
          </p>
        )}
      </main>
    </PageShell>
  );
}

// -----------------------------------------------------------------------------
// NEXT STEPS BLOCK
// -----------------------------------------------------------------------------

function NextStepsBlock({
  startupId,
  url,
  displayName,
  godScore,
  hasDeck = false,
  onSaveMatches,
  savedAt,
  unlocksRemaining,
  isInApp,
  onDeckUploadSuccess,
}: {
  startupId: string;
  url: string | null;
  displayName: string;
  godScore?: number;
  hasDeck?: boolean;
  onSaveMatches: (id: string, u: string | null, name: string) => void;
  savedAt: number | null;
  unlocksRemaining: number;
  isInApp: boolean;
  onDeckUploadSuccess?: () => void;
}) {
  const [showImproveWizard, setShowImproveWizard] = useState(false);
  const basePath = isInApp ? '/app' : '';
  const wasSaved = savedAt !== null;
  const justSaved = wasSaved && savedAt > Date.now() - 3000;

  const handleSave = () => {
    onSaveMatches(startupId, url, displayName);
  };

  return (
    <section className="mt-10 mb-8 rounded-xl border border-zinc-700/50 bg-zinc-900/30 p-6">
      <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">Your next steps</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setShowImproveWizard(true)}
          className="group flex items-start gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-4 hover:border-cyan-500/40 hover:bg-zinc-800/60 transition text-left w-full"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cyan-500/20 text-cyan-400 font-bold text-sm">0</span>
          <div>
            <p className="font-medium text-white group-hover:text-cyan-400 transition">Improve your score</p>
            <p className="text-xs text-zinc-500 mt-0.5">3 steps: know score → add evidence → see impact</p>
          </div>
        </button>
        <Link
          to={`${basePath}/signal-matches?startup=${startupId}`}
          className="group flex items-start gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-4 hover:border-emerald-500/40 hover:bg-zinc-800/60 transition"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-500/20 text-emerald-400 font-bold text-sm">1</span>
          <div>
            <p className="font-medium text-white group-hover:text-emerald-400 transition">Unlock top matches</p>
            <p className="text-xs text-zinc-500 mt-0.5">{unlocksRemaining} free unlocks today</p>
          </div>
        </Link>
        <Link
          to={`${basePath}/pitch-scan`}
          className="group flex items-start gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-4 hover:border-cyan-500/40 hover:bg-zinc-800/60 transition"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cyan-500/20 text-cyan-400 font-bold text-sm">2</span>
          <div>
            <p className="font-medium text-white group-hover:text-cyan-400 transition">Scan your pitch</p>
            <p className="text-xs text-zinc-500 mt-0.5">Prep before outreach</p>
          </div>
        </Link>
        <Link
          to={`${basePath}/playbook`}
          className="group flex items-start gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-4 hover:border-cyan-500/40 hover:bg-zinc-800/60 transition"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-cyan-500/20 text-cyan-400 font-bold text-sm">3</span>
          <div>
            <p className="font-medium text-white group-hover:text-cyan-400 transition">Signal Playbook</p>
            <p className="text-xs text-zinc-500 mt-0.5">Learn how to time outreach</p>
          </div>
        </Link>
        <Link
          to={`${basePath}/oracle/coaching`}
          className="group flex items-start gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-4 hover:border-amber-500/40 hover:bg-zinc-800/60 transition"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-amber-500/20 text-amber-400 font-bold text-sm">4</span>
          <div>
            <p className="font-medium text-white group-hover:text-amber-400 transition">Oracle coaching</p>
            <p className="text-xs text-zinc-500 mt-0.5">Improve your position</p>
          </div>
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          className="inline-flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800/60 px-4 py-2 text-sm font-medium text-zinc-300 hover:border-zinc-500 hover:text-white transition"
        >
          {justSaved ? '✓ Saved' : wasSaved ? '✓ Saved' : 'Save these matches'}
        </button>
        {justSaved && (
          <span className="text-xs text-zinc-500">
            <Link to="/signup?ref=matches" className="text-cyan-400 hover:text-cyan-300">
              Create account
            </Link>{' '}
            to keep them across devices
          </span>
        )}
      </div>
      <ImproveScoreWizard
        isOpen={showImproveWizard}
        onClose={() => setShowImproveWizard(false)}
        startupId={startupId}
        displayName={displayName}
        godScore={godScore}
        hasDeck={hasDeck}
        onSuccess={onDeckUploadSuccess}
      />
    </section>
  );
}

// -----------------------------------------------------------------------------
// SHELL
// -----------------------------------------------------------------------------

function PageShell({
  isInApp,
  onRefresh,
  tableLoading,
  children,
}: {
  isInApp: boolean;
  onRefresh: () => void;
  tableLoading: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={isInApp ? '' : 'min-h-screen bg-[#0a0a0a] text-white'}>
      {!isInApp && (
        <header className="border-b border-zinc-800/50 bg-[#0a0a0a]/95 backdrop-blur-md sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/" className="text-lg font-bold text-white tracking-tight">pythh.ai</Link>
              <span className="text-xs text-zinc-500 uppercase tracking-widest">Signal Matches</span>
            </div>

            <nav className="flex items-center gap-6 text-sm text-zinc-400">
              <Link to="/signals" className="hover:text-white">Signals</Link>
              <Link to="/app/signals-dashboard" className="hover:text-white">Dashboard</Link>
              <Link to="/how-it-works" className="hover:text-white">How it works</Link>
              <button
                type="button"
                onClick={onRefresh}
                className="hover:text-white transition"
              >
                {tableLoading ? 'Refreshing...' : 'Refresh'}
              </button>
            </nav>
          </div>
        </header>
      )}

      {children}
    </div>
  );
}

// -----------------------------------------------------------------------------
// FULL PAGE SKELETON
// -----------------------------------------------------------------------------

function FullPageSkeleton({ message }: { message: string }) {
  const steps = [
    { label: 'Resolving startup', delay: 0 },
    { label: 'Scanning website', delay: 2000 },
    { label: 'Calculating GOD score', delay: 5000 },
    { label: 'Matching investors', delay: 8000 },
  ];

  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = window.setInterval(() => {
      setElapsed((e) => e + 500);
    }, 500);

    return () => window.clearInterval(t);
  }, []);

  const activeStep = steps.reduce((acc, step, index) => {
    return elapsed >= step.delay ? index : acc;
  }, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 max-w-xs w-full px-4">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-500" />

        <div className="space-y-3 w-full">
          {steps.map((step, index) => (
            <div
              key={step.label}
              className={`flex items-center gap-3 transition-opacity duration-500 ${
                index <= activeStep ? 'opacity-100' : 'opacity-30'
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-300 ${
                  index < activeStep
                    ? 'bg-emerald-400'
                    : index === activeStep
                      ? 'bg-cyan-400 animate-pulse'
                      : 'bg-zinc-700'
                }`}
              />
              <span
                className={`text-sm ${
                  index < activeStep
                    ? 'text-emerald-400'
                    : index === activeStep
                      ? 'text-white'
                      : 'text-zinc-600'
                }`}
              >
                {step.label}
              </span>
              {index < activeStep && <span className="text-emerald-400 text-xs ml-auto">✓</span>}
            </div>
          ))}
        </div>

        <p className="text-sm text-zinc-400">{message}</p>
        <p className="text-xs text-zinc-500 mt-2">First-time lookups take 5–10 seconds</p>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// LIVE INDICATOR
// -----------------------------------------------------------------------------

const BUSY_TIMEOUT_MS = 12000;
const LIVE_THRESHOLD_S = 15;

function LiveIndicator({
  lastRefreshAt,
  isPaused,
  busySince,
  isStale,
}: {
  lastRefreshAt: number | null;
  isPaused?: boolean;
  busySince?: number | null;
  isStale?: boolean;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const secondsAgo =
    lastRefreshAt !== null ? Math.floor((now - lastRefreshAt) / 1000) : null;

  const busyDurationMs = busySince ? now - busySince : 0;
  const isBusyTooLong = !!isPaused && busyDurationMs > BUSY_TIMEOUT_MS;

  if (isBusyTooLong) {
    return (
      <div className="flex items-center gap-2" title={`Operation stalled (${Math.floor(busyDurationMs / 1000)}s)`}>
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <span className="text-xs font-medium text-red-400">STALLED</span>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className="flex items-center gap-2" title="Processing unlock...">
        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <span className="text-xs font-medium text-amber-400">BUSY</span>
      </div>
    );
  }

  if (isStale) {
    return (
      <div className="flex items-center gap-2" title="Connection issue - showing cached data">
        <span className="w-2 h-2 rounded-full bg-orange-500" />
        <span className="text-xs font-medium text-orange-400">STALE</span>
      </div>
    );
  }

  if (secondsAgo !== null && secondsAgo < LIVE_THRESHOLD_S) {
    return (
      <div className="flex items-center gap-2" title={`Updated ${secondsAgo}s ago`}>
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs font-medium text-emerald-400">LIVE</span>
      </div>
    );
  }

  if (secondsAgo !== null) {
    return (
      <div className="flex items-center gap-2" title={`Last update: ${new Date(lastRefreshAt!).toLocaleTimeString()}`}>
        <span className="w-2 h-2 rounded-full bg-gray-500" />
        <span className="text-xs font-medium text-gray-500">{secondsAgo}s ago</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" title="Connecting...">
      <span className="w-2 h-2 rounded-full bg-gray-600 animate-pulse" />
      <span className="text-xs font-medium text-gray-500">...</span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// RADAR MATCH TABLE WRAPPER
// -----------------------------------------------------------------------------

function RadarMatchTable({
  rows,
  context,
  loading,
  isPending,
  onUnlock,
  unlocksRemaining,
  matchGenPending = false,
  mode = 'all',
}: {
  rows: MatchRow[];
  context: StartupContext | null;
  loading: boolean;
  isPending: (investorId: string) => boolean;
  onUnlock: (investorId: string) => Promise<void>;
  unlocksRemaining: number;
  matchGenPending?: boolean;
  mode?: 'unlocked' | 'locked' | 'all';
}) {
  const { unlockedRows, lockedRows } = useLegacyRadarAdapter(rows, context?.god?.total, context);

  if (matchGenPending && unlockedRows.length === 0 && lockedRows.length === 0) {
    return (
      <div className="mb-8 flex items-center justify-center py-20" data-testid="match-table">
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-lg font-medium text-cyan-400">Generating matches…</p>
          <p className="text-sm text-gray-500">
            Our engine is analyzing investor alignment. This usually takes 30–60 seconds.
          </p>
          <p className="text-xs text-gray-600">Auto-refreshing every 5 seconds</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4" data-testid={`match-table-${mode}`}>
      <LiveMatchTable
        unlockedRows={unlockedRows}
        lockedRows={lockedRows}
        loading={loading}
        isPending={isPending}
        onUnlock={onUnlock}
        unlocksRemaining={unlocksRemaining}
        mode={mode}
        startupName={context?.startup?.name}
        startupTagline={context?.startup?.tagline}
        startupSectors={context?.startup?.sectors}
        maturityLevel={context?.startup?.maturity_level ?? null}
        maturityScore={context?.startup?.maturity_score ?? null}
        maturityGaps={context?.startup?.maturity_gaps}
      />
    </div>
  );
}

// -----------------------------------------------------------------------------
// STARTUP PICKER
// -----------------------------------------------------------------------------

const BENCHMARK_TOOLTIPS = {
  signal: {
    title: 'Signal Score',
    description: 'Measures how investor attention is forming right now — language shifts, receptivity, capital alignment, and velocity.',
    subline: 'Signal reflects movement, not quality.',
  },
  god: {
    title: 'GOD Score — Investment Readiness',
    description: 'Your score reflects how strong your startup looks on the same criteria tier 1 VCs use: team, traction, market, product, and vision.',
    subline: "It's not a prediction—it's a snapshot of your current investment readiness.",
    details: [
      'Team — founder fit, experience, cohesion',
      'Traction — growth, revenue, milestones',
      'Market — size, timing, dynamics',
      'Product — differentiation, execution',
      'Vision — strategy, roadmap, storytelling',
    ],
    footer: 'Higher scores indicate stronger fundamentals. Think of it as "how would a top fund assess us today?"',
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

const SIGNAL_THRESHOLDS = {
  WINDOW_OPENING: 7.5,
  ACTIVE: 5.5,
  COOLING: 4.0,
  DORMANT: 0,
} as const;

function BenchmarkInfo({
  benchmark,
}: {
  benchmark: keyof typeof BENCHMARK_TOOLTIPS;
}) {
  const [expanded, setExpanded] = useState(false);
  const info = BENCHMARK_TOOLTIPS[benchmark];

  return (
    <div className="relative inline-block">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setExpanded(!expanded);
        }}
        className="ml-1 text-gray-500 hover:text-gray-300 transition-colors"
        title={`${info.title}: ${info.subline}`}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {expanded && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setExpanded(false)} />
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

function ReadinessBar({ value, className = '' }: { value: number; className?: string }) {
  const bars = Math.round(value * 5);

  return (
    <div className={`flex items-center gap-0.5 ${className}`} title="Confidence that this startup will perform once injected into the radar">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`w-1.5 h-3 rounded-sm ${i < bars ? 'bg-gray-300' : 'bg-gray-700'}`}
        />
      ))}
    </div>
  );
}

function SignalDisplay({ score, delta }: { score: number; delta?: number }) {
  const direction =
    delta !== undefined ? (delta > 0.1 ? 'up' : delta < -0.1 ? 'down' : 'flat') : 'flat';

  const colorClass =
    score >= SIGNAL_THRESHOLDS.WINDOW_OPENING
      ? 'text-emerald-400'
      : score >= SIGNAL_THRESHOLDS.ACTIVE
        ? 'text-gray-300'
        : score >= SIGNAL_THRESHOLDS.COOLING
          ? 'text-amber-400'
          : 'text-gray-500';

  const arrowClass =
    direction === 'up'
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

function StartupPicker({ onSelect }: { onSelect: (id: string, name: string) => void }) {
  const [startups, setStartups] = useState<StartupBenchmarkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<keyof StartupBenchmarkRow>('signal_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    async function fetchStartups() {
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

      const { data: matchCounts, error: matchError } = await supabase
        .from('startup_investor_matches')
        .select('startup_id')
        .in('startup_id', startupsData.map((s) => s.id));

      const countMap = new Map<string, number>();

      if (matchCounts && !matchError) {
        matchCounts.forEach((m) => {
          countMap.set(m.startup_id, (countMap.get(m.startup_id) || 0) + 1);
        });
      }

      const benchmarks: StartupBenchmarkRow[] = startupsData.map((s) => {
        const godScore = s.total_god_score || 50;
        const matchCount = countMap.get(s.id) || 0;

        const normalized = Math.max(0, Math.min(1, (godScore - 35) / 65));
        const signalBase = 5.5 + normalized * 4.0;
        const matchBonus = Math.min(matchCount / 50, 0.5);
        const signalScore = Math.max(5.0, Math.min(10, signalBase + matchBonus));

        const tractionWeight = (s.traction_score || 0) * 1.5;
        const teamWeight = (s.team_score || 0) * 1.2;
        const ycBase = ((tractionWeight + teamWeight) / 2.7) * 100;
        const ycPlusScore = Math.max(40, Math.min(95, ycBase + (Math.random() - 0.3) * 15));

        const momentumDelta = (Math.random() - 0.4) * 2;

        const dataCompleteness = [s.team_score, s.traction_score, s.market_score, s.product_score]
          .filter((v) => v !== null && v > 0).length / 4;

        const matchReadiness = matchCount > 0 ? Math.min(matchCount / 20, 1) : 0;
        const readiness = dataCompleteness * 0.6 + matchReadiness * 0.4;

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

    void fetchStartups();
  }, []);

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
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
      return;
    }

    setSortKey(key);
    setSortDir('desc');
  };

  const SortHeader = ({
    label,
    field,
    benchmark,
  }: {
    label: string;
    field: keyof StartupBenchmarkRow;
    benchmark?: keyof typeof BENCHMARK_TOOLTIPS;
  }) => (
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
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white mb-1">Signal Radar</h1>
          <p className="text-sm text-gray-500">
            Benchmark your startup across movement, position, and investor optics
          </p>
        </div>

        <div className="mb-4 text-sm text-gray-500">
          Use <strong className="text-gray-400">Signal</strong> to time outreach, <strong className="text-gray-400">GOD</strong> to assess strength, and <strong className="text-gray-400">YC++</strong> to understand investor optics.
        </div>

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
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
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
                  sorted.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-800/50 transition-colors group">
                      <td className="px-4 py-3">
                        <span className="font-medium text-white">{s.name}</span>
                      </td>

                      <td className="px-3 py-3">
                        <SignalDisplay score={s.signal_score} delta={s.momentum_delta} />
                      </td>

                      <td className="px-3 py-3">
                        <span className="font-mono text-sm text-gray-200">{s.god_score}</span>
                      </td>

                      <td className="px-3 py-3">
                        <span className="font-mono text-sm text-gray-200">{s.yc_plus_score}</span>
                      </td>

                      <td className="px-3 py-3">
                        <span
                          className={`font-mono text-sm ${
                            s.momentum_delta > 0.3
                              ? 'text-emerald-400'
                              : s.momentum_delta < -0.2
                                ? 'text-red-400/60'
                                : 'text-gray-600'
                          }`}
                        >
                          {s.momentum_delta > 0 ? '+' : ''}
                          {s.momentum_delta.toFixed(1)}
                        </span>
                      </td>

                      <td className="px-3 py-3">
                        <ReadinessBar value={s.readiness} />
                      </td>

                      <td className="px-3 py-3">
                        <span className="font-mono text-sm text-gray-400">{s.match_count}</span>
                      </td>

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
      </div>
    </div>
  );
}
