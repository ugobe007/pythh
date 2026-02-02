/**
 * SIGNAL HELPERS
 * ==============
 * Utilities for signal strength, colors, formatting
 */

import { SignalStrength } from '../types/signals';

export function getSignalStrength(score: number): SignalStrength {
  if (score >= 80) {
    return {
      level: 'strong',
      score,
      emoji: '🔥',
      label: 'STRONG SIGNAL',
      color: 'text-green-400'
    };
  }
  if (score >= 60) {
    return {
      level: 'medium',
      score,
      emoji: '⚡',
      label: 'MEDIUM SIGNAL',
      color: 'text-blue-400'
    };
  }
  if (score >= 40) {
    return {
      level: 'emerging',
      score,
      emoji: '💡',
      label: 'EMERGING SIGNAL',
      color: 'text-yellow-400'
    };
  }
  return {
    level: 'watching',
    score,
    emoji: '👀',
    label: 'WATCHING',
    color: 'text-gray-400'
  };
}

export function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) {
    return `${diffMins} minutes ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  }
  return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(part => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}
