/**
 * Pending Oracle decisions on results / command surfaces.
 */

import { useEffect, useState } from 'react';
import OracleDecisionCard from '@/components/OracleDecisionCard';
import {
  type OracleDecision,
  approveDecision,
  deferDecision,
  isRaisePlanAuthorized,
  loadDecisionState,
} from '@/lib/oracleRaisePlan';
import { trackFunnelEventOnce } from '@/lib/matchEngagement';

type Props = {
  startupId: string;
  onOpenWizard?: () => void;
};

export default function OracleDecisionQueue({ startupId, onOpenWizard }: Props) {
  const [decisions, setDecisions] = useState<OracleDecision[]>([]);

  useEffect(() => {
    if (!isRaisePlanAuthorized(startupId)) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/wizard/${startupId}/raise-plan`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const saved = loadDecisionState(startupId);
        const pending = (data.decisions || [])
          .map((d: OracleDecision) => ({ ...d, status: saved[d.id] || d.status }))
          .filter((d: OracleDecision) => d.status === 'pending' && d.requires_plan_auth);
        setDecisions(pending);
        for (const d of pending) {
          void trackFunnelEventOnce(`decision_card_viewed:${startupId}:${d.id}:results`, 'decision_card_viewed', {
            startup_id: startupId,
            decision_id: d.id,
            source: 'activate_results',
          });
        }
      } catch {
        /* non-blocking */
      }
    })();
    return () => { cancelled = true; };
  }, [startupId]);

  if (!decisions.length) return null;

  return (
    <div className="mb-8 space-y-3">
      <p className="text-[10px] font-semibold tracking-widest" style={{ color: '#22d3ee' }}>
        ORACLE · DECISIONS NEEDED
      </p>
      {decisions.map((d) => (
        <OracleDecisionCard
          key={d.id}
          decision={d}
          onApprove={() => {
            approveDecision(startupId, d);
            setDecisions((prev) => prev.filter((x) => x.id !== d.id));
          }}
          onDefer={() => {
            deferDecision(startupId, d);
            setDecisions((prev) => prev.filter((x) => x.id !== d.id));
          }}
          onView={d.type === 'readiness' ? onOpenWizard : undefined}
        />
      ))}
    </div>
  );
}
