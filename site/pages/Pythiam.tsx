/**
 * /pythiam — Pythiam Ventures LP page
 * Editorial LP surface: brand, thesis, MOIC proof, engine — math not magic.
 */
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import {
  Brain,
  Filter,
  Radar,
  Shield,
  Target,
  TrendingUp,
} from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";
import SectionLabel from "@/components/design/SectionLabel";
import StrokeButton from "@/components/design/StrokeButton";
import PythhEngineVisual from "@/components/PythhEngineVisual";
import PortfolioGodStrip from "@/components/PortfolioGodStrip";
import { G, MUTED, DIM, BORDER, CARD, PAGE, CYAN, GOLD, TEXT, G_SUBTLE } from "@/lib/designTokens";

interface TrackRecord {
  oracle?: {
    total_picks?: number;
    verified_funded_picks?: number;
    verified_funded_rate_pct?: number;
    funded_picks?: number;
    funded_rate_pct?: number;
    successful_exits?: number;
    median_days_to_funding?: number | null;
    avg_moic?: number | null;
    verified_avg_moic?: number | null;
    best_moic?: number | null;
    moic_note?: string | null;
    entry_god_threshold?: number;
  };
  featured_pick?: PerformerPick | null;
  top_performers?: PerformerPick[];
}

interface PerformerPick {
  name: string;
  tagline?: string | null;
  sector?: string | null;
  entry_god_score?: number;
  entry_date?: string;
  moic?: number | null;
  irr_annualized?: number | null;
  status?: string;
  verified?: boolean;
  latest_funding?: {
    amount_usd?: number | null;
    headline?: string | null;
    lead_investor?: string | null;
    event_date?: string;
  } | null;
}

function formatFundingUsd(amount: number): string {
  if (amount >= 1_000_000) return `$${Math.round(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${amount.toLocaleString()}`;
}

function formatValuation(amount?: number | null): string {
  if (!amount || amount <= 0) return "—";
  if (amount >= 1_000_000_000) return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `$${Math.round(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${amount}`;
}

interface FundValue {
  positions?: number;
  tvpi?: number;
  avg_moic?: number;
  current_value_usd?: number;
  cost_basis_usd?: number;
  deployed_usd?: number;
  gain_pct?: number;
  win_rate_pct?: number;
  projected_moic?: number;
}

interface SignalMarquee {
  name: string;
  first_flag_valuation_usd?: number;
  current_valuation_usd?: number;
  lead_months?: number;
}

interface SignalProof {
  flagged?: number;
  unicorns_now?: number;
  tier_500m_now?: number;
  tier_100m_now?: number;
  unicorn_hit_rate_pct?: number;
  median_lead_months?: number;
  marquee?: SignalMarquee[];
}

interface VelocitySummary {
  positions_scored?: number;
  accelerating_count?: number;
  hot_count?: number;
  momentum_uplift_pct?: number;
}

interface PortfolioAnalytics {
  value?: FundValue;
  follow_on?: FundValue;
  signal?: SignalProof;
  velocity?: VelocitySummary;
}

const FUND_TERMS = [
  { label: "Fund", value: "Pythiam Ventures Fund I" },
  { label: "Target size", value: "$8MM" },
  { label: "Stage", value: "Seed" },
  { label: "Sector", value: "AI and B2B software" },
  { label: "Geography", value: "United States" },
  { label: "Structure", value: "2% / 20% · LP deck on request" },
];

/** Canonical LP thesis — see docs/PYTHIA_FUND_THESIS.md */
const FUND_THESIS =
  "Pythiam Ventures is launching an $8MM seed fund in the United States to back US AI and B2B software companies, using Pythh’s signal engine — 11k+ scored startups and Oracle picks with a ~44% verified-funded hit rate.";

const ENGINE_LAYERS = [
  { icon: Filter, title: "Entity resolution gate", desc: "Name validation, URL checks, junk filtering before scoring." },
  { icon: Brain, title: "GOD scoring (0–100)", desc: "Seven-pillar composite — team, traction, market, product, vision, grit, momentum." },
  { icon: Radar, title: "Signal intelligence", desc: "News, hiring, funding cues — often 6–18 months before databases update." },
  { icon: TrendingUp, title: "Trajectory engine", desc: "Signal sequences predict what happens next and who should care now." },
  { icon: Target, title: "Thesis matching", desc: "Stage, sector, check size, timing — ranked to mandate, not spray-and-pray." },
  { icon: Shield, title: "Portfolio monitoring", desc: "Post-investment signal refresh and health tiers without waiting for quarterly updates." },
];

const FUND_EDGE = (stats: { startups?: number } | null) => [
  { traditional: "Sort inbound decks and warm intros", pythiam: `Surface companies from a ${stats?.startups ? formatCompact(stats.startups) + "+" : "11k+"} pipeline before they raise` },
  { traditional: "Subjective gut on 'interesting' companies", pythiam: "GOD score + signal dimensions — auditable selection bar" },
  { traditional: "Crunchbase lag — learn after rounds close", pythiam: "Trajectory signals on hiring, product, capital convergence ahead of press" },
  { traditional: "Analyst bandwidth caps at dozens of names", pythiam: `Platform scores ${stats?.startups ? formatCompact(stats.startups) + "+" : "11k+"} continuously; humans focus on top tier` },
  { traditional: "Portfolio updates when founders email", pythiam: "Automated signal monitoring on holdings" },
  { traditional: "Network as the only moat", pythiam: "Network plus proprietary data engine that compounds each scrape cycle" },
];

function formatCompact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return m >= 10 ? `${Math.round(m)}M` : `${m.toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) return `${Math.round(n / 1000)}K`;
  return n.toLocaleString();
}

function MetricLine({
  value,
  label,
  sub,
  color = TEXT,
}: {
  value: string;
  label: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="min-w-0">
      <div
        className="font-display font-bold tabular-nums tracking-tight"
        style={{ color, fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.03em" }}
      >
        {value}
      </div>
      <div className="text-xs font-medium mt-1" style={{ color: TEXT }}>
        {label}
      </div>
      {sub ? (
        <div className="text-[10px] font-mono mt-0.5" style={{ color: DIM }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

export default function PythiamPage() {
  const [trackRecord, setTrackRecord] = useState<TrackRecord | null>(null);
  const [platformStats, setPlatformStats] = useState<{ startups: number; investors: number; matches: number } | null>(null);
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);

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
    fetch("/api/portfolio/analytics")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setAnalytics(d))
      .catch(() => {});
  }, []);

  const seed = analytics?.value;
  const followOn = analytics?.follow_on;
  const sig = analytics?.signal;
  const vel = analytics?.velocity;
  const oracle = trackRecord?.oracle;
  const featuredPick = trackRecord?.featured_pick ?? trackRecord?.top_performers?.[0];
  const moicHighlight =
    [...(trackRecord?.top_performers ?? [])]
      .filter((p) => p.verified && p.moic != null && p.moic > 1)
      .sort((a, b) => (b.moic ?? 0) - (a.moic ?? 0))[0] ??
    (featuredPick && featuredPick.moic != null && featuredPick.moic > 1 ? featuredPick : null);
  const fundEdge = FUND_EDGE(platformStats);

  const verifiedMoic = oracle?.verified_avg_moic;
  const avgMoic = oracle?.avg_moic ?? seed?.avg_moic;
  const seedTvpi = seed?.tvpi;

  return (
    <div className="min-h-screen relative overflow-x-hidden" style={{ backgroundColor: PAGE, color: TEXT }}>
      {/* Atmosphere — soft emerald wash, not flat black */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[70vh] opacity-90"
        style={{
          background: `
            radial-gradient(ellipse 80% 50% at 15% 10%, oklch(0.696 0.17 162.48 / 0.14), transparent 55%),
            radial-gradient(ellipse 60% 40% at 90% 0%, oklch(0.769 0.188 70.08 / 0.06), transparent 50%),
            linear-gradient(180deg, oklch(0.11 0.015 162) 0%, ${PAGE} 100%)
          `,
        }}
      />

      <Helmet>
        <title>Pythiam Ventures — $8MM seed fund for US AI and B2B software</title>
        <meta
          name="description"
          content="Pythiam Ventures is launching an $8MM seed fund in the United States to back US AI and B2B software companies, using Pythh’s signal engine — 11k+ scored startups and Oracle picks with a ~44% verified-funded hit rate."
        />
        <meta property="og:title" content="Pythiam Ventures — $8MM seed · US AI & B2B software" />
        <meta property="og:url" content="https://pythh.ai/pythiam" />
        <meta property="og:description" content="A venture fund built on signal science. Powered by Pythh." />
      </Helmet>

      <SharedNavbar activePath="/pythiam" />

      <main className="relative">
        {/* ─── Hero ─── */}
        <section className="container max-w-6xl pt-24 pb-10 lg:pt-28 lg:pb-12">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            <div
              className="lg:col-span-5 animate-fade-in-up"
              style={{ animationFillMode: "both" }}
            >
              <p
                className="font-display font-bold tracking-tight mb-5"
                style={{
                  color: G,
                  fontSize: "clamp(1.75rem, 4vw, 2.35rem)",
                  letterSpacing: "-0.04em",
                  lineHeight: 1.05,
                }}
              >
                Pythiam Ventures
              </p>
              <h1
                className="font-display font-bold tracking-tight mb-4"
                style={{
                  color: TEXT,
                  fontSize: "clamp(2.4rem, 5.5vw, 3.6rem)",
                  letterSpacing: "-0.045em",
                  lineHeight: 1.02,
                }}
              >
                Math, not{" "}
                <span style={{ color: G }}>magic.</span>
              </h1>
              <p className="text-base md:text-lg leading-snug mb-6 max-w-[34ch]" style={{ color: MUTED }}>
                A venture fund built on signal science.
              </p>
              <p className="text-sm md:text-[15px] leading-relaxed mb-8 max-w-[42ch]" style={{ color: MUTED }}>
                {FUND_THESIS}
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
              </div>
            </div>

            <div className="lg:col-span-7 animate-fade-in-up delay-100" style={{ animationFillMode: "both" }}>
              <PythhEngineVisual />
            </div>
          </div>
        </section>

        {/* ─── MOIC band — one composition, not a card grid ─── */}
        <section
          className="border-y relative"
          style={{
            borderColor: BORDER,
            background: `linear-gradient(90deg, ${G_SUBTLE} 0%, transparent 40%, transparent 100%), ${CARD}`,
          }}
        >
          <div className="container max-w-6xl py-12 md:py-16 animate-fade-in-up delay-200" style={{ animationFillMode: "both" }}>
            <div className="flex flex-col lg:flex-row lg:items-end gap-10 lg:gap-16">
              <div className="lg:min-w-[280px]">
                <SectionLabel className="mb-3">Live book · Fund I</SectionLabel>
                <div
                  className="font-display font-bold tabular-nums leading-none tracking-tight"
                  style={{
                    color: G,
                    fontSize: "clamp(4.5rem, 12vw, 7.5rem)",
                    letterSpacing: "-0.06em",
                  }}
                >
                  {verifiedMoic != null ? `${verifiedMoic}×` : "—"}
                </div>
                <p className="mt-3 text-sm font-medium" style={{ color: TEXT }}>
                  Verified MOIC
                </p>
                <p className="text-[11px] font-mono mt-1 max-w-[28ch]" style={{ color: DIM }}>
                  Press-confirmed raises only
                  {oracle?.moic_note ? ` · ${oracle.moic_note}` : ""}
                </p>
              </div>

              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8 lg:gap-x-10 lg:border-l lg:pl-12 pt-2" style={{ borderColor: BORDER }}>
                <MetricLine
                  value={avgMoic != null ? `${avgMoic}×` : "—"}
                  label="Avg MOIC"
                  sub="incl. signal marks"
                  color={GOLD}
                />
                <MetricLine
                  value={seedTvpi != null ? `${seedTvpi.toFixed(2)}×` : "—"}
                  label="Seed TVPI"
                  sub="virtual Fund I"
                  color={G}
                />
                <MetricLine
                  value={oracle?.verified_funded_picks != null ? String(oracle.verified_funded_picks) : "—"}
                  label="Verified funded"
                  sub={oracle?.verified_funded_rate_pct != null ? `${oracle.verified_funded_rate_pct}% of picks` : undefined}
                  color={TEXT}
                />
                <MetricLine
                  value={oracle?.best_moic != null ? `${oracle.best_moic}×` : "—"}
                  label="Best MOIC"
                  sub="per-position cap"
                  color={GOLD}
                />
              </div>
            </div>
          </div>
        </section>

        <div className="container max-w-6xl pb-16">
          {/* ─── Proof ─── */}
          <section className="py-14 md:py-16">
            <SectionLabel className="mb-3">Proof</SectionLabel>
            <h2
              className="font-display font-bold tracking-tight mb-3 max-w-[18ch]"
              style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", letterSpacing: "-0.035em", color: TEXT }}
            >
              The portfolio is the math made visible
            </h2>
            <p className="text-sm leading-relaxed mb-8 max-w-xl" style={{ color: MUTED }}>
              Every Oracle entry logged a GOD score at selection. MOIC marks to press-verified rounds —
              public scoreboard, no narrative override.
            </p>
            <PortfolioGodStrip />

            {moicHighlight && moicHighlight.moic != null && (
              <div className="mt-10 grid lg:grid-cols-12 gap-8 items-end">
                <div className="lg:col-span-7">
                  <p className="text-[10px] font-mono uppercase tracking-[0.16em] mb-3" style={{ color: G }}>
                    Top MOIC pick
                    {moicHighlight.verified ? " · press verified" : ""}
                  </p>
                  <h3
                    className="font-display font-bold tracking-tight mb-2"
                    style={{ fontSize: "clamp(1.75rem, 3vw, 2.25rem)", letterSpacing: "-0.03em" }}
                  >
                    {moicHighlight.name}
                  </h3>
                  <p className="text-sm mb-3" style={{ color: MUTED }}>
                    {moicHighlight.tagline || moicHighlight.sector || "Oracle entry"}
                    {" · "}
                    GOD {moicHighlight.entry_god_score ?? "—"} at entry
                  </p>
                  {moicHighlight.latest_funding?.amount_usd ? (
                    <p className="text-sm leading-relaxed max-w-xl" style={{ color: MUTED }}>
                      {formatFundingUsd(moicHighlight.latest_funding.amount_usd)}
                      {moicHighlight.latest_funding.lead_investor
                        ? ` from ${moicHighlight.latest_funding.lead_investor}`
                        : ""}
                      {moicHighlight.latest_funding.headline
                        ? ` — ${moicHighlight.latest_funding.headline}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <div className="lg:col-span-5 lg:text-right">
                  <div
                    className="font-display font-bold tabular-nums leading-none"
                    style={{
                      color: GOLD,
                      fontSize: "clamp(3.5rem, 8vw, 5.5rem)",
                      letterSpacing: "-0.05em",
                    }}
                  >
                    {moicHighlight.moic.toFixed(1)}×
                  </div>
                  <p className="text-[10px] font-mono uppercase tracking-[0.16em] mt-2" style={{ color: DIM }}>
                    MOIC
                    {moicHighlight.irr_annualized != null && moicHighlight.irr_annualized > 0
                      ? ` · ${Math.round(moicHighlight.irr_annualized)}% IRR`
                      : ""}
                  </p>
                </div>
              </div>
            )}
          </section>

          {/* ─── Fund books ─── */}
          {(seed || followOn) && (
            <section className="py-12 border-t" style={{ borderColor: BORDER }}>
              <SectionLabel className="mb-3">Fund books</SectionLabel>
              <h2
                className="font-display font-bold tracking-tight mb-10"
                style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.03em" }}
              >
                Seed and follow-on, marked live
              </h2>
              <div className="grid md:grid-cols-2 gap-12 md:gap-16">
                {seed && (
                  <div>
                    <div className="flex items-baseline justify-between gap-4 mb-6">
                      <h3 className="text-sm font-semibold" style={{ color: TEXT }}>
                        Seed Fund I
                      </h3>
                      <div className="text-right">
                        <span className="font-display font-bold tabular-nums text-3xl" style={{ color: G }}>
                          {(seed.avg_moic ?? seed.tvpi ?? 0).toFixed(2)}×
                        </span>
                        <span className="text-[10px] font-mono ml-2" style={{ color: DIM }}>
                          MOIC
                        </span>
                        {seed.tvpi != null && (
                          <div className="text-xs font-mono mt-1" style={{ color: MUTED }}>
                            {seed.tvpi.toFixed(2)}× TVPI
                          </div>
                        )}
                      </div>
                    </div>
                    <dl className="grid grid-cols-3 gap-4">
                      <div>
                        <dt className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>
                          Value
                        </dt>
                        <dd className="text-sm font-semibold tabular-nums">{formatValuation(seed.current_value_usd)}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>
                          Gain
                        </dt>
                        <dd className="text-sm font-semibold tabular-nums" style={{ color: seed.gain_pct && seed.gain_pct > 0 ? G : TEXT }}>
                          {seed.gain_pct != null ? `+${seed.gain_pct}%` : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>
                          Win rate
                        </dt>
                        <dd className="text-sm font-semibold tabular-nums">
                          {seed.win_rate_pct != null ? `${seed.win_rate_pct}%` : "—"}
                        </dd>
                      </div>
                    </dl>
                    <p className="text-[11px] font-mono mt-5" style={{ color: DIM }}>
                      {seed.positions ?? 0} positions · {formatValuation(seed.cost_basis_usd)} cost basis
                    </p>
                  </div>
                )}
                {followOn && (
                  <div className="md:border-l md:pl-16" style={{ borderColor: BORDER }}>
                    <div className="flex items-baseline justify-between gap-4 mb-6">
                      <h3 className="text-sm font-semibold" style={{ color: TEXT }}>
                        Follow-on Sidecar
                      </h3>
                      <div className="text-right">
                        <span className="font-display font-bold tabular-nums text-3xl" style={{ color: CYAN }}>
                          {(followOn.avg_moic ?? followOn.tvpi ?? 0).toFixed(2)}×
                        </span>
                        <span className="text-[10px] font-mono ml-2" style={{ color: DIM }}>
                          MOIC
                        </span>
                        {followOn.tvpi != null && (
                          <div className="text-xs font-mono mt-1" style={{ color: MUTED }}>
                            {followOn.tvpi.toFixed(2)}× TVPI
                          </div>
                        )}
                      </div>
                    </div>
                    <dl className="grid grid-cols-3 gap-4">
                      <div>
                        <dt className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>
                          Value
                        </dt>
                        <dd className="text-sm font-semibold tabular-nums">{formatValuation(followOn.current_value_usd)}</dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>
                          Gain
                        </dt>
                        <dd className="text-sm font-semibold tabular-nums" style={{ color: followOn.gain_pct && followOn.gain_pct > 0 ? G : TEXT }}>
                          {followOn.gain_pct != null ? `+${followOn.gain_pct}%` : "—"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[10px] font-mono uppercase tracking-widest mb-1" style={{ color: DIM }}>
                          Projected
                        </dt>
                        <dd className="text-sm font-semibold tabular-nums" style={{ color: GOLD }}>
                          {followOn.projected_moic != null ? `${followOn.projected_moic}×` : "—"}
                        </dd>
                      </div>
                    </dl>
                    <p className="text-[11px] font-mono mt-5" style={{ color: DIM }}>
                      {followOn.positions ?? 0} later-stage · {formatValuation(followOn.deployed_usd)} deployed
                    </p>
                  </div>
                )}
              </div>

              {sig && (
                <p className="text-[11px] font-mono mt-10 pt-6 border-t" style={{ color: DIM, borderColor: BORDER }}>
                  Predictive · {sig.unicorns_now ?? "—"} unicorns flagged
                  {sig.unicorn_hit_rate_pct != null ? ` · ${sig.unicorn_hit_rate_pct}% hit rate` : ""}
                  {sig.tier_500m_now != null ? ` · ${sig.tier_500m_now} now $500M+` : ""}
                  {sig.median_lead_months != null ? ` · ${sig.median_lead_months}mo median lead` : ""}
                  {vel?.momentum_uplift_pct != null
                    ? ` · +${vel.momentum_uplift_pct}% momentum premium (not in realized MOIC)`
                    : ""}
                </p>
              )}

              {sig?.marquee && sig.marquee.length > 0 && (
                <div className="mt-10 overflow-x-auto">
                  <p className="text-[10px] font-mono uppercase tracking-[0.14em] mb-4" style={{ color: DIM }}>
                    Caught early
                  </p>
                  <table className="w-full text-sm min-w-[440px]">
                    <thead>
                      <tr>
                        <th className="text-left pb-3 font-mono text-[10px] uppercase tracking-widest font-normal" style={{ color: DIM }}>
                          Company
                        </th>
                        <th className="text-right pb-3 font-mono text-[10px] uppercase tracking-widest font-normal" style={{ color: DIM }}>
                          At flag
                        </th>
                        <th className="text-right pb-3 font-mono text-[10px] uppercase tracking-widest font-normal" style={{ color: G }}>
                          Now
                        </th>
                        <th className="text-right pb-3 font-mono text-[10px] uppercase tracking-widest font-normal" style={{ color: DIM }}>
                          Lead
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sig.marquee.slice(0, 6).map((m) => {
                        const grew = (m.current_valuation_usd ?? 0) > (m.first_flag_valuation_usd ?? 0);
                        return (
                          <tr key={m.name} style={{ borderTop: `1px solid ${BORDER}` }}>
                            <td className="py-3" style={{ color: TEXT }}>
                              {m.name}
                            </td>
                            <td className="py-3 text-right tabular-nums" style={{ color: MUTED }}>
                              {formatValuation(m.first_flag_valuation_usd)}
                            </td>
                            <td className="py-3 text-right tabular-nums font-medium" style={{ color: grew ? G : TEXT }}>
                              {formatValuation(m.current_valuation_usd)}
                            </td>
                            <td className="py-3 text-right font-mono text-xs" style={{ color: DIM }}>
                              {m.lead_months ? `${m.lead_months}mo` : "at flag"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-8">
                <StrokeButton href="/portfolio" showArrow muted size="sm">
                  Full Oracle scoreboard
                </StrokeButton>
              </div>
            </section>
          )}

          {/* ─── Operating model ─── */}
          <section className="py-14 border-t" style={{ borderColor: BORDER }}>
            <SectionLabel className="mb-3">Operating model</SectionLabel>
            <h2
              className="font-display font-bold tracking-tight mb-8 max-w-[22ch]"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.03em" }}
            >
              How Pythh makes Pythiam successful
            </h2>
            <div className="space-y-0">
              {fundEdge.map((row, i) => (
                <div
                  key={i}
                  className="grid md:grid-cols-2 gap-3 md:gap-10 py-4"
                  style={{ borderTop: `1px solid ${BORDER}` }}
                >
                  <p className="text-sm" style={{ color: DIM }}>
                    {row.traditional}
                  </p>
                  <p className="text-sm" style={{ color: TEXT }}>
                    {row.pythiam}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ─── Stack ─── */}
          <section className="py-14 border-t" style={{ borderColor: BORDER }}>
            <SectionLabel className="mb-3">Stack</SectionLabel>
            <h2
              className="font-display font-bold tracking-tight mb-3"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.03em" }}
            >
              Six production layers
            </h2>
            <p className="text-sm mb-10 max-w-lg" style={{ color: MUTED }}>
              All live on pythh.ai — 24 algorithms, 40+ signal types, continuous GOD scoring.
            </p>
            <ol className="grid sm:grid-cols-2 gap-x-12 gap-y-8">
              {ENGINE_LAYERS.map(({ icon: Icon, title, desc }, i) => (
                <li key={title} className="flex gap-4">
                  <span className="font-mono text-[11px] tabular-nums pt-1 shrink-0" style={{ color: G }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <Icon size={14} style={{ color: G }} />
                      <h3 className="text-sm font-semibold" style={{ color: TEXT }}>
                        {title}
                      </h3>
                    </div>
                    <p className="text-xs leading-relaxed" style={{ color: MUTED }}>
                      {desc}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {/* ─── Terms ─── */}
          <section className="py-14 border-t" style={{ borderColor: BORDER }}>
            <SectionLabel className="mb-3">Fund I</SectionLabel>
            <h2
              className="font-display font-bold tracking-tight mb-10"
              style={{ fontSize: "clamp(1.5rem, 3vw, 2rem)", letterSpacing: "-0.03em" }}
            >
              Terms at a glance
            </h2>
            <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-8">
              {FUND_TERMS.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-[10px] font-mono uppercase tracking-[0.14em] mb-2" style={{ color: DIM }}>
                    {label}
                  </dt>
                  <dd className="text-base font-medium" style={{ color: TEXT }}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {/* ─── LP CTA ─── */}
          <section
            className="my-6 py-14 px-6 md:px-10 relative overflow-hidden"
            style={{
              background: `
                radial-gradient(ellipse 70% 80% at 100% 50%, oklch(0.696 0.17 162.48 / 0.12), transparent 60%),
                ${CARD}
              `,
              borderTop: `1px solid ${BORDER}`,
              borderBottom: `1px solid ${BORDER}`,
            }}
          >
            <div className="grid lg:grid-cols-12 gap-10 items-center">
              <div className="lg:col-span-7">
                <SectionLabel className="mb-3">For LPs</SectionLabel>
                <h2
                  className="font-display font-bold tracking-tight mb-4 max-w-[16ch]"
                  style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", letterSpacing: "-0.035em" }}
                >
                  Invest in the fund. Invest in the engine.
                </h2>
                <p className="text-sm leading-relaxed max-w-md mb-6" style={{ color: MUTED }}>
                  Returns come from information advantage — engineered, measured, and audited.
                  Verified MOIC on press-confirmed raises. Public scoreboard.
                </p>
                <ul className="space-y-2">
                  {[
                    "Verified MOIC on press-confirmed raises",
                    "24 algorithms · 40+ signal types · real-time scoring",
                    "Public Oracle scoreboard — portfolio as proof",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm" style={{ color: MUTED }}>
                      <span style={{ color: G }}>·</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="lg:col-span-5 lg:text-right">
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
        </div>
      </main>

      <footer className="border-t py-8 relative" style={{ borderColor: BORDER }}>
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
                <span className="text-[11px] font-mono cursor-pointer transition-colors hover:opacity-80" style={{ color: DIM }}>
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
