/**
 * Investor Prep Mode Component
 * 
 * Decision preparation intelligence, not advice.
 * "Pythh doesn't introduce founders. It shows you how to enter the flow correctly."
 * 
 * Answers:
 * 1. Am I ready for this investor?
 * 2. What am I missing?
 * 3. When should I reach out?
 * 4. How do people like me actually enter?
 */

import React, { useState, useEffect } from 'react';
import {
  assessFounderReadiness,
  getProfileByArchetype,
  inferInvestorArchetype,
  type ReadinessAssessment
} from '../../services/readinessService';
import type { InvestorPrepProfile, EntryPathPattern } from '../../lib/database.types';

// =============================================================================
// TYPES
// =============================================================================

interface InvestorPrepModeProps {
  investor: {
    id: string;
    name: string;
    sectors?: string[];
    stage?: string;
    thesis?: string;
    description?: string;
    // Could have a prep profile attached
    prep_profile?: InvestorPrepProfile;
  };
  startupData?: Record<string, unknown>;
  onClose?: () => void;
  className?: string;
}

// =============================================================================
// STYLING
// =============================================================================

const TIMING_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  'optimal': { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/30' },
  'early': { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  'too_early': { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
  'late': { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30' },
  'missed': { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30' },
  'unknown': { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30' }
};

const TIMING_LABELS: Record<string, string> = {
  'optimal': 'Optimal timing',
  'early': 'Slightly early',
  'too_early': 'Too early',
  'late': 'Running late',
  'missed': 'Window closed',
  'unknown': 'Unknown'
};

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

/**
 * Section 1: Current Readiness
 */
function ReadinessSection({ assessment }: { assessment: ReadinessAssessment }) {
  const { matchedSignals, missingSignals, signalCoverageRatio } = assessment;
  const totalSignals = matchedSignals.length + missingSignals.length;
  const coveragePercent = Math.round(signalCoverageRatio * 100);
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
          Your Current Readiness
        </h3>
        <div className="text-right">
          <span className="text-2xl font-bold text-white">{matchedSignals.length}</span>
          <span className="text-gray-500"> / {totalSignals}</span>
          <span className="text-xs text-gray-500 ml-2">signals matched</span>
        </div>
      </div>
      
      {/* Progress bar */}
      <div className="relative h-2 bg-gray-700 rounded-full overflow-hidden">
        <div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
          style={{ width: `${coveragePercent}%` }}
        />
      </div>
      
      {/* Strong signals */}
      {matchedSignals.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Strong signals</p>
          <div className="flex flex-wrap gap-2">
            {matchedSignals.map((signal, i) => (
              <span 
                key={i}
                className="px-2 py-1 text-xs bg-green-500/10 text-green-400 border border-green-500/30 rounded"
              >
                ✓ {signal}
              </span>
            ))}
          </div>
        </div>
      )}
      
      {/* Missing signals */}
      {missingSignals.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 mb-2">Missing signals</p>
          <div className="flex flex-wrap gap-2">
            {missingSignals.map((signal, i) => (
              <span 
                key={i}
                className="px-2 py-1 text-xs bg-gray-700/50 text-gray-400 border border-gray-600 rounded"
              >
                ○ {signal}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Section 2: What Moves This Investor
 */
function EngagementTriggersSection({ profile }: { profile: InvestorPrepProfile }) {
  const triggers = profile.engagement_triggers;
  
  if (triggers.length === 0) return null;
  
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
        What Moves This Investor
      </h3>
      <p className="text-xs text-gray-500">
        What usually moves them from monitoring to engagement
      </p>
      <ul className="space-y-2">
        {triggers.map((trigger, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
            <span className="text-amber-400 mt-0.5">→</span>
            {trigger}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Section 3: Timing Guidance
 */
function TimingSection({ assessment }: { assessment: ReadinessAssessment }) {
  const { timing, investorProfile } = assessment;
  const colors = TIMING_COLORS[timing.state];
  const label = TIMING_LABELS[timing.state];
  
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
        Timing Guidance
      </h3>
      
      <div className={`p-4 rounded-lg border ${colors.bg} ${colors.border}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-lg font-semibold ${colors.text}`}>{label}</span>
          {investorProfile.timing_sensitivity !== 'low' && (
            <span className="text-xs text-gray-500">
              (investor is {investorProfile.timing_sensitivity} timing-sensitive)
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 mb-2">{timing.reason}</p>
        <p className="text-sm text-gray-300">{timing.suggestion}</p>
      </div>
      
      {investorProfile.typical_timing_triggers.length > 0 && (
        <div className="text-xs text-gray-500">
          <span className="font-medium">Typical timing triggers: </span>
          {investorProfile.typical_timing_triggers.join(', ')}
        </div>
      )}
    </div>
  );
}

/**
 * Section 4: Entry Paths
 */
function EntryPathsSection({ paths }: { paths: EntryPathPattern[] }) {
  if (paths.length === 0) return null;
  
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
        Entry Paths That Work
      </h3>
      <p className="text-xs text-gray-500">
        How founders usually enter their flow
      </p>
      
      <ol className="space-y-3">
        {paths.slice(0, 4).map((path, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold shrink-0">
              {i + 1}
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-200">{path.path_type}</span>
                {path.success_rate > 0 && (
                  <span className="text-xs text-gray-500">
                    ({Math.round(path.success_rate * 100)}% success rate)
                  </span>
                )}
              </div>
              {path.path_description && (
                <p className="text-xs text-gray-500 mt-0.5">{path.path_description}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Section 5: What To Do Next
 */
function NextStepsSection({ steps }: { steps: string[] }) {
  if (steps.length === 0) return null;
  
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-300 uppercase tracking-wider">
        What To Do Next
      </h3>
      <p className="text-xs text-gray-500">
        What founders typically do to improve their position
      </p>
      
      <ul className="space-y-2">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-amber-400 mt-0.5">•</span>
            <span className="text-sm text-gray-300">{step}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Readiness Score Badge
 */
function ReadinessScoreBadge({ score }: { score: number }) {
  let color = 'text-red-400';
  let label = 'Not ready';
  
  if (score >= 80) {
    color = 'text-green-400';
    label = 'Ready';
  } else if (score >= 60) {
    color = 'text-yellow-400';
    label = 'Getting ready';
  } else if (score >= 40) {
    color = 'text-orange-400';
    label = 'Building';
  }
  
  return (
    <div className="text-center">
      <div className={`text-4xl font-bold ${color}`}>{score}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export function InvestorPrepMode({ 
  investor, 
  startupData,
  onClose,
  className = ''
}: InvestorPrepModeProps) {
  const [assessment, setAssessment] = useState<ReadinessAssessment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  useEffect(() => {
    // Get or infer investor profile
    let profile: InvestorPrepProfile;
    
    if (investor.prep_profile) {
      profile = investor.prep_profile;
    } else {
      // Infer archetype and use default profile
      const archetype = inferInvestorArchetype(investor);
      profile = {
        ...getProfileByArchetype(archetype),
        investor_id: investor.id
      };
    }
    
    // Convert entry paths from profile to EntryPathPattern format
    const entryPaths: EntryPathPattern[] = profile.entry_paths_ranked.map((p, i) => ({
      path_type: p.path,
      path_description: p.description,
      success_rate: p.effectiveness,
      rank_order: i + 1
    }));
    
    // Perform assessment
    const result = assessFounderReadiness(
      startupData || {},
      profile,
      entryPaths
    );
    
    setAssessment(result);
    setIsLoading(false);
  }, [investor, startupData]);
  
  if (isLoading || !assessment) {
    return (
      <div className={`bg-gray-800/50 rounded-xl p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-700 rounded w-1/3"></div>
          <div className="h-24 bg-gray-700 rounded"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-700/50 bg-gray-800/80">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              How to Enter {investor.name}'s Flow
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Decision preparation intelligence • Not advice
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ReadinessScoreBadge score={assessment.readinessScore} />
            {onClose && (
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-6 space-y-8">
        {/* Section 1: Readiness */}
        <ReadinessSection assessment={assessment} />
        
        {/* Divider */}
        <div className="border-t border-gray-700/50" />
        
        {/* Section 2: What Moves This Investor */}
        <EngagementTriggersSection profile={assessment.investorProfile} />
        
        {/* Divider */}
        <div className="border-t border-gray-700/50" />
        
        {/* Section 3: Timing */}
        <TimingSection assessment={assessment} />
        
        {/* Divider */}
        <div className="border-t border-gray-700/50" />
        
        {/* Section 4: Entry Paths */}
        <EntryPathsSection paths={assessment.entryPaths} />
        
        {/* Divider */}
        <div className="border-t border-gray-700/50" />
        
        {/* Section 5: Next Steps */}
        <NextStepsSection steps={assessment.recommendedNextSteps} />
      </div>
      
      {/* Footer - THE CRITICAL MESSAGE */}
      <div className="px-6 py-4 border-t border-gray-700/50 bg-gray-900/50">
        <p className="text-center text-xs text-gray-500 italic">
          Pythh doesn't introduce founders.
          <br />
          <span className="text-gray-400">It shows you how to enter the flow correctly.</span>
        </p>
      </div>
      
      {/* Confidence indicator */}
      <div className="px-6 pb-4 bg-gray-900/50">
        <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
          <span>Profile confidence:</span>
          <span className={
            assessment.investorProfile.confidence_level === 'observed' ? 'text-green-500' :
            assessment.investorProfile.confidence_level === 'inferred' ? 'text-yellow-500' :
            'text-gray-500'
          }>
            {assessment.investorProfile.confidence_level}
          </span>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// COMPACT VARIANT (for embedding in other components)
// =============================================================================

export function InvestorPrepModeMini({ 
  investor, 
  startupData,
  onExpand
}: {
  investor: InvestorPrepModeProps['investor'];
  startupData?: Record<string, unknown>;
  onExpand?: () => void;
}) {
  const [assessment, setAssessment] = useState<ReadinessAssessment | null>(null);
  
  useEffect(() => {
    const archetype = inferInvestorArchetype(investor);
    const profile = investor.prep_profile || {
      ...getProfileByArchetype(archetype),
      investor_id: investor.id
    };
    
    const entryPaths: EntryPathPattern[] = profile.entry_paths_ranked.map((p, i) => ({
      path_type: p.path,
      path_description: p.description,
      success_rate: p.effectiveness,
      rank_order: i + 1
    }));
    
    setAssessment(assessFounderReadiness(startupData || {}, profile, entryPaths));
  }, [investor, startupData]);
  
  if (!assessment) return null;
  
  const timingColors = TIMING_COLORS[assessment.timing.state];
  
  return (
    <button
      onClick={onExpand}
      className="w-full p-3 bg-gray-800/30 hover:bg-gray-800/50 border border-gray-700/50 hover:border-amber-500/30 rounded-lg transition-all group text-left"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-500">Your readiness</span>
        <span className="text-sm font-bold text-amber-400">{assessment.readinessScore}/100</span>
      </div>
      
      <div className="flex items-center gap-2 mb-2">
        <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full"
            style={{ width: `${Math.round(assessment.signalCoverageRatio * 100)}%` }}
          />
        </div>
        <span className="text-xs text-gray-500">
          {assessment.matchedSignals.length}/{assessment.matchedSignals.length + assessment.missingSignals.length}
        </span>
      </div>
      
      <div className={`text-xs ${timingColors.text}`}>
        {TIMING_LABELS[assessment.timing.state]}
      </div>
      
      <div className="mt-2 text-xs text-gray-500 group-hover:text-amber-400 transition-colors">
        See how to enter their flow →
      </div>
    </button>
  );
}

export default InvestorPrepMode;
