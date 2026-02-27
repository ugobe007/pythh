import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/apiConfig';

// ─── Types ───────────────────────────────────────────────────────────────────

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

// ─── Constants ───────────────────────────────────────────────────────────────

const POOL_SIZE     = 20;
const VISIBLE       = 5;
const TICK_MS       = 5000;
const REFETCH_TICKS = 36;   // 36 × 5s = ~3 min data refresh
const ROW_H         = 54;   // px — height of one row slot (includes gap)
const ANIM_MS       = 380;  // transition duration ms
const MAX_ROWS      = VISIBLE + 3; // hard cap — prevents unbounded accumulation

// ─── Waterfall row item ───────────────────────────────────────────────────────

interface RowItem {
  match: HotMatch;
  id: string;    // stable key = `{match_id}-{tickKey}` — unique per entry
  pos: number;   // -1 = above viewport, 0..(N-1) = visible, N = exiting below
}

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
  const [rows, setRows]                   = useState<RowItem[]>([]);
  const [newestId, setNewestId]           = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [selectedMatch, setSelectedMatch] = useState<HotMatch | null>(null);
  const [totalThisWeek, setTotalThisWeek] = useState<number | null>(null);

  const poolIdxRef   = useRef(0);
  const tickCountRef = useRef(0);
  // poolRef: always-current pool — avoids stale closure in tick()
  const poolRef      = useRef<HotMatch[]>([]);
  // tickKeyRef: monotonic counter appended to match_id → unique React keys
  // This is the core fix for the "garbled font" corruption bug:
  // when the same match_id re-enters after a pool reshuffle, giving it a new
  // key forces React to create a fresh DOM node instead of reusing the old one.
  const tickKeyRef   = useRef(0);

  const visibleCount = Math.max(1, limit);

  // ── Fetch pool ─────────────────────────────────────────────────────────────

  const fetchPool = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/hot-matches?limit_count=${POOL_SIZE}&hours_ago=${hoursAgo}`);
      if (!res.ok) throw new Error(`hot-matches ${res.status}`);
      const json = await res.json();

      const fetched: HotMatch[] | null = json.matches && json.matches.length > 0 ? json.matches : null;

      if (fetched && fetched.length > 0) {
        const shuffled = [...fetched].sort(() => Math.random() - 0.5);
        // Sync poolRef before resetting counters so tick() never reads stale data
        poolRef.current      = shuffled;
        tickKeyRef.current   = 0;
        poolIdxRef.current   = 0;
        tickCountRef.current = 0;
        setPool(shuffled);
        const initial = shuffled.slice(0, visibleCount);
        // Use tickKeyRef (not index i) for initial row ids — prevents the first
        // tick() from producing a key like `${match_id}-0` that collides with an
        // initial row, causing React to reuse the same DOM node (garbled text).
        const initialRows = initial.map((m) => ({
          match: m,
          id: `${m.match_id}-${tickKeyRef.current++}`,
          pos: initial.indexOf(m),
        }));
        setRows(initialRows);
        setNewestId(initialRows[0]?.id ?? null);
      }

      setLoading(false);

      if (json.totalThisWeek != null) setTotalThisWeek(json.totalThisWeek);
    } catch (err: unknown) {
      console.error('[HotMatchesFeed] fetch error:', { message: (err as any)?.message });
      setLoading(false);
    }
  }, [hoursAgo, visibleCount]);

  // ── Rotate one match in at position 0 every tick ─────────────────────────
  //
  // BUG FIX NOTES:
  //
  // Old code called setPool(currentPool => { ... setRows() ... setNewestId() ... })
  // — i.e., nested state mutations inside a state updater. React may defer or
  // batch these in unexpected ways, causing rows to desync from the pool.
  //
  // Old code used `id: incoming.match_id` as the row key. When the pool
  // reshuffles and the same match_id comes back around, rows[] got two entries
  // with the same key. React's reconciler reused the same DOM node for both,
  // producing garbled/overwritten text content. Very visible after ~3 min.
  //
  // Fix: read pool from poolRef (ref = always current, no closure staleness),
  // assign each row a unique id = `{match_id}-{tickKeyRef++}`, and cap rows
  // array at MAX_ROWS to prevent unbounded growth.

  const tick = useCallback(() => {
    const currentPool = poolRef.current;
    if (currentPool.length === 0) return;

    const idx      = poolIdxRef.current % currentPool.length;
    const incoming = currentPool[idx];
    poolIdxRef.current++;

    // Re-shuffle when we complete a full cycle so the order never repeats
    if (poolIdxRef.current % currentPool.length === 0) {
      const reshuffled = [...currentPool].sort(() => Math.random() - 0.5);
      poolRef.current = reshuffled;
      setPool(reshuffled);
    }

    // Unique key: `{match_id}-{tickKey}` — prevents duplicate-key DOM corruption
    const key = `${incoming.match_id}-${tickKeyRef.current++}`;
    setNewestId(key);

    // Step 1: place incoming above the viewport (pos = -1), cap array size
    setRows(prev => [
      { match: incoming, id: key, pos: -1 },
      ...prev.slice(0, MAX_ROWS - 1),
    ]);

    // Step 2: two rAF frames later, trigger CSS transition:
    //   incoming slides -1 → 0, all existing rows shift down +1
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setRows(prev =>
          prev.map(r =>
            r.id === key && r.pos === -1
              ? { ...r, pos: 0 }
              : r.id === key
              ? r
              : { ...r, pos: r.pos + 1 }
          )
        );
      });
    });

    // Step 3: after transition completes, prune rows that have scrolled out
    setTimeout(() => {
      setRows(prev => prev.filter(r => r.pos < visibleCount));
    }, ANIM_MS + 100);
  }, [visibleCount]);

  // ── Bootstrap ──────────────────────────────────────────────────────────────

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

  // ── Helpers ────────────────────────────────────────────────────────────────

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

  // ── Skeleton ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-0.5">
        {showHeader && <div className="h-2.5 bg-white/5 rounded w-1/2 animate-pulse mb-1.5" />}
        {[...Array(visibleCount)].map((_, i) => (
          <div key={i} className="h-9 bg-white/[0.04] rounded-lg animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    );
  }

  // ── Empty ──────────────────────────────────────────────────────────────────

  if (rows.length === 0) {
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

  // ── Feed ───────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="space-y-0.5">
        {showHeader && (
          <div className="flex items-center gap-1.5 text-xs mb-1.5">
            <span className="text-orange-400">🔥</span>
            <span className="uppercase tracking-widest font-semibold text-white/40 tracking-[0.12em]">Live Matches</span>
            {totalThisWeek != null && (
              <span className="text-white/25 ml-auto tabular-nums">
                {totalThisWeek.toLocaleString()} this week
              </span>
            )}
          </div>
        )}

        {/* Waterfall container — fixed height, rows absolutely positioned */}
        <div
          className="relative overflow-hidden"
          style={{ height: `${visibleCount * ROW_H}px` }}
        >
          {rows.map(({ match, id, pos }) => {
            const isNewest = id === newestId;
            const visible  = pos >= 0 && pos < visibleCount;
            return (
              <div
                key={id}
                style={{
                  position: 'absolute',
                  top: `${pos * ROW_H}px`,
                  left: 0,
                  right: 0,
                  height: `${ROW_H - 2}px`,
                  transition: `top ${ANIM_MS}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${ANIM_MS}ms ease`,
                  opacity: visible ? 1 : 0,
                  pointerEvents: visible ? 'auto' : 'none',
                }}
              >
                <button
                  onClick={() => setSelectedMatch(match)}
                  className={[
                    'w-full h-full text-left group',
                    'flex items-center gap-2 px-2',
                    'rounded-lg border transition-colors duration-200',
                    'hover:bg-white/[0.05] hover:border-white/[0.10] active:scale-[0.99]',
                    isNewest
                      ? 'bg-white/[0.04] border-orange-500/50'
                      : 'border-transparent',
                  ].join(' ')}
                >
                  {/* Score badge */}
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center bg-black/40 ${matchRingColor(match.match_score)}`}>
                    <span className={`text-[9px] font-black font-mono leading-none ${matchColor(match.match_score)}`}>
                      {Math.round(match.match_score)}
                    </span>
                  </div>

                  {/* Names + meta */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1 truncate leading-tight">
                      <span className="text-white/90 font-semibold text-[11px] truncate group-hover:text-white transition-colors">
                        {match.startup_name}
                      </span>
                      <span className="text-white/20 text-[9px] flex-shrink-0">→</span>
                      <span className="text-white/50 text-[11px] truncate group-hover:text-white/75 transition-colors">
                        {match.investor_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 overflow-hidden">
                      <span className={`text-[9px] font-mono font-bold tracking-tight flex-shrink-0 ${godColor(match.startup_god_score)}`}>
                        GOD {match.startup_god_score}
                      </span>
                      {match.investor_firm && match.investor_firm !== match.investor_name && (
                        <>
                          <span className="text-white/15 text-[9px] flex-shrink-0">·</span>
                          <span className="text-white/30 text-[9px] truncate max-w-[72px] flex-shrink">{match.investor_firm}</span>
                        </>
                      )}
                      {(match.startup_sectors || [])[0] && (
                        <>
                          <span className="text-white/15 text-[9px] flex-shrink-0">·</span>
                          <span className="text-cyan-400/50 text-[9px] truncate flex-shrink">{match.startup_sectors[0]}</span>
                        </>
                      )}
                      <span className="text-white/15 text-[9px] flex-shrink-0">·</span>
                      <span className="text-white/25 text-[9px] tabular-nums flex-shrink-0">{formatTimeAgo(match.created_at)}</span>
                    </div>
                  </div>

                  <span className="flex-shrink-0 text-white/15 group-hover:text-white/40 transition-colors text-xs">›</span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Live pulse indicator */}
        <div className="flex items-center gap-1.5 pt-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[10px] text-white/20 uppercase tracking-wider">Live · refreshes every 5s</span>
        </div>
      </div>

      {selectedMatch && (
        <MatchModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}
    </>
  );
}
