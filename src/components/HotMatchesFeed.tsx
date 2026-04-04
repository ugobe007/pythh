import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { API_BASE } from '../lib/apiConfig';
import { HotMatchLogo } from './FlameIcon';

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
  /** ticker = animated narrow feed; showcase = marketing grid of rich cards */
  variant?: 'ticker' | 'showcase';
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
      case 'Elite':     return 'text-emerald-300 border-emerald-500/40';
      case 'Excellent': return 'text-cyan-300 border-cyan-500/40';
      case 'Strong':    return 'text-emerald-400/90 border-emerald-500/35';
      default:          return 'text-white/60 border-white/20';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={handleBackdrop}
    >
      <div className="relative w-full max-w-sm bg-transparent border border-white/15 rounded-xl overflow-hidden animate-slideInFromTop">
        <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

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
          <div className="border border-white/12 rounded-lg p-3 space-y-2 bg-transparent">
            <div className="flex items-center justify-between">
              <span className="text-white font-semibold text-base">{match.startup_name}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-md border font-medium bg-transparent ${tierBadge(match.startup_tier)}`}>
                {match.startup_tier}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="text-[11px] text-white/45 border border-white/12 px-2 py-0.5 rounded-md bg-transparent">
                {match.startup_stage}
              </span>
              {(match.startup_sectors || []).slice(0, 3).map(s => (
                <span key={s} className="text-[11px] text-white/45 border border-white/12 px-2 py-0.5 rounded-md bg-transparent">
                  {s}
                </span>
              ))}
            </div>
          </div>

          {/* Signal intelligence CTA */}
          <a
            href={`/investor/signal-matches?q=${encodeURIComponent(match.startup_name)}`}
            className="block w-full text-center text-[11px] px-3 py-2 border border-amber-400/35 text-amber-300/90 rounded-lg bg-transparent hover:border-amber-400/60 transition-colors"
          >
            View Signal Intelligence →
          </a>

          {/* Connector */}
          <div className="flex items-center gap-2 text-white/20 text-xs px-1">
            <div className="flex-1 h-px bg-white/10" />
            <span>matched with</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Investor */}
          <div className="border border-white/12 rounded-lg p-3 space-y-1 bg-transparent">
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
                type="button"
                onClick={() => { navigate(`/investor/${match.investor_id}`); onClose(); }}
                className="flex-1 py-2.5 text-xs font-semibold rounded-lg border border-white/20 text-white/80 bg-transparent hover:border-white/35 transition-colors"
              >
                Investor Profile
              </button>
            )}
            <button
              type="button"
              onClick={() => { navigate('/signal-matches'); onClose(); }}
              className="flex-1 py-2.5 text-xs font-bold rounded-lg border border-orange-400/45 text-orange-100 bg-transparent hover:border-orange-300/70 transition-colors"
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
  variant = 'ticker',
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
  const showcaseSlots = variant === 'showcase' ? Math.min(Math.max(visibleCount, 1), 12) : visibleCount;

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

    if (variant === 'showcase') {
      const slow = setInterval(() => { tickCountRef.current++; fetchPool(); }, 60000);
      return () => { clearInterval(slow); clearTimeout(safetyTimer); };
    }

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
  }, [fetchPool, tick, autoRefresh, variant]);

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
    if (variant === 'showcase') {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-40 rounded-lg border border-white/[0.06] bg-transparent animate-pulse" />
          ))}
        </div>
      );
    }
    return (
      <div className="space-y-0.5">
        {showHeader && <div className="h-2.5 bg-white/5 rounded w-1/2 animate-pulse mb-1.5" />}
        {[...Array(visibleCount)].map((_, i) => (
          <div key={i} className="h-9 bg-white/[0.04] rounded-lg animate-pulse" style={{ opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    );
  }

  // ── Showcase grid (marketing) ─────────────────────────────────────────────
  if (variant === 'showcase') {
    const grid = pool.slice(0, showcaseSlots);
    if (grid.length === 0) {
      return (
        <div className="rounded-lg border border-white/10 px-8 py-16 text-center bg-transparent">
          <p className="text-zinc-500 text-sm">Match engine warming up — check back shortly.</p>
          <Link
            to="/signal-matches"
            className="mt-4 inline-block text-sm font-semibold text-amber-200/90 border-b border-amber-400/40 hover:border-amber-300 pb-0.5"
          >
            Analyze your startup →
          </Link>
        </div>
      );
    }
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
          {grid.map((match) => (
            <button
              key={match.match_id}
              type="button"
              onClick={() => setSelectedMatch(match)}
              className="group text-left rounded-lg border border-white/12 bg-transparent p-4 sm:p-4 transition-all duration-300 hover:border-white/22 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-400/35"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-zinc-500 mb-0.5">Startup</p>
                  <p className="text-base font-semibold text-white group-hover:text-amber-100/95 transition-colors leading-tight">
                    {match.startup_name}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(match.startup_sectors || []).slice(0, 2).map((s) => (
                      <span key={s} className="text-[10px] px-1.5 py-0.5 rounded border border-cyan-500/30 text-cyan-300/90 bg-transparent">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[9px] uppercase tracking-wider text-zinc-500">Match</span>
                  <span className={`text-2xl font-black font-mono tabular-nums leading-none mt-0.5 ${matchColor(match.match_score)}`}>
                    {Math.round(match.match_score)}
                  </span>
                </div>
              </div>
              <div className="h-px bg-gradient-to-r from-transparent via-white/12 to-transparent mb-3" />
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.12em] text-zinc-500 mb-0.5">Investor</p>
                  <p className="text-[13px] font-medium text-white/90 leading-snug">{match.investor_name}</p>
                  {match.investor_firm && (
                    <p className="text-[11px] text-zinc-500 mt-0.5 truncate max-w-[200px]">{match.investor_firm}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className={`text-xs font-mono font-bold ${godColor(match.startup_god_score)}`}>
                    GOD {match.startup_god_score}
                  </span>
                  <p className="text-[9px] text-zinc-600 mt-0.5 tabular-nums">{formatTimeAgo(match.created_at)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        {selectedMatch && (
          <MatchModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
        )}
      </>
    );
  }

  // ── Empty (ticker) ─────────────────────────────────────────────────────────

  if (rows.length === 0) {
    return (
      <div className="opacity-40 space-y-1">
        {showHeader && (
          <div className="flex items-center gap-2 text-white/30 text-xs mb-2">
            <HotMatchLogo size="xs" className="flex-shrink-0 opacity-90" aria-hidden />
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
            <HotMatchLogo size="xs" className="flex-shrink-0 opacity-90" aria-hidden />
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
                    'hover:border-white/15 active:scale-[0.99]',
                    isNewest
                      ? 'border-orange-400/35 bg-transparent'
                      : 'border-transparent bg-transparent',
                  ].join(' ')}
                >
                  {/* Score ring — stroke only */}
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full border-2 flex items-center justify-center bg-transparent ${matchRingColor(match.match_score)}`}>
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
          <span className="w-1.5 h-1.5 rounded-full border border-emerald-500/80 bg-transparent" />
          <span className="text-[10px] text-white/20 uppercase tracking-wider">Live · refreshes every 5s</span>
        </div>
      </div>

      {selectedMatch && (
        <MatchModal match={selectedMatch} onClose={() => setSelectedMatch(null)} />
      )}
    </>
  );
}
