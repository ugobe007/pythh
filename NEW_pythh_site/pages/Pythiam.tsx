/**
 * /pythiam — Pythiam Ventures LP page
 * How the Pythh platform powers the fund's deal flow and selection edge.
 */
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import {
  ArrowRight,
  BarChart3,
  Brain,
  Filter,
  Layers,
  Radar,
  Shield,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";

const G = "oklch(0.696 0.17 162.48)";
const MUTED = "oklch(0.55 0.01 264)";
const BORDER = "oklch(0.18 0.01 264)";
const CARD = "oklch(0.12 0.01 264)";

const PLATFORM_STATS = [
  { label: "Scored startups", value: "11,300+", sub: "approved & GOD-rated" },
  { label: "Investment-grade (70+)", value: "2,300+", sub: "top ~20% of pipeline" },
  { label: "Discovery universe", value: "27,000+", sub: "RSS + ingest sources" },
  { label: "Mapped investors", value: "6,370", sub: "thesis + stage profiles" },
  { label: "Signal events", value: "22,000+", sub: "parsed & classified" },
  { label: "Pre-computed matches", value: "1.8M+", sub: "startup ↔ investor pairs" },
];

const ENGINE_LAYERS = [
  {
    icon: Filter,
    title: "Entity resolution gate",
    desc: "Every inbound record passes name validation, URL checks, and junk filtering before it enters scoring. Noise never becomes deal flow.",
  },
  {
    icon: Brain,
    title: "GOD scoring (0–100)",
    desc: "Seven-pillar composite — team, traction, market, product, vision, grit, momentum — so companies are comparable on one disciplined scale.",
  },
  {
    icon: Radar,
    title: "Signal intelligence",
    desc: "Language in the wild (news, hiring, funding cues, product velocity) parsed into classified events — often 6–18 months before static databases update.",
  },
  {
    icon: TrendingUp,
    title: "Trajectory engine",
    desc: "Ordered signal sequences (hire → GTM → diligence → raise) predict what happens next and who should care now.",
  },
  {
    icon: Target,
    title: "Thesis matching",
    desc: "Stage, sector, check size, and timing filters rank startups against mandate — not spray-and-pray lists.",
  },
  {
    icon: Shield,
    title: "Portfolio monitoring",
    desc: "Post-investment signal refresh, event logging, and health tiers — ongoing diligence without waiting for quarterly updates.",
  },
];

const FUND_EDGE = [
  {
    traditional: "Sort inbound decks and warm intros",
    pythiam: "Proactively surface companies from a 27k+ discovery pipeline before they raise",
  },
  {
    traditional: "Subjective gut on 'interesting' companies",
    pythiam: "GOD score + signal dimensions — comparable, auditable selection bar",
  },
  {
    traditional: "Crunchbase lag — learn about rounds after they're done",
    pythiam: "Trajectory signals on hiring, product, and capital convergence ahead of press",
  },
  {
    traditional: "Analyst bandwidth caps coverage at dozens of names",
    pythiam: "Platform scores 11k+ companies continuously; humans focus on top tier",
  },
  {
    traditional: "Portfolio updates when founders email",
    pythiam: "Automated signal monitoring on holdings — funding, product, team events",
  },
  {
    traditional: "Network as the only moat",
    pythiam: "Network plus proprietary data engine that compounds with every scrape cycle",
  },
];

const LP_PILLARS = [
  {
    icon: Zap,
    title: "Deal flow advantage",
    body: "Pythiam does not wait for the best companies to find us. Pythh ingests from 100+ RSS feeds, direct submissions, and enrichment pipelines — then ranks what fits our thesis before competitors see the round.",
  },
  {
    icon: BarChart3,
    title: "Selection discipline",
    body: "After calibration, GOD scores spread honestly: sparse data sits low, traction-rich companies rise to 70+. That bimodal distribution is a feature — we know which names cleared a real bar.",
  },
  {
    icon: Layers,
    title: "Timing edge",
    body: "Signal scores (founder language, capital convergence, execution velocity) tell us when a company is entering a fundraise window — not just whether it is good in the abstract.",
  },
  {
    icon: Target,
    title: "Co-investor intelligence",
    body: "6,370 investor profiles scored and matched. We know who is deploying in our sectors, who is adjacent, and where syndicate opportunities exist.",
  },
];

function SectionHeader({ n, title, subtitle }: { n: string; title: string; subtitle: string }) {
  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-3">
        <span
          className="text-xs font-mono font-bold px-2 py-0.5 rounded"
          style={{ color: G, backgroundColor: `${G}15`, border: `1px solid ${G}35` }}
        >
          {n}
        </span>
        <div className="h-px flex-1" style={{ backgroundColor: BORDER }} />
      </div>
      <h2 className="text-2xl md:text-3xl font-bold text-white mb-3 tracking-tight">{title}</h2>
      <p className="text-base leading-relaxed max-w-3xl" style={{ color: MUTED }}>{subtitle}</p>
    </div>
  );
}

export default function PythiamPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.09 0.01 264)" }}>
      <Helmet>
        <title>Pythiam Ventures — Signal-native venture fund powered by Pythh</title>
        <meta
          name="description"
          content="Pythiam Ventures is a venture fund powered by the Pythh signal intelligence platform — proprietary deal flow, GOD scoring, trajectory prediction, and continuous portfolio monitoring."
        />
        <meta property="og:title" content="Pythiam Ventures — Powered by Pythh" />
        <meta property="og:url" content="https://pythh.ai/pythiam" />
      </Helmet>

      <SharedNavbar activePath="/pythiam" />

      <main className="container pt-20 pb-16 max-w-4xl">

        {/* Hero */}
        <section className="pt-8 pb-14">
          <p className="text-xs font-semibold tracking-[0.2em] uppercase mb-4" style={{ color: G }}>
            Pythiam Ventures
          </p>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white leading-[1.08] mb-6">
            A venture fund built on
            <br />
            <span style={{ color: G }}>signal science.</span>
          </h1>
          <p className="text-lg leading-relaxed mb-8 max-w-2xl" style={{ color: MUTED }}>
            Pythiam Ventures is raising a fund powered by{" "}
            <span className="text-white font-medium">Pythh</span> — our proprietary venture intelligence
            platform. We do not compete on who takes the most meetings. We compete on who sees the
            right companies first, scores them honestly, and moves when the signals say move.
          </p>
          <div className="flex flex-wrap gap-3">
            <a
              href="mailto:hello@pythh.ai?subject=Pythiam%20Ventures%20—%20LP%20inquiry"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition-all"
              style={{ border: `1px solid ${G}`, color: G }}
            >
              LP inquiry <ArrowRight size={16} />
            </a>
            <Link href="/methodology">
              <span
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-medium cursor-pointer transition-colors"
                style={{ border: `1px solid ${BORDER}`, color: MUTED }}
              >
                Scoring methodology
              </span>
            </Link>
          </div>
        </section>

        {/* Thesis */}
        <section className="border-t py-12" style={{ borderColor: BORDER }}>
          <SectionHeader
            n="01"
            title="What Pythh is"
            subtitle="Pythh is an intent detection platform — not a database. It tracks language → intent → action: what companies say in the wild, what that signals about their next move, and who should care now."
          />
          <div
            className="p-6 rounded-xl text-base leading-relaxed"
            style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
          >
            <p className="mb-4" style={{ color: MUTED }}>
              Crunchbase and PitchBook record what already happened. Pythh reads hiring patterns,
              product velocity, funding language, and news momentum — often months before rounds close.
              For Pythiam, that means{" "}
              <span className="text-white">pre-scored deal flow matched to our thesis</span>, ranked
              by signal quality and timing — not a raw list of inbound decks.
            </p>
            <p style={{ color: MUTED }}>
              The same engine that helps founders find investors powers our fund: discovery → entity
              gate → GOD score → signal dimensions → trajectory → match → monitor.
            </p>
          </div>
        </section>

        {/* Fund edge */}
        <section className="border-t py-12" style={{ borderColor: BORDER }}>
          <SectionHeader
            n="02"
            title="How Pythh makes Pythiam successful"
            subtitle="The platform is not a slide in our deck — it is the operating system for sourcing, selecting, and monitoring investments."
          />
          <div className="grid gap-4 mb-10">
            {LP_PILLARS.map(({ icon: Icon, title, body }) => (
              <div
                key={title}
                className="p-5 rounded-xl flex gap-4"
                style={{ backgroundColor: CARD, borderLeft: `2px solid ${G}66` }}
              >
                <Icon size={20} className="shrink-0 mt-0.5" style={{ color: G }} />
                <div>
                  <h3 className="text-white font-semibold mb-2">{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{body}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl" style={{ border: `1px solid ${BORDER}` }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: CARD }}>
                  <th className="text-left p-4 font-medium" style={{ color: MUTED }}>Traditional VC</th>
                  <th className="text-left p-4 font-medium" style={{ color: G }}>Pythiam + Pythh</th>
                </tr>
              </thead>
              <tbody>
                {FUND_EDGE.map((row, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td className="p-4 align-top" style={{ color: "oklch(0.45 0.01 264)" }}>{row.traditional}</td>
                    <td className="p-4 align-top text-white">{row.pythiam}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Platform stack */}
        <section className="border-t py-12" style={{ borderColor: BORDER }}>
          <SectionHeader
            n="03"
            title="The platform stack"
            subtitle="Six layers from raw ingest to portfolio monitoring — all production today on pythh.ai."
          />
          <div className="grid sm:grid-cols-2 gap-3">
            {ENGINE_LAYERS.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="p-4 rounded-xl"
                style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
              >
                <Icon size={18} className="mb-3" style={{ color: G }} />
                <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Live stats */}
        <section className="border-t py-12" style={{ borderColor: BORDER }}>
          <SectionHeader
            n="04"
            title="Production scale"
            subtitle="Live platform metrics — the data moat behind Pythiam's sourcing advantage."
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {PLATFORM_STATS.map(({ label, value, sub }) => (
              <div
                key={label}
                className="p-4 rounded-xl"
                style={{ backgroundColor: CARD, border: `1px solid ${BORDER}` }}
              >
                <div className="text-2xl font-bold font-mono text-white mb-1">{value}</div>
                <div className="text-xs font-medium text-white mb-1">{label}</div>
                <div className="text-[10px]" style={{ color: "oklch(0.42 0.01 264)" }}>{sub}</div>
              </div>
            ))}
          </div>
          <p className="text-xs mt-4" style={{ color: "oklch(0.42 0.01 264)" }}>
            Figures from Pythh production database. GOD ≥ 70 = investment-grade tier after calibration.
          </p>
        </section>

        {/* Fund positioning */}
        <section className="border-t py-12" style={{ borderColor: BORDER }}>
          <SectionHeader
            n="05"
            title="Why LPs should care"
            subtitle="Pythiam is not buying software — we built the software. The fund and the platform share one data flywheel."
          />
          <ul className="space-y-4">
            {[
              "Proprietary deal flow engine assessing tens of thousands of companies — not relying on banker decks.",
              "Quantitative selection discipline: one comparable GOD score across team, traction, market, product, and vision.",
              "Earliest-signal advantage: trajectory and news momentum before rounds are public.",
              "Compounding moat: every RSS cycle, enrichment run, and calibration pass improves the next fund decision.",
              "Transparent methodology — scoring logic, entity gate, and signal weights documented on pythh.ai.",
            ].map((item) => (
              <li key={item} className="flex gap-3 text-sm leading-relaxed" style={{ color: MUTED }}>
                <span className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: G }} />
                {item}
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <section className="border-t py-14 text-center" style={{ borderColor: BORDER }}>
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
            Invest in the fund. Invest in the engine.
          </h2>
          <p className="text-sm mb-8 max-w-lg mx-auto leading-relaxed" style={{ color: MUTED }}>
            Pythiam Ventures is raising from partners who understand that venture returns come from
            information advantage — and that information advantage can be engineered.
          </p>
          <a
            href="mailto:hello@pythh.ai?subject=Pythiam%20Ventures%20—%20LP%20inquiry"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg text-sm font-semibold transition-all"
            style={{ backgroundColor: `${G}18`, border: `1px solid ${G}`, color: G }}
          >
            Request LP materials <ArrowRight size={16} />
          </a>
          <p className="text-xs mt-6" style={{ color: "oklch(0.4 0.01 264)" }}>
            hello@pythh.ai · Signal science for capital
          </p>
        </section>

      </main>

      <footer className="border-t py-8" style={{ borderColor: BORDER }}>
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-4 max-w-4xl">
          <span className="text-xs" style={{ color: "oklch(0.38 0.01 264)" }}>
            © 2026 Pythiam Ventures · Powered by Pythh
          </span>
          <div className="flex gap-6">
            {[
              { href: "/methodology", label: "Methodology" },
              { href: "/rankings", label: "Rankings" },
              { href: "/platform", label: "Platform" },
              { href: "/about", label: "About" },
            ].map(({ href, label }) => (
              <Link key={href} href={href}>
                <span className="text-xs cursor-pointer transition-colors" style={{ color: "oklch(0.42 0.01 264)" }}>
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
