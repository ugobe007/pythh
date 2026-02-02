// ============================================================================
// StartupSelectTable - Pure Render Component for Startup Select
// ============================================================================
// Consumes StartupSelectRowViewModel[] - NO INLINE COMPUTATIONS
// 
// Contract rules (LOCKED):
//   1. All values pre-computed in view model
//   2. Row height is 64px
//   3. Glow-only decoration (no borders)
//   4. Click → Navigate to /app/radar?startup=<id>
// ============================================================================

import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import type { 
  StartupSelectRowViewModel, 
  SortKey 
} from '@/lib/startup-select-view-model';
import { STARTUP_SELECT_THRESHOLDS } from '@/lib/startup-select-view-model';

// -----------------------------------------------------------------------------
// PROPS
// -----------------------------------------------------------------------------

interface StartupSelectTableProps {
  rows: StartupSelectRowViewModel[];
  loading: boolean;
  sortKey: SortKey;
  sortDirection: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  className?: string;
}

// -----------------------------------------------------------------------------
// GLOW COLORS (LOCKED per spec)
// -----------------------------------------------------------------------------

const GLOW_COLORS = {
  cyan: 'rgba(34, 211, 238, 0.2)',
  cyanHover: 'rgba(34, 211, 238, 0.35)',
  cyanGreen: 'rgba(34, 211, 238, 0.15), rgba(34, 197, 94, 0.15)',
  cyanGreenHover: 'rgba(34, 211, 238, 0.25), rgba(34, 197, 94, 0.25)',
} as const;

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export function StartupSelectTable({
  rows,
  loading,
  sortKey,
  sortDirection,
  onSort,
  className = '',
}: StartupSelectTableProps) {
  const navigate = useNavigate();

  const handleEnter = (startupId: string) => {
    navigate(`/app/radar?startup=${startupId}`);
  };

  if (loading && rows.length === 0) {
    return (
      <div className={`flex items-center justify-center py-20 ${className}`}>
        <div className="flex flex-col items-center gap-4 text-gray-400">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span>Loading startups...</span>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className={`flex items-center justify-center py-20 ${className}`}>
        <div className="text-center text-gray-400">
          <p className="text-lg font-medium">No startups found</p>
          <p className="text-sm mt-1">Check your filters or try again later</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Column Headers */}
      <div className="h-10 flex items-center gap-4 px-5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        <div className="flex-1">Entity</div>
        <SortHeader label="Signal" field="signal" current={sortKey} direction={sortDirection} onSort={onSort} width="w-20" />
        <SortHeader label="GOD" field="god" current={sortKey} direction={sortDirection} onSort={onSort} width="w-16" />
        <SortHeader label="YC++" field="ycPlusPlus" current={sortKey} direction={sortDirection} onSort={onSort} width="w-16" />
        <SortHeader label="Δ" field="delta" current={sortKey} direction={sortDirection} onSort={onSort} width="w-12" />
        <SortHeader label="Ready" field="readiness" current={sortKey} direction={sortDirection} onSort={onSort} width="w-24" />
        <SortHeader label="Matches" field="matches" current={sortKey} direction={sortDirection} onSort={onSort} width="w-20" />
        <div className="w-20 text-right">Action</div>
      </div>

      {/* Rows */}
      {rows.map((row) => (
        <StartupSelectRow
          key={row.startupId}
          row={row}
          onEnter={handleEnter}
        />
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// Sort Header
// -----------------------------------------------------------------------------

interface SortHeaderProps {
  label: string;
  field: SortKey;
  current: SortKey;
  direction: 'asc' | 'desc';
  onSort: (key: SortKey) => void;
  width: string;
}

function SortHeader({ label, field, current, direction, onSort, width }: SortHeaderProps) {
  const isActive = current === field;
  
  return (
    <button
      className={`${width} text-center flex items-center justify-center gap-1 hover:text-zinc-300 transition-colors ${isActive ? 'text-zinc-300' : ''}`}
      onClick={() => onSort(field)}
    >
      {label}
      {isActive && (
        <span className="text-[8px]">{direction === 'desc' ? '▼' : '▲'}</span>
      )}
    </button>
  );
}

// -----------------------------------------------------------------------------
// Row Component
// -----------------------------------------------------------------------------

interface StartupSelectRowProps {
  row: StartupSelectRowViewModel;
  onEnter: (startupId: string) => void;
}

function StartupSelectRow({ row, onEnter }: StartupSelectRowProps) {
  const glowBase = row.glow.hover === 'cyan-green' 
    ? `0 0 20px 2px ${GLOW_COLORS.cyanGreen}`
    : 'none';
  
  const glowHover = row.glow.hover === 'cyan-green'
    ? `0 0 24px 4px ${GLOW_COLORS.cyanGreenHover}`
    : `0 0 24px 4px ${GLOW_COLORS.cyanHover}`;

  return (
    <div
      className="relative h-16 w-full flex items-center gap-4 px-5 bg-zinc-900/60 rounded-none border-0 transition-all duration-200 ease-out cursor-pointer"
      style={{ boxShadow: glowBase }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = glowHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = glowBase;
      }}
      onClick={() => onEnter(row.startupId)}
    >
      {/* ENTITY: name + context */}
      <div className="flex-1 min-w-0">
        <div className="text-white font-medium text-sm truncate">{row.entity.name}</div>
        {row.entity.context && (
          <div className="text-xs text-zinc-500 truncate">{row.entity.context}</div>
        )}
      </div>

      {/* SIGNAL */}
      <div className="w-20 text-center">
        <SignalCell value={row.signal.value} direction={row.signal.direction} />
      </div>

      {/* GOD */}
      <div className="w-16 text-center">
        <GODCell value={row.god} />
      </div>

      {/* YC++ */}
      <div className="w-16 text-center">
        <YCPlusCell value={row.ycPlusPlus} />
      </div>

      {/* Δ */}
      <div className="w-12 text-center">
        <DeltaCell value={row.delta} />
      </div>

      {/* READINESS */}
      <div className="w-24 text-center">
        <ReadinessCell tier={row.readiness.tier} label={row.readiness.label} />
      </div>

      {/* MATCHES */}
      <div className="w-20 text-center">
        <span className="font-mono text-sm text-zinc-300">{row.matchCount}</span>
      </div>

      {/* ACTION */}
      <div className="w-20 text-right">
        <button
          className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onEnter(row.startupId);
          }}
        >
          Enter
          <ArrowUpRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Cell Components
// -----------------------------------------------------------------------------

function SignalCell({ value, direction }: { value: number; direction: 'up' | 'down' | 'flat' }) {
  const colorClass = value >= STARTUP_SELECT_THRESHOLDS.SIGNAL_HIGH
    ? 'text-cyan-400'
    : value >= STARTUP_SELECT_THRESHOLDS.SIGNAL_ACTIVE
      ? 'text-gray-300'
      : 'text-gray-500';
  
  const arrow = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '';
  const arrowClass = direction === 'up' ? 'text-emerald-400' : direction === 'down' ? 'text-red-400' : '';
  
  return (
    <span className="font-mono text-sm">
      <span className={colorClass}>{value.toFixed(1)}</span>
      {arrow && <span className={`ml-1 text-xs ${arrowClass}`}>{arrow}</span>}
    </span>
  );
}

function GODCell({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="font-mono text-sm text-zinc-600">—</span>;
  }
  
  const colorClass = value >= STARTUP_SELECT_THRESHOLDS.GOD_EXCELLENT
    ? 'text-emerald-400'
    : value >= STARTUP_SELECT_THRESHOLDS.GOD_GOOD
      ? 'text-gray-300'
      : 'text-gray-500';
  
  return <span className={`font-mono text-sm ${colorClass}`}>{value}</span>;
}

function YCPlusCell({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="font-mono text-sm text-zinc-600">—</span>;
  }
  
  const colorClass = value >= STARTUP_SELECT_THRESHOLDS.YC_EXCELLENT
    ? 'text-emerald-400'
    : value >= STARTUP_SELECT_THRESHOLDS.YC_GOOD
      ? 'text-gray-300'
      : 'text-gray-500';
  
  return <span className={`font-mono text-sm ${colorClass}`}>{value}</span>;
}

function DeltaCell({ value }: { value: number | null }) {
  if (value == null) {
    return <span className="font-mono text-sm text-zinc-600">—</span>;
  }
  
  const colorClass = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-gray-500';
  const prefix = value > 0 ? '+' : '';
  
  return <span className={`font-mono text-sm ${colorClass}`}>{prefix}{value.toFixed(1)}</span>;
}

function ReadinessCell({ tier, label }: { tier: number; label: string }) {
  const colorClass = tier >= 4 ? 'text-emerald-400' : tier >= 3 ? 'text-gray-300' : 'text-gray-500';
  
  return (
    <div className="flex flex-col items-center">
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div 
            key={i}
            className={`w-1.5 h-3 rounded-sm ${i < tier ? (tier >= 4 ? 'bg-emerald-400' : 'bg-gray-400') : 'bg-gray-700'}`}
          />
        ))}
      </div>
      <span className={`text-[9px] mt-0.5 ${colorClass}`}>{label}</span>
    </div>
  );
}
