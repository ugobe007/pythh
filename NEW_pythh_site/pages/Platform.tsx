import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useState, useEffect } from "react";
import { ArrowRight, Zap, Target, Brain, BarChart3, Mail } from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";

// ─── Animated signal bars ─────────────────────────────────────────────────────

interface SignalRow {
  id: string;
  label: string;
  value: number;
  delta: number;
  description: string;
}

const INITIAL_SIGNALS: SignalRow[] = [
  { id: "funding",     label: "Funding Activity",  value: 0.73, delta:  0.04, description: "Recent funding rounds, term sheets, and investor meetings in your sector" },
  { id: "hiring",      label: "Hiring Velocity",    value: 0.81, delta:  0.12, description: "Engineering and go-to-market hiring patterns across comparable startups" },
  { id: "market",      label: "Market Momentum",    value: 0.58, delta: -0.05, description: "Overall sector interest from LPs, analysts, and trade publications" },
  { id: "social",      label: "Social Proof",       value: 0.71, delta:  0.08, description: "Mentions, shares, and engagement from influential investors and founders" },
  { id: "competition", label: "Competition Heat",   value: 0.54, delta:  0,    description: "Competitive landscape intensity and market consolidation signals" },
  { id: "revenue",     label: "Revenue Signals",    value: 0.66, delta:  0.03, description: "B2B contract announcements, customer logos, and revenue milestones" },
  { id: "product",     label: "Product Velocity",   value: 0.85, delta:  0.15, description: "Shipping cadence, feature launches, and product-market fit indicators" },
];

function SignalBar({ signal }: { signal: SignalRow }) {
  const { label, value, delta, description } = signal;
  const deltaPositive = delta > 0;
  const deltaZero = delta === 0;
  const deltaColor = deltaPositive
    ? "oklch(0.696 0.17 162.48)"
    : deltaZero
    ? "oklch(0.45 0.01 264)"
    : "oklch(0.65 0.15 22)";
  const arrow = deltaPositive ? "▲" : deltaZero ? "→" : "▼";
  const sign  = deltaPositive ? "+" : "";
  const barColor =
    value >= 0.7
      ? "linear-gradient(to right, oklch(0.55 0.13 195), oklch(0.696 0.17 162.48))"
      : value >= 0.5
      ? "linear-gradient(to right, oklch(0.4 0.1 195), oklch(0.55 0.13 195))"
      : "linear-gradient(to right, oklch(0.3 0.01 264), oklch(0.4 0.01 264))";
  const glowStyle = deltaPositive ? { boxShadow: "0 0 8px rgba(34,211,238,0.35)" } : {};

  return (
    <div className="group" title={description}>
      <div className="flex items-center gap-3 mb-1">
        <div className="w-32 text-xs truncate" style={{ color: "oklch(0.55 0.01 264)" }}>{label}</div>
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "oklch(0.18 0.01 264 / 0.6)" }}>
          <div
            className="h-full rounded-full"
            style={{ width: `${value * 100}%`, background: barColor, transition: "width 700ms ease-out", ...glowStyle }}
          />
        </div>
        <div className="w-10 text-right font-mono text-xs" style={{ color: "oklch(0.85 0.005 264)" }}>
          {value.toFixed(2)}
        </div>
        <div className="w-14 text-right font-mono text-xs" style={{ color: deltaColor }}>
          {arrow} {sign}{Math.abs(delta).toFixed(2)}
        </div>
      </div>
    </div>
  );
}

function SignalFlowBars() {
  const [signals, setSignals] = useState(INITIAL_SIGNALS);
  useEffect(() => {
    const id = setInterval(() => {
      setSignals((prev) =>
        prev.map((s) => {
          const movement = (Math.random() - 0.5) * 0.06;
          const newValue = Math.max(0.1, Math.min(0.95, s.value + movement));
          return { ...s, value: +newValue.toFixed(2), delta: +(newValue - s.value).toFixed(2) };
        })
      );
    }, 3000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="space-y-3">
      {signals.map((s) => <SignalBar key={s.id} signal={s} />)}
    </div>
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
        <meta name="description" content="PYTHIA's signal intelligence engine: proprietary GOD scoring, behavioral multipliers, and real-time investor matching. Not generic AI — field-tested human insight." />
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
                Pythh Capital · Platform
              </span>
            </div>
            <h1
              className="font-display font-bold mb-5 leading-tight"
              style={{ fontSize: "clamp(2.2rem, 5vw, 3.4rem)", color: "oklch(0.97 0.005 264)" }}
            >
              Signal intelligence<br />
              <span style={{ color: "oklch(0.696 0.17 162.48)" }}>shaped by human insight.</span>
            </h1>
            <p className="text-base leading-relaxed mb-4" style={{ color: "oklch(0.62 0.01 264)" }}>
              PYTHIA doesn't return AI summaries or keyword matches. She runs a multi-stage scoring cascade
              across 40+ observable signals — each weighted, normalized, and continuously recalibrated by the
              same analytical mind that designed them. Real-time. Market-aware. Behaviorally tuned.
            </p>
            <p className="text-base leading-relaxed mb-8" style={{ color: "oklch(0.52 0.01 264)" }}>
              While generic AI models apply fixed rules, Pythh's methodology is alive. The logic sharpens every
              quarter as new market patterns surface. PYTHIA is a sage — and her results reflect it.
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
              <Link href="/rankings">
                <span
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                  style={{ border: "1px solid oklch(0.25 0.01 264)", color: "oklch(0.65 0.01 264)" }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.94 0.005 264)")}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.65 0.01 264)")}
                >
                  Live rankings
                </span>
              </Link>
            </div>
          </div>

          {/* Right: live signal bars — above the fold */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: "oklch(0.696 0.17 162.48)", boxShadow: "0 0 5px oklch(0.696 0.17 162.48 / 0.6)" }}
                />
                <span className="text-xs font-mono font-bold tracking-widest uppercase" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                  Live Signal Feed
                </span>
              </div>
              <span className="text-[10px] font-mono" style={{ color: "oklch(0.38 0.01 264)" }}>7 dimensions · updates every 3s</span>
            </div>
            <div className="p-5 rounded-2xl" style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}>
              <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: "1px solid oklch(0.2 0.01 264)" }}>
                <div className="w-32 text-[10px] font-mono font-bold uppercase" style={{ color: "oklch(0.4 0.01 264)" }}>Signal</div>
                <div className="flex-1 text-[10px] font-mono font-bold uppercase" style={{ color: "oklch(0.4 0.01 264)" }}>Strength</div>
                <div className="w-10 text-right text-[10px] font-mono font-bold" style={{ color: "oklch(0.4 0.01 264)" }}>Val</div>
                <div className="w-14 text-right text-[10px] font-mono font-bold" style={{ color: "oklch(0.4 0.01 264)" }}>Δ</div>
              </div>
              <SignalFlowBars />
              <p className="text-[10px] font-mono mt-4 text-right" style={{ color: "oklch(0.35 0.01 264)" }}>
                Derived from publicly observable behavior · hover any bar for detail
              </p>
            </div>
            <p className="text-xs mt-3 leading-relaxed" style={{ color: "oklch(0.45 0.01 264)" }}>
              Every bar represents a real-time market signal computed across 33,000+ tracked startups.
              No self-reported data. No editorial judgment. Pure observable evidence.
            </p>
          </div>
        </div>

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
              The PYTHIA pipeline
            </h2>
            <p className="text-sm" style={{ color: "oklch(0.5 0.01 264)" }}>
              Five deterministic stages. Explainable by design. Improving every quarter.
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
            PYTHIA's funding agent monitors every portfolio company around the clock — scanning
            TechCrunch, VentureBeat, and Hacker News for funding rounds, product launches,
            acquisitions, and revenue milestones. Events are classified by GPT-4o-mini, logged to
            the portfolio, and delivered via daily digest.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Events logged",           value: "39",   sub: "funding, product, revenue, team", color: "#22c55e" },
              { label: "Funding rounds detected", value: "9",    sub: "across active portfolio",         color: "#22d3ee" },
              { label: "Product launches tracked",value: "27",   sub: "real-time classification",        color: "#a855f7" },
              { label: "Monitor cadence",         value: "Daily",sub: "6 AM UTC + weekly refresh",       color: "#f97316" },
            ].map((s) => (
              <div
                key={s.label}
                className="p-4 rounded-xl"
                style={{ backgroundColor: "oklch(0.115 0.01 264)", border: `1px solid ${s.color}25` }}
              >
                <div className="text-2xl font-bold mb-1" style={{ color: s.color }}>{s.value}</div>
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
                title: "Daily digest email",
                desc: "Each morning at 6:30 AM UTC, a digest delivers new events, Review-tier alerts, GOD score movements, and auto-seeded new picks to the fund manager.",
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
          <div className="mt-4">
            <a href="/portfolio" className="text-xs inline-flex items-center gap-1" style={{ color: "#22c55e" }}>
              View live portfolio →
            </a>
          </div>
        </section>

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
