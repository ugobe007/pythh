import type { Request, Response } from "express";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { UNAUTHED_ERR_MSG } from "../shared/const";
import { getSubscriptionByUserId } from "../db";
import { ENV } from "../env";

export type AuthedUser = {
  id: number;
  openId: string;
  name: string | null;
  email: string | null;
  role: "user" | "admin";
};

export type TrpcContext = {
  user: AuthedUser | null;
  req: Request;
  res: Response;
};

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;

export const publicProcedure = t.procedure;

const requireUser = t.middleware(({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const protectedProcedure = t.procedure.use(requireUser);

function isAdminUser(user: AuthedUser | null | undefined): user is AuthedUser {
  if (!user) return false;
  if (user.role === "admin") return true;
  const email = user.email?.trim().toLowerCase();
  return !!email && ENV.ownerEmails.includes(email);
}

const requireAdmin = t.middleware(({ ctx, next }) => {
  if (!isAdminUser(ctx.user)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only." });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

export const adminProcedure = t.procedure.use(requireUser).use(requireAdmin);

/**
 * Plans that include PYTHIA outreach agent services.
 * Scout: 1 active campaign · Oracle/Pantheon: full automation.
 */
const OUTREACH_PLANS = new Set(["scout", "oracle", "pantheon"]);

const requireOutreachPlan = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  // Admin users bypass subscription gate
  if (isAdminUser(ctx.user)) {
    return next({ ctx: { ...ctx, user: ctx.user } });
  }
  const sub = await getSubscriptionByUserId(ctx.user.id).catch(() => null);
  if (!sub || sub.status !== "active" || !OUTREACH_PLANS.has(sub.plan)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message:
        "PYTHIA outreach agent requires a Scout or Oracle subscription. Upgrade at pythh.ai/pricing.",
    });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

/** Use on outreach procedures: generateEmailPitch, sendEmail, proposeMeeting, etc. */
export const outreachProcedure = t.procedure.use(requireUser).use(requireOutreachPlan);
