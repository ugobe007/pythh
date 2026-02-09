/**
 * INVESTOR PROFILE — PYTHH OBSERVATORY DASHBOARD
 * ═══════════════════════════════════════════════════════════════════════
 * 
 * Supabase design language: dark, clean, inline text, no buttons.
 * Observatory framing — "how discovery is forming around you."
 * 
 * CRITICAL PRINCIPLES (from investorObservatoryService):
 *   ❌ Never expose founders directly
 *   ❌ Never create marketplace vibes
 *   ❌ Never show raw scores
 *   ✅ Show alignment patterns, signal distribution, quality drift
 * 
 * Sections:
 *   1. Identity bar — investor name, firm, access level
 *   2. Observatory summary — total in flow, new this week, quality trend
 *   3. Discovery flow — anonymized startups entering orbit
 *   4. Signal distribution — what signals drive inbound
 *   5. Quality drift — inbound quality trend over weeks
 *   6. Entry paths — how founders reach you
 *   7. Matched startups — top startup matches (non-anonymous, for investors who want to see)
 *   8. Account — settings, sign out
 * ═══════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import LogoDropdownMenu from '../components/LogoDropdownMenu';
import ShareDashboardButton from '../components/ShareDashboardButton';
import {
  getDiscoveryFlow,
  getObservatorySummary,
  getSignalDistribution,
  getEntryPathDistribution,
  getQualityDrift,
  getCurrentQualityStatus,
  getAlignmentDisplayText,
  getAlignmentColor,
  type DiscoveryFlowItem,
  type SignalDistributionItem,
  type EntryPathItem,
  type QualityDriftWeek,
  type ObservatorySummary,
} from '../services/investorObservatoryService';
import { findMatchesForInvestor } from '../lib/matchingService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function trendIcon(dir: 'up' | 'down' | 'stable' | 'improving' | 'declining' | string): string {
  if (dir === 'up' || dir === 'improving') return '↑';
  if (dir === 'down' || dir === 'declining') return '↓';
  return '—';
}

function trendColor(dir: string): string {
  if (dir === 'up' || dir === 'improving') return 'text-emerald-400';
  if (dir === 'down' || dir === 'declining') return 'text-red-400';
  return 'text-zinc-500';
}

function qualityColor(score: number): string {
  if (score >= 70) return 'text-emerald-400';
  if (score >= 40) return 'text-cyan-400';
  if (score >= 20) return 'text-amber-400';
  return 'text-zinc-500';
}

function qualityBarColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-cyan-500';
  if (score >= 20) return 'bg-amber-500';
  return 'bg-zinc-600';
}

function formatCheckSize(min: number | null, max: number | null): string {
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n}`;
  };
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return '—';
}

function alignmentDot(state: string): string {
  if (state === 'strong' || state === 'strong_pattern_match' || state === 'high_alignment') return 'bg-emerald-400';
  if (state === 'active' || state === 'multiple_signals' || state === 'moderate_alignment') return 'bg-cyan-400';
  if (state === 'forming' || state === 'early_signals' || state === 'low_alignment') return 'bg-amber-400';
  return 'bg-zinc-600';
}

function trendBadge(trend: string): string {
  if (trend === 'new') return 'text-emerald-400';
  if (trend === 'rising') return 'text-cyan-400';
  if (trend === 'stable') return 'text-zinc-500';
  return 'text-amber-400'; // fading
}

// ─── Investor data shape ─────────────────────────────────────────────────────

interface InvestorProfile {
  id: string;
  name: string;
  firm: string | null;
  title: string | null;
  email: string | null;
  sectors: string[] | null;
  stage: string[] | null;
  geography_focus: string[] | null;
  check_size_min: number | null;
  check_size_max: number | null;
  investment_thesis: string | null;
  bio: string | null;
  total_investments: number | null;
  successful_exits: number | null;
  active_fund_size: number | null;
  investor_tier: string | null;
  investor_score: number | null;
  leads_rounds: boolean | null;
  portfolio_companies: string[] | null;
  notable_investments: unknown;
  created_at: string | null;
}

interface StartupMatch {
  startup: {
    id: string;
    name: string;
    total_god_score: number;
    stage?: string;
    sectors?: string[];
    website?: string;
  };
  score: number;
  reasons: string[];
}

// ═════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════════════════════════

export default function InvestorProfileDashboard() {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useAuth();
  const [searchParams] = useSearchParams();

  // Investor ID from URL param or localStorage
  const investorId = searchParams.get('investor') || localStorage.getItem('pythh_investor_id') || '';

  // Data
  const [investor, setInvestor] = useState<InvestorProfile | null>(null);
  const [summary, setSummary] = useState<ObservatorySummary | null>(null);
  const [discoveryFlow, setDiscoveryFlow] = useState<DiscoveryFlowItem[]>([]);
  const [signalDist, setSignalDist] = useState<SignalDistributionItem[]>([]);
  const [entryPaths, setEntryPaths] = useState<EntryPathItem[]>([]);
  const [qualityDrift, setQualityDrift] = useState<QualityDriftWeek[]>([]);
  const [qualityStatus, setQualityStatus] = useState<{ current_score: number; trend: string; strong_percentage: number; active_percentage: number } | null>(null);
  const [startupMatches, setStartupMatches] = useState<StartupMatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Load all data
  const loadData = useCallback(async () => {
    if (!investorId) { setLoading(false); return; }
    setLoading(true);
    try {
      // Load investor profile
      const { data: inv } = await supabase
        .from('investors')
        .select('id, name, firm, title, email, sectors, stage, geography_focus, check_size_min, check_size_max, investment_thesis, bio, total_investments, successful_exits, active_fund_size, investor_tier, investor_score, leads_rounds, portfolio_companies, notable_investments, created_at')
        .eq('id', investorId)
        .single();

      if (inv) setInvestor(inv);

      // Load observatory data in parallel
      const [obs, flow, signals, paths, drift, quality, matches] = await Promise.all([
        getObservatorySummary(investorId),
        getDiscoveryFlow(investorId, { limit: 10 }),
        getSignalDistribution(investorId),
        getEntryPathDistribution(investorId),
        getQualityDrift(investorId, 8),
        getCurrentQualityStatus(investorId),
        findMatchesForInvestor(investorId, 8).catch(() => []),
      ]);

      setSummary(obs);
      setDiscoveryFlow(flow);
      setSignalDist(signals);
      setEntryPaths(paths);
      setQualityDrift(drift);
      setQualityStatus(quality);
      setStartupMatches(matches as StartupMatch[]);
    } catch (err) {
      console.error('[InvestorProfile] Load error:', err);
    } finally {
      setLoading(false);
    }
  }, [investorId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Not logged in ─────────────────────────────────────
  if (!isLoggedIn || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
        <div className="max-w-sm text-center space-y-5">
          <p className="text-zinc-400 text-sm">Sign in to access your investor observatory.</p>
          <div className="flex gap-3 justify-center">
            <Link to="/login" className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors">Sign in</Link>
            <span className="text-zinc-700">·</span>
            <Link to="/signup/investor" className="text-sm text-zinc-400 hover:text-zinc-300 transition-colors">Create investor account</Link>
          </div>
        </div>
      </div>
    );
  }

  // ─── No investor linked ────────────────────────────────
  if (!loading && !investorId) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <LogoDropdownMenu />
        <div className="max-w-xl mx-auto px-6 pt-28 pb-16">
          <div className="space-y-6">
            <div>
              <p className="text-[11px] uppercase tracking-[1.5px] text-zinc-500 mb-2">investor observatory</p>
              <h1 className="text-[28px] font-semibold text-zinc-100 leading-tight">
                Hello, {user?.name || 'Investor'}
              </h1>
              <p className="text-zinc-400 text-sm mt-3 leading-relaxed">
                No investor profile is linked yet. Complete your investor setup to see how
                discovery is forming around you — what signals are driving inbound, quality trends, and alignment patterns.
              </p>
            </div>
            <div className="border border-zinc-800 rounded-lg bg-zinc-900/30 p-5">
              <p className="text-zinc-300 text-sm mb-4">Set up your investor profile to begin.</p>
              <Link
                to="/signup/investor"
                className="text-cyan-400 text-sm hover:text-cyan-300 transition-colors"
              >
                Complete investor setup →
              </Link>
            </div>
            <div className="pt-4 flex gap-4 text-xs text-zinc-600">
              <Link to="/profile" className="hover:text-zinc-400 transition-colors">Founder dashboard</Link>
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
          <p className="text-zinc-500 text-xs">Loading your observatory…</p>
        </div>
      </div>
    );
  }

  // ─── Main Dashboard ────────────────────────────────────
  const displayName = investor?.name || user?.name || 'Investor';
  const firmLabel = investor?.firm || '';
  const sectors = investor?.sectors?.slice(0, 3) || [];
  const stages = investor?.stage?.slice(0, 3) || [];
  const checkSize = formatCheckSize(investor?.check_size_min ?? null, investor?.check_size_max ?? null);
  const maxSignalPct = Math.max(...signalDist.map(s => s.percentage), 1);
  const maxPathPct = Math.max(...entryPaths.map(p => p.percentage), 1);
  const maxQuality = Math.max(...qualityDrift.map(w => w.quality_score), 100);

  // Build share payload (frozen snapshot of current pipeline)
  const sharePayload = useMemo(() => ({
    investor_name: displayName,
    firm: firmLabel,
    title: investor?.title || null,
    sectors,
    check_size: checkSize !== '—' ? checkSize : null,
    summary: summary ? {
      total_in_flow: summary.total_in_flow,
      new_this_week: summary.new_this_week,
      strong_alignment_count: summary.strong_alignment_count,
      quality_trend: qualityStatus?.trend || null,
    } : {},
    matches: startupMatches.slice(0, 15).map(m => ({
      name: m.startup.name,
      god_score: m.startup.total_god_score,
      match_score: Math.round(m.score * 100),
      stage: m.startup.stage || null,
      sectors: m.startup.sectors || [],
      reasons: m.reasons?.slice(0, 2) || [],
    })),
  }), [displayName, firmLabel, investor, sectors, checkSize, summary, qualityStatus, startupMatches]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
      <LogoDropdownMenu />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-20 pb-20">

        {/* ═══════ 1. IDENTITY BAR ═══════════════════════════════════════ */}
        <header className="mb-10">
          <div className="flex items-baseline justify-between mb-1">
            <p className="text-[11px] uppercase tracking-[1.5px] text-zinc-500">investor observatory</p>
            {investor?.investor_tier && (
              <span className="text-[11px] uppercase tracking-[1.5px] text-zinc-600">{investor.investor_tier}</span>
            )}
          </div>
          <h1 className="text-[28px] font-semibold text-zinc-100 leading-tight">{displayName}</h1>
          <div className="flex items-center justify-between mt-1">
            <p className="text-zinc-500 text-sm">
              {[firmLabel, investor?.title].filter(Boolean).join(' · ')}
              {sectors.length > 0 && <> · {sectors.join(', ')}</>}
            </p>
            <ShareDashboardButton
              shareType="investor_pipeline"
              payload={sharePayload}
            />
          </div>

          {/* Investment profile row */}
          <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-xs text-zinc-600">
            {stages.length > 0 && (
              <span>Stage <span className="text-zinc-400">{stages.join(', ')}</span></span>
            )}
            {checkSize !== '—' && (
              <span>Check <span className="text-zinc-400">{checkSize}</span></span>
            )}
            {investor?.total_investments != null && investor.total_investments > 0 && (
              <span>Investments <span className="text-zinc-400 tabular-nums">{investor.total_investments}</span></span>
            )}
            {investor?.successful_exits != null && investor.successful_exits > 0 && (
              <span>Exits <span className="text-zinc-400 tabular-nums">{investor.successful_exits}</span></span>
            )}
            {investor?.leads_rounds && (
              <span className="text-emerald-400/70">Leads rounds</span>
            )}
          </div>

          {/* Thesis */}
          {investor?.investment_thesis && (
            <p className="text-zinc-500 text-xs mt-3 leading-relaxed line-clamp-2">
              {investor.investment_thesis}
            </p>
          )}
        </header>


        {/* ═══════ 2. OBSERVATORY SUMMARY ════════════════════════════════ */}
        <section className="mb-10">
          <h2 className="text-[15px] font-medium text-zinc-300 mb-4">Observatory</h2>

          {summary ? (
            <div className="border border-zinc-800/50 rounded-lg">
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-zinc-800/50">
                <div className="px-4 py-4">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1">In flow</p>
                  <p className="text-[22px] font-semibold tabular-nums text-zinc-100">{summary.total_in_flow}</p>
                </div>
                <div className="px-4 py-4">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1">New this week</p>
                  <p className="text-[22px] font-semibold tabular-nums text-cyan-400">{summary.new_this_week}</p>
                </div>
                <div className="px-4 py-4">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1">Strong alignment</p>
                  <p className="text-[22px] font-semibold tabular-nums text-emerald-400">{summary.strong_alignment_count}</p>
                </div>
                <div className="px-4 py-4">
                  <p className="text-[11px] uppercase tracking-wider text-zinc-600 mb-1">Quality trend</p>
                  <p className={`text-[22px] font-semibold ${trendColor(summary.quality_trend)}`}>
                    {trendIcon(summary.quality_trend)} {summary.quality_trend}
                  </p>
                </div>
              </div>

              {/* Top signal + top path */}
              <div className="border-t border-zinc-800/50 px-4 py-3 flex gap-6 text-xs text-zinc-500">
                <span>Top signal <span className="text-zinc-400">{summary.top_signal}</span></span>
                <span>Top entry <span className="text-zinc-400">{summary.top_entry_path}</span></span>
              </div>
            </div>
          ) : (
            <div className="border border-zinc-800/50 rounded-lg p-4">
              <p className="text-zinc-600 text-sm">Observatory data not yet available. Data populates as founders enter your discovery flow.</p>
            </div>
          )}
        </section>


        {/* ═══════ 3. DISCOVERY FLOW ═════════════════════════════════════ */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[15px] font-medium text-zinc-300">Discovery flow</h2>
            <span className="text-xs text-zinc-500">{discoveryFlow.length} in orbit</span>
          </div>

          {discoveryFlow.length > 0 ? (
            <div className="border border-zinc-800/50 rounded-lg divide-y divide-zinc-800/50">
              {discoveryFlow.map((item) => (
                <div key={item.id} className="px-4 py-3 hover:bg-zinc-900/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${alignmentDot(item.alignment_state)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="text-sm text-zinc-200 truncate">{item.startup_type_label}</p>
                        <span className={`text-[11px] tabular-nums whitespace-nowrap ${trendBadge(item.trend)}`}>
                          {item.trend}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-600">
                        <span className={getAlignmentColor(item.alignment_state as any)}>
                          {getAlignmentDisplayText(item.alignment_state as any)}
                        </span>
                        <span>·</span>
                        <span>{item.stage}</span>
                        <span>·</span>
                        <span>{item.industry}</span>
                        {item.signal_count > 0 && (
                          <>
                            <span>·</span>
                            <span className="tabular-nums">{item.signal_count} signals</span>
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
              <p className="text-zinc-600 text-sm">No startups in your discovery flow yet. As founders match your criteria, they will appear here anonymously.</p>
            </div>
          )}
        </section>


        {/* ═══════ 4. SIGNAL DISTRIBUTION ════════════════════════════════ */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[15px] font-medium text-zinc-300">Signal distribution</h2>
            <span className="text-xs text-zinc-500">What's driving inbound</span>
          </div>

          {signalDist.length > 0 ? (
            <div className="border border-zinc-800/50 rounded-lg divide-y divide-zinc-800/50">
              {signalDist.slice(0, 8).map((s) => (
                <div key={s.signal_type} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-sm text-zinc-400 truncate">{s.signal_label}</span>
                    <span className={`text-[11px] ${trendColor(s.trend_direction)}`}>
                      {trendIcon(s.trend_direction)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-cyan-500 transition-all"
                        style={{ width: `${(s.percentage / maxSignalPct) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-zinc-500 w-10 text-right">
                      {s.percentage.toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-zinc-800/50 rounded-lg p-4">
              <p className="text-zinc-600 text-sm">Signal data populates as your discovery flow grows.</p>
            </div>
          )}
        </section>


        {/* ═══════ 5. QUALITY DRIFT ══════════════════════════════════════ */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[15px] font-medium text-zinc-300">Quality drift</h2>
            {qualityStatus && (
              <span className={`text-[22px] font-semibold tabular-nums ${qualityColor(qualityStatus.current_score)}`}>
                {qualityStatus.current_score}
                <span className="text-zinc-600 text-xs font-normal ml-1">quality</span>
              </span>
            )}
          </div>

          {qualityDrift.length > 0 ? (
            <div className="border border-zinc-800/50 rounded-lg">
              {/* Mini bar chart */}
              <div className="px-4 py-4">
                <div className="flex items-end gap-1 h-16">
                  {qualityDrift.map((week, i) => {
                    const height = maxQuality > 0 ? (week.quality_score / maxQuality) * 100 : 0;
                    const isLast = i === qualityDrift.length - 1;
                    return (
                      <div
                        key={week.week_bucket}
                        className="flex-1 flex flex-col items-center gap-1"
                        title={`Week of ${week.week_bucket}: ${week.quality_score} quality, ${week.total_inbound} inbound`}
                      >
                        <div className="w-full relative" style={{ height: '64px' }}>
                          <div
                            className={`absolute bottom-0 w-full rounded-sm transition-all ${
                              isLast ? qualityBarColor(week.quality_score) : 'bg-zinc-700'
                            }`}
                            style={{ height: `${height}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Week labels */}
                <div className="flex gap-1 mt-1">
                  {qualityDrift.map((week, i) => (
                    <span key={i} className="flex-1 text-[9px] text-zinc-700 text-center tabular-nums truncate">
                      {new Date(week.week_bucket).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats row */}
              <div className="border-t border-zinc-800/50 px-4 py-3 flex gap-6 text-xs text-zinc-500">
                {qualityStatus && (
                  <>
                    <span>Strong <span className="text-emerald-400 tabular-nums">{qualityStatus.strong_percentage.toFixed(0)}%</span></span>
                    <span>Active <span className="text-cyan-400 tabular-nums">{qualityStatus.active_percentage.toFixed(0)}%</span></span>
                    <span>Trend <span className={trendColor(qualityStatus.trend)}>{qualityStatus.trend}</span></span>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="border border-zinc-800/50 rounded-lg p-4">
              <p className="text-zinc-600 text-sm">Quality drift data requires at least 2 weeks of activity.</p>
            </div>
          )}
        </section>


        {/* ═══════ 6. ENTRY PATHS ════════════════════════════════════════ */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[15px] font-medium text-zinc-300">Entry paths</h2>
            <span className="text-xs text-zinc-500">How founders reach you</span>
          </div>

          {entryPaths.length > 0 ? (
            <div className="border border-zinc-800/50 rounded-lg divide-y divide-zinc-800/50">
              {entryPaths.slice(0, 6).map((p) => (
                <div key={p.entry_path} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-zinc-400">{p.path_label}</span>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-zinc-500 transition-all"
                        style={{ width: `${(p.percentage / maxPathPct) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums text-zinc-500 w-10 text-right">{p.percentage.toFixed(0)}%</span>
                    <span className="text-[11px] text-zinc-700 w-14 text-right tabular-nums">
                      {(p.conversion_rate * 100).toFixed(0)}% conv
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-zinc-800/50 rounded-lg p-4">
              <p className="text-zinc-600 text-sm">Entry path data populates as founders interact with your profile.</p>
            </div>
          )}
        </section>


        {/* ═══════ 7. MATCHED STARTUPS ═══════════════════════════════════ */}
        <section className="mb-10">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[15px] font-medium text-zinc-300">Top matched startups</h2>
            <span className="text-xs text-zinc-500">{startupMatches.length} matches</span>
          </div>

          {startupMatches.length > 0 ? (
            <div className="border border-zinc-800/50 rounded-lg divide-y divide-zinc-800/50">
              {/* Header */}
              <div className="grid grid-cols-[1fr_4rem_4rem] gap-2 px-4 py-2 text-[11px] uppercase tracking-wider text-zinc-600">
                <span>Startup</span>
                <span className="text-right">GOD</span>
                <span className="text-right">Match</span>
              </div>

              {startupMatches.map((m, i) => (
                <div
                  key={m.startup.id}
                  className="grid grid-cols-[1fr_4rem_4rem] gap-2 px-4 py-3 hover:bg-zinc-900/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm text-zinc-200 truncate">{m.startup.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-zinc-600 mt-0.5">
                      {m.startup.stage && <span>{m.startup.stage}</span>}
                      {m.startup.sectors && m.startup.sectors.length > 0 && (
                        <>
                          {m.startup.stage && <span>·</span>}
                          <span className="truncate">{m.startup.sectors.slice(0, 2).join(', ')}</span>
                        </>
                      )}
                    </div>
                    {m.reasons.length > 0 && (
                      <p className="text-[11px] text-zinc-700 mt-0.5 truncate">{m.reasons[0]}</p>
                    )}
                  </div>
                  <span className={`text-xs tabular-nums text-right self-center ${qualityColor(m.startup.total_god_score)}`}>
                    {m.startup.total_god_score}
                  </span>
                  <span className={`text-xs tabular-nums text-right self-center ${qualityColor(m.score)}`}>
                    {m.score}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-zinc-800/50 rounded-lg p-4">
              <p className="text-zinc-600 text-sm">No startup matches yet. Matches generate based on your investment criteria and available startups.</p>
            </div>
          )}
        </section>


        {/* ═══════ 8. ACCOUNT ════════════════════════════════════════════ */}
        <section className="border-t border-zinc-800/50 pt-6">
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-600">
            <Link to="/profile" className="hover:text-zinc-400 transition-colors">Founder dashboard</Link>
            <Link to="/settings" className="hover:text-zinc-400 transition-colors">Settings</Link>
            <Link to="/pricing" className="hover:text-zinc-400 transition-colors">Billing</Link>
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
            {user?.email} · Observatory updates as discovery flow changes
          </p>
        </section>
      </div>
    </div>
  );
}
