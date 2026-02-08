// ============================================================================
// SignalPathDashboard — "This is the way."
// ============================================================================
// Post-match insights panel that shows founders:
//   1. Signal Health — where their signals are strong/weak
//   2. Investor Landscape — what their match pool looks like
//   3. The Path — what to do next based on their specific data
//
// Appears below the match table on /signal-matches.
// All data derived from existing hooks (no extra API calls).
// ============================================================================

import { useMemo } from 'react';
import type { MatchRow, StartupContext } from '@/lib/pythh-types';

// -----------------------------------------------------------------------------
// PROPS
// -----------------------------------------------------------------------------

interface SignalPathDashboardProps {
  context: StartupContext | null;
  rows: MatchRow[];
  startupName: string;
  loading?: boolean;
}

// -----------------------------------------------------------------------------
// ANALYTICS DERIVED FROM EXISTING DATA
// -----------------------------------------------------------------------------

interface MatchAnalytics {
  total: number;
  highFit: number;
  goodFit: number;
  earlyFit: number;
  strongMomentum: number;
  emergingMomentum: number;
  neutralMomentum: number;
  coolingMomentum: number;
  avgSignalScore: number;
  topSignalScore: number;
  unlockedCount: number;
  lockedCount: number;
}

function analyzeMatches(rows: MatchRow[]): MatchAnalytics {
  const stats: MatchAnalytics = {
    total: rows.length,
    highFit: 0, goodFit: 0, earlyFit: 0,
    strongMomentum: 0, emergingMomentum: 0, neutralMomentum: 0, coolingMomentum: 0,
    avgSignalScore: 0, topSignalScore: 0,
    unlockedCount: 0, lockedCount: 0,
  };

  if (rows.length === 0) return stats;

  let signalSum = 0;
  for (const r of rows) {
    // Fit buckets
    if (r.fit_bucket === 'high') stats.highFit++;
    else if (r.fit_bucket === 'good') stats.goodFit++;
    else stats.earlyFit++;

    // Momentum
    if (r.momentum_bucket === 'strong') stats.strongMomentum++;
    else if (r.momentum_bucket === 'emerging') stats.emergingMomentum++;
    else if (r.momentum_bucket === 'neutral') stats.neutralMomentum++;
    else stats.coolingMomentum++;

    // Signal
    signalSum += r.signal_score ?? 0;
    if ((r.signal_score ?? 0) > stats.topSignalScore) stats.topSignalScore = r.signal_score ?? 0;

    // Lock state
    if (r.is_locked) stats.lockedCount++;
    else stats.unlockedCount++;
  }

  stats.avgSignalScore = Math.round((signalSum / rows.length) * 10) / 10;
  return stats;
}

// Generate actionable "path steps" based on the data
interface PathStep {
  order: number;
  title: string;
  detail: string;
  urgency: 'now' | 'soon' | 'later';
  icon: string;
}

function generatePath(
  context: StartupContext | null,
  analytics: MatchAnalytics,
): PathStep[] {
  const steps: PathStep[] = [];
  let order = 1;

  // --- IMMEDIATE ACTIONS ---

  // High-fit investors with strong momentum = outreach NOW
  if (analytics.strongMomentum > 0 || analytics.emergingMomentum > 0) {
    const hot = analytics.strongMomentum + analytics.emergingMomentum;
    steps.push({
      order: order++,
      title: `Reach out to your top ${Math.min(hot, 3)} investors`,
      detail: `${hot} investor${hot > 1 ? 's' : ''} show${hot === 1 ? 's' : ''} active momentum toward your space. Their attention window is open — warm outreach converts best when signals are strong.`,
      urgency: 'now',
      icon: '🎯',
    });
  }

  // Unlock recommendation
  if (analytics.lockedCount > 0 && analytics.unlockedCount < 5) {
    steps.push({
      order: order++,
      title: 'Unlock your next investor profiles',
      detail: `You have ${analytics.lockedCount} matched investors waiting. Unlock 2-3 at a time, review their thesis overlap, and draft a short tailored note.`,
      urgency: 'now',
      icon: '🔓',
    });
  }

  // --- SIGNAL IMPROVEMENT ---

  // Weak GOD components
  if (context?.god) {
    const god = context.god;
    const weakest = [
      { name: 'Team', score: god.team, max: 25 },
      { name: 'Traction', score: god.traction, max: 25 },
      { name: 'Market', score: god.market, max: 20 },
      { name: 'Product', score: god.product, max: 15 },
      { name: 'Vision', score: god.vision, max: 15 },
    ].sort((a, b) => (a.score / a.max) - (b.score / b.max));

    const lowest = weakest[0];
    const lowestPct = Math.round((lowest.score / lowest.max) * 100);

    if (lowestPct < 60) {
      const remedies: Record<string, string> = {
        Team: 'Strengthen your team narrative — highlight complementary expertise, prior exits, or domain depth.',
        Traction: 'Build proof of demand — user growth, revenue milestones, or engagement metrics move this score fastest.',
        Market: 'Sharpen your market thesis — show the timing catalyst and why the TAM is expanding now.',
        Product: 'Demonstrate product-market pull — show customers chose you over alternatives and why.',
        Vision: 'Articulate a bold but credible 10-year vision — investors fund where you\'re going, not just where you are.',
      };

      steps.push({
        order: order++,
        title: `Strengthen your ${lowest.name} signal`,
        detail: `${lowest.name} is your weakest dimension at ${lowestPct}%. ${remedies[lowest.name] || 'Focus on improving this area to unlock stronger matches.'}`,
        urgency: 'soon',
        icon: '📈',
      });
    }

    // Second weakest if also under threshold
    const secondLowest = weakest[1];
    const secondPct = Math.round((secondLowest.score / secondLowest.max) * 100);
    if (secondPct < 50) {
      steps.push({
        order: order++,
        title: `Shore up your ${secondLowest.name} score`,
        detail: `${secondLowest.name} is at ${secondPct}% — bringing both weak areas above 60% dramatically improves match quality.`,
        urgency: 'later',
        icon: '🔧',
      });
    }
  }

  // Signal-specific guidance
  if (context?.signals) {
    const sig = context.signals;
    // Capital convergence is low = investors aren't focused on your space yet
    if (sig.capital_convergence < 1.0) {
      steps.push({
        order: order++,
        title: 'Increase capital convergence',
        detail: 'Investor capital isn\'t flowing to your exact space yet. Consider positioning your narrative closer to an active thesis area, or target investors actively building the category.',
        urgency: 'soon',
        icon: '💰',
      });
    }

    // Investor receptivity low = cold market
    if (sig.investor_receptivity < 1.2) {
      steps.push({
        order: order++,
        title: 'Warm up investor receptivity',
        detail: 'Receptivity in your sector is below median. Build social proof through warm intros, founder networks, or angel syndicates before approaching institutional capital.',
        urgency: 'soon',
        icon: '🌡️',
      });
    }
  }

  // Percentile-based guidance
  if (context?.comparison) {
    const pct = context.comparison.percentile;
    if (pct >= 80) {
      steps.push({
        order: order++,
        title: 'You\'re in the top tier — move fast',
        detail: `Top ${100 - pct}% of startups in your cohort. Your signals are aligned. Don't overthink it — start conversations with your strongest matches this week.`,
        urgency: 'now',
        icon: '⚡',
      });
    } else if (pct < 40) {
      steps.push({
        order: order++,
        title: 'Build signal before outreach',
        detail: 'Your position is developing. Focus on 2-3 concrete wins (users, revenue, partnerships) that shift your GOD score before heavy outreach. Quality over quantity.',
        urgency: 'later',
        icon: '🏗️',
      });
    }
  }

  // --- STRATEGIC ---

  // Mostly cooling momentum = market timing concern
  const coolingRatio = analytics.total > 0 ? analytics.coolingMomentum / analytics.total : 0;
  if (coolingRatio > 0.5 && analytics.total > 5) {
    steps.push({
      order: order++,
      title: 'Investor attention is shifting',
      detail: `${Math.round(coolingRatio * 100)}% of your matches show cooling momentum. Consider pivoting your narrative to a hotter thesis area, or target contrarian investors who deploy against consensus.`,
      urgency: 'soon',
      icon: '🔄',
    });
  }

  // General fallback if no strong signals
  if (steps.length < 2) {
    steps.push({
      order: order++,
      title: 'Keep building and checking back',
      detail: 'Signals are dynamic. As market conditions shift and your startup grows, new investor windows open. Check back weekly for updated match intelligence.',
      urgency: 'later',
      icon: '🔁',
    });
  }

  return steps.sort((a, b) => {
    const urgencyOrder = { now: 0, soon: 1, later: 2 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });
}

// -----------------------------------------------------------------------------
// COMPONENT: GOD Score Mini Bar Chart
// -----------------------------------------------------------------------------

function GODMiniChart({ context }: { context: StartupContext }) {
  const components = [
    { label: 'Team', value: context.god.team, max: 25, color: 'bg-blue-500' },
    { label: 'Traction', value: context.god.traction, max: 25, color: 'bg-emerald-500' },
    { label: 'Market', value: context.god.market, max: 20, color: 'bg-purple-500' },
    { label: 'Product', value: context.god.product, max: 15, color: 'bg-amber-500' },
    { label: 'Vision', value: context.god.vision, max: 15, color: 'bg-cyan-500' },
  ];

  return (
    <div className="space-y-2">
      {components.map((c) => {
        const pct = Math.round((c.value / c.max) * 100);
        return (
          <div key={c.label} className="flex items-center gap-3">
            <span className="text-xs text-gray-400 w-16 text-right">{c.label}</span>
            <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${c.color} transition-all duration-700`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500 w-8 font-mono">{c.value}</span>
          </div>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------------
// COMPONENT: Momentum Distribution
// -----------------------------------------------------------------------------

function MomentumChart({ analytics }: { analytics: MatchAnalytics }) {
  const total = analytics.total || 1;
  const segments = [
    { label: 'Strong', count: analytics.strongMomentum, color: 'bg-emerald-500', textColor: 'text-emerald-400' },
    { label: 'Emerging', count: analytics.emergingMomentum, color: 'bg-cyan-500', textColor: 'text-cyan-400' },
    { label: 'Neutral', count: analytics.neutralMomentum, color: 'bg-gray-500', textColor: 'text-gray-400' },
    { label: 'Cooling', count: analytics.coolingMomentum, color: 'bg-amber-500', textColor: 'text-amber-400' },
  ];

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="h-3 flex rounded-full overflow-hidden bg-gray-800">
        {segments.map((s) => (
          s.count > 0 && (
            <div
              key={s.label}
              className={`${s.color} transition-all duration-700`}
              style={{ width: `${(s.count / total) * 100}%` }}
              title={`${s.label}: ${s.count}`}
            />
          )
        ))}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${s.color}`} />
            <span className={`text-xs ${s.textColor}`}>{s.label}</span>
            <span className="text-xs text-gray-600">{s.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// COMPONENT: Fit Distribution Ring
// -----------------------------------------------------------------------------

function FitDistribution({ analytics }: { analytics: MatchAnalytics }) {
  const total = analytics.total || 1;
  const items = [
    { label: 'High Fit', count: analytics.highFit, pct: Math.round((analytics.highFit / total) * 100), color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30' },
    { label: 'Good Fit', count: analytics.goodFit, pct: Math.round((analytics.goodFit / total) * 100), color: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500/30' },
    { label: 'Early Fit', count: analytics.earlyFit, pct: Math.round((analytics.earlyFit / total) * 100), color: 'text-gray-400', bg: 'bg-gray-500/20', border: 'border-gray-500/30' },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <div key={item.label} className={`${item.bg} border ${item.border} rounded-lg p-3 text-center`}>
          <p className={`text-xl font-bold ${item.color}`}>{item.count}</p>
          <p className="text-xs text-gray-500 mt-1">{item.label}</p>
          <p className="text-[10px] text-gray-600">{item.pct}%</p>
        </div>
      ))}
    </div>
  );
}

// -----------------------------------------------------------------------------
// COMPONENT: Signal Components Radar
// -----------------------------------------------------------------------------

function SignalComponents({ context }: { context: StartupContext }) {
  const signals = [
    { label: 'Language Shift', value: context.signals.founder_language_shift, max: 2.0, desc: 'How founder messaging is evolving' },
    { label: 'Receptivity', value: context.signals.investor_receptivity, max: 2.5, desc: 'Investor openness to your space' },
    { label: 'News Momentum', value: context.signals.news_momentum, max: 1.5, desc: 'Media & industry buzz' },
    { label: 'Capital Flow', value: context.signals.capital_convergence, max: 2.0, desc: 'Where money is moving' },
    { label: 'Exec Velocity', value: context.signals.execution_velocity, max: 2.0, desc: 'Pace of execution signals' },
  ];

  return (
    <div className="space-y-2">
      {signals.map((s) => {
        const pct = Math.round((s.value / s.max) * 100);
        const intensity = pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-gray-300' : 'text-gray-500';
        return (
          <div key={s.label} className="flex items-center gap-3" title={s.desc}>
            <span className="text-xs text-gray-400 w-24 text-right truncate">{s.label}</span>
            <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-600 to-emerald-500 transition-all duration-700"
                style={{ width: `${Math.min(pct, 100)}%` }}
              />
            </div>
            <span className={`text-xs font-mono w-8 ${intensity}`}>{s.value.toFixed(1)}</span>
          </div>
        );
      })}
    </div>
  );
}

// -----------------------------------------------------------------------------
// MAIN COMPONENT
// -----------------------------------------------------------------------------

export default function SignalPathDashboard({
  context,
  rows,
  startupName,
  loading = false,
}: SignalPathDashboardProps) {
  const analytics = useMemo(() => analyzeMatches(rows), [rows]);
  const pathSteps = useMemo(() => generatePath(context, analytics), [context, analytics]);

  // Don't render until we have both matches and context
  if (loading || !context || rows.length === 0) return null;

  const urgencyColors = {
    now: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    soon: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400', badge: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    later: { bg: 'bg-gray-500/10', border: 'border-gray-500/20', text: 'text-gray-400', badge: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  };

  return (
    <div className="mt-10 space-y-8">
      {/* Section Header */}
      <div className="border-t border-zinc-800/50 pt-8">
        <div className="flex items-center gap-3 mb-1">
          <h2 className="text-xl font-semibold text-white">The Signal Path</h2>
          <span className="text-xs text-amber-400/80 font-medium italic">"This is the way."</span>
        </div>
        <p className="text-sm text-gray-500">
          Your personalized roadmap based on {analytics.total} investor signals for <span className="text-gray-300">{startupName}</span>.
        </p>
      </div>

      {/* === ROW 1: Signal Health + Match Landscape === */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Signal Health */}
        <div className="bg-gray-900/40 border border-zinc-800/50 rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-1">Signal Health</h3>
            <p className="text-xs text-gray-500">How investor attention is forming around your startup.</p>
          </div>

          {/* Signal Score Banner */}
          <div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-4">
            <div>
              <p className="text-xs text-gray-500">Total Signal Score</p>
              <p className="text-3xl font-bold text-white">{context.signals.total.toFixed(1)}<span className="text-base text-gray-500">/10</span></p>
            </div>
            {context.comparison?.percentile !== undefined && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Percentile</p>
                <p className="text-2xl font-bold text-cyan-400">
                  {context.comparison.percentile >= 99 ? 'Top 1%' : `${context.comparison.percentile}th`}
                </p>
              </div>
            )}
          </div>

          {/* Signal Components */}
          <SignalComponents context={context} />
        </div>

        {/* RIGHT: Match Landscape */}
        <div className="bg-gray-900/40 border border-zinc-800/50 rounded-xl p-6 space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-1">Match Landscape</h3>
            <p className="text-xs text-gray-500">{analytics.total} investors analyzed. Here's the breakdown.</p>
          </div>

          {/* Fit Distribution */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Fit Distribution</p>
            <FitDistribution analytics={analytics} />
          </div>

          {/* Momentum */}
          <div>
            <p className="text-xs text-gray-500 mb-2">Investor Momentum</p>
            <MomentumChart analytics={analytics} />
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-4 pt-2 border-t border-zinc-800/30 text-xs text-gray-500">
            <span>Avg Signal: <strong className="text-gray-300">{analytics.avgSignalScore}</strong></span>
            <span>Top Signal: <strong className="text-gray-300">{analytics.topSignalScore.toFixed(1)}</strong></span>
            <span>Unlocked: <strong className="text-gray-300">{analytics.unlockedCount}/{analytics.total}</strong></span>
          </div>
        </div>
      </div>

      {/* === ROW 2: GOD Score Breakdown === */}
      <div className="bg-gray-900/40 border border-zinc-800/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-1">Your Position</h3>
            <p className="text-xs text-gray-500">GOD Score breakdown — what investors see when evaluating your startup.</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">GOD Score</p>
            <p className="text-2xl font-bold text-white">{context.god.total}<span className="text-sm text-gray-500">/100</span></p>
          </div>
        </div>
        <GODMiniChart context={context} />
        {context.comparison && (
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-zinc-800/30 text-xs text-gray-500">
            <span>Industry Avg: <strong className="text-gray-300">{context.comparison.industry_avg}</strong></span>
            <span>Top Quartile: <strong className="text-gray-300">{context.comparison.top_quartile}</strong></span>
            {context.comparison.sectors?.length > 0 && (
              <span>Sectors: <strong className="text-gray-300">{context.comparison.sectors.slice(0, 3).join(', ')}</strong></span>
            )}
          </div>
        )}
      </div>

      {/* === ROW 3: THE PATH — Action Steps === */}
      <div className="bg-gray-900/40 border border-zinc-800/50 rounded-xl p-6">
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-1">Your Next Moves</h3>
          <p className="text-xs text-gray-500">Prioritized actions based on your signal data. Start from the top.</p>
        </div>

        <div className="space-y-4">
          {pathSteps.map((step, i) => {
            const colors = urgencyColors[step.urgency];
            return (
              <div
                key={i}
                className={`${colors.bg} border ${colors.border} rounded-lg p-4 flex gap-4`}
              >
                {/* Step number + icon */}
                <div className="flex-shrink-0 flex flex-col items-center gap-1">
                  <span className="text-lg">{step.icon}</span>
                  <span className="text-[10px] text-gray-600 font-mono">#{step.order}</span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className={`text-sm font-semibold ${colors.text}`}>{step.title}</h4>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wider ${colors.badge}`}>
                      {step.urgency}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 leading-relaxed">{step.detail}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Oracle hook */}
        <div className="mt-6 pt-4 border-t border-zinc-800/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-amber-400/60 text-sm">⊛</span>
            <p className="text-xs text-gray-500">
              Want deeper coaching? The <span className="text-amber-300/80">Oracle</span> can generate custom outreach plans, thesis decks, and founder personas.
            </p>
          </div>
          <a
            href="/app/oracle"
            className="text-xs text-amber-400/80 hover:text-amber-300 font-medium transition-colors flex-shrink-0"
          >
            Open Oracle →
          </a>
        </div>
      </div>
    </div>
  );
}
