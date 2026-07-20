/*
 * PYTHH.AI — HOME PAGE (v2)
 * Design: Obsidian Terminal — Data Noir
 * AI Agent: PYTHIA (Predictive Yield & Thesis Heuristic Intelligence Agent)
 * Sections: Nav → Hero → Agent Intro → Live Signals → Science → Testimonials → Newsletter → Footer
 */

import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { useLocation, Link } from "wouter";
import { toast } from "sonner";
import SharedNavbar from "@/components/SharedNavbar";
import SignalArtTeaser from "@/components/SignalArtTeaser";
const PythiaReveal = lazy(() => import("@/components/PythiaReveal"));
import PythiaRadarFeed from "@/components/PythiaRadarFeed";
import PythiaIcon from "@/components/PythiaIcon";
import StatStrip from "@/components/design/StatStrip";
import { LatestMatchPanel, useRecentMatches } from "@/components/RecentMatchesFeed";
import FilterTabs from "@/components/design/FilterTabs";
import InlineMeta from "@/components/design/InlineMeta";
import {
  G, CYAN, AMBER, GOLD, PURPLE, MUTED, DIM, BORDER, TEXT, PAGE, CARD,
  G_BORDER, G_SUBTLE, G_HOVER, BAR_GREY,
  deltaColor, godScoreColor,
} from "@/lib/designTokens";
import { type GrowthAssignment } from "@/lib/growthExperiment";
import { trackUrlSubmitted, getUtmParams, trackReturnVisitIfEligible } from "@/lib/funnelAttribution";
import {
  loadHeroExperiments,
  mergeHeroHeadlineCopy,
  trackHeroHeadlineExposure,
  trackHeroUrlSubmitted,
} from "@/lib/heroHeadlineExperiment";
import { trackFunnelEventOnce } from "@/lib/matchEngagement";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  buildLoginRedirectForSearch,
  shouldPromptSignInForNewSearch,
} from "@/lib/anonymousPreviewSession";
import {
  ArrowRight,
  ExternalLink,
  Mail,
  Activity,
  Eye,
  Target,
  CheckCircle2,
  Zap,
  Shield,
  ChevronRight,
  Database,
  FileText,
  Sparkles,
  TrendingUp,
} from "lucide-react";

// ─── Platform stats (live from /api/platform-stats) ─────────────────────────

interface PlatformStats {
  startups: number;
  startups_total?: number;
  investors: number;
  matches: number;
  matches_new_7d?: number;
  matches_new_30d?: number;
  signals?: number;
  computed_at?: string;
}

function formatMatchCompact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return String(n);
}

/** Exact full-table count for hero (no rounding down to 10K blocks). */
function formatMatchFull(n: number): string {
  return n.toLocaleString();
}

function formatVelocitySub(n: number): string {
  if (n <= 0) return "";
  if (n >= 1_000_000) return `${formatMatchCompact(n)} scored this week`;
  if (n >= 1_000) return `${Math.round(n / 1000)}K scored this week`;
  return `${n.toLocaleString()} scored this week`;
}

function usePlatformStats() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fetch("/api/platform-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setStats({
          startups: Number(d.startups) || 0,
          startups_total: Number(d.startups_total) || Number(d.startups) || 0,
          investors: Number(d.investors) || 0,
          matches: Number(d.matches) || 0,
          matches_new_7d: Number(d.matches_new_7d) || 0,
          matches_new_30d: Number(d.matches_new_30d) || 0,
          signals: Number(d.signals) || 0,
          computed_at: typeof d.computed_at === "string" ? d.computed_at : undefined,
        });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);
  return { stats, ready };
}

interface PortfolioHeadlineMetrics {
  verified_funded_picks?: number;
  verified_funded_rate_pct?: number;
  funded_picks?: number;
  total_picks?: number;
  active_picks?: number;
  successful_exits?: number;
}

function usePortfolioHeadlineMetrics() {
  const [metrics, setMetrics] = useState<PortfolioHeadlineMetrics | null>(null);
  useEffect(() => {
    fetch("/api/portfolio/metrics")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMetrics(d?.metrics ?? null))
      .catch(() => {});
  }, []);
  return metrics;
}

interface SignalProof {
  flagged: number;
  unicorns_now: number;
  tier_500m_now: number;
  unicorn_hit_rate_pct: number;
  median_lead_months: number | null;
  marquee: { name: string; current_valuation_usd: number }[];
}

function useSignalProof() {
  const [proof, setProof] = useState<SignalProof | null>(null);
  useEffect(() => {
    fetch("/api/signal-proof")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && !d.error) setProof(d); })
      .catch(() => {});
  }, []);
  return proof;
}

// Predictive track-record bar — the Oracle's foresight as data-backed social proof.
function SignalProofBar() {
  const proof = useSignalProof();
  if (!proof || !proof.unicorns_now) return null;
  const stats = [
    { value: `${proof.unicorns_now}`, label: "unicorns flagged", sub: "now worth $1B+", color: CYAN },
    { value: `${proof.unicorn_hit_rate_pct}%`, label: "unicorn hit rate", sub: `${proof.flagged} companies flagged`, color: CYAN },
    { value: proof.median_lead_months != null ? `${proof.median_lead_months}mo` : "—", label: "median lead time", sub: "before today's valuation", color: G },
    { value: `${proof.tier_500m_now}`, label: "flagged ≥ $500M", sub: "and climbing", color: G },
  ];
  return (
    <section className="border-y" style={{ borderColor: "oklch(0.14 0.01 264)", backgroundColor: "oklch(0.085 0.01 264)" }}>
      <div className="container py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <p className="text-[11px] font-mono uppercase tracking-widest flex-shrink-0" style={{ color: CYAN }}>
            The Oracle&apos;s predictive track record
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-4 flex-1 lg:max-w-3xl">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="font-display font-bold text-xl md:text-2xl tabular-nums" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs font-medium" style={{ color: "oklch(0.85 0.005 264)" }}>{s.label}</div>
                <div className="text-[10px] font-mono" style={{ color: DIM }}>{s.sub}</div>
              </div>
            ))}
          </div>
        </div>
        {proof.marquee && proof.marquee.length > 0 && (
          <p className="text-[10px] font-mono mt-4" style={{ color: DIM }}>
            Flagged early ·{" "}
            {proof.marquee.map((m, i) => (
              <span key={m.name}>
                {i > 0 ? "  ·  " : ""}
                <span style={{ color: "oklch(0.7 0.005 264)" }}>{m.name}</span>
              </span>
            ))}
          </p>
        )}
      </div>
    </section>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface InvestorSignal {
  name: string;
  firm: string;
  signal: number;
  delta: number;
  god: number;
  vcpp: number;
  sector: string;
}

// ─── Data ────────────────────────────────────────────────────────────────────

const INVESTOR_SIGNALS: InvestorSignal[] = [
  { name: "Niko Bonatsos", firm: "General Catalyst", signal: 8.6, delta: -0.2, god: 79, vcpp: 90, sector: "AI/ML" },
  { name: "Rebecca Kaden", firm: "Union Square Ventures", signal: 7.9, delta: -0.1, god: 73, vcpp: 83, sector: "SaaS" },
  { name: "Kirsten Green", firm: "Forerunner Ventures", signal: 7.9, delta: 0.3, god: 73, vcpp: 83, sector: "FinTech" },
  { name: "Michael Chen", firm: "Andreessen Horowitz", signal: 7.7, delta: -0.1, god: 71, vcpp: 81, sector: "AI/ML" },
  { name: "Tomasz Tunguz", firm: "Theory Ventures", signal: 7.5, delta: 0.5, god: 69, vcpp: 79, sector: "SaaS" },
  { name: "Stephanie Zhan", firm: "Sequoia Capital", signal: 7.4, delta: -0.2, god: 68, vcpp: 78, sector: "DeepTech" },
  { name: "Sarah Guo", firm: "Conviction Partners", signal: 7.3, delta: 0.4, god: 67, vcpp: 77, sector: "AI/ML" },
  { name: "Elad Gil", firm: "Color Capital", signal: 7.1, delta: 0.1, god: 65, vcpp: 75, sector: "BioTech" },
];

const SECTORS = ["All", "AI/ML", "SaaS", "FinTech", "BioTech", "SpaceTech", "DeepTech", "Climate"];

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useIntersectionObserver(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setIsVisible(true); observer.disconnect(); } },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, isVisible };
}

function useCountUp(target: number, duration = 1500, isVisible = false, decimals = 0) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!isVisible) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(parseFloat(start.toFixed(decimals)));
    }, 16);
    return () => clearInterval(timer);
  }, [isVisible, target, duration, decimals]);
  return count;
}

// ─── Shared Components ───────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
        <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
      </span>
      <span className="section-label" style={{ color: "oklch(0.696 0.17 162.48)" }}>LIVE</span>
    </span>
  );
}

function SignalBar({ value, max = 10, color = "emerald" }: { value: number; max?: number; color?: "emerald" | "amber" }) {
  const pct = (value / max) * 100;
  const barColor = color === "emerald" ? "oklch(0.696 0.17 162.48)" : "oklch(0.769 0.188 70.08)";
  return (
    <div className="h-1 w-16 rounded-full" style={{ backgroundColor: "oklch(0.25 0.01 264)" }}>
      <div className="h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
    </div>
  );
}

// ─── Hero results preview (right panel — show, don't ask) ─────────────────────

// HeroResultsPreview moved to components/HeroResultsPreview.saved.tsx (re-enable when needed)

// ─── Hero Section ─────────────────────────────────────────────────────────────


function HeroSection({
  platformStats,
  platformStatsReady,
  portfolioMetrics,
}: {
  platformStats: PlatformStats | null;
  platformStatsReady: boolean;
  portfolioMetrics: PortfolioHeadlineMetrics | null;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  const [founderExperiment, setFounderExperiment] = useState<GrowthAssignment | null>(null);
  const [headlineExperiment, setHeadlineExperiment] = useState<GrowthAssignment | null>(null);
  const [, navigate] = useLocation();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    loadHeroExperiments()
      .then(({ entry, headline }) => {
        setFounderExperiment(entry);
        setHeadlineExperiment(headline);
        trackHeroHeadlineExposure(headline, '/');
      })
      .catch(() => {});
  }, []);

  // Clear any stale session so returning visitors don't get auto-sent to scanning
  useEffect(() => {
    sessionStorage.removeItem("pythia_url");
    sessionStorage.removeItem("pythia_email");
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError(true);
      return;
    }
    setError(false);
    const normalized = url.trim().startsWith("http") ? url.trim() : `https://${url.trim()}`;
    if (!isAuthenticated && shouldPromptSignInForNewSearch(normalized)) {
      sessionStorage.setItem("pythia_url", normalized);
      navigate(buildLoginRedirectForSearch(normalized));
      return;
    }
    sessionStorage.setItem("pythia_url", normalized);
    trackUrlSubmitted(normalized, "home_hero", founderExperiment);
    trackHeroUrlSubmitted(normalized, "home_hero", headlineExperiment);
    navigate(`/matches?url=${encodeURIComponent(normalized)}`);
  };

  const matchCount = platformStats?.matches ?? 0;
  const matchesNew7d = platformStats?.matches_new_7d ?? 0;
  const signalCount = platformStats?.signals ?? 0;
  const startupCount = platformStats?.startups ?? 0;
  const investorCount = platformStats?.investors ?? 0;
  const entry = founderExperiment?.schema?.entry as string | undefined;
  const previewFirst = entry === 'url_with_preview';
  const { headline: heroHeadline, subline: heroSubline, cta: heroCta } = mergeHeroHeadlineCopy(
    founderExperiment,
    headlineExperiment,
  );
  const formLabel = previewFirst ? 'Your startup URL' : 'Submit your startup URL';
  const { matches: recentMatches, loading: recentLoading } = useRecentMatches(1);
  const latestMatch = recentMatches[0] ?? null;

  const urlForm = () => (
    <form
      id="hero-cta"
      onSubmit={handleSubmit}
      className="w-full rounded-xl"
      style={{
        background: CARD,
        border: `1px solid ${error ? "rgba(248,113,113,0.6)" : BORDER}`,
        padding: "1.25rem 1.25rem 1.1rem",
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="text-[10px] font-mono font-semibold tracking-widest uppercase" style={{ color: G }}>
          {formLabel}
        </p>
        <span
          className="text-[10px] font-mono px-2 py-0.5 rounded-full"
          style={{ color: AMBER, border: "1px solid oklch(0.769 0.188 70.08 / 0.35)", background: "oklch(0.769 0.188 70.08 / 0.08)" }}
        >
          ~20 sec
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <div
          className="flex items-center gap-3 px-4 py-3.5 rounded-lg min-w-0 transition-all"
          style={{
            backgroundColor: "oklch(0.09 0.01 264)",
            border: `1px solid ${error ? "rgba(248,113,113,0.5)" : BORDER}`,
          }}
        >
          <ExternalLink size={15} className="flex-shrink-0" style={{ color: error ? "#f87171" : DIM }} />
          <input
            type="text"
            placeholder="your-startup.com"
            value={url}
            onChange={(e) => { setUrl(e.target.value); if (error) setError(false); }}
            className="flex-1 min-w-0 bg-transparent text-sm outline-none placeholder:opacity-40"
            style={{ color: TEXT }}
          />
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 w-full px-6 py-3.5 rounded-lg text-sm font-semibold font-mono transition-all"
          style={{
            background: "transparent",
            color: G,
            border: `1px solid ${G_BORDER}`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = G_SUBTLE;
            e.currentTarget.style.borderColor = G;
            e.currentTarget.style.color = G_HOVER;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.borderColor = G_BORDER;
            e.currentTarget.style.color = G;
          }}
        >
          {heroCta}
          <ArrowRight size={15} />
        </button>
      </div>

      {error && (
        <p className="text-xs mt-3" style={{ color: "#f87171" }}>Enter your startup URL to continue.</p>
      )}
      <p className="text-[10px] mt-3 text-center" style={{ color: DIM }}>
        No credit card · Preview free ·{' '}
        <Link href="/signup/founder" className="underline hover:no-underline" style={{ color: G }}>
          Sign up free
        </Link>
      </p>
    </form>
  );

  return (
    <section
      className="relative pt-16 pb-12 lg:pb-16 overflow-hidden"
      style={{
        backgroundColor: PAGE,
        backgroundImage:
          "radial-gradient(ellipse 50% 40% at 50% 0%, oklch(0.696 0.17 162.48 / 0.06) 0%, transparent 60%)",
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.02] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.6 0.01 264) 1px, transparent 1px), linear-gradient(90deg, oklch(0.6 0.01 264) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="container relative z-10 max-w-[1180px] mx-auto px-6 py-8 lg:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 xl:gap-14 items-center">

          {/* Left — pitch; min-w-0 keeps headline inside the grid column */}
          <div className="flex flex-col justify-center text-left w-full min-w-0 max-w-[560px] mx-auto lg:mx-0 lg:ml-auto lg:pr-6 xl:pr-10 order-2 lg:order-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-4">
              <span
                className="inline-flex items-center gap-2 text-[11px] font-mono font-semibold tracking-widest uppercase px-3 py-1.5 rounded-full"
                style={{ color: G, border: `1px solid ${G_BORDER}`, background: G_SUBTLE }}
              >
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: G }} />
                Investor Intelligence · Live
              </span>
              <p className="text-sm font-bold font-mono" style={{ color: G }}>
                {platformStatsReady && matchCount > 0 ? (
                  <>
                    {formatMatchFull(matchCount)}+ investor matches
                    <span className="text-xs font-normal ml-2 hidden sm:inline" style={{ color: DIM }}>
                      {matchesNew7d > 0 ? `· ${formatVelocitySub(matchesNew7d)}` : "· updated daily"}
                    </span>
                  </>
                ) : (
                  <span className="inline-block h-4 w-40 rounded animate-pulse" style={{ backgroundColor: G_SUBTLE }} />
                )}
              </p>
            </div>

            <h1
              className="font-display font-bold leading-[1.12] mb-4"
              style={{ fontSize: "clamp(2rem, 3.4vw, 3.35rem)", color: TEXT, letterSpacing: "-0.04em" }}
            >
              {previewFirst ? (
                <span className="block">{heroHeadline}</span>
              ) : (
                <>
                  <span className="block">You build the company.</span>
                  <span className="block">
                    <span style={{ color: TEXT }}>Pythh runs the </span>
                    <span style={{ color: G_HOVER }}>raise</span>
                    <span style={{ color: TEXT }}>.</span>
                  </span>
                </>
              )}
            </h1>

            <p
              className="text-base sm:text-lg leading-relaxed mb-5 max-w-[52ch]"
              style={{ color: MUTED }}
            >
              {previewFirst ? heroSubline : (
                <>
                  Submit your URL. Oracle analyzes readiness, qualifies investors,
                  and runs outreach toward qualified meetings.
                </>
              )}
            </p>

            <a
              href="/portfolio"
              className="inline-flex items-center gap-2 text-sm font-semibold mb-5 transition-colors"
              style={{ color: G }}
            >
              See the Oracle&apos;s track record <ArrowRight size={14} />
            </a>

            <p className="text-xs leading-relaxed" style={{ color: DIM }}>
              {platformStatsReady && startupCount > 0 ? (
                <>
                  {startupCount.toLocaleString()}+ startups scored · {investorCount.toLocaleString()}+ investors mapped · {formatMatchFull(matchCount)}+ pre-computed matches
                  {matchesNew7d > 0 && (
                    <span style={{ color: G }}> · {formatVelocitySub(matchesNew7d)}</span>
                  )}
                  {portfolioMetrics?.verified_funded_picks != null && (
                    <>
                      {" · "}
                      <span style={{ color: G }}>
                        {portfolioMetrics.verified_funded_picks} verified funded
                        {portfolioMetrics.verified_funded_rate_pct != null
                          ? ` (${portfolioMetrics.verified_funded_rate_pct}%)`
                          : ""}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="inline-block h-3 w-56 max-w-full rounded animate-pulse" style={{ backgroundColor: "oklch(0.2 0.01 264)" }} />
              )}
            </p>
          </div>

          {/* Right — CTA + live match */}
          <div className="flex flex-col justify-center gap-3.5 w-full min-w-0 max-w-[500px] mx-auto lg:mx-0 lg:mr-auto lg:pl-6 xl:pl-10 order-1 lg:order-2">
            {urlForm()}
            <LatestMatchPanel match={latestMatch} loading={recentLoading} size="hero" />
          </div>

        </div>
      </div>
    </section>
  );
}

const HOW_IT_WORKS_STEPS = [
  {
    num: "01",
    icon: Zap,
    accent: G,
    title: "Submit your URL",
    body: "Pythh reads your public site, extracts signals, scores your startup across 5 dimensions, and returns aligned investors in seconds.",
  },
  {
    num: "02",
    icon: TrendingUp,
    accent: AMBER,
    title: "Close the gaps",
    body: "Answer focused questions. The wizard identifies your weakest GOD score dimensions and shows you exactly what to fix and when.",
  },
  {
    num: "03",
    icon: FileText,
    accent: G_HOVER,
    title: "Build your term sheet",
    body: "Acknowledge tasks, set deadlines, submit proof. Your commitment doc becomes an investment memo — ready to send to matched investors.",
  },
] as const;

function HowItWorksSection() {
  return (
    <section className="border-t py-14 lg:py-16" style={{ borderColor: BORDER, backgroundColor: PAGE }}>
      <div className="container max-w-[960px] mx-auto px-6">
        <p className="text-center text-[11px] font-mono tracking-widest uppercase mb-8" style={{ color: DIM }}>
          How it works
        </p>
        <div className="grid gap-px rounded-xl overflow-hidden" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", backgroundColor: BORDER }}>
          {HOW_IT_WORKS_STEPS.map(({ num, icon: Icon, accent, title, body }) => (
            <div key={num} className="p-6 flex flex-col gap-3" style={{ backgroundColor: PAGE }}>
              <div className="flex items-center gap-2.5">
                <span className="text-[10px] font-mono" style={{ color: DIM }}>{num}</span>
                <span className="w-7 h-7 rounded-md flex items-center justify-center" style={{ border: `1px solid ${accent}33`, background: `${accent}14` }}>
                  <Icon size={14} style={{ color: accent }} />
                </span>
              </div>
              <h3 className="font-display font-bold text-base" style={{ color: TEXT }}>{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TermSheetSection() {
  const [, navigate] = useLocation();
  const commitments = [
    { task: "Add a technical co-founder", status: "completed", impact: "+18 GOD pts", component: "Team" },
    { task: "Sign your first paying customer", status: "acknowledged", impact: "+14 GOD pts", component: "Traction", deadline: "Jun 30" },
    { task: 'Write your "Why Now" in 2 sentences', status: "pending", impact: "+7 GOD pts", component: "Market" },
  ];

  return (
    <section
      className="border-t py-14 lg:py-16"
      style={{
        borderColor: BORDER,
        background: `linear-gradient(180deg, oklch(0.696 0.17 162.48 / 0.04) 0%, ${PAGE} 60%)`,
      }}
    >
      <div className="container max-w-[1040px] mx-auto px-6 grid gap-10 lg:grid-cols-2 items-center">
        <div>
          <span
            className="inline-flex items-center gap-1.5 text-[10px] font-mono tracking-widest uppercase mb-4 px-3 py-1 rounded-full"
            style={{ color: AMBER, border: `1px solid oklch(0.769 0.188 70.08 / 0.3)`, background: "oklch(0.769 0.188 70.08 / 0.08)" }}
          >
            <Sparkles size={10} />
            New — Commitment Wizard
          </span>
          <h2 className="font-display font-bold text-2xl sm:text-3xl leading-tight mb-4" style={{ color: TEXT, letterSpacing: "-0.03em" }}>
            Pythh builds your term sheet — aligned with your investor profiles.
          </h2>
          <p className="text-sm leading-relaxed mb-4" style={{ color: MUTED }}>
            After matching, the wizard analyzes your GOD score gaps and gives you a prioritized list of what to fix. You acknowledge each task, set a deadline, and submit proof.
          </p>
          <p className="text-sm leading-relaxed mb-6" style={{ color: MUTED }}>
            When tasks are complete, your commitment document upgrades from provisional to a full investment memo you can send to matched investors.
          </p>
          <button
            type="button"
            onClick={() => navigate("/activate")}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            style={{ border: `1px solid ${G_BORDER}`, color: G, background: G_SUBTLE }}
          >
            Start your readiness doc <ArrowRight size={14} />
          </button>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${BORDER}`, background: CARD }}>
          <div className="px-4 py-3 border-b flex justify-between items-center" style={{ borderColor: BORDER }}>
            <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: DIM }}>Commitment doc · provisional</span>
            <span className="text-[10px] font-mono" style={{ color: AMBER }}>GOD 62 → 78 projected</span>
          </div>
          {commitments.map((c) => (
            <div key={c.task} className="px-4 py-3 border-b flex items-start justify-between gap-3" style={{ borderColor: BORDER }}>
              <div>
                <p className="text-sm font-medium" style={{ color: TEXT }}>{c.task}</p>
                <p className="text-[10px] font-mono mt-0.5" style={{ color: DIM }}>
                  {c.component}{c.deadline ? ` · due ${c.deadline}` : ""}
                </p>
              </div>
              <span
                className="text-[10px] font-mono px-2 py-0.5 rounded flex-shrink-0"
                style={{
                  color: c.status === "completed" ? G : c.status === "acknowledged" ? AMBER : DIM,
                  border: `1px solid ${c.status === "completed" ? G_BORDER : BORDER}`,
                }}
              >
                {c.impact}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Investor Strip (Pythh Connect / MCP) ───────────────────────────────────

function InvestorStrip() {
  return (
    <section
      className="border-y"
      style={{ backgroundColor: "oklch(0.11 0.015 280)", borderColor: "oklch(0.18 0.01 264)" }}
    >
      <div className="container py-10">
        <div className="flex flex-col lg:flex-row lg:items-center gap-8 lg:gap-16">
          <div className="flex items-center gap-3 flex-shrink-0">
            <PythiaIcon size={32} ring alt="" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold tracking-wider uppercase" style={{ color: "#c4b5fd", letterSpacing: "0.08em" }}>For investors</span>
                <span className="text-[10px] font-mono uppercase" style={{ color: G }}>MCP live</span>
              </div>
              <p className="text-sm font-semibold text-white mt-0.5">Pythh Connect</p>
            </div>
          </div>

          <p className="flex-1 text-sm leading-relaxed" style={{ color: "oklch(0.58 0.01 264)" }}>
            Automate dealflow and portfolio management: query 11,000+ scored startups,
            pick up to 10 for a tracked virtual portfolio, and connect MCP for agent-native
            workflow. Sync to Carta, Smartsheet, and Standard Metrics — coming soon.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 flex-shrink-0">
          <a
            href="/developers"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all"
            style={{ border: "1px solid #7c3aed", color: "#a78bfa" }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#a78bfa"; el.style.color = "#c4b5fd"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#7c3aed"; el.style.color = "#a78bfa"; }}
          >
            <Database size={14} />
            Connect your agent
            <ArrowRight size={14} />
          </a>
          <a
            href="/signup/investor"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all"
            style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "#000" }}
          >
            Join as investor
            <ArrowRight size={14} />
          </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Portfolio Teaser ─────────────────────────────────────────────────────────

interface PortfolioPick {
  id: string;
  startup_id: string;
  startup_name: string;
  primary_sector?: string | null;
  current_god_score?: number;
  entry_god_score: number;
  status: string;
  moic?: number | null;
}

interface PortfolioMetrics {
  total_picks: number;
  active_picks: number;
  successful_exits?: number;
  funded_picks?: number;
  funded_rate_pct?: number;
  verified_funded_picks?: number;
  avg_moic: number | null;
}

function PortfolioTeaser() {
  const { ref, isVisible } = useIntersectionObserver();
  const [picks, setPicks] = useState<PortfolioPick[]>([]);
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/portfolio?sort=god&limit=8&status=active&lite=1").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/portfolio/metrics").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([listData, metricsData]) => {
        const entries = (listData?.entries ?? []) as PortfolioPick[];
        setPicks(entries.filter((e) => e.status === "active").slice(0, 4));
        setMetrics(metricsData?.metrics ?? null);
      })
      .catch(() => {});
  }, []);

  return (
    <section
      ref={ref}
      className="py-16 border-t"
      style={{ backgroundColor: "oklch(0.13 0.01 264)", borderColor: "oklch(0.2 0.01 264)" }}
    >
      <div className="container">
        <div className={`flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8 transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target size={14} style={{ color: "oklch(0.696 0.17 162.48)" }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                Virtual portfolio
              </span>
            </div>
            <h2 className="font-display font-bold text-2xl lg:text-3xl text-white mb-2">
              The Oracle's Picks
            </h2>
            <p className="text-sm leading-relaxed max-w-xl" style={{ color: "oklch(0.55 0.01 264)" }}>
              Every startup crossing GOD 70 enters the Pythh virtual fund. We track funding rounds,
              acquisitions, and score momentum — proof the signal engine finds winners, not hype.
            </p>
          </div>
          {metrics && (
            <div className="flex flex-wrap gap-6 lg:gap-8">
              {[
                { n: metrics.verified_funded_picks ?? 0, l: "verified", highlight: true },
                { n: metrics.funded_picks ?? 0, l: "signals" },
                { n: metrics.successful_exits ?? 0, l: "exited" },
                { n: metrics.active_picks, l: "active" },
                { n: metrics.total_picks, l: "total picks" },
              ].map(({ n, l, highlight }) => (
                <div key={l} className="text-center lg:text-right">
                  <div
                    className="text-xl font-bold tabular-nums"
                    style={{ color: highlight ? "oklch(0.696 0.17 162.48)" : "oklch(0.55 0.01 264)" }}
                  >
                    {n}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider" style={{ color: "oklch(0.42 0.01 264)" }}>{l}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {picks.length > 0 ? (
          <div className={`grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 transition-all duration-700 delay-150 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            {picks.map((pick) => {
              const god = pick.current_god_score ?? pick.entry_god_score;
              return (
                <Link key={pick.id} href={`/portfolio/${pick.startup_id}`}>
                  <div
                    className="p-4 rounded-xl h-full cursor-pointer transition-all"
                    style={{ backgroundColor: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.696 0.17 162.48 / 0.4)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.22 0.01 264)"; }}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-sm font-semibold text-white truncate">{pick.startup_name}</span>
                      <span className="text-sm font-bold tabular-nums flex-shrink-0" style={{ color: godScoreColor(god) }}>{god}</span>
                    </div>
                    <p className="text-xs truncate mb-3" style={{ color: "oklch(0.45 0.01 264)" }}>
                      {pick.primary_sector ?? "Multi-sector"}
                    </p>
                    <span className="text-[10px] font-mono uppercase" style={{ color: G }}>Active pick</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="p-4 rounded-xl animate-pulse" style={{ backgroundColor: "oklch(0.15 0.01 264)", height: 96 }} />
            ))}
          </div>
        )}

        <div className="text-center">
          <a
            href="/portfolio"
            className="inline-flex items-center gap-2 text-sm font-semibold transition-colors"
            style={{ color: "oklch(0.696 0.17 162.48)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.78 0.17 162.48)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.696 0.17 162.48)"; }}
          >
            View full portfolio <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}

// ─── Track Record Strip ─────────────────────────────────────────────────────
function TrackRecordStrip({
  platformStats,
  platformStatsReady,
  portfolioMetrics,
}: {
  platformStats: PlatformStats | null;
  platformStatsReady: boolean;
  portfolioMetrics: PortfolioHeadlineMetrics | null;
}) {
  const { ref, isVisible } = useIntersectionObserver();
  const matchCount = platformStats?.matches ?? 0;
  const matchesNew7d = platformStats?.matches_new_7d ?? 0;
  const signalCount = platformStats?.signals ?? 0;
  const startupsTarget = platformStats?.startups ?? 0;
  const investorsTarget = platformStats?.investors ?? 0;
  const verifiedTarget = portfolioMetrics?.verified_funded_picks ?? 0;
  const verifiedPct = portfolioMetrics?.verified_funded_rate_pct;
  const statsLive = platformStatsReady && (startupsTarget > 0 || matchCount > 0);
  const startups = useCountUp(startupsTarget, 1600, isVisible && statsLive);
  const investors = useCountUp(investorsTarget, 1800, isVisible && statsLive);
  const verified = useCountUp(verifiedTarget, 1400, isVisible && statsLive);

  const matchSub = statsLive
    ? [
        `${formatMatchFull(matchCount)} startup ↔ investor pairs`,
        matchesNew7d > 0 ? `${formatVelocitySub(matchesNew7d)} · v3.3 recency` : "full-table count · updated daily",
      ].join(" · ")
    : "loading network stats…";

  const stats = [
    {
      value: verified > 0 ? String(verified) : "—",
      suffix: "",
      label: "Verified Funded",
      sub: verifiedPct != null ? `${verifiedPct}% of Oracle picks · press-confirmed` : "Oracle scoreboard · press-verified raises",
      accent: true,
      href: "/portfolio",
    },
    {
      value: statsLive ? formatMatchFull(matchCount) : "—",
      suffix: statsLive ? "+" : "",
      label: "Pre-computed Matches",
      sub: matchSub,
      color: G,
      href: null,
    },
    {
      value: statsLive ? startups.toLocaleString() : "—",
      suffix: statsLive ? "+" : "",
      label: "Startups Scored",
      sub: statsLive ? "approved · GOD-ranked · updated daily" : "loading network stats…",
      color: CYAN,
      href: null,
    },
    {
      value: statsLive ? investors.toLocaleString() : "—",
      suffix: statsLive ? "+" : "",
      label: "Investors Qualified",
      sub: statsLive
        ? signalCount > 0
          ? `${signalCount.toLocaleString()} signal scores · thesis-mapped`
          : "entity-resolved, thesis-mapped, GOD-ranked"
        : "loading network stats…",
      color: PURPLE,
      href: null,
    },
  ];

  return (
    <div ref={ref} className="relative py-12 overflow-hidden"
      style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, backgroundColor: "oklch(0.145 0.01 264)" }}>
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(${G} 1px, transparent 1px), linear-gradient(90deg, ${G} 1px, transparent 1px)`,
        backgroundSize: "40px 40px"
      }} />
      <div className="max-w-5xl mx-auto px-6">
        <div className={`transition-all duration-700 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
          <StatStrip items={stats} cols={4} />
        </div>
      </div>
    </div>
  );
}

// ─── Agent Intro Section ──────────────────────────────────────────────────────
function AgentIntroSection() {
  const { ref, isVisible } = useIntersectionObserver();

  return (
    <section className="py-24 border-t" style={{ backgroundColor: "oklch(0.15 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}>
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left: PYTHIA Animated Reveal */}
          <div ref={ref} className={`relative flex items-center justify-center ${isVisible ? "animate-fade-in-up" : "opacity-0"}`} style={{ animationFillMode: "forwards", minHeight: 360 }}>
            {/* Radial dark backdrop */}
            <div className="absolute inset-0 rounded-3xl" style={{ background: "radial-gradient(ellipse at center, oklch(0.18 0.015 162) 0%, oklch(0.13 0.01 264) 70%)", border: "1px solid oklch(0.696 0.17 162.48 / 0.12)" }} />
            {/* Corner accent lines */}
            <div className="absolute top-4 left-4 w-8 h-8" style={{ borderTop: "1px solid oklch(0.696 0.17 162.48 / 0.4)", borderLeft: "1px solid oklch(0.696 0.17 162.48 / 0.4)" }} />
            <div className="absolute top-4 right-4 w-8 h-8" style={{ borderTop: "1px solid oklch(0.696 0.17 162.48 / 0.4)", borderRight: "1px solid oklch(0.696 0.17 162.48 / 0.4)" }} />
            <div className="absolute bottom-4 left-4 w-8 h-8" style={{ borderBottom: "1px solid oklch(0.696 0.17 162.48 / 0.4)", borderLeft: "1px solid oklch(0.696 0.17 162.48 / 0.4)" }} />
            <div className="absolute bottom-4 right-4 w-8 h-8" style={{ borderBottom: "1px solid oklch(0.696 0.17 162.48 / 0.4)", borderRight: "1px solid oklch(0.696 0.17 162.48 / 0.4)" }} />
            {/* Label */}
            <div className="absolute top-5 left-0 right-0 flex justify-center">
              <span className="section-label" style={{ color: "oklch(0.696 0.17 162.48 / 0.5)" }}>PYTHIA SEES THE SIGNAL</span>
            </div>
            <Suspense
              fallback={
                <div
                  className="relative flex items-center justify-center rounded-2xl"
                  style={{ width: 320, height: 320, backgroundColor: "oklch(0.15 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}
                  aria-hidden
                />
              }
            >
              <PythiaReveal autoPlay={isVisible} />
            </Suspense>
          </div>

          {/* Right: Copy */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-8" style={{ backgroundColor: "oklch(0.769 0.188 70.08)" }} />
              <span className="section-label">MEET YOUR ORACLE</span>
            </div>
            <h2 className="font-display font-bold mb-2" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "oklch(0.97 0.005 264)" }}>
              Meet PYTHIA.
            </h2>
            <p className="text-lg font-medium mb-6" style={{ color: "oklch(0.769 0.188 70.08)" }}>
              The Oracle of your fundraise.
            </p>
            <p className="text-base leading-relaxed mb-4" style={{ color: "oklch(0.6 0.01 264)" }}>
              PYTHIA is the oracle at the core of Pythh — named for the high priestess of Delphi who saw the future before anyone else. She runs your entire fundraising pipeline — from identifying the right investors to booking confirmed meetings — without you lifting a finger.
            </p>
            <p className="text-base leading-relaxed mb-8" style={{ color: "oklch(0.6 0.01 264)" }}>
              She reads your startup, maps your thesis against 5,000+ investors, drafts personalized outreach, follows up intelligently, and only surfaces a meeting request when an investor says yes. Your one job: approve and show up.
            </p>

            <InlineMeta
              items={[
                { text: "Investor Matching", color: G },
                { text: "Pitch Prep", color: GOLD },
                { text: "Outreach Automation", color: G },
                { text: "Follow-up Sequences", color: GOLD },
                { text: "Meeting Scheduling", color: G },
                { text: "Conversation Briefings", color: GOLD },
              ]}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Live Signals ─────────────────────────────────────────────────────────────

function LiveSignalsSection() {
  const { ref, isVisible } = useIntersectionObserver();
  const [activeSector, setActiveSector] = useState("All");
  const filtered = activeSector === "All" ? INVESTOR_SIGNALS : INVESTOR_SIGNALS.filter((s) => s.sector === activeSector);

  return (
    <section className="py-24 border-t" style={{ backgroundColor: "oklch(0.15 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}>
      <div className="container">
        <div ref={ref} className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-8" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
              <span className="section-label">INVESTOR SIGNALS</span>
              <LiveDot />
            </div>
            <h2 className="font-display font-bold mb-3" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", color: "oklch(0.97 0.005 264)" }}>
              Real-time signal intelligence.
            </h2>
            <p className="text-base max-w-lg" style={{ color: "oklch(0.6 0.01 264)" }}>
              PYTHIA monitors 40+ behavioral dimensions — from LP updates to check-size changes — 6 to 18 months before major funding events.
            </p>
          </div>
          <FilterTabs
            label="Sector"
            value={activeSector}
            onChange={setActiveSector}
            labelWidth="w-0"
            options={SECTORS.map((s) => ({ id: s, label: s }))}
          />
        </div>

        <div className="rounded-xl border overflow-hidden" style={{ borderColor: "oklch(0.25 0.01 264)" }}>
          <div className="grid gap-4 px-6 py-3 border-b"
            style={{ gridTemplateColumns: "1fr 100px 60px 60px 60px 80px", backgroundColor: "oklch(0.17 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}>
            {["INVESTOR / FIRM", "SIGNAL", "Δ", "GOD", "VC++", ""].map((h) => (
              <span key={h} className="section-label">{h}</span>
            ))}
          </div>
          {filtered.map((inv, i) => (
            <div key={inv.name}
              className={`grid gap-4 px-6 py-4 border-b transition-colors duration-150 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
              style={{ gridTemplateColumns: "1fr 100px 60px 60px 60px 80px", borderColor: "oklch(0.22 0.01 264)", animationDelay: `${i * 0.05}s`, animationFillMode: "forwards" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "oklch(0.17 0.01 264)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}>
              <div>
                <p className="text-sm font-medium" style={{ color: "oklch(0.9 0.005 264)" }}>{inv.name}</p>
                <p className="text-xs mt-0.5" style={{ color: "oklch(0.5 0.01 264)" }}>{inv.firm}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono-data font-semibold text-sm" style={{ color: inv.signal >= 8 ? "oklch(0.696 0.17 162.48)" : "oklch(0.769 0.188 70.08)" }}>{inv.signal}</span>
                <SignalBar value={inv.signal} max={10} color={inv.signal >= 8 ? "emerald" : "amber"} />
              </div>
              <span className="font-mono-data text-xs self-center" style={{ color: deltaColor(inv.delta) }}>
                {inv.delta > 0 ? "+" : ""}{inv.delta}
              </span>
              <span className="font-mono-data text-xs self-center" style={{ color: "oklch(0.65 0.01 264)" }}>{inv.god}</span>
              <span className="font-mono-data text-xs self-center" style={{ color: "oklch(0.65 0.01 264)" }}>{inv.vcpp}</span>
              <div className="self-center">
                <span className="text-xs font-mono" style={{ color: CYAN }}>{inv.sector}</span>
              </div>
            </div>
          ))}
          <div className="px-6 py-4 flex items-center justify-between" style={{ backgroundColor: "oklch(0.17 0.01 264)" }}>
            <p className="text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>Signal = timing · GOD = investment readiness · VC++ = investor optics</p>
            <a href="/investors" className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "oklch(0.696 0.17 162.48)" }}>
              See full rankings <ChevronRight size={12} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Science Section ──────────────────────────────────────────────────────────

function ScienceSection() {
  const { ref, isVisible } = useIntersectionObserver();
  const timing = useCountUp(8.7, 1500, isVisible, 1);
  const fit = useCountUp(94, 1500, isVisible, 0);
  const optics = useCountUp(88, 1500, isVisible, 0);

  const metrics = [
    { icon: <Activity size={20} />, label: "TIMING", value: timing, suffix: "/10", sublabel: "SIGNAL SCORE", description: "We track when VCs are actively deploying — portfolio velocity, LP updates, fund cycle position. PYTHIA pitches when the window is open.", color: "emerald" as const },
    { icon: <Target size={20} />, label: "FIT", value: fit, suffix: "%", sublabel: "THESIS MATCH", description: "Every investor thesis is mapped across 40+ dimensions. Your startup is scored against each one — sector, stage, check size, geography.", color: "amber" as const },
    { icon: <Eye size={20} />, label: "OPTICS", value: optics, suffix: "pts", sublabel: "VC++ SCORE", description: "How an investor is perceived by other VCs — co-investment history, portfolio reputation, founder NPS. Signal quality, not just quantity.", color: "emerald" as const },
  ];

  return (
    <section className="py-24" style={{ backgroundColor: "oklch(0.13 0.01 264)" }}>
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div ref={ref}>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px w-8" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
              <span className="section-label">THE SCIENCE BEHIND THE ORACLE</span>
            </div>
            <h2 className="font-display font-bold mb-4" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "oklch(0.97 0.005 264)" }}>
              Math, not magic.
            </h2>
            <p className="text-lg leading-relaxed mb-6" style={{ color: "oklch(0.6 0.01 264)" }}>
              A single data point is noise. A sequence of signals is a pattern. PYTHIA detects patterns across 40+ behavioral dimensions — 6 to 18 months before major funding events.
            </p>
            <p className="text-base leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>
              Her scoring engine combines timing intelligence, thesis alignment, and peer-weighted optics into a single, actionable signal — so she knows exactly who to approach and when.
            </p>
            <div className="mt-8">
              <a href="/methodology" className="flex items-center gap-2 text-sm font-semibold" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                Read the methodology <ArrowRight size={14} />
              </a>
            </div>
          </div>
          <div className="space-y-4">
            {metrics.map((m, i) => (
              <div key={m.label}
                className={`rounded-xl p-5 border flex items-center gap-6 ${isVisible ? "animate-fade-in-up" : "opacity-0"}`}
                style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.25 0.01 264)", animationDelay: `${i * 0.15}s`, animationFillMode: "forwards" }}>
                <div className="flex-shrink-0 w-16 h-16 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: m.color === "emerald" ? "oklch(0.696 0.17 162.48 / 0.1)" : "oklch(0.769 0.188 70.08 / 0.1)", border: `1px solid ${m.color === "emerald" ? "oklch(0.696 0.17 162.48 / 0.2)" : "oklch(0.769 0.188 70.08 / 0.2)"}`, color: m.color === "emerald" ? "oklch(0.696 0.17 162.48)" : "oklch(0.769 0.188 70.08)" }}>
                  {m.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="font-mono-data font-bold text-3xl" style={{ color: m.color === "emerald" ? "oklch(0.696 0.17 162.48)" : "oklch(0.769 0.188 70.08)" }}>{m.value}</span>
                    <span className="font-mono-data text-lg" style={{ color: "oklch(0.5 0.01 264)" }}>{m.suffix}</span>
                  </div>
                  <p className="section-label mb-1">{m.sublabel}</p>
                  <p className="text-xs leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>{m.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────

function TestimonialsSection() {
  const testimonials = [
    {
      quote: "I submitted my URL on a Monday. By Wednesday, PYTHIA had already booked two investor calls. I didn't write a single email.",
      author: "Sarah M.",
      role: "Founder, Series A — AI Infrastructure",
    },
    {
      quote: "The meeting brief PYTHIA sent before my Sequoia call was better than anything I'd prepared myself. She knew their portfolio gaps before I did.",
      author: "James K.",
      role: "Co-founder, Seed — Climate Tech",
    },
    {
      quote: "I used to spend 40% of my time on investor research and outreach. PYTHIA does all of it. I just show up to meetings now.",
      author: "Priya R.",
      role: "CEO, Pre-seed — FinTech",
    },
  ];

  return (
    <section className="py-24 border-t" style={{ backgroundColor: "oklch(0.15 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}>
      <div className="container">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px w-8" style={{ backgroundColor: "oklch(0.769 0.188 70.08)" }} />
          <span className="section-label">FOUNDER SIGNAL</span>
        </div>
        <h2 className="font-display font-bold mb-12" style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", color: "oklch(0.97 0.005 264)" }}>
          Founders who let PYTHIA run the pipeline.
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t, i) => (
            <div key={i} className="rounded-xl p-6 border" style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.25 0.01 264)" }}>
              <div className="mb-4">{[...Array(5)].map((_, j) => <span key={j} style={{ color: "oklch(0.769 0.188 70.08)" }}>★</span>)}</div>
              <blockquote className="text-sm leading-relaxed mb-6 italic" style={{ color: "oklch(0.75 0.005 264)" }}>"{t.quote}"</blockquote>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold font-mono-data"
                  style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.15)", color: "oklch(0.696 0.17 162.48)", border: "1px solid oklch(0.696 0.17 162.48 / 0.3)" }}>
                  {t.author.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-semibold" style={{ color: "oklch(0.85 0.005 264)" }}>{t.author}</p>
                  <p className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Newsletter ───────────────────────────────────────────────────────────────

function NewsletterSection() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email) setSubmitted(true);
  };

  return (
    <section className="py-24 relative overflow-hidden" style={{ backgroundColor: "oklch(0.13 0.01 264)" }}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full opacity-10 blur-3xl" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
      <div className="container relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="h-px w-8" style={{ backgroundColor: "oklch(0.769 0.188 70.08)" }} />
            <span className="section-label">THE DAILY SIGNAL</span>
            <div className="h-px w-8" style={{ backgroundColor: "oklch(0.769 0.188 70.08)" }} />
          </div>
          <h2 className="font-display font-bold mb-4" style={{ fontSize: "clamp(2rem, 4vw, 3rem)", color: "oklch(0.97 0.005 264)" }}>
            Get the signal<br />
            <span style={{ color: "oklch(0.769 0.188 70.08)" }}>before the noise.</span>
          </h2>
          <p className="text-base leading-relaxed mb-8" style={{ color: "oklch(0.6 0.01 264)" }}>
            Join 12,000+ founders receiving our weekly breakdown of VC thesis shifts, hidden capital flows, and the investors PYTHIA is watching right now.
          </p>
          {submitted ? (
            <div className="flex items-center justify-center gap-3 py-4 px-6 rounded-xl border"
              style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)", borderColor: "oklch(0.696 0.17 162.48 / 0.3)" }}>
              <Zap size={16} style={{ color: "oklch(0.696 0.17 162.48)" }} />
              <span className="text-sm font-medium" style={{ color: "oklch(0.696 0.17 162.48)" }}>You're in. First signal drops this week.</span>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg border"
                style={{ backgroundColor: "oklch(0.16 0.01 264)", borderColor: "oklch(0.3 0.01 264)" }}>
                <Mail size={16} style={{ color: "oklch(0.5 0.01 264)" }} />
                <input type="email" placeholder="founder@startup.com" value={email} onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 bg-transparent text-sm outline-none" style={{ color: "oklch(0.94 0.005 264)" }} required />
              </div>
              <button type="submit"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-sm transition-all duration-200 whitespace-nowrap"
                style={{ backgroundColor: "oklch(0.769 0.188 70.08)", color: "oklch(0.1 0.01 70)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px oklch(0.769 0.188 70.08 / 0.5)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}>
                Subscribe <ArrowRight size={16} />
              </button>
            </form>
          )}
          <p className="text-xs mt-4" style={{ color: "oklch(0.45 0.01 264)" }}>No spam. Unsubscribe anytime.</p>
        </div>
      </div>
    </section>
  );
}

// ─── GOD Score Section ────────────────────────────────────────────────────────

const GOD_PILLARS = [
  {
    letter: "G",
    word: "Grit",
    color: "#a855f7",
    desc: "The relentless drive to endure adversity and keep building. Pythh measures founder resilience through prior pivots, time-in-market signals, and survival under pressure — the quality that Y Combinator has always selected for above all others.",
    vcs: ["Y Combinator"],
    signals: ["Repeat founder", "Pivot velocity", "Time in market"],
  },
  {
    letter: "O",
    word: "Opportunity",
    color: "#22d3ee",
    desc: "The precision to identify and enter the right market at exactly the right moment. We score category size, creation potential, and timing against technology adoption curves — the framework Sequoia and Greylock have used to back every category-defining company.",
    vcs: ["Sequoia Capital", "Greylock"],
    signals: ["Market size signals", "Funding velocity", "Category momentum"],
  },
  {
    letter: "D",
    word: "Determination",
    color: G,
    desc: "The clarity of conviction and the magnetic force of execution. We score thesis specificity, product velocity, and the ability to attract world-class talent — the qualities Andreessen Horowitz and Founders Fund use to distinguish missionaries from mercenaries.",
    vcs: ["Andreessen Horowitz", "Founders Fund"],
    signals: ["Product velocity", "Team depth", "Thesis coherence"],
  },
];

function GODScoreSection() {
  return (
    <section
      className="py-20 border-t border-b"
      style={{ backgroundColor: "oklch(0.09 0.01 264)", borderColor: "oklch(0.16 0.01 264)" }}
    >
      <div className="container px-6" style={{ maxWidth: "1200px" }}>

        {/* ── Header row ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-[10px] font-mono tracking-widest uppercase mb-2" style={{ color: "oklch(0.36 0.01 264)" }}>
              scoring framework
            </p>
            <h2 className="text-xl font-bold" style={{ color: "oklch(0.9 0.005 264)", letterSpacing: "-0.02em" }}>
              GOD Score <span style={{ color: "oklch(0.45 0.01 264)", fontWeight: 400 }}>—</span> Grit · Opportunity · Determination
            </h2>
            <p className="text-sm mt-1" style={{ color: "oklch(0.48 0.01 264)" }}>
              40+ observable signals · derived from YC, Sequoia, A16z, Founders Fund, Greylock selection patterns
            </p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-xs font-mono" style={{ color: G }}>
              0 – 100
            </span>
            <a
              href="/methodology"
              className="text-xs font-mono transition-colors"
              style={{ color: "oklch(0.45 0.01 264)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#a78bfa"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "oklch(0.45 0.01 264)"; }}
            >
              Full methodology →
            </a>
          </div>
        </div>

        {/* ── Dimension table ── */}
        <div className="rounded-xl overflow-hidden mb-6" style={{ border: "1px solid oklch(0.17 0.01 264)" }}>

          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[160px_1fr_180px_180px] px-5 py-2.5 border-b"
            style={{ borderColor: "oklch(0.15 0.01 264)", backgroundColor: "oklch(0.105 0.01 264)" }}>
            {["DIMENSION", "WHAT WE MEASURE", "SIGNALS", "VC BENCHMARK"].map((h) => (
              <span key={h} className="text-[10px] font-mono tracking-widest" style={{ color: "oklch(0.33 0.01 264)" }}>{h}</span>
            ))}
          </div>

          {/* Rows */}
          {GOD_PILLARS.map(({ letter, word, color, desc, vcs, signals }, i) => (
            <div
              key={letter}
              className="grid md:grid-cols-[160px_1fr_180px_180px] gap-0 px-5 py-5 border-b last:border-b-0"
              style={{ borderColor: "oklch(0.14 0.01 264)", backgroundColor: i % 2 === 0 ? "transparent" : "oklch(0.105 0.01 264)" }}
            >
              {/* Dimension label */}
              <div className="flex items-center gap-3 mb-3 md:mb-0">
                <span className="font-mono font-bold text-lg w-6 text-center" style={{ color }}>{letter}</span>
                <span className="text-sm font-semibold" style={{ color: "oklch(0.78 0.005 264)" }}>{word}</span>
              </div>

              {/* Description */}
              <p className="text-xs leading-relaxed pr-6 mb-3 md:mb-0" style={{ color: "oklch(0.52 0.01 264)" }}>
                {desc.split(" — ")[0].trim()}
              </p>

              {/* Signals */}
              <div className="flex flex-col gap-1 pr-4 mb-3 md:mb-0">
                {signals.map((s) => (
                  <span key={s} className="text-[11px] font-mono" style={{ color: "oklch(0.48 0.01 264)" }}>
                    — {s}
                  </span>
                ))}
              </div>

              {/* VCs */}
              <div className="flex flex-col gap-1">
                {vcs.map((v) => (
                  <span key={v} className="text-[11px]" style={{ color: "oklch(0.42 0.01 264)" }}>{v}</span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Score bands + methodology note — two columns ── */}
        <div className="grid lg:grid-cols-2 gap-4">

          {/* Score bands */}
          <div className="rounded-xl p-5" style={{ border: "1px solid oklch(0.16 0.01 264)", backgroundColor: "oklch(0.105 0.01 264)" }}>
            <p className="text-[10px] font-mono tracking-widest uppercase mb-4" style={{ color: "oklch(0.36 0.01 264)" }}>
              score bands
            </p>
            <div className="space-y-2.5">
              {[
                { range: "80–100", label: "Elite",      color: G,              note: "Investment-grade · surfaces first" },
                { range: "60–79",  label: "Strong",     color: "#22d3ee",              note: "High conviction · core matching pool" },
                { range: "40–59",  label: "Solid",      color: "#eab308",              note: "Signal-building · confidence-weighted" },
                { range: "20–39",  label: "Emerging",   color: "#f97316",              note: "Early signals · monitored" },
                { range: "0–19",   label: "Pre-signal", color: "oklch(0.35 0.01 264)", note: "Excluded — protects match quality" },
              ].map(({ range, label, color, note }) => (
                <div key={range} className="flex items-center gap-3">
                  <span className="text-xs font-mono w-14 flex-shrink-0 tabular-nums" style={{ color: "oklch(0.33 0.01 264)" }}>{range}</span>
                  <div className="w-0.5 h-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-xs font-semibold w-16 flex-shrink-0" style={{ color }}>{label}</span>
                  <span className="text-xs" style={{ color: "oklch(0.42 0.01 264)" }}>{note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Methodology note */}
          <div className="rounded-xl p-5" style={{ border: "1px solid oklch(0.16 0.01 264)", backgroundColor: "oklch(0.105 0.01 264)" }}>
            <p className="text-[10px] font-mono tracking-widest uppercase mb-4" style={{ color: "oklch(0.36 0.01 264)" }}>
              methodology basis
            </p>
            <p className="text-sm leading-relaxed mb-3" style={{ color: "oklch(0.52 0.01 264)" }}>
              The GOD dimensions are derived from the observable selection patterns of the most successful early-stage
              investors in history. No self-reported data. No black boxes. 40+ observable signals, scored consistently.
            </p>
            <p className="text-sm leading-relaxed mb-5" style={{ color: "oklch(0.52 0.01 264)" }}>
              Every startup founder faces the moment of choosing to continue against the odds. The GOD Score was built
              to identify the founders who make that choice — and the investors who are ready to back them.
            </p>
            <a
              href="/methodology"
              className="text-xs font-mono transition-colors"
              style={{ color: "#a78bfa" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#c4b5fd"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#a78bfa"; }}
            >
              Read the full methodology →
            </a>
          </div>
        </div>

      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

function Footer() {
  const cols: { title: string; links: { label: string; href: string | null }[] }[] = [
    { title: "Product", links: [
      { label: "How it works", href: "/oracle" },
      { label: "Find my investors", href: "/find-investors" },
      { label: "Start your raise", href: "/matches" },
      { label: "Rankings", href: "/rankings" },
      { label: "Investors", href: "/investors" },
      { label: "Portfolio", href: "/portfolio" },
      { label: "Platform", href: "/platform" },
      { label: "Pricing", href: "/pricing" },
    ]},
    { title: "Resources", links: [
      { label: "Methodology", href: "/methodology" },
      { label: "Newsletter", href: "/newsletter" },
      { label: "About", href: "/about" },
      { label: "Support", href: "/support" },
    ]},
    { title: "Company", links: [
      { label: "Pythiam Ventures", href: "/pythiam" },
      { label: "About", href: "/about" },
      { label: "Blog", href: null },
      { label: "Careers", href: null },
      { label: "Press", href: null },
    ]},
    { title: "Legal", links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Cookie Policy", href: "/privacy" },
    ]},
  ];

  return (
    <footer className="border-t" style={{ backgroundColor: "oklch(0.11 0.01 264)", borderColor: "oklch(0.2 0.01 264)" }}>
      <div className="container py-16">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex flex-col mb-4">
              <span className="font-display font-bold text-lg text-white tracking-tight">pythh.ai</span>
              <span className="section-label" style={{ color: "oklch(0.696 0.17 162.48)" }}>SIGNAL SCIENCE</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "oklch(0.45 0.01 264)" }}>
              PYTHIA sees the investors you should be talking to — before you even know to ask. You approve. You show up.
            </p>
          </div>
          {cols.map((col) => (
            <div key={col.title}>
              <h4 className="font-display font-semibold text-sm mb-4" style={{ color: "oklch(0.7 0.01 264)" }}>{col.title}</h4>
              <ul className="space-y-2.5">
                {col.links.map(({ label, href }) => (
                  <li key={label}>
                    {href ? (
                      <a
                        href={href}
                        className="text-xs transition-colors duration-150"
                        style={{ color: "oklch(0.45 0.01 264)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "oklch(0.7 0.01 264)")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "oklch(0.45 0.01 264)")}
                      >{label}</a>
                    ) : (
                      <span className="text-xs" style={{ color: "oklch(0.3 0.01 264)" }}>{label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-8 border-t flex flex-col md:flex-row items-center justify-between gap-4" style={{ borderColor: "oklch(0.2 0.01 264)" }}>
          <p className="text-xs" style={{ color: "oklch(0.35 0.01 264)" }}>
            © 2026 Pythh Capital. All rights reserved. Signals reflect investor intent and timing based on observed behavior. No guarantees. Just math.
          </p>
          <div className="flex items-center gap-1">
            <Shield size={12} style={{ color: "oklch(0.35 0.01 264)" }} />
            <span className="text-xs" style={{ color: "oklch(0.35 0.01 264)" }}>SOC 2 Type II Compliant</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const { stats: platformStats, ready: platformStatsReady } = usePlatformStats();
  const portfolioMetrics = usePortfolioHeadlineMetrics();

  useEffect(() => {
    void trackFunnelEventOnce('pythh_home_page_view', 'page_view', {
      path: '/',
      source: 'home_hero',
      ...getUtmParams(),
    });
    trackReturnVisitIfEligible('/');
  }, []);

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE }}>
      <SharedNavbar
        activePath="/"
        variant="hero"
        heroCta={{ label: "Start my raise", targetId: "hero-cta" }}
      />
      <HeroSection platformStats={platformStats} platformStatsReady={platformStatsReady} portfolioMetrics={portfolioMetrics} />
      <SignalArtTeaser />
      <HowItWorksSection />
      <TermSheetSection />
      <SignalProofBar />
      <InvestorStrip />
      <TrackRecordStrip platformStats={platformStats} platformStatsReady={platformStatsReady} portfolioMetrics={portfolioMetrics} />
      <PortfolioTeaser />
      <GODScoreSection />
      <AgentIntroSection />
      <LiveSignalsSection />
      <ScienceSection />
      <TestimonialsSection />
      <NewsletterSection />
      <Footer />
    </div>
  );
}
