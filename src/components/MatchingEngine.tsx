import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ThumbsUp, Info, Share2, Sparkles, Search, TrendingUp, Heart } from 'lucide-react';
import { supabase } from '../lib/supabase';
// REMOVED: Tier classification - now handled by queue-processor-v16.js during match generation

import { DotLottie } from '@lottiefiles/dotlottie-web';
import LiveMatchDemo from './LiveMatchDemo';
import HotMatchPopup from './HotMatchPopup';
import InvestorCard from './InvestorCard';
import EnhancedInvestorCard from './EnhancedInvestorCard';
import StartupVotePopup from './StartupVotePopup';
import VCInfoPopup from './VCInfoPopup';
import MatchScoreBreakdown from './MatchScoreBreakdown';
import ShareMatchModal from './ShareMatchModal';
import SplitScreenHero from './SplitScreenHero';
import ValuePropPanels from './ValuePropPanels';
import LogoDropdownMenu from './LogoDropdownMenu';
import OracleHeader from './oracle/OracleHeader';
import TransparencyPanel from './TransparencyPanel';
import DataQualityBadge from './DataQualityBadge';
import MatchConfidenceBadge from './MatchConfidenceBadge';
import SmartSearchBar from './SmartSearchBar';
import EducationalMatchModal from './EducationalMatchModal';
import GetMatchedPopup from './GetMatchedPopup';
import { saveMatch, unsaveMatch, isMatchSaved } from '../lib/savedMatches';
import { StartupComponent, InvestorComponent } from '../types';
import HomeProofFeed from './home/HomeProofFeed';

// SIMPLIFIED MATCHING: Uses pre-calculated GOD scores from database
// This aligns with Architecture Document Option A (Recommended)

interface MatchPair {
  startup: StartupComponent & {
    tags: string[];
    seeking?: string; // fivePoints[4] - Investment
    market?: string; // fivePoints[1] - Market
    product?: string; // fivePoints[2] - Product
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
  };
  investor: {
    id: string;
    name: string; // name @ firm
    firm?: string; // firm name
    description: string; // bio
    tagline?: string; // tagline or investment thesis
    type?: string; // 'VC', 'Angel', 'Family Office', 'PE'
    stage?: string[]; // investment stages
    sectors?: string[]; // investment sectors
    tags: string[];
    checkSize?: string;
    geography?: string; // location/geography
    notableInvestments?: string[]; // notable_investments company names (array)
    portfolioSize?: number; // portfolio_count
    status?: string;
    investmentThesis?: string; // investment_thesis
    portfolio?: string; // portfolio company info
    aum?: number; // Assets Under Management
    fundSize?: number; // Current fund size
    exits?: number; // Number of successful exits
    unicorns?: number; // Number of unicorn investments
    website?: string;
    linkedin?: string;
    twitter?: string;
    partners?: string[]; // Partner names - TO BE SCRAPED
    // Extended fields from database
    bio?: string;
    blog_url?: string;
    check_size_min?: number | null;
    check_size_max?: number | null;
    notable_investments?: string[] | string | null;
  };
  matchScore: number;
  reasoning?: string[];
  breakdown?: {
    industryMatch: number;
    stageMatch: number;
    geographyMatch: number;
    checkSizeMatch: number;
    thesisAlignment: number;
  };
}

// Helper function to format check size from min/max
function formatCheckSize(min?: number, max?: number): string {
  if (!min && !max) return 'Undisclosed';
  const minStr = min ? `$${(min / 1000000).toFixed(1)}M` : '$0';
  const maxStr = max ? `$${(max / 1000000).toFixed(1)}M` : '$10M+';
  return `${minStr} - ${maxStr}`;
}

export default function MatchingEngine() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlParam = searchParams.get('url');
  const [userStartupId, setUserStartupId] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchPair[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [currentBatch, setCurrentBatch] = useState(0); // batch index
  const [batchSize] = useState(25); // batch size (fixed at 25)
  const [isAnalyzing, setIsAnalyzing] = useState(true);
  const [showLightning, setShowLightning] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [matchPulse, setMatchPulse] = useState(false);
  const [brainSpin, setBrainSpin] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [godAlgoStep, setGodAlgoStep] = useState(0);
  const [showVotePopup, setShowVotePopup] = useState(false);
  const [votingStartup, setVotingStartup] = useState<any>(null);
  const [showVCPopup, setShowVCPopup] = useState(false);
  const [selectedInvestor, setSelectedInvestor] = useState<any>(null);
  const [cardFadeOut, setCardFadeOut] = useState(false);
  const [showScoreBreakdown, setShowScoreBreakdown] = useState(false);
  const [isEducationalMatch, setIsEducationalMatch] = useState(false);
  const [showEducationalModal, setShowEducationalModal] = useState(false);
  const [educationalMatchTimer, setEducationalMatchTimer] = useState<NodeJS.Timeout | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showHotMatchInfo, setShowHotMatchInfo] = useState(false);
  const [showHotMatchPopup, setShowHotMatchPopup] = useState(false);
  const [showMatchLogic, setShowMatchLogic] = useState(false);
  const [showGetMatchedPopup, setShowGetMatchedPopup] = useState(false);
  const [matchViewCount, setMatchViewCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);  // OracleHeader hamburger menu state
  const lottieCanvasRef = useRef<HTMLCanvasElement>(null);
  const dotLottieRef = useRef<any>(null);

  // Calculate total number of batches
  const totalBatches = Math.ceil(matches.length / batchSize);
  // Get matches for current batch
  const batchMatches = matches.slice(currentBatch * batchSize, (currentBatch + 1) * batchSize);
  // Track which match in the batch is currently shown (for card animation, optional)
  const [currentIndex, setCurrentIndex] = useState(0);

  // Check if current match is saved whenever match changes (within batch)
  useEffect(() => {
    if (batchMatches.length > 0 && batchMatches[currentIndex]) {
      const match = batchMatches[currentIndex];
      if (!match) return;
      setIsSaved(isMatchSaved(match.startup.id, match.investor.id));
    }
  }, [currentIndex, batchMatches]);

  const handleToggleSave = () => {
    if (matches.length === 0) return;
    const match = matches[currentIndex];
    
    if (!match || !match.startup || !match.investor || !match.startup.id || !match.investor.id) {
      return;
    }
    
    if (isSaved) {
      unsaveMatch(match.startup.id, match.investor.id);
      setIsSaved(false);
    } else {
      saveMatch({
        startupId: match.startup.id,
        investorId: match.investor.id,
        startupName: match.startup.name || 'Unknown Startup',
        investorName: match.investor.name || 'Unknown Investor',
        matchScore: match.matchScore,
        tags: match.startup.tags || [],
      });
      setIsSaved(true);
    }
  };

  // GOD Algorithm steps animation
  const godAlgorithmSteps = [
    "🧠 Analyzing team strength...",
    "📈 Evaluating traction signals...",
    "🎯 Assessing market fit...",
    "💡 Scoring product innovation...",
    "🚀 Calculating vision potential...",
    "🌐 Measuring ecosystem advantages...",
    "💪 Gauging grit & perseverance...",
    "✅ GOD Score: Complete"
  ];

  // Rotating secrets/news for startup cards
  const startupSecrets = [
    "Recently featured in TechCrunch",
    "Just closed seed round oversubscribed by 2x",
    "Growing 40% MoM for last 6 months",
    "Former executives from Fortune 500 companies",
    "Strategic partnership with industry leader announced",
    "Product waitlist hit 10,000 users in first month",
    "Patent pending on core technology",
    "Backed by Y Combinator alumni"
  ];
  
  const currentSecret = startupSecrets[currentIndex % startupSecrets.length];

  // DIRECT SUPABASE CONNECTION TEST
  useEffect(() => {
    async function testFetch() {
      console.log('\n' + '='.repeat(80));
      console.log('🔍 DIRECT SUPABASE CONNECTION TEST');
      console.log('='.repeat(80));
      
      const { data, error } = await supabase
        .from('startup_uploads')
        .select('id, name, status')
        .eq('status', 'approved')
        .limit(5);
      
      console.log('📊 DIRECT SUPABASE TEST RESULT:', { 
        data, 
        error,
        dataLength: data?.length,
        firstStartup: data?.[0]
      });
      
      if (error) {
        console.error('❌ SUPABASE ERROR:', error);
        console.error('   Message:', error.message);
        console.error('   Code:', error.code);
        console.error('   Details:', error.details);
        console.error('   Hint:', error.hint);
      } else if (data && data.length > 0) {
        console.log('✅ SUCCESS: Found', data.length, 'approved startups');
        console.log('📦 Sample IDs:', data.map(s => s.id));
      } else {
        console.warn('⚠️ Query succeeded but returned 0 results');
      }
      console.log('='.repeat(80) + '\n');
    }
    testFetch();
  }, []);

  // Load matches from database
  useEffect(() => {
    loadMatches();
    
    // Refresh matches every 10 minutes to get new batch
    const refreshInterval = setInterval(() => {
      console.log('🔄 Refreshing matches (10-minute replenish)...');
      loadMatches();
    }, 10 * 60 * 1000); // 10 minutes
    
    return () => clearInterval(refreshInterval);
  }, [urlParam]); // Re-run when URL param changes
  
  // DEBUG 4: Watch matches state changes
  useEffect(() => {
    if (matches.length > 0) {
      console.log('\n🔄 MATCHES STATE UPDATED:');
      console.log('   Total matches:', matches.length);
      console.log('   First 3 matches:', matches.slice(0, 3).map(m => ({
        startup: m.startup.name,
        score: m.matchScore
      })));
      console.log('   Current index:', currentIndex);
      console.log('   Current match being displayed:', matches[currentIndex]?.startup?.name, matches[currentIndex]?.matchScore);
    }
  }, [matches]);

  // Initialize Lottie animation
  useEffect(() => {
    if (lottieCanvasRef.current && !dotLottieRef.current) {
      console.log('🎬 Initializing Lottie animation...');
      dotLottieRef.current = new DotLottie({
        autoplay: false,
        loop: false,
        canvas: lottieCanvasRef.current,
        src: "https://lottie.host/4db68bbd-31f6-4cd8-84eb-189de081159a/IGmMCqhzpt.lottie",
      });
      console.log('✅ Lottie initialized:', dotLottieRef.current);
    }
  }, []);

  // Trigger Lottie animation when showLightning changes
  useEffect(() => {
    if (showLightning && dotLottieRef.current) {
      console.log('⚡ PLAYING LOTTIE ANIMATION');
      dotLottieRef.current.play();
    } else if (showLightning && lottieCanvasRef.current) {
      // Ref not initialized yet, but canvas exists - wait a bit and try again
      const timeout = setTimeout(() => {
        if (dotLottieRef.current) {
          dotLottieRef.current.play();
        }
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [showLightning]);

  // Auto-advance to next batch every 10 minutes
  useEffect(() => {
    if (matches.length === 0) return;
    const batchAdvanceInterval = setInterval(() => {
      setCurrentBatch((prev) => {
        const nextBatch = (prev + 1) % totalBatches;
        setCurrentIndex(0); // Reset to first match in new batch
        return nextBatch;
      });
    }, 10 * 60 * 1000); // 10 minutes
    return () => clearInterval(batchAdvanceInterval);
  }, [matches.length, totalBatches]);

  // GOD Algorithm rolling animation (changes every 1.5 seconds)
  useEffect(() => {
    const godInterval = setInterval(() => {
      setGodAlgoStep((prev) => (prev + 1) % godAlgorithmSteps.length);
    }, 1500);
    
    return () => clearInterval(godInterval);
  });

  // Match cycling: show each match for 10 seconds
  // After every 4 matches, show the "Get Matched" popup to capture conversions
  useEffect(() => {
    if (batchMatches.length === 0) return;
    
    // Cycle to next match every 10 seconds
    const cycleInterval = setInterval(() => {
      // Track view count and show popup every 4 matches
      setMatchViewCount(prev => {
        const newCount = prev + 1;
        // Show popup after 4th, 8th, 12th match etc. (but not if already showing)
        if (newCount % 4 === 0 && !showGetMatchedPopup) {
          setShowGetMatchedPopup(true);
        }
        return newCount;
      });
      handleNextMatch();
    }, 10000); // 10 seconds per match
    
    return () => clearInterval(cycleInterval);
  }, [batchMatches.length, showGetMatchedPopup]);

  // REMOVED: saveMatchesToDatabase - Queue processor handles match creation
  // Frontend should only READ matches, not write them

  // Helper to normalize URL
  const normalizeUrl = (input: string): string => {
    let normalized = input.trim().toLowerCase();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = 'https://' + normalized;
    }
    return normalized.replace(/\/$/, '');
  };

  // Helper to extract domain
  const extractDomain = (input: string): string => {
    try {
      const urlObj = new URL(normalizeUrl(input));
      return urlObj.hostname.replace('www.', '');
    } catch {
      return input.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
    }
  };

  // Find or create startup from URL
  const findOrCreateStartup = async (url: string): Promise<string | null> => {
    const normalizedUrl = normalizeUrl(url);
    const domain = extractDomain(url);
    
    console.log('[findOrCreate] Looking for domain:', domain);

    // Check if startup exists - use ilike to find candidates, then filter by exact domain
    const candidatesRes = await supabase
      .from('startup_uploads')
      .select('id, website')
      .ilike('website', `%${domain}%`)
      .limit(10);
    
    const candidates = candidatesRes?.data ?? [];
    
    // Pick best match by exact hostname equality
    const best = (candidates || []).find(s => {
      try {
        const h = new URL(normalizeUrl(s.website || '')).hostname.replace('www.', '');
        return h === domain;
      } catch {
        return false;
      }
    });
    
    if (best) {
      console.log('[findOrCreate] Found exact match:', best.id);
      return best.id;
    }

    // Create new startup
    const companyName = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    
    const insertRes = await supabase
      .from('startup_uploads')
      .insert({
        name: companyName,
        website: normalizedUrl,
        tagline: `Startup at ${domain}`,
        sectors: ['Technology'],
        stage: 1,
        status: 'approved', // Valid constraint: pending|reviewing|approved|rejected|published
        source_type: 'url', // Valid constraint: url|deck|manual
        total_god_score: 65,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();
    
    const newStartup = insertRes?.data ?? null;
    const error = insertRes?.error ?? null;

    if (newStartup && !error) {
      return newStartup.id;
    }
    
    console.error('Failed to create startup:', error);
    return null;
  };

  const loadMatches = async () => {
    console.log('[matches] urlParam:', urlParam);
    
    try {
      setLoadError(null);
      setDebugInfo(null);
      setMatches([]);
      setCurrentIndex(0);
      
      // Check if Supabase is properly configured
      const supabaseLib = await import('../lib/supabase');
      if (!supabaseLib.hasValidSupabaseCredentials) {
        setLoadError('⚠️ Supabase credentials not configured. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your .env file and restart the dev server.');
        setIsAnalyzing(false);
        return;
      }

      // If URL param provided, find/create that startup first
      let targetStartupId: string | null = null;
      if (urlParam) {
        targetStartupId = await findOrCreateStartup(urlParam);
        console.log('[matches] targetStartupId:', targetStartupId);
        if (targetStartupId) {
          setUserStartupId(targetStartupId);
        }
      }
      
      // Query PRE-CALCULATED matches from database
      // These were created by queue-processor-v16.js using the official algorithm
      // Step 1: Get match IDs only (fast)
      // Lowered threshold from 35 to 20 to show more matches (can be adjusted)
      const MIN_MATCH_SCORE = 20; // Lowered to show matches with score >= 20
      
      // Build query - if user submitted URL, prioritize their matches
      let matchQuery = supabase
        .from('startup_investor_matches')
        .select('id, match_score, confidence_level, startup_id, investor_id, reasoning')
        .eq('status', 'suggested')
        .gte('match_score', MIN_MATCH_SCORE)
        .order('match_score', { ascending: false });

      // If we have a target startup, filter to their matches
      if (targetStartupId) {
        matchQuery = matchQuery.eq('startup_id', targetStartupId);
      }

      const matchRes = await matchQuery.limit(500);
      const matchIds = matchRes?.data ?? [];
      const matchError = matchRes?.error ?? null;
      
      if (matchError) {
        console.error('❌ Error fetching match IDs:', matchError);
        
        // Provide more specific error messages
        let errorMsg = 'Failed to load matches';
        if (matchError.message?.includes('JWT')) {
          errorMsg = 'Authentication error. Please check your Supabase credentials in .env file.';
        } else if (matchError.message?.includes('relation') || matchError.message?.includes('does not exist')) {
          errorMsg = 'Database table not found. Please ensure migrations are run.';
        } else if (matchError.message?.includes('permission') || matchError.message?.includes('RLS')) {
          errorMsg = 'Permission denied. Check Supabase Row Level Security settings.';
        } else {
          errorMsg = `Failed to load matches: ${matchError.message || 'Unknown error'}`;
        }
        
        setLoadError(errorMsg);
        setIsAnalyzing(false);
        return;
      }
      
      if (!matchIds?.length) {
        console.warn(`⚠️ No matches found with status="suggested" and score >= ${MIN_MATCH_SCORE}`);
        setLoadError(`No matches available. This could mean:\n1. No matches have been generated yet\n2. Queue processor needs to run\n3. Matches exist but have different status\n4. All matches have score < ${MIN_MATCH_SCORE}`);
        setIsAnalyzing(false);
        return;
      }
      
      // EARLY DEDUPLICATION: Remove duplicate startup-investor pairs from database results
      // Keep only the highest-scoring match for each pair
      const seenPairsEarly = new Map<string, typeof matchIds[0]>();
      matchIds.forEach(m => {
        const pairKey = `${m.startup_id}-${m.investor_id}`;
        const existing = seenPairsEarly.get(pairKey);
        if (!existing || (m.match_score || 0) > (existing.match_score || 0)) {
          seenPairsEarly.set(pairKey, m);
        }
      });
      const uniqueMatchIds = Array.from(seenPairsEarly.values());
      console.log(`🔍 Early dedup: ${matchIds.length} → ${uniqueMatchIds.length} unique pairs`);
      
      // Step 2: Fetch startup and investor details separately
      const startupIds = [...new Set(uniqueMatchIds.map(m => m.startup_id).filter((id): id is string => Boolean(id)))];
      const investorIds = [...new Set(uniqueMatchIds.map(m => m.investor_id).filter((id): id is string => Boolean(id)))];
      
      if (startupIds.length === 0 || investorIds.length === 0) {
        console.error('❌ No valid startup or investor IDs');
        setLoadError('No matches available. Please ensure the queue processor is running.');
        setIsAnalyzing(false);
        return;
      }
      
      const [startupsRes, investorsRes] = await Promise.all([
        supabase.from('startup_uploads').select('id, name, tagline, description, sectors, stage, total_god_score, team_score, traction_score, market_score, product_score, vision_score, raise_amount, extracted_data, location, website, has_revenue, has_customers, is_launched, team_size, growth_rate_monthly, deployment_frequency, mrr, arr').in('id', startupIds),
        supabase.from('investors').select('id, name, firm, bio, type, sectors, stage, check_size_min, check_size_max, geography_focus, notable_investments, investment_thesis, investment_firm_description, firm_description_normalized, photo_url, linkedin_url, total_investments, active_fund_size').in('id', investorIds)
      ]);
      
      if (startupsRes.error) {
        console.error('❌ Error fetching startups:', startupsRes.error);
        setLoadError('Failed to load startup data: ' + startupsRes.error.message);
        setIsAnalyzing(false);
        return;
      }
      
      if (investorsRes.error) {
        console.error('❌ Error fetching investors:', investorsRes.error);
        setLoadError('Failed to load investor data: ' + investorsRes.error.message);
        setIsAnalyzing(false);
        return;
      }
      
      const startupMap = new Map((startupsRes.data || []).map((s: any) => [s.id, s]));
      const investorMap = new Map(((investorsRes.data || []) as any[]).map((i: any) => [i.id, i]));
      
      // Combine into matchData format (using uniqueMatchIds, not matchIds)
      let matchData = uniqueMatchIds
        .filter(m => m.startup_id && m.investor_id)
        .map(m => ({
          ...m,
          startup_uploads: startupMap.get(m.startup_id!) || null,
          investors: investorMap.get(m.investor_id!) || null
        }))
        .filter(m => m.startup_uploads && m.investors);
      
      // Shuffle matches to show variety (if we have enough)
      if (matchData.length > 10) {
        // Fisher-Yates shuffle for better variety
        for (let i = matchData.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [matchData[i], matchData[j]] = [matchData[j], matchData[i]];
        }
      }

      if (!matchData || matchData.length === 0) {
        console.warn('⚠️ No matches found in startup_investor_matches table');
        
        // Check if there are ANY matches at all (different status)
        const countRes = await supabase
          .from('startup_investor_matches')
          .select('*', { count: 'exact', head: true });
        
        const totalMatches = countRes?.count ?? 0;
        
        if (totalMatches === 0) {
          setLoadError('No matches found in database. The queue processor needs to generate matches first. Check /admin/dashboard for queue processor status.');
        } else {
          setLoadError(`Found ${totalMatches} total matches, but none with status="suggested" and score >= ${MIN_MATCH_SCORE}. Check match statuses in the database.`);
        }
        
        setIsAnalyzing(false);
        return;
      }

      console.log('✅ Loaded', matchData.length, 'pre-calculated matches');

      // Transform database results to display format
      // Preserves the existing MatchPair interface used by the UI
      const displayMatches: MatchPair[] = matchData
        .filter((m: any) => m.startup_uploads && m.investors) // Filter out null/undefined
        .map((m: any) => {
        const startup = m.startup_uploads;
        const investor = m.investors;
        
        // Additional safety check
        if (!startup || !investor || !startup.id || !investor.id) {
          return null;
        }
        
        return {
          startup: {
            ...startup,
            id: startup.id,
            name: startup.name,
            description: startup.description || startup.tagline || startup.pitch || '',
            tagline: startup.tagline || '',
            tags: startup.sectors || [],
            sectors: startup.sectors || [],
            stage: startup.stage,
            total_god_score: startup.total_god_score,
            team_score: startup.team_score,
            traction_score: startup.traction_score,
            market_score: startup.market_score,
            product_score: startup.product_score,
            vision_score: startup.vision_score,
            seeking: startup.raise_amount,
            market: (startup.extracted_data as any)?.market,
            product: (startup.extracted_data as any)?.product,
            extracted_data: startup.extracted_data,
            fivePoints: (startup.extracted_data as any)?.fivePoints || [],
          } as StartupComponent & {
            tags: string[];
            seeking?: string;
            market?: string;
            product?: string;
            team_score?: number | null;
            traction_score?: number | null;
            market_score?: number | null;
            product_score?: number | null;
            vision_score?: number | null;
          },
          investor: {
            id: investor.id,
            name: investor.name,
            firm: investor.firm || '',
            description: investor.bio || '',
            tagline: '',
            type: (investor as any).type,
            stage: investor.stage || [],
            sectors: investor.sectors || [],
            tags: investor.sectors || [],
            checkSize: formatCheckSize(investor.check_size_min, investor.check_size_max),
            geography: Array.isArray(investor.geography_focus) ? investor.geography_focus.join(', ') : investor.geography_focus || undefined,
            notableInvestments: Array.isArray(investor.notable_investments) ? investor.notable_investments : (investor.notable_investments ? [investor.notable_investments] : []),
            investmentThesis: investor.investment_thesis,
            bio: investor.bio,
            blog_url: investor.blog_url,
            check_size_min: investor.check_size_min,
            check_size_max: investor.check_size_max,
            notable_investments: investor.notable_investments,
          },
          matchScore: m.match_score || 0,  // FROM DATABASE - calculated by queue-processor-v16
          reasoning: m.reasoning ? (Array.isArray(m.reasoning) ? m.reasoning : [m.reasoning]) : [],
        };
      })
      .filter(Boolean) as MatchPair[]; // Filter out null matches

      // CONDITIONAL DEDUPE: Only dedupe by startup in demo mode (no URL submitted)
      // When user submits URL, show MANY investors for THAT startup
      let finalMatches: MatchPair[] = displayMatches;
      
      if (!targetStartupId) {
        // Demo mode: one startup per match (carousel variety)
        const bestMatchPerStartup = new Map<string, MatchPair>();
        finalMatches.forEach(m => {
          const sid = String(m.startup.id);
          const existing = bestMatchPerStartup.get(sid);
          if (!existing || m.matchScore > existing.matchScore) {
            bestMatchPerStartup.set(sid, m);
          }
        });
        finalMatches = Array.from(bestMatchPerStartup.values());
        console.log(`✅ Demo mode: ${displayMatches.length} → ${finalMatches.length} unique startups`);
      } else {
        console.log(`✅ URL mode: showing ${finalMatches.length} investor matches for startup ${targetStartupId}`);
      }
      
      // Fisher-Yates shuffle for variety
      for (let i = finalMatches.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [finalMatches[i], finalMatches[j]] = [finalMatches[j], finalMatches[i]];
      }
      
      // Final matches
      const shuffledMatches = finalMatches;
      
      setDebugInfo({
        source: 'startup_investor_matches table (pre-calculated)',
        matchCount: shuffledMatches.length,
        scoreRange: {
          min: Math.min(...shuffledMatches.map(m => m.matchScore)),
          max: Math.max(...shuffledMatches.map(m => m.matchScore)),
        }
      });
      
      console.log('📈 Score range:', 
        Math.min(...shuffledMatches.map(m => m.matchScore)), '-',
        Math.max(...shuffledMatches.map(m => m.matchScore))
      );
      
      setMatches(shuffledMatches);
      setCurrentBatch(0);
      setCurrentIndex(0);
      setIsAnalyzing(false);
      
    } catch (error) {
      console.error('❌ Error in loadMatches:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Provide user-friendly error messages
      let userMessage = 'Failed to load matches';
      if (errorMessage.includes('JWT') || errorMessage.includes('auth')) {
        userMessage = 'Authentication error. Check your Supabase credentials in .env file.';
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        userMessage = 'Network error. Check your internet connection and Supabase URL.';
      } else if (errorMessage.includes('permission') || errorMessage.includes('RLS')) {
        userMessage = 'Permission denied. Check Supabase Row Level Security settings.';
      } else {
        userMessage = `Error: ${errorMessage}`;
      }
      
      setLoadError(userMessage);
      setIsAnalyzing(false);
    }
  };

  // Next match within batch
  const handleNextMatch = () => {
    if (batchMatches.length === 0) return;
    setCardFadeOut(true);
    setTimeout(() => {
      setShowLightning(true);
      setIsAnalyzing(true);
      setBrainSpin(true);
      setTimeout(() => setBrainSpin(false), 800);
      setCurrentIndex((prev) => {
        const nextIndex = prev + 1;
        // If we've reached the end of this batch, move to next batch
        if (nextIndex >= batchMatches.length) {
          setCurrentBatch((prevBatch) => {
            const nextBatch = (prevBatch + 1) % totalBatches;
            console.log(`📦 Moving to batch ${nextBatch + 1}/${totalBatches}`);
            return nextBatch;
          });
          return 0; // Reset to first match in new batch
        }
        return nextIndex;
      });
      setTimeout(() => setCardFadeOut(false), 100);
      setTimeout(() => setShowLightning(false), 600);
      setTimeout(() => setIsAnalyzing(false), 1200);
    }, 400);
  };

  const match = batchMatches[currentIndex];

  // DEBUG: Log current batch and match
  useEffect(() => {
    if (match && match.startup && match.investor) {
      console.log(`\n📍 RENDERING - currentBatch: ${currentBatch + 1}/${totalBatches}, currentMatch:`, match.startup?.name, match.matchScore);
      console.log(`   currentIndex (in batch): ${currentIndex}`);
      console.log(`   batchMatches.length: ${batchMatches.length}`);
      console.log(`   matches.length: ${matches.length}`);
    }
  }, [currentBatch, currentIndex, match, batchMatches.length, matches.length, totalBatches]);

  if (!match || !match.startup || !match.investor || !match.startup.id || !match.investor.id) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#141414] to-[#1a1a1a] flex flex-col items-center justify-center">
        {/* Animated background glows */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>
        
        {/* Loading content */}
        <div className="relative z-10 text-center">
          {/* Animated logo/spinner */}
          <div className="mb-8">
            <div className="relative inline-block">
              <div className="w-24 h-24 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin"></div>
              <span className="absolute inset-0 flex items-center justify-center text-4xl">🔥</span>
            </div>
          </div>
          
          {/* Loading text */}
          <h2 className="text-3xl font-bold text-white mb-3">
            {matches.length === 0 ? 'Finding Your Perfect Matches' : 'Loading Next Batch'}
          </h2>
          <p className="text-white/60 text-lg mb-6">
            {matches.length === 0 ? 'AI is analyzing startups & investors...' : 'Preparing more matches for you...'}
          </p>
          
          {/* Progress dots */}
          <div className="flex justify-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full animate-bounce"></div>
            <div className="w-3 h-3 bg-cyan-500 rounded-full animate-bounce delay-100"></div>
            <div className="w-3 h-3 bg-orange-500 rounded-full animate-bounce delay-200"></div>
          </div>
          
          {/* Error display - only shown if there's an actual error */}
          {loadError && (
            <div className="mt-8 bg-red-500/10 border border-red-500/30 rounded-xl px-6 py-4 max-w-md">
              <p className="text-red-400 text-sm">{loadError}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#141414] to-[#1a1a1a] relative overflow-hidden">
      {/* FloatingSearch removed - only used on secondary pages */}
      
      {/* Data Quality Banner - Shows when data is stale */}
      {/* <DataQualityBadge variant="banner" /> */}
      
      {/* Animated background - two worlds: amber/orange (pyth) and cyan/blue (ai) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-96 h-96 bg-amber-500/15 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      </div>

      {/* Hamburger Menu Drawer - controlled by OracleHeader hamburger button */}
      <LogoDropdownMenu 
        onPythClick={() => setShowHotMatchPopup(true)} 
        externalOpen={menuOpen}
        onOpenChange={setMenuOpen}
        mode="oracle"
      />

      {/* TOP SHELL: Unified container for ticker + header - normal flow, sticky */}
      <div className="sticky top-0 z-30 w-full bg-[#0a0a0a]/80 backdrop-blur-md border-b border-white/5">
        <div className="mx-auto w-full max-w-6xl px-6">
          {/* Row A: Ticker */}
          <div className="h-7 flex items-center overflow-hidden border-b border-white/5 opacity-80">
            <span className="text-[9px] text-gray-600 uppercase tracking-[0.15em] font-mono mr-6 flex-shrink-0">Live</span>
            <div className="overflow-hidden flex-1">
              <div className="animate-ticker flex items-center gap-20 whitespace-nowrap">
                {['⚡ Sequoia active in developer tools — 2h ago', '💰 Greylock Series B activity in B2B SaaS — just now', '🔥 Khosla thesis convergence in climate — today', '📊 a16z deploying in AI infrastructure — 4h ago', '⚡ Ribbit capital velocity rising in FinTech — now', '🎯 Benchmark stage readiness shift in consumer — 1h ago', '⚡ Sequoia active in developer tools — 2h ago', '💰 Greylock Series B activity in B2B SaaS — just now', '🔥 Khosla thesis convergence in climate — today', '📊 a16z deploying in AI infrastructure — 4h ago'].map((item, i) => (
                  <span key={i} className="text-[10px] text-gray-500/90 font-mono">{item}</span>
                ))}
              </div>
            </div>
          </div>
          
          {/* Row B: Header - brand lockup + sign in + hamburger */}
          <div className="h-14 flex items-center">
            <OracleHeader onOpenMenu={() => setMenuOpen(true)} />
          </div>
        </div>
      </div>

      {/* Landing Hero */}
      <SplitScreenHero />

      {/* Founder Proof Feed (demo mode only: show social proof before scanning) */}
      {!urlParam && (
        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 py-12">
          <HomeProofFeed
            onRunMySignals={() => {
              const urlInput = document.getElementById('url-input');
              if (urlInput) urlInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          />
        </div>
      )}

    </div>
  );
}
