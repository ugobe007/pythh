import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { ArrowRight, Zap, Target, Brain, BarChart3, Mail } from "lucide-react";

// ─── Shared nav (matches Rankings.tsx pattern) ────────────────────────────────

function PageNav() {
  const { user, isAuthenticated } = useAuth();
  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50"
      style={{
        backgroundColor: "oklch(0.11 0.01 264 / 0.95)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid oklch(0.2 0.01 264)",
      }}
    >
      <div className="container">
        <div className="flex items-center justify-between h-14">
          <Link href="/">
            <div className="flex flex-col leading-none cursor-pointer">
              <span className="font-display font-bold text-base text-white tracking-tight">pythh.ai</span>
              <span className="section-label" style={{ color: "oklch(0.696 0.17 162.48)" }}>SIGNAL SCIENCE</span>
            </div>
          </Link>
          <div className="hidden md:flex items-center gap-6">
            {[
              { label: "Rankings", href: "/rankings" },
              { label: "Methodology", href: "/methodology" },
              { label: "Pricing", href: "/pricing" },
            ].map(({ label, href }) => (
              <Link key={href} href={href}>
                <span className="text-sm font-medium cursor-pointer transition-colors"
                  style={{ color: "oklch(0.55 0.01 264)" }}
                  onMouseEnter={(e) => ((e.target as HTMLElement).style.color = "oklch(0.94 0.005 264)")}
                  onMouseLeave={(e) => ((e.target as HTMLElement).style.color = "oklch(0.55 0.01 264)")}
                >{label}</span>
              </Link>
            ))}
          </div>
          <div>
            {isAuthenticated ? (
              <Link href="/account">
                <span className="text-sm font-medium cursor-pointer" style={{ color: "oklch(0.696 0.17 162.48)" }}>
                  {user?.name?.split(" ")[0] ?? "Account"}
                </span>
              </Link>
            ) : (
              <a href={getLoginUrl()} className="text-sm font-semibold px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)" }}>
                Sign in
              </a>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

// ─── Animated signal bars (live-updating every 3s) ───────────────────────────

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

  const glowStyle = deltaPositive
    ? { boxShadow: "0 0 8px rgba(34,211,238,0.35)" }
    : {};

  return (
    <div className="group" title={description}>
      <div className="flex items-center gap-3 mb-1">
        {/* Label */}
        <div className="w-36 text-xs truncate" style={{ color: "oklch(0.55 0.01 264)" }}>
          {label}
        </div>
        {/* Bar track */}
        <div
          className="flex-1 h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: "oklch(0.18 0.01 264 / 0.6)" }}
        >
          <div
            className="h-full rounded-full"
            style={{
              width: `${value * 100}%`,
              background: barColor,
              transition: "width 700ms ease-out",
              ...glowStyle,
            }}
          />
        </div>
        {/* Value */}
        <div
          className="w-10 text-right font-mono text-xs"
          style={{ color: "oklch(0.85 0.005 264)" }}
        >
          {value.toFixed(2)}
        </div>
        {/* Delta */}
        <div className="w-16 text-right font-mono text-xs" style={{ color: deltaColor }}>
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
      {signals.map((s) => (
        <SignalBar key={s.id} signal={s} />
      ))}
    </div>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    n: "01",
    icon: <Zap size={18} />,
    label: "Submit your URL",
    desc: "Paste your website. Within seconds PYTHIA extracts your public signal profile — team depth, product velocity, traction markers, and market positioning.",
  },
  {
    n: "02",
    icon: <BarChart3 size={18} />,
    label: "GOD Scoring",
    desc: "Five dimensions scored 0–20 each: team, traction, market, product, vision. Your 0–100 GOD score updates automatically as new signals surface.",
  },
  {
    n: "03",
    icon: <Target size={18} />,
    label: "Investor candidate selection",
    desc: "Only entity-verified investors with a GOD score ≥ 30 enter the pool. Sector alignment, stage fit, and check-size compatibility are scored in real time.",
  },
  {
    n: "04",
    icon: <Brain size={18} />,
    label: "AI match analysis",
    desc: "GPT-4o scores thesis alignment, synthesizes why-you-match bullets, and drafts a personalized intro email — informed by the investor's quality tier.",
  },
  {
    n: "05",
    icon: <Mail size={18} />,
    label: "Action layer",
    desc: "Ranked matches with confidence levels, fit flags, outreach angles, and ready-to-send intro emails. Why each investor, why now.",
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
        <meta name="description" content="How PYTHIA works: signal science, GOD scoring, investor matching, and the timing playbook that helps founders raise faster." />
        <meta property="og:title" content="Platform — Pythh.ai" />
        <meta property="og:url" content="https://pythh.ai/platform" />
      </Helmet>

      <PageNav />

      <div className="container pt-24 pb-20">

        {/* ── Hero ── */}
        <div className="max-w-3xl mb-16">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px w-8" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
            <span className="text-xs font-bold tracking-widest" style={{ color: "oklch(0.696 0.17 162.48)" }}>
              PYTHH CAPITAL · PLATFORM
            </span>
          </div>
          <h1 className="font-display font-bold mb-4 leading-tight" style={{ fontSize: "clamp(2.2rem, 5vw, 3.5rem)", color: "oklch(0.97 0.005 264)" }}>
            See what investors<br />
            <span style={{ color: "oklch(0.696 0.17 162.48)" }}>can't hide.</span>
          </h1>
          <p className="text-lg leading-relaxed mb-8" style={{ color: "oklch(0.6 0.01 264)" }}>
            PYTHIA is an AI investor intelligence engine. She detects when VCs are actively deploying capital,
            matches your startup to the right investors at the right moment, and writes the outreach.
            No cold lists. No guessing. Just signals.
          </p>
          <div className="flex flex-wrap gap-3">
            <a href="/activate"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all"
              style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)" }}
            >
              Get started <ArrowRight size={14} />
            </a>
            <Link href="/rankings">
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                style={{ backgroundColor: "oklch(0.18 0.01 264)", color: "oklch(0.65 0.01 264)", border: "1px solid oklch(0.25 0.01 264)" }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.94 0.005 264)")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = "oklch(0.65 0.01 264)")}
              >Live rankings</span>
            </Link>
          </div>
        </div>

        {/* ── How It Works ── */}
        <section className="mb-20">
          <h2 className="font-display font-semibold text-xl mb-8" style={{ color: "oklch(0.85 0.01 264)" }}>
            How it works
          </h2>
          <div className="space-y-4">
            {HOW_IT_WORKS.map((s) => (
              <div key={s.n}
                className="flex gap-5 items-start p-5 rounded-xl"
                style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}
              >
                <div className="flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)", border: "1px solid oklch(0.696 0.17 162.48 / 0.25)", color: "oklch(0.696 0.17 162.48)" }}>
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

        {/* ── Live Signal Bars ── */}
        <section className="mb-20">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display font-semibold text-xl" style={{ color: "oklch(0.85 0.01 264)" }}>
              7 signal dimensions
            </h2>
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: "oklch(0.696 0.17 162.48)", boxShadow: "0 0 5px oklch(0.696 0.17 162.48 / 0.6)", animation: "pulse 2s infinite" }}
              />
              <span className="text-xs font-mono" style={{ color: "oklch(0.696 0.17 162.48)" }}>LIVE</span>
            </div>
          </div>
          <p className="text-sm mb-8" style={{ color: "oklch(0.5 0.01 264)" }}>
            Every score derived from publicly observable behavior — not self-reported data. Hover a bar for detail.
          </p>
          <div
            className="p-6 rounded-2xl"
            style={{ backgroundColor: "oklch(0.12 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}
          >
            {/* Column headers */}
            <div className="flex items-center gap-3 mb-4 pb-3" style={{ borderBottom: "1px solid oklch(0.2 0.01 264)" }}>
              <div className="w-36 text-xs font-mono font-bold" style={{ color: "oklch(0.4 0.01 264)" }}>SIGNAL</div>
              <div className="flex-1 text-xs font-mono font-bold" style={{ color: "oklch(0.4 0.01 264)" }}>STRENGTH</div>
              <div className="w-10 text-right text-xs font-mono font-bold" style={{ color: "oklch(0.4 0.01 264)" }}>VAL</div>
              <div className="w-16 text-right text-xs font-mono font-bold" style={{ color: "oklch(0.4 0.01 264)" }}>Δ</div>
            </div>
            <SignalFlowBars />
            <p className="text-xs mt-4 text-right font-mono" style={{ color: "oklch(0.35 0.01 264)" }}>
              Updates every 3s · Hover bar for signal description
            </p>
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
              <div key={p.name}
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
            <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase tracking-wider" style={{ backgroundColor: "#22c55e18", color: "#22c55e", border: "1px solid #22c55e40" }}>
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
              { label: "Events logged", value: "39", sub: "funding, product, revenue, team", color: "#22c55e" },
              { label: "Funding rounds detected", value: "9", sub: "across active portfolio", color: "#22d3ee" },
              { label: "Product launches tracked", value: "27", sub: "real-time classification", color: "#a855f7" },
              { label: "Monitor cadence", value: "Daily", sub: "6 AM UTC + weekly refresh", color: "#f97316" },
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
                desc: "RSS feeds from TechCrunch Startups/Venture, VentureBeat, and Hacker News Algolia — fetched in a single batch pass, matched against every portfolio company by name.",
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
                desc: "Each morning at 6:30 AM UTC, a Resend digest delivers new events, Review-tier alerts, GOD score movements, and auto-seeded new picks to the fund manager.",
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
        <div className="p-8 rounded-2xl text-center" style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.25 0.01 264)" }}>
          <h2 className="font-display font-bold text-2xl mb-3" style={{ color: "oklch(0.97 0.005 264)" }}>
            Ready to see who's ready for you?
          </h2>
          <p className="text-sm mb-6" style={{ color: "oklch(0.55 0.01 264)" }}>
            Activate PYTHIA. She'll find the investors, time the outreach, and write the intro.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a href="/activate"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all"
              style={{ backgroundColor: "oklch(0.696 0.17 162.48)", color: "oklch(0.1 0.01 162)" }}
            >
              Activate PYTHIA <ArrowRight size={14} />
            </a>
            <Link href="/methodology">
              <span className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium cursor-pointer"
                style={{ backgroundColor: "oklch(0.18 0.01 264)", color: "oklch(0.65 0.01 264)", border: "1px solid oklch(0.25 0.01 264)" }}
              >Read the methodology</span>
            </Link>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="border-t py-8 mt-4" style={{ borderColor: "oklch(0.2 0.01 264)", backgroundColor: "oklch(0.11 0.01 264)" }}>
        <div className="container flex flex-wrap gap-6 justify-center">
          {[
            { label: "Rankings", href: "/rankings" },
            { label: "Methodology", href: "/methodology" },
            { label: "Pricing", href: "/pricing" },
            { label: "Newsletter", href: "/newsletter" },
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
