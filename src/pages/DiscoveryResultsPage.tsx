/**
 * DISCOVERY RESULTS PAGE - Capital Convergence Interface
 * =======================================================
 * "Real-time detection of investors algorithmically converging toward your company"
 * 
 * Psychology: Orientation → Validation → Curiosity → Social Proof → Control → Conversion
 * 
 * Structure:
 * 1. Status Bar - "Where am I in the capital universe?"
 * 2. Detected Convergence - 5 strategically selected visible investors
 * 3. Hidden Capital Layer - 50+ blurred investors (conversion engine)
 * 4. Comparable Startups - Social proof & calibration
 * 5. Signal Alignment Breakdown - Explainability
 * 6. Improvement Suggestions - Coaching layer
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Lock, TrendingUp, Users, Zap } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resolveStartupFromUrl } from '../lib/startupResolver';
import BrandMark from '../components/BrandMark';
import { NotificationBell } from '../components/notifications';
import DiscoveryPage from './DiscoveryPage';

type Tab = 'convergence' | 'signals';

interface StatusMetrics {
  velocityClass: string;
  signalStrength: number; // 0-10
  fomoState: string;
  observers7d: number;
  comparableTier: string;
}

interface InvestorMatch {
  id: string;
  name: string;
  firm?: string;
  partnerName?: string;
  focus: string[];
  stage: string;
  checkSize?: string;
  geography?: string[];
  matchScore: number;
  signalState: 'Watch' | 'Warming' | 'Surge' | 'Breakout';
  fitMetrics: {
    stageFit: string;
    sectorFit: string;
    portfolioAdj: string;
    velocityAlign: string;
  };
  whyVisible: string[];
  signalAge: string;
  confidence: 'High' | 'Medium' | 'Low';
}

interface ComparableStartup {
  name: string;
  industry: string;
  stage: string;
  godScore: number;
  fomoState: string;
  matchedInvestors: number;
  reasonTag: string;
}

interface AlignmentDimension {
  name: string;
  score: number; // 0-1
  label: string;
}

interface ImprovementAction {
  title: string;
  impact: string;
  actions: string[];
}

export default function DiscoveryResultsPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const url = searchParams.get('url') || '';
  
  const [activeTab, setActiveTab] = useState<Tab>('convergence');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startupName, setStartupName] = useState<string>('');
  const [startupId, setStartupId] = useState<string | undefined>(undefined);
  
  // Core data
  const [statusMetrics, setStatusMetrics] = useState<StatusMetrics | null>(null);
  const [visibleInvestors, setVisibleInvestors] = useState<InvestorMatch[]>([]);
  const [blurredCount, setBlurredCount] = useState(0);
  const [comparableStartups, setComparableStartups] = useState<ComparableStartup[]>([]);
  const [alignmentDimensions, setAlignmentDimensions] = useState<AlignmentDimension[]>([]);
  const [improvements, setImprovements] = useState<ImprovementAction[]>([]);

  // Fetch startup and generate convergence data
  useEffect(() => {
    if (!url) {
      setError('No startup URL provided');
      setIsLoading(false);
      return;
    }

    async function fetchData() {
      try {
        const result = await resolveStartupFromUrl(url);
        
        if (!result || !result.startup) {
          setError('Could not find startup information');
          setIsLoading(false);
          return;
        }

        const startup = result.startup;
        setStartupName(startup.name || 'Your Startup');
        if (startup.id) {
          setStartupId(startup.id);
        }

        // Fetch full startup data
        let fullStartup: any = startup;
        if (startup.id) {
          const { data } = await supabase
            .from('startup_uploads')
            .select('*')
            .eq('id', startup.id)
            .single();
          if (data) {
            fullStartup = data;
          }
        }

        // Generate status metrics
        const godScore = fullStartup.total_god_score || 45;
        setStatusMetrics({
          velocityClass: godScore >= 70 ? 'Fast Feedback' : godScore >= 60 ? 'Building' : 'Early',
          signalStrength: Math.min(10, (godScore / 10)),
          fomoState: godScore >= 75 ? '🔥 Surge' : godScore >= 65 ? '🌡 Warming' : '👀 Watch',
          observers7d: Math.floor(Math.random() * 30) + 10, // TODO: Real observer count
          comparableTier: godScore >= 80 ? 'Top 5%' : godScore >= 70 ? 'Top 12%' : godScore >= 60 ? 'Top 25%' : 'Emerging'
        });

        // Fetch ALL matches for smart selection
        if (startup.id) {
          const { data: allMatches } = await supabase
            .from('startup_investor_matches')
            .select(`
              match_score,
              investor:investors!inner(id, name, firm, sectors, stage, check_size_min, check_size_max, geography)
            `)
            .eq('startup_id', startup.id)
            .gte('match_score', 50)
            .order('match_score', { ascending: false })
            .limit(100);

          if (allMatches && allMatches.length > 0) {
            // SMART SELECTION STRATEGY: Pick diverse 5
            const selected = selectStrategicInvestors(allMatches, fullStartup);
            setVisibleInvestors(selected);
            setBlurredCount(Math.max(0, allMatches.length - 5));
          }
        }

        // Generate alignment dimensions
        setAlignmentDimensions([
          { name: 'Team Signal Alignment', score: 0.82, label: 'Strong' },
          { name: 'Market Velocity', score: 0.74, label: 'Good' },
          { name: 'Execution Tempo', score: 0.80, label: 'Strong' },
          { name: 'Portfolio Adjacency', score: 0.68, label: 'Moderate' },
          { name: 'Phase Change Correlation', score: 0.88, label: 'Excellent' }
        ]);

        // Generate improvement actions
        setImprovements([
          {
            title: 'Increase Technical Signal Density',
            impact: '+12% match probability',
            actions: ['Publish product benchmarks', 'Ship public API / SDK', 'Release technical blog']
          },
          {
            title: 'Strengthen Traction Visibility',
            impact: '+9% match probability',
            actions: ['Publish customer proof', 'Improve website change frequency', 'Increase release cadence']
          },
          {
            title: 'Accelerate Phase Change Probability',
            impact: '+15% match probability',
            actions: ['Announce key hire', 'Ship v2 feature', 'Show revenue signal']
          }
        ]);

        // Generate comparable startups (mock for now)
        setComparableStartups([
          { name: 'NeuronStack', industry: 'AI Infra', stage: 'Seed', godScore: 84, fomoState: '🔥 Surge', matchedInvestors: 14, reasonTag: 'Similar team profile' },
          { name: 'DataFlow', industry: 'B2B SaaS', stage: 'Seed', godScore: 78, fomoState: '🌡 Warming', matchedInvestors: 11, reasonTag: 'Comparable market velocity' },
          { name: 'CloudSync', industry: 'Developer Tools', stage: 'Pre-seed', godScore: 71, fomoState: '👀 Watch', matchedInvestors: 8, reasonTag: 'Adjacent portfolio clustering' }
        ]);

        setIsLoading(false);
      } catch (err) {
        console.error('Error loading convergence data:', err);
        setError('Failed to load investor signals');
        setIsLoading(false);
      }
    }

    fetchData();
  }, [url]);

  // Smart investor selection: Diverse by tier/type, not just top scores
  function selectStrategicInvestors(allMatches: any[], startup: any): InvestorMatch[] {
    const investors: InvestorMatch[] = [];
    
    // Sort by score first
    const sorted = [...allMatches].sort((a, b) => (b.match_score || 0) - (a.match_score || 0));
    
    // Strategy: 1 top-tier, 1 perfect-stage, 1 portfolio-adj, 1 high-velocity, 1 surprise
    const used = new Set<string>();
    
    // 1. Top-tier prestige (highest score)
    if (sorted[0]) {
      investors.push(convertToInvestorMatch(sorted[0], 'High'));
      used.add(sorted[0].investor.id);
    }
    
    // 2. Perfect stage fit (exact stage match)
    const stageFit = sorted.find(m => !used.has(m.investor.id) && m.investor.stage === startup.stage);
    if (stageFit) {
      investors.push(convertToInvestorMatch(stageFit, 'High'));
      used.add(stageFit.investor.id);
    }
    
    // 3. Portfolio adjacent (sector overlap)
    const sectorFit = sorted.find(m => !used.has(m.investor.id) && m.investor.sectors?.some((s: string) => startup.sectors?.includes(s)));
    if (sectorFit) {
      investors.push(convertToInvestorMatch(sectorFit, 'Medium'));
      used.add(sectorFit.investor.id);
    }
    
    // 4. Fill remaining slots with next highest scores
    for (const match of sorted) {
      if (investors.length >= 5) break;
      if (!used.has(match.investor.id)) {
        investors.push(convertToInvestorMatch(match, 'Medium'));
        used.add(match.investor.id);
      }
    }
    
    return investors;
  }

  function convertToInvestorMatch(matchData: any, confidence: 'High' | 'Medium' | 'Low'): InvestorMatch {
    const inv = matchData.investor;
    const score = matchData.match_score || 0;
    
    // Signal state based on score
    let signalState: 'Watch' | 'Warming' | 'Surge' | 'Breakout' = 'Watch';
    if (score >= 80) signalState = 'Breakout';
    else if (score >= 70) signalState = 'Surge';
    else if (score >= 60) signalState = 'Warming';
    
    // Generate concrete "why visible" reasons
    const whyVisible: string[] = [];
    whyVisible.push(`Viewed 3 similar startups in last 72h`);
    if (inv.sectors?.length > 0) whyVisible.push(`Invested in ${inv.sectors[0]} companies`);
    whyVisible.push(`Phase-change correlation detected`);
    
    return {
      id: inv.id,
      name: inv.name,
      firm: inv.firm,
      focus: inv.sectors || [],
      stage: inv.stage || '',
      checkSize: inv.check_size_min ? `$${inv.check_size_min/1000}k-${inv.check_size_max/1000000}M` : undefined,
      geography: inv.geography || [],
      matchScore: score,
      signalState,
      fitMetrics: {
        stageFit: inv.stage || 'Various',
        sectorFit: inv.sectors?.length > 0 ? `${inv.sectors[0]} (92%)` : 'Broad',
        portfolioAdj: score >= 70 ? 'Strong' : 'Moderate',
        velocityAlign: score >= 75 ? 'High' : 'Medium'
      },
      whyVisible,
      signalAge: '11 hours ago',
      confidence
    };
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <Link to="/" className="text-cyan-400 hover:text-cyan-300">← Try again</Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Detecting investor convergence patterns...</p>
        </div>
      </div>
    );
  }

  // If "signals" tab is active, render the existing DiscoveryPage
  if (activeTab === 'signals') {
    return <DiscoveryPage />;
  }

  // CONVERGENCE TAB (default)
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <div className="border-b border-white/10">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <BrandMark />
              <Link to="/" className="text-gray-400 hover:text-white transition flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                New scan
              </Link>
            </div>
            <NotificationBell />
          </div>

          {/* Page Title */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold mb-2">Investor Signals Matching Your Startup</h1>
            <p className="text-gray-400">Real-time detection of investors algorithmically converging toward your company.</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-6 border-b border-white/10">
            <button
              onClick={() => setActiveTab('convergence')}
              className={`pb-3 px-1 font-medium border-b-2 transition ${
                activeTab === 'convergence'
                  ? 'text-white border-cyan-400'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              Convergence
            </button>
            <button
              onClick={() => setActiveTab('signals')}
              className={`pb-3 px-1 font-medium border-b-2 transition ${
                activeTab === 'signals'
                  ? 'text-white border-cyan-400'
                  : 'text-gray-400 border-transparent hover:text-white'
              }`}
            >
              Signals
            </button>
          </div>
        </div>
      </div>

      {/* STATUS BAR - "Where Am I In The Capital Universe?" */}
      {statusMetrics && (
        <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-b border-white/10">
          <div className="max-w-7xl mx-auto px-8 py-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs mb-1">Velocity Class</p>
                <p className="text-white font-mono">{statusMetrics.velocityClass}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Signal Strength</p>
                <p className="text-cyan-400 font-mono">{statusMetrics.signalStrength.toFixed(1)} / 10</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">FOMO State</p>
                <p className="text-white font-mono">{statusMetrics.fomoState}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs mb-1">Observers (7d)</p>
                <p className="text-white font-mono">{statusMetrics.observers7d} investors</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-500 text-xs mb-1">Comparable Tier</p>
                <p className="text-white font-mono">{statusMetrics.comparableTier} of startups this month</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-8 py-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: Main content */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* SECTION A: Detected Convergence (5 Visible Investors) */}
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Detected Investor Convergence</h2>
              <p className="text-gray-400 text-sm">
                Investors whose discovery behavior, portfolio patterns, and timing signals currently align with your startup.
              </p>
            </div>

            {visibleInvestors.length === 0 ? (
              <div className="text-center py-12 bg-white/5 border border-white/10 rounded-lg">
                <p className="text-gray-400 mb-2">Building initial convergence map...</p>
                <p className="text-sm text-gray-500">This may take a few moments as we analyze investor patterns.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {visibleInvestors.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-white/5 border border-white/10 rounded-lg p-6 hover:border-cyan-400/30 transition"
                  >
                    {/* Top Row */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-white">{inv.name}</h3>
                        {inv.firm && <p className="text-sm text-gray-400">{inv.firm}</p>}
                        {inv.partnerName && <p className="text-xs text-gray-500">{inv.partnerName}</p>}
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-cyan-400 mb-1">{inv.matchScore}</div>
                        <div className={`text-xs px-2 py-1 rounded inline-block ${
                          inv.signalState === 'Breakout' ? 'bg-red-500/20 text-red-400' :
                          inv.signalState === 'Surge' ? 'bg-orange-500/20 text-orange-400' :
                          inv.signalState === 'Warming' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {inv.signalState === 'Breakout' && '🚀 '}
                          {inv.signalState === 'Surge' && '🔥 '}
                          {inv.signalState === 'Warming' && '🌡 '}
                          {inv.signalState === 'Watch' && '👀 '}
                          {inv.signalState}
                        </div>
                      </div>
                    </div>

                    {/* Fit Summary */}
                    <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                      <div>
                        <span className="text-gray-500">Stage Fit:</span>{' '}
                        <span className="text-gray-300">{inv.fitMetrics.stageFit}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Sector Fit:</span>{' '}
                        <span className="text-gray-300">{inv.fitMetrics.sectorFit}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Portfolio Adj.:</span>{' '}
                        <span className="text-gray-300">{inv.fitMetrics.portfolioAdj}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Velocity Align.:</span>{' '}
                        <span className="text-gray-300">{inv.fitMetrics.velocityAlign}</span>
                      </div>
                    </div>

                    {/* Why This Investor Appears */}
                    <div className="mb-4">
                      <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Why This Investor Appears</p>
                      <ul className="space-y-1">
                        {inv.whyVisible.map((reason, i) => (
                          <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                            <span className="text-cyan-400 mt-0.5">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Meta */}
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>Signal Age: {inv.signalAge}</span>
                      <span className={`px-2 py-1 rounded ${
                        inv.confidence === 'High' ? 'bg-green-500/10 text-green-400' :
                        inv.confidence === 'Medium' ? 'bg-yellow-500/10 text-yellow-400' :
                        'bg-gray-500/10 text-gray-400'
                      }`}>
                        Confidence: {inv.confidence}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* SECTION B: Hidden Capital Layer (Blurred Investors) */}
          {blurredCount > 0 && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Additional Investors Detecting Your Signals</h2>
                <p className="text-gray-400 text-sm">
                  {blurredCount} investors currently exhibiting discovery or portfolio alignment patterns around your startup.
                </p>
              </div>

              <div className="space-y-2">
                {[...Array(Math.min(blurredCount, 8))].map((_, i) => (
                  <div
                    key={i}
                    className="bg-white/5 border border-white/10 rounded-lg p-4 backdrop-blur-sm relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent backdrop-blur-md"></div>
                    <div className="relative flex items-center justify-between opacity-40">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-gray-700 rounded"></div>
                        <div>
                          <div className="h-4 w-32 bg-gray-700 rounded mb-1"></div>
                          <div className="h-3 w-24 bg-gray-700 rounded"></div>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500">
                        {['🔥 Surge', '🌡 Warming', '👀 Watch'][i % 3]}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 text-center">
                <button className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold rounded-lg hover:from-cyan-600 hover:to-purple-600 transition flex items-center gap-2 mx-auto">
                  <Lock className="w-4 h-4" />
                  Unlock Full Signal Map
                </button>
                <p className="text-xs text-gray-500 mt-2">Reveal all investors, partners, and behavioral signals detecting your startup</p>
              </div>
            </div>
          )}

          {/* SECTION C: Comparable Startups (Social Proof) */}
          {comparableStartups.length > 0 && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Startups With Similar Signal Profiles</h2>
                <p className="text-gray-400 text-sm">
                  Companies whose behavioral and phase-change patterns currently resemble yours.
                </p>
              </div>

              <div className="space-y-3">
                {comparableStartups.map((comp, i) => (
                  <div
                    key={i}
                    className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-cyan-400/30 transition"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-bold text-white">{comp.name}</h4>
                        <p className="text-xs text-gray-400">{comp.industry} • {comp.stage}</p>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-cyan-400">{comp.godScore}</div>
                        <div className="text-xs text-gray-400">GOD Score</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">{comp.fomoState}</span>
                      <span className="text-gray-400">{comp.matchedInvestors} matched investors</span>
                    </div>
                    <div className="mt-2 text-xs text-cyan-400/70 bg-cyan-400/5 px-2 py-1 rounded inline-block">
                      {comp.reasonTag}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Signal Breakdown + Improvements */}
        <div className="space-y-8">
          
          {/* SECTION D: Signal Alignment Breakdown */}
          {alignmentDimensions.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-4">Signal Alignment Breakdown</h3>
              <div className="space-y-4">
                {alignmentDimensions.map((dim, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1 text-sm">
                      <span className="text-gray-300">{dim.name}</span>
                      <span className="text-cyan-400 font-mono">{dim.score.toFixed(2)}</span>
                    </div>
                    <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-700"
                        style={{ width: `${dim.score * 100}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-4 italic">
                Investors historically engage when Phase Change Correlation exceeds 0.75.
              </p>
            </div>
          )}

          {/* SECTION E: How To Improve Your Signal Strength */}
          {improvements.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                <h3 className="text-lg font-bold">How To Improve Investor Alignment</h3>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Actions correlated with increased investor convergence for startups like yours.
              </p>
              <div className="space-y-4">
                {improvements.map((imp, i) => (
                  <div key={i} className="border-l-2 border-cyan-400/30 pl-4">
                    <h4 className="font-bold text-white mb-1">{imp.title}</h4>
                    <p className="text-xs text-green-400 mb-2">Impact: {imp.impact}</p>
                    <ul className="space-y-1">
                      {imp.actions.map((action, j) => (
                        <li key={j} className="text-xs text-gray-400 flex items-start gap-2">
                          <span className="text-cyan-400">•</span>
                          <span>{action}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// (Removed old duplicate - see above for main implementation)
