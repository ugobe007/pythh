/**
 * RESULTS PAGE (Phase 4: Job-Based Polling)
 * =========================================
 * Flow: / → /matches?url=...
 * 
 * Implements submit → poll → ready pattern:
 * - POST /api/discovery/submit (idempotent by URL)
 * - GET /api/discovery/results (poll until ready/failed)
 * - AbortController for cleanup on URL change
 * - requestIdRef for stale-result prevention
 */

import { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { submitUrl, fetchResults, calculatePollDelay, fetchLatestDelta, diagnosePipeline, type SignalDelta, type PipelineDiagnostic } from '../lib/discoveryAPI';
import PageShell, { ContentContainer } from '../components/layout/PageShell';
import TopBar, { TopBarBrand } from '../components/layout/TopBar';
import { PythhTokens } from '../lib/designTokens';

// Step 5+ Components
import SignalHeroFrame from '../components/results/SignalHeroFrame';
import StartupSignalCard from '../components/results/StartupSignalCard';
import MatchesHeaderRow from '../components/results/MatchesHeaderRow';
import InvestorMatchCard from '../components/results/InvestorMatchCard';
import IntroStrategyModal from "../components/results/IntroStrategyModal";
import NextActionBar from "../components/results/NextActionBar";
import ProofPanel from "../components/results/ProofPanel";
import SignalEvolutionSection from "../components/results/SignalEvolutionSection";
import type { StartupSignal, InvestorMatch } from '../types/results.types';

// ============================================================================
// Job State Machine
// ============================================================================

type RawSignalData = {
  name?: string;
  sectors?: string[] | null;
  stage?: number | null;
  signal_strength?: number | null;
  phase_score?: number | null;
  signal_band?: "low" | "med" | "high" | null;
  tier?: string | null;
};

type JobState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | {
      status: 'building';
      backendState: 'queued' | 'building' | 'scoring' | 'matching';
      progress: number;
      pollCount: number;
    }
  | {
      status: 'ready';
      jobId: string;
      startupId: string;
      matches: MatchRow[];
      signalData: RawSignalData | null;
      phase5Ready?: boolean;
    }
  | { status: 'failed'; error: string; retryable: boolean }
  | { status: 'unknown'; message: string };

// -----------------------------
// URL helpers
// -----------------------------
function normalizeUrlInput(input: string) {
  const raw = (input || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function normalizeUrlForSubmit(input: string) {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
}

function safeHostname(input: string) {
  try {
    const u = new URL(normalizeUrlInput(input));
    return u.hostname.replace(/^www\./, '');
  } catch {
    return input.replace(/^https?:\/\//i, '').replace(/^www\./, '').split('/')[0] || 'startup';
  }
}

function extractBaseDomain(hostname: string): string {
  // Extract the base domain without www and normalize
  // Examples:
  //   asidehq.com -> asidehq
  //   spatial-ai.com -> spatial-ai
  //   example.co.nz -> example
  //   example.eu -> example
  
  const parts = hostname.replace(/^www\./, '').split('.');
  
  // For most TLDs (com, org, io, ai, etc.), take the first part
  if (parts.length >= 2) {
    return parts[0];
  }
  
  return hostname;
}

function domainMatches(url1: string, url2: string): boolean {
  try {
    const host1 = new URL(normalizeUrlInput(url1)).hostname.replace(/^www\./, '').toLowerCase();
    const host2 = new URL(normalizeUrlInput(url2)).hostname.replace(/^www\./, '').toLowerCase();
    
    // Exact match
    if (host1 === host2) return true;
    
    // Base domain match (handles asidehq.com vs asidehq.co.nz)
    const base1 = extractBaseDomain(host1);
    const base2 = extractBaseDomain(host2);
    
    return base1 === base2;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -----------------------------
// Types
// -----------------------------
type MatchRow = {
  investor_id: string;
  match_score: number;
  reasoning?: any;
  status?: string;
  investors: {
    id: string;
    name: string;
    firm?: string | null;
    sectors?: string[] | string | null;
    stage?: string[] | string | null;
    check_size_min?: number | null;
    check_size_max?: number | null;
  } | null;
};

type StartupContext = {
  hostname: string;
  valueProp: string;
  industryLabel: string;
  stageLabel: string;
  raiseLabel: string;
  confidence: string;
  fomoLabel: string;
  velocityLabel: string;
  signalStrengthLabel: string;
  phaseLabel: string;
  signalChips: string[];
  // New fields for Signal Hero Frame
  signalScore: number;
  phase: number;
  matches: number;
  signalBand: "low" | "med" | "high";
  heat: "cool" | "warming" | "hot";
  tierLabel: string;
  observers7d: number;
};

// -----------------------------
// Helper to compute "why match" line from reasoning
// -----------------------------
function computeWhyLine(reasoning: any, investorName: string, startupIndustry: string): string {
  if (reasoning && typeof reasoning === 'object') {
    if (reasoning.summary) return reasoning.summary;
    if (reasoning.why_match) return reasoning.why_match;
  }
  return `Strong sector alignment in ${startupIndustry || 'Technology'}, matches investment thesis.`;
}

// Helper to compute match chips
function computeMatchChips(matchScore: number, stage: string, focus: string): string[] {
  const chips: string[] = [];
  
  if (matchScore >= 70) chips.push('Strong fit');
  else if (matchScore >= 50) chips.push('Good fit');
  
  if (stage && stage !== 'Any') chips.push(`${stage} focused`);
  
  if (focus && focus !== 'Generalist') {
    const sectors = focus.split(',').map(s => s.trim());
    if (sectors.length > 0) chips.push(`${sectors[0]} expert`);
  }
  
  if (matchScore >= 60) chips.push('Warm intro likely');
  
  return chips;
}

// Helper to format check size
function formatCheckSize(min?: number | null, max?: number | null): string {
  if (!min && !max) return 'Undisclosed';
  const fmt = (n: number) => `$${(n / 1_000).toFixed(0)}K`;
  if (!max) return `${fmt(min!)}+`;
  if (!min) return `<${fmt(max)}`;
  return `${fmt(min)}–${fmt(max)}`;
}

// Helper to pick focus sectors
function pickFocus(sectors?: string[] | string | null): string {
  const arr: string[] = Array.isArray(sectors)
    ? sectors
    : typeof sectors === 'string'
      ? sectors.split(',').map(s => s.trim()).filter(Boolean)
      : [];
  if (!arr.length) return 'Generalist';
  return arr.slice(0, 2).join(', ');
}

// Helper to pick stage
function pickStage(stage?: string[] | string | number | null): string {
  if (Array.isArray(stage)) return stage[0] || 'Any';
  if (typeof stage === 'string') return stage.split(',')[0]?.trim() || 'Any';
  if (typeof stage === 'number') {
    if (stage <= 1) return 'Pre-seed';
    if (stage === 2) return 'Seed';
    if (stage === 3) return 'Series A';
    return 'Growth';
  }
  return 'Any';
}

// -----------------------------
// Page
// -----------------------------
export default function DiscoveryResultsPage() {
  const [searchParams] = useSearchParams();
  const urlParam = searchParams.get('url') || '';

  const [jobState, setJobState] = useState<JobState>({ status: 'idle' });
  const [selectedMatch, setSelectedMatch] = useState<InvestorMatch | null>(null);
  const [introOpen, setIntroOpen] = useState(false);
  const [signalDelta, setSignalDelta] = useState<SignalDelta | null>(null);
  const [pipelineDiag, setPipelineDiag] = useState<PipelineDiagnostic | null>(null);

  // requestIdRef: Prevents stale async results from overwriting newer ones
  const requestIdRef = useRef(0);
  // Track submitted URLs to prevent duplicate submissions
  const submittedUrlsRef = useRef(new Set<string>());

  const domain = useMemo(() => safeHostname(urlParam), [urlParam]);

  // ============================================================================
  // Core submit → poll → ready flow
  // ============================================================================

  useEffect(() => {
    if (!urlParam) {
      setJobState({ status: 'idle' });
      return;
    }

    // ✅ CRITICAL: Prevent duplicate submissions of same URL
    const normalizedUrl = normalizeUrlForSubmit(urlParam);
    if (submittedUrlsRef.current.has(normalizedUrl)) {
      console.log('[DiscoveryResults] URL already submitted, skipping:', normalizedUrl);
      return;
    }
    submittedUrlsRef.current.add(normalizedUrl);

    const myReqId = ++requestIdRef.current;
    const abortController = new AbortController();

    (async () => {
      try {
        // STEP 1: Submit URL → get job_id
        setJobState({ status: 'submitting' });
        setSignalDelta(null); // Clear any stale delta from previous startup

        const submitResp = await submitUrl(normalizeUrlForSubmit(urlParam));
        if (requestIdRef.current !== myReqId) return; // Stale check

        if (!submitResp.job_id) {
          setJobState({
            status: 'failed',
            error: submitResp.message || 'No job ID returned',
            retryable: false,
          });
          return;
        }

        const jobId = submitResp.job_id;
        let pollCount = 0;

        // STEP 2: Poll /api/discovery/results until ready/failed
        while (!abortController.signal.aborted) {
          pollCount++;
          const results = await fetchResults(jobId);
          if (requestIdRef.current !== myReqId) return; // Stale check

          if (results.status === 'ready') {
            // Convert matches to frontend format
            const startupId = results.startup_id || '';
            const matchesRaw: MatchRow[] = results.matches || [];
            const signalData: RawSignalData | null = results.signal || null;

            setJobState({
              status: 'ready',
              jobId,
              startupId,
              matches: matchesRaw,
              signalData,
              phase5Ready: !!results.debug?.phase5Ready,
            });
            return;
          }

          if (results.status === 'failed') {
            setJobState({
              status: 'failed',
              error: results.error || 'Job failed',
              retryable: results.retryable || false,
            });
            return;
          }

          // building, scoring, matching states → show progress
          if (
            results.status === 'queued' ||
            results.status === 'building' ||
            results.status === 'scoring' ||
            results.status === 'matching'
          ) {
            setJobState({
              status: 'building',
              backendState: results.status,
              progress: results.progress || 0,
              pollCount,
            });
          }

          // Wait before next poll (tiered backoff)
          await sleep(calculatePollDelay(pollCount));
        }
      } catch (err: any) {
        if (requestIdRef.current !== myReqId) return; // Stale check
        setJobState({
          status: 'failed',
          error: err.message || 'Unknown error',
          retryable: true,
        });
      }
    })();

    return () => {
      abortController.abort();
      // Clear cache when URL changes to allow re-submission of new URLs
      if (urlParam) {
        const oldUrl = normalizeUrlForSubmit(urlParam);
        submittedUrlsRef.current.delete(oldUrl);
      }
    };
  }, [urlParam]); // ✅ FIX: Only re-run when URL changes, not on every status change

  // ============================================================================
  // Phase 5: Fetch signal delta when backend reports ready
  // ============================================================================

  useEffect(() => {
    if (jobState.status !== 'ready') {
      setSignalDelta(null);
      return;
    }

    if (!jobState.phase5Ready) {
      setSignalDelta(null);
      return;
    }

    if (!jobState.startupId) return;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetchLatestDelta(jobState.startupId);
        if (cancelled) return;

        if (res.status === 'ready' && res.delta) {
          setSignalDelta(res.delta);
        } else {
          setSignalDelta(null);
        }
      } catch {
        if (!cancelled) setSignalDelta(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    jobState.status,
    jobState.status === 'ready' ? jobState.phase5Ready : false,
    jobState.status === 'ready' ? jobState.startupId : null
  ]);

  // ============================================================================
  // Dev Mode: Fetch pipeline diagnostic for visibility
  // ============================================================================

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (jobState.status !== 'ready' && jobState.status !== 'building') {
      setPipelineDiag(null);
      return;
    }
    
    const startupId = jobState.status === 'ready' ? jobState.startupId : null;
    if (!startupId) return;
    
    let cancelled = false;
    
    (async () => {
      try {
        const diag = await diagnosePipeline(startupId);
        if (!cancelled) setPipelineDiag(diag);
      } catch {
        if (!cancelled) setPipelineDiag(null);
      }
    })();
    
    return () => {
      cancelled = true;
    };
  }, [jobState.status, jobState.status === 'ready' ? jobState.startupId : null]);

  // ============================================================================
  // Retry handler
  // ============================================================================

  const handleRetry = () => {
    if (!urlParam) return;
    requestIdRef.current++; // cancel any in-flight loops
    setJobState({ status: 'submitting' });
  };

  // ============================================================================
  // Modal handlers
  // ============================================================================

  const openIntro = (match: InvestorMatch) => {
    setSelectedMatch(match);
    setIntroOpen(true);
  };

  const closeIntro = () => {
    setIntroOpen(false);
    setSelectedMatch(null);
  };

  // ============================================================================
  // Convert matches to InvestorMatch format
  // ============================================================================

  // Compute StartupSignal from raw signal data
  const startupSignal = useMemo<StartupSignal | null>(() => {
    if (jobState.status !== 'ready' || !jobState.signalData) return null;
    
    const rawData = jobState.signalData;
    return {
      name: rawData.name || 'Unknown',
      industry: rawData.sectors?.[0] || 'Technology',
      stageLabel: computeStageLabel(rawData.stage || 1),
      signalScore: rawData.signal_strength || 5.0,
      signalMax: 10,
      phase: rawData.phase_score || 0.5,
      velocityLabel: 'building',
      tierLabel: rawData.tier || 'unranked',
      observers7d: 0,
      matches: jobState.matches.length,
      signalBand: rawData.signal_band || 'med',
      heat: 'warming',
    };
  }, [jobState]);

  const investorMatches = useMemo<InvestorMatch[]>(() => {
    if (jobState.status !== 'ready' || !startupSignal) return [];
    
    // CRITICAL FIX: Filter out matches where investors is null (broken FK references)
    const validMatches = jobState.matches
      .filter((m: any) => m.investors && m.investors.id)
      .slice(0, 5);

    return validMatches.map((m: any, idx: number) => {
      const inv = m.investors; // Always use m.investors (from database join)
      const focus = pickFocus(inv.sectors);
      const stage = pickStage(inv.stage);
      const check = formatCheckSize(inv.check_size_min, inv.check_size_max);
      const whyLine = computeWhyLine(m.reasoning, inv.name, startupSignal.industry);
      const chips = computeMatchChips(m.match_score || 0, stage, focus);

      return {
        id: inv.id,
        name: inv.name,
        subtitle: inv.firm || undefined,
        focus,
        stage,
        check,
        signal: m.match_score || 0,
        why: whyLine,
        chips,
        contact: undefined,
        portfolioCompanies: undefined,
      };
    });
  }, [jobState, startupSignal]);

  // ============================================================================
  // Computed values for UI
  // ============================================================================

  const matchCount = useMemo(() => {
    if (jobState.status !== 'ready') return 0;
    // Count only valid matches (non-null investors)
    return jobState.matches.filter((m: any) => m.investors && m.investors.id).length;
  }, [jobState]);

  const stageFitLabel = useMemo(() => {
    if (jobState.status !== 'ready') return 'All stages';
    const stages = jobState.matches
      .filter((m: any) => m.investors && m.investors.id)
      .slice(0, 5)
      .map((m: any) => m.investors?.stage)
      .filter(Boolean);
    return stages.length > 0 ? `${stages.length} aligned` : 'All stages';
  }, [jobState]);

  const checkFitLabel = useMemo(() => {
    if (jobState.status !== 'ready') return 'Flexible';
    const checks = jobState.matches
      .filter((m: any) => m.investors && m.investors.id)
      .slice(0, 5)
      .map((m: any) => {
        const inv = m.investors || {};
        return { min: inv.check_size_min, max: inv.check_size_max };
      })
      .filter(c => c.min || c.max);
    return checks.length > 0 ? `${checks.length} in range` : 'Flexible';
  }, [jobState]);

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <PageShell variant="standard">
      {/* Top bar */}
      <TopBar 
        leftContent={
          <div className="flex items-center gap-4">
            <TopBarBrand />
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white transition">
              <ArrowLeft className="w-4 h-4" />
              New scan
            </Link>
          </div>
        }
        rightContent={
          domain ? (
            <div className="text-xs text-white/50">
              <span className="px-2 py-1 rounded border border-white/10 bg-white/5">
                {domain}
              </span>
            </div>
          ) : undefined
        }
      />

      {/* Main */}
      <main className={PythhTokens.spacing.page}>
        <ContentContainer variant="standard">
          <h1 className={PythhTokens.text.heroSmall}>pythh signals</h1>

          <p className={`mt-4 mb-8 ${PythhTokens.text.subhead}`}>
            <span
              className="text-cyan-400 font-semibold text-3xl"
              style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.6)' }}
            >
              [{matchCount}]
            </span>{' '}
            investors aligned with your signals
          </p>

          {/* Debug panel - development only */}
          {process.env.NODE_ENV === "development" && (
            <div className="mb-6 space-y-3">
              {/* Job State Debug */}
              <details className="text-xs">
                <summary className="cursor-pointer text-white/50 hover:text-white/70 font-mono">
                  🔍 Job State Debug
                </summary>
                <pre className="mt-2 text-white/40 bg-black/30 p-3 rounded overflow-auto max-h-40 border border-white/10">
                  {JSON.stringify({ 
                    urlParam, 
                    jobState: {
                      status: jobState.status,
                      ...(jobState.status === 'ready' && { 
                        jobId: jobState.jobId,
                        matchCount: jobState.matches.length,
                        phase5Ready: jobState.phase5Ready
                      }),
                      ...(jobState.status === 'building' && {
                        backendState: jobState.backendState,
                        progress: jobState.progress,
                        pollCount: jobState.pollCount
                      }),
                      ...(jobState.status === 'failed' && {
                        error: jobState.error,
                        retryable: jobState.retryable
                      })
                    },
                    signalDelta: signalDelta ? 'present' : 'null'
                  }, null, 2)}
                </pre>
              </details>
              
              {/* Pipeline Truth Panel */}
              {pipelineDiag && (
                <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 backdrop-blur-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                    <span className="text-cyan-300 font-semibold text-sm">Pipeline Truth</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <div>
                      <span className="text-white/50">System State:</span>
                      <span className={`ml-2 font-mono font-semibold ${
                        pipelineDiag.system_state === 'ready' ? 'text-green-400' :
                        pipelineDiag.system_state === 'matching' ? 'text-yellow-400' :
                        'text-orange-400'
                      }`}>
                        {pipelineDiag.system_state}
                      </span>
                    </div>
                    <div>
                      <span className="text-white/50">Queue:</span>
                      <span className="ml-2 font-mono text-white/70">{pipelineDiag.queue_status}</span>
                    </div>
                    <div>
                      <span className="text-white/50">Matches:</span>
                      <span className="ml-2 font-mono text-cyan-300">
                        {pipelineDiag.match_count} / 1000
                      </span>
                    </div>
                    <div>
                      <span className="text-white/50">Active:</span>
                      <span className="ml-2 font-mono text-white/70">{pipelineDiag.active_match_count}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-white/50">Diagnosis:</span>
                      <span className="ml-2 text-white/70">{pipelineDiag.diagnosis}</span>
                    </div>
                    {pipelineDiag.last_error && (
                      <div className="col-span-2 text-rose-300">
                        <span className="text-white/50">Error:</span>
                        <span className="ml-2">{pipelineDiag.last_error}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ============================= */}
          {/* STATE: submitting */}
          {/* ============================= */}
          {jobState.status === 'submitting' && (
            <div className="mb-8 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 backdrop-blur-md p-5">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-cyan-300 text-sm font-medium">Submitting...</span>
              </div>
            </div>
          )}

          {/* ============================= */}
          {/* STATE: building */}
          {/* ============================= */}
          {jobState.status === 'building' && (
            <div className="mb-8 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 backdrop-blur-md p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
                <span className="text-cyan-300 text-sm font-medium">
                  {jobState.backendState === 'scoring'
                    ? 'Scoring startup…'
                    : jobState.backendState === 'matching'
                    ? 'Matching investors…'
                    : 'Reading signals…'} {jobState.progress}%
                </span>
                <span className="text-white/50 text-xs">
                  (attempt {jobState.pollCount})
                </span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-orange-500 transition-all duration-500"
                  style={{ width: `${jobState.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* ============================= */}
          {/* STATE: failed */}
          {/* ============================= */}
          {jobState.status === 'failed' && (
            <div className="mb-8 rounded-2xl border border-rose-500/30 bg-rose-500/5 backdrop-blur-md p-5">
              <div className="text-rose-300 text-sm font-medium mb-2">Error</div>
              <div className="text-white/70 text-sm mb-4">{jobState.error}</div>
              {jobState.retryable && (
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 rounded-lg text-sm transition"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* ============================= */}
          {/* STATE: idle (no URL) */}
          {/* ============================= */}
          {jobState.status === 'idle' && !urlParam && (
            <div className="relative group">
              {/* Animated glow */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-orange-500/20 via-cyan-500/20 to-violet-500/20 rounded-2xl blur-xl animate-pulse"
                style={{ animationDuration: '3s' }}
              />

              <div className="relative bg-gradient-to-br from-[#0f0f0f] via-[#131313] to-[#0f0f0f] border-2 border-orange-500/40 rounded-2xl p-12 text-center overflow-hidden">
                    {/* Scanning lines */}
                    <div className="absolute inset-0 opacity-20">
                      {[0, 1, 2, 3].map((i) => (
                        <div 
                          key={i}
                          className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-400 to-transparent"
                          style={{
                            top: `${25 * i}%`,
                            animation: 'fadeInOut 2s ease-in-out infinite',
                            animationDelay: `${i * 0.5}s`
                          }}
                        />
                      ))}
                    </div>
                    
                    {/* Content */}
                    <div className="relative">
                      {/* Icon */}
                      <div className="relative w-32 h-32 mx-auto mb-6">
                        {/* Spinning rings */}
                        <div className="absolute inset-0 rounded-full border-2 border-orange-500/40 border-t-orange-400 animate-spin" style={{ animationDuration: '2s' }} />
                        <div className="absolute inset-4 rounded-full border border-cyan-500/30 border-b-cyan-400 animate-spin" style={{ animationDuration: '3s', animationDirection: 'reverse' }} />
                        
                        {/* Center */}
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-6xl animate-pulse">🎯</div>
                        </div>
                      </div>
                      
                      <h2 className="text-3xl font-bold text-white mb-4">
                        Ready to find <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-cyan-400">your investors</span>?
                      </h2>
                      
                      <p className="text-lg text-white/70 mb-8 max-w-xl mx-auto">
                        Submit your startup URL and watch the GOD Algorithm analyze 47,000+ investors in real-time.
                      </p>
                      
                      <Link
                        to="/"
                        className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-black font-bold rounded-xl transition-all shadow-lg shadow-orange-500/30 hover:shadow-orange-500/50 hover:scale-105 active:scale-95"
                      >
                        <span>Start Matching</span>
                        <span className="text-xl">→</span>
                      </Link>
                    </div>
                  </div>
                </div>
            )}

            <style>{`
              @keyframes fadeInOut {
                0%, 100% { opacity: 0; }
                50% { opacity: 1; }
              }
            `}</style>

            {/* ============================= */}
            {/* STATE: ready - SHOW RESULTS */}
            {/* ============================= */}
            {jobState.status === 'ready' && startupSignal && (
              <>
                {/* Signal Hero Frame */}
                <SignalHeroFrame>
                  <StartupSignalCard s={startupSignal} />
                </SignalHeroFrame>

                {/* SECTION 3: Signal Evolution (Phase 5) */}
                {jobState.phase5Ready && signalDelta && (
                  <SignalEvolutionSection delta={signalDelta} />
                )}

                {/* Matches Header Row */}
                {investorMatches.length > 0 && (
                  <MatchesHeaderRow
                    industry={startupSignal.industry}
                    stageFit={stageFitLabel}
                    checkFit={checkFitLabel}
                    matches={matchCount}
                  />
                )}

                {/* Top 5 Investor Cards */}
                {investorMatches.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {investorMatches.map((m, i) => (
                      <InvestorMatchCard
                        key={m.id}
                        rank={i + 1}
                        m={m}
                        featured={i === 0}
                        startupSignal={startupSignal}
                        onDraftIntro={() => openIntro(m)}
                      />
                    ))}
                  </div>
                )}

                {/* Next Action Bar */}
                {investorMatches.length > 0 && (
                  <NextActionBar
                    top={investorMatches[0] || null}
                    startup={startupSignal}
                    onPrimary={() => investorMatches[0] && openIntro(investorMatches[0])}
                    onSecondary={() => {
                      console.log('Export matches', investorMatches);
                      alert('Export functionality coming soon!');
                    }}
                    onTertiary={() => {
                      console.log('Refine signal');
                      alert('Signal refinement tools coming soon!');
                    }}
                  />
                )}

                {/* Proof Panel */}
                {investorMatches.length > 0 && (
                  <ProofPanel
                    signalsObserved={[
                      'Market size narrative present',
                      'Recent product milestones detected',
                      'Customer traction signals',
                      'Team credibility signals',
                      'Competitive positioning clear',
                      'Growth trajectory visible',
                      'Technology differentiation noted',
                      'Business model validated',
                    ]}
                    evidenceSources={[
                      'Company website',
                      'Public announcements / blog',
                      'Founder LinkedIn profiles',
                      'Press coverage / podcasts',
                      'Product documentation',
                      'Social media activity',
                      'Industry mentions',
                      'Third-party reviews',
                    ]}
                    lastUpdated={new Date().toLocaleDateString()}
                    confidence="med"
                  />
                )}
              </>
            )}

            {/* Intro Strategy Modal */}
            {selectedMatch && jobState.status === 'ready' && startupSignal && (
              <IntroStrategyModal
                open={introOpen}
                onClose={closeIntro}
                match={selectedMatch}
                startup={startupSignal}
                toolkitHref="/toolkit"
              />
            )}
          </ContentContainer>
        </main>
      </PageShell>
    );
  }

  // ============================================================================
  // Helper Functions (Phase/Tier Computation)
  // ============================================================================

  function computeStageLabel(stage: number): string {
    if (stage <= 1) return 'Pre-seed';
    if (stage === 2) return 'Seed';
    if (stage === 3) return 'Series A';
    return 'Growth';
  }

