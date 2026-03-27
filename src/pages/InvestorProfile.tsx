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
import { Link, useParams } from 'react-router-dom';
import SaveToSignalCard from '../components/SaveToSignalCard';
import ShareButton from '../components/ShareButton';
import { supabase } from '../lib/supabase';
import { withErrorMonitoring } from '../lib/dbErrorMonitor';
import { useAuth } from '../contexts/AuthContext';
import { useOracleStartupId } from '../hooks/useOracleStartupId';
import { isUuidString } from '../lib/isUuid';
import { Briefcase, TrendingUp, Clock, DollarSign, Award, Users, Target, Zap } from 'lucide-react';

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

export default function InvestorProfile() {
  const { id } = useParams();
  const { user, isLoggedIn } = useAuth();
  const startupId = useOracleStartupId();
  const [investor, setInvestor] = useState<InvestorData>(defaultInvestor);
  const [loading, setLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  
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
      case 'Warming': return 'text-emerald-400';
      case 'Monitoring': return 'text-cyan-400';
      case 'Cooling': return 'text-amber-400';
      case 'Dormant': return 'text-[#5f5f5f]';
    }
  };

  const timingColor = (t: string): string => {
    if (t === 'Active') return 'text-emerald-400';
    if (t === 'Warming') return 'text-cyan-400';
    if (t === 'Cooling') return 'text-amber-400';
    return 'text-[#5f5f5f]';
  };

  // Score click → Score Drawer (lens locked)
  const handleScoreClick = () => {
    console.log('Open score drawer for', investor.name);
  };

  return (
    <div className="min-h-screen bg-[#1c1c1c]" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      
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
      <header className="border-b border-[#2e2e2e]">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/app" className="text-white font-medium">pythh</Link>
            <span className="text-[#5f5f5f]">/</span>
            <Link to="/matches" className="text-[#8f8f8f] hover:text-white transition-colors">matches</Link>
            <span className="text-[#5f5f5f]">/</span>
            <span className="text-[#8f8f8f]">{id}</span>
          </div>
          <span className="text-xs text-[#5f5f5f]">
            {isUpdating ? (
              <span style={{ animation: 'updateFade 1.2s ease-in-out' }}>updating…</span>
            ) : (
              'Live'
            )}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        
        {/* ═══════════════════════════════════════════════════════════════
            1️⃣ IDENTITY STRIP — Minimal, human + Save/Share
        ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-10">
          <div className="flex items-start justify-between mb-2">
            <div className="px-4 py-2 border border-emerald-400/50 rounded-lg">
              <h1 className="text-xl text-emerald-400 font-medium">{investor.name}</h1>
            </div>
            <div className="flex items-center gap-3">
              <SaveToSignalCard
                entityType="investor"
                entityId={id || ''}
                entityName={investor.name}
                scoreValue={investor.lensScore}
                context="from profile header"
                size="sm"
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
              />
            </div>
          </div>
          <div className="text-sm text-[#8f8f8f] space-y-1">
            <p><span className="text-cyan-400">Focus:</span> <span className="text-white/90">{investor.focus}</span></p>
            <p><span className="text-cyan-400">Stage:</span> <span className="text-white/90">{investor.stage}</span></p>
            <p className="text-[#5f5f5f] text-xs mt-2">Observed since: <span className="text-cyan-400/70">{investor.observedSince}</span></p>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            🎯 SIGNALS THIS INVESTOR RESPONDS TO — Top priority for founders
        ═══════════════════════════════════════════════════════════════ */}
        {investor.signalsTheyRespondTo.length > 0 && (
          <section className="mb-10 border border-emerald-400/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <div className="text-cyan-400 text-sm font-medium">Signals this investor responds to</div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-400">{investor.lensScore.toFixed(1)}</span>
                <span className="text-xs text-white/60">/ 10</span>
              </div>
            </div>
            <div className="space-y-1.5">
              {investor.signalsTheyRespondTo.map((signal, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span className="text-white/90">{signal}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-emerald-500/20">
              <p className="text-xs text-cyan-400/70 italic">
                Signal score reflects investor quality and responsiveness. Higher scores indicate stronger signal alignment.
              </p>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            2️⃣ BEHAVIORAL SUMMARY — This is the soul (3 bullets max)
        ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-10">
          <div className="text-cyan-400 text-sm mb-3 font-medium">Behavioral pattern</div>
          <div className="space-y-2">
            {investor.behavioralPattern.map((pattern, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span className="text-emerald-400 mt-0.5">•</span>
                <span className="text-white/90">{pattern}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            3️⃣ RECENT BEHAVIOR — Lifeform core (≤30 days)
        ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-10">
          <div className="text-cyan-400 text-sm mb-3 font-medium">Recent behavior</div>
          <div className="space-y-2">
            {investor.recentBehavior.map((item, i) => (
              <div 
                key={i} 
                className="flex items-start gap-2 text-sm"
                style={{ animation: `profileFadeIn 0.2s ease-out ${i * 0.05}s both` }}
              >
                <span className="text-emerald-400 mt-0.5">•</span>
                <span className="text-white/80">{item}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            4️⃣ MATCH QUALITY (if founder logged in)
        ═══════════════════════════════════════════════════════════════ */}
        {startupClaimed && investor.matchScore !== undefined && (
          <section className="mb-10 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-lg border border-emerald-500/30 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-emerald-400" />
              <div className="text-cyan-400 text-sm font-medium">Your match quality</div>
            </div>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="text-3xl font-bold text-emerald-400">{investor.matchScore}</span>
              <span className="text-sm text-white/60">/ 100</span>
            </div>
            {investor.matchReasons && investor.matchReasons.length > 0 && (
              <div className="space-y-1.5 mt-3">
                {investor.matchReasons.map((reason, i) => (
                  <div key={i} className="text-sm text-white/80 flex items-start gap-2">
                    <span className="text-emerald-400 mt-0.5">✓</span>
                    <span>{reason}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            5️⃣ ALIGNMENT & TIMING — This is discipline
        ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-10 bg-[#232323] rounded-lg border border-cyan-500/20 p-5">
          {startupClaimed ? (
            <>
              <div className="text-cyan-400 text-sm mb-4 font-medium">Your alignment</div>
              <div className="grid grid-cols-3 gap-6 text-sm">
                <div>
                  <span className="text-cyan-400/70 block mb-1 text-xs">Current state</span>
                  <span className={`${alignmentColor(investor.alignmentState)} font-medium`}>
                    {investor.alignmentState}
                  </span>
                </div>
                <div>
                  <span className="text-cyan-400/70 block mb-1 text-xs">Lens score</span>
                  <span 
                    className="text-emerald-400 font-mono cursor-pointer hover:text-emerald-300 transition-colors font-semibold"
                    onClick={handleScoreClick}
                  >
                    {investor.lensScore} <span className="text-[#5f5f5f] text-xs">(GOD)</span>
                  </span>
                </div>
                <div>
                  <span className="text-cyan-400/70 block mb-1 text-xs">Timing</span>
                  <span className={`${timingColor(investor.timing)} font-medium`}>
                    {investor.timing}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="text-white/70 text-sm">
              <Link to="/signup/founder" className="text-cyan-400 hover:text-cyan-300 underline">
                Claim your startup
              </Link> to see alignment and timing.
            </div>
          )}
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            6️⃣ KEY METRICS — Investment activity
        ═══════════════════════════════════════════════════════════════ */}
        {(investor.totalInvestments || investor.successfulExits || investor.investmentPace) && (
          <section className="mb-10 grid grid-cols-3 gap-4">
            {investor.totalInvestments && (
              <div className="bg-[#232323] rounded-lg border border-cyan-500/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Briefcase className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400/70 text-xs">Total Investments</span>
                </div>
                <div className="text-2xl font-bold text-emerald-400">{investor.totalInvestments}</div>
              </div>
            )}
            {investor.successfulExits && (
              <div className="bg-[#232323] rounded-lg border border-cyan-500/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Award className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400/70 text-xs">Successful Exits</span>
                </div>
                <div className="text-2xl font-bold text-emerald-400">{investor.successfulExits}</div>
              </div>
            )}
            {investor.investmentPace && (
              <div className="bg-[#232323] rounded-lg border border-cyan-500/20 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <span className="text-cyan-400/70 text-xs">Deals/Year</span>
                </div>
                <div className="text-2xl font-bold text-emerald-400">~{investor.investmentPace}</div>
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
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm hover:bg-emerald-500/20 transition-colors"
                >
                  {company}
                </span>
              ))}
              {investor.portfolioCompanies.length > 12 && (
                <span className="px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm">
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
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500/20 to-emerald-500/20 border border-cyan-400/40 text-cyan-300 text-sm font-medium"
                  >
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
          <section className="mb-10 bg-[#232323] rounded-lg border border-cyan-500/20 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-cyan-400" />
              <div className="text-cyan-400 text-sm font-medium">Investment Thesis</div>
            </div>
            <p className="text-white/90 text-sm leading-relaxed">{investor.investmentThesis}</p>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            🔟 WARM INTRO GUIDANCE — How to reach them
        ═══════════════════════════════════════════════════════════════ */}
        {investor.preferredIntroMethod && (
          <section className="mb-10 bg-gradient-to-br from-cyan-500/10 to-emerald-500/10 rounded-lg border border-cyan-500/30 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-cyan-400" />
              <div className="text-cyan-400 text-sm font-medium">Preferred Introduction Method</div>
            </div>
            <p className="text-white/90 text-sm">{investor.preferredIntroMethod}</p>
            {investor.avgResponseTime && (
              <p className="text-cyan-400/70 text-xs mt-2 flex items-center gap-1">
                <Clock className="w-3 h-3" />
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
            <div className="text-cyan-400 text-sm mb-3 font-medium">Relative behavior</div>
            <div className="space-y-2">
              {investor.relativeBehavior.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="text-emerald-400 mt-0.5">•</span>
                  <span className="text-white/80">{item}</span>
                </div>
              ))}
            </div>
          </section>
        )}


        {/* ═══════════════════════════════════════════════════════════════
            1️⃣3️⃣ FULL BIO — If available
        ═══════════════════════════════════════════════════════════════ */}
        {investor.bio && investor.bio.length > 150 && (
          <section className="mb-10 bg-[#232323] rounded-lg border border-cyan-500/20 p-5">
            <div className="text-cyan-400 text-sm mb-3 font-medium">About</div>
            <p className="text-white/90 text-sm leading-relaxed">{investor.bio}</p>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            1️⃣4️⃣ QUIET GUIDANCE — One line, no emphasis
        ═══════════════════════════════════════════════════════════════ */}
        <section className="mb-10 pl-4 border-l border-cyan-500/30">
          <p className="text-sm text-white/70 italic">{investor.quietGuidance}</p>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            QUIET EXIT
        ═══════════════════════════════════════════════════════════════ */}
        <div className="pt-4">
          <Link 
            to="/matches"
            className="text-[#8f8f8f] hover:text-[#c0c0c0] text-sm transition-colors"
          >
            ← Back to matches
          </Link>
        </div>
        
      </main>
    </div>
  );
}
