/**
 * Social Signals Monitor - View collected social signals and buzz scores
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageCircle, RefreshCw, TrendingUp, Play, 
  Radio, ExternalLink, Globe
} from 'lucide-react';
import { API_BASE } from '../../lib/apiConfig';

interface PlatformStats {
  platform: string;
  count: number;
  uniqueStartups: number;
}

interface TopStartup {
  name: string;
  signalCount: number;
  buzzScore: number;
}

export default function SocialSignalsMonitor() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [scraping, setScraping] = useState(false);
  const [stats, setStats] = useState<{
    totalSignals: number;
    uniqueStartups: number;
    platforms: PlatformStats[];
    topStartups: TopStartup[];
    lastUpdated: string | null;
  }>({
    totalSignals: 0,
    uniqueStartups: 0,
    platforms: [],
    topStartups: [],
    lastUpdated: null
  });

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/social-signals`);
      if (!res.ok) throw new Error(`social-signals ${res.status}`);
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Error loading social signals stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const triggerScraper = async () => {
    if (scraping) return;
    
    if (!confirm('Start social signals scraper? This will scrape Reddit, HackerNews, ProductHunt, and other platforms.')) {
      return;
    }

    setScraping(true);
    try {
      const response = await fetch(`${API_BASE}/api/scrapers/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scriptName: 'scripts/enrichment/social-signals-scraper.js',
          description: 'Social Signals Scraper',
          args: ['50'] // Scrape top 50 startups
        })
      });

      if (response.ok) {
        alert('✅ Social signals scraper started! Scraping 50 startups across 12 platforms.');
        setTimeout(loadStats, 10000);
      } else {
        throw new Error('Failed to start scraper');
      }
    } catch (error) {
      console.error('Error starting scraper:', error);
      alert('❌ Failed to start scraper. You can run manually:\nnode scripts/enrichment/social-signals-scraper.js 50');
    } finally {
      setScraping(false);
    }
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'reddit': return '🔴';
      case 'hackernews': return '🟠';
      case 'twitter': return '🐦';
      case 'producthunt': return '🔥';
      case 'indiehackers': return '🏠';
      case 'betalist': return '📝';
      case 'startupgrind': return '📰';
      default: return '🌐';
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin" />
          <span className="text-slate-400">Loading social signals...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-r from-cyan-500 to-blue-500 rounded-lg">
            <Radio className="w-5 h-5 text-black" />
          </div>
          <div>
            <h3 className="font-bold text-white">Social Signals</h3>
            <p className="text-xs text-slate-400">Community buzz intelligence</p>
          </div>
        </div>
        <div className="text-xs text-slate-400">
          {stats.lastUpdated && `Updated ${new Date(stats.lastUpdated).toLocaleTimeString()}`}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="p-4 grid grid-cols-3 gap-4 border-b border-slate-700">
        <div className="text-center">
          <div className="text-2xl font-bold text-cyan-400">{stats.totalSignals.toLocaleString()}</div>
          <div className="text-xs text-slate-400 mt-1">Total Signals</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-white">{stats.uniqueStartups}</div>
          <div className="text-xs text-slate-400 mt-1">Startups</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-purple-400">{stats.platforms.length}</div>
          <div className="text-xs text-slate-400 mt-1">Platforms</div>
        </div>
      </div>

      {/* Platform Breakdown */}
      <div className="p-4 border-b border-slate-700">
        <div className="text-sm font-medium text-slate-300 mb-3">By Platform</div>
        <div className="space-y-2">
          {stats.platforms.slice(0, 5).map((p) => (
            <div key={p.platform} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span>{getPlatformIcon(p.platform)}</span>
                <span className="text-sm text-slate-300 capitalize">{p.platform}</span>
              </div>
              <div className="text-sm text-slate-400">
                {p.count.toLocaleString()} signals
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Startups */}
      {stats.topStartups.length > 0 && (
        <div className="p-4 border-b border-slate-700">
          <div className="text-sm font-medium text-slate-300 mb-3">Most Discussed</div>
          <div className="space-y-2">
            {stats.topStartups.slice(0, 3).map((s, i) => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">#{i + 1}</span>
                  <span className="text-sm text-white truncate max-w-[120px]">{s.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{s.signalCount} signals</span>
                  <span className="text-xs text-cyan-400">🔥 {s.buzzScore}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="p-4">
        <button
          onClick={triggerScraper}
          disabled={scraping}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-black font-semibold rounded-lg transition-all disabled:opacity-50"
        >
          {scraping ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Scraping...
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Run Social Scraper
            </>
          )}
        </button>
      </div>
    </div>
  );
}
