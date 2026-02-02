/**
 * UNIVERSAL TABLE CARD SYSTEM
 * 
 * The missing unifier - everything is a single-row rectangular table card.
 * 
 * Core Rules:
 * - Rectangular (sharp corners, no rounding)
 * - No visible border
 * - No background panel stacking
 * - Separation via spacing + glow only
 * - Looks like a table row, behaves like a card
 * 
 * Glow Palette (LOCKED):
 * - Cyan/Blue: Signal / movement / live
 * - Green: Readiness / fit / positive convergence
 * - Light Orange: Locked value / premium / gated
 */

import React from 'react';
import { cn } from '@/lib/utils';

// ============================================
// GLOW SYSTEM (ONLY DECORATION)
// ============================================

export type GlowIntent = 'signal' | 'good' | 'locked' | 'neutral';

const GLOW_COLORS: Record<GlowIntent, string> = {
  signal: 'rgba(34, 211, 238, 0.4)',   // Cyan - LIVE movement
  good: 'rgba(34, 197, 94, 0.35)',     // Green - high fit, ready
  locked: 'rgba(251, 146, 60, 0.4)',   // Light Orange - premium/gated
  neutral: 'transparent',
};

const GLOW_HOVER_COLORS: Record<GlowIntent, string> = {
  signal: 'rgba(34, 211, 238, 0.5)',
  good: 'rgba(34, 197, 94, 0.45)',
  locked: 'rgba(251, 146, 60, 0.5)',
  neutral: 'rgba(255, 255, 255, 0.05)',
};

// ============================================
// TABLE CARD ROW (BASE COMPONENT)
// ============================================

interface TableCardRowProps {
  children: React.ReactNode;
  glow?: GlowIntent;
  glowOnHover?: GlowIntent;
  pulse?: boolean;
  onClick?: () => void;
  className?: string;
  selected?: boolean;
  disabled?: boolean;
}

export function TableCardRow({
  children,
  glow = 'neutral',
  glowOnHover,
  pulse = false,
  onClick,
  className,
  selected = false,
  disabled = false,
}: TableCardRowProps) {
  const baseGlow = GLOW_COLORS[glow];
  const hoverGlow = GLOW_HOVER_COLORS[glowOnHover || glow];
  
  return (
    <div
      onClick={disabled ? undefined : onClick}
      className={cn(
        // Base geometry - rectangular, sharp corners, no border
        'relative h-16 w-full',
        'flex items-center gap-4 px-5',
        'bg-zinc-900/60',
        
        // No radius, no border
        'rounded-none border-0',
        
        // Transitions
        'transition-all duration-200 ease-out',
        
        // Interaction
        onClick && !disabled && 'cursor-pointer',
        disabled && 'opacity-50 cursor-not-allowed',
        
        // Selected state
        selected && 'bg-zinc-800/80',
        
        // Pulse animation for live items
        pulse && 'animate-pulse-subtle',
        
        className
      )}
      style={{
        boxShadow: glow !== 'neutral' 
          ? `0 0 20px 2px ${baseGlow}, inset 0 1px 0 rgba(255,255,255,0.03)`
          : 'inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
      onMouseEnter={(e) => {
        if (!disabled && hoverGlow) {
          e.currentTarget.style.boxShadow = `0 0 24px 4px ${hoverGlow}, inset 0 1px 0 rgba(255,255,255,0.05)`;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = glow !== 'neutral'
          ? `0 0 20px 2px ${baseGlow}, inset 0 1px 0 rgba(255,255,255,0.03)`
          : 'inset 0 1px 0 rgba(255,255,255,0.03)';
      }}
    >
      {children}
    </div>
  );
}

// ============================================
// COLUMN HEADER ROW (MINIMAL, UPPERCASE, SUBTLE)
// ============================================

interface ColumnHeaderRowProps {
  children: React.ReactNode;
  sticky?: boolean;
  className?: string;
}

export function ColumnHeaderRow({ children, sticky = false, className }: ColumnHeaderRowProps) {
  return (
    <div
      className={cn(
        'h-10 w-full',
        'flex items-center gap-4 px-5',
        'text-[10px] font-medium uppercase tracking-wider text-zinc-500',
        sticky && 'sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-sm',
        className
      )}
    >
      {children}
    </div>
  );
}

// ============================================
// CELL COMPONENTS
// ============================================

interface CellProps {
  children: React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export function Cell({ children, width, align = 'left', className }: CellProps) {
  return (
    <div
      className={cn(
        'flex items-center truncate',
        align === 'center' && 'justify-center',
        align === 'right' && 'justify-end',
        className
      )}
      style={{ width, minWidth: width, flex: width ? 'none' : '1' }}
    >
      {children}
    </div>
  );
}

// Entity Cell (name + optional context)
interface EntityCellProps {
  name: string;
  context?: string;
  icon?: React.ReactNode;
  locked?: boolean;
}

export function EntityCell({ name, context, icon, locked }: EntityCellProps) {
  return (
    <div className="flex items-center gap-3 min-w-0 flex-1">
      {icon && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className={cn(
          'font-semibold text-sm truncate',
          locked ? 'text-zinc-400' : 'text-zinc-100'
        )}>
          {name}
        </div>
        {context && (
          <div className="text-xs text-zinc-500 truncate">{context}</div>
        )}
      </div>
    </div>
  );
}

// Score Cell (Signal/GOD/YC++)
interface ScoreCellProps {
  value: number;
  type: 'signal' | 'god' | 'yc';
  showArrow?: boolean;
  delta?: number;
}

export function ScoreCell({ value, type, showArrow = false, delta }: ScoreCellProps) {
  // Signal: 0-10, GOD/YC++: 0-100
  const isSignal = type === 'signal';
  const displayValue = isSignal ? value.toFixed(1) : Math.round(value);
  
  // Color based on thresholds
  let colorClass = 'text-zinc-400';
  
  if (type === 'signal') {
    if (value >= 7.5) colorClass = 'text-emerald-400';
    else if (value >= 5.5) colorClass = 'text-zinc-300';
    else if (value >= 4.0) colorClass = 'text-amber-400';
    else colorClass = 'text-zinc-500';
  } else if (type === 'god') {
    if (value >= 85) colorClass = 'text-emerald-400';
    else if (value >= 70) colorClass = 'text-zinc-200';
    else if (value >= 55) colorClass = 'text-zinc-400';
    else colorClass = 'text-zinc-500';
  } else if (type === 'yc') {
    if (value >= 80) colorClass = 'text-emerald-400';
    else if (value >= 65) colorClass = 'text-zinc-300';
    else if (value >= 50) colorClass = 'text-zinc-400';
    else colorClass = 'text-zinc-500';
  }
  
  // Arrow direction
  const arrow = delta !== undefined ? (delta > 0 ? '▲' : delta < 0 ? '▼' : '–') : (showArrow ? '–' : null);
  const arrowColor = delta !== undefined && delta > 0 ? 'text-emerald-400' : delta !== undefined && delta < 0 ? 'text-red-400' : 'text-zinc-500';
  
  return (
    <div className="flex items-center gap-1 font-mono text-sm">
      <span className={colorClass}>{displayValue}</span>
      {arrow && <span className={cn('text-xs', arrowColor)}>{arrow}</span>}
    </div>
  );
}

// Delta Cell (Δ)
interface DeltaCellProps {
  value: number;
}

export function DeltaCell({ value }: DeltaCellProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  
  return (
    <span className={cn(
      'font-mono text-xs',
      isPositive && 'text-emerald-400',
      isNegative && 'text-red-400',
      !isPositive && !isNegative && 'text-zinc-500'
    )}>
      {isPositive ? '+' : ''}{value.toFixed(1)}
    </span>
  );
}

// Fit Bars (5 bars, no number)
interface FitBarsProps {
  level: number; // 1-5
  size?: 'sm' | 'md';
}

export function FitBars({ level, size = 'md' }: FitBarsProps) {
  const barHeight = size === 'sm' ? 'h-2' : 'h-2.5';
  const barWidth = size === 'sm' ? 'w-1' : 'w-1.5';
  const gap = size === 'sm' ? 'gap-0.5' : 'gap-1';
  
  return (
    <div className={cn('flex items-end', gap)}>
      {[1, 2, 3, 4, 5].map((bar) => (
        <div
          key={bar}
          className={cn(
            barWidth,
            barHeight,
            'rounded-sm transition-colors',
            bar <= level ? 'bg-zinc-300' : 'bg-zinc-700'
          )}
        />
      ))}
    </div>
  );
}

// Status Pill (LIVE/LOCKED/READY/HIGH/MID)
type StatusType = 'live' | 'locked' | 'ready' | 'high' | 'mid' | 'low';

interface StatusPillProps {
  status: StatusType;
}

const STATUS_CONFIG: Record<StatusType, { label: string; className: string }> = {
  live: { label: 'LIVE', className: 'text-cyan-400' },
  locked: { label: 'Locked', className: 'text-zinc-500' },
  ready: { label: 'Ready', className: 'text-emerald-400' },
  high: { label: 'HIGH', className: 'text-emerald-400' },
  mid: { label: 'MID', className: 'text-zinc-400' },
  low: { label: 'LOW', className: 'text-zinc-500' },
};

export function StatusPill({ status }: StatusPillProps) {
  const config = STATUS_CONFIG[status];
  
  return (
    <div className={cn(
      'flex items-center gap-1.5 text-xs font-medium',
      config.className
    )}>
      {status === 'live' && (
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
      )}
      {status === 'locked' && (
        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      )}
      {config.label}
    </div>
  );
}

// Action Button (Enter / View / Unlock)
type ActionType = 'enter' | 'view' | 'unlock';

interface ActionButtonProps {
  action: ActionType;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
}

const ACTION_CONFIG: Record<ActionType, { label: string; icon: string; className: string }> = {
  enter: { 
    label: 'Enter', 
    icon: '▶', 
    className: 'text-cyan-400 hover:text-cyan-300' 
  },
  view: { 
    label: 'View', 
    icon: '👁', 
    className: 'text-zinc-400 hover:text-zinc-300' 
  },
  unlock: { 
    label: 'Unlock', 
    icon: '🔓', 
    className: 'bg-amber-500 hover:bg-amber-400 text-zinc-900' 
  },
};

export function ActionButton({ action, onClick, disabled }: ActionButtonProps) {
  const config = ACTION_CONFIG[action];
  
  if (action === 'unlock') {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick?.(e);
        }}
        disabled={disabled}
        className={cn(
          'px-4 py-1.5 text-xs font-semibold rounded-sm',
          'transition-colors duration-150',
          'flex items-center gap-1.5',
          config.className,
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span>{config.icon}</span>
        <span>{config.label}</span>
      </button>
    );
  }
  
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
      disabled={disabled}
      className={cn(
        'text-xs font-medium',
        'transition-colors duration-150',
        'flex items-center gap-1',
        config.className,
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </button>
  );
}

// ============================================
// TIME CELL (for signal tape)
// ============================================

interface TimeCellProps {
  timestamp: Date | string;
}

export function TimeCell({ timestamp }: TimeCellProps) {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  let display: string;
  if (diffMins < 1) display = 'Just now';
  else if (diffMins < 60) display = `${diffMins}m ago`;
  else if (diffHours < 24) display = `${diffHours}h ago`;
  else if (diffDays === 1) display = 'Yesterday';
  else display = `${diffDays}d ago`;
  
  return (
    <span className="text-xs text-zinc-500 font-mono">{display}</span>
  );
}

// ============================================
// TABLE CARD CONTAINER
// ============================================

interface TableCardContainerProps {
  children: React.ReactNode;
  title?: string;
  liveCount?: number;
  className?: string;
}

export function TableCardContainer({ children, title, liveCount, className }: TableCardContainerProps) {
  return (
    <div className={cn('w-full', className)}>
      {(title || liveCount !== undefined) && (
        <div className="flex items-center justify-between mb-4 px-1">
          {title && (
            <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-400">
              {title}
            </h2>
          )}
          {liveCount !== undefined && (
            <div className="flex items-center gap-2 text-xs text-cyan-400">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span>{liveCount} active</span>
            </div>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {children}
      </div>
    </div>
  );
}

// ============================================
// CSS ANIMATION (add to global styles)
// ============================================

// Add this to your global CSS or tailwind config:
// @keyframes pulse-subtle {
//   0%, 100% { opacity: 1; }
//   50% { opacity: 0.92; }
// }
// .animate-pulse-subtle {
//   animation: pulse-subtle 2s ease-in-out infinite;
// }
