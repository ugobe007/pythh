import Stripe from "stripe";
import { z } from "zod";
import { COOKIE_NAME, ONE_YEAR_MS } from "./shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { randomUUID } from "node:crypto";
import {
  createPipelineRun,
  getAdminAggregateStats,
  getFounderProfile,
  getInvestorById,
  getInvestorRankings,
  getPipelineFeedbackByRunId,
  getRecentFeedbackWithUsers,
  getSubscriptionByUserId,
  listRecentPipelineRunsForUser,
  listUsersBrief,
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

  investors: router({
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
        // Verify Oracle subscription
        const sub = await getSubscriptionByUserId(ctx.user.id);
        const isOracle =
          !!sub &&
          (sub.status === "active" || sub.status === "trialing" || sub.status === "paused") &&
          sub.plan === "oracle";
        if (!isOracle) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Oracle plan required to run PYTHIA analysis.",
          });
        }

        // Fetch all investors (Oracle sees all 44)
        const { rows: allInvestors } = await getInvestorRankings({
          limit: 100,
          offset: 0,
          isOracle: true,
        });

        const founderProfile = await getFounderProfile(ctx.user.id);
        const founderLines: string[] = [];
        if (founderProfile) {
          if (founderProfile.companyName) founderLines.push(`Company: ${founderProfile.companyName}`);
          if (founderProfile.companyUrl) founderLines.push(`Company URL (profile): ${founderProfile.companyUrl}`);
          if (founderProfile.stage) founderLines.push(`Stage: ${founderProfile.stage}`);
          if (founderProfile.sector) founderLines.push(`Sector: ${founderProfile.sector}`);
          if (founderProfile.askAmount) founderLines.push(`Ask: ${founderProfile.askAmount}`);
          if (founderProfile.bio) founderLines.push(`Bio: ${founderProfile.bio}`);
          if (founderProfile.linkedinUrl) founderLines.push(`LinkedIn: ${founderProfile.linkedinUrl}`);
        }

        // Build a compact investor list for the LLM prompt
        const investorList = allInvestors.map((inv) => ({
          id: inv.id,
          name: inv.name,
          firm: inv.firm,
          sectors: [inv.sector, inv.sector2].filter(Boolean).join(", "),
          stage: inv.stage,
          checkSize: inv.checkSize,
          geo: inv.geo,
          signal: (inv.signal / 10).toFixed(1),
          recentActivity: inv.recentActivity,
        }));

        const { invokeLLM } = await import("./_core/llm");

        const systemPrompt = `You are PYTHIA, an AI fundraising oracle specialising in venture capital investor matching.
You receive a startup URL and a list of active investors. Your job is to:
1. Infer the startup's sector, stage, and value proposition from the URL.
2. Rank the top 6 investors by fit, considering sector alignment, stage, check size, and recent activity.
3. Return a structured JSON response.

IMPORTANT: Return ONLY valid JSON matching the schema exactly. No markdown, no explanation.`;

        const founderBlock =
          founderLines.length > 0
            ? `\n\nFounder-provided profile (use together with the URL; prefer this when it conflicts with a weak guess from the URL alone):\n${founderLines.join("\n")}`
            : "";

        const userPrompt = `Startup URL: ${input.url}${founderBlock}

Available investors (${investorList.length} total):
${JSON.stringify(investorList, null, 2)}

Return the top 6 best-fit investors for this startup.`;

        const llmResponse = await invokeLLM({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "pythia_matches",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  summary: {
                    type: "string",
                    description: "PYTHIA's 2-3 sentence narrative on the startup's strongest fundraising angle and recommended approach.",
                  },
                  matches: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        investorId: { type: "number", description: "The investor's id from the list" },
                        matchScore: { type: "number", description: "Match score 0-100" },
                        reason: { type: "string", description: "1-2 sentences on why this investor fits" },
                      },
                      required: ["investorId", "matchScore", "reason"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["summary", "matches"],
                additionalProperties: false,
              },
            },
          },
        });

        // Parse the LLM response
        const rawContent = llmResponse.choices?.[0]?.message?.content;
        const content = typeof rawContent === "string" ? rawContent : null;
        if (!content) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "PYTHIA returned an empty response." });
        let parsed: { summary: string; matches: Array<{ investorId: number; matchScore: number; reason: string }> };
        try {
          parsed = JSON.parse(content);;
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "PYTHIA returned malformed JSON." });
        }

        // Enrich matches with full investor data
        const investorMap = new Map(allInvestors.map((inv) => [inv.id, inv]));
        const enrichedMatches = parsed.matches
          .filter((m) => investorMap.has(m.investorId))
          .slice(0, 6)
          .map((m) => {
            const inv = investorMap.get(m.investorId)!;
            return {
              id: inv.id,
              name: inv.name,
              firm: inv.firm,
              sector: [inv.sector, inv.sector2].filter(Boolean) as string[],
              stage: inv.stage ?? "Series A/B",
              checkSize: inv.checkSize ?? "$5–20M",
              geo: inv.geo ?? "US",
              signalScore: parseFloat((inv.signal / 10).toFixed(1)),
              recentActivity: inv.recentActivity ?? "",
              matchScore: Math.min(100, Math.max(0, Math.round(m.matchScore))),
              reason: m.reason,
            };
          });

        const runId = input.runId?.trim() || randomUUID();
        await createPipelineRun({
          userId: ctx.user.id,
          runId,
          startupUrl: input.url,
          summary: parsed.summary,
          matches: enrichedMatches,
        });

        return {
          runId,
          summary: parsed.summary,
          matches: enrichedMatches,
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
  }),
});

export type AppRouter = typeof appRouter;
