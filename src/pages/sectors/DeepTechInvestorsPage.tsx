import React, { useState, useEffect } from 'react';
import { Atom, Cpu, FlaskConical, Users } from 'lucide-react';
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

const DeepTechInvestorsPage: React.FC = () => {
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [startups, setStartups] = useState<Startup[]>([]);
  const [stats, setStats] = useState({ investors: 0, startups: 0, totalRaised: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSectorData();
  }, []);

  const loadSectorData = async () => {
    try {
      const { data: investorData, error: investorError } = await supabase
        .from('investors')
        .select('id, name, type, sectors, stage, investor_score')
        .contains('sectors', ['DeepTech'])
        .order('investor_score', { ascending: false })
        .limit(12);

      if (investorError) throw investorError;
      if (investorData) setInvestors(investorData as Investor[]);

      const { data: startupData, error: startupError } = await supabase
        .from('startup_uploads')
        .select('id, name, total_god_score, sectors')
        .eq('status', 'approved')
        .contains('sectors', ['DeepTech'])
        .order('total_god_score', { ascending: false })
        .limit(8);

      if (startupError) throw startupError;
      if (startupData) setStartups(startupData as Startup[]);

      const { count: investorCount } = await supabase
        .from('investors')
        .select('*', { count: 'exact', head: true })
        .contains('sectors', ['DeepTech']);

      const { count: startupCount } = await supabase
        .from('startup_uploads')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .contains('sectors', ['DeepTech']);

      setStats({
        investors: investorCount || 0,
        startups: startupCount || 0,
        totalRaised: 0,
      });
    } catch (error) {
      console.error('Error loading DeepTech sector data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-950 via-black to-zinc-950">
      <SEO
        title="Top DeepTech Investors – Frontier Science, Advanced Hardware, Breakthrough Engineering | Pythh"
        description="Discover investors actively backing DeepTech startups across frontier science, advanced hardware, robotics, energy, and breakthrough engineering."
        keywords="deeptech investors, frontier tech investors, advanced hardware VC, breakthrough engineering funding"
        canonical="/deeptech-investors"
      />
      <PythhUnifiedNav />

      <div className="container mx-auto px-4 pt-24 pb-16">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-500/10 border border-violet-500/25 mb-6">
            <Atom className="w-4 h-4 text-violet-300" />
            <span className="text-violet-300 font-medium">DeepTech</span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white via-violet-200 to-cyan-300 bg-clip-text text-transparent">
            Top DeepTech Investors
          </h1>

          <p className="text-xl text-slate-300 max-w-3xl mx-auto mb-12">
            Capital for hard problems: frontier science, advanced systems, and engineering breakthroughs that compound over time.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto mb-16">
            <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-6">
              <Users className="w-8 h-8 text-violet-300 mx-auto mb-3" />
              <div className="text-3xl font-bold text-white mb-1">{stats.investors}+</div>
              <div className="text-slate-400">Active DeepTech Investors</div>
            </div>
            <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-6">
              <FlaskConical className="w-8 h-8 text-violet-300 mx-auto mb-3" />
              <div className="text-3xl font-bold text-white mb-1">{stats.startups}+</div>
              <div className="text-slate-400">DeepTech Startups Tracked</div>
            </div>
            <div className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-6">
              <Cpu className="w-8 h-8 text-violet-300 mx-auto mb-3" />
              <div className="text-3xl font-bold text-white mb-1">Signal-first</div>
              <div className="text-slate-400">Fit by thesis, stage, and timing</div>
            </div>
          </div>
        </div>

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8">Leading DeepTech Investors</h2>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-300 mx-auto" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {investors.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-6 hover:border-violet-400/60 transition-colors"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white mb-1">{inv.name}</h3>
                      {inv.type && (
                        <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                          {inv.type}
                        </span>
                      )}
                    </div>
                    {typeof inv.investor_score === 'number' && (
                      <div className="px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/30">
                        <span className="text-violet-300 font-mono text-sm">{inv.investor_score.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2 text-sm text-slate-300">
                    {inv.stage && inv.stage.length > 0 && (
                      <div>
                        <span className="text-slate-500">Stage focus:</span> {inv.stage.join(', ')}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {inv.sectors?.slice(0, 3).map((sector, idx) => (
                        <span key={idx} className="px-2 py-1 rounded-md bg-slate-800/80 text-xs text-slate-200">
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

        <div className="mb-16">
          <h2 className="text-3xl font-bold text-white mb-8">High-scoring DeepTech Startups</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {startups.map((s) => (
              <div
                key={s.id}
                className="bg-slate-900/60 backdrop-blur-sm border border-slate-800/80 rounded-xl p-6 hover:border-violet-400/60 transition-colors"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-white">{s.name}</h3>
                  <div className="px-2 py-1 rounded-full bg-violet-500/10 border border-violet-500/30">
                    <span className="text-violet-300 text-sm font-mono">{s.total_god_score}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {s.sectors?.slice(0, 3).map((sector, idx) => (
                    <span key={idx} className="px-2 py-1 rounded-md bg-slate-800/80 text-xs text-slate-300">
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

export default DeepTechInvestorsPage;

