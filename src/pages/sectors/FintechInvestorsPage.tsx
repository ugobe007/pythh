import React, { useState, useEffect } from 'react';
import { TrendingUp, Target, DollarSign, Users } from 'lucide-react';
import PythhUnifiedNav from '../../components/PythhUnifiedNav';
import SEO from '../../components/SEO';
import { supabase } from '../../lib/supabase';

interface Investor {
  id: string;
  name: string;
  type: string;
  sectors: string[];
  stage: string;
  total_score?: number;
  check_size?: string;
}

interface Startup {
  id: string;
  name: string;
  total_god_score: number;
  problem?: string;
  solution?: string;
  logo_url?: string;
}

const FintechInvestorsPage: React.FC = () => {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [startups, setStartups] = useState<Startup[]>([]);
  const [stats, setStats] = useState({ investors: 0, startups: 0, totalRaised: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSectorData();
  }, []);

  const loadSectorData = async () => {
    try {
      // Load Fintech investors
      const { data: investorData, error: investorError } = await supabase
        .from('investors')
        .select('id, name, type, sectors, stage, total_score, check_size')
        .contains('sectors', ['Fintech'])
        .order('total_score', { ascending: false })
        .limit(12);

      if (investorError) throw investorError;
      if (investorData) setInvestors(investorData);

      // Load top Fintech startups
      const { data: startupData, error: startupError } = await supabase
        .from('startup_uploads')
        .select('id, name, total_god_score, problem, solution, logo_url, extracted_data')
        .eq('status', 'approved')
        .contains('sectors', ['Fintech'])
        .order('total_god_score', { ascending: false })
        .limit(8);

      if (startupError) throw startupError;
      if (startupData) setStartups(startupData);

      // Calculate stats
      const { count: investorCount } = await supabase
        .from('investors')
        .select('*', { count: 'exact', head: true })
        .contains('sectors', ['Fintech']);

      const { count: startupCount } = await supabase
        .from('startup_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .contains('sectors', ['Fintech']);

      setStats({
        investors: investorCount || 0,
        startups: startupCount || 0,
        totalRaised: 280 // Placeholder - would calculate from actual data
      });

    } catch (error) {
      console.error('Error loading Fintech sector data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <SEO
        title="Top Fintech Investors - Find Your Perfect Fintech Startup Investor | Hot Honey"
        description="Connect with leading fintech investors. Discover VCs and angels investing in payments, banking, and financial technology startups. 250+ fintech-focused investors."
        keywords="fintech investors, payments VC, banking investors, financial technology funding, fintech startup investors, fintech venture capital"
        canonical="/fintech-investors"
      />
      <PythhUnifiedNav />
      
      <div className="container mx-auto px-4 pt-24 pb-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400 font-medium">Fintech Sector</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Top Fintech Investors
          </h1>
          
          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-12">
            Discover the most active investors transforming financial services, payments, and banking technology
          </p>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <Users className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
              <div className="text-3xl font-bold text-white mb-1">{stats.investors}+</div>
              <div className="text-slate-400">Active Investors</div>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <Target className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
              <div className="text-3xl font-bold text-white mb-1">{stats.startups}+</div>
              <div className="text-slate-400">Funded Startups</div>
            </div>
            <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6">
              <TrendingUp className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
              <div className="text-3xl font-bold text-white mb-1">${stats.totalRaised}B+</div>
              <div className="text-slate-400">Total Raised</div>
            </div>
          </div>
        </div>

        {/* Top Investors Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8">Leading Fintech Investors</h2>
          
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {investors.map((investor) => (
                <div key={investor.id} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-emerald-500/50 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{investor.name}</h3>
                      <span className="text-sm text-emerald-400">{investor.type}</span>
                    </div>
                    {investor.total_score && (
                      <div className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <span className="text-emerald-400 font-bold">{investor.total_score}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="text-slate-300">
                      <span className="text-slate-500">Stage:</span> {investor.stage}
                    </div>
                    {investor.check_size && (
                      <div className="text-slate-300">
                        <span className="text-slate-500">Check Size:</span> {investor.check_size}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {investor.sectors?.slice(0, 3).map((sector, idx) => (
                        <span key={idx} className="px-2 py-1 rounded-md bg-slate-700/50 text-xs text-slate-300">
                          {sector}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Startups Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8">Top Fintech Startups</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {startups.map((startup) => (
              <div key={startup.id} className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-6 hover:border-emerald-500/50 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white">{startup.name}</h3>
                  <div className="px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-emerald-400 text-sm font-bold">{startup.total_god_score}</span>
                  </div>
                </div>
                <p className="text-sm text-slate-400 line-clamp-3">
                  {startup.solution || startup.problem || 'Innovative Fintech solution'}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-600/10 to-emerald-500/10 border border-emerald-500/20 rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Find Your Perfect Fintech Investor</h2>
          <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">
            Get AI-powered matches with investors specifically looking for Fintech startups like yours
          </p>
          <a 
            href="/"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold hover:from-emerald-600 hover:to-emerald-700 transition-all transform hover:scale-105"
          >
            <Target className="w-5 h-5" />
            Analyze Your Startup
          </a>
        </div>
      </div>
    </div>
  );
};

export default FintechInvestorsPage;
