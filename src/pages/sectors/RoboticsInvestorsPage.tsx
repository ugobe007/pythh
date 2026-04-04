import React, { useState, useEffect } from 'react';
import { Cpu, Bot, Rocket, Users } from 'lucide-react';
import PythhUnifiedNav from '../../components/PythhUnifiedNav';
import SEO from '../../components/SEO';
import { supabase } from '../../lib/supabase';

interface Investor {
  id: string;
  name: string;
  type: string | null;
  sectors: string[] | null;
  stage: string[] | null;
  investor_score?: number | null;
}

interface Startup {
  id: string;
  name: string;
  total_god_score: number;
  sectors: string[] | null;
}

const RoboticsInvestorsPage: React.FC = () => {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [startups, setStartups] = useState<Startup[]>([]);
  const [stats, setStats] = useState({ investors: 0, startups: 0, totalRaised: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSectorData();
  }, []);

  const loadSectorData = async () => {
    try {
      // Robotics-focused investors
      const { data: investorData, error: investorError } = await supabase
        .from('investors')
        .select('id, name, type, sectors, stage, investor_score')
        .contains('sectors', ['Robotics'])
        .order('investor_score', { ascending: false })
        .limit(12);

      if (investorError) throw investorError;
      if (investorData) setInvestors(investorData as Investor[]);

      // Top robotics startups by GOD score
      const { data: startupData, error: startupError } = await supabase
        .from('startup_uploads')
        .select('id, name, total_god_score, sectors')
        .eq('status', 'approved')
        .contains('sectors', ['Robotics'])
        .order('total_god_score', { ascending: false })
        .limit(8);

      if (startupError) throw startupError;
      if (startupData) setStartups(startupData as Startup[]);

      // Aggregate stats (counts only for now)
      const { count: investorCount } = await supabase
        .from('investors')
        .select('*', { count: 'exact', head: true })
        .contains('sectors', ['Robotics']);

      const { count: startupCount } = await supabase
        .from('startup_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .contains('sectors', ['Robotics']);

      setStats({
        investors: investorCount || 0,
        startups: startupCount || 0,
        // Placeholder until we wire capital raised aggregation for robotics
        totalRaised: 0,
      });
    } catch (error) {
      console.error('Error loading Robotics sector data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-slate-950 to-black">
      <SEO
        title="Top Robotics Investors – Humanoids, Warehouse Automation, Autonomous Systems | Pythh"
        description="Discover the most active robotics and automation investors. From humanoids to warehouse robots and autonomous systems, find VCs backing real-world robotics."
        keywords="robotics investors, humanoid robot investors, warehouse robotics VC, autonomous systems investors, hardware robotics funding"
        canonical="/robotics-investors"
      />
      <PythhUnifiedNav />

      <div className="container mx-auto px-4 pt-24 pb-16">
        {/* Hero */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-cyan-500/10 text-cyan-200/95 mb-6">
            <Bot className="w-4 h-4 text-cyan-400" />
            <span className="font-medium">Robotics & Automation</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-cyan-200 to-sky-400 bg-clip-text text-transparent">
            Top Robotics Investors
          </h1>

          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-12">
            The investors funding humanoids, warehouse automation, industrial robots, and next-gen autonomous systems.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
            <div className="bg-white/[0.03] rounded-lg p-5 backdrop-blur-sm transition-colors hover:bg-white/[0.05]">
              <Users className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
              <div className="text-3xl font-bold text-white mb-1">{stats.investors}+</div>
              <div className="text-slate-400">Active Robotics Investors</div>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-5 backdrop-blur-sm transition-colors hover:bg-white/[0.05]">
              <Cpu className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
              <div className="text-3xl font-bold text-white mb-1">{stats.startups}+</div>
              <div className="text-slate-400">Robotics Startups Tracked</div>
            </div>
            <div className="bg-white/[0.03] rounded-lg p-5 backdrop-blur-sm transition-colors hover:bg-white/[0.05]">
              <Rocket className="w-8 h-8 text-cyan-400 mx-auto mb-3" />
              <div className="text-3xl font-bold text-white mb-1">Signal-first</div>
              <div className="text-slate-400">Matches based on real founder signals</div>
            </div>
          </div>
        </div>

        {/* Investors grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8">Leading Robotics Investors</h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400 mx-auto" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {investors.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-white/[0.03] rounded-lg p-5 backdrop-blur-sm transition-colors hover:bg-white/[0.06]"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{inv.name}</h3>
                      {inv.type && (
                        <span className="text-xs text-slate-500">{inv.type}</span>
                      )}
                    </div>
                    {typeof inv.investor_score === 'number' && (
                      <div className="px-2 py-0.5 rounded-md bg-cyan-500/15">
                        <span className="text-cyan-300 font-mono text-sm tabular-nums">
                          {inv.investor_score.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-slate-300">
                    {inv.stage && inv.stage.length > 0 && (
                      <div>
                        <span className="text-slate-500">Stage focus:</span>{' '}
                        {inv.stage.join(', ')}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {inv.sectors?.slice(0, 3).map((sector, idx) => (
                        <span
                          key={idx}
                          className="text-xs text-slate-400"
                        >
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

        {/* Startups grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8">High-scoring Robotics Startups</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {startups.map((s) => (
              <div
                key={s.id}
                className="bg-white/[0.03] rounded-lg p-5 backdrop-blur-sm transition-colors hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white">{s.name}</h3>
                  <div className="px-2 py-0.5 rounded-md bg-cyan-500/15">
                    <span className="text-cyan-300 text-sm font-mono tabular-nums">
                      {s.total_god_score}
                    </span>
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
      </div>
    </div>
  );
};

export default RoboticsInvestorsPage;

