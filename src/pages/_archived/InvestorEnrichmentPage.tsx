import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Users, TrendingUp, CheckCircle, Clock, Play, RefreshCw, Loader2, Home, Settings, BarChart3, Upload, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface EnrichmentStats {
  total: number;
  enriched: number;
  hasPartners: number;
  hasInvestments: number;
  hasThesis: number;
  recentlyAdded: number;
}

export default function InvestorEnrichmentPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EnrichmentStats>({
    total: 0,
    enriched: 0,
    hasPartners: 0,
    hasInvestments: 0,
    hasThesis: 0,
    recentlyAdded: 0
  });
  const [recentInvestors, setRecentInvestors] = useState<any[]>([]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const { data: investors, error } = await supabase
        .from('investors')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (!investors) return;

      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentlyAdded = investors.filter(
        i => i.created_at && new Date(i.created_at) > oneHourAgo
      ).length;

      const enriched = investors.filter(i => i.last_enrichment_date).length;
      const hasPartners = investors.filter(i => i.partners && i.partners !== null).length;
      const hasInvestments = investors.filter(i => i.notable_investments && i.notable_investments !== null).length;
      const hasThesis = investors.filter(i => i.investment_thesis && i.investment_thesis !== '').length;

      setStats({
        total: investors.length,
        enriched,
        hasPartners,
        hasInvestments,
        hasThesis,
        recentlyAdded
      });

      setRecentInvestors(investors.slice(0, 10));
      setLoading(false);
    } catch (error) {
      console.error('Error loading investor data:', error);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1a1140] via-[#2d1b69] to-[#4a2a8f] relative overflow-hidden">
      {/* Navigation Bar */}
      <div className="bg-white/5 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-center gap-2 text-sm">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white transition-all">← Back</button>
          <span className="text-gray-600">|</span>
          <Link to="/" className="text-gray-400 hover:text-white transition-all">🏠 Home</Link>
          <span className="text-gray-600">|</span>
          <Link to="/admin/control" className="text-gray-400 hover:text-white transition-all">⚙️ Control Center</Link>
          <span className="text-gray-600">|</span>
          <Link to="/bulkupload" className="text-gray-400 hover:text-white transition-all">📤 Bulk Upload</Link>
          <span className="text-gray-600">|</span>
          <Link to="/admin/discovered-investors" className="text-gray-400 hover:text-white transition-all">👥 Investors</Link>
          <span className="text-gray-600">|</span>
          <Link to="/vote" className="text-cyan-400 hover:text-cyan-300 transition-all font-bold">⚡ Match</Link>
        </div>
      </div>

      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-cyan-600/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div className="relative z-10 container mx-auto px-8 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-5xl font-bold text-white mb-3">
                Investor <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">Enrichment</span>
              </h1>
              <p className="text-gray-300 text-lg">Real-time tracking of investor discovery and data enrichment</p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin/control')}
                className="flex items-center gap-2 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-lg transition-all"
              >
                ← Control Center
              </button>
              <button
                onClick={loadData}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:bg-gray-600 text-white font-bold rounded-lg transition-all shadow-lg"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-700/80 backdrop-blur-lg border-2 border-cyan-400/60 rounded-3xl p-8 shadow-2xl mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-8 h-8 text-cyan-300" />
            <h2 className="text-3xl font-bold text-white">Enrichment Status</h2>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {/* Total Investors */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-6 h-6 text-cyan-400" />
                <h3 className="text-gray-300 text-sm uppercase tracking-wide">Total Investors</h3>
              </div>
              <div className="text-5xl font-bold text-white mb-2">{stats.total}</div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-green-400 font-bold">+{stats.recentlyAdded}</span>
                <span className="text-gray-400">added in last hour</span>
              </div>
            </div>

            {/* Enrichment Progress */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-6 h-6 text-green-400" />
                <h3 className="text-gray-300 text-sm uppercase tracking-wide">Fully Enriched</h3>
              </div>
              <div className="text-5xl font-bold text-white mb-2">{stats.enriched}</div>
              <div className="text-sm text-gray-400 mb-3">
                {Math.round((stats.enriched / stats.total) * 100)}% complete
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${(stats.enriched / stats.total) * 100}%` }}
                />
              </div>
            </div>

            {/* Pending Enrichment */}
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-6 h-6 text-blue-400" />
                <h3 className="text-gray-300 text-sm uppercase tracking-wide">Needs Enrichment</h3>
              </div>
              <div className="text-5xl font-bold text-white mb-2">{stats.total - stats.enriched}</div>
              <div className="text-sm text-gray-400">
                ~{Math.ceil((stats.total - stats.enriched) * 2 / 60)} minutes to complete
              </div>
            </div>
          </div>
        </div>

        {/* Data Completeness */}
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-700/80 backdrop-blur-lg border-2 border-cyan-400/60 rounded-3xl p-8 shadow-2xl mb-12">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-8 h-8 text-cyan-300" />
            <h2 className="text-3xl font-bold text-white">Data Completeness</h2>
          </div>
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300 text-sm uppercase font-medium">Has Partners</span>
                <span className="text-cyan-400 font-bold text-lg">{Math.round((stats.hasPartners / stats.total) * 100)}%</span>
              </div>
              <div className="text-3xl font-bold text-white mb-3">{stats.hasPartners}</div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 h-2 rounded-full"
                  style={{ width: `${(stats.hasPartners / stats.total) * 100}%` }}
                />
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300 text-sm uppercase font-medium">Has Investments</span>
                <span className="text-blue-400 font-bold text-lg">{Math.round((stats.hasInvestments / stats.total) * 100)}%</span>
              </div>
              <div className="text-3xl font-bold text-white mb-3">{stats.hasInvestments}</div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 h-2 rounded-full"
                  style={{ width: `${(stats.hasInvestments / stats.total) * 100}%` }}
                />
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-6 border border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-300 text-sm uppercase font-medium">Has Thesis</span>
                <span className="text-blue-400 font-bold text-lg">{Math.round((stats.hasThesis / stats.total) * 100)}%</span>
              </div>
              <div className="text-3xl font-bold text-white mb-3">{stats.hasThesis}</div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-cyan-600 to-blue-600 h-2 rounded-full"
                  style={{ width: `${(stats.hasThesis / stats.total) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Recent Investors */}
        <div className="bg-gradient-to-br from-cyan-900/80 to-blue-900/80 backdrop-blur-lg border-2 border-cyan-400/60 rounded-3xl p-8 shadow-2xl mb-12">
          <div className="flex items-center gap-3 mb-6">
            <Clock className="w-8 h-8 text-cyan-300" />
            <h2 className="text-3xl font-bold text-white">Recent Investors</h2>
          </div>
          <div className="space-y-3">
            {recentInvestors.map((investor, i) => (
              <div key={investor.id} className="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between hover:bg-white/10 transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-400/50 flex items-center justify-center text-cyan-300 font-bold">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-white font-bold text-lg">{investor.name}</div>
                    <div className="text-sm text-gray-400">
                      Added {new Date(investor.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {investor.partners ? (
                    <div className="px-4 py-2 bg-green-500/20 border-2 border-green-400 rounded-lg text-green-300 font-bold text-sm uppercase">
                      ✓ Enriched
                    </div>
                  ) : (
                    <div className="px-4 py-2 bg-cyan-500/20 border-2 border-cyan-400 rounded-lg text-cyan-300 font-bold text-sm uppercase">
                      ⏳ Pending
                    </div>
                  )}
                  <button
                    onClick={() => navigate(`/investor/${investor.id}`)}
                    className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg transition-all shadow-lg"
                  >
                    View →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-gradient-to-br from-purple-900/80 to-violet-900/80 backdrop-blur-lg border-2 border-purple-400/60 rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center gap-3 mb-6">
            <Play className="w-8 h-8 text-purple-300" />
            <h2 className="text-3xl font-bold text-white">Quick Actions</h2>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <button
              onClick={() => navigate('/investors')}
              className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-4 px-6 rounded-xl transition-all shadow-lg"
            >
              💰 View All Investors
            </button>
            <button
              onClick={() => navigate('/admin/control')}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-xl transition-all"
            >
              ← Control Center
            </button>
            <button
                onClick={() => navigate('/admin/control')}
              className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-xl transition-all"
            >
              📊 Workflow Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
