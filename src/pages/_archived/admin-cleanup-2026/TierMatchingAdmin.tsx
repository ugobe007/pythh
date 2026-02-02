import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Search, Filter, TrendingUp, TrendingDown, Users, Building2, 
  Target, AlertTriangle, CheckCircle, XCircle, RefreshCw,
  ChevronDown, ChevronUp, Download, BarChart3
} from 'lucide-react';

// Tier definitions
const TIER_DEFINITIONS = {
  1: { name: 'Elite', color: 'bg-purple-500', expectedGOD: 55, bonus: 0 },
  2: { name: 'Strong', color: 'bg-blue-500', expectedGOD: 45, bonus: 10 },
  3: { name: 'Emerging', color: 'bg-green-500', expectedGOD: 38, bonus: 18 },
  4: { name: 'Angels', color: 'bg-cyan-600', expectedGOD: 30, bonus: 25 },
};

const TIER_FIRMS: Record<number, string[]> = {
  1: ['sequoia', 'a16z', 'andreessen', 'benchmark', 'founders fund', 'general catalyst', 'greylock', 'accel', 'lightspeed', 'index', 'bessemer'],
  2: ['first round', 'initialized', 'felicis', 'boldstart', 'craft', 'spark capital', 'nea', 'khosla'],
  3: ['pear', 'haystack', 'precursor', 'nextview', 'notation', 'lerer hippeau', 'compound', 'homebrew'],
  4: [],
};

const SECTOR_WEIGHTS: Record<string, number> = {
  'ai/ml': 2.0, 'ai': 2.0, 'ml': 2.0, 'saas': 2.0, 'fintech': 2.0, 
  'healthtech': 2.0, 'consumer': 2.0, 'robotics': 2.0,
  'crypto': 1.0, 'web3': 1.0,
  'cleantech': 0.5, 'climate': 0.5, 'gaming': 0.5, 'edtech': 0.5
};

interface Startup {
  id: string;
  name: string;
  total_god_score: number;
  sectors: string[];
  stage: number;
  source_type: string;
}

interface Investor {
  id: string;
  name: string;
  firm: string;
  sectors: string[];
  stage: string[];
  check_size_min: number;
  check_size_max: number;
}

interface Match {
  startup: Startup;
  investor: Investor;
  investorTier: number;
  godScore: number;
  sectorBonus: number;
  tierBonus: number;
  tier1Match: number;
  tierAdjustedMatch: number;
  isGoodFit: boolean;
}

export default function TierMatchingAdmin() {
  const [startups, setStartups] = useState<Startup[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [godScoreRange, setGodScoreRange] = useState({ min: 0, max: 100 });
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'godScore' | 'tierAdjustedMatch' | 'tier1Match'>('tierAdjustedMatch');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [stats, setStats] = useState<any>(null);
  const [expandedStartup, setExpandedStartup] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    const [startupsRes, investorsRes] = await Promise.all([
      supabase.from('startup_uploads')
        .select('id, name, total_god_score, sectors, stage, source_type')
        .eq('status', 'approved')
        .order('total_god_score', { ascending: false })
        .limit(500),
      supabase.from('investors')
        .select('id, name, firm, sectors, stage, check_size_min, check_size_max')
        .not('sectors', 'eq', '{}')
        .limit(500)
    ]);

    const s = startupsRes.data || [];
    const i = investorsRes.data || [];
    
    setStartups(s);
    setInvestors(i);
    
    // Calculate all matches
    const allMatches: Match[] = [];
    for (const startup of s.slice(0, 100)) {
      for (const investor of i.slice(0, 50)) {
        const match = calculateMatch(startup, investor);
        allMatches.push(match);
      }
    }
    setMatches(allMatches);
    
    // Calculate stats
    calculateStats(s, i, allMatches);
    
    setLoading(false);
  };

  const classifyTier = (investor: Investor): number => {
    const name = (investor.name || '').toLowerCase();
    const firm = (investor.firm || '').toLowerCase();
    const checkSize = investor.check_size_min || investor.check_size_max || 0;
    
    for (const [tier, firms] of Object.entries(TIER_FIRMS)) {
      if (firms.some(f => name.includes(f) || firm.includes(f))) {
        return parseInt(tier);
      }
    }
    
    if (checkSize >= 5000000) return 1;
    if (checkSize >= 1000000) return 2;
    if (checkSize >= 250000) return 3;
    return 4;
  };

  const calculateMatch = (startup: Startup, investor: Investor): Match => {
    const tier = classifyTier(investor);
    const tierDef = TIER_DEFINITIONS[tier as keyof typeof TIER_DEFINITIONS];
    const godScore = startup.total_god_score || 40;
    
    const sSectors = (startup.sectors || []).map(s => s.toLowerCase());
    const iSectors = (investor.sectors || []).map(s => s.toLowerCase());
    
    let sectorBonus = 0;
    sSectors.forEach(sec => {
      if (iSectors.some(is => sec.includes(is) || is.includes(sec))) {
        const weight = SECTOR_WEIGHTS[sec] || SECTOR_WEIGHTS[Object.keys(SECTOR_WEIGHTS).find(k => sec.includes(k)) || ''] || 1.0;
        sectorBonus += 8 * weight;
      }
    });
    sectorBonus = Math.min(sectorBonus, 32);
    
    const tierBonus = tierDef.bonus;
    let tierFitPenalty = 0;
    if (godScore < tierDef.expectedGOD) {
      tierFitPenalty = (tierDef.expectedGOD - godScore) * 1.5;
    }
    
    const rawMatch = godScore + sectorBonus + 10;
    const tier1Match = Math.max(25, Math.min(Math.round(rawMatch - tierFitPenalty), 99));
    const tierAdjustedMatch = Math.max(25, Math.min(Math.round(rawMatch + tierBonus - Math.max(0, tierFitPenalty - tierBonus)), 99));
    
    return {
      startup,
      investor,
      investorTier: tier,
      godScore,
      sectorBonus,
      tierBonus,
      tier1Match,
      tierAdjustedMatch,
      isGoodFit: tierAdjustedMatch >= 60,
    };
  };

  const calculateStats = (s: Startup[], i: Investor[], m: Match[]) => {
    const tierCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
    i.forEach(inv => { tierCounts[classifyTier(inv) as keyof typeof tierCounts]++; });
    
    const godBuckets = { elite: 0, strong: 0, promising: 0, early: 0 };
    s.forEach(st => {
      const score = st.total_god_score || 0;
      if (score >= 55) godBuckets.elite++;
      else if (score >= 45) godBuckets.strong++;
      else if (score >= 38) godBuckets.promising++;
      else godBuckets.early++;
    });
    
    const avgGod = s.length ? Math.round(s.reduce((a, b) => a + (b.total_god_score || 0), 0) / s.length) : 0;
    const avgTier1Match = m.filter(x => x.investorTier === 1).reduce((a, b) => a + b.tier1Match, 0) / Math.max(1, m.filter(x => x.investorTier === 1).length);
    const avgTierAdjMatch = m.reduce((a, b) => a + b.tierAdjustedMatch, 0) / Math.max(1, m.length);
    
    const goodFitRate = m.filter(x => x.isGoodFit).length / Math.max(1, m.length) * 100;
    
    setStats({
      tierCounts,
      godBuckets,
      avgGod,
      avgTier1Match: Math.round(avgTier1Match),
      avgTierAdjMatch: Math.round(avgTierAdjMatch),
      goodFitRate: Math.round(goodFitRate),
      totalStartups: s.length,
      totalInvestors: i.length,
      totalMatches: m.length,
    });
  };

  const filteredMatches = matches
    .filter(m => {
      if (selectedTier && m.investorTier !== selectedTier) return false;
      if (m.godScore < godScoreRange.min || m.godScore > godScoreRange.max) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!m.startup.name.toLowerCase().includes(q) && !m.investor.name.toLowerCase().includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const aVal = sortBy === 'godScore' ? a.godScore : sortBy === 'tier1Match' ? a.tier1Match : a.tierAdjustedMatch;
      const bVal = sortBy === 'godScore' ? b.godScore : sortBy === 'tier1Match' ? b.tier1Match : b.tierAdjustedMatch;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

  // Group matches by startup for better viewing
  const groupedByStartup = filteredMatches.reduce((acc, match) => {
    if (!acc[match.startup.id]) {
      acc[match.startup.id] = { startup: match.startup, matches: [] };
    }
    acc[match.startup.id].matches.push(match);
    return acc;
  }, {} as Record<string, { startup: Startup; matches: Match[] }>);

  const exportData = () => {
    const csv = [
      ['Startup', 'GOD Score', 'Investor', 'Tier', 'Tier1 Match', 'Adjusted Match', 'Sector Bonus', 'Good Fit'].join(','),
      ...filteredMatches.map(m => [
        m.startup.name,
        m.godScore,
        m.investor.name,
        m.investorTier,
        m.tier1Match,
        m.tierAdjustedMatch,
        m.sectorBonus,
        m.isGoodFit ? 'Yes' : 'No'
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tier-matches-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading tier matching data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Target className="w-8 h-8 text-purple-500" />
              Tier Matching Admin
            </h1>
            <p className="text-gray-400 mt-1">Monitor and analyze investor tier matching system</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg hover:bg-gray-700"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={exportData}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 rounded-lg hover:bg-purple-500"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm">Avg GOD Score</div>
              <div className="text-2xl font-bold text-white">{stats.avgGod}</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm">Avg Tier 1 Match</div>
              <div className="text-2xl font-bold text-purple-400">{stats.avgTier1Match}%</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm">Avg Adjusted Match</div>
              <div className="text-2xl font-bold text-green-400">{stats.avgTierAdjMatch}%</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm">Good Fit Rate</div>
              <div className="text-2xl font-bold text-blue-400">{stats.goodFitRate}%</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm">Total Startups</div>
              <div className="text-2xl font-bold">{stats.totalStartups}</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm">Total Investors</div>
              <div className="text-2xl font-bold">{stats.totalInvestors}</div>
            </div>
          </div>
        )}

        {/* Tier Distribution */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-400" />
                Investor Tier Distribution
              </h3>
              <div className="space-y-3">
                {Object.entries(TIER_DEFINITIONS).map(([tier, def]) => (
                  <div key={tier} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${def.color}`} />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span>Tier {tier}: {def.name}</span>
                        <span className="text-gray-400">{stats.tierCounts[parseInt(tier)]}</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                        <div 
                          className={`${def.color} h-2 rounded-full`}
                          style={{ width: `${(stats.tierCounts[parseInt(tier)] / stats.totalInvestors) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-green-400" />
                GOD Score Distribution
              </h3>
              <div className="space-y-3">
                {[
                  { label: 'Elite (55+)', count: stats.godBuckets.elite, color: 'bg-purple-500' },
                  { label: 'Strong (45-54)', count: stats.godBuckets.strong, color: 'bg-blue-500' },
                  { label: 'Promising (38-44)', count: stats.godBuckets.promising, color: 'bg-green-500' },
                  { label: 'Early (<38)', count: stats.godBuckets.early, color: 'bg-cyan-600' },
                ].map(bucket => (
                  <div key={bucket.label} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${bucket.color}`} />
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span>{bucket.label}</span>
                        <span className="text-gray-400">{bucket.count}</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
                        <div 
                          className={`${bucket.color} h-2 rounded-full`}
                          style={{ width: `${(bucket.count / stats.totalStartups) * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="relative flex-1 min-w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search startups or investors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
              />
            </div>

            {/* Tier Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={selectedTier || ''}
                onChange={(e) => setSelectedTier(e.target.value ? parseInt(e.target.value) : null)}
                className="px-3 py-2 bg-gray-700 rounded-lg border border-gray-600 focus:border-purple-500 focus:outline-none"
              >
                <option value="">All Tiers</option>
                <option value="1">Tier 1 (Elite)</option>
                <option value="2">Tier 2 (Strong)</option>
                <option value="3">Tier 3 (Emerging)</option>
                <option value="4">Tier 4 (Angels)</option>
              </select>
            </div>

            {/* GOD Score Range */}
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">GOD:</span>
              <input
                type="number"
                value={godScoreRange.min}
                onChange={(e) => setGodScoreRange(prev => ({ ...prev, min: parseInt(e.target.value) || 0 }))}
                className="w-16 px-2 py-2 bg-gray-700 rounded-lg border border-gray-600 text-center"
                min="0"
                max="100"
              />
              <span className="text-gray-400">-</span>
              <input
                type="number"
                value={godScoreRange.max}
                onChange={(e) => setGodScoreRange(prev => ({ ...prev, max: parseInt(e.target.value) || 100 }))}
                className="w-16 px-2 py-2 bg-gray-700 rounded-lg border border-gray-600 text-center"
                min="0"
                max="100"
              />
            </div>

            {/* Sort */}
            <div className="flex items-center gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2 bg-gray-700 rounded-lg border border-gray-600"
              >
                <option value="tierAdjustedMatch">Adjusted Match</option>
                <option value="tier1Match">Tier 1 Match</option>
                <option value="godScore">GOD Score</option>
              </select>
              <button
                onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"
              >
                {sortOrder === 'desc' ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="text-gray-400 mb-4">
          Showing {Object.keys(groupedByStartup).length} startups with {filteredMatches.length} matches
        </div>

        {/* Matches Table */}
        <div className="bg-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Startup</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">GOD</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Investor</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Tier</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">T1 Match</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Adj Match</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Sector +</th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Fit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredMatches.slice(0, 100).map((match, idx) => (
                  <tr key={idx} className="hover:bg-gray-750">
                    <td className="px-4 py-3">
                      <div className="font-medium">{match.startup.name.substring(0, 25)}</div>
                      <div className="text-xs text-gray-400">{(match.startup.sectors || []).slice(0, 2).join(', ')}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                        match.godScore >= 55 ? 'bg-purple-500/20 text-purple-300' :
                        match.godScore >= 45 ? 'bg-blue-500/20 text-blue-300' :
                        match.godScore >= 38 ? 'bg-green-500/20 text-green-300' :
                        'bg-cyan-600/20 text-cyan-300'
                      }`}>
                        {match.godScore}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{match.investor.name.substring(0, 25)}</div>
                      <div className="text-xs text-gray-400">{match.investor.firm?.substring(0, 20)}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block w-6 h-6 rounded-full text-xs flex items-center justify-center ${
                        TIER_DEFINITIONS[match.investorTier as keyof typeof TIER_DEFINITIONS]?.color
                      }`}>
                        {match.investorTier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`${match.tier1Match >= 70 ? 'text-green-400' : match.tier1Match >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {match.tier1Match}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`font-bold ${match.tierAdjustedMatch >= 70 ? 'text-green-400' : match.tierAdjustedMatch >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {match.tierAdjustedMatch}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-gray-400">
                      +{match.sectorBonus}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {match.isGoodFit ? (
                        <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bias Detection Panel */}
        <div className="mt-8 bg-gray-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-400" />
            Bias Detection & Alerts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stats && stats.avgTier1Match < 40 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="text-red-400 font-medium">Low Tier 1 Match Rate</div>
                <div className="text-sm text-gray-400 mt-1">
                  Avg {stats.avgTier1Match}% - Consider adjusting GOD scoring or tier thresholds
                </div>
              </div>
            )}
            {stats && stats.goodFitRate < 50 && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <div className="text-yellow-400 font-medium">Low Good Fit Rate</div>
                <div className="text-sm text-gray-400 mt-1">
                  Only {stats.goodFitRate}% are good fits - Check sector alignment
                </div>
              </div>
            )}
            {stats && stats.godBuckets.elite < stats.totalStartups * 0.1 && (
              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <div className="text-purple-400 font-medium">Few Elite Startups</div>
                <div className="text-sm text-gray-400 mt-1">
                  Only {stats.godBuckets.elite} elite (55+) - GOD scoring may be too strict
                </div>
              </div>
            )}
            {stats && stats.tierCounts[1] < 10 && (
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                <div className="text-blue-400 font-medium">Few Tier 1 Investors</div>
                <div className="text-sm text-gray-400 mt-1">
                  Only {stats.tierCounts[1]} elite VCs - Enrich more investor data
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
