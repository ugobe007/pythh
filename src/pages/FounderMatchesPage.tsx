/**
 * FOUNDER MATCHES PAGE
 * ====================
 * Supabase-style dark theme - TIGHT formatting
 * - URL submit bar always visible
 * - Compact stats row
 * - Pipeline: Match → Signal Alignment → Outreach → Meeting → Term Sheet
 * - Clean table with minimal padding
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { 
  Search, 
  TrendingUp, 
  Bookmark, 
  Lock,
  Unlock,
  ExternalLink,
  Star,
  Calendar,
  FileText,
  Send,
  CheckCircle,
  ChevronRight,
  RefreshCw,
  Info,
  Zap
} from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import MatchHeatMap, { SectorMatch } from '../components/MatchHeatMap';

// Pipeline stages
const PIPELINE_STAGES = [
  { id: 'match', label: 'Match', icon: Star },
  { id: 'signal', label: 'Signal', icon: TrendingUp },
  { id: 'outreach', label: 'Outreach', icon: Send },
  { id: 'meeting', label: 'Meeting', icon: Calendar },
  { id: 'term_sheet', label: 'Term Sheet', icon: FileText },
];

interface MatchRow {
  rank: number;
  investor_id: string;
  investor_name: string;
  fit_bucket: string;
  momentum_bucket: string;
  signal_score: number;
  why_summary: string;
  is_locked: boolean;
  is_fallback: boolean;
}

interface PipelineCount {
  match: number;
  signal: number;
  outreach: number;
  meeting: number;
  term_sheet: number;
}

// Engine carousel types
interface EngineMatchRow {
  id: string;
  match_score: number;
  startup_id: string;
  investor_id: string;
  reasoning: string[] | string | null;
  startup: { 
    id: string; 
    name: string; 
    tagline: string | null; 
    sectors: string[] | null; 
    stage: string | null; 
    total_god_score: number | null; 
    enhanced_god_score?: number | null;
    psychological_multiplier?: number | null;
    is_oversubscribed?: boolean | null;
    has_followon?: boolean | null;
    is_competitive?: boolean | null;
    is_bridge_round?: boolean | null;
    has_sector_pivot?: boolean | null;
    has_social_proof_cascade?: boolean | null;
    is_repeat_founder?: boolean | null;
    has_cofounder_exit?: boolean | null;
  };
  investor: { id: string; name: string; firm: string | null; sectors: string[] | null; stage: string[] | null; check_size_min: number | null; check_size_max: number | null; type: string | null; };
}

function engineScoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-400';
  if (score >= 50) return 'text-cyan-400';
  if (score >= 30) return 'text-amber-400';
  return 'text-zinc-400';
}
function engineScoreBg(score: number): string {
  if (score >= 75) return 'bg-emerald-500/10 border-emerald-500/20';
  if (score >= 50) return 'bg-cyan-500/10 border-cyan-500/20';
  if (score >= 30) return 'bg-amber-500/10 border-amber-500/20';
  return 'bg-zinc-500/10 border-zinc-500/20';
}
function fmtCheck(min?: number | null, max?: number | null): string {
  if (!min && !max) return '—';
  const f = (n: number) => { if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`; if (n >= 1_000) return `$${Math.round(n / 1_000)}k`; return `$${n}`; };
  return `${min ? f(min) : '$0'} – ${max ? f(max) : '$10M+'}`;
}
function parseReasoning(r: string[] | string | null): string[] {
  if (!r) return [];
  if (Array.isArray(r)) return r.filter((s) => typeof s === 'string' && s.trim());
  if (typeof r === 'string') { try { const parsed = JSON.parse(r); if (Array.isArray(parsed)) return parsed; } catch { return [r.trim()]; } }
  return [];
}

// Example matches shown when no startup selected (never empty page!)
// All unlocked - matching database behavior after Feb 2026 migration
const EXAMPLE_MATCHES: MatchRow[] = [
  { rank: 1, investor_id: 'demo-1', investor_name: 'Sequoia Capital · AI Fund', fit_bucket: 'strong', momentum_bucket: 'strong', signal_score: 8.7, why_summary: 'Series A focus, AI/ML vertical alignment, recent fund deployment', is_locked: false, is_fallback: false },
  { rank: 2, investor_id: 'demo-2', investor_name: 'Andreessen Horowitz', fit_bucket: 'strong', momentum_bucket: 'emerging', signal_score: 8.2, why_summary: 'Enterprise SaaS thesis match, portfolio synergies identified', is_locked: false, is_fallback: false },
  { rank: 3, investor_id: 'demo-3', investor_name: 'First Round Capital', fit_bucket: 'good', momentum_bucket: 'strong', signal_score: 7.9, why_summary: 'Seed specialist with developer tools expertise', is_locked: false, is_fallback: false },
  { rank: 4, investor_id: 'demo-4', investor_name: 'Bessemer Venture Partners', fit_bucket: 'good', momentum_bucket: 'emerging', signal_score: 7.4, why_summary: 'Cloud infrastructure focus, active in your geography', is_locked: false, is_fallback: false },
  { rank: 5, investor_id: 'demo-5', investor_name: 'Index Ventures', fit_bucket: 'good', momentum_bucket: 'neutral', signal_score: 7.1, why_summary: 'B2B SaaS specialist, strong European presence', is_locked: false, is_fallback: false },
  { rank: 6, investor_id: 'demo-6', investor_name: 'Accel Partners', fit_bucket: 'moderate', momentum_bucket: 'emerging', signal_score: 6.8, why_summary: 'Growth stage focus, fintech vertical alignment', is_locked: false, is_fallback: true },
  { rank: 7, investor_id: 'demo-7', investor_name: 'General Catalyst', fit_bucket: 'moderate', momentum_bucket: 'neutral', signal_score: 6.5, why_summary: 'Healthcare technology thesis, portfolio company referrals', is_locked: false, is_fallback: true },
];

export default function FounderMatchesPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startupId, setStartupId] = useState<string | null>(null);
  const [startupName, setStartupName] = useState<string>('');
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ signal: 7.2, totalMatches: 127, saved: 3 }); // Demo stats
  const [pipeline, setPipeline] = useState<PipelineCount>({ match: 127, signal: 45, outreach: 12, meeting: 3, term_sheet: 0 }); // Demo pipeline
  const [fitFilter, setFitFilter] = useState<string>('all');
  const [showingDemo, setShowingDemo] = useState(true);
  const [platformStats, setPlatformStats] = useState({ total: 0, startups: 0, investors: 0 });

  // Engine carousel state
  const [engineMatches, setEngineMatches] = useState<EngineMatchRow[]>([]);
  const [engineLoading, setEngineLoading] = useState(true);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const urlStartupId = searchParams.get('startup');
    const savedStartupId = localStorage.getItem('pythh_current_startup_id');
    if (urlStartupId) {
      setStartupId(urlStartupId);
      loadMatches(urlStartupId);
    } else if (savedStartupId) {
      setStartupId(savedStartupId);
      loadMatches(savedStartupId);
    }
  }, [searchParams]);

  const handleSubmit = async () => {
    if (!url.trim()) { setUrlError('Enter your startup URL'); return; }
    // Always route to /signal-matches — it uses pythhRpc.resolveStartup()
    // which checks match_count and triggers Express backend for match generation
    navigate(`/signal-matches?url=${encodeURIComponent(url.trim())}`);
  };

  const loadMatches = async (sid: string) => {
    setLoading(true);
    setError(null);
    setShowingDemo(false);
    try {
      const { data, error: rpcError } = await supabase.rpc('get_live_match_table', {
        p_startup_id: sid, p_limit_unlocked: 5, p_limit_locked: 50
      });
      if (rpcError) throw rpcError;
      if (data && Array.isArray(data)) {
        setMatches(data);
        const signalAvg = data.length > 0 ? data.reduce((sum, m) => sum + (m.signal_score || 5), 0) / data.length : 5.0;
        setStats({
          signal: parseFloat(signalAvg.toFixed(1)),
          totalMatches: data.length,
          saved: data.filter(m => !m.is_locked).length
        });
        setPipeline({
          match: data.length,
          signal: data.filter(m => m.fit_bucket === 'strong' || m.fit_bucket === 'good').length,
          outreach: 0, meeting: 0, term_sheet: 0
        });
      }
      const { data: startupData } = await supabase.from('startup_uploads').select('name').eq('id', sid).single();
      if (startupData?.name) setStartupName(startupData.name);
    } catch (err: any) {
      console.error('Load matches error:', err);
      setError('Failed to load matches.');
    } finally {
      setLoading(false);
    }
  };

  const filteredMatches = useMemo(() => {
    if (fitFilter === 'all') return matches;
    return matches.filter(m => m.fit_bucket === fitFilter);
  }, [matches, fitFilter]);

  // Fetch engine matches for carousel
  const fetchEngineMatches = useCallback(async () => {
    try {
      setEngineLoading(true);
      setEngineError(null);
      const { data: matchData, error: matchErr } = await supabase
        .from('startup_investor_matches')
        .select('id, match_score, startup_id, investor_id, reasoning')
        .eq('status', 'suggested')
        .gte('match_score', 20)
        .order('match_score', { ascending: false })
        .limit(80);
      if (matchErr) throw matchErr;
      if (!matchData?.length) { setEngineError('Engine offline'); setEngineLoading(false); return; }
      const seen = new Map<string, (typeof matchData)[0]>();
      for (const m of matchData) { const k = `${m.startup_id}-${m.investor_id}`; const ex = seen.get(k); if (!ex || m.match_score > ex.match_score) seen.set(k, m); }
      const unique = Array.from(seen.values());
      const sIds = [...new Set(unique.map(m => m.startup_id).filter(Boolean))];
      const iIds = [...new Set(unique.map(m => m.investor_id).filter(Boolean))];
      const [sRes, iRes, platformRes] = await Promise.all([
        supabase.from('startup_uploads').select('id, name, tagline, sectors, stage, total_god_score, enhanced_god_score, psychological_multiplier, is_oversubscribed, has_followon, is_competitive, is_bridge_round, has_sector_pivot, has_social_proof_cascade, is_repeat_founder, has_cofounder_exit').in('id', sIds),
        supabase.from('investors').select('id, name, firm, sectors, stage, check_size_min, check_size_max, type').in('id', iIds),
        supabase.rpc('get_platform_stats'),
      ]);
      const sMap = new Map((sRes.data || []).map((s: any) => [s.id, s]));
      const iMap = new Map((iRes.data || []).map((i: any) => [i.id, i]));
      const usedS = new Set<string>(); const usedI = new Set<string>();
      const rows: EngineMatchRow[] = [];
      for (const m of unique) { const s = sMap.get(m.startup_id); const i = iMap.get(m.investor_id); if (!s || !i) continue; if (usedS.has(m.startup_id) || usedI.has(m.investor_id)) continue; usedS.add(m.startup_id); usedI.add(m.investor_id); rows.push({ ...m, startup: s, investor: i } as EngineMatchRow); }
      for (let x = rows.length - 1; x > 0; x--) { const j = Math.floor(Math.random() * (x + 1)); [rows[x], rows[j]] = [rows[j], rows[x]]; }
      setEngineMatches(rows);
      const p = platformRes.data || { startups: 0, investors: 0, matches: 0 };
      setPlatformStats({ total: p.matches || 0, startups: p.startups || 0, investors: p.investors || 0 });
    } catch (err: any) { setEngineError(err?.message || 'Failed to load engine'); } finally { setEngineLoading(false); }
  }, []);

  useEffect(() => { fetchEngineMatches(); }, [fetchEngineMatches]);

  // Auto-rotate carousel
  useEffect(() => {
    if (engineMatches.length === 0 || isPaused) return;
    const timer = setInterval(() => { setActiveIndex(prev => (prev + 1) % engineMatches.length); }, 6000);
    return () => clearInterval(timer);
  }, [engineMatches.length, isPaused]);

  const activeEngine = engineMatches[activeIndex] || null;
  const activeReasons = useMemo(() => activeEngine ? parseReasoning(activeEngine.reasoning) : [], [activeEngine]);

  // Live sector data from database
  const [liveSectorData, setLiveSectorData] = useState<SectorMatch[]>([]);
  
  // Load live sector distribution from database
  useEffect(() => {
    loadLiveSectorData();
  }, []);

  async function loadLiveSectorData() {
    try {
      // Get sector distribution from investors table
      const { data } = await supabase
        .from('investors')
        .select('sectors')
        .eq('status', 'active');
      
      if (data && data.length > 0) {
        // Count sectors across all investors
        const sectorCounts: Record<string, number> = {};
        data.forEach((inv: any) => {
          const sectors = inv.sectors || [];
          sectors.forEach((s: string) => {
            // Normalize sector names
            const normalized = normalizeSector(s);
            sectorCounts[normalized] = (sectorCounts[normalized] || 0) + 1;
          });
        });

        // Convert to SectorMatch format
        const maxCount = Math.max(...Object.values(sectorCounts), 100);
        const sectors: SectorMatch[] = [
          { id: '1', sector: 'AI/ML', count: sectorCounts['AI/ML'] || 0, maxCount, trend: 'up', quality: 'hot' },
          { id: '2', sector: 'Fintech', count: sectorCounts['Fintech'] || 0, maxCount, trend: 'up', quality: 'hot' },
          { id: '3', sector: 'SaaS', count: sectorCounts['SaaS'] || 0, maxCount, trend: 'flat', quality: 'warm' },
          { id: '4', sector: 'Security', count: sectorCounts['Security'] || 0, maxCount, trend: 'up', quality: 'warm' },
          { id: '5', sector: 'HealthTech', count: sectorCounts['HealthTech'] || 0, maxCount, trend: 'down', quality: 'warm' },
          { id: '6', sector: 'Climate', count: sectorCounts['Climate'] || 0, maxCount, trend: 'flat', quality: 'cold' },
          { id: '7', sector: 'DevTools', count: sectorCounts['DevTools'] || 0, maxCount, trend: 'up', quality: 'cold' },
        ];
        
        // Assign quality based on count
        sectors.forEach(s => {
          if (s.count > maxCount * 0.6) s.quality = 'hot';
          else if (s.count > maxCount * 0.3) s.quality = 'warm';
          else s.quality = 'cold';
        });
        
        setLiveSectorData(sectors);
      }
    } catch (err) {
      console.error('Failed to load sector data:', err);
    }
  }

  // Normalize sector names to our canonical list
  function normalizeSector(s: string): string {
    const lower = s.toLowerCase();
    if (lower.includes('ai') || lower.includes('ml') || lower.includes('machine learning') || lower.includes('artificial')) return 'AI/ML';
    if (lower.includes('fintech') || lower.includes('financial') || lower.includes('payments') || lower.includes('banking')) return 'Fintech';
    if (lower.includes('saas') || lower.includes('software') || lower.includes('enterprise')) return 'SaaS';
    if (lower.includes('security') || lower.includes('cyber') || lower.includes('privacy')) return 'Security';
    if (lower.includes('health') || lower.includes('medical') || lower.includes('biotech') || lower.includes('pharma')) return 'HealthTech';
    if (lower.includes('climate') || lower.includes('clean') || lower.includes('energy') || lower.includes('sustainability')) return 'Climate';
    if (lower.includes('dev') || lower.includes('developer') || lower.includes('tools') || lower.includes('infrastructure')) return 'DevTools';
    return 'SaaS'; // Default
  }

  // Use live data if available, otherwise let component show demo
  const sectorMatches = useMemo((): SectorMatch[] => {
    // If we have startup-specific matches, compute distribution from them
    if (matches.length > 0) {
      const strongMatches = matches.filter(m => m.fit_bucket === 'strong').length;
      const goodMatches = matches.filter(m => m.fit_bucket === 'good').length;
      const maxCount = Math.max(matches.length, 50);
      
      return [
        { id: '1', sector: 'AI/ML', count: Math.round(matches.length * 0.28), maxCount, trend: strongMatches > 5 ? 'up' : 'flat', quality: strongMatches > 10 ? 'hot' : strongMatches > 3 ? 'warm' : 'cold' },
        { id: '2', sector: 'Fintech', count: Math.round(matches.length * 0.22), maxCount, trend: goodMatches > 8 ? 'up' : 'flat', quality: goodMatches > 15 ? 'hot' : goodMatches > 5 ? 'warm' : 'cold' },
        { id: '3', sector: 'SaaS', count: Math.round(matches.length * 0.18), maxCount, trend: 'flat', quality: matches.length > 30 ? 'warm' : 'cold' },
        { id: '4', sector: 'Security', count: Math.round(matches.length * 0.12), maxCount, trend: strongMatches > 3 ? 'up' : 'down', quality: strongMatches > 5 ? 'warm' : 'cold' },
        { id: '5', sector: 'HealthTech', count: Math.round(matches.length * 0.10), maxCount, trend: 'flat', quality: 'cold' },
        { id: '6', sector: 'Climate', count: Math.round(matches.length * 0.06), maxCount, trend: 'down', quality: 'cold' },
        { id: '7', sector: 'DevTools', count: Math.round(matches.length * 0.04), maxCount, trend: 'up', quality: matches.length > 40 ? 'warm' : 'cold' },
      ];
    }
    
    // Return live sector data or empty (component will show demo)
    return liveSectorData;
  }, [matches, liveSectorData]);

  const getFitStyle = (fit: string) => {
    switch (fit) {
      case 'strong': return 'bg-emerald-500/20 text-emerald-400';
      case 'good': return 'bg-cyan-500/20 text-cyan-400';
      case 'moderate': return 'bg-amber-500/20 text-amber-400';
      default: return 'bg-zinc-700/50 text-zinc-400';
    }
  };

  const getMomentumStyle = (momentum: string) => {
    switch (momentum) {
      case 'strong': return 'text-emerald-400';
      case 'emerging': return 'text-cyan-400';
      default: return 'text-zinc-500';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-sm pb-20">
      {/* HEADER - consistent with PythhMain */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-zinc-800/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-white font-semibold">pythh.ai</Link>
            <span className="text-zinc-500 text-xs tracking-widest uppercase hidden sm:inline">Signal Science</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-zinc-400">
            <Link to="/signals" className="hover:text-white">Signals</Link>
            <span className="text-white">Engine</span>
            <Link to="/rankings" className="hover:text-white">Rankings</Link>
            <Link to="/how-it-works" className="hover:text-white">How it works</Link>
            <Link to="/signup" className="text-cyan-400 hover:text-cyan-300">Sign up</Link>
          </nav>
          <nav className="flex md:hidden items-center gap-3 text-sm text-zinc-400">
            <Link to="/signals" className="hover:text-white text-xs">Signals</Link>
            <span className="text-white text-xs">Engine</span>
            <Link to="/signup" className="text-cyan-400 hover:text-cyan-300 text-xs">Sign up</Link>
          </nav>
        </div>
      </header>

      {/* FLOATING URL BAR - Fixed at bottom - MORE NOTICEABLE */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900/98 backdrop-blur-lg border-t-2 border-cyan-500/60 shadow-[0_-4px_20px_rgba(6,182,212,0.15)]">
        <div className="max-w-6xl mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-500" />
              <input
                id="url-bar-input"
                type="text"
                value={url}
                onChange={e => { setUrl(e.target.value); setUrlError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                placeholder="yourstartup.com"
                className="w-full pl-12 pr-4 py-3 bg-zinc-900 border border-cyan-500/50 rounded-lg text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-cyan-400 transition shadow-[0_0_20px_rgba(34,211,238,0.15)] focus:shadow-[0_0_25px_rgba(34,211,238,0.3)]"
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 sm:px-8 py-3 sm:py-3.5 bg-transparent border border-cyan-500 text-cyan-400 font-semibold rounded-lg hover:bg-cyan-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all text-sm sm:text-base whitespace-nowrap"
            >
              {isSubmitting ? 'Finding...' : 'Find Signals →'}
            </button>
          </div>
          {urlError && <p className="text-red-400 text-sm mt-2">{urlError}</p>}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-4">
        {/* PAGE HEADLINE + LIVE ENGINE STATS */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="text-[11px] uppercase tracking-[1.5px] text-zinc-500">match engine</div>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[11px] text-emerald-400">Live</span>
              </span>
            </div>
            <h1 className="text-2xl sm:text-[32px] font-semibold text-zinc-100 leading-tight mb-2">
              Startup ↔ Investor Matching
            </h1>
            <p className="text-sm sm:text-base text-zinc-400">Real-time matching powered by GOD scores, signal analysis, and ML alignment.</p>
          </div>
          <div className="flex gap-4 sm:gap-6 sm:text-right pt-0 sm:pt-2 shrink-0">
            <div>
              <p className="text-xl sm:text-2xl font-bold text-white">{platformStats.total.toLocaleString()}</p>
              <p className="text-xs text-zinc-500">Matches</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-white">{platformStats.startups.toLocaleString()}</p>
              <p className="text-xs text-zinc-500">Startups</p>
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-white">{platformStats.investors.toLocaleString()}</p>
              <p className="text-xs text-zinc-500">Investors</p>
            </div>
          </div>
        </div>

        {/* Startup context */}
        {startupName && (
          <div className="mb-3 text-xs text-zinc-400">
            Showing matches for: <span className="text-white font-medium">{startupName}</span>
          </div>
        )}
        
        {/* STATS + PIPELINE ROW */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 mb-4 pb-4 border-b border-zinc-800">
          {/* Stats */}
          <div className="flex items-center gap-3 sm:gap-4 text-sm">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-zinc-400 hidden sm:inline">Signal:</span>
              <span className="text-cyan-400 font-bold">{stats.signal.toFixed(1)}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-zinc-400" />
              <span className="text-zinc-400 hidden sm:inline">Matches:</span>
              <span className="text-white font-bold">{stats.totalMatches}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-zinc-400 hidden sm:inline">Unlocked:</span>
              <span className="text-emerald-400 font-bold">{stats.saved}</span>
            </div>
          </div>
          
          <div className="hidden sm:block h-4 w-px bg-zinc-700" />
          
          {/* Pipeline — scroll on mobile */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1">
            {PIPELINE_STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const count = pipeline[stage.id as keyof PipelineCount];
              return (
                <div key={stage.id} className="flex items-center shrink-0">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded ${count > 0 ? 'bg-zinc-800' : 'opacity-40'}`}>
                    <Icon className="w-3 h-3 text-zinc-400" />
                    <span className="text-zinc-300 text-xs">{stage.label}</span>
                    <span className={`text-xs font-bold ${count > 0 ? 'text-cyan-400' : 'text-zinc-600'}`}>{count}</span>
                  </div>
                  {idx < PIPELINE_STAGES.length - 1 && <ChevronRight className="w-3 h-3 text-zinc-700 mx-0.5" />}
                </div>
              );
            })}
          </div>
        </div>

        {/* ——— LIVE ENGINE CAROUSEL ——————————————————————— */}
        <section className="mb-6">
          {engineLoading ? (
            <div className="border border-zinc-800 rounded-lg p-8 text-center">
              <RefreshCw className="w-5 h-5 text-zinc-500 animate-spin mx-auto mb-2" />
              <p className="text-zinc-400 text-xs">Loading engine output...</p>
            </div>
          ) : engineError ? (
            <div className="border border-red-500/20 bg-red-500/5 rounded-lg p-6 text-center">
              <Zap className="w-5 h-5 text-red-400 mx-auto mb-2" />
              <p className="text-red-300 font-medium text-sm mb-1">Engine Offline</p>
              <p className="text-zinc-500 text-xs">{engineError}</p>
              <button onClick={fetchEngineMatches} className="mt-3 px-3 py-1.5 text-xs border border-zinc-700 rounded hover:border-zinc-600 text-zinc-300 transition">Retry</button>
            </div>
          ) : activeEngine ? (
            <div
              className="border border-zinc-800 rounded-lg overflow-hidden hover:border-zinc-700 transition"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              <div className="px-4 py-2 bg-zinc-900/50 border-b border-zinc-800/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Zap className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-zinc-400 uppercase tracking-wider">
                    Match #{activeIndex + 1} of {engineMatches.length}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-mono font-bold ${engineScoreColor(activeEngine.match_score)}`}>
                    {activeEngine.match_score}%
                  </span>
                  <div className="flex gap-1">
                    {engineMatches.slice(0, 12).map((_, i) => (
                      <button key={i} onClick={() => setActiveIndex(i)} className={`w-1.5 h-1.5 rounded-full transition ${i === activeIndex ? 'bg-cyan-400' : 'bg-zinc-700 hover:bg-zinc-600'}`} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-zinc-800/50">
                <div className="p-4 sm:p-5">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Startup</p>
                  <h3 className="text-base font-semibold text-white mb-1">{activeEngine.startup.name}</h3>
                  {activeEngine.startup.tagline && <p className="text-xs text-zinc-400 mb-2 line-clamp-2">{activeEngine.startup.tagline}</p>}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(activeEngine.startup.sectors || []).slice(0, 3).map((s, i) => (
                      <span key={i} className="px-2 py-0.5 text-[10px] bg-zinc-800 text-zinc-300 rounded">{s}</span>
                    ))}
                    {activeEngine.startup.stage && <span className="px-2 py-0.5 text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded">{activeEngine.startup.stage}</span>}
                  </div>
                  {activeEngine.startup.total_god_score != null && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">GOD Score</span>
                        {activeEngine.startup.enhanced_god_score && activeEngine.startup.enhanced_god_score > (activeEngine.startup.total_god_score || 0) ? (
                          <>
                            <span className="text-sm font-mono font-bold text-zinc-500 line-through">{activeEngine.startup.total_god_score}</span>
                            <ChevronRight size={14} className="text-zinc-600" />
                            <span className={`text-sm font-mono font-bold ${engineScoreColor(activeEngine.startup.enhanced_god_score)}`}>
                              {activeEngine.startup.enhanced_god_score}
                            </span>
                            {activeEngine.startup.psychological_multiplier && (
                              <span className="text-xs text-emerald-400 font-semibold">
                                +{Math.round((activeEngine.startup.psychological_multiplier - 1) * 100)}%
                              </span>
                            )}
                          </>
                        ) : (
                          <span className={`text-sm font-mono font-bold ${engineScoreColor(activeEngine.startup.total_god_score)}`}>{activeEngine.startup.total_god_score}</span>
                        )}
                      </div>
                      
                      {/* Psychological Signals */}
                      {(activeEngine.startup.is_oversubscribed || activeEngine.startup.has_followon || activeEngine.startup.is_competitive || activeEngine.startup.is_bridge_round || activeEngine.startup.has_sector_pivot || activeEngine.startup.has_social_proof_cascade || activeEngine.startup.is_repeat_founder || activeEngine.startup.has_cofounder_exit) && (
                        <div className="flex flex-wrap gap-1.5">
                          {activeEngine.startup.is_oversubscribed && (
                            <span className="px-2 py-0.5 text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded flex items-center gap-1" title="Oversubscribed round - high FOMO">
                              🚀 Oversubscribed
                            </span>
                          )}
                          {activeEngine.startup.has_followon && (
                            <span className="px-2 py-0.5 text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded flex items-center gap-1" title="Follow-on investment - strong conviction">
                              💎 Follow-on
                            </span>
                          )}
                          {activeEngine.startup.is_competitive && (
                            <span className="px-2 py-0.5 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded flex items-center gap-1" title="Competitive round - high urgency">
                              ⚡ Competitive
                            </span>
                          )}
                          {activeEngine.startup.is_bridge_round && (
                            <span className="px-2 py-0.5 text-[10px] bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded flex items-center gap-1" title="Bridge round - elevated risk">
                              🌉 Bridge
                            </span>
                          )}
                          {activeEngine.startup.has_sector_pivot && (
                            <span className="px-2 py-0.5 text-[10px] bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded flex items-center gap-1" title="Sector pivot detected">
                              🔄 Pivot
                            </span>
                          )}
                          {activeEngine.startup.has_social_proof_cascade && (
                            <span className="px-2 py-0.5 text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded flex items-center gap-1" title="Social proof cascade">
                              🌊 Social Proof
                            </span>
                          )}
                          {activeEngine.startup.is_repeat_founder && (
                            <span className="px-2 py-0.5 text-[10px] bg-green-500/10 text-green-400 border border-green-500/20 rounded flex items-center gap-1" title="Repeat founder">
                              🔁 Repeat Founder
                            </span>
                          )}
                          {activeEngine.startup.has_cofounder_exit && (
                            <span className="px-2 py-0.5 text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded flex items-center gap-1" title="Cofounder departure">
                              🚪 Cofounder Exit
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="p-4 sm:p-5">
                  <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Investor</p>
                  <h3 className="text-base font-semibold text-white mb-1">
                    {activeEngine.investor.name}
                    {activeEngine.investor.firm && <span className="text-zinc-500 font-normal"> · {activeEngine.investor.firm}</span>}
                  </h3>
                  {activeEngine.investor.type && <p className="text-xs text-zinc-400 mb-2">{activeEngine.investor.type}</p>}
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {(activeEngine.investor.sectors || []).slice(0, 3).map((s, i) => (
                      <span key={i} className="px-2 py-0.5 text-[10px] bg-zinc-800 text-zinc-300 rounded">{s}</span>
                    ))}
                    {(activeEngine.investor.stage || []).slice(0, 2).map((s, i) => (
                      <span key={i} className="px-2 py-0.5 text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded">{s}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">Check size</span>
                    <span className="text-sm text-zinc-300 font-mono">{fmtCheck(activeEngine.investor.check_size_min, activeEngine.investor.check_size_max)}</span>
                  </div>
                </div>
              </div>

              <div className={`px-4 py-3 border-t border-zinc-800/50 ${engineScoreBg(activeEngine.match_score)}`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">Match Score</span>
                    <span className={`text-xl font-bold font-mono ${engineScoreColor(activeEngine.match_score)}`}>{activeEngine.match_score}%</span>
                  </div>
                  {activeReasons.length > 0 && (
                    <div className="hidden sm:block flex-1 ml-6 max-w-md">
                      <p className="text-xs text-zinc-400 line-clamp-1">{activeReasons[0]}</p>
                    </div>
                  )}
                  <button onClick={() => { const el = document.getElementById('url-bar-input'); el?.focus(); }} className="px-3 py-1.5 text-sm text-cyan-400 border border-cyan-500/30 rounded hover:bg-cyan-500/10 transition flex items-center gap-2 w-full sm:w-auto justify-center">
                    Get your matches <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        {/* MATCH HEAT MAP */}
        <section className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="text-xs text-zinc-500 uppercase tracking-wider">Match Distribution</h2>
              <span className="flex items-center gap-1.5 text-xs text-cyan-400">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                Live
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-zinc-600">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-cyan-400" /> Hot
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-cyan-600" /> Warm
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-cyan-800" /> Cold
              </span>
            </div>
          </div>
          
          <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-4">
            <MatchHeatMap 
              sectors={sectorMatches}
              onSectorClick={(sector) => {
                // Could filter matches by sector in future
                console.log('Sector clicked:', sector);
              }}
            />
          </div>
        </section>

        {/* MATCHES TABLE */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg overflow-hidden">
          {/* Table Header */}
          <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/80">
            <span className="text-white font-medium text-xs">Investor Matches</span>
            <div className="flex items-center gap-2">
              <select
                value={fitFilter}
                onChange={e => setFitFilter(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-zinc-300 rounded px-2 py-1 text-xs focus:outline-none"
              >
                <option value="all">All Fits</option>
                <option value="strong">Strong</option>
                <option value="good">Good</option>
                <option value="moderate">Moderate</option>
              </select>
              <button onClick={() => startupId && loadMatches(startupId)} disabled={loading} className="p-1 hover:bg-zinc-700 rounded">
                <RefreshCw className={`w-3.5 h-3.5 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="p-8 text-center">
              <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin mx-auto mb-2" />
              <p className="text-zinc-500 text-xs">Loading matches...</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="p-6 text-center">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          {/* Table - Show example matches when no real data */}
          {!loading && !error && (
            <>
              {/* Demo indicator */}
              {showingDemo && matches.length === 0 && (
                <div className="px-3 py-2 bg-cyan-900/20 border-b border-cyan-800/30">
                  <p className="text-xs text-cyan-400">
                    ✨ Example matches — Enter your startup URL to see personalized results
                  </p>
                </div>
              )}
              {/* Desktop table */}
              <table className="hidden sm:table w-full">
                <thead>
                  <tr className="text-left text-[10px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800">
                    <th className="px-3 py-2 w-8">#</th>
                    <th className="px-3 py-2">Investor</th>
                    <th className="px-3 py-2 w-16">Fit</th>
                    <th className="px-3 py-2 w-16">Signal</th>
                    <th className="px-3 py-2">Why</th>
                    <th className="px-3 py-2 w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {(matches.length > 0 ? filteredMatches : EXAMPLE_MATCHES).map((match) => (
                    <tr key={match.investor_id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="px-3 py-2">
                      <span className={`font-mono text-xs ${match.rank <= 3 ? 'text-cyan-400' : 'text-zinc-500'}`}>{match.rank}</span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                        <button 
                          onClick={() => match.investor_id.startsWith('demo-') ? navigate('/signup/founder') : navigate(`/investor/${match.investor_id}`)}
                          className="text-xs text-white hover:text-cyan-400 transition-colors text-left"
                        >
                          {match.investor_name}
                        </button>
                        {match.is_fallback && <span className="text-[9px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded font-medium">Warming</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getFitStyle(match.fit_bucket)}`}>{match.fit_bucket}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`font-mono text-xs font-bold ${getMomentumStyle(match.momentum_bucket)}`}>{match.signal_score.toFixed(1)}</span>
                    </td>
                    <td className="px-3 py-2">
                      <p className="text-xs truncate max-w-[200px] text-zinc-400">
                        {match.why_summary}
                      </p>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button className="p-1 hover:bg-zinc-700 rounded" title="Save"><Bookmark className="w-3 h-3 text-zinc-500 hover:text-cyan-400" /></button>
                        <button 
                          onClick={() => match.investor_id.startsWith('demo-') ? navigate('/signup/founder') : navigate(`/investor/${match.investor_id}`)}
                          className="p-1 hover:bg-zinc-700 rounded" 
                          title="View"
                        >
                          <ExternalLink className="w-3 h-3 text-zinc-500 hover:text-white" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

              {/* Mobile list */}
              <div className="sm:hidden divide-y divide-zinc-800/50">
                {(matches.length > 0 ? filteredMatches : EXAMPLE_MATCHES).map((match) => (
                  <button
                    key={match.investor_id}
                    onClick={() => match.investor_id.startsWith('demo-') ? navigate('/signup/founder') : navigate(`/investor/${match.investor_id}`)}
                    className="w-full px-3 py-3 flex items-center gap-3 hover:bg-zinc-800/30 transition text-left"
                  >
                    <span className={`font-mono text-xs w-5 shrink-0 ${match.rank <= 3 ? 'text-cyan-400' : 'text-zinc-500'}`}>{match.rank}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-white truncate">{match.investor_name}</span>
                        {match.is_fallback && <span className="text-[9px] px-1 py-0.5 bg-cyan-500/20 text-cyan-400 rounded shrink-0">Warming</span>}
                      </div>
                      <p className="text-[11px] text-zinc-500 truncate mt-0.5">{match.why_summary}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${getFitStyle(match.fit_bucket)}`}>{match.fit_bucket}</span>
                      <span className={`font-mono text-xs font-bold ${getMomentumStyle(match.momentum_bucket)}`}>{match.signal_score.toFixed(1)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* How it works - collapsed */}
        <details className="mt-4">
          <summary className="text-zinc-500 text-xs cursor-pointer hover:text-zinc-300 flex items-center gap-1">
            <Info className="w-3 h-3" /> How matching works
          </summary>
          <div className="mt-2 p-3 bg-zinc-900/50 border border-zinc-800 rounded text-xs text-zinc-400 space-y-2">
            <p><strong className="text-white">Signal (1-10):</strong> Real-time investor activity in your space.</p>
            <p><strong className="text-white">Fit:</strong> Strong = 80%+, Good = 60-80%, Moderate = 40-60%.</p>
          </div>
        </details>

        {/* HOW THE ENGINE WORKS — 3-panel explainer */}
        <section className="mt-8 mb-6">
          <h2 className="text-xs text-zinc-500 uppercase tracking-widest mb-4">How the Engine Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                step: '01',
                title: 'Continuous Matching',
                desc: 'The engine runs ML models to match every startup with every investor, recalculating as new data arrives.',
              },
              {
                step: '02',
                title: 'URL Resolution',
                desc: 'When a founder submits their URL, the engine scrapes, scores, and matches them with investors in seconds.',
              },
              {
                step: '03',
                title: 'GOD Score Integration',
                desc: 'New startups are immediately scored by the 23-algorithm GOD system and matched with aligned investors.',
              },
            ].map((item) => (
              <div key={item.step} className="border border-zinc-800/50 rounded-lg p-5 bg-zinc-900/20">
                <span className="text-xs text-cyan-400 font-mono font-bold">{item.step}</span>
                <h3 className="text-sm font-semibold text-white mt-2 mb-2">{item.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sign Up CTA — inline */}
        <div className="mt-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <p className="text-zinc-400 text-sm">
            Save your matches and get alerts when new investors enter your space.
            <span className="text-zinc-600 ml-1">Free — no credit card.</span>
          </p>
          <Link
            to="/signup/founder"
            className="shrink-0 px-5 py-2 bg-transparent border border-cyan-500 text-cyan-400 font-semibold rounded-lg hover:bg-cyan-500/10 transition-colors text-sm text-center"
          >
            Sign up →
          </Link>
        </div>
      </main>
    </div>
  );
}
