/**
 * Unit tests for the subscriber account tRPC procedures:
 *   - stripe.getSubscriptionDetails
 *   - stripe.createPortalSession
 *
 * All external dependencies (Stripe SDK, DB helpers) are mocked.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";
import { UNAUTHED_ERR_MSG } from "./shared/const";

// ─── Mock Stripe ──────────────────────────────────────────────────────────────

const mockPortalCreate = vi.fn();

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    billingPortal: {
      sessions: { create: mockPortalCreate },
    },
    checkout: {
      sessions: { create: vi.fn().mockResolvedValue({ url: "https://checkout.stripe.com/test" }) },
    },
  })),
}));

// ─── Mock DB helpers ──────────────────────────────────────────────────────────

const mockGetSubscriptionByUserId = vi.fn();

vi.mock("./db", () => ({
  getSubscriptionByUserId: (...args: unknown[]) => mockGetSubscriptionByUserId(...args),
  upsertSubscription: vi.fn().mockResolvedValue(undefined),
  getSubscriptionByStripeId: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(null),
}));

// ─── Import router after mocks ────────────────────────────────────────────────

import { appRouter } from "./routers";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: 1,
  openId: "user_abc",
  name: "Test Founder",
  email: "founder@startup.com",
  role: "user" as const,
  loginMethod: null,
  lastSignedIn: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_SUB = {
  id: 1,
  userId: 1,
  stripeCustomerId: "cus_test123",
  stripeSubscriptionId: "sub_test123",
  plan: "oracle" as const,
  billingCycle: "monthly" as const,
  status: "active" as const,
  currentPeriodEnd: 1_800_000_000_000,
  createdAt: new Date("2025-01-01"),
  updatedAt: new Date("2025-01-01"),
};

function makeCaller(user = MOCK_USER) {
  return appRouter.createCaller({
    req: {} as any,
    res: {} as any,
    user,
  });
}

// ─── getSubscriptionDetails ───────────────────────────────────────────────────

describe("stripe.getSubscriptionDetails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  });

  it("returns full subscription details for a subscribed user", async () => {
    mockGetSubscriptionByUserId.mockResolvedValue(MOCK_SUB);

    const result = await makeCaller().stripe.getSubscriptionDetails();

    expect(result).toMatchObject({
      plan: "oracle",
      billingCycle: "monthly",
      status: "active",
      currentPeriodEnd: MOCK_SUB.currentPeriodEnd,
      stripeCustomerId: "cus_test123",
    });
    expect(result?.createdAt).toBeInstanceOf(Date);
  });

  it("returns null when user has no subscription", async () => {
    mockGetSubscriptionByUserId.mockResolvedValue(null);

    const result = await makeCaller().stripe.getSubscriptionDetails();

    expect(result).toBeNull();
  });

  it("throws UNAUTHORIZED when called without a user context", async () => {
    const anonCaller = appRouter.createCaller({
      req: {} as any,
      res: {} as any,
      user: null,
    });

    await expect(anonCaller.stripe.getSubscriptionDetails()).rejects.toThrow(UNAUTHED_ERR_MSG);
  });
});

// ─── createPortalSession ──────────────────────────────────────────────────────

describe("stripe.createPortalSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  });

  it("returns the Stripe Customer Portal URL for a subscribed user", async () => {
    mockGetSubscriptionByUserId.mockResolvedValue(MOCK_SUB);
    mockPortalCreate.mockResolvedValue({ url: "https://billing.stripe.com/portal/test" });

    const result = await makeCaller().stripe.createPortalSession({
      returnUrl: "https://pythh.ai/account",
    });

    expect(result.url).toBe("https://billing.stripe.com/portal/test");
    expect(mockPortalCreate).toHaveBeenCalledWith({
      customer: "cus_test123",
      return_url: "https://pythh.ai/account",
    });
  });

  it("throws NOT_FOUND when user has no subscription", async () => {
    mockGetSubscriptionByUserId.mockResolvedValue(null);

    await expect(
      makeCaller().stripe.createPortalSession({ returnUrl: "https://pythh.ai/account" })
    ).rejects.toThrow("No active subscription found for this account.");
  });

  it("throws UNAUTHORIZED when called without a user context", async () => {
    const anonCaller = appRouter.createCaller({
      req: {} as any,
      res: {} as any,
      user: null,
    });

    await expect(
      anonCaller.stripe.createPortalSession({ returnUrl: "https://pythh.ai/account" })
    ).rejects.toThrow(UNAUTHED_ERR_MSG);
  });

  it("passes the correct return_url to Stripe", async () => {
    mockGetSubscriptionByUserId.mockResolvedValue(MOCK_SUB);
    mockPortalCreate.mockResolvedValue({ url: "https://billing.stripe.com/portal/test" });

    await makeCaller().stripe.createPortalSession({
      returnUrl: "https://pythh.ai/account?ref=nav",
    });

    expect(mockPortalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ return_url: "https://pythh.ai/account?ref=nav" })
    );
  });
});
