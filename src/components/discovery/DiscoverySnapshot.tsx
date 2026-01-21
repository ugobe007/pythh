/**
 * DISCOVERY SNAPSHOT - The Full Founder Experience v1.2
 * =====================================================
 * The complete post-URL submission experience that:
 * 1. Shows investor signal alignment status
 * 2. Displays signals investors respond to
 * 3. Shows what shifts alignment
 * 4. Lists matched investors with prep mode CTA
 * 5. Provides self-evaluation examples
 * 6. Optional alignment score (collapsed)
 * 7. Return loop hook for weekly updates
 * 8. [v1.1] Personal alignment timeline
 * 9. [v1.1] "What changed for you" panel
 * 10. [v1.2] Investor prep mode integration
 */

import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Bell, Check, Sparkles, Clock, Compass } from 'lucide-react';
import AlignmentTimeline from './AlignmentTimeline';
import WhatChangedPanel from './WhatChangedPanel';
import { InvestorPrepModeMini } from '../investor/InvestorPrepMode';

// Types
export type AlignmentStatus = 'ALIGNED' | 'FORMING' | 'LIMITED';

export interface SignalCard {
  name: string;
  observation: string;
}

export interface AlignmentDriver {
  name: string;
  status: 'strong' | 'forming' | 'early' | 'uneven' | 'present' | 'limited';
}

export interface InvestorMatch {
  id: string;
  name: string;
  focus: string;
  whyAligned: string;
}

export interface ExampleCard {
  startupType: string;
  whatChanged: string;
  result: string;
}

export interface DiscoveryData {
  status: AlignmentStatus;
  signals: SignalCard[];
  strengthens: string[];
  weakens: string[];
  investors: InvestorMatch[];
  examples: ExampleCard[];
  score?: number;
  drivers?: AlignmentDriver[];
}

// Status pill configuration
const STATUS_CONFIG = {
  ALIGNED: {
    label: 'Investor alignment: Active',
    description: 'Signals investors respond to are present and circulating.',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    textColor: 'text-amber-400',
    dotColor: 'bg-amber-400'
  },
  FORMING: {
    label: 'Investor alignment: Forming',
    description: 'Early investor-relevant signals detected. Attention builds unevenly at this stage.',
    bgColor: 'bg-slate-500/10',
    borderColor: 'border-slate-500/30',
    textColor: 'text-slate-300',
    dotColor: 'bg-slate-400'
  },
  LIMITED: {
    label: 'Investor alignment: Limited',
    description: 'Few investor-relevant signals detected yet.',
    bgColor: 'bg-slate-600/10',
    borderColor: 'border-slate-600/30',
    textColor: 'text-slate-400',
    dotColor: 'bg-slate-500'
  }
};

// Driver status display
const DRIVER_STATUS_COLORS = {
  strong: 'text-amber-400',
  forming: 'text-slate-300',
  early: 'text-slate-400',
  uneven: 'text-slate-400',
  present: 'text-slate-300',
  limited: 'text-slate-500'
};

interface DiscoverySnapshotProps {
  data: DiscoveryData;
  startupName?: string;
  startupId?: string;
  startupData?: Record<string, unknown>; // NEW v1.2: For prep mode
  onEnableUpdates?: () => void;
  isUpdatesEnabled?: boolean;
}

export default function DiscoverySnapshot({ 
  data, 
  startupName,
  startupId,
  startupData,
  onEnableUpdates,
  isUpdatesEnabled = false
}: DiscoverySnapshotProps) {
  const [showScore, setShowScore] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [expandedInvestorPrep, setExpandedInvestorPrep] = useState<string | null>(null);
  
  const statusConfig = STATUS_CONFIG[data.status];

  // Animate content in
  useEffect(() => {
    const timer = setTimeout(() => setAnimateIn(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={`space-y-12 transition-all duration-700 ${animateIn ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
      
      {/* ============================================ */}
      {/* STEP 1: DISCOVERY SNAPSHOT HEADER + STATUS */}
      {/* ============================================ */}
      <section className="text-center">
        {/* Header */}
        <p className="text-xs text-gray-500 uppercase tracking-[0.2em] mb-2">
          Your investor signal alignment
        </p>
        <p className="text-sm text-gray-500 mb-8">
          Based on how investors typically evaluate startups like yours.
        </p>

        {/* Primary Status Pill */}
        <div className="flex justify-center mb-4">
          <div className={`inline-flex items-center gap-3 px-8 py-4 rounded-full ${statusConfig.bgColor} border ${statusConfig.borderColor}`}>
            <span className={`w-2 h-2 rounded-full ${statusConfig.dotColor}`} />
            <span className={`text-lg font-medium ${statusConfig.textColor}`}>
              {statusConfig.label}
            </span>
          </div>
        </div>

        {/* Status description */}
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          {statusConfig.description}
        </p>
      </section>

      {/* ============================================ */}
      {/* STEP 2: SIGNALS INVESTORS ARE RESPONDING TO */}
      {/* ============================================ */}
      {data.signals.length > 0 && (
        <section>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-1">
              Signals investors are responding to
            </h2>
            <p className="text-sm text-gray-500">
              Observed across startups at your stage and category.
            </p>
          </div>

          <div className="grid gap-4">
            {data.signals.slice(0, 5).map((signal, i) => (
              <div 
                key={i}
                className="p-5 bg-[#111111] border border-gray-800 rounded-xl"
              >
                <p className="font-medium text-white mb-1">{signal.name}</p>
                <p className="text-sm text-gray-400">{signal.observation}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============================================ */}
      {/* STEP 3: WHAT SHIFTS INVESTOR ALIGNMENT */}
      {/* ============================================ */}
      <section>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-1">
            What shifts investor alignment
          </h2>
          <p className="text-sm text-gray-500">
            Based on patterns across similar startups.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Strengthens */}
          <div className="p-5 bg-[#111111] border border-gray-800 rounded-xl">
            <p className="text-sm font-medium text-amber-400/80 mb-4 uppercase tracking-wider">
              Strengthens alignment
            </p>
            <ul className="space-y-3">
              {data.strengthens.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <span className="text-amber-500/60 mt-1">+</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Weakens */}
          <div className="p-5 bg-[#111111] border border-gray-800 rounded-xl">
            <p className="text-sm font-medium text-slate-400 mb-4 uppercase tracking-wider">
              Weakens alignment
            </p>
            <ul className="space-y-3">
              {data.weakens.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                  <span className="text-slate-500/60 mt-1">−</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ============================================ */}
      {/* STEP 4: INVESTOR MATCHES WITH PREP MODE */}
      {/* ============================================ */}
      {data.investors.length > 0 && (
        <section>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-1">
              Investors currently aligned with your signals
            </h2>
            <p className="text-sm text-gray-500">
              Based on how these investors typically discover and evaluate startups like yours. Click to see how they decide, or expand to see your readiness.
            </p>
          </div>

          <div className="space-y-3">
            {data.investors.slice(0, 20).map((investor, i) => (
              <div key={investor.id || i} className="space-y-2">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/investor-lens/${investor.id}${startupId ? `?startup=${startupId}` : ''}`}
                    className="flex-1 flex items-center justify-between p-4 bg-[#111111] border border-gray-800 rounded-xl hover:border-amber-500/40 hover:bg-amber-500/5 transition-all group cursor-pointer"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xs text-gray-600 font-mono w-6 group-hover:text-amber-500/60 transition-colors">{i + 1}</span>
                      <div>
                        <p className="font-medium text-white group-hover:text-amber-100 transition-colors">{investor.name}</p>
                        <p className="text-sm text-gray-500">{investor.focus}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm text-gray-400 max-w-xs text-right">
                        {investor.whyAligned}
                      </p>
                      <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                    </div>
                  </Link>
                  
                  {/* Prep mode toggle button */}
                  <button
                    onClick={() => setExpandedInvestorPrep(
                      expandedInvestorPrep === investor.id ? null : investor.id
                    )}
                    className={`p-3 rounded-lg border transition-all ${
                      expandedInvestorPrep === investor.id
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:text-amber-400 hover:border-amber-500/30'
                    }`}
                    title="Check your readiness"
                  >
                    <Compass className="w-4 h-4" />
                  </button>
                </div>
                
                {/* Expanded prep mode mini */}
                {expandedInvestorPrep === investor.id && (
                  <div className="ml-10 animate-in slide-in-from-top-2 duration-200">
                    <InvestorPrepModeMini
                      investor={{
                        id: investor.id,
                        name: investor.name,
                        sectors: investor.focus?.split(',').map(s => s.trim())
                      }}
                      startupData={startupData}
                      onExpand={() => {
                        // Navigate to full investor lens with prep mode
                        window.location.href = `/investor-lens/${investor.id}${startupId ? `?startup=${startupId}&showPrep=true` : '?showPrep=true'}`;
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ============================================ */}
      {/* STEP 5: SELF-EVALUATION EXAMPLES */}
      {/* ============================================ */}
      {data.examples.length > 0 && (
        <section>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white mb-1">
              How founders at your stage improve investor alignment
            </h2>
            <p className="text-sm text-gray-500">
              Observed across startups that later raised successfully.
            </p>
          </div>

          <div className="grid gap-4">
            {data.examples.slice(0, 5).map((example, i) => (
              <div 
                key={i}
                className="p-5 bg-[#111111] border border-gray-800 rounded-xl"
              >
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                  {example.startupType}
                </p>
                <p className="text-sm text-gray-300 mb-2">
                  {example.whatChanged}
                </p>
                <p className="text-sm text-amber-400/80">
                  → {example.result}
                </p>
              </div>
            ))}
          </div>

          {/* Link to Gallery */}
          <div className="mt-6 flex justify-center">
            <Link
              to="/gallery"
              className="inline-flex items-center gap-2 px-6 py-3 text-sm font-medium text-gray-400 hover:text-amber-400 border border-gray-700 hover:border-amber-500/30 rounded-full transition-all"
            >
              <Sparkles className="w-4 h-4" />
              Explore more alignment patterns
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      )}

      {/* ============================================ */}
      {/* STEP 6: ALIGNMENT SCORE (COLLAPSED) */}
      {/* ============================================ */}
      {data.score !== undefined && (
        <section>
          <button
            onClick={() => setShowScore(!showScore)}
            className="w-full flex items-center justify-between p-4 bg-[#111111] border border-gray-800 rounded-xl hover:border-gray-700 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400">Signal alignment score</span>
              <span className="text-lg font-mono text-white">
                [ {data.score} / 100 ]
              </span>
            </div>
            {showScore ? (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronRight className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {showScore && data.drivers && (
            <div className="mt-2 p-5 bg-[#0a0a0a] border border-gray-800 rounded-xl">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-4">
                Alignment drivers
              </p>
              <p className="text-xs text-gray-500 mb-4">
                Reflects how closely your current signals match investor decision patterns at your stage.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {data.drivers.map((driver, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">{driver.name}</span>
                    <span className={`text-sm font-medium ${DRIVER_STATUS_COLORS[driver.status]}`}>
                      — {driver.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ============================================ */}
      {/* STEP 7: YOUR ALIGNMENT JOURNEY (NEW v1.1) */}
      {/* ============================================ */}
      <section>
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Clock className="w-5 h-5 text-violet-400" />
            Your alignment timeline
          </h2>
          <p className="text-sm text-gray-500">
            How your investor visibility has evolved.
          </p>
        </div>

        <div className="p-5 bg-[#111111] border border-gray-800 rounded-xl">
          <AlignmentTimeline 
            startupId={startupId}
            maxEvents={4}
          />
        </div>

        {/* What Changed Panel */}
        <div className="mt-6">
          <WhatChangedPanel
            startupId={startupId}
            currentState={{
              alignmentStatus: data.status === 'ALIGNED' ? 'Active' : data.status === 'FORMING' ? 'Forming' : 'Cold',
              godScore: data.score,
              signals: data.signals?.map(s => s.name) || [],
              investorCount: data.investors?.length || 0
            }}
          />
        </div>
      </section>

      {/* ============================================ */}
      {/* STEP 8: RETURN LOOP HOOK */}
      {/* ============================================ */}
      <section className="text-center pt-8 border-t border-gray-800">
        <p className="text-sm text-gray-500 mb-4">
          Investor alignment changes over time.<br />
          Pythh updates when it does.
        </p>
        
        {isUpdatesEnabled ? (
          <div className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400">
            <Check className="w-4 h-4" />
            <span className="text-sm font-medium">Weekly updates enabled</span>
          </div>
        ) : (
          <button
            onClick={onEnableUpdates}
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 hover:bg-amber-500/15 transition-colors"
          >
            <Bell className="w-4 h-4" />
            <span className="text-sm font-medium">Enable weekly updates</span>
          </button>
        )}
      </section>
    </div>
  );
}
