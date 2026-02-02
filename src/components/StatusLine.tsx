/**
 * STATUS LINE - Shows match loading/resolving status under hero
 * 
 * Provides intentional, reassuring feedback during async operations.
 * Reduces drop-off by showing progress and time-based reassurance.
 */

import React from 'react';
import { MatchState } from '../hooks/useMatchState';

interface StatusLineProps {
  state: MatchState;
  matchCount?: number;
  className?: string;
}

export default function StatusLine({ state, matchCount = 0, className = '' }: StatusLineProps) {
  if (state === 'idle') return null;

  const getStatusContent = () => {
    switch (state) {
      case 'resolving':
        return {
          icon: '🔍',
          text: 'Resolving startup...',
          subtext: 'Looking up your company',
          color: 'text-cyan-400',
          bgColor: 'bg-cyan-500/10',
          borderColor: 'border-cyan-500/30',
        };

      case 'loading':
        return {
          icon: '⚡',
          text: 'Scanning signals...',
          subtext: 'This can take a moment the first time. We\'ll keep scanning.',
          color: 'text-amber-400',
          bgColor: 'bg-amber-500/10',
          borderColor: 'border-amber-500/30',
        };

      case 'ready':
        return {
          icon: '✨',
          text: `Found ${matchCount} investors aligned`,
          subtext: 'Showing your best matches',
          color: 'text-green-400',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
        };

      case 'empty':
        return {
          icon: '🔎',
          text: 'No matches found yet',
          subtext: 'Try checking back later or submit a different URL',
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/10',
          borderColor: 'border-yellow-500/30',
        };

      case 'error':
        return {
          icon: '⚠️',
          text: 'Unable to load matches',
          subtext: 'Please check your connection and try again',
          color: 'text-red-400',
          bgColor: 'bg-red-500/10',
          borderColor: 'border-red-500/30',
        };

      default:
        return null;
    }
  };

  const status = getStatusContent();
  if (!status) return null;

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`
          flex items-center gap-3 px-4 py-3 
          rounded-xl border ${status.borderColor} ${status.bgColor}
          backdrop-blur-sm
        `}
      >
        <span className="text-xl">{status.icon}</span>
        <div className="flex-1">
          <div className={`text-sm font-semibold ${status.color}`}>
            {status.text}
          </div>
          <div className="text-xs text-white/50 mt-0.5">
            {status.subtext}
          </div>
        </div>
        
        {/* Animated spinner for loading states */}
        {(state === 'resolving' || state === 'loading') && (
          <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
        )}
      </div>
    </div>
  );
}
