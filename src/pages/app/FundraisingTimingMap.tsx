// ============================================================================
// Pythh — Fundraising Timing Map
// ============================================================================
// Your fundraising readiness dashboard — pure inline text, Supabase style.
// ============================================================================

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBilling } from '../../hooks/useBilling';

/* ──────────────────────────── Types ──────────────────────────── */

interface Phase {
  id: string;
  label: string;
  status: 'complete' | 'active' | 'upcoming' | 'future';
  window: string;
  description: string;
  actions: string[];
}

interface MarketSignal {
  signal: string;
  direction: 'up' | 'down' | 'stable';
  impact: string;
  relevance: 'high' | 'medium' | 'low';
}

interface ReadinessMetric {
  label: string;
  current: number;
  target: number;
  unit: string;
  status: 'on-track' | 'at-risk' | 'behind';
}

interface CadenceItem {
  week: number;
  focus: string;
  milestone: string;
  status: 'done' | 'current' | 'upcoming';
}

interface TimingMapData {
  overall_readiness: number;
  optimal_window: string;
  current_phase: string;
  market_temperature: string;
  phases: Phase[];
  market_signals: MarketSignal[];
  readiness_metrics: ReadinessMetric[];
  weekly_cadence: CadenceItem[];
}

/* ──────────────────────────── Mock data ──────────────────────────── */

function generateTimingMap(): TimingMapData {
  return {
    overall_readiness: 72,
    optimal_window: 'March 2026 - April 2026',
    current_phase: 'preparation',
    market_temperature: 'warm',

    phases: [
      {
        id: 'research',
        label: 'Research & Targeting',
        status: 'complete',
        window: 'Dec 2025 - Jan 2026',
        description: 'Investor list built, thesis alignment mapped, warm intro paths identified.',
        actions: [
          'Built target list of 45 investors with thesis match',
          'Mapped 23 warm intro paths through network',
          'Completed competitive landscape analysis',
        ],
      },
      {
        id: 'preparation',
        label: 'Materials & Narrative',
        status: 'active',
        window: 'Jan 2026 - Feb 2026',
        description: 'Deck, data room, and narrative being finalized. Key metrics being packaged for maximum signal strength.',
        actions: [
          'Finalize pitch deck with updated metrics',
          'Build data room with diligence-ready docs',
          'Prepare founder story arc and practice delivery',
          'Set up CRM for tracking investor conversations',
        ],
      },
      {
        id: 'outreach',
        label: 'Outreach & Meetings',
        status: 'upcoming',
        window: 'Mar 2026 - Apr 2026',
        description: 'Concentrated 6-week push. Launch all warm intros in week 1, create urgency through parallel process.',
        actions: [
          'Activate all warm intros in first 5 days',
          'Schedule 3-4 meetings per day in weeks 2-4',
          'Send weekly investor updates to build momentum',
          'Track and optimize conversion at each stage',
        ],
      },
      {
        id: 'close',
        label: 'Term Sheet & Close',
        status: 'future',
        window: 'Apr 2026 - May 2026',
        description: 'Negotiate terms, run final diligence, close round. Target 2-week close from term sheet.',
        actions: [
          'Compare term sheets on key dimensions',
          'Run reference checks on lead investor',
          'Negotiate key terms (valuation, board, pro-rata)',
          'Execute docs and wire funds',
        ],
      },
    ],

    market_signals: [
      { signal: 'VC dry powder at record levels', direction: 'up', impact: 'More capital available, but investors still selective', relevance: 'high' },
      { signal: 'AI/ML deal volume increasing 40% QoQ', direction: 'up', impact: 'Category tailwind if positioned correctly', relevance: 'high' },
      { signal: 'Seed valuations stabilizing at 2023 levels', direction: 'stable', impact: 'Realistic expectations, less bubble risk', relevance: 'medium' },
      { signal: 'Time to close extending to 3-4 months', direction: 'down', impact: 'Need earlier start, more runway buffer', relevance: 'high' },
      { signal: 'Follow-on rates declining for seed stage', direction: 'down', impact: 'Must show clear path to Series A metrics', relevance: 'medium' },
    ],

    readiness_metrics: [
      { label: 'MRR', current: 42, target: 50, unit: 'K', status: 'at-risk' },
      { label: 'MoM Growth', current: 18, target: 15, unit: '%', status: 'on-track' },
      { label: 'Runway', current: 8, target: 6, unit: 'months', status: 'on-track' },
      { label: 'Logo Count', current: 28, target: 35, unit: 'customers', status: 'behind' },
      { label: 'NRR', current: 115, target: 120, unit: '%', status: 'at-risk' },
      { label: 'CAC Payback', current: 14, target: 12, unit: 'months', status: 'at-risk' },
    ],

    weekly_cadence: [
      { week: 1, focus: 'Deck finalization', milestone: 'Deck v3 complete with updated metrics', status: 'done' },
      { week: 2, focus: 'Data room build', milestone: 'All diligence docs uploaded and organized', status: 'done' },
      { week: 3, focus: 'Narrative practice', milestone: '3 practice pitches with advisors, iterate', status: 'current' },
      { week: 4, focus: 'Pre-outreach warm-up', milestone: 'Soft intros to 5 target investors', status: 'upcoming' },
      { week: 5, focus: 'Launch outreach', milestone: 'All warm intros activated, 10+ meetings booked', status: 'upcoming' },
      { week: 6, focus: 'Meeting sprint 1', milestone: '15+ first meetings completed', status: 'upcoming' },
      { week: 7, focus: 'Meeting sprint 2', milestone: 'Partner meetings with top 5 firms', status: 'upcoming' },
      { week: 8, focus: 'Follow-up & close', milestone: 'Term sheet(s) in hand, begin negotiation', status: 'upcoming' },
    ],
  };
}

/* ──────────────────────────── Component ──────────────────────────── */

export default function FundraisingTimingMap() {
  const { user } = useAuth();
  const { plan } = useBilling();

  const [data, setData] = useState<TimingMapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'signals' | 'readiness' | 'cadence'>('timeline');
  const [expandedPhase, setExpandedPhase] = useState<string | null>(null);

  const isLocked = !plan || plan === 'free';

  useEffect(() => {
    const timer = setTimeout(() => {
      setData(generateTimingMap());
      setLoading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  const statusColor = (s: string) =>
    s === 'on-track' || s === 'complete' || s === 'done' ? 'text-emerald-400'
    : s === 'at-risk' || s === 'active' || s === 'current' ? 'text-amber-400'
    : s === 'behind' ? 'text-red-400'
    : 'text-zinc-500';

  const directionSymbol = (d: string) =>
    d === 'up' ? '\u2191' : d === 'down' ? '\u2193' : '\u2194';

  const directionColor = (d: string) =>
    d === 'up' ? 'text-emerald-400' : d === 'down' ? 'text-red-400' : 'text-zinc-400';

  const relevanceColor = (r: string) =>
    r === 'high' ? 'text-cyan-400' : r === 'medium' ? 'text-zinc-400' : 'text-zinc-600';

  const readinessColor = (score: number) =>
    score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-cyan-400' : score >= 40 ? 'text-amber-400' : 'text-red-400';

  const tabs = ['timeline', 'signals', 'readiness', 'cadence'] as const;

  return (
    <div>

        {/* Intro */}
        <p className="text-sm text-zinc-400 leading-relaxed mb-8 max-w-3xl">
          Your <span className="text-cyan-400">fundraising map</span> tracks where you are in the process,
          what the market looks like, and exactly what to do each week. Timing is the
          difference between a contested round and a cold outreach graveyard.
        </p>

        {loading ? (
          <div className="text-sm text-zinc-500 py-12">Building your timing map...</div>
        ) : data ? (
          <div className="space-y-8">

            {/* Stats line */}
            <div className="flex items-center gap-6 text-sm border-b border-zinc-800/50 pb-6 flex-wrap">
              <div>
                <span className={`text-3xl font-bold font-mono ${readinessColor(data.overall_readiness)}`}>{data.overall_readiness}</span>
                <span className="text-zinc-500 ml-2 text-xs">% ready</span>
              </div>
              <div className="text-zinc-600">·</div>
              <div>
                <span className="text-zinc-500 text-xs">Window:</span>
                <span className="text-cyan-400 ml-1 text-xs">{data.optimal_window}</span>
              </div>
              <div className="text-zinc-600">·</div>
              <div>
                <span className="text-zinc-500 text-xs">Phase:</span>
                <span className="text-amber-400 ml-1 text-xs">{data.current_phase}</span>
              </div>
              <div className="text-zinc-600">·</div>
              <div>
                <span className="text-zinc-500 text-xs">Market:</span>
                <span className="text-emerald-400 ml-1 text-xs">{data.market_temperature}</span>
              </div>
            </div>

            {/* Tab row — text links only */}
            <div className="flex items-center gap-6 text-sm">
              {tabs.map((tab) => (
                <span
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`cursor-pointer transition capitalize ${
                    activeTab === tab
                      ? 'text-cyan-400'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {tab}
                </span>
              ))}
            </div>

            {/* ─── Timeline Tab ─── */}
            {activeTab === 'timeline' && (
              <div className="space-y-1">
                <div className="hidden sm:grid grid-cols-[1fr_120px_100px] gap-2 px-2 py-2 text-[11px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800/30">
                  <span>Phase</span>
                  <span>Window</span>
                  <span className="text-right">Status</span>
                </div>

                {data.phases.map((phase, idx) => {
                  const isOpen = expandedPhase === phase.id;
                  const isBlurred = isLocked && idx >= 2;

                  return (
                    <div key={phase.id} className={isBlurred ? 'relative' : ''}>
                      {isBlurred && (
                        <div className="absolute inset-0 z-10 backdrop-blur-md bg-black/40 flex items-center justify-center">
                          <span className="text-xs text-zinc-500">
                            <Link to="/pricing?source=timing-map" className="text-cyan-400 hover:text-cyan-300">Upgrade</Link> to see full timeline
                          </span>
                        </div>
                      )}

                      <div
                        onClick={() => !isBlurred && setExpandedPhase(isOpen ? null : phase.id)}
                        className="grid grid-cols-[1fr_120px_100px] gap-2 px-2 py-3 items-center border-b border-zinc-800/30 cursor-pointer hover:bg-zinc-900/40 transition text-sm"
                      >
                        <span className="text-white font-medium">{phase.label}</span>
                        <span className="text-zinc-500 text-xs">{phase.window}</span>
                        <span className={`text-right text-xs ${statusColor(phase.status)}`}>{phase.status}</span>
                      </div>

                      {isOpen && !isBlurred && (
                        <div className="px-2 py-4 border-b border-zinc-800/30 bg-zinc-900/20 space-y-3 text-sm">
                          <p className="text-zinc-400 leading-relaxed">{phase.description}</p>
                          <div>
                            <span className="text-[11px] text-zinc-500 uppercase tracking-wider">Actions</span>
                            <div className="mt-2 space-y-1.5">
                              {phase.actions.map((action, i) => (
                                <p key={i} className="text-zinc-400">
                                  <span className="text-cyan-400 mr-2">{'\u2192'}</span>{action}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ─── Signals Tab ─── */}
            {activeTab === 'signals' && (
              <div className="space-y-1">
                <div className="hidden sm:grid grid-cols-[1fr_60px_80px] gap-2 px-2 py-2 text-[11px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800/30">
                  <span>Signal</span>
                  <span className="text-center">Trend</span>
                  <span className="text-right">Relevance</span>
                </div>

                {data.market_signals.map((sig, idx) => {
                  const isBlurred = isLocked && idx >= 2;

                  return (
                    <div key={idx} className={isBlurred ? 'relative' : ''}>
                      {isBlurred && (
                        <div className="absolute inset-0 z-10 backdrop-blur-md bg-black/40 flex items-center justify-center">
                          <span className="text-xs text-zinc-500">
                            <Link to="/pricing?source=timing-map" className="text-cyan-400 hover:text-cyan-300">Upgrade</Link> to see all signals
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-[1fr_60px_80px] gap-2 px-2 py-3 items-start border-b border-zinc-800/30 text-sm">
                        <div>
                          <span className="text-white">{sig.signal}</span>
                          <p className="text-zinc-500 text-xs mt-0.5">{sig.impact}</p>
                        </div>
                        <span className={`text-center font-mono ${directionColor(sig.direction)}`}>{directionSymbol(sig.direction)}</span>
                        <span className={`text-right text-xs ${relevanceColor(sig.relevance)}`}>{sig.relevance}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ─── Readiness Tab ─── */}
            {activeTab === 'readiness' && (
              <div className="space-y-1">
                <div className="hidden sm:grid grid-cols-[1fr_100px_100px_80px] gap-2 px-2 py-2 text-[11px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800/30">
                  <span>Metric</span>
                  <span className="text-right">Current</span>
                  <span className="text-right">Target</span>
                  <span className="text-right">Status</span>
                </div>

                {data.readiness_metrics.map((metric, idx) => {
                  const isBlurred = isLocked && idx >= 3;

                  return (
                    <div key={idx} className={isBlurred ? 'relative' : ''}>
                      {isBlurred && (
                        <div className="absolute inset-0 z-10 backdrop-blur-md bg-black/40 flex items-center justify-center">
                          <span className="text-xs text-zinc-500">
                            <Link to="/pricing?source=timing-map" className="text-cyan-400 hover:text-cyan-300">Upgrade</Link> to see all metrics
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-[1fr_100px_100px_80px] gap-2 px-2 py-3 items-center border-b border-zinc-800/30 text-sm">
                        <span className="text-white">{metric.label}</span>
                        <span className="text-right font-mono text-zinc-300">{metric.current}{metric.unit === '%' || metric.unit === 'K' ? metric.unit : ''}</span>
                        <span className="text-right font-mono text-zinc-500">{metric.target}{metric.unit === '%' || metric.unit === 'K' ? metric.unit : ''}</span>
                        <span className={`text-right text-xs ${statusColor(metric.status)}`}>{metric.status.replace('-', ' ')}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* ─── Cadence Tab ─── */}
            {activeTab === 'cadence' && (
              <div className="space-y-1">
                <div className="hidden sm:grid grid-cols-[50px_120px_1fr_80px] gap-2 px-2 py-2 text-[11px] text-zinc-500 uppercase tracking-wider border-b border-zinc-800/30">
                  <span>Week</span>
                  <span>Focus</span>
                  <span>Milestone</span>
                  <span className="text-right">Status</span>
                </div>

                {data.weekly_cadence.map((item, idx) => {
                  const isBlurred = isLocked && idx >= 3;

                  return (
                    <div key={idx} className={isBlurred ? 'relative' : ''}>
                      {isBlurred && (
                        <div className="absolute inset-0 z-10 backdrop-blur-md bg-black/40 flex items-center justify-center">
                          <span className="text-xs text-zinc-500">
                            <Link to="/pricing?source=timing-map" className="text-cyan-400 hover:text-cyan-300">Upgrade</Link> to see full cadence
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-[50px_120px_1fr_80px] gap-2 px-2 py-3 items-center border-b border-zinc-800/30 text-sm">
                        <span className="text-zinc-500 font-mono">{item.week}</span>
                        <span className="text-white">{item.focus}</span>
                        <span className="text-zinc-400">{item.milestone}</span>
                        <span className={`text-right text-xs ${statusColor(item.status)}`}>{item.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <p className="text-xs text-zinc-600 mt-6 text-center">
              Timing analysis based on your stage, metrics, and current market conditions
            </p>
          </div>
        ) : null}
    </div>
  );
}
