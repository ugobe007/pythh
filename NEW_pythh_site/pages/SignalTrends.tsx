/**
 * /signal-trends — PYTHH MARKET SCOREBOARD (Production)
 *
 * ══════════════════════════════════════════════════════════════════════
 * TRENDS INVARIANTS — DO NOT MODIFY WITHOUT READING: /PYTHH_TRENDS_INVARIANTS.md
 * ══════════════════════════════════════════════════════════════════════
 *
 * 1. GOD Score = default, deterministic baseline
 * 2. VC lenses = re-weighted models, NO randomness, NO editorial overrides
 * 3. Δ = rank delta (not score delta)
 * 4. Velocity = acceleration (not popularity)
 * 5. The shock of re-ordering IS the feature
 *
 * Role: Show founders how different top investors would rank the same
 * market — live. Each VC lens applies that investor's ACTUAL scoring
 * criteria so founders see the same startups ranked differently under
 * different investment philosophies.
 * ══════════════════════════════════════════════════════════════════════
 */
import { Helmet } from "react-helmet-async";
import { useState, useMemo, useRef, useEffect } from "react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import StartupCTA from "@/components/design/StartupCTA";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Flame,
  Zap,
  Users,
  RotateCcw,
  Star,
  GitBranch,
  ArrowUpRight,
} from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";
import HorizontalSignalChart from "@/components/HorizontalSignalChart";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StartupRaw {
  id: string;
  name: string;
  sectors: string | string[] | null;
  total_god_score: number | null;
  team_score: number | null;
  traction_score: number | null;
  market_score: number | null;
  product_score: number | null;
  vision_score: number | null;
  is_oversubscribed?: boolean | null;
  has_followon?: boolean | null;
  is_competitive?: boolean | null;
  is_bridge_round?: boolean | null;
  has_sector_pivot?: boolean | null;
  has_social_proof_cascade?: boolean | null;
  is_repeat_founder?: boolean | null;
  has_cofounder_exit?: boolean | null;
  psychological_multiplier?: number | null;
}

interface StartupRanked {
  id: string;
  rank: number;
  prevRank: number;
  name: string;
  sector: string;
  score: number;
  godScore: number;
  delta: number;
  velocity: number;
  signalFlags: SignalFlags;
  hotScoreTier: boolean;
  warmingScoreTier: boolean;
  psychBoost: boolean;
}

interface SignalFlags {
  is_oversubscribed?: boolean | null;
  has_followon?: boolean | null;
  is_competitive?: boolean | null;
  is_bridge_round?: boolean | null;
  has_sector_pivot?: boolean | null;
  has_social_proof_cascade?: boolean | null;
  is_repeat_founder?: boolean | null;
  has_cofounder_exit?: boolean | null;
}

// ─── VC Lenses ────────────────────────────────────────────────────────────────

interface VCLens {
  id: string;
  name: string;
  accent: string;
  weights: { team: number; traction: number; market: number; product: number; vision: number };
  description: string;
}

const VC_LENSES: VCLens[] = [
  {
    id: "god",
    name: "GOD Score",
    accent: "#22d3ee",
    weights: { team: 0.20, traction: 0.20, market: 0.20, product: 0.20, vision: 0.20 },
    description: "Balanced scoring across all dimensions",
  },
  {
    id: "yc",
    name: "YC",
    accent: "#f97316",
    weights: { team: 0.50, traction: 0.30, market: 0.05, product: 0.10, vision: 0.05 },
    description: "Team velocity & traction over polish",
  },
  {
    id: "sequoia",
    name: "Sequoia",
    accent: "#ef4444",
    weights: { team: 0.15, traction: 0.10, market: 0.50, product: 0.15, vision: 0.10 },
    description: "Market size & defensible moat",
  },
  {
    id: "a16z",
    name: "a16z",
    accent: "#a855f7",
    weights: { team: 0.15, traction: 0.10, market: 0.10, product: 0.55, vision: 0.10 },
    description: "Technical depth & platform potential",
  },
  {
    id: "founders-fund",
    name: "Founders Fund",
    accent: "#22c55e",
    weights: { team: 0.25, traction: 0.05, market: 0.10, product: 0.10, vision: 0.50 },
    description: "Contrarian vision & founder conviction",
  },
  {
    id: "lightspeed",
    name: "Lightspeed",
    accent: "#eab308",
    weights: { team: 0.15, traction: 0.55, market: 0.15, product: 0.10, vision: 0.05 },
    description: "Proven traction & market timing",
  },
  {
    id: "greylock",
    name: "Greylock",
    accent: "#6366f1",
    weights: { team: 0.10, traction: 0.25, market: 0.15, product: 0.35, vision: 0.15 },
    description: "Product-led growth & network effects",
  },
  {
    id: "accel",
    name: "Accel",
    accent: "#ec4899",
    weights: { team: 0.45, traction: 0.20, market: 0.15, product: 0.15, vision: 0.05 },
    description: "Strong team with proven execution",
  },
];

// ─── Scoring Logic ────────────────────────────────────────────────────────────

function calculateVCScore(s: StartupRaw, lens: VCLens): number {
  if (lens.id === "god") return s.total_god_score ?? 50;
  const team = Math.min(100, s.team_score ?? 50);
  const traction = Math.min(100, s.traction_score ?? 50);
  const market = Math.min(100, (s.market_score ?? 25) * 2);
  const product = Math.min(100, (s.product_score ?? 25) * 2);
  const vision = Math.min(100, (s.vision_score ?? 25) * 2);
  return Math.round(
    (team * lens.weights.team +
      traction * lens.weights.traction +
      market * lens.weights.market +
      product * lens.weights.product +
      vision * lens.weights.vision) * 10
  ) / 10;
}

function rankStartupsForLens(
  raw: StartupRaw[],
  lens: VCLens,
  prevRanks: Map<string, number>
): StartupRanked[] {
  const scored = raw.map((s) => ({ raw: s, vcScore: calculateVCScore(s, lens) }));
  scored.sort((a, b) => b.vcScore - a.vcScore);

  return scored.map((s, idx) => {
    const rank = idx + 1;
    const prevRank = prevRanks.get(s.raw.id) ?? rank;
    const delta = prevRank - rank;
    let velocity = 0;
    if (delta > 10) velocity = 3;
    else if (delta > 5) velocity = 2;
    else if (delta > 0) velocity = 1;
    else if (delta < -10) velocity = -3;
    else if (delta < -5) velocity = -2;
    else if (delta < 0) velocity = -1;

    let sector = "Unknown";
    if (s.raw.sectors) {
      sector = Array.isArray(s.raw.sectors)
        ? s.raw.sectors[0] || "Unknown"
        : s.raw.sectors.split(",")[0]?.trim() || "Unknown";
    }

    const god = s.raw.total_god_score ?? 0;
    const psych = s.raw.psychological_multiplier;

    return {
      id: s.raw.id,
      rank,
      prevRank,
      name: s.raw.name || "Unnamed",
      sector,
      score: s.vcScore,
      godScore: god,
      delta,
      velocity,
      signalFlags: {
        is_oversubscribed: s.raw.is_oversubscribed,
        has_followon: s.raw.has_followon,
        is_competitive: s.raw.is_competitive,
        is_bridge_round: s.raw.is_bridge_round,
        has_sector_pivot: s.raw.has_sector_pivot,
        has_social_proof_cascade: s.raw.has_social_proof_cascade,
        is_repeat_founder: s.raw.is_repeat_founder,
        has_cofounder_exit: s.raw.has_cofounder_exit,
      },
      hotScoreTier: god >= 85,
      warmingScoreTier: god >= 70 && god < 85,
      psychBoost: typeof psych === "number" && psych >= 1.08,
    };
  });
}

// ─── Small Components ─────────────────────────────────────────────────────────

function VelocityIndicator({ velocity, accent }: { velocity: number; accent: string }) {
  if (velocity === 0) return <span style={{ color: "oklch(0.4 0.01 264)" }}>→</span>;
  if (velocity > 0) {
    return (
      <span style={{ color: accent }}>{"↑".repeat(Math.min(velocity, 3))}</span>
    );
  }
  return <span style={{ color: "oklch(0.65 0.18 25)" }}>{"↓".repeat(Math.min(Math.abs(velocity), 3))}</span>;
}

function DeltaBadge({ delta, accent }: { delta: number; accent: string }) {
  if (delta === 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>
        <Minus size={10} />
      </span>
    );
  if (delta > 0)
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-semibold" style={{ color: accent }}>
        <TrendingUp size={10} />+{delta}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-semibold" style={{ color: "oklch(0.65 0.18 25)" }}>
      <TrendingDown size={10} />{delta}
    </span>
  );
}

function SignalBadges({ flags, hot, warming, psych }: {
  flags: SignalFlags;
  hot: boolean;
  warming: boolean;
  psych: boolean;
}) {
  const badges: React.ReactNode[] = [];
  if (hot) badges.push(<span key="hot" title="Hot (GOD ≥ 85)"><Flame size={11} style={{ color: "#f97316" }} /></span>);
  else if (warming) badges.push(<span key="warm" title="Warming (GOD 70–84)"><Zap size={11} style={{ color: "#eab308" }} /></span>);
  if (psych) badges.push(<span key="psych" title="Psychological multiplier active"><Star size={11} style={{ color: "#a855f7" }} /></span>);
  if (flags.is_repeat_founder) badges.push(<span key="repeat" title="Repeat founder"><Users size={11} style={{ color: "#22c55e" }} /></span>);
  if (flags.has_followon) badges.push(<span key="followon" title="Follow-on financing"><RotateCcw size={11} style={{ color: "#22d3ee" }} /></span>);
  if (flags.has_sector_pivot) badges.push(<span key="pivot" title="Sector pivot detected"><GitBranch size={11} style={{ color: "#ec4899" }} /></span>);
  if (!badges.length) return null;
  return <span className="inline-flex items-center gap-0.5 ml-1">{badges}</span>;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const SECTOR_FILTERS = [
  "All", "Fintech", "AI/ML", "SaaS", "Developer Tools",
  "Gaming", "Climate", "HealthTech", "Cybersecurity", "Consumer",
];

export default function SignalTrends() {
  const { isAuthenticated } = useAuth();

  const [activeLens, setActiveLens] = useState(VC_LENSES[0]);
  const [prevRanks, setPrevRanks] = useState<Map<string, number>>(new Map());
  const [hasUserChangedLens, setHasUserChangedLens] = useState(false);
  const [lensFlash, setLensFlash] = useState(false);
  const [activeSector, setActiveSector] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const prevLensId = useRef(VC_LENSES[0].id);

  // Pre-warm the Fly.io backend to reduce cold-start latency.
  useEffect(() => {
    fetch("/api/instant/health", { method: "GET", credentials: "include" }).catch(() => {});
  }, []);

  const { data, isLoading, isError, refetch } = trpc.startups.getRankings.useQuery(
    { limit: 100 },
    { staleTime: 5 * 60 * 1000 }
  );

  const rawStartups = data?.startups ?? [];
  const total = data?.total ?? 0;

  const ranked = useMemo(() => {
    if (!rawStartups.length) return [];
    let filtered = rawStartups;
    if (activeSector !== "All") {
      filtered = filtered.filter((s) => {
        const sectors = Array.isArray(s.sectors)
          ? s.sectors
          : typeof s.sectors === "string"
          ? [s.sectors]
          : [];
        return sectors.some((sec) =>
          String(sec).toLowerCase().includes(activeSector.toLowerCase())
        );
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      filtered = filtered.filter((s) =>
        (s.name || "").toLowerCase().includes(q)
      );
    }
    return rankStartupsForLens(filtered, activeLens, prevRanks);
  }, [rawStartups, activeLens, activeSector, searchQuery]);

  function handleLensChange(lens: VCLens) {
    if (lens.id === activeLens.id) return;
    setHasUserChangedLens(true);

    // Capture current ranks before switching so deltas are relative to previous lens
    if (ranked.length > 0) {
      const cur = new Map(ranked.map((s) => [s.id, s.rank]));
      setPrevRanks(cur);
    }

    setLensFlash(true);
    setTimeout(() => setLensFlash(false), 400);
    prevLensId.current = activeLens.id;
    setActiveLens(lens);
  }

  const moversUp = ranked.filter((s) => s.delta > 0).length;
  const moversDown = ranked.filter((s) => s.delta < 0).length;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.09 0.01 264)" }}>
      <Helmet>
        <title>Rankings — Startup VC Lens Scoreboard — Pythh.ai</title>
        <meta
          name="description"
          content="See how the same startups rank under different VC scoring philosophies — YC, Sequoia, a16z, Founders Fund and more. Live startup lens rankings powered by GOD score."
        />
        <meta property="og:title" content="Rankings — Pythh.ai" />
        <meta
          property="og:description"
          content="Live startup VC-lens scoreboard. Switch between investor models and watch the rankings shift in real time."
        />
        <meta property="og:url" content="https://pythh.ai/rankings" />
      </Helmet>

      {/* ── Navbar ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50"
        style={{
          backgroundColor: "oklch(0.11 0.01 264 / 0.95)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid oklch(0.2 0.01 264)",
        }}
      >
        <div className="container">
          <div className="flex items-center justify-between h-14">
            <Link href="/">
              <span
                className="font-display font-bold text-base text-white tracking-tight cursor-pointer"
              >
                pythh.ai
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-6">
              {[
                { href: "/rankings", label: "Rankings" },
                { href: "/investors", label: "Investors" },
                { href: "/platform", label: "Platform" },
                { href: "/methodology", label: "Methodology" },
              ].map(({ href, label }) => (
                <Link key={href} href={href}>
                  <span
                    className="text-sm font-medium cursor-pointer transition-colors"
                    style={{
                      color:
                        href === "/rankings"
                          ? activeLens.accent
                          : "oklch(0.65 0.01 264)",
                    }}
                  >
                    {label}
                  </span>
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <Link href="/account">
                  <span
                    className="text-sm font-medium cursor-pointer"
                    style={{ color: "oklch(0.696 0.17 162.48)" }}
                  >
                    Account
                  </span>
                </Link>
              ) : (
                <a
                  href={getLoginUrl()}
                  className="px-4 py-1.5 rounded-md text-sm font-semibold transition-colors"
                  style={{
                    backgroundColor: "oklch(0.696 0.17 162.48 / 0.15)",
                    color: "oklch(0.696 0.17 162.48)",
                    border: "1px solid oklch(0.696 0.17 162.48 / 0.3)",
                  }}
                >
                  Sign in
                </a>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Main Content ── */}
      <main className="container pt-24 pb-16">

        {/* Header */}
        <div className="mb-5">
          <div
            className="text-[11px] uppercase tracking-[1.5px] mb-2 flex items-center gap-2"
            style={{ color: "oklch(0.55 0.01 264)" }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: activeLens.accent }}
            />
            startup lens
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-2">
            Signal{" "}
            <span style={{ color: activeLens.accent, textShadow: `0 0 28px ${activeLens.accent}33` }}>
              Trends
            </span>
          </h1>
          <p className="text-sm" style={{ color: "oklch(0.55 0.01 264)" }}>
            How different investors score the same market
          </p>
        </div>

        {/* Horizontal signal chart */}
        <HorizontalSignalChart accent={activeLens.accent} />

        {/* Description */}
        <p className="text-sm leading-relaxed mb-6" style={{ color: "oklch(0.55 0.01 264)" }}>
          Rankings show how the same startups reorder under different investor scoring models.
          The default{" "}
          <span style={{ color: "#22d3ee" }}>GOD Score</span> is pythh's balanced baseline — equal
          weight across team, traction, market, product, and vision. Click any tab to see how a
          specific investor would rescore and reorder the same companies.{" "}
          <span style={{ color: "oklch(0.65 0.01 264)" }}>
            The delta between lenses is the signal.
          </span>
        </p>

        {/* ── GOD Score Science ── */}
        <div
          className="grid lg:grid-cols-2 gap-6 mb-8 p-5 rounded-2xl"
          style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
        >
          {/* Left: Formula */}
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-5" style={{ color: "oklch(0.45 0.01 264)" }}>
              GOD Score Formula
            </p>
            <div className="space-y-3 mb-5">
              {[
                { dim: "Team",     range: "0–20", weight: "Founder track record, team depth, cofounder dynamics",  color: "#a855f7" },
                { dim: "Traction", range: "0–20", weight: "Revenue signals, growth rate, customer evidence",       color: "#22d3ee" },
                { dim: "Market",   range: "0–20", weight: "TAM, sector timing, competitive landscape",            color: "#f97316" },
                { dim: "Product",  range: "0–20", weight: "Shipping velocity, differentiation, IP signals",       color: "#eab308" },
                { dim: "Vision",   range: "0–20", weight: "Thesis coherence, contrarian insight, conviction",     color: "#22c55e" },
              ].map(({ dim, range, weight, color }) => (
                <div key={dim} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold" style={{ color }}>{dim}</span>
                      <span className="text-xs font-mono" style={{ color: "oklch(0.48 0.01 264)" }}>{range}</span>
                    </div>
                    <p className="text-xs" style={{ color: "oklch(0.48 0.01 264)" }}>{weight}</p>
                  </div>
                </div>
              ))}
            </div>
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-lg"
              style={{ backgroundColor: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.25 0.01 264)" }}
            >
              <span className="text-2xl font-bold" style={{ color: "#22d3ee" }}>Σ</span>
              <div>
                <p className="text-sm font-semibold text-white">Total GOD Score = 0–100</p>
                <p className="text-xs" style={{ color: "oklch(0.48 0.01 264)" }}>
                  5 × 20 = 100 max · Behavioral multipliers shift scores above tier thresholds
                </p>
              </div>
            </div>
          </div>

          {/* Right: Behavioral multipliers + VC lens rationale */}
          <div>
            <p className="text-xs font-bold tracking-widest uppercase mb-5" style={{ color: "oklch(0.45 0.01 264)" }}>
              Behavioral Multipliers
            </p>
            <div className="space-y-2.5 mb-6">
              {[
                { flag: "Repeat Founder",        impact: "Prior exit or notable startup — conviction signal",    color: "#22c55e" },
                { flag: "Social Proof Cascade",   impact: "Viral signal from influential investors or founders",  color: "#22d3ee" },
                { flag: "Follow-on Financing",    impact: "Existing investors doubling down — confidence signal", color: "#a78bfa" },
                { flag: "Sector Pivot",           impact: "Intentional, high-signal direction change",           color: "#ec4899" },
                { flag: "Oversubscribed Round",   impact: "Demand exceeds supply — urgency multiplier",          color: "#f97316" },
              ].map(({ flag, impact, color }) => (
                <div key={flag} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: color }} />
                  <div className="flex-1">
                    <span className="text-xs font-semibold" style={{ color: "oklch(0.78 0.01 264)" }}>{flag}</span>
                    <span className="text-xs ml-2" style={{ color: "oklch(0.48 0.01 264)" }}>{impact}</span>
                  </div>
                </div>
              ))}
            </div>
            <div
              className="px-4 py-3 rounded-lg"
              style={{ backgroundColor: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.25 0.01 264)" }}
            >
              <p className="text-xs font-semibold text-white mb-2">Why VC Lenses?</p>
              <p className="text-xs leading-relaxed" style={{ color: "oklch(0.5 0.01 264)" }}>
                Different investors weight these 5 dimensions differently. YC prioritizes team and traction.
                Sequoia weights market size above all. a16z rewards product depth. Switch lenses above to see
                the same startups reorder under each philosophy — the delta between lenses is the real signal.
              </p>
            </div>
          </div>
        </div>

        {/* Live Stats Strip */}
        <div
          className="flex flex-wrap items-center gap-4 mb-5 py-3 px-4 rounded-xl"
          style={{
            border: "1px solid oklch(0.2 0.01 264)",
            backgroundColor: "oklch(0.12 0.01 264 / 0.6)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#22c55e" }} />
            <span className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>Live</span>
          </div>
          <div className="h-4 w-px" style={{ backgroundColor: "oklch(0.2 0.01 264)" }} />
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold text-white">{total.toLocaleString()}</span>
            <span className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>startups ranked</span>
          </div>
          <div className="h-4 w-px" style={{ backgroundColor: "oklch(0.2 0.01 264)" }} />
          <div className="flex items-center gap-1.5">
            <span className="text-lg font-bold" style={{ color: activeLens.accent }}>{VC_LENSES.length}</span>
            <span className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>investor models</span>
          </div>
          <div className="h-4 w-px" style={{ backgroundColor: "oklch(0.2 0.01 264)" }} />
          <div className="flex items-center gap-1.5">
            <span className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>Active lens</span>
            <span
              className="text-sm font-semibold"
              style={{ color: activeLens.accent, textShadow: `0 0 10px ${activeLens.accent}40` }}
            >
              {activeLens.name}
            </span>
          </div>
          {hasUserChangedLens && (moversUp > 0 || moversDown > 0) && (
            <>
              <div className="h-4 w-px ml-auto" style={{ backgroundColor: "oklch(0.2 0.01 264)" }} />
              <div className="flex items-center gap-3 text-xs">
                {moversUp > 0 && <span style={{ color: activeLens.accent }}>↑ {moversUp} rose</span>}
                {moversDown > 0 && <span style={{ color: "oklch(0.65 0.18 25)" }}>↓ {moversDown} fell</span>}
              </div>
            </>
          )}
        </div>

        {/* ── Sector + Search filters ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          {/* Search */}
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search startup name…"
            className="px-3 py-2 rounded-lg text-sm bg-transparent outline-none"
            style={{
              border: "1px solid oklch(0.22 0.01 264)",
              color: "oklch(0.85 0.01 264)",
              backgroundColor: "oklch(0.12 0.01 264)",
              minWidth: "200px",
            }}
          />
          {/* Sector pills */}
          <div className="flex flex-wrap gap-1.5">
            {SECTOR_FILTERS.map((sector) => {
              const active = activeSector === sector;
              return (
                <button
                  key={sector}
                  onClick={() => setActiveSector(sector)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                  style={{
                    backgroundColor: active ? `${activeLens.accent}20` : "oklch(0.13 0.01 264)",
                    color: active ? activeLens.accent : "oklch(0.55 0.01 264)",
                    border: active ? `1px solid ${activeLens.accent}50` : "1px solid oklch(0.2 0.01 264)",
                  }}
                >
                  {sector}
                </button>
              );
            })}
          </div>
        </div>

        {/* VC Lens Tabs */}
        <div className="mb-4">
          <div
            className="flex flex-wrap items-center gap-1.5 rounded-lg p-1.5"
            style={{
              backgroundColor: "oklch(0.12 0.01 264)",
              border: "1px solid oklch(0.22 0.01 264)",
            }}
          >
            {VC_LENSES.map((lens) => {
              const active = activeLens.id === lens.id;
              return (
                <button
                  key={lens.id}
                  onClick={() => handleLensChange(lens)}
                  title={lens.description}
                  className="px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200 whitespace-nowrap"
                  style={{
                    color: active ? lens.accent : "oklch(0.55 0.01 264)",
                    backgroundColor: active ? `${lens.accent}18` : "transparent",
                    borderBottom: active ? `2px solid ${lens.accent}` : "2px solid transparent",
                    boxShadow: active ? `0 0 12px ${lens.accent}25` : undefined,
                  }}
                >
                  {lens.name}
                </button>
              );
            })}
          </div>
          <p className="text-xs mt-2 ml-1" style={{ color: "oklch(0.45 0.01 264)" }}>
            {activeLens.description}
          </p>
        </div>

        {/* Table */}
        <div
          className="rounded-xl overflow-hidden transition-all duration-500"
          style={{
            border: lensFlash ? `1px solid ${activeLens.accent}80` : `1px solid oklch(0.2 0.01 264)`,
            boxShadow: lensFlash ? `0 0 30px ${activeLens.accent}20` : "none",
          }}
        >
          {/* Table Header */}
          <div
            className="grid gap-4 px-4 py-3 border-b text-xs font-bold tracking-widest"
            style={{
              gridTemplateColumns: "52px 1fr 140px 90px 60px 52px",
              color: "oklch(0.45 0.01 264)",
              borderColor: "oklch(0.18 0.01 264)",
              backgroundColor: "oklch(0.115 0.01 264)",
            }}
          >
            <div>#</div>
            <div>Startup</div>
            <div>Sector</div>
            <div style={{ color: activeLens.accent }}>{activeLens.name}</div>
            <div className="text-center">Δ</div>
            <div className="text-center">Vel</div>
          </div>

          {/* Table Body */}
          <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
            {isLoading ? (
              <div className="py-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="grid gap-4 px-4 py-3 border-b animate-pulse"
                    style={{
                      gridTemplateColumns: "52px 1fr 140px 90px 60px 52px",
                      borderColor: "oklch(0.16 0.01 264)",
                      opacity: 1 - i * 0.055,
                    }}
                  >
                    <div className="h-4 rounded" style={{ backgroundColor: "oklch(0.18 0.01 264)", width: "28px" }} />
                    <div className="h-4 rounded" style={{ backgroundColor: "oklch(0.18 0.01 264)", width: `${55 + (i % 4) * 12}%` }} />
                    <div className="h-4 rounded" style={{ backgroundColor: "oklch(0.18 0.01 264)", width: "80px" }} />
                    <div className="h-4 rounded" style={{ backgroundColor: "oklch(0.18 0.01 264)", width: "42px" }} />
                    <div className="h-4 rounded" style={{ backgroundColor: "oklch(0.18 0.01 264)", width: "24px" }} />
                    <div className="h-4 rounded" style={{ backgroundColor: "oklch(0.18 0.01 264)", width: "20px" }} />
                  </div>
                ))}
                <div className="flex items-center justify-center py-4 gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: activeLens.accent }} />
                  <span className="text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>Loading market data…</span>
                </div>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <span className="text-sm" style={{ color: "oklch(0.65 0.18 25)" }}>
                  Failed to load startup data
                </span>
                <button
                  onClick={() => refetch()}
                  className="text-xs px-3 py-1.5 rounded"
                  style={{
                    border: "1px solid oklch(0.3 0.01 264)",
                    color: "oklch(0.55 0.01 264)",
                  }}
                >
                  Retry
                </button>
              </div>
            ) : ranked.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <span className="text-sm" style={{ color: "oklch(0.45 0.01 264)" }}>
                  No startups found
                </span>
              </div>
            ) : (
              ranked.map((s) => (
                <div
                  key={s.id}
                  className="grid gap-4 px-4 py-3 border-b transition-colors hover:bg-white/[0.02] cursor-default"
                  style={{
                    gridTemplateColumns: "52px 1fr 140px 90px 60px 52px",
                    borderColor: "oklch(0.16 0.01 264)",
                    borderLeft: s.rank <= 3 ? `2px solid ${activeLens.accent}` : "2px solid transparent",
                    backgroundColor:
                      s.rank <= 3 ? `${activeLens.accent}06` : undefined,
                  }}
                >
                  {/* Rank */}
                  <div
                    className="font-mono text-sm tabular-nums self-center"
                    style={{
                      color:
                        s.rank <= 3
                          ? activeLens.accent
                          : s.rank <= 10
                          ? "oklch(0.75 0.01 264)"
                          : "oklch(0.45 0.01 264)",
                      fontWeight: s.rank <= 3 ? 700 : s.rank <= 10 ? 500 : 400,
                    }}
                  >
                    {s.rank}
                  </div>

                  {/* Name + Signal Badges */}
                  <div className="flex items-center min-w-0 self-center gap-1.5">
                    <span
                      className="truncate text-sm font-medium text-white"
                      title={s.name}
                    >
                      {s.name}
                    </span>
                    <SignalBadges
                      flags={s.signalFlags}
                      hot={s.hotScoreTier}
                      warming={s.warmingScoreTier}
                      psych={s.psychBoost}
                    />
                  </div>

                  {/* Sector */}
                  <div className="text-sm truncate self-center" style={{ color: "oklch(0.5 0.01 264)" }}>
                    {s.sector}
                  </div>

                  {/* Score */}
                  <div
                    className="font-mono text-sm tabular-nums font-semibold self-center"
                    style={{ color: activeLens.accent }}
                  >
                    {s.score.toFixed(1)}
                  </div>

                  {/* Delta */}
                  <div className="text-center self-center">
                    <DeltaBadge delta={s.delta} accent={activeLens.accent} />
                  </div>

                  {/* Velocity */}
                  <div className="text-center font-mono text-sm self-center">
                    <VelocityIndicator velocity={s.velocity} accent={activeLens.accent} />
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Table Footer */}
          <div
            className="px-4 py-3 border-t flex items-center justify-between"
            style={{ borderColor: "oklch(0.18 0.01 264)", backgroundColor: "oklch(0.115 0.01 264)" }}
          >
            <div className="text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>
              Showing top {ranked.length} of{" "}
              <span className="text-white font-medium">{total.toLocaleString()}</span> startups
            </div>
            <div className="text-xs" style={{ color: "oklch(0.35 0.01 264)" }}>
              Scoring by{" "}
              <span style={{ color: activeLens.accent }}>{activeLens.name}</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div
          className="mt-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-xl"
          style={{
            border: "1px solid oklch(0.22 0.01 264)",
            backgroundColor: "oklch(0.12 0.01 264)",
          }}
        >
          <div>
            <p className="text-sm text-white font-medium mb-1">
              See where you rank under each investor's model
            </p>
            <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>
              Get matched with VCs based on your sector, stage, and traction.{" "}
              <span style={{ color: "oklch(0.4 0.01 264)" }}>Free — no credit card.</span>
            </p>
          </div>
          <StartupCTA href="/activate" showArrow>
            Analyze my startup
          </StartupCTA>
        </div>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>
          <span className="flex items-center gap-1">
            <Flame size={11} style={{ color: "#f97316" }} /> Hot (GOD ≥ 85)
          </span>
          <span className="flex items-center gap-1">
            <Zap size={11} style={{ color: "#eab308" }} /> Warming (GOD 70–84)
          </span>
          <span className="flex items-center gap-1">
            <Star size={11} style={{ color: "#a855f7" }} /> Psychological multiplier
          </span>
          <span className="flex items-center gap-1">
            <Users size={11} style={{ color: "#22c55e" }} /> Repeat founder
          </span>
          <span className="flex items-center gap-1">
            <RotateCcw size={11} style={{ color: "#22d3ee" }} /> Follow-on financing
          </span>
        </div>
      </main>
    </div>
  );
}
