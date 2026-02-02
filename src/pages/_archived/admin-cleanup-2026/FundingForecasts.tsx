import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, 
  Clock, 
  DollarSign, 
  Target, 
  AlertTriangle,
  Zap,
  Building2,
  Users,
  BarChart3,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Filter,
  ArrowUpRight
} from 'lucide-react';

interface FundingForecast {
  id: string;
  startup_id: string;
  name: string;
  sectors: string[];
  total_god_score: number;
  arr: number;
  mrr: number;
  customer_count: number;
  growth_rate_monthly: number;
  funding_probability: number;
  urgency_score: number;
  investor_interest_score: number;
  predicted_round: string;
  predicted_amount_min: number;
  predicted_amount_max: number;
  predicted_timeline_months: number;
  confidence_level: string;
  acceleration_factors: string[];
  risk_factors: string[];
  last_calculated_at: string;
}

interface SectorStats {
  sector: string;
  startup_count: number;
  avg_probability: number;
  likely_funded: number;
  avg_raise: number;
}

export default function FundingForecasts() {
  const [forecasts, setForecasts] = useState<FundingForecast[]>([]);
  const [sectorStats, setSectorStats] = useState<SectorStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'imminent' | 'likely' | 'series-a-plus'>('all');
  const [selectedSector, setSelectedSector] = useState<string>('all');

  useEffect(() => {
    loadForecasts();
  }, []);

  const loadForecasts = async () => {
    // Query startups with high GOD scores
    const { data: startups, error } = await supabase
      .from('startup_uploads')
      .select(`
        id,
        name,
        sectors,
        total_god_score,
        arr,
        mrr,
        customer_count,
        growth_rate_monthly
      `)
      .eq('status', 'approved')
      .order('total_god_score', { ascending: false })
      .limit(500);
    
    if (!error && startups) {
      // Fetch forecast data using raw fetch to avoid type issues
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      
      const response = await fetch(
        `${supabaseUrl}/rest/v1/funding_forecasts?select=*`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
          }
        }
      );
      
      const forecastData: any[] = await response.json();
      
      // Calculate sector stats from the data
      const sectorMap = new Map<string, { count: number; probSum: number; likely: number; raiseSum: number }>();
      
      // Merge the data
      const merged = startups.map(startup => {
        const forecast = forecastData?.find((f: any) => f.startup_id === startup.id);
        
        // Update sector stats
        startup.sectors?.forEach((sector: string) => {
          const existing = sectorMap.get(sector) || { count: 0, probSum: 0, likely: 0, raiseSum: 0 };
          existing.count++;
          existing.probSum += Number(forecast?.funding_probability || 0);
          if (forecast?.funding_probability >= 70) existing.likely++;
          existing.raiseSum += Number(forecast?.predicted_amount_max || 0);
          sectorMap.set(sector, existing);
        });
        
        return {
          ...startup,
          startup_id: startup.id,
          funding_probability: forecast?.funding_probability || 0,
          urgency_score: forecast?.urgency_score || 0,
          investor_interest_score: forecast?.investor_interest_score || 0,
          predicted_round: forecast?.predicted_round || 'Pre-Seed',
          predicted_amount_min: forecast?.predicted_amount_min || 100000,
          predicted_amount_max: forecast?.predicted_amount_max || 500000,
          predicted_timeline_months: forecast?.predicted_timeline_months || 12,
          confidence_level: forecast?.confidence_level || 'medium',
          acceleration_factors: forecast?.acceleration_factors || [],
          risk_factors: forecast?.risk_factors || [],
          last_calculated_at: forecast?.last_calculated_at
        };
      }).filter(f => f.funding_probability > 0)
        .sort((a, b) => Number(b.funding_probability) - Number(a.funding_probability));
      
      // Convert sector map to stats array
      const stats: SectorStats[] = Array.from(sectorMap.entries())
        .map(([sector, data]) => ({
          sector,
          startup_count: data.count,
          avg_probability: data.count > 0 ? data.probSum / data.count : 0,
          likely_funded: data.likely,
          avg_raise: data.count > 0 ? data.raiseSum / data.count : 0
        }))
        .filter(s => s.startup_count >= 3)
        .sort((a, b) => b.avg_probability - a.avg_probability);
      
      setSectorStats(stats);
      setForecasts(merged as FundingForecast[]);
    }
    setLoading(false);
  };

  const refreshForecasts = async () => {
    setRefreshing(true);
    // Call the RPC function using raw fetch
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    await fetch(
      `${supabaseUrl}/rest/v1/rpc/calculate_all_funding_forecasts`,
      {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    await loadForecasts();
    setRefreshing(false);
  };

  const filteredForecasts = forecasts.filter(f => {
    if (selectedSector !== 'all' && !f.sectors?.includes(selectedSector)) return false;
    switch (filter) {
      case 'imminent':
        return f.predicted_timeline_months <= 3 && f.funding_probability >= 70;
      case 'likely':
        return f.funding_probability >= 80;
      case 'series-a-plus':
        return ['Series A', 'Series B', 'Series C'].includes(f.predicted_round);
      default:
        return true;
    }
  });

  const stats = {
    total: forecasts.length,
    veryLikely: forecasts.filter(f => f.funding_probability >= 80).length,
    likely: forecasts.filter(f => f.funding_probability >= 60 && f.funding_probability < 80).length,
    imminent: forecasts.filter(f => f.predicted_timeline_months <= 3 && f.funding_probability >= 70).length,
    avgProbability: forecasts.length > 0 
      ? Math.round(forecasts.reduce((sum, f) => sum + Number(f.funding_probability), 0) / forecasts.length) 
      : 0
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount}`;
  };

  const getProbabilityColor = (prob: number) => {
    if (prob >= 80) return 'text-green-400';
    if (prob >= 60) return 'text-yellow-400';
    if (prob >= 40) return 'text-cyan-400';
    return 'text-red-400';
  };

  const getProbabilityBg = (prob: number) => {
    if (prob >= 80) return 'bg-green-500/20 border-green-500/30';
    if (prob >= 60) return 'bg-yellow-500/20 border-yellow-500/30';
    if (prob >= 40) return 'bg-cyan-600/20 border-cyan-500/30';
    return 'bg-red-500/20 border-red-500/30';
  };

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: 'bg-green-500/20 text-green-400 border-green-500/30',
      medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      low: 'bg-red-500/20 text-red-400 border-red-500/30'
    };
    return colors[confidence as keyof typeof colors] || colors.medium;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-blue-400 to-violet-400 bg-clip-text text-transparent flex items-center gap-3">
              <Sparkles className="w-8 h-8 text-purple-400" />
              Funding Forecast Engine
            </h1>
            <p className="text-gray-400 mt-2">AI-powered predictions for startup funding likelihood and timing</p>
          </div>
          <button
            onClick={refreshForecasts}
            disabled={refreshing}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Recalculating...' : 'Refresh Forecasts'}
          </button>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-5 gap-4 mb-8">
          <div className="bg-gradient-to-br from-purple-900/40 to-purple-800/20 rounded-xl p-5 border border-purple-500/30">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              <span className="text-gray-400 text-sm">Total Analyzed</span>
            </div>
            <div className="text-3xl font-bold text-white">{stats.total}</div>
          </div>
          
          <div className="bg-gradient-to-br from-green-900/40 to-green-800/20 rounded-xl p-5 border border-green-500/30">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <span className="text-gray-400 text-sm">Very Likely (80%+)</span>
            </div>
            <div className="text-3xl font-bold text-green-400">{stats.veryLikely}</div>
          </div>
          
          <div className="bg-gradient-to-br from-yellow-900/40 to-yellow-800/20 rounded-xl p-5 border border-yellow-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Target className="w-5 h-5 text-yellow-400" />
              <span className="text-gray-400 text-sm">Likely (60-79%)</span>
            </div>
            <div className="text-3xl font-bold text-yellow-400">{stats.likely}</div>
          </div>
          
          <div className="bg-gradient-to-br from-slate-800/40 to-slate-700/20 rounded-xl p-5 border border-cyan-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              <span className="text-gray-400 text-sm">Imminent (3mo)</span>
            </div>
            <div className="text-3xl font-bold text-cyan-400">{stats.imminent}</div>
          </div>
          
          <div className="bg-gradient-to-br from-cyan-900/40 to-cyan-800/20 rounded-xl p-5 border border-cyan-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Zap className="w-5 h-5 text-cyan-400" />
              <span className="text-gray-400 text-sm">Avg Probability</span>
            </div>
            <div className="text-3xl font-bold text-cyan-400">{stats.avgProbability}%</div>
          </div>
        </div>

        {/* Sector Insights */}
        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-purple-400" />
            Hot Sectors for Funding
          </h2>
          <div className="grid grid-cols-5 gap-4">
            {sectorStats.slice(0, 10).map((sector, i) => (
              <button
                key={sector.sector}
                onClick={() => setSelectedSector(selectedSector === sector.sector ? 'all' : sector.sector)}
                className={`p-4 rounded-lg border transition-all ${
                  selectedSector === sector.sector 
                    ? 'bg-purple-600/30 border-purple-500' 
                    : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                }`}
              >
                <div className="text-sm font-medium text-white truncate">{sector.sector}</div>
                <div className={`text-2xl font-bold ${getProbabilityColor(sector.avg_probability)}`}>
                  {Math.round(sector.avg_probability)}%
                </div>
                <div className="text-xs text-gray-500">{sector.startup_count} startups</div>
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 mb-6">
          <Filter className="w-5 h-5 text-gray-400" />
          <div className="flex gap-2">
            {[
              { key: 'all', label: 'All Forecasts' },
              { key: 'likely', label: '🔥 Very Likely (80%+)' },
              { key: 'imminent', label: '⏰ Imminent (3 months)' },
              { key: 'series-a-plus', label: '💰 Series A+' }
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key as typeof filter)}
                className={`px-4 py-2 rounded-lg transition-all ${
                  filter === f.key 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {selectedSector !== 'all' && (
            <button
              onClick={() => setSelectedSector('all')}
              className="px-3 py-1 bg-purple-600/30 text-purple-300 rounded-full text-sm flex items-center gap-1"
            >
              {selectedSector} ×
            </button>
          )}
        </div>

        {/* Forecast Cards */}
        <div className="space-y-4">
          {filteredForecasts.map((forecast) => (
            <Link
              key={forecast.startup_id}
              to={`/startup/${forecast.startup_id}`}
              className="block bg-gray-900/50 rounded-xl border border-gray-800 p-6 hover:border-purple-500/50 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h3 className="text-xl font-semibold text-white group-hover:text-purple-400 transition-colors">
                      {forecast.name}
                    </h3>
                    <span className={`px-2 py-0.5 rounded text-xs border ${getConfidenceBadge(forecast.confidence_level)}`}>
                      {forecast.confidence_level} confidence
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-gray-600 group-hover:text-purple-400 transition-colors" />
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {forecast.sectors?.map((sector, i) => (
                      <span key={i} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-400">
                        {sector}
                      </span>
                    ))}
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-5 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Probability</div>
                      <div className={`text-xl font-bold ${getProbabilityColor(forecast.funding_probability)}`}>
                        {Math.round(forecast.funding_probability)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Timeline</div>
                      <div className="text-xl font-bold text-white">
                        {forecast.predicted_timeline_months}mo
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Predicted Round</div>
                      <div className="text-xl font-bold text-purple-400">
                        {forecast.predicted_round}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Predicted Raise</div>
                      <div className="text-xl font-bold text-green-400">
                        {formatCurrency(forecast.predicted_amount_min)} - {formatCurrency(forecast.predicted_amount_max)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">GOD Score</div>
                      <div className="text-xl font-bold text-cyan-400">
                        {forecast.total_god_score}
                      </div>
                    </div>
                  </div>

                  {/* Traction Indicators */}
                  <div className="flex gap-6 text-sm text-gray-400 mb-4">
                    {forecast.arr > 0 && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-green-400" />
                        ARR: {formatCurrency(forecast.arr)}
                      </span>
                    )}
                    {forecast.customer_count > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4 text-blue-400" />
                        {forecast.customer_count} customers
                      </span>
                    )}
                    {forecast.growth_rate_monthly > 0 && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-purple-400" />
                        {forecast.growth_rate_monthly}% monthly growth
                      </span>
                    )}
                  </div>

                  {/* Acceleration Factors */}
                  {forecast.acceleration_factors?.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {forecast.acceleration_factors.slice(0, 3).map((factor, i) => (
                        <span key={i} className="px-2 py-1 bg-green-500/10 border border-green-500/30 rounded text-xs text-green-400 flex items-center gap-1">
                          <Zap className="w-3 h-3" />
                          {factor}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Risk Factors */}
                  {forecast.risk_factors?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {forecast.risk_factors.slice(0, 2).map((risk, i) => (
                        <span key={i} className="px-2 py-1 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {risk}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Probability Gauge */}
                <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center ${getProbabilityBg(forecast.funding_probability)}`}>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${getProbabilityColor(forecast.funding_probability)}`}>
                      {Math.round(forecast.funding_probability)}%
                    </div>
                    <div className="text-xs text-gray-500">likely</div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredForecasts.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No startups match the current filter criteria
          </div>
        )}
      </div>
    </div>
  );
}
