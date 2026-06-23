/**
 * Post-reveal founder signup gate — attribution for preview_to_signup_conversion.
 */

import { fetchGrowthAssignment, trackGrowthEvent, type GrowthAssignment } from '@/lib/growthExperiment';
import { trackFunnelEvent } from '@/lib/matchEngagement';

export type FounderGatedAction = 'save' | 'intro' | 'export';

const GATE_PENDING_KEY = 'pythia_founder_gate_pending';
const GATED_ACTION_KEY = 'pythia_gated_action';

export function persistFounderGateContext(url: string, startupId: string, action: FounderGatedAction) {
  sessionStorage.setItem('pythia_url', url);
  sessionStorage.setItem('pythia_startup_id', startupId);
  sessionStorage.setItem(GATED_ACTION_KEY, action);
  sessionStorage.setItem(GATE_PENDING_KEY, '1');
}

export function consumeFounderGatePending(): { action: FounderGatedAction | null } {
  const pending = sessionStorage.getItem(GATE_PENDING_KEY);
  if (!pending) return { action: null };
  const action = (sessionStorage.getItem(GATED_ACTION_KEY) as FounderGatedAction | null) ?? null;
  sessionStorage.removeItem(GATE_PENDING_KEY);
  return { action };
}

async function resolveAssignment(existing: GrowthAssignment | null): Promise<GrowthAssignment | null> {
  if (existing) return existing;
  return fetchGrowthAssignment('founder');
}

/** Fire when user clicks a post-reveal gated action (save / intro / export). */
export async function trackFounderGateStarted(
  action: FounderGatedAction,
  ctx: { url: string; startupId: string },
  assignmentRef?: GrowthAssignment | null,
) {
  persistFounderGateContext(ctx.url, ctx.startupId, action);

  if (action === 'intro') {
    trackFunnelEvent('match_intro_requested', {
      startup_id: ctx.startupId,
      url: ctx.url,
      source: 'instant_preview_gate',
      gated_action: action,
    });
  }

  const assignment = await resolveAssignment(assignmentRef ?? null);
  if (assignment) {
    await trackGrowthEvent(assignment, 'founder_signup_started', {
      url: ctx.url,
      startup_id: ctx.startupId,
      gated_action: action,
    });
  }
}

/** Fire when founder completes email+URL on /activate after a gated CTA. */
export async function trackFounderGateCompleted(
  ctx: { url: string; email?: string; startupId?: string | null; gatedAction?: FounderGatedAction | null },
) {
  const assignment = await fetchGrowthAssignment('founder');
  if (assignment) {
    await trackGrowthEvent(assignment, 'founder_signup_completed', {
      url: ctx.url,
      startup_id: ctx.startupId ?? sessionStorage.getItem('pythia_startup_id'),
      gated_action: ctx.gatedAction ?? sessionStorage.getItem(GATED_ACTION_KEY),
      email_provided: Boolean(ctx.email),
    });
  }
  trackFunnelEvent('lookup_signup_completed', {
    url: ctx.url,
    source: 'preview_gate',
    gated_action: ctx.gatedAction ?? sessionStorage.getItem(GATED_ACTION_KEY),
  });
  sessionStorage.removeItem(GATED_ACTION_KEY);
  sessionStorage.removeItem('pythia_startup_id');
}
