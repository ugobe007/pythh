/**
 * Stripe Webhook Handler
 *
 * Registers a raw-body Express route at POST /api/stripe/webhook.
 * Verifies the Stripe-Signature header, then handles:
 *   - checkout.session.completed  → provision Oracle subscription
 *   - customer.subscription.updated → sync status / period end
 *   - customer.subscription.deleted → mark subscription canceled
 *
 * IMPORTANT: This route must be registered BEFORE express.json() so that
 * the raw request body is available for Stripe signature verification.
 */

import type { Express, NextFunction, Request, Response } from "express";
import Stripe from "stripe";
import {
  getSubscriptionByStripeId,
  getUserByOpenId,
  upsertSubscription,
} from "./db";
import { notifyOwner } from "./_core/notification";
import { checkoutAmountLabel } from "./lib/pricingPlans";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" as Stripe.StripeConfig["apiVersion"] });
}

/**
 * Derive billing cycle from a Stripe subscription's recurring interval.
 * Falls back to "monthly" if the interval is absent or unrecognised.
 */
function billingCycleFromInterval(
  interval: string | undefined
): "monthly" | "annual" {
  return interval === "year" ? "annual" : "monthly";
}

async function recordCheckoutCompletedFunnel(
  session: Stripe.Checkout.Session,
  billingCycle: "monthly" | "annual",
  plan: string,
): Promise<void> {
  const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!sbUrl || !sbKey) return;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sb = createClient(sbUrl, sbKey);
    await sb.from("ai_logs").insert({
      operation: "checkout_completed",
      status: "success",
      output: {
        source: "stripe_webhook",
        plan,
        billing_cycle: billingCycle,
        session_id: session.id,
      },
    });
  } catch (err) {
    console.warn("[Webhook] checkout_completed funnel log failed (non-critical):", err);
  }
}

// ─── Event handlers ──────────────────────────────────────────────────────────

/**
 * Handle checkout.session.completed.
 *
 * Associates the Stripe subscription with the Manus user identified by
 * the `client_reference_id` stored in the session metadata (set during
 * checkout session creation). If no user is found the event is logged
 * and silently dropped — Stripe will not retry a 200 response.
 */
export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe
): Promise<void> {
  // We embed the Manus openId as client_reference_id when creating the session.
  const openId = session.client_reference_id;
  if (!openId) {
    console.warn(
      "[Webhook] checkout.session.completed: missing client_reference_id — cannot provision subscription"
    );
    return;
  }

  const user = await getUserByOpenId(openId);
  if (!user) {
    console.warn(
      `[Webhook] checkout.session.completed: no user found for openId=${openId}`
    );
    return;
  }

  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  if (!subscriptionId) {
    console.warn("[Webhook] checkout.session.completed: no subscription ID on session");
    return;
  }

  // Retrieve full subscription object to get interval + period end
  const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
  const firstItem = stripeSub.items.data[0];
  const interval = firstItem?.price?.recurring?.interval;
  const billingCycle = billingCycleFromInterval(interval);
  const cpe = stripeSub.current_period_end;
  const currentPeriodEnd = cpe ? cpe * 1000 : undefined;

  const planFromMeta =
    (session.metadata?.plan as string | undefined) ||
    (stripeSub.metadata?.plan as string | undefined) ||
    "oracle";
  const plan = planFromMeta === "scout" ? "scout" : "oracle";

  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : (session.customer as Stripe.Customer | null)?.id ?? "";

  await upsertSubscription({
    userId: user.id,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscriptionId,
    plan,
    billingCycle,
    status: "active",
    currentPeriodEnd,
  });

  await recordCheckoutCompletedFunnel(session, billingCycle, plan);

  console.log(
    `[Webhook] ${plan} plan provisioned for userId=${user.id} (${billingCycle})`
  );

  const cycleLabel = billingCycle === "annual" ? "Annual" : "Monthly";
  const amountLabel = checkoutAmountLabel(plan as "scout" | "oracle", billingCycle);
  const planTitle = plan === "scout" ? "Scout" : "Oracle";
  await notifyOwner(
    [
      `New ${planTitle} subscriber — ${cycleLabel}`,
      `Name: ${user.name ?? "(unknown)"}`,
      `Email: ${user.email ?? "(unknown)"}`,
      `Plan: ${planTitle} ${cycleLabel} (${amountLabel})`,
      `Stripe Customer: ${customerId}`,
      `Subscription: ${subscriptionId}`,
    ].join("\n")
  ).catch((err) =>
    console.warn("[Webhook] notifyOwner failed (non-critical):", err)
  );
}

/**
 * Handle customer.subscription.updated.
 * Syncs status and current_period_end for an existing subscription row.
 */
export async function handleSubscriptionUpdated(
  stripeSub: Stripe.Subscription
): Promise<void> {
  const existing = await getSubscriptionByStripeId(stripeSub.id);
  if (!existing) {
    // Not a subscription we track — ignore
    return;
  }

  const firstItem = stripeSub.items.data[0];
  const interval = firstItem?.price?.recurring?.interval;
  const billingCycle = billingCycleFromInterval(interval);
  const cpe = stripeSub.current_period_end;
  const currentPeriodEnd = cpe ? cpe * 1000 : undefined;

  await upsertSubscription({
    ...existing,
    billingCycle,
    status: stripeSub.status as
      | "active"
      | "past_due"
      | "canceled"
      | "unpaid"
      | "trialing",
    currentPeriodEnd,
  });

  console.log(
    `[Webhook] Subscription updated: ${stripeSub.id} → status=${stripeSub.status}`
  );
}

/**
 * Handle customer.subscription.deleted.
 * Marks the subscription as canceled in the database.
 */
export async function handleSubscriptionDeleted(
  stripeSub: Stripe.Subscription
): Promise<void> {
  const existing = await getSubscriptionByStripeId(stripeSub.id);
  if (!existing) return;

  await upsertSubscription({
    ...existing,
    status: "canceled",
  });

  console.log(`[Webhook] Subscription canceled: ${stripeSub.id}`);
}

// ─── Route registration ───────────────────────────────────────────────────────

/**
 * Register the Stripe webhook route.
 *
 * Call this BEFORE app.use(express.json()) in server/_core/index.ts so the
 * raw body buffer is preserved for signature verification.
 */
export function registerStripeWebhook(app: Express): void {
  app.post(
    "/api/stripe/webhook",
    // Use express.raw() here — NOT express.json() — so Stripe can verify the signature
    (req: Request, res: Response, next: NextFunction) => {
      // express.raw middleware inline
      const chunks: Buffer[] = [];
      req.on("data", (chunk: Buffer) => chunks.push(chunk));
      req.on("end", () => {
        (req as Request & { rawBody: Buffer }).rawBody = Buffer.concat(chunks);
        next();
      });
      req.on("error", next);
    },
    async (req: Request & { rawBody?: Buffer }, res: Response) => {
      const sig = req.headers["stripe-signature"] as string | undefined;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error("[Webhook] STRIPE_WEBHOOK_SECRET is not configured.");
        res.status(500).json({ error: "Webhook secret not configured." });
        return;
      }

      if (!sig) {
        res.status(400).json({ error: "Missing Stripe-Signature header." });
        return;
      }

      const stripe = getStripe();
      let event: Stripe.Event;

      try {
        event = stripe.webhooks.constructEvent(
          req.rawBody ?? Buffer.alloc(0),
          sig,
          webhookSecret
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[Webhook] Signature verification failed: ${message}`);
        res.status(400).json({ error: `Webhook signature verification failed: ${message}` });
        return;
      }

      try {
        switch (event.type) {
          case "checkout.session.completed":
            await handleCheckoutSessionCompleted(
              event.data.object as Stripe.Checkout.Session,
              stripe
            );
            break;

          case "customer.subscription.updated":
            await handleSubscriptionUpdated(
              event.data.object as Stripe.Subscription
            );
            break;

          case "customer.subscription.deleted":
            await handleSubscriptionDeleted(
              event.data.object as Stripe.Subscription
            );
            break;

          default:
            // Unhandled event types — acknowledge receipt so Stripe doesn't retry
            break;
        }

        res.json({ received: true });
      } catch (err) {
        console.error("[Webhook] Error processing event:", err);
        // Return 500 so Stripe retries the event
        res.status(500).json({ error: "Internal webhook processing error." });
      }
    }
  );
}
