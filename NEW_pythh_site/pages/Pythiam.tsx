/**
 * /pythiam — Pythiam Ventures LP page
 * Visual-first: signal array, GOD scores, portfolio proof — math not magic.
 */
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import {
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
import SectionLabel from "@/components/design/SectionLabel";
import StrokeButton from "@/components/design/StrokeButton";
import PythhEngineVisual from "@/components/PythhEngineVisual";
import PortfolioGodStrip from "@/components/PortfolioGodStrip";
import { G, MUTED, DIM, BORDER, CARD, PAGE, CYAN, GOLD } from "@/lib/designTokens";

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
    best_moic?: number | null;
    entry_god_threshold?: number;
  };
  by_god_tier?: Array<{
    tier: string;
    picks: number;
    funded: number;
    verified_funded: number;
    funded_rate_pct: number;
  }>;
  top_performers?: Array<{
    name: string;
    tagline?: string | null;
    sector?: string | null;
    entry_god_score?: number;
    moic?: number | null;
    irr_annualized?: number | null;
    status?: string;
  }>;
}

const FUND_TERMS = [
  { label: "Fund", value: "Pythiam Ventures Fund I" },
  { label: "Target size", value: "Raising — terms on request" },
  { label: "Stage focus", value: "Pre-seed & Seed" },
  { label: "Sector focus", value: "AI/ML · Fintech · Developer Tools · SaaS" },
  { label: "Geography", value: "US-centric · global signal coverage" },
  { label: "Structure", value: "2% / 20% standard · LP deck on request" },
];

const ENGINE_LAYERS = [
  { icon: Filter, title: "Entity resolution gate", desc: "Name validation, URL checks, junk filtering before scoring." },
  { icon: Brain, title: "GOD scoring (0–100)", desc: "Seven-pillar composite — team, traction, market, product, vision, grit, momentum." },
  { icon: Radar, title: "Signal intelligence", desc: "News, hiring, funding cues — often 6–18 months before databases update." },
  { icon: TrendingUp, title: "Trajectory engine", desc: "Signal sequences predict what happens next and who should care now." },
  { icon: Target, title: "Thesis matching", desc: "Stage, sector, check size, timing — ranked to mandate, not spray-and-pray." },
  { icon: Shield, title: "Portfolio monitoring", desc: "Post-investment signal refresh and health tiers without waiting for quarterly updates." },
];

const FUND_EDGE = (stats: { startups?: number; investors?: number } | null) => [
  { traditional: "Sort inbound decks and warm intros", pythiam: `Surface companies from a ${stats?.startups ? formatCompact(stats.startups) + "+" : "11k+"} pipeline before they raise` },
  { traditional: "Subjective gut on 'interesting' companies", pythiam: "GOD score + signal dimensions — auditable selection bar" },
  { traditional: "Crunchbase lag — learn after rounds close", pythiam: "Trajectory signals on hiring, product, capital convergence ahead of press" },
  { traditional: "Analyst bandwidth caps at dozens of names", pythiam: `Platform scores ${stats?.startups ? formatCompact(stats.startups) + "+" : "11k+"} continuously; humans focus on top tier` },
  { traditional: "Portfolio updates when founders email", pythiam: "Automated signal monitoring on holdings" },
  { traditional: "Network as the only moat", pythiam: "Network plus proprietary data engine that compounds each scrape cycle" },
];

const LP_PILLARS = (stats: { investors?: number; matches?: number } | null) => [
  { icon: Zap, title: "Deal flow", body: "100+ RSS feeds, submissions, enrichment — ranked to thesis before competitors see the round." },
  { icon: BarChart3, title: "Selection", body: "GOD scores spread honestly after calibration — we know which names cleared a real bar." },
  { icon: Layers, title: "Timing", body: "Signal scores tell us when a company enters a fundraise window, not just whether it's good." },
  { icon: Target, title: "Co-investors", body: `${stats?.investors ? formatCompact(stats.investors) : "6.4k"}+ investor profiles scored — who is deploying, adjacent, and where syndicates exist.` },
];

const ENGINE_STATS = [
  { value: "24", label: "Scoring algorithms", sub: "tier-1 VC selection criteria", color: G },
  { value: "40+", label: "Signal types", sub: "classified in real time", color: CYAN },
  { value: "RT", label: "Continuous scoring", sub: "not quarterly snapshots", color: GOLD },
  { value: "0–100", label: "GOD composite", sub: "one auditable bar", color: G },
];

function formatCompact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString();
}

function SectionBlock({
  label,
  title,
  subtitle,
  children,
  className = "",
}: {
  label: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`py-8 border-t ${className}`} style={{ borderColor: BORDER }}>
      <SectionLabel className="mb-2">{label}</SectionLabel>
      <h2 className="text-xl md:text-2xl font-bold text-white mb-2 tracking-tight">{title}</h2>
      {subtitle && (
        <p className="text-sm leading-relaxed mb-5 max-w-3xl" style={{ color: MUTED }}>{subtitle}</p>
      )}
      {children}
    </section>
  );
}

export default function PythiamPage() {
  const [trackRecord, setTrackRecord] = useState<TrackRecord | null>(null);
  const [platformStats, setPlatformStats] = useState<{ startups: number; investors: number; matches: number } | null>(null);
  const [showTierTable, setShowTierTable] = useState(false);

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

  const oracle = trackRecord?.oracle;
  const topPick = trackRecord?.top_performers?.[0];
  const fundEdge = FUND_EDGE(platformStats);
  const lpPillars = LP_PILLARS(platformStats);
  const heroStats = [
    {
      label: "Verified funded",
      value: oracle?.verified_funded_picks != null ? String(oracle.verified_funded_picks) : "—",
      sub: oracle?.verified_funded_rate_pct != null ? `${oracle.verified_funded_rate_pct}% of picks` : "press-confirmed raises",
      accent: true,
    },
    {
      label: "Oracle picks",
      value: oracle?.total_picks != null ? String(oracle.total_picks) : "—",
      sub: `GOD ≥ ${oracle?.entry_god_threshold ?? 70} at entry`,
    },
    {
      label: "Scored startups",
      value: platformStats ? formatCompact(platformStats.startups) : "—",
      sub: "approved & GOD-rated",
    },
    {
      label: "Mapped investors",
      value: platformStats ? formatCompact(platformStats.investors) : "—",
      sub: "thesis + stage profiles",
    },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE }}>
      <Helmet>
        <title>Pythiam Ventures — Math, not magic. Signal-native venture fund.</title>
        <meta
          name="description"
          content="Pythiam Ventures is powered by Pythh — 24 algorithms, 40+ signal types, real-time GOD scoring. Our portfolio reflects our math, not magic."
        />
        <meta property="og:title" content="Pythiam Ventures — Powered by Pythh" />
        <meta property="og:url" content="https://pythh.ai/pythiam" />
      </Helmet>

      <SharedNavbar activePath="/pythiam" />

      <main className="container max-w-6xl pt-20 pb-12">
        {/* Hero — copy + live engine visual */}
        <section className="py-10 lg:py-12">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-start">
            <div className="lg:col-span-5 order-2 lg:order-1">
              <SectionLabel className="mb-3">Pythiam Ventures</SectionLabel>
              <h1 className="text-3xl md:text-4xl lg:text-[2.85rem] font-bold tracking-tight text-white leading-[1.08] mb-3">
                Math, not{" "}
                <span style={{ color: G }}>magic.</span>
              </h1>
              <p className="text-lg font-medium text-white mb-4 leading-snug">
                A venture fund built on signal science.
              </p>
              <p className="text-base leading-relaxed mb-5" style={{ color: MUTED }}>
                Pythiam is powered by{" "}
                <span className="text-white font-medium">Pythh</span> — an advanced system that identifies,
                scores, and matches startups using{" "}
                <span style={{ color: G }}>24 algorithms</span> and{" "}
                <span style={{ color: CYAN }}>40+ signal types</span>, in real time.
              </p>
              <p className="text-sm leading-relaxed mb-6 border-l-2 pl-4" style={{ color: MUTED, borderColor: G }}>
                Our portfolio is a reflection of our math — our signal science. Every Oracle pick cleared
                a quantitative bar before it entered the book.
              </p>
              <div className="flex flex-wrap gap-3 mb-8">
                <StrokeButton
                  href="mailto:hello@pythh.ai?subject=Pythiam%20Ventures%20—%20LP%20inquiry"
                  showArrow
                >
                  LP inquiry
                </StrokeButton>
                <StrokeButton href="/portfolio" showArrow muted>
                  Oracle scoreboard
                </StrokeButton>
                <StrokeButton href="/methodology" muted size="sm">
                  Methodology
                </StrokeButton>
              </div>

              {oracle || platformStats ? (
                <StatStrip items={heroStats} cols={2} compact className="border rounded-lg" />
              ) : (
                <div className="h-28 rounded-lg animate-pulse border" style={{ backgroundColor: CARD, borderColor: BORDER }} />
              )}
            </div>

            <div className="lg:col-span-7 order-1 lg:order-2">
              <PythhEngineVisual />
            </div>
          </div>
        </section>

        {/* Portfolio = our math */}
        <section className="py-8 border-t" style={{ borderColor: BORDER }}>
          <SectionLabel className="mb-2">Proof</SectionLabel>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-2 tracking-tight">
            The portfolio is the math made visible
          </h2>
          <p className="text-sm leading-relaxed mb-5 max-w-2xl" style={{ color: MUTED }}>
            Each Oracle entry logged a GOD score at selection. No narrative override — the scoreboard
            is public, press-verified, and updated as signals change.
          </p>
          <PortfolioGodStrip />
          {topPick && topPick.moic != null && topPick.moic > 1 && (
            <div className="mt-5 p-4 border grid sm:grid-cols-[1fr_auto] gap-4 items-center" style={{ borderColor: BORDER, backgroundColor: CARD }}>
              <div>
                <SectionLabel className="mb-1">Highlighted pick</SectionLabel>
                <h3 className="text-lg font-bold text-white mb-1">{topPick.name}</h3>
                <p className="text-xs mb-2" style={{ color: MUTED }}>
                  {topPick.tagline || topPick.sector || "Oracle entry"} · GOD {topPick.entry_god_score ?? "—"} at entry
                </p>
                <p className="text-xs leading-relaxed" style={{ color: DIM }}>
                  Press-verified Oracle track record — the math in production, not a backtest narrative.
                </p>
              </div>
              <div className="text-right sm:pl-6 sm:border-l" style={{ borderColor: BORDER }}>
                <div className="text-3xl font-display font-bold tabular-nums" style={{ color: GOLD }}>
                  {topPick.moic.toFixed(2)}×
                </div>
                <div className="text-[10px] font-mono uppercase tracking-widest" style={{ color: DIM }}>MOIC</div>
                {topPick.irr_annualized != null && topPick.irr_annualized > 0 && (
                  <div className="text-xs font-mono mt-1" style={{ color: CYAN }}>
                    {Math.round(topPick.irr_annualized)}% IRR
                  </div>
                )}
              </div>
            </div>
          )}
        </section>

        {/* Engine stats strip */}
        <section className="py-6 border-t" style={{ borderColor: BORDER }}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {ENGINE_STATS.map(({ value, label, sub, color }) => (
              <div key={label} className="p-4 border text-center" style={{ borderColor: BORDER, backgroundColor: CARD }}>
                <div className="text-2xl md:text-3xl font-display font-bold tabular-nums mb-1" style={{ color }}>
                  {value}
                </div>
                <div className="text-xs font-medium text-white mb-0.5">{label}</div>
                <div className="text-[10px] font-mono" style={{ color: DIM }}>{sub}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Four pillars */}
        <section className="py-8 border-t" style={{ borderColor: BORDER }}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {lpPillars.map(({ icon: Icon, title, body }) => (
              <div key={title} className="p-4 border" style={{ borderColor: BORDER, backgroundColor: CARD }}>
                <Icon size={16} className="mb-2" style={{ color: G }} />
                <h3 className="text-sm font-semibold text-white mb-1.5">{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Traditional vs Pythiam */}
        <section className="py-8 border-t" style={{ borderColor: BORDER }}>
          <SectionLabel className="mb-2">Operating model</SectionLabel>
          <h2 className="text-xl md:text-2xl font-bold text-white mb-4 tracking-tight">
            How Pythh makes Pythiam successful
          </h2>
          <div className="overflow-x-auto border" style={{ borderColor: BORDER }}>
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr style={{ backgroundColor: CARD }}>
                  <th className="text-left p-3 font-mono text-[10px] uppercase tracking-widest w-1/2" style={{ color: DIM }}>
                    Traditional VC
                  </th>
                  <th className="text-left p-3 font-mono text-[10px] uppercase tracking-widest w-1/2" style={{ color: G }}>
                    Pythiam + Pythh
                  </th>
                </tr>
              </thead>
              <tbody>
                {fundEdge.map((row, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td className="p-3 align-top text-xs" style={{ color: DIM }}>{row.traditional}</td>
                    <td className="p-3 align-top text-xs text-white">{row.pythiam}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Two-column: thesis + track record */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-10 border-t pt-8" style={{ borderColor: BORDER }}>
          <SectionBlock
            label="Platform"
            title="What Pythh is"
            subtitle="Intent detection — language → intent → action. Not a database of what already happened."
            className="border-t-0 pt-0"
          >
            <div className="text-sm leading-relaxed space-y-3" style={{ color: MUTED }}>
              <p>
                Crunchbase records the past. Pythh reads hiring, product velocity, funding language, and news momentum —
                often months before rounds close. For Pythiam:{" "}
                <span className="text-white">pre-scored deal flow matched to our thesis</span>, ranked by signal quality and timing.
              </p>
              <p className="font-mono text-xs" style={{ color: DIM }}>
                discovery → entity gate → GOD score → signals → trajectory → match → monitor
              </p>
            </div>
          </SectionBlock>

          <SectionBlock
            label="Scoreboard"
            title="Oracle track record"
            subtitle="Press-verified raises vs early signals — the math in production."
            className="border-t-0 pt-0 lg:border-l lg:pl-10"
          >
            {oracle ? (
              <>
                <StatStrip
                  cols={3}
                  compact
                  className="mb-3"
                  items={[
                    { label: "Verified funded", value: String(oracle.verified_funded_picks ?? 0), sub: `${oracle.verified_funded_rate_pct ?? 0}%`, accent: true },
                    { label: "Total picks", value: String(oracle.total_picks ?? "—"), sub: "Oracle entries" },
                    { label: "Signal funded", value: String(Math.max(0, (oracle.funded_picks ?? 0) - (oracle.verified_funded_picks ?? 0))), sub: `${oracle.funded_rate_pct ?? 0}% detection` },
                  ]}
                />
                {trackRecord?.by_god_tier?.length ? (
                  <>
                    <button
                      type="button"
                      onClick={() => setShowTierTable((v) => !v)}
                      className="text-xs font-mono mb-2 bg-transparent border-0 cursor-pointer p-0"
                      style={{ color: G }}
                    >
                      {showTierTable ? "Hide" : "Show"} GOD tier breakdown →
                    </button>
                    {showTierTable && (
                      <div className="overflow-x-auto border mb-3" style={{ borderColor: BORDER }}>
                        <table className="w-full text-xs">
                          <thead>
                            <tr style={{ backgroundColor: CARD }}>
                              <th className="text-left p-2 font-mono" style={{ color: DIM }}>GOD</th>
                              <th className="text-right p-2 font-mono" style={{ color: DIM }}>Picks</th>
                              <th className="text-right p-2 font-mono" style={{ color: DIM }}>Funded</th>
                              <th className="text-right p-2 font-mono" style={{ color: G }}>Verified</th>
                            </tr>
                          </thead>
                          <tbody>
                            {trackRecord.by_god_tier.map((row) => (
                              <tr key={row.tier} style={{ borderTop: `1px solid ${BORDER}` }}>
                                <td className="p-2 text-white">{row.tier}</td>
                                <td className="p-2 text-right" style={{ color: MUTED }}>{row.picks}</td>
                                <td className="p-2 text-right" style={{ color: MUTED }}>{row.funded}</td>
                                <td className="p-2 text-right font-medium" style={{ color: G }}>{row.verified_funded}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : null}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono" style={{ color: DIM }}>
                  <span>Exited {oracle.successful_exits ?? 0}</span>
                  <span>Median raise {oracle.median_days_to_funding ?? "—"}d</span>
                  <span>Verified MOIC {oracle.verified_avg_moic ? `${oracle.verified_avg_moic}×` : "—"}</span>
                </div>
              </>
            ) : (
              <div className="h-24 rounded animate-pulse border" style={{ backgroundColor: CARD, borderColor: BORDER }} />
            )}
          </SectionBlock>
        </div>

        {/* Platform stack */}
        <SectionBlock label="Stack" title="Six production layers" subtitle="All live on pythh.ai today.">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ENGINE_LAYERS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="p-3 border" style={{ backgroundColor: CARD, borderColor: BORDER }}>
                <Icon size={14} className="mb-2" style={{ color: G }} />
                <h3 className="text-xs font-semibold text-white mb-1">{title}</h3>
                <p className="text-[11px] leading-relaxed" style={{ color: MUTED }}>{desc}</p>
              </div>
            ))}
          </div>
        </SectionBlock>

        {/* Fund terms */}
        <SectionBlock label="Fund I" title="Terms at a glance" subtitle="Full LP deck available on request.">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {FUND_TERMS.map(({ label, value }) => (
              <div key={label} className="p-3 border" style={{ borderColor: BORDER, backgroundColor: CARD }}>
                <div className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>{label}</div>
                <div className="text-sm text-white">{value}</div>
              </div>
            ))}
          </div>
        </SectionBlock>

        {/* LP CTA */}
        <section className="border-t py-10" style={{ borderColor: BORDER }}>
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <div>
              <SectionLabel className="mb-2">For LPs</SectionLabel>
              <h2 className="text-xl font-bold text-white mb-2 tracking-tight">
                Invest in the fund. Invest in the engine.
              </h2>
              <p className="text-sm mb-4 leading-relaxed" style={{ color: MUTED }}>
                Venture returns come from information advantage — and that advantage can be engineered,
                measured, and audited. Not guessed.
              </p>
              <ul className="space-y-2.5">
                {[
                  "24 algorithms · 40+ signal types · real-time scoring",
                  "One comparable GOD score across every dimension",
                  "Public Oracle scoreboard — portfolio as proof of math",
                  "Compounding moat: every scrape cycle improves the next decision",
                ].map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-relaxed" style={{ color: MUTED }}>
                    <span className="shrink-0 font-mono" style={{ color: G }}>·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:text-right lg:pt-4">
              <StrokeButton
                href="mailto:hello@pythh.ai?subject=Pythiam%20Ventures%20—%20LP%20inquiry"
                showArrow
                size="lg"
              >
                Request LP materials
              </StrokeButton>
              <p className="text-[11px] font-mono mt-4" style={{ color: DIM }}>
                hello@pythh.ai · Signal science for capital
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t py-6" style={{ borderColor: BORDER }}>
        <div className="container flex flex-col sm:flex-row items-center justify-between gap-3 max-w-6xl">
          <span className="text-[11px] font-mono" style={{ color: DIM }}>
            © 2026 Pythiam Ventures · Powered by Pythh
          </span>
          <div className="flex gap-5">
            {[
              { href: "/methodology", label: "Methodology" },
              { href: "/rankings", label: "Rankings" },
              { href: "/platform", label: "Platform" },
              { href: "/about", label: "About" },
            ].map(({ href, label }) => (
              <Link key={href} href={href}>
                <span className="text-[11px] font-mono cursor-pointer transition-colors" style={{ color: DIM }}>
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
