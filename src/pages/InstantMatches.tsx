/**
 * RESULTS PAGE (Doctrine-Aligned)
 * ==============================
 * Canonical outputs:
 * - Power Score (Signal Strength × Readiness)
 * - Fundraising Window (Too Early / Forming / Prime / Cooling)
 * - Distance to Targets (alignment % per investor + trend placeholder)
 * - Investors Aligned With You (tier gated)
 * - Market Signals (context)
 * - Strategy & Next Steps (actionable)
 *
 * Tier gating (unchanged):
 * - Free: top 3, masked names, no reasons
 * - Pro: top 10, full names, no reasons
 * - Elite: top 50, full names + reasons + confidence + export
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { 
  Loader2, 
  Sparkles, 
  Lock, 
  Globe, 
  Building2, 
  Target, 
  TrendingUp,
  CheckCircle,
  ArrowRight,
  Star,
  Zap,
  Brain,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Download,
  Crown,
  Eye,
  EyeOff,
  FileText,
  Share2,
  Copy,
  Check,
  HelpCircle
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resolveStartupFromUrl, ResolveResult } from '../lib/startupResolver';
import { useAuth } from '../contexts/AuthContext';
import { useMatches, getScoreStyle } from '../hooks/useMatches';
import { getPlan, getMatchVisibility } from '../utils/plan';
import { analytics } from '../analytics';
import UpgradeModal from '../components/UpgradeModal';
import { UpgradeMoment } from '../lib/upgradeMoments';
import InvestorAlignmentCard from '../components/InvestorAlignmentCard';
import { useSignalHistory } from '../hooks/useSignalHistory';
import PowerScoreSparkline from '../components/PowerScoreSparkline';

interface AnalyzedStartup {
  id?: string;
  name: string;
  website: string;
  tagline?: string;
  description?: string; // AI-generated summary
  sectors?: string[];
  stage?: string;
  total_god_score?: number; // Readiness
  signals?: string[]; // Detected signals
}

// Legacy interface kept for similar startups
interface SimilarStartup {
  id: string;
  name: string;
  tagline?: string;
  sectors?: string[];
  total_god_score?: number;
}

// Founders Toolkit services
const FOUNDERS_TOOLKIT = [
  { slug: 'pitch-analyzer', name: 'Pitch Deck Analyzer', icon: '📊', desc: 'AI feedback on your pitch' },
  { slug: 'value-prop-sharpener', name: 'Value Prop Sharpener', icon: '✨', desc: 'Perfect your one-liner' },
  { slug: 'vc-approach-playbook', name: 'VC Approach Playbook', icon: '🎯', desc: 'Custom investor strategies' },
  { slug: 'funding-strategy', name: 'Funding Roadmap', icon: '🗺️', desc: 'Your fundraise timeline' },
];

// Analysis steps for the loading animation
const ANALYSIS_STEPS = [
  { icon: Globe, text: 'Scanning website...', duration: 1500, isBrain: false },
  { icon: Brain, text: 'Running inference engine...', duration: 2500, isBrain: true },
  { icon: Target, text: 'Analyzing market signals...', duration: 1500, isBrain: false },
  { icon: Zap, text: 'Calculating readiness...', duration: 2000, isBrain: true },
  { icon: Sparkles, text: 'Finding investor matches...', duration: 1500, isBrain: false },
];

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 
  (import.meta.env.DEV ? 'http://localhost:3002' : '');

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function computeFundraisingWindow(powerScore: number) {
  if (powerScore >= 85) return { label: "Prime", tone: "emerald", guidance: "Start outreach now. This is your highest conversion window." };
  if (powerScore >= 65) return { label: "Forming", tone: "amber", guidance: "Warm outreach now. Stronger conversion likely in 3–6 weeks." };
  if (powerScore >= 40) return { label: "Too Early", tone: "gray", guidance: "Build proof and signals. Target seed scouts / smaller funds first." };
  return { label: "Too Early", tone: "gray", guidance: "You're not circulating yet. Focus on traction + independent validation." };
}

function tonePill(tone: string) {
  if (tone === "emerald") return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
  if (tone === "amber") return "bg-amber-500/20 text-amber-400 border border-amber-500/30";
  return "bg-gray-500/20 text-gray-400 border border-gray-500/30";
}

// Get auth headers for API calls
async function getAuthHeaders(): Promise<HeadersInit> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    };
  }
  return { 'Content-Type': 'application/json' };
}

// Elite-only action buttons: Export CSV, Deal Memo, Share
function EliteActionsBar({ startupId, startupName }: { startupId: string; startupName: string }) {
  const [exportLoading, setExportLoading] = useState(false);
  const [memoLoading, setMemoLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'memo' | 'share'>('idle');
  const [toast, setToast] = useState<string | null>(null);
  const [upgradeModal, setUpgradeModal] = useState<{ open: boolean; moment: UpgradeMoment }>({
    open: false,
    moment: 'export_csv'
  });
  
  // Show toast for 3 seconds
  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };
  
  // Export CSV - triggers download from server
  const handleExportCSV = async () => {
    setExportLoading(true);
    try {
      const headers = await getAuthHeaders();
      const url = `${API_BASE}/api/matches/export.csv?startup_id=${startupId}&limit=50`;
      
      const response = await fetch(url, { headers });
      if (!response.ok) {
        if (response.status === 403) {
          setUpgradeModal({ open: true, moment: 'export_csv' });
          return;
        }
        throw new Error('Export failed');
      }
      
      // Download the CSV
      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `matches-${startupName.replace(/[^a-z0-9]/gi, '_')}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
      
      showToast('✅ CSV downloaded');
      analytics.exportCSVClicked(startupId || undefined);
    } catch (err) {
      console.error('Export error:', err);
      showToast('❌ Export failed');
    } finally {
      setExportLoading(false);
    }
  };
  
  // Copy Deal Memo to clipboard
  const handleCopyMemo = async () => {
    setMemoLoading(true);
    try {
      const headers = await getAuthHeaders();
      const url = `${API_BASE}/api/matches/memo?startup_id=${startupId}`;
      
      const response = await fetch(url, { headers });
      if (!response.ok) {
        if (response.status === 403) {
          setUpgradeModal({ open: true, moment: 'deal_memo' });
          return;
        }
        throw new Error('Memo failed');
      }
      
      const { memo } = await response.json();
      await navigator.clipboard.writeText(memo);
      setCopyState('memo');
      setTimeout(() => setCopyState('idle'), 2000);
      showToast('✅ Deal Memo copied to clipboard');
      analytics.dealMemoCopied(startupId || undefined);
    } catch (err) {
      console.error('Memo error:', err);
      showToast('❌ Failed to copy memo');
    } finally {
      setMemoLoading(false);
    }
  };
  
  // Create share link and copy to clipboard
  const handleShare = async () => {
    setShareLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE}/api/share/matches`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ startup_id: startupId, limit: 10 })
      });
      
      if (!response.ok) {
        if (response.status === 403) {
          setUpgradeModal({ open: true, moment: 'share_matches' });
          return;
        }
        const data = await response.json();
        if (data.error?.includes('table not found')) {
          showToast('⚠️ Share feature coming soon');
          return;
        }
        throw new Error('Share failed');
      }
      
      const { url, share_id } = await response.json();
      await navigator.clipboard.writeText(url);
      setCopyState('share');
      setTimeout(() => setCopyState('idle'), 2000);
      showToast('✅ Share link copied (expires in 7 days)');
      analytics.shareCreated(share_id || startupId || 'unknown');
    } catch (err) {
      console.error('Share error:', err);
      showToast('❌ Failed to create share link');
    } finally {
      setShareLoading(false);
    }
  };
  
  return (
    <>
    <div className="flex items-center gap-2 relative">
      {/* Export CSV */}
      <button 
        onClick={handleExportCSV}
        disabled={exportLoading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30 hover:bg-amber-500/30 transition-colors disabled:opacity-50"
        title="Export all matches to CSV"
      >
        {exportLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">CSV</span>
      </button>
      
      {/* Deal Memo */}
      <button 
        onClick={handleCopyMemo}
        disabled={memoLoading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-violet-500/20 text-violet-400 rounded-lg border border-violet-500/30 hover:bg-violet-500/30 transition-colors disabled:opacity-50"
        title="Copy investor-ready deal memo"
      >
        {memoLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : copyState === 'memo' ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <FileText className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">Memo</span>
      </button>
      
      {/* Share Link */}
      <button 
        onClick={handleShare}
        disabled={shareLoading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors disabled:opacity-50"
        title="Create shareable link (7-day expiry)"
      >
        {shareLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : copyState === 'share' ? (
          <Check className="w-3.5 h-3.5" />
        ) : (
          <Share2 className="w-3.5 h-3.5" />
        )}
        <span className="hidden sm:inline">Share</span>
      </button>
      
      {/* Toast notification */}
      {toast && (
        <div className="absolute top-full right-0 mt-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg shadow-lg whitespace-nowrap z-50 animate-fade-in">
          {toast}
        </div>
      )}
    </div>
    
    {/* Upgrade Modal */}
    <UpgradeModal
      moment={upgradeModal.moment}
      open={upgradeModal.open}
      onClose={() => setUpgradeModal({ ...upgradeModal, open: false })}
    />
    </>
  );
}

export default function InstantMatches() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isLoggedIn = !!user;
  const urlParam = searchParams.get('url') || '';
  const allMatchesRef = useRef<HTMLDivElement>(null);
  
  // Analysis state (resolving startup from URL)
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [startup, setStartup] = useState<AnalyzedStartup | null>(null);
  const [startupId, setStartupId] = useState<string | null>(null);
  const [similarStartups, setSimilarStartups] = useState<SimilarStartup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [whyExpanded, setWhyExpanded] = useState(false); // "Why we matched" toggle
  
  // Get plan tier for UI decisions
  const plan = getPlan(user);
  const visibility = getMatchVisibility(plan);
  
  // Use gated matches hook (fetches from /api/matches when startupId is set)
  const { 
    matches: gatedMatches, 
    loading: matchesLoading, 
    error: matchesError,
    plan: serverPlan,
    showing,
    total,
    upgradeCTA
  } = useMatches(startupId);

  // Fetch signal history for daily deltas + sparklines
  const signalHistory = useSignalHistory(startupId, 14);

  // Run analysis on mount - reset state when URL changes
  useEffect(() => {
    if (!urlParam) {
      navigate('/match');
      return;
    }
    
    // Reset all state when URL changes (deterministic refresh)
    setStartup(null);
    setStartupId(null);
    setSimilarStartups([]);
    setError(null);
    setIsAnalyzing(true);
    setAnalysisStep(0);
    
    analyzeAndMatch();
  }, [urlParam]);

  // Animate through analysis steps
  useEffect(() => {
    if (!isAnalyzing) return;
    
    const stepDurations = ANALYSIS_STEPS.map(s => s.duration);
    let currentStep = 0;
    
    const advanceStep = () => {
      if (currentStep < ANALYSIS_STEPS.length - 1) {
        currentStep++;
        setAnalysisStep(currentStep);
        setTimeout(advanceStep, stepDurations[currentStep]);
      }
    };
    
    setTimeout(advanceStep, stepDurations[0]);
  }, [isAnalyzing]);

  const analyzeAndMatch = async () => {
    try {
      // Use the proper startup resolver to create/find the startup record
      // This handles: existing startups, LinkedIn/Crunchbase URLs, and creates new records
      // waitForEnrichment: true = waits for inference engine to calculate real GOD score
      console.log('[matches] url:', urlParam);
      console.log('[matches] session:', user?.email || 'not logged in');
      console.log('[matches] plan:', plan);
      const result = await resolveStartupFromUrl(urlParam, { waitForEnrichment: true });

      if (!result) {
        console.error('[InstantMatches] Failed to resolve URL:', urlParam);
        setError(`Could not resolve this URL. Please check it's a valid website, LinkedIn, or Crunchbase URL.`);
        setIsAnalyzing(false);
        return;
      }
      
      console.log('[matches] startupId:', result.startup.id);
      console.log('[InstantMatches] Resolved startup:', result.startup.name, 'GOD Score:', result.startup.total_god_score, 'confidence:', result.confidence);

      // Set the startup for display
      const resolvedStartup: AnalyzedStartup = {
        id: result.startup.id,
        name: result.startup.name || 'Unknown Startup',
        website: result.startup.website || urlParam,
        tagline: result.startup.tagline || undefined,
        sectors: result.startup.sectors || ['Technology'],
        stage: result.startup.stage ? ['', 'Pre-seed', 'Seed', 'Series A', 'Series B', 'Series C+'][result.startup.stage] : 'Seed',
        total_god_score: result.startup.total_god_score || 60,
        signals: result.startup.signals || undefined
      };
      setStartup(resolvedStartup);

      // Set startupId to trigger the useMatches hook
      // The hook will fetch gated matches from /api/matches with proper tier enforcement
      setStartupId(result.startup.id);
      console.log('[matches] Set startupId, useMatches will fetch gated data');

      // Fetch similar startups in same sectors (not gated)
      const startupSectors = result.startup.sectors || ['Technology'];
      if (startupSectors.length > 0) {
        const { data: similar } = await supabase
          .from('startup_uploads')
          .select('id, name, tagline, sectors, total_god_score')
          .eq('status', 'approved')
          .neq('id', result.startup.id)
          .overlaps('sectors', startupSectors)
          .order('total_god_score', { ascending: false })
          .limit(5);
        
        if (similar) {
          // Convert null to undefined for type compatibility
          setSimilarStartups(similar.map(s => ({
            ...s,
            tagline: s.tagline ?? undefined,
            sectors: s.sectors ?? undefined,
            total_god_score: s.total_god_score ?? undefined
          })));
        }
      }

      // Brief delay for animation to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsAnalyzing(false);
      
      // Track matches page view with startup ID
      analytics.matchesPageViewed(result.startup.id);
      
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze. Please try again.');
      setIsAnalyzing(false);
    }
  };

  const formatCheckSize = (min?: number, max?: number) => {
    if (!min && !max) return 'Undisclosed';
    
    const formatAmount = (amt: number) => {
      if (amt >= 1000000) return `$${(amt / 1000000).toFixed(0)}M`;
      if (amt >= 1000) return `$${(amt / 1000).toFixed(0)}K`;
      return `$${amt}`;
    };
    
    const minStr = min ? formatAmount(min) : '$0';
    const maxStr = max ? formatAmount(max) : '$10M+';
    return `${minStr} - ${maxStr}`;
  };

  // Generate match reasons based on overlap
  const generateMatchReasons = (startup: any, investor: any, score: number): string[] => {
    const reasons: string[] = [];
    
    // Sector match
    const startupSectors = startup?.sectors || [];
    const investorSectors = investor?.sectors || [];
    const sectorOverlap = startupSectors.filter((s: string) => 
      investorSectors.some((is: string) => is.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(is.toLowerCase()))
    );
    if (sectorOverlap.length > 0) {
      reasons.push(`🎯 Sector fit: ${sectorOverlap[0]}`);
    }
    
    // Stage match
    const startupStage = startup?.stage || 'Seed';
    const investorStages = investor?.stage || [];
    if (investorStages.some((s: string) => s.toLowerCase().includes(startupStage.toLowerCase()))) {
      reasons.push(`📈 Stage alignment: ${startupStage}`);
    }
    
    // Check size fit
    if (investor?.check_size_min || investor?.check_size_max) {
      reasons.push(`💰 Check size compatible`);
    }
    
    // High score bonus
    if (score >= 85) {
      reasons.push(`⭐ Top-tier match score`);
    } else if (score >= 75) {
      reasons.push(`✨ Strong match potential`);
    }

    // Add generic reason if none found
    if (reasons.length === 0) {
      reasons.push(`🤝 Investment thesis alignment`);
    }

    return reasons.slice(0, 3);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
    if (score >= 80) return 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30';
    if (score >= 70) return 'text-violet-400 bg-violet-500/20 border-violet-500/30';
    return 'text-gray-400 bg-gray-500/20 border-gray-500/30';
  };

  // Loading state - wait for both startup resolution AND match fetching
  if (isAnalyzing || matchesLoading) {
    const currentStep = ANALYSIS_STEPS[analysisStep];
    const CurrentIcon = currentStep.icon;
    const isBrainStep = currentStep.isBrain;
    
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          {/* Animated icon - special treatment for brain steps */}
          <div className="mb-8 relative">
            {isBrainStep ? (
              // Spinning brain for inference/scoring steps
              <div className="w-28 h-28 mx-auto relative">
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-600/30 to-cyan-600/30 animate-pulse" />
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-600/20 border-2 border-violet-500/50 flex items-center justify-center">
                  <Brain className="w-14 h-14 text-violet-400 animate-pulse" />
                </div>
                <div className="absolute inset-0 w-28 h-28 rounded-full border-4 border-violet-500/60 border-t-cyan-400 animate-spin" style={{ animationDuration: '1s' }} />
                <div className="absolute inset-[-4px] w-[120px] h-[120px] rounded-full border-2 border-cyan-500/30 border-b-transparent animate-spin" style={{ animationDuration: '2s', animationDirection: 'reverse' }} />
              </div>
            ) : (
              // Regular icon for other steps
              <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-violet-600/20 to-cyan-600/20 border border-violet-500/30 flex items-center justify-center">
                <CurrentIcon className="w-10 h-10 text-violet-400 animate-pulse" />
              </div>
            )}
            {!isBrainStep && (
              <div className="absolute inset-0 w-24 h-24 mx-auto rounded-full border-2 border-violet-500/50 border-t-transparent animate-spin" />
            )}
          </div>

          {/* Current step */}
          <h2 className={`text-xl font-semibold mb-2 ${isBrainStep ? 'text-violet-300' : 'text-white'}`}>
            {currentStep.text}
          </h2>
          <p className="text-gray-400 text-sm mb-6">
            {isBrainStep ? (
              <span className="text-violet-400">Finding investors for <span className="text-cyan-400 font-medium">{urlParam}</span></span>
            ) : (
              <>Checking <span className="text-cyan-400 font-medium">{urlParam}</span></>
            )}
          </p>

          {/* Progress dots */}
          <div className="flex justify-center gap-2">
            {ANALYSIS_STEPS.map((step, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i < analysisStep 
                    ? 'bg-green-500 scale-100' 
                    : i === analysisStep 
                      ? (step.isBrain ? 'bg-violet-500 scale-125 animate-pulse' : 'bg-violet-500 scale-100')
                      : 'bg-gray-700 scale-75'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <span className="text-2xl">❌</span>
          </div>
          <h2 className="text-xl font-semibold text-white mb-2">Analysis Failed</h2>
          <p className="text-gray-400 mb-6">{error || matchesError}</p>
          <Link
            to="/match"
            className="inline-flex items-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors"
          >
            Try Again
          </Link>
        </div>
      </div>
    );
  }

  // Use gated matches from server
  const matches = gatedMatches;
  const displayPlan = serverPlan || plan;

  // ================================
  // DOCTRINE METRICS (Founder GPS)
  // ================================

  // Readiness = GOD score (reframed)
  const readiness = clamp(Math.round(startup?.total_god_score ?? 60), 0, 100);

  // Signal Strength = mean of top 5 alignment scores (proxy for "how investors will respond")
  const signalStrength = useMemo(() => {
    if (!matches?.length) return 50;
    const top = matches.slice(0, Math.min(5, matches.length));
    const avg = top.reduce((acc, m) => acc + (m.match_score || 0), 0) / top.length;
    return clamp(Math.round(avg), 0, 100);
  }, [matches]);

  // Power Score = SignalStrength × Readiness normalized
  const powerScore = useMemo(() => {
    return clamp(Math.round((signalStrength * readiness) / 100), 0, 100);
  }, [signalStrength, readiness]);

  const fundraisingWindow = useMemo(() => computeFundraisingWindow(powerScore), [powerScore]);

  // Daily progress visibility (REAL DATA)
  const dailyDelta = signalHistory.deltaToday;
  const lastUpdatedLabel = signalHistory.lastUpdatedLabel;
  const windowTransition = signalHistory.transition;

  // V5.5: Verdict copy based on window
  const verdictCopy = useMemo(() => {
    if (powerScore >= 85) return {
      headline: "You're in a Prime window",
      subtext: "Conversion probability is highest now. Move with a focused raise narrative.",
      confidence: "High",
      action: "Send outreach this week"
    };
    if (powerScore >= 65) return {
      headline: "Your window is Forming",
      subtext: "Signals are building. Start warm intros to your top targets.",
      confidence: "Medium",
      action: "Begin warm outreach"
    };
    if (powerScore >= 40) return {
      headline: "You're Too Early",
      subtext: "Strengthen proof before broad outreach. Target seed scouts first.",
      confidence: "Low",
      action: "Build proof signals"
    };
    return {
      headline: "You're not circulating yet",
      subtext: "Focus on traction and independent validation before investor outreach.",
      confidence: "Low",
      action: "Create proof points"
    };
  }, [powerScore]);

  // V5.5: Trust proof signals (detected from startup data)
  const trustSignals = useMemo(() => {
    const signals: string[] = [];
    if (startup?.signals?.length) {
      signals.push(...startup.signals.slice(0, 4));
    }
    // Add inferred signals based on data
    if (matches?.length >= 10) signals.push("Portfolio adjacency");
    if (powerScore >= 65) signals.push("Category heat");
    if (readiness >= 70) signals.push("Execution cadence");
    return signals.slice(0, 5);
  }, [startup, matches, powerScore, readiness]);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* ================================
          V5.5 VERDICT BAR (Plot Anchor)
         ================================ */}
      <div className={`border-b ${
        powerScore >= 85 ? 'bg-emerald-950/50 border-emerald-800' :
        powerScore >= 65 ? 'bg-amber-950/50 border-amber-800' :
        'bg-gray-900/50 border-gray-800'
      }`}>
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-4">
              {/* Big Power Score */}
              <div className={`text-5xl font-black ${
                powerScore >= 65 ? 'text-emerald-400' :
                powerScore >= 40 ? 'text-amber-400' :
                'text-red-400'
              }`}>
                {powerScore}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 text-xs font-bold rounded uppercase ${
                    powerScore >= 85 ? 'bg-emerald-500/30 text-emerald-300' :
                    powerScore >= 65 ? 'bg-amber-500/30 text-amber-300' :
                    'bg-gray-500/30 text-gray-300'
                  }`}>
                    {fundraisingWindow.label}
                  </span>
                  <span className="text-xs text-gray-500">
                    Confidence: {verdictCopy.confidence}
                  </span>
                </div>
                <h1 className="text-lg font-bold text-white mt-1">{verdictCopy.headline}</h1>
                <p className="text-sm text-gray-400">{verdictCopy.subtext}</p>
              </div>
            </div>
            {/* Daily delta + action hint */}
            <div className="flex items-center gap-4">
              {dailyDelta !== 0 && (
                <div className={`text-sm font-semibold ${dailyDelta > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {dailyDelta > 0 ? `+${dailyDelta}` : dailyDelta} today
                </div>
              )}
              <div className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                powerScore >= 65 ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                'bg-gray-500/20 text-gray-300 border border-gray-500/30'
              }`}>
                → {verdictCopy.action}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Header with plan badge */}
      <div className="border-b border-gray-800 bg-[#0f0f0f]">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/match" className="text-gray-400 hover:text-white transition-colors">
                ← Back
              </Link>
              <div className="w-px h-6 bg-gray-700" />
              <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-violet-400" />
                  Your top investors — ranked by timing + fit
                </h1>
                <p className="text-sm text-gray-400">
                  Know who to target, when to raise, and how close you are.
                </p>
              </div>
            </div>
            {/* Plan badge */}
            <div className="flex items-center gap-2">
              {displayPlan === 'elite' && (
                <span className="px-3 py-1 text-xs bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-400 rounded-full border border-amber-500/30 flex items-center gap-1">
                  <Crown className="w-3 h-3" /> Elite
                </span>
              )}
              {displayPlan === 'pro' && (
                <span className="px-3 py-1 text-xs bg-cyan-500/20 text-cyan-400 rounded-full border border-cyan-500/30">
                  Pro
                </span>
              )}
              {displayPlan === 'free' && (
                <span className="px-3 py-1 text-xs bg-gray-500/20 text-gray-400 rounded-full border border-gray-500/30">
                  Free Preview
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* STARTUP CARD - Full width, prominent */}
        {startup && (
          <div className="mb-6 p-5 bg-gradient-to-r from-[#0f0f0f] via-[#131313] to-[#0f0f0f] border border-violet-500/30 rounded-xl shadow-lg shadow-violet-500/10">
            <div className="flex flex-col md:flex-row md:items-start gap-4">
              {/* Left: Icon + Name + URL */}
              <div className="flex items-start gap-4 flex-1">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-600/30 to-cyan-600/30 border border-violet-500/30 flex items-center justify-center shrink-0">
                  <Building2 className="w-7 h-7 text-violet-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-white">{startup.name}</h2>
                  <a href={startup.website} target="_blank" rel="noopener noreferrer" className="text-gray-400 text-sm flex items-center gap-1.5 hover:text-cyan-400 transition-colors">
                    <Globe className="w-4 h-4" />
                    <span>{startup.website?.replace('https://', '').replace('http://', '')}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  
                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {startup.sectors?.slice(0, 3).map((sector, i) => (
                      <span key={i} className="px-2 py-0.5 text-xs bg-violet-500/20 text-violet-300 rounded-full border border-violet-500/30">
                        {sector}
                      </span>
                    ))}
                    {startup.stage && (
                      <span className="px-2 py-0.5 text-xs bg-cyan-500/20 text-cyan-300 rounded-full border border-cyan-500/30">
                        {startup.stage}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Right: Discovery Status (replaces GOD Score) */}
              {startup.total_god_score && (
                <div className="text-center md:text-right shrink-0 min-w-[160px]">
                  {/* Discovery Status Pill */}
                  <div className={`inline-block px-4 py-2 rounded-full text-sm font-semibold mb-2 ${
                    startup.total_god_score >= 70 
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                      : startup.total_god_score >= 50 
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-gray-500/20 text-gray-400 border border-gray-500/30'
                  }`}>
                    {startup.total_god_score >= 70 
                      ? "You're actively appearing" 
                      : startup.total_god_score >= 50 
                        ? "You're starting to surface"
                        : "You're not circulating yet"}
                  </div>
                  <div className="text-xs text-gray-500 mt-1 max-w-[160px]">
                    in investor discovery
                  </div>
                  {/* GOD number only, no explanation */}
                  <div className="text-lg font-bold text-gray-600 mt-2">
                    GOD: {startup.total_god_score}
                  </div>
                </div>
              )}
            </div>
            
            {/* Description */}
            {(startup.tagline || startup.description) && (
              <div className="mt-4 pt-4 border-t border-gray-800">
                {startup.tagline && startup.tagline !== `Startup at ${startup.website?.replace('https://', '').replace('http://', '')}` && (
                  <p className="text-gray-200 text-sm leading-relaxed">{startup.tagline}</p>
                )}
                {startup.description && (
                  <p className="text-gray-400 text-sm mt-2 leading-relaxed">{startup.description}</p>
                )}
              </div>
            )}
            
            {/* Detected signals */}
            {startup.signals && startup.signals.length > 0 && (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs text-emerald-400 font-semibold uppercase tracking-wider">What We Detected</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {startup.signals.map((signal, i) => (
                    <span key={i} className="px-2 py-1 text-xs bg-emerald-500/20 text-emerald-300 rounded-md">
                      {signal}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================================
            RESULTS FIRST (Founder GPS)
           ================================ */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {/* Power Score */}
          <div className="p-4 bg-[#0f0f0f] border border-gray-800 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className={`w-4 h-4 ${powerScore >= 65 ? 'text-emerald-400' : powerScore >= 40 ? 'text-amber-400' : 'text-red-400'}`} />
                <h3 className="text-sm font-bold text-white">Power Score</h3>
              </div>
              <span className="text-[10px] text-gray-500">{lastUpdatedLabel}</span>
            </div>

            <div className="flex items-end justify-between">
              <div className={`text-4xl font-extrabold ${
                powerScore >= 65 
                  ? 'text-emerald-400' 
                  : powerScore >= 40 
                    ? 'text-amber-400' 
                    : 'text-red-400'
              }`}>{powerScore}</div>
              <div className={`text-xs ${
                dailyDelta > 0 ? 'text-emerald-400' : dailyDelta < 0 ? 'text-red-400' : 'text-gray-500'
              }`}>
                {dailyDelta === 0 ? "—" : dailyDelta > 0 ? `+${dailyDelta}` : `${dailyDelta}`} today
              </div>
            </div>

            <div className="text-xs text-gray-500 mt-1">
              Signal Strength ({signalStrength}) × Readiness ({readiness})
            </div>

            {/* Sparkline (7-day trend) */}
            {signalHistory.sparklineData.length >= 2 && (
              <div className="mt-2 flex items-center gap-2">
                <PowerScoreSparkline 
                  data={signalHistory.sparklineData} 
                  width={60} 
                  height={20}
                  color={powerScore >= 65 ? '#10b981' : powerScore >= 40 ? '#f59e0b' : '#ef4444'}
                />
                <span className="text-[10px] text-gray-500">7-day trend</span>
              </div>
            )}

            <div className="mt-3 text-sm text-gray-300 leading-relaxed">
              {powerScore >= 85
                ? "You're in a high-conversion window. Send outreach this week."
                : powerScore >= 65
                ? "You're close. Warm outreach now; your best window is forming."
                : "You're early. Build proof + signal visibility before pitching broadly."}
            </div>
          </div>

          {/* Fundraising Window */}
          <div className="p-4 bg-[#0f0f0f] border border-gray-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-violet-400" />
              <h3 className="text-sm font-bold text-white">Fundraising Window</h3>
            </div>

            <div className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold ${tonePill(fundraisingWindow.tone)}`}>
              {fundraisingWindow.label}
            </div>

            {/* Window transition (THE DOPAMINE HIT) */}
            {windowTransition && (
              <div className="mt-2 text-xs text-cyan-400">
                Window changed: {windowTransition.from} → {windowTransition.to} 
                <span className="text-gray-500">({windowTransition.daysAgo === 0 ? 'today' : `${windowTransition.daysAgo} day${windowTransition.daysAgo > 1 ? 's' : ''} ago`})</span>
              </div>
            )}
            {!windowTransition && signalHistory.history.length > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                Window steady: {fundraisingWindow.label} (last {signalHistory.history.length} day{signalHistory.history.length > 1 ? 's' : ''})
              </div>
            )}

            <div className="mt-3 text-sm text-gray-300 leading-relaxed">
              {fundraisingWindow.guidance}
            </div>

            <div className="mt-3 text-xs text-gray-500">
              This is timing. It changes as signals + readiness change.
            </div>
          </div>

          {/* Distance to Targets */}
          <div className="p-4 bg-[#0f0f0f] border border-gray-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Top Targets This Week</h3>
            </div>

            {!matches?.length ? (
              <div className="text-sm text-gray-400">No targets yet.</div>
            ) : (
              <div className="space-y-2">
                {matches.slice(0, 3).map((m, idx) => (
                  <div key={m.investor_id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-300 truncate mr-2">
                      {m.investor_name_masked
                        ? m.firm
                          ? `Investor at ${m.firm}`
                          : `Investor #${idx + 1}`
                        : m.investor_name || m.firm || `Investor #${idx + 1}`}
                    </span>
                    <span className="text-gray-200 font-semibold">{m.match_score}%</span>
                  </div>
                ))}
                <div className="text-[11px] text-gray-500 pt-2 border-t border-gray-800">
                  Pick 3. Reach out with precision. Don't spray-and-pray.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* V5.5: TRUST PROOF SIGNALS (Compact Row) */}
        {trustSignals.length > 0 && (
          <div className="mb-6 p-3 bg-[#0f0f0f] border border-gray-800 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-gray-400 font-medium">Signals Detected</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {trustSignals.map((signal, i) => (
                <span key={i} className="px-2 py-1 text-xs bg-emerald-500/10 text-emerald-300 rounded border border-emerald-500/20">
                  {signal}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* V5.5: THIS WEEK PLAN (Enhanced with reasons) */}
        <div className="mb-6 p-5 bg-gradient-to-r from-violet-500/5 via-[#0f0f0f] to-cyan-500/5 border border-violet-500/30 rounded-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">This Week Plan</h3>
              <p className="text-xs text-gray-500">3 actions to move your fundraise forward</p>
            </div>
          </div>
          
          <div className="space-y-3">
            {powerScore >= 85 ? (
              <>
                <div className="flex items-start gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-white font-medium">Send outreach to your top 3 targets</p>
                    <p className="text-xs text-gray-500 mt-1">Why: Prime windows are short. These investors are warm now.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-violet-500/5 border border-violet-500/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-violet-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-white font-medium">Get one warm intro per target</p>
                    <p className="text-xs text-gray-500 mt-1">Why: Warm intros convert 8× better than cold outreach.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-white font-medium">Ship + announce one proof point</p>
                    <p className="text-xs text-gray-500 mt-1">Why: Momentum visibility keeps your window open longer.</p>
                  </div>
                </div>
              </>
            ) : powerScore >= 65 ? (
              <>
                <div className="flex items-start gap-3 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-white font-medium">Soft outreach to top 3: "here's what's coming"</p>
                    <p className="text-xs text-gray-500 mt-1">Why: Warm them up before your window opens fully.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-violet-500/5 border border-violet-500/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-violet-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-white font-medium">Add one validation signal (pilot, LOI, benchmark)</p>
                    <p className="text-xs text-gray-500 mt-1">Why: Independent proof is what moves investors from curious to committed.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-white font-medium">Tighten your 1-sentence wedge + why now</p>
                    <p className="text-xs text-gray-500 mt-1">Why: Clear narrative converts 3× better in soft outreach.</p>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3 p-3 bg-gray-500/5 border border-gray-500/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-white font-medium">Don't pitch broad VC lists yet</p>
                    <p className="text-xs text-gray-500 mt-1">Why: Low signal = low conversion. Build proof first.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-violet-500/5 border border-violet-500/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-violet-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-white font-medium">Create one sharp validation event</p>
                    <p className="text-xs text-gray-500 mt-1">Why: A pilot, customer, or benchmark is worth 100 cold emails.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-white font-medium">Target early-conviction angels in your sector</p>
                    <p className="text-xs text-gray-500 mt-1">Why: They bet on category + team, not just traction.</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* V5.5: SINGLE PRIMARY CTA */}
        <div className="mb-6">
          {isLoggedIn ? (
            <Link
              to={`/saved-matches`}
              className="flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 rounded-xl transition-all group"
            >
              <span className="text-white font-bold text-lg">View Full Target List</span>
              <ArrowRight className="w-5 h-5 text-white group-hover:translate-x-1 transition-transform" />
            </Link>
          ) : (
            <Link
              to={`/signup?url=${encodeURIComponent(urlParam)}&matches=${matches.length}`}
              className="flex items-center justify-center gap-3 p-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 rounded-xl transition-all group"
            >
              <span className="text-black font-bold text-lg">Unlock Your {matches.length} Investor Matches</span>
              <ArrowRight className="w-5 h-5 text-black group-hover:translate-x-1 transition-transform" />
            </Link>
          )}
          <p className="text-xs text-gray-600 text-center mt-2">No pitch deck. No spam. No intros sent without your approval.</p>
        </div>

        {/* WHAT THIS MEANS FOR YOU - Dynamic copy based on backend state */}
        <div className="mb-6 p-4 bg-gradient-to-r from-violet-500/5 via-[#0f0f0f] to-cyan-500/5 border border-violet-500/20 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center shrink-0">
              <Brain className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white mb-2">
                What this means for you
              </h3>
              <p className="text-sm text-gray-300 leading-relaxed">
                {startup && startup.total_god_score ? (
                  startup.total_god_score >= 70 ? (
                    <>You're appearing in investor discovery. Attention is real — but fragile without reinforcement.</>
                  ) : startup.total_god_score >= 50 ? (
                    <>Investors tend to notice teams like yours when early proof or external signals become visible.</>
                  ) : (
                    <>Startups like yours are often discovered quietly before customer traction. Silence here is normal — until independent validation appears.</>
                  )
                ) : (
                  <>We're reading the signals. Your discovery status will update as data comes in.</>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* WHAT CHANGES INVESTOR ATTENTION - Two-column static layout */}
        <div className="mb-6 p-4 bg-[#0f0f0f] border border-gray-800 rounded-xl">
          <h3 className="text-sm font-bold text-white mb-4">What changes investor attention</h3>
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left: To increase discovery */}
            <div>
              <p className="text-xs text-emerald-400 uppercase tracking-wider mb-2 font-semibold">To increase discovery</p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  Independent validation (pilot, audit, partnership)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  Clear technical proof
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 mt-0.5">•</span>
                  Consistent forward motion
                </li>
              </ul>
            </div>
            {/* Right: What weakens discovery */}
            <div>
              <p className="text-xs text-red-400 uppercase tracking-wider mb-2 font-semibold">What weakens discovery</p>
              <ul className="space-y-2 text-sm text-gray-400">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  Prolonged silence
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  Capital without follow-through
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-0.5">•</span>
                  Key technical or founder departures
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* MATCHES LIST - Tier-gated */}
        <div className="mb-6" ref={allMatchesRef}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                <Star className="w-4 h-4 text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-white">
                {displayPlan === 'elite' ? 'All Matches' : displayPlan === 'pro' ? 'Top 10 Matches' : 'Top 3 Matches'}
              </h3>
              <span className={`px-2 py-0.5 text-[10px] rounded-full border uppercase ${
                displayPlan === 'elite' 
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                  : displayPlan === 'pro'
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              }`}>
                {displayPlan === 'free' ? 'Free Preview' : displayPlan}
              </span>
            </div>
            {/* Elite-only action buttons */}
            {displayPlan === 'elite' && visibility.canExport && startupId && (
              <EliteActionsBar startupId={startupId} startupName={startup?.name || 'startup'} />
            )}
          </div>

          <div className="grid gap-3">
            {matches.map((match, index) => (
              <InvestorAlignmentCard
                key={match.investor_id}
                match={match}
                index={index}
                visibility={{
                  showCheckSize: visibility.showCheckSize,
                  showReason: visibility.showReason,
                  showConfidence: visibility.showConfidence,
                  showNotableInvestments: visibility.showNotableInvestments,
                }}
              />
            ))}
          </div>
        </div>

        {/* WHY WE MATCHED YOU - Collapsible diagnostic toggle */}
        <div className="mb-6">
          <button
            onClick={() => setWhyExpanded(!whyExpanded)}
            className="w-full p-4 bg-[#0f0f0f] border border-gray-800 rounded-xl hover:border-gray-700 transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                  <HelpCircle className="w-4 h-4 text-violet-400" />
                </div>
                <span className="text-sm font-semibold text-gray-300 group-hover:text-white transition-colors">
                  Why we matched you
                </span>
              </div>
              {whyExpanded ? (
                <ChevronUp className="w-5 h-5 text-gray-500 group-hover:text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-500 group-hover:text-gray-400" />
              )}
            </div>
          </button>
          
          {whyExpanded && (
            <div className="mt-3 p-4 bg-[#0a0a0a] border border-gray-800 rounded-xl">
              <p className="text-sm text-gray-400 mb-4">
                We analyzed your startup against <strong className="text-white">{total || matches.length} investors</strong> based on:
              </p>
              <ul className="space-y-2 text-sm text-gray-400 mb-4">
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5">•</span>
                  <strong className="text-gray-300">Sector alignment</strong> — Do they invest in your space?
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5">•</span>
                  <strong className="text-gray-300">Stage fit</strong> — Are they writing checks at your stage?
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5">•</span>
                  <strong className="text-gray-300">Signal strength</strong> — Are they actively looking at similar deals?
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-violet-400 mt-0.5">•</span>
                  <strong className="text-gray-300">Readiness (GOD Score)</strong> — Is your startup ready for their attention?
                </li>
              </ul>
              <Link
                to={`/why?url=${encodeURIComponent(urlParam)}`}
                className="inline-flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
              >
                View full diagnostic
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}
        </div>

        {/* UPGRADE CTA - Only if not elite */}
        {upgradeCTA.show && (
          <div className="mb-6 p-5 bg-gradient-to-r from-amber-600/10 via-[#0f0f0f] to-violet-600/10 border border-amber-500/40 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <Crown className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">{upgradeCTA.text}</h3>
                <p className="text-sm text-gray-400">{upgradeCTA.subtext}</p>
              </div>
            </div>
            <Link
              to="/pricing"
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-semibold rounded-lg transition-all text-sm"
            >
              Upgrade Now
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}

        {/* Bottom CTA */}
        <div className="mt-8 p-6 bg-gradient-to-r from-violet-600/10 via-[#0f0f0f] to-cyan-600/10 border border-violet-500/20 rounded-xl text-center">
          {isLoggedIn ? (
            <>
              <h3 className="text-lg font-semibold text-white mb-2">Signals update daily</h3>
              <p className="text-gray-400 text-sm mb-4">
                Track which investors are warming — and share with your advisors
              </p>
              <Link
                to="/saved-matches"
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-semibold rounded-lg transition-all"
              >
                View All Signals
                <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold text-white mb-2">Track how your alignment changes</h3>
              <p className="text-gray-400 text-sm mb-4">
                Sign in to save these signals, see which investors are warming, and share with advisors
              </p>
              <Link
                to={`/signup?url=${encodeURIComponent(urlParam)}&matches=${matches.length}`}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold rounded-lg transition-all"
              >
                Create Free Account
                <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
