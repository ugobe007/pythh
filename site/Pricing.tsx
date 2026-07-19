/*
 * PYTHH.AI — PRICING PAGE
 * Outcome-led tiers: Scout ($19) · Oracle ($49) · Pantheon (custom)
 */
import { Helmet } from "react-helmet-async";
import { useState, useEffect } from "react";
import { Check, X, Building2, Loader2, CheckCircle2, Target, Zap, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import SharedNavbar from "@/components/SharedNavbar";
import SectionLabel from "@/components/design/SectionLabel";
import FilterTabs from "@/components/design/FilterTabs";
import StrokeButton from "@/components/design/StrokeButton";
import StartupCTA from "@/components/design/StartupCTA";
import {
  G, GOLD, MUTED, DIM, BORDER, CARD, PAGE, TEXT, G_BORDER,
} from "@/lib/designTokens";
import { trackFunnelEvent, trackFunnelEventOnce } from "@/lib/matchEngagement";
import { fetchGrowthAssignment, trackGrowthEvent, type GrowthAssignment } from "@/lib/growthExperiment";
import {
  FOUNDER_PLANS,
  PRICING_FEATURE_ROWS,
  formatCampaignLimit,
  type PaidPlanId,
  type PricingPlanConfig,
} from "@/lib/pricingPlans";

type BillingCycle = "monthly" | "annual";

function FeatureCell({ value, color }: { value: string | boolean; color: string }) {
  if (value === true) return <Check size={14} style={{ color }} className="mx-auto" />;
  if (value === false) return <X size={14} style={{ color: DIM }} className="mx-auto" />;
  return (
    <span className="font-mono text-xs font-medium text-center block" style={{ color }}>
      {value}
    </span>
  );
}

function PlanCTA({
  plan,
  billing,
  onCheckout,
  isCheckingOut,
  activePlanId,
  oracleCtaLabel,
  isAuthenticated,
}: {
  plan: PricingPlanConfig;
  billing: BillingCycle;
  onCheckout?: (planId: PaidPlanId) => void;
  isCheckingOut?: boolean;
  activePlanId?: string | null;
  oracleCtaLabel?: string;
  isAuthenticated: boolean;
}) {
  if (plan.stripePlanId && activePlanId === plan.stripePlanId) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-2.5 text-sm font-mono w-full"
        style={{ color: G, border: `1px solid ${G_BORDER}` }}
      >
        <CheckCircle2 size={14} />
        Active plan
      </div>
    );
  }

  if (plan.stripePlanId && onCheckout) {
    const label =
      plan.id === "oracle" && oracleCtaLabel ? oracleCtaLabel : plan.cta;
    const loginHref = `/login?redirect=${encodeURIComponent("/pricing")}`;

    if (!isAuthenticated) {
      return (
        <StrokeButton href={loginHref} color={plan.color} borderColor={plan.borderColor} fullWidth showArrow>
          Sign in to start trial
        </StrokeButton>
      );
    }

    return (
      <StrokeButton
        type="button"
        onClick={() => onCheckout(plan.stripePlanId!)}
        disabled={isCheckingOut}
        color={plan.color}
        borderColor={plan.borderColor}
        fullWidth
        showArrow
      >
        {isCheckingOut ? (
          <>
            <Loader2 size={14} className="animate-spin" /> Redirecting…
          </>
        ) : (
          label
        )}
      </StrokeButton>
    );
  }

  return (
    <StrokeButton
      href={plan.ctaHref || "mailto:hello@pythh.ai"}
      color={plan.color}
      borderColor={plan.borderColor}
      fullWidth
      showArrow
    >
      {plan.cta}
    </StrokeButton>
  );
}

function PricingCard({
  plan,
  billing,
  onCheckout,
  checkingOutPlan,
  activePlanId,
  oracleCtaLabel,
  isAuthenticated,
}: {
  plan: PricingPlanConfig;
  billing: BillingCycle;
  onCheckout?: (planId: PaidPlanId) => void;
  checkingOutPlan?: PaidPlanId | null;
  activePlanId?: string | null;
  oracleCtaLabel?: string;
  isAuthenticated: boolean;
}) {
  return (
    <div
      className="border p-5 flex flex-col h-full relative"
      style={{
        backgroundColor: CARD,
        borderColor: plan.featured ? plan.borderColor : BORDER,
        boxShadow: plan.featured ? `0 0 0 1px ${plan.borderColor}` : undefined,
      }}
    >
      {plan.featured && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-[10px] font-bold tracking-widest uppercase"
          style={{ background: GOLD, color: "#0a0a0a" }}
        >
          Most founders
        </div>
      )}

      <div className="mb-4">
        <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: plan.color }}>
          {plan.name}
        </p>
        <p className="text-sm font-medium mb-2" style={{ color: TEXT }}>{plan.tagline}</p>
        <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{plan.headline}</p>
      </div>

      <div
        className="rounded-lg px-3 py-2 mb-4 text-[11px] font-mono"
        style={{
          backgroundColor: plan.featured ? "oklch(0.769 0.188 70.08 / 0.06)" : "oklch(0.696 0.17 162.48 / 0.06)",
          border: `1px solid ${plan.featured ? "oklch(0.769 0.188 70.08 / 0.2)" : "oklch(0.696 0.17 162.48 / 0.2)"}`,
          color: plan.featured ? GOLD : G,
        }}
      >
        {formatCampaignLimit(plan)}
      </div>

      <div className="mb-5">
        {plan.monthlyPrice != null ? (
          <>
            <div className="flex items-baseline gap-1">
              <span className="font-display font-bold text-3xl tabular-nums" style={{ color: TEXT }}>
                ${plan.monthlyPrice}
              </span>
              <span className="text-sm font-mono" style={{ color: DIM }}>/month</span>
            </div>
            {billing === "annual" && plan.annualPrice != null && (
              <p className="text-[11px] font-mono mt-1" style={{ color: G }}>
                ${plan.annualCents! / 100}/yr billed annually (${plan.annualPrice}/mo effective)
              </p>
            )}
            {billing === "monthly" && plan.trialDays > 0 && (
              <p className="text-[11px] font-mono mt-1" style={{ color: DIM }}>
                {plan.trialDays}-day free trial · cancel anytime
              </p>
            )}
          </>
        ) : (
          <span className="font-display font-bold text-2xl" style={{ color: TEXT }}>Custom</span>
        )}
      </div>

      <div className="mb-5">
        <PlanCTA
          plan={plan}
          billing={billing}
          onCheckout={onCheckout}
          isCheckingOut={checkingOutPlan === plan.stripePlanId}
          activePlanId={activePlanId}
          oracleCtaLabel={oracleCtaLabel}
          isAuthenticated={isAuthenticated}
        />
      </div>

      <div className="space-y-2.5 border-t pt-4 flex-1" style={{ borderColor: BORDER }}>
        {plan.highlights.map((line) => (
          <div key={line} className="flex items-start gap-2 text-xs leading-snug">
            <Check size={12} style={{ color: plan.color, flexShrink: 0, marginTop: 2 }} />
            <span style={{ color: MUTED }}>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Pricing() {
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const [showFullTable, setShowFullTable] = useState(false);
  const [pricingExp, setPricingExp] = useState<GrowthAssignment | null>(null);
  const [oracleCtaLabel, setOracleCtaLabel] = useState("Start 7-day free trial");
  const [checkingOutPlan, setCheckingOutPlan] = useState<PaidPlanId | null>(null);
  const { isAuthenticated } = useAuth();

  const { data: subscription } = trpc.stripe.getSubscription.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  const isActiveSubscriber =
    subscription?.status === "active" || subscription?.status === "trialing";

  useEffect(() => {
    void trackFunnelEventOnce("pythh_pricing_viewed", "pricing_viewed", {
      path: "/pricing",
      authenticated: isAuthenticated,
    });
    fetchGrowthAssignment("founder", "pricing_oracle_cta")
      .then((assignment) => {
        if (!assignment) return;
        setPricingExp(assignment);
        const headline = (assignment.copy as { headline?: string })?.headline;
        if (headline) setOracleCtaLabel(headline);
      })
      .catch(() => {});
  }, [isAuthenticated]);

  const checkoutMutation = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      setCheckingOutPlan(null);
      toast.error("Checkout failed", {
        description: err.message || "Unable to start checkout. Please try again.",
        duration: 4000,
      });
    },
  });

  const handleCheckout = async (planId: PaidPlanId) => {
    setCheckingOutPlan(planId);
    await trackFunnelEvent("checkout_started", {
      plan: planId,
      billing,
      path: "/pricing",
      pricing_experiment: pricingExp?.experiment_id,
      pricing_variant: pricingExp?.variant_key,
    });
    if (pricingExp && planId === "oracle") {
      await trackGrowthEvent(pricingExp, "checkout_started", {
        billing,
        path: "/pricing",
      });
    }
    checkoutMutation.mutate({
      plan: planId,
      billingCycle: billing,
      origin: window.location.origin,
    });
  };

  const visibleFeatures = showFullTable ? PRICING_FEATURE_ROWS : PRICING_FEATURE_ROWS.slice(0, 8);
  const activePlanId = isActiveSubscriber ? subscription?.plan : null;

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE }}>
      <Helmet>
        <title>Pricing — Pythh.ai</title>
        <meta
          name="description"
          content="Scout from $19/mo with 1 PYTHIA outreach campaign. Oracle $49/mo with 5 campaigns. 7-day free trial on paid plans."
        />
        <meta property="og:title" content="Pricing — Pythh.ai" />
        <meta
          property="og:description"
          content="Let PYTHIA run investor outreach while you focus on meetings. Plans from $19/mo."
        />
        <meta property="og:url" content="https://pythh.ai/pricing" />
      </Helmet>

      <SharedNavbar activePath="/pricing" />

      <div className="container max-w-6xl pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-10"
        >
          <SectionLabel className="mb-3">Pricing</SectionLabel>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div className="max-w-2xl">
              <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight mb-3" style={{ color: TEXT }}>
                One qualified meeting
                <span style={{ color: GOLD }}> pays for the year.</span>
              </h1>
              <p className="text-base leading-relaxed mb-4" style={{ color: MUTED }}>
                PYTHIA finds thesis-fit investors, writes personalized outreach, sends follow-ups, and tracks replies —
                so you spend time in meetings, not in Gmail.
              </p>
              <p className="text-sm font-mono mb-1" style={{ color: G }}>
                Scout <span style={{ color: TEXT }}>$19/mo</span>
                <span style={{ color: DIM }}> · </span>
                Oracle <span style={{ color: GOLD }}>$49/mo</span>
              </p>
              <p className="text-xs font-mono" style={{ color: DIM }}>
                7-day free trial on paid plans · save 17% on annual billing
              </p>
            </div>
          </div>
        </motion.div>

        {/* Value anchors */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-10">
          {[
            { icon: Target, title: "Campaigns, not credits", body: "Each plan includes real PYTHIA outreach campaigns — automated sends to matched investors, not a search quota." },
            { icon: Zap, title: "Copy free, automate when ready", body: "Manual email drafts stay free forever. Upgrade when you want PYTHIA to send and follow up for you." },
            { icon: TrendingUp, title: "Built for outcomes", body: "We price for founder velocity: get to investor conversations faster, not for enterprise shelfware." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="border p-4" style={{ borderColor: BORDER, backgroundColor: CARD }}>
              <Icon size={16} className="mb-2" style={{ color: G }} />
              <p className="text-sm font-semibold mb-1" style={{ color: TEXT }}>{title}</p>
              <p className="text-xs leading-relaxed" style={{ color: MUTED }}>{body}</p>
            </div>
          ))}
        </div>

        <div className="mb-8">
          <FilterTabs
            label="Bill"
            value={billing}
            onChange={setBilling}
            options={[
              { id: "monthly", label: "Monthly" },
              { id: "annual", label: "Annual · save 17%" },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12 lg:hidden">
          {FOUNDER_PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              billing={billing}
              onCheckout={plan.stripePlanId ? handleCheckout : undefined}
              checkingOutPlan={checkingOutPlan}
              activePlanId={activePlanId}
              oracleCtaLabel={oracleCtaLabel}
              isAuthenticated={isAuthenticated}
            />
          ))}
        </div>

        <div className="hidden lg:block border mb-8 overflow-hidden" style={{ borderColor: BORDER, backgroundColor: CARD }}>
          <div className="grid grid-cols-4 border-b" style={{ borderColor: BORDER }}>
            <div className="p-5 border-r" style={{ borderColor: BORDER }}>
              <SectionLabel>Compare</SectionLabel>
              <p className="text-xs mt-2" style={{ color: DIM }}>What you get at each tier</p>
            </div>
            {FOUNDER_PLANS.map((plan, i) => (
              <div
                key={plan.id}
                className="p-5"
                style={{
                  borderRight: i < FOUNDER_PLANS.length - 1 ? `1px solid ${BORDER}` : undefined,
                  borderTop: plan.featured ? `2px solid ${plan.borderColor}` : undefined,
                }}
              >
                <p className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: plan.color }}>
                  {plan.name}
                </p>
                <p className="text-xs mb-2" style={{ color: DIM }}>{plan.headline}</p>
                {plan.monthlyPrice != null ? (
                  <div className="mb-3">
                    <div className="flex items-baseline gap-1">
                      <span className="font-display font-bold text-2xl tabular-nums" style={{ color: TEXT }}>
                        ${plan.monthlyPrice}
                      </span>
                      <span className="text-xs font-mono" style={{ color: DIM }}>/month</span>
                    </div>
                    {billing === "annual" && plan.annualPrice != null && (
                      <p className="text-[10px] font-mono mt-1" style={{ color: G }}>
                        ${plan.annualCents! / 100}/yr
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="font-display font-bold text-xl mb-3" style={{ color: TEXT }}>Custom</p>
                )}
                <PlanCTA
                  plan={plan}
                  billing={billing}
                  onCheckout={plan.stripePlanId ? handleCheckout : undefined}
                  isCheckingOut={checkingOutPlan === plan.stripePlanId}
                  activePlanId={activePlanId}
                  oracleCtaLabel={oracleCtaLabel}
                  isAuthenticated={isAuthenticated}
                />
              </div>
            ))}
          </div>

          {visibleFeatures.map((feature, i) => (
            <div
              key={i}
              className="grid grid-cols-4 border-b text-sm"
              style={{
                borderColor: BORDER,
                backgroundColor: feature.highlight ? "oklch(0.769 0.188 70.08 / 0.04)" : "transparent",
              }}
            >
              <div className="px-5 py-3 border-r flex items-center" style={{ borderColor: BORDER }}>
                <span className="text-xs" style={{ color: feature.highlight ? TEXT : MUTED }}>
                  {feature.label}
                </span>
              </div>
              {(["scout", "oracle", "pantheon"] as const).map((tier, pi) => (
                <div
                  key={tier}
                  className="px-5 py-3 flex items-center justify-center"
                  style={{
                    borderRight: pi < 2 ? `1px solid ${BORDER}` : undefined,
                  }}
                >
                  <FeatureCell
                    value={feature[tier]}
                    color={FOUNDER_PLANS[pi].color}
                  />
                </div>
              ))}
            </div>
          ))}

          {!showFullTable && PRICING_FEATURE_ROWS.length > 8 && (
            <div className="flex justify-center py-3 border-t" style={{ borderColor: BORDER }}>
              <button
                type="button"
                onClick={() => setShowFullTable(true)}
                className="text-xs font-mono bg-transparent border-0 cursor-pointer transition-colors"
                style={{ color: DIM }}
                onMouseEnter={(e) => { e.currentTarget.style.color = GOLD; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = DIM; }}
              >
                Show all {PRICING_FEATURE_ROWS.length} features →
              </button>
            </div>
          )}
        </div>

        <div
          className="border p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-5 mb-12"
          style={{ borderColor: G_BORDER, backgroundColor: CARD }}
        >
          <div className="flex items-start gap-4">
            <Building2 size={20} className="shrink-0 mt-0.5" style={{ color: G }} />
            <div>
              <p className="font-display font-bold text-base mb-1" style={{ color: TEXT }}>
                Running a fund or studio?
              </p>
              <p className="text-sm leading-relaxed max-w-lg" style={{ color: MUTED }}>
                Pantheon — unlimited campaigns, CRM sync, custom filters, and a dedicated success manager.
              </p>
            </div>
          </div>
          <StrokeButton href="mailto:hello@pythh.ai" color={G} showArrow className="shrink-0">
            Talk to us
          </StrokeButton>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            {
              q: "What's an outreach campaign?",
              a: "One raise push: PYTHIA targets a set of thesis-fit investors with personalized sequences — initial email, follow-ups, and reply tracking until you pause or complete the round.",
            },
            {
              q: "Can I start on Scout and upgrade?",
              a: "Yes. Scout gives you one active campaign to prove the pipeline. When you're ready to run multiple segments or a larger round, upgrade to Oracle for five concurrent campaigns.",
            },
            {
              q: "Does PYTHIA send emails for me?",
              a: "On Scout and Oracle — yes, after you authorize your campaign. Manual copy-and-send from drafts stays free on the Outreach tab without a subscription.",
            },
          ].map((item) => (
            <div key={item.q} className="border-t pt-4" style={{ borderColor: BORDER }}>
              <p className="text-sm font-medium mb-2" style={{ color: TEXT }}>{item.q}</p>
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{item.a}</p>
            </div>
          ))}
        </div>

        <div className="text-center border-t pt-10" style={{ borderColor: BORDER }}>
          <p className="text-sm mb-2" style={{ color: MUTED }}>
            Not ready to automate? Preview your matches free.
          </p>
          <StartupCTA href="/matches" showArrow size="lg">
            Preview my matches
          </StartupCTA>
          <p className="text-xs mt-4" style={{ color: DIM }}>
            Already subscribed?{" "}
            <Link href="/account" className="underline" style={{ color: G }}>
              Manage billing
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
