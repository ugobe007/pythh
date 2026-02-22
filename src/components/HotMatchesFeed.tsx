import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface HotMatch {
  match_id: string;
  startup_name: string;
  startup_god_score: number;
  startup_tier: string;
  startup_sectors: string[];
  startup_stage: string;
  investor_name: string;
  investor_tier: string;
  investor_firm: string | null;
  match_score: number;
  created_at: string;
  is_anonymized: boolean;
}

interface PlatformVelocity {
  total_matches_today: number;
  total_matches_week: number;
  startups_discovered_today: number;
  high_quality_matches_today: number;
  avg_match_score_today: number;
  top_tier_activity_today: number;
}

interface HotMatchesFeedProps {
  limit?: number;
  hoursAgo?: number;
  showHeader?: boolean;
  autoRefresh?: boolean;
}

/**
 * HotMatchesFeed - Display recent high-quality matches
 * Creates FOMO by showing platform activity in real-time
 * 
 * Features:
 * - Anonymized by default (respects privacy)
 * - Auto-refreshes every 2 minutes
 * - Shows GOD scores and match scores
 * - Real-time platform velocity stats
 */
export default function HotMatchesFeed({ 
  limit = 8, 
  hoursAgo = 24,
  showHeader = true,
  autoRefresh = true
}: HotMatchesFeedProps) {
  const [matches, setMatches] = useState<HotMatch[]>([]);
  const [velocity, setVelocity] = useState<PlatformVelocity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      // Fire both RPCs simultaneously — never block matches on velocity
      const matchPromise = supabase.rpc('get_hot_matches', { limit_count: limit, hours_ago: hoursAgo });
      const velocityPromise = supabase.rpc('get_platform_velocity');

      // Resolve matches first — show cards immediately without waiting for velocity
      const { data: matchData, error: matchError } = await matchPromise;

      if (matchError) throw matchError;

      let finalMatchData: HotMatch[] | null = matchData && matchData.length > 0 ? matchData : null;

      // Only cascade if first window returned nothing
      if (!finalMatchData) {
        for (const tryHours of [hoursAgo * 7, 168]) {
          const { data, error: cascadeError } = await supabase
            .rpc('get_hot_matches', { limit_count: limit, hours_ago: tryHours });
          if (cascadeError) throw cascadeError;
          if (data && data.length > 0) { finalMatchData = data; break; }
        }
      }

      setMatches(finalMatchData || []);
      setError(!finalMatchData || finalMatchData.length === 0 ? 'no-matches' : null);
      setLoading(false); // ← unblock UI as soon as matches are ready

      // Velocity resolves in background — update if/when it arrives
      Promise.resolve(velocityPromise).then(({ data, error }) => {
        if (!error && data?.[0]) setVelocity(data[0]);
      }).catch(() => {/* silent */});

    } catch (err: unknown) {
      // Snapshot before logging — prevents DevTools "object no longer exists" after HMR
      const snapshot = {
        message: (err as any)?.message ?? String(err),
        details: (err as any)?.details,
        hint: (err as any)?.hint,
        code: (err as any)?.code,
      };
      console.error('[HotMatchesFeed] fetch error:', snapshot);
      setError(snapshot.message || 'Failed to load matches');
      setLoading(false);
    }
  };

  useEffect(() => {
    // Safety net: never stay grey longer than 5s regardless of network
    const safetyTimer = setTimeout(() => setLoading(false), 5000);
    fetchData().finally(() => clearTimeout(safetyTimer));

    if (autoRefresh) {
      const interval = setInterval(fetchData, 120000); // Refresh every 2 minutes
      return () => { clearInterval(interval); clearTimeout(safetyTimer); };
    }
    return () => clearTimeout(safetyTimer);
  }, [limit, hoursAgo, autoRefresh]);

  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'Elite': return 'text-purple-400 bg-purple-500/20';
      case 'Excellent': return 'text-blue-400 bg-blue-500/20';
      case 'Strong': return 'text-green-400 bg-green-500/20';
      case 'Good': return 'text-yellow-400 bg-yellow-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 90) return 'text-pink-400';
    if (score >= 85) return 'text-purple-400';
    if (score >= 80) return 'text-blue-400';
    return 'text-green-400';
  };

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        <div className="h-4 bg-white/5 rounded w-1/3"></div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-16 bg-white/5 rounded"></div>
        ))}
      </div>
    );
  }

  // Show a minimal placeholder instead of disappearing entirely
  if (error === 'no-matches' || (error && matches.length === 0)) {
    return (
      <div className="space-y-1 opacity-50">
        {showHeader && (
          <div className="flex items-center gap-2 text-white/30 text-xs mb-2">
            <span>🔥</span>
            <span className="uppercase tracking-wider">Recent Matches</span>
          </div>
        )}
        <div className="text-xs text-white/25 italic">Match engine warming up…</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {showHeader && (
        <div className="flex items-center gap-2 text-white/50 text-xs mb-3">
          <span>🔥</span>
          <span className="uppercase tracking-wider">Recent Matches</span>
          {velocity && (
            <span className="text-white/30">
              · {velocity.total_matches_week.toLocaleString()} this week
            </span>
          )}
        </div>
      )}

      <div className="space-y-1.5 overflow-hidden">
        {matches.map((match, index) => (
          <div
            key={match.match_id}
            className="text-sm text-white/70 hover:text-white/90 transition-all leading-relaxed animate-slideDown"
            style={{ 
              animationDelay: `${index * 150}ms`,
            }}
          >
            <span className="text-white/90 font-medium">{match.startup_name}</span>
            {' '}
            <span className="text-white/40">→</span>
            {' '}
            <span className="text-white/80">{match.investor_name}</span>
            {' '}
            <span className="text-white/30">·</span>
            {' '}
            <span className="font-mono font-semibold text-emerald-400">
              {match.startup_god_score}
            </span>
            <span className="text-white/40">/</span>
            <span className="font-mono font-semibold text-cyan-400">
              {Math.round(match.match_score)}
            </span>
            {' '}
            <span className="text-white/30 text-xs">
              · {formatTimeAgo(match.created_at)}
            </span>
          </div>
        ))}
      </div>

      {showHeader && matches.length > 0 && velocity && (
        <div className="text-[11px] text-white/30 mt-2 pt-2 border-t border-white/5">
          {velocity.high_quality_matches_today > 0 && (
            <>
              {velocity.high_quality_matches_today} elite matches today · 
            </>
          )}
          {' '}Platform live
        </div>
      )}
    </div>
  );
}
