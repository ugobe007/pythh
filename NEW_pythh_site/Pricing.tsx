/*
 * PYTHH.AI — PRICING PAGE
 * Terminal / data-noir — outline CTAs, inline tabs, no pill fills
 */
import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { Check, X, Building2, Loader2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
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

type BillingCycle = "monthly" | "annual";

interface PlanFeature {
  label: string;
  free: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
  highlight?: boolean;
}

const FEATURES: PlanFeature[] = [
  { label: "URL submissions + investor matches", free: "3 searches", pro: "Unlimited", enterprise: "Unlimited", highlight: true },
  { label: "PYTHIA outreach agent", free: false, pro: true, enterprise: true, highlight: true },
  { label: "Automated outreach emails", free: false, pro: true, enterprise: true, highlight: true },
  { label: "Email inference engine", free: false, pro: true, enterprise: true },
  { label: "Pitch brief generation", free: false, pro: true, enterprise: true },
  { label: "Pre-meeting brief", free: false, pro: true, enterprise: true },
  { label: "Meeting approval & booking", free: false, pro: true, enterprise: true, highlight: true },
  { label: "Pipeline live feed", free: "Preview only", pro: true, enterprise: true },
  { label: "Investor signal intelligence", free: "3 signals", pro: "Full access", enterprise: "Full access" },
  { label: "Co-investor context", free: false, pro: true, enterprise: true },
  { label: "Q&A prep (anticipated questions)", free: false, pro: true, enterprise: true },
  { label: "Parallel pipeline threads", free: "1", pro: "6", enterprise: "Unlimited" },
  { label: "Team seats", free: "1", pro: "3", enterprise: "Unlimited" },
  { label: "CRM integrations", free: false, pro: false, enterprise: true },
  { label: "Custom investor filters", free: false, pro: false, enterprise: true },
  { label: "Dedicated success manager", free: false, pro: false, enterprise: true },
  { label: "Priority support", free: false, pro: "Email", enterprise: "Dedicated Slack" },
];

const PLANS = [
  {
    id: "free",
    name: "Scout",
    tagline: "3 searches. See who fits.",
    monthlyPrice: 29,
    annualPrice: 24,
    cta: "Get Scout",
    ctaHref: "/activate",
    color: MUTED,
    borderColor: BORDER,
    featured: false,
  },
  {
    id: "pro",
    name: "Oracle",
    tagline: "Full pipeline automation",
    monthlyPrice: 299,
    annualPrice: 249,
    cta: "Start 7-day free trial",
    ctaHref: "/activate",
    color: GOLD,
    borderColor: "oklch(0.769 0.188 70.08 / 0.45)",
    featured: true,
  },
  {
    id: "enterprise",
    name: "Pantheon",
    tagline: "For funds & studios",
    monthlyPrice: null,
    annualPrice: null,
    cta: "Talk to us",
    ctaHref: "mailto:hello@pythh.ai",
    color: G,
    borderColor: G_BORDER,
    featured: false,
  },
];

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
  onOracleCTA,
  isCheckingOut,
  isActiveSubscriber,
}: {
  plan: (typeof PLANS)[0];
  onOracleCTA?: () => void;
  isCheckingOut?: boolean;
  isActiveSubscriber?: boolean;
}) {
  if (plan.id === "pro" && isActiveSubscriber) {
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

  if (plan.id === "pro" && onOracleCTA) {
    return (
      <StrokeButton
        type="button"
        onClick={onOracleCTA}
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
          plan.cta
        )}
      </StrokeButton>
    );
  }

  return (
    <StrokeButton
      href={plan.ctaHref}
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
  onOracleCTA,
  isCheckingOut,
  isActiveSubscriber,
}: {
  plan: (typeof PLANS)[0];
  billing: BillingCycle;
  onOracleCTA?: () => void;
  isCheckingOut?: boolean;
  isActiveSubscriber?: boolean;
}) {
  const price = billing === "annual" ? plan.annualPrice : plan.monthlyPrice;
  const planFeatures = FEATURES.filter((f) => f[plan.id as keyof PlanFeature] !== false);

  return (
    <div
      className="border p-5 flex flex-col"
      style={{
        backgroundColor: CARD,
        borderColor: plan.featured ? plan.borderColor : BORDER,
      }}
    >
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest mb-1" style={{ color: plan.color }}>
            {plan.name}
            {plan.featured && (
              <span className="ml-2 normal-case tracking-normal" style={{ color: DIM }}>
                · popular
              </span>
            )}
          </p>
          <p className="text-sm" style={{ color: MUTED }}>{plan.tagline}</p>
        </div>
      </div>

      <div className="mb-5">
        {price !== null ? (
          <div className="flex items-baseline gap-1">
            <span className="font-display font-bold text-3xl tabular-nums" style={{ color: TEXT }}>
              ${price}
            </span>
            <span className="text-sm font-mono" style={{ color: DIM }}>/mo</span>
          </div>
        ) : (
          <span className="font-display font-bold text-2xl" style={{ color: TEXT }}>Custom</span>
        )}
        {billing === "annual" && price != null && price > 0 && (
          <p className="text-[11px] font-mono mt-1" style={{ color: G }}>
            Save ${(plan.monthlyPrice! - price) * 12}/yr billed annually
          </p>
        )}
      </div>

      <div className="mb-5">
        <PlanCTA
          plan={plan}
          onOracleCTA={onOracleCTA}
          isCheckingOut={isCheckingOut}
          isActiveSubscriber={isActiveSubscriber}
        />
      </div>

      <div className="space-y-2 border-t pt-4" style={{ borderColor: BORDER }}>
        {planFeatures.slice(0, 8).map((f, i) => {
          const val = f[plan.id as keyof PlanFeature];
          return (
            <div key={i} className="flex items-start gap-2 text-xs leading-snug">
              {val === true ? (
                <Check size={12} style={{ color: plan.color, flexShrink: 0, marginTop: 2 }} />
              ) : (
                <span className="w-3 shrink-0 font-mono" style={{ color: plan.color }}>·</span>
              )}
              <span style={{ color: MUTED }}>
                {typeof val === "string" ? `${val} — ${f.label.toLowerCase()}` : f.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Pricing() {
  const [billing, setBilling] = useState<BillingCycle>("annual");
  const [showFullTable, setShowFullTable] = useState(false);
  const { isAuthenticated } = useAuth();

  const { data: subscription } = trpc.stripe.getSubscription.useQuery(undefined, {
    enabled: isAuthenticated,
    retry: false,
  });

  const isActiveSubscriber =
    subscription?.status === "active" || subscription?.status === "trialing";

  const checkoutMutation = trpc.stripe.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      window.location.href = data.url;
    },
    onError: (err) => {
      toast.error("Checkout failed", {
        description: err.message || "Unable to start checkout. Please try again.",
        duration: 4000,
      });
    },
  });

  const handleOracleCTA = () => {
    checkoutMutation.mutate({
      billingCycle: billing,
      origin: window.location.origin,
    });
  };

  const visibleFeatures = showFullTable ? FEATURES : FEATURES.slice(0, 10);

  return (
    <div className="min-h-screen" style={{ backgroundColor: PAGE }}>
      <Helmet>
        <title>Pricing — Pythh.ai</title>
        <meta name="description" content="Choose your plan. Scout is free forever. Oracle gives you full PYTHIA pipeline automation with a 7-day free trial. Pantheon for funds and studios." />
        <meta property="og:title" content="Pricing — Pythh.ai" />
        <meta property="og:description" content="Start your 7-day free trial of the Oracle plan. Full investor matching, automated outreach, pitch briefs, and meeting booking." />
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
            <div>
              <h1 className="font-display font-bold text-4xl md:text-5xl tracking-tight leading-tight mb-3" style={{ color: TEXT }}>
                Let PYTHIA work.
                <span style={{ color: GOLD }}> You show up.</span>
              </h1>
              <p className="text-base max-w-xl leading-relaxed" style={{ color: MUTED }}>
                From first signal to term sheet — PYTHIA runs outreach, briefs, and booking so you focus on the meeting.
              </p>
            </div>
            <p className="text-sm font-mono shrink-0" style={{ color: G }}>
              7-day Oracle trial · no charge until trial ends
            </p>
          </div>
        </motion.div>

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
          {PLANS.map((plan) => (
            <PricingCard
              key={plan.id}
              plan={plan}
              billing={billing}
              onOracleCTA={plan.id === "pro" ? handleOracleCTA : undefined}
              isCheckingOut={plan.id === "pro" && checkoutMutation.isPending}
              isActiveSubscriber={plan.id === "pro" ? isActiveSubscriber : false}
            />
          ))}
        </div>

        <div className="hidden lg:block border mb-8 overflow-hidden" style={{ borderColor: BORDER, backgroundColor: CARD }}>
          <div className="grid grid-cols-4 border-b" style={{ borderColor: BORDER }}>
            <div className="p-5 border-r" style={{ borderColor: BORDER }}>
              <SectionLabel>Compare</SectionLabel>
              <p className="text-xs mt-2" style={{ color: DIM }}>Features by tier</p>
            </div>
            {PLANS.map((plan, i) => (
              <div
                key={plan.id}
                className="p-5"
                style={{
                  borderRight: i < PLANS.length - 1 ? `1px solid ${BORDER}` : undefined,
                  borderTop: plan.featured ? `1px solid ${plan.borderColor}` : undefined,
                }}
              >
                <p className="font-mono text-xs uppercase tracking-widest mb-1" style={{ color: plan.color }}>
                  {plan.name}
                </p>
                <p className="text-xs mb-3" style={{ color: DIM }}>{plan.tagline}</p>
                {plan.monthlyPrice != null ? (
                  <div className="flex items-baseline gap-1 mb-3">
                    <span className="font-display font-bold text-2xl tabular-nums" style={{ color: TEXT }}>
                      ${billing === "annual" ? plan.annualPrice : plan.monthlyPrice}
                    </span>
                    <span className="text-xs font-mono" style={{ color: DIM }}>/mo</span>
                  </div>
                ) : (
                  <p className="font-display font-bold text-xl mb-3" style={{ color: TEXT }}>Custom</p>
                )}
                <PlanCTA
                  plan={plan}
                  onOracleCTA={plan.id === "pro" ? handleOracleCTA : undefined}
                  isCheckingOut={plan.id === "pro" && checkoutMutation.isPending}
                  isActiveSubscriber={plan.id === "pro" ? isActiveSubscriber : false}
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
              {PLANS.map((plan, pi) => (
                <div
                  key={plan.id}
                  className="px-5 py-3 flex items-center justify-center"
                  style={{
                    borderRight: pi < PLANS.length - 1 ? `1px solid ${BORDER}` : undefined,
                  }}
                >
                  <FeatureCell
                    value={feature[plan.id as keyof PlanFeature] as string | boolean}
                    color={plan.color}
                  />
                </div>
              ))}
            </div>
          ))}

          {!showFullTable && FEATURES.length > 10 && (
            <div className="flex justify-center py-3 border-t" style={{ borderColor: BORDER }}>
              <button
                type="button"
                onClick={() => setShowFullTable(true)}
                className="text-xs font-mono bg-transparent border-0 cursor-pointer transition-colors"
                style={{ color: DIM }}
                onMouseEnter={(e) => { e.currentTarget.style.color = GOLD; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = DIM; }}
              >
                Show all {FEATURES.length} features →
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
                Pantheon — unlimited PYTHIA threads, CRM sync, custom investor filters, dedicated success manager.
              </p>
            </div>
          </div>
          <StrokeButton href="mailto:hello@pythh.ai" color={G} showArrow className="shrink-0">
            Talk to us
          </StrokeButton>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { q: "Can I cancel anytime?", a: "Yes. Cancel from your dashboard. Your pipeline keeps running until the end of your billing period." },
            { q: "What counts as a match?", a: "An investor PYTHIA identifies as a fit based on thesis, fund cycle, portfolio gaps, and recent signal activity." },
            { q: "Does PYTHIA send emails for me?", a: "On Oracle and Pantheon. Personalized outreach from a pythh.ai domain — you review the pitch brief before anything sends." },
          ].map((item) => (
            <div key={item.q} className="border-t pt-4" style={{ borderColor: BORDER }}>
              <p className="text-sm font-medium mb-2" style={{ color: TEXT }}>{item.q}</p>
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{item.a}</p>
            </div>
          ))}
        </div>

        <div className="text-center border-t pt-10" style={{ borderColor: BORDER }}>
          <p className="text-sm mb-4" style={{ color: MUTED }}>Ready to activate your pipeline?</p>
          <StartupCTA href="/activate" showArrow size="lg">
            Activate PYTHIA
          </StartupCTA>
        </div>
      </div>
    </div>
  );
}
