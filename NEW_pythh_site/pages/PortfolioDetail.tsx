/**
 * Portfolio Company Detail — /portfolio/:startupId
 *
 * Full dossier: GOD score, health tier, MOIC, pillar scorecard,
 * signal timeline, deal positioning, and entry rationale.
 *
 * Data: /api/portfolio/:startupId  +  /api/intelligence/positioning/:startupId
 */

import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { Helmet } from "react-helmet-async";
import {
  ArrowLeft, ExternalLink, TrendingUp, Users, Target,
  Package, Activity, ChevronRight,
} from "lucide-react";
import SharedNavbar from "@/components/SharedNavbar";
import InlineMeta from "@/components/design/InlineMeta";
import StatStrip from "@/components/design/StatStrip";
import {
  G, CYAN, AMBER, MUTED, DIM, BORDER, CARD, PAGE, TEXT,
  tierColor, tierLabel, moicColor, deltaColor, godScoreColor,
} from "@/lib/designTokens";

// ── Types ─────────────────────────────────────────────────────────────────────
interface PortfolioEntry {
  id: string;
  startup_id: string;
  startup_name: string;
  tagline?: string;
  website?: string;
  sectors?: string[];
  entry_date: string;
  entry_stage?: string;
  entry_god_score: number;
  current_god_score?: number;
  entry_valuation_usd?: number;
  current_valuation_usd?: number;
  virtual_check_usd: number;
  status: string;
  moic?: number;
  irr_annualized?: number;
  holding_days?: number;
  entry_rationale?: string;
  notes?: string;
  health_tier?: string;
  god_delta?: number;
  sector_god_percentile?: number;
  pillar_spread?: number;
  pillar_min?: number;
  events_last_180d?: number;
  days_since_last_event?: number;
  maturity_level?: string;
  maturity_score?: number;
  maturity_gaps?: string[];
  goldilocks_alignment?: string;
  goldilocks_maturity_gap?: number;
  in_goldilocks_god_zone?: boolean;
  exit_propensity_score?: number;
  exit_propensity_tier?: string;
  exit_propensity_confidence?: number;
  team_score?: number;
  traction_score?: number;
  market_score?: number;
  product_score?: number;
  latest_round_type?: string;
  latest_round_post_money?: number;
  latest_lead_investor?: string;
  total_rounds_tracked?: number;
}

interface PortfolioEvent {
  id: string;
  event_type: string;
  event_date: string;
  amount_usd?: number;
  round_type?: string;
  lead_investor?: string;
  headline?: string;
  god_score_before?: number;
  god_score_after?: number;
  verified?: boolean;
}

interface DealPositioning {
  thesis_alignment: number;
  sector_fit: string;
  stage_fit: string;
  positioning_angle: string;
  key_signals: string[];
  suggested_subject: string;
  suggested_opening: string;
  investors?: { id: string; name: string; firm?: string; url?: string };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtUSD(n?: number | null) {
  if (!n) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${(n / 1e3).toFixed(0)}K`;
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function PillarBar({ label, score, icon: Icon, barColor }: { label: string; score?: number; icon: React.ElementType; barColor: string }) {
  const s = score ?? 0;
  const textColor = godScoreColor(s);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5" style={{ color: DIM }}>
          <Icon size={11} />{label}
        </span>
        <span className="font-semibold font-mono tabular-nums" style={{ color: textColor }}>{s}</span>
      </div>
      <div className="h-px overflow-hidden" style={{ backgroundColor: "oklch(0.22 0.01 264)" }}>
        <div className="h-full" style={{ width: `${s}%`, backgroundColor: barColor }} />
      </div>
    </div>
  );
}

function eventLabel(type: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    funding_round: { label: "Funding", color: G },
    god_score_change: { label: "GOD score", color: CYAN },
    acquisition: { label: "Acquisition", color: MUTED },
    ipo: { label: "IPO", color: G },
    revenue_milestone: { label: "Revenue", color: G },
    product_launch: { label: "Launch", color: CYAN },
    team_milestone: { label: "Team", color: MUTED },
    prediction_hit: { label: "Prediction", color: AMBER },
  };
  return map[type] || { label: type.replace(/_/g, " "), color: MUTED };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function PortfolioDetail() {
  const params = useParams<{ startupId: string }>();
  const startupId = params?.startupId;

  const [entry, setEntry]       = useState<PortfolioEntry | null>(null);
  const [events, setEvents]     = useState<PortfolioEvent[]>([]);
  const [positioning, setPos]   = useState<DealPositioning[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [posExpanded, setPosExp] = useState(false);

  useEffect(() => {
    if (!startupId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/portfolio/${startupId}`).then((r) => r.json()),
      fetch(`/api/intelligence/positioning/${startupId}`).then((r) => r.json()).catch(() => ({ positioning: [] })),
    ])
      .then(([detail, pos]) => {
        setEntry(detail.entry || null);
        setEvents(detail.events || []);
        setPos(pos.positioning || []);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [startupId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: PAGE }}>
        <div className="flex flex-col items-center gap-3" style={{ color: DIM }}>
          <Activity size={24} className="animate-pulse" style={{ color: G }} />
          <span className="text-sm font-mono">Loading portfolio data…</span>
        </div>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: PAGE }}>
        <SharedNavbar activePath="/portfolio" />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <p className="mb-4 text-sm font-mono" style={{ color: AMBER }}>{error || "Company not found"}</p>
            <Link href="/portfolio" className="text-sm font-mono flex items-center gap-1 justify-center transition-colors" style={{ color: G }}>
              <ArrowLeft size={13} /> Back to portfolio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const delta = entry.god_delta ?? 0;
  const tier = entry.health_tier || "core";
  const moic = entry.moic ?? 1;
  const moicClr = moicColor(moic);

  const headerMeta = [
    { text: tierLabel(tier), color: tierColor(tier) },
    entry.entry_stage ? { text: entry.entry_stage, color: MUTED } : { text: "" },
    {
      text:
        entry.current_god_score != null && entry.current_god_score !== entry.entry_god_score
          ? `GOD ${entry.entry_god_score} → ${entry.current_god_score}`
          : `GOD ${entry.entry_god_score}`,
      color: G,
    },
    { text: `picked ${fmtDate(entry.entry_date)}` },
  ];

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE, color: "oklch(0.94 0.005 264)" }}>
      <Helmet>
        <title>{entry.startup_name} — Oracle Portfolio</title>
      </Helmet>

      <SharedNavbar activePath="/portfolio" />

      <main className="container max-w-5xl pt-24 pb-20 px-4 sm:px-6 space-y-8">
        <Link
          href="/portfolio"
          className="inline-flex items-center gap-1.5 text-xs font-mono transition-colors"
          style={{ color: DIM }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = G; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = DIM; }}
        >
          <ArrowLeft size={12} /> Portfolio
        </Link>

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-8 border-b" style={{ borderColor: BORDER }}>
          <div className="min-w-0 space-y-2">
            <h1 className="text-3xl font-display font-bold tracking-tight">{entry.startup_name}</h1>
            <InlineMeta items={headerMeta} />
            {entry.tagline && (
              <p className="text-sm max-w-xl leading-relaxed" style={{ color: MUTED }}>{entry.tagline}</p>
            )}
            <InlineMeta
              items={[
                ...(entry.sectors ?? []).map((s) => ({ text: s, color: CYAN })),
                entry.website
                  ? { text: entry.website.replace(/^https?:\/\//, ""), color: MUTED }
                  : { text: "" },
              ]}
            />
            {entry.website && (
              <a
                href={entry.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-mono transition-colors"
                style={{ color: MUTED }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = CYAN; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = MUTED; }}
              >
                Visit <ExternalLink size={10} />
              </a>
            )}
          </div>

          <div className="md:text-right shrink-0">
            <div className="text-4xl font-bold font-mono tabular-nums tracking-tight" style={{ color: moicClr }}>
              {moic.toFixed(2)}×
            </div>
            <div className="text-[10px] font-mono uppercase tracking-widest mt-1" style={{ color: DIM }}>MOIC</div>
            {entry.irr_annualized != null && (
              <div className="text-xs font-mono mt-1" style={{ color: DIM }}>
                IRR {(entry.irr_annualized * 100).toFixed(1)}%
              </div>
            )}
          </div>
        </div>

        {entry.goldilocks_alignment === "thin_signals" && (
          <p className="text-xs font-mono border-l-2 pl-3" style={{ color: AMBER, borderColor: `${AMBER}66` }}>
            Goldilocks: maturity signals thin vs. entry GOD score — review traction data freshness.
          </p>
        )}
        {entry.goldilocks_alignment === "ahead_of_god" && (
          <p className="text-xs font-mono border-l-2 pl-3" style={{ color: CYAN, borderColor: `${CYAN}66` }}>
            Maturity trajectory runs ahead of raw GOD score — richer signal history than the headline number.
          </p>
        )}

        {/* Stats strip */}
        <StatStrip
          cols={4}
          compact
          items={[
            {
              label: "GOD score",
              value: String(entry.current_god_score ?? entry.entry_god_score),
              sub: delta !== 0 ? `Δ ${delta > 0 ? "+" : ""}${delta} since entry` : "no change",
              color: deltaColor(delta),
            },
            { label: "Entry GOD", value: String(entry.entry_god_score), sub: fmtUSD(entry.entry_valuation_usd), color: TEXT },
            { label: "Current val", value: fmtUSD(entry.current_valuation_usd), sub: `entry ${fmtUSD(entry.entry_valuation_usd)}`, color: TEXT },
            {
              label: "Exit propensity",
              value: entry.exit_propensity_score ? `${entry.exit_propensity_score}` : "—",
              sub: entry.exit_propensity_tier || "—",
              color: entry.exit_propensity_score && entry.exit_propensity_score >= 80 ? G : MUTED,
            },
          ]}
        />

        {(entry.team_score != null || entry.traction_score != null) && (
          <section className="rounded-xl border px-5 py-6" style={{ backgroundColor: CARD, borderColor: BORDER }}>
            <h2 className="text-[10px] font-mono uppercase tracking-widest mb-4" style={{ color: G }}>Pillar scorecard</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <PillarBar label="Team" score={entry.team_score} icon={Users} barColor={CYAN} />
              <PillarBar label="Traction" score={entry.traction_score} icon={TrendingUp} barColor={G} />
              <PillarBar label="Market" score={entry.market_score} icon={Target} barColor={AMBER} />
              <PillarBar label="Product" score={entry.product_score} icon={Package} barColor={MUTED} />
            </div>
            {entry.pillar_spread != null && (
              <InlineMeta
                items={[
                  { text: `pillar spread ${entry.pillar_spread} pts`, color: entry.pillar_spread > 40 ? AMBER : MUTED },
                  entry.sector_god_percentile != null ? { text: `sector ${entry.sector_god_percentile.toFixed(0)}th pct` } : { text: "" },
                  entry.maturity_score != null ? { text: `maturity ${entry.maturity_score}` } : { text: "" },
                ]}
              />
            )}
          </section>
        )}

        <section className="rounded-xl border px-5 py-6" style={{ backgroundColor: CARD, borderColor: BORDER }}>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[10px] font-mono uppercase tracking-widest" style={{ color: G }}>Signal timeline</h2>
            <span className="text-[10px] font-mono" style={{ color: DIM }}>{events.length} events</span>
          </div>
          {events.length === 0 ? (
            <p className="text-sm" style={{ color: MUTED }}>
              No portfolio events logged yet.
            </p>
          ) : (
            <div className="space-y-4">
              {events.map((ev) => {
                const evCfg = eventLabel(ev.event_type);
                return (
                  <div key={ev.id} className="border-b last:border-b-0 pb-4 last:pb-0" style={{ borderColor: BORDER }}>
                    <InlineMeta
                      items={[
                        { text: evCfg.label, color: evCfg.color },
                        { text: fmtDate(ev.event_date) },
                        ev.verified ? { text: "verified", color: G } : { text: "" },
                      ]}
                    />
                    <p className="text-sm mt-1" style={{ color: MUTED }}>{ev.headline || ev.round_type}</p>
                    <InlineMeta
                      items={[
                        ev.amount_usd ? { text: fmtUSD(ev.amount_usd) } : { text: "" },
                        ev.lead_investor ? { text: `led by ${ev.lead_investor}` } : { text: "" },
                        ev.god_score_before != null && ev.god_score_after != null
                          ? { text: `GOD ${ev.god_score_before} → ${ev.god_score_after}`, color: G }
                          : { text: "" },
                      ]}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {positioning.length > 0 && (
          <section className="rounded-xl border px-5 py-6" style={{ backgroundColor: CARD, borderColor: BORDER }}>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-[10px] font-mono uppercase tracking-widest" style={{ color: G }}>
                Deal positioning · {positioning.length} investors
              </h2>
              <button
                type="button"
                onClick={() => setPosExp((x) => !x)}
                className="text-xs font-mono bg-transparent border-0 p-0 cursor-pointer transition-colors"
                style={{ color: G }}
              >
                {posExpanded ? "Show less" : "Show all"}
              </button>
            </div>
            <div className="space-y-0">
              {(posExpanded ? positioning : positioning.slice(0, 3)).map((pos, i) => {
                const alignColor =
                  pos.thesis_alignment >= 70 ? G : pos.thesis_alignment >= 50 ? AMBER : MUTED;
                return (
                  <div key={i} className="py-4 border-b last:border-b-0" style={{ borderColor: BORDER }}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                      <span className="text-sm font-medium">
                        {pos.investors?.name || "Investor"}
                        {pos.investors?.firm && (
                          <span className="font-normal ml-2 text-xs font-mono" style={{ color: DIM }}>{pos.investors.firm}</span>
                        )}
                      </span>
                      <InlineMeta
                        items={[
                          { text: `${pos.thesis_alignment}% thesis`, color: alignColor },
                          { text: `${pos.sector_fit} / ${pos.stage_fit}` },
                        ]}
                      />
                    </div>
                    {pos.positioning_angle && (
                      <p className="text-sm mt-1" style={{ color: MUTED }}>{pos.positioning_angle}</p>
                    )}
                    {pos.suggested_subject && (
                      <p className="text-xs font-mono mt-2" style={{ color: DIM }}>
                        Subject: <span style={{ color: MUTED }}>{pos.suggested_subject}</span>
                      </p>
                    )}
                    {pos.key_signals?.length > 0 && (
                      <p className="text-xs font-mono mt-2" style={{ color: DIM }}>
                        {pos.key_signals.map((sig, j) => (
                          <span key={j}>
                            {j > 0 && " · "}
                            <span style={{ color: G }}>{sig}</span>
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {(entry.entry_rationale || entry.notes) && (
          <section className="rounded-xl border px-5 py-6" style={{ backgroundColor: CARD, borderColor: BORDER }}>
            <h2 className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: G }}>Entry rationale</h2>
            <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{entry.entry_rationale}</p>
            {entry.notes && <p className="text-xs font-mono mt-2" style={{ color: DIM }}>{entry.notes}</p>}
          </section>
        )}

        <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: BORDER }}>
          <Link href="/portfolio" className="text-sm font-mono flex items-center gap-1 transition-colors" style={{ color: DIM }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = G; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = DIM; }}
          >
            <ArrowLeft size={13} /> Back to portfolio
          </Link>
          <Link href="/rankings" className="text-sm font-mono flex items-center gap-1 transition-colors" style={{ color: DIM }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = G; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = DIM; }}
          >
            Rankings <ChevronRight size={13} />
          </Link>
        </div>

      </main>
    </div>
  );
}
