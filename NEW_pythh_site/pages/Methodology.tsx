import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { ArrowRight } from "lucide-react";

import SharedNavbar from "@/components/SharedNavbar";


// ─── Data ────────────────────────────────────────────────────────────────────

const GOD_DIMS = [
  { label: "Team", weight: "20 pts", color: "oklch(0.696 0.17 162.48)", desc: "Founder background, domain expertise, repeat-founder status, advisor network. We score what founders have publicly demonstrated." },
  { label: "Traction", weight: "20 pts", color: "oklch(0.769 0.188 70.08)", desc: "Revenue indicators, customer count, MRR/ARR proxies, growth velocity from public signals — job posts, press, product launches." },
  { label: "Market", weight: "20 pts", color: "oklch(0.7 0.17 300)", desc: "Total addressable market size, sector momentum, comparable funding activity, and timing relative to macro trends." },
  { label: "Product", weight: "20 pts", color: "oklch(0.696 0.17 162.48)", desc: "Product clarity, differentiation signals, technical depth, and evidence of shipping velocity from the public footprint." },
  { label: "Vision", weight: "20 pts", color: "oklch(0.769 0.188 70.08)", desc: "Narrative coherence, mission clarity, and long-arc thesis alignment with the market opportunity." },
];

const INVESTOR_DIMS = [
  { label: "Profile Completeness", weight: "25 pts", desc: "Firm name, sectors, stage, check size, thesis, and contact info." },
  { label: "Investment Focus", weight: "25 pts", desc: "Sector + stage specificity. Generalists dilute; specialists score higher." },
  { label: "Capital Readiness", weight: "20 pts", desc: "Active fund size, dry powder estimates, deployment velocity index." },
  { label: "Track Record", weight: "20 pts", desc: "Investment count, successful exits, notable portfolio companies." },
  { label: "Activity & Velocity", weight: "10 pts", desc: "Recency of last investment and deployment cadence over trailing 12 months." },
];

const TIERS = [
  { label: "Elite", range: "70 – 100", color: "oklch(0.769 0.188 70.08)", desc: "Top-quartile investors. Rich data, active deployment, strong track record." },
  { label: "Strong", range: "50 – 69", color: "oklch(0.696 0.17 162.48)", desc: "High-quality investors with solid focus and meaningful activity." },
  { label: "Solid", range: "30 – 49", color: "oklch(0.65 0.12 162.48)", desc: "Minimum viable signal — included in the matching pool." },
  { label: "Emerging", range: "0 – 29", color: "oklch(0.35 0.01 264)", desc: "Insufficient data — excluded to protect match quality." },
];

const GATE_STAGES = [
  { n: "1", label: "Logic Engine", desc: "Structural template check: startup name vs investor, descriptor, or RSS headline pattern." },
  { n: "2", label: "Ontology + Inference", desc: "Name ontology flags news wire junk, scraper concatenation artifacts, and known garbage patterns." },
  { n: "3", label: "Entity Disambiguation", desc: "Geographic, person, and brand disambiguation to avoid misclassifying proper nouns." },
  { n: "4", label: "URL Gate", desc: "A verified website promotes a startup to qualified. Without one: needs_url queue or junk." },
];

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

      <div className="container pt-24 pb-20 max-w-4xl">

        {/* ── Hero ── */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px w-8" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
            <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.696 0.17 162.48)" }}>
              PYTHH CAPITAL · METHODOLOGY
            </span>
          </div>
          <h1 className="font-display font-bold mb-4 leading-tight" style={{ fontSize: "clamp(2.2rem, 5vw, 3.5rem)", color: "oklch(0.97 0.005 264)" }}>
            How we score.<br />
            <span style={{ color: "oklch(0.55 0.01 264)" }}>How we match.</span>
          </h1>
          <p className="text-lg leading-relaxed max-w-2xl" style={{ color: "oklch(0.6 0.01 264)" }}>
            Every number on Pythh is derived from observed signals — public behavior, funding data,
            product velocity, and market timing. No self-reported information. No black boxes.
          </p>
        </div>

        {/* ── GOD Score ── */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-mono" style={{ color: "oklch(0.35 0.01 264)" }}>01</span>
            <h2 className="font-display font-semibold text-xl" style={{ color: "oklch(0.85 0.01 264)" }}>
              The GOD Score (0–100)
            </h2>
          </div>
          <p className="text-sm mb-6 ml-8" style={{ color: "oklch(0.5 0.01 264)" }}>
            Every startup receives a GOD score — a 100-point composite across five signal dimensions.
            Scores update as new data surfaces.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 ml-8">
            {GOD_DIMS.map((d) => (
              <div key={d.label} className="p-4 rounded-xl" style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium" style={{ color: "oklch(0.85 0.01 264)" }}>{d.label}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full" style={{ color: d.color, backgroundColor: `${d.color.replace(")", " / 0.1)")}`}}>{d.weight}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "oklch(0.5 0.01 264)" }}>{d.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 ml-8 p-3 rounded-lg text-xs" style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.2 0.01 264)", color: "oklch(0.45 0.01 264)" }}>
            Score buckets: ≥ 80 Elite · 60–79 Strong · 40–59 Solid · 20–39 Emerging · &lt;20 Pre-signal. Pre-signal startups are excluded from investor match ranking.
          </div>
        </section>

        {/* ── Entity Gate ── */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-mono" style={{ color: "oklch(0.35 0.01 264)" }}>02</span>
            <h2 className="font-display font-semibold text-xl" style={{ color: "oklch(0.85 0.01 264)" }}>
              Entity Resolution Gate
            </h2>
          </div>
          <p className="text-sm mb-6 ml-8" style={{ color: "oklch(0.5 0.01 264)" }}>
            Before any startup or investor enters the scoring pipeline, it passes through a four-stage
            entity gate. Real companies and VCs are separated from RSS junk, scraper artifacts, and fragments.
          </p>
          <div className="space-y-3 ml-8">
            {GATE_STAGES.map((s) => (
              <div key={s.n} className="flex gap-4 p-4 rounded-xl items-start" style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}>
                <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono"
                  style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)", border: "1px solid oklch(0.696 0.17 162.48 / 0.25)", color: "oklch(0.696 0.17 162.48)" }}>
                  {s.n}
                </div>
                <div>
                  <p className="text-sm font-medium mb-0.5" style={{ color: "oklch(0.85 0.01 264)" }}>{s.label}</p>
                  <p className="text-xs leading-relaxed" style={{ color: "oklch(0.5 0.01 264)" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-5 mt-4 ml-8 text-xs">
            <span style={{ color: "oklch(0.696 0.17 162.48)" }}>qualified → scoring + matching</span>
            <span style={{ color: "oklch(0.769 0.188 70.08)" }}>needs_url → enrichment queue</span>
            <span style={{ color: "oklch(0.65 0.22 25)" }}>junk → excluded</span>
          </div>
        </section>

        {/* ── Investor GOD Score ── */}
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-xs font-mono" style={{ color: "oklch(0.35 0.01 264)" }}>03</span>
            <h2 className="font-display font-semibold text-xl" style={{ color: "oklch(0.85 0.01 264)" }}>
              Investor GOD Score (0–100)
            </h2>
          </div>
          <p className="text-sm mb-6 ml-8" style={{ color: "oklch(0.5 0.01 264)" }}>
            Investors are scored on the same 0–100 scale. Only Solid tier or above (≥ 30) enter the
            matching pool — preventing low-signal records from surfacing as matches.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 mb-5 ml-8">
            {INVESTOR_DIMS.map((d) => (
              <div key={d.label} className="p-4 rounded-xl" style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium" style={{ color: "oklch(0.85 0.01 264)" }}>{d.label}</span>
                  <span className="text-xs font-mono" style={{ color: "oklch(0.45 0.01 264)" }}>{d.weight}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "oklch(0.5 0.01 264)" }}>{d.desc}</p>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 ml-8">
            {TIERS.map((t) => (
              <div key={t.label} className="p-3 rounded-lg" style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}>
                <p className="text-xs font-semibold mb-0.5" style={{ color: t.color }}>{t.label}</p>
                <p className="text-xs font-mono mb-1" style={{ color: "oklch(0.4 0.01 264)" }}>{t.range}</p>
                <p className="text-xs leading-relaxed" style={{ color: "oklch(0.42 0.01 264)" }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Principles ── */}
        <section className="mb-16 p-6 rounded-2xl" style={{ backgroundColor: "oklch(0.13 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}>
          <h2 className="font-display font-semibold text-lg mb-4" style={{ color: "oklch(0.85 0.01 264)" }}>
            Core principles
          </h2>
          <ul className="space-y-3">
            {[
              "No self-reported data. Every score is derived from publicly observable behavior.",
              "No pay-to-play. Investor placement is determined by GOD score and fit, not spend.",
              "No opaque rankings. Every score component is visible in the score_breakdown field.",
              "Garbage in, garbage out — the entity gate exists to protect match quality at the source.",
              "Both sides are scored. Founder readiness and investor quality must both meet a floor.",
            ].map((p) => (
              <li key={p} className="flex gap-3 text-sm" style={{ color: "oklch(0.55 0.01 264)" }}>
                <span className="flex-shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* ── CTA ── */}
        <div className="flex flex-wrap gap-3">
          <a href="/activate"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
            style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)" }}
          >
            Get your signal score <ArrowRight size={14} />
          </a>
          <Link href="/platform">
            <span className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
              style={{ backgroundColor: "oklch(0.16 0.01 264)", color: "oklch(0.55 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}
            >How the platform works</span>
          </Link>
          <Link href="/rankings">
            <span className="inline-flex items-center px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer"
              style={{ backgroundColor: "oklch(0.16 0.01 264)", color: "oklch(0.55 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}
            >Live rankings</span>
          </Link>
        </div>

      </div>

      <footer className="border-t py-8 mt-4" style={{ borderColor: "oklch(0.2 0.01 264)", backgroundColor: "oklch(0.11 0.01 264)" }}>
        <div className="container flex flex-wrap gap-6 justify-center">
          {[
            { label: "Platform", href: "/platform" },
            { label: "Rankings", href: "/rankings" },
            { label: "Newsletter", href: "/newsletter" },
            { label: "Pricing", href: "/pricing" },
          ].map(({ label, href }) => (
            <Link key={href} href={href}>
              <span className="text-xs cursor-pointer transition-colors"
                style={{ color: "oklch(0.35 0.01 264)" }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "oklch(0.6 0.01 264)")}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "oklch(0.35 0.01 264)")}
              >{label}</span>
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
