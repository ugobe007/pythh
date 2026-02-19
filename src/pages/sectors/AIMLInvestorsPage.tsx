import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PythhUnifiedNav from '../../components/PythhUnifiedNav';
import { supabase } from '../../lib/supabase';

export default function AIMLInvestorsPage() {
  const [topInvestors, setTopInvestors] = useState([]);
  const [topStartups, setTopStartups] = useState([]);
  const [stats, setStats] = useState({ investors: 0, startups: 0, totalRaised: '$2.3B' });

  useEffect(() => {
    async function fetchData() {
      // Fetch AI/ML focused investors
      const { data: investors } = await supabase
        .from('investors')
        .select('name, firm, investor_score, sectors')
        .contains('sectors', ['AI/ML'])
        .order('investor_score', { ascending: false })
        .limit(12);

      // Fetch AI/ML startups
      const { data: startups } = await supabase
        .from('startup_uploads')
        .select('name, total_god_score, sectors')
        .contains('sectors', ['AI/ML'])
        .eq('status', 'approved')
        .order('total_god_score', { ascending: false })
        .limit(8);

      setTopInvestors(investors || []);
      setTopStartups(startups || []);
      
      // Calculate stats
      setStats({
        investors: investors?.length || 0,
        startups: startups?.length || 0,
        totalRaised: '$2.3B'
      });
    }
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e13]">
      <PythhUnifiedNav />

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-16 sm:pt-24 pb-12">
        <div className="max-w-4xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-sm font-medium mb-6">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
            AI/ML Sector Focus
          </div>

          <h1 className="text-5xl sm:text-7xl font-bold text-white mb-6 leading-tight">
            Top AI/ML Investors & Signals
          </h1>

          <p className="text-xl text-zinc-400 mb-8 leading-relaxed">
            Real-time intelligence on {stats.investors}+ investors actively funding AI/ML startups. 
            Track portfolio moves, thesis shifts, and check-size changes to find your perfect match.
          </p>

          <div className="flex flex-wrap gap-6 mb-12">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center">
                <span className="text-2xl font-bold text-cyan-400">{stats.investors}</span>
              </div>
              <div>
                <div className="text-white font-medium">Active Investors</div>
                <div className="text-sm text-zinc-500">AI/ML focused VCs</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center">
                <span className="text-2xl font-bold text-emerald-400">{stats.startups}</span>
              </div>
              <div>
                <div className="text-white font-medium">Top Startups</div>
                <div className="text-sm text-zinc-500">Highest GOD scores</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-violet-500/20 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center">
                <span className="text-xl font-bold text-violet-400">$3B+</span>
              </div>
              <div>
                <div className="text-white font-medium">Capital Raised</div>
                <div className="text-sm text-zinc-500">Last 12 months</div>
              </div>
            </div>
          </div>

          <Link
            to="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500 text-white font-semibold rounded-lg hover:bg-cyan-600 transition"
          >
            Get Your AI/ML Investor Matches →
          </Link>
        </div>
      </section>

      {/* Top Investors */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-12">
        <h2 className="text-3xl font-bold text-white mb-6">Top AI/ML Investors</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topInvestors.map((inv, i) => (
            <div key={i} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-cyan-500/50 transition">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="text-white font-medium">{inv.name}</div>
                  <div className="text-sm text-zinc-500">{inv.firm}</div>
                </div>
                <div className="text-cyan-400 font-mono text-lg">{inv.investor_score?.toFixed(1)}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                {inv.sectors?.slice(0, 3).map((sector, j) => (
                  <span key={j} className="text-xs px-2 py-1 bg-cyan-500/10 text-cyan-400 rounded">
                    {sector}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Top Startups */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-12">
        <h2 className="text-3xl font-bold text-white mb-6">Highest-Scoring AI/ML Startups</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {topStartups.map((startup, i) => (
            <div key={i} className="p-4 bg-zinc-900/50 border border-zinc-800 rounded-lg hover:border-emerald-500/50 transition">
              <div className="text-white font-medium mb-1">{startup.name}</div>
              <div className="text-2xl font-bold text-emerald-400 mb-2">{startup.total_god_score}</div>
              <div className="text-xs text-zinc-500">GOD Score</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-8 py-16">
        <div className="bg-gradient-to-r from-cyan-500/10 via-transparent to-emerald-500/10 border border-cyan-500/20 rounded-2xl p-8 sm:p-12 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Find Your Perfect AI/ML Investor Match
          </h2>
          <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
            Enter your startup URL and we'll show you exactly which AI/ML investors are the best fit based on real-time signals.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-8 py-4 bg-cyan-500 text-white text-lg font-semibold rounded-lg hover:bg-cyan-600 transition shadow-lg shadow-cyan-500/25"
          >
            Get Started Free →
          </Link>
        </div>
      </section>
    </div>
  );
}
