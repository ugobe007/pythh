/**
 * Canonical founder pricing — Scout / Oracle / Pantheon.
 * Used by Pricing page, Stripe checkout, Account, and webhook copy.
 */

export type PaidPlanId = "scout" | "oracle";

export interface PricingPlanConfig {
  id: PaidPlanId | "pantheon";
  stripePlanId?: PaidPlanId;
  name: string;
  tagline: string;
  headline: string;
  monthlyPrice: number | null;
  annualPrice: number | null;
  monthlyCents: number | null;
  annualCents: number | null;
  outreachCampaigns: number | "unlimited";
  investorsPerCampaign: number | "unlimited";
  trialDays: number;
  cta: string;
  ctaHref?: string;
  featured: boolean;
  color: string;
  borderColor: string;
  highlights: string[];
}

export const SCOUT_PLAN: PricingPlanConfig = {
  id: "scout",
  stripePlanId: "scout",
  name: "Scout",
  tagline: "Your first raise, handled",
  headline: "1 active outreach campaign",
  monthlyPrice: 19,
  annualPrice: 16,
  monthlyCents: 1900,
  annualCents: 19200,
  outreachCampaigns: 1,
  investorsPerCampaign: 25,
  trialDays: 7,
  cta: "Start 7-day free trial",
  featured: false,
  color: "oklch(0.696 0.17 162.48)",
  borderColor: "oklch(0.696 0.17 162.48 / 0.35)",
  highlights: [
    "Unlimited investor match scans",
    "Full GOD score + readiness analysis",
    "PYTHIA writes & sends to your top 25 matches",
    "Reply tracking + pipeline dashboard",
    "Personalized drafts for every match",
  ],
};

export const ORACLE_PLAN: PricingPlanConfig = {
  id: "oracle",
  stripePlanId: "oracle",
  name: "Oracle",
  tagline: "Run your round on autopilot",
  headline: "5 concurrent outreach campaigns",
  monthlyPrice: 49,
  annualPrice: 41,
  monthlyCents: 4900,
  annualCents: 49200,
  outreachCampaigns: 5,
  investorsPerCampaign: "unlimited",
  trialDays: 7,
  cta: "Start 7-day free trial",
  featured: true,
  color: "oklch(0.769 0.188 70.08)",
  borderColor: "oklch(0.769 0.188 70.08 / 0.45)",
  highlights: [
    "Everything in Scout",
    "Automated follow-up sequences",
    "Pre-meeting briefs + Q&A prep",
    "Meeting approval & booking flow",
    "Co-investor context + signal intel",
    "3 team seats",
  ],
};

export const PANTHEON_PLAN: PricingPlanConfig = {
  id: "pantheon",
  name: "Pantheon",
  tagline: "For funds & studios",
  headline: "Unlimited campaigns",
  monthlyPrice: null,
  annualPrice: null,
  monthlyCents: null,
  annualCents: null,
  outreachCampaigns: "unlimited",
  investorsPerCampaign: "unlimited",
  trialDays: 0,
  cta: "Talk to us",
  ctaHref: "mailto:hello@pythh.ai",
  featured: false,
  color: "oklch(0.696 0.17 162.48)",
  borderColor: "oklch(0.696 0.17 162.48 / 0.35)",
  highlights: [
    "Unlimited PYTHIA threads",
    "CRM sync + custom investor filters",
    "Dedicated success manager",
    "Priority Slack support",
  ],
};

export const FOUNDER_PLANS = [SCOUT_PLAN, ORACLE_PLAN, PANTHEON_PLAN] as const;

export function getCheckoutPlan(planId: PaidPlanId): PricingPlanConfig {
  return planId === "scout" ? SCOUT_PLAN : ORACLE_PLAN;
}

export function formatCampaignLimit(plan: PricingPlanConfig): string {
  const campaigns =
    plan.outreachCampaigns === "unlimited"
      ? "Unlimited campaigns"
      : `${plan.outreachCampaigns} outreach campaign${plan.outreachCampaigns === 1 ? "" : "s"}`;
  const investors =
    plan.investorsPerCampaign === "unlimited"
      ? "unlimited investors per campaign"
      : `up to ${plan.investorsPerCampaign} investors each`;
  return `${campaigns} · ${investors}`;
}

export function planPriceLabel(
  planId: string,
  billingCycle: "monthly" | "annual",
): { perMonth: string; billed: string } {
  const plan =
    planId === "scout" ? SCOUT_PLAN : planId === "oracle" ? ORACLE_PLAN : null;
  if (!plan?.monthlyPrice) {
    return { perMonth: "Custom", billed: "Contact us" };
  }
  const perMonth = billingCycle === "annual" ? plan.annualPrice! : plan.monthlyPrice;
  const billed =
    billingCycle === "annual"
      ? `$${plan.annualCents! / 100}/yr`
      : "Billed monthly";
  return { perMonth: `$${perMonth}`, billed };
}

export function checkoutAmountLabel(
  planId: PaidPlanId,
  billingCycle: "monthly" | "annual",
): string {
  const plan = getCheckoutPlan(planId);
  if (billingCycle === "annual") {
    return `$${plan.annualCents! / 100}/yr`;
  }
  return `$${plan.monthlyPrice}/mo`;
}

interface PlanFeatureRow {
  label: string;
  scout: string | boolean;
  oracle: string | boolean;
  pantheon: string | boolean;
  highlight?: boolean;
}

export const PRICING_FEATURE_ROWS: PlanFeatureRow[] = [
  {
    label: "Outreach campaigns",
    scout: "1 active",
    oracle: "5 concurrent",
    pantheon: "Unlimited",
    highlight: true,
  },
  {
    label: "Investors per campaign",
    scout: "25",
    oracle: "Unlimited",
    pantheon: "Unlimited",
    highlight: true,
  },
  {
    label: "Investor match scans",
    scout: "Unlimited",
    oracle: "Unlimited",
    pantheon: "Unlimited",
    highlight: true,
  },
  {
    label: "PYTHIA automated sends",
    scout: true,
    oracle: true,
    pantheon: true,
    highlight: true,
  },
  {
    label: "Follow-up sequences",
    scout: "Basic",
    oracle: true,
    pantheon: true,
  },
  {
    label: "Readiness score + gap analysis",
    scout: true,
    oracle: true,
    pantheon: true,
  },
  {
    label: "Pre-meeting brief + Q&A prep",
    scout: false,
    oracle: true,
    pantheon: true,
  },
  {
    label: "Meeting booking flow",
    scout: false,
    oracle: true,
    pantheon: true,
  },
  {
    label: "Investor signal intelligence",
    scout: "Top signals",
    oracle: "Full access",
    pantheon: "Full access",
  },
  {
    label: "Team seats",
    scout: "1",
    oracle: "3",
    pantheon: "Unlimited",
  },
  {
    label: "CRM integrations",
    scout: false,
    oracle: false,
    pantheon: true,
  },
  {
    label: "Dedicated success manager",
    scout: false,
    oracle: false,
    pantheon: true,
  },
];
