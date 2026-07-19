/**
 * Unit tests for the Stripe checkout session tRPC procedure.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create: mockCreate,
        },
      },
    })),
  };
});

vi.mock("./db", () => ({
  getSubscriptionByUserId: vi.fn().mockResolvedValue(null),
  upsertSubscription: vi.fn().mockResolvedValue(undefined),
  getSubscriptionByStripeId: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(null),
}));

import { appRouter } from "./routers";

function makeCaller() {
  return appRouter.createCaller({
    req: {} as any,
    res: {} as any,
    user: {
      id: 1,
      openId: "user_test_openid",
      name: "Test Founder",
      email: "founder@startup.com",
      role: "user" as const,
    },
  });
}

describe("stripe.createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  });

  it("returns the checkout URL for Oracle monthly ($49)", async () => {
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/oracle-monthly" });

    const caller = makeCaller();
    const result = await caller.stripe.createCheckoutSession({
      plan: "oracle",
      billingCycle: "monthly",
      origin: "https://pythh.ai",
    });

    expect(result.url).toBe("https://checkout.stripe.com/oracle-monthly");
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.line_items[0].price_data.unit_amount).toBe(4900);
    expect(callArgs.metadata.plan).toBe("oracle");
  });

  it("returns the checkout URL for Scout annual ($192/yr)", async () => {
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/scout-annual" });

    const caller = makeCaller();
    const result = await caller.stripe.createCheckoutSession({
      plan: "scout",
      billingCycle: "annual",
      origin: "https://pythh.ai",
    });

    expect(result.url).toBe("https://checkout.stripe.com/scout-annual");
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.line_items[0].price_data.unit_amount).toBe(19200);
    expect(callArgs.line_items[0].price_data.recurring.interval).toBe("year");
    expect(callArgs.metadata.plan).toBe("scout");
  });

  it("defaults to Oracle when plan omitted", async () => {
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/default" });

    const caller = makeCaller();
    await caller.stripe.createCheckoutSession({
      billingCycle: "monthly",
      origin: "https://pythh.ai",
    } as any);

    expect(mockCreate.mock.calls[0][0].metadata.plan).toBe("oracle");
  });

  it("includes success URL with plan query param", async () => {
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/test" });

    const caller = makeCaller();
    await caller.stripe.createCheckoutSession({
      plan: "scout",
      billingCycle: "monthly",
      origin: "https://pythh.ai",
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.success_url).toContain("plan=scout");
    expect(callArgs.cancel_url).toBe("https://pythh.ai/checkout/cancel");
  });

  it("throws when Stripe returns no URL", async () => {
    mockCreate.mockResolvedValueOnce({ url: null });

    const caller = makeCaller();
    await expect(
      caller.stripe.createCheckoutSession({
        plan: "oracle",
        billingCycle: "monthly",
        origin: "https://pythh.ai",
      })
    ).rejects.toThrow("Stripe did not return a checkout URL.");
  });
});
