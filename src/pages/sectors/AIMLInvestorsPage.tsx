import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Brain, Cpu, Rocket, Users } from 'lucide-react';
import PythhUnifiedNav from '../../components/PythhUnifiedNav';
import SEO from '../../components/SEO';
import { supabase } from '../../lib/supabase';
import { PYTHH_MARKETING_BG } from '../../lib/pythhMarketingTheme';

interface Investor {
  id: string;
  name: string;
  firm: string | null;
  investor_score?: number | null;
  sectors: string[] | null;
}

interface Startup {
  id: string;
  name: string;
  total_god_score: number;
  sectors: string[] | null;
}

export default function AIMLInvestorsPage() {
  const [topInvestors, setTopInvestors] = useState<Investor[]>([]);
  const [topStartups, setTopStartups] = useState<Startup[]>([]);
  const [stats, setStats] = useState({ investors: 0, startups: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: investors, error: invErr } = await supabase
          .from('investors')
          .select('id, name, firm, investor_score, sectors')
          .contains('sectors', ['AI/ML'])
          .order('investor_score', { ascending: false })
          .limit(12);

        if (invErr) throw invErr;
        setTopInvestors((investors || []) as Investor[]);

        const { data: startups, error: suErr } = await supabase
          .from('startup_uploads')
          .select('id, name, total_god_score, sectors')
          .contains('sectors', ['AI/ML'])
          .eq('status', 'approved')
          .order('total_god_score', { ascending: false })
          .limit(8);

        if (suErr) throw suErr;
        setTopStartups((startups || []) as Startup[]);

        const { count: investorCount } = await supabase
          .from('investors')
          .select('*', { count: 'exact', head: true })
          .contains('sectors', ['AI/ML']);

        const { count: startupCount } = await supabase
          .from('startup_uploads')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'approved')
          .contains('sectors', ['AI/ML']);

        setStats({
          investors: investorCount || 0,
          startups: startupCount || 0,
        });
      } catch (e) {
        console.error('Error loading AI/ML sector data:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={PYTHH_MARKETING_BG}>
      <SEO
        title="Top AI/ML Investors - Find Your Perfect AI Startup Investor | Pythh"
        description="Discover the most active AI/ML investors. Connect with VCs and angels investing in artificial intelligence and machine learning startups. 300+ AI-focused investors."
        keywords="AI investors, ML investors, artificial intelligence VC, machine learning funding, AI startup investors, AI/ML venture capital"
        canonical="/ai-ml-investors"
      />
      <PythhUnifiedNav />

      <div className="container mx-auto px-4 pt-24 pb-16">
        {/* Hero — aligned with Robotics / DeepTech structure */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-violet-500/10 text-violet-200/95 mb-6">
            <Brain className="w-4 h-4 text-violet-300" />
            <span className="font-medium">AI/ML Sector Focus</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-violet-200 to-cyan-300 bg-clip-text text-transparent">
            Top AI/ML Investors & Signals
          </h1>

          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-12">
            Real-time intelligence on investors actively funding AI and ML — from foundation models to applied ML,
            infra, and tooling. Track thesis and find your match.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
            <div className="bg-white/[0.03] rounded-lg p-5 backdrop-blur-sm transition-colors hover:bg-white/[0.05]">
              <Users className="w-8 h-8 text-violet-400 mx-auto mb-3" />
              <div className="text-3xl font-bold text-white mb-1">{stats.investors}+</div>
              <div className="text-slate-400">Active AI/ML Investors</div>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-5 backdrop-blur-sm transition-colors hover:bg-white/[0.05]">
              <Cpu className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
              <div className="text-3xl font-bold text-white mb-1">{stats.startups}+</div>
              <div className="text-slate-400">AI/ML Startups Tracked</div>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-5 backdrop-blur-sm transition-colors hover:bg-white/[0.05]">
              <Rocket className="w-8 h-8 text-amber-400 mx-auto mb-3" />
              <div className="text-3xl font-bold text-white mb-1">Signal-first</div>
              <div className="text-slate-400">Matches from real founder signals</div>
            </div>
          </div>
        </div>

        {/* Investors */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8">Leading AI/ML Investors</h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-400 mx-auto" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {topInvestors.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-white/[0.03] rounded-lg p-5 backdrop-blur-sm transition-colors hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{inv.name}</h3>
                      {inv.firm && (
                        <span className="text-sm text-slate-400">{inv.firm}</span>
                      )}
                    </div>
                    {typeof inv.investor_score === 'number' && (
                      <div className="px-2 py-0.5 rounded-md bg-violet-500/15">
                        <span className="text-violet-200 font-mono text-sm tabular-nums">
                          {inv.investor_score.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {inv.sectors?.slice(0, 4).map((sector, idx) => (
                      <span
                        key={idx}
                        className="text-xs text-slate-400"
                      >
                        {sector}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Startups */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8">Highest-Scoring AI/ML Startups</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {topStartups.map((s) => (
              <div
                key={s.id}
                className="bg-white/[0.03] rounded-lg p-5 backdrop-blur-sm transition-colors hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white">{s.name}</h3>
                  <div className="px-2 py-0.5 rounded-md bg-cyan-500/15">
                    <span className="text-cyan-300 text-sm font-mono tabular-nums">{s.total_god_score}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {s.sectors?.slice(0, 3).map((sector, idx) => (
                    <span
                      key={idx}
                      className="text-xs text-slate-400"
                    >
                      {sector}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <section className="max-w-4xl mx-auto">
          <div className="rounded-xl bg-white/[0.03] p-8 sm:p-12 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Find Your Perfect AI/ML Investor Match
            </h2>
            <p className="text-lg text-slate-400 mb-8 max-w-2xl mx-auto">
              Enter your startup URL and we&apos;ll show you which AI/ML investors fit best — from signal, not guesswork.
            </p>
            <Link
              to="/signal-matches"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-violet-500 text-white text-base font-semibold hover:bg-violet-400 transition-colors"
            >
              Get Your AI/ML Matches →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
