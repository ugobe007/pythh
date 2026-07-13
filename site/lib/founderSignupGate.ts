/**
 * Post-reveal founder signup gate — attribution for preview_to_signup_conversion.
 */

import { fetchGrowthAssignment, trackGrowthEvent, type GrowthAssignment } from '@/lib/growthExperiment';
import { trackFunnelEvent } from '@/lib/matchEngagement';
import { getUtmParams } from '@/lib/funnelAttribution';

export type FounderGatedAction = 'save' | 'intro' | 'export' | 'delta' | 'oracle_gap';

const POST_SIGNUP_PATH_KEY = 'pythia_post_signup_path';
const GATE_PENDING_KEY = 'pythia_founder_gate_pending';
const GATED_ACTION_KEY = 'pythia_gated_action';
const GATED_INVESTOR_KEY = 'pythia_gated_investor';
const STORAGE_KEY = 'pyth_growth_assignment';

export type GatedInvestorContext = {
  id: string;
  name: string;
  firm?: string | null;
};

const FALLBACK_FOUNDER_ASSIGNMENT: GrowthAssignment = {
  experiment_id: 'founder_hero_entry',
  variant_key: 'matches_preview',
  audience: 'founder',
  schema: {},
  copy: {},
};

function getCachedAssignment(audience: 'founder' | 'investor'): GrowthAssignment | null {
  const cacheKey = `${STORAGE_KEY}:${audience}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (!cached) return null;
  try {
    return JSON.parse(cached) as GrowthAssignment;
  } catch {
    return null;
  }
}

async function resolveFounderAssignment(): Promise<GrowthAssignment> {
  return getCachedAssignment('founder') ?? (await fetchGrowthAssignment('founder')) ?? FALLBACK_FOUNDER_ASSIGNMENT;
}

export function peekFounderGatePending(): {
  action: FounderGatedAction | null;
  pending: boolean;
  investor: GatedInvestorContext | null;
} {
  const pending = sessionStorage.getItem(GATE_PENDING_KEY);
  if (!pending) return { action: null, pending: false, investor: null };
  let investor: GatedInvestorContext | null = null;
  try {
    const raw = sessionStorage.getItem(GATED_INVESTOR_KEY);
    if (raw) investor = JSON.parse(raw) as GatedInvestorContext;
  } catch {
    investor = null;
  }
  return {
    pending: true,
    action: (sessionStorage.getItem(GATED_ACTION_KEY) as FounderGatedAction | null) ?? null,
    investor,
  };
}

export const FOUNDER_GATE_ACTION_LABELS: Record<FounderGatedAction, string> = {
  save: 'track your investor shortlist',
  intro: 'track intros to your top matches',
  export: 'export and track your match list',
  delta: 'see which investors moved toward you',
  oracle_gap: 'see your Oracle gap map and unlock outreach',
};

export function postSignupPathForAction(
  action: FounderGatedAction | null,
  startupId: string,
): string {
  if (action === 'intro' || action === 'export') {
    return `/wizard/${startupId}?tab=round`;
  }
  return `/wizard/${startupId}`;
}

export function persistFounderGateContext(
  url: string,
  startupId: string,
  action: FounderGatedAction,
  investor?: GatedInvestorContext | null,
) {
  sessionStorage.setItem('pythia_url', url);
  sessionStorage.setItem('pythia_startup_id', startupId);
  sessionStorage.setItem(GATED_ACTION_KEY, action);
  sessionStorage.setItem(GATE_PENDING_KEY, '1');
  if (investor?.id) {
    sessionStorage.setItem(GATED_INVESTOR_KEY, JSON.stringify(investor));
  } else {
    sessionStorage.removeItem(GATED_INVESTOR_KEY);
  }
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

const PREVIEW_GATE_EXPERIMENTS: Partial<Record<FounderGatedAction, string>> = {
  oracle_gap: 'founder_preview_oracle_gap_gate',
  delta: 'founder_preview_signal_delta_gate',
};

/** Fire when user clicks a post-reveal gated action (save / intro / export). */
export async function trackFounderGateStarted(
  action: FounderGatedAction,
  ctx: {
    url: string;
    startupId: string;
    investor?: GatedInvestorContext | null;
  },
  assignmentRef?: GrowthAssignment | null,
  gateCtaAssignment?: GrowthAssignment | null,
  previewGateAssignment?: GrowthAssignment | null,
) {
  persistFounderGateContext(ctx.url, ctx.startupId, action, ctx.investor);

  if (action === 'intro') {
    trackFunnelEvent('match_intro_requested', {
      startup_id: ctx.startupId,
      investor_id: ctx.investor?.id,
      investor_name: ctx.investor?.name,
      url: ctx.url,
      source: 'instant_preview_gate',
      gated_action: action,
    });
  }

  const gatePayload = {
    url: ctx.url,
    startup_id: ctx.startupId,
    gated_action: action,
    investor_id: ctx.investor?.id,
    investor_name: ctx.investor?.name,
    ...getUtmParams(),
  };

  const assignment = await resolveAssignment(assignmentRef ?? null);
  const resolved = assignment ?? (await fetchGrowthAssignment('founder')) ?? FALLBACK_FOUNDER_ASSIGNMENT;
  await trackGrowthEvent(resolved, 'founder_signup_started', gatePayload);

  if (gateCtaAssignment) {
    await trackGrowthEvent(gateCtaAssignment, 'founder_signup_started', {
      ...gatePayload,
      gate_cta_experiment: gateCtaAssignment.experiment_id,
    });
  }

  const previewExp =
    previewGateAssignment ??
    (PREVIEW_GATE_EXPERIMENTS[action]
      ? await fetchGrowthAssignment('founder', PREVIEW_GATE_EXPERIMENTS[action])
      : null);
  if (previewExp) {
    await trackGrowthEvent(previewExp, 'founder_signup_started', {
      ...gatePayload,
      preview_gate_experiment: previewExp.experiment_id,
    });
  }
}

/** Fire when founder completes email+URL on /activate after a gated CTA. */
export async function trackFounderGateCompleted(
  ctx: { url: string; email?: string; startupId?: string | null; gatedAction?: FounderGatedAction | null },
) {
  const gatedAction = ctx.gatedAction ?? (sessionStorage.getItem(GATED_ACTION_KEY) as FounderGatedAction | null);
  const startupId = ctx.startupId ?? sessionStorage.getItem('pythia_startup_id');

  if (startupId && gatedAction) {
    sessionStorage.setItem(POST_SIGNUP_PATH_KEY, postSignupPathForAction(gatedAction, startupId));
  } else if (startupId) {
    sessionStorage.setItem(POST_SIGNUP_PATH_KEY, `/wizard/${startupId}`);
  }

  trackFunnelEvent('lookup_signup_completed', {
    url: ctx.url,
    source: 'preview_gate',
    gated_action: gatedAction,
    email_provided: Boolean(ctx.email),
    startup_id: startupId,
    ...getUtmParams(),
  });

  const completedPayload = {
    url: ctx.url,
    startup_id: startupId,
    gated_action: gatedAction,
    email_provided: Boolean(ctx.email),
    ...getUtmParams(),
  };

  const assignment = await resolveFounderAssignment();
  await trackGrowthEvent(assignment, 'founder_signup_completed', {
    ...completedPayload,
    attribution_fallback: assignment.experiment_id === FALLBACK_FOUNDER_ASSIGNMENT.experiment_id
      && assignment.variant_key === FALLBACK_FOUNDER_ASSIGNMENT.variant_key,
  });

  if (gatedAction && PREVIEW_GATE_EXPERIMENTS[gatedAction]) {
    const previewExp = await fetchGrowthAssignment('founder', PREVIEW_GATE_EXPERIMENTS[gatedAction]);
    if (previewExp) {
      await trackGrowthEvent(previewExp, 'founder_signup_completed', {
        ...completedPayload,
        preview_gate_experiment: previewExp.experiment_id,
      });
    }
  }

  sessionStorage.removeItem(GATED_ACTION_KEY);
  sessionStorage.removeItem('pythia_startup_id');
  sessionStorage.removeItem(GATED_INVESTOR_KEY);
}

export function consumePostSignupPath(): string | null {
  const path = sessionStorage.getItem(POST_SIGNUP_PATH_KEY);
  if (path) sessionStorage.removeItem(POST_SIGNUP_PATH_KEY);
  return path;
}
