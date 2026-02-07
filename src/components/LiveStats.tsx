/**
 * LIVE STATS COUNTER
 * 
 * Supabase-style live statistics display for homepage
 * Shows real-time counts: Startups, Investors, Matches, Signals
 * Updates every 30 seconds
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Stats {
  startups: number;
  investors: number;
  matches: number;
  signals: number;
  latestGodScore: number | null;
  loading: boolean;
}

export default function LiveStats() {
  const [stats, setStats] = useState<Stats>({
    startups: 0,
    investors: 0,
    matches: 0,
    signals: 0,
    latestGodScore: null,
    loading: true,
  });

  useEffect(() => {
    loadStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  async function loadStats() {
    try {
      const [startupsRes, investorsRes, matchesRes, signalsRes, latestStartupRes] = await Promise.all([
        supabase.from('startup_uploads').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('investors').select('id', { count: 'exact', head: true }),
        supabase.from('startup_investor_matches').select('id', { count: 'exact', head: true }),
        supabase.from('startup_signal_scores').select('id', { count: 'exact', head: true }),
        supabase
          .from('startup_uploads')
          .select('total_god_score')
          .eq('status', 'approved')
          .not('total_god_score', 'is', null)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
      ]);

      setStats({
        startups: startupsRes.count ?? 0,
        investors: investorsRes.count ?? 0,
        matches: matchesRes.count ?? 0,
        signals: signalsRes.count ?? 0,
        latestGodScore: latestStartupRes.data?.total_god_score ?? null,
        loading: false,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  }

  const StatItem = ({ label, value, highlight = false }: { label: string; value: string | number; highlight?: boolean }) => (
    <div className="flex items-baseline gap-2">
      <span className="text-sm text-gray-400">{label}:</span>
      <span className={`text-lg font-semibold ${highlight ? 'text-cyan-400' : 'text-white'} tabular-nums`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </div>
  );

  if (stats.loading) {
    return (
      <div className="flex items-center gap-6 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-6 w-24 bg-gray-800 rounded" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-sm">
      <StatItem label="Startups" value={stats.startups} />
      <StatItem label="Investors" value={stats.investors} />
      <StatItem label="Matches" value={stats.matches} />
      <StatItem label="Signals" value={stats.signals} />
      {stats.latestGodScore !== null && (
        <StatItem label="Latest GOD" value={stats.latestGodScore} highlight />
      )}
      
      {/* Live indicator */}
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-xs text-gray-500 uppercase tracking-wide">Live</span>
      </div>
    </div>
  );
}
