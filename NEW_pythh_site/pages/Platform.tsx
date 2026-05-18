import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
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

const SIGNAL_TYPES = [
  { label: "Funding Activity", desc: "New deals, fund closes, portfolio expansions tracked in real time." },
  { label: "Hiring Velocity", desc: "Investor firms growing teams = capital being actively deployed." },
  { label: "Market Momentum", desc: "Sector-level capital flow and competitive heat." },
  { label: "Social Proof", desc: "Conference presence, media coverage, thesis content." },
  { label: "Revenue Signals", desc: "Startup traction from your public footprint." },
  { label: "Product Velocity", desc: "Shipping cadence, feature launches, user growth signals." },
  { label: "Competition Heat", desc: "Adjacent funding rounds and category positioning." },
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

        {/* ── Signal Types ── */}
        <section className="mb-20">
          <h2 className="font-display font-semibold text-xl mb-2" style={{ color: "oklch(0.85 0.01 264)" }}>
            7 signal dimensions
          </h2>
          <p className="text-sm mb-8" style={{ color: "oklch(0.5 0.01 264)" }}>
            Every score is derived from publicly observable behavior — not self-reported data.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {SIGNAL_TYPES.map((s) => (
              <div key={s.label}
                className="p-4 rounded-xl"
                style={{ backgroundColor: "oklch(0.14 0.01 264)", border: "1px solid oklch(0.22 0.01 264)" }}
              >
                <p className="text-sm font-medium mb-1" style={{ color: "oklch(0.85 0.01 264)" }}>{s.label}</p>
                <p className="text-xs leading-relaxed" style={{ color: "oklch(0.52 0.01 264)" }}>{s.desc}</p>
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
