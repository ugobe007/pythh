import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useState, useEffect, type ReactNode } from "react";
import {
  ArrowRight,
  Zap,
  Target,
  Brain,
  BarChart3,
  Mail,
  Filter,
  Radar,
  GitBranch,
  Activity,
  CheckCircle2,
} from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";

const G = "oklch(0.696 0.17 162.48)";
const MUTED = "oklch(0.55 0.01 264)";
const BORDER = "oklch(0.22 0.01 264)";
const CARD = "oklch(0.12 0.01 264)";

// ─── Live stats ───────────────────────────────────────────────────────────────

interface PlatformStats {
  startups: number;
  investors: number;
  matches: number;
}

interface PortfolioMetrics {
  verified_funded_picks?: number;
  verified_funded_rate_pct?: number;
  total_picks?: number;
  funded_picks?: number;
  active_picks?: number;
  successful_exits?: number;
  total_events?: number;
  funding_event_count?: number;
  product_event_count?: number;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString();
}

function useLiveEngineStats() {
  const [platform, setPlatform] = useState<PlatformStats | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioMetrics | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/platform-stats").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/portfolio/metrics").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([plat, port]) => {
        if (plat) {
          setPlatform({
            startups: Number(plat.startups) || 0,
            investors: Number(plat.investors) || 0,
            matches: Number(plat.matches) || 0,
          });
        }
        if (port?.metrics) setPortfolio(port.metrics);
      })
      .catch(() => {});
  }, []);

  return { platform, portfolio };
}

// ─── Animated pipeline ────────────────────────────────────────────────────────

interface PipelineStage {
  id: string;
  label: string;
  desc: string;
  icon: ReactNode;
  metric?: (ctx: { platform: PlatformStats | null; portfolio: PortfolioMetrics | null }) => string | null;
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: "discovery",
    label: "Discovery",
    desc: "RSS · submissions · ingest",
    icon: <Radar size={14} />,
    metric: ({ platform }) => (platform?.startups ? `${formatCompact(platform.startups)} scored` : null),
  },
  {
    id: "entity",
    label: "Entity gate",
    desc: "Name · URL · junk filter",
    icon: <Filter size={14} />,
    metric: () => "28.6% pass rate",
  },
  {
    id: "god",
    label: "GOD",
    desc: "7-pillar composite 0–100",
    icon: <BarChart3 size={14} />,
    metric: () => "70+ investment-grade",
  },
  {
    id: "signals",
    label: "Signals",
    desc: "News · hiring · funding cues",
    icon: <Activity size={14} />,
    metric: () => "22K+ events classified",
  },
  {
    id: "trajectory",
    label: "Trajectory",
    desc: "hire → GTM → raise",
    icon: <GitBranch size={14} />,
    metric: () => "sequence prediction",
  },
  {
    id: "match",
    label: "Match",
    desc: "Thesis · stage · check size",
    icon: <Target size={14} />,
    metric: ({ platform }) => (platform?.matches ? `${formatCompact(platform.matches)} pairs` : null),
  },
  {
    id: "monitor",
    label: "Monitor",
    desc: "Portfolio signal refresh",
    icon: <Zap size={14} />,
    metric: ({ portfolio }) =>
      portfolio?.total_picks != null ? `${portfolio.total_picks} Oracle picks` : null,
  },
  {
    id: "verify",
    label: "Verify",
    desc: "Press-confirmed outcomes",
    icon: <CheckCircle2 size={14} />,
    metric: ({ portfolio }) => {
      const v = portfolio?.verified_funded_picks;
      const pct = portfolio?.verified_funded_rate_pct;
      if (v == null) return null;
      return pct != null ? `${v} verified · ${pct}%` : `${v} verified`;
    },
  },
];

function PipelineConnector({ active }: { active: boolean }) {
  return (
    <div className="relative flex-1 min-w-[12px] h-px mx-0.5 self-center" style={{ backgroundColor: "oklch(0.2 0.01 264)" }}>
      <div
        className="absolute inset-y-0 left-0 h-px rounded-full transition-all duration-500"
        style={{
          width: active ? "100%" : "0%",
          background: `linear-gradient(90deg, ${G}88, ${G})`,
          boxShadow: active ? `0 0 8px ${G}66` : "none",
        }}
      />
      {active && (
        <span
          className="absolute top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full"
          style={{
            backgroundColor: G,
            boxShadow: `0 0 6px ${G}`,
            animation: "pipeline-dot 0.9s ease-in-out infinite",
          }}
        />
      )}
    </div>
  );
}

function PipelineFlow({
  platform,
  portfolio,
}: {
  platform: PlatformStats | null;
  portfolio: PortfolioMetrics | null;
}) {
  const [activeIdx, setActiveIdx] = useState(0);
  const [pulseKey, setPulseKey] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActiveIdx((i) => (i + 1) % PIPELINE_STAGES.length);
      setPulseKey((k) => k + 1);
    }, 1100);
    return () => clearInterval(id);
  }, []);

  const activeStage = PIPELINE_STAGES[activeIdx];

  return (
    <>
      <style>{`
        @keyframes pipeline-dot {
          0% { left: 0%; opacity: 0; }
          15% { opacity: 1; }
          85% { opacity: 1; }
          100% { left: calc(100% - 6px); opacity: 0; }
        }
        @keyframes stage-pulse {
          0%, 100% { box-shadow: 0 0 0 0 oklch(0.696 0.17 162.48 / 0); }
          50% { box-shadow: 0 0 16px oklch(0.696 0.17 162.48 / 0.35); }
        }
      `}</style>

      {/* Desktop: horizontal flow */}
      <div className="hidden lg:block">
        <div className="flex items-start mb-4">
          {PIPELINE_STAGES.map((stage, i) => (
            <div key={stage.id} className="flex items-start flex-1 min-w-0">
              <div className="flex flex-col items-center flex-1 min-w-0 px-0.5">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center mb-1.5 transition-all duration-300"
                  style={{
                    color: i === activeIdx ? G : MUTED,
                    backgroundColor: i === activeIdx ? `${G}18` : "oklch(0.14 0.01 264)",
                    border: `1px solid ${i === activeIdx ? `${G}55` : BORDER}`,
                    animation: i === activeIdx ? "stage-pulse 1.1s ease-in-out" : "none",
                  }}
                >
                  {stage.icon}
                </div>
                <span
                  className="text-[9px] font-mono font-bold uppercase tracking-wide text-center leading-tight truncate w-full"
                  style={{ color: i === activeIdx ? "oklch(0.92 0.005 264)" : "oklch(0.42 0.01 264)" }}
                >
                  {stage.label}
                </span>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <PipelineConnector active={i === activeIdx} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile / tablet: vertical stepped flow */}
      <div className="lg:hidden space-y-1 mb-4">
        {PIPELINE_STAGES.map((stage, i) => {
          const isActive = i === activeIdx;
          return (
            <div key={stage.id} className="flex items-stretch gap-2">
              <div className="flex flex-col items-center w-8 flex-shrink-0">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300"
                  style={{
                    color: isActive ? G : MUTED,
                    backgroundColor: isActive ? `${G}18` : "oklch(0.14 0.01 264)",
                    border: `1px solid ${isActive ? `${G}55` : BORDER}`,
                  }}
                >
                  {stage.icon}
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <div
                    className="w-px flex-1 min-h-[8px] my-0.5 transition-all duration-300"
                    style={{
                      background: isActive
                        ? `linear-gradient(180deg, ${G}, oklch(0.2 0.01 264))`
                        : "oklch(0.2 0.01 264)",
                    }}
                  />
                )}
              </div>
              <div
                className="flex-1 py-1.5 px-3 rounded-lg mb-1 transition-all duration-300"
                style={{
                  backgroundColor: isActive ? `${G}0d` : "transparent",
                  border: isActive ? `1px solid ${G}33` : "1px solid transparent",
                }}
              >
                <span className="text-xs font-semibold text-white">{stage.label}</span>
                <p className="text-[10px]" style={{ color: MUTED }}>{stage.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active stage detail */}
      <div
        key={`${activeStage.id}-${pulseKey}`}
        className="p-4 rounded-xl transition-all duration-300"
        style={{
          backgroundColor: "oklch(0.1 0.01 264)",
          border: `1px solid ${G}44`,
          boxShadow: `0 0 24px ${G}12`,
        }}
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
              style={{ backgroundColor: G, boxShadow: `0 0 6px ${G}` }}
            />
            <span className="text-xs font-mono font-bold uppercase tracking-widest truncate" style={{ color: G }}>
              {activeStage.label}
            </span>
          </div>
          <span className="text-[10px] font-mono flex-shrink-0" style={{ color: "oklch(0.38 0.01 264)" }}>
            {activeIdx + 1}/{PIPELINE_STAGES.length}
          </span>
        </div>
        <p className="text-sm text-white mb-1">{activeStage.desc}</p>
        {activeStage.metric?.({ platform, portfolio }) && (
          <p className="text-xs font-mono" style={{ color: "#22d3ee" }}>
            {activeStage.metric({ platform, portfolio })}
          </p>
        )}
      </div>
    </>
  );
}

function LiveEnginePanel() {
  const { platform, portfolio } = useLiveEngineStats();

  const statTiles = [
    {
      label: "Scored startups",
      value: platform ? formatCompact(platform.startups) : "—",
      sub: "approved & GOD-rated",
      color: G,
    },
    {
      label: "Investors mapped",
      value: platform ? formatCompact(platform.investors) : "—",
      sub: "thesis + stage profiles",
      color: "#22d3ee",
    },
    {
      label: "Pre-computed matches",
      value: platform ? formatCompact(platform.matches) : "—",
      sub: "startup ↔ investor pairs",
      color: "#a855f7",
    },
    {
      label: "Verified funded",
      value:
        portfolio?.verified_funded_picks != null
          ? String(portfolio.verified_funded_picks)
          : "—",
      sub:
        portfolio?.verified_funded_rate_pct != null
          ? `${portfolio.verified_funded_rate_pct}% of Oracle picks`
          : "press-confirmed raises",
      color: "#22c55e",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ backgroundColor: G, boxShadow: `0 0 5px ${G}99` }}
          />
          <span className="text-xs font-mono font-bold tracking-widest uppercase" style={{ color: G }}>
            Live engine
          </span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: "oklch(0.38 0.01 264)" }}>
          production · updates daily
        </span>
      </div>

      <div className="p-5 rounded-2xl" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}>
        <div className="grid grid-cols-2 gap-2 mb-5">
          {statTiles.map(({ label, value, sub, color }) => (
            <div
              key={label}
              className="p-3 rounded-lg"
              style={{ backgroundColor: "oklch(0.1 0.01 264)", border: `1px solid ${color}22` }}
            >
              <div className="text-lg font-bold font-mono tabular-nums mb-0.5" style={{ color }}>
                {value}
              </div>
              <div className="text-[10px] font-medium text-white leading-tight">{label}</div>
              <div className="text-[9px] mt-0.5 leading-tight" style={{ color: "oklch(0.4 0.01 264)" }}>
                {sub}
              </div>
            </div>
          ))}
        </div>

        <div className="mb-3 pb-2" style={{ borderBottom: `1px solid oklch(0.18 0.01 264)` }}>
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: "oklch(0.4 0.01 264)" }}>
            Pipeline · continuous flow
          </span>
        </div>

        <PipelineFlow platform={platform} portfolio={portfolio} />

        <p className="text-[10px] font-mono mt-4 text-center" style={{ color: "oklch(0.35 0.01 264)" }}>
          discovery → entity gate → GOD → signals → trajectory → match → monitor → verify
        </p>
      </div>

      <p className="text-xs mt-3 leading-relaxed" style={{ color: "oklch(0.45 0.01 264)" }}>
        Same pipeline powers founder matching, investor MCP queries, and the Oracle scoreboard.
        Numbers from live production — not demo data.
      </p>
    </div>
  );
}

function FundingAgentSection() {
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);

  useEffect(() => {
    fetch("/api/portfolio/metrics")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMetrics(d?.metrics ?? null))
      .catch(() => {});
  }, []);

  const statTiles = [
    {
      label: "Events logged",
      value: metrics?.total_events != null ? String(metrics.total_events) : "—",
      sub: "funding, product, revenue, team",
      color: "#22c55e",
    },
    {
      label: "Funding rounds detected",
      value: metrics?.funding_event_count != null ? String(metrics.funding_event_count) : "—",
      sub: `${metrics?.funded_picks ?? "—"} picks with rounds`,
      color: "#22d3ee",
    },
    {
      label: "Verified funded",
      value: metrics?.verified_funded_picks != null ? String(metrics.verified_funded_picks) : "—",
      sub:
        metrics?.verified_funded_rate_pct != null
          ? `${metrics.verified_funded_rate_pct}% press-confirmed`
          : "press-verified raises",
      color: G,
    },
    {
      label: "Product launches tracked",
      value: metrics?.product_event_count != null ? String(metrics.product_event_count) : "—",
      sub: "classified from news feed",
      color: "#a855f7",
    },
  ];

  return (
    <section className="mb-20">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#22c55e" }} />
        <h2 className="font-display font-bold text-xl" style={{ color: "oklch(0.97 0.005 264)" }}>
          Live Funding Agent
        </h2>
        <span
          className="text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider"
          style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "1px solid #22c55e40" }}
        >
          running daily
        </span>
      </div>
      <p className="text-sm mb-6" style={{ color: "oklch(0.55 0.01 264)" }}>
        PYTHIA monitors every Oracle pick around the clock — scanning TechCrunch, VentureBeat, and
        Hacker News for funding rounds, product launches, acquisitions, and revenue milestones.
        Events are classified, logged to the portfolio, verified against press, and delivered via daily digest.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {statTiles.map((s) => (
          <div
            key={s.label}
            className="p-4 rounded-xl"
            style={{ backgroundColor: "oklch(0.115 0.01 264)", border: `1px solid ${s.color}25` }}
          >
            <div className="text-2xl font-bold mb-1 tabular-nums" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs font-medium text-white mb-0.5">{s.label}</div>
            <div className="text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {[
          {
            title: "Multi-source intelligence",
            desc: "RSS feeds from TechCrunch Startups/Venture, VentureBeat, and Hacker News — fetched in a single batch pass, matched against every portfolio company by name.",
            color: "#22c55e",
          },
          {
            title: "GPT-4o-mini classification",
            desc: "Each article is classified into: funding_round, acquisition, IPO, product_launch, revenue_milestone, team_milestone, or noise — with confidence scoring. Only signals ≥ 50% confidence are logged.",
            color: "#22d3ee",
          },
          {
            title: "MOIC auto-update",
            desc: "When a confirmed funding round is detected, the agent recalculates the portfolio company's current valuation and updates MOIC and IRR in real time.",
            color: "#a855f7",
          },
          {
            title: "Daily digest + weekly verify",
            desc: "Morning digest at 6:30 AM UTC. Weekly funding verification pass upgrades signal detections to press-confirmed outcomes on the Oracle scoreboard.",
            color: "#f97316",
          },
        ].map((c) => (
          <div
            key={c.title}
            className="p-5 rounded-xl"
            style={{ backgroundColor: "oklch(0.115 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="text-sm font-semibold text-white">{c.title}</span>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>{c.desc}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-4">
        <a href="/portfolio" className="text-xs inline-flex items-center gap-1" style={{ color: "#22c55e" }}>
          View Oracle scoreboard →
        </a>
        <span className="text-[10px] font-mono" style={{ color: "oklch(0.38 0.01 264)" }}>
          Monitor cadence · daily 6 AM UTC + Monday verify refresh
        </span>
      </div>
    </section>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    n: "01",
    icon: <Zap size={18} />,
    label: "Submit your URL",
    desc: "Paste your website. PYTHIA extracts your public signal profile — team depth, product velocity, traction markers, and market positioning. No forms. No pitch deck. No self-reporting.",
  },
  {
    n: "02",
    icon: <BarChart3 size={18} />,
    label: "GOD Scoring",
    desc: "Five dimensions scored 0–20 each — Team, Traction, Market, Product, Vision — summing to a 0–100 GOD score. Behavioral multipliers (repeat founder, social proof cascade, sector pivot) apply on top. The score is deterministic, explainable, and self-improving.",
  },
  {
    n: "03",
    icon: <Target size={18} />,
    label: "Investor candidate selection",
    desc: "Only entity-verified investors with a GOD score ≥ 30 enter the pool. Sector alignment, stage fit, and check-size compatibility are scored in real time against 6,250+ tracked investors. No spray-and-pray.",
  },
  {
    n: "04",
    icon: <Brain size={18} />,
    label: "AI match analysis",
    desc: "GPT-4o scores thesis alignment, synthesizes why-you-match bullets, and drafts a personalized intro email — informed by the investor's quality tier, recent portfolio moves, and active deployment signals.",
  },
  {
    n: "05",
    icon: <Mail size={18} />,
    label: "Action layer",
    desc: "Ranked matches with confidence levels, fit flags, outreach angles, and ready-to-send intro emails. Why each investor. Why now. No noise. No guessing.",
  },
];

const PLAYBOOK = [
  { trigger: "Δ +0.3 or higher", name: "Ride the Momentum", action: "Reach out within 48 hours. They're actively deploying.", why: "Investors in deployment mode are 3× more likely to take meetings." },
  { trigger: "Signal > 8.0 + sector aligns", name: "Thesis Match", action: "Lead with their recent investment as context.", why: "Pattern-matching to recent deals signals you've done your homework." },
  { trigger: "Sunday night / Monday AM", name: "Pre-Partner Meeting", action: "Send materials before their weekly partner meeting.", why: "Partners discuss new deals Monday. Be on the agenda." },
  { trigger: "2–3 weeks after adjacent deal", name: "Follow the Check", action: "Reference their portfolio company. Ask for intro.", why: "They're thinking about the space. Your timing looks intentional." },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function Platform() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.09 0.01 264)", fontFamily: "'Inter', sans-serif" }}>
      <Helmet>
        <title>Platform — Pythh.ai</title>
        <meta name="description" content="Pythh's live signal engine: discovery through verification — GOD scoring, 1.8M+ pre-computed matches, and a public Oracle scoreboard. One pipeline, two paths in." />
        <meta property="og:title" content="Platform — Pythh.ai" />
        <meta property="og:url" content="https://pythh.ai/platform" />
      </Helmet>

      <SharedNavbar activePath="/platform" />

      <div className="container pt-24 pb-20">

        {/* ── Hero (2-panel: copy left, live signals right) ── */}
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 mb-16 items-start pt-4">

          {/* Left */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px w-8" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                The signal engine
              </span>
            </div>
            <h1
              className="font-display font-bold mb-5 leading-tight"
              style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)", color: "oklch(0.97 0.005 264)" }}
            >
              One engine.<br />
              <span style={{ color: "oklch(0.696 0.17 162.48)" }}>Two ways in.</span>
            </h1>
            <p className="text-base leading-relaxed mb-4" style={{ color: "oklch(0.62 0.01 264)" }}>
              Pythh ingests what companies and investors do in the wild — hiring velocity,
              product shipping, funding language, thesis shifts — and scores every startup 0–100
              across five dimensions. The matches are pre-computed. The pipeline updates daily.
            </p>
            <p className="text-base leading-relaxed mb-8" style={{ color: "oklch(0.52 0.01 264)" }}>
              Founders submit a URL and get ranked investors. Investors query the same data
              through Pythh Connect MCP. Same signals. Same scores. No stale spreadsheets.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/activate"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
                style={{ border: "1px solid oklch(0.696 0.17 162.48)", color: "oklch(0.696 0.17 162.48)" }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.78 0.17 162.48)"; el.style.color = "oklch(0.78 0.17 162.48)"; }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.696 0.17 162.48)"; el.style.color = "oklch(0.696 0.17 162.48)"; }}
              >
                Find my investors <ArrowRight size={14} />
              </a>
              <a
                href="/developers"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{ border: "1px solid #7c3aed", color: "#a78bfa" }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#a78bfa"; el.style.color = "#c4b5fd"; }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#7c3aed"; el.style.color = "#a78bfa"; }}
              >
                Pythh Connect MCP <ArrowRight size={14} />
              </a>
            </div>
          </div>

          {/* Right: live engine + animated pipeline */}
          <LiveEnginePanel />
        </div>

        {/* ── Two paths ── */}
        <section className="mb-20">
          <div className="grid md:grid-cols-2 gap-5">
            <div
              className="p-6 rounded-xl"
              style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.696 0.17 162.48 / 0.25)" }}
            >
              <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "oklch(0.696 0.17 162.48)" }}>For founders</p>
              <h2 className="text-lg font-bold text-white mb-3">Submit your URL → ranked investors</h2>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "oklch(0.58 0.01 264)" }}>
                PYTHIA extracts your public signal profile, computes a GOD score across Team,
                Traction, Market, Product, and Vision, then ranks investors by thesis fit, stage,
                check size, and deployment timing. Outreach angles included.
              </p>
              <a href="/oracle" className="inline-flex items-center gap-1 text-xs font-semibold transition-colors" style={{ color: "oklch(0.696 0.17 162.48)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.78 0.17 162.48)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.696 0.17 162.48)"; }}
              >
                How it works <ArrowRight size={12} />
              </a>
            </div>
            <div
              className="p-6 rounded-xl"
              style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid #7c3aed40" }}
            >
              <p className="text-xs font-bold tracking-widest uppercase mb-2" style={{ color: "#a78bfa" }}>For investors</p>
              <h2 className="text-lg font-bold text-white mb-3">Query deal flow via MCP</h2>
              <p className="text-sm leading-relaxed mb-5" style={{ color: "oklch(0.58 0.01 264)" }}>
                Pythh Connect exposes ranked startups, GOD scores, sector momentum, and thesis
                alignment to any MCP client — Claude, Cursor, ChatGPT, Copilot. Filter by stage,
                sector, score band, or deployment signal. Live data, not exports.
              </p>
              <a href="/developers" className="inline-flex items-center gap-1 text-xs font-semibold transition-colors" style={{ color: "#a78bfa" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#c4b5fd"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#a78bfa"; }}
              >
                Pythh Connect docs <ArrowRight size={12} />
              </a>
            </div>
          </div>
        </section>

        {/* ── Signal Science Pillars ── */}
        <section className="mb-20">
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              {
                stat: "40+",
                label: "Observable signals",
                desc: "Every dimension is derived from publicly observable behavior — hiring velocity, social proof clusters, funding cadence, product shipping rates. No pitch decks. No founder self-reporting. No AI hallucination.",
                color: "oklch(0.696 0.17 162.48)",
              },
              {
                stat: "5",
                label: "Scoring dimensions",
                desc: "Team, Traction, Market, Product, Vision — each scored 0–20, summing to a 0–100 GOD score. Dimensional scoring reveals exactly where a startup is strong and where it needs work — not just a single number.",
                color: "#22d3ee",
              },
              {
                stat: "8",
                label: "Behavioral multipliers",
                desc: "Repeat founder, social proof cascade, sector pivot, oversubscription, follow-on financing — behavioral patterns that adjust the baseline score to reflect what the market is actually signaling.",
                color: "#a855f7",
              },
            ].map(({ stat, label, desc, color }) => (
              <div
                key={label}
                className="p-6 rounded-xl"
                style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
              >
                <div className="text-4xl font-bold mb-1 font-display" style={{ color }}>{stat}</div>
                <p className="text-sm font-semibold text-white mb-3">{label}</p>
                <p className="text-xs leading-relaxed" style={{ color: "oklch(0.52 0.01 264)" }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── The PYTHIA Pipeline ── */}
        <section className="mb-20">
          <div className="mb-8">
            <h2 className="font-display font-semibold text-xl mb-2" style={{ color: "oklch(0.85 0.01 264)" }}>
              The founder pipeline
            </h2>
            <p className="text-sm" style={{ color: "oklch(0.5 0.01 264)" }}>
              Five deterministic stages from URL to ranked investor shortlist. Explainable by design.
            </p>
          </div>
          <div className="space-y-4">
            {HOW_IT_WORKS.map((s) => (
              <div
                key={s.n}
                className="flex gap-5 items-start p-5 rounded-xl"
                style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}
              >
                <div
                  className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)", border: "1px solid oklch(0.696 0.17 162.48 / 0.25)", color: "oklch(0.696 0.17 162.48)" }}
                >
                  {s.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono" style={{ color: "oklch(0.4 0.01 264)" }}>{s.n}</span>
                    <span className="text-sm font-semibold" style={{ color: "oklch(0.9 0.005 264)" }}>{s.label}</span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: "oklch(0.58 0.01 264)" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Timing Playbook ── */}
        <section className="mb-20">
          <h2 className="font-display font-semibold text-xl mb-2" style={{ color: "oklch(0.85 0.01 264)" }}>
            The timing playbook
          </h2>
          <p className="text-sm mb-8" style={{ color: "oklch(0.5 0.01 264)" }}>
            When to reach out matters more than what you say. PYTHIA tells you both.
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            {PLAYBOOK.map((p) => (
              <div
                key={p.name}
                className="p-5 rounded-xl"
                style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}
              >
                <p className="text-xs font-mono mb-2" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                  IF {p.trigger}
                </p>
                <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.9 0.005 264)" }}>{p.name}</p>
                <p className="text-xs mb-2" style={{ color: "oklch(0.6 0.01 264)" }}>{p.action}</p>
                <p className="text-xs italic" style={{ color: "oklch(0.45 0.01 264)" }}>{p.why}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Funding Agent ── */}
        <FundingAgentSection />

        {/* ── CTA ── */}
        <div
          className="p-8 rounded-2xl text-center"
          style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.25 0.01 264)" }}
        >
          <h2 className="font-display font-bold text-2xl mb-3" style={{ color: "oklch(0.97 0.005 264)" }}>
            Ready to see who's ready for you?
          </h2>
          <p className="text-sm mb-6" style={{ color: "oklch(0.55 0.01 264)" }}>
            Submit your URL. PYTHIA finds your investors, times the outreach, and writes the intro.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href="/activate"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all"
              style={{ border: "1px solid oklch(0.696 0.17 162.48)", color: "oklch(0.696 0.17 162.48)" }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.78 0.17 162.48)"; el.style.color = "oklch(0.78 0.17 162.48)"; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.696 0.17 162.48)"; el.style.color = "oklch(0.696 0.17 162.48)"; }}
            >
              Find my investors <ArrowRight size={14} />
            </a>
            <Link href="/methodology">
              <span
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium cursor-pointer"
                style={{ border: "1px solid oklch(0.25 0.01 264)", color: "oklch(0.65 0.01 264)" }}
              >
                Read the methodology
              </span>
            </Link>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="border-t py-8 mt-4" style={{ borderColor: "oklch(0.2 0.01 264)", backgroundColor: "oklch(0.11 0.01 264)" }}>
        <div className="container flex flex-wrap gap-6 justify-center">
          {[
            { label: "Rankings",    href: "/rankings" },
            { label: "Methodology", href: "/methodology" },
            { label: "Pricing",     href: "/pricing" },
            { label: "Newsletter",  href: "/newsletter" },
          ].map(({ label, href }) => (
            <Link key={href} href={href}>
              <span
                className="text-xs cursor-pointer transition-colors"
                style={{ color: "oklch(0.35 0.01 264)" }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "oklch(0.6 0.01 264)")}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "oklch(0.35 0.01 264)")}
              >
                {label}
              </span>
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
