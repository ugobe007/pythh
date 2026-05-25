/**
 * /oracle — PYTHIA Oracle: How the Oracle helps startups
 */
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import {
  Zap, Target, Brain, TrendingUp, Users, ArrowRight,
  CheckCircle, Clock, Activity, Shield, Star, ChevronRight,
} from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";

// ─── Data ────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    label: "Submit your URL",
    icon: Zap,
    color: "#22d3ee",
    desc: "Drop your startup URL into the Oracle. No deck required, no forms, no pitch. PYTHIA reads your public presence and immediately begins extracting signals from your website, product, team, and market behavior.",
    detail: [
      "Reads website copy, product features, and positioning",
      "Identifies founding team signals and technical depth",
      "Detects market timing and enabling technology context",
      "Extracts pricing, traction signals, and go-to-market intent",
    ],
  },
  {
    n: "02",
    label: "GOD Score computed",
    icon: Brain,
    color: "#a855f7",
    desc: "In seconds, PYTHIA computes your GOD score — a 0–100 composite across five independently weighted dimensions. Built on 33,000+ startup outcomes. She has seen enough to know what actually matters.",
    detail: [
      "Team: founder velocity, exits, technical depth, domain fit",
      "Traction: launch status, adoption curve, social proof",
      "Market: TAM sizing, timing, enabling technology window",
      "Product: architecture, defensibility, velocity signals",
    ],
  },
  {
    n: "03",
    label: "Investor matching",
    icon: Target,
    color: "#22c55e",
    desc: "The Oracle maps your startup across 6,250+ investors — filtered by sector alignment, stage preference, check size, and timing fit. Not a list. A ranked, reasoned shortlist scored on five independent dimensions.",
    detail: [
      "Sector fit: primary and adjacent thesis alignment",
      "Stage fit: current raise vs. investor sweet spot",
      "Timing score: market readiness × deployment cycle",
      "Thesis alignment: conviction signal vs. portfolio patterns",
    ],
  },
  {
    n: "04",
    label: "Pipeline activated",
    icon: TrendingUp,
    color: "#f97316",
    desc: "Unlock the full pipeline: outreach drafts personalized to each investor's thesis, pitch prep calibrated to their portfolio blind spots, and milestone tracking to keep you raise-ready.",
    detail: [
      "Investor-specific outreach calibrated to their last 3 deals",
      "Pitch narrative adjusted for each firm's stated thesis",
      "Meeting prep: likely questions, red flags, positioning angles",
      "Live milestone feed to track pipeline progress",
    ],
  },
];

const CAPABILITIES = [
  {
    icon: Brain,
    label: "Signal Intelligence",
    color: "#22d3ee",
    desc: "PYTHIA reads 40+ behavioral and structural signals from your public presence — things traditional due diligence misses or arrives at too late.",
  },
  {
    icon: Clock,
    label: "Timing Analysis",
    color: "#a855f7",
    desc: "The Oracle knows when investors deploy. It maps your trajectory against 6,250+ investors' activity windows to surface who's ready to write a check now.",
  },
  {
    icon: Target,
    label: "Thesis Alignment",
    color: "#22c55e",
    desc: "Every investor has a pattern they're running. PYTHIA has modeled 6,250+ investor portfolios to identify thesis fit beyond sector tags and stage labels.",
  },
  {
    icon: Activity,
    label: "Real-time Scoring",
    color: "#f97316",
    desc: "Your GOD score updates as signals change — new press, funding events, product launches, and team signals are continuously integrated.",
  },
  {
    icon: Shield,
    label: "Pattern Recognition",
    color: "#ec4899",
    desc: "1.2M+ active startup-investor matches across the network. The Oracle has seen enough deals to recognize which signals actually predict fundability.",
  },
  {
    icon: Users,
    label: "Investor Network",
    color: "#eab308",
    desc: "4,007 qualified investors — not a list scraped from Crunchbase, but a network continuously scored for thesis clarity, deployment pace, and deal quality.",
  },
];

const VS = [
  { traditional: "3–6 month warm intro process",  oracle: "Instant thesis-matched shortlist" },
  { traditional: "Generic cold outreach",          oracle: "Investor-specific narrative drafted by AI" },
  { traditional: "Gut-feel on investor fit",       oracle: "Five-dimension match score with confidence" },
  { traditional: "Static pitch deck review",       oracle: "Live GOD score that updates with your signals" },
  { traditional: "No visibility into timing",      oracle: "Timing score vs. investor deployment window" },
];

const SCORE_BANDS = [
  { range: "80–100", label: "Elite · Investment-grade",   color: "#22c55e" },
  { range: "60–79",  label: "Strong · High conviction",   color: "#22d3ee" },
  { range: "40–59",  label: "Solid · Signal-building",    color: "#eab308" },
  { range: "20–39",  label: "Emerging · Early signals",   color: "#f97316" },
  { range: "0–19",   label: "Pre-signal · Forming",       color: "oklch(0.5 0.01 264)" },
];

// ─── Pythh hex icon SVG ───────────────────────────────────────────────────────

function PythhhIcon({ size = 56 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" fill="none" aria-label="Pythh">
      <polygon points="26,4 46,15 46,37 26,48 6,37 6,15" stroke="#a78bfa" strokeWidth="1.4" strokeLinejoin="round" />
      <line x1="26" y1="17" x2="16" y2="33" stroke="#a78bfa" strokeWidth="1" strokeLinecap="round" strokeDasharray="3 3" />
      <line x1="26" y1="17" x2="36" y2="33" stroke="#22d3ee" strokeWidth="1" strokeLinecap="round" strokeDasharray="3 3" />
      <line x1="16" y1="33" x2="36" y2="33" stroke="#22c55e" strokeWidth="1" strokeLinecap="round" strokeDasharray="3 3" />
      <circle cx="26" cy="17" r="2.5" stroke="#a78bfa" strokeWidth="1.2" />
      <circle cx="16" cy="33" r="2.5" stroke="#22d3ee" strokeWidth="1.2" />
      <circle cx="36" cy="33" r="2.5" stroke="#22c55e" strokeWidth="1.2" />
    </svg>
  );
}

// ─── Oracle terminal preview ──────────────────────────────────────────────────

function OracleTerminal() {
  const dims = [
    { label: "TEAM",     score: 78, color: "#a855f7" },
    { label: "TRACTION", score: 62, color: "#22d3ee" },
    { label: "MARKET",   score: 91, color: "#22c55e" },
    { label: "PRODUCT",  score: 67, color: "#22d3ee" },
    { label: "VISION",   score: 82, color: "#a855f7" },
  ];
  return (
    <div className="rounded-xl overflow-hidden w-full" style={{ border: "1px solid #22c55e28", backgroundColor: "oklch(0.08 0.01 264)", maxWidth: 500 }}>
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: "oklch(0.14 0.01 264)", backgroundColor: "oklch(0.09 0.01 264)" }}>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#22c55e" }} />
          <span className="text-xs font-mono font-semibold" style={{ color: "#22c55e" }}>PYTHIA · analyzing startup.com</span>
        </div>
        <span className="text-[10px] font-mono" style={{ color: "oklch(0.38 0.01 264)" }}>~20 sec</span>
      </div>

      {/* What you get label */}
      <div className="px-4 py-2 border-b" style={{ borderColor: "oklch(0.12 0.01 264)", backgroundColor: "oklch(0.085 0.01 264)" }}>
        <span className="text-[10px] font-mono tracking-widest uppercase" style={{ color: "oklch(0.35 0.01 264)" }}>GOD score · 5-dimension breakdown</span>
      </div>

      {/* Score bars */}
      {dims.map(({ label, score, color }) => (
        <div key={label} className="flex items-center gap-3 px-4 py-2.5 border-b" style={{ borderColor: "oklch(0.11 0.01 264)" }}>
          <span className="text-[10px] font-mono w-16 flex-shrink-0" style={{ color: "oklch(0.38 0.01 264)" }}>{label}</span>
          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ backgroundColor: "oklch(0.15 0.01 264)" }}>
            <div className="h-1 rounded-full" style={{ width: `${score}%`, backgroundColor: color, transition: "width 1s ease" }} />
          </div>
          <span className="text-xs font-mono font-bold w-6 text-right flex-shrink-0" style={{ color }}>{score}</span>
        </div>
      ))}

      {/* GOD Score + Matches */}
      <div className="grid grid-cols-2 border-t" style={{ borderColor: "oklch(0.16 0.01 264)" }}>
        <div className="px-5 py-4 border-r" style={{ borderColor: "oklch(0.14 0.01 264)" }}>
          <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "oklch(0.38 0.01 264)" }}>GOD Score</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold" style={{ color: "#22c55e" }}>76</span>
            <span className="text-xs font-mono" style={{ color: "oklch(0.4 0.01 264)" }}>/100</span>
          </div>
          <p className="text-[10px] mt-1" style={{ color: "oklch(0.42 0.01 264)" }}>Strong · Investment-grade</p>
        </div>
        <div className="px-5 py-4">
          <p className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: "oklch(0.38 0.01 264)" }}>Matched to</p>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold text-white">18</span>
            <span className="text-xs font-mono" style={{ color: "oklch(0.5 0.01 264)" }}>investors</span>
          </div>
          <p className="text-[10px] mt-1" style={{ color: "#22d3ee" }}>2 super matches · ranked</p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Oracle() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "oklch(0.09 0.01 264)", color: "oklch(0.9 0.01 264)", fontFamily: "'Inter', sans-serif" }}
    >
      <Helmet>
        <title>How It Works — Pythh.ai</title>
        <meta name="description" content="Submit your startup URL. PYTHIA scores your signals, computes a GOD score, and matches you to investors deploying in your sector — in about twenty seconds." />
        <meta property="og:title" content="How It Works — Pythh.ai" />
        <meta property="og:url" content="https://pythh.ai/oracle" />
      </Helmet>

      <SharedNavbar activePath="/oracle" />

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "0 1.5rem" }}>

        {/* ── Hero ── */}
        <div className="pt-24 pb-16">
          <div className="grid lg:grid-cols-[1fr_auto] gap-12 lg:gap-20 items-start">

            {/* Left: Identity + copy */}
            <div>
              {/* Brand mark */}
              <div className="flex items-center gap-3 mb-6">
                <PythhhIcon size={44} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold tracking-wider uppercase" style={{ color: "#c4b5fd", letterSpacing: "0.08em" }}>PYTHIA</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: "#22c55e", border: "1px solid #22c55e30" }}>For founders</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "#22c55e" }} />
                    <span className="text-[11px] font-mono" style={{ color: "#22c55e" }}>How it works · live engine</span>
                  </div>
                </div>
              </div>

              <h1
                className="font-display font-bold leading-tight mb-5"
                style={{ fontSize: "clamp(2.4rem, 5vw, 3.8rem)", letterSpacing: "-0.03em", color: "oklch(0.97 0.005 264)" }}
              >
                Submit your URL.<br />
                Get ranked investors.<br />
                <span style={{ color: "#22c55e" }}>In about twenty seconds.</span>
              </h1>

              <p className="text-base leading-relaxed mb-4" style={{ color: "oklch(0.6 0.01 264)", maxWidth: 520 }}>
                PYTHIA doesn't run keyword searches or match sector tags. She cross-references
                <strong style={{ color: "oklch(0.78 0.005 264)" }}> 40+ behavioral signals</strong> against a scoring model
                built on <strong style={{ color: "oklch(0.78 0.005 264)" }}>33,000+ startup outcomes</strong> — then ranks
                the investors most likely to fund you now.
              </p>
              <p className="text-sm leading-relaxed mb-7" style={{ color: "oklch(0.5 0.01 264)", maxWidth: 480 }}>
                No deck. No warm intro. GOD score, investor shortlist, and outreach angles — the
                whole founder pipeline from one URL.
              </p>

              <div className="flex flex-wrap gap-3 mb-10">
                <a
                  href="/activate"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all"
                  style={{ border: "1px solid #22c55e", color: "#22c55e" }}
                  onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#4ade80"; el.style.color = "#4ade80"; el.style.backgroundColor = "#22c55e0a"; }}
                  onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#22c55e"; el.style.color = "#22c55e"; el.style.backgroundColor = "transparent"; }}
                >
                  Submit your startup URL <ArrowRight size={14} />
                </a>
                <Link href="/methodology">
                  <span
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                    style={{ border: "1px solid oklch(0.22 0.01 264)", color: "oklch(0.55 0.01 264)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.85 0.005 264)"; (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.32 0.01 264)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.55 0.01 264)"; (e.currentTarget as HTMLElement).style.borderColor = "oklch(0.22 0.01 264)"; }}
                  >
                    How scores are built
                  </span>
                </Link>
              </div>

              {/* Inline proof stats */}
              <div className="flex flex-wrap gap-x-7 gap-y-2">
                {[
                  { n: "1.2M+", l: "active matches" },
                  { n: "6,250+", l: "investors in network" },
                  { n: "33k+", l: "startups scored" },
                  { n: "40+", l: "signals per startup" },
                ].map(({ n, l }) => (
                  <div key={l} className="flex items-baseline gap-1.5">
                    <span className="text-sm font-bold text-white">{n}</span>
                    <span className="text-xs" style={{ color: "oklch(0.45 0.01 264)" }}>{l}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Oracle terminal preview */}
            <div className="lg:pt-2">
              <p className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: "oklch(0.38 0.01 264)" }}>
                what you get · live preview
              </p>
              <OracleTerminal />
              <p className="text-[11px] mt-3 text-center" style={{ color: "oklch(0.35 0.01 264)" }}>
                Real output · based on actual PYTHIA analysis
              </p>
            </div>
          </div>
        </div>

        {/* ── Traditional vs. With Oracle ── */}
        <section className="mb-20">
          <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid oklch(0.18 0.01 264)" }}>
            <div className="grid grid-cols-2 px-6 py-3 border-b text-[10px] font-mono tracking-widest uppercase" style={{ backgroundColor: "oklch(0.105 0.01 264)", borderColor: "oklch(0.16 0.01 264)" }}>
              <span style={{ color: "oklch(0.38 0.01 264)" }}>Traditional fundraising</span>
              <span style={{ color: "#22c55e" }}>With Oracle</span>
            </div>
            {VS.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-2"
                style={{ borderBottom: i < VS.length - 1 ? "1px solid oklch(0.14 0.01 264)" : "none", backgroundColor: i % 2 === 0 ? "oklch(0.095 0.01 264)" : "oklch(0.105 0.01 264)" }}
              >
                <div className="flex items-center gap-3 px-6 py-3.5 border-r" style={{ borderColor: "oklch(0.15 0.01 264)" }}>
                  <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: "oklch(0.28 0.01 264)" }} />
                  <span className="text-sm" style={{ color: "oklch(0.46 0.01 264)" }}>{row.traditional}</span>
                </div>
                <div className="flex items-center gap-3 px-6 py-3.5">
                  <CheckCircle size={13} className="flex-shrink-0" style={{ color: "#22c55e" }} />
                  <span className="text-sm font-medium" style={{ color: "oklch(0.88 0.005 264)" }}>{row.oracle}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── How It Works — 2×2 grid ── */}
        <section className="mb-20">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-[10px] font-mono tracking-widest uppercase mb-2" style={{ color: "oklch(0.38 0.01 264)" }}>how it works</p>
              <h2 className="text-2xl font-bold" style={{ letterSpacing: "-0.02em", color: "oklch(0.95 0.005 264)" }}>
                Four steps. URL to investor pipeline.
              </h2>
            </div>
            <a href="/activate" className="hidden sm:flex items-center gap-1.5 text-sm transition-colors" style={{ color: "#22c55e" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#4ade80"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#22c55e"; }}
            >
              Try it now <ArrowRight size={13} />
            </a>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.n}
                  className="rounded-xl p-6"
                  style={{ backgroundColor: "oklch(0.105 0.01 264)", border: `1px solid ${step.color}20` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${step.color}14`, border: `1px solid ${step.color}30` }}>
                      <Icon size={18} style={{ color: step.color }} />
                    </div>
                    <span className="text-3xl font-bold font-mono leading-none" style={{ color: "oklch(0.2 0.01 264)" }}>{step.n}</span>
                  </div>
                  <h3 className="text-base font-bold mb-2" style={{ color: "oklch(0.92 0.005 264)" }}>{step.label}</h3>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: "oklch(0.55 0.01 264)" }}>{step.desc}</p>
                  <div className="space-y-1.5">
                    {step.detail.map((d) => (
                      <div key={d} className="flex items-start gap-2 text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>
                        <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: step.color }} />
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── What the Oracle can see ── */}
        <section className="mb-20">
          <div className="mb-8">
            <p className="text-[10px] font-mono tracking-widest uppercase mb-2" style={{ color: "oklch(0.38 0.01 264)" }}>oracle capabilities</p>
            <h2 className="text-2xl font-bold" style={{ letterSpacing: "-0.02em", color: "oklch(0.95 0.005 264)" }}>
              What the Oracle can see
            </h2>
            <p className="text-sm mt-1.5" style={{ color: "oklch(0.48 0.01 264)" }}>
              Capabilities that traditional fundraising misses entirely.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.label}
                  className="p-5 rounded-xl"
                  style={{ backgroundColor: "oklch(0.105 0.01 264)", border: `1px solid ${cap.color}18` }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${cap.color}14` }}>
                      <Icon size={15} style={{ color: cap.color }} />
                    </div>
                    <span className="text-sm font-semibold" style={{ color: "oklch(0.88 0.005 264)" }}>{cap.label}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "oklch(0.52 0.01 264)" }}>{cap.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── GOD Score ── */}
        <section className="mb-20">
          <div className="rounded-2xl p-8" style={{ background: "linear-gradient(135deg, oklch(0.11 0.02 264) 0%, oklch(0.12 0.015 280) 100%)", border: "1px solid oklch(0.2 0.01 264)" }}>
            <div className="grid lg:grid-cols-2 gap-10">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Star size={18} style={{ color: "#eab308" }} />
                  <h2 className="text-xl font-bold text-white">The GOD Score</h2>
                  <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ color: "#eab308", border: "1px solid #eab30830" }}>0 – 100</span>
                </div>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "oklch(0.6 0.01 264)" }}>
                  The GOD score is a 0–100 predictive composite across five observable dimensions —
                  Team, Traction, Market, Product, and Vision — built on 33,000+ startup outcomes.
                  It isn't a confidence meter. It's what the signals actually say.
                </p>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "oklch(0.5 0.01 264)" }}>
                  Five dimensions. Each independently observable. No self-reporting. No editorial override. Updates automatically as new signals surface.
                </p>
                <Link href="/methodology">
                  <span className="inline-flex items-center gap-1 text-xs cursor-pointer transition-colors" style={{ color: "#a78bfa" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#c4b5fd"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#a78bfa"; }}
                  >
                    Full scoring methodology <ChevronRight size={12} />
                  </span>
                </Link>
              </div>
              <div>
                <p className="text-[10px] font-mono tracking-widest uppercase mb-4" style={{ color: "oklch(0.4 0.01 264)" }}>score bands</p>
                <div className="space-y-2">
                  {SCORE_BANDS.map((b) => (
                    <div key={b.range} className="flex items-center gap-4">
                      <div className="w-0.5 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                      <span className="text-xs font-mono w-16 flex-shrink-0 tabular-nums" style={{ color: b.color }}>{b.range}</span>
                      <span className="text-xs" style={{ color: "oklch(0.55 0.01 264)" }}>{b.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── For investors ── */}
        <section className="mb-20">
          <div
            className="rounded-2xl p-8 lg:p-10"
            style={{ background: "linear-gradient(135deg, oklch(0.11 0.02 280) 0%, oklch(0.1 0.015 264) 100%)", border: "1px solid #7c3aed28" }}
          >
            <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-center">
              <div>
                <p className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#a78bfa" }}>For investors</p>
                <h2 className="text-xl font-bold text-white mb-3">Looking for startups, not sending a URL?</h2>
                <p className="text-sm leading-relaxed max-w-xl" style={{ color: "oklch(0.58 0.01 264)" }}>
                  Pythh Connect exposes the full signal engine through MCP — query ranked startups,
                  GOD scores, thesis fit, and deployment windows from Claude, Cursor, or any agent
                  client. Same data. Live pipeline. No exports.
                </p>
              </div>
              <a
                href="/developers"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold flex-shrink-0 transition-all"
                style={{ border: "1px solid #7c3aed", color: "#a78bfa" }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#a78bfa"; el.style.color = "#c4b5fd"; }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#7c3aed"; el.style.color = "#a78bfa"; }}
              >
                Pythh Connect <ArrowRight size={14} />
              </a>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="text-center pb-20">
          <div className="flex justify-center mb-5">
            <PythhhIcon size={52} />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3" style={{ letterSpacing: "-0.02em" }}>
            Let the Oracle read your startup.
          </h2>
          <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: "oklch(0.5 0.01 264)" }}>
            Submit your URL. GOD score in seconds. Investor matches ranked and ready.
            No deck, no intro, no waiting.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a
              href="/activate"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-lg text-sm font-semibold transition-all"
              style={{ border: "1px solid #22c55e", color: "#22c55e" }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#4ade80"; el.style.color = "#4ade80"; el.style.backgroundColor = "#22c55e0a"; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "#22c55e"; el.style.color = "#22c55e"; el.style.backgroundColor = "transparent"; }}
            >
              Find my investors <ArrowRight size={16} />
            </a>
            <Link href="/matches">
              <span
                className="inline-flex items-center gap-2 px-7 py-3 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                style={{ border: "1px solid oklch(0.22 0.01 264)", color: "oklch(0.55 0.01 264)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.85 0.005 264)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.55 0.01 264)"; }}
              >
                View active matches
              </span>
            </Link>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t py-8" style={{ borderColor: "oklch(0.16 0.01 264)" }}>
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs" style={{ color: "oklch(0.38 0.01 264)" }}>© 2026 Pythh · pythh.ai</span>
          <div className="flex gap-6">
            {["/methodology", "/rankings", "/investors", "/pricing"].map((href) => (
              <Link key={href} href={href}>
                <span
                  className="text-xs capitalize cursor-pointer transition-colors"
                  style={{ color: "oklch(0.42 0.01 264)" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.65 0.01 264)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.42 0.01 264)")}
                >
                  {href.replace("/", "")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
