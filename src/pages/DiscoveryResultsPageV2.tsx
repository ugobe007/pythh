/**
 * DISCOVERY RESULTS PAGE V2 - Capital Navigation Architecture
 * ============================================================
 * "Capital Navigation Detection System"
 * 
 * Architecture:
 * - Orientation before information (Triad → Scan → Charts → Investors)
 * - Degraded mode with preview cards (never empty, always alive)
 * - Intent traces always render (even at zero)
 * - Debug mode for development
 */

import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import BrandMark from '../components/BrandMark';
import { NotificationBell } from '../components/notifications';
import DiscoveryPage from './DiscoveryPage';

// Capital Navigation Components
import { DegradedModeBanner } from '../components/capitalNav/DegradedModeBanner';
import { CapitalNavigationHeader } from '../components/capitalNav/CapitalNavigationHeader';
import { ScanPlaybackTimeline } from '../components/capitalNav/ScanPlaybackTimeline';
import { IntentTraceChart } from '../components/capitalNav/IntentTraceChart';
import { AlignmentBars } from '../components/capitalNav/AlignmentBars';
import { ConvergencePreviewArchetypes } from '../components/capitalNav/ConvergencePreviewArchetypes';
import { AhaRevealStrip } from '../components/capitalNav/AhaRevealStrip';
import { IntentVelocitySparkline } from '../components/capitalNav/IntentVelocitySparkline';
import { WhyModal } from '../components/capitalNav/WhyModal';
import { makeDegradedDemoPayload } from '../components/capitalNav/demoFallback';

// URL Safe Parsing Helpers
function normalizeUrlInput(input: string) {
  const raw = (input || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

function safeHostname(input: string) {
  try {
    const u = new URL(normalizeUrlInput(input));
    return u.hostname;
  } catch {
    return input.replace(/^https?:\/\//i, '').split('/')[0] || 'startup';
  }
}

// Legacy components (for when matches succeed)
import { InvestorSignalCard } from '../components/convergence/InvestorSignalCard';
import { HiddenCapitalLayer } from '../components/convergence/HiddenCapitalLayer';

// API & Types
import { fetchConvergenceData } from '../lib/convergenceAPI';
import type { ConvergenceResponse, EmptyConvergenceResponse } from '../types/convergence';
import type { DegradedStatus } from '../types/capitalNavigation';

type Tab = 'convergence' | 'signals';
type LoadingStage = 'resolving' | 'fetching' | 'rendering' | 'complete';

interface DebugInfo {
  startupId?: string;
  visibleCount: number;
  hiddenCount: number;
  queryTimeMs: number;
  failedStep?: string;
  error?: string;
}

export default function DiscoveryResultsPage() {
  const [searchParams] = useSearchParams();
  const url = searchParams.get('url') || '';
  const demoMode = searchParams.get('demo') === '1';
  const debugMode = searchParams.get('debug') === '1';
  
  const [activeTab, setActiveTab] = useState<Tab>('convergence');
  const [loadingStage, setLoadingStage] = useState<LoadingStage>('resolving');
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ConvergenceResponse | EmptyConvergenceResponse | null>(null);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({ visibleCount: 0, hiddenCount: 0, queryTimeMs: 0 });
  
  const [whyOpen, setWhyOpen] = useState(false);
  const [whyTitle, setWhyTitle] = useState("Why this badge?");
  const [whyBullets, setWhyBullets] = useState<string[]>([]);

  useEffect(() => {
    if (!url && !demoMode) {
      setError('No startup URL provided');
      setLoadingStage('complete');
      return;
    }

    async function loadData() {
      const startTime = Date.now();
      
      try {
        setLoadingStage('resolving');
        setLoadingStage('fetching');
        
        const convergence = await fetchConvergenceData(url, { demo: demoMode, debug: debugMode });
        
        setLoadingStage('rendering');
        setData(convergence);
        
        // Update debug info
        setDebugInfo({
          startupId: convergence.startup.id,
          visibleCount: convergence.visible_investors?.length || 0,
          hiddenCount: convergence.hidden_investors_total || 0,
          queryTimeMs: Date.now() - startTime,
          failedStep: convergence.visible_investors?.length === 0 ? 'match_query' : undefined
        });
        
        setLoadingStage('complete');
      } catch (err) {
        console.error('[DiscoveryResultsPage] Error:', err);
        setError(err instanceof Error ? err.message : 'Failed to load convergence data');
        setDebugInfo(prev => ({
          ...prev,
          error: err instanceof Error ? err.message : 'Unknown error',
          failedStep: 'api_call',
          queryTimeMs: Date.now() - startTime
        }));
        setLoadingStage('complete');
      }
    }

    loadData();
  }, [url, demoMode, debugMode]);

  // Loading state with stages
  if (loadingStage !== 'complete' || !data) {
    return <LoadingState stage={loadingStage} url={url} />;
  }

  // Error state
  if (error) {
    return <ErrorState error={error} debugInfo={debugInfo} debugMode={debugMode} />;
  }

  // Signals tab
  if (activeTab === 'signals') {
    return <DiscoveryPage />;
  }

  // Main convergence interface
  const isDegraded = !data.visible_investors || data.visible_investors.length === 0;
  
  // Use degraded fallback if matches failed
  const payload = isDegraded 
    ? makeDegradedDemoPayload(url) 
    : null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      
      {/* Header */}
      <DiscoveryHeader 
        url={data.startup.url} 
        startupName={data.startup.name}
        onRefresh={() => window.location.reload()}
      />

      {/* Tabs */}
      <ConvergenceTabs 
        activeTab={activeTab} 
        onTabChange={setActiveTab} 
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 py-8">
        
        {/* CINEMA FIRST: Aha Reveal Strip (always shows) */}
        {isDegraded && payload && (
          <AhaRevealStrip 
            triad={payload.triad}
            estimatedSignalsProcessed={124}
          />
        )}
        
        {/* ORIENTATION FIRST: Capital Navigation Triad */}
        {isDegraded && payload ? (
          <>
            {/* Degraded Mode: Show preview with orientation */}
            <DegradedModeBanner 
              status={payload.degraded} 
              onRetry={() => window.location.reload()}
            />
            
            <CapitalNavigationHeader 
              data={payload.triad}
              onWhy={(col) => {
                setWhyOpen(true);
                if (col === 'position') {
                  setWhyTitle('Position drivers');
                  setWhyBullets([
                    `Position score: ${(payload.triad.positionScore01 ?? 0).toFixed(2)}`,
                    `Alignment: ${(payload.triad.alignment01 ?? 0).toFixed(2)}`,
                    `Momentum inferred from flow score: ${(payload.triad.flowScore01 ?? 0).toFixed(2)}`,
                    `Observers (7d): ${payload.triad.observers7d ?? '—'}`,
                  ]);
                } else if (col === 'flow') {
                  setWhyTitle('Flow drivers');
                  setWhyBullets([
                    `Flow score: ${(payload.triad.flowScore01 ?? 0).toFixed(2)}`,
                    `Latest intent trace: ${payload.triad.latestIntentTraceHours ?? '—'}h`,
                    `Confidence: ${payload.triad.confidence.toUpperCase()}`,
                    `Active investors: ${payload.triad.activeInvestorsVisible ?? '—'} / ${payload.triad.activeInvestorsTotal ?? '—'}`,
                  ]);
                } else {
                  setWhyTitle('Trajectory drivers');
                  setWhyBullets([
                    `Direction: ${payload.triad.directionState}`,
                    `Trajectory score: ${(payload.triad.trajectoryScore01 ?? 0).toFixed(2)}`,
                    `Alignment: ${(payload.triad.alignment01 ?? 0).toFixed(2)}`,
                    `Rule: Strongly Incoming requires Confidence=HIGH`,
                  ]);
                }
              }}
            />
            
            <ScanPlaybackTimeline data={payload.scan} />
            
            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <IntentVelocitySparkline values={[0,1,0,2,1,0,1,2,1,0,0,1,2,3,2,1,0,1,1,2,2,1,0,1]} />
                <IntentTraceChart series={payload.traces} />
              </div>
              <AlignmentBars 
                metrics={payload.alignment} 
                alignment01={payload.triad.alignment01 ?? 0} 
                nextBestMove={payload.nextBestMove}
              />
            </div>
            
            <ConvergencePreviewArchetypes 
              cards={payload.archetypes} 
              totalHiddenCount={payload.hiddenCount}
              onUnlock={() => alert('Unlock feature coming soon!')}
            />
          </>
        ) : (
          <>
            {/* Success Mode: Show real investors + scan */}
            <ScanPlaybackTimeline data={{
              domainLabel: safeHostname(data.startup.url),
              steps: [
                { id: "normalize", title: "Normalize URL", detail: "Canonical domain", state: "done" },
                { id: "infer", title: "Infer Profile", detail: "Sector, stage, velocity", state: "done" },
                { id: "collect", title: "Collect Traces", detail: "Intent signals", state: "done" },
                { id: "resolve", title: "Resolve Identities", detail: "Match complete", state: "done" },
              ],
              summaryLines: [
                `Matched ${data.visible_investors?.length || 0} investors`,
                `Hidden pool: ${data.hidden_investors_total || 0} candidates`,
                `Query completed in ${debugInfo.queryTimeMs}ms`,
              ],
            }} />
            
            <div className="mt-4 space-y-8">
              {/* Detected Convergence - Real Investors */}
              <div>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold mb-2">Detected Investor Convergence</h2>
                  <p className="text-gray-400 text-sm">
                    Investors whose discovery behavior, portfolio patterns, and timing signals currently align with your startup.
                  </p>
                </div>
                <div className="space-y-4">
                  {data.visible_investors?.map((inv) => (
                    <InvestorSignalCard key={inv.investor_id} investor={inv} />
                  ))}
                </div>
              </div>
              
              {/* Hidden Capital Layer */}
              <HiddenCapitalLayer 
                preview={data.hidden_investors_preview || []}
                totalCount={data.hidden_investors_total || 0}
                onUnlock={() => alert('Unlock feature coming soon!')}
              />
            </div>
          </>
        )}
      </div>

      {/* Debug Panel (Dev Only) */}
      {debugMode && (
        <DebugPanel debugInfo={debugInfo} apiDebug={data.debug} />
      )}

      {/* Why Modal */}
      <WhyModal
        open={whyOpen}
        title={whyTitle}
        bullets={whyBullets}
        onClose={() => setWhyOpen(false)}
      />
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function DiscoveryHeader({ 
  url, 
  startupName, 
  onRefresh 
}: { 
  url: string; 
  startupName?: string;
  onRefresh: () => void;
}) {
  const domain = safeHostname(url);
  
  return (
    <div className="border-b border-white/10">
      <div className="max-w-7xl mx-auto px-8 py-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <BrandMark />
            <Link to="/" className="text-gray-400 hover:text-white transition flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              New scan
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={onRefresh}
              className="p-2 hover:bg-white/5 rounded transition"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 text-gray-400" />
            </button>
            <NotificationBell />
          </div>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">
            {startupName || 'Investor Signals Matching Your Startup'}
          </h1>
          <p className="text-gray-400">
            Real-time detection of investors algorithmically converging toward your company.
          </p>
          {domain && (
            <div className="mt-2">
              <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded">
                Scanning: {domain}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConvergenceTabs({ 
  activeTab, 
  onTabChange 
}: { 
  activeTab: Tab; 
  onTabChange: (tab: Tab) => void;
}) {
  return (
    <div className="border-b border-white/10">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex gap-6">
          <button
            onClick={() => onTabChange('convergence')}
            className={`pb-3 px-1 font-medium border-b-2 transition ${
              activeTab === 'convergence'
                ? 'text-white border-cyan-400'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Convergence
          </button>
          <button
            onClick={() => onTabChange('signals')}
            className={`pb-3 px-1 font-medium border-b-2 transition ${
              activeTab === 'signals'
                ? 'text-white border-cyan-400'
                : 'text-gray-400 border-transparent hover:text-white'
            }`}
          >
            Signals
          </button>
        </div>
      </div>
    </div>
  );
}

// DetectedConvergenceSection and PreviewModeCard removed - now inline in main render

function LoadingState({ stage, url }: { stage: LoadingStage; url: string }) {
  const stages = {
    resolving: { label: 'Resolving startup', progress: 33 },
    fetching: { label: 'Fetching convergence signals', progress: 66 },
    rendering: { label: 'Building convergence map', progress: 90 }
  };
  
  const current = stages[stage as keyof typeof stages] || stages.resolving;
  const domain = safeHostname(url);
  
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center max-w-md">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-400 mx-auto mb-6"></div>
        <h3 className="text-xl font-bold mb-2">{current.label}...</h3>
        <p className="text-gray-400 text-sm mb-6">Analyzing {domain}</p>
        
        {/* Progress bar */}
        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all duration-500"
            style={{ width: `${current.progress}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ 
  error, 
  debugInfo, 
  debugMode 
}: { 
  error: string; 
  debugInfo: DebugInfo;
  debugMode: boolean;
}) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/10 rounded-full mb-4">
          <AlertCircle className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Could Not Load Convergence Data</h2>
        <p className="text-red-400 mb-6">{error}</p>
        
        {debugMode && (
          <div className="text-left bg-white/5 border border-white/10 rounded p-4 mb-6">
            <h4 className="text-sm font-mono text-gray-400 mb-2">Debug Info:</h4>
            <pre className="text-xs text-gray-500">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
        
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
        >
          <ArrowLeft className="w-4 h-4" />
          Try another startup
        </Link>
      </div>
    </div>
  );
}

function DebugPanel({ 
  debugInfo, 
  apiDebug 
}: { 
  debugInfo: DebugInfo; 
  apiDebug?: ConvergenceResponse['debug'];
}) {
  return (
    <div className="fixed bottom-4 right-4 bg-black/90 border border-cyan-400/50 rounded-lg p-4 max-w-sm text-xs font-mono">
      <h4 className="text-cyan-400 font-bold mb-2">🐛 Debug Mode</h4>
      
      <div className="space-y-1 text-gray-300">
        <div>Startup ID: <span className="text-white">{debugInfo.startupId || 'N/A'}</span></div>
        <div>Visible: <span className="text-white">{debugInfo.visibleCount}</span></div>
        <div>Hidden: <span className="text-white">{debugInfo.hiddenCount}</span></div>
        <div>Query Time: <span className="text-white">{debugInfo.queryTimeMs}ms</span></div>
        
        {debugInfo.failedStep && (
          <div className="text-red-400">Failed: {debugInfo.failedStep}</div>
        )}
        
        {apiDebug && (
          <>
            <div className="border-t border-gray-700 my-2"></div>
            <div>API Version: <span className="text-white">{apiDebug.match_version}</span></div>
            <div>Sources: <span className="text-white">{apiDebug.data_sources.join(', ')}</span></div>
          </>
        )}
      </div>
    </div>
  );
}
