/**
 * useSignalIntelligence — the motivational intelligence layer
 *
 * Computes four things the existing scorecard hook never provides:
 *   1. cohortPercentile   — where this startup ranks vs sector/stage peers (0–100)
 *   2. signalGaps         — which core signal classes are missing + projected impact
 *   3. signalVelocity     — 30-day signal count delta (are you accelerating or stalling?)
 *   4. narrative          — analyst-style plain-English summary of what investors see
 *
 * All data is fetched directly from Supabase — no server round-trip required.
 * The hook is self-contained and can be dropped into any component.
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface SignalGap {
  signalClass: string;
  label: string;
  description: string;          // what generating this signal requires
  investorImpact: string;       // what investors read when this is missing
  projectedMatchLift: number;   // estimated match-score improvement (0–20)
}

export interface SignalIntelligence {
  // Cohort
  cohortPercentile: number | null;        // 0–100, null if insufficient cohort data
  cohortSize: number;                     // # startups in same sector/stage
  cohortLabel: string;                    // e.g. "SaaS · Seed"

  // Signal gaps
  signalGaps: SignalGap[];
  signalCompleteness: number;             // 0–100, % of core classes present
  presentClasses: string[];

  // Velocity
  signalCountLast30: number;
  signalCountPrev30: number;
  velocityDelta: number;                  // +/- absolute
  velocityLabel: 'accelerating' | 'stable' | 'stalling' | 'silent';
  topSignalClass: string | null;
  topSignalStrength: number | null;

  // Narrative
  narrative: string;

  // Meta
  startupName: string;
  sector: string | null;
  stage: string | null;
}

interface UseSignalIntelligenceResult {
  data: SignalIntelligence | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// The 8 core signal classes every investor-ready startup should emit
const CORE_SIGNAL_CLASSES: SignalGap[] = [
  {
    signalClass: 'fundraising_signal',
    label: 'Fundraising intent',
    description: 'State that you are raising, seeking capital, or in a funding round',
    investorImpact: 'Investors cannot tell you are open to capital — they will not reach out',
    projectedMatchLift: 12,
  },
  {
    signalClass: 'growth_signal',
    label: 'Growth evidence',
    description: 'Share user growth, revenue growth rate, or MoM metrics',
    investorImpact: 'No growth data means investors assume flat — your match score is penalised',
    projectedMatchLift: 10,
  },
  {
    signalClass: 'revenue_signal',
    label: 'Revenue signal',
    description: 'Publish ARR, MRR, or first-dollar milestone',
    investorImpact: 'Pre-revenue signals trigger conservative match scoring from Series A+ investors',
    projectedMatchLift: 9,
  },
  {
    signalClass: 'product_signal',
    label: 'Product momentum',
    description: 'Announce a launch, new feature, or product milestone',
    investorImpact: 'Missing product signals suggest execution risk — investors discount trajectory',
    projectedMatchLift: 8,
  },
  {
    signalClass: 'buyer_pain_signal',
    label: 'Customer validation',
    description: 'Reference customer pain, interviews, or early adopters',
    investorImpact: 'Investors need demand evidence — absence signals market risk',
    projectedMatchLift: 8,
  },
  {
    signalClass: 'hiring_signal',
    label: 'Team scaling',
    description: 'Post open roles, mention new hires, or reference team expansion',
    investorImpact: 'Investors use hiring as a proxy for capital deployment readiness',
    projectedMatchLift: 6,
  },
  {
    signalClass: 'market_position_signal',
    label: 'Market positioning',
    description: 'Reference your competitive differentiation or market category',
    investorImpact: 'Without positioning, investors cannot place you in their mental model',
    projectedMatchLift: 5,
  },
  {
    signalClass: 'expansion_signal',
    label: 'Expansion signal',
    description: 'Mention new markets, geographies, or enterprise entry',
    investorImpact: 'Expansion signals unlock growth-stage investor matching',
    projectedMatchLift: 5,
  },
];

const STAGE_LABELS: Record<number, string> = {
  1: 'Pre-Seed',
  2: 'Seed',
  3: 'Series A',
  4: 'Series B',
  5: 'Series C+',
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function velocityLabel(
  last30: number,
  prev30: number,
): SignalIntelligence['velocityLabel'] {
  if (last30 === 0 && prev30 === 0) return 'silent';
  if (last30 === 0) return 'stalling';
  const ratio = prev30 === 0 ? 99 : last30 / prev30;
  if (ratio >= 1.5) return 'accelerating';
  if (ratio <= 0.6) return 'stalling';
  return 'stable';
}

function percentileOf(value: number, sortedAsc: number[]): number {
  if (sortedAsc.length === 0) return 50;
  const below = sortedAsc.filter((v) => v < value).length;
  return Math.round((below / sortedAsc.length) * 100);
}

function buildNarrative(
  name: string,
  cohortPercentile: number | null,
  cohortLabel: string,
  presentClasses: string[],
  gaps: SignalGap[],
  velocity: SignalIntelligence['velocityLabel'],
  topClass: string | null,
  topStrength: number | null,
): string {
  const parts: string[] = [];

  // Lead — what investors see first
  if (presentClasses.length === 0) {
    parts.push(
      `${name} has not yet generated a detectable signal profile. Investors scanning the platform will not find this company in active deal flow.`,
    );
  } else {
    const topLabel = topClass
      ? CORE_SIGNAL_CLASSES.find((c) => c.signalClass === topClass)?.label ?? topClass
      : null;
    const strengthLabel =
      topStrength !== null
        ? topStrength >= 0.85
          ? 'high-conviction'
          : topStrength >= 0.65
          ? 'moderate'
          : 'early-stage'
        : '';
    const classCount = presentClasses.length;
    parts.push(
      `Investors scanning ${name} see ${classCount} active signal type${classCount !== 1 ? 's' : ''}${
        topLabel ? `, led by ${strengthLabel} ${topLabel}` : ''
      }.`,
    );
  }

  // Velocity sentence
  if (velocity === 'accelerating') {
    parts.push('Signal velocity is accelerating — the platform is detecting increased activity, which raises your visibility in investor feeds.');
  } else if (velocity === 'stalling') {
    parts.push('Signal velocity has dropped over the last 30 days. Investors interpret silence as stalled momentum — activity is needed now.');
  } else if (velocity === 'silent') {
    parts.push('No signals detected in the last 60 days. This company is invisible to investors on active deal searches.');
  } else {
    parts.push('Signal output is steady. To trigger investor alerts, you need a velocity spike — a cluster of new signals within a 2-week window.');
  }

  // Cohort sentence
  if (cohortPercentile !== null) {
    if (cohortPercentile >= 75) {
      parts.push(`Relative to ${cohortLabel} peers, this signal profile ranks in the top ${100 - cohortPercentile}% — strong positioning for inbound investor interest.`);
    } else if (cohortPercentile >= 40) {
      parts.push(`Among ${cohortLabel} peers, the signal profile is mid-field. Closing the top signal gaps below would move this into the top quartile.`);
    } else {
      parts.push(`Against ${cohortLabel} peers, this profile ranks in the bottom half. Investors comparing deal flow will find stronger signals from competitors.`);
    }
  }

  // Gap sentence
  if (gaps.length > 0) {
    const topGap = gaps[0];
    parts.push(
      `Critical gap: ${topGap.investorImpact} Add ${topGap.label.toLowerCase()} to unlock an estimated +${topGap.projectedMatchLift}pt match improvement.`,
    );
  }

  return parts.join(' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────────────────────

export function useSignalIntelligence(startupId: string | null | undefined): UseSignalIntelligenceResult {
  const [data, setData] = useState<SignalIntelligence | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!startupId) return;
    setLoading(true);
    setError(null);

    try {
      // ── 1. Fetch this startup's metadata ──────────────────────────────────
      const { data: startup, error: suErr } = await supabase
        .from('startup_uploads')
        .select('id, name, total_god_score, sectors, stage, industry')
        .eq('id', startupId)
        .single();

      if (suErr || !startup) throw new Error(suErr?.message ?? 'Startup not found');

      const sector: string | null =
        (Array.isArray(startup.sectors) && startup.sectors[0]) ||
        startup.industry ||
        null;
      const stageNum: number | null = typeof startup.stage === 'number' ? startup.stage : null;
      const stageStr = stageNum !== null ? (STAGE_LABELS[stageNum] ?? String(stageNum)) : null;
      const cohortLabel = [sector, stageStr].filter(Boolean).join(' · ') || 'All startups';

      // ── 2. Fetch cohort GOD scores (same sector + stage) ──────────────────
      let cohortQuery = supabase
        .from('startup_uploads')
        .select('total_god_score')
        .not('total_god_score', 'is', null)
        .gt('total_god_score', 0)
        .neq('id', startupId)
        .limit(2000);

      if (sector) cohortQuery = cohortQuery.contains('sectors', [sector]);
      if (stageNum !== null) cohortQuery = cohortQuery.eq('stage', stageNum);

      const { data: cohortRows } = await cohortQuery;
      const cohortScores = (cohortRows ?? [])
        .map((r) => r.total_god_score as number)
        .sort((a, b) => a - b);

      const cohortPercentile =
        startup.total_god_score && cohortScores.length >= 5
          ? percentileOf(startup.total_god_score, cohortScores)
          : null;

      // ── 3. Fetch this entity's signals ────────────────────────────────────
      // First resolve entity_id
      const { data: entity } = await supabase
        .from('pythh_entities')
        .select('id')
        .eq('startup_upload_id', startupId)
        .limit(1)
        .single();

      const entityId = entity?.id ?? null;

      let signals: Array<{ primary_signal: string; signal_strength: number | null; detected_at: string }> = [];

      if (entityId) {
        const { data: sigs } = await supabase
          .from('pythh_signal_events')
          .select('primary_signal, signal_strength, detected_at')
          .eq('entity_id', entityId)
          .order('detected_at', { ascending: false })
          .limit(500);
        signals = sigs ?? [];
      }

      // ── 4. Signal classes present ─────────────────────────────────────────
      const presentSet = new Set(signals.map((s) => s.primary_signal));
      const presentClasses = Array.from(presentSet);
      const gaps = CORE_SIGNAL_CLASSES.filter((c) => !presentSet.has(c.signalClass));
      const signalCompleteness = Math.round(
        ((CORE_SIGNAL_CLASSES.length - gaps.length) / CORE_SIGNAL_CLASSES.length) * 100,
      );

      // ── 5. Signal velocity (30-day buckets) ───────────────────────────────
      const now = Date.now();
      const ms30 = 30 * 24 * 60 * 60 * 1000;
      const signalCountLast30 = signals.filter(
        (s) => now - new Date(s.detected_at).getTime() <= ms30,
      ).length;
      const signalCountPrev30 = signals.filter((s) => {
        const age = now - new Date(s.detected_at).getTime();
        return age > ms30 && age <= 2 * ms30;
      }).length;
      const velocityDelta = signalCountLast30 - signalCountPrev30;
      const vLabel = velocityLabel(signalCountLast30, signalCountPrev30);

      // ── 6. Top signal ─────────────────────────────────────────────────────
      const byStrength = [...signals]
        .filter((s) => s.signal_strength !== null)
        .sort((a, b) => (b.signal_strength ?? 0) - (a.signal_strength ?? 0));
      const topSignalClass = byStrength[0]?.primary_signal ?? null;
      const topSignalStrength = byStrength[0]?.signal_strength ?? null;

      // ── 7. Narrative ──────────────────────────────────────────────────────
      const narrative = buildNarrative(
        startup.name ?? 'This startup',
        cohortPercentile,
        cohortLabel,
        presentClasses,
        gaps,
        vLabel,
        topSignalClass,
        topSignalStrength,
      );

      setData({
        cohortPercentile,
        cohortSize: cohortScores.length,
        cohortLabel,
        signalGaps: gaps,
        signalCompleteness,
        presentClasses,
        signalCountLast30,
        signalCountPrev30,
        velocityDelta,
        velocityLabel: vLabel,
        topSignalClass,
        topSignalStrength,
        narrative,
        startupName: startup.name ?? 'Unknown',
        sector,
        stage: stageStr,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [startupId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refresh: fetch };
}

export default useSignalIntelligence;
