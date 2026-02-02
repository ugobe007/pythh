import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface MatchDisplay {
  startupName: string;
  startupValueProp: string;
  startupRaise: string;
  startupStage: string;
  investorName: string;
  investorFirm: string;
  investorFocus: string;
  investorStage: string;
  matchScore: number;
}

export default function LiveMatchingStrip() {
  const [matches, setMatches] = useState<MatchDisplay[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch live matches from database
  useEffect(() => {
    async function fetchMatches() {
      try {
        console.log('[LiveMatchingStrip] Fetching matches...');
        
        // Fetch more matches since we'll filter out garbage data
        const { data: matchData, error: matchError } = await supabase
          .from('startup_investor_matches')
          .select('startup_id, investor_id, match_score')
          .eq('status', 'suggested')  // Add status filter
          .gte('match_score', 70)  // Higher threshold for quality
          .order('match_score', { ascending: false })  // Required for index usage
          .limit(100);  // Increased from 20 to account for filtering

        console.log('[LiveMatchingStrip] Match query result:', { 
          count: matchData?.length, 
          error: matchError?.message,
          sample: matchData?.[0]
        });

        if (matchError) {
          console.error('[LiveMatchingStrip] Query failed:', matchError);
          setIsLoading(false);
          return;
        }
        
        if (!matchData?.length) {
          console.log('[LiveMatchingStrip] No matches with score>=60');
          setIsLoading(false);
          return;
        }

        // Get startup and investor IDs
        const startupIds = [...new Set(matchData.map(m => m.startup_id))];
        const investorIds = [...new Set(matchData.map(m => m.investor_id))];

        console.log('[LiveMatchingStrip] Fetching details for:', { 
          startupIds: startupIds.length, 
          investorIds: investorIds.length 
        });

        // Fetch details
        const [startupsRes, investorsRes] = await Promise.all([
          supabase
            .from('startup_uploads')
            .select('id, name, tagline, sectors, stage, raise_amount')
            .in('id', startupIds),
          supabase
            .from('investors')
            .select('id, name, firm, sectors, stage')
            .in('id', investorIds)
        ]);

        console.log('[LiveMatchingStrip] Fetched:', {
          startups: startupsRes.data?.length || 0,
          investors: investorsRes.data?.length || 0,
          startupError: startupsRes.error,
          investorError: investorsRes.error
        });

        if (startupsRes.error || investorsRes.error) {
          console.error('[LiveMatchingStrip] Fetch errors:', { 
            startupError: startupsRes.error, 
            investorError: investorsRes.error 
          });
          throw new Error('Failed to fetch details');
        }

        // Create lookup maps
        const startupMap = new Map(startupsRes.data?.map(s => [s.id, s]) || []);
        const investorMap = new Map(investorsRes.data?.map(i => [i.id, i]) || []);

        // Transform to display format
        const displayMatches = matchData
          .map(m => {
            const startup = startupMap.get(m.startup_id);
            const investor = investorMap.get(m.investor_id);
            
            if (!startup || !investor) {
              console.log('[LiveMatchingStrip] Missing data for match:', {
                matchId: `${m.startup_id}:${m.investor_id}`,
                hasStartup: !!startup,
                hasInvestor: !!investor
              });
              return null;
            }

            // Filter out garbage data (scraped news articles, weird entries)
            const badPatterns = [
              'by ', 'Approve ', "'s ", 'CEO', 'founder of', 'plans to', 
              'Falls', 'Juspay', '$', 'Intel', 'Nvidia', 'AMD', 'Oracle',
              'Launches', 'Raises', 'Announces', 'Unveils'
            ];
            
            const startupName = startup.name?.toLowerCase() || '';
            const investorName = investor.name?.toLowerCase() || '';
            
            const isGarbageStartup = badPatterns.some(pattern => 
              startupName.includes(pattern.toLowerCase())
            );
            
            const isGarbageInvestor = badPatterns.some(pattern => 
              investorName.includes(pattern.toLowerCase())
            );
            
            if (isGarbageStartup) {
              console.log('[LiveMatchingStrip] Filtered garbage startup:', startup.name);
              return null;
            }
            
            if (isGarbageInvestor) {
              console.log('[LiveMatchingStrip] Filtered garbage investor:', investor.name);
              return null;
            }

            return {
              startupName: startup.name || 'Unknown Startup',
              startupValueProp: startup.tagline || 'Building the future',
              startupRaise: startup.raise_amount 
                ? `Raising $${(startup.raise_amount / 1000000).toFixed(1)}M` 
                : 'Fundraising',
              startupStage: formatStage(startup.stage),
              investorName: investor.name || 'Unknown',
              investorFirm: investor.firm || 'Independent',
              investorFocus: formatSectors(investor.sectors),
              investorStage: formatStages(investor.stage),
              matchScore: m.match_score || 0
            };
          })
          .filter((m): m is MatchDisplay => m !== null);

        console.log('[LiveMatchingStrip] Transformed matches:', displayMatches.length);
        setMatches(displayMatches);
        setIsLoading(false);
      } catch (err) {
        console.error('Failed to fetch matches:', err);
        setIsLoading(false);
      }
    }

    fetchMatches();
    // Removed auto-refresh to prevent hammering database
  }, []);

  // Auto-rotate every 8 seconds - each match is unique (1-to-1)
  useEffect(() => {
    if (matches.length === 0) return;

    const rotateInterval = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % matches.length);
    }, 8000);

    return () => clearInterval(rotateInterval);
  }, [matches.length]);

  if (isLoading) {
    return (
      <div className="w-full max-w-6xl mx-auto px-6">
        <div className="text-sm text-white/40 font-mono mb-3">LIVE SIGNAL MATCHING</div>
        <div className="h-32 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="w-full max-w-6xl mx-auto px-6">
        <div className="text-sm text-white/40 font-mono mb-3">LIVE SIGNAL MATCHING</div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
          <div className="text-white/50 text-sm">No active matches at this time</div>
        </div>
      </div>
    );
  }

  const current = matches[currentIndex];

  return (
    <div className="w-full">
      {/* Header - consistent spacing with hero section above */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white tracking-wider">LIVE SIGNAL MATCHING</h2>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="text-sm text-cyan-400 font-mono font-semibold">{matches.length} active</span>
        </div>
      </div>

      {/* Grid system - 2 columns, consistent gap */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* LEFT: Investor Card - CYAN accent */}
        <div 
          key={`investor-${currentIndex}-${current.investorName}`}
          className="rounded-[18px] border border-cyan-500/40 bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 p-[22px] min-h-[150px] transition-all duration-500 shadow-lg shadow-cyan-500/20"
          style={{ '--accent': 'cyan' } as React.CSSProperties}
        >
          <div className="flex flex-col h-full justify-between">
            {/* Title + subtitle */}
            <div className="space-y-1">
              <h3 className="text-[22px] leading-[1.15] font-bold text-white">{current.investorName}</h3>
              <p className="text-[14px] leading-[1.4] text-white/75">{current.investorFirm}</p>
            </div>

            {/* Meta row - always one line, same gap */}
            <div className="flex items-center gap-3 text-sm mt-4">
              <div className="flex items-center gap-1.5">
                <span className="text-white/40">focus:</span>
                <span className="text-cyan-400">{current.investorFocus}</span>
              </div>
              <div className="w-px h-3 bg-white/10" />
              <div className="flex items-center gap-1.5">
                <span className="text-white/40">stage:</span>
                <span className="text-white/70">{current.investorStage}</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Startup Card - GREEN accent */}
        <div 
          key={`startup-${currentIndex}-${current.startupName}`}
          className="rounded-[18px] border border-green-500/40 bg-gradient-to-br from-green-500/10 to-green-500/5 p-[22px] min-h-[150px] transition-all duration-500 shadow-lg shadow-green-500/20"
          style={{ '--accent': 'green' } as React.CSSProperties}
        >
          <div className="flex flex-col h-full justify-between">
            {/* Title + subtitle */}
            <div className="space-y-1">
              <h3 className="text-[22px] leading-[1.15] font-bold text-white">{current.startupName}</h3>
              <p className="text-[14px] leading-[1.4] text-white/75 line-clamp-1">{current.startupValueProp}</p>
            </div>

            {/* Meta row - always one line, same gap */}
            <div className="flex items-center gap-3 text-sm mt-4">
              <div className="flex items-center gap-1.5">
                <span className="text-white/40">raise:</span>
                <span className="text-violet-400">{current.startupRaise}</span>
              </div>
              <div className="w-px h-3 bg-white/10" />
              <div className="flex items-center gap-1.5">
                <span className="text-white/40">stage:</span>
                <span className="text-white/70">{current.startupStage}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Match Score Footer */}
      <div className="mt-3 flex items-center justify-center gap-3">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="flex items-center gap-2 text-xs">
          <span className="text-white/40 font-mono">match score:</span>
          <span className="text-cyan-400 font-semibold">{current.matchScore}%</span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </div>

      {/* Progress Dots */}
      <div className="mt-4 flex items-center justify-center gap-1.5">
        {matches.slice(0, Math.min(10, matches.length)).map((_, idx) => (
          <div
            key={idx}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              idx === currentIndex % 10
                ? 'bg-cyan-400 w-4'
                : 'bg-white/20'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// Helper functions
function formatStage(stage: any): string {
  if (typeof stage === 'number') {
    if (stage <= 1) return 'Pre-seed';
    if (stage === 2) return 'Seed';
    if (stage === 3) return 'Series A';
    return 'Growth';
  }
  return String(stage || 'Early');
}

function formatSectors(sectors: any): string {
  if (Array.isArray(sectors)) {
    return sectors.slice(0, 2).join(', ');
  }
  if (typeof sectors === 'string') {
    return sectors.split(',')[0]?.trim() || 'Tech';
  }
  return 'Technology';
}

function formatStages(stages: any): string {
  if (Array.isArray(stages)) {
    return stages[0] || 'Early';
  }
  if (typeof stages === 'string') {
    return stages.split(',')[0]?.trim() || 'Early';
  }
  return 'Early';
}
