// ============================================================================
// FindInvestorSignals - Full Page Component for Signals/Market Tape
// ============================================================================
// Replaces match engine - URL input → investor signals
// 
// Contract rules (LOCKED):
//   1. URL is the ONLY input
//   2. State machine: idle → analyzing → live | not_found | error
//   3. System messages displayed per state
//   4. Signal stream uses InvestorSignalRowViewModel[]
// ============================================================================

import { useState, useCallback } from 'react';
import { ArrowRight, Globe, Loader2, AlertTriangle, Zap, Search } from 'lucide-react';
import type { InvestorSignalRowViewModel } from '@/lib/signals-view-model';
import { 
  SYSTEM_MESSAGES as SIGNALS_SYSTEM_MESSAGES,
  normalizeStartupUrl,
} from '@/lib/signals-view-model';

// -----------------------------------------------------------------------------
// PROPS
// -----------------------------------------------------------------------------

// Simple string state for component (hook handles complex state machine internally)
type PageStateSimple = 'idle' | 'analyzing' | 'live' | 'not_found' | 'error';

interface FindInvestorSignalsProps {
  onFindSignals: (url: string) => Promise<void>;
  pageState: PageStateSimple;
  signals: InvestorSignalRowViewModel[];
  error: string | null;
  className?: string;
}

// -----------------------------------------------------------------------------
// GLOW COLORS
// -----------------------------------------------------------------------------

const GLOW_COLORS = {
  cyan: 'rgba(34, 211, 238, 0.2)',
  cyanHover: 'rgba(34, 211, 238, 0.35)',
  cyanGreen: 'rgba(34, 211, 238, 0.15), rgba(34, 197, 94, 0.15)',
  cyanGreenHover: 'rgba(34, 211, 238, 0.25), rgba(34, 197, 94, 0.25)',
} as const;

// -----------------------------------------------------------------------------
// MAIN PAGE COMPONENT
// -----------------------------------------------------------------------------

export function FindInvestorSignals({
  onFindSignals,
  pageState,
  signals,
  error,
  className = '',
}: FindInvestorSignalsProps) {
  const [urlInput, setUrlInput] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

    const normalizedUrl = normalizeStartupUrl(urlInput);
    if (!normalizedUrl) {
      setUrlError('Please enter a valid URL (e.g., techcrunch.com/startup or startup.com)');
      return;
    }

    await onFindSignals(normalizedUrl);
  }, [urlInput, onFindSignals]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* URL Input Section */}
      <div className="flex-shrink-0 px-6 py-8 border-b border-zinc-800">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold text-white mb-2">
            Find Investor Signals
          </h1>
          <p className="text-sm text-zinc-400 mb-6">
            {SIGNALS_SYSTEM_MESSAGES.idle}
          </p>

          <form onSubmit={handleSubmit} className="flex gap-3">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Enter startup URL..."
                className="w-full h-11 pl-10 pr-4 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
                disabled={pageState === 'analyzing'}
              />
            </div>
            <button
              type="submit"
              disabled={pageState === 'analyzing' || !urlInput.trim()}
              className="h-11 px-6 bg-transparent border border-cyan-500 text-cyan-400 font-semibold rounded-lg hover:bg-cyan-500/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              {pageState === 'analyzing' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing…
                </>
              ) : (
                'Find Signals →'
              )}
            </button>
          </form>

          {urlError && (
            <p className="mt-2 text-sm text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {urlError}
            </p>
          )}
        </div>
      </div>

      {/* Results Section */}
      <div className="flex-1 overflow-auto">
        {pageState === 'idle' && (
          <IdleState />
        )}
        
        {pageState === 'analyzing' && (
          <AnalyzingState />
        )}
        
        {pageState === 'live' && signals.length > 0 && (
          <SignalStream signals={signals} />
        )}
        
        {pageState === 'not_found' && (
          <NotFoundState />
        )}
        
        {pageState === 'error' && (
          <ErrorState message={error} />
        )}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// State Components
// -----------------------------------------------------------------------------

function IdleState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-zinc-800 flex items-center justify-center">
          <Globe className="w-8 h-8 text-zinc-500" />
        </div>
        <h2 className="text-lg font-medium text-zinc-300 mb-2">
          Enter a Startup URL
        </h2>
        <p className="text-sm text-zinc-500">
          Paste any startup URL from TechCrunch, Product Hunt, their website, 
          or social profiles to discover relevant investor signals.
        </p>
      </div>
    </div>
  );
}

function AnalyzingState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-cyan-900/30 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
        <h2 className="text-lg font-medium text-cyan-300 mb-2">
          Analyzing Startup...
        </h2>
        <p className="text-sm text-zinc-500">
          {SIGNALS_SYSTEM_MESSAGES.analyzing}
        </p>
      </div>
    </div>
  );
}

function NotFoundState() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-900/30 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-lg font-medium text-amber-300 mb-2">
          Startup Not Found
        </h2>
        <p className="text-sm text-zinc-500">
          {SIGNALS_SYSTEM_MESSAGES.not_found}
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string | null }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center max-w-md px-6">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-900/30 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-lg font-medium text-red-300 mb-2">
          Something Went Wrong
        </h2>
        <p className="text-sm text-zinc-500">
          {message || SIGNALS_SYSTEM_MESSAGES.error}
        </p>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Signal Stream Component
// -----------------------------------------------------------------------------

interface SignalStreamProps {
  signals: InvestorSignalRowViewModel[];
}

function SignalStream({ signals }: SignalStreamProps) {
  return (
    <div className="py-4 px-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4 text-xs text-zinc-500">
        <Zap className="w-3 h-3 text-emerald-400" />
        <span className="uppercase tracking-wider font-medium">
          {SIGNALS_SYSTEM_MESSAGES.live}
        </span>
        <span className="text-zinc-600">•</span>
        <span>{signals.length} investors</span>
      </div>

      {/* Column Headers */}
      <div className="h-10 flex items-center gap-4 px-4 text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-2">
        <div className="flex-1">Investor</div>
        <div className="w-44 text-right">Context</div>
        <div className="w-16 text-center">Signal</div>
        <div className="w-16 text-center">Fit</div>
        <div className="w-20 text-right">Action</div>
      </div>

      {/* Signal Rows */}
      <div className="space-y-1.5">
        {signals.map((signal) => (
          <SignalRow key={signal.investorId} signal={signal} />
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Signal Row
// -----------------------------------------------------------------------------

interface SignalRowProps {
  signal: InvestorSignalRowViewModel;
}

function SignalRow({ signal }: SignalRowProps) {
  const glowBase = signal.glow.hover === 'cyan-green' 
    ? `0 0 16px 2px ${GLOW_COLORS.cyanGreen}`
    : 'none';
  
  const glowHover = signal.glow.hover === 'cyan-green'
    ? `0 0 20px 4px ${GLOW_COLORS.cyanGreenHover}`
    : `0 0 20px 4px ${GLOW_COLORS.cyanHover}`;

  const fitColorClass = signal.fit.tier >= 4 
    ? 'text-emerald-400' 
    : signal.fit.tier >= 3 
      ? 'text-gray-300' 
      : 'text-gray-500';

  const signalColorClass = signal.signal.value >= 6 
    ? 'text-cyan-400' 
    : signal.signal.value >= 3 
      ? 'text-gray-300' 
      : 'text-gray-500';

  return (
    <div
      className="relative h-14 w-full flex items-center gap-4 px-4 bg-zinc-900/50 rounded-none border-0 transition-all duration-150 ease-out cursor-pointer"
      style={{ boxShadow: glowBase }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = glowHover;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = glowBase;
      }}
    >
      {/* ENTITY: Investor name + firm */}
      <div className="flex-1 min-w-0">
        <div className="text-white font-medium text-sm truncate">
          {signal.entity.name}
        </div>
      </div>

      {/* CONTEXT: Why this investor */}
      <div className="w-44 text-right">
        <span className="text-xs text-zinc-400 truncate">{signal.context}</span>
      </div>

      {/* SIGNAL */}
      <div className="w-16 text-center">
        <span className={`font-mono text-sm ${signalColorClass}`}>
          {signal.signal.value.toFixed(1)}
        </span>
      </div>

      {/* FIT */}
      <div className="w-16 text-center">
        <span className={`font-mono text-sm ${fitColorClass}`}>
          {signal.fit.tier}
        </span>
      </div>

      {/* ACTION */}
      <div className="w-20 text-right">
        <button className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors">
          View
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Export subcomponents
// -----------------------------------------------------------------------------

export { SignalStream, SignalRow, IdleState, AnalyzingState, NotFoundState, ErrorState };
