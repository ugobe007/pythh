/**
 * MATCH REVIEW PAGE
 * =================
 * Quick access page to review the new matching system
 */

import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Search, 
  Rocket, 
  Briefcase, 
  ExternalLink,
  Loader2,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function MatchReviewPage() {
  const navigate = useNavigate();
  const [startups, setStartups] = useState<any[]>([]);
  const [investors, setInvestors] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load sample startups
      const { data: startupsData } = await supabase
        .from('startup_uploads')
        .select('id, name, tagline, total_god_score, stage, sectors')
        .eq('status', 'approved')
        .order('total_god_score', { ascending: false, nullsLast: true })
        .limit(10);

      // Load sample investors
      const { data: investorsData } = await supabase
        .from('investors')
        .select('id, name, firm, investor_type, sectors, stage')
        .limit(10);

      setStartups(startupsData || []);
      setInvestors(investorsData || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredStartups = startups.filter(s => 
    !searchQuery || 
    s.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.tagline?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredInvestors = investors.filter(i => 
    !searchQuery || 
    i.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    i.firm?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-purple-400" />
            Match Review Dashboard
          </h1>
          <p className="text-slate-400">
            Review the new GOD Score-based matching system. Click on any startup or investor to see their matches.
          </p>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search startups or investors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
            />
          </div>
        </div>

        {/* Startups Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Rocket className="w-6 h-6 text-cyan-400" />
              Startups ({filteredStartups.length})
            </h2>
            <Link
              to="/matching-engine"
              className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              View All Matches <ExternalLink className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredStartups.map((startup) => (
              <Link
                key={startup.id}
                to={`/startup/${startup.id}/matches`}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-cyan-500/50 hover:bg-slate-800 transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition-colors">
                      {startup.name}
                    </h3>
                    {startup.tagline && (
                      <p className="text-sm text-slate-400 line-clamp-2 mt-1">
                        {startup.tagline}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-colors flex-shrink-0 ml-2" />
                </div>
                
                <div className="flex items-center gap-3 mt-3">
                  {startup.total_god_score && (
                    <span className="px-2 py-1 bg-purple-500/20 text-purple-300 rounded text-xs font-semibold">
                      GOD: {startup.total_god_score}
                    </span>
                  )}
                  {startup.stage && (
                    <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                      {startup.stage}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {filteredStartups.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              No startups found matching "{searchQuery}"
            </div>
          )}
        </div>

        {/* Investors Section */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Briefcase className="w-6 h-6 text-blue-400" />
              Investors ({filteredInvestors.length})
            </h2>
            <Link
              to="/investors"
              className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1"
            >
              View All Investors <ExternalLink className="w-4 h-4" />
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredInvestors.map((investor) => (
              <Link
                key={investor.id}
                to={`/investor/${investor.id}/matches`}
                className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 hover:border-cyan-500/50 hover:bg-slate-800 transition-all group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                      {investor.name}
                    </h3>
                    {investor.firm && (
                      <p className="text-sm text-slate-400 mt-1">
                        {investor.firm}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-blue-400 transition-colors flex-shrink-0 ml-2" />
                </div>
                
                <div className="flex items-center gap-3 mt-3">
                  {investor.investor_type && (
                    <span className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs font-semibold">
                      {investor.investor_type}
                    </span>
                  )}
                  {investor.stage && investor.stage.length > 0 && (
                    <span className="px-2 py-1 bg-slate-700 text-slate-300 rounded text-xs">
                      {investor.stage[0]}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {filteredInvestors.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              No investors found matching "{searchQuery}"
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="mt-12 bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">Quick Links</h3>
          <div className="grid md:grid-cols-3 gap-4">
            <Link
              to="/matching-engine"
              className="p-4 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 rounded-xl hover:border-cyan-500/50 transition-all"
            >
              <div className="text-white font-semibold mb-1">Matching Engine</div>
              <div className="text-sm text-slate-400">View all matches</div>
            </Link>
            <Link
              to="/admin/god-scores"
              className="p-4 bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30 rounded-xl hover:border-purple-500/50 transition-all"
            >
              <div className="text-white font-semibold mb-1">GOD Scores</div>
              <div className="text-sm text-slate-400">View scoring dashboard</div>
            </Link>
            <Link
              to="/admin/analytics"
              className="p-4 bg-gradient-to-r from-cyan-500/20 to-teal-500/20 border border-cyan-500/30 rounded-xl hover:border-cyan-500/50 transition-all"
            >
              <div className="text-white font-semibold mb-1">Analytics</div>
              <div className="text-sm text-slate-400">View match analytics</div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}


