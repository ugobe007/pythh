/**
 * Oracle Raise Plan — post-signup full plan + authorization (Phase 2).
 */

import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Target, ArrowRight } from 'lucide-react';
import { trackFunnelEventOnce } from '@/lib/matchEngagement';
import OracleDecisionCard from '@/components/OracleDecisionCard';
import {
  type AutonomyLevel,
  type OracleDecision,
  approveDecision,
  deferDecision,
  getAutonomyLevel,
  loadDecisionState,
  markRaisePlanAuthorized,
  setAutonomyLevel,
} from '@/lib/oracleRaisePlan';

export interface RaisePlanPayload {
  startup_id: string;
  startup_name: string;
  readiness_score: number;
  projected_readiness: number;
  campaign: {
    duration_weeks: number;
    segments: string[];
    segment_summary: string;
    qualified_investors: number;
    identified_investors: number;
    target_raise: string | null;
    headline: string;
    subline: string;
  };
  before_outreach: Array<{
    task_key: string;
    title: string;
    impact_points: number;
    component_label: string;
  }>;
  total_gaps: number;
  decisions: OracleDecision[];
  oracle_message: string;
}

type Props = {
  startupId: string;
  onAuthorized: (plan: RaisePlanPayload) => void;
  onOpenWizard?: () => void;
};

const AUTONOMY_OPTIONS: { id: AutonomyLevel; label: string; detail: string }[] = [
  { id: 'observe', label: 'Observe', detail: 'Recommendations only — no external outreach' },
  { id: 'prepare', label: 'Prepare', detail: 'Oracle drafts everything — you approve before send' },
  { id: 'execute', label: 'Execute', detail: 'Pre-authorized campaigns within agreed limits' },
];

export default function OracleRaisePlan({ startupId, onAuthorized, onOpenWizard }: Props) {
  const [plan, setPlan] = useState<RaisePlanPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [autonomy, setAutonomy] = useState<AutonomyLevel>(() => getAutonomyLevel());
  const [decisions, setDecisions] = useState<OracleDecision[]>([]);
  const [authorizing, setAuthorizing] = useState(false);
  const [planAuthorized, setPlanAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/wizard/${startupId}/raise-plan`);
        if (!res.ok) throw new Error('Could not load your raise plan');
        const data = (await res.json()) as RaisePlanPayload;
        if (cancelled) return;
        const saved = loadDecisionState(startupId);
        const merged = (data.decisions || []).map((d) => ({
          ...d,
          status: saved[d.id] || d.status,
        }));
        setPlan(data);
        setDecisions(merged);
        void trackFunnelEventOnce(`raise_plan_viewed:${startupId}:detail`, 'raise_plan_viewed', {
          startup_id: startupId,
          source: 'oracle_raise_plan_screen',
          qualified_investors: data.campaign?.qualified_investors,
          total_gaps: data.total_gaps,
        });
        for (const d of merged.filter((x) => x.status === 'pending')) {
          void trackFunnelEventOnce(`decision_card_viewed:${startupId}:${d.id}`, 'decision_card_viewed', {
            startup_id: startupId,
            decision_id: d.id,
            decision_type: d.type,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Something went wrong');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [startupId]);

  const handleAutonomyChange = (level: AutonomyLevel) => {
    setAutonomy(level);
    setAutonomyLevel(level);
  };

  const handleAuthorize = () => {
    if (!plan) return;
    setAuthorizing(true);
    markRaisePlanAuthorized(startupId, autonomy);
    setPlanAuthorized(true);
    onAuthorized(plan);
    setAuthorizing(false);
  };

  const handleDecisionApprove = (decision: OracleDecision) => {
    approveDecision(startupId, decision);
    setDecisions((prev) =>
      prev.map((d) => (d.id === decision.id ? { ...d, status: 'approved' as const } : d)),
    );
  };

  const handleDecisionDefer = (decision: OracleDecision) => {
    deferDecision(startupId, decision);
    setDecisions((prev) =>
      prev.map((d) => (d.id === decision.id ? { ...d, status: 'deferred' as const } : d)),
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: 'oklch(0.13 0.01 264)' }}>
        <Loader2 className="w-8 h-8 animate-spin text-emerald-400 mb-4" />
        <p className="text-sm" style={{ color: 'oklch(0.55 0.01 264)' }}>Oracle is building your raise plan…</p>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: 'oklch(0.13 0.01 264)' }}>
        <p className="text-sm text-red-400 mb-4">{error || 'Plan unavailable'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10" style={{ backgroundColor: 'oklch(0.13 0.01 264)' }}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <p className="text-[10px] font-semibold tracking-widest mb-2" style={{ color: '#22d3ee' }}>
            ORACLE · YOUR RAISE PLAN
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: 'oklch(0.94 0.005 264)' }}>
            {plan.startup_name}
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'oklch(0.55 0.01 264)' }}>
            {plan.oracle_message}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'READINESS', value: `${plan.readiness_score}`, sub: `/100 → ${plan.projected_readiness} projected` },
            { label: 'QUALIFIED', value: String(plan.campaign.qualified_investors), sub: 'investors' },
            { label: 'GAPS', value: String(plan.total_gaps), sub: 'before outreach' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl p-3 text-center"
              style={{ backgroundColor: 'oklch(0.14 0.01 264)', border: '1px solid oklch(0.2 0.01 264)' }}
            >
              <p className="text-[9px] tracking-widest mb-1" style={{ color: 'oklch(0.42 0.01 264)' }}>{stat.label}</p>
              <p className="text-xl font-bold font-mono" style={{ color: '#22c55e' }}>{stat.value}</p>
              <p className="text-[10px] mt-0.5" style={{ color: 'oklch(0.45 0.01 264)' }}>{stat.sub}</p>
            </div>
          ))}
        </div>

        <section className="mb-8 rounded-xl p-5" style={{ backgroundColor: 'oklch(0.14 0.01 264)', border: '1px solid oklch(0.2 0.01 264)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Target size={14} style={{ color: '#22d3ee' }} />
            <p className="text-xs font-semibold tracking-widest" style={{ color: '#22d3ee' }}>CAMPAIGN</p>
          </div>
          <p className="text-sm font-semibold mb-1" style={{ color: 'oklch(0.94 0.005 264)' }}>{plan.campaign.headline}</p>
          <p className="text-xs mb-3" style={{ color: 'oklch(0.55 0.01 264)' }}>{plan.campaign.subline}</p>
          <p className="text-xs" style={{ color: 'oklch(0.45 0.01 264)' }}>
            {plan.campaign.qualified_investors} qualified of {plan.campaign.identified_investors} identified
            {plan.campaign.segments.length > 0 && (
              <> · Segments: {plan.campaign.segments.join(', ')}</>
            )}
          </p>
        </section>

        {plan.before_outreach.length > 0 && (
          <section className="mb-8">
            <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'oklch(0.42 0.01 264)' }}>
              BEFORE OUTREACH · COMPANY BUILDER
            </p>
            <div className="space-y-2">
              {plan.before_outreach.map((gap) => (
                <div
                  key={gap.task_key}
                  className="flex items-center justify-between rounded-lg px-4 py-3"
                  style={{ backgroundColor: 'oklch(0.14 0.01 264)', border: '1px solid oklch(0.2 0.01 264)' }}
                >
                  <div>
                    <p className="text-sm" style={{ color: 'oklch(0.88 0.005 264)' }}>{gap.title}</p>
                    <p className="text-[10px]" style={{ color: 'oklch(0.45 0.01 264)' }}>{gap.component_label}</p>
                  </div>
                  <span className="text-xs font-mono" style={{ color: '#22c55e' }}>+{gap.impact_points}</span>
                </div>
              ))}
            </div>
            {onOpenWizard && (
              <button
                type="button"
                onClick={onOpenWizard}
                className="mt-3 text-xs underline"
                style={{ color: 'oklch(0.696 0.17 162.48)' }}
              >
                Open readiness unlocks →
              </button>
            )}
          </section>
        )}

        <section className="mb-8">
          <p className="text-xs font-semibold tracking-widest mb-3" style={{ color: 'oklch(0.42 0.01 264)' }}>
            AUTONOMY LEVEL
          </p>
          <div className="space-y-2">
            {AUTONOMY_OPTIONS.map((opt) => (
              <label
                key={opt.id}
                className="flex items-start gap-3 rounded-lg px-4 py-3 cursor-pointer"
                style={{
                  backgroundColor: autonomy === opt.id ? 'oklch(0.696 0.17 162.48 / 0.08)' : 'oklch(0.14 0.01 264)',
                  border: `1px solid ${autonomy === opt.id ? 'oklch(0.696 0.17 162.48 / 0.35)' : 'oklch(0.2 0.01 264)'}`,
                }}
              >
                <input
                  type="radio"
                  name="autonomy"
                  checked={autonomy === opt.id}
                  onChange={() => handleAutonomyChange(opt.id)}
                  className="mt-1"
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'oklch(0.94 0.005 264)' }}>{opt.label}</p>
                  <p className="text-xs" style={{ color: 'oklch(0.5 0.01 264)' }}>{opt.detail}</p>
                </div>
              </label>
            ))}
          </div>
        </section>

        {decisions.length > 0 && (
          <section className="mb-8 space-y-3">
            <p className="text-xs font-semibold tracking-widest" style={{ color: 'oklch(0.42 0.01 264)' }}>
              DECISIONS QUEUE
            </p>
            {decisions.map((d) => (
              <OracleDecisionCard
                key={d.id}
                decision={d}
                locked={Boolean(d.requires_plan_auth && !planAuthorized)}
                onApprove={
                  d.status === 'pending' && (!d.requires_plan_auth || planAuthorized)
                    ? () => handleDecisionApprove(d)
                    : undefined
                }
                onDefer={d.status === 'pending' ? () => handleDecisionDefer(d) : undefined}
                onView={
                  d.type === 'readiness' && onOpenWizard ? onOpenWizard : undefined
                }
              />
            ))}
          </section>
        )}

        <button
          type="button"
          disabled={authorizing || planAuthorized}
          onClick={handleAuthorize}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold text-black disabled:opacity-60"
          style={{ background: '#22c55e' }}
        >
          <Sparkles size={16} />
          {planAuthorized ? 'Plan authorized' : authorizing ? 'Authorizing…' : 'Authorize plan'}
          {!planAuthorized && <ArrowRight size={16} />}
        </button>
        <p className="text-center text-[10px] mt-3" style={{ color: 'oklch(0.38 0.01 264)' }}>
          Oracle continues working on readiness and campaign prep while you review
        </p>
      </div>
    </div>
  );
}
