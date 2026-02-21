import React, { useState, useEffect } from 'react';
import { 
  ScatterChart, Scatter, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, Cell, ReferenceLine, Area
} from 'recharts';
import { supabase } from '../../lib/supabase';
import { Target, TrendingUp, Zap, Award, BarChart3 } from 'lucide-react';

interface MatchQualityPoint {
  godScore: number;
  matchScore: number;
  count: number;
  avgMatchScore: number;
  highQuality: number;
  mediumQuality: number;
  lowQuality: number;
}

interface QualityDistribution {
  range: string;
  count: number;
  avgMatchScore: number;
  highQuality: number;
  mediumQuality: number;
  lowQuality: number;
  matchRate: number;
}

interface ComponentCorrelation {
  component: string;
  correlation: number;
  avgMatchScore: number;
}

export default function MatchQualityChart() {
  const [scatterData, setScatterData] = useState<MatchQualityPoint[]>([]);
  const [distribution, setDistribution] = useState<QualityDistribution[]>([]);
  const [componentCorrelations, setComponentCorrelations] = useState<ComponentCorrelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [correlation, setCorrelation] = useState(0);
  const [totalMatches, setTotalMatches] = useState(0);
  const [highQualityMatches, setHighQualityMatches] = useState(0);

  useEffect(() => {
    loadMatchQualityData();
    const interval = setInterval(loadMatchQualityData, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadMatchQualityData = async () => {
    try {
      // Step 1: fetch match scores + startup_ids (no FK embed - avoids schema cache issues)
      const { data: rawMatches, error } = await supabase
        .from('startup_investor_matches')
        .select('match_score, confidence_level, startup_id')
        .not('match_score', 'is', null)
        .limit(2000);

      if (error) throw error;

      // Step 2: fetch GOD scores for the unique startup_ids
      const startupIds = [...new Set((rawMatches || []).map((m: any) => m.startup_id))].slice(0, 500) as string[];
      let godScoreMap: Record<string, any> = {};
      if (startupIds.length > 0) {
        const { data: startupData } = await supabase
          .from('startup_uploads')
          .select('id, total_god_score, team_score, traction_score, market_score, product_score, vision_score')
          .in('id', startupIds);
        (startupData || []).forEach((s: any) => { godScoreMap[s.id] = s; });
      }

      // Combine into the shape the rest of the function expects
      const matches = (rawMatches || []).map((m: any) => ({
        match_score: m.match_score,
        confidence_level: m.confidence_level,
        startup_uploads: godScoreMap[m.startup_id] || null,
      }));

      const scatterPoints: MatchQualityPoint[] = [];
      const godScoreRanges: Record<string, { scores: number[]; high: number; medium: number; low: number; count: number }> = {};
      const componentData: Record<string, { godScores: number[]; matchScores: number[] }> = {
        team: { godScores: [], matchScores: [] },
        traction: { godScores: [], matchScores: [] },
        market: { godScores: [], matchScores: [] },
        product: { godScores: [], matchScores: [] },
        vision: { godScores: [], matchScores: [] },
      };

      let total = 0;
      let highQuality = 0;

      matches?.forEach((match: any) => {
        const godScore = match.startup_uploads?.total_god_score;
        const matchScore = match.match_score || 0;

        if (godScore && matchScore > 0) {
          total++;
          if (matchScore >= 70) highQuality++;

          scatterPoints.push({
            godScore: Math.round(godScore),
            matchScore: Math.round(matchScore),
            count: 1,
            avgMatchScore: matchScore,
            highQuality: matchScore >= 70 ? 1 : 0,
            mediumQuality: matchScore >= 50 && matchScore < 70 ? 1 : 0,
            lowQuality: matchScore < 50 ? 1 : 0,
          });

          const range = getGODScoreRange(godScore);
          if (!godScoreRanges[range]) {
            godScoreRanges[range] = { scores: [], high: 0, medium: 0, low: 0, count: 0 };
          }
          godScoreRanges[range].scores.push(matchScore);
          godScoreRanges[range].count++;
          if (matchScore >= 70) godScoreRanges[range].high++;
          else if (matchScore >= 50) godScoreRanges[range].medium++;
          else godScoreRanges[range].low++;

          // Component correlations
          const components = {
            team: match.startup_uploads?.team_score,
            traction: match.startup_uploads?.traction_score,
            market: match.startup_uploads?.market_score,
            product: match.startup_uploads?.product_score,
            vision: match.startup_uploads?.vision_score,
          };

          Object.entries(components).forEach(([comp, score]) => {
            if (score && score > 0) {
              componentData[comp].godScores.push(score);
              componentData[comp].matchScores.push(matchScore);
            }
          });
        }
      });

      setTotalMatches(total);
      setHighQualityMatches(highQuality);

      // Calculate distribution
      const dist: QualityDistribution[] = Object.entries(godScoreRanges).map(([range, data]) => ({
        range,
        count: data.count,
        avgMatchScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        highQuality: data.high,
        mediumQuality: data.medium,
        lowQuality: data.low,
        matchRate: data.count > 0 ? (data.high / data.count) * 100 : 0,
      })).sort((a, b) => {
        const aMin = parseInt(a.range.split('-')[0]);
        const bMin = parseInt(b.range.split('-')[0]);
        return aMin - bMin;
      });

      setDistribution(dist);

      // Calculate component correlations
      const correlations: ComponentCorrelation[] = Object.entries(componentData).map(([component, data]) => {
        if (data.godScores.length < 2) {
          return { component, correlation: 0, avgMatchScore: 0 };
        }

        const n = data.godScores.length;
        const sumX = data.godScores.reduce((a, b) => a + b, 0);
        const sumY = data.matchScores.reduce((a, b) => a + b, 0);
        const sumXY = data.godScores.reduce((sum, x, i) => sum + x * data.matchScores[i], 0);
        const sumX2 = data.godScores.reduce((sum, x) => sum + x * x, 0);
        const sumY2 = data.matchScores.reduce((sum, y) => sum + y * y, 0);

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        const corr = denominator !== 0 ? numerator / denominator : 0;

        return {
          component,
          correlation: corr,
          avgMatchScore: data.matchScores.reduce((a, b) => a + b, 0) / data.matchScores.length,
        };
      }).sort((a, b) => b.correlation - a.correlation);

      setComponentCorrelations(correlations);

      // Aggregate scatter data
      const aggregated: Record<number, { scores: number[]; high: number; medium: number; low: number }> = {};
      scatterPoints.forEach(point => {
        if (!aggregated[point.godScore]) {
          aggregated[point.godScore] = { scores: [], high: 0, medium: 0, low: 0 };
        }
        aggregated[point.godScore].scores.push(point.matchScore);
        if (point.highQuality) aggregated[point.godScore].high++;
        else if (point.mediumQuality) aggregated[point.godScore].medium++;
        else aggregated[point.godScore].low++;
      });

      const aggregatedScatter: MatchQualityPoint[] = Object.entries(aggregated).map(([godScore, data]) => ({
        godScore: parseInt(godScore),
        matchScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        count: data.scores.length,
        avgMatchScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
        highQuality: data.high,
        mediumQuality: data.medium,
        lowQuality: data.low,
      }));

      setScatterData(aggregatedScatter.sort((a, b) => a.godScore - b.godScore));

      // Calculate overall correlation
      if (scatterPoints.length > 1) {
        const n = scatterPoints.length;
        const sumX = scatterPoints.reduce((sum, p) => sum + p.godScore, 0);
        const sumY = scatterPoints.reduce((sum, p) => sum + p.matchScore, 0);
        const sumXY = scatterPoints.reduce((sum, p) => sum + p.godScore * p.matchScore, 0);
        const sumX2 = scatterPoints.reduce((sum, p) => sum + p.godScore * p.godScore, 0);
        const sumY2 = scatterPoints.reduce((sum, p) => sum + p.matchScore * p.matchScore, 0);

        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        const corr = denominator !== 0 ? numerator / denominator : 0;
        setCorrelation(corr);
      }
    } catch (error) {
      console.error('Error loading match quality data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGODScoreRange = (score: number): string => {
    if (score < 40) return '0-39';
    if (score < 50) return '40-49';
    if (score < 60) return '50-59';
    if (score < 70) return '60-69';
    if (score < 80) return '70-79';
    return '80-100';
  };

  const getColor = (score: number): string => {
    if (score >= 80) return '#10B981';
    if (score >= 70) return '#3B82F6';
    if (score >= 60) return '#F59E0B';
    if (score >= 50) return '#F97316';
    return '#EF4444';
  };

  if (loading) {
    return (
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl p-6 border border-gray-700 shadow-xl">
        <div className="h-64 flex items-center justify-center">
          <div className="text-gray-400 animate-pulse">Loading Match Quality Analytics...</div>
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0]?.payload;
      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-4 shadow-xl">
          <p className="font-semibold text-white mb-2">
            GOD Score: {data?.godScore} | Match Score: {data?.matchScore}
          </p>
          {data && (
            <div className="space-y-1 text-xs">
              <p className="text-gray-400">Matches: {data.count}</p>
              <p className="text-green-400">High Quality: {data.highQuality}</p>
              <p className="text-yellow-400">Medium: {data.mediumQuality}</p>
              <p className="text-red-400">Low: {data.lowQuality}</p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Main Scatter Plot */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl p-6 border border-gray-700 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold flex items-center gap-2 mb-2">
              <Target className="w-6 h-6 text-orange-400" />
              Match Quality vs GOD Score Analysis
            </h3>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-400" />
                <span className="text-gray-300">
                  Correlation: <span className={`font-semibold ${correlation > 0.5 ? 'text-green-400' : correlation > 0.3 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {correlation.toFixed(3)}
                  </span>
                  <span className="text-gray-500 ml-1">
                    {correlation > 0.5 ? '(Strong)' : correlation > 0.3 ? '(Moderate)' : '(Weak)'}
                  </span>
                </span>
              </div>
              <div className="text-gray-400">|</div>
              <div className="text-gray-300">
                Total: <span className="font-semibold text-orange-400">{totalMatches.toLocaleString()}</span>
              </div>
              <div className="text-gray-400">|</div>
              <div className="text-gray-300">
                High Quality: <span className="font-semibold text-green-400">{highQualityMatches.toLocaleString()}</span>
                <span className="text-gray-500 ml-1">
                  ({(totalMatches > 0 ? (highQualityMatches / totalMatches) * 100 : 0).toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={450}>
          <ScatterChart data={scatterData}>
            <defs>
              <linearGradient id="scatterGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.8}/>
                <stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.8}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
            <XAxis 
              type="number"
              dataKey="godScore"
              name="GOD Score"
              domain={[0, 100]}
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              label={{ value: 'GOD Score', position: 'insideBottom', offset: -5, fill: '#9CA3AF' }}
            />
            <YAxis 
              type="number"
              dataKey="matchScore"
              name="Match Score"
              domain={[0, 100]}
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              label={{ value: 'Match Score', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
            />
            <ReferenceLine y={70} stroke="#10B981" strokeDasharray="3 3" label={{ value: "High Quality", position: "right", fill: '#10B981' }} />
            <ReferenceLine y={50} stroke="#F59E0B" strokeDasharray="3 3" label={{ value: "Medium", position: "right", fill: '#F59E0B' }} />
            <ReferenceLine x={70} stroke="#EF4444" strokeDasharray="3 3" label={{ value: "Alert Threshold", position: "top", fill: '#EF4444' }} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#374151', strokeWidth: 1 }} />
            <Scatter name="Matches" data={scatterData} fill="#3B82F6">
              {scatterData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(entry.godScore)} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Distribution Chart */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl p-6 border border-gray-700 shadow-xl">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" />
          Match Quality Distribution by GOD Score Range
        </h3>
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart data={distribution}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
            <XAxis 
              dataKey="range" 
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              label={{ value: 'GOD Score Range', position: 'insideBottom', offset: -5, fill: '#9CA3AF' }}
            />
            <YAxis 
              yAxisId="left"
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              label={{ value: 'Match Count', angle: -90, position: 'insideLeft', fill: '#9CA3AF' }}
            />
            <YAxis 
              yAxisId="right"
              orientation="right"
              stroke="#9CA3AF"
              tick={{ fill: '#9CA3AF', fontSize: 11 }}
              domain={[0, 100]}
              label={{ value: 'Avg Match Score', angle: 90, position: 'insideRight', fill: '#9CA3AF' }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1F2937', 
                border: '1px solid #374151',
                borderRadius: '8px',
                color: '#F3F4F6'
              }}
            />
            <Legend />
            <Bar yAxisId="left" dataKey="highQuality" stackId="a" fill="#10B981" name="High Quality (70+)" />
            <Bar yAxisId="left" dataKey="mediumQuality" stackId="a" fill="#F59E0B" name="Medium (50-69)" />
            <Bar yAxisId="left" dataKey="lowQuality" stackId="a" fill="#EF4444" name="Low (<50)" />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="avgMatchScore" 
              stroke="#8B5CF6" 
              strokeWidth={3}
              name="Avg Match Score"
              dot={{ fill: '#8B5CF6', r: 5 }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="matchRate" 
              stroke="#06B6D4" 
              strokeWidth={2}
              strokeDasharray="5 5"
              name="High Quality Rate %"
              dot={{ fill: '#06B6D4', r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        {distribution.map((item) => (
          <div key={item.range} className="bg-gradient-to-br from-gray-700/50 to-gray-800/30 rounded-xl p-4 border border-gray-600">
            <div className="text-xs text-gray-400 mb-2">GOD {item.range}</div>
            <div className="text-2xl font-bold text-blue-400 mb-1">{item.avgMatchScore.toFixed(1)}</div>
            <div className="text-xs text-gray-500 mb-2">{item.count.toLocaleString()} matches</div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-green-400">High:</span>
                <span className="text-white font-semibold">{item.highQuality}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-yellow-400">Med:</span>
                <span className="text-white font-semibold">{item.mediumQuality}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-red-400">Low:</span>
                <span className="text-white font-semibold">{item.lowQuality}</span>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-xs text-cyan-400">
                Quality Rate: {item.matchRate.toFixed(1)}%
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Component Correlations */}
      <div className="bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl p-6 border border-gray-700 shadow-xl">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-400" />
          Component Score Impact on Match Quality
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {componentCorrelations.map((comp, index) => (
            <div key={comp.component} className="bg-gray-700/50 rounded-lg p-4 border border-gray-600">
              <div className="text-sm text-gray-400 mb-2 capitalize">{comp.component}</div>
              <div className="text-2xl font-bold text-purple-400 mb-1">
                {comp.correlation.toFixed(3)}
              </div>
              <div className="text-xs text-gray-500 mb-2">
                Correlation
              </div>
              <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
                <div 
                  className={`h-2 rounded-full ${
                    comp.correlation > 0.5 ? 'bg-gradient-to-r from-green-500 to-emerald-500' :
                    comp.correlation > 0.3 ? 'bg-gradient-to-r from-yellow-500 to-orange-500' :
                    'bg-gradient-to-r from-red-500 to-pink-500'
                  }`}
                  style={{ width: `${Math.abs(comp.correlation) * 100}%` }}
                />
              </div>
              <div className="text-xs text-blue-400 mt-2">
                Avg Match: {comp.avgMatchScore.toFixed(1)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
