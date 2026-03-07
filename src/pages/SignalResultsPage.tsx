/**
 * SIGNAL RESULTS PAGE
 * ===================
 * Minimal landing page showing investor signals for a startup URL
 * Design: Compact, at-a-glance, pythh dark grey + glowing effects
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { getSignalStrength, formatTimeAgo } from '../utils/signalHelpers';
import { SignalResult } from '../types/signals';
import { supabase } from '../lib/supabase';
import { withErrorMonitoring } from '../lib/dbErrorMonitor';

export default function SignalResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const url = searchParams.get('url') || '';
  
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [showContent, setShowContent] = useState(false);
  const [signals, setSignals] = useState<SignalResult[]>([]);
  const [startupName, setStartupName] = useState<string>('');
  const [stats, setStats] = useState({
    totalInvestors: 0,
    topScore: 0,
    stage: 'N/A',
    avgCheck: '$12M'
  });
  const [godScore, setGodScore] = useState<{
    total: number | null;
    team: number | null;
    traction: number | null;
    market: number | null;
    product: number | null;
    vision: number | null;
  }>({
    total: null,
    team: null,
    traction: null,
    market: null,
    product: null,
    vision: null,
  });
  const [signalScores, setSignalScores] = useState<{
    total: number | null;
    founderLanguageShift: number | null;
    investorReceptivity: number | null;
    newsMomentum: number | null;
    capitalConvergence: number | null;
    executionVelocity: number | null;
  }>({
    total: null,
    founderLanguageShift: null,
    investorReceptivity: null,
    newsMomentum: null,
    capitalConvergence: null,
    executionVelocity: null,
  });
  const [timingInsights, setTimingInsights] = useState<{
    bestTimeToReachOut: string;
    receptivityWindow: string;
    recentActivity: string;
  } | null>(null);

  // Fetch signals from database
  useEffect(() => {
    if (!url) {
      setLoading(false);
      return;
    }

    let progressTimer: NodeJS.Timeout;
    let cancelled = false;

    async function fetchSignals() {
      try {
        // Step 1: Resolve startup from URL
        const { data: rpcResult, error: rpcErr } = await withErrorMonitoring(
          'SignalResultsPage',
          'resolve_startup_by_url',
          () => supabase.rpc('resolve_startup_by_url', { p_url: url }),
          { url }
        );

        if (rpcErr || !rpcResult?.found || !rpcResult?.startup_id) {
          console.error('Failed to resolve startup:', rpcErr);
          setLoading(false);
          return;
        }

        const startupId = rpcResult.startup_id;

        // Step 2: Fetch startup details for name, stats, and GOD scores
        const { data: startup, error: startupErr } = await supabase
          .from('startup_uploads')
          .select('name, stage, sectors, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
          .eq('id', startupId)
          .single();

        if (startup) {
          setStartupName(startup.name || url);
          setStats(prev => ({
            ...prev,
            stage: startup.stage || 'N/A'
          }));
          setGodScore({
            total: startup.total_god_score,
            team: startup.team_score,
            traction: startup.traction_score,
            market: startup.market_score,
            product: startup.product_score,
            vision: startup.vision_score,
          });
        }

        // Step 2b: Fetch signal scores
        const { data: signalData } = await supabase
          .from('startup_signal_scores')
          .select('signals_total, founder_language_shift, investor_receptivity, news_momentum, capital_convergence, execution_velocity')
          .eq('startup_id', startupId)
          .single();

        if (signalData) {
          setSignalScores({
            total: signalData.signals_total,
            founderLanguageShift: signalData.founder_language_shift,
            investorReceptivity: signalData.investor_receptivity,
            newsMomentum: signalData.news_momentum,
            capitalConvergence: signalData.capital_convergence,
            executionVelocity: signalData.execution_velocity,
          });
        }

        // Step 3: Fetch top matches with investor details
        const { data: matches, error: matchErr } = await withErrorMonitoring(
          'SignalResultsPage',
          'fetch_matches',
          () => supabase
            .from('startup_investor_matches')
            .select(`
              investor_id,
              match_score,
              reasoning,
              why_you_match,
              fit_analysis,
              created_at,
              investors!inner(
                id,
                name,
                firm,
                title,
                sectors,
                stage,
                check_size_min,
                check_size_max
              )
            `)
            .eq('startup_id', startupId)
            .gte('match_score', 50)
            .order('match_score', { ascending: false })
            .limit(5),
          { startupId }
        );

        if (matchErr) {
          console.error('Failed to fetch matches:', matchErr);
          setLoading(false);
          return;
        }

        if (!matches || matches.length === 0) {
          setLoading(false);
          return;
        }

        // Step 4: Transform to SignalResult format
        const transformedSignals: SignalResult[] = matches.map((m: any) => {
          const investor = m.investors;
          const matchScore = Math.round(m.match_score || 0);
          
          // Parse lookingFor from reasoning or why_you_match
          const lookingFor = parseLookingFor(m.reasoning || m.why_you_match || m.fit_analysis || '');
          
          // Calculate breakdown from match score
          const breakdown = {
            portfolioFit: Math.round(matchScore * 0.3),
            stageMatch: Math.round(matchScore * 0.25),
            sectorVelocity: Math.round(matchScore * 0.25),
            geoFit: Math.round(matchScore * 0.2)
          };

          // Calculate composition (simplified from match score)
          const composition = {
            recentActivity: Math.round(matchScore / 10),
            portfolioAdjacency: Math.round(matchScore / 8),
            thesisAlignment: Math.round(matchScore / 12),
            stageMatch: Math.round(matchScore / 9)
          };

          // Calculate prediction
          const prediction = {
            outreachProbability: Math.min(95, Math.round(matchScore * 0.8)),
            likelyTimeframe: matchScore >= 80 ? '7-14 days' : matchScore >= 70 ? '14-21 days' : matchScore >= 60 ? '21-30 days' : '30-60 days',
            trigger: 'High match score indicates strong alignment'
          };

          // Get initials from firm or name
          const initials = investor.firm 
            ? investor.firm.substring(0, 2).toUpperCase()
            : investor.name 
            ? investor.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().substring(0, 2)
            : 'VC';

          return {
            investor: {
              id: investor.id,
              name: investor.name || 'Unknown',
              firm: investor.firm || 'Unknown Firm',
              title: investor.title || 'Partner',
              initials,
              practice: investor.sectors?.[0] || ''
            },
            signalStrength: matchScore,
            timestamp: m.created_at ? new Date(m.created_at) : new Date(),
            lookingFor,
            matchBreakdown: breakdown,
            composition,
            prediction,
            recentContext: [] // Could be populated from investor activity if available
          };
        });

        // Update stats
        setStats({
          totalInvestors: transformedSignals.length,
          topScore: transformedSignals[0]?.signalStrength || 0,
          stage: startup?.stage || 'N/A',
          avgCheck: calculateAvgCheck(matches)
        });

        setSignals(transformedSignals);

        // Step 5: Calculate timing insights based on matches
        if (transformedSignals.length > 0) {
          const topMatch = transformedSignals[0];
          const avgScore = transformedSignals.reduce((sum, s) => sum + s.signalStrength, 0) / transformedSignals.length;
          
          let bestTime = 'Next 2-4 weeks';
          let receptivity = 'Moderate';
          let activity = 'Active';
          
          if (avgScore >= 80) {
            bestTime = 'This week';
            receptivity = 'High';
            activity = 'Very active';
          } else if (avgScore >= 70) {
            bestTime = 'Next 1-2 weeks';
            receptivity = 'High';
            activity = 'Active';
          } else if (avgScore >= 60) {
            bestTime = 'Next 2-4 weeks';
            receptivity = 'Moderate';
            activity = 'Moderate';
          } else {
            bestTime = 'Next 4-6 weeks';
            receptivity = 'Low';
            activity = 'Limited';
          }

          setTimingInsights({
            bestTimeToReachOut: bestTime,
            receptivityWindow: receptivity,
            recentActivity: activity,
          });
        }

        setLoading(false);
        setShowContent(true);
      } catch (err) {
        console.error('Failed to fetch signals:', err);
        setLoading(false);
      }
    }

    // Progress simulation
    progressTimer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressTimer);
          return 100;
        }
        return prev + 2;
      });
    }, 40);

    fetchSignals();

    return () => {
      cancelled = true;
      clearInterval(progressTimer);
    };
  }, [url]);

  // Helper function to parse lookingFor from text
  function parseLookingFor(text: string | null): string[] {
    if (!text) return ['Strong alignment with portfolio', 'Stage match', 'Sector focus'];
    
    // Try to extract key points from reasoning text
    const sentences = text.split(/[.!?]\s+/).filter(s => s.length > 20);
    if (sentences.length >= 3) {
      return sentences.slice(0, 4);
    }
    
    // Fallback to generic points
    return [
      'Strong alignment with portfolio',
      'Stage match',
      'Sector focus',
      'Geographic fit'
    ];
  }

  // Helper to calculate average check size
  function calculateAvgCheck(matches: any[]): string {
    const checks = matches
      .map(m => {
        const inv = m.investors;
        if (inv.check_size_min && inv.check_size_max) {
          return (inv.check_size_min + inv.check_size_max) / 2;
        }
        return null;
      })
      .filter((v): v is number => v !== null);
    
    if (checks.length === 0) return '$12M';
    const avg = checks.reduce((a, b) => a + b, 0) / checks.length;
    return `$${Math.round(avg)}M`;
  }


  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white relative overflow-hidden">
        {/* Pythh glowing background */}
        <div className="fixed bottom-0 right-0 w-[1000px] h-[1000px] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="fixed bottom-20 right-20 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '3s', animationDelay: '1s' }} />
        
        <div className="max-w-5xl mx-auto px-6 py-20 relative z-10">
          <div className="text-center">
            <div className="text-2xl font-bold text-white mb-8">
              Analyzing capital signals for {url}
            </div>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-4 max-w-md mx-auto">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-teal-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-sm text-white/50">
              {progress < 30 && 'Scanning investor databases...'}
              {progress >= 30 && progress < 60 && 'Analyzing portfolio patterns...'}
              {progress >= 60 && progress < 90 && 'Calculating signal strength...'}
              {progress >= 90 && 'Preparing your results...'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (signals.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-black text-white relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 py-20 relative z-10">
          <div className="text-center">
            <h1 className="text-4xl font-bold mb-4">No signals found</h1>
            <p className="text-lg text-white/60 mb-8">
              We couldn't find investor signals for {url}
            </p>
            <Link 
              to="/" 
              className="px-6 py-3 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg text-sm font-medium border border-cyan-500/30 transition"
            >
              Try another URL
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      {/* Pythh glowing background */}
      <div className="fixed bottom-0 right-0 w-[1000px] h-[1000px] bg-teal-500/10 rounded-full blur-[140px] pointer-events-none animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="fixed bottom-20 right-20 w-[600px] h-[600px] bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDuration: '3s', animationDelay: '1s' }} />
      <div className="fixed top-1/4 right-1/4 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[80px] pointer-events-none animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />
      
      {/* Grid pattern */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)`,
        backgroundSize: '60px 60px'
      }} />

      <div className="max-w-5xl mx-auto px-6 py-12 relative z-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="text-xl font-bold tracking-tight hover:text-cyan-400 transition">
            pythh.ai
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm text-white/70 hover:text-white transition">
              Sign in
            </Link>
            <button className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 rounded-lg text-sm font-medium border border-cyan-500/30 transition">
              Get started
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-3">pythh signals</h1>
          <p className="text-lg text-white/60">
            Top Matches by <span className="text-cyan-400 font-semibold" style={{ textShadow: '0 0 20px rgba(34, 211, 238, 0.6)' }}>[signal]</span>: these firms match your signals
          </p>
        </div>

        {/* Stats Banner */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="border border-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold text-cyan-400 mb-1">{stats.totalInvestors}</div>
            <div className="text-xs text-white/50 uppercase tracking-wider">Investors Signaling</div>
          </div>
          <div className="border border-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold text-green-400 mb-1">{stats.topScore}</div>
            <div className="text-xs text-white/50 uppercase tracking-wider">Top Signal Score</div>
          </div>
          <div className="border border-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold text-amber-500 mb-1">{stats.stage}</div>
            <div className="text-xs text-white/50 uppercase tracking-wider">Capital Pushing →</div>
          </div>
          <div className="border border-white/10 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400 mb-1">{stats.avgCheck}</div>
            <div className="text-xs text-white/50 uppercase tracking-wider">Avg Check Size</div>
          </div>
        </div>

        {/* GOD Score & Breakdown */}
        {godScore.total !== null && (
          <div className="mb-8 border border-white/10 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">GOD Score</h2>
              <div className="text-right">
                <div className="text-3xl font-bold text-emerald-400">{Math.round(godScore.total)}</div>
                <div className="text-xs text-white/50">/ 100</div>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-4">
              <div className="border-l border-white/10 pl-4">
                <div className="text-xs text-white/50 mb-1">Team</div>
                <div className="text-lg font-semibold text-white">{godScore.team !== null ? Math.round(godScore.team) : '—'}</div>
              </div>
              <div className="border-l border-white/10 pl-4">
                <div className="text-xs text-white/50 mb-1">Traction</div>
                <div className="text-lg font-semibold text-white">{godScore.traction !== null ? Math.round(godScore.traction) : '—'}</div>
              </div>
              <div className="border-l border-white/10 pl-4">
                <div className="text-xs text-white/50 mb-1">Market</div>
                <div className="text-lg font-semibold text-white">{godScore.market !== null ? Math.round(godScore.market) : '—'}</div>
              </div>
              <div className="border-l border-white/10 pl-4">
                <div className="text-xs text-white/50 mb-1">Product</div>
                <div className="text-lg font-semibold text-white">{godScore.product !== null ? Math.round(godScore.product) : '—'}</div>
              </div>
              <div className="border-l border-white/10 pl-4">
                <div className="text-xs text-white/50 mb-1">Vision</div>
                <div className="text-lg font-semibold text-white">{godScore.vision !== null ? Math.round(godScore.vision) : '—'}</div>
              </div>
            </div>
          </div>
        )}

        {/* Signal Score Breakdown */}
        {signalScores.total !== null && (
          <div className="mb-8 border border-white/10 rounded-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Signal Score</h2>
              <div className="text-right">
                <div className="text-3xl font-bold text-cyan-400">{signalScores.total.toFixed(1)}</div>
                <div className="text-xs text-white/50">/ 10</div>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white/70">Founder Language Shift</span>
                  <span className="text-sm font-semibold text-white">{signalScores.founderLanguageShift !== null ? signalScores.founderLanguageShift.toFixed(1) : '—'} / 2.0</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${signalScores.founderLanguageShift !== null ? (signalScores.founderLanguageShift / 2.0) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white/70">Investor Receptivity</span>
                  <span className="text-sm font-semibold text-white">{signalScores.investorReceptivity !== null ? signalScores.investorReceptivity.toFixed(1) : '—'} / 2.5</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${signalScores.investorReceptivity !== null ? (signalScores.investorReceptivity / 2.5) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white/70">News Momentum</span>
                  <span className="text-sm font-semibold text-white">{signalScores.newsMomentum !== null ? signalScores.newsMomentum.toFixed(1) : '—'} / 1.5</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${signalScores.newsMomentum !== null ? (signalScores.newsMomentum / 1.5) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white/70">Capital Convergence</span>
                  <span className="text-sm font-semibold text-white">{signalScores.capitalConvergence !== null ? signalScores.capitalConvergence.toFixed(1) : '—'} / 2.0</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${signalScores.capitalConvergence !== null ? (signalScores.capitalConvergence / 2.0) * 100 : 0}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-white/70">Execution Velocity</span>
                  <span className="text-sm font-semibold text-white">{signalScores.executionVelocity !== null ? signalScores.executionVelocity.toFixed(1) : '—'} / 2.0</span>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-cyan-400 rounded-full"
                    style={{ width: `${signalScores.executionVelocity !== null ? (signalScores.executionVelocity / 2.0) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timing Insights */}
        {timingInsights && (
          <div className="mb-8 border border-white/10 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-white mb-6">Timing Insights</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="border-l border-cyan-400/30 pl-4">
                <div className="text-xs text-white/50 mb-1 uppercase tracking-wider">Best Time to Reach Out</div>
                <div className="text-lg font-semibold text-cyan-400">{timingInsights.bestTimeToReachOut}</div>
              </div>
              <div className="border-l border-cyan-400/30 pl-4">
                <div className="text-xs text-white/50 mb-1 uppercase tracking-wider">Receptivity Window</div>
                <div className="text-lg font-semibold text-cyan-400">{timingInsights.receptivityWindow}</div>
              </div>
              <div className="border-l border-cyan-400/30 pl-4">
                <div className="text-xs text-white/50 mb-1 uppercase tracking-wider">Recent Activity</div>
                <div className="text-lg font-semibold text-cyan-400">{timingInsights.recentActivity}</div>
              </div>
            </div>
          </div>
        )}

        {/* Compact Signal Cards */}
        <div className="space-y-4 mb-12">
          {signals.map((signal, index) => {
            const strength = getSignalStrength(signal.signalStrength);
            return (
              <div 
                key={signal.investor.id || index}
                className="border border-white/10 hover:border-cyan-400/50 rounded-lg p-6 transition-all"
                style={{ animation: `fadeIn 0.3s ease-out ${0.5 + index * 0.1}s both` }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">{strength.emoji}</span>
                      <Link 
                        to={`/investor/${signal.investor.id}`}
                        className="font-semibold text-lg hover:text-cyan-400 transition"
                      >
                        {signal.investor.firm}:
                      </Link>
                    </div>
                    <div className="flex flex-wrap items-center gap-6 text-sm text-white/70">
                      <div>
                        <span className="text-white/50">focus:</span> {signal.lookingFor[0]?.split(' ').slice(0, 3).join(' ') || 'Strong alignment'}
                      </div>
                      <div>
                        <span className="text-white/50">stage:</span> {stats.stage}
                      </div>
                      <div>
                        <span className="text-white/50">size:</span> {stats.avgCheck}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-white/50">signal:</span> 
                        <span className={`text-2xl font-bold ${strength.color}`} style={{ textShadow: `0 0 15px ${strength.color.includes('green') ? 'rgba(34, 197, 94, 0.5)' : strength.color.includes('blue') ? 'rgba(59, 130, 246, 0.5)' : strength.color.includes('yellow') ? 'rgba(251, 191, 36, 0.5)' : 'rgba(156, 163, 175, 0.5)'}` }}>
                          {signal.signalStrength}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate(`/investor/${signal.investor.id}`)}
                    className="text-sm text-cyan-400 hover:text-cyan-300 transition cursor-pointer"
                  >
                    View details →
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Why They Match */}
        {signals.length > 0 && (
          <div className="border border-white/10 rounded-lg p-8 mb-12">
            <h2 className="text-2xl font-bold mb-6">Why they match</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-white/50 uppercase tracking-wider mb-2">Portfolio Fit</div>
                <div className="text-xl font-bold text-cyan-400 mb-1">{signals[0].matchBreakdown.portfolioFit}%</div>
                <div className="text-sm text-white/70">Strong alignment with portfolio companies</div>
              </div>
              <div>
                <div className="text-sm text-white/50 uppercase tracking-wider mb-2">Sector Velocity</div>
                <div className="text-xl font-bold text-cyan-400 mb-1">{signals[0].matchBreakdown.sectorVelocity}%</div>
                <div className="text-sm text-white/70">Active in your sector</div>
              </div>
              <div>
                <div className="text-sm text-white/50 uppercase tracking-wider mb-2">Recent Activity</div>
                <div className="text-xl font-bold text-cyan-400 mb-1">{formatTimeAgo(signals[0].timestamp)}</div>
                <div className="text-sm text-white/70">Latest signal from {signals[0].investor.firm}</div>
              </div>
              <div>
                <div className="text-sm text-white/50 uppercase tracking-wider mb-2">Outreach Window</div>
                <div className="text-xl font-bold text-cyan-400 mb-1">{signals[0].prediction.likelyTimeframe}</div>
                <div className="text-sm text-white/70">Predicted timeframe for top match</div>
              </div>
            </div>
          </div>
        )}

        {/* What to Do Next */}
        <div className="border border-cyan-400/30 rounded-lg p-8">
          <h2 className="text-2xl font-bold mb-6">What to do next</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-cyan-400 font-bold">1</span>
              </div>
              <div>
                <div className="font-semibold mb-1">Review your matches</div>
                <div className="text-sm text-white/70">These investors have the strongest signal alignment with your startup</div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-cyan-400 font-bold">2</span>
              </div>
              <div>
                <div className="font-semibold mb-1">Prepare your pitch</div>
                <div className="text-sm text-white/70">Tailor your approach based on each investor's focus areas</div>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <span className="text-cyan-400 font-bold">3</span>
              </div>
              <div>
                <div className="font-semibold mb-1">Reach out strategically</div>
                <div className="text-sm text-white/70">Use the predicted timeframe to time your outreach</div>
              </div>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/10">
            <button className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-semibold rounded-lg transition shadow-lg shadow-orange-600/30">
              Unlock all 60 signals — $49/month
            </button>
            <div className="text-center text-sm text-white/50 mt-2">
              or start 7-day free trial
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
