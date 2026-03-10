/**
 * TopMatchesCards - Displays top 5 investor matches in card format
 * Similar to SubmitStartupPage MatchCard format
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Flame, Lock, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface Investor {
  id: string;
  name: string | null;
  firm: string | null;
  title: string | null;
  photo_url: string | null;
  sectors: string[] | null;
  stage: string[] | null;
  check_size_min: number | null;
  check_size_max: number | null;
  investor_tier: string | null;
}

interface Match {
  investor_id: string;
  match_score: number;
  reasoning: string | null;
  why_you_match: string[] | null;
  investor: Investor | null;
}

interface TopMatchesCardsProps {
  startupId: string;
  totalMatches?: number;
}

function formatSectors(sectors: string[] | null): string[] {
  if (!sectors || !Array.isArray(sectors)) return [];
  return sectors.slice(0, 3);
}

function fmtMoney(amount: number | null): string {
  if (!amount) return '';
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
  return `$${amount}`;
}

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-400';
  if (score >= 65) return 'text-cyan-400';
  if (score >= 50) return 'text-amber-400';
  return 'text-zinc-400';
}

function barColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 65) return 'bg-cyan-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-zinc-500';
}

function MatchCard({ match, rank, blurred }: { match: Match; rank: number; blurred?: boolean }) {
  const { investor, match_score } = match;
  if (!investor) return null;

  const sectors = formatSectors(investor.sectors);
  const check = investor.check_size_min || investor.check_size_max
    ? `${fmtMoney(investor.check_size_min)}${investor.check_size_max ? `–${fmtMoney(investor.check_size_max)}` : '+'}`
    : null;
  
  const whyText = match.why_you_match && match.why_you_match.length > 0
    ? match.why_you_match[0]
    : match.reasoning || null;

  return (
    <div className={`relative rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-all ${blurred ? 'blur-[6px] select-none pointer-events-none' : ''}`}>
      <div className="absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-400">{rank}</div>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          {investor.photo_url
            ? <img src={investor.photo_url} className="w-9 h-9 rounded-full object-cover border border-zinc-700 flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            : <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 text-sm font-bold text-zinc-300">{(investor.firm || investor.name || '?').charAt(0).toUpperCase()}</div>
          }
          <div className="min-w-0">
            <div className="font-semibold text-white text-sm truncate">{investor.firm || investor.name}</div>
            {investor.firm && investor.name && <div className="text-xs text-zinc-500 truncate">{investor.name}{investor.title ? ` · ${investor.title}` : ''}</div>}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className={`text-base font-bold ${scoreColor(match_score)}`}>{match_score}%</div>
          <div className="text-[10px] text-zinc-600">match</div>
        </div>
      </div>
      <div className="w-full h-1 bg-zinc-800 rounded-full mb-2.5">
        <div className={`h-1 rounded-full ${barColor(match_score)}`} style={{ width: `${match_score}%` }} />
      </div>
      <div className="flex flex-wrap gap-1">
        {investor.investor_tier === 'tier_1' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">Tier 1</span>}
        {sectors.map(s => <span key={s} className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700">{s}</span>)}
        {check && <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{check}</span>}
      </div>
      {whyText && !blurred && (
        <p className="mt-2 text-[11px] text-zinc-600 leading-relaxed line-clamp-2">"{whyText}"</p>
      )}
      {!blurred && (
        <Link
          to={`/investor/${investor.id}`}
          className="mt-3 inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          View Profile <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

export default function TopMatchesCards({ startupId, totalMatches = 0 }: TopMatchesCardsProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!startupId) {
      setLoading(false);
      return;
    }

    async function fetchTopMatches() {
      try {
        setLoading(true);
        setError(null);

        // Fetch top 5 matches
        const { data: matchData, error: matchError } = await supabase
          .from('startup_investor_matches')
          .select('investor_id, match_score, reasoning, why_you_match')
          .eq('startup_id', startupId)
          .order('match_score', { ascending: false })
          .limit(5);

        if (matchError) throw matchError;
        if (!matchData || matchData.length === 0) {
          setMatches([]);
          return;
        }

        // Fetch investor details for these matches
        const investorIds = matchData.map(m => m.investor_id).filter(Boolean);
        const { data: investorData, error: investorError } = await supabase
          .from('investors')
          .select('id, name, firm, title, photo_url, sectors, stage, check_size_min, check_size_max, investor_tier')
          .in('id', investorIds);

        if (investorError) throw investorError;

        // Create a map of investor_id -> investor
        const investorMap = new Map((investorData || []).map((inv: any) => [inv.id, inv]));

        // Merge matches with investor data
        const formattedMatches: Match[] = matchData.map((m: any) => ({
          investor_id: m.investor_id,
          match_score: m.match_score || 0,
          reasoning: m.reasoning,
          why_you_match: m.why_you_match,
          investor: investorMap.get(m.investor_id) || null,
        }));

        setMatches(formattedMatches);
      } catch (err) {
        console.error('Error fetching top matches:', err);
        setError(err instanceof Error ? err.message : 'Failed to load matches');
      } finally {
        setLoading(false);
      }
    }

    fetchTopMatches();
  }, [startupId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-white">Top Investor Matches</h2>
          </div>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 animate-pulse">
              <div className="h-16 bg-zinc-800/40 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || matches.length === 0) {
    return null; // Don't show section if no matches
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-400" />
          <h2 className="text-sm font-semibold text-white">Top Investor Matches</h2>
        </div>
        {totalMatches > 0 && (
          <span className="text-xs text-zinc-600">{totalMatches} total matches found</span>
        )}
      </div>
      <div className="space-y-3">
        {matches.slice(0, 5).map((m, i) => (
          <MatchCard key={m.investor_id} match={m} rank={i + 1} blurred={i >= 3} />
        ))}
      </div>
      {matches.length >= 3 && (
        <div className="relative mt-4 rounded-xl border border-orange-500/20 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 p-5 text-center"
          style={{ boxShadow: '0 0 40px rgba(249,115,22,0.08)' }}>
          <Lock className="w-5 h-5 text-orange-400/60 mx-auto mb-2" />
          <p className="text-white text-sm font-semibold mb-1">Unlock all {totalMatches || matches.length} investor matches</p>
          <p className="text-zinc-500 text-xs mb-3">See full profiles, contact intel, and outreach templates tailored to your GOD score.</p>
          <Link
            to="/signup?ref=matches"
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-orange-500/60 text-orange-400 hover:border-orange-400 hover:text-orange-300 font-semibold rounded-xl transition text-sm"
            style={{ boxShadow: '0 0 20px rgba(249,115,22,0.15)' }}
          >
            Get Full Access <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
