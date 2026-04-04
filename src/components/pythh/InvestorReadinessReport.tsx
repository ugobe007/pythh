/**
 * Shared Investor Readiness Report Component
 * Used by both SubmitStartupPage and SignalMatches
 * Renders the same report view using /api/preview data
 */

import { Link } from 'react-router-dom';
import { Flame, ChevronRight, Lock, TrendingUp, Target, Lightbulb, Users, Zap, BarChart2 } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://localhost:3002' : '');

// ─── Types ─────────────────────────────────────────────────────────────────

interface ScoreComponents { team: number; traction: number; market: number; product: number; vision: number; }
interface Investor { id: string; name: string; firm: string; title?: string; sectors?: string[] | string; stage?: string[] | string; check_size_min?: number; check_size_max?: number; investor_tier?: string; photo_url?: string; }
interface Match { match_score: number; why_you_match?: string; investor: Investor; }
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
    /** Coalesced for display: column + pitch + extracted_data narrative fields */
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
  if (Array.isArray(v)) return v.slice(0, 3);
  try { return JSON.parse(v).slice(0, 3); } catch { return [v]; }
}
function fmtMoney(n?: number) {
  if (!n) return '';
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(0)}M` : `$${(n / 1_000).toFixed(0)}K`;
}

// ─── Derived insights from score components ─────────────────────────────────

const COMPONENT_INSIGHTS: Record<keyof ScoreComponents, { label: string; icon: typeof Flame; weak: string; step: string }> = {
  team: {
    label: 'Team',
    icon: Users,
    weak: "Investors can't verify your team's credibility from public signals. Add LinkedIn profiles, prior exits, and relevant domain experience to your site.",
    step: 'Update your website and LinkedIn to clearly show founder backgrounds, prior exits, and domain expertise.',
  },
  traction: {
    label: 'Traction',
    icon: TrendingUp,
    weak: "Traction signals are thin — no ARR, customer count, or growth metrics detected. This is the #1 reason investors pass at early meetings.",
    step: 'Publish a case study or press release mentioning specific metrics: customers, revenue, or growth rate.',
  },
  market: {
    label: 'Market',
    icon: BarChart2,
    weak: "Market size and opportunity aren't clearly articulated in public content. VCs want to see a credible TAM narrative before taking a meeting.",
    step: 'Add a clear market slide or one-liner to your site: "$Xbn TAM, growing Y% YoY, captured Z% = $W ARR potential."',
  },
  product: {
    label: 'Product',
    icon: Zap,
    weak: "Product differentiation isn't clear from public signals. What makes your solution uniquely defensible?",
    step: 'Write a short "Why us?" page section explaining your technical moat, IP, or unique insight.',
  },
  vision: {
    label: 'Vision',
    icon: Lightbulb,
    weak: "Long-term vision and strategic narrative are weak. Investors back missionaries, not mercenaries.",
    step: "Publish a founder's note or blog post on why you're building this and where the company is in 5 years.",
  },
};

function getWeakComponents(c: ScoreComponents): (keyof ScoreComponents)[] {
  return (Object.entries(c) as [keyof ScoreComponents, number][])
    .sort((a, b) => a[1] - b[1])
    .slice(0, 2)
    .map(([k]) => k);
}

// Meeting success rate: calibrated tiers
function meetingSuccessRate(godScore: number, topMatchAvg: number): number {
  const base = godScore >= 70 ? 74 : godScore >= 60 ? 62 : godScore >= 50 ? 48 : godScore >= 40 ? 34 : 22;
  const boost = topMatchAvg >= 80 ? 8 : topMatchAvg >= 70 ? 4 : 0;
  return Math.min(base + boost, 91);
}

// ─── Sub-components ────────────────────────────────────────────────────────

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? '#34d399' : score >= 55 ? '#22d3ee' : score >= 40 ? '#fbbf24' : '#71717a';
  const r = 52; const arcLen = Math.PI * r;
  const dash = (Math.min(score, 100) / 100) * arcLen;
  return (
    <div className="flex flex-col items-center">
      <svg width="128" height="72" viewBox="0 0 128 72">
        <path d="M 12,64 A 52,52 0 0 1 116,64" fill="none" stroke="#27272a" strokeWidth="10" strokeLinecap="round" />
        <path d="M 12,64 A 52,52 0 0 1 116,64" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash} ${arcLen}`} style={{ filter: `drop-shadow(0 0 6px ${color}88)` }} />
      </svg>
      <div className="text-4xl font-bold -mt-6" style={{ color }}>{score}</div>
      <div className="text-xs text-zinc-500 mt-1 font-mono tracking-widest uppercase">GOD Score</div>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-zinc-400">{label}</span>
        <span className={scoreColor(value)}>{value}</span>
      </div>
      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-1.5 rounded-full transition-all duration-700 ${barColor(value)}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

function MatchCard({ match, rank, blurred }: { match: Match; rank: number; blurred?: boolean }) {
  const { investor, match_score } = match;
  const sectors = formatSectors(investor.sectors);
  const check = investor.check_size_min || investor.check_size_max
    ? `${fmtMoney(investor.check_size_min)}${investor.check_size_max ? `–${fmtMoney(investor.check_size_max)}` : '+'}`
    : null;
  return (
    <div className={`relative rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 transition-all ${blurred ? 'blur-[6px] select-none pointer-events-none' : ''}`}>
      <div className="absolute -top-2.5 -left-2.5 w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-400">{rank}</div>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-3 min-w-0">
          {investor.photo_url
            ? <img src={investor.photo_url} className="w-9 h-9 rounded-full object-cover border border-zinc-700 flex-shrink-0" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            : <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center flex-shrink-0 text-sm font-bold text-zinc-300">{(investor.firm || investor.name || '?').charAt(0).toUpperCase()}</div>
          }
          <div className="min-w-0">
            <div className="font-semibold text-white text-sm truncate">{investor.firm || investor.name}</div>
            {investor.firm && investor.name && <div className="text-xs text-zinc-500 truncate">{investor.name}{investor.title ? ` · ${investor.title}` : ''}</div>}
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className={`text-base font-bold ${scoreColor(match_score)}`}>{match_score}%</div>
          <div className="text-[10px] text-zinc-600">match</div>
        </div>
      </div>
      <div className="w-full h-1 bg-zinc-800 rounded-full mb-2.5">
        <div className={`h-1 rounded-full ${barColor(match_score)}`} style={{ width: `${match_score}%` }} />
      </div>
      <div className="flex flex-wrap gap-1">
        {investor.investor_tier === 'tier_1' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">Tier 1</span>}
        {sectors.map(s => <span key={s} className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700">{s}</span>)}
        {check && <span className="px-1.5 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{check}</span>}
      </div>
      {match.why_you_match && !blurred && (
        <p className="mt-2 text-[11px] text-zinc-600 leading-relaxed line-clamp-2">"{match.why_you_match}"</p>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

interface InvestorReadinessReportProps {
  report: ReportData;
  showFooter?: boolean;
  onReset?: () => void;
}

export default function InvestorReadinessReport({ report, showFooter = false, onReset }: InvestorReadinessReportProps) {
  const { startup, matches, total_matches } = report;
  const { score_components: sc } = startup;
  const weakKeys = getWeakComponents(sc);
  const topAvg = matches.slice(0, 3).reduce((s, m) => s + m.match_score, 0) / Math.max(matches.slice(0, 3).length, 1);
  const successRate = meetingSuccessRate(startup.god_score, topAvg);
  const signupUrl = `/signup?ref=report&startup=${startup.id}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-xs font-mono tracking-[0.2em] text-emerald-500/60 uppercase mb-2">Investor Readiness Report</p>
        <h1 className="text-3xl font-bold text-white">{startup.name}</h1>
        {startup.tagline && <p className="text-zinc-500 text-sm mt-1">{startup.tagline}</p>}
        {startup.description && (
          <div className="max-w-2xl mx-auto mt-4">
            <p className="text-zinc-400 text-sm leading-relaxed">{startup.description}</p>
          </div>
        )}
        {startup.website && (
          <a href={startup.website.startsWith('http') ? startup.website : `https://${startup.website}`}
             target="_blank" rel="noopener noreferrer"
             className="text-cyan-400 hover:text-cyan-300 text-xs mt-2 inline-block">
            {startup.website.replace(/^https?:\/\//, '').replace(/\/$/, '')} ↗
          </a>
        )}
        <p className="text-zinc-600 text-xs mt-2">Top {100 - startup.percentile}% of all startups on pythh</p>
      </div>

      {/* GOD Score + Components */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex flex-col sm:flex-row items-center gap-8">
          <div className="flex-shrink-0">
            <ScoreGauge score={startup.god_score} />
          </div>
          <div className="flex-1 w-full space-y-3">
            <ScoreBar label="Team" value={sc.team} />
            <ScoreBar label="Traction" value={sc.traction} />
            <ScoreBar label="Market" value={sc.market} />
            <ScoreBar label="Product" value={sc.product} />
            <ScoreBar label="Vision" value={sc.vision} />
          </div>
        </div>
      </div>

      {/* Signal Score + Components */}
      {startup.signal_score != null && startup.signal_score > 0 && (
        <div className="rounded-2xl border border-cyan-500/20 bg-zinc-900/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-cyan-400" />
            <h2 className="text-sm font-semibold text-white">Signal Score</h2>
            <span className="text-xs text-zinc-600 ml-auto">Market intelligence layer</span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <div className="flex-shrink-0 text-center">
              <div className="text-5xl font-bold text-cyan-400" style={{ filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.4))' }}>
                {startup.signal_score.toFixed(1)}
              </div>
              <div className="text-xs text-zinc-600 mt-1 font-mono tracking-widest uppercase">/ 10</div>
            </div>
            {startup.signal_components && (
              <div className="flex-1 w-full space-y-3">
                <ScoreBar label="Founder Language Shift" value={(startup.signal_components.founder_language_shift / 2.0) * 100} />
                <ScoreBar label="Investor Receptivity" value={(startup.signal_components.investor_receptivity / 2.5) * 100} />
                <ScoreBar label="News Momentum" value={(startup.signal_components.news_momentum / 1.5) * 100} />
                <ScoreBar label="Capital Convergence" value={(startup.signal_components.capital_convergence / 2.0) * 100} />
                <ScoreBar label="Execution Velocity" value={(startup.signal_components.execution_velocity / 2.0) * 100} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Focus Areas */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Where to Focus Before Outreach</h2>
        </div>
        <div className="space-y-4">
          {weakKeys.map((key) => {
            const insight = COMPONENT_INSIGHTS[key];
            const Icon = insight.icon;
            return (
              <div key={key} className="flex gap-3">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-amber-400" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-amber-400 mb-0.5">{insight.label} · Score {sc[key]}</div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{insight.weak}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Investor Matches */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-white">Top Investor Matches</h2>
          </div>
          <span className="text-xs text-zinc-600">{total_matches} total matches found</span>
        </div>
        <div className="space-y-3">
          {matches.slice(0, 5).map((m, i) => (
            <MatchCard key={m.investor.id} match={m} rank={i + 1} blurred={false} />
          ))}
        </div>
        <div className="relative mt-4 rounded-xl border border-orange-500/20 bg-gradient-to-b from-zinc-900/80 to-zinc-950/80 p-5 text-center"
          style={{ boxShadow: '0 0 40px rgba(249,115,22,0.08)' }}>
          <Lock className="w-5 h-5 text-orange-400/60 mx-auto mb-2" />
          <p className="text-white text-sm font-semibold mb-1">Unlock all {total_matches} investor matches</p>
          <p className="text-zinc-500 text-xs mb-3">See full profiles, contact intel, and outreach templates tailored to your GOD score.</p>
          <a href={signupUrl}
            className="inline-flex items-center gap-2 px-5 py-2.5 border border-orange-500/60 text-orange-400 hover:border-orange-400 hover:text-orange-300 font-semibold rounded-xl transition text-sm"
            style={{ boxShadow: '0 0 20px rgba(249,115,22,0.15)' }}>
            Get Full Access <ChevronRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Meeting Success Forecast */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">Meeting Success Forecast</h2>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0 text-center">
            <div className="text-5xl font-bold text-cyan-400" style={{ filter: 'drop-shadow(0 0 12px rgba(34,211,238,0.4))' }}>{successRate}%</div>
            <div className="text-xs text-zinc-600 mt-1 font-mono">estimated response rate</div>
          </div>
          <div className="flex-1 space-y-2">
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-2 bg-cyan-500 rounded-full transition-all duration-1000" style={{ width: `${successRate}%`, filter: 'drop-shadow(0 0 4px rgba(34,211,238,0.5))' }} />
            </div>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Based on {total_matches} matched investors in your category — startups scoring {
                startup.god_score >= 70 ? '70+' : startup.god_score >= 60 ? '60–69' : startup.god_score >= 50 ? '50–59' : '40–49'
              } on the GOD Algorithm receive positive responses at this rate with a warm intro or fit-specific cold email.
            </p>
          </div>
        </div>
      </div>

      {/* Next Steps */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Your Next 3 Steps</h2>
        </div>
        <ol className="space-y-3">
          {weakKeys.slice(0, 2).map((key, i) => (
            <li key={key} className="flex gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-400 flex-shrink-0 mt-0.5">{i + 1}</div>
              <p className="text-xs text-zinc-400 leading-relaxed">{COMPONENT_INSIGHTS[key].step}</p>
            </li>
          ))}
          <li className="flex gap-3">
            <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-400 flex-shrink-0 mt-0.5">3</div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Reach out to your top {Math.min(total_matches, 5)} matches via warm intros. Reference their specific thesis and why your signals align — generic cold emails are ignored.
            </p>
          </li>
        </ol>
      </div>

      {/* Bottom CTA */}
      <div className="rounded-2xl border border-orange-500/20 bg-zinc-950 p-6 text-center" style={{ boxShadow: '0 0 60px rgba(249,115,22,0.06)' }}>
        <p className="text-white font-semibold mb-1">Ready to move fast?</p>
        <p className="text-zinc-500 text-xs mb-4">Create a free account to track your score, get alerted when new investors match, and access outreach templates.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href={signupUrl}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-orange-500/60 text-orange-400 hover:border-orange-400 hover:text-orange-300 font-semibold rounded-xl transition text-sm"
            style={{ boxShadow: '0 0 20px rgba(249,115,22,0.15)' }}>
            Create Free Account <ChevronRight className="w-4 h-4" />
          </a>
          {onReset && (
            <button onClick={onReset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400 rounded-xl transition text-sm">
              Analyze Another Startup
            </button>
          )}
        </div>
      </div>

      {showFooter && (
        <footer className="border-t border-white/5 px-6 py-6 text-center text-xs text-zinc-700">
          <p>© {new Date().getFullYear()} pythh.ai — Signal science for founders.</p>
          <div className="mt-2"><Link to="/admin-login" className="text-zinc-800 hover:text-zinc-600 transition">admin</Link></div>
        </footer>
      )}
    </div>
  );
}
