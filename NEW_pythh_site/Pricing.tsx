/*
 * PYTHH.AI — PRICING PAGE
 * Design: Obsidian Terminal — Data Noir
 * Palette: Obsidian bg · Emerald primary · Amber accent · Space Grotesk + JetBrains Mono
 */
import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { Link } from "wouter";
import { Check, X, Zap, Building2, ArrowRight, ChevronLeft, Loader2, CheckCircle2 } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

// ─── Types ────────────────────────────────────────────────────────────────────
type BillingCycle = "monthly" | "annual";

interface PlanFeature {
  label: string;
  free: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
  highlight?: boolean;
}

// ─── Data ─────────────────────────────────────────────────────────────────────
const FEATURES: PlanFeature[] = [
  { label: "PYTHIA investor matches / month", free: "10", pro: "Unlimited", enterprise: "Unlimited", highlight: true },
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
    tagline: "Explore the signal",
    monthlyPrice: 0,
    annualPrice: 0,
    cta: "Start free",
    ctaHref: "/activate",
    color: "oklch(0.5 0.01 264)",
    borderColor: "oklch(0.28 0.01 264)",
    bgColor: "oklch(0.14 0.01 264)",
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
    color: "oklch(0.769 0.188 70.08)",
    borderColor: "oklch(0.769 0.188 70.08 / 0.5)",
    bgColor: "oklch(0.769 0.188 70.08 / 0.05)",
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
    color: "oklch(0.696 0.17 162.48)",
    borderColor: "oklch(0.696 0.17 162.48 / 0.4)",
    bgColor: "oklch(0.696 0.17 162.48 / 0.04)",
    featured: false,
  },
];

// ─── Feature Cell ─────────────────────────────────────────────────────────────
function FeatureCell({ value, color }: { value: string | boolean; color: string }) {
  if (value === true) {
    return (
      <div className="flex justify-center">
        <div className="w-5 h-5 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${color.replace(")", " / 0.15)").replace("oklch(", "oklch(")}` }}>
          <Check size={11} style={{ color }} />
        </div>
      </div>
    );
  }
  if (value === false) {
    return (
      <div className="flex justify-center">
        <X size={14} style={{ color: "oklch(0.35 0.01 264)" }} />
      </div>
    );
  }
  return (
    <div className="text-center font-mono text-xs font-semibold" style={{ color }}>
      {value}
    </div>
  );
}

// ─── Pricing Card (mobile) ────────────────────────────────────────────────────────────────
function PricingCard({
  plan,
  billing,
  onOracleCTA,
  isCheckingOut,
  isActiveSubscriber,
}: {
  plan: typeof PLANS[0];
  billing: BillingCycle;
  onOracleCTA?: () => void;
  isCheckingOut?: boolean;
  isActiveSubscriber?: boolean;
}) {
  const price = billing === "annual" ? plan.annualPrice : plan.monthlyPrice;
  const planFeatures = FEATURES.filter((f) => {
    const val = f[plan.id as keyof PlanFeature];
    return val !== false;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl border p-6 flex flex-col relative overflow-hidden"
      style={{
        backgroundColor: plan.bgColor,
        borderColor: plan.borderColor,
        boxShadow: plan.featured ? `0 0 40px ${plan.color.replace(")", " / 0.12)")}` : "none",
      }}
    >
      {plan.featured && (
        <div className="absolute top-0 left-0 right-0 h-0.5"
          style={{ background: `linear-gradient(90deg, transparent, ${plan.color}, transparent)` }} />
      )}
      {plan.featured && (
        <div className="absolute top-4 right-4 px-2 py-0.5 rounded-full text-xs font-bold tracking-wider"
          style={{ backgroundColor: `${plan.color.replace(")", " / 0.15)")}`, color: plan.color, border: `1px solid ${plan.color.replace(")", " / 0.3)")}` }}>
          MOST POPULAR
        </div>
      )}
      <div className="mb-5">
        <p className="text-xs font-bold tracking-widest mb-1" style={{ color: plan.color }}>{plan.name.toUpperCase()}</p>
        <p className="text-sm" style={{ color: "oklch(0.55 0.01 264)" }}>{plan.tagline}</p>
      </div>
      <div className="mb-6">
        {price !== null ? (
          <div className="flex items-end gap-1">
            <span className="font-display font-bold text-4xl" style={{ color: "oklch(0.97 0.005 264)" }}>
              ${price}
            </span>
            <span className="text-sm mb-1.5" style={{ color: "oklch(0.5 0.01 264)" }}>/mo</span>
          </div>
        ) : (
          <span className="font-display font-bold text-3xl" style={{ color: "oklch(0.97 0.005 264)" }}>Custom</span>
        )}
        {billing === "annual" && price !== null && price > 0 && (
          <p className="text-xs mt-1" style={{ color: "oklch(0.696 0.17 162.48)" }}>
            Billed annually · Save ${(plan.monthlyPrice! - price) * 12}/yr
          </p>
        )}
      </div>
      {plan.id === "pro" && isActiveSubscriber ? (
        <div
          className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm mb-6 w-full"
          style={{
            backgroundColor: "oklch(0.696 0.17 162.48 / 0.12)",
            color: "oklch(0.696 0.17 162.48)",
            border: "1px solid oklch(0.696 0.17 162.48 / 0.3)",
          }}>
          <CheckCircle2 size={14} />
          Active Plan
        </div>
      ) : plan.id === "pro" && onOracleCTA ? (
        <button
          onClick={onOracleCTA}
          disabled={isCheckingOut}
          className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm mb-6 transition-all w-full disabled:opacity-70 disabled:cursor-not-allowed"
          style={{
            backgroundColor: plan.color,
            color: "oklch(0.1 0.01 70)",
          }}>
          {isCheckingOut ? (
            <><Loader2 size={14} className="animate-spin" /> Redirecting…</>
          ) : (
            <>{plan.cta}<ArrowRight size={14} /></>
          )}
        </button>
      ) : (
        <a href={plan.ctaHref}
          className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm mb-6 transition-all"
          style={{
            backgroundColor: plan.featured ? plan.color : "transparent",
            color: plan.featured ? "oklch(0.1 0.01 70)" : plan.color,
            border: plan.featured ? "none" : `1.5px solid ${plan.borderColor}`,
          }}>
          {plan.cta}
          <ArrowRight size={14} />
        </a>
      )}
      <div className="space-y-2.5">
        {planFeatures.slice(0, 8).map((f, i) => {
          const val = f[plan.id as keyof PlanFeature];
          return (
            <div key={i} className="flex items-center gap-2.5">
              {val === true ? (
                <Check size={13} style={{ color: plan.color, flexShrink: 0 }} />
              ) : (
                <span className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              <span className="text-xs" style={{ color: val === false ? "oklch(0.35 0.01 264)" : "oklch(0.7 0.01 264)" }}>
                {typeof val === "string" ? `${val} ${f.label.toLowerCase()}` : f.label}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Pricing() {
  const [billing, setBilling] = useState<BillingCycle>("annual");
  const [showFullTable, setShowFullTable] = useState(false);
  const { isAuthenticated } = useAuth();

  // Only fetch subscription if the user is logged in
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
    <div className="min-h-screen" style={{ backgroundColor: "oklch(0.09 0.01 264)" }}>
      <Helmet>
        <title>Pricing — Pythh.ai</title>
        <meta name="description" content="Choose your plan. Scout is free forever. Oracle gives you full PYTHIA pipeline automation with a 7-day free trial. Pantheon for funds and studios." />
        <meta property="og:title" content="Pricing — Pythh.ai" />
        <meta property="og:description" content="Start your 7-day free trial of the Oracle plan. Full investor matching, automated outreach, pitch briefs, and meeting booking." />
        <meta property="og:url" content="https://pythh.ai/pricing" />
      </Helmet>
      {/* Nav */}
      <nav className="border-b px-6 py-4 flex items-center justify-between sticky top-0 z-40"
        style={{ backgroundColor: "oklch(0.09 0.01 264 / 0.95)", borderColor: "oklch(0.18 0.01 264)", backdropFilter: "blur(12px)" }}>
        <Link href="/" className="flex items-center gap-3 group">
          <ChevronLeft size={16} style={{ color: "oklch(0.5 0.01 264)" }} />
          <div>
            <span className="font-display font-bold text-lg" style={{ color: "oklch(0.97 0.005 264)" }}>pythh.ai</span>
            <span className="text-xs ml-2 font-mono" style={{ color: "oklch(0.5 0.01 264)" }}>SIGNAL SCIENCE</span>
          </div>
        </Link>
        <Link href="/activate">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ backgroundColor: "oklch(0.769 0.188 70.08)", color: "oklch(0.1 0.01 70)" }}>
            Activate PYTHIA
            <Zap size={13} />
          </button>
        </Link>
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-16">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold tracking-widest mb-5"
            style={{ backgroundColor: "oklch(0.769 0.188 70.08 / 0.1)", color: "oklch(0.769 0.188 70.08)", border: "1px solid oklch(0.769 0.188 70.08 / 0.2)" }}>
            PRICING
          </div>
          <h1 className="font-display font-bold text-5xl md:text-6xl mb-4 leading-tight"
            style={{ color: "oklch(0.97 0.005 264)" }}>
            Let PYTHIA work.<br />
            <span style={{ color: "oklch(0.769 0.188 70.08)" }}>You show up.</span>
          </h1>
          <p className="text-lg max-w-xl mx-auto mb-5" style={{ color: "oklch(0.55 0.01 264)" }}>
            From your first signal to your first term sheet — PYTHIA runs the pipeline so you don't have to.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
            style={{
              backgroundColor: "oklch(0.696 0.17 162.48 / 0.1)",
              color: "oklch(0.696 0.17 162.48)",
              border: "1px solid oklch(0.696 0.17 162.48 / 0.3)",
            }}>
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "oklch(0.696 0.17 162.48)" }} />
            Try Oracle free for 7 days — no charge until your trial ends
          </div>
        </motion.div>

        {/* Billing toggle */}
        <div className="flex justify-center mb-10">
          <div className="flex items-center gap-1 p-1 rounded-xl border"
            style={{ backgroundColor: "oklch(0.13 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}>
            {(["monthly", "annual"] as BillingCycle[]).map((cycle) => (
              <button key={cycle} onClick={() => setBilling(cycle)}
                className="px-5 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2"
                style={{
                  backgroundColor: billing === cycle ? "oklch(0.769 0.188 70.08)" : "transparent",
                  color: billing === cycle ? "oklch(0.1 0.01 70)" : "oklch(0.55 0.01 264)",
                }}>
                {cycle === "monthly" ? "Monthly" : "Annual"}
                {cycle === "annual" && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                    style={{
                      backgroundColor: billing === "annual" ? "oklch(0.1 0.01 70 / 0.2)" : "oklch(0.696 0.17 162.48 / 0.15)",
                      color: billing === "annual" ? "oklch(0.1 0.01 70)" : "oklch(0.696 0.17 162.48)",
                    }}>
                    Save 17%
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-16 lg:hidden">
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

        {/* Desktop comparison table */}
        <div className="hidden lg:block rounded-2xl border overflow-hidden mb-6"
          style={{ borderColor: "oklch(0.22 0.01 264)", backgroundColor: "oklch(0.11 0.01 264)" }}>
          {/* Plan headers */}
          <div className="grid grid-cols-4 border-b" style={{ borderColor: "oklch(0.18 0.01 264)" }}>
            <div className="p-6 border-r" style={{ borderColor: "oklch(0.18 0.01 264)" }}>
              <p className="text-xs font-bold tracking-widest mb-1" style={{ color: "oklch(0.4 0.01 264)" }}>COMPARE PLANS</p>
              <p className="text-sm" style={{ color: "oklch(0.5 0.01 264)" }}>All features included in each tier</p>
            </div>
            {PLANS.map((plan, i) => (
              <div key={plan.id}
                className="p-6 relative"
                style={{
                  borderRight: i < PLANS.length - 1 ? `1px solid oklch(0.18 0.01 264)` : "none",
                  backgroundColor: plan.featured ? `${plan.color.replace(")", " / 0.04)")}` : "transparent",
                }}>
                {plan.featured && (
                  <div className="absolute top-0 left-0 right-0 h-0.5"
                    style={{ background: `linear-gradient(90deg, transparent, ${plan.color}, transparent)` }} />
                )}
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-display font-bold text-lg" style={{ color: plan.color }}>{plan.name}</p>
                  {plan.featured && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                      style={{ backgroundColor: `${plan.color.replace(")", " / 0.15)")}`, color: plan.color }}>
                      POPULAR
                    </span>
                  )}
                </div>
                <p className="text-xs mb-3" style={{ color: "oklch(0.5 0.01 264)" }}>{plan.tagline}</p>
                {plan.monthlyPrice !== null ? (
                  <div className="flex items-end gap-1 mb-3">
                    <span className="font-display font-bold text-3xl" style={{ color: "oklch(0.97 0.005 264)" }}>
                      ${billing === "annual" ? plan.annualPrice : plan.monthlyPrice}
                    </span>
                    <span className="text-xs mb-1" style={{ color: "oklch(0.45 0.01 264)" }}>/mo</span>
                  </div>
                ) : (
                  <div className="mb-3">
                    <span className="font-display font-bold text-2xl" style={{ color: "oklch(0.97 0.005 264)" }}>Custom</span>
                  </div>
                )}
                {plan.id === "pro" ? (
                  isActiveSubscriber ? (
                    <div
                      className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold w-full"
                      style={{
                        backgroundColor: "oklch(0.696 0.17 162.48 / 0.12)",
                        color: "oklch(0.696 0.17 162.48)",
                        border: "1px solid oklch(0.696 0.17 162.48 / 0.3)",
                      }}>
                      <CheckCircle2 size={13} />
                      Active Plan
                    </div>
                  ) : (
                  <button
                    onClick={handleOracleCTA}
                    disabled={checkoutMutation.isPending}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all w-full disabled:opacity-70 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: plan.color,
                      color: "oklch(0.1 0.01 70)",
                    }}>
                    {checkoutMutation.isPending ? (
                      <><Loader2 size={13} className="animate-spin" /> Redirecting…</>
                    ) : (
                      <>{plan.cta}<ArrowRight size={13} /></>
                    )}
                  </button>
                  )
                ) : (
                  <a href={plan.ctaHref}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-all w-full"
                    style={{
                      backgroundColor: "transparent",
                      color: plan.color,
                      border: `1.5px solid ${plan.borderColor}`,
                    }}>
                    {plan.cta}
                    <ArrowRight size={13} />
                  </a>
                )}
              </div>
            ))}
          </div>

          {/* Feature rows */}
          {visibleFeatures.map((feature, i) => (
            <div key={i}
              className="grid grid-cols-4 border-b"
              style={{
                borderColor: "oklch(0.15 0.01 264)",
                backgroundColor: feature.highlight ? "oklch(0.769 0.188 70.08 / 0.02)" : "transparent",
              }}>
              <div className="px-6 py-3.5 border-r flex items-center" style={{ borderColor: "oklch(0.18 0.01 264)" }}>
                <span className="text-xs" style={{ color: feature.highlight ? "oklch(0.85 0.005 264)" : "oklch(0.6 0.01 264)" }}>
                  {feature.label}
                </span>
              </div>
              {PLANS.map((plan, pi) => (
                <div key={plan.id}
                  className="px-6 py-3.5 flex items-center justify-center"
                  style={{
                    borderRight: pi < PLANS.length - 1 ? "1px solid oklch(0.18 0.01 264)" : "none",
                    backgroundColor: plan.featured ? "oklch(0.769 0.188 70.08 / 0.02)" : "transparent",
                  }}>
                  <FeatureCell value={feature[plan.id as keyof PlanFeature] as string | boolean} color={plan.color} />
                </div>
              ))}
            </div>
          ))}

          {/* Show more toggle */}
          {!showFullTable && FEATURES.length > 10 && (
            <div className="flex justify-center py-4 border-t" style={{ borderColor: "oklch(0.18 0.01 264)" }}>
              <button onClick={() => setShowFullTable(true)}
                className="text-xs font-semibold flex items-center gap-1.5 transition-colors"
                style={{ color: "oklch(0.5 0.01 264)" }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.769 0.188 70.08)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "oklch(0.5 0.01 264)"; }}>
                Show all {FEATURES.length} features
              </button>
            </div>
          )}
        </div>

        {/* Enterprise callout */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
          className="rounded-2xl border p-8 flex flex-col md:flex-row items-center justify-between gap-6"
          style={{ backgroundColor: "oklch(0.13 0.01 264)", borderColor: "oklch(0.696 0.17 162.48 / 0.25)" }}>
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.12)", border: "1px solid oklch(0.696 0.17 162.48 / 0.3)" }}>
              <Building2 size={22} style={{ color: "oklch(0.696 0.17 162.48)" }} />
            </div>
            <div>
              <p className="font-display font-bold text-lg mb-1" style={{ color: "oklch(0.97 0.005 264)" }}>
                Running a fund or studio?
              </p>
              <p className="text-sm" style={{ color: "oklch(0.55 0.01 264)" }}>
                Pantheon gives your whole team unlimited PYTHIA threads, CRM sync, custom investor filters, and a dedicated success manager.
              </p>
            </div>
          </div>
          <a href="mailto:hello@pythh.ai"
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm whitespace-nowrap flex-shrink-0 transition-all"
            style={{ backgroundColor: "oklch(0.696 0.17 162.48 / 0.12)", color: "oklch(0.696 0.17 162.48)", border: "1px solid oklch(0.696 0.17 162.48 / 0.3)" }}>
            Talk to us
            <ArrowRight size={14} />
          </a>
        </motion.div>

        {/* FAQ strip */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { q: "Can I cancel anytime?", a: "Yes. Cancel from your dashboard with no questions asked. Your pipeline keeps running until the end of your billing period." },
            { q: "What counts as a 'match'?", a: "A match is an investor PYTHIA identifies as a fit for your startup based on thesis, fund cycle, portfolio gaps, and recent signal activity." },
            { q: "Does PYTHIA send emails on my behalf?", a: "Yes — on Oracle and Pantheon plans. PYTHIA sends personalized outreach from a pythh.ai domain with your name. You review the pitch brief before any email is sent." },
          ].map((item, i) => (
            <div key={i} className="rounded-xl p-5 border" style={{ backgroundColor: "oklch(0.13 0.01 264)", borderColor: "oklch(0.22 0.01 264)" }}>
              <p className="text-sm font-semibold mb-2" style={{ color: "oklch(0.92 0.005 264)" }}>{item.q}</p>
              <p className="text-sm leading-relaxed" style={{ color: "oklch(0.55 0.01 264)" }}>{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
