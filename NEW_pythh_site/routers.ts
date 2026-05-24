import Stripe from "stripe";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { COOKIE_NAME, ONE_YEAR_MS } from "./shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { randomUUID } from "node:crypto";
import {
  countPipelineRunsForUser,
  createPipelineRun,
  getAdminAggregateStats,
  getFounderProfile,
  getInvestorById,
  getAnimationFeed,
  getInvestorRankings,
  getPipelineFeedbackByRunId,
  getRecentFeedbackWithUsers,
  getSubscriptionByUserId,
  listRecentPipelineRunsForUser,
  listUsersBrief,
  rawExecute,
  rawQuery,
  upsertFounderProfile,
  upsertPipelineFeedback,
  upsertSubscription,
  upsertUser,
  type InvestorSortField,
  type SortDir,
} from "./db";
import { TRPCError } from "@trpc/server";
import { ENV } from "./env";
import { outreachRouter } from "./outreachRouter";

// Lazily initialise Stripe so the server still starts without the key set.
function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not configured.");
  return new Stripe(key, { apiVersion: "2026-04-22.dahlia" as Stripe.StripeConfig["apiVersion"] });
}

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  outreach: outreachRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    /**
     * Email-based login — creates or retrieves a user account and sets the
     * pythh_session cookie. No password required for MVP; identify by email.
     * Uses `email:<address>` as the stable openId namespace.
     */
    login: publicProcedure
      .input(z.object({
        email: z.string().email("Please enter a valid email address."),
        name: z.string().max(128).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const email = input.email.trim().toLowerCase();
        const openId = `email:${email}`;
        const isOwner = ENV.ownerEmails.includes(email);
        await upsertUser({
          openId,
          name: input.name?.trim() || null,
          email,
          role: isOwner ? "admin" : "user",
        });
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(
          COOKIE_NAME,
          JSON.stringify({ openId }),
          { ...cookieOptions, maxAge: ONE_YEAR_MS },
        );
        return { success: true } as const;
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  startups: router({
    /**
     * Returns the top startup rankings for VC-lens scoring.
     * Pulls approved startups with all GOD sub-scores so the client can
     * re-weight them per investor philosophy (YC, Sequoia, a16z, etc.).
     * Public endpoint — no Oracle gate needed since no PII is exposed.
     */
    getRankings: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(500).optional() }))
      .query(async ({ input }) => {
        const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
        const sbKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
        if (!sbUrl || !sbKey) return { startups: [], total: 0 };

        const sbClient = createClient(sbUrl, sbKey);
        const limit = input.limit ?? 100;

        const [{ count: total }, { data, error }] = await Promise.all([
          sbClient
            .from("startup_uploads")
            .select("*", { count: "exact", head: true })
            .eq("status", "approved")
            .not("total_god_score", "is", null),
          sbClient
            .from("startup_uploads")
            .select(
              "id, name, sectors, total_god_score, team_score, traction_score, market_score, product_score, vision_score, is_oversubscribed, has_followon, is_competitive, is_bridge_round, has_sector_pivot, has_social_proof_cascade, is_repeat_founder, has_cofounder_exit, psychological_multiplier"
            )
            .eq("status", "approved")
            .not("total_god_score", "is", null)
            .not("name", "is", null)
            .order("total_god_score", { ascending: false })
            .limit(limit),
        ]);

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

      return {
        startups: (data ?? []) as Array<{
          id: string;
          name: string;
          sectors: string | string[] | null;
          total_god_score: number | null;
          team_score: number | null;
          traction_score: number | null;
          market_score: number | null;
          product_score: number | null;
          vision_score: number | null;
          is_oversubscribed: boolean | null;
          has_followon: boolean | null;
          is_competitive: boolean | null;
          is_bridge_round: boolean | null;
          has_sector_pivot: boolean | null;
          has_social_proof_cascade: boolean | null;
          is_repeat_founder: boolean | null;
          has_cofounder_exit: boolean | null;
          psychological_multiplier: number | null;
        }>,
        total: total ?? 0,
      };
    }),

    /**
     * Full-text startup search for the /explore page.
     * Supports name search, sector filter, stage filter, and sort.
     */
    search: publicProcedure
      .input(
        z.object({
          query: z.string().max(200).optional(),
          sector: z.string().max(100).optional(),
          stage: z.string().max(50).optional(),
          sortBy: z.enum(["total_god_score", "created_at", "name"]).optional(),
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
      )
      .query(async ({ input }) => {
        const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
        const sbKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
        if (!sbUrl || !sbKey) return { startups: [], total: 0 };

        const sbClient = createClient(sbUrl, sbKey);
        const limit = input.limit ?? 50;
        const offset = input.offset ?? 0;
        const sortBy = input.sortBy ?? "total_god_score";

        let q = sbClient
          .from("startup_uploads")
          .select(
            "id, name, tagline, sectors, stage, website, total_god_score, team_score, traction_score, created_at",
            { count: "exact" }
          )
          .eq("status", "approved")
          .not("name", "is", null);

        if (input.query?.trim()) {
          q = q.ilike("name", `%${input.query.trim()}%`);
        }
        if (input.sector?.trim()) {
          q = q.contains("sectors", [input.sector.trim()]);
        }
        if (input.stage?.trim()) {
          q = q.eq("stage", input.stage.trim());
        }

        q = q
          .order(sortBy, { ascending: sortBy === "name" })
          .range(offset, offset + limit - 1);

        const { data, error, count } = await q;

        if (error) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: error.message });

        return {
          startups: (data ?? []) as Array<{
            id: string;
            name: string;
            tagline: string | null;
            sectors: string | string[] | null;
            stage: string | null;
            website: string | null;
            total_god_score: number | null;
            team_score: number | null;
            traction_score: number | null;
            created_at: string | null;
          }>,
          total: count ?? 0,
        };
      }),
  }),

  /**
   * Matches dashboard — aggregate stats + recent high-score pairings
   * from the pythh_matches table (91,950+ active records).
   */
  matches: router({
    getStats: publicProcedure.query(async () => {
      const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const sbKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
      if (!sbUrl || !sbKey) return { total: 0, highConf: 0, topScore: 0, sectors: [], recentCount: 0 };

      const sb = createClient(sbUrl, sbKey);

      const [
        { count: total },
        { count: highConf },
        { count: topScore },
        { data: sectorRows },
        { count: recentCount },
      ] = await Promise.all([
        sb.from("pythh_matches").select("*", { count: "exact", head: true }).eq("status", "active"),
        sb.from("pythh_matches").select("*", { count: "exact", head: true }).eq("status", "active").gte("confidence", 0.75),
        sb.from("pythh_matches").select("*", { count: "exact", head: true }).eq("status", "active").gte("match_score", 0.85),
        sb.from("pythh_matches")
          .select("explanation")
          .eq("status", "active")
          .gte("match_score", 0.80)
          .limit(500),
        sb.from("pythh_matches")
          .select("*", { count: "exact", head: true })
          .eq("status", "active")
          .gte("matched_at", new Date(Date.now() - 7 * 86400000).toISOString()),
      ]);

      // Extract sector mentions from explanations
      const sectorCounts: Record<string, number> = {};
      for (const row of sectorRows ?? []) {
        const exps: string[] = Array.isArray(row.explanation) ? row.explanation : [];
        for (const ex of exps) {
          const m = ex.match(/focuses on ([A-Za-z/]+)/);
          if (m) sectorCounts[m[1]] = (sectorCounts[m[1]] ?? 0) + 1;
        }
      }
      const sectors = Object.entries(sectorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([name, count]) => ({ name, count }));

      return {
        total: total ?? 0,
        highConf: highConf ?? 0,
        topScore: topScore ?? 0,
        recentCount: recentCount ?? 0,
        sectors,
      };
    }),
  }),

  investors: router({
    /**
     * Returns a random sample of top qualified investors from the main investors
     * table (6000+ records) for the home page animation. Each call returns a
     * different cohort from the top-1800 ranked investors.
     */
    getAnimationFeed: publicProcedure
      .input(z.object({ limit: z.number().min(1).max(30).optional() }))
      .query(async ({ input }) => {
        const rows = await getAnimationFeed(input.limit ?? 20);
        return { investors: rows };
      }),

    /**
     * Returns paginated investor signal rankings.
     * Oracle subscribers see all 44 records; non-subscribers see the 10 public rows.
     * Supports search, sector filter, column sort, and offset pagination.
     */
    getRankings: publicProcedure
      .input(
        z.object({
          search: z.string().optional(),
          sector: z.string().optional(),
          sortBy: z.enum(["signal", "god", "vcpp", "delta", "name", "firm"]).optional(),
          sortDir: z.enum(["asc", "desc"]).optional(),
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
      )
      .query(async ({ input, ctx }) => {
        // Determine if the caller has an active Oracle subscription
        let isOracle = false;
        if (ctx.user) {
          const sub = await getSubscriptionByUserId(ctx.user.id);
          isOracle =
            !!sub &&
            (sub.status === "active" || sub.status === "trialing" || sub.status === "paused") &&
            sub.plan === "oracle";
        }

        const { rows, total } = await getInvestorRankings({
          search: input.search,
          sector: input.sector,
          sortBy: input.sortBy as InvestorSortField | undefined,
          sortDir: input.sortDir as SortDir | undefined,
          limit: input.limit ?? 50,
          offset: input.offset ?? 0,
          isOracle,
        });

        return {
          investors: rows.map((r) => ({
            id: r.id,
            name: r.name,
            firm: r.firm,
            sector: r.sector,
            sector2: r.sector2,
            signal: r.signal,   // integer × 10
            delta: r.delta,     // integer × 10
            god: r.god,
            vcpp: r.vcpp,
            checkSize: r.checkSize,
            stage: r.stage,
            geo: r.geo,
            recentActivity: r.recentActivity,
            notableInvestments: r.notableInvestments ?? [],
            isPublic: r.isPublic,
          })),
          total,
          isOracle,
        };
      }),

    /**
     * Returns a single investor's full profile by ID.
     * Public investors are accessible to all; private investors require an active Oracle subscription.
     */
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const investor = await getInvestorById(input.id);
        if (!investor) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Investor not found." });
        }
        // Gate private investor profiles behind an active Oracle subscription
        if (!investor.isPublic) {
          let isOracle = false;
          if (ctx.user) {
            const sub = await getSubscriptionByUserId(ctx.user.id);
            isOracle =
              !!sub &&
              (sub.status === "active" || sub.status === "trialing" || sub.status === "paused") &&
              sub.plan === "oracle";
          }
          if (!isOracle) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Oracle plan required to view this investor profile." });
          }
        }
        return investor;
      }),
  }),
  stripe: router({
    /**
     * Creates a Stripe Checkout Session for the Oracle plan.
     * Returns the hosted checkout URL for the frontend to redirect to.
     */
    /**
     * Returns the current user's Oracle subscription status, or null.
     * Used by the Pricing page to show "Manage Plan" instead of the checkout CTA.
     */
    getSubscription: protectedProcedure.query(async ({ ctx }) => {
      const sub = await getSubscriptionByUserId(ctx.user.id);
      if (!sub) return null;
      return {
        plan: sub.plan,
        billingCycle: sub.billingCycle,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
      };
    }),

    /**
     * Returns full subscription details for the /account dashboard.
     * Includes stripeCustomerId so the portal session can be created.
     */
    getSubscriptionDetails: protectedProcedure.query(async ({ ctx }) => {
      const sub = await getSubscriptionByUserId(ctx.user.id);
      if (!sub) return null;
      return {
        plan: sub.plan,
        billingCycle: sub.billingCycle,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
        stripeCustomerId: sub.stripeCustomerId,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? 0,
        createdAt: sub.createdAt,
      };
    }),

    /**
     * Creates a Stripe Customer Portal session so the user can manage
     * their subscription (update payment method, cancel, etc.) without
     * leaving the Stripe-hosted portal.
     *
     * Returns the portal URL for the frontend to redirect to.
     */
    createPortalSession: protectedProcedure
      .input(z.object({ returnUrl: z.string().url() }))
      .mutation(async ({ input, ctx }) => {
        const sub = await getSubscriptionByUserId(ctx.user.id);
        if (!sub) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No active subscription found for this account.",
          });
        }

        const stripe = getStripe();
        const portalSession = await stripe.billingPortal.sessions.create({
          customer: sub.stripeCustomerId,
          return_url: input.returnUrl,
        });

        return { url: portalSession.url };
      }),

    /**
     * Lists the last 10 Stripe invoices for the current user.
     * Returns invoice number, amount, status, date, and hosted PDF URL.
     */
    getInvoices: protectedProcedure.query(async ({ ctx }) => {
      const sub = await getSubscriptionByUserId(ctx.user.id);
      if (!sub?.stripeCustomerId) return [];

      const stripe = getStripe();
      const invoices = await stripe.invoices.list({
        customer: sub.stripeCustomerId,
        limit: 10,
      });

      return invoices.data.map((inv) => ({
        id: inv.id,
        number: inv.number ?? inv.id,
        amountPaid: inv.amount_paid,   // in cents
        currency: inv.currency,
        status: inv.status,
        created: inv.created * 1000,   // convert to ms
        invoicePdf: inv.invoice_pdf,   // Stripe-hosted PDF URL
        hostedInvoiceUrl: inv.hosted_invoice_url,
      }));
    }),

    /**
     * Pauses the user's Oracle subscription by setting pause_collection
     * behaviour to 'void' on the Stripe subscription. The subscription
     * remains active in Stripe but no new invoices are generated until
     * the pause is lifted. We update our local status to 'paused'.
     */
    pauseSubscription: protectedProcedure
      .mutation(async ({ ctx }) => {
        const sub = await getSubscriptionByUserId(ctx.user.id);
        if (!sub?.stripeSubscriptionId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No active subscription found.",
          });
        }
        if (sub.status === "paused") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Subscription is already paused.",
          });
        }

        const stripe = getStripe();
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          pause_collection: { behavior: "void" },
        });

        // Mark as paused locally. The plan stays 'oracle' so the /activate
        // gate (which allows active + paused) keeps access until period end.
        await upsertSubscription({
          userId: ctx.user.id,
          stripeSubscriptionId: sub.stripeSubscriptionId,
          stripeCustomerId: sub.stripeCustomerId,
          plan: sub.plan,          // keep oracle — access continues
          billingCycle: sub.billingCycle,
          status: "paused",
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: 0,    // pause is not a cancellation
        });

        return { success: true };
      }),

    /**
     * Downgrades the user from the Oracle plan to the Scout (free) plan by
     * cancelling the Stripe subscription at the end of the current period.
     * We mark the local subscription as 'canceled' immediately so the UI
     * can reflect the change without waiting for the webhook.
     */
    downgradeToScout: protectedProcedure
      .mutation(async ({ ctx }) => {
        const sub = await getSubscriptionByUserId(ctx.user.id);
        if (!sub?.stripeSubscriptionId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No active subscription found.",
          });
        }

        const stripe = getStripe();
        // Cancel at period end so the user keeps Oracle access until paid for.
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          cancel_at_period_end: true,
        });

        // Keep plan='oracle' and status='active' so the /activate gate still
        // grants access until currentPeriodEnd. Set cancelAtPeriodEnd=1 so the
        // UI can show a "Cancels on <date>" badge. The webhook will flip
        // status='canceled' when Stripe fires customer.subscription.deleted.
        await upsertSubscription({
          userId: ctx.user.id,
          stripeSubscriptionId: sub.stripeSubscriptionId,
          stripeCustomerId: sub.stripeCustomerId,
          plan: sub.plan,          // keep oracle until period ends
          billingCycle: sub.billingCycle,
          status: sub.status,      // keep current status (active/trialing)
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: 1,    // flag for UI badge
        });

        return { success: true };
      }),

    /**
     * Resumes a paused Oracle subscription by clearing the pause_collection
     * setting on the Stripe subscription. Billing resumes immediately on the
     * next invoice cycle. We update our local status back to 'active'.
     */
    resumeSubscription: protectedProcedure
      .mutation(async ({ ctx }) => {
        const sub = await getSubscriptionByUserId(ctx.user.id);
        if (!sub?.stripeSubscriptionId) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No subscription found for this account.",
          });
        }
        if (sub.status !== "paused") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Subscription is not currently paused.",
          });
        }

        const stripe = getStripe();
        // Passing an empty string clears the pause_collection object in Stripe v22.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          pause_collection: "" as any,
        });

        // Restore local status to 'active'.
        await upsertSubscription({
          userId: ctx.user.id,
          stripeSubscriptionId: sub.stripeSubscriptionId,
          stripeCustomerId: sub.stripeCustomerId,
          plan: sub.plan,
          billingCycle: sub.billingCycle,
          status: "active",
          currentPeriodEnd: sub.currentPeriodEnd,
          cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? 0,
        });

        return { success: true };
      }),

    createCheckoutSession: protectedProcedure
      .input(
        z.object({
          billingCycle: z.enum(["monthly", "annual"]),
          origin: z.string().url(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const stripe = getStripe();

        // Annual: $249/mo billed as $2,988/year; Monthly: $299/mo
        const unitAmount = input.billingCycle === "annual" ? 298800 : 29900;
        const interval = input.billingCycle === "annual" ? "year" : "month";

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "subscription",
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: "PYTHIA Oracle Plan",
                  description:
                    input.billingCycle === "annual"
                      ? "Full PYTHIA pipeline automation — billed annually (save 17%)"
                      : "Full PYTHIA pipeline automation — billed monthly",
                },
                unit_amount: unitAmount,
                recurring: { interval },
              },
              quantity: 1,
            },
          ],
          success_url: `${input.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${input.origin}/checkout/cancel`,
          allow_promotion_codes: true,
          billing_address_collection: "auto",
          // 7-day free trial for all new Oracle plan subscribers.
          // Stripe will not charge the card until the trial ends.
          subscription_data: {
            trial_period_days: 7,
            metadata: { plan: "oracle", billingCycle: input.billingCycle },
          },
          // client_reference_id lets the webhook look up the Manus user
          client_reference_id: ctx.user.openId,
          // Pre-fill customer email for a smoother checkout experience
          customer_email: ctx.user.email ?? undefined,
          metadata: { plan: "oracle", billingCycle: input.billingCycle },
        });

        if (!session.url) throw new Error("Stripe did not return a checkout URL.");
        return { url: session.url };
      }),
  }),

  /**
   * PYTHIA Pipeline — startup analysis and investor matching.
   * Requires an active Oracle subscription.
   */
  pipeline: router({
    /**
     * Analyses a startup URL using PYTHIA (LLM) and returns a ranked list of
     * matched investors from the database, with a brief narrative summary.
     *
     * The procedure:
     * 1. Fetches all public investor records from the DB.
     * 2. Sends the URL + investor list to the LLM requesting structured JSON.
     * 3. Returns the matched investors with match scores and reasons.
     */
    analyzeStartup: protectedProcedure
      .input(
        z.object({
          url: z.string().url(),
          founderEmail: z.string().email().optional(),
          /** Optional client-generated id; if omitted the server assigns one and persists the run. */
          runId: z.string().min(1).max(64).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        // Tier-aware access:
        //   Admin       → unlimited
        //   Oracle/Pantheon → unlimited
        //   Scout ($29) → unlimited searches + matches (no outreach — gated in outreachRouter)
        //   No plan     → 3 free trial searches, then upgrade prompt
        const FREE_TRIAL_LIMIT = 3;
        const PAID_PLANS = new Set(["oracle", "pantheon", "scout"]);

        const sub = await getSubscriptionByUserId(ctx.user.id).catch(() => null);
        // paused = temporarily suspended but still a paid account — keep access
        const activePlan =
          sub && (sub.status === "active" || sub.status === "trialing" || sub.status === "paused")
            ? sub.plan
            : null;
        const isAdmin = ctx.user.role === "admin";

        if (!isAdmin && !activePlan) {
          const usageCount = await countPipelineRunsForUser(ctx.user.id);
          if (usageCount >= FREE_TRIAL_LIMIT) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: `Free trial limit reached (${FREE_TRIAL_LIMIT} searches). Upgrade to SCOUT ($29/mo) for more matches, or Oracle ($299/mo) for the full PYTHIA outreach agent.`,
            });
          }
        } else if (!isAdmin && activePlan && !PAID_PLANS.has(activePlan)) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "An active subscription is required to run PYTHIA analysis.",
          });
        }

        // ── Step 1: Run the real GOD + v16 pipeline via instantSubmit ────────────
        const PORT = process.env.PORT || (process.env.FLY_APP_NAME ? 8080 : 3002);
        const INSTANT_URL = `http://127.0.0.1:${PORT}/api/instant/submit`;

        let startupId: string | null = null;
        let godScore: number | null = null;

        try {
          const submitRes = await fetch(INSTANT_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: input.url }),
            signal: AbortSignal.timeout(14000),
          });
          if (submitRes.ok) {
            const body = await submitRes.json() as Record<string, unknown>;
            startupId = (body.startup_id as string) ?? null;
            godScore = (body.total_god_score as number) ?? null;
          }
        } catch (err) {
          // Non-fatal — fall through to LLM-only path
          console.warn("[analyzeStartup] instantSubmit call failed:", (err as Error).message);
        }

        // ── Step 2: Fetch real v16 matches from startup_investor_matches ─────────
        const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
        const sbKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
        const sbClient = sbUrl && sbKey ? createClient(sbUrl, sbKey) : null;

        type RealMatch = {
          investorUuid: string;
          matchScore: number;
          matchReasons: string[];
          firmName: string;
          investorName: string;
          sectors: string[];
          stage: string | null;
          checkSize: string | null;
          geo: string | null;
        };

        let realMatches: RealMatch[] = [];

        if (startupId && sbClient) {
          const { data: matchRows } = await sbClient
            .from("startup_investor_matches")
            .select(`
              investor_id,
              score,
              match_reasons,
              investors!inner(name, firm, sectors, stage, check_size_min, check_size_max, geography_focus)
            `)
            .eq("startup_id", startupId)
            .order("score", { ascending: false })
            .limit(12);

          if (matchRows && matchRows.length > 0) {
            realMatches = matchRows.map((row: Record<string, unknown>) => {
              const inv = row.investors as Record<string, unknown> | null;
              const sectors = Array.isArray(inv?.sectors)
                ? (inv.sectors as string[])
                : (typeof inv?.sectors === "string" ? [inv.sectors] : []);
              const checkMin = inv?.check_size_min as number | null;
              const checkMax = inv?.check_size_max as number | null;
              const checkSize = checkMin && checkMax
                ? `$${(checkMin / 1e6).toFixed(0)}–${(checkMax / 1e6).toFixed(0)}M`
                : checkMin ? `$${(checkMin / 1e6).toFixed(0)}M+` : null;
              return {
                investorUuid: row.investor_id as string,
                matchScore: Math.round((row.score as number ?? 0) * 100) / 100,
                matchReasons: Array.isArray(row.match_reasons) ? (row.match_reasons as string[]) : [],
                firmName: (inv?.firm as string) ?? "",
                investorName: (inv?.name as string) ?? "",
                sectors,
                stage: (inv?.stage as string) ?? null,
                checkSize,
                geo: (inv?.geography_focus as string) ?? null,
              };
            });
          }
        }

        // ── Step 3: Bridge real matches → pythh_investors by firm name ────────────
        const isOracleTier = isAdmin || activePlan === "oracle" || activePlan === "pantheon";
        const { rows: pythhInvestors } = await getInvestorRankings({ limit: 100, offset: 0, isOracle: isOracleTier });
        const pythhByFirm = new Map(pythhInvestors.map((inv) => [inv.firm.toLowerCase().trim(), inv]));

        // Map real matches to pythh_investors where firm name matches
        const bridgedMatches = realMatches
          .map((rm) => {
            const pythh = pythhByFirm.get(rm.firmName.toLowerCase().trim());
            return pythh ? { rm, pythh } : null;
          })
          .filter(Boolean) as Array<{ rm: RealMatch; pythh: (typeof pythhInvestors)[number] }>;

        // If we got fewer than 3 bridged matches fall back to LLM ranking over pythh_investors
        const useLLMRanking = bridgedMatches.length < 3;

        // ── Step 4: Founder profile context for LLM ───────────────────────────────
        const founderProfile = await getFounderProfile(ctx.user.id);
        const founderLines: string[] = [];
        if (founderProfile) {
          if (founderProfile.companyName) founderLines.push(`Company: ${founderProfile.companyName}`);
          if (founderProfile.companyUrl) founderLines.push(`Company URL: ${founderProfile.companyUrl}`);
          if (founderProfile.stage) founderLines.push(`Stage: ${founderProfile.stage}`);
          if (founderProfile.sector) founderLines.push(`Sector: ${founderProfile.sector}`);
          if (founderProfile.askAmount) founderLines.push(`Ask: ${founderProfile.askAmount}`);
          if (founderProfile.bio) founderLines.push(`Bio: ${founderProfile.bio}`);
        }
        const founderBlock = founderLines.length > 0
          ? `\n\nFounder profile:\n${founderLines.join("\n")}`
          : "";

        const { invokeLLM } = await import("./_core/llm");

        let enrichedMatches: Array<{
          id: number; name: string; firm: string; sector: string[];
          stage: string; checkSize: string; geo: string;
          signalScore: number; recentActivity: string;
          matchScore: number; reason: string; godScore?: number | null;
        }>;
        let summary: string;

        if (useLLMRanking) {
          // ── Fallback: LLM ranks pythh_investors (no real v16 data available yet) ──
          const investorList = pythhInvestors.map((inv) => ({
            id: inv.id, name: inv.name, firm: inv.firm,
            sectors: [inv.sector, inv.sector2].filter(Boolean).join(", "),
            stage: inv.stage, checkSize: inv.checkSize, geo: inv.geo,
            signal: (inv.signal / 10).toFixed(1),
          }));

          const llmRes = await invokeLLM({
            messages: [
              { role: "system", content: `You are PYTHIA, a VC matching oracle. Rank the top 6 investors for this startup by fit. Return ONLY valid JSON.` },
              { role: "user", content: `Startup URL: ${input.url}${founderBlock}\n\nInvestors:\n${JSON.stringify(investorList, null, 2)}\n\nReturn JSON: { summary: string, matches: [{investorId: number, matchScore: number, reason: string}] }` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "pythia_matches", strict: true,
                schema: {
                  type: "object",
                  properties: {
                    summary: { type: "string" },
                    matches: { type: "array", items: { type: "object", properties: { investorId: { type: "number" }, matchScore: { type: "number" }, reason: { type: "string" } }, required: ["investorId", "matchScore", "reason"], additionalProperties: false } },
                  },
                  required: ["summary", "matches"], additionalProperties: false,
                },
              },
            },
          });

          const rawContent = llmRes.choices?.[0]?.message?.content;
          if (!rawContent) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "PYTHIA returned an empty response." });
          let parsed: { summary: string; matches: Array<{ investorId: number; matchScore: number; reason: string }> };
          try { parsed = JSON.parse(rawContent); } catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "PYTHIA returned malformed JSON." }); }

          summary = parsed.summary;
          const investorMap = new Map(pythhInvestors.map((inv) => [inv.id, inv]));
          enrichedMatches = parsed.matches
            .filter((m) => investorMap.has(m.investorId))
            .slice(0, 6)
            .map((m) => {
              const inv = investorMap.get(m.investorId)!;
              return {
                id: inv.id, name: inv.name, firm: inv.firm,
                sector: [inv.sector, inv.sector2].filter(Boolean) as string[],
                stage: inv.stage ?? "Series A/B",
                checkSize: inv.checkSize ?? "$5–20M",
                geo: inv.geo ?? "US",
                signalScore: parseFloat((inv.signal / 10).toFixed(1)),
                recentActivity: inv.recentActivity ?? "",
                matchScore: Math.min(100, Math.max(0, Math.round(m.matchScore))),
                reason: m.reason,
                godScore,
              };
            });
        } else {
          // ── Primary path: LLM narrates real v16 matches ─────────────────────────
          const matchContext = bridgedMatches.slice(0, 6).map(({ rm, pythh }) => ({
            name: pythh.name, firm: pythh.firm,
            sectors: rm.sectors.join(", ") || [pythh.sector, pythh.sector2].filter(Boolean).join(", "),
            stage: rm.stage || pythh.stage,
            checkSize: rm.checkSize || pythh.checkSize,
            matchScore: rm.matchScore,
            matchReasons: rm.matchReasons.slice(0, 3).join("; "),
          }));

          const narrativeRes = await invokeLLM({
            messages: [
              { role: "system", content: `You are PYTHIA. The matching engine has already ranked these investors. Your job is to write a narrative summary and a 1-2 sentence reason for each match explaining WHY this investor fits. Use the match reasons provided. Return ONLY valid JSON.` },
              { role: "user", content: `Startup URL: ${input.url}${founderBlock}\nGOD Score: ${godScore ?? "pending"}\n\nReal matches from scoring engine:\n${JSON.stringify(matchContext, null, 2)}\n\nReturn JSON: { summary: string, reasons: [{firm: string, reason: string}] }` },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "pythia_narrative", strict: true,
                schema: {
                  type: "object",
                  properties: {
                    summary: { type: "string" },
                    reasons: { type: "array", items: { type: "object", properties: { firm: { type: "string" }, reason: { type: "string" } }, required: ["firm", "reason"], additionalProperties: false } },
                  },
                  required: ["summary", "reasons"], additionalProperties: false,
                },
              },
            },
          });

          const rawNarr = narrativeRes.choices?.[0]?.message?.content;
          let narrative: { summary: string; reasons: Array<{ firm: string; reason: string }> };
          try { narrative = JSON.parse(rawNarr ?? "{}"); } catch { narrative = { summary: `PYTHIA identified ${bridgedMatches.length} strong investor matches for this startup based on sector alignment and stage fit.`, reasons: [] }; }

          const reasonMap = new Map((narrative.reasons ?? []).map((r) => [r.firm.toLowerCase(), r.reason]));
          summary = narrative.summary;

          enrichedMatches = bridgedMatches.slice(0, 6).map(({ rm, pythh }) => ({
            id: pythh.id, name: pythh.name, firm: pythh.firm,
            sector: rm.sectors.length > 0 ? rm.sectors : [pythh.sector, pythh.sector2].filter(Boolean) as string[],
            stage: rm.stage ?? pythh.stage ?? "Series A/B",
            checkSize: rm.checkSize ?? pythh.checkSize ?? "$5–20M",
            geo: rm.geo ?? pythh.geo ?? "US",
            signalScore: parseFloat((pythh.signal / 10).toFixed(1)),
            recentActivity: pythh.recentActivity ?? "",
            matchScore: Math.min(100, Math.max(0, Math.round(rm.matchScore))),
            reason: reasonMap.get(pythh.firm.toLowerCase()) ?? (rm.matchReasons.slice(0, 2).join(". ") || "Strong sector and stage alignment."),
            godScore,
          }));
        }

        const runId = input.runId?.trim() || randomUUID();
        await createPipelineRun({
          userId: ctx.user.id,
          runId,
          startupUrl: input.url,
          summary,
          matches: enrichedMatches,
        });

        return {
          runId,
          summary,
          matches: enrichedMatches,
          godScore,
          realMatchesUsed: !useLLMRanking,
        };
      }),

    /** Last N saved pipeline runs for the signed-in user (handoff §6.3). */
    getRunHistory: protectedProcedure.query(async ({ ctx }) => {
      const rows = await listRecentPipelineRunsForUser(ctx.user.id, 10);
      return rows.map((r) => ({
        runId: r.runId,
        startupUrl: r.startupUrl,
        summary: r.summary,
        status: r.status,
        createdAt: r.createdAt,
        matchCount: (() => {
          try {
            const arr = JSON.parse(r.matchedInvestorsJson || "[]");
            return Array.isArray(arr) ? arr.length : 0;
          } catch {
            return 0;
          }
        })(),
      }));
    }),

    /**
     * Saves a thumbs-up or thumbs-down rating for a PYTHIA analysis run.
     *
     * The client generates a UUID `runId` before calling `analyzeStartup`
     * and passes the same ID here. Calling this procedure again with the
     * same `runId` updates the existing rating (upsert semantics).
     *
     * An optional `comment` (max 500 chars) can accompany the rating.
     */
    /**
     * Known thumbs-down reason categories shown as chips in the FeedbackWidget.
     * Kept as a const so the frontend and backend share the same set.
     */
    submitFeedback: protectedProcedure
      .input(
        z.object({
          runId: z.string().min(1).max(64),
          rating: z.enum(["up", "down"]),
          /**
           * Pre-defined reason for a thumbs-down rating.
           * Must be one of the known categories or omitted.
           */
          reason: z
            .enum([
              "wrong_investors",
              "inaccurate_scores",
              "missing_sectors",
              "poor_summary",
              "wrong_stage",
              "other",
            ])
            .optional(),
          comment: z.string().max(500).optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        await upsertPipelineFeedback({
          userId: ctx.user.id,
          runId: input.runId,
          rating: input.rating,
          reason: input.reason ?? null,
          comment: input.comment ?? null,
        });
        return { success: true };
      }),

    /**
     * Returns the current user's feedback for a given run, or null.
     * Used by the FeedbackWidget to restore state on re-render.
     */
    getFeedback: protectedProcedure
      .input(z.object({ runId: z.string().min(1).max(64) }))
      .query(async ({ input, ctx }) => {
        const row = await getPipelineFeedbackByRunId(ctx.user.id, input.runId);
        if (!row) return null;
        return { rating: row.rating, reason: row.reason ?? null, comment: row.comment ?? null };
      }),
  }),

  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const row = await getFounderProfile(ctx.user.id);
      return row ?? null;
    }),
    upsert: protectedProcedure
      .input(
        z.object({
          companyName: z.string().max(256).optional(),
          companyUrl: z.string().max(512).optional(),
          stage: z.string().max(64).optional(),
          sector: z.string().max(128).optional(),
          askAmount: z.string().max(64).optional(),
          deckFileKey: z.string().max(256).optional(),
          bio: z.string().max(8000).optional(),
          linkedinUrl: z.string().max(512).optional(),
        }),
      )
      .mutation(async ({ input, ctx }) => {
        const patch = {
          companyName: input.companyName?.trim() || null,
          companyUrl: input.companyUrl?.trim() || null,
          stage: input.stage?.trim() || null,
          sector: input.sector?.trim() || null,
          askAmount: input.askAmount?.trim() || null,
          deckFileKey: input.deckFileKey?.trim() || null,
          bio: input.bio?.trim() || null,
          linkedinUrl: input.linkedinUrl?.trim() || null,
        };
        await upsertFounderProfile(ctx.user.id, patch);
        return { ok: true as const };
      }),
  }),

  admin: router({
    getStats: adminProcedure.query(async () => getAdminAggregateStats()),
    getRecentFeedback: adminProcedure.query(async () => getRecentFeedbackWithUsers(20)),
    listUsers: adminProcedure.query(async () => listUsersBrief(100)),

    // ── GOD Score Manager ──────────────────────────────────────────────────
    getGodScoreSummary: adminProcedure.query(async () => {
      const [distribution, runtime, weights] = await Promise.all([
        rawQuery<{ bucket: string; cnt: string }>(`
          SELECT
            CASE
              WHEN total_god_score IS NULL THEN 'unscored'
              WHEN total_god_score < 20    THEN '0–20'
              WHEN total_god_score < 40    THEN '20–40'
              WHEN total_god_score < 60    THEN '40–60'
              WHEN total_god_score < 80    THEN '60–80'
              ELSE '80–100'
            END AS bucket,
            COUNT(*) AS cnt
          FROM startup_uploads
          GROUP BY 1
          ORDER BY 1
        `),
        rawQuery(`SELECT * FROM god_runtime_config LIMIT 1`),
        rawQuery(`
          SELECT weights_version, status, weights, comment, created_at
          FROM god_weight_versions
          ORDER BY created_at DESC
          LIMIT 10
        `),
      ]);

      const scoreStats = await rawQuery<{ avg: string; max: string; min: string; total: string }>(`
        SELECT
          ROUND(AVG(total_god_score)::numeric, 2) AS avg,
          MAX(total_god_score)                    AS max,
          MIN(total_god_score)                    AS min,
          COUNT(*)                                AS total
        FROM startup_uploads
        WHERE total_god_score IS NOT NULL
      `);

      return {
        distribution,
        runtime: runtime[0] ?? null,
        weightHistory: weights,
        stats: scoreStats[0] ?? null,
      };
    }),

    freezeGodScoring: adminProcedure
      .input(z.object({ freeze: z.boolean() }))
      .mutation(async ({ input }) => {
        await rawExecute(
          `UPDATE god_runtime_config SET freeze = $1, updated_at = now() WHERE id = (SELECT id FROM god_runtime_config LIMIT 1)`,
          [input.freeze],
        );
        return { ok: true };
      }),

    // ── Signal Scores ──────────────────────────────────────────────────────
    getSignalSummary: adminProcedure.query(async () => {
      const cultureClasses = [
        'founder_psychology_signal', 'founder_excellence_signal', 'founder_cunning_signal',
        'customer_delight_signal', 'talent_magnet_signal', 'failure_learning_signal', 'failure_exit_signal',
      ];
      const classList = cultureClasses.map((c) => `'${c}'`).join(', ');

      const [summary, topStartups, bottomStartups, recentHistory, cultureEvents, voiceAgg, topCulture] = await Promise.all([
        rawQuery<{ avg_total: string; count: string }>(`
          SELECT ROUND(AVG(signals_total)::numeric, 2) AS avg_total, COUNT(*) AS count
          FROM startup_signal_scores
        `),
        rawQuery(`
          SELECT s.company_name, ss.signals_total, ss.founder_language_shift,
                 ss.investor_receptivity, ss.news_momentum, ss.capital_convergence,
                 ss.execution_velocity, ss.as_of
          FROM startup_signal_scores ss
          JOIN startup_uploads s ON s.id = ss.startup_id
          ORDER BY ss.signals_total DESC
          LIMIT 15
        `),
        rawQuery(`
          SELECT s.company_name, ss.signals_total, ss.as_of
          FROM startup_signal_scores ss
          JOIN startup_uploads s ON s.id = ss.startup_id
          ORDER BY ss.signals_total ASC
          LIMIT 10
        `),
        rawQuery(`
          SELECT startup_id, dimension, old_value, new_value, applied, created_at
          FROM signal_history
          ORDER BY created_at DESC
          LIMIT 50
        `),
        rawQuery<{ primary_signal: string; cnt: string }>(`
          SELECT primary_signal, COUNT(*)::text AS cnt
          FROM pythh_signal_events
          WHERE primary_signal IN (${classList})
          GROUP BY primary_signal
          ORDER BY COUNT(*) DESC
        `),
        rawQuery<{ avg_team_credit: string; avg_culture: string; n: string }>(`
          SELECT
            ROUND(AVG((debug->'founder_voice'->>'teamCreditRatio')::numeric), 2)::text AS avg_team_credit,
            ROUND(AVG((debug->'founder_voice'->>'cultureScore')::numeric), 2)::text AS avg_culture,
            COUNT(*) FILTER (WHERE debug->'founder_voice' IS NOT NULL)::text AS n
          FROM startup_signal_scores
          WHERE debug->'founder_voice' IS NOT NULL
        `),
        rawQuery(`
          SELECT s.company_name,
                 (ss.debug->'founder_voice'->>'cultureScore')::numeric AS culture_score,
                 (ss.debug->'founder_voice'->>'teamCreditRatio')::numeric AS team_credit_ratio
          FROM startup_signal_scores ss
          JOIN startup_uploads s ON s.id = ss.startup_id
          WHERE ss.debug->'founder_voice' IS NOT NULL
          ORDER BY culture_score DESC NULLS LAST
          LIMIT 10
        `),
      ]);

      const classLabels: Record<string, string> = {
        founder_psychology_signal: 'Psychology',
        founder_excellence_signal: 'Excellence',
        founder_cunning_signal: 'Cunning / ship fast',
        customer_delight_signal: 'Customer delight',
        talent_magnet_signal: 'Talent magnet',
        failure_learning_signal: 'Failure → learning',
        failure_exit_signal: 'Failure → exit',
      };
      const classTotals: Record<string, number> = {};
      for (const c of cultureClasses) classTotals[c] = 0;
      for (const row of cultureEvents) {
        classTotals[row.primary_signal] = Number(row.cnt) || 0;
      }

      const voiceRow = voiceAgg[0] ?? {};
      return {
        summary: summary[0] ?? null,
        topStartups,
        bottomStartups,
        recentHistory,
        founderVoice: {
          classTotals,
          classLabels,
          avgTeamCreditRatio: voiceRow.avg_team_credit ?? null,
          avgCultureScore: voiceRow.avg_culture ?? null,
          startupsWithVoiceMetrics: Number(voiceRow.n ?? 0),
        },
        topCultureStartups: topCulture,
      };
    }),

    getMatchSummary: adminProcedure.query(async () => {
      const [totals, buckets] = await Promise.all([
        rawQuery<{ total: string; high_score: string; strong_fit: string; recent7d: string; avg_score: string }>(`
          SELECT
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE score >= 0.75)::text AS high_score,
            COUNT(*) FILTER (WHERE score >= 0.85)::text AS strong_fit,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text AS recent7d,
            ROUND(AVG(score)::numeric, 3)::text AS avg_score
          FROM startup_investor_matches
        `),
        rawQuery<{ bucket: string; cnt: string }>(`
          SELECT
            CASE
              WHEN score IS NULL THEN 'unscored'
              WHEN score < 0.5  THEN '0.0–0.5'
              WHEN score < 0.7  THEN '0.5–0.7'
              WHEN score < 0.85 THEN '0.7–0.85'
              ELSE '0.85+'
            END AS bucket,
            COUNT(*)::text AS cnt
          FROM startup_investor_matches
          GROUP BY 1
          ORDER BY 1
        `),
      ]);
      const row = totals[0] ?? {};
      return {
        total: row.total ?? "0",
        highScore: row.high_score ?? "0",
        strongFit: row.strong_fit ?? "0",
        recent7d: row.recent7d ?? "0",
        avgScore: row.avg_score ?? null,
        buckets,
      };
    }),

    // ── ML Agent ──────────────────────────────────────────────────────────
    getMlRecommendations: adminProcedure.query(async () => {
      const [pending, recent, entityGateStats] = await Promise.all([
        rawQuery(`
          SELECT id, weights_version, recommendation_type, confidence, reasoning,
                 expected_improvement, status, requires_manual_approval,
                 current_weights, recommended_weights, created_at
          FROM ml_recommendations
          WHERE status = 'pending'
          ORDER BY created_at DESC
          LIMIT 20
        `),
        rawQuery(`
          SELECT id, recommendation_type, confidence, status, reviewed_at, rejection_reason, created_at
          FROM ml_recommendations
          WHERE status != 'pending'
          ORDER BY created_at DESC
          LIMIT 20
        `),
        rawQuery<{ gate: string; cnt: string }>(`
          SELECT entity_gate AS gate, COUNT(*) AS cnt
          FROM startup_uploads
          GROUP BY entity_gate
          ORDER BY cnt DESC
        `),
      ]);
      return { pending, recent, entityGateStats };
    }),

    reviewMlRecommendation: adminProcedure
      .input(z.object({ id: z.string(), action: z.enum(["approve", "reject"]), reason: z.string().optional() }))
      .mutation(async ({ input, ctx }) => {
        const status = input.action === "approve" ? "approved" : "rejected";
        await rawExecute(
          `UPDATE ml_recommendations
           SET status = $1, reviewed_at = now(), reviewed_by = $2, rejection_reason = $3
           WHERE id = $4`,
          [status, ctx.user.id, input.reason ?? null, input.id],
        );
        return { ok: true };
      }),

    // ── RSS Feed Manager ───────────────────────────────────────────────────
    getRssFeeds: adminProcedure.query(async () => {
      return rawQuery(`
        SELECT id, name, url, category, active, priority,
               last_scraped, total_discoveries, avg_yield_per_scrape,
               consecutive_failures, created_at
        FROM rss_sources
        ORDER BY active DESC, priority ASC, name ASC
      `);
    }),

    toggleRssFeed: adminProcedure
      .input(z.object({ id: z.number(), active: z.boolean() }))
      .mutation(async ({ input }) => {
        await rawExecute(
          `UPDATE rss_sources SET active = $1 WHERE id = $2`,
          [input.active, input.id],
        );
        return { ok: true };
      }),

    // ── Analytics ─────────────────────────────────────────────────────────
    getAnalytics: adminProcedure.query(async () => {
      const [eventBreakdown, dailySignups, pageViews, usageStats] = await Promise.all([
        rawQuery<{ event_name: string; cnt: string }>(`
          SELECT event_name, COUNT(*) AS cnt
          FROM events
          WHERE created_at > now() - interval '30 days'
          GROUP BY event_name
          ORDER BY cnt DESC
          LIMIT 25
        `),
        rawQuery<{ day: string; cnt: string }>(`
          SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS day, COUNT(*) AS cnt
          FROM pythh_users
          WHERE created_at > now() - interval '30 days'
          GROUP BY 1
          ORDER BY 1
        `),
        rawQuery<{ page: string; cnt: string }>(`
          SELECT page, COUNT(*) AS cnt
          FROM events
          WHERE event_name = 'page_viewed'
            AND created_at > now() - interval '30 days'
          GROUP BY page
          ORDER BY cnt DESC
          LIMIT 20
        `),
        rawQuery<{ total_users: string; avg_analysis_count: string; active_30d: string }>(`
          SELECT
            COUNT(*) AS total_users,
            ROUND(AVG(analysis_count)::numeric, 1) AS avg_analysis_count,
            COUNT(*) FILTER (WHERE updated_at > now() - interval '30 days') AS active_30d
          FROM profiles
        `),
      ]);
      return { eventBreakdown, dailySignups, pageViews, usageStats: usageStats[0] ?? null };
    }),
  }),
});

export type AppRouter = typeof appRouter;
