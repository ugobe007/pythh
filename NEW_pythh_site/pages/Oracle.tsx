/**
 * /oracle — PYTHIA Oracle: How the Oracle helps startups
 *
 * Explains the full lifecycle: URL → signals → GOD score → investor match → pipeline activation.
 * Positions the Oracle as the core intelligence layer of Pythh.
 */
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import {
  Zap, Target, Brain, TrendingUp, Users, ArrowRight,
  CheckCircle, Clock, Activity, Shield, Star, ChevronRight,
} from "lucide-react";

// ─── Shared nav ───────────────────────────────────────────────────────────────

function PageNav() {
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        backgroundColor: "oklch(0.11 0.01 264 / 0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid oklch(0.18 0.01 264)",
      }}
    >
      <div className="container">
        <div className="flex items-center justify-between h-14">
          <Link href="/">
            <span className="font-display font-bold text-base text-white tracking-tight cursor-pointer">
              pythh.ai
            </span>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {[
              { href: "/oracle", label: "Oracle" },
              { href: "/rankings", label: "Rankings" },
              { href: "/matches", label: "Matches" },
              { href: "/investors", label: "Investors" },
              { href: "/platform", label: "Platform" },
            ].map(({ href, label }) => (
              <Link key={href} href={href}>
                <span
                  className="text-sm font-medium cursor-pointer transition-colors"
                  style={{
                    color: href === "/oracle"
                      ? "oklch(0.696 0.17 162.48)"
                      : "oklch(0.6 0.01 264)",
                  }}
                >
                  {label}
                </span>
              </Link>
            ))}
          </div>
          <a
            href="/activate"
            className="px-4 py-1.5 rounded-md text-sm font-semibold"
            style={{
              backgroundColor: "oklch(0.696 0.17 162.48 / 0.15)",
              color: "oklch(0.696 0.17 162.48)",
              border: "1px solid oklch(0.696 0.17 162.48 / 0.3)",
            }}
          >
            Activate →
          </a>
        </div>
      </div>
    </nav>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = [
  {
    n: "01",
    label: "Submit your URL",
    icon: Zap,
    color: "#22d3ee",
    desc: "Drop your startup URL into the Oracle. No deck required, no forms, no pitch. The Oracle reads your public presence and immediately begins extracting signals from your website, product, team, and market behavior.",
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
    desc: "In seconds, PYTHIA computes your GOD score — a 0–100 composite across seven independently weighted dimensions. This isn't a confidence score. It's a predictive model built on 33,000+ startup outcomes.",
    detail: [
      "Team: founder velocity, exits, technical depth, domain fit",
      "Traction: launch status, adoption curve, social proof",
      "Market: TAM sizing, timing, enabling technology window",
      "Product: architecture, defensibility, velocity signals",
      "Vision: contrarian clarity, inevitability, missionary signal",
      "Grit: iteration speed, pivot history, resilience signals",
      "Momentum: live funding acceleration, customer adoption",
    ],
  },
  {
    n: "03",
    label: "Investor matching",
    icon: Target,
    color: "#22c55e",
    desc: "The Oracle maps your startup across 6,250+ investors in the Pythh network — filtered by sector alignment, stage preference, check size, and timing fit. Every match is scored on five independent dimensions.",
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
      "Investor-specific outreach email calibrated to their last 3 deals",
      "Pitch narrative adjusted for each firm's stated thesis",
      "Meeting prep: likely questions, red flags, and positioning angles",
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
    desc: "The Oracle knows when investors deploy. It maps your funding trajectory against 2,616 qualified investors' activity windows to surface who's ready to write a check now.",
  },
  {
    icon: Target,
    label: "Thesis Alignment",
    color: "#22c55e",
    desc: "Every investor has a pattern they're running. PYTHIA has modeled 6,250+ investor portfolios to identify thesis fit that goes beyond sector tags and stage labels.",
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
    desc: "91,950 active startup-investor matches across the Pythh network. The Oracle has seen enough deals to recognize which signals actually predict fundability.",
  },
  {
    icon: Users,
    label: "Investor Network",
    color: "#eab308",
    desc: "Access to 4,007 qualified investors — not a list scraped from Crunchbase, but a network continuously scored for thesis clarity, deployment pace, and deal quality.",
  },
];

const STATS = [
  { label: "Active matches in network", value: "91,950" },
  { label: "Qualified investors", value: "4,007" },
  { label: "Investment-grade startups", value: "1,774" },
  { label: "Signals tracked per startup", value: "40+" },
];

const VS = [
  { traditional: "3–6 month warm intro process", oracle: "Instant thesis-matched shortlist" },
  { traditional: "Generic cold outreach", oracle: "Investor-specific narrative drafted by AI" },
  { traditional: "Gut-feel on investor fit", oracle: "Five-dimension match score with confidence" },
  { traditional: "Static pitch deck review", oracle: "Live GOD score that updates with your signals" },
  { traditional: "No visibility into timing", oracle: "Timing score vs. investor deployment window" },
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
        <meta
          name="description"
          content="PYTHIA Oracle analyzes your startup URL, computes a GOD score across 7 signal dimensions, and matches you to the right investors at the right time. See how it works."
        />
        <meta property="og:title" content="PYTHIA Oracle — Pythh.ai" />
        <meta property="og:url" content="https://pythh.ai/oracle" />
      </Helmet>

      <PageNav />

      <main className="container pt-24 pb-20 max-w-5xl">

        {/* ── Hero ── */}
        <div className="mb-20">
          <div
            className="text-[11px] uppercase tracking-[2px] mb-4 flex items-center gap-2"
            style={{ color: "oklch(0.696 0.17 162.48)" }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full animate-pulse"
              style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }}
            />
            PYTHIA Oracle
          </div>
          <h1
            className="font-display font-bold text-4xl sm:text-5xl leading-tight mb-6"
            style={{ letterSpacing: "-0.02em" }}
          >
            The Oracle doesn't score your deck.
            <br />
            <span style={{ color: "oklch(0.696 0.17 162.48)" }}>
              It reads your signals.
            </span>
          </h1>
          <p
            className="text-lg leading-relaxed max-w-2xl mb-8"
            style={{ color: "oklch(0.6 0.01 264)" }}
          >
            PYTHIA is Pythh's AI intelligence layer. Submit a URL and the Oracle extracts
            40+ behavioral and structural signals, computes your GOD score in seconds, and
            maps you to the investors most likely to fund your specific stage and thesis.
            No deck required. No warm intro needed.
          </p>

          {/* Stats bar */}
          <div
            className="flex flex-wrap gap-6 py-4 px-5 rounded-xl mb-8"
            style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
          >
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="text-2xl font-bold text-white">{s.value}</div>
                <div className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          <a
            href="/activate"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-colors"
            style={{
              backgroundColor: "oklch(0.696 0.17 162.48)",
              color: "oklch(0.09 0.01 264)",
            }}
          >
            Activate Oracle now <ArrowRight size={16} />
          </a>
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
                    {/* Step indicator */}
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
                        <span className="text-xs font-mono" style={{ color: "oklch(0.4 0.01 264)" }}>
                          {step.n}
                        </span>
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

        {/* ── Oracle Capabilities ── */}
        <section className="mb-24">
          <h2
            className="text-2xl font-bold mb-2"
            style={{ letterSpacing: "-0.01em" }}
          >
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
                  <p className="text-xs leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>
                    {cap.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Oracle vs Traditional ── */}
        <section className="mb-24">
          <h2
            className="text-2xl font-bold mb-2"
            style={{ letterSpacing: "-0.01em" }}
          >
            Oracle vs. traditional fundraising
          </h2>
          <p className="text-sm mb-8" style={{ color: "oklch(0.5 0.01 264)" }}>
            What changes when the machine reads your signals before you pitch.
          </p>
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid oklch(0.2 0.01 264)" }}
          >
            <div
              className="grid grid-cols-2 px-5 py-3 text-xs font-bold uppercase tracking-widest"
              style={{
                backgroundColor: "oklch(0.115 0.01 264)",
                borderBottom: "1px solid oklch(0.2 0.01 264)",
                color: "oklch(0.45 0.01 264)",
              }}
            >
              <div>Traditional approach</div>
              <div style={{ color: "oklch(0.696 0.17 162.48)" }}>With Oracle</div>
            </div>
            {VS.map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-2 px-5 py-4 text-sm"
                style={{ borderBottom: i < VS.length - 1 ? "1px solid oklch(0.16 0.01 264)" : undefined }}
              >
                <div className="flex items-center gap-2" style={{ color: "oklch(0.5 0.01 264)" }}>
                  <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: "oklch(0.35 0.01 264)" }} />
                  {row.traditional}
                </div>
                <div className="flex items-center gap-2" style={{ color: "oklch(0.85 0.01 264)" }}>
                  <CheckCircle size={12} className="flex-shrink-0" style={{ color: "oklch(0.696 0.17 162.48)" }} />
                  {row.oracle}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── GOD Score Explainer ── */}
        <section className="mb-24">
          <div
            className="rounded-2xl p-8"
            style={{
              background: "linear-gradient(135deg, oklch(0.12 0.02 264) 0%, oklch(0.13 0.015 280) 100%)",
              border: "1px solid oklch(0.22 0.01 264)",
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Star size={20} style={{ color: "#22d3ee" }} />
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
            <div className="grid sm:grid-cols-3 gap-3 mb-6">
              {[
                { range: "80 – 100", label: "Elite / High-conviction", color: "#22c55e" },
                { range: "60 – 79", label: "Strong / Investment-grade", color: "#22d3ee" },
                { range: "40 – 59", label: "Solid / Signal-building", color: "#eab308" },
                { range: "20 – 39", label: "Emerging / Early signals", color: "#f97316" },
                { range: "0 – 19", label: "Pre-signal / Forming", color: "oklch(0.5 0.01 264)" },
              ].map((b) => (
                <div
                  key={b.range}
                  className="flex items-center gap-3 p-3 rounded-lg"
                  style={{ backgroundColor: "oklch(0.115 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: b.color }} />
                  <div>
                    <div className="text-xs font-mono font-bold" style={{ color: b.color }}>{b.range}</div>
                    <div className="text-xs" style={{ color: "oklch(0.5 0.01 264)" }}>{b.label}</div>
                  </div>
                </div>
              ))}
            </div>
            <Link href="/methodology">
              <span
                className="inline-flex items-center gap-1 text-xs cursor-pointer"
                style={{ color: "#22d3ee" }}
              >
                Full scoring methodology <ChevronRight size={12} />
              </span>
            </Link>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="text-center">
          <div
            className="inline-block w-12 h-12 rounded-xl mb-6 flex items-center justify-center mx-auto"
            style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.15)", border: "1px solid oklch(0.696 0.17 162.48 / 0.3)" }}
          >
            <Zap size={22} style={{ color: "oklch(0.696 0.17 162.48)" }} />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4" style={{ letterSpacing: "-0.02em" }}>
            Let the Oracle read your startup.
          </h2>
          <p className="text-sm mb-8 max-w-md mx-auto" style={{ color: "oklch(0.55 0.01 264)" }}>
            Submit your URL. GOD score computed in seconds. Investor matches ranked and ready.
            No deck, no intro, no waiting.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <a
              href="/activate"
              className="inline-flex items-center gap-2 px-7 py-3 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.09 0.01 264)" }}
            >
              Activate PYTHIA <ArrowRight size={16} />
            </a>
            <Link href="/matches">
              <span
                className="inline-flex items-center gap-2 px-7 py-3 rounded-lg text-sm font-semibold cursor-pointer"
                style={{ border: "1px solid oklch(0.3 0.01 264)", color: "oklch(0.7 0.01 264)" }}
              >
                View active matches
              </span>
            </Link>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer
        className="border-t py-8 mt-16"
        style={{ borderColor: "oklch(0.18 0.01 264)" }}
      >
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>
            © 2026 Pythh · pythh.ai
          </span>
          <div className="flex gap-6">
            {["/methodology", "/rankings", "/investors", "/portfolio", "/pricing"].map((href) => (
              <Link key={href} href={href}>
                <span className="text-xs capitalize cursor-pointer" style={{ color: "oklch(0.45 0.01 264)" }}>
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
