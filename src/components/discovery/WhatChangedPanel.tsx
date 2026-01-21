/**
 * WHAT CHANGED PANEL — Personalized Change Detection
 * ===================================================
 * Shows what changed for THIS founder's alignment recently.
 * 
 * This is the "mirror" that makes founders think:
 * "I should check Pythh again"
 * 
 * Visual language:
 * - 1-2 bullets max
 * - Always actionable framing
 * - Connects changes to investor implications
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  AlertCircle,
  ArrowRight,
  RefreshCw
} from 'lucide-react';

// ============================================
// TYPES
// ============================================
export interface AlignmentChange {
  id: string;
  type: 'signal' | 'investor' | 'alignment' | 'attention';
  direction: 'positive' | 'negative' | 'neutral';
  title: string;
  investorImplication?: string;
}

interface WhatChangedPanelProps {
  startupId?: string;
  startupUrl?: string;
  // Current alignment state (to derive changes)
  currentState?: {
    alignmentStatus?: string;
    godScore?: number;
    signals?: string[];
    investorCount?: number;
  };
  // Previous state (for comparison)
  previousState?: {
    alignmentStatus?: string;
    godScore?: number;
    signals?: string[];
    investorCount?: number;
  };
  // Or provide changes directly
  changes?: AlignmentChange[];
  maxChanges?: number;
}

// ============================================
// CHANGE DETECTION LOGIC
// ============================================
function detectChanges(
  current?: WhatChangedPanelProps['currentState'],
  previous?: WhatChangedPanelProps['previousState']
): AlignmentChange[] {
  if (!current) return [];
  
  const changes: AlignmentChange[] = [];
  
  // If no previous state, generate welcome changes
  if (!previous) {
    // Generate contextual "first scan" insights
    if (current.signals && current.signals.length > 0) {
      const topSignal = current.signals[0];
      changes.push({
        id: 'first-signal',
        type: 'signal',
        direction: 'positive',
        title: `${topSignal} signal detected`,
        investorImplication: 'This increases visibility to specialized investors'
      });
    }
    
    if (current.godScore && current.godScore > 50) {
      changes.push({
        id: 'good-score',
        type: 'alignment',
        direction: 'positive',
        title: 'Strong initial alignment profile',
        investorImplication: 'Your signals match active investor patterns'
      });
    }
    
    return changes.slice(0, 2);
  }
  
  // Detect GOD score changes
  if (current.godScore && previous.godScore) {
    const scoreDiff = current.godScore - previous.godScore;
    if (Math.abs(scoreDiff) >= 5) {
      changes.push({
        id: 'score-change',
        type: 'alignment',
        direction: scoreDiff > 0 ? 'positive' : 'negative',
        title: scoreDiff > 0 
          ? `Alignment strength improved by ${scoreDiff} points`
          : `Alignment strength decreased by ${Math.abs(scoreDiff)} points`,
        investorImplication: scoreDiff > 0
          ? 'You moved into view of more investors'
          : 'Some investor attention may have shifted'
      });
    }
  }
  
  // Detect status changes
  const statusOrder = ['Cold', 'Emerging', 'Forming', 'Active', 'Hot'];
  if (current.alignmentStatus && previous.alignmentStatus) {
    const currentIdx = statusOrder.indexOf(current.alignmentStatus);
    const previousIdx = statusOrder.indexOf(previous.alignmentStatus);
    if (currentIdx !== previousIdx && currentIdx !== -1 && previousIdx !== -1) {
      changes.push({
        id: 'status-change',
        type: 'alignment',
        direction: currentIdx > previousIdx ? 'positive' : 'negative',
        title: currentIdx > previousIdx
          ? `Alignment upgraded to ${current.alignmentStatus}`
          : `Alignment shifted to ${current.alignmentStatus}`,
        investorImplication: currentIdx > previousIdx
          ? 'Investors in your sector are paying more attention'
          : 'Consider strengthening your signal density'
      });
    }
  }
  
  // Detect new signals
  if (current.signals && previous.signals) {
    const newSignals = current.signals.filter(s => !previous.signals!.includes(s));
    if (newSignals.length > 0) {
      changes.push({
        id: 'new-signals',
        type: 'signal',
        direction: 'positive',
        title: `New signal: ${newSignals[0]}`,
        investorImplication: 'This opens new investor pathways'
      });
    }
    
    const lostSignals = previous.signals.filter(s => !current.signals!.includes(s));
    if (lostSignals.length > 0) {
      changes.push({
        id: 'lost-signals',
        type: 'signal',
        direction: 'negative',
        title: `Signal weakened: ${lostSignals[0]}`,
        investorImplication: 'Consider reinforcing this aspect of your profile'
      });
    }
  }
  
  // Detect investor attention changes
  if (current.investorCount !== undefined && previous.investorCount !== undefined) {
    const diff = current.investorCount - previous.investorCount;
    if (diff !== 0) {
      changes.push({
        id: 'investor-count',
        type: 'investor',
        direction: diff > 0 ? 'positive' : 'negative',
        title: diff > 0
          ? `${diff} new investor${diff > 1 ? 's' : ''} monitoring`
          : `${Math.abs(diff)} investor${Math.abs(diff) > 1 ? 's' : ''} stopped monitoring`,
        investorImplication: diff > 0
          ? 'Your profile is gaining traction'
          : 'Review what signals they were watching'
      });
    }
  }
  
  return changes.slice(0, 2); // Max 2 changes
}

// ============================================
// CHANGE ICONS
// ============================================
function getChangeIcon(change: AlignmentChange) {
  if (change.direction === 'positive') {
    switch (change.type) {
      case 'signal': return Sparkles;
      case 'investor': return Eye;
      case 'attention': return TrendingUp;
      default: return TrendingUp;
    }
  } else if (change.direction === 'negative') {
    return TrendingDown;
  }
  return AlertCircle;
}

// ============================================
// MAIN COMPONENT
// ============================================
export default function WhatChangedPanel({
  startupId,
  startupUrl,
  currentState,
  previousState,
  changes: propChanges,
  maxChanges = 2
}: WhatChangedPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  
  // Detect changes
  const changes = useMemo(() => {
    if (propChanges && propChanges.length > 0) {
      return propChanges.slice(0, maxChanges);
    }
    return detectChanges(currentState, previousState);
  }, [propChanges, currentState, previousState, maxChanges]);
  
  // No changes detected
  if (changes.length === 0 && !isLoading) {
    return null; // Don't show panel if nothing changed
  }
  
  // Loading state
  if (isLoading) {
    return (
      <div className="p-4 rounded-xl bg-gray-900/50 border border-gray-800 animate-pulse">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-gray-600 animate-spin" />
          <span className="text-sm text-gray-500">Detecting changes...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-violet-500/5 to-blue-500/5 border border-violet-500/20">
      {/* Header */}
      <h3 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-violet-400" />
        What changed your alignment recently
      </h3>
      
      {/* Changes list */}
      <div className="space-y-3">
        {changes.map((change) => {
          const Icon = getChangeIcon(change);
          const colorClass = change.direction === 'positive' 
            ? 'text-emerald-400' 
            : change.direction === 'negative' 
              ? 'text-red-400' 
              : 'text-gray-400';
          
          return (
            <div 
              key={change.id}
              className="flex items-start gap-3"
            >
              {/* Icon */}
              <div className={`mt-0.5 ${colorClass}`}>
                <Icon className="w-4 h-4" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Title */}
                <p className="text-sm text-gray-200">
                  {change.title}
                </p>
                
                {/* Investor implication */}
                {change.investorImplication && (
                  <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                    <ArrowRight className="w-3 h-3" />
                    {change.investorImplication}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
