import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RefreshCw, ExternalLink, ChevronDown, ChevronUp, Target } from 'lucide-react';

interface SectorData {
  sector: string;
  startup_count: number;
  investor_count: number;
  match_potential: number;
  gap: string;
}

interface TopStartup {
  id: string;
  name: string;
  tagline: string | null;
  total_god_score: number | null;
  sectors: string[] | null;
  location: string | null;
  status: string | null;
  created_at: string | null;
}

interface TopInvestor {
  id: string;
  name: string;
  firm: string | null;
  sectors: string[] | null;
  check_size_min: number | null;
  check_size_max: number | null;
  total_investments: number | null;
  status: string | null;
}

interface RecentMatch {
  id: string;
  startup_name: string;
  startup_id: string | null;
  investor_name: string;
  investor_id: string | null;
  match_score: number | null;
  status: string | null;
  created_at: string | null;
}

interface PlatformStats {
  total_startups: number;
  approved_startups: number;
  pending_startups: number;
  total_investors: number;
  active_investors: number;
  total_matches: number;
  high_quality_matches: number;
  avg_match_score: number;
  matches_today: number;
  startups_this_week: number;
}

export default function MarketTrends() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [sectorData, setSectorData] = useState<SectorData[]>([]);
  const [topStartups, setTopStartups] = useState<TopStartup[]>([]);
  const [topInvestors, setTopInvestors] = useState<TopInvestor[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [sortField, setSortField] = useState<string>('total_god_score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadStats(),
      loadSectorAnalysis(),
      loadTopStartups(),
      loadTopInvestors(),
      loadRecentMatches()
    ]);
    setLoading(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const loadStats = async () => {
    const [startupsRes, investorsRes, matchesRes] = await Promise.all([
      supabase.from('startup_uploads').select('status, created_at'),
      supabase.from('investors').select('status'),
      supabase.from('startup_investor_matches').select('match_score, created_at')
    ]);

    const startups = startupsRes.data || [];
    const investors = investorsRes.data || [];
    const matches = matchesRes.data || [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const avgScore = matches.length > 0 
      ? Math.round(matches.reduce((sum, m) => sum + Number(m.match_score || 0), 0) / matches.length)
      : 0;

    setStats({
      total_startups: startups.length,
      approved_startups: startups.filter(s => s.status === 'approved').length,
      pending_startups: startups.filter(s => s.status === 'pending').length,
      total_investors: investors.length,
      active_investors: investors.filter(i => i.status === 'active').length,
      total_matches: matches.length,
      high_quality_matches: matches.filter(m => Number(m.match_score) >= 80).length,
      avg_match_score: avgScore,
      matches_today: matches.filter(m => m.created_at !== null && new Date(m.created_at as string) >= today).length,
      startups_this_week: startups.filter(s => s.created_at !== null && new Date(s.created_at as string) >= weekAgo).length
    });
  };

  const loadSectorAnalysis = async () => {
    const [startupsRes, investorsRes] = await Promise.all([
      supabase.from('startup_uploads').select('sectors').not('sectors', 'is', null),
      supabase.from('investors').select('sectors').not('sectors', 'is', null)
    ]);

    const startupSectors: Record<string, number> = {};
    const investorSectors: Record<string, number> = {};

    (startupsRes.data || []).forEach(s => {
      (s.sectors || []).forEach((sector: string) => {
        startupSectors[sector] = (startupSectors[sector] || 0) + 1;
      });
    });

    (investorsRes.data || []).forEach(i => {
      (i.sectors || []).forEach((sector: string) => {
        investorSectors[sector] = (investorSectors[sector] || 0) + 1;
      });
    });

    const allSectors = new Set([...Object.keys(startupSectors), ...Object.keys(investorSectors)]);
    const analysis: SectorData[] = Array.from(allSectors).map(sector => {
      const sc = startupSectors[sector] || 0;
      const ic = investorSectors[sector] || 0;
      const potential = sc > 0 ? Math.round((ic / sc) * 100) : 0;
      let gap = 'Balanced';
      if (sc > ic * 2) gap = 'Oversupplied';
      else if (ic > sc * 2) gap = 'High Demand';
      else if (sc > ic) gap = 'Slight Oversupply';
      else if (ic > sc) gap = 'Slight Demand';

      return { sector, startup_count: sc, investor_count: ic, match_potential: potential, gap };
    }).sort((a, b) => (b.startup_count + b.investor_count) - (a.startup_count + a.investor_count))
      .slice(0, 20);

    setSectorData(analysis);
  };

  const loadTopStartups = async () => {
    const { data } = await supabase
      .from('startup_uploads')
      .select('id, name, tagline, total_god_score, sectors, location, status, created_at')
      .order('total_god_score', { ascending: false })
      .limit(25);
    setTopStartups((data || []) as TopStartup[]);
  };

  const loadTopInvestors = async () => {
    const { data } = await supabase
      .from('investors')
      .select('id, name, firm, sectors, check_size_min, check_size_max, total_investments, status')
      .order('total_investments', { ascending: false })
      .limit(25);
    setTopInvestors((data || []) as TopInvestor[]);
  };

  const loadRecentMatches = async () => {
    const { data: matches } = await supabase
      .from('startup_investor_matches')
      .select('id, startup_id, investor_id, match_score, status, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!matches?.length) {
      setRecentMatches([]);
      return;
    }

    const startupIds = [...new Set(matches.map(m => m.startup_id).filter((id): id is string => id !== null))];
    const investorIds = [...new Set(matches.map(m => m.investor_id).filter((id): id is string => id !== null))];

    const [startupsRes, investorsRes] = await Promise.all([
      supabase.from('startup_uploads').select('id, name').in('id', startupIds),
      supabase.from('investors').select('id, name').in('id', investorIds)
    ]);

    const startupMap = new Map((startupsRes.data || []).map(s => [s.id, s.name]));
    const investorMap = new Map((investorsRes.data || []).map(i => [i.id, i.name]));

    setRecentMatches(matches.map(m => ({
      id: m.id,
      startup_id: m.startup_id,
      startup_name: startupMap.get(m.startup_id || '') || 'Unknown',
      investor_id: m.investor_id,
      investor_name: investorMap.get(m.investor_id || '') || 'Unknown',
      match_score: m.match_score,
      status: m.status,
      created_at: m.created_at
    })) as RecentMatch[]);
  };

  const formatNumber = (n: number) => n?.toLocaleString() || '0';
  const formatMoney = (n: number | null) => {
    if (!n) return '-';
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${n}`;
  };
  const formatDate = (d: string | null) => d ? new Date(d).toLocaleDateString() : '-';
  const formatTime = (d: string | null) => {
    if (!d) return '-';
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return formatDate(d);
  };

  const getScoreClass = (score: number | null) => {
    if (!score) return 'text-gray-400';
    if (score >= 90) return 'text-blue-400 font-bold';
    if (score >= 80) return 'text-cyan-400 font-semibold';
    if (score >= 70) return 'text-yellow-400';
    if (score >= 60) return 'text-lime-400';
    return 'text-gray-400';
  };

  const getGapClass = (gap: string) => {
    if (gap === 'High Demand') return 'text-green-400 bg-green-500/20';
    if (gap === 'Slight Demand') return 'text-green-300 bg-green-500/10';
    if (gap === 'Oversupplied') return 'text-red-400 bg-red-500/20';
    if (gap === 'Slight Oversupply') return 'text-red-300 bg-red-500/10';
    return 'text-gray-400 bg-gray-500/20';
  };

  const sortStartups = (field: string) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const sortedStartups = [...topStartups].sort((a, b) => {
    const aVal = (a as any)[sortField] || 0;
    const bVal = (b as any)[sortField] || 0;
    return sortDir === 'asc' ? (aVal > bVal ? 1 : -1) : (aVal < bVal ? 1 : -1);
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading market data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 overflow-auto">
      {/* Compact Header */}
      <div className="border-b border-gray-800 bg-gray-900/95 sticky top-0 z-30">
        <div className="max-w-[1800px] mx-auto px-4 py-2 flex items-center justify-between">
          <h1 className="text-lg font-bold text-white pl-20">📈 Market Trends</h1>
          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-500">Last updated: {new Date().toLocaleTimeString()}</span>
            <button onClick={refresh} disabled={refreshing} className="text-gray-400 hover:text-white">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto p-4 space-y-4">
        {/* Stats Row - Compact */}
        <div className="grid grid-cols-5 md:grid-cols-10 gap-2 text-xs">
          <StatCell label="Startups" value={formatNumber(stats?.total_startups || 0)} />
          <StatCell label="Approved" value={formatNumber(stats?.approved_startups || 0)} color="green" />
          <StatCell label="Pending" value={formatNumber(stats?.pending_startups || 0)} color="yellow" />
          <StatCell label="Investors" value={formatNumber(stats?.total_investors || 0)} />
          <StatCell label="Active" value={formatNumber(stats?.active_investors || 0)} color="green" />
          <StatCell label="Matches" value={formatNumber(stats?.total_matches || 0)} />
          <StatCell label="Hot (80%+)" value={formatNumber(stats?.high_quality_matches || 0)} color="orange" />
          <StatCell label="Avg Score" value={`${stats?.avg_match_score || 0}%`} />
          <StatCell label="Today" value={formatNumber(stats?.matches_today || 0)} color="blue" />
          <StatCell label="This Week" value={`+${stats?.startups_this_week || 0}`} color="violet" />
        </div>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Sector Supply/Demand Table */}
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-700 bg-gray-800/80">
              <h2 className="text-sm font-semibold text-white">Sector Supply vs Demand</h2>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-gray-700/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-400">Sector</th>
                    <th className="text-right px-2 py-2 text-gray-400">Startups</th>
                    <th className="text-right px-2 py-2 text-gray-400">Investors</th>
                    <th className="text-right px-2 py-2 text-gray-400">Ratio</th>
                    <th className="text-center px-2 py-2 text-gray-400">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {sectorData.map((s, i) => (
                    <tr key={s.sector} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-3 py-1.5 text-white">{s.sector}</td>
                      <td className="px-2 py-1.5 text-right text-cyan-400 font-mono">{s.startup_count}</td>
                      <td className="px-2 py-1.5 text-right text-violet-400 font-mono">{s.investor_count}</td>
                      <td className="px-2 py-1.5 text-right text-gray-300 font-mono">{s.match_potential}%</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-xs ${getGapClass(s.gap)}`}>{s.gap}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Matches Table */}
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-700 bg-gray-800/80">
              <h2 className="text-sm font-semibold text-white">Recent Matches (Live)</h2>
            </div>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-gray-700/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-400">Startup</th>
                    <th className="text-left px-2 py-2 text-gray-400">Investor</th>
                    <th className="text-right px-2 py-2 text-gray-400">Score</th>
                    <th className="text-center px-2 py-2 text-gray-400">Status</th>
                    <th className="text-right px-2 py-2 text-gray-400">When</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMatches.map((m) => (
                    <tr key={m.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-3 py-1.5">
                        <Link to={`/startup/${m.startup_id}`} className="text-white hover:text-cyan-400 truncate block max-w-32">
                          {m.startup_name}
                        </Link>
                      </td>
                      <td className="px-2 py-1.5">
                        <Link to={`/investor/${m.investor_id}`} className="text-gray-300 hover:text-violet-400 truncate block max-w-28">
                          {m.investor_name}
                        </Link>
                      </td>
                      <td className={`px-2 py-1.5 text-right font-mono ${getScoreClass(m.match_score)}`}>
                        {m.match_score}%
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <span className="text-gray-400">{m.status}</span>
                      </td>
                      <td className="px-2 py-1.5 text-right text-gray-500">{formatTime(m.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Top Startups Table */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-700 bg-gray-800/80 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">🔥 Top Startups by GOD Score</h2>
            <Link to="/trending" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
              Full Rankings <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-400 w-8">#</th>
                  <th className="text-left px-2 py-2 text-gray-400 cursor-pointer hover:text-white" onClick={() => sortStartups('name')}>
                    Startup {sortField === 'name' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />)}
                  </th>
                  <th className="text-left px-2 py-2 text-gray-400">Tagline</th>
                  <th className="text-left px-2 py-2 text-gray-400">Sectors</th>
                  <th className="text-left px-2 py-2 text-gray-400">Location</th>
                  <th className="text-center px-2 py-2 text-gray-400">Status</th>
                  <th className="text-right px-2 py-2 text-gray-400 cursor-pointer hover:text-white" onClick={() => sortStartups('total_god_score')}>
                    GOD Score {sortField === 'total_god_score' && (sortDir === 'asc' ? <ChevronUp className="w-3 h-3 inline" /> : <ChevronDown className="w-3 h-3 inline" />)}
                  </th>
                  <th className="text-right px-3 py-2 text-gray-400">Added</th>
                  <th className="text-center px-3 py-2 text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedStartups.map((s, i) => (
                  <tr key={s.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                    <td className="px-3 py-1.5 text-gray-500">{i + 1}</td>
                    <td className="px-2 py-1.5 text-white font-medium cursor-pointer hover:text-cyan-400" onClick={() => navigate(`/startup/${s.id}`)}>{s.name}</td>
                    <td className="px-2 py-1.5 text-gray-400 truncate max-w-48">{s.tagline}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1 flex-wrap">
                        {(s.sectors || []).slice(0, 2).map(sec => (
                          <span key={sec} className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">{sec}</span>
                        ))}
                        {(s.sectors?.length || 0) > 2 && <span className="text-gray-500">+{(s.sectors?.length || 0) - 2}</span>}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-gray-400">{s.location || '-'}</td>
                    <td className="px-2 py-1.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${s.status === 'approved' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td className={`px-2 py-1.5 text-right font-mono text-lg ${getScoreClass(s.total_god_score)}`}>
                      {s.total_god_score}
                    </td>
                    <td className="px-3 py-1.5 text-right text-gray-500">{formatDate(s.created_at)}</td>
                    <td className="px-3 py-1.5 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/startup/${s.id}/matches`);
                        }}
                        className="px-2 py-1 bg-purple-500/20 hover:bg-purple-500/30 rounded text-purple-400 text-xs flex items-center gap-1"
                        title="View Matches"
                      >
                        <Target className="w-3 h-3" />
                        Matches
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Investors Table */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-700 bg-gray-800/80 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">💰 Active Investors</h2>
            <Link to="/investors" className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
              Full Directory <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left px-3 py-2 text-gray-400">Name</th>
                  <th className="text-left px-2 py-2 text-gray-400">Firm</th>
                  <th className="text-left px-2 py-2 text-gray-400">Sectors</th>
                  <th className="text-right px-2 py-2 text-gray-400">Check Size</th>
                  <th className="text-right px-2 py-2 text-gray-400">Investments</th>
                  <th className="text-center px-3 py-2 text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {topInvestors.map((inv) => (
                  <tr key={inv.id} className="border-t border-gray-700/50 hover:bg-gray-700/30 cursor-pointer" onClick={() => navigate(`/investor/${inv.id}`)}>
                    <td className="px-3 py-1.5 text-white font-medium">{inv.name}</td>
                    <td className="px-2 py-1.5 text-gray-400">{inv.firm || '-'}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1 flex-wrap">
                        {(inv.sectors || []).slice(0, 2).map(sec => (
                          <span key={sec} className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">{sec}</span>
                        ))}
                        {(inv.sectors || []).length > 2 && <span className="text-gray-500">+{(inv.sectors || []).length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-2 py-1.5 text-right text-green-400 font-mono">
                      {formatMoney(inv.check_size_min)} - {formatMoney(inv.check_size_max)}
                    </td>
                    <td className="px-2 py-1.5 text-right text-violet-400 font-mono">{inv.total_investments || 0}</td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${inv.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, color }: { label: string; value: string; color?: string }) {
  const colorClass = {
    green: 'text-green-400',
    yellow: 'text-yellow-400',
    orange: 'text-cyan-400',
    blue: 'text-blue-400',
    violet: 'text-violet-400',
    red: 'text-red-400'
  }[color || ''] || 'text-white';

  return (
    <div className="bg-gray-800/50 rounded px-2 py-1.5 border border-gray-700/50">
      <div className={`font-mono font-bold ${colorClass}`}>{value}</div>
      <div className="text-gray-500 text-[10px]">{label}</div>
    </div>
  );
}
