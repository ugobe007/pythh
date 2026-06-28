/**
 * Tests for stripe.pauseSubscription and stripe.downgradeToScout procedures.
 *
 * Corrected behavior (post bug-fix):
 * - pauseSubscription: sets status="paused", keeps plan="oracle", cancelAtPeriodEnd=0
 * - downgradeToScout: keeps plan="oracle" and current status, sets cancelAtPeriodEnd=1
 *   (access preserved until period end; webhook flips status to "canceled" later)
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { appRouter } from "./routers";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getSubscriptionByUserId: vi.fn(),
  upsertSubscription: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

const mockStripeSubscriptionsUpdate = vi.fn();
vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      subscriptions: {
        update: mockStripeSubscriptionsUpdate,
      },
    })),
  };
});

import {
  getSubscriptionByUserId as mockGetSubscriptionByUserId,
  upsertSubscription as mockUpsertSubscription,
} from "./db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCaller() {
  return appRouter.createCaller({
    user: {
      id: 1,
      openId: "test_open_id",
      name: "Test User",
      email: "test@example.com",
      role: "user" as const,
    },
    req: {} as never,
    res: {} as never,
  });
}

const ACTIVE_SUB = {
  id: 1,
  userId: 1,
  stripeCustomerId: "cus_abc",
  stripeSubscriptionId: "sub_abc",
  plan: "oracle" as const,
  billingCycle: "monthly" as const,
  status: "active" as const,
  currentPeriodEnd: 1800000000000,
  cancelAtPeriodEnd: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── pauseSubscription ────────────────────────────────────────────────────────

describe("stripe.pauseSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  });

  it("pauses an active subscription, keeps plan=oracle and cancelAtPeriodEnd=0", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(ACTIVE_SUB);
    mockStripeSubscriptionsUpdate.mockResolvedValue({});
    (mockUpsertSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const caller = makeCaller();
    const result = await caller.stripe.pauseSubscription();

    expect(result).toEqual({ success: true });

    // Stripe was called with pause_collection
    expect(mockStripeSubscriptionsUpdate).toHaveBeenCalledWith("sub_abc", {
      pause_collection: { behavior: "void" },
    });

    // Local DB: status=paused, plan stays oracle, cancelAtPeriodEnd=0
    expect(mockUpsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paused",
        plan: "oracle",
        cancelAtPeriodEnd: 0,
      })
    );
  });

  it("throws NOT_FOUND when user has no subscription", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const caller = makeCaller();
    await expect(caller.stripe.pauseSubscription()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockStripeSubscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST when subscription is already paused", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...ACTIVE_SUB,
      status: "paused",
    });

    const caller = makeCaller();
    await expect(caller.stripe.pauseSubscription()).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mockStripeSubscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("does not call upsert if Stripe update throws", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(ACTIVE_SUB);
    mockStripeSubscriptionsUpdate.mockRejectedValue(new Error("Stripe error"));

    const caller = makeCaller();
    await expect(caller.stripe.pauseSubscription()).rejects.toThrow("Stripe error");
    expect(mockUpsertSubscription).not.toHaveBeenCalled();
  });
});

// ─── downgradeToScout ─────────────────────────────────────────────────────────

describe("stripe.downgradeToScout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  });

  it("schedules cancellation at period end, keeps plan=oracle and sets cancelAtPeriodEnd=1", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(ACTIVE_SUB);
    mockStripeSubscriptionsUpdate.mockResolvedValue({});
    (mockUpsertSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const caller = makeCaller();
    const result = await caller.stripe.downgradeToScout();

    expect(result).toEqual({ success: true });

    // Stripe was called with cancel_at_period_end=true
    expect(mockStripeSubscriptionsUpdate).toHaveBeenCalledWith("sub_abc", {
      cancel_at_period_end: true,
    });

    // Local DB: plan stays oracle, status unchanged, cancelAtPeriodEnd=1
    expect(mockUpsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "oracle",
        status: "active",
        cancelAtPeriodEnd: 1,
      })
    );
  });

  it("throws NOT_FOUND when user has no subscription", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const caller = makeCaller();
    await expect(caller.stripe.downgradeToScout()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockStripeSubscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("preserves the existing billingCycle when downgrading", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...ACTIVE_SUB,
      billingCycle: "annual",
    });
    mockStripeSubscriptionsUpdate.mockResolvedValue({});
    (mockUpsertSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const caller = makeCaller();
    await caller.stripe.downgradeToScout();

    expect(mockUpsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ billingCycle: "annual" })
    );
  });

  it("does not call upsert if Stripe update throws", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(ACTIVE_SUB);
    mockStripeSubscriptionsUpdate.mockRejectedValue(new Error("Stripe error"));

    const caller = makeCaller();
    await expect(caller.stripe.downgradeToScout()).rejects.toThrow("Stripe error");
    expect(mockUpsertSubscription).not.toHaveBeenCalled();
  });

  it("works for a trialing subscription and preserves trialing status", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...ACTIVE_SUB,
      status: "trialing",
    });
    mockStripeSubscriptionsUpdate.mockResolvedValue({});
    (mockUpsertSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const caller = makeCaller();
    const result = await caller.stripe.downgradeToScout();

    expect(result).toEqual({ success: true });
    expect(mockUpsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        plan: "oracle",
        status: "trialing",
        cancelAtPeriodEnd: 1,
      })
    );
  });
});
