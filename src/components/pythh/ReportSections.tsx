/**
 * ReportSections - Shared components for report-style pages
 * Used by both SubmitStartupPage and SignalMatches for consistency
 */

import { Target, TrendingUp, Lightbulb, Users, Zap, BarChart2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { StartupContext } from '@/lib/pythh-types';

interface ScoreComponents {
  team: number;
  traction: number;
  market: number;
  product: number;
  vision: number;
}

const COMPONENT_INSIGHTS: Record<keyof ScoreComponents, {
  label: string;
  icon: typeof Target;
  weak: string;
  step: string;
}> = {
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

function meetingSuccessRate(godScore: number, topMatchAvg: number): number {
  const base = godScore >= 70 ? 74 : godScore >= 60 ? 62 : godScore >= 50 ? 48 : godScore >= 40 ? 34 : 22;
  const boost = topMatchAvg >= 80 ? 8 : topMatchAvg >= 70 ? 4 : 0;
  return Math.min(base + boost, 91);
}

interface FocusAreasProps {
  context: StartupContext | null;
}

export function FocusAreas({ context }: FocusAreasProps) {
  if (!context) return null;

  const sc: ScoreComponents = {
    team: context.god.team,
    traction: context.god.traction,
    market: context.god.market,
    product: context.god.product,
    vision: context.god.vision,
  };

  const weakKeys = getWeakComponents(sc);

  if (weakKeys.length === 0) return null;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 mb-6">
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
  );
}

interface MeetingSuccessForecastProps {
  context: StartupContext | null;
  topMatchScores: number[];
  totalMatches: number;
}

export function MeetingSuccessForecast({ context, topMatchScores, totalMatches }: MeetingSuccessForecastProps) {
  if (!context || topMatchScores.length === 0) return null;

  const topAvg = topMatchScores.slice(0, 3).reduce((s, m) => s + m, 0) / Math.min(topMatchScores.length, 3);
  const successRate = meetingSuccessRate(context.god.total, topAvg);
  const godScore = context.god.total;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 mb-6">
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
            Based on {totalMatches} matched investors in your category — startups scoring {
              godScore >= 70 ? '70+' : godScore >= 60 ? '60–69' : godScore >= 50 ? '50–59' : '40–49'
            } on the GOD Algorithm receive positive responses at this rate with a warm intro or fit-specific cold email.
          </p>
        </div>
      </div>
    </div>
  );
}

interface NextStepsProps {
  context: StartupContext | null;
  totalMatches: number;
  startupId?: string;
}

export function NextSteps({ context, totalMatches, startupId }: NextStepsProps) {
  if (!context) return null;

  const sc: ScoreComponents = {
    team: context.god.team,
    traction: context.god.traction,
    market: context.god.market,
    product: context.god.product,
    vision: context.god.vision,
  };

  const weakKeys = getWeakComponents(sc);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-4 h-4 text-emerald-400" />
        <h2 className="text-sm font-semibold text-white">Your Next 3 Steps</h2>
      </div>
      <ol className="space-y-3">
        {weakKeys.slice(0, 2).map((key, i) => {
          const insight = COMPONENT_INSIGHTS[key];
          return (
            <li key={key} className="flex gap-3">
              <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-400 flex-shrink-0 mt-0.5">{i + 1}</div>
              <p className="text-xs text-zinc-400 leading-relaxed">{insight.step}</p>
            </li>
          );
        })}
        <li className="flex gap-3">
          <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-400 flex-shrink-0 mt-0.5">3</div>
          <p className="text-xs text-zinc-400 leading-relaxed">
            Reach out to your top {Math.min(totalMatches, 5)} matches via warm intros. Reference their specific thesis and why your signals align — generic cold emails are ignored.
          </p>
        </li>
      </ol>
    </div>
  );
}

interface BottomCTAProps {
  startupId?: string;
}

export function BottomCTA({ startupId }: BottomCTAProps) {
  const signupUrl = startupId ? `/signup?ref=matches&startup=${startupId}` : '/signup?ref=matches';

  return (
    <div className="rounded-2xl border border-orange-500/20 bg-zinc-950 p-6 text-center mb-6" style={{ boxShadow: '0 0 60px rgba(249,115,22,0.06)' }}>
      <p className="text-white font-semibold mb-1">Ready to move fast?</p>
      <p className="text-zinc-500 text-xs mb-4">Create a free account to track your score, get alerted when new investors match, and access outreach templates.</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          to={signupUrl}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-orange-500/60 text-orange-400 hover:border-orange-400 hover:text-orange-300 font-semibold rounded-xl transition text-sm"
          style={{ boxShadow: '0 0 20px rgba(249,115,22,0.15)' }}
        >
          Create Free Account
        </Link>
      </div>
    </div>
  );
}
