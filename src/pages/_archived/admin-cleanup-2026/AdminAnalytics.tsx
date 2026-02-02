import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { RefreshCw, AlertTriangle, CheckCircle, Clock, XCircle, Trash2, Check, Play, ExternalLink, Database, Zap, Globe, Target } from 'lucide-react';

interface DataQuality {
  table: string;
  total: number;
  complete: number;
  missing_key_fields: number;
  last_updated: string;
}

interface StartupDataGaps {
  missing_description: number;
  missing_sectors: number;
  missing_website: number;
  missing_location: number;
  has_all_data: number;
  total: number;
}

interface IncompleteStartup {
  id: string;
  name: string;
  tagline: string;
  has_description: boolean;
  has_sectors: boolean;
  has_website: boolean;
  has_location: boolean;
  total_god_score: number;
}

interface MatchQueueItem {
  id: string;
  startup_name: string;
  startup_id: string;
  investor_name: string;
  investor_id: string;
  match_score: number;
  status: string;
  created_at: string;
}

interface SystemHealth {
  scrapers_running: number;
  last_scrape: string;
  rss_sources_active: number;
  errors_today: number;
  queue_size: number;
}

export default function AdminAnalytics() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [matchQueue, setMatchQueue] = useState<MatchQueueItem[]>([]);
  const [dataQuality, setDataQuality] = useState<DataQuality[]>([]);
  const [startupGaps, setStartupGaps] = useState<StartupDataGaps | null>(null);
  const [incompleteStartups, setIncompleteStartups] = useState<IncompleteStartup[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [enriching, setEnriching] = useState(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    await Promise.all([
      loadMatchQueue(),
      loadDataQuality(),
      loadStartupGaps(),
      loadIncompleteStartups(),
      loadSystemHealth()
    ]);
    setLoading(false);
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadAllData();
    setRefreshing(false);
  };

  const loadMatchQueue = async () => {
    // Get high-score matches (top matches by score, regardless of status)
    const { data: matches, error } = await supabase
      .from('startup_investor_matches')
      .select('id, startup_id, investor_id, match_score, status, created_at')
      .order('match_score', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error loading match queue:', error);
      setMatchQueue([]);
      return;
    }

    if (!matches?.length) {
      setMatchQueue([]);
      return;
    }

    const startupIds = [...new Set(matches.map(m => m.startup_id).filter((id): id is string => id !== null))];
    const investorIds = [...new Set(matches.map(m => m.investor_id).filter((id): id is string => id !== null))];

    const [startupsRes, investorsRes] = await Promise.all([
      startupIds.length ? supabase.from('startup_uploads').select('id, name').in('id', startupIds) : { data: [] },
      investorIds.length ? supabase.from('investors').select('id, name').in('id', investorIds) : { data: [] }
    ]);

    const startupMap = new Map((startupsRes.data || []).map(s => [s.id, s.name]));
    const investorMap = new Map((investorsRes.data || []).map(i => [i.id, i.name]));

    setMatchQueue(matches.map(m => ({
      id: m.id,
      startup_id: m.startup_id || '',
      startup_name: startupMap.get(m.startup_id || '') || 'Unknown',
      investor_id: m.investor_id || '',
      investor_name: investorMap.get(m.investor_id || '') || 'Unknown',
      match_score: m.match_score || 0,
      status: m.status || 'pending',
      created_at: m.created_at || ''
    })));
  };

  const loadDataQuality = async () => {
    // Get total counts using count queries (not limited to 1000)
    const [
      { count: totalStartups },
      { count: totalInvestors },
      { count: totalMatches },
      { count: totalDiscovered }
    ] = await Promise.all([
      supabase.from('startup_uploads').select('*', { count: 'exact', head: true }),
      supabase.from('investors').select('*', { count: 'exact', head: true }),
      supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true }),
      supabase.from('discovered_startups').select('*', { count: 'exact', head: true })
    ]);

    // Get sample data for quality analysis (using pagination to get representative sample)
    // For large tables, we'll sample the first 1000 rows for quality metrics
    const [startupsRes, investorsRes, matchesRes, discoveredRes] = await Promise.all([
      supabase.from('startup_uploads').select('id, name, tagline, sectors, website, total_god_score, created_at').order('created_at', { ascending: false }).limit(1000),
      supabase.from('investors').select('id, name, firm, sectors, check_size_min, created_at').order('created_at', { ascending: false }).limit(1000),
      supabase.from('startup_investor_matches').select('id, match_score, created_at').order('created_at', { ascending: false }).limit(1000),
      supabase.from('discovered_startups').select('id, name, article_url, created_at').order('created_at', { ascending: false }).limit(1000)
    ]);

    const startups = startupsRes.data || [];
    const investors = investorsRes.data || [];
    const matches = matchesRes.data || [];
    const discovered = discoveredRes.data || [];

    // Calculate quality percentages from sample, then apply to total
    const startupQualityRate = startups.length > 0 
      ? startups.filter(s => s.name && s.tagline && s.sectors?.length && s.website).length / startups.length
      : 0;
    const investorQualityRate = investors.length > 0
      ? investors.filter(i => i.name && i.firm && i.sectors?.length && i.check_size_min).length / investors.length
      : 0;
    const matchQualityRate = matches.length > 0
      ? matches.filter(m => (m.match_score ?? 0) > 0).length / matches.length
      : 0;
    const discoveredQualityRate = discovered.length > 0
      ? discovered.filter(d => d.name && d.article_url).length / discovered.length
      : 0;

    // Calculate estimated complete/missing based on quality rates
    const startupComplete = Math.round((totalStartups || 0) * startupQualityRate);
    const investorComplete = Math.round((totalInvestors || 0) * investorQualityRate);
    const matchComplete = Math.round((totalMatches || 0) * matchQualityRate);
    const discoveredComplete = Math.round((totalDiscovered || 0) * discoveredQualityRate);

    setDataQuality([
      {
        table: 'startup_uploads',
        total: totalStartups || 0,
        complete: startupComplete,
        missing_key_fields: (totalStartups || 0) - startupComplete,
        last_updated: startups[0]?.created_at || '-'
      },
      {
        table: 'investors',
        total: totalInvestors || 0,
        complete: investorComplete,
        missing_key_fields: (totalInvestors || 0) - investorComplete,
        last_updated: investors[0]?.created_at || '-'
      },
      {
        table: 'matches',
        total: totalMatches || 0,
        complete: matchComplete,
        missing_key_fields: (totalMatches || 0) - matchComplete,
        last_updated: matches[0]?.created_at || '-'
      },
      {
        table: 'discovered_startups',
        total: totalDiscovered || 0,
        complete: discoveredComplete,
        missing_key_fields: (totalDiscovered || 0) - discoveredComplete,
        last_updated: discovered[0]?.created_at || '-'
      }
    ]);
  };

  const loadStartupGaps = async () => {
    const { data: startups } = await supabase
      .from('startup_uploads')
      .select('id, description, sectors, website, location');

    if (!startups) return;

    const gaps: StartupDataGaps = {
      total: startups.length,
      missing_description: startups.filter(s => !s.description || s.description === '').length,
      missing_sectors: startups.filter(s => !s.sectors || s.sectors.length === 0).length,
      missing_website: startups.filter(s => !s.website || s.website === '').length,
      missing_location: startups.filter(s => !s.location || s.location === '').length,
      has_all_data: startups.filter(s => 
        s.description && s.description !== '' &&
        s.sectors && s.sectors.length > 0 &&
        s.website && s.website !== '' &&
        s.location && s.location !== ''
      ).length
    };

    setStartupGaps(gaps);
  };

  const loadIncompleteStartups = async () => {
    const { data } = await supabase
      .from('startup_uploads')
      .select('id, name, tagline, description, sectors, website, location, total_god_score')
      .order('total_god_score', { ascending: false })
      .limit(500);

    if (!data) return;

    const incomplete = data
      .filter(s => !s.description || !s.sectors?.length || !s.website || !s.location)
      .slice(0, 50)
      .map(s => ({
        id: s.id,
        name: s.name,
        tagline: s.tagline || '',
        has_description: !!(s.description && s.description !== ''),
        has_sectors: !!(s.sectors && s.sectors.length > 0),
        has_website: !!(s.website && s.website !== ''),
        has_location: !!(s.location && s.location !== ''),
        total_god_score: s.total_god_score || 0
      }));

    setIncompleteStartups(incomplete);
  };

  // AI Enrichment - Generate description from tagline AND infer sectors
  // Uses keyword-based inference (no OpenAI API needed)
  const enrichWithAI = async (startup: IncompleteStartup) => {
    if (!startup.tagline) {
      throw new Error(`Startup ${startup.name} has no tagline for enrichment`);
    }
    
    try {
      // Sector inference keywords
      const sectorKeywords: Record<string, string[]> = {
        'FinTech': ['fintech', 'finance', 'banking', 'payment', 'crypto', 'defi', 'insurance', 'lending', 'trading', 'wallet', 'neobank', 'regtech', 'money', 'transaction', 'wealth'],
        'AI/ML': ['ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural', 'nlp', 'gpt', 'llm', 'automation', 'cognitive', 'predictive'],
        'SaaS': ['saas', 'cloud', 'platform', 'software', 'api', 'dashboard', 'tool', 'workflow', 'productivity', 'enterprise', 'b2b'],
        'HealthTech': ['health', 'healthcare', 'medical', 'clinical', 'patient', 'doctor', 'hospital', 'pharma', 'biotech', 'wellness', 'mental health', 'telemedicine', 'diagnosis'],
        'EdTech': ['education', 'learning', 'course', 'student', 'school', 'teach', 'training', 'skill', 'tutor', 'academic'],
        'Sustainability': ['climate', 'carbon', 'green', 'sustainable', 'environment', 'renewable', 'clean', 'eco', 'solar', 'energy'],
        'E-commerce': ['ecommerce', 'shop', 'retail', 'marketplace', 'commerce', 'store', 'merchant', 'brand', 'direct-to-consumer', 'd2c'],
        'Cybersecurity': ['security', 'cyber', 'privacy', 'encryption', 'authentication', 'threat', 'fraud', 'identity', 'compliance'],
        'PropTech': ['real estate', 'property', 'housing', 'rental', 'mortgage', 'home', 'construction', 'tenant'],
        'FoodTech': ['food', 'restaurant', 'delivery', 'kitchen', 'meal', 'grocery', 'farming', 'agriculture'],
        'Developer Tools': ['developer', 'dev', 'code', 'infrastructure', 'devops', 'sdk', 'api', 'testing', 'deployment', 'git'],
        'Marketing': ['marketing', 'advertising', 'brand', 'content', 'social media', 'influencer', 'seo', 'analytics', 'campaign'],
        'HR/Talent': ['hr', 'hiring', 'recruiting', 'talent', 'employee', 'workforce', 'payroll', 'benefit', 'career', 'job'],
        'Logistics': ['logistics', 'supply chain', 'shipping', 'delivery', 'warehouse', 'freight', 'fleet', 'tracking'],
        'Consumer': ['consumer', 'app', 'social', 'community', 'creator', 'entertainment', 'gaming', 'lifestyle', 'subscription']
      };

      // Infer sectors from tagline and name
      const textToAnalyze = `${startup.name} ${startup.tagline}`.toLowerCase();
      const inferredSectors: string[] = [];
      
      for (const [sector, keywords] of Object.entries(sectorKeywords)) {
        for (const keyword of keywords) {
          if (textToAnalyze.includes(keyword) && !inferredSectors.includes(sector)) {
            inferredSectors.push(sector);
            break;
          }
        }
      }
      
      // Default to SaaS if no sectors found
      if (inferredSectors.length === 0) {
        inferredSectors.push('SaaS');
      }
      
      // Generate description
      const description = `${startup.name} is ${startup.tagline.toLowerCase()}. The company is focused on delivering innovative solutions in this space, helping customers achieve better outcomes through technology-driven approaches.`;
      
      const updateData: any = { description };
      
      // Only update sectors if startup doesn't have any
      if (!startup.has_sectors) {
        updateData.sectors = inferredSectors.slice(0, 3);
      }
      
      const { error } = await supabase
        .from('startup_uploads')
        .update(updateData)
        .eq('id', startup.id);

      if (error) {
        throw new Error(`Database update failed: ${error.message}`);
      }
    } catch (error: any) {
      console.error(`Error enriching startup ${startup.name}:`, error);
      // Provide more helpful error message
      const errorMessage = error?.message || 'Unknown error occurred';
      throw new Error(`Failed to enrich ${startup.name}: ${errorMessage}`);
    }
  };

  // Bulk AI enrichment - enriches both description AND sectors
  const bulkEnrichAI = async () => {
    try {
      setEnriching(true);
      const toEnrich = incompleteStartups.filter(s => (!s.has_description || !s.has_sectors) && s.tagline);
      
      if (toEnrich.length === 0) {
        alert('No startups available for enrichment. They need a tagline and missing description or sectors.');
        setEnriching(false);
        return;
      }
      
      const batch = toEnrich.slice(0, 20);
      let successCount = 0;
      let errorCount = 0;
      
      for (const startup of batch) {
        try {
          await enrichWithAI(startup);
          successCount++;
          // Small delay to avoid overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Error enriching ${startup.name}:`, error);
          errorCount++;
        }
      }
      
      // Refresh data after enrichment
      await loadIncompleteStartups();
      await loadStartupGaps();
      
      alert(`✅ Enrichment complete!\n\nSuccessfully enriched: ${successCount}\nErrors: ${errorCount}`);
    } catch (error) {
      console.error('Error in bulk enrichment:', error);
      alert(`❌ Error during enrichment: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setEnriching(false);
    }
  };

  const loadSystemHealth = async () => {
    const { data: rssSources } = await supabase.from('rss_sources').select('id, active');
    const activeRss = (rssSources || []).filter(r => r.active).length;

    setSystemHealth({
      scrapers_running: 0,
      last_scrape: new Date().toISOString(),
      rss_sources_active: activeRss,
      errors_today: 0,
      queue_size: 0
    });
  };

  const formatTime = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    const days = Math.floor(hrs / 24);
    return `${days}d`;
  };

  const getScoreClass = (score: number) => {
    if (score >= 90) return 'text-blue-400 font-bold';
    if (score >= 80) return 'text-cyan-400 font-semibold';
    if (score >= 70) return 'text-yellow-400';
    return 'text-gray-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400">Loading admin data...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 overflow-auto">
      {/* Compact Header */}
      <div className="border-b border-gray-800 bg-gray-900/95 sticky top-0 z-30">
        <div className="max-w-[1800px] mx-auto px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-white pl-20">⚙️ Admin Analytics</h1>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <Link to="/" className="text-gray-400 hover:text-white">Home</Link>
            <Link to="/admin/control" className="text-gray-400 hover:text-white">Control Center</Link>
            <Link to="/market-trends" className="text-gray-400 hover:text-white">Trends</Link>
            <Link to="/matching" className="text-cyan-400 hover:text-cyan-300 font-bold">⚡ Match</Link>
            <span className="text-gray-600">|</span>
            <span className="text-gray-500">Updated: {new Date().toLocaleTimeString()}</span>
            <button onClick={refresh} disabled={refreshing} className="text-gray-400 hover:text-white">
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1800px] mx-auto p-4 space-y-4">
        {/* System Health Row */}
        <div className="grid grid-cols-5 gap-2 text-xs">
          <HealthCell icon={<CheckCircle className="w-3 h-3" />} label="Active RSS" value={systemHealth?.rss_sources_active || 0} status="good" />
          <HealthCell icon={<AlertTriangle className="w-3 h-3" />} label="Match Queue" value={matchQueue.length} status={matchQueue.length > 100 ? 'warning' : 'good'} />
          <HealthCell icon={<CheckCircle className="w-3 h-3" />} label="Data Quality" value={`${Math.round((dataQuality[0]?.complete || 0) / (dataQuality[0]?.total || 1) * 100)}%`} status="good" />
          <HealthCell icon={<XCircle className="w-3 h-3" />} label="Missing Data" value={dataQuality.reduce((sum, d) => sum + d.missing_key_fields, 0)} status={dataQuality.reduce((sum, d) => sum + d.missing_key_fields, 0) > 50 ? 'error' : 'warning'} />
          <HealthCell icon={<Database className="w-3 h-3" />} label="Incomplete" value={startupGaps ? startupGaps.total - startupGaps.has_all_data : 0} status={startupGaps && (startupGaps.total - startupGaps.has_all_data) > 100 ? 'warning' : 'good'} />
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-4">
          {/* Match Queue */}
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-700 bg-gray-800/80 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white">🔥 High-Score Matches Pending</h2>
              <Link to="/matching" className="text-xs text-cyan-400 hover:text-cyan-300">Manage All →</Link>
            </div>
            <div className="overflow-x-auto max-h-72">
              <table className="w-full text-xs">
                <thead className="bg-gray-700/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-400">Startup</th>
                    <th className="text-left px-2 py-2 text-gray-400">Investor</th>
                    <th className="text-right px-2 py-2 text-gray-400">Score</th>
                    <th className="text-right px-3 py-2 text-gray-400">Age</th>
                  </tr>
                </thead>
                <tbody>
                  {matchQueue.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                        No high-score matches found
                      </td>
                    </tr>
                  ) : (
                    matchQueue.slice(0, 15).map((m) => (
                      <tr key={m.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                        <td className="px-3 py-1.5">
                          <Link to={`/startup/${m.startup_id}`} className="text-white hover:text-cyan-400">{m.startup_name}</Link>
                        </td>
                        <td className="px-2 py-1.5">
                          <Link to={`/investor/${m.investor_id}`} className="text-gray-300 hover:text-violet-400">{m.investor_name}</Link>
                        </td>
                        <td className={`px-2 py-1.5 text-right font-mono ${getScoreClass(m.match_score)}`}>{m.match_score}%</td>
                        <td className="px-3 py-1.5 text-right text-gray-500">{formatTime(m.created_at)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Data Quality Table */}
          <div className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-700 bg-gray-800/80">
              <h2 className="text-sm font-semibold text-white">📊 Data Quality Report</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-700/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-400">Table</th>
                    <th className="text-right px-2 py-2 text-gray-400">Total</th>
                    <th className="text-right px-2 py-2 text-gray-400">Complete</th>
                    <th className="text-right px-2 py-2 text-gray-400">Missing</th>
                    <th className="text-right px-2 py-2 text-gray-400">Quality</th>
                    <th className="text-right px-3 py-2 text-gray-400">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {dataQuality.map((d) => {
                    const quality = d.total > 0 ? Math.round((d.complete / d.total) * 100) : 0;
                    return (
                      <tr key={d.table} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                        <td className="px-3 py-1.5 text-white font-mono">{d.table}</td>
                        <td className="px-2 py-1.5 text-right text-gray-300 font-mono">{d.total.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right text-green-400 font-mono">{d.complete.toLocaleString()}</td>
                        <td className="px-2 py-1.5 text-right text-red-400 font-mono">{d.missing_key_fields}</td>
                        <td className="px-2 py-1.5 text-right">
                          <span className={`font-mono ${quality >= 80 ? 'text-green-400' : quality >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                            {quality}%
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-right text-gray-500">{formatTime(d.last_updated)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Startup Data Gaps Panel */}
        {startupGaps && (
          <div className="bg-gray-800/50 rounded-lg border border-cyan-500/30 overflow-hidden">
            <div className="px-3 py-2 border-b border-gray-700 bg-cyan-600/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-cyan-400" />
                <h2 className="text-sm font-semibold text-white">⚠️ Startup Data Gaps ({startupGaps.total - startupGaps.has_all_data} need enrichment)</h2>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={bulkEnrichAI} 
                  disabled={enriching}
                  className="px-2 py-1 bg-cyan-700 hover:bg-cyan-600 rounded text-xs flex items-center gap-1 disabled:opacity-50"
                >
                  <Zap className="w-3 h-3" /> {enriching ? 'Enriching...' : 'AI Enrich (20)'}
                </button>
              </div>
            </div>
            
            {/* Gap Summary */}
            <div className="grid grid-cols-6 gap-2 p-3 border-b border-gray-700/50 text-xs">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{startupGaps.total}</div>
                <div className="text-gray-500">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{startupGaps.missing_description}</div>
                <div className="text-gray-500">No Description</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{startupGaps.missing_sectors}</div>
                <div className="text-gray-500">No Sectors</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{startupGaps.missing_website}</div>
                <div className="text-gray-500">No Website</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-400">{startupGaps.missing_location}</div>
                <div className="text-gray-500">No Location</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">{startupGaps.has_all_data}</div>
                <div className="text-gray-500">Complete</div>
              </div>
            </div>

            {/* Incomplete Startups Table */}
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs">
                <thead className="bg-gray-700/50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 text-gray-400">Startup</th>
                    <th className="text-left px-2 py-2 text-gray-400">Tagline</th>
                    <th className="text-center px-2 py-2 text-gray-400">Desc</th>
                    <th className="text-center px-2 py-2 text-gray-400">Sectors</th>
                    <th className="text-center px-2 py-2 text-gray-400">Web</th>
                    <th className="text-center px-2 py-2 text-gray-400">Loc</th>
                    <th className="text-right px-2 py-2 text-gray-400">GOD</th>
                    <th className="text-center px-3 py-2 text-gray-400">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {incompleteStartups.map((s) => (
                    <tr key={s.id} className="border-t border-gray-700/50 hover:bg-gray-700/30">
                      <td className="px-3 py-1.5">
                        <Link to={`/startup/${s.id}`} className="text-white hover:text-cyan-400 font-medium">
                          {s.name}
                        </Link>
                      </td>
                      <td className="px-2 py-1.5 text-gray-400 truncate max-w-40">{s.tagline || '-'}</td>
                      <td className="px-2 py-1.5 text-center">
                        {s.has_description ? <CheckCircle className="w-3 h-3 text-green-400 inline" /> : <XCircle className="w-3 h-3 text-red-400 inline" />}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {s.has_sectors ? <CheckCircle className="w-3 h-3 text-green-400 inline" /> : <XCircle className="w-3 h-3 text-red-400 inline" />}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {s.has_website ? <CheckCircle className="w-3 h-3 text-green-400 inline" /> : <XCircle className="w-3 h-3 text-yellow-400 inline" />}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {s.has_location ? <CheckCircle className="w-3 h-3 text-green-400 inline" /> : <XCircle className="w-3 h-3 text-yellow-400 inline" />}
                      </td>
                      <td className={`px-2 py-1.5 text-right font-mono ${getScoreClass(s.total_god_score)}`}>
                        {s.total_god_score}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Link
                            to={`/startup/${s.id}/matches`}
                            onClick={(e) => e.stopPropagation()}
                            className="px-1.5 py-0.5 bg-purple-500/20 hover:bg-purple-500/40 rounded text-purple-400 text-[10px]"
                            title="View Matches"
                          >
                            <Target className="w-3 h-3 inline" />
                          </Link>
                          {((!s.has_description || !s.has_sectors) && s.tagline) && (
                            <button 
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await enrichWithAI(s);
                                  alert(`✅ Successfully enriched ${s.name}`);
                                  await loadIncompleteStartups();
                                  await loadStartupGaps();
                                } catch (error: any) {
                                  console.error('Enrichment error:', error);
                                  alert(`❌ Failed to enrich ${s.name}: ${error?.message || 'Unknown error'}`);
                                }
                              }}
                              className="px-1.5 py-0.5 bg-cyan-600/20 hover:bg-cyan-600/40 rounded text-cyan-400 text-[10px]"
                              title="Generate description + infer sectors from tagline"
                            >
                              <Zap className="w-3 h-3 inline" /> AI
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Quick Actions - Minimal, just links */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-3">
          <div className="flex items-center gap-6 text-xs">
            <span className="text-gray-500 font-semibold">Quick Links:</span>
            <Link to="/admin/bulk-upload" className="text-blue-400 hover:text-blue-300">Bulk Upload</Link>
            <Link to="/admin/discovered-investors" className="text-violet-400 hover:text-violet-300">Manage Investors</Link>
            <Link to="/matching" className="text-cyan-400 hover:text-cyan-300">Matching Engine</Link>
            <Link to="/admin/rss-manager" className="text-green-400 hover:text-green-300">RSS Sources</Link>
            <Link to="/admin/discovered-startups" className="text-cyan-400 hover:text-cyan-300">Discovered Startups</Link>
            <Link to="/market-trends" className="text-blue-400 hover:text-cyan-300">Market Trends</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthCell({ icon, label, value, status }: { icon: React.ReactNode; label: string; value: number | string; status: 'good' | 'warning' | 'error' }) {
  const statusClass = {
    good: 'text-green-400 border-green-500/30',
    warning: 'text-yellow-400 border-yellow-500/30',
    error: 'text-red-400 border-red-500/30'
  }[status];

  return (
    <div className={`bg-gray-800/50 rounded px-3 py-2 border ${statusClass}`}>
      <div className="flex items-center gap-2">
        <span className={statusClass.split(' ')[0]}>{icon}</span>
        <div>
          <div className={`font-mono font-bold text-lg ${statusClass.split(' ')[0]}`}>{value}</div>
          <div className="text-gray-500 text-[10px]">{label}</div>
        </div>
      </div>
    </div>
  );
}
