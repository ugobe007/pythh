'use strict';

/**
 * Founder outreach campaign quotas — Scout 3 / Oracle 10 / Pantheon unlimited.
 * A campaign = one startup with an activated PYTHIA round (round_activated_at).
 */

const { pool } = require('../db');

const PLAN_LIMITS = {
  scout: { campaigns: 3, investorsPerCampaign: 50 },
  oracle: { campaigns: 10, investorsPerCampaign: Infinity },
  pantheon: { campaigns: Infinity, investorsPerCampaign: Infinity },
};

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function getLimitsForPlan(plan) {
  if (!plan || plan === 'free') {
    return { campaigns: 0, investorsPerCampaign: 0, plan: null };
  }
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.scout;
  return { ...limits, plan };
}

async function getFounderPlanByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized || !process.env.DATABASE_URL) return null;

  try {
    const { rows } = await pool.query(
      `SELECT s.plan, s.status
       FROM pythh_subscriptions s
       JOIN pythh_users u ON u.id = s.user_id
       WHERE lower(u.email) = $1
         AND s.status IN ('active', 'trialing', 'paused')
       ORDER BY s.updated_at DESC
       LIMIT 1`,
      [normalized],
    );
    return rows[0]?.plan || null;
  } catch (err) {
    console.warn('[campaignQuota] subscription lookup failed:', err.message);
    return null;
  }
}

async function resolveFounderEmail(supabase, startupId, overrideEmail) {
  const direct = normalizeEmail(overrideEmail);
  if (direct) return direct;

  const { data: startup } = await supabase
    .from('startup_uploads')
    .select('submitted_email, claimed_by')
    .eq('id', startupId)
    .maybeSingle();

  return normalizeEmail(startup?.submitted_email || startup?.claimed_by || '');
}

async function listFounderStartupIds(supabase, founderEmail) {
  const email = normalizeEmail(founderEmail);
  if (!email) return [];

  const [bySubmitted, byClaimed] = await Promise.all([
    supabase.from('startup_uploads').select('id').ilike('submitted_email', email),
    supabase.from('startup_uploads').select('id').ilike('claimed_by', email),
  ]);

  const ids = new Set();
  for (const row of bySubmitted.data || []) ids.add(row.id);
  for (const row of byClaimed.data || []) ids.add(row.id);
  return [...ids];
}

async function countActiveCampaigns(supabase, founderEmail) {
  const startupIds = await listFounderStartupIds(supabase, founderEmail);
  if (startupIds.length === 0) {
    return { activeCount: 0, activeStartups: [] };
  }

  const { data: docs, error } = await supabase
    .from('commitment_documents')
    .select('startup_id, content, version, generated_at')
    .in('startup_id', startupIds)
    .order('version', { ascending: false });

  if (error) {
    console.warn('[campaignQuota] doc fetch error:', error.message);
    return { activeCount: 0, activeStartups: [] };
  }

  const latestByStartup = new Map();
  for (const doc of docs || []) {
    if (!latestByStartup.has(doc.startup_id)) {
      latestByStartup.set(doc.startup_id, doc);
    }
  }

  const activeStartups = [];
  for (const [startupId, doc] of latestByStartup.entries()) {
    const activatedAt = doc.content?.header?.round_activated_at;
    if (activatedAt) {
      activeStartups.push({
        startup_id: startupId,
        activated_at: activatedAt,
        startup_name: doc.content?.header?.startup_name || null,
      });
    }
  }

  return { activeCount: activeStartups.length, activeStartups };
}

/**
 * Build quota payload for UI + activate-round gate.
 */
async function buildCampaignQuota(supabase, { startupId, founderEmail }) {
  const email = await resolveFounderEmail(supabase, startupId, founderEmail);
  const plan = email ? await getFounderPlanByEmail(email) : null;
  const limits = getLimitsForPlan(plan);
  const { activeCount, activeStartups } = email
    ? await countActiveCampaigns(supabase, email)
    : { activeCount: 0, activeStartups: [] };

  const currentIsActive = activeStartups.some((s) => s.startup_id === startupId);
  const slotsUsed = currentIsActive ? activeCount : activeCount;
  const atLimit =
    limits.campaigns !== Infinity &&
    !currentIsActive &&
    activeCount >= limits.campaigns;

  const hasSubscription = Boolean(plan);
  const canActivate =
    hasSubscription &&
    !atLimit &&
    (limits.campaigns === Infinity || activeCount < limits.campaigns || currentIsActive);

  let upgradePlan = null;
  let message = null;

  if (!hasSubscription) {
    message = 'Start a Scout or Oracle trial to activate PYTHIA automated outreach.';
    upgradePlan = 'scout';
  } else if (atLimit) {
    upgradePlan = plan === 'scout' ? 'oracle' : 'pantheon';
    message =
      plan === 'scout'
        ? `You've used all ${limits.campaigns} Scout campaigns. Upgrade to Oracle for ${PLAN_LIMITS.oracle.campaigns} concurrent campaigns.`
        : 'Contact us for Pantheon unlimited campaigns.';
  }

  return {
    founder_email: email || null,
    plan: plan || 'none',
    active_count: activeCount,
    campaign_limit: limits.campaigns === Infinity ? null : limits.campaigns,
    investors_per_campaign: limits.investorsPerCampaign === Infinity ? null : limits.investorsPerCampaign,
    slots_remaining:
      limits.campaigns === Infinity
        ? null
        : Math.max(0, limits.campaigns - (currentIsActive ? activeCount - 1 : activeCount)),
    current_startup_active: currentIsActive,
    can_activate: canActivate,
    at_limit: atLimit,
    upgrade_plan: upgradePlan,
    message,
    active_campaigns: activeStartups,
    estimated_monthly_touches:
      limits.investorsPerCampaign === Infinity || limits.campaigns === Infinity
        ? null
        : limits.campaigns * limits.investorsPerCampaign,
  };
}

module.exports = {
  PLAN_LIMITS,
  getLimitsForPlan,
  getFounderPlanByEmail,
  buildCampaignQuota,
  countActiveCampaigns,
};
