import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SubmitBar from "@/components/pythh-home/SubmitBar";
import StatusLine from "@/components/pythh-home/StatusLine";
import SignalLegend from "@/components/pythh-home/SignalLegend";
import SignalTicker from "@/components/pythh-home/SignalTicker";
import LiveMatchesTable, { LiveMatchRow, Heat } from "@/components/pythh-home/LiveMatchesTable";
import AboutPythh from "@/components/pythh-home/AboutPythh";
import LiveStats from "@/components/LiveStats";
import { useLivePairings } from "@/hooks/useLivePairings";

/**
 * PYTHH Home v1 (locked)
 * Header → Submit → Status → Ticker → Live Matches (buffered) → About
 *
 * LIVE SIGNALS: Fetches from API, rotates every 30 seconds, refreshes hourly
 * Falls back to static buffer if API fails (UI never blanks)
 */

// Static fallback buffer (never blank UI)
const STATIC_BUFFER: LiveMatchRow[] = [
  { id: "a16z", investorName: "Andreessen Horowitz", firm: "a16z", signal: 8.7, delta: +0.4, god: 76, vc: 88, tension: 4, heat: "warm", actionLabel: "View" },
  { id: "sequoia", investorName: "Sequoia Capital", firm: "Sequoia", signal: 9.1, delta: +0.7, god: 81, vc: 92, tension: 5, heat: "hot", actionLabel: "View" },
  { id: "foundersfund", investorName: "Founders Fund", firm: "Founders Fund", signal: 7.9, delta: +0.2, god: 69, vc: 86, tension: 3, heat: "warming", actionLabel: "View" },
  { id: "greylock", investorName: "Greylock", firm: "Greylock Partners", signal: 6.6, delta: -0.1, god: 63, vc: 78, tension: 2, heat: "neutral", actionLabel: "View" },
  { id: "khosla", investorName: "Khosla Ventures", firm: "Khosla", signal: 8.3, delta: +0.3, god: 72, vc: 83, tension: 4, heat: "warm", actionLabel: "View" },
  { id: "accel", investorName: "Accel", firm: "Accel", signal: 7.2, delta: +0.1, god: 67, vc: 80, tension: 3, heat: "warming", actionLabel: "View" },
  { id: "benchmark", investorName: "Benchmark", firm: "Benchmark", signal: 8.0, delta: +0.5, god: 74, vc: 85, tension: 4, heat: "warm", actionLabel: "View" },
  { id: "index", investorName: "Index Ventures", firm: "Index", signal: 7.5, delta: +0.2, god: 70, vc: 82, tension: 3, heat: "warming", actionLabel: "View" },
  { id: "lightspeed", investorName: "Lightspeed", firm: "Lightspeed VP", signal: 6.9, delta: -0.2, god: 65, vc: 77, tension: 2, heat: "neutral", actionLabel: "View" },
  { id: "nea", investorName: "NEA", firm: "New Enterprise", signal: 7.1, delta: +0.3, god: 68, vc: 79, tension: 3, heat: "warming", actionLabel: "View" },
  { id: "gc", investorName: "General Catalyst", firm: "GC", signal: 8.2, delta: +0.6, god: 75, vc: 87, tension: 4, heat: "warm", actionLabel: "View" },
  { id: "bessemer", investorName: "Bessemer VP", firm: "Bessemer", signal: 7.7, delta: +0.1, god: 71, vc: 81, tension: 3, heat: "warming", actionLabel: "View" },
];

const STATIC_TICKER = [
  { label: "Sequoia", delta: +0.7, topic: "AI agents", ageMin: 5, heat: "hot" as const },
  { label: "Founders Fund", delta: +0.6, topic: "infra", ageMin: 3, heat: "warm" as const },
  { label: "Greylock", delta: +0.2, topic: "dev tools", ageMin: 14, heat: "warming" as const },
  { label: "Khosla", delta: +0.3, topic: "climate", ageMin: 8, heat: "warming" as const },
  { label: "a16z", delta: +0.4, topic: "enterprise", ageMin: 6, heat: "warm" as const },
  { label: "Benchmark", delta: +0.5, topic: "marketplaces", ageMin: 4, heat: "warm" as const },
  { label: "Index", delta: +0.2, topic: "fintech", ageMin: 9, heat: "warming" as const },
];

// Helper to determine heat from signal/delta
function getHeat(signal: number, delta: number): Heat {
  if (signal >= 8.5 && delta >= 0.5) return "hot";
  if (signal >= 7.5 || delta >= 0.3) return "warm";
  if (delta > 0) return "warming";
  return "neutral";
}

export default function Home() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [sliceIndex, setSliceIndex] = useState(0);
  
  // Fetch LIVE signals from API (refresh every 60 minutes, enable polling)
  const { data: liveData, loading, error, lastUpdatedAt, refetch } = useLivePairings("free", true, 60000);

  // Transform live data to table row format, fallback to static
  const fullBuffer: LiveMatchRow[] = useMemo(() => {
    if (!liveData || liveData.length === 0) return STATIC_BUFFER;
    
    return liveData.map((p: any, i: number) => ({
      id: p.id || `live-${i}`,
      investorName: p.investor_name || p.name || p.firm_name || STATIC_BUFFER[i % STATIC_BUFFER.length]?.investorName || "Partner",
      firm: p.firm || p.firm_name || p.investor_firm || STATIC_BUFFER[i % STATIC_BUFFER.length]?.firm,
      signal: Number(p.signal_score || p.score || p.match_score || 7),
      delta: Number(p.delta || p.signal_delta || 0),
      god: Number(p.god_score || p.total_god_score || 65),
      vc: Number(p.vc_plus || p.vc_score || 75),
      tension: Math.min(5, Math.max(1, Math.round(Number(p.tension || p.fit_tier || 3)))),
      heat: getHeat(
        Number(p.signal_score || p.score || 7),
        Number(p.delta || p.signal_delta || 0)
      ),
      actionLabel: "View",
    }));
  }, [liveData]);

  // Slice size and rotation (show 6 rows, rotate every 30 seconds)
  const SLICE_SIZE = 6;
  const visibleSlice = useMemo(() => {
    const start = (sliceIndex * SLICE_SIZE) % fullBuffer.length;
    const slice: LiveMatchRow[] = [];
    for (let i = 0; i < SLICE_SIZE; i++) {
      slice.push(fullBuffer[(start + i) % fullBuffer.length]);
    }
    return slice;
  }, [fullBuffer, sliceIndex]);

  // Rotate slice every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setSliceIndex((prev) => (prev + 1) % Math.ceil(fullBuffer.length / SLICE_SIZE));
    }, 30000); // 30 seconds
    return () => clearInterval(interval);
  }, [fullBuffer.length]);

  // Ticker items (use live data if available, else static)
  const ticker = useMemo(() => {
    if (!liveData || liveData.length < 5) return STATIC_TICKER;
    return liveData.slice(0, 7).map((p: any) => ({
      label: p.firm || p.firm_name || p.investor_name || "Fund",
      delta: Number(p.delta || p.signal_delta || 0),
      topic: p.sector || p.thesis || p.context || "venture",
      ageMin: Math.floor(Math.random() * 15) + 1, // TODO: wire real age
      heat: getHeat(Number(p.signal_score || 7), Number(p.delta || 0)),
    }));
  }, [liveData]);

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    navigate(`/signal-matches?url=${encodeURIComponent(trimmed)}`);
  };

  // Compute system state from live data
  const systemState = loading ? "BUSY" : error ? "STALE" : "LIVE";
  const lastUpdatedAtMs = lastUpdatedAt?.getTime() || Date.now();
  const mode = "global";
  const bufferState = error ? "stale" : liveData?.length ? "warm" : "cold";
  const refreshMins = Math.max(1, 60 - Math.floor((Date.now() - lastUpdatedAtMs) / 60000));

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white">
      <div className="mx-auto max-w-[1120px] px-6 pt-5 pb-10">
        {/* =========================
            HEADER (thin)
        ========================== */}
        <div className="h-[44px] flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <div className="text-[12.5px] tracking-[0.28em] text-white/70">
              PYTHH
            </div>
            <div className="text-[12.5px] text-white/35">
              Signal Science
            </div>
          </div>
          <div className="text-[12.5px] text-white/35">
            {/* keep empty for v1; don't add nav noise */}
          </div>
        </div>

        {/* =========================
            TITLE (dominant + cyan glow)
        ========================== */}
        <div className="mb-4">
          <div
            className="text-[32px] leading-[1.05] font-semibold tracking-[-0.02em] text-white"
            style={{ 
              textShadow: "0 0 20px rgba(34,211,238,0.35), 0 0 40px rgba(34,211,238,0.15), 0 0 60px rgba(34,211,238,0.08)" 
            }}
          >
            FIND INVESTOR SIGNALS
          </div>
          <div className="text-[13px] text-white/50 mt-2">
            Discover which investors are aligned with you — now
          </div>
        </div>

        {/* =========================
            LIVE STATS (Supabase-style)
        ========================== */}
        <div className="mb-6 pb-6 border-b border-white/10">
          <LiveStats />
        </div>

        {/* =========================
            SUBMIT BAR
        ========================== */}
        <div className="mt-4">
          <SubmitBar
            value={url}
            onChange={setUrl}
            onSubmit={handleSubmit}
            isLoading={false}
          />
        </div>

        {/* =========================
            STATUS LINE
        ========================== */}
        <div className="mt-2">
          <StatusLine
            state={systemState}
            lastUpdatedAtMs={lastUpdatedAtMs}
            mode={mode}
            bufferState={bufferState}
            refreshMins={refreshMins}
          />
          <SignalLegend />
        </div>

        {/* =========================
            TICKER (horizontal)
        ========================== */}
        <div className="mt-4">
          <SignalTicker items={ticker} />
        </div>

        {/* =========================
            LIVE MATCHES TABLE (buffer)
        ========================== */}
        <div className="mt-6">
          <div className="flex items-center justify-between">
            <div className="text-[12px] tracking-[0.22em] text-white/55">
              LIVE MATCHES (BUFFERED)
            </div>
            <div className="text-[12px] text-white/35 tabular-nums">
              slice {sliceIndex + 1} / {Math.ceil(fullBuffer.length / SLICE_SIZE)}&nbsp;&nbsp;•&nbsp;&nbsp;rotates 30s&nbsp;&nbsp;•&nbsp;&nbsp;refresh 60m
            </div>
          </div>

          <div className="mt-3">
            <LiveMatchesTable
              rows={visibleSlice}
              onAction={(row) => {
                // v1: route to signal-matches (or investor reveal later)
                // For now keep the UI wired.
                navigate("/signal-matches");
              }}
            />
          </div>

          {/* One-line guidance (locked) */}
          <div className="mt-3 text-[12.5px] text-white/45">
            Signal = timing · GOD = position · VC++ = investor optics · σ = surface tension
          </div>
        </div>

        {/* =========================
            ABOUT
        ========================== */}
        <div className="mt-8">
          <AboutPythh />
        </div>
      </div>
    </div>
  );
}
