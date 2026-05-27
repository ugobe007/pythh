/**
 * /pythiam — Pythiam Ventures LP page
 * How the Pythh platform powers the fund's deal flow and selection edge.
 */
import { useEffect, useState } from "react";
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
import StatStrip from "@/components/design/StatStrip";
import { G, MUTED, DIM, BORDER, CARD, PAGE } from "@/lib/designTokens";

interface TrackRecord {
  oracle?: {
    total_picks?: number;
    verified_funded_picks?: number;
    verified_funded_rate_pct?: number;
    funded_picks?: number;
    funded_rate_pct?: number;
    successful_exits?: number;
    median_days_to_funding?: number | null;
    verified_avg_moic?: number | null;
    avg_moic?: number | null;
    entry_god_threshold?: number;
  };
  by_god_tier?: Array<{
    tier: string;
    picks: number;
    funded: number;
    verified_funded: number;
    funded_rate_pct: number;
  }>;
}

const PLATFORM_STATS = [
  { label: "Scored startups", key: "startups" as const, sub: "approved & GOD-rated" },
  { label: "Mapped investors", key: "investors" as const, sub: "thesis + stage profiles" },
  { label: "Pre-computed matches", key: "matches" as const, sub: "startup ↔ investor pairs" },
  { label: "Verified funded", key: "verified" as const, sub: "press-confirmed Oracle picks" },
];

function formatCompact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString();
}

function OracleTrackRecordSection({
  trackRecord,
}: {
  trackRecord: TrackRecord | null;
}) {
  const oracle = trackRecord?.oracle;

  return (
    <>
      {oracle ? (
        <>
          <StatStrip
            cols={3}
            className="mb-6"
            items={[
              { label: "Verified funded", value: String(oracle.verified_funded_picks ?? 0), sub: `${oracle.verified_funded_rate_pct ?? 0}% of picks`, accent: true },
              { label: "Oracle picks", value: String(oracle.total_picks ?? "—"), sub: `GOD ≥ ${oracle.entry_god_threshold ?? 70} at entry` },
              { label: "Signal funded", value: String(Math.max(0, (oracle.funded_picks ?? 0) - (oracle.verified_funded_picks ?? 0))), sub: `${oracle.funded_rate_pct ?? 0}% total detection` },
              { label: "Exited", value: String(oracle.successful_exits ?? 0), sub: "acq · IPO" },
              { label: "Median days to raise", value: String(oracle.median_days_to_funding ?? "—"), sub: "after Oracle entry" },
              { label: "Verified avg MOIC", value: oracle.verified_avg_moic ? `${oracle.verified_avg_moic}×` : "—", sub: "press-confirmed markups only" },
            ]}
          />

          {trackRecord?.by_god_tier?.length ? (
            <div className="overflow-x-auto rounded-xl mb-4" style={{ border: `1px solid ${BORDER}` }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: CARD }}>
                    <th className="text-left p-3 font-medium" style={{ color: MUTED }}>GOD at entry</th>
                    <th className="text-right p-3 font-medium" style={{ color: MUTED }}>Picks</th>
                    <th className="text-right p-3 font-medium" style={{ color: MUTED }}>Funded</th>
                    <th className="text-right p-3 font-medium" style={{ color: G }}>Verified</th>
                    <th className="text-right p-3 font-medium" style={{ color: MUTED }}>Funded %</th>
                  </tr>
                </thead>
                <tbody>
                  {trackRecord.by_god_tier.map((row) => (
                    <tr key={row.tier} style={{ borderTop: `1px solid ${BORDER}` }}>
                      <td className="p-3 text-white">{row.tier}</td>
                      <td className="p-3 text-right" style={{ color: MUTED }}>{row.picks}</td>
                      <td className="p-3 text-right" style={{ color: MUTED }}>{row.funded}</td>
                      <td className="p-3 text-right font-medium" style={{ color: G }}>{row.verified_funded}</td>
                      <td className="p-3 text-right" style={{ color: MUTED }}>{row.funded_rate_pct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <Link href="/portfolio">
            <span className="text-sm cursor-pointer transition-colors" style={{ color: G }}>
              Full Oracle scoreboard →
            </span>
          </Link>
        </>
      ) : (
        <div className="p-6 rounded-xl animate-pulse" style={{ backgroundColor: CARD, border: `1px solid ${BORDER}`, height: 120 }} />
      )}
    </>
  );
}

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
  const [trackRecord, setTrackRecord] = useState<TrackRecord | null>(null);
  const [platformStats, setPlatformStats] = useState<{ startups: number; investors: number; matches: number } | null>(null);

  useEffect(() => {
    fetch("/api/portfolio/track-record")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setTrackRecord(data))
      .catch(() => {});
    fetch("/api/platform-stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setPlatformStats({
          startups: Number(d.startups) || 0,
          investors: Number(d.investors) || 0,
          matches: Number(d.matches) || 0,
        });
      })
      .catch(() => {});
  }, []);

  const verifiedCount = trackRecord?.oracle?.verified_funded_picks;
  const verifiedPct = trackRecord?.oracle?.verified_funded_rate_pct;

  const livePlatformTiles = PLATFORM_STATS.map(({ label, key, sub }) => {
    let value = "—";
    if (key === "verified") {
      value = verifiedCount != null ? String(verifiedCount) : "—";
    } else if (platformStats && key in platformStats) {
      value = formatCompact(platformStats[key as keyof typeof platformStats]);
    }
    const liveSub =
      key === "verified" && verifiedPct != null ? `${verifiedPct}% of Oracle picks` : sub;
    return { label, value, sub: liveSub };
  });

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE }}>
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
            <Link href="/portfolio">
              <span
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
                style={{ backgroundColor: `${G}15`, border: `1px solid ${G}55`, color: G }}
              >
                View Oracle scoreboard <ArrowRight size={16} />
              </span>
            </Link>
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

        {/* Oracle track record — proof first */}
        <section className="border-t py-12" style={{ borderColor: BORDER }}>
          <SectionHeader
            n="01"
            title="Oracle track record"
            subtitle="Public proof sheet for the virtual fund — press-verified raises vs early signals, broken down by GOD tier at entry."
          />
          <OracleTrackRecordSection trackRecord={trackRecord} />
        </section>

        {/* Thesis */}
        <section className="border-t py-12" style={{ borderColor: BORDER }}>
          <SectionHeader
            n="02"
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
            n="03"
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
            n="04"
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
            n="05"
            title="Production scale"
            subtitle="Live platform metrics — the data moat behind Pythiam's sourcing advantage."
          />
          <StatStrip
            cols={4}
            className="mb-4"
            items={livePlatformTiles.map(({ label, value, sub }) => ({
              label,
              value,
              sub,
              accent: label === "Verified funded",
            }))}
          />
          <p className="text-xs" style={{ color: DIM }}>
            Live from Pythh production. GOD ≥ 70 = investment-grade tier after calibration.
          </p>
        </section>

        {/* Fund positioning */}
        <section className="border-t py-12" style={{ borderColor: BORDER }}>
          <SectionHeader
            n="06"
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
                <span className="shrink-0 font-mono" style={{ color: G }}>·</span>
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
