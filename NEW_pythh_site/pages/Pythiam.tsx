/**
 * /pythiam — Pythiam Ventures LP page
 * Above-the-fold thesis + proof; horizontal density over vertical scroll.
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
import { G, MUTED, DIM, BORDER, CARD, PAGE, TEXT, G_BORDER } from "@/lib/designTokens";

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

const ENGINE_LAYERS = [
  { icon: Filter, title: "Entity resolution gate", desc: "Name validation, URL checks, junk filtering before scoring." },
  { icon: Brain, title: "GOD scoring (0–100)", desc: "Seven-pillar composite — team, traction, market, product, vision, grit, momentum." },
  { icon: Radar, title: "Signal intelligence", desc: "News, hiring, funding cues — often 6–18 months before databases update." },
  { icon: TrendingUp, title: "Trajectory engine", desc: "Signal sequences predict what happens next and who should care now." },
  { icon: Target, title: "Thesis matching", desc: "Stage, sector, check size, timing — ranked to mandate, not spray-and-pray." },
  { icon: Shield, title: "Portfolio monitoring", desc: "Post-investment signal refresh and health tiers without waiting for quarterly updates." },
];

const FUND_EDGE = [
  { traditional: "Sort inbound decks and warm intros", pythiam: "Surface companies from a 27k+ pipeline before they raise" },
  { traditional: "Subjective gut on 'interesting' companies", pythiam: "GOD score + signal dimensions — auditable selection bar" },
  { traditional: "Crunchbase lag — learn after rounds close", pythiam: "Trajectory signals on hiring, product, capital convergence ahead of press" },
  { traditional: "Analyst bandwidth caps at dozens of names", pythiam: "Platform scores 11k+ continuously; humans focus on top tier" },
  { traditional: "Portfolio updates when founders email", pythiam: "Automated signal monitoring on holdings" },
  { traditional: "Network as the only moat", pythiam: "Network plus proprietary data engine that compounds each scrape cycle" },
];

const LP_PILLARS = [
  { icon: Zap, title: "Deal flow", body: "100+ RSS feeds, submissions, enrichment — ranked to thesis before competitors see the round." },
  { icon: BarChart3, title: "Selection", body: "GOD scores spread honestly after calibration — we know which names cleared a real bar." },
  { icon: Layers, title: "Timing", body: "Signal scores tell us when a company enters a fundraise window, not just whether it's good." },
  { icon: Target, title: "Co-investors", body: "6,370 investor profiles scored — who is deploying, adjacent, and where syndicates exist." },
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
        <title>Pythiam Ventures — Signal-native venture fund powered by Pythh</title>
        <meta
          name="description"
          content="Pythiam Ventures is a venture fund powered by the Pythh signal intelligence platform — proprietary deal flow, GOD scoring, trajectory prediction, and continuous portfolio monitoring."
        />
        <meta property="og:title" content="Pythiam Ventures — Powered by Pythh" />
        <meta property="og:url" content="https://pythh.ai/pythiam" />
      </Helmet>

      <SharedNavbar activePath="/pythiam" />

      <main className="container max-w-6xl pt-20 pb-12">
        {/* Hero — message + proof side by side */}
        <section className="pb-8">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            <div className="lg:col-span-7">
              <SectionLabel className="mb-3">Pythiam Ventures</SectionLabel>
              <h1 className="text-3xl md:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-white leading-[1.1] mb-4">
                A venture fund built on{" "}
                <span style={{ color: G }}>signal science.</span>
              </h1>
              <p className="text-base leading-relaxed mb-6 max-w-xl" style={{ color: MUTED }}>
                Raising a fund powered by{" "}
                <span className="text-white">Pythh</span> — our proprietary intelligence platform.
                We compete on who sees the right companies first, scores them honestly, and moves when the signals say move.
              </p>
              <div className="flex flex-wrap gap-3">
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
            </div>

            <div className="lg:col-span-5">
              {oracle || platformStats ? (
                <StatStrip items={heroStats} cols={2} compact className="border rounded-lg" />
              ) : (
                <div className="h-32 rounded-lg animate-pulse border" style={{ backgroundColor: CARD, borderColor: BORDER }} />
              )}
              {oracle && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-[11px] font-mono" style={{ color: DIM }}>
                  <span>Exited {oracle.successful_exits ?? 0}</span>
                  <span>Median raise {oracle.median_days_to_funding ?? "—"}d</span>
                  <span>Verified MOIC {oracle.verified_avg_moic ? `${oracle.verified_avg_moic}×` : "—"}</span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Four pillars — visible without scrolling on desktop */}
        <section className="pb-8 border-t pt-8" style={{ borderColor: BORDER }}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {LP_PILLARS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="p-4 border" style={{ borderColor: BORDER, backgroundColor: CARD }}>
                <Icon size={16} className="mb-2" style={{ color: G }} />
                <h3 className="text-sm font-semibold text-white mb-1.5">{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Traditional vs Pythiam — key differentiator early */}
        <section className="pb-8 border-t pt-8" style={{ borderColor: BORDER }}>
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
                {FUND_EDGE.map((row, i) => (
                  <tr key={i} style={{ borderTop: `1px solid ${BORDER}` }}>
                    <td className="p-3 align-top text-xs" style={{ color: DIM }}>{row.traditional}</td>
                    <td className="p-3 align-top text-xs text-white">{row.pythiam}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Two-column: thesis + track record detail */}
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
              <p>
                Discovery → entity gate → GOD score → signal dimensions → trajectory → match → monitor.
              </p>
            </div>
          </SectionBlock>

          <SectionBlock
            label="Proof"
            title="Oracle track record"
            subtitle="Public scoreboard — press-verified raises vs early signals."
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
                <Link href="/portfolio">
                  <span className="text-xs font-mono cursor-pointer" style={{ color: G }}>
                    Full scoreboard →
                  </span>
                </Link>
              </>
            ) : (
              <div className="h-24 rounded animate-pulse border" style={{ backgroundColor: CARD, borderColor: BORDER }} />
            )}
          </SectionBlock>
        </div>

        {/* Platform stack — compact grid */}
        <SectionBlock
          label="Stack"
          title="Six production layers"
          subtitle="All live on pythh.ai today."
        >
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

        {/* LP bullets + CTA */}
        <section className="border-t py-10" style={{ borderColor: BORDER }}>
          <div className="grid lg:grid-cols-2 gap-8 items-start">
            <div>
              <SectionLabel className="mb-2">For LPs</SectionLabel>
              <h2 className="text-xl font-bold text-white mb-4 tracking-tight">
                Invest in the fund. Invest in the engine.
              </h2>
              <ul className="space-y-2.5">
                {[
                  "Proprietary deal flow — not banker decks.",
                  "One comparable GOD score across team, traction, market, product, vision.",
                  "Earliest-signal advantage before rounds are public.",
                  "Compounding moat: every scrape cycle improves the next decision.",
                  "Transparent methodology documented on pythh.ai.",
                ].map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-relaxed" style={{ color: MUTED }}>
                    <span className="shrink-0 font-mono" style={{ color: G }}>·</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:text-right lg:pt-8">
              <p className="text-sm mb-5 leading-relaxed lg:ml-auto lg:max-w-sm" style={{ color: MUTED }}>
                Raising from partners who understand that venture returns come from information advantage — and that advantage can be engineered.
              </p>
              <StrokeButton
                href="mailto:hello@pythh.ai?subject=Pythiam%20Ventures%20—%20LP%20inquiry"
                showArrow
                size="lg"
              >
                Request LP materials
              </StrokeButton>
              <p className="text-[11px] font-mono mt-4" style={{ color: DIM }}>
                hello@pythh.ai
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
