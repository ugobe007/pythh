/**
 * Canonical founder pricing — Scout / Oracle / Pantheon.
 * Used by Pricing page, Stripe checkout, Account, and subscription gates.
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
  tagline: "Run a real raise — not a teaser",
  headline: "3 active outreach campaigns",
  monthlyPrice: 19,
  annualPrice: 16,
  monthlyCents: 1900,
  annualCents: 19200,
  outreachCampaigns: 3,
  investorsPerCampaign: 50,
  trialDays: 14,
  cta: "Start 14-day free trial",
  featured: false,
  color: "oklch(0.696 0.17 162.48)",
  borderColor: "oklch(0.696 0.17 162.48 / 0.35)",
  highlights: [
    "3 PYTHIA campaigns · 50 investors each (150 automated touches/mo)",
    "Unlimited match scans + full investor rankings",
    "Automated sends + 2-touch follow-up sequences",
    "Reply tracking, pipeline dashboard, investment memo export",
    "Full GOD score + readiness gap analysis",
  ],
};

export const ORACLE_PLAN: PricingPlanConfig = {
  id: "oracle",
  stripePlanId: "oracle",
  name: "Oracle",
  tagline: "Parallel campaigns for serious rounds",
  headline: "10 concurrent outreach campaigns",
  monthlyPrice: 49,
  annualPrice: 41,
  monthlyCents: 4900,
  annualCents: 49200,
  outreachCampaigns: 10,
  investorsPerCampaign: "unlimited",
  trialDays: 14,
  cta: "Start 14-day free trial",
  featured: true,
  color: "oklch(0.769 0.188 70.08)",
  borderColor: "oklch(0.769 0.188 70.08 / 0.45)",
  highlights: [
    "10 PYTHIA campaigns · unlimited investors per campaign",
    "Everything in Scout + multi-segment parallel outreach",
    "Smart follow-up sequences (up to 5 touches)",
    "Pre-meeting briefs, Q&A prep, meeting booking flow",
    "Full signal intel + co-investor context · 5 team seats",
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

export const PAID_FOUNDER_PLANS = new Set<string>(["scout", "oracle", "pantheon"]);

export function isPaidFounderPlan(plan: string | null | undefined): boolean {
  return !!plan && PAID_FOUNDER_PLANS.has(plan);
}

/** Full rankings database (44+ investors) — Scout and above. */
export function hasFullRankingsAccess(plan: string | null | undefined): boolean {
  return isPaidFounderPlan(plan);
}

/** Private investor thesis profiles — Oracle and above. */
export function hasPrivateInvestorAccess(plan: string | null | undefined): boolean {
  return plan === "oracle" || plan === "pantheon";
}

export function getPlanConfig(planId: string): PricingPlanConfig | null {
  if (planId === "scout") return SCOUT_PLAN;
  if (planId === "oracle") return ORACLE_PLAN;
  if (planId === "pantheon") return PANTHEON_PLAN;
  return null;
}

export function getCheckoutPlan(planId: PaidPlanId): PricingPlanConfig {
  return planId === "scout" ? SCOUT_PLAN : ORACLE_PLAN;
}

export function getPlanLimits(planId: string): {
  outreachCampaigns: number | "unlimited";
  investorsPerCampaign: number | "unlimited";
} {
  const plan = getPlanConfig(planId);
  if (!plan) {
    return { outreachCampaigns: 0, investorsPerCampaign: 0 };
  }
  return {
    outreachCampaigns: plan.outreachCampaigns,
    investorsPerCampaign: plan.investorsPerCampaign,
  };
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

/** Rough monthly automated touch capacity for marketing copy. */
export function estimatedMonthlyTouches(plan: PricingPlanConfig): number | "unlimited" {
  if (plan.outreachCampaigns === "unlimited" || plan.investorsPerCampaign === "unlimited") {
    return "unlimited";
  }
  return plan.outreachCampaigns * plan.investorsPerCampaign;
}

export function planPriceLabel(
  planId: string,
  billingCycle: "monthly" | "annual",
): { perMonth: string; billed: string } {
  const plan = getPlanConfig(planId);
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
    scout: "3 active",
    oracle: "10 concurrent",
    pantheon: "Unlimited",
    highlight: true,
  },
  {
    label: "Investors per campaign",
    scout: "50",
    oracle: "Unlimited",
    pantheon: "Unlimited",
    highlight: true,
  },
  {
    label: "Automated touches / month (est.)",
    scout: "150",
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
    label: "Full investor rankings (44+)",
    scout: true,
    oracle: true,
    pantheon: true,
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
    scout: "2-touch",
    oracle: "5-touch smart",
    pantheon: "Custom",
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
    label: "Private investor profiles",
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
    label: "Team seats",
    scout: "1",
    oracle: "5",
    pantheon: "Unlimited",
  },
  {
    label: "Free trial",
    scout: "14 days",
    oracle: "14 days",
    pantheon: "—",
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
