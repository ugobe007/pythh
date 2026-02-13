import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Lightbulb, 
  TrendingUp, 
  Target, 
  Users, 
  DollarSign,
  BarChart3,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Zap,
  ArrowRight,
  Info
} from 'lucide-react';
import FlameIcon from '../components/FlameIcon';
import { supabase } from '../lib/supabase';
import LogoDropdownMenu from '../components/LogoDropdownMenu';
import { useNavigate } from 'react-router-dom';

interface FundingStrategy {
  id: string;
  strategy_type: string;
  title: string;
  description: string;
  stage: string[];
  tactics: string[];
  common_mistakes: string[];
  examples: string[];
  source: string;
}

interface FundingBenchmark {
  stage: string;
  metric_name: string;
  metric_category: string;
  top_10_percent: number;
  top_25_percent: number;
  median: number;
  bottom_25_percent: number;
  unit: string;
  description: string;
}

interface MetricDefinition {
  id: number;
  metric_name: string;
  category: string;
  definition: string;
  why_it_matters: string;
  how_to_calculate: string;
  good_benchmark: string;
  warning_signs: string[];
}

const StrategiesPage: React.FC = () => {
  const navigate = useNavigate();
  const [strategies, setStrategies] = useState<FundingStrategy[]>([]);
  const [benchmarks, setBenchmarks] = useState<FundingBenchmark[]>([]);
  const [metrics, setMetrics] = useState<MetricDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'strategies' | 'benchmarks' | 'metrics'>('strategies');
  const [selectedStage, setSelectedStage] = useState<string>('seed');
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);
  const [expandedMetric, setExpandedMetric] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [strategiesRes, benchmarksRes, metricsRes] = await Promise.all([
        (supabase.from as any)('funding_strategies').select('*'),
        (supabase.from as any)('funding_benchmarks').select('*').order('stage').order('metric_category'),
        (supabase.from as any)('metric_definitions').select('*').order('category')
      ]);

      if (strategiesRes.data) setStrategies(strategiesRes.data as FundingStrategy[]);
      if (benchmarksRes.data) setBenchmarks(benchmarksRes.data as FundingBenchmark[]);
      if (metricsRes.data) setMetrics(metricsRes.data as MetricDefinition[]);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stages = ['pre-seed', 'seed', 'series-a', 'series-b'];
  
  const strategyIcons: Record<string, any> = {
    pitch: Lightbulb,
    traction: TrendingUp,
    customers: Users,
    growth: TrendingUp,
    fundraising: DollarSign,
    metrics: BarChart3,
    team: Users,
    competition: Target,
    unit_economics: DollarSign,
    product_market_fit: Target,
  };

  const categoryColors: Record<string, string> = {
    revenue: 'from-green-500 to-emerald-600',
    growth: 'from-blue-500 to-cyan-600',
    users: 'from-purple-500 to-violet-600',
    retention: 'from-cyan-600 to-blue-600',
    unit_economics: 'from-cyan-500 to-blue-600',
    burn: 'from-blue-500 to-violet-600',
    engagement: 'from-indigo-500 to-purple-600',
  };

  const formatValue = (value: number, unit: string): string => {
    if (unit === 'USD') {
      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
      return `$${value}`;
    }
    if (unit === 'percent') return `${value}%`;
    if (unit === 'months') return `${value} mo`;
    if (unit === 'ratio') return `${value}x`;
    if (unit === 'count') {
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
      return value.toString();
    }
    return value.toString();
  };

  const filteredBenchmarks = benchmarks.filter(b => b.stage === selectedStage);
  const groupedBenchmarks = filteredBenchmarks.reduce((acc, b) => {
    if (!acc[b.metric_category]) acc[b.metric_category] = [];
    acc[b.metric_category].push(b);
    return acc;
  }, {} as Record<string, FundingBenchmark[]>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950">
      {/* Global Navigation */}
              <LogoDropdownMenu />

      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-500/10 via-blue-500/10 to-violet-500/10 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-4xl font-bold text-white mb-4">
              🚀 Startup Fundraising Playbook
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto">
              Battle-tested strategies from YC, a16z, and top founders. 
              Know your metrics, nail your pitch, close your round.
            </p>
          </motion.div>

          {/* Tabs */}
          <div className="flex justify-center gap-2 mt-8">
            {[
              { id: 'strategies', label: 'Winning Strategies', icon: Lightbulb },
              { id: 'benchmarks', label: 'Stage Benchmarks', icon: BarChart3 },
              { id: 'metrics', label: 'Key Metrics', icon: Target },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-3 rounded-xl font-medium transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-cyan-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {/* STRATEGIES TAB */}
          {activeTab === 'strategies' && (
            <motion.div
              key="strategies"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              <div className="grid gap-4">
                {strategies.map((strategy) => {
                  const Icon = strategyIcons[strategy.strategy_type] || Lightbulb;
                  const isExpanded = expandedStrategy === strategy.id;
                  
                  return (
                    <motion.div
                      key={strategy.id}
                      layout
                      className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden"
                    >
                      {/* Strategy Header */}
                      <button
                        onClick={() => setExpandedStrategy(isExpanded ? null : strategy.id)}
                        className="w-full p-6 text-left flex items-start gap-4 hover:bg-gray-800/80 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-600 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-xl font-bold text-white">{strategy.title}</h3>
                            <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400">
                              {strategy.source}
                            </span>
                          </div>
                          <p className="text-gray-400">{strategy.description}</p>
                          <div className="flex gap-2 mt-3">
                            {strategy.stage.map(s => (
                              <span key={s} className="px-2 py-1 bg-cyan-600/20 text-cyan-400 rounded text-xs">
                                {s}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </button>

                      {/* Expanded Content */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-gray-700"
                          >
                            <div className="p-6 grid md:grid-cols-2 gap-6">
                              {/* Tactics */}
                              <div>
                                <h4 className="text-sm font-semibold text-green-400 mb-3 flex items-center gap-2">
                                  <CheckCircle className="w-4 h-4" />
                                  Key Tactics
                                </h4>
                                <ul className="space-y-2">
                                  {strategy.tactics.map((tactic, i) => (
                                    <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                                      <span className="text-green-400 mt-1">✓</span>
                                      {tactic}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Common Mistakes */}
                              <div>
                                <h4 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4" />
                                  Common Mistakes
                                </h4>
                                <ul className="space-y-2">
                                  {strategy.common_mistakes.map((mistake, i) => (
                                    <li key={i} className="flex items-start gap-2 text-gray-300 text-sm">
                                      <span className="text-red-400 mt-1">✗</span>
                                      {mistake}
                                    </li>
                                  ))}
                                </ul>
                              </div>

                              {/* Examples */}
                              {strategy.examples && strategy.examples.length > 0 && (
                                <div className="md:col-span-2">
                                  <h4 className="text-sm font-semibold text-blue-400 mb-3 flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" />
                                    Real Examples
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {strategy.examples.map((example, i) => (
                                      <span key={i} className="px-3 py-2 bg-blue-500/10 border border-blue-500/30 rounded-lg text-blue-300 text-sm">
                                        {example}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* BENCHMARKS TAB */}
          {activeTab === 'benchmarks' && (
            <motion.div
              key="benchmarks"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Stage Selector */}
              <div className="flex justify-center gap-2 mb-8">
                {stages.map(stage => (
                  <button
                    key={stage}
                    onClick={() => setSelectedStage(stage)}
                    className={`px-6 py-3 rounded-xl font-medium transition-all ${
                      selectedStage === stage
                        ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {stage.charAt(0).toUpperCase() + stage.slice(1).replace('-', ' ')}
                  </button>
                ))}
              </div>

              {/* Benchmarks by Category */}
              <div className="grid md:grid-cols-2 gap-6">
                {Object.entries(groupedBenchmarks).map(([category, categoryBenchmarks]) => (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden"
                  >
                    <div className={`px-6 py-4 bg-gradient-to-r ${categoryColors[category] || 'from-gray-600 to-gray-700'}`}>
                      <h3 className="text-lg font-bold text-white capitalize">
                        {category.replace('_', ' ')} Metrics
                      </h3>
                    </div>
                    <div className="p-4">
                      <table className="w-full">
                        <thead>
                          <tr className="text-xs text-gray-500">
                            <th className="text-left pb-2">Metric</th>
                            <th className="text-right pb-2">Top 10%</th>
                            <th className="text-right pb-2">Median</th>
                            <th className="text-right pb-2">Bottom 25%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryBenchmarks.map((benchmark, i) => (
                            <tr key={i} className="border-t border-gray-700/50">
                              <td className="py-3">
                                <div className="text-white font-medium text-sm">
                                  {benchmark.metric_name.toUpperCase().replace('_', ' ')}
                                </div>
                                <div className="text-xs text-gray-500">{benchmark.description}</div>
                              </td>
                              <td className="text-right py-3">
                                <span className="text-green-400 font-semibold">
                                  {formatValue(benchmark.top_10_percent, benchmark.unit)}
                                </span>
                              </td>
                              <td className="text-right py-3">
                                <span className="text-yellow-400 font-semibold">
                                  {formatValue(benchmark.median, benchmark.unit)}
                                </span>
                              </td>
                              <td className="text-right py-3">
                                <span className="text-red-400 font-semibold">
                                  {formatValue(benchmark.bottom_25_percent, benchmark.unit)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* CTA */}
              <div className="text-center mt-8 p-6 bg-gradient-to-r from-cyan-500/10 to-blue-500/10 rounded-2xl border border-cyan-500/30">
                <h3 className="text-xl font-bold text-white mb-2">
                  See How You Compare
                </h3>
                <p className="text-gray-400 mb-4">
                  Get a personalized analysis of your metrics against these benchmarks
                </p>
                <button
                  onClick={() => navigate('/services/traction-improvement')}
                  className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all"
                >
                  Run Traction Analysis →
                </button>
              </div>
            </motion.div>
          )}

          {/* METRICS TAB */}
          {activeTab === 'metrics' && (
            <motion.div
              key="metrics"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-4"
            >
              <div className="text-center mb-8">
                <h2 className="text-2xl font-bold text-white mb-2">
                  The 16 Metrics Investors Care About
                </h2>
                <p className="text-gray-400">
                  Based on a16z's definitive guide to startup metrics
                </p>
              </div>

              <div className="grid gap-4">
                {metrics.map((metric) => {
                  const isExpanded = expandedMetric === metric.id;
                  
                  return (
                    <motion.div
                      key={metric.id}
                      layout
                      className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden"
                    >
                      <button
                        onClick={() => setExpandedMetric(isExpanded ? null : metric.id)}
                        className="w-full p-4 text-left flex items-center gap-4 hover:bg-gray-800/80 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                          <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-white">{metric.metric_name}</h3>
                            <span className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-400">
                              {metric.category}
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 mt-1">{metric.definition}</p>
                        </div>
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                          ) : (
                            <ChevronRight className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-gray-700"
                          >
                            <div className="p-6 grid md:grid-cols-2 gap-6">
                              <div>
                                <h4 className="text-sm font-semibold text-blue-400 mb-2">
                                  Why It Matters
                                </h4>
                                <p className="text-gray-300 text-sm">{metric.why_it_matters}</p>
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-green-400 mb-2">
                                  How to Calculate
                                </h4>
                                <p className="text-gray-300 text-sm font-mono bg-gray-900/50 p-3 rounded">
                                  {metric.how_to_calculate}
                                </p>
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-purple-400 mb-2">
                                  Good Benchmark
                                </h4>
                                <p className="text-gray-300 text-sm">{metric.good_benchmark}</p>
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-red-400 mb-2 flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4" />
                                  Warning Signs
                                </h4>
                                <ul className="space-y-1">
                                  {metric.warning_signs?.map((sign, i) => (
                                    <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                                      <span className="text-red-400">•</span>
                                      {sign}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom CTA */}
      <div className="border-t border-gray-800 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-white mb-4">
              Ready to Put This Into Action?
            </h2>
            <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
              Our AI services apply these strategies and benchmarks to your specific startup
            </p>
            <div className="flex justify-center gap-4 flex-wrap">
              <button
                onClick={() => navigate('/services/pitch-analyzer')}
                className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-semibold rounded-xl hover:shadow-lg hover:shadow-cyan-500/25 transition-all flex items-center gap-2"
              >
                <FlameIcon variant={5} size="sm" />
                Analyze My Pitch
              </button>
              <button
                onClick={() => navigate('/services/funding-strategy')}
                className="px-6 py-3 bg-gray-700 text-white font-semibold rounded-xl hover:bg-gray-600 transition-all flex items-center gap-2"
              >
                <DollarSign className="w-5 h-5" />
                Funding Strategy
              </button>
              <button
                onClick={() => navigate('/services/pmf-analysis')}
                className="px-6 py-3 bg-gray-700 text-white font-semibold rounded-xl hover:bg-gray-600 transition-all flex items-center gap-2"
              >
                <Target className="w-5 h-5" />
                PMF Analysis
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrategiesPage;
