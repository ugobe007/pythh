import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { ArrowRight } from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";

// ─── Data ────────────────────────────────────────────────────────────────────

const GOD_DIMS = [
  {
    label: "Team",
    weight: "20 pts",
    color: "#a855f7",
    desc: "Founder background, domain expertise, repeat-founder status, advisor network. We score what founders have publicly demonstrated — not what they claim.",
  },
  {
    label: "Traction",
    weight: "20 pts",
    color: "#22d3ee",
    desc: "Revenue indicators, customer count, MRR/ARR proxies, growth velocity from public signals — job posts, press, product launches.",
  },
  {
    label: "Market",
    weight: "20 pts",
    color: "#f97316",
    desc: "Total addressable market size, sector momentum, comparable funding activity, and timing relative to macro trends.",
  },
  {
    label: "Product",
    weight: "20 pts",
    color: "#eab308",
    desc: "Product clarity, differentiation signals, technical depth, and evidence of shipping velocity from the public footprint.",
  },
  {
    label: "Vision",
    weight: "20 pts",
    color: "#22c55e",
    desc: "Narrative coherence, mission clarity, and long-arc thesis alignment with the market opportunity.",
  },
];

const INVESTOR_DIMS = [
  { label: "Profile Completeness", weight: "25 pts", desc: "Firm name, sectors, stage, check size, thesis, and contact info." },
  { label: "Investment Focus",     weight: "25 pts", desc: "Sector + stage specificity. Generalists dilute; specialists score higher." },
  { label: "Capital Readiness",    weight: "20 pts", desc: "Active fund size, dry powder estimates, deployment velocity index." },
  { label: "Track Record",         weight: "20 pts", desc: "Investment count, successful exits, notable portfolio companies." },
  { label: "Activity & Velocity",  weight: "10 pts", desc: "Recency of last investment and deployment cadence over trailing 12 months." },
];

const TIERS = [
  { label: "Elite",    range: "70 – 100", color: "#eab308",              desc: "Top-quartile investors. Rich data, active deployment, strong track record." },
  { label: "Strong",   range: "50 – 69",  color: "oklch(0.696 0.17 162.48)", desc: "High-quality investors with solid focus and meaningful activity." },
  { label: "Solid",    range: "30 – 49",  color: "oklch(0.65 0.12 162.48)", desc: "Minimum viable signal — included in the matching pool." },
  { label: "Emerging", range: "0 – 29",   color: "oklch(0.35 0.01 264)",  desc: "Insufficient data — excluded to protect match quality." },
];

const GATE_STAGES = [
  { n: "1", label: "Logic Engine",           desc: "Structural template check: startup name vs investor, descriptor, or RSS headline pattern." },
  { n: "2", label: "Ontology + Inference",   desc: "Name ontology flags news wire junk, scraper concatenation artifacts, and known garbage patterns." },
  { n: "3", label: "Entity Disambiguation",  desc: "Geographic, person, and brand disambiguation to avoid misclassifying proper nouns." },
  { n: "4", label: "URL Gate",               desc: "A verified website promotes a startup to qualified. Without one: needs_url queue or junk." },
];

const PRINCIPLES = [
  "No self-reported data. Every score is derived from publicly observable behavior.",
  "No pay-to-play. Investor placement is determined by GOD score and fit, not spend.",
  "No opaque rankings. Every score component is visible in the score_breakdown field.",
  "Garbage in, garbage out — the entity gate exists to protect match quality at the source.",
  "Both sides are scored. Founder readiness and investor quality must both meet a floor.",
];

// ─── Section divider ─────────────────────────────────────────────────────────

function SectionDivider({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      <span className="text-xs font-mono" style={{ color: "oklch(0.35 0.01 264)" }}>{n}</span>
      <h2 className="font-display font-semibold text-2xl" style={{ color: "oklch(0.85 0.01 264)" }}>{title}</h2>
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Methodology() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.09 0.01 264)", fontFamily: "'Inter', sans-serif" }}>
      <Helmet>
        <title>Methodology — Pythh.ai</title>
        <meta name="description" content="How Pythh scores startups and investors: GOD score dimensions, entity resolution gate, investor tiers, and the full matching pipeline." />
        <meta property="og:title" content="Methodology — Pythh.ai" />
        <meta property="og:url" content="https://pythh.ai/methodology" />
      </Helmet>

      <SharedNavbar activePath="/methodology" />

      <div className="container pt-24 pb-20" style={{ maxWidth: "1200px" }}>

        {/* ── Hero (2-panel) ── */}
        <div className="grid lg:grid-cols-[1fr_1fr] gap-12 lg:gap-20 mb-20 items-start pt-4">

          {/* Left */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="h-px w-8" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                Pythh Capital · Methodology
              </span>
            </div>
            <h1
              className="font-display font-bold mb-5 leading-tight"
              style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)", color: "oklch(0.97 0.005 264)" }}
            >
              How we score.<br />
              <span style={{ color: "oklch(0.55 0.01 264)" }}>How we match.</span>
            </h1>
            <p className="text-base leading-relaxed mb-4" style={{ color: "oklch(0.62 0.01 264)" }}>
              Every number on Pythh is derived from observed signals — public behavior, funding data,
              product velocity, and market timing. No self-reported information. No black boxes.
            </p>
            <p className="text-base leading-relaxed" style={{ color: "oklch(0.52 0.01 264)" }}>
              The same scoring model runs for every startup and every investor. The methodology is
              deterministic, explainable, and sharpens continuously as new data surfaces.
            </p>
          </div>

          {/* Right: Core Principles */}
          <div
            className="p-6 rounded-2xl"
            style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}
          >
            <p className="text-xs font-bold tracking-widest uppercase mb-5" style={{ color: "oklch(0.45 0.01 264)" }}>
              Core principles
            </p>
            <ul className="space-y-4">
              {PRINCIPLES.map((p, i) => (
                <li key={i} className="flex gap-3">
                  <span
                    className="flex-shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full"
                    style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }}
                  />
                  <span className="text-sm leading-relaxed" style={{ color: "oklch(0.6 0.01 264)" }}>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* ── Section 01: GOD Score (2-panel) ── */}
        <section className="mb-20">
          <SectionDivider n="01" title="The GOD Score (0–100)" />
          <div className="grid lg:grid-cols-[40%_60%] gap-10">

            {/* Left: description + score bands */}
            <div>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "oklch(0.55 0.01 264)" }}>
                Every startup receives a GOD score — a 100-point composite across five signal
                dimensions. Scores update automatically as new data surfaces. No dimension can
                be gamed in isolation.
              </p>
              <div className="space-y-2 mb-6">
                {[
                  { range: "≥ 80",  label: "Elite",       color: "#22c55e" },
                  { range: "60–79", label: "Strong",      color: "#22d3ee" },
                  { range: "40–59", label: "Solid",       color: "#eab308" },
                  { range: "20–39", label: "Emerging",    color: "#f97316" },
                  { range: "< 20",  label: "Pre-signal",  color: "oklch(0.42 0.01 264)" },
                ].map(({ range, label, color }) => (
                  <div key={range} className="flex items-center gap-3">
                    <span
                      className="font-mono text-xs font-bold w-14 text-center px-1.5 py-0.5 rounded flex-shrink-0"
                      style={{ color, backgroundColor: `${color === "oklch(0.42 0.01 264)" ? "oklch(0.18 0.01 264)" : `${color}15`}` }}
                    >
                      {range}
                    </span>
                    <span className="text-sm" style={{ color: "oklch(0.62 0.01 264)" }}>{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs" style={{ color: "oklch(0.4 0.01 264)" }}>
                Pre-signal startups are excluded from investor match ranking.
              </p>
            </div>

            {/* Right: 5 dimension cards */}
            <div className="space-y-3">
              {GOD_DIMS.map((d) => (
                <div
                  key={d.label}
                  className="flex items-start gap-4 p-4 rounded-xl"
                  style={{ backgroundColor: "oklch(0.13 0.01 264)", border: "1px solid oklch(0.21 0.01 264)" }}
                >
                  <div className="flex-shrink-0 pt-0.5">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-sm font-semibold" style={{ color: "oklch(0.88 0.005 264)" }}>{d.label}</span>
                      <span
                        className="text-[11px] font-mono px-2 py-0.5 rounded-full"
                        style={{ color: d.color, backgroundColor: `${d.color}15` }}
                      >
                        {d.weight}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "oklch(0.52 0.01 264)" }}>{d.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 02: Entity Gate (2-panel) ── */}
        <section className="mb-20">
          <SectionDivider n="02" title="Entity Resolution Gate" />
          <div className="grid lg:grid-cols-[40%_60%] gap-10">

            {/* Left: description + outcomes */}
            <div>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "oklch(0.55 0.01 264)" }}>
                Before any startup or investor enters the scoring pipeline, it passes through a
                four-stage entity gate. Real companies and VCs are separated from RSS junk, scraper
                artifacts, and concatenated fragments. This gate is the foundation of match quality.
              </p>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "oklch(0.52 0.01 264)" }}>
                The gate processes tens of thousands of inbound records per week and makes
                deterministic routing decisions — no human review required at scale.
              </p>
              <div className="space-y-2">
                {[
                  { label: "qualified",   desc: "→ scoring + matching pipeline", color: "oklch(0.696 0.17 162.48)" },
                  { label: "needs_url",   desc: "→ enrichment queue",            color: "#eab308" },
                  { label: "junk",        desc: "→ excluded permanently",         color: "#ef4444" },
                ].map(({ label, desc, color }) => (
                  <div key={label} className="flex items-center gap-3 text-xs">
                    <code
                      className="px-2 py-0.5 rounded font-mono"
                      style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
                    >
                      {label}
                    </code>
                    <span style={{ color: "oklch(0.5 0.01 264)" }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: 4 gate stages */}
            <div className="space-y-3">
              {GATE_STAGES.map((s) => (
                <div
                  key={s.n}
                  className="flex gap-4 p-4 rounded-xl items-start"
                  style={{ backgroundColor: "oklch(0.13 0.01 264)", border: "1px solid oklch(0.21 0.01 264)" }}
                >
                  <div
                    className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-mono font-bold"
                    style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)", border: "1px solid oklch(0.696 0.17 162.48 / 0.3)", color: "oklch(0.696 0.17 162.48)" }}
                  >
                    {s.n}
                  </div>
                  <div>
                    <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.85 0.01 264)" }}>{s.label}</p>
                    <p className="text-xs leading-relaxed" style={{ color: "oklch(0.52 0.01 264)" }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Section 03: Investor GOD Score (2-panel) ── */}
        <section className="mb-20">
          <SectionDivider n="03" title="Investor GOD Score (0–100)" />
          <div className="grid lg:grid-cols-[60%_40%] gap-10">

            {/* Left: 5 investor dimension cards in 2-col grid */}
            <div>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "oklch(0.55 0.01 264)" }}>
                Investors are scored on the same 0–100 scale. Only Solid tier or above (≥ 30) enter
                the matching pool — preventing low-signal records from surfacing as matches.
                The investor score gates match quality on both sides.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                {INVESTOR_DIMS.map((d) => (
                  <div
                    key={d.label}
                    className="p-4 rounded-xl"
                    style={{ backgroundColor: "oklch(0.13 0.01 264)", border: "1px solid oklch(0.21 0.01 264)" }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium" style={{ color: "oklch(0.85 0.01 264)" }}>{d.label}</span>
                      <span className="text-[11px] font-mono" style={{ color: "oklch(0.45 0.01 264)" }}>{d.weight}</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "oklch(0.52 0.01 264)" }}>{d.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: 4 investor tiers */}
            <div>
              <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: "oklch(0.45 0.01 264)" }}>
                Investor tiers
              </p>
              <div className="space-y-3">
                {TIERS.map((t) => (
                  <div
                    key={t.label}
                    className="p-4 rounded-xl"
                    style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
                  >
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="text-sm font-semibold" style={{ color: t.color }}>{t.label}</span>
                      <span className="text-xs font-mono" style={{ color: "oklch(0.42 0.01 264)" }}>{t.range}</span>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: "oklch(0.5 0.01 264)" }}>{t.desc}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs mt-4 px-1" style={{ color: "oklch(0.38 0.01 264)" }}>
                Only Solid (≥ 30) and above enter the matching pool.
              </p>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <div className="flex flex-wrap gap-3 pt-4">
          <a
            href="/activate"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
            style={{ border: "1px solid oklch(0.696 0.17 162.48)", color: "oklch(0.696 0.17 162.48)" }}
            onMouseEnter={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.78 0.17 162.48)"; el.style.color = "oklch(0.78 0.17 162.48)"; }}
            onMouseLeave={(e) => { const el = e.currentTarget as HTMLElement; el.style.borderColor = "oklch(0.696 0.17 162.48)"; el.style.color = "oklch(0.696 0.17 162.48)"; }}
          >
            Get your signal score <ArrowRight size={14} />
          </a>
          <Link href="/platform">
            <span
              className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors"
              style={{ border: "1px solid oklch(0.22 0.01 264)", color: "oklch(0.55 0.01 264)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.85 0.01 264)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.55 0.01 264)")}
            >
              How the platform works
            </span>
          </Link>
          <Link href="/rankings">
            <span
              className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors"
              style={{ border: "1px solid oklch(0.22 0.01 264)", color: "oklch(0.55 0.01 264)" }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.85 0.01 264)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.55 0.01 264)")}
            >
              Live rankings
            </span>
          </Link>
        </div>

      </div>

      <footer className="border-t py-8 mt-4" style={{ borderColor: "oklch(0.2 0.01 264)", backgroundColor: "oklch(0.11 0.01 264)" }}>
        <div className="container flex flex-wrap gap-6 justify-center">
          {[
            { label: "Platform",  href: "/platform" },
            { label: "Rankings",  href: "/rankings" },
            { label: "Newsletter",href: "/newsletter" },
            { label: "Pricing",   href: "/pricing" },
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
