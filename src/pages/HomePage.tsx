/**
 * PYTHH HOME v1 — DESIGN & LAYOUT SPEC (Jan 2026)
 * ================================================
 * Design principles (locked):
 *   - Thin, calm, confident — Bloomberg / Supabase / Linear hybrid
 *   - No cards, no rounded boxes, no marketing panels
 *   - Tables > cards, with subtle glow halos
 *   - Always alive (buffered data, rotation, ticker)
 *   - Candy-first: investor & firm names visible
 *   - Minimal lines, maximum signal
 *
 * Page structure (exact order):
 *   [ HEADER ] → [ FIND INVESTOR SIGNALS ] → [ SUBMIT BAR ] → [ STATUS LINE ]
 *   → [ SIGNAL TICKER ] → [ LIVE MATCHES TABLE ] → [ ABOUT PYTHH ]
 *
 * Font: Inter / SF Pro / system-ui
 * Background: #0B0F14 (near-black)
 *
 * Glow semantics (locked):
 *   cyan = warming (movement)
 *   green = warm (strong momentum)
 *   orange = hot (surge)
 *   gray = neutral
 */

import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useLivePairings } from "@/hooks/useLivePairings";
import type { PlanTier } from "@/utils/plan";

// ═══════════════════════════════════════════════════════════════════════════
// STATIC BUFFER (always-on fallback — founders must never see empty tables)
// ═══════════════════════════════════════════════════════════════════════════

const STATIC_BUFFER = [
  { id: "1", firm: "Andreessen Horowitz", investor: "Marc Andreessen", signal: 8.7, delta: 0.4, god: 76, vc: 88, tension: 4, context: "AI agents" },
  { id: "2", firm: "Sequoia Capital", investor: "Roelof Botha", signal: 8.2, delta: 0.0, god: 73, vc: 84, tension: 3, context: "seed velocity" },
  { id: "3", firm: "Founders Fund", investor: "Keith Rabois", signal: 7.7, delta: -0.2, god: 70, vc: 80, tension: 3, context: "infra" },
  { id: "4", firm: "Greylock", investor: "Reid Hoffman", signal: 7.2, delta: -0.1, god: 67, vc: 76, tension: 2, context: "dev tooling" },
  { id: "5", firm: "Khosla Ventures", investor: "Vinod Khosla", signal: 6.7, delta: 0.2, god: 64, vc: 72, tension: 1, context: "climate" },
  { id: "6", firm: "Accel", investor: "Sameer Gandhi", signal: 6.5, delta: 0.3, god: 62, vc: 70, tension: 2, context: "B2B SaaS" },
  { id: "7", firm: "Benchmark", investor: "Bill Gurley", signal: 6.2, delta: 0.1, god: 60, vc: 68, tension: 2, context: "marketplaces" },
  { id: "8", firm: "Index Ventures", investor: "Mike Volpi", signal: 6.0, delta: -0.1, god: 58, vc: 66, tension: 1, context: "fintech" },
  { id: "9", firm: "Lightspeed", investor: "Jeremy Liew", signal: 5.8, delta: 0.2, god: 56, vc: 64, tension: 1, context: "consumer" },
  { id: "10", firm: "General Catalyst", investor: "Hemant Taneja", signal: 5.5, delta: 0.0, god: 54, vc: 62, tension: 1, context: "healthcare" },
  { id: "11", firm: "NEA", investor: "Scott Sandell", signal: 5.3, delta: 0.1, god: 52, vc: 60, tension: 1, context: "enterprise" },
  { id: "12", firm: "Bessemer", investor: "Byron Deeter", signal: 5.1, delta: 0.0, god: 50, vc: 58, tension: 1, context: "cloud" },
];

const STATIC_TAPE = [
  { firm: "Sequoia", topic: "AI agents", delta: 0.7, age: "5m" },
  { firm: "Founders Fund", topic: "infra", delta: 0.6, age: "3m" },
  { firm: "Greylock", topic: "dev tools", delta: 0.2, age: "14m" },
  { firm: "Khosla", topic: "climate", delta: 0.3, age: "8m" },
  { firm: "a16z", topic: "crypto", delta: 0.5, age: "2m" },
  { firm: "Accel", topic: "B2B SaaS", delta: 0.4, age: "6m" },
  { firm: "Benchmark", topic: "marketplaces", delta: 0.2, age: "11m" },
  { firm: "Index", topic: "fintech", delta: 0.1, age: "9m" },
];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function Home() {
  const navigate = useNavigate();
  const plan: PlanTier = "free";

  const [url, setUrl] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [sliceStart, setSliceStart] = useState(0);

  // Live data (falls back to static buffer if empty)
  const { data, lastUpdatedAt } = useLivePairings(plan, true, 60000);

  // Merge live data with static buffer (live takes priority, static fills gaps)
  const buffer = useMemo(() => {
    if (!data?.length) return STATIC_BUFFER;
    
    return data.slice(0, 200).map((p: any, i: number) => ({
      id: String(p?.id ?? `live-${i}`),
      firm: p?.firm_name ?? p?.firm ?? p?.investor_firm ?? p?.investor?.firm ?? STATIC_BUFFER[i % STATIC_BUFFER.length]?.firm ?? "—",
      investor: p?.investor_name ?? p?.name ?? p?.partner_name ?? STATIC_BUFFER[i % STATIC_BUFFER.length]?.investor ?? "Partner",
      signal: Number(p?.signal_score ?? p?.score ?? STATIC_BUFFER[i % STATIC_BUFFER.length]?.signal ?? 5),
      delta: Number(p?.delta ?? p?.signal_delta ?? STATIC_BUFFER[i % STATIC_BUFFER.length]?.delta ?? 0),
      god: Number(p?.god_score ?? STATIC_BUFFER[i % STATIC_BUFFER.length]?.god ?? 60),
      vc: Number(p?.vc_plus ?? p?.vc_score ?? STATIC_BUFFER[i % STATIC_BUFFER.length]?.vc ?? 70),
      tension: Math.min(5, Math.max(1, Math.round(Number(p?.tension ?? p?.fit_tier ?? 3)))),
      context: p?.context ?? p?.thesis_alignment ?? STATIC_BUFFER[i % STATIC_BUFFER.length]?.context ?? "signal",
    }));
  }, [data]);

  // Visible slice (12 rows per spec, rotates every 12s)
  const SLICE_SIZE = 12;
  const visibleSlice = useMemo(() => {
    const start = sliceStart % buffer.length;
    const slice = [];
    for (let i = 0; i < Math.min(SLICE_SIZE, buffer.length); i++) {
      slice.push(buffer[(start + i) % buffer.length]);
    }
    return slice;
  }, [buffer, sliceStart]);

  // Rotate slice every 12s
  useEffect(() => {
    const interval = setInterval(() => {
      setSliceStart((prev) => (prev + 1) % buffer.length);
    }, 12000);
    return () => clearInterval(interval);
  }, [buffer.length]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    navigate(`/app/signals?url=${encodeURIComponent(trimmed)}`);
  };

  const secondsAgo = lastUpdatedAt ? Math.round((Date.now() - lastUpdatedAt.getTime()) / 1000) : 7;
  const refreshMins = Math.max(1, 60 - Math.floor(secondsAgo / 60));

  return (
    <div 
      className="min-h-screen text-white"
      style={{ 
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif",
        backgroundColor: "#0B0F14",
      }}
    >
      {/* ═══════════════════════════════════════════════════════════════════
          1. HEADER (very thin, ~44px)
          Specs: Height ~44px, Font 12-13px, Opacity 60-70%, No nav clutter
      ═══════════════════════════════════════════════════════════════════ */}
      <header 
        className="h-[44px] flex items-center px-6"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="max-w-[1120px] w-full mx-auto flex items-baseline gap-2">
          <span className="text-[13px] font-semibold tracking-wide text-white/90">PYTHH</span>
          <span className="text-[12px] text-white/50">Signal Science</span>
        </div>
      </header>

      <main className="max-w-[1120px] mx-auto px-6 pt-8 pb-12">
        
        {/* ═══════════════════════════════════════════════════════════════════
            2. FIND INVESTOR SIGNALS (headline block)
            Specs: Title 18-20px semi-bold, Subtitle 13px 55% opacity, Left aligned
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="mb-5">
          <h1 className="text-[20px] font-semibold tracking-tight text-white/95">
            FIND INVESTOR SIGNALS
          </h1>
          <p className="text-[13px] text-white/55 mt-1">
            Discover which investors are aligned with you — now
          </p>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            3. SUBMIT BAR (primary action, the only CTA on the page)
            Specs: Height 44px, Single line, No border, Subtle inset glow when active
            States: Idle=faint white hairline, Active=cyan halo, Submitting=cyan+disabled
        ═══════════════════════════════════════════════════════════════════ */}
        <form onSubmit={handleSubmit} className="mb-4">
          <div
            className="flex items-center h-[44px] transition-all duration-200"
            style={{
              background: "rgba(255,255,255,0.02)",
              boxShadow: isFocused 
                ? "0 0 0 1px rgba(34,211,238,0.4), 0 0 20px rgba(34,211,238,0.15)"
                : "0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="https://yourstartup.com"
              className="flex-1 h-full bg-transparent outline-none px-4 text-[13px] text-white placeholder:text-white/30"
            />
            <button
              type="submit"
              disabled={!url.trim()}
              className="h-full px-6 text-[12px] font-semibold tracking-wider transition-opacity disabled:opacity-30"
              style={{
                background: "rgba(255,255,255,0.88)",
                color: "#0B0F14",
              }}
            >
              FIND →
            </button>
          </div>
        </form>

        {/* ═══════════════════════════════════════════════════════════════════
            4. STATUS LINE (thin system feedback)
            Specs: Font 12-12.5px, Inline dots (●), No icons, Neutral white/gray
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="text-[12px] text-white/45 mb-6 flex items-center gap-1.5 flex-wrap">
          <span className="text-emerald-400">●</span>
          <span>LIVE</span>
          <span className="text-white/30">·</span>
          <span>updated {secondsAgo}s ago</span>
          <span className="text-white/30">·</span>
          <span>mode: global</span>
          <span className="text-white/30">·</span>
          <span>buffer: warm</span>
          <span className="text-white/30">·</span>
          <span>refresh: {refreshMins}m</span>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            5. SIGNAL TICKER (horizontal, continuous CSS scroll)
            Specs: Height ~28-32px, Continuous horizontal scroll (never jumps)
            Separator: ▸, Tabular numbers
            Colors: cyan=movement, green=strong momentum, orange=hot surge, gray=neutral
        ═══════════════════════════════════════════════════════════════════ */}
        <div 
          className="h-[30px] mb-6 overflow-hidden relative"
          style={{ background: "rgba(255,255,255,0.02)" }}
        >
          <div className="ticker-track flex items-center h-full">
            {[...STATIC_TAPE, ...STATIC_TAPE, ...STATIC_TAPE].map((item, i) => (
              <span key={i} className="flex items-center shrink-0 px-3 text-[12px] tabular-nums">
                <span className="text-white/80 font-medium">{item.firm}</span>
                <span className={`ml-2 ${getTickerDeltaColor(item.delta)}`}>
                  {item.delta > 0 ? "+" : ""}{item.delta.toFixed(1)}
                </span>
                <span className="ml-2 text-white/40">{item.topic}</span>
                <span className="ml-2 text-white/25">{item.age}</span>
                <span className="ml-4 text-white/15">▸</span>
              </span>
            ))}
          </div>
          <style>{`
            .ticker-track {
              animation: ticker-scroll 40s linear infinite;
              width: max-content;
            }
            @keyframes ticker-scroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-33.333%); }
            }
          `}</style>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            6. LIVE MATCHES (BUFFERED TABLE) — CORE UI
            Section header: Font 12px, muted, informational
            Row height: 44px, Rectangular, No borders, Subtle halo glow only
            7 Columns: Investor/Firm | Signal | Δ | GOD | VC++ | σ | Action
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="mb-4">
          {/* Table section header */}
          <div className="flex items-center justify-between mb-2 text-[12px] text-white/40">
            <span>LIVE MATCHES (BUFFERED)</span>
            <span className="tabular-nums">
              slice {sliceStart + 1} / {buffer.length} · rotates 12s · refresh 60m
            </span>
          </div>

          {/* Table wrapper */}
          <div style={{ background: "rgba(255,255,255,0.015)" }}>
            {/* Table header */}
            <div 
              className="grid gap-3 px-4 py-2.5 text-[10px] text-white/35 uppercase tracking-wider"
              style={{ 
                gridTemplateColumns: "1fr 70px 55px 55px 55px 60px 60px",
                borderBottom: "1px solid rgba(255,255,255,0.04)",
              }}
            >
              <div>Investor / Firm</div>
              <div className="text-right">Signal</div>
              <div className="text-right">Δ</div>
              <div className="text-right">GOD</div>
              <div className="text-right">VC++</div>
              <div className="text-center">σ</div>
              <div className="text-right">Action</div>
            </div>

            {/* Table rows */}
            {visibleSlice.map((row, i) => {
              const glowStyle = getRowGlow(row.delta, row.tension);
              
              return (
                <div
                  key={row.id + "-" + i}
                  className="grid gap-3 px-4 h-[44px] items-center transition-all duration-300 hover:brightness-110"
                  style={{ 
                    gridTemplateColumns: "1fr 70px 55px 55px 55px 60px 60px",
                    boxShadow: glowStyle,
                  }}
                >
                  {/* Investor / Firm */}
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium text-white/90 truncate">{row.investor}</div>
                    <div className="text-[11px] text-white/40 truncate">{row.firm}</div>
                  </div>
                  
                  {/* Signal */}
                  <div className="text-[13px] text-right font-medium text-white/90 tabular-nums">
                    {row.signal.toFixed(1)}
                  </div>
                  
                  {/* Δ (Delta/Velocity) */}
                  <div className={`text-[12px] text-right tabular-nums ${getDeltaColor(row.delta)}`}>
                    {row.delta > 0 ? "+" : ""}{row.delta.toFixed(1)}
                  </div>
                  
                  {/* GOD (Position) */}
                  <div className="text-[12px] text-right text-white/55 tabular-nums">{row.god}</div>
                  
                  {/* VC++ (Optics) */}
                  <div className="text-[12px] text-right text-white/55 tabular-nums">{row.vc}</div>
                  
                  {/* σ (Surface Tension) */}
                  <div className="flex justify-center">
                    <TensionBars tension={row.tension} delta={row.delta} />
                  </div>
                  
                  {/* Action */}
                  <div className="text-right">
                    <button className="text-[11px] text-cyan-400/80 hover:text-cyan-300 transition-colors">
                      View
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            Column semantics helper (once, under table)
        ═══════════════════════════════════════════════════════════════════ */}
        <div className="text-[11px] text-white/30 mb-12">
          Signal = timing · GOD = position · VC++ = investor optics · σ = surface tension
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            7. ABOUT PYTHH (quiet, confident)
            Specs: Font 13px, Max width ~640px, No gradients, No hype words
        ═══════════════════════════════════════════════════════════════════ */}
        <section 
          className="pt-8"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <h2 className="text-[14px] font-medium text-white/70 tracking-wide mb-4">
            ABOUT PYTHH
          </h2>
          <p className="text-[13px] text-white/45 leading-relaxed max-w-[640px]">
            PYTHH is signal science for fundraising.<br />
            We track investor movement (Signal), measure market position (GOD),<br />
            and model investor optics (VC++) so founders can time outreach correctly.
          </p>
          <div className="mt-6 flex gap-6">
            <Link 
              to="/what-are-signals" 
              className="text-[12px] text-cyan-400/75 hover:text-cyan-300 transition-colors"
            >
              How signals work →
            </Link>
            <Link 
              to="/live" 
              className="text-[12px] text-cyan-400/75 hover:text-cyan-300 transition-colors"
            >
              See live radar →
            </Link>
          </div>
        </section>

      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ticker delta color: cyan=movement, green=strong, orange=hot
 */
function getTickerDeltaColor(delta: number): string {
  if (delta >= 0.6) return "text-orange-400";   // hot surge
  if (delta >= 0.3) return "text-emerald-400";  // strong momentum
  if (delta > 0) return "text-cyan-400";        // movement
  return "text-white/35";                       // neutral
}

/**
 * Table delta color
 */
function getDeltaColor(delta: number): string {
  if (delta >= 0.5) return "text-orange-400";
  if (delta > 0) return "text-cyan-400";
  if (delta < 0) return "text-white/35";        // gray, never red per spec
  return "text-white/40";
}

/**
 * Row glow: outer halo only, never borders, never fills
 * cyan=warming, green=warm, orange=hot, gray=neutral
 */
function getRowGlow(delta: number, tension: number): string {
  if (delta >= 0.5 && tension >= 4) {
    return "0 0 24px rgba(251,146,60,0.12)";    // orange (hot)
  }
  if (tension >= 4) {
    return "0 0 20px rgba(34,197,94,0.10)";     // green (warm)
  }
  if (delta > 0) {
    return "0 0 18px rgba(34,211,238,0.08)";    // cyan (warming)
  }
  return "none";                                 // gray (neutral)
}

// ═══════════════════════════════════════════════════════════════════════════
// TENSION BARS (σ) — Surface Tension Visualization
// Glow semantics: cyan=warming, green=warm, orange=hot
// ═══════════════════════════════════════════════════════════════════════════

function TensionBars({ tension, delta }: { tension: number; delta: number }) {
  const color =
    delta >= 0.5 && tension >= 4
      ? "bg-orange-400"       // hot
      : tension >= 4
      ? "bg-emerald-400"      // warm
      : delta > 0
      ? "bg-cyan-400"         // warming
      : "bg-white/30";        // neutral (gray)

  return (
    <div className="flex gap-[2px]">
      {[0, 1, 2, 3, 4].map((i) => (
        <div 
          key={i} 
          className={`w-[3px] h-[14px] ${i < tension ? color : "bg-white/10"}`}
        />
      ))}
    </div>
  );
}
