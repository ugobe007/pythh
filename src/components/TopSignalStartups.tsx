import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, Zap, Eye } from 'lucide-react';

interface SignalStartup {
  id: string;
  name: string;
  tagline?: string;
  sectors?: string[];
  total_god_score?: number;
  signal_strength: number;
  match_count: number;
  avg_match_score: number;
}

export default function TopSignalStartups() {
  const [startups, setStartups] = useState<SignalStartup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTopSignalStartups() {
      setLoading(true);
      
      try {
        // Fetch startups with their match statistics
        // Signal Strength = (avg_match_score * 0.6) + (match_count_normalized * 0.4)
        const { data: matches, error: matchError } = await supabase
          .from('startup_investor_matches')
          .select('startup_id, match_score')
          .gte('match_score', 60); // Only quality matches
        
        if (matchError) throw matchError;
        
        // Group by startup_id and calculate stats
        const startupStats = new Map<string, { total: number; count: number; scores: number[] }>();
        
        matches?.forEach(match => {
          const existing = startupStats.get(match.startup_id) || { total: 0, count: 0, scores: [] };
          existing.total += match.match_score;
          existing.count += 1;
          existing.scores.push(match.match_score);
          startupStats.set(match.startup_id, existing);
        });
        
        // Get startup details for top performers
        const topStartupIds = Array.from(startupStats.entries())
          .sort((a, b) => {
            const avgA = a[1].total / a[1].count;
            const avgB = b[1].total / b[1].count;
            const countA = Math.min(a[1].count / 100, 1); // Normalize to 0-1
            const countB = Math.min(b[1].count / 100, 1);
            const strengthA = (avgA * 0.6) + (countA * 100 * 0.4);
            const strengthB = (avgB * 0.6) + (countB * 100 * 0.4);
            return strengthB - strengthA;
          })
          .slice(0, 30)
          .map(([id]) => id);
        
        if (topStartupIds.length === 0) {
          setStartups([]);
          setLoading(false);
          return;
        }
        
        // Fetch startup details
        const { data: startupsData, error: startupsError } = await supabase
          .from('startup_uploads')
          .select('id, name, tagline, sectors, total_god_score')
          .in('id', topStartupIds)
          .eq('status', 'approved');
        
        if (startupsError) throw startupsError;
        
        // Combine with stats
        const enriched = startupsData?.map(startup => {
          const stats = startupStats.get(startup.id);
          const avg_match_score = stats ? stats.total / stats.count : 0;
          const match_count = stats?.count || 0;
          const count_normalized = Math.min(match_count / 100, 1);
          const signal_strength = (avg_match_score * 0.6) + (count_normalized * 100 * 0.4);
          
          return {
            ...startup,
            signal_strength: Math.round(signal_strength),
            match_count,
            avg_match_score: Math.round(avg_match_score)
          };
        }).sort((a, b) => b.signal_strength - a.signal_strength) || [];
        
        setStartups(enriched);
      } catch (error) {
        console.error('Error fetching signal startups:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchTopSignalStartups();
  }, []);

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-spin w-10 h-10 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full mx-auto mb-4"></div>
        <p className="text-gray-400">Loading signal data...</p>
      </div>
    );
  }

  if (startups.length === 0) {
    return (
      <div className="py-12 text-center">
        <Zap className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <p className="text-gray-400">No signal data available</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Top Signal Startups</h2>
            <p className="text-sm text-gray-400">Ranked by match quality and investor interest</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-gradient-to-br from-black/40 to-gray-900/40 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-white/10 bg-black/30">
                <th className="py-4 pl-6 w-16">Rank</th>
                <th className="py-4">Startup</th>
                <th className="py-4 hidden md:table-cell">Sectors</th>
                <th className="py-4 hidden lg:table-cell">GOD Score</th>
                <th className="py-4 hidden xl:table-cell">Matches</th>
                <th className="py-4 pr-6 text-right">Signal Strength</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {startups.map((startup, index) => {
                const isTop3 = index < 3;
                const signalColor = 
                  startup.signal_strength >= 80 ? 'from-green-500 to-emerald-500' :
                  startup.signal_strength >= 70 ? 'from-cyan-500 to-blue-500' :
                  'from-gray-500 to-gray-600';
                
                return (
                  <tr
                    key={startup.id}
                    className="hover:bg-white/5 cursor-pointer transition-colors group"
                  >
                    {/* Rank */}
                    <td className="py-4 pl-6">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                        index === 0 
                          ? 'bg-gradient-to-br from-yellow-400 to-amber-500 text-black shadow-lg shadow-yellow-500/30' 
                          : index === 1
                            ? 'bg-gradient-to-br from-gray-200 to-gray-400 text-black shadow-lg'
                            : index === 2
                              ? 'bg-gradient-to-br from-orange-500 to-orange-700 text-white shadow-lg'
                              : 'bg-white/10 text-gray-300 border border-white/20'
                      }`}>
                        {index === 0 ? '👑' : index + 1}
                      </div>
                    </td>
                    
                    {/* Startup Info */}
                    <td className="py-4">
                      <div>
                        <div className="font-bold text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                          {startup.name}
                          {isTop3 && <Zap className="w-4 h-4 text-cyan-400 animate-pulse" />}
                        </div>
                        <div className="text-sm text-gray-400 truncate max-w-[200px] md:max-w-[300px]">
                          {startup.tagline || 'Building the future'}
                        </div>
                      </div>
                    </td>
                    
                    {/* Sectors */}
                    <td className="py-4 hidden md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(startup.sectors || []).slice(0, 2).map((sector, i) => (
                          <span 
                            key={i}
                            className="text-xs px-2 py-1 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                          >
                            {sector}
                          </span>
                        ))}
                      </div>
                    </td>
                    
                    {/* GOD Score */}
                    <td className="py-4 hidden lg:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-purple-500 to-violet-500 rounded-full"
                            style={{ width: `${startup.total_god_score || 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-300 w-8">
                          {startup.total_god_score || '-'}
                        </span>
                      </div>
                    </td>
                    
                    {/* Match Count */}
                    <td className="py-4 hidden xl:table-cell">
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Eye className="w-4 h-4" />
                        <span>{startup.match_count} investors</span>
                      </div>
                    </td>
                    
                    {/* Signal Strength */}
                    <td className="py-4 pr-6 text-right">
                      <div className="inline-flex items-center gap-3">
                        <div className="w-20 h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-gradient-to-r ${signalColor} rounded-full`}
                            style={{ width: `${startup.signal_strength}%` }}
                          />
                        </div>
                        <span className={`text-xl font-bold bg-gradient-to-r ${signalColor} bg-clip-text text-transparent min-w-[50px]`}>
                          {startup.signal_strength}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6 text-xs text-gray-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gradient-to-r from-green-500 to-emerald-500"></div>
          <span>Strong Signal (80+)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gradient-to-r from-cyan-500 to-blue-500"></div>
          <span>Active Signal (70-79)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gradient-to-r from-gray-500 to-gray-600"></div>
          <span>Emerging Signal (&lt;70)</span>
        </div>
      </div>
    </div>
  );
}
