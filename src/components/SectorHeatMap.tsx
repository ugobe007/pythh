import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface SectorData {
  sector: string;
  match_count: number;
  avg_match_score: number;
  week_over_week_change: number;
  top_startups: string[];
}

interface SectorHeatMapProps {
  daysAgo?: number;
  showHeader?: boolean;
  compact?: boolean;
}

/**
 * SectorHeatMap - Show trending sectors by match activity
 * 
 * Features:
 * - Week-over-week growth indicators
 * - Average match score per sector
 * - Top startups in each sector
 * - Visual heat indication (color intensity)
 */
export default function SectorHeatMap({ 
  daysAgo = 7,
  showHeader = true,
  compact = false
}: SectorHeatMapProps) {
  const [sectors, setSectors] = useState<SectorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const { data, error: err } = await supabase
        .rpc('get_sector_heat_map', { days_ago: daysAgo });

      if (err) throw err;

      setSectors(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching sector heat map:', err);
      setError(err instanceof Error ? err.message : 'Failed to load sectors');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [daysAgo]);

  const getHeatIntensity = (matchCount: number, maxCount: number) => {
    const intensity = Math.min(1, matchCount / maxCount);
    
    if (intensity >= 0.8) return 'bg-orange-500/30 border-orange-500/50 text-orange-300';
    if (intensity >= 0.6) return 'bg-orange-500/20 border-orange-500/40 text-orange-400';
    if (intensity >= 0.4) return 'bg-yellow-500/20 border-yellow-500/40 text-yellow-400';
    if (intensity >= 0.2) return 'bg-blue-500/20 border-blue-500/40 text-blue-400';
    return 'bg-gray-500/10 border-gray-500/30 text-gray-400';
  };

  const getChangeColor = (change: number) => {
    if (change > 20) return 'text-green-400';
    if (change > 0) return 'text-green-500';
    if (change === 0) return 'text-white/60';
    if (change > -20) return 'text-yellow-500';
    return 'text-red-400';
  };

  const getChangeIcon = (change: number) => {
    if (change > 5) return '🔥';
    if (change > 0) return '↗';
    if (change === 0) return '→';
    return '↘';
  };

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-lg p-6 backdrop-blur-sm">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-white/10 rounded w-1/3"></div>
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-white/10 rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 backdrop-blur-sm">
        <p className="text-red-400 text-sm">Failed to load sectors: {error}</p>
      </div>
    );
  }

  const maxMatches = Math.max(...sectors.map(s => s.match_count), 1);

  return (
    <div className="bg-white/5 border border-white/10 rounded-lg backdrop-blur-sm overflow-hidden">
      {showHeader && (
        <div className="border-b border-white/10 p-6 pb-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span className="text-2xl">📊</span>
                {compact ? 'Hot Sectors' : 'Sector Heat Map'}
              </h3>
              <p className="text-sm text-white/60 mt-1">
                Match activity • Last {daysAgo} days
              </p>
            </div>
            <button 
              onClick={fetchData}
              className="text-white/60 hover:text-white transition-colors text-sm"
              title="Refresh"
            >
              ↻
            </button>
          </div>
        </div>
      )}

      <div className="p-6">
        {sectors.length === 0 ? (
          <div className="text-center py-8 text-white/60">
            <p>No sector data available</p>
            <p className="text-sm mt-2">Check back soon</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sectors.map((sector, index) => (
              <div
                key={sector.sector}
                className={`border rounded-lg p-4 transition-all ${getHeatIntensity(sector.match_count, maxMatches)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    {/* Sector Name & Rank */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-white/40 font-mono">
                        #{index + 1}
                      </span>
                      <span className="text-white font-bold truncate">
                        {sector.sector}
                      </span>
                    </div>
                    
                    {/* Stats Row */}
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <div className="flex items-center gap-1">
                        <span className="text-white font-medium">
                          {sector.match_count}
                        </span>
                        <span className="text-white/60">matches</span>
                      </div>
                      
                      {!compact && (
                        <>
                          <span className="text-white/30">•</span>
                          <div className="flex items-center gap-1">
                            <span className="text-white/60">avg</span>
                            <span className="text-white font-medium">
                              {sector.avg_match_score.toFixed(0)}
                            </span>
                          </div>
                        </>
                      )}
                      
                      <span className="text-white/30">•</span>
                      <div className={`flex items-center gap-1 ${getChangeColor(sector.week_over_week_change)}`}>
                        <span>{getChangeIcon(sector.week_over_week_change)}</span>
                        <span className="font-medium">
                          {sector.week_over_week_change > 0 ? '+' : ''}
                          {sector.week_over_week_change.toFixed(0)}%
                        </span>
                        <span className="text-white/40 text-xs">WoW</span>
                      </div>
                    </div>

                    {/* Top Startups */}
                    {!compact && sector.top_startups && sector.top_startups.length > 0 && (
                      <div className="mt-2 text-xs text-white/60">
                        <span className="text-white/40">Top: </span>
                        {sector.top_startups.slice(0, 3).join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Heat Indicator */}
                  <div className="flex flex-col items-end gap-1">
                    <div className="text-xs text-white/40 uppercase tracking-wide">
                      Heat
                    </div>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className={`w-1.5 h-6 rounded-sm ${
                            i < Math.ceil((sector.match_count / maxMatches) * 5)
                              ? 'bg-current'
                              : 'bg-white/10'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showHeader && sectors.length > 0 && (
        <div className="border-t border-white/10 p-4 text-center">
          <p className="text-xs text-white/60">
            Showing top {sectors.length} sectors by match volume
          </p>
        </div>
      )}
    </div>
  );
}
