/**
 * Investor Readiness Report — /submit + share previews
 * Value-first: signal + GOD context, company narrative, top matches (unlocked),
 * Oracle-style next steps. Supabase-adjacent: hairline borders, dense type, tables.
 */

import { Link } from 'react-router-dom';
import {
  Flame,
  ChevronRight,
  TrendingUp,
  Target,
  Lightbulb,
  Users,
  Zap,
  BarChart2,
  Activity,
  ExternalLink,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface ScoreComponents {
  team: number;
  traction: number;
  market: number;
  product: number;
  vision: number;
}
interface Investor {
  id?: string;
  name: string;
  firm: string;
  title?: string;
  sectors?: string[] | string;
  stage?: string[] | string;
  check_size_min?: number;
  check_size_max?: number;
  investor_tier?: string;
  photo_url?: string;
}
interface Match {
  match_score: number;
  why_you_match?: string;
  /** Present on API payloads; use if embedded `investor` omits id */
  investor_id?: string;
  investor: Investor;
}
interface SignalComponents {
  founder_language_shift: number;
  investor_receptivity: number;
  news_momentum: number;
  capital_convergence: number;
  execution_velocity: number;
}

export interface ReportData {
  startup: {
    id: string;
    name: string;
    tagline?: string;
    description?: string;
    extracted_data?: Record<string, unknown> | null;
    website?: string;
    sectors?: string[];
    stage?: number | string | null;
    god_score: number;
    signal_score?: number;
    score_components: ScoreComponents;
    signal_components?: SignalComponents | null;
    percentile: number;
  };
  total_matches: number;
  matches: Match[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function scoreColor(s: number) {
  if (s >= 70) return 'text-emerald-400';
  if (s >= 55) return 'text-cyan-400';
  if (s >= 40) return 'text-amber-400';
  return 'text-zinc-500';
}
function barColor(s: number) {
  if (s >= 70) return 'bg-emerald-500';
  if (s >= 55) return 'bg-cyan-500';
  if (s >= 40) return 'bg-amber-500';
  return 'bg-zinc-600';
}
function formatSectors(v: string[] | string | undefined): string[] {
  if (!v) return [];
  if (Array.isArray(v)) return v.slice(0, 4);
  try {
    return JSON.parse(v).slice(0, 4);
  } catch {
    return [v];
  }
}
function fmtMoney(n?: number) {
  if (!n) return '';
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(0)}M` : `$${(n / 1_000).toFixed(0)}K`;
}

/** Signal sub-scores are ~0–2.5 from the API; normalize to bar width */
function signalBarPct(v: number) {
  return Math.min(100, (v / 2.5) * 100);
}

/** `signals_total` is 0–10, but low values read like a bad “rating”; show words until composite is solid */
const SIGNAL_HEADLINE_NUMERIC_MIN = 5;

const COMPONENT_INSIGHTS: Record<
  keyof ScoreComponents,
  { label: string; icon: typeof Users; weak: string; step: string }
> = {
  team: {
    label: 'Team',
    icon: Users,
    weak: "Investors can't verify your team's credibility from public signals.",
    step: 'Surface founder backgrounds, exits, and domain expertise on site + LinkedIn.',
  },
  traction: {
    label: 'Traction',
    icon: TrendingUp,
    weak: 'Thin traction signals — metrics move the needle in first meetings.',
    step: 'Publish one concrete metric: customers, revenue, or growth.',
  },
  market: {
    label: 'Market',
    icon: BarChart2,
    weak: 'TAM / urgency narrative is easy to tighten from public content.',
    step: 'Add a one-line market + why-now to your landing page.',
  },
  product: {
    label: 'Product',
    icon: Zap,
    weak: 'Differentiation reads generic without a sharp “why us”.',
    step: 'Add a short moat section: tech, data, or distribution edge.',
  },
  vision: {
    label: 'Vision',
    icon: Lightbulb,
    weak: 'Missionary narrative is underweighted in scraped signals.',
    step: 'Publish a founder note: why you, why now, 5-year arc.',
  },
};

const SIGNAL_INTEL: Record<
  keyof SignalComponents,
  { label: string; hint: string }
> = {
  founder_language_shift: {
    label: 'Founder narrative',
    hint: 'Positioning & story vs. peers — clarity of what you’re building.',
  },
  investor_receptivity: {
    label: 'Investor climate',
    hint: 'How receptive your stage/sector is to new deals right now.',
  },
  news_momentum: {
    label: 'News velocity',
    hint: 'Announcements, press, and funding noise in your space.',
  },
  capital_convergence: {
    label: 'Capital flow',
    hint: 'Money moving into your category — tailwinds for the story.',
  },
  execution_velocity: {
    label: 'Execution',
    hint: 'Shipping cadence & operational signals from public data.',
  },
};

function getWeakComponents(c: ScoreComponents): (keyof ScoreComponents)[] {
  return (Object.entries(c) as [keyof ScoreComponents, number][])
    .sort((a, b) => a[1] - b[1])
    .slice(0, 3)
    .map(([k]) => k);
}

function meetingSuccessRate(godScore: number, topMatchAvg: number): number {
  const base =
    godScore >= 70 ? 74 : godScore >= 60 ? 62 : godScore >= 50 ? 48 : godScore >= 40 ? 34 : 22;
  const boost = topMatchAvg >= 80 ? 8 : topMatchAvg >= 70 ? 4 : 0;
  return Math.min(base + boost, 91);
}

// ─── UI primitives (Supabase-style: hairline, mono, dense) ─────────────────

const panel = 'rounded-lg border border-white/[0.08] bg-[#0a0a0a]';
const labelCaps = 'text-[0.65rem] uppercase tracking-[0.14em] text-zinc-500 font-medium';

function MatchTableRow({
  match,
  rank,
  startupId,
}: {
  match: Match;
  rank: number;
  startupId: string;
}) {
  const { investor, match_score } = match;
  const investorUuid = investor.id || match.investor_id;
  const sectors = formatSectors(investor.sectors);
  const check =
    investor.check_size_min || investor.check_size_max
      ? `${fmtMoney(investor.check_size_min)}${
          investor.check_size_max ? `–${fmtMoney(investor.check_size_max)}` : '+'
        }`
      : null;
  const to =
    investorUuid &&
    `/investor/${encodeURIComponent(investorUuid)}?startup=${encodeURIComponent(startupId)}`;

  const rowInner = (
    <>
      <div className="col-span-1 text-zinc-600 font-mono text-xs pt-0.5">{rank}</div>
      <div className="col-span-5 min-w-0">
        <div className="text-zinc-100 font-medium truncate group-hover:text-white">
          {investor.firm || investor.name}
        </div>
        {investor.firm && investor.name && (
          <div className="text-zinc-500 text-xs truncate">
            {investor.name}
            {investor.title ? ` · ${investor.title}` : ''}
          </div>
        )}
        <div className="flex flex-wrap gap-1 mt-1">
          {sectors.slice(0, 3).map((s) => (
            <span
              key={s}
              className="text-[10px] px-1.5 py-0 rounded border border-white/[0.06] text-zinc-500"
            >
              {s}
            </span>
          ))}
          {check && (
            <span className="text-[10px] px-1.5 py-0 rounded border border-cyan-500/20 text-cyan-500/80">
              {check}
            </span>
          )}
        </div>
      </div>
      <div className="col-span-2 text-right font-mono text-zinc-200 pt-0.5">{match_score}%</div>
      <div className="col-span-4 text-zinc-500 text-xs">
        {match.why_you_match ? (
          <span className="line-clamp-3">{match.why_you_match}</span>
        ) : (
          <span className="text-zinc-600 italic">Thesis fit from pythh match engine</span>
        )}
        {to ? (
          <span className="mt-1 block text-[10px] text-cyan-500/70">Open profile · full thesis →</span>
        ) : null}
      </div>
    </>
  );

  const shellClass =
    'group grid grid-cols-12 gap-2 items-start py-2.5 border-b border-white/[0.06] last:border-0 text-[13px] leading-snug rounded-md -mx-1 px-1 transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-cyan-500/40 focus-visible:outline-offset-0 cursor-pointer';

  if (!to) {
    return <div className={shellClass}>{rowInner}</div>;
  }

  return (
    <Link to={to} className={`${shellClass} text-inherit no-underline`}>
      {rowInner}
    </Link>
  );
}

// ─── Props ─────────────────────────────────────────────────────────────────

interface InvestorReadinessReportProps {
  report: ReportData;
  showFooter?: boolean;
  onReset?: () => void;
}

export default function InvestorReadinessReport({
  report,
  showFooter = false,
  onReset,
}: InvestorReadinessReportProps) {
  const { startup, matches, total_matches } = report;
  const sc = startup.score_components;
  const weakKeys = getWeakComponents(sc);
  const topSlice = matches.slice(0, 5);
  const topAvg =
    topSlice.reduce((s, m) => s + m.match_score, 0) / Math.max(topSlice.length, 1);
  const successRate = meetingSuccessRate(startup.god_score, topAvg);
  const signupUrl = `/signup?ref=report&startup=${startup.id}`;
  /** Canonical URL for this readiness report (bookmark + return from investor profile) */
  const reportUrl = `/submit?startup=${encodeURIComponent(startup.id)}`;
  const dashboardUrl = `/signal-matches?startup=${encodeURIComponent(startup.id)}`;

  const signalTotal = startup.signal_score ?? 0;
  const sig = startup.signal_components;
  const hasSignalSubscores = !!(sig && Object.values(sig).some((v) => v > 0));
  const showSignalNumericHeadline = signalTotal >= SIGNAL_HEADLINE_NUMERIC_MIN;
  const signalHeadlineWord = !showSignalNumericHeadline
    ? hasSignalSubscores || signalTotal > 0
      ? 'Partial'
      : 'Calibrating'
    : null;

  return (
    <div className="space-y-4 max-w-5xl mx-auto text-left">
      {/* Top: identity + inline metrics */}
      <div className={`${panel} px-4 py-4`}>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="min-w-0 flex-1">
            <p className={`${labelCaps} text-emerald-500/70 mb-1`}>Investor readiness</p>
            <h1 className="text-xl md:text-2xl font-semibold text-white tracking-tight">
              {startup.name}
            </h1>
            {startup.tagline && (
              <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{startup.tagline}</p>
            )}
            {startup.website && (
              <a
                href={startup.website.startsWith('http') ? startup.website : `https://${startup.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-cyan-400/90 hover:text-cyan-300 mt-2"
              >
                {startup.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                <ExternalLink className="w-3 h-3 opacity-70" />
              </a>
            )}
          </div>
          <div className="flex flex-wrap gap-3 md:justify-end shrink-0">
            <div className="rounded border border-white/[0.08] bg-black/40 px-3 py-2 min-w-[5.5rem]">
              <div className={labelCaps}>Signal</div>
              {showSignalNumericHeadline ? (
                <div className="text-lg font-semibold text-cyan-400 font-mono tabular-nums leading-tight">
                  {signalTotal.toFixed(1)}
                  <span className="text-zinc-600 text-sm font-normal">/10</span>
                </div>
              ) : (
                <>
                  <div className="text-lg font-semibold text-cyan-400 leading-tight font-sans tracking-tight">
                    {signalHeadlineWord}
                  </div>
                  <p className="text-[10px] text-zinc-600 mt-1 leading-snug normal-case tracking-normal font-normal">
                    {signalTotal > 0 && signalTotal < SIGNAL_HEADLINE_NUMERIC_MIN
                      ? 'Composite still building — bars below, no headline yet'
                      : hasSignalSubscores
                        ? 'Headline score when composite is firm'
                        : 'Score appears after enrichment'}
                  </p>
                </>
              )}
            </div>
            <div className="rounded border border-white/[0.08] bg-black/40 px-3 py-2 min-w-[5.5rem]">
              <div className={labelCaps}>GOD</div>
              <div className={`text-lg font-semibold font-mono tabular-nums ${scoreColor(startup.god_score)}`}>
                {startup.god_score}
              </div>
            </div>
            <div className="rounded border border-white/[0.08] bg-black/40 px-3 py-2 min-w-[5.5rem]">
              <div className={labelCaps}>Peer rank</div>
              <div className="text-lg font-semibold text-zinc-200 font-mono tabular-nums">
                Top {100 - startup.percentile}%
              </div>
            </div>
          </div>
        </div>

        {startup.description && (
          <p className="text-sm text-zinc-400 leading-relaxed mt-4 border-t border-white/[0.06] pt-4">
            {startup.description}
          </p>
        )}
        <p className="text-[11px] text-zinc-600 mt-3 leading-snug border-t border-white/[0.06] pt-3">
          Save this report:{' '}
          <Link to={reportUrl} className="text-cyan-500/85 hover:underline font-mono text-[10px] break-all">
            {typeof window !== 'undefined' ? `${window.location.origin}${reportUrl}` : reportUrl}
          </Link>
        </p>
      </div>

      {/* Oracle — next steps (moved up for value) */}
      <div className={`${panel} px-4 py-3`}>
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-3.5 h-3.5 text-emerald-400/90" />
          <span className={`${labelCaps} text-zinc-400`}>Suggested next steps</span>
        </div>
        <ol className="space-y-2">
          {weakKeys.slice(0, 2).map((key, i) => (
            <li key={key} className="flex gap-2 text-sm text-zinc-400 leading-snug">
              <span className="text-emerald-500/80 font-mono text-xs w-5 shrink-0">{i + 1}.</span>
              <span>{COMPONENT_INSIGHTS[key].step}</span>
            </li>
          ))}
          <li className="flex gap-2 text-sm text-zinc-400 leading-snug">
            <span className="text-emerald-500/80 font-mono text-xs w-5 shrink-0">3.</span>
            <span>
              Use your top investor rows below to tailor cold outreach — reference thesis fit, not generic
              praise.
            </span>
          </li>
        </ol>
      </div>

      {/* Top matches — before signal intelligence so “matches first” on scan */}
      <div className={`${panel} px-4 py-3`}>
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-2">
            <Flame className="w-3.5 h-3.5 text-orange-400/90" />
            <span className="text-sm font-medium text-zinc-200">Top investor matches</span>
          </div>
          <span className={`${labelCaps} text-zinc-600`}>{total_matches} in engine</span>
        </div>
        <p className="text-xs text-zinc-600 mb-3">
          Ranked by thesis fit, stage, and sector — same engine as the full product.
        </p>

        {topSlice.length === 0 ? (
          <div className="rounded border border-dashed border-white/[0.12] bg-zinc-950/50 px-3 py-4 text-sm text-zinc-500">
            <p className="mb-2">
              No matches in this preview yet — the matcher may still be running after your URL scan.
            </p>
            <p>
              <Link to={reportUrl} className="text-cyan-500/90 hover:underline">
                Reload your readiness report
              </Link>
              {' · '}
              <Link to={dashboardUrl} className="text-cyan-500/90 hover:underline">
                Open full live matches
              </Link>
              {' '}
              — or wait a minute and try again.
            </p>
          </div>
        ) : (
          <>
            <div className="hidden sm:grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wide text-zinc-600 pb-1 border-b border-white/[0.06]">
              <div className="col-span-1">#</div>
              <div className="col-span-5">Investor</div>
              <div className="col-span-2 text-right">Fit</div>
              <div className="col-span-4">Why you match</div>
            </div>
            {topSlice.map((m, i) => (
              <MatchTableRow
                key={`${m.investor?.id || m.investor_id || i}-${i}`}
                match={m}
                rank={i + 1}
                startupId={startup.id}
              />
            ))}
            {total_matches > 5 && (
              <p className="text-[11px] text-zinc-600 mt-3">
                Showing 5 of {total_matches} ranked matches.
                <Link to={signupUrl} className="text-cyan-500/80 hover:underline ml-1">
                  Create an account
                </Link>{' '}
                to track the full list and get alerts.
              </p>
            )}
          </>
        )}
      </div>

      {/* Signal intelligence — after matches */}
      <div className={`${panel} px-4 py-3`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-cyan-400/90" />
            <span className="text-sm font-medium text-zinc-200">Signals & intelligence</span>
          </div>
          <span className={`${labelCaps} text-zinc-600`}>Live layer on GOD</span>
        </div>
        <p className="text-xs text-zinc-500 leading-relaxed mb-3">
          GOD scores readiness from your site; <span className="text-zinc-400">Signal</span> adds market
          timing, narrative, and sector momentum. Together they drive match ranking.
        </p>
        {sig && (signalTotal > 0 || Object.values(sig).some((v) => v > 0)) ? (
          <div className="space-y-2.5">
            {(Object.keys(SIGNAL_INTEL) as (keyof SignalComponents)[]).map((key) => {
              const v = sig[key] ?? 0;
              const meta = SIGNAL_INTEL[key];
              return (
                <div key={key}>
                  <div className="flex justify-between text-xs gap-2 mb-0.5">
                    <span className="text-zinc-400">{meta.label}</span>
                    {showSignalNumericHeadline ? (
                      <span className="text-zinc-600 font-mono tabular-nums">{v.toFixed(1)}</span>
                    ) : (
                      <span className="text-zinc-600" aria-hidden>
                        ·
                      </span>
                    )}
                  </div>
                  <div className="h-1 w-full bg-zinc-900 rounded overflow-hidden">
                    <div
                      className="h-1 rounded bg-cyan-500/70"
                      style={{ width: `${signalBarPct(v)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-zinc-600 mt-0.5 leading-snug">{meta.hint}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-zinc-600">
            Signal subscores appear once enrichment finishes (usually within a minute of submit).{' '}
            <Link to={reportUrl} className="text-cyan-500/90 hover:underline">
              Reload your report
            </Link>
            {' · '}
            <Link to={dashboardUrl} className="text-cyan-500/90 hover:underline">
              Full match dashboard
            </Link>
            .
          </p>
        )}
      </div>

      {/* GOD — compact breakdown */}
      <div className={`${panel} px-4 py-3`}>
        <div className={`${labelCaps} text-zinc-500 mb-3`}>GOD breakdown · investment readiness</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(['team', 'traction', 'market', 'product', 'vision'] as const).map((k) => (
            <div key={k} className="rounded border border-white/[0.06] bg-black/30 px-2 py-2">
              <div className="text-[10px] uppercase tracking-wide text-zinc-600 mb-1">{COMPONENT_INSIGHTS[k].label}</div>
              <div className={`text-lg font-mono font-semibold ${scoreColor(sc[k])}`}>{sc[k]}</div>
              <div className="h-1 mt-1.5 bg-zinc-900 rounded overflow-hidden">
                <div
                  className={`h-1 rounded ${barColor(sc[k])}`}
                  style={{ width: `${Math.min(sc[k], 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Focus — two columns inline on wide */}
      <div className={`${panel} px-4 py-3`}>
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-3.5 h-3.5 text-amber-400/90" />
          <span className="text-sm font-medium text-zinc-200">Where to tighten</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {weakKeys.slice(0, 2).map((key) => {
            const insight = COMPONENT_INSIGHTS[key];
            return (
              <div key={key} className="text-xs text-zinc-500 leading-relaxed border-l border-amber-500/30 pl-3">
                <span className="text-amber-400/90 font-medium">{insight.label}</span>
                <span className="text-zinc-600"> · {sc[key]} — </span>
                {insight.weak}
              </div>
            );
          })}
        </div>
      </div>

      {/* Forecast — single compact row */}
      <div className={`${panel} px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3`}>
        <div className="flex items-center gap-2 shrink-0">
          <TrendingUp className="w-3.5 h-3.5 text-cyan-400/90" />
          <span className="text-sm font-medium text-zinc-200">Meeting success estimate</span>
        </div>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="text-2xl font-semibold text-cyan-400 font-mono tabular-nums shrink-0">
            {successRate}%
          </span>
          <div className="flex-1 min-w-0">
            <div className="h-1.5 bg-zinc-900 rounded overflow-hidden mb-1">
              <div
                className="h-1.5 bg-cyan-500/80 rounded"
                style={{ width: `${successRate}%` }}
              />
            </div>
            <p className="text-[11px] text-zinc-600 leading-snug">
              Illustrative response rate for startups in the{' '}
              {startup.god_score >= 70 ? '70+' : startup.god_score >= 60 ? '60–69' : startup.god_score >= 50 ? '50–59' : '40–49'}{' '}
              GOD band with warm intros or sharp cold outreach ({total_matches} matches in model).
            </p>
          </div>
        </div>
      </div>

      {/* Footer CTA — single soft conversion */}
      <div className={`${panel} px-4 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3`}>
        <div>
          <p className="text-sm text-zinc-300 font-medium">Start building your investor plan and next steps.</p>
          <p className="text-xs text-zinc-600 mt-0.5">
            Free account — track score changes and new investor fits.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={signupUrl}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-cyan-500/40 text-cyan-400 text-sm font-medium hover:bg-cyan-500/10 transition"
          >
            Create account <ChevronRight className="w-3.5 h-3.5" />
          </a>
          {onReset && (
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center px-4 py-2 rounded-md border border-white/[0.08] text-zinc-500 text-sm hover:text-zinc-400 hover:border-white/[0.12] transition"
            >
              Another URL
            </button>
          )}
        </div>
      </div>

      {showFooter && (
        <footer className="border-t border-white/[0.06] pt-6 text-center text-xs text-zinc-700">
          <p>© {new Date().getFullYear()} pythh.ai — Signal science for founders.</p>
          <div className="mt-2">
            <Link to="/admin-login" className="text-zinc-600 hover:text-zinc-500 transition">
              admin
            </Link>
          </div>
        </footer>
      )}
    </div>
  );
}
