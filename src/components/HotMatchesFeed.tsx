import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HotMatch {
  match_id: string;
  startup_id: string;
  investor_id: string;
  startup_name: string;
  startup_god_score: number;
  startup_tier: string;
  startup_sectors: string[];
  startup_stage: string;
  investor_name: string;
  investor_tier: string;
  investor_firm: string | null;
  match_score: number;
  created_at: string;
  is_anonymized: boolean;
}

interface HotMatchesFeedProps {
  limit?: number;
  hoursAgo?: number;
  showHeader?: boolean;
  autoRefresh?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POOL_SIZE     = 20;
const VISIBLE       = 5;
const TICK_MS       = 15000;
const REFETCH_TICKS = 12;

// ─── Match Detail Modal ───────────────────────────────────────────────────────

function MatchModal({ match, onClose }: { match: HotMatch; onClose: () => void }) {
  const navigate = useNavigate();

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const godColor =
    match.startup_god_score >= 80 ? 'text-emerald-400' :
    match.startup_god_score >= 70 ? 'text-cyan-400' :
    match.startup_god_score >= 60 ? 'text-emerald-300' : 'text-yellow-400';

  const matchColor =
    match.match_score >= 90 ? 'text-orange-400' :
    match.match_score >= 85 ? 'text-orange-300' :
    match.match_score >= 80 ? 'text-cyan-400' : 'text-emerald-400';

  const tierBadge = (tier: string) => {
    switch (tier) {
      case 'Elite':     return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'Excellent': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
      case 'Strong':    return 'bg-emerald-500/15 text-emerald-400/80 border-emerald-500/20';
      default:          return 'bg-white/10 text-white/60 border-white/10';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="relative w-full max-w-sm bg-gray-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-slideInFromTop">
        <div className="h-1 bg-gradient-to-r from-orange-500 via-emerald-500 to-cyan-500" />

        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-white/30 hover:text-white/70 transition-colors text-lg leading-none"
          aria-label="Close"
        >
          ✕
        </button>

        <div className="p-5 space-y-4">
          {/* Score hero */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="text-[11px] uppercase tracking-widest text-white/30 mb-1">Match Score</div>
              <div className={`text-4xl font-black font-mono ${matchColor}`}>
                {Math.round(match.match_score)}
                <span className="text-white/30 text-xl font-normal">/100</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-widest text-white/30 mb-1">GOD Score</div>
              <div className={`text-2xl font-bold font-mono ${godColor}`}>
                {match.startup_god_score}
              </div>
            </div>
          </div>

          {/* Startup */}
          <div className="border border-white/[0.08] rounded-xl p-3 space-y-2 bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold text-base">{match.startup_name}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${tierBadge(match.startup_tier)}`}>
                {match.startup_tier}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] bg-white/[0.08] text-white/50 px-2 py-0.5 rounded-full">
                {match.startup_stage}
              </span>
              {(match.startup_sectors || []).slice(0, 3).map(s => (
                <span key={s} className="text-[11px] bg-white/[0.08] text-white/50 px-2 py-0.5 rounded-full">
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Connector */}
          <div className="flex items-center gap-2 text-white/20 text-xs px-1">
            <div className="flex-1 h-px bg-white/10" />
            <span>matched with</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Investor */}
          <div className="border border-white/[0.08] rounded-xl p-3 space-y-1 bg-white/[0.02]">
            <div className="flex items-center justify-between">
              <span className="text-white/90 font-medium">{match.investor_name}</span>
              <span className="text-[11px] text-white/30">Tier {match.investor_tier}</span>
            </div>
            {match.investor_firm && (
              <div className="text-[12px] text-white/40">{match.investor_firm}</div>
            )}
          </div>

          {/* CTAs */}
          <div className="flex gap-2 pt-1">
            {!match.is_anonymized && match.investor_id && (
              <button
                onClick={() => { navigate(`/investor/${match.investor_id}`); onClose(); }}
                className="flex-1 py-2.5 text-xs font-semibold rounded-xl border border-white/15 text-white/70 hover:text-white hover:bg-white/[0.08] transition-all"
              >
                Investor Profile
              </button>
            )}
            <button
              onClick={() => { navigate('/signal-matches'); onClose(); }}
              className="flex-1 py-2.5 text-xs font-bold rounded-xl bg-gradient-to-r from-orange-600 to-emerald-600 hover:from-orange-500 hover:to-emerald-500 text-white transition-all shadow-lg shadow-emerald-900/30"
            >
              Find My Matches →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Feed Component ───────────────────────────────────────────────────────────

export default function HotMatchesFeed({
  limit = VISIBLE,
  hoursAgo = 720,
  showHeader = true,
  autoRefresh = true,
}: HotMatchesFeedProps) {
  const [pool, setPool]                   = useState<HotMatch[]>([]);
  const [displayed, setDisplayed]         = useState<HotMatch[]>([]);
  const [newestId, setNewestId]           = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<HotMatch | null>(null);
  const [totalThisWeek, setTotalThisWeek] = useState<number | null>(null);

  const poolIdxRef   = useRef(0);
  const tickCountRef = useRef(0);
  const visibleCount = Math.max(1, limit);

  // ── Fetch pool ──────────────────────────────────────────────────────────────
  const fetchPool = useCallback(async () => {
    try {
      const matchPromise    = supabase.rpc('get_hot_matches', { limit_count: POOL_SIZE, hours_ago: hoursAgo });
      const velocityPromise = supabase.rpc('get_platform_velocity');

      const { data, error } = await matchPromise;
      if (error) throw error;

      let fetched: HotMatch[] | null = data && data.length > 0 ? data : null;

      if (!fetched) {
        for (const tryHours of [hoursAgo * 7, 720]) {
          const { data: d, error: e } = await supabase.rpc('get_hot_matches', { limit_count: POOL_SIZE, hours_ago: tryHours });
          if (e) throw e;
          if (d && d.length > 0) { fetched = d; break; }
        }
      }

      if (fetched && fetched.length > 0) {
        const shuffled = [...fetched].sort(() => Math.random() - 0.5);
        setPool(shuffled);
        const initial = shuffled.slice(0, visibleCount);
        setDisplayed(initial);
        setNewestId(initial[0]?.match_id ?? null);
        poolIdxRef.current  = visibleCount;
        tickCountRef.current = 0;
      }

      setLoading(false);

      void (async () => {
        try {
          const { data: v } = await velocityPromise;
          if (v?.[0]) setTotalThisWeek(v[0].total_matches_week ?? null);
        } catch { /* silent */ }
      })();
    } catch (err: unknown) {
      console.error('[HotMatchesFeed] fetch error:', { message: (err as any)?.message });
      setLoading(false);
    }
  }, [hoursAgo, visibleCount]);

  // ── Rotate one match in at position 0 every tick ────────────────────────────
  const tick = useCallback(() => {
    setPool(currentPool => {
      if (currentPool.length === 0) return currentPool;
      const incoming = currentPool[poolIdxRef.current % currentPool.length];
      poolIdxRef.current++;
      setDisplayed(prev => {
        const next = [incoming, ...prev.slice(0, visibleCount - 1)];
        setNewestId(incoming.match_id);
        return next;
      });
      return currentPool;
    });
  }, [visibleCount]);

  // ── Bootstrap ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const safetyTimer = setTimeout(() => setLoading(false), 5000);
    fetchPool().finally(() => clearTimeout(safetyTimer));

    if (!autoRefresh) return () => clearTimeout(safetyTimer);

    const interval = setInterval(() => {
      tickCountRef.current++;
      if (tickCountRef.current % REFETCH_TICKS === 0) {
        fetchPool();
      } else {
        tick();
      }
    }, TICK_MS);

    return () => { clearInterval(interval); clearTimeout(safetyTimer); };
  }, [fetchPool, tick, autoRefresh]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const formatTimeAgo = (ts: string) => {
    const diffMins  = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    const diffHours = Math.floor(diffMins / 60);
    if (diffMins < 1)   return 'just now';
    if (diffMins < 60)  return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  const matchRingColor = (score: number) =>
    score >= 90 ? 'border-orange-500/70'   :
    score >= 85 ? 'border-orange-400/50' :
    score >= 80 ? 'border-cyan-500/50'   : 'border-emerald-500/40';

  const godColor = (score: number) =>
    score >= 80 ? 'text-emerald-400' :
    score >= 70 ? 'text-cyan-400'    :
    score >= 60 ? 'text-emerald-300' : 'text-yellow-400';

  const matchColor = (score: number) =>
    score >= 90 ? 'text-orange-400'  :
    score >= 85 ? 'text-orange-300'  :
    score >= 80 ? 'text-cyan-400'    : 'text-emerald-400';

  // ── Skeleton ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-2">
        {showHeader && <div className="h-3 bg-white/5 rounded w-1/2 animate-pulse mb-2" />}
        {[...Array(visibleCount)].map((_, i) => (
          <div key={i} className="h-12 bg-white/[0.04] rounded-xl animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────────────
  if (displayed.length === 0) {
    return (
      <div className="opacity-40 space-y-1">
        {showHeader && (
          <div className="flex items-center gap-2 text-white/30 text-xs mb-2">
            <span>🔥</span>
            <span className="uppercase tracking-wider">Recent Matches</span>
          </div>
        )}
        <div className="text-xs text-white/25 italic">Match engine warming up…</div>
      </div>
    );
  }

  // ── Feed ─────────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-1.5">
        {showHeader && (
          <div className="flex items-center gap-2 text-xs mb-2">
            <span className="text-orange-400">🔥</span>
            <span className="uppercase tracking-widest font-semibold text-white/50">Live Matches</span>
            {totalThisWeek != null && (
              <span className="text-white/25 ml-auto tabular-nums">
                {totalThisWeek.toLocaleString()} this week
              </span>
            )}
          </div>
        )}

        <div className="space-y-1 overflow-hidden">
          {displayed.map((match) => {
            const isNewest = match.match_id === newestId;
            return (
              <button
                key={match.match_id}
                onClick={() => setSelectedMatch(match)}
                className={[
                  'w-full text-left group',
                  'flex items-center gap-2.5 px-2.5 py-2',
                  'rounded-xl border transition-all duration-200',
                  'hover:bg-white/[0.06] hover:border-white/[0.12] active:scale-[0.98]',
                  isNewest
                    ? `bg-white/[0.04] animate-slideInFromTop ${matchRingColor(match.match_score)}`
                    : 'border-transparent bg-transparent',
                ].join(' ')}
              >
                {/* Score ring */}
                <div className={`flex-shrink-0 w-8 h-8 rounded-full border-2 flex items-center justify-center bg-black/30 ${matchRingColor(match.match_score)}`}>
                  <span className={`text-[10px] font-black font-mono leading-none ${matchColor(match.match_score)}`}>
                    {Math.round(match.match_score)}
                  </span>
                </div>

                {/* Names + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 truncate">
                    <span className="text-white/90 font-semibold text-xs truncate group-hover:text-white transition-colors">
                      {match.startup_name}
                    </span>
                    <span className="text-white/25 text-[10px] flex-shrink-0">→</span>
                    <span className="text-white/55 text-xs truncate group-hover:text-white/80 transition-colors">
                      {match.investor_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] font-mono font-bold ${godColor(match.startup_god_score)}`}>
                      GOD {match.startup_god_score}
                    </span>
                    <span className="text-white/15">·</span>
                    <span className="text-white/25 text-[10px]">{formatTimeAgo(match.created_at)}</span>
                  </div>
                </div>

                {/* Chevron */}
                <span className="flex-shrink-0 text-white/15 group-hover:text-white/40 transition-colors text-sm">›</span>
              </button>
            );
          })}
        </div>

        {/* Live pulse indicator */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-white/20 uppercase tracking-wider">Live · refreshes every 15s</span>
        </div>
      </div>

      {selectedMatch && (
        <MatchModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}
    </>
  );
}
