import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { ArrowRight, CheckCircle } from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";
import StartupCTA from "@/components/design/StartupCTA";
import SectionLabel from "@/components/design/SectionLabel";
import StrokeButton from "@/components/design/StrokeButton";
import { G, PAGE, BORDER, CARD, MUTED, DIM } from "@/lib/designTokens";

// ─── Data ────────────────────────────────────────────────────────────────────

const GOD_DIMS = [
  {
    label: "Team",
    weight: "20 pts",
    color: "#a855f7",
    desc: "Founder background, domain expertise, repeat-founder status, technical depth, and advisor network. We score what founders have publicly demonstrated — not what they claim on an about page. A repeat founder with a prior exit scores differently than a first-time founder in an adjacent field.",
  },
  {
    label: "Traction",
    weight: "20 pts",
    color: "#22d3ee",
    desc: "Revenue indicators, customer count, MRR/ARR proxies, and growth velocity — inferred from public signals like job posts, press coverage, and product launch cadence. A startup hiring its third enterprise sales rep is sending a very different signal than one posting junior dev roles.",
  },
  {
    label: "Market",
    weight: "20 pts",
    color: "#f97316",
    desc: "Total addressable market size, sector momentum, comparable funding activity in adjacent categories, and timing relative to macro trends and technology cycles. We look at whether investors are already clustering in this space — and whether the timing window is opening or closing.",
  },
  {
    label: "Product",
    weight: "20 pts",
    color: "#eab308",
    desc: "Product clarity, differentiation signals, technical depth, and shipping velocity from the public footprint. A startup with a live product, documented API, and three recent changelog posts scores materially higher than one with a landing page and a waitlist.",
  },
  {
    label: "Vision",
    weight: "20 pts",
    color: "#22c55e",
    desc: "Narrative coherence, mission clarity, and long-arc thesis alignment with the market opportunity. PYTHIA looks for founders who articulate a specific point of view on why this moment matters — not just what the product does.",
  },
];

const GATE_STAGES = [
  {
    n: "1",
    label: "Logic Engine",
    desc: "Structural template check: startup name vs investor, descriptor, or RSS headline pattern. Catches obvious artifacts immediately — names that parse as news headlines or investor firm strings are routed out before any further analysis.",
  },
  {
    n: "2",
    label: "Ontology + Inference",
    desc: "Name ontology flags news wire junk, scraper concatenation artifacts, and known garbage patterns. A custom lexicon of sector terms, entity types, and known bad actors allows high-confidence disambiguation at scale.",
  },
  {
    n: "3",
    label: "Entity Disambiguation",
    desc: "Geographic, person, and brand disambiguation to avoid misclassifying proper nouns. 'River Capital' is an investor. 'Capital River' is a geographic descriptor. 'River' alone is noise. The gate knows the difference.",
  },
  {
    n: "4",
    label: "URL Gate",
    desc: "A verified website is the final signal of a real entity. A startup that can be reached at its stated URL is promoted to qualified status. Without one, it enters the needs_url enrichment queue — or is classified as junk.",
  },
];

const INVESTOR_DIMS = [
  { label: "Profile Completeness", weight: "25 pts", desc: "Firm name, sectors, stage, check size, thesis, and contact info. Sparse records score lower — incomplete data means incomplete matching." },
  { label: "Investment Focus",     weight: "25 pts", desc: "Sector + stage specificity. Generalists who invest in everything score lower than specialists with a clear thesis. Focus is a proxy for conviction." },
  { label: "Capital Readiness",    weight: "20 pts", desc: "Active fund size, dry powder estimates, and deployment velocity index — inferred from public filing data and deal cadence." },
  { label: "Track Record",         weight: "20 pts", desc: "Investment count, successful exits, and notable portfolio companies. A strong track record isn't disqualifying, but it does set the bar for thesis expectation." },
  { label: "Activity & Velocity",  weight: "10 pts", desc: "Recency of last investment and deployment cadence over the trailing 12 months. An investor who hasn't written a check in 18 months scores lower regardless of their historical track record." },
];

const TIERS = [
  { label: "Elite",    range: "70 – 100", color: "#eab308",              desc: "Top-quartile investors. Rich data, active deployment, strong track record. First to surface in match results." },
  { label: "Strong",   range: "50 – 69",  color: "oklch(0.696 0.17 162.48)", desc: "High-quality investors with solid focus and meaningful activity. Core of the matching pool." },
  { label: "Solid",    range: "30 – 49",  color: "oklch(0.65 0.12 162.48)", desc: "Minimum viable signal — included in the matching pool with appropriate confidence weighting." },
  { label: "Emerging", range: "0 – 29",   color: "oklch(0.35 0.01 264)",  desc: "Insufficient data or inactive — excluded entirely to protect match quality." },
];

const PRINCIPLES = [
  { rule: "No self-reported data.", detail: "Every score is derived from publicly observable behavior. A startup can't game a GOD score by updating its about page." },
  { rule: "No pay-to-play.",        detail: "Investor placement is determined entirely by GOD score and fit metrics. No one buys their way to the top of a match list." },
  { rule: "No opaque rankings.",    detail: "Every score component is visible in the score_breakdown field. If your score is 68, you can see exactly which dimension held it back." },
  { rule: "Garbage in, garbage out.", detail: "The entity gate exists because match quality is only as good as the data that feeds it. We'd rather exclude 10,000 records than poison results with noise." },
  { rule: "Both sides are scored.", detail: "Founder readiness and investor quality must both meet a floor. A high-GOD startup matched to a low-quality investor is a bad outcome. We prevent it by design." },
];

// ─── Shared section header ────────────────────────────────────────────────────

function SectionHeader({ n, title, subtitle }: { n: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-sm font-mono font-bold" style={{ color: "oklch(0.35 0.01 264)" }}>{n}</span>
        <h2 className="font-display font-semibold text-2xl" style={{ color: "oklch(0.88 0.005 264)", letterSpacing: "-0.01em" }}>{title}</h2>
      </div>
      {subtitle && (
        <p className="text-sm leading-relaxed" style={{ color: "oklch(0.5 0.01 264)", paddingLeft: "2.25rem" }}>{subtitle}</p>
      )}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Methodology() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE, fontFamily: "'Inter', sans-serif" }}>
      <Helmet>
        <title>Methodology — Pythh.ai</title>
        <meta name="description" content="How Pythh scores startups and investors: GOD score dimensions, entity resolution gate, investor tiers, and the full matching pipeline." />
        <meta property="og:title" content="Methodology — Pythh.ai" />
        <meta property="og:url" content="https://pythh.ai/methodology" />
      </Helmet>

      <SharedNavbar activePath="/methodology" />

      <div className="container pt-24 pb-20" style={{ maxWidth: "960px" }}>

        {/* ── Hero ── */}
        <div className="mb-20 pt-4">
          <SectionLabel className="mb-5">Pythh Capital · Methodology</SectionLabel>
          <h1
            className="font-display font-bold mb-6 leading-tight"
            style={{ fontSize: "clamp(2.4rem, 5vw, 3.6rem)", color: "oklch(0.97 0.005 264)", letterSpacing: "-0.02em" }}
          >
            How we score.<br />
            <span style={{ color: "oklch(0.55 0.01 264)" }}>How we match.</span>
          </h1>
          <div className="grid sm:grid-cols-2 gap-8 max-w-3xl">
            <p className="text-base leading-relaxed" style={{ color: "oklch(0.62 0.01 264)" }}>
              Every number on Pythh is derived from observed signals — public behavior, funding data,
              product velocity, and market timing. No self-reported information. No editorial judgment.
              No black boxes.
            </p>
            <p className="text-base leading-relaxed" style={{ color: "oklch(0.52 0.01 264)" }}>
              The same scoring model runs for every startup and every investor. It's deterministic,
              explainable, and continuously sharpened by the same analytical mind that designed it.
              When you see a score, you can understand exactly what drove it.
            </p>
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* SECTION 01 — GOD Score                                     */}
        {/* ─────────────────────────────────────────────────────────── */}
        <section className="mb-20">
          <SectionHeader
            n="01"
            title="The GOD Score (0–100)"
            subtitle="Every startup receives a GOD score — a 100-point composite across five independently weighted signal dimensions. Scores update automatically as new data surfaces. No single dimension dominates; strength must be multi-dimensional to score high."
          />

          {/* 5 dimension cards */}
          <div className="space-y-3 mb-8">
            {GOD_DIMS.map((d) => (
              <div
                key={d.label}
                className="grid sm:grid-cols-[160px_1fr] gap-5 p-5 rounded-xl"
                style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <div>
                    <p className="text-sm font-semibold" style={{ color: "oklch(0.88 0.005 264)" }}>{d.label}</p>
                    <span
                      className="text-[11px] font-mono px-2 py-0.5 rounded-full mt-1 inline-block"
                      style={{ color: d.color, backgroundColor: `${d.color}18` }}
                    >
                      {d.weight}
                    </span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>{d.desc}</p>
              </div>
            ))}
          </div>

          {/* Score bands */}
          <div
            className="p-5 rounded-xl"
            style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
          >
            <p className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: "oklch(0.42 0.01 264)" }}>
              Score bands
            </p>
            <div className="grid sm:grid-cols-5 gap-3">
              {[
                { range: "80–100", label: "Elite",       color: "#22c55e",              note: "Investment-grade" },
                { range: "60–79",  label: "Strong",      color: "#22d3ee",              note: "High conviction" },
                { range: "40–59",  label: "Solid",       color: "#eab308",              note: "Signal-building" },
                { range: "20–39",  label: "Emerging",    color: "#f97316",              note: "Early signals" },
                { range: "0–19",   label: "Pre-signal",  color: "oklch(0.42 0.01 264)", note: "Excluded from matches" },
              ].map(({ range, label, color, note }) => (
                <div key={range} className="text-center">
                  <div
                    className="text-sm font-mono font-bold mb-1"
                    style={{ color }}
                  >
                    {range}
                  </div>
                  <div className="text-xs font-semibold text-white mb-0.5">{label}</div>
                  <div className="text-[10px]" style={{ color: "oklch(0.42 0.01 264)" }}>{note}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* SECTION 02 — Entity Resolution Gate                        */}
        {/* ─────────────────────────────────────────────────────────── */}
        <section className="mb-20">
          <SectionHeader
            n="02"
            title="Entity Resolution Gate"
            subtitle="Before any startup or investor enters the scoring pipeline, it passes through a four-stage entity gate. Real companies and VCs are separated from RSS junk, scraper artifacts, and concatenated fragments. This gate processes tens of thousands of inbound records weekly — match quality depends on it."
          />

          <div className="space-y-3 mb-6">
            {GATE_STAGES.map((s) => (
              <div
                key={s.n}
                className="grid sm:grid-cols-[48px_1fr] gap-4 p-5 rounded-xl"
                style={{ backgroundColor: "oklch(0.13 0.01 264)", border: "1px solid oklch(0.21 0.01 264)" }}
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-mono font-bold flex-shrink-0"
                  style={{
                    backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)",
                    border: "1px solid oklch(0.696 0.17 162.48 / 0.3)",
                    color: "oklch(0.696 0.17 162.48)",
                  }}
                >
                  {s.n}
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1" style={{ color: "oklch(0.88 0.005 264)" }}>{s.label}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Routing outcomes */}
          <div className="flex flex-wrap gap-3">
            {[
              { code: "qualified",  desc: "enters scoring + matching pipeline",  color: "oklch(0.696 0.17 162.48)" },
              { code: "needs_url",  desc: "enters enrichment queue",             color: "#eab308" },
              { code: "junk",       desc: "excluded permanently",                 color: "#ef4444" },
            ].map(({ code, desc, color }) => (
              <div key={code} className="flex items-center gap-2 text-xs">
                <code
                  className="px-2 py-1 rounded font-mono font-semibold"
                  style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}35` }}
                >
                  {code}
                </code>
                <span style={{ color: "oklch(0.5 0.01 264)" }}>{desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* SECTION 03 — Investor GOD Score                            */}
        {/* ─────────────────────────────────────────────────────────── */}
        <section className="mb-20">
          <SectionHeader
            n="03"
            title="Investor GOD Score (0–100)"
            subtitle="Investors are scored on the same 0–100 scale as startups. Only Solid tier or above (≥ 30) enter the matching pool. This threshold exists to protect match quality — a low-signal investor record, no matter how prominent the name, does not surface as a match."
          />

          {/* Investor dimension cards */}
          <div className="grid sm:grid-cols-2 gap-3 mb-8">
            {INVESTOR_DIMS.map((d) => (
              <div
                key={d.label}
                className="p-4 rounded-xl"
                style={{ backgroundColor: "oklch(0.13 0.01 264)", border: "1px solid oklch(0.21 0.01 264)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold" style={{ color: "oklch(0.85 0.01 264)" }}>{d.label}</span>
                  <span className="text-xs font-mono" style={{ color: "oklch(0.45 0.01 264)" }}>{d.weight}</span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "oklch(0.52 0.01 264)" }}>{d.desc}</p>
              </div>
            ))}
          </div>

          {/* Investor tiers */}
          <div className="grid sm:grid-cols-4 gap-3">
            {TIERS.map((t) => (
              <div
                key={t.label}
                className="p-4 rounded-xl"
                style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.2 0.01 264)" }}
              >
                <p className="text-sm font-semibold mb-0.5" style={{ color: t.color }}>{t.label}</p>
                <p className="text-xs font-mono mb-2" style={{ color: "oklch(0.4 0.01 264)" }}>{t.range}</p>
                <p className="text-xs leading-relaxed" style={{ color: "oklch(0.48 0.01 264)" }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────── */}
        {/* SECTION 04 — Core Principles                               */}
        {/* ─────────────────────────────────────────────────────────── */}
        <section className="mb-16">
          <SectionHeader
            n="04"
            title="Core principles"
            subtitle="The rules that govern every scoring decision, match result, and data inclusion on Pythh."
          />

          <div className="space-y-4">
            {PRINCIPLES.map(({ rule, detail }) => (
              <div
                key={rule}
                className="flex gap-4 p-5 rounded-xl"
                style={{ backgroundColor: "oklch(0.13 0.01 264)", border: "1px solid oklch(0.21 0.01 264)" }}
              >
                <CheckCircle size={16} className="flex-shrink-0 mt-0.5" style={{ color: "oklch(0.696 0.17 162.48)" }} />
                <div>
                  <p className="text-sm font-semibold text-white mb-1">{rule}</p>
                  <p className="text-sm leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Scores that resolve ── */}
        <section className="mb-16 p-8 rounded-2xl" style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.696 0.17 162.48 / 0.25)" }}>
          <SectionHeader
            n="05"
            title="Scores that resolve"
            subtitle="Every GOD 70+ company enters the Oracle's virtual fund. We track funding, exits, and press-verified outcomes in public — so the methodology isn't theory, it's a scoreboard."
          />
          <p className="text-sm leading-relaxed mb-6 max-w-2xl" style={{ color: "oklch(0.58 0.01 264)" }}>
            Scores derived from public behavior. Outcomes verified against press-confirmed raises.
            No self-reported decks. No black-box verdicts.
          </p>
          <Link href="/portfolio">
            <span
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
              style={{ border: "1px solid oklch(0.696 0.17 162.48)", color: "oklch(0.696 0.17 162.48)" }}
            >
              View Oracle track record →
            </span>
          </Link>
        </section>

        {/* ── CTA ── */}
        <div className="flex flex-wrap gap-3 pt-2">
          <StartupCTA href="/matches" showArrow>
            Get your signal score
          </StartupCTA>
          <StrokeButton href="/platform" muted showArrow>
            How the platform works
          </StrokeButton>
          <StrokeButton href="/portfolio" muted showArrow>
            Oracle scoreboard
          </StrokeButton>
          <StrokeButton href="/rankings" muted>
            Live rankings
          </StrokeButton>
        </div>

      </div>

      <footer
        className="border-t py-8 mt-4"
        style={{ borderColor: "oklch(0.2 0.01 264)", backgroundColor: "oklch(0.11 0.01 264)" }}
      >
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
