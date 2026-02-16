import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  Brain,
  TrendingUp,
  Activity,
  Zap,
  Database,
  BarChart3,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  Target,
  DollarSign,
  Radio,
  Gauge,
  ChevronRight,
  XCircle,
  Clock,
  Hash,
  Layers,
  BarChart,
} from 'lucide-react';
import LogoDropdownMenu from '../components/LogoDropdownMenu';

/* ─── types ─── */
interface DiscoveredStartup {
  id: string;
  name: string;
  source: string | null;
  created_at: string;
  funding_amount: string | null;
  funding_stage: string | null;
  sectors: string | null;
  article_title: string | null;
  rss_source: string | null;
}

interface RSSSource {
  id: string;
  name: string;
  url: string;
  category: string | null;
  active: boolean;
  last_scraped: string | null;
  total_discoveries: number;
  avg_yield_per_scrape: number;
  consecutive_failures: number;
  priority: number;
}

interface ScoreDistribution {
  tier: string;
  count: number;
  pct: number;
}

interface SectorTrend {
  sector: string;
  count: number;
  avgScore: number;
  recentCount: number;
}

/* ─── helpers ─── */
function formatTimeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/* ─── component ─── */
export default function AIIntelligenceDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'rss' | 'ml' | 'trends' | 'scores' | 'matches'>('rss');

  const [recentDiscoveries, setRecentDiscoveries] = useState<DiscoveredStartup[]>([]);
  const [totalDiscovered, setTotalDiscovered] = useState(0);
  const [discoveredToday, setDiscoveredToday] = useState(0);
  const [rssSources, setRssSources] = useState<RSSSource[]>([]);
  const [scoreDist, setScoreDist] = useState<ScoreDistribution[]>([]);
  const [scoreStats, setScoreStats] = useState({ avg: 0, median: 0, max: 0, total: 0, withMomentum: 0 });
  const [matchCount, setMatchCount] = useState(0);
  const [investorCount, setInvestorCount] = useState(0);
  const [approvedCount, setApprovedCount] = useState(0);
  const [sectorTrends, setSectorTrends] = useState<SectorTrend[]>([]);
  const [recentLogs, setRecentLogs] = useState<Array<{ operation: string; status: string; created_at: string; error_message?: string }>>([]);
  const [recentlyScored, setRecentlyScored] = useState<Array<{ name: string; total_god_score: number; momentum_score: number; updated_at: string }>>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Recent RSS discoveries
      const { data: discoveries } = await supabase
        .from('discovered_startups')
        .select('id, name, source, created_at, funding_amount, funding_stage, sectors, article_title, rss_source')
        .order('created_at', { ascending: false })
        .limit(20);
      setRecentDiscoveries(discoveries || []);

      // 2. Total discovered count
      const { count: discCount } = await supabase
        .from('discovered_startups')
        .select('*', { count: 'exact', head: true });
      setTotalDiscovered(discCount || 0);

      // 3. Discovered today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { count: todayNum } = await supabase
        .from('discovered_startups')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString());
      setDiscoveredToday(todayNum || 0);

      // 4. RSS Sources
      const { data: sources } = await supabase
        .from('rss_sources')
        .select('id, name, url, category, active, last_scraped, total_discoveries, avg_yield_per_scrape, consecutive_failures, priority')
        .order('total_discoveries', { ascending: false });
      setRssSources(sources || []);

      // 5. Approved startup count
      const { count: apprCount } = await supabase
        .from('startup_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved');
      setApprovedCount(apprCount || 0);

      // 6. GOD score distribution
      const { data: scoreData } = await supabase
        .from('startup_uploads')
        .select('total_god_score, momentum_score')
        .eq('status', 'approved')
        .not('total_god_score', 'is', null)
        .order('total_god_score', { ascending: true });

      if (scoreData && scoreData.length > 0) {
        const scores = scoreData.map((s: any) => s.total_god_score as number);
        const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;
        const median = scores[Math.floor(scores.length / 2)];
        const max = scores[scores.length - 1];
        const withMom = scoreData.filter((s: any) => s.momentum_score && s.momentum_score > 0).length;
        setScoreStats({ avg: Math.round(avg * 10) / 10, median, max, total: scores.length, withMomentum: withMom });

        const tiers: Record<string, number> = { '90-100': 0, '80-89': 0, '70-79': 0, '60-69': 0, '50-59': 0, '40-49': 0, '<40': 0 };
        scores.forEach((s: number) => {
          if (s >= 90) tiers['90-100']++;
          else if (s >= 80) tiers['80-89']++;
          else if (s >= 70) tiers['70-79']++;
          else if (s >= 60) tiers['60-69']++;
          else if (s >= 50) tiers['50-59']++;
          else if (s >= 40) tiers['40-49']++;
          else tiers['<40']++;
        });
        setScoreDist(Object.entries(tiers).map(([tier, count]) => ({
          tier, count, pct: Math.round((count / scores.length) * 1000) / 10,
        })));
      }

      // 7. Match count
      const { count: mCount } = await supabase
        .from('startup_investor_matches')
        .select('*', { count: 'exact', head: true });
      setMatchCount(mCount || 0);

      // 8. Investor count
      const { count: iCount } = await supabase
        .from('investors')
        .select('*', { count: 'exact', head: true });
      setInvestorCount(iCount || 0);

      // 9. AI logs
      const { data: logs } = await supabase
        .from('ai_logs')
        .select('operation, status, created_at, error_message')
        .order('created_at', { ascending: false })
        .limit(10);
      setRecentLogs(logs || []);

      // 10. Recently scored
      const { data: recent } = await supabase
        .from('startup_uploads')
        .select('name, total_god_score, momentum_score, updated_at')
        .eq('status', 'approved')
        .order('updated_at', { ascending: false })
        .limit(10);
      setRecentlyScored(recent || []);

      // 11. Sector trends
      const { data: sectorRaw } = await supabase
        .from('discovered_startups')
        .select('sectors, created_at')
        .not('sectors', 'is', null);
      if (sectorRaw) {
        const sMap: Record<string, { count: number; recent: number }> = {};
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        sectorRaw.forEach((r: any) => {
          const s = r.sectors as string;
          if (!s) return;
          if (!sMap[s]) sMap[s] = { count: 0, recent: 0 };
          sMap[s].count++;
          if (new Date(r.created_at).getTime() > weekAgo) sMap[s].recent++;
        });
        setSectorTrends(
          Object.entries(sMap)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 12)
            .map(([sector, data]) => ({ sector, count: data.count, avgScore: 0, recentCount: data.recent }))
        );
      }
    } catch (err) {
      console.error('Error loading AI intelligence:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="text-white text-xl">Loading AI Intelligence...</span>
        </div>
      </div>
    );
  }

  const activeSources = rssSources.filter(s => s.active).length;
  const totalSourceDiscoveries = rssSources.reduce((sum, s) => sum + (s.total_discoveries || 0), 0);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <LogoDropdownMenu />

      <div className="max-w-7xl mx-auto px-6 pt-6 pb-16">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate(-1)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
              <ArrowLeft className="w-5 h-5 text-zinc-400" />
            </button>
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-2">
                <span className="text-amber-400">[pyth]</span>
                <span className="text-cyan-400">ai</span>
                <span>AI Intelligence</span>
              </h1>
              <p className="text-zinc-500 mt-1">Real-time system overview — scraper, scoring, matching, and ML pipeline</p>
            </div>
          </div>
          <button onClick={loadData} className="px-4 py-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20 transition-colors flex items-center gap-2 text-sm font-medium">
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <Database className="w-6 h-6 text-purple-400" />
              <span className="text-2xl font-bold">{totalDiscovered.toLocaleString()}</span>
            </div>
            <div className="text-sm text-zinc-400">Startups Discovered</div>
            <div className="text-xs text-cyan-400 mt-1">+{discoveredToday} today</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <Gauge className="w-6 h-6 text-cyan-400" />
              <span className="text-2xl font-bold">{approvedCount.toLocaleString()}</span>
            </div>
            <div className="text-sm text-zinc-400">Approved &amp; Scored</div>
            <div className="text-xs text-green-400 mt-1">avg GOD: {scoreStats.avg}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <Target className="w-6 h-6 text-green-400" />
              <span className="text-2xl font-bold">{matchCount.toLocaleString()}</span>
            </div>
            <div className="text-sm text-zinc-400">Active Matches</div>
            <div className="text-xs text-zinc-500 mt-1">{investorCount.toLocaleString()} investors</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <Radio className="w-6 h-6 text-amber-400" />
              <span className="text-2xl font-bold">{activeSources}/{rssSources.length}</span>
            </div>
            <div className="text-sm text-zinc-400">RSS Sources Active</div>
            <div className="text-xs text-zinc-500 mt-1">{totalSourceDiscoveries} total finds</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {([
            { id: 'rss' as const, label: 'RSS Data Stream', icon: Activity },
            { id: 'scores' as const, label: 'GOD Scores', icon: BarChart3 },
            { id: 'trends' as const, label: 'Sector Trends', icon: TrendingUp },
            { id: 'matches' as const, label: 'Match Engine', icon: Sparkles },
            { id: 'ml' as const, label: 'ML Pipeline', icon: Brain },
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-all flex items-center gap-2 whitespace-nowrap ${
                selectedTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                  : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── RSS Data Stream Tab ─── */}
        {selectedTab === 'rss' && (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Radio className="w-5 h-5 text-cyan-400" />
                RSS Source Health
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {rssSources.slice(0, 9).map(src => (
                  <div key={src.id} className="bg-zinc-950 border border-zinc-800 rounded-lg p-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white truncate">{src.name}</div>
                      <div className="text-xs text-zinc-500">{src.category || 'Uncategorized'}</div>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <span className="text-xs text-zinc-400">{src.total_discoveries} finds</span>
                      <span className={`w-2 h-2 rounded-full ${src.active ? 'bg-green-400' : 'bg-zinc-600'}`} />
                    </div>
                  </div>
                ))}
              </div>
              {rssSources.length > 9 && (
                <div className="mt-3 text-xs text-zinc-500 text-center">+{rssSources.length - 9} more sources</div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Activity className="w-5 h-5 text-purple-400" />
                  Recent Discoveries
                </h2>
                <button onClick={() => navigate('/admin/discovered-startups')} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                  View all <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-2">
                {recentDiscoveries.slice(0, 10).map(d => (
                  <div key={d.id} className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors cursor-pointer" onClick={() => navigate('/admin/discovered-startups')}>
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-purple-400" />
                          <span className="font-medium">{d.name || 'Unknown'}</span>
                        </div>
                        {d.article_title && <div className="text-xs text-zinc-500 mt-1 truncate max-w-md">{d.article_title}</div>}
                        <div className="flex items-center gap-3 mt-2">
                          {d.rss_source && <span className="text-xs text-zinc-500">via {d.rss_source}</span>}
                          {d.sectors && <span className="text-xs px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{d.sectors}</span>}
                          {d.funding_stage && <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">{d.funding_stage}</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        {d.funding_amount && <div className="text-sm font-bold text-green-400">{d.funding_amount}</div>}
                        <div className="text-xs text-zinc-500 mt-1">{formatTimeAgo(d.created_at)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {recentDiscoveries.length === 0 && (
                <div className="text-center py-8 text-zinc-500">No discoveries yet. Start the RSS scraper to begin.</div>
              )}
            </div>
          </div>
        )}

        {/* ─── GOD Scores Tab ─── */}
        {selectedTab === 'scores' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: 'Total Scored', value: scoreStats.total.toLocaleString(), color: 'text-white' },
                { label: 'Average', value: scoreStats.avg.toString(), color: 'text-cyan-400' },
                { label: 'Median', value: scoreStats.median.toString(), color: 'text-zinc-300' },
                { label: 'Max', value: scoreStats.max.toString(), color: 'text-green-400' },
                { label: 'With Momentum', value: scoreStats.withMomentum.toLocaleString(), color: 'text-amber-400' },
              ].map(s => (
                <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center">
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-zinc-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart className="w-5 h-5 text-cyan-400" />
                GOD Score Distribution
              </h2>
              <div className="space-y-3">
                {scoreDist.map(tier => {
                  const maxPct = Math.max(...scoreDist.map(t => t.pct));
                  const width = maxPct > 0 ? (tier.pct / maxPct) * 100 : 0;
                  const barColor = tier.tier === '90-100' ? 'bg-green-500' : tier.tier === '80-89' ? 'bg-cyan-500' : tier.tier === '70-79' ? 'bg-blue-500' : tier.tier === '60-69' ? 'bg-indigo-500' : tier.tier === '50-59' ? 'bg-purple-500' : tier.tier === '40-49' ? 'bg-amber-500' : 'bg-red-500';
                  return (
                    <div key={tier.tier} className="flex items-center gap-4">
                      <div className="w-16 text-right text-sm text-zinc-400 font-mono">{tier.tier}</div>
                      <div className="flex-1 bg-zinc-800 rounded-full h-6 overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full transition-all duration-500 flex items-center justify-end pr-2`} style={{ width: `${width}%`, minWidth: tier.count > 0 ? '24px' : '0' }}>
                          {tier.count > 10 && <span className="text-xs font-medium text-white/80">{tier.count.toLocaleString()}</span>}
                        </div>
                      </div>
                      <div className="w-20 text-right">
                        <span className="text-sm text-white font-medium">{tier.count.toLocaleString()}</span>
                        <span className="text-xs text-zinc-500 ml-1">({tier.pct}%)</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  Recently Scored
                </h2>
                <button onClick={() => navigate('/admin/god-scores')} className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                  View all scores <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="space-y-2">
                {recentlyScored.map((s, i) => (
                  <div key={i} className="flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3">
                    <span className="text-sm font-medium">{s.name}</span>
                    <div className="flex items-center gap-4">
                      {s.momentum_score > 0 && <span className="text-xs text-amber-400">+{s.momentum_score} momentum</span>}
                      <span className={`text-sm font-bold ${s.total_god_score >= 80 ? 'text-green-400' : s.total_god_score >= 60 ? 'text-cyan-400' : s.total_god_score >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                        GOD {s.total_god_score}
                      </span>
                      <span className="text-xs text-zinc-500">{formatTimeAgo(s.updated_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ─── Sector Trends Tab ─── */}
        {selectedTab === 'trends' && (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                Sector Trends
              </h2>
              <p className="text-sm text-zinc-500 mb-6">Based on {totalDiscovered.toLocaleString()} discovered startups. Showing sectors with most activity.</p>
              {sectorTrends.length > 0 ? (
                <div className="space-y-3">
                  {sectorTrends.map(t => {
                    const maxCount = sectorTrends[0]?.count || 1;
                    const width = (t.count / maxCount) * 100;
                    const isHot = t.recentCount > 2;
                    return (
                      <div key={t.sector} className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {isHot && <span className="text-sm">🔥</span>}
                            <span className="font-medium text-sm">{t.sector}</span>
                            {isHot && <span className="text-[10px] text-red-400 font-medium uppercase tracking-wider">Hot</span>}
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-zinc-500">{t.recentCount} this week</span>
                            <span className="text-sm font-bold text-white">{t.count} total</span>
                          </div>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-2">
                          <div className={`h-full rounded-full transition-all duration-500 ${isHot ? 'bg-gradient-to-r from-red-500 to-amber-500' : 'bg-cyan-500/60'}`} style={{ width: `${width}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500">Sector data not yet available. Sectors are populated during RSS scraping.</div>
              )}
            </div>
          </div>
        )}

        {/* ─── Match Engine Tab ─── */}
        {selectedTab === 'matches' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                <Sparkles className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
                <div className="text-3xl font-bold">{matchCount.toLocaleString()}</div>
                <div className="text-sm text-zinc-400 mt-1">Total Matches</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                <Layers className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                <div className="text-3xl font-bold">{investorCount.toLocaleString()}</div>
                <div className="text-sm text-zinc-400 mt-1">Investors</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 text-center">
                <Hash className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <div className="text-3xl font-bold">{approvedCount.toLocaleString()}</div>
                <div className="text-sm text-zinc-400 mt-1">Scored Startups</div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-400" />
                Matching Architecture
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-cyan-400 mb-3">Match Score Components</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'GOD Score Weight', value: '60%', desc: 'Core startup quality assessment' },
                      { label: 'Semantic Similarity', value: '40%', desc: 'AI embedding cosine distance' },
                      { label: 'Stage Fit Bonus', value: '+5-15', desc: 'Investor stage preference alignment' },
                      { label: 'Sector Match', value: '+5-10', desc: 'Thesis-sector overlap scoring' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between bg-zinc-950 rounded-lg px-3 py-2">
                        <div>
                          <div className="text-sm text-white">{item.label}</div>
                          <div className="text-xs text-zinc-500">{item.desc}</div>
                        </div>
                        <span className="text-sm font-bold text-cyan-400">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-purple-400 mb-3">Pipeline Stats</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Match Ratio', value: `${matchCount > 0 && approvedCount > 0 ? Math.round(matchCount / approvedCount) : 0} per startup` },
                      { label: 'Investor Coverage', value: `${investorCount.toLocaleString()} profiles` },
                      { label: 'Momentum Signals', value: `${scoreStats.withMomentum.toLocaleString()} startups` },
                      { label: 'Scoring Frequency', value: 'Every 2 hours (PM2)' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between bg-zinc-950 rounded-lg px-3 py-2">
                        <span className="text-sm text-zinc-400">{item.label}</span>
                        <span className="text-sm text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={() => navigate('/admin/edit-startups')} className="px-4 py-2 bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 rounded-lg text-sm hover:bg-cyan-500/20 transition-colors">View Startups →</button>
                <button onClick={() => navigate('/admin/investor-enrichment')} className="px-4 py-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-lg text-sm hover:bg-purple-500/20 transition-colors">View Investors →</button>
              </div>
            </div>
          </div>
        )}

        {/* ─── ML Pipeline Tab ─── */}
        {selectedTab === 'ml' && (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Brain className="w-5 h-5 text-cyan-400" />
                ML Training Pipeline
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-cyan-400 mb-3">Training Data</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'Training Samples', value: approvedCount.toLocaleString() },
                      { label: 'Feature Dimensions', value: '5 (T/Tr/M/P/V)' },
                      { label: 'Momentum Signals', value: scoreStats.withMomentum.toLocaleString() },
                      { label: 'RSS Discoveries', value: totalDiscovered.toLocaleString() },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between bg-zinc-950 rounded-lg px-3 py-2">
                        <span className="text-sm text-zinc-400">{item.label}</span>
                        <span className="text-sm text-white">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-purple-400 mb-3">Pipeline Health</h3>
                  <div className="space-y-2">
                    {[
                      { label: 'ML Scheduler', online: true, detail: 'Every 30min' },
                      { label: 'RSS Scraper', online: true, detail: 'Continuous' },
                      { label: 'Score Recalc', online: false, detail: 'Every 2h (PM2)' },
                      { label: 'Signal Scoring', online: false, detail: 'Every 6h (PM2)' },
                    ].map(item => (
                      <div key={item.label} className="flex items-center justify-between bg-zinc-950 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          {item.online ? <CheckCircle className="w-4 h-4 text-green-400" /> : <AlertCircle className="w-4 h-4 text-amber-400" />}
                          <span className="text-sm text-white">{item.label}</span>
                        </div>
                        <span className="text-xs text-zinc-500">{item.detail}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-amber-400" />
                Recent System Logs
              </h2>
              {recentLogs.length > 0 ? (
                <div className="space-y-2">
                  {recentLogs.map((log, i) => (
                    <div key={i} className="flex items-center gap-3 bg-zinc-950 rounded-lg px-4 py-3">
                      {log.status === 'success' ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" /> : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-white font-mono">{log.operation}</span>
                        {log.error_message && <div className="text-xs text-red-400/80 mt-0.5 truncate">{log.error_message}</div>}
                      </div>
                      <span className="text-xs text-zinc-500 flex-shrink-0">{formatTimeAgo(log.created_at)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-zinc-500">No system logs available.</div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                How the ML Pipeline Works
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { step: '1', title: 'Data Ingestion', desc: 'RSS scraper discovers startups from TechCrunch, VentureBeat, and other sources. Parsed into structured format.' },
                  { step: '2', title: 'GOD Scoring', desc: 'Each startup is scored 0-100 across Team, Traction, Market, Product, and Vision. Momentum bonuses applied.' },
                  { step: '3', title: 'Match Generation', desc: 'Scored startups matched to investors using GOD score (60%) + semantic similarity (40%) + stage/sector fit.' },
                ].map(s => (
                  <div key={s.step} className="bg-zinc-950 border border-zinc-800 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-bold flex items-center justify-center">{s.step}</span>
                      <span className="text-sm font-medium">{s.title}</span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
