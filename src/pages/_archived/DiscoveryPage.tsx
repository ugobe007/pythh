/**
 * DISCOVERY PAGE - Founder Experience v1.1
 * ========================================
 * The complete post-URL submission experience.
 * 
 * Flow:
 * 1. Loading: "Reading investor signals…"
 * 2. Discovery Snapshot with all sections
 * 3. [v1.1] Notification bell for drift updates
 */

import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { resolveStartupFromUrl } from '../lib/startupResolver';
import { useAuth } from '../contexts/AuthContext';
import BrandMark from '../components/BrandMark';
import { NotificationBell, NotificationDrawer } from '../components/notifications';
import { 
  DiscoverySnapshot, 
  ReadingSignalsLoader, 
  generateDiscoveryData,
  type DiscoveryData,
  type StartupAnalysis
} from '../components/discovery';

export default function DiscoveryPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const url = searchParams.get('url') || '';
  
  // States
  const [isLoading, setIsLoading] = useState(true);
  const [loadingComplete, setLoadingComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startupName, setStartupName] = useState<string>('');
  const [startupId, setStartupId] = useState<string | undefined>(undefined);
  const [discoveryData, setDiscoveryData] = useState<DiscoveryData | null>(null);
  const [updatesEnabled, setUpdatesEnabled] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);

  // Fetch and process startup data
  useEffect(() => {
    if (!url) {
      setError('No startup URL provided');
      setIsLoading(false);
      return;
    }

    async function fetchData() {
      try {
        // Resolve startup from URL
        const result = await resolveStartupFromUrl(url);
        
        if (!result || !result.startup) {
          setError('Could not find startup information');
          setIsLoading(false);
          return;
        }

        const startup = result.startup;
        setStartupName(startup.name || 'Your Startup');
        if (startup.id) {
          setStartupId(startup.id);
        }

        // Fetch full startup data with component scores
        let fullStartup: any = startup;
        if (startup.id) {
          const { data } = await supabase
            .from('startup_uploads')
            .select('*')
            .eq('id', startup.id)
            .single();
          if (data) {
            fullStartup = data;
          }
        }

        // Build analysis object
        const analysis: StartupAnalysis = {
          name: fullStartup.name || 'Startup',
          sectors: fullStartup.sectors || [],
          stage: String(fullStartup.stage || 'seed'),
          total_god_score: fullStartup.total_god_score ?? undefined,
          team_score: fullStartup.team_score ?? undefined,
          traction_score: fullStartup.traction_score ?? undefined,
          market_score: fullStartup.market_score ?? undefined,
          product_score: fullStartup.product_score ?? undefined,
          vision_score: fullStartup.vision_score ?? undefined,
          hasProduct: true,
          hasRevenue: fullStartup.traction_score ? fullStartup.traction_score > 60 : false,
        };

        // Fetch investor matches (NO EMBEDS — avoids PostgREST 400)
        let investors: { id: string; name: string; focus: string; whyAligned: string }[] = [];
        
        if (startup.id) {
          // 1) Pull match rows only
          const { data: matchRows, error: matchErr } = await supabase
            .from('startup_investor_matches')
            .select('investor_id, match_score, match_reasons')
            .eq('startup_id', startup.id)
            .order('match_score', { ascending: false })
            .limit(20);

          if (matchErr) {
            console.error('[DiscoveryPage] match query failed:', matchErr);
          } else if (matchRows && matchRows.length > 0) {
            // 2) Pull investors in a second query
            const investorIds = Array.from(new Set(matchRows.map((m: any) => m.investor_id))).filter(Boolean);

            const { data: invRows, error: invErr } = await supabase
              .from('investors')
              .select('id, name, sectors, stage')
              .in('id', investorIds);

            if (invErr) {
              console.error('[DiscoveryPage] investor query failed:', invErr);
            } else {
              // 3) Join in memory
              const investorById = new Map((invRows || []).map((i: any) => [i.id, i]));

              investors = matchRows
                .map((m: any) => {
                  const inv = investorById.get(m.investor_id);
                  if (!inv) return null;

                  const sectors = Array.isArray(inv.sectors) ? inv.sectors : [];
                  const stage = inv.stage || 'Seed';

                  return {
                    id: inv.id,
                    name: inv.name || 'Investor',
                    focus: `${stage} / ${sectors.slice(0, 2).join(', ') || 'Generalist'}`,
                    whyAligned: (Array.isArray(m.match_reasons) && m.match_reasons[0])
                      ? m.match_reasons[0]
                      : `Matches ${sectors.slice(0, 2).join(' + ') || 'your'} signals`,
                  };
                })
                .filter(Boolean) as any[];
            }
          }
        }

        // Generate discovery data
        const data = generateDiscoveryData(analysis, investors);
        setDiscoveryData(data);
        
        // Store founder context for personalized gallery
        try {
          const founderContext = {
            stage: analysis.stage,
            industry: analysis.sectors?.[0] || null,
            geography: fullStartup.geography || null,
            startupName: analysis.name,
            signals: data.signals?.map(s => s.name) || [],
            godScore: analysis.total_god_score
          };
          sessionStorage.setItem('pythh_founder_context', JSON.stringify(founderContext));
          localStorage.setItem('pythh_founder_context', JSON.stringify(founderContext));
        } catch (e) {
          console.error('Failed to store founder context:', e);
        }

        // Mark loading as complete (let the loader finish its animation)
        setLoadingComplete(true);
      } catch (err) {
        console.error('Discovery error:', err);
        setError('Failed to analyze startup');
        setIsLoading(false);
      }
    }

    fetchData();
  }, [url]);

  // Handle loader completion
  const handleLoaderComplete = () => {
    if (loadingComplete) {
      setIsLoading(false);
    }
  };

  // Enable weekly updates
  const handleEnableUpdates = async () => {
    if (!user) {
      // Redirect to login with return URL
      navigate(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    // For now, just toggle the state (expand with actual notification system later)
    setUpdatesEnabled(true);
  };

  // Loading state
  if (isLoading) {
    return <ReadingSignalsLoader onComplete={handleLoaderComplete} minDuration={2500} />;
  }

  // Error state
  if (error || !discoveryData) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-400 mb-4">{error || 'Something went wrong'}</p>
          <Link 
            to="/" 
            className="text-amber-400 hover:text-amber-300 transition-colors"
          >
            ← Try again
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Background subtle gradient */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-amber-500/3 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-40 bg-[#0a0a0a]/80 backdrop-blur-sm border-b border-gray-800/50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BrandMark />
            {startupName && (
              <>
                <span className="text-gray-600">/</span>
                <span className="text-gray-400 text-sm">{startupName}</span>
              </>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            {/* Notification Bell - Sprint 4 */}
            <NotificationBell 
              startupUrl={url}
              onClick={() => setIsNotificationDrawerOpen(true)}
            />
            
            <Link
              to="/"
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              New scan
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        <DiscoverySnapshot 
          data={discoveryData}
          startupName={startupName}
          startupId={startupId}
          onEnableUpdates={handleEnableUpdates}
          isUpdatesEnabled={updatesEnabled}
        />
      </main>

      {/* Footer */}
      <footer className="relative z-10 max-w-4xl mx-auto px-6 py-8 border-t border-gray-800/50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <p>Pythh — Investor signals that matter</p>
          <div className="flex items-center gap-4">
            <Link to="/how-it-works" className="hover:text-gray-400 transition-colors">
              How it works
            </Link>
            <Link to="/pricing" className="hover:text-gray-400 transition-colors">
              Pricing
            </Link>
          </div>
        </div>
      </footer>

      {/* Notification Drawer - Sprint 4 */}
      <NotificationDrawer
        startupUrl={url}
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        onViewChange={() => {
          setIsNotificationDrawerOpen(false);
          // Could scroll to specific section or navigate
        }}
      />
    </div>
  );
}
