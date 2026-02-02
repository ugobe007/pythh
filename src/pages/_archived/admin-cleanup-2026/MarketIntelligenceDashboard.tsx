/**
 * Market Intelligence Dashboard
 * 
 * Provides analytics and insights for investors and startups
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  TrendingUp, BarChart3, Users, Brain, Shield, ArrowLeft, Home, Settings,
  Building2, DollarSign, Zap, Target, PieChart
} from 'lucide-react';
import { API_BASE } from '@/lib/apiConfig';

interface SectorPerformance {
  sector: string;
  startup_count: number;
  avg_god_score: number;
  avg_mrr: number;
  avg_growth_rate: number;
}

interface FounderPatterns {
  courage_distribution: Record<string, number>;
  intelligence_distribution: Record<string, number>;
  courage_averages: Record<string, number>;
  intelligence_averages: Record<string, number>;
  total_startups: number;
}

export default function MarketIntelligenceDashboard() {
  const navigate = useNavigate();
  const [sectorPerformance, setSectorPerformance] = useState<SectorPerformance[]>([]);
  const [founderPatterns, setFounderPatterns] = useState<FounderPatterns | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sectors' | 'founders' | 'trends'>('sectors');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sectorsRes, foundersRes] = await Promise.all([
        fetch(`${API_BASE}/api/market-intelligence/sector-performance`),
        fetch(`${API_BASE}/api/market-intelligence/founder-patterns`)
      ]);

      if (sectorsRes.ok) {
        const sectorsData = await sectorsRes.json();
        setSectorPerformance(sectorsData.sectors || []);
      }

      if (foundersRes.ok) {
        const foundersData = await foundersRes.json();
        setFounderPatterns(foundersData);
      }
    } catch (error) {
      console.error('Error loading market intelligence:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Navigation Bar */}
      <div className="sticky top-0 z-50 bg-gray-800/95 backdrop-blur-sm border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate(-1)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                title="Back"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Link
                to="/"
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                title="Home"
              >
                <Home className="w-5 h-5" />
              </Link>
              <Link
                to="/admin/control"
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                title="Control Center"
              >
                <Settings className="w-5 h-5" />
              </Link>
            </div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Market Intelligence
            </h1>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tabs */}
        <div className="mb-6 flex gap-2 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('sectors')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'sectors'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Building2 className="w-4 h-4 inline mr-2" />
            Sector Performance
          </button>
          <button
            onClick={() => setActiveTab('founders')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'founders'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <Users className="w-4 h-4 inline mr-2" />
            Founder Patterns
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'trends'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Trends
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading market intelligence...</div>
        ) : (
          <>
            {/* Sector Performance Tab */}
            {activeTab === 'sectors' && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Sector Performance Analysis</h2>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div className="text-sm text-gray-400 mb-1">Total Sectors Tracked</div>
                    <div className="text-3xl font-bold text-blue-400">{sectorPerformance.length}</div>
                  </div>
                  <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div className="text-sm text-gray-400 mb-1">Top Sector (GOD Score)</div>
                    <div className="text-xl font-bold text-green-400">
                      {sectorPerformance[0]?.sector || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {sectorPerformance[0]?.avg_god_score?.toFixed(1) || '0'}/100
                    </div>
                  </div>
                  <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div className="text-sm text-gray-400 mb-1">Highest Growth Rate</div>
                    <div className="text-xl font-bold text-purple-400">
                      {sectorPerformance.sort((a, b) => (b.avg_growth_rate || 0) - (a.avg_growth_rate || 0))[0]?.sector || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {sectorPerformance.sort((a, b) => (b.avg_growth_rate || 0) - (a.avg_growth_rate || 0))[0]?.avg_growth_rate?.toFixed(1) || '0'}% MoM
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-700">
                        <th className="text-left py-3 px-4 text-sm font-semibold">Sector</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold">Startups</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold">Avg GOD Score</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold">Avg MRR</th>
                        <th className="text-right py-3 px-4 text-sm font-semibold">Avg Growth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sectorPerformance.map((sector) => (
                        <tr key={sector.sector} className="border-b border-gray-800 hover:bg-gray-800/30">
                          <td className="py-3 px-4 font-medium">{sector.sector}</td>
                          <td className="py-3 px-4 text-right text-gray-400">{sector.startup_count}</td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-semibold ${
                              sector.avg_god_score >= 70 ? 'text-green-400' :
                              sector.avg_god_score >= 50 ? 'text-yellow-400' :
                              'text-gray-400'
                            }`}>
                              {sector.avg_god_score.toFixed(1)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right text-gray-400">
                            {sector.avg_mrr > 0 ? `$${(sector.avg_mrr / 1000).toFixed(0)}K` : 'N/A'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={`font-semibold ${
                              (sector.avg_growth_rate || 0) >= 20 ? 'text-green-400' :
                              (sector.avg_growth_rate || 0) >= 10 ? 'text-yellow-400' :
                              'text-gray-400'
                            }`}>
                              {sector.avg_growth_rate ? `${sector.avg_growth_rate.toFixed(1)}%` : 'N/A'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Founder Patterns Tab */}
            {activeTab === 'founders' && founderPatterns && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Founder Attribute Patterns</h2>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Courage Distribution */}
                  <div className="p-6 bg-gray-800/50 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Shield className="w-5 h-5 text-blue-400" />
                      Courage Distribution
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(founderPatterns.courage_distribution)
                        .filter(([key]) => key !== 'unknown')
                        .sort(([, a], [, b]) => b - a)
                        .map(([level, count]) => {
                          const percentage = (count / founderPatterns.total_startups) * 100;
                          const avgScore = founderPatterns.courage_averages[level] || 0;
                          return (
                            <div key={level}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm capitalize">{level}</span>
                                <span className="text-sm text-gray-400">{count} ({percentage.toFixed(1)}%)</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-blue-400 h-2 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              {avgScore > 0 && (
                                <div className="text-xs text-gray-400 mt-1">
                                  Avg GOD Score: {avgScore.toFixed(1)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Intelligence Distribution */}
                  <div className="p-6 bg-gray-800/50 rounded-lg border border-gray-700">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <Brain className="w-5 h-5 text-purple-400" />
                      Intelligence Distribution
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(founderPatterns.intelligence_distribution)
                        .filter(([key]) => key !== 'unknown')
                        .sort(([, a], [, b]) => b - a)
                        .map(([level, count]) => {
                          const percentage = (count / founderPatterns.total_startups) * 100;
                          const avgScore = founderPatterns.intelligence_averages[level] || 0;
                          return (
                            <div key={level}>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-sm capitalize">{level}</span>
                                <span className="text-sm text-gray-400">{count} ({percentage.toFixed(1)}%)</span>
                              </div>
                              <div className="w-full bg-gray-700 rounded-full h-2">
                                <div
                                  className="bg-purple-400 h-2 rounded-full"
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                              {avgScore > 0 && (
                                <div className="text-xs text-gray-400 mt-1">
                                  Avg GOD Score: {avgScore.toFixed(1)}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>

                {/* Insights */}
                <div className="p-6 bg-gray-800/50 rounded-lg border border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-green-400" />
                    Key Insights
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li>• Total startups analyzed: <span className="font-semibold text-white">{founderPatterns.total_startups}</span></li>
                    <li>• Most common courage level: <span className="font-semibold text-white">
                      {Object.entries(founderPatterns.courage_distribution)
                        .filter(([key]) => key !== 'unknown')
                        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A'}
                    </span></li>
                    <li>• Most common intelligence level: <span className="font-semibold text-white">
                      {Object.entries(founderPatterns.intelligence_distribution)
                        .filter(([key]) => key !== 'unknown')
                        .sort(([, a], [, b]) => b - a)[0]?.[0] || 'N/A'}
                    </span></li>
                    {founderPatterns.courage_averages['high'] && (
                      <li>• High-courage founders average GOD score: <span className="font-semibold text-green-400">
                        {founderPatterns.courage_averages['high'].toFixed(1)}
                      </span></li>
                    )}
                    {founderPatterns.intelligence_averages['high'] && (
                      <li>• High-intelligence founders average GOD score: <span className="font-semibold text-purple-400">
                        {founderPatterns.intelligence_averages['high'].toFixed(1)}
                      </span></li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* Trends Tab */}
            {activeTab === 'trends' && (
              <div>
                <h2 className="text-2xl font-bold mb-6">Market Trends</h2>
                <div className="p-6 bg-gray-800/50 rounded-lg border border-gray-700">
                  <p className="text-gray-400">
                    Trend analysis coming soon. This will include:
                  </p>
                  <ul className="mt-4 space-y-2 text-sm text-gray-300">
                    <li>• Funding velocity by sector</li>
                    <li>• Stage-specific success rates</li>
                    <li>• Geographic performance trends</li>
                    <li>• Founder attribute correlations with success</li>
                    <li>• Emerging sector identification</li>
                  </ul>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}





