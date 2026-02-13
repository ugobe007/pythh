import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';

interface BenchmarkData {
  metric: string;
  avg: number;
  p50: number;
  p90: number;
  p10: number;
}

interface ScoreDistribution {
  range: string;
  count: number;
}

interface SectorBenchmark {
  sector: string;
  avgScore: number;
  count: number;
}

export default function StartupBenchmarksDashboard() {
  const navigate = useNavigate();
  const [benchmarks, setBenchmarks] = useState<Record<string, BenchmarkData>>({});
  const [scoreDistribution, setScoreDistribution] = useState<ScoreDistribution[]>([]);
  const [sectorBenchmarks, setSectorBenchmarks] = useState<SectorBenchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalStartups: 0,
    avgBenchmarkScore: 0,
    medianBenchmarkScore: 0,
    topSector: '',
    topSectorScore: 0
  });

  useEffect(() => {
    loadBenchmarkData();
  }, []);

  const loadBenchmarkData = async () => {
    try {
      setError(null);
      
      // Fetch all approved startups with pagination
      let allStartups: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: startups, error: fetchError } = await supabase
          .from('startup_uploads')
          .select('id, name, benchmark_score, total_god_score, team_size, mrr, sectors')
          .eq('status', 'approved')
          .order('created_at', { ascending: false })
          .range(from, from + pageSize - 1);

        if (fetchError) {
          console.error('Error loading startups:', fetchError);
          setError(`Failed to load data: ${fetchError.message}`);
          setLoading(false);
          return;
        }

        if (!startups || startups.length === 0) {
          hasMore = false;
        } else {
          allStartups = [...allStartups, ...startups];
          from += pageSize;
          hasMore = startups.length === pageSize;
        }
      }

      if (allStartups.length === 0) {
        setError('No approved startups found');
        setLoading(false);
        return;
      }

      console.log(`Loaded ${allStartups.length} startups`);

      // Calculate benchmarks for key metrics
      const metrics = ['total_god_score', 'team_size', 'mrr'];
      const calculatedBenchmarks: Record<string, BenchmarkData> = {};

      for (const metric of metrics) {
        const values = allStartups
          .map(s => Number(s[metric as keyof typeof allStartups[0]]) || 0)
          .filter(v => v > 0)
          .sort((a, b) => a - b);

        if (values.length > 0) {
          const avg = values.reduce((a, b) => a + b, 0) / values.length;
          const p50 = values[Math.floor(values.length * 0.5)] || 0;
          const p90 = values[Math.floor(values.length * 0.9)] || 0;
          const p10 = values[Math.floor(values.length * 0.1)] || 0;

          calculatedBenchmarks[metric] = {
            metric: metric.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
            avg,
            p50,
            p90,
            p10
          };
        }
      }

      setBenchmarks(calculatedBenchmarks);

      // Calculate score distribution
      const benchmarkScores = allStartups
        .map(s => s.benchmark_score)
        .filter((s): s is number => s !== null && s !== undefined && typeof s === 'number');
      
      console.log(`Found ${benchmarkScores.length} startups with benchmark scores out of ${allStartups.length}`);

      const distribution: ScoreDistribution[] = [
        { range: '0-20', count: benchmarkScores.filter(s => s >= 0 && s < 20).length },
        { range: '20-40', count: benchmarkScores.filter(s => s >= 20 && s < 40).length },
        { range: '40-60', count: benchmarkScores.filter(s => s >= 40 && s < 60).length },
        { range: '60-80', count: benchmarkScores.filter(s => s >= 60 && s < 80).length },
        { range: '80-100', count: benchmarkScores.filter(s => s >= 80 && s <= 100).length }
      ];

      setScoreDistribution(distribution);

      // Calculate sector benchmarks
      const sectorMap = new Map<string, { total: number; count: number }>();
      
      allStartups.forEach(startup => {
        const score = startup.benchmark_score;
        if (score !== null && score !== undefined && typeof score === 'number' && startup.sectors && Array.isArray(startup.sectors)) {
          startup.sectors.forEach((sector: string) => {
            const existing = sectorMap.get(sector) || { total: 0, count: 0 };
            sectorMap.set(sector, {
              total: existing.total + score,
              count: existing.count + 1
            });
          });
        }
      });

      const sectorBenchmarksData: SectorBenchmark[] = Array.from(sectorMap.entries())
        .map(([sector, data]) => ({
          sector,
          avgScore: data.total / data.count,
          count: data.count
        }))
        .sort((a, b) => b.avgScore - a.avgScore)
        .slice(0, 10);

      setSectorBenchmarks(sectorBenchmarksData);

      // Calculate overall stats
      const avgBenchmark = benchmarkScores.length > 0
        ? benchmarkScores.reduce((a, b) => a + b, 0) / benchmarkScores.length
        : 0;

      const sortedScores = [...benchmarkScores].sort((a, b) => a - b);
      const medianBenchmark = sortedScores.length > 0
        ? sortedScores[Math.floor(sortedScores.length / 2)]
        : 0;

      const topSector = sectorBenchmarksData[0];

      setStats({
        totalStartups: allStartups.length,
        avgBenchmarkScore: Math.round(avgBenchmark),
        medianBenchmarkScore: Math.round(medianBenchmark),
        topSector: topSector?.sector || '',
        topSectorScore: Math.round(topSector?.avgScore || 0)
      });

      setLoading(false);
    } catch (err: any) {
      console.error('Error loading benchmark data:', err);
      setError(err.message || 'Failed to load benchmark data');
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-400 mb-4"></div>
          <div className="text-white text-xl">Loading benchmarks...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-6">
        <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-8 max-w-2xl">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error Loading Data</h2>
          <p className="text-white mb-6">{error}</p>
          <div className="space-y-2">
            <button
              onClick={() => loadBenchmarkData()}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-colors"
            >
              Retry
            </button>
            <button
              onClick={() => navigate('/admin/control')}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl transition-colors"
            >
              Back to Control Center
            </button>
          </div>
        </div>
      </div>
    );
  }

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  // Prepare data for benchmark comparison chart
  const benchmarkComparisonData = Object.entries(benchmarks).map(([key, data]) => ({
    metric: data.metric,
    Average: Math.round(data.avg),
    Median: Math.round(data.p50),
    '90th Percentile': Math.round(data.p90),
    '10th Percentile': Math.round(data.p10)
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Industry Benchmarks</h1>
            <p className="text-gray-400">High-level performance metrics across all startups</p>
          </div>
          <button
            onClick={() => navigate('/admin/control')}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            ← Back
          </button>
        </div>

        {/* Stats Cards - Clickable */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <button
            onClick={() => navigate('/admin/discovered-startups')}
            className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-blue-500 hover:bg-gray-800/70 transition-all cursor-pointer text-left"
          >
            <div className="text-gray-400 text-sm mb-1">Total Startups</div>
            <div className="text-3xl font-bold text-white">{stats.totalStartups.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-2">Click to view all →</div>
          </button>
          <button
            onClick={() => navigate('/admin/god-scores')}
            className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-blue-500 hover:bg-gray-800/70 transition-all cursor-pointer text-left"
          >
            <div className="text-gray-400 text-sm mb-1">Avg Benchmark Score</div>
            <div className="text-3xl font-bold text-blue-400">{stats.avgBenchmarkScore}</div>
            <div className="text-xs text-gray-500 mt-2">Click to view scores →</div>
          </button>
          <button
            onClick={() => navigate('/admin/god-scores')}
            className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-green-500 hover:bg-gray-800/70 transition-all cursor-pointer text-left"
          >
            <div className="text-gray-400 text-sm mb-1">Median Score</div>
            <div className="text-3xl font-bold text-green-400">{stats.medianBenchmarkScore}</div>
            <div className="text-xs text-gray-500 mt-2">Click to view scores →</div>
          </button>
          {stats.topSector && (
            <button
              onClick={() => navigate(`/admin/discovered-startups?sector=${encodeURIComponent(stats.topSector)}`)}
              className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-purple-500 hover:bg-gray-800/70 transition-all cursor-pointer text-left"
            >
              <div className="text-gray-400 text-sm mb-1">Top Sector</div>
              <div className="text-lg font-bold text-white">{stats.topSector}</div>
              <div className="text-sm text-purple-400">{stats.topSectorScore} avg</div>
              <div className="text-xs text-gray-500 mt-2">Click to filter →</div>
            </button>
          )}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Score Distribution */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Benchmark Score Distribution</h2>
            {scoreDistribution.some(d => d.count > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={scoreDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="range" stroke="#9ca3af" />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                  <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <p className="mb-2">No benchmark scores available</p>
                  <button
                    onClick={() => navigate('/admin/control')}
                    className="text-blue-400 hover:text-blue-300 underline"
                  >
                    Run benchmark calculation
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sector Performance */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Top Sectors by Benchmark Score</h2>
            {sectorBenchmarks.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sectorBenchmarks} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis type="number" stroke="#9ca3af" />
                  <YAxis dataKey="sector" type="category" stroke="#9ca3af" width={100} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    labelStyle={{ color: '#f3f4f6' }}
                  />
                  <Bar dataKey="avgScore" fill="#10b981" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-400">
                No sector data available
              </div>
            )}
          </div>
        </div>

        {/* Benchmark Comparison */}
        {benchmarkComparisonData.length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 mb-6">
            <h2 className="text-xl font-bold text-white mb-4">Metric Benchmarks (Percentiles)</h2>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={benchmarkComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="metric" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#f3f4f6' }}
                />
                <Legend />
                <Area type="monotone" dataKey="10th Percentile" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
                <Area type="monotone" dataKey="Average" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                <Area type="monotone" dataKey="Median" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                <Area type="monotone" dataKey="90th Percentile" stackId="1" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Sector Count Distribution */}
        {sectorBenchmarks.length > 0 && (
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700">
            <h2 className="text-xl font-bold text-white mb-4">Startup Count by Sector</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sectorBenchmarks.slice(0, 5)}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ sector, count }) => `${sector}: ${count}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="count"
                >
                  {sectorBenchmarks.slice(0, 5).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                  labelStyle={{ color: '#f3f4f6' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => navigate('/admin/discovered-startups')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl transition-colors"
          >
            View All Startups →
          </button>
          <button
            onClick={() => navigate('/admin/god-scores')}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-4 px-6 rounded-xl transition-colors"
          >
            View GOD Scores →
          </button>
          <button
            onClick={() => navigate('/admin/control')}
            className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-xl transition-colors"
          >
            Back to Control Center →
          </button>
        </div>
      </div>
    </div>
  );
}
