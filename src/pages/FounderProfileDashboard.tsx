/**
 * FOUNDER PROFILE — PYTHH DASHBOARD
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Supabase design language: dark, clean, inline text, no buttons.
 * Everything is information. Actions are inline links.
 * 
 * Sections:
 *   1. Identity bar — startup name, signal score, plan
 *   2. Signal health — 5 dimensions, percentile vs peers
 *   3. GOD score breakdown — horizontal bars
 *   4. Top matched investors — compact table
 *   5. What to do next — prioritized action list
 *   6. Schedule — upcoming events + mini calendar
 *   7. Account — settings link, sign out
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useBilling } from '../hooks/useBilling';
import { supabase } from '../lib/supabase';
import { useOracleStartupId } from '../hooks/useOracleStartupId';
import { pythhRpc } from '../services/pythh-rpc';
import LogoDropdownMenu from '../components/LogoDropdownMenu';
import type { StartupContext, MatchRow } from '../lib/pythh-types';
import { GOD_MAX_SCORES, SIGNAL_WEIGHTS, MOMENTUM_DISPLAY } from '../lib/pythh-types';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function signalColor(value: number, max: number): string {
  const pct = value / max;
  if (pct >= 0.7) return 'text-emerald-400';
  if (pct >= 0.4) return 'text-cyan-400';
  if (pct >= 0.2) return 'text-amber-400';
  return 'text-zinc-500';
}

function barColor(pct: number): string {
  if (pct >= 0.7) return 'bg-emerald-500';
  if (pct >= 0.4) return 'bg-cyan-500';
  if (pct >= 0.2) return 'bg-amber-500';
  return 'bg-zinc-600';
}

function momentumDot(bucket: string): string {
  if (bucket === 'strong') return 'bg-emerald-400';
  if (bucket === 'emerging') return 'bg-cyan-400';
  if (bucket === 'neutral') return 'bg-zinc-500';
  if (bucket === 'cooling') return 'bg-amber-400';
  return 'bg-zinc-600';
}

function fitLabel(bucket: string): string {
  return bucket === 'high' ? 'High fit' : bucket === 'good' ? 'Good fit' : 'Early fit';
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Calendar helpers ────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

// ─── Action items (generated from signal data) ──────────────────────────────

interface ActionItem {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  dimension: string;
  lift: string;
  link?: string;
}

function generateActions(ctx: StartupContext | null): ActionItem[] {
  if (!ctx) return [];
  const actions: ActionItem[] = [];

  const { signals, god, comparison } = ctx;

  // Signal-based
  if (signals.investor_receptivity < 1.2) {
    actions.push({
      id: 'ir-low', priority: 'critical',
      title: 'Investor receptivity is below threshold',
      detail: 'Your startup is not appearing on investor radars. Strengthening your public narrative and PR activity will move this signal.',
      dimension: 'investor_receptivity', lift: '+0.5 – 1.2',
      link: '/app/oracle/actions',
    });
  }
  if (signals.founder_language_shift < 0.8) {
    actions.push({
      id: 'fls-low', priority: 'high',
      title: 'Narrative consistency needs attention',
      detail: 'Your founder language signal is weak. Align your pitch, website, and LinkedIn to tell the same story.',
      dimension: 'founder_language_shift', lift: '+0.3 – 0.8',
      link: '/app/oracle/wizard',
    });
  }
  if (signals.execution_velocity < 0.8) {
    actions.push({
      id: 'ev-low', priority: 'high',
      title: 'Ship faster — execution velocity is stalling',
      detail: 'Investors track your public cadence. Launch features, publish updates, or announce partnerships to boost this signal.',
      dimension: 'execution_velocity', lift: '+0.4 – 1.0',
    });
  }
  if (signals.capital_convergence < 1.0) {
    actions.push({
      id: 'cc-low', priority: 'medium',
      title: 'Capital convergence below sector average',
      detail: 'Funding momentum in your space is not reflecting on you. Consider warm intros or co-investor conversations.',
      dimension: 'capital_convergence', lift: '+0.3 – 0.7',
    });
  }
  if (signals.news_momentum < 0.6) {
    actions.push({
      id: 'nm-low', priority: 'medium',
      title: 'Increase public visibility',
      detail: 'No recent press or social mentions. A blog post, podcast appearance, or launch announcement would move this.',
      dimension: 'news_momentum', lift: '+0.2 – 0.5',
    });
  }

  // GOD-based
  if (god.traction < 10) {
    actions.push({
      id: 'god-traction', priority: 'high',
      title: 'Traction evidence is weak',
      detail: 'Add verifiable metrics — MRR, user growth, partnerships — to your profile. Traction is 25% of your GOD score.',
      dimension: 'god.traction', lift: '+5 – 12 pts',
    });
  }
  if (god.team < 10) {
    actions.push({
      id: 'god-team', priority: 'medium',
      title: 'Strengthen team signal',
      detail: 'Add co-founder details, LinkedIn profiles, and prior exits. Team is 25% of your GOD score.',
      dimension: 'god.team', lift: '+3 – 8 pts',
    });
  }

  // Comparison
  if (comparison.percentile < 50) {
    actions.push({
      id: 'below-median', priority: 'high',
      title: `Below median in ${comparison.sectors?.[0] || 'your sector'}`,
      detail: `You're at the ${comparison.percentile}th percentile. Focus on the highest-lift actions above to climb.`,
      dimension: 'comparison', lift: `→ ${comparison.percentile + 15}th+`,
    });
  }

  // Sort by priority
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return actions.sort((a, b) => order[a.priority] - order[b.priority]);
}

// ─── Upcoming events (smart defaults) ────────────────────────────────────────

interface ScheduleEvent {
  id: string;
  date: Date;
  title: string;
  type: 'action' | 'deadline' | 'meeting' | 'milestone';
  detail?: string;
}

function generateSchedule(actions: ActionItem[], startupName: string): ScheduleEvent[] {
  const now = new Date();
  const events: ScheduleEvent[] = [];

  // Generate events based on action items
  const criticalActions = actions.filter(a => a.priority === 'critical');
  const highActions = actions.filter(a => a.priority === 'high');

  if (criticalActions.length > 0) {
    const deadline = new Date(now);
    deadline.setDate(deadline.getDate() + 3);
    events.push({
      id: 'crit-deadline',
      date: deadline,
      title: `Fix: ${criticalActions[0].title.slice(0, 50)}`,
      type: 'deadline',
      detail: 'Critical signal gap — address within 72h',
    });
  }

  if (highActions.length > 0) {
    const actionDate = new Date(now);
    actionDate.setDate(actionDate.getDate() + 5);
    events.push({
      id: 'high-action',
      date: actionDate,
      title: highActions[0].title.slice(0, 50),
      type: 'action',
      detail: 'High-priority improvement',
    });
  }

  // Weekly signal review
  const nextMonday = new Date(now);
  nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
  events.push({
    id: 'signal-review',
    date: nextMonday,
    title: 'Weekly signal review',
    type: 'milestone',
    detail: `${startupName} signals refresh every Monday`,
  });

  // Bi-weekly investor check
  const investorCheck = new Date(now);
  investorCheck.setDate(investorCheck.getDate() + 14);
  events.push({
    id: 'investor-check',
    date: investorCheck,
    title: 'Review new investor matches',
    type: 'meeting',
    detail: 'New matches generated as signals update',
  });

  // Monthly GOD re-score
  const godRescore = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  events.push({
    id: 'god-rescore',
    date: godRescore,
    title: 'GOD score recalculation',
    type: 'milestone',
    detail: 'Monthly comprehensive re-score',
  });

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function FounderProfileDashboard() {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useAuth();
  const { plan: billingPlan } = useBilling();
  const startupId = useOracleStartupId();

  // Data
  const [context, setContext] = useState<StartupContext | null>(null);
  const [matches, setMatches] = useState<MatchRow[]>([]);
  const [startupName, setStartupName] = useState('');
  const [loading, setLoading] = useState(true);
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [calYear, setCalYear] = useState(new Date().getFullYear());

  // Load all data
  const loadData = useCallback(async () => {
    if (!startupId) { setLoading(false); return; }
    setLoading(true);
    try {
      const [ctx, matchRows] = await Promise.all([
        pythhRpc.getStartupContext(startupId),
        pythhRpc.getMatchTable(startupId, 5, 20),
      ]);

      // Get startup name
      const { data: su } = await supabase
        .from('startup_uploads')
        .select('name')
        .eq('id', startupId)
        .single();

      setContext(ctx);
      setMatches(matchRows || []);
      setStartupName(su?.name || 'Your Startup');
    } catch (err) {
      console.error('[FounderProfile] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [startupId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Derived
  const actions = useMemo(() => generateActions(context), [context]);
  const schedule = useMemo(() => generateSchedule(actions, startupName), [actions, startupName]);
  const plan = billingPlan || 'free';
  const displayName = user?.name || user?.email?.split('@')[0] || 'Founder';

  // Calendar
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfWeek(calYear, calMonth);
  const monthLabel = new Date(calYear, calMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const today = new Date();
  const eventDates = useMemo(() => {
    const set = new Set<number>();
    schedule.forEach(e => {
      if (e.date.getMonth() === calMonth && e.date.getFullYear() === calYear) {
        set.add(e.date.getDate());
      }
    });
    return set;
  }, [schedule, calMonth, calYear]);

  // ─── Not logged in ─────────────────────────────────────
  if (!isLoggedIn || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-5">
          <p className="text-zinc-400 text-sm">Sign in to access your founder dashboard.</p>
          <div className="flex gap-3 justify-center">
            <Link to="/login" className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">Sign in</Link>
            <span className="text-zinc-700">·</span>
            <Link to="/signup" className="text-sm text-zinc-400 hover:text-zinc-300 transition-colors">Create account</Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── No startup linked ─────────────────────────────────
  if (!loading && !startupId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <LogoDropdownMenu />
        <div className="max-w-xl mx-auto px-6 pt-28 pb-16">
          <div className="space-y-6">
            <div>
              <p className="text-[11px] uppercase tracking-[1.5px] text-zinc-500 mb-2">founder dashboard</p>
              <h1 className="text-[28px] font-semibold text-zinc-100 leading-tight">
                Hello, {displayName}
              </h1>
              <p className="text-zinc-400 text-sm mt-3 leading-relaxed">
                No startup is linked to your profile yet. Submit your website to see how Pythh reads your signals, 
                matches you with investors, and tells you exactly what to do next.
              </p>
            </div>
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-5">
              <p className="text-zinc-300 text-sm mb-4">Enter your startup URL to begin.</p>
              <Link
                to="/"
                className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors"
              >
                Go to Pythh submission →
              </Link>
            </div>
            <div className="pt-4 flex gap-4 text-xs text-zinc-600">
              <Link to="/settings" className="hover:text-zinc-400 transition-colors">Settings</Link>
              <button onClick={() => { logout(); navigate('/'); }} className="hover:text-zinc-400 transition-colors">Sign out</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Loading ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="space-y-3 text-center">
          <div className="w-5 h-5 border-2 border-zinc-700 border-t-zinc-400 rounded-full animate-spin mx-auto" />
          <p className="text-zinc-500 text-xs">Loading your signals…</p>
        </div>
      </div>
    );
  }

  // ─── Main Dashboard ────────────────────────────────────
  const god = context?.god;
  const signals = context?.signals;
  const comparison = context?.comparison;
  const entitlements = context?.entitlements;
  const topMatches = matches.slice(0, 7);
  const unlockedCount = matches.filter(m => !m.is_locked).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <LogoDropdownMenu />

      <div className="max-w-3xl mx-auto px-6 pt-20 pb-20">

        {/* ═══════ 1. IDENTITY BAR ═══════════════════════════════════════ */}
        <header className="mb-10">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-[11px] uppercase tracking-[1.5px] text-zinc-500">founder dashboard</p>
            <span className="text-[11px] uppercase tracking-[1.5px] text-zinc-600">{plan} plan</span>
          </div>
          <h1 className="text-[28px] font-semibold text-zinc-100 leading-tight">{startupName}</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {displayName} · {comparison?.sectors?.[0] || 'Startup'} · {comparison?.percentile ?? '—'}th percentile
          </p>
        </header>


        {/* ═══════ 2. SIGNAL HEALTH ══════════════════════════════════════ */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[15px] font-medium text-zinc-300">Signal health</h2>
            {signals && (
              <span className={`text-[22px] font-semibold tabular-nums ${signalColor(signals.total, 10)}`}>
                {signals.total.toFixed(1)}
                <span className="text-zinc-600 text-xs font-normal ml-1">/ 10</span>
              </span>
            )}
          </div>

          {signals ? (
            <div className="border border-zinc-800/50 rounded-lg divide-y divide-zinc-800/50">
              {([
                ['Investor receptivity', signals.investor_receptivity, SIGNAL_WEIGHTS.investor_receptivity.max],
                ['Capital convergence', signals.capital_convergence, SIGNAL_WEIGHTS.capital_convergence.max],
                ['Execution velocity', signals.execution_velocity, SIGNAL_WEIGHTS.execution_velocity.max],
                ['Founder language', signals.founder_language_shift, SIGNAL_WEIGHTS.founder_language_shift.max],
                ['News momentum', signals.news_momentum, SIGNAL_WEIGHTS.news_momentum.max],
              ] as [string, number, number][]).map(([label, value, max]) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-zinc-400">{label}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor(value / max)}`}
                        style={{ width: `${Math.min((value / max) * 100, 100)}%` }}
                      />
                    </div>
                    <span className={`text-xs tabular-nums w-8 text-right ${signalColor(value, max)}`}>
                      {value.toFixed(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-zinc-800/50 rounded-lg p-4">
              <p className="text-zinc-600 text-sm">Signal data not yet available. Submit your startup to begin tracking.</p>
            </div>
          )}

          {/* Comparison row */}
          {comparison && (
            <div className="flex gap-6 mt-3 text-xs text-zinc-500">
              <span>Industry avg <span className="text-zinc-400 tabular-nums">{comparison.industry_avg.toFixed(1)}</span></span>
              <span>Top quartile <span className="text-zinc-400 tabular-nums">{comparison.top_quartile.toFixed(1)}</span></span>
              <span>Your percentile <span className={`tabular-nums ${(comparison.percentile >= 50) ? 'text-emerald-400' : 'text-amber-400'}`}>{comparison.percentile}th</span></span>
            </div>
          )}
        </section>


        {/* ═══════ 3. GOD SCORE ══════════════════════════════════════════ */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[15px] font-medium text-zinc-300">GOD score</h2>
            {god && (
              <span className={`text-[22px] font-semibold tabular-nums ${signalColor(god.total, 100)}`}>
                {god.total}
                <span className="text-zinc-600 text-xs font-normal ml-1">/ 100</span>
              </span>
            )}
          </div>

          {god ? (
            <div className="border border-zinc-800/50 rounded-lg divide-y divide-zinc-800/50">
              {([
                ['Team', god.team, GOD_MAX_SCORES.team],
                ['Traction', god.traction, GOD_MAX_SCORES.traction],
                ['Market', god.market, GOD_MAX_SCORES.market],
                ['Product', god.product, GOD_MAX_SCORES.product],
                ['Vision', god.vision, GOD_MAX_SCORES.vision],
              ] as [string, number, number][]).map(([label, value, max]) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-zinc-400">{label}</span>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor(value / max)}`}
                        style={{ width: `${(value / max) * 100}%` }}
                      />
                    </div>
                    <span className={`text-xs tabular-nums w-10 text-right ${signalColor(value, max)}`}>
                      {value} <span className="text-zinc-700">/ {max}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-zinc-800/50 rounded-lg p-4">
              <p className="text-zinc-600 text-sm">GOD score pending. Scores are calculated after startup data is enriched.</p>
            </div>
          )}
        </section>


        {/* ═══════ 4. MATCHED INVESTORS ══════════════════════════════════ */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[15px] font-medium text-zinc-300">Matched investors</h2>
            <span className="text-xs text-zinc-500 tabular-nums">{unlockedCount} unlocked · {matches.length} total</span>
          </div>

          {topMatches.length > 0 ? (
            <div className="border border-zinc-800/50 rounded-lg divide-y divide-zinc-800/50">
              {/* Header */}
              <div className="grid grid-cols-[2rem_1fr_5rem_5rem_4rem] gap-2 px-4 py-2 text-[11px] uppercase tracking-wider text-zinc-600">
                <span>#</span>
                <span>Investor</span>
                <span className="text-right">Fit</span>
                <span className="text-right">Momentum</span>
                <span className="text-right">Signal</span>
              </div>

              {topMatches.map((m) => (
                <div
                  key={m.investor_id}
                  className="grid grid-cols-[2rem_1fr_5rem_5rem_4rem] gap-2 px-4 py-3 hover:bg-zinc-900/40 transition-colors group"
                >
                  <span className="text-xs text-zinc-600 tabular-nums">{m.rank}</span>
                  <div className="min-w-0">
                    {m.is_locked ? (
                      <span className="text-zinc-600 text-sm">Locked investor</span>
                    ) : (
                      <Link
                        to={`/app/investors/${m.investor_id}?startup=${startupId}`}
                        className="text-sm text-zinc-200 hover:text-cyan-400 transition-colors truncate block"
                      >
                        {m.investor_name}
                      </Link>
                    )}
                    <p className="text-[11px] text-zinc-600 truncate mt-0.5">{m.why_summary}</p>
                  </div>
                  <span className="text-xs text-zinc-400 text-right self-center">{fitLabel(m.fit_bucket)}</span>
                  <div className="flex items-center justify-end gap-1.5 self-center">
                    <span className={`w-1.5 h-1.5 rounded-full ${momentumDot(m.momentum_bucket)}`} />
                    <span className="text-xs text-zinc-400">
                      {MOMENTUM_DISPLAY[m.momentum_bucket as keyof typeof MOMENTUM_DISPLAY]?.label || m.momentum_bucket}
                    </span>
                  </div>
                  <span className={`text-xs tabular-nums text-right self-center ${signalColor(m.signal_score, 10)}`}>
                    {m.signal_score.toFixed(1)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-zinc-800/50 rounded-lg p-4">
              <p className="text-zinc-600 text-sm">No matches yet. Matches are generated after your signals are calculated.</p>
            </div>
          )}

          {matches.length > 7 && (
            <p className="text-xs text-zinc-600 mt-2">
              <Link to={`/matches?startupId=${startupId}`} className="text-cyan-400/70 hover:text-cyan-400 transition-colors">
                View all {matches.length} matches →
              </Link>
            </p>
          )}
        </section>


        {/* ═══════ 5. WHAT TO DO NEXT ════════════════════════════════════ */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[15px] font-medium text-zinc-300">What to do next</h2>
            <span className="text-xs text-zinc-500">{actions.length} action{actions.length !== 1 ? 's' : ''}</span>
          </div>

          {actions.length > 0 ? (
            <div className="border border-zinc-800/50 rounded-lg divide-y divide-zinc-800/50">
              {actions.map((action) => (
                <div key={action.id} className="px-4 py-4 hover:bg-zinc-900/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      action.priority === 'critical' ? 'bg-red-400' :
                      action.priority === 'high' ? 'bg-amber-400' :
                      action.priority === 'medium' ? 'bg-cyan-400' : 'bg-zinc-600'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-zinc-200">{action.title}</p>
                      <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{action.detail}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-600">
                        <span>Est. lift: <span className="text-zinc-400">{action.lift}</span></span>
                        {action.link && (
                          <>
                            <span>·</span>
                            <Link to={action.link} className="text-cyan-400/70 hover:text-cyan-400 transition-colors">
                              Start this →
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-zinc-800/50 rounded-lg p-4">
              <p className="text-zinc-500 text-sm">No urgent actions. Your signals are healthy.</p>
              <p className="text-zinc-600 text-xs mt-1">Check back after your next weekly signal refresh.</p>
            </div>
          )}
        </section>


        {/* ═══════ 6. SCHEDULE + CALENDAR ════════════════════════════════ */}
        <section className="mb-10">
          <h2 className="text-[15px] font-medium text-zinc-300 mb-4">Schedule</h2>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-5">
            {/* Event list */}
            <div className="border border-zinc-800/50 rounded-lg divide-y divide-zinc-800/50">
              {schedule.length > 0 ? schedule.map(event => (
                <div key={event.id} className="px-4 py-3 hover:bg-zinc-900/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 shrink-0">
                      <span className={`block w-1.5 h-1.5 rounded-full ${
                        event.type === 'deadline' ? 'bg-red-400' :
                        event.type === 'action' ? 'bg-amber-400' :
                        event.type === 'meeting' ? 'bg-cyan-400' :
                        'bg-zinc-600'
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm text-zinc-300 truncate">{event.title}</p>
                        <span className="text-[11px] text-zinc-600 tabular-nums whitespace-nowrap">{formatDate(event.date)}</span>
                      </div>
                      {event.detail && (
                        <p className="text-[11px] text-zinc-600 mt-0.5">{event.detail}</p>
                      )}
                    </div>
                  </div>
                </div>
              )) : (
                <div className="p-4">
                  <p className="text-zinc-600 text-sm">No upcoming events.</p>
                </div>
              )}
            </div>

            {/* Mini calendar */}
            <div className="border border-zinc-800/50 rounded-lg p-3">
              {/* Month nav */}
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => {
                    if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); }
                    else setCalMonth(calMonth - 1);
                  }}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors text-xs px-1"
                >
                  ←
                </button>
                <span className="text-xs text-zinc-400 font-medium">{monthLabel}</span>
                <button
                  onClick={() => {
                    if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); }
                    else setCalMonth(calMonth + 1);
                  }}
                  className="text-zinc-600 hover:text-zinc-400 transition-colors text-xs px-1"
                >
                  →
                </button>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 gap-0 mb-1">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <span key={i} className="text-[10px] text-zinc-700 text-center">{d}</span>
                ))}
              </div>

              {/* Days grid */}
              <div className="grid grid-cols-7 gap-0">
                {Array.from({ length: firstDay }).map((_, i) => (
                  <span key={`pad-${i}`} className="h-7" />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const isToday = day === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                  const hasEvent = eventDates.has(day);
                  return (
                    <span
                      key={day}
                      className={`h-7 flex items-center justify-center text-[11px] tabular-nums rounded relative ${
                        isToday ? 'text-zinc-100 font-medium' : 'text-zinc-600'
                      }`}
                    >
                      {isToday && <span className="absolute inset-0 bg-zinc-800 rounded" />}
                      <span className="relative">{day}</span>
                      {hasEvent && (
                        <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-cyan-500" />
                      )}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </section>


        {/* ═══════ 7. ACCOUNT ════════════════════════════════════════════ */}
        <section className="border-t border-zinc-800/50 pt-6">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-600">
            <Link to="/settings" className="hover:text-zinc-400 transition-colors">Settings</Link>
            <Link to="/pricing" className="hover:text-zinc-400 transition-colors">Billing</Link>
            <Link to="/app/oracle" className="hover:text-zinc-400 transition-colors">Oracle</Link>
            <Link to="/app/oracle/wizard" className="hover:text-zinc-400 transition-colors">Signal wizard</Link>
            {user?.isAdmin && (
              <Link to="/admin" className="hover:text-zinc-400 transition-colors">Admin</Link>
            )}
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="hover:text-zinc-400 transition-colors"
            >
              Sign out
            </button>
          </div>
          <p className="text-[11px] text-zinc-700 mt-3">
            {user?.email} · {plan} · Pythh reads your signals every 24h
          </p>
        </section>
      </div>
    </div>
  );
}
