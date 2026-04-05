/**
 * PYTHH INVESTOR PROFILE — LIFEFORM (CANONICAL)
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * Investor profiles answer ONE question:
 * "How does this investor behave over time, and when do they engage?"
 * 
 * They are NOT:
 * - resumes
 * - logos + portfolio porn
 * - contact cards
 * - promises of access
 * 
 * If a founder leaves thinking "I should email them", the page failed.
 * If they leave thinking "I should watch them", it worked.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import SaveToSignalCard from '../components/SaveToSignalCard';
import ShareButton from '../components/ShareButton';
import { supabase } from '../lib/supabase';
import { withErrorMonitoring } from '../lib/dbErrorMonitor';
import { useAuth } from '../contexts/AuthContext';
import { useOracleStartupId } from '../hooks/useOracleStartupId';
import { isUuidString } from '../lib/isUuid';
import { apiUrl } from '../lib/apiConfig';
import { PYTHH_MARKETING_BG } from '../lib/pythhMarketingTheme';
import { Briefcase, TrendingUp, Clock, Award, Users, Target, Zap, ChevronLeft } from 'lucide-react';

/** Stroke-only surfaces — cyan accent, no fill (pythh public UI) */
const cardStroke = 'rounded-lg border border-cyan-500/35 bg-transparent';
const chipOutline =
  'inline-flex items-center rounded-md border border-cyan-500/35 bg-transparent px-2.5 py-1 text-xs text-cyan-300/90 hover:border-cyan-400/50 hover:text-cyan-200 transition-colors';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

type AlignmentState = 'Monitoring' | 'Warming' | 'Cooling' | 'Dormant';

interface InvestorData {
  name: string;
  focus: string;
  stage: string;
  observedSince: string;
  // Behavioral Summary (3 bullets max)
  behavioralPattern: string[];
  // Recent Behavior (≤30 days)
  recentBehavior: string[];
  // Alignment & Timing
  alignmentState: AlignmentState;
  lensScore: number;
  timing: 'Cooling' | 'Warming' | 'Active' | 'Dormant';
  // Competitive Context
  relativeBehavior: string[];
  // Signals they respond to
  signalsTheyRespondTo: string[];
  // Quiet guidance
  quietGuidance: string;
  // Enhanced data
  portfolioCompanies?: string[];
  notableInvestments?: any[];
  investmentThesis?: string;
  bio?: string;
  totalInvestments?: number;
  successfulExits?: number;
  investmentPace?: number;
  checkSizeMin?: number;
  checkSizeMax?: number;
  lastInvestmentDate?: string;
  leadsRounds?: boolean;
  decisionMaker?: boolean;
  preferredIntroMethod?: string;
  avgResponseTime?: number;
  firm?: string;
  title?: string;
  // Match data (if founder logged in)
  matchScore?: number;
  matchReasons?: string[];
}

// Helper function to clean investor name - removes artifacts like "AdministratorOperations"
function cleanInvestorName(name: string): string {
  if (!name) return name;
  
  // Remove "AdministratorOperations" prefix (case-insensitive)
  let cleaned = name.replace(/^AdministratorOperations/i, '');
  
  // Handle format: "Name (Firm)" -> "Name @ Firm"
  // Also handle: "Name(Firm)" -> "Name @ Firm"
  cleaned = cleaned.replace(/\s*\(([^)]+)\)$/, ' @ $1');
  
  // Clean up any double spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
}

// Helper function to transform database investor to display format
function transformInvestorData(dbInvestor: any, matchData?: { score: number; reasons: string[] }): InvestorData {
  const sectors = dbInvestor.sectors || [];
  const stages = dbInvestor.stage || [];
  
  // Clean the investor name
  const cleanedName = cleanInvestorName(dbInvestor.name || 'Unknown Investor');
  
  // Parse notable investments (can be array of strings or objects)
  let notableInvestments: any[] = [];
  if (dbInvestor.notable_investments) {
    if (Array.isArray(dbInvestor.notable_investments)) {
      notableInvestments = dbInvestor.notable_investments;
    } else if (typeof dbInvestor.notable_investments === 'string') {
      try {
        notableInvestments = JSON.parse(dbInvestor.notable_investments);
      } catch {
        notableInvestments = [];
      }
    }
  }
  
  return {
    name: cleanedName,
    focus: sectors.length > 0 ? sectors.join(', ') : 'Not specified',
    stage: stages.length > 0 ? stages.join(' → ') : 'Not specified',
    observedSince: dbInvestor.created_at 
      ? new Date(dbInvestor.created_at).getFullYear().toString()
      : '—',
    behavioralPattern: [
      dbInvestor.leads_rounds 
        ? 'Typically leads investment rounds'
        : 'Often participates in rounds',
      dbInvestor.decision_maker
        ? 'Decision maker at firm'
        : 'Part of investment committee',
      dbInvestor.check_size_min && dbInvestor.check_size_max
        ? `Check size: $${(dbInvestor.check_size_min / 1000).toFixed(0)}K - $${(dbInvestor.check_size_max / 1000).toFixed(0)}K`
        : 'Check size: Not specified',
    ],
    recentBehavior: [
      dbInvestor.last_investment_date
        ? `Last investment: ${new Date(dbInvestor.last_investment_date).toLocaleDateString()}`
        : 'Investment history being tracked',
      dbInvestor.investment_pace_per_year
        ? `Investment pace: ~${dbInvestor.investment_pace_per_year} deals per year`
        : 'Investment activity being monitored',
      dbInvestor.total_investments
        ? `Total investments: ${dbInvestor.total_investments}`
        : 'Portfolio data being collected',
    ],
    alignmentState: 'Monitoring',
    lensScore: dbInvestor.investor_score || 0,
    timing: dbInvestor.last_investment_date
      ? (Date.now() - new Date(dbInvestor.last_investment_date).getTime() < 90 * 24 * 60 * 60 * 1000 ? 'Active' : 'Warming')
      : 'Dormant',
    relativeBehavior: [
      dbInvestor.firm ? `Firm: ${dbInvestor.firm}` : '',
      dbInvestor.investor_tier ? `Tier: ${dbInvestor.investor_tier}` : '',
    ].filter(Boolean),
    signalsTheyRespondTo: [
      // Show actual market signals: sectors and stages (NOT geography, NOT behavioral patterns)
      ...(sectors.length > 0 ? sectors.slice(0, 5) : []),
      ...(stages.length > 0 ? stages.slice(0, 3) : []),
    ],
    quietGuidance: dbInvestor.bio 
      ? dbInvestor.bio.substring(0, 150) + (dbInvestor.bio.length > 150 ? '...' : '')
      : 'Profile data is being enriched. Check back soon for detailed insights.',
    // Enhanced data
    portfolioCompanies: dbInvestor.portfolio_companies || [],
    notableInvestments,
    investmentThesis: dbInvestor.investment_thesis || null,
    bio: dbInvestor.bio || null,
    totalInvestments: dbInvestor.total_investments || null,
    successfulExits: dbInvestor.successful_exits || null,
    investmentPace: dbInvestor.investment_pace_per_year || null,
    checkSizeMin: dbInvestor.check_size_min || null,
    checkSizeMax: dbInvestor.check_size_max || null,
    lastInvestmentDate: dbInvestor.last_investment_date || null,
    leadsRounds: dbInvestor.leads_rounds || false,
    decisionMaker: dbInvestor.decision_maker || false,
    preferredIntroMethod: dbInvestor.preferred_intro_method || null,
    avgResponseTime: dbInvestor.avg_response_time_days || null,
    firm: dbInvestor.firm || null,
    title: dbInvestor.title || null,
    // Match data
    matchScore: matchData?.score,
    matchReasons: matchData?.reasons || [],
  };
}

// Default for loading/error states
const defaultInvestor: InvestorData = {
  name: 'Loading...',
  focus: 'Loading...',
  stage: 'Loading...',
  observedSince: '—',
  behavioralPattern: ['Loading investor data...'],
  recentBehavior: ['Loading recent activity...'],
  alignmentState: 'Dormant',
  lensScore: 0,
  timing: 'Dormant',
  relativeBehavior: [],
  signalsTheyRespondTo: [],
  quietGuidance: 'Loading...',
};

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════

type PreviewMatchPayload = {
  match_score: number;
  why_you_match: string | null;
  reasoning: string | null;
  fit_analysis: unknown;
};

export default function InvestorProfile() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user, isLoggedIn } = useAuth();
  const startupId = useOracleStartupId();
  const [investor, setInvestor] = useState<InvestorData>(defaultInvestor);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [previewMatch, setPreviewMatch] = useState<PreviewMatchPayload | null>(null);

  const startupFromQuery = searchParams.get('startup');
  const readinessReportBackUrl =
    isUuidString(startupFromQuery) ? `/submit?startup=${encodeURIComponent(startupFromQuery)}` : null;

  /**
   * Return founders to the same surface as “Save this report” — /submit readiness UI — not the full
   * /signal-matches live dashboard (different layout; avoids confusion after viewing an investor).
   */
  const backFromProfileUrl = (() => {
    const sid =
      isUuidString(startupFromQuery ?? '')
        ? startupFromQuery!
        : isLoggedIn && startupId && isUuidString(startupId)
          ? startupId
          : null;
    return sid ? `/submit?startup=${encodeURIComponent(sid)}` : '/signal-matches';
  })();
  const backFromProfileLabel =
    backFromProfileUrl.startsWith('/submit') ? '← Back to your readiness report' : '← Back to matches';

  // Check if founder is logged in and has a startup
  const startupClaimed = isLoggedIn && !!startupId;

  // Load investor data from database
  useEffect(() => {
    async function loadInvestor() {
      if (!id) {
        setLoading(false);
        return;
      }

      if (!isUuidString(id)) {
        setInvestor({
          ...defaultInvestor,
          name: 'Invalid link',
          quietGuidance: 'This URL does not look like a valid investor profile. Use a link from search or lookup.',
        });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        
        // Load investor data
        const { data: dbInvestor, error } = await withErrorMonitoring(
          'InvestorProfile',
          'fetch_investor',
          () => supabase
            .from('investors')
            .select('id, name, firm, title, sectors, stage, geography_focus, check_size_min, check_size_max, investment_thesis, bio, total_investments, successful_exits, investor_tier, investor_score, score_signals, leads_rounds, portfolio_companies, notable_investments, investment_pace_per_year, last_investment_date, decision_maker, preferred_intro_method, avg_response_time_days, created_at')
            .eq('id', id)
            .single(),
          { investorId: id }
        );

        if (error) {
          console.error('[InvestorProfile] Error loading investor:', error);
          setInvestor({
            ...defaultInvestor,
            name: 'Investor Not Found',
            quietGuidance: 'This investor profile could not be loaded. Please check the URL or try again later.',
          });
          setLoading(false);
          return;
        }

        if (!dbInvestor) {
          setLoading(false);
          return;
        }

        // Load match data if founder is logged in (startup_id must be a UUID or PostgREST returns 400)
        let matchData: { score: number; reasons: string[] } | undefined;
        if (startupId && isLoggedIn && isUuidString(startupId)) {
          try {
            const { data: match } = await supabase
              .from('startup_investor_matches')
              .select('match_score, reasoning, why_you_match')
              .eq('startup_id', startupId)
              .eq('investor_id', id)
              .single();
            
            if (match) {
              matchData = {
                score: Math.round(match.match_score || 0),
                reasons: [
                  match.reasoning || '',
                  match.why_you_match || '',
                ].filter(Boolean).slice(0, 3),
              };
            }
          } catch (matchErr) {
            // Match not found or error - that's okay, continue without match data
            console.log('[InvestorProfile] No match data available');
          }
        }

        setInvestor(transformInvestorData(dbInvestor, matchData));
      } catch (err) {
        console.error('[InvestorProfile] Load error:', err);
        setInvestor({
          ...defaultInvestor,
          name: 'Error Loading Profile',
          quietGuidance: 'An error occurred while loading this investor profile. Please try again later.',
        });
      } finally {
        setLoading(false);
      }
    }

    loadInvestor();
  }, [id, startupId, isLoggedIn]);

  // Public report deep-link: /investor/:id?startup=UUID — oracle match copy without login
  useEffect(() => {
    if (!id || !isUuidString(id)) {
      setPreviewMatch(null);
      return;
    }
    const sid = searchParams.get('startup');
    if (!sid || !isUuidString(sid)) {
      setPreviewMatch(null);
      return;
    }
    if (isLoggedIn) {
      setPreviewMatch(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/preview/${sid}/investor/${id}`));
        if (!res.ok) {
          if (!cancelled) setPreviewMatch(null);
          return;
        }
        const data = (await res.json()) as PreviewMatchPayload;
        if (!cancelled) setPreviewMatch(data);
      } catch {
        if (!cancelled) setPreviewMatch(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, searchParams, isLoggedIn]);

  // Lifeform breathing
  useEffect(() => {
    const interval = setInterval(() => {
      setIsUpdating(true);
      setTimeout(() => setIsUpdating(false), 1200);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Style helpers with Pythh colors
  const alignmentColor = (state: AlignmentState): string => {
    switch (state) {
      case 'Warming':
        return 'text-cyan-300';
      case 'Monitoring':
        return 'text-cyan-400/90';
      case 'Cooling':
        return 'text-amber-400/90';
      case 'Dormant':
        return 'text-zinc-500';
    }
  };

  const timingColor = (t: string): string => {
    if (t === 'Active') return 'text-cyan-300';
    if (t === 'Warming') return 'text-cyan-400/90';
    if (t === 'Cooling') return 'text-amber-400/90';
    return 'text-zinc-500';
  };

  // Score click → Score Drawer (lens locked)
  const handleScoreClick = () => {
    console.log('Open score drawer for', investor.name);
  };

  return (
    <div
      className="min-h-screen text-zinc-200"
      style={{ fontFamily: 'Inter, system-ui, sans-serif', ...PYTHH_MARKETING_BG }}
    >
      
      {/* Lifeform animations */}
      <style>{`
        @keyframes profileFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes updateFade {
          0%, 100% { opacity: 0; }
          20%, 80% { opacity: 1; }
        }
      `}</style>

      {/* ═══════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════ */}
      <header className="border-b border-cyan-500/15">
        <div className="max-w-3xl mx-auto px-6 py-4">
          {readinessReportBackUrl && (
            <div className="mb-3">
              <Link
                to={readinessReportBackUrl}
                className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-transparent px-3 py-1.5 text-sm font-medium text-cyan-400/95 hover:border-cyan-400/60 hover:text-cyan-300 transition-colors"
              >
                <ChevronLeft className="w-4 h-4 shrink-0" aria-hidden />
                Back to your investor readiness report
              </Link>
            </div>
          )}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 text-sm">
              <Link to="/" className="text-white font-medium shrink-0">
                pythh
              </Link>
              <span className="text-[#5f5f5f] shrink-0">/</span>
              {readinessReportBackUrl ? (
                <Link
                  to={readinessReportBackUrl}
                  className="text-[#8f8f8f] hover:text-white transition-colors truncate"
                >
                  Your report
                </Link>
              ) : (
                <Link to="/platform" className="text-[#8f8f8f] hover:text-white transition-colors">
                  Platform
                </Link>
              )}
              <span className="text-[#5f5f5f] shrink-0">/</span>
              <span className="text-[#8f8f8f] truncate" title={id}>
                Investor
              </span>
            </div>
            <span className="text-xs text-[#5f5f5f] shrink-0">
              {isUpdating ? (
                <span style={{ animation: 'updateFade 1.2s ease-in-out' }}>updating…</span>
              ) : (
                'Live'
              )}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        
        {/* ═══════════════════════════════════════════════════════════════
            1️⃣ IDENTITY STRIP — Minimal, human + Save/Share
        ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-10">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className={`min-w-0 flex-1 px-4 py-3 ${cardStroke}`}>
              <h1 className="text-lg sm:text-xl text-cyan-300 font-medium leading-snug break-words">
                {investor.name}
              </h1>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <SaveToSignalCard
                entityType="investor"
                entityId={id || ''}
                entityName={investor.name}
                scoreValue={investor.lensScore}
                context="from profile header"
                size="sm"
                buttonClassName="!bg-transparent border border-cyan-500/40 text-cyan-400/90 hover:!bg-transparent hover:text-cyan-300 focus:ring-cyan-500/40 aria-pressed:!bg-transparent aria-pressed:text-cyan-200 aria-pressed:border-cyan-500/55 aria-pressed:hover:text-cyan-100"
              />
              <ShareButton
                payload={{
                  type: 'investor_brief',
                  investorName: investor.name,
                  behavioralPattern: investor.behavioralPattern,
                  timing: investor.timing,
                  signalsTheyRespondTo: investor.signalsTheyRespondTo,
                }}
                expandable
                linkPayload={{
                  share_type: 'investor_brief',
                  investor_id: id,
                  investor_name: investor.name,
                  timing_state: investor.timing || 'stable',
                  behavioral_pattern: investor.behavioralPattern?.slice(0, 3) || [],
                  signals_respond_to: investor.signalsTheyRespondTo?.slice(0, 5) || [],
                  recent_behavior: investor.recentBehavior?.slice(0, 3) || [],
                  competitive_context: investor.relativeBehavior?.slice(0, 2) || [],
                  snapshot: {
                    investor_name: investor.name,
                    focus: investor.focus,
                    stage: investor.stage,
                    timing_state: investor.timing || 'stable',
                    behavioral_pattern: investor.behavioralPattern?.slice(0, 3) || [],
                    signals_respond_to: investor.signalsTheyRespondTo?.slice(0, 5) || [],
                    recent_behavior: investor.recentBehavior?.slice(0, 3) || [],
                    competitive_context: investor.relativeBehavior?.slice(0, 2) || [],
                  },
                  redaction_level: 'public',
                }}
                size="sm"
                className="rounded-md border border-cyan-500/40 bg-transparent px-2.5 py-1.5 text-cyan-400/90 hover:border-cyan-400/55 hover:text-cyan-300 hover:!bg-transparent"
              />
            </div>
          </div>
          <p className="text-sm leading-relaxed text-zinc-300">
            <span className="text-cyan-400/90 font-medium">Focus</span>{' '}
            <span>{investor.focus}</span>
            <span className="text-zinc-600 mx-2">·</span>
            <span className="text-cyan-400/90 font-medium">Stage</span>{' '}
            <span>{investor.stage}</span>
            <span className="text-zinc-600 mx-2">·</span>
            <span className="text-zinc-500 text-xs">Observed since {investor.observedSince}</span>
          </p>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            🎯 SIGNALS THIS INVESTOR RESPONDS TO — Top priority for founders
        ═══════════════════════════════════════════════════════════════ */}
        {investor.signalsTheyRespondTo.length > 0 && (
          <section className={`mb-10 p-4 ${cardStroke}`}>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Zap className="w-4 h-4 shrink-0 text-cyan-400/90" aria-hidden />
                <div className="text-cyan-400 text-sm font-medium">Signals this investor responds to</div>
              </div>
              <div className="flex items-baseline gap-1.5 shrink-0">
                <span className="text-2xl font-bold text-cyan-300 tabular-nums">
                  {investor.lensScore.toFixed(1)}
                </span>
                <span className="text-xs text-zinc-500">/ 10</span>
              </div>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {investor.signalsTheyRespondTo.map((signal, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-zinc-600"> · </span>}
                  <span>{signal}</span>
                </span>
              ))}
            </p>
            <div className="mt-3 pt-3 border-t border-cyan-500/20">
              <p className="text-xs text-cyan-400/65 italic">
                Signal score reflects investor quality and responsiveness. Higher scores indicate stronger signal alignment.
              </p>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            2️⃣ BEHAVIORAL SUMMARY — This is the soul (3 bullets max)
        ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-10">
          <div className="text-cyan-400 text-sm mb-2 font-medium">Behavioral pattern</div>
          <p className="text-sm text-zinc-300 leading-relaxed">
            {investor.behavioralPattern.map((pattern, i) => (
              <span key={i}>
                {i > 0 && <span className="text-zinc-600"> · </span>}
                <span>{pattern}</span>
              </span>
            ))}
          </p>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            3️⃣ RECENT BEHAVIOR — Lifeform core (≤30 days)
        ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-10">
          <div className="text-cyan-400 text-sm mb-2 font-medium">Recent behavior</div>
          <p
            className="text-sm text-zinc-300 leading-relaxed"
            style={{ animation: 'profileFadeIn 0.25s ease-out both' }}
          >
            {investor.recentBehavior.map((item, i) => (
              <span key={i}>
                {i > 0 && <span className="text-zinc-600"> · </span>}
                <span>{item}</span>
              </span>
            ))}
          </p>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            4️⃣ MATCH QUALITY — logged-in founders, or ?startup= from readiness report (preview API)
        ═══════════════════════════════════════════════════════════════ */}
        {!loading && previewMatch && !isLoggedIn && (
          <section className={`mb-10 p-5 ${cardStroke}`}>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-cyan-400/90" />
              <div className="text-cyan-400 text-sm font-medium">How this investor fits your startup</div>
            </div>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-3xl font-bold text-cyan-300 tabular-nums">
                {Math.round(previewMatch.match_score ?? 0)}
              </span>
              <span className="text-sm text-zinc-500">/ 100</span>
            </div>
            <div className="space-y-2 mt-3">
              {[previewMatch.reasoning, previewMatch.why_you_match]
                .filter((r): r is string => typeof r === 'string' && r.trim().length > 0)
                .map((reason, i) => (
                  <p key={i} className="text-sm text-zinc-300 leading-relaxed">
                    {reason}
                  </p>
                ))}
            </div>
            <p className="text-[11px] text-zinc-500 mt-4 leading-snug">
              From your pythh match engine — explore the full investor profile below.
            </p>
          </section>
        )}

        {startupClaimed && investor.matchScore !== undefined && (
          <section className={`mb-10 p-5 ${cardStroke}`}>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-cyan-400/90" />
              <div className="text-cyan-400 text-sm font-medium">Your match quality</div>
            </div>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-3xl font-bold text-cyan-300 tabular-nums">{investor.matchScore}</span>
              <span className="text-sm text-zinc-500">/ 100</span>
            </div>
            {investor.matchReasons && investor.matchReasons.length > 0 && (
              <div className="space-y-1.5 mt-3">
                {investor.matchReasons.map((reason, i) => (
                  <p key={i} className="text-sm text-zinc-300 leading-relaxed">
                    {reason}
                  </p>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            5️⃣ ALIGNMENT & TIMING — This is discipline
        ═══════════════════════════════════════════════════════════════ */}
        <section className={`mb-10 p-5 ${cardStroke}`}>
          {startupClaimed ? (
            <>
              <div className="text-cyan-400 text-sm mb-4 font-medium">Your alignment</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-sm">
                <div>
                  <span className="text-cyan-400/70 block mb-1 text-xs">Current state</span>
                  <span className={`${alignmentColor(investor.alignmentState)} font-medium`}>
                    {investor.alignmentState}
                  </span>
                </div>
                <div>
                  <span className="text-cyan-400/70 block mb-1 text-xs">Lens score</span>
                  <span
                    className="text-cyan-300 font-mono cursor-pointer hover:text-cyan-200 transition-colors font-semibold tabular-nums"
                    onClick={handleScoreClick}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleScoreClick();
                    }}
                  >
                    {investor.lensScore} <span className="text-zinc-500 text-xs font-sans">(GOD)</span>
                  </span>
                </div>
                <div>
                  <span className="text-cyan-400/70 block mb-1 text-xs">Timing</span>
                  <span className={`${timingColor(investor.timing)} font-medium`}>{investor.timing}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-zinc-400 text-sm">
              <Link
                to="/signup/founder"
                className="text-cyan-400/95 border-b border-dotted border-cyan-500/50 hover:border-cyan-400/70 hover:text-cyan-300 transition-colors"
              >
                Claim your startup
              </Link>{' '}
              to see alignment and timing.
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            6️⃣ KEY METRICS — Investment activity
        ═══════════════════════════════════════════════════════════════ */}
        {(investor.totalInvestments || investor.successfulExits || investor.investmentPace) && (
          <section className="mb-10 grid grid-cols-3 gap-4">
            {investor.totalInvestments && (
              <div className={`p-4 ${cardStroke}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="w-4 h-4 text-cyan-400/90" />
                  <span className="text-cyan-400/70 text-xs">Total Investments</span>
                </div>
                <div className="text-2xl font-bold text-cyan-300 tabular-nums">{investor.totalInvestments}</div>
              </div>
            )}
            {investor.successfulExits && (
              <div className={`p-4 ${cardStroke}`}>
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-cyan-400/90" />
                  <span className="text-cyan-400/70 text-xs">Successful Exits</span>
                </div>
                <div className="text-2xl font-bold text-cyan-300 tabular-nums">{investor.successfulExits}</div>
              </div>
            )}
            {investor.investmentPace && (
              <div className={`p-4 ${cardStroke}`}>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400/90" />
                  <span className="text-cyan-400/70 text-xs">Deals/Year</span>
                </div>
                <div className="text-2xl font-bold text-cyan-300 tabular-nums">~{investor.investmentPace}</div>
              </div>
            )}
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            7️⃣ PORTFOLIO COMPANIES — Visual showcase
        ═══════════════════════════════════════════════════════════════ */}
        {investor.portfolioCompanies && investor.portfolioCompanies.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Briefcase className="w-4 h-4 text-cyan-400" />
              <div className="text-cyan-400 text-sm font-medium">Portfolio Companies</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {investor.portfolioCompanies.slice(0, 12).map((company, i) => (
                <span key={i} className={`${chipOutline} text-sm`}>
                  {company}
                </span>
              ))}
              {investor.portfolioCompanies.length > 12 && (
                <span className={`${chipOutline} text-sm text-zinc-400`}>
                  +{investor.portfolioCompanies.length - 12} more
                </span>
              )}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            8️⃣ NOTABLE INVESTMENTS — Highlight reel
        ═══════════════════════════════════════════════════════════════ */}
        {investor.notableInvestments && investor.notableInvestments.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Award className="w-4 h-4 text-cyan-400" />
              <div className="text-cyan-400 text-sm font-medium">Notable Investments</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {investor.notableInvestments.slice(0, 8).map((inv: any, i: number) => {
                const name = typeof inv === 'string' ? inv : (inv.name || inv.company || String(inv));
                return (
                  <span key={i} className={`${chipOutline} text-sm font-medium`}>
                    {name}
                  </span>
                );
              })}
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            9️⃣ INVESTMENT THESIS — Full text
        ═══════════════════════════════════════════════════════════════ */}
        {investor.investmentThesis && (
          <section className={`mb-10 p-5 ${cardStroke}`}>
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-cyan-400/90" />
              <div className="text-cyan-400 text-sm font-medium">Investment Thesis</div>
            </div>
            <p className="text-zinc-300 text-sm leading-relaxed">{investor.investmentThesis}</p>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            🔟 WARM INTRO GUIDANCE — How to reach them
        ═══════════════════════════════════════════════════════════════ */}
        {investor.preferredIntroMethod && (
          <section className={`mb-10 p-5 ${cardStroke}`}>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-cyan-400/90" />
              <div className="text-cyan-400 text-sm font-medium">Preferred Introduction Method</div>
            </div>
            <p className="text-zinc-300 text-sm leading-relaxed">{investor.preferredIntroMethod}</p>
            {investor.avgResponseTime && (
              <p className="text-cyan-400/65 text-xs mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3 shrink-0" aria-hidden />
                Average response time: {investor.avgResponseTime} days
              </p>
            )}
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            1️⃣1️⃣ COMPETITIVE CONTEXT — Relative, not flattering
        ═══════════════════════════════════════════════════════════════ */}
        {investor.relativeBehavior.length > 0 && (
          <section className="mb-10">
            <div className="text-cyan-400 text-sm mb-2 font-medium">Relative behavior</div>
            <p className="text-sm text-zinc-300 leading-relaxed">
              {investor.relativeBehavior.map((item, i) => (
                <span key={i}>
                  {i > 0 && <span className="text-zinc-600"> · </span>}
                  <span>{item}</span>
                </span>
              ))}
            </p>
          </section>
        )}


        {/* ═══════════════════════════════════════════════════════════════
            1️⃣3️⃣ FULL BIO — If available
        ═══════════════════════════════════════════════════════════════ */}
        {investor.bio && investor.bio.length > 150 && (
          <section className={`mb-10 p-5 ${cardStroke}`}>
            <div className="text-cyan-400 text-sm mb-3 font-medium">About</div>
            <p className="text-zinc-300 text-sm leading-relaxed">{investor.bio}</p>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            1️⃣4️⃣ QUIET GUIDANCE — One line, no emphasis
        ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-10 pl-4 border-l border-cyan-500/35">
          <p className="text-sm text-zinc-400 italic">{investor.quietGuidance}</p>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            QUIET EXIT
        ═══════════════════════════════════════════════════════════════ */}
        <div className="pt-4">
          <Link
            to={backFromProfileUrl}
            className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/35 bg-transparent px-3 py-2 text-sm text-cyan-400/90 hover:border-cyan-400/55 hover:text-cyan-300 transition-colors"
          >
            {backFromProfileLabel}
          </Link>
        </div>
        
      </main>
    </div>
  );
}
