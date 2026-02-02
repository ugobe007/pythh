/**
 * Rebuilt Matching Engine - Pure Renderer
 * 
 * Frontend states come ONLY from backend run.status:
 * - created/queued/processing → show pulse + real step label
 * - ready → render matches
 * - error → show error + retry button
 * - ready + matchCount=0 → show "No matches found"
 * 
 * No guessing. No local state machine. Just render what backend tells us.
 */

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface MatchRunStatus {
  runId: string;
  startupId: string;
  status: 'created' | 'queued' | 'processing' | 'ready' | 'error';
  progressStep?: string;
  matchCount: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  matches?: MatchResult[];
}

interface MatchResult {
  id: string;
  match_score: number;
  match_reasoning: string;
  investor_id: string;
  investors: {
    id: string;
    name: string;
    firm: string;
    logo_url?: string;
    sectors: string[];
    stage?: string;
    check_size_min?: number;
    check_size_max?: number;
  };
}

const STEP_LABELS: Record<string, string> = {
  resolve: 'Resolving startup...',
  extract: 'Extracting data...',
  parse: 'Parsing information...',
  match: 'Finding investors...',
  rank: 'Ranking matches...',
  finalize: 'Finalizing results...'
};

const POLL_INTERVAL = 2000; // Poll every 2 seconds while processing

export default function MatchingEngineV2() {
  const [url, setUrl] = useState('');
  const [currentRun, setCurrentRun] = useState<MatchRunStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Client-side run sequence to ignore stale responses
  const clientRunSeq = useRef(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  /**
   * Submit URL to start/get run (idempotent)
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      setError('Please enter a startup URL');
      return;
    }
    
    setError(null);
    setIsSubmitting(true);
    
    // Increment sequence to invalidate previous runs
    clientRunSeq.current += 1;
    const thisSeq = clientRunSeq.current;
    
    try {
      const response = await fetch('/api/match/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start match run');
      }
      
      const run: MatchRunStatus = await response.json();
      
      // Ignore if stale (user submitted again while this was in flight)
      if (thisSeq !== clientRunSeq.current) {
        console.log('[MatchEngine] Ignoring stale response');
        return;
      }
      
      setCurrentRun(run);
      setIsSubmitting(false);
      
      // Start polling if not ready/error
      if (run.status === 'queued' || run.status === 'processing') {
        startPolling(run.runId, thisSeq);
      }
      
    } catch (err) {
      if (thisSeq === clientRunSeq.current) {
        setError(err instanceof Error ? err.message : 'Failed to start matching');
        setIsSubmitting(false);
      }
    }
  };
  
  /**
   * Poll for run status updates
   */
  const startPolling = (runId: string, seq: number) => {
    // Clear existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    
    pollIntervalRef.current = setInterval(async () => {
      // Stop if stale
      if (seq !== clientRunSeq.current) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        return;
      }
      
      try {
        const response = await fetch(`/api/match/run/${runId}`);
        if (!response.ok) throw new Error('Failed to fetch run status');
        
        const run: MatchRunStatus = await response.json();
        
        // Ignore if stale
        if (seq !== clientRunSeq.current) {
          return;
        }
        
        setCurrentRun(run);
        
        // Stop polling if terminal state
        if (run.status === 'ready' || run.status === 'error') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        }
        
      } catch (err) {
        console.error('[MatchEngine] Poll error:', err);
      }
    }, POLL_INTERVAL);
  };
  
  /**
   * Retry after error
   */
  const handleRetry = () => {
    setCurrentRun(null);
    setError(null);
    // Submit automatically triggers new run
    handleSubmit({ preventDefault: () => {} } as React.FormEvent);
  };
  
  /**
   * Reset to start fresh
   */
  const handleReset = () => {
    clientRunSeq.current += 1; // Invalidate any in-flight requests
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }
    setCurrentRun(null);
    setError(null);
    setUrl('');
  };
  
  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);
  
  /**
   * Render based on BACKEND state only
   */
  const renderContent = () => {
    // No run yet - show input
    if (!currentRun && !isSubmitting) {
      return (
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl font-bold text-white mb-8">
            Find Your Perfect Investors
          </h1>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter startup URL (e.g., example.com)"
                className="w-full px-6 py-4 bg-black/50 border border-cyan-500/30 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-cyan-500"
              />
            </div>
            
            <button
              type="submit"
              disabled={!url.trim()}
              className="w-full px-8 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-full font-semibold hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Get Matches
            </button>
          </form>
          
          {error && (
            <div className="mt-4 px-6 py-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">
              {error}
            </div>
          )}
        </div>
      );
    }
    
    // Submitting initial request
    if (isSubmitting) {
      return (
        <div className="text-center">
          <PulseLoader message="Starting match run..." />
        </div>
      );
    }
    
    // Processing states (created/queued/processing)
    if (currentRun && (currentRun.status === 'created' || currentRun.status === 'queued' || currentRun.status === 'processing')) {
      const stepLabel = currentRun.progressStep 
        ? STEP_LABELS[currentRun.progressStep] || currentRun.progressStep
        : currentRun.status === 'queued' 
          ? 'Waiting in queue...'
          : 'Processing...';
      
      return (
        <div className="text-center">
          <PulseLoader message={stepLabel} />
          
          <DebugBanner run={currentRun} />
        </div>
      );
    }
    
    // Error state
    if (currentRun && currentRun.status === 'error') {
      return (
        <div className="max-w-2xl mx-auto text-center">
          <div className="px-8 py-6 bg-red-500/10 border border-red-500/30 rounded-xl">
            <h2 className="text-2xl font-bold text-red-400 mb-4">
              Matching Failed
            </h2>
            <p className="text-gray-300 mb-2">
              {currentRun.errorMessage || 'An error occurred during matching'}
            </p>
            {currentRun.errorCode && (
              <p className="text-sm text-gray-400 mb-6">
                Error code: {currentRun.errorCode}
              </p>
            )}
            <div className="flex gap-4 justify-center">
              <button
                onClick={handleRetry}
                className="px-6 py-3 bg-cyan-500 text-white rounded-full font-semibold hover:bg-cyan-600 transition-colors"
              >
                Retry
              </button>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-gray-700 text-white rounded-full font-semibold hover:bg-gray-600 transition-colors"
              >
                Start Over
              </button>
            </div>
          </div>
          
          <DebugBanner run={currentRun} />
        </div>
      );
    }
    
    // Ready state - show matches
    if (currentRun && currentRun.status === 'ready') {
      // CRITICAL: Only show "no matches" if backend says ready + 0
      if (currentRun.matchCount === 0 || !currentRun.matches || currentRun.matches.length === 0) {
        return (
          <div className="max-w-2xl mx-auto text-center">
            <div className="px-8 py-6 bg-gray-800/50 border border-gray-700 rounded-xl">
              <h2 className="text-2xl font-bold text-white mb-4">
                No Matches Found
              </h2>
              <p className="text-gray-400 mb-6">
                We couldn't find investors matching your startup's profile.
              </p>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-cyan-500 text-white rounded-full font-semibold hover:bg-cyan-600 transition-colors"
              >
                Try Another Startup
              </button>
            </div>
            
            <DebugBanner run={currentRun} />
          </div>
        );
      }
      
      // Show matches
      return (
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-bold text-white">
              {currentRun.matchCount} Investor Matches
            </h2>
            <button
              onClick={handleReset}
              className="px-6 py-3 bg-gray-700 text-white rounded-full font-semibold hover:bg-gray-600 transition-colors"
            >
              New Search
            </button>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {currentRun.matches.map((match) => (
              <MatchCard key={match.id} match={match} />
            ))}
          </div>
          
          <DebugBanner run={currentRun} />
        </div>
      );
    }
    
    return null;
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-black to-gray-900 py-12 px-4">
      {renderContent()}
    </div>
  );
}

/**
 * Pulse loader component
 */
function PulseLoader({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-6">
      <motion.div
        className="w-24 h-24 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.5, 1, 0.5]
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />
      <p className="text-xl text-white font-medium">{message}</p>
    </div>
  );
}

/**
 * Debug banner (dev mode only)
 */
function DebugBanner({ run }: { run: MatchRunStatus }) {
  const [expanded, setExpanded] = useState(false);
  
  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }
  
  return (
    <div className="mt-8 bg-black/80 border border-cyan-500/30 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-6 py-3 flex items-center justify-between text-left hover:bg-cyan-500/10 transition-colors"
      >
        <span className="text-cyan-400 font-mono font-bold">
          🔍 DEBUG STATE
        </span>
        <span className="text-gray-400">{expanded ? '▼' : '▶'}</span>
      </button>
      
      {expanded && (
        <div className="px-6 py-4 border-t border-cyan-500/30 font-mono text-xs text-left space-y-2">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-cyan-400">runId:</div>
              <div className="text-white break-all">{run.runId}</div>
            </div>
            <div>
              <div className="text-cyan-400">startupId:</div>
              <div className="text-white break-all">{run.startupId}</div>
            </div>
            <div>
              <div className="text-cyan-400">status:</div>
              <div className="text-white">{run.status}</div>
            </div>
            <div>
              <div className="text-cyan-400">progressStep:</div>
              <div className="text-white">{run.progressStep || 'none'}</div>
            </div>
            <div>
              <div className="text-cyan-400">matchCount:</div>
              <div className="text-white">{run.matchCount}</div>
            </div>
            <div>
              <div className="text-cyan-400">updatedAt:</div>
              <div className="text-white">{new Date(run.updatedAt).toLocaleTimeString()}</div>
            </div>
          </div>
          
          {run.errorCode && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded">
              <div className="text-red-400 font-bold">Error:</div>
              <div className="text-red-300">{run.errorCode}: {run.errorMessage}</div>
            </div>
          )}
          
          <div className="mt-4 pt-4 border-t border-cyan-500/20">
            <a
              href={`/api/match/run/${run.runId}/debug`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline"
            >
              View full debug info →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Match card component
 */
function MatchCard({ match }: { match: MatchResult }) {
  const investor = match.investors;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-cyan-500/50 transition-colors"
    >
      <div className="flex items-start gap-4 mb-4">
        {investor.logo_url ? (
          <img
            src={investor.logo_url}
            alt={investor.name}
            className="w-12 h-12 rounded-full object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-white font-bold">
            {investor.name.charAt(0)}
          </div>
        )}
        
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white">{investor.name}</h3>
          {investor.firm && (
            <p className="text-sm text-gray-400">{investor.firm}</p>
          )}
        </div>
        
        <div className="text-right">
          <div className="text-2xl font-bold text-cyan-400">
            {match.match_score}
          </div>
          <div className="text-xs text-gray-400">Score</div>
        </div>
      </div>
      
      {investor.sectors && investor.sectors.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {investor.sectors.slice(0, 3).map((sector, i) => (
            <span
              key={i}
              className="px-3 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-xs text-cyan-400"
            >
              {sector}
            </span>
          ))}
        </div>
      )}
      
      {match.match_reasoning && (
        <p className="text-sm text-gray-400 line-clamp-2">
          {match.match_reasoning}
        </p>
      )}
    </motion.div>
  );
}
