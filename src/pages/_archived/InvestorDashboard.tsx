// @ts-nocheck
/**
 * INVESTOR OBSERVATORY DASHBOARD
 * ============================================================================
 * "Your discovery flow"
 * "How startups are entering your alignment orbit"
 * 
 * NOT a marketplace. NOT leads. NOT deals.
 * This is: Decision support + observatory
 * 
 * CRITICAL PRINCIPLES (LOCKED):
 * ❌ Never expose founders
 * ❌ Never allow messaging
 * ❌ Never create inboxes
 * ❌ Never create marketplaces
 * ❌ Never sell access
 * ❌ Never show scores
 * ============================================================================
 */

import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  TrendingDown,
  Minus,
  Sparkles,
  Signal,
  RefreshCw,
  BarChart3,
  Clock
} from 'lucide-react';
import {
  getDiscoveryFlow,
  getDiscoveryFlowSummary,
  getSignalDistribution,
  getEntryPathDistribution,
  getQualityDrift,
  getObservatorySummary,
  checkObservatoryAccess,
  startObservatorySession,
  mapAlignmentStateLabel,
  getAlignmentDisplayText,
  getAlignmentColor,
  type DiscoveryFlowItem,
  type SignalDistributionItem,
  type EntryPathItem,
  type QualityDriftWeek,
  type ObservatorySummary
} from '../services/investorObservatoryService';
import {
  submitFeedback,
  removeFeedback,
  getFeedbackForItem,
  getFeedbackStats,
  getFeedbackButtonConfig,
  getAllFeedbackTypes,
  type FeedbackType
} from '../services/investorFeedbackService';

// =============================================================================
// TYPES
// =============================================================================

interface InvestorDashboardProps {
  investorId?: string; // For now, passed via URL or session
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function InvestorDashboard({ investorId }: InvestorDashboardProps) {
  // For demo, use a test investor ID if none provided
  const activeInvestorId = investorId || 'demo-investor';
  
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState(true); // Default true for demo
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Data state
  const [summary, setSummary] = useState<ObservatorySummary | null>(null);
  const [discoveryFlow, setDiscoveryFlow] = useState<DiscoveryFlowItem[]>([]);
  const [signalDist, setSignalDist] = useState<SignalDistributionItem[]>([]);
  const [entryPaths, setEntryPaths] = useState<EntryPathItem[]>([]);
  const [qualityDrift, setQualityDrift] = useState<QualityDriftWeek[]>([]);
  const [feedbackMap, setFeedbackMap] = useState<Record<string, FeedbackType>>({});
  
  // Filter state
  const [flowFilter, setFlowFilter] = useState<string>('all');
  
  // UI helpers
  const [showExplainer, setShowExplainer] = useState(true);

  // =============================================================================
  // LOAD DATA
  // =============================================================================

  useEffect(() => {
    loadDashboard();
  }, [activeInvestorId]);

  async function loadDashboard() {
    setLoading(true);
    
    try {
      // Check access (disabled for demo)
      // const access = await checkObservatoryAccess(activeInvestorId);
      // setHasAccess(access);
      // if (!access) return;
      
      // Start session
      const session = await startObservatorySession(activeInvestorId);
      setSessionId(session);
      
      // Load all data in parallel
      const [summaryData, flowData, signalData, pathData, driftData] = await Promise.all([
        getObservatorySummary(activeInvestorId),
        getDiscoveryFlow(activeInvestorId, { limit: 50 }),
        getSignalDistribution(activeInvestorId),
        getEntryPathDistribution(activeInvestorId),
        getQualityDrift(activeInvestorId, 12)
      ]);
      
      setSummary(summaryData);
      setDiscoveryFlow(flowData);
      setSignalDist(signalData);
      setEntryPaths(pathData);
      setQualityDrift(driftData);
      
      // Load feedback state for flow items
      const feedbackState: Record<string, FeedbackType> = {};
      for (const item of flowData) {
        const feedback = await getFeedbackForItem(activeInvestorId, item.id);
        if (feedback) feedbackState[item.id] = feedback;
      }
      setFeedbackMap(feedbackState);
      
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }

  // =============================================================================
  // FEEDBACK HANDLERS
  // =============================================================================

  async function handleFeedback(flowId: string, type: FeedbackType) {
    const currentFeedback = feedbackMap[flowId];
    
    if (currentFeedback === type) {
      // Remove feedback if clicking same button
      await removeFeedback(activeInvestorId, flowId);
      setFeedbackMap(prev => {
        const next = { ...prev };
        delete next[flowId];
        return next;
      });
    } else {
      // Submit new feedback
      await submitFeedback(activeInvestorId, flowId, type);
      setFeedbackMap(prev => ({ ...prev, [flowId]: type }));
    }
  }

  // =============================================================================
  // RENDER HELPERS
  // =============================================================================

  function renderTrendIcon(trend: string) {
    switch (trend) {
      case 'new':
        return <Sparkles className="w-4 h-4 text-purple-500" />;
      case 'rising':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'fading':
        return <TrendingDown className="w-4 h-4 text-red-500" />;
      default:
        return <Minus className="w-4 h-4 text-gray-400" />;
    }
  }

  function renderAlignmentBadge(state: string) {
    // Map DB state to friendly label and color
    const mappedState = mapAlignmentStateLabel(state);
    const displayText = getAlignmentDisplayText(mappedState);
    const colorClass = getAlignmentColor(mappedState);
    
    // Badge background color based on state
    const bgColors = {
      'strong_pattern_match': 'bg-emerald-500/20 border border-emerald-500/30',
      'multiple_signals': 'bg-blue-500/20 border border-blue-500/30',
      'early_signals': 'bg-amber-500/20 border border-amber-500/30',
      'emerging': 'bg-gray-700/20 border border-gray-700/30',
      // Legacy:
      'high_alignment': 'bg-emerald-500/20 border border-emerald-500/30',
      'moderate_alignment': 'bg-blue-500/20 border border-blue-500/30',
      'low_alignment': 'bg-amber-500/20 border border-amber-500/30',
      'minimal_alignment': 'bg-gray-700/20 border border-gray-700/30',
      'strong': 'bg-blue-500/20 border border-blue-500/30',
      'active': 'bg-emerald-500/20 border border-emerald-500/30',
      'forming': 'bg-amber-500/20 border border-amber-500/30'
    };
    
    const bgClass = bgColors[mappedState] || 'bg-gray-700 border border-gray-700';
    
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${bgClass} ${colorClass}`}>
        {displayText}
      </span>
    );
  }

  // =============================================================================
  // RENDER
  // =============================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading your discovery flow...</p>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="max-w-md text-center p-8">
          <h2 className="text-2xl font-bold text-white mb-4">Observatory Access Required</h2>
          <p className="text-gray-400 mb-6">
            The investor observatory is currently invite-only. 
            Contact us to request access.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Signal className="w-7 h-7 text-amber-400" />
            Your discovery flow
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            How startups are entering your alignment orbit
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* UX GUARDRAIL: Observatory Notice Banner */}
        <div className="mb-6 bg-gradient-to-r from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg shrink-0">
              <Sparkles className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white mb-1">
                This is anonymized signal flow
              </h3>
              <p className="text-xs text-gray-400">
                You're observing discovery patterns, not leads. <span className="text-gray-500">No founder contact. No messaging. No marketplace.</span>
                {' '}Use 👍 👎 ⏸ to refine what signals matter to you.
              </p>
            </div>
          </div>
        </div>
        
        {/* Summary Stats */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-amber-400">{summary.total_in_flow}</div>
              <div className="text-sm text-gray-500">In your flow</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-green-400">{summary.new_this_week}</div>
              <div className="text-sm text-gray-500">New this week</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="text-2xl font-bold text-purple-400">{summary.strong_alignment_count}</div>
              <div className="text-sm text-gray-500">Strong alignment</div>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex items-center gap-2">
                {summary.quality_trend === 'improving' && <TrendingUp className="w-5 h-5 text-green-500" />}
                {summary.quality_trend === 'declining' && <TrendingDown className="w-5 h-5 text-red-500" />}
                {summary.quality_trend === 'stable' && <Minus className="w-5 h-5 text-gray-400" />}
                <span className="text-lg font-medium capitalize">{summary.quality_trend}</span>
              </div>
              <div className="text-sm text-gray-500">Quality trend</div>
            </div>
          </div>
        )}

        {/* "Why you're seeing this" Explainer Panel */}
        {showExplainer && signalDist.length > 0 && entryPaths.length > 0 && (
          <div className="bg-gradient-to-br from-amber-500/10 to-purple-500/10 border border-amber-500/30 rounded-xl p-6 mb-8">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-semibold text-white">Why you're seeing this</h3>
              </div>
              <button 
                onClick={() => setShowExplainer(false)}
                className="text-gray-400 hover:text-white text-sm"
              >
                Dismiss
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Top drivers */}
              <div>
                <h4 className="text-sm font-medium text-amber-400 mb-2">Top drivers this week:</h4>
                <div className="space-y-1.5">
                  {signalDist.slice(0, 3).map((signal, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-300">{signal.signal_strength}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div 
                            className="bg-amber-500 h-full rounded-full" 
                            style={{ width: `${(signal.count / discoveryFlow.length) * 100}%` }}
                          />
                        </div>
                        <span className="text-gray-400 text-xs w-12 text-right">{signal.count} items</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Entry paths */}
              <div>
                <h4 className="text-sm font-medium text-blue-400 mb-2">Entry paths trending:</h4>
                <div className="flex flex-wrap gap-2">
                  {entryPaths.slice(0, 2).map((path, idx) => (
                    <span 
                      key={idx}
                      className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 text-blue-300 rounded-full text-xs"
                    >
                      {path.entry_path} ({path.count})
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Timing readiness */}
              {summary && (
                <div>
                  <h4 className="text-sm font-medium text-purple-400 mb-2">Timing:</h4>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs text-gray-400 mb-1">
                        <span>Early</span>
                        <span>Ready</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-3 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-amber-500 to-emerald-500 h-full rounded-full transition-all" 
                          style={{ width: `${100 - (summary.too_early_rate * 100)}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-sm text-gray-300 font-medium">
                      {Math.round(100 - (summary.too_early_rate * 100))}% ready
                    </span>
                  </div>
                </div>
              )}
              
              <p className="text-xs text-gray-500 italic mt-4 pt-4 border-t border-gray-800">
                This explains patterns in your flow, not individual companies. We're showing you <em>how</em> discovery is forming around you, not <em>who</em>.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Discovery Flow */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Section 1: Startups Entering Your Flow */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="px-6 py-4 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Signal className="w-5 h-5 text-amber-400" />
                      Startups entering your flow
                    </h2>
                    <p className="text-xs text-gray-500 mt-1">
                      Anonymized patterns matching your investment thesis
                    </p>
                  </div>
                  
                  {/* Filter */}
                  <select 
                    value={flowFilter}
                    onChange={(e) => setFlowFilter(e.target.value)}
                    className="text-sm bg-gray-800 border-gray-700 text-white rounded-lg focus:ring-amber-500 focus:border-amber-500"
                  >
                    <option value="all">All states</option>
                    <option value="strong">Strong</option>
                    <option value="active">Active</option>
                    <option value="forming">Forming</option>
                  </select>
                </div>
              </div>
              
              <div className="divide-y divide-gray-800">
                {discoveryFlow.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-500">
                    <Signal className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400">No startups in your flow yet.</p>
                    <p className="text-sm mt-2 text-gray-500">As matches form, they'll appear here.</p>
                  </div>
                ) : (
                  discoveryFlow
                    .filter(item => flowFilter === 'all' || item.alignment_state === flowFilter)
                    .map((item) => (
                      <div key={item.id} className="px-6 py-4 hover:bg-gray-800/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            {/* Anonymized Label */}
                            <div className="flex items-center gap-2 mb-1">
                              {renderTrendIcon(item.trend)}
                              <span className="font-medium text-white">
                                {item.startup_type_label}
                              </span>
                              {renderAlignmentBadge(item.alignment_state)}
                            </div>
                            
                            {/* Why am I seeing this? (signals only, no identifying info) */}
                            <p className="text-sm text-gray-400 mb-2 flex items-center gap-1">
                              <span className="text-gray-500 text-xs">Why this signal:</span>
                              {item.why_appeared}
                            </p>
                            
                            {/* Signals */}
                            <div className="flex flex-wrap gap-1">
                              {item.signals_present.slice(0, 4).map((signal, i) => (
                                <span 
                                  key={i}
                                  className="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs"
                                >
                                  {signal.replace(/_/g, ' ')}
                                </span>
                              ))}
                              {item.signals_present.length > 4 && (
                                <span className="px-2 py-0.5 bg-gray-700 text-gray-400 rounded text-xs">
                                  +{item.signals_present.length - 4} more
                                </span>
                              )}
                            </div>
                          </div>
                          
                          {/* Feedback Buttons */}
                          <div className="flex items-center gap-1 ml-4">
                            {getAllFeedbackTypes().map((type) => {
                              const config = getFeedbackButtonConfig(type);
                              const isActive = feedbackMap[item.id] === type;
                              return (
                                <button
                                  key={type}
                                  onClick={() => handleFeedback(item.id, type)}
                                  className={`p-2 rounded-lg transition-colors ${
                                    isActive ? config.activeColor : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                                  }`}
                                  title={config.label}
                                >
                                  <span className="text-lg">{config.emoji}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </section>
            
            {/* Section 4: Quality Drift Chart */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="px-6 py-4 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-400" />
                  Inbound quality trend
                </h2>
              </div>
              
              <div className="p-6">
                {qualityDrift.length === 0 ? (
                  <div className="text-center py-8">
                    <BarChart3 className="w-12 h-12 mx-auto mb-4 text-gray-600" />
                    <p className="text-gray-400">Quality data will appear after you have more inbound activity.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Simple bar chart visualization */}
                    <div className="flex items-end gap-1 h-32">
                      {qualityDrift.map((week, i) => {
                        const height = Math.max(10, (week.quality_score || 0.5) * 100);
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center">
                            <div 
                              className="w-full bg-amber-500 rounded-t transition-all"
                              style={{ height: `${height}%` }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Week labels */}
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{qualityDrift[0]?.week_bucket?.slice(5, 10) || ''}</span>
                      <span>{qualityDrift[qualityDrift.length - 1]?.week_bucket?.slice(5, 10) || ''}</span>
                    </div>
                    
                    {/* Legend */}
                    <div className="flex justify-center gap-6 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded" />
                        <span className="text-gray-400">Strong</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-blue-500 rounded" />
                        <span className="text-gray-400">Active</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-amber-500 rounded" />
                        <span className="text-gray-400">Forming</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
          
          {/* Right Column: Distributions */}
          <div className="space-y-6">
            
            {/* Section 2: Signal Distribution */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="px-6 py-4 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white">
                  What's driving inbound
                </h2>
              </div>
              
              <div className="p-6">
                {signalDist.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Signal data will appear as your flow grows.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {signalDist.slice(0, 6).map((signal) => (
                      <div key={signal.signal_type}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-300">{signal.signal_label}</span>
                          <span className="text-gray-500">{Math.round(signal.percentage)}%</span>
                        </div>
                        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-amber-500 rounded-full transition-all"
                            style={{ width: `${signal.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
            
            {/* Section 3: Entry Path Distribution */}
            <section className="bg-gray-900 border border-gray-800 rounded-xl">
              <div className="px-6 py-4 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white">
                  How discovery happens
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  Signal channels, not founder identities
                </p>
              </div>
              
              <div className="p-6">
                {entryPaths.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Entry path data will appear as your flow grows.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {entryPaths.slice(0, 5).map((path) => (
                      <div key={path.entry_path} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ 
                              backgroundColor: path.avg_alignment_quality > 0.7 
                                ? '#10B981' 
                                : path.avg_alignment_quality > 0.5 
                                  ? '#3B82F6' 
                                  : '#F59E0B' 
                            }}
                          />
                          <span className="text-sm text-gray-300">{path.path_label}</span>
                        </div>
                        <span className="text-sm text-gray-500">
                          {Math.round(path.percentage)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
            
            {/* Top Signal & Path */}
            {summary && (
              <section className="bg-gradient-to-br from-amber-600 to-orange-600 rounded-xl text-white p-6">
                <h3 className="text-sm font-medium opacity-80 mb-4">Key insights</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-xs opacity-70">Top signal</div>
                    <div className="font-semibold">{summary.top_signal}</div>
                  </div>
                  <div>
                    <div className="text-xs opacity-70">Primary entry path</div>
                    <div className="font-semibold">{summary.top_entry_path}</div>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-gray-800 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-500">
            This is an observatory, not a marketplace. 
            Founders are never exposed. Messages are never sent.
          </p>
        </div>
      </footer>
    </div>
  );
}
