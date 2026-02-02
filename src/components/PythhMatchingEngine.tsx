import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { DotLottie } from '@lottiefiles/dotlottie-web';
import { fetchConvergenceData } from '../lib/convergenceAPI';

import PageShell, { ContentContainer, GlassPanel } from '../components/layout/PageShell';
import TopBar, { TopBarBrand } from '../components/layout/TopBar';
import { PythhTokens } from '../lib/designTokens';
import type { StartupComponent } from '../types';

// ============================================================================
// Types
// ============================================================================

interface MatchPair {
  startup: StartupComponent & {
    tags: string[];
    seeking?: string;
    market?: string;
    product?: string;
    mrr?: number | null;
    arr?: number | null;
    has_revenue?: boolean | null;
    is_launched?: boolean | null;
    team_size?: number | null;
    growth_rate_monthly?: number | null;
    team_score?: number | null;
    traction_score?: number | null;
    market_score?: number | null;
    product_score?: number | null;
    vision_score?: number | null;
    sectors?: string[] | string | null;
    stage?: number | string | null;
  };
  investor: {
    id: string;
    name: string;
    firm?: string;
    sectors?: string[] | string | null;
    stage?: string[] | string | null;
    check_size_min?: number | null;
    check_size_max?: number | null;
    geography_focus?: string | null;
    notable_investments?: string[] | string | null;
    bio?: string | null;
    status?: string | null;
  };
  matchScore: number;
  reasoning?: string[];
}

// ============================================================================
// Helpers
// ============================================================================

function normalizeUrl(input: string): string {
  let normalized = input.trim();
  if (!normalized) return normalized;
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
  normalized = normalized.replace(/\/$/, '');
  return normalized.toLowerCase();
}

function extractDomain(input: string): string {
  try {
    const u = new URL(normalizeUrl(input));
    return u.hostname.replace(/^www\./, '');
  } catch {
    return input.replace(/^(https?:\/\/)?(www\.)?/i, '').split('/')[0];
  }
}

function formatCheckSize(min?: number | null, max?: number | null): string {
  if (!min && !max) return 'Undisclosed';
  const fmt = (n: number) => `$${(n / 1_000_000).toFixed(1)}M`;
  const a = min ? fmt(min) : '$0';
  const b = max ? fmt(max) : '$10M+';
  return `${a} - ${b}`;
}

// "Signal" is a product surface concept. We only need a lightweight best-effort
// until you formalize a signal taxonomy table.
function chooseTopSignal(startup: any): string {
  const raw = startup?.sectors;

  const sectors: string[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  if (!sectors.length) return 'alignment';

  // Prefer the first meaningful sector
  const s = sectors[0].toLowerCase();
  if (s.includes('ai')) return 'AI adoption';
  if (s.includes('climate') || s.includes('energy')) return 'climate momentum';
  if (s.includes('fintech')) return 'fintech traction';
  if (s.includes('dev')) return 'developer gravity';
  if (s.includes('health')) return 'health signal';

  return sectors[0];
}

// ============================================================================
// DISCOVER SURFACE
// Canon: /discover?url=...
// Responsibility: load enough matches → redirect to /matches
// ============================================================================

export default function PythhMatchingEngine() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlParam = searchParams.get('url');

  const [menuOpen, setMenuOpen] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [userStartupId, setUserStartupId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchPair[]>([]);
  const [debugInfo, setDebugInfo] = useState<any>(null);

  const lottieCanvasRef = useRef<HTMLCanvasElement>(null);
  const dotLottieRef = useRef<any>(null);

  // Guard: do not redirect repeatedly
  const hasRedirectedRef = useRef(false);
  
  // Track active request to prevent stale overwrites
  const activeRequestIdRef = useRef<string | null>(null);

  // "Intelligence" line (lightweight, founder-friendly)
  const intelligencePhases = useMemo(
    () => [
      'Resolving your startup…',
      'Scanning investor fit…',
      'Ranking by signal alignment…',
      'Finalizing top matches…',
    ],
    []
  );
  const [intelligenceStep, setIntelligenceStep] = useState(0);

  // Rotate phase text
  useEffect(() => {
    if (!isAnalyzing) return;
    const t = window.setInterval(() => {
      setIntelligenceStep((p) => (p + 1) % intelligencePhases.length);
    }, 1200);
    return () => window.clearInterval(t);
  }, [isAnalyzing, intelligencePhases.length]);

  // Initialize Lottie once
  useEffect(() => {
    if (lottieCanvasRef.current && !dotLottieRef.current) {
      dotLottieRef.current = new DotLottie({
        autoplay: true,
        loop: true,
        canvas: lottieCanvasRef.current,
        src: 'https://lottie.host/4db68bbd-31f6-4cd8-84eb-189de081159a/IGmMCqhzpt.lottie',
      });
    }
  }, []);

  // Find or create startup from URL
  const findOrCreateStartup = async (url: string): Promise<string | null> => {
    const normalizedUrl = normalizeUrl(url);
    const domain = extractDomain(url);

    // 1) Try find
    const candidatesRes = await supabase
      .from('startup_uploads')
      .select('id, website')
      .ilike('website', `%${domain}%`)
      .limit(10);

    console.log('[PYTHH] candidatesRes:', {
      domain,
      dataLen: candidatesRes.data?.length,
      error: candidatesRes.error,
      errorCode: candidatesRes.error?.code,
      errorMessage: candidatesRes.error?.message
    });

    const candidates = candidatesRes?.data ?? [];

    const exact = (candidates || []).find((s: any) => {
      try {
        const h = new URL(normalizeUrl(s.website || '')).hostname.replace(/^www\./, '');
        return h === domain;
      } catch {
        return false;
      }
    });

    if (exact?.id) return exact.id as string;

    // 2) Create with UNIQUE name (avoid 409 name collision)
    const baseName = domain.split('.')[0];
    const pretty = baseName ? baseName.charAt(0).toUpperCase() + baseName.slice(1) : 'Startup';
    const uniqueName = `${pretty} (${domain})`; // Embeds domain → always unique

    const insertRes = await supabase
      .from('startup_uploads')
      .insert({
        name: uniqueName,
        website: normalizedUrl,
        tagline: `Startup at ${domain}`,
        sectors: ['Technology'],
        stage: 1,
        status: 'approved',
        source_type: 'url',
        total_god_score: 65,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    console.log('[PYTHH] insertRes:', { 
      data: insertRes.data, 
      error: insertRes.error,
      errorCode: insertRes.error?.code,
      errorMessage: insertRes.error?.message
    });

    // 3) If we hit a race/collision anyway (code 23505), re-select
    if (insertRes.error) {
      const code = (insertRes.error as any).code;
      if (code === '23505') {
        console.log('[PYTHH] Duplicate detected (23505), re-fetching by domain...');
        const retry = await supabase
          .from('startup_uploads')
          .select('id, website')
          .ilike('website', `%${domain}%`)
          .limit(10);

        const retryBest = (retry.data ?? []).find((s: any) => {
          try {
            const h = new URL(normalizeUrl(s.website || '')).hostname.replace(/^www\./, '');
            return h === domain;
          } catch {
            return false;
          }
        });

        if (retryBest?.id) return retryBest.id as string;
      }

      console.error('[PYTHH] Failed to create startup:', insertRes.error);
      return null;
    }

    if (insertRes?.data?.id && !insertRes?.error) {
      const newStartupId = insertRes.data.id as string;
      
      // Trigger instant match generation via API (production-ready)
      try {
        console.log('[PYTHH] Triggering instant match generation for new startup:', newStartupId);
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002';
        const matchResponse = await fetch(`${apiUrl}/api/matches/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startupId: newStartupId })
        });
        
        if (matchResponse.ok) {
          const matchResult = await matchResponse.json();
          console.log('[PYTHH] ✅ Instant matches generated:', matchResult.matchCount);
        } else {
          console.warn('[PYTHH] ⚠️ Match generation API error:', await matchResponse.text());
        }
      } catch (matchError) {
        console.warn('[PYTHH] ⚠️ Failed to trigger instant matching:', matchError);
        console.log('[PYTHH] Fallback: Queue processor will generate matches within 1 minute');
        // Non-fatal - queue processor will handle it
      }
      
      return newStartupId;
    }

    console.error('[PYTHH] Failed to create startup:', insertRes?.error);
    return null;
  };

  const loadMatches = async () => {
    const url = urlParam?.trim() || '';

    // Hard guard: discover requires a URL
    if (!url) {
      setIsAnalyzing(false);
      setLoadError('Missing URL. Use /discover?url=yourstartup.com');
      return;
    }

    try {
      setLoadError(null);
      setDebugInfo(null);
      setMatches([]);
      setIsAnalyzing(true);

      // 1) Resolve startup (creates if needed)
      const targetStartupId = await findOrCreateStartup(url);
      if (!targetStartupId) {
        setIsAnalyzing(false);
        setLoadError('Could not resolve startup from URL. Database insert/select failed. Check console for [PYTHH] logs.');
        return;
      }

      console.log('[PYTHH] Resolved startup ID:', targetStartupId);
      setUserStartupId(targetStartupId);

      // 2) Poll convergence API with stale-result protection
      const currentReqId = crypto.randomUUID();
      activeRequestIdRef.current = currentReqId;

      const intervalMs = 2000;
      const maxAttempts = 10;
      let attempt = 0;

      const isPending = (state?: string) =>
        state && state !== 'ready' && state !== 'error';

      const tick = async () => {
        attempt += 1;
        
        // Ignore if this request is stale
        if (activeRequestIdRef.current !== currentReqId) {
          console.log('[PYTHH] Stale request detected, aborting');
          return;
        }

        try {
          console.log(`[PYTHH] Polling attempt ${attempt}/${maxAttempts}...`);
          
          const convergenceData = await fetchConvergenceData(url, { debug: true });
          
          // Check again after async operation
          if (activeRequestIdRef.current !== currentReqId) {
            console.log('[PYTHH] Stale request after fetch, aborting');
            return;
          }

          const state = convergenceData?.debug?.state;
          const visibleInvestors = convergenceData?.visible_investors ?? [];

          // ✅ SUCCESS: matches found
          if (visibleInvestors.length > 0) {
            console.log('[PYTHH] ✅ Matches found:', visibleInvestors.length);
            
            // 3) Fetch full investor details if needed
            const firstInv = visibleInvestors[0];
            const needsInvestorFetch = firstInv && !firstInv.investor && firstInv.investor_id;
            
            let investorsById = new Map();
            
            if (needsInvestorFetch) {
              console.log('[PYTHH] Backend returned flat structure, fetching investor details...');
              const investorIds = visibleInvestors.map((inv: any) => inv.investor_id).filter(Boolean);
              const { data: investors } = await supabase
                .from('investors')
                .select('id, name, firm, sectors, stage, check_size_min, check_size_max, geography_focus, notable_investments, bio, status')
                .in('id', investorIds);
              investorsById = new Map((investors || []).map((i: any) => [i.id, i]));
            }

            // 4) Transform to MatchPair format
            const startup = convergenceData.startup;
            const joined: MatchPair[] = visibleInvestors.map((inv: any) => {
              const investorData = inv.investor || investorsById.get(inv.investor_id) || {
                id: inv.investor_id || 'unknown',
                name: inv.firm_name || 'Unknown Investor',
              };

              return {
                startup: {
                  id: startup.id,
                  name: startup.name || 'Unknown Startup',
                  url: startup.url || url,
                  logo: startup.logo || null,
                  stage: startup.stage_hint || startup.stage || 'preseed',
                  total_god_score: typeof startup.total_god_score === 'number' ? startup.total_god_score : 50,
                  tags: [],
                  sectors: startup.sectors || startup.sector_hint || [],
                  team_score: startup.team_score || null,
                  traction_score: startup.traction_score || null,
                  market_score: startup.market_score || null,
                  product_score: startup.product_score || null,
                  vision_score: startup.vision_score || null,
                },
                investor: investorData,
                matchScore: inv.match_score || 0,
                confidence: inv.confidence_level || 'medium',
                similarityScore: inv.similarity_score || 0,
                successScore: inv.success_score || 0,
                reasoning: inv.reasoning || 'Sector and stage alignment',
                whyYouMatch: inv.why_you_match || [],
                fitAnalysis: inv.fit_analysis || {},
                status: inv.status || 'live',
              };
            });

            setMatches(joined);
            setDebugInfo(convergenceData.debug);
            setIsAnalyzing(false);
            
            // Redirect to /matches page (ONLY ONCE)
            if (!hasRedirectedRef.current) {
              hasRedirectedRef.current = true;
              
              const signal = chooseTopSignal(startup);
              const qs = new URLSearchParams({
                url: normalizeUrl(url),
                startup_id: targetStartupId,
                signal: signal,
              }).toString();

              setTimeout(() => {
                navigate(`/matches?${qs}`, { replace: true });
              }, 450);
            }
            return;
          }

          // ✅ PENDING: still generating matches
          if (isPending(state)) {
            console.log('[PYTHH] Matches pending, state:', state);
            if (attempt < maxAttempts) {
              setTimeout(tick, intervalMs);
              return;
            }
            throw new Error('Timed out waiting for matches to be generated (20s).');
          }

          // ✅ READY but empty: real "no matches"
          if (state === 'ready') {
            console.log('[PYTHH] Backend says ready but no matches found');
            setIsAnalyzing(false);
            setLoadError('No matches found for this startup yet.');
            return;
          }

          // ✅ UNKNOWN state: retry a bit more
          console.log('[PYTHH] Unknown state, will retry:', state);
          if (attempt < maxAttempts) {
            setTimeout(tick, intervalMs);
            return;
          }
          
          throw new Error(`No matches returned after ${maxAttempts} attempts (state=${state ?? 'unknown'})`);
          
        } catch (error: any) {
          // Ignore if request became stale during error handling
          if (activeRequestIdRef.current !== currentReqId) {
            console.log('[PYTHH] Stale request in error handler, aborting');
            return;
          }

          console.error('[PYTHH] Error during polling:', error);
          setIsAnalyzing(false);
          setLoadError(error?.message || 'Failed to load matches.');
        }
      };

      // Start polling
      tick();
      
    } catch (error: any) {
      console.error('[PYTHH] Error in loadMatches:', error);
      setIsAnalyzing(false);
      setLoadError(error?.message || 'Unknown error occurred.');
    }
  };

  // Load once per URL change
  useEffect(() => {
    hasRedirectedRef.current = false;
    
    // Abort previous request when URL changes
    if (urlParam) {
      activeRequestIdRef.current = null;
      loadMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlParam]);

  const headline = urlParam ? 'Discovering…' : 'Discovery requires a URL';
  const subhead = urlParam
    ? "We're matching your signals to investors who already invest like that."
    : 'Return home and submit your startup URL.';

  return (
    <PageShell variant="standard">
      <TopBar 
        leftContent={<TopBarBrand />}
        rightLinks={[
          { to: "/", label: "Home" },
          { to: "/live", label: "Live" },
          { to: "/signals", label: "How It Works" },
        ]}
      />

      <ContentContainer>
        <div className="py-12">
          <GlassPanel className="p-8 sm:p-10">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className={PythhTokens.text.hero}>
                  {headline}
                </h1>
                <p className={PythhTokens.text.subhead}>
                  {subhead}
                </p>

                {urlParam && (
                  <div className="mt-4 text-xs text-white/55">
                    URL: <span className="font-semibold text-white/70">{normalizeUrl(urlParam)}</span>
                    {userStartupId ? (
                      <>
                        {' '}· Startup ID:{' '}
                        <span className="font-semibold text-white/70">{userStartupId}</span>
                      </>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                <img 
                  src="/images/brain-icon.png" 
                  alt="Signal Science" 
                  className="w-14 h-14 opacity-90"
                />
                <div className="text-[11px] text-white/55 flex items-center gap-2">
                  <Sparkles size={14} />
                  Signal Science
                </div>
              </div>
            </div>

            {/* Status rail */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-4">
              {isAnalyzing ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold">
                    {intelligencePhases[intelligenceStep]}
                  </div>
                  <div className="text-xs text-white/60">
                    Ranking matches by alignment…
                  </div>
                </div>
              ) : loadError ? (
                <div className="text-sm text-rose-200 whitespace-pre-wrap">
                  {loadError}
                </div>
              ) : (
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm font-semibold">Match set ready.</div>
                  <div className="text-xs text-white/60">
                    Redirecting to results…
                  </div>
                </div>
              )}
            </div>

            {/* Tiny debug (optional, safe) */}
            {debugInfo && (
              <div className="mt-6 text-xs text-white/60">
                Loaded <span className="font-semibold text-white/80">{matches.length}</span> matches · Top score{' '}
                <span className="font-semibold text-white/80">{matches[0]?.matchScore ?? '—'}</span>
              </div>
            )}

            {!urlParam && (
              <div className="mt-8 flex items-center gap-3">
                <Link
                  to="/"
                  className={PythhTokens.button.primary}
                >
                  Go to Find My Investors
                </Link>
                <div className="text-sm text-white/60">
                  Example: <code className="px-2 py-1 rounded bg-black/30 border border-white/10">/discover?url=autoops.ai</code>
                </div>
              </div>
            )}
          </GlassPanel>
        </div>
      </ContentContainer>
    </PageShell>
  );
}
