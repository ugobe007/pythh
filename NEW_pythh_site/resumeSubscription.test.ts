/**
 * Tests for stripe.resumeSubscription tRPC procedure.
 *
 * Behaviour:
 * - Only works when status === "paused"
 * - Calls stripe.subscriptions.update with pause_collection=""
 * - Updates local DB status back to "active"
 * - Throws NOT_FOUND when no subscription exists
 * - Throws BAD_REQUEST when subscription is not paused
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("./db", () => ({
  getSubscriptionByUserId: vi.fn(),
  upsertSubscription: vi.fn(),
  getUserByOpenId: vi.fn(),
}));

const mockStripeSubscriptionsUpdate = vi.fn();
vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    subscriptions: {
      update: mockStripeSubscriptionsUpdate,
    },
  })),
}));

import {
  getSubscriptionByUserId as mockGetSubscriptionByUserId,
  upsertSubscription as mockUpsertSubscription,
} from "./db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: 1,
  openId: "test_open_id",
  name: "Test User",
  email: "test@example.com",
  role: "user" as const,
};

function makeCaller() {
  return appRouter.createCaller({
    user: MOCK_USER,
    req: {} as never,
    res: {} as never,
  });
}

const PAUSED_SUB = {
  id: 1,
  userId: 1,
  stripeCustomerId: "cus_abc",
  stripeSubscriptionId: "sub_abc",
  plan: "oracle" as const,
  billingCycle: "monthly" as const,
  status: "paused" as const,
  currentPeriodEnd: 1800000000000,
  cancelAtPeriodEnd: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── resumeSubscription ───────────────────────────────────────────────────────

describe("stripe.resumeSubscription", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  });

  it("resumes a paused subscription and restores status to active", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(PAUSED_SUB);
    mockStripeSubscriptionsUpdate.mockResolvedValue({});
    (mockUpsertSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const caller = makeCaller();
    const result = await caller.stripe.resumeSubscription();

    expect(result).toEqual({ success: true });

    // Stripe was called with empty pause_collection to clear the pause
    expect(mockStripeSubscriptionsUpdate).toHaveBeenCalledWith("sub_abc", {
      pause_collection: "",
    });

    // Local DB: status restored to active, plan and billingCycle preserved
    expect(mockUpsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        plan: "oracle",
        billingCycle: "monthly",
        cancelAtPeriodEnd: 0,
      })
    );
  });

  it("throws NOT_FOUND when user has no subscription", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const caller = makeCaller();
    await expect(caller.stripe.resumeSubscription()).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect(mockStripeSubscriptionsUpdate).not.toHaveBeenCalled();
    expect(mockUpsertSubscription).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST when subscription is active (not paused)", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...PAUSED_SUB,
      status: "active",
    });

    const caller = makeCaller();
    await expect(caller.stripe.resumeSubscription()).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mockStripeSubscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST when subscription is trialing (not paused)", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...PAUSED_SUB,
      status: "trialing",
    });

    const caller = makeCaller();
    await expect(caller.stripe.resumeSubscription()).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mockStripeSubscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("throws BAD_REQUEST when subscription is canceled", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...PAUSED_SUB,
      status: "canceled",
    });

    const caller = makeCaller();
    await expect(caller.stripe.resumeSubscription()).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(mockStripeSubscriptionsUpdate).not.toHaveBeenCalled();
  });

  it("does not call upsert if Stripe update throws", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue(PAUSED_SUB);
    mockStripeSubscriptionsUpdate.mockRejectedValue(new Error("Stripe network error"));

    const caller = makeCaller();
    await expect(caller.stripe.resumeSubscription()).rejects.toThrow("Stripe network error");
    expect(mockUpsertSubscription).not.toHaveBeenCalled();
  });

  it("preserves cancelAtPeriodEnd=1 when resuming a subscription with pending downgrade", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...PAUSED_SUB,
      cancelAtPeriodEnd: 1,
    });
    mockStripeSubscriptionsUpdate.mockResolvedValue({});
    (mockUpsertSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const caller = makeCaller();
    await caller.stripe.resumeSubscription();

    // cancelAtPeriodEnd is preserved as-is from the existing subscription
    expect(mockUpsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ cancelAtPeriodEnd: 1 })
    );
  });

  it("preserves annual billing cycle when resuming", async () => {
    (mockGetSubscriptionByUserId as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...PAUSED_SUB,
      billingCycle: "annual",
    });
    mockStripeSubscriptionsUpdate.mockResolvedValue({});
    (mockUpsertSubscription as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    const caller = makeCaller();
    const result = await caller.stripe.resumeSubscription();

    expect(result).toEqual({ success: true });
    expect(mockUpsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ billingCycle: "annual", status: "active" })
    );
  });
});
