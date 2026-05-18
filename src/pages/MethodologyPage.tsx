/**
 * MethodologyPage — /methodology
 *
 * How Pythh scores startups and matches them to investors.
 * Covers: GOD score dimensions, signal types, entity gate,
 * investor scoring, and the matching pipeline.
 */

import { Link } from "react-router-dom";
import PythhUnifiedNav from "../components/PythhUnifiedNav";

// ─── Data ────────────────────────────────────────────────────────────────────

const GOD_DIMENSIONS = [
  {
    id: "team",
    label: "Team",
    weight: "20 pts",
    color: "#22d3ee",
    desc:
      "Founder background, domain expertise, repeat-founder status, and advisor network depth. We look at what signals the team has publicly demonstrated, not self-reported bios.",
  },
  {
    id: "traction",
    label: "Traction",
    weight: "20 pts",
    color: "#f97316",
    desc:
      "Revenue indicators, customer count, MRR/ARR proxies, and growth velocity. Public signals (job posts, press, product launches) are used where financials aren't disclosed.",
  },
  {
    id: "market",
    label: "Market",
    weight: "20 pts",
    color: "#a855f7",
    desc:
      "Total addressable market size, sector momentum, recent comparable funding activity, and timing relative to macro trends.",
  },
  {
    id: "product",
    label: "Product",
    weight: "20 pts",
    color: "#10b981",
    desc:
      "Product clarity, differentiation signals, technical depth markers, and evidence of shipping velocity from public footprint.",
  },
  {
    id: "vision",
    label: "Vision",
    weight: "20 pts",
    color: "#f59e0b",
    desc:
      "Narrative coherence, mission clarity, and long-arc thesis alignment with the market opportunity the startup is pursuing.",
  },
];

const INVESTOR_DIMENSIONS = [
  { label: "Profile Completeness", weight: "25 pts", desc: "Firm name, focus areas, check size, thesis, and contact info populated." },
  { label: "Investment Focus", weight: "25 pts", desc: "Sector + stage specificity. Generalist dilutes; specialist scores higher." },
  { label: "Capital Readiness", weight: "20 pts", desc: "Active fund size, dry powder estimates, and deployment velocity index." },
  { label: "Track Record", weight: "20 pts", desc: "Number of investments, successful exits, and notable portfolio companies." },
  { label: "Activity & Velocity", weight: "10 pts", desc: "Recency of last investment and deployment cadence over trailing 12 months." },
];

const ENTITY_GATE_STAGES = [
  {
    stage: "1 — Logic Engine",
    desc: "Structural template check: startup name pattern vs investor, descriptor, or headline.",
  },
  {
    stage: "2 — Ontology + Inference",
    desc: "Pending name ontology flags RSS news headlines and wire-service junk.",
  },
  {
    stage: "3 — Entity Disambiguation",
    desc: "Geographic / person / brand disambiguation to avoid misclassifying proper nouns.",
  },
  {
    stage: "4 — URL Gate",
    desc: "A verified website promotes a startup to qualified. Without one: needs_url or junk.",
  },
];

const MATCHING_STEPS = [
  {
    n: "1",
    label: "URL → Signal Profile",
    desc: "Paste a URL. Within seconds we extract company signals from the public web footprint and build a structured startup record.",
  },
  {
    n: "2",
    label: "GOD Scoring",
    desc: "Five dimensions (team, traction, market, product, vision) each scored 0–20 for a 0–100 total. Stored in startup_uploads.total_god_score.",
  },
  {
    n: "3",
    label: "Investor Candidate Selection",
    desc: "Only entity_gate='qualified' investors with investor_score ≥ 30 (Solid tier) enter the candidate pool. Pre-sorted by GOD score descending.",
  },
  {
    n: "4",
    label: "Fit Scoring",
    desc: "Sector overlap (35 pts) + stage alignment (35 pts) + check-size fit (15 pts) + investor quality bonus (0–15 pts). GOD score flows through each dimension.",
  },
  {
    n: "5",
    label: "AI Analysis",
    desc: "GPT-4o scores thesis alignment, synthesizes why-you-match bullets, and drafts a personalized intro email — informed by the investor's GOD tier.",
  },
  {
    n: "6",
    label: "Ranked Match Output",
    desc: "Matches sorted by composite score. Each card shows match_score, confidence level, fit flags, and outreach copy.",
  },
];

const TIERS = [
  { label: "Elite", range: "70 – 100", color: "#f59e0b", desc: "Top-quartile investors — rich data, active deployment, strong track record." },
  { label: "Strong", range: "50 – 69", color: "#22d3ee", desc: "High-quality investors with solid focus and meaningful activity." },
  { label: "Solid", range: "30 – 49", color: "#10b981", desc: "Minimum viable signal — included in matching pool." },
  { label: "Emerging", range: "0 – 29", color: "#6b7280", desc: "Insufficient data — excluded from matching to protect match quality." },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <PythhUnifiedNav />

      <main className="max-w-4xl mx-auto px-4 sm:px-8 py-12">

        {/* Hero */}
        <div className="mb-14">
          <p className="text-xs text-cyan-400 tracking-[2px] uppercase mb-3">Pythh Capital · Methodology</p>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
            How we score.<br />
            <span className="text-zinc-500">How we match.</span>
          </h1>
          <p className="text-zinc-400 text-lg max-w-2xl leading-relaxed">
            Every number on Pythh is derived from observed signals — public behavior, funding data, product
            velocity, and market timing. No self-reported information. No black boxes.
          </p>
        </div>

        {/* ─── GOD Score ─────────────────────────────────────────────────── */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] text-zinc-600 tracking-[2px] uppercase">01</span>
            <h2 className="text-2xl font-semibold text-white">The GOD Score (0–100)</h2>
          </div>
          <p className="text-zinc-400 mb-6 leading-relaxed">
            Every startup receives a GOD (Growth-Opportunity-Differentiation) score — a 100-point composite
            across five signal dimensions. Scores update automatically as new data surfaces.
          </p>

          <div className="grid sm:grid-cols-2 gap-4">
            {GOD_DIMENSIONS.map((d) => (
              <div
                key={d.id}
                className="p-5 rounded-xl border border-zinc-800/60 bg-zinc-900/40"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white">{d.label}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-full border"
                    style={{ color: d.color, borderColor: `${d.color}30`, background: `${d.color}10` }}>
                    {d.weight}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 p-4 rounded-xl border border-zinc-800/40 bg-zinc-950/60">
            <p className="text-sm text-zinc-500">
              <span className="text-zinc-300 font-medium">Score buckets: </span>
              ≥ 80 Elite · 60–79 Strong · 40–59 Solid · 20–39 Emerging · &lt;20 Pre-signal.
              The floor cluster (pre-signal startups) is intentionally excluded from investor match ranking.
            </p>
          </div>
        </section>

        {/* ─── Entity Gate ────────────────────────────────────────────────── */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] text-zinc-600 tracking-[2px] uppercase">02</span>
            <h2 className="text-2xl font-semibold text-white">Entity Resolution Gate</h2>
          </div>
          <p className="text-zinc-400 mb-6 leading-relaxed">
            Before any startup or investor enters the scoring pipeline, it passes through a four-stage
            entity resolution gate. The gate separates genuine companies and VCs from RSS news artifacts,
            scraper junk, and unresolvable fragments.
          </p>

          <div className="space-y-3">
            {ENTITY_GATE_STAGES.map((s) => (
              <div key={s.stage} className="flex gap-4 p-4 rounded-xl border border-zinc-800/40 bg-zinc-900/30">
                <div className="flex-shrink-0 w-2 h-2 mt-2 rounded-full bg-orange-400" />
                <div>
                  <p className="text-sm font-medium text-white mb-0.5">{s.stage}</p>
                  <p className="text-sm text-zinc-400">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 flex gap-6 text-sm text-zinc-500">
            <span><span className="text-green-400 font-mono">qualified</span> — full scoring + matching</span>
            <span><span className="text-yellow-400 font-mono">needs_url</span> — enrichment queue</span>
            <span><span className="text-red-400 font-mono">junk</span> — excluded</span>
          </div>
        </section>

        {/* ─── Investor GOD Score ─────────────────────────────────────────── */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] text-zinc-600 tracking-[2px] uppercase">03</span>
            <h2 className="text-2xl font-semibold text-white">Investor GOD Score (0–100)</h2>
          </div>
          <p className="text-zinc-400 mb-6 leading-relaxed">
            Investors are scored on the same 0–100 scale. Only investors at Solid tier or above (≥ 30) enter
            the matching pool. This prevents low-signal or incomplete records from surfacing as matches.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {INVESTOR_DIMENSIONS.map((d) => (
              <div key={d.label} className="p-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-white">{d.label}</span>
                  <span className="text-xs font-mono text-zinc-500">{d.weight}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{d.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TIERS.map((t) => (
              <div key={t.label} className="p-3 rounded-lg border border-zinc-800/40 bg-zinc-950/50">
                <p className="text-xs font-semibold mb-1" style={{ color: t.color }}>{t.label}</p>
                <p className="text-xs font-mono text-zinc-500 mb-1">{t.range}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Matching Pipeline ──────────────────────────────────────────── */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] text-zinc-600 tracking-[2px] uppercase">04</span>
            <h2 className="text-2xl font-semibold text-white">The Matching Pipeline</h2>
          </div>
          <p className="text-zinc-400 mb-6 leading-relaxed">
            Every match is a function of startup signals × investor readiness × behavioral timing.
            No manual curation. No paid placement. Rank is earned by score.
          </p>

          <div className="space-y-3">
            {MATCHING_STEPS.map((s) => (
              <div key={s.n} className="flex gap-4 items-start p-4 rounded-xl border border-zinc-800/40 bg-zinc-900/30">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                  <span className="text-[10px] font-mono text-cyan-400">{s.n}</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white mb-0.5">{s.label}</p>
                  <p className="text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Signal Types ───────────────────────────────────────────────── */}
        <section className="mb-14">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] text-zinc-600 tracking-[2px] uppercase">05</span>
            <h2 className="text-2xl font-semibold text-white">Signal Types</h2>
          </div>
          <p className="text-zinc-400 mb-6 leading-relaxed">
            Pythh ingests signals across seven behavioral categories. Each signal type carries different
            weight depending on how reliably it predicts investor intent.
          </p>

          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: "Funding Activity", desc: "New deals, fund closes, portfolio expansions." },
              { label: "Hiring Velocity", desc: "Team growth at investor firms = capital being deployed." },
              { label: "Market Momentum", desc: "Sector-level capital flow and competitive heat maps." },
              { label: "Social Proof", desc: "Conference presence, media coverage, thesis content." },
              { label: "Revenue Signals", desc: "Startup traction indicators from its public footprint." },
              { label: "Product Velocity", desc: "Shipping cadence, launches, and user acquisition signals." },
              { label: "Competition Heat", desc: "Adjacent funding rounds and category positioning." },
            ].map((s) => (
              <div key={s.label} className="p-4 rounded-xl border border-zinc-800/40 bg-zinc-900/30">
                <p className="text-sm font-medium text-white mb-1">{s.label}</p>
                <p className="text-sm text-zinc-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Principles ─────────────────────────────────────────────────── */}
        <section className="mb-14 p-6 rounded-2xl border border-zinc-800/40 bg-zinc-900/30">
          <h2 className="text-xl font-semibold text-white mb-4">Core Principles</h2>
          <ul className="space-y-3">
            {[
              "No self-reported data. Every score is derived from publicly observable behavior.",
              "No pay-to-play. Investor placement is determined by GOD score and fit, not spend.",
              "No opaque rankings. Every score component is visible in the score_breakdown field.",
              "Garbage in, garbage out — the entity gate exists to protect match quality at the source.",
              "Both sides are scored. Founder readiness and investor quality must both meet a floor.",
            ].map((p) => (
              <li key={p} className="flex gap-3 text-sm text-zinc-400">
                <span className="flex-shrink-0 w-1.5 h-1.5 mt-2 rounded-full bg-cyan-400" />
                {p}
              </li>
            ))}
          </ul>
        </section>

        {/* ─── CTA ────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/signal-matches"
            className="px-6 py-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-sm font-medium hover:bg-cyan-500/20 transition text-center"
          >
            Get your signal score →
          </Link>
          <Link
            to="/platform"
            className="px-6 py-3 rounded-xl border border-zinc-800 text-zinc-400 text-sm hover:text-white hover:border-zinc-600 transition text-center"
          >
            How the platform works
          </Link>
          <Link
            to="/rankings"
            className="px-6 py-3 rounded-xl border border-zinc-800 text-zinc-400 text-sm hover:text-white hover:border-zinc-600 transition text-center"
          >
            Live rankings
          </Link>
        </div>

      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/40 mt-16 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-8 flex flex-wrap gap-6 justify-center">
          {[
            { label: "Platform", to: "/platform" },
            { label: "Rankings", to: "/rankings" },
            { label: "Explore", to: "/explore" },
            { label: "Newsletter", to: "/newsletter" },
            { label: "About", to: "/about" },
          ].map(({ label, to }) => (
            <Link key={label} to={to} className="text-sm text-zinc-600 hover:text-zinc-400 transition-colors">
              {label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}
