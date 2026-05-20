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
    desc: "In seconds, PYTHIA computes your GOD score — a 0–100 composite across five independently weighted dimensions. This isn't a confidence score. It's a predictive model built on 33,000+ startup outcomes. She has seen enough to know what actually matters.",
    detail: [
      "Team: founder velocity, exits, technical depth, domain fit",
      "Traction: launch status, adoption curve, social proof",
      "Market: TAM sizing, timing, enabling technology window",
      "Product: architecture, defensibility, velocity signals",
      "Vision: contrarian clarity, inevitability, missionary signal",
    ],
  },
  {
    n: "03",
    label: "Investor matching",
    icon: Target,
    color: "#22c55e",
    desc: "The Oracle maps your startup across 6,250+ investors in the Pythh network — filtered by sector alignment, stage preference, check size, and timing fit. Every match is scored on five independent dimensions. Not a list. A ranked, reasoned shortlist.",
    detail: [
      "Sector fit: primary and adjacent thesis alignment",
      "Stage fit: current raise vs. investor sweet spot",
      "Timing score: market readiness × investor deployment cycle",
      "Thesis alignment: conviction signal vs. investor portfolio patterns",
      "Confidence score: composite match reliability",
    ],
  },
  {
    n: "04",
    label: "Pipeline activated",
    icon: TrendingUp,
    color: "#f97316",
    desc: "Activate PYTHIA and unlock the full pipeline: outreach drafts personalized to each investor's thesis, pitch prep calibrated to their portfolio blind spots, and milestone tracking to keep you raise-ready.",
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
    desc: "The Oracle knows when investors deploy. It maps your trajectory against 2,616 qualified investors' activity windows to surface who's ready to write a check now.",
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
    desc: "91,950 active startup-investor matches across the network. The Oracle has seen enough deals to recognize which signals actually predict fundability.",
  },
  {
    icon: Users,
    label: "Investor Network",
    color: "#eab308",
    desc: "4,007 qualified investors — not a list scraped from Crunchbase, but a network continuously scored for thesis clarity, deployment pace, and deal quality.",
  },
];

const STATS = [
  { label: "Active matches",          value: "91,950" },
  { label: "Qualified investors",     value: "4,007" },
  { label: "Investment-grade startups",value: "1,774" },
  { label: "Signals per startup",     value: "40+" },
];

const VS = [
  { traditional: "3–6 month warm intro process",  oracle: "Instant thesis-matched shortlist" },
  { traditional: "Generic cold outreach",          oracle: "Investor-specific narrative drafted by AI" },
  { traditional: "Gut-feel on investor fit",       oracle: "Five-dimension match score with confidence" },
  { traditional: "Static pitch deck review",       oracle: "Live GOD score that updates with your signals" },
  { traditional: "No visibility into timing",      oracle: "Timing score vs. investor deployment window" },
];

const SCORE_BANDS = [
  { range: "80 – 100", label: "Elite / High-conviction",  color: "#22c55e" },
  { range: "60 – 79",  label: "Strong / Investment-grade", color: "#22d3ee" },
  { range: "40 – 59",  label: "Solid / Signal-building",  color: "#eab308" },
  { range: "20 – 39",  label: "Emerging / Early signals", color: "#f97316" },
  { range: "0 – 19",   label: "Pre-signal / Forming",     color: "oklch(0.5 0.01 264)" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Oracle() {
  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: "oklch(0.09 0.01 264)", color: "oklch(0.9 0.01 264)", fontFamily: "'Inter', sans-serif" }}
    >
      <Helmet>
        <title>PYTHIA Oracle — How It Works — Pythh.ai</title>
        <meta name="description" content="PYTHIA Oracle analyzes your startup URL, computes a GOD score across 5 signal dimensions, and matches you to the right investors at the right time." />
        <meta property="og:title" content="PYTHIA Oracle — Pythh.ai" />
        <meta property="og:url" content="https://pythh.ai/oracle" />
      </Helmet>

      <SharedNavbar activePath="/oracle" />

      <main className="container pt-24 pb-20" style={{ maxWidth: "1200px" }}>

        {/* ── Hero (2-panel) ── */}
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-16 mb-20 items-start pt-4">

          {/* Left: Positioning */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <span
                className="inline-block w-2 h-2 rounded-full animate-pulse"
                style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }}
              />
              <span className="text-[11px] uppercase tracking-[2px]" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                PYTHIA Oracle
              </span>
            </div>
            <h1
              className="font-display font-bold leading-tight mb-6"
              style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)", letterSpacing: "-0.02em" }}
            >
              The Oracle doesn't score your deck.
              <br />
              <span style={{ color: "oklch(0.696 0.17 162.48)" }}>It reads your signals.</span>
            </h1>
            <p className="text-base leading-relaxed mb-4" style={{ color: "oklch(0.62 0.01 264)" }}>
              PYTHIA doesn't run keyword searches or match sector tags. She cross-references 40+
              behavioral signals against a scoring model built on 33,000+ startup outcomes.
              The Oracle is wise because she has seen enough to know what actually matters.
            </p>
            <p className="text-base leading-relaxed mb-8" style={{ color: "oklch(0.52 0.01 264)" }}>
              Submit your URL. No deck. No warm intro. PYTHIA computes your GOD score in seconds
              and returns a ranked, reasoned investor shortlist — with outreach written.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/activate"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all"
                style={{ border: "1px solid oklch(0.696 0.17 162.48)", color: "oklch(0.696 0.17 162.48)" }}
                onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.78 0.17 162.48)"; el.style.color = "oklch(0.78 0.17 162.48)"; }}
                onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.696 0.17 162.48)"; el.style.color = "oklch(0.696 0.17 162.48)"; }}
              >
                Activate Oracle now <ArrowRight size={15} />
              </a>
              <Link href="/methodology">
                <span
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                  style={{ border: "1px solid oklch(0.25 0.01 264)", color: "oklch(0.65 0.01 264)" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.94 0.005 264)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.65 0.01 264)")}
                >
                  Read the methodology
                </span>
              </Link>
            </div>
          </div>

          {/* Right: Stats + VS comparison */}
          <div>
            {/* Stats 2×2 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {STATS.map((s) => (
                <div
                  key={s.label}
                  className="p-4 rounded-xl"
                  style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
                >
                  <div className="text-2xl font-bold text-white mb-0.5">{s.value}</div>
                  <div className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* VS comparison */}
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid oklch(0.2 0.01 264)" }}>
              <div
                className="grid grid-cols-2 px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest"
                style={{ backgroundColor: "oklch(0.115 0.01 264)", borderBottom: "1px solid oklch(0.2 0.01 264)", color: "oklch(0.45 0.01 264)" }}
              >
                <div>Traditional</div>
                <div style={{ color: "oklch(0.696 0.17 162.48)" }}>With Oracle</div>
              </div>
              {VS.map((row, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 px-4 py-3 text-xs"
                  style={{ borderBottom: i < VS.length - 1 ? "1px solid oklch(0.16 0.01 264)" : undefined }}
                >
                  <div className="flex items-center gap-2 pr-3" style={{ color: "oklch(0.48 0.01 264)" }}>
                    <span className="flex-shrink-0 w-1 h-1 rounded-full" style={{ backgroundColor: "oklch(0.32 0.01 264)" }} />
                    {row.traditional}
                  </div>
                  <div className="flex items-center gap-1.5" style={{ color: "oklch(0.85 0.01 264)" }}>
                    <CheckCircle size={11} className="flex-shrink-0" style={{ color: "oklch(0.696 0.17 162.48)" }} />
                    {row.oracle}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── How It Works ── */}
        <section className="mb-24">
          <h2
            className="text-2xl font-bold mb-2"
            style={{ color: "oklch(0.696 0.17 162.48)", letterSpacing: "-0.01em" }}
          >
            How the Oracle works
          </h2>
          <p className="text-sm mb-10" style={{ color: "oklch(0.5 0.01 264)" }}>
            Four steps from URL to active investor pipeline.
          </p>

          <div className="space-y-0">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.n} className="relative">
                  {i < STEPS.length - 1 && (
                    <div
                      className="absolute left-6 top-16 bottom-0 w-px"
                      style={{ backgroundColor: "oklch(0.18 0.01 264)" }}
                    />
                  )}
                  <div className="flex gap-6 pb-10">
                    <div className="flex-shrink-0">
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: `${step.color}18`, border: `1px solid ${step.color}40` }}
                      >
                        <Icon size={20} style={{ color: step.color }} />
                      </div>
                    </div>
                    <div className="flex-1 pt-2">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-mono" style={{ color: "oklch(0.4 0.01 264)" }}>{step.n}</span>
                        <h3 className="text-lg font-bold text-white">{step.label}</h3>
                      </div>
                      <p className="text-sm leading-relaxed mb-4" style={{ color: "oklch(0.58 0.01 264)" }}>
                        {step.desc}
                      </p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {step.detail.map((d) => (
                          <div key={d} className="flex items-start gap-2 text-xs" style={{ color: "oklch(0.55 0.01 264)" }}>
                            <CheckCircle size={12} className="flex-shrink-0 mt-0.5" style={{ color: step.color }} />
                            {d}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Oracle Capabilities (3-col) ── */}
        <section className="mb-24">
          <h2 className="text-2xl font-bold mb-2" style={{ letterSpacing: "-0.01em" }}>
            What the Oracle can see
          </h2>
          <p className="text-sm mb-8" style={{ color: "oklch(0.5 0.01 264)" }}>
            Capabilities that traditional fundraising misses entirely.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.label}
                  className="p-5 rounded-xl"
                  style={{ backgroundColor: "oklch(0.115 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${cap.color}18` }}
                    >
                      <Icon size={16} style={{ color: cap.color }} />
                    </div>
                    <span className="text-sm font-semibold text-white">{cap.label}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>{cap.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── GOD Score (2-panel) ── */}
        <section className="mb-24">
          <div
            className="grid lg:grid-cols-2 gap-10 p-8 rounded-2xl"
            style={{
              background: "linear-gradient(135deg, oklch(0.12 0.02 264) 0%, oklch(0.13 0.015 280) 100%)",
              border: "1px solid oklch(0.22 0.01 264)",
            }}
          >
            {/* Left */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Star size={18} style={{ color: "#22d3ee" }} />
                <h2 className="text-xl font-bold text-white">The GOD Score</h2>
                <span
                  className="text-xs px-2 py-0.5 rounded font-mono"
                  style={{ backgroundColor: "oklch(0.18 0.02 264)", color: "#22d3ee" }}
                >
                  0 – 100
                </span>
              </div>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "oklch(0.6 0.01 264)" }}>
                The GOD score (Graded Opportunity Distribution) is not a confidence meter. It's a
                predictive composite built on signals from 33,000+ startups — calibrated to surface
                companies with multi-dimensional strength before the market has priced them in.
              </p>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "oklch(0.52 0.01 264)" }}>
                Five dimensions. Each independently observable. No self-reporting. No editorial
                override. The score updates automatically as new signals surface.
              </p>
              <Link href="/methodology">
                <span className="inline-flex items-center gap-1 text-xs cursor-pointer" style={{ color: "#22d3ee" }}>
                  Full scoring methodology <ChevronRight size={12} />
                </span>
              </Link>
            </div>

            {/* Right: score bands */}
            <div>
              <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: "oklch(0.45 0.01 264)" }}>
                Score bands
              </p>
              <div className="space-y-2.5">
                {SCORE_BANDS.map((b) => (
                  <div
                    key={b.range}
                    className="flex items-center gap-4 p-3 rounded-lg"
                    style={{ backgroundColor: "oklch(0.115 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
                  >
                    <div
                      className="w-12 text-center text-xs font-mono font-bold flex-shrink-0 py-1 rounded"
                      style={{ color: b.color, backgroundColor: `${b.color}15` }}
                    >
                      {b.range}
                    </div>
                    <div className="text-xs" style={{ color: "oklch(0.6 0.01 264)" }}>{b.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="text-center">
          <div
            className="inline-flex w-12 h-12 rounded-xl mb-6 items-center justify-center mx-auto"
            style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.12)", border: "1px solid oklch(0.696 0.17 162.48 / 0.3)" }}
          >
            <Zap size={22} style={{ color: "oklch(0.696 0.17 162.48)" }} />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4" style={{ letterSpacing: "-0.02em" }}>
            Let the Oracle read your startup.
          </h2>
          <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: "oklch(0.55 0.01 264)" }}>
            Submit your URL. GOD score in seconds. Investor matches ranked and ready.
            No deck, no intro, no waiting.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a
              href="/activate"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-lg text-sm font-semibold transition-all"
              style={{ border: "1px solid oklch(0.696 0.17 162.48)", color: "oklch(0.696 0.17 162.48)" }}
              onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.78 0.17 162.48)"; el.style.color = "oklch(0.78 0.17 162.48)"; }}
              onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.696 0.17 162.48)"; el.style.color = "oklch(0.696 0.17 162.48)"; }}
            >
              Activate PYTHIA <ArrowRight size={16} />
            </a>
            <Link href="/matches">
              <span
                className="inline-flex items-center gap-2 px-7 py-3 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
                style={{ border: "1px solid oklch(0.3 0.01 264)", color: "oklch(0.7 0.01 264)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.94 0.005 264)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.7 0.01 264)")}
              >
                View active matches
              </span>
            </Link>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-16" style={{ borderColor: "oklch(0.18 0.01 264)" }}>
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>© 2026 Pythh · pythh.ai</span>
          <div className="flex gap-6">
            {["/methodology", "/rankings", "/investors", "/portfolio", "/pricing"].map((href) => (
              <Link key={href} href={href}>
                <span
                  className="text-xs capitalize cursor-pointer transition-colors"
                  style={{ color: "oklch(0.45 0.01 264)" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.7 0.01 264)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.45 0.01 264)")}
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
