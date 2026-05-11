/**
 * Unit tests for the Stripe checkout session tRPC procedure.
 *
 * We mock the `stripe` package so no real API calls are made.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock stripe before importing routers ────────────────────────────────────
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

// ─── Mock db helpers (getSubscriptionByUserId used by getSubscription query) ─
vi.mock("./db", () => ({
  getSubscriptionByUserId: vi.fn().mockResolvedValue(null),
  upsertSubscription: vi.fn().mockResolvedValue(undefined),
  getSubscriptionByStripeId: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(null),
}));

// ─── Import router after mocks are set up ────────────────────────────────────
import { appRouter } from "./routers";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Authenticated caller — createCheckoutSession is a protectedProcedure */
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
      loginMethod: null,
      lastSignedIn: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────
describe("stripe.createCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  });

  it("returns the checkout URL for a monthly subscription", async () => {
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/monthly-test" });

    const caller = makeCaller();
    const result = await caller.stripe.createCheckoutSession({
      billingCycle: "monthly",
      origin: "https://pythh.ai",
    });

    expect(result.url).toBe("https://checkout.stripe.com/monthly-test");

    // Verify correct unit amount for monthly ($299 = 29900 cents)
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.line_items[0].price_data.unit_amount).toBe(29900);
    expect(callArgs.line_items[0].price_data.recurring.interval).toBe("month");
  });

  it("returns the checkout URL for an annual subscription", async () => {
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/annual-test" });

    const caller = makeCaller();
    const result = await caller.stripe.createCheckoutSession({
      billingCycle: "annual",
      origin: "https://pythh.ai",
    });

    expect(result.url).toBe("https://checkout.stripe.com/annual-test");

    // Verify correct unit amount for annual ($2,988 = 298800 cents)
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.line_items[0].price_data.unit_amount).toBe(298800);
    expect(callArgs.line_items[0].price_data.recurring.interval).toBe("year");
  });

  it("includes correct success and cancel URLs derived from origin", async () => {
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/test" });

    const caller = makeCaller();
    await caller.stripe.createCheckoutSession({
      billingCycle: "monthly",
      origin: "https://pythh.ai",
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.success_url).toContain("https://pythh.ai/checkout/success");
    expect(callArgs.cancel_url).toBe("https://pythh.ai/checkout/cancel");
  });

  it("passes client_reference_id as the user's openId", async () => {
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/test" });

    const caller = makeCaller();
    await caller.stripe.createCheckoutSession({
      billingCycle: "monthly",
      origin: "https://pythh.ai",
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.client_reference_id).toBe("user_test_openid");
  });

  it("pre-fills customer_email from the authenticated user", async () => {
    mockCreate.mockResolvedValueOnce({ url: "https://checkout.stripe.com/test" });

    const caller = makeCaller();
    await caller.stripe.createCheckoutSession({
      billingCycle: "monthly",
      origin: "https://pythh.ai",
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.customer_email).toBe("founder@startup.com");
  });

  it("throws when Stripe returns no URL", async () => {
    mockCreate.mockResolvedValueOnce({ url: null });

    const caller = makeCaller();
    await expect(
      caller.stripe.createCheckoutSession({
        billingCycle: "monthly",
        origin: "https://pythh.ai",
      })
    ).rejects.toThrow("Stripe did not return a checkout URL.");
  });

  it("throws when STRIPE_SECRET_KEY is missing", async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const caller = makeCaller();
    await expect(
      caller.stripe.createCheckoutSession({
        billingCycle: "monthly",
        origin: "https://pythh.ai",
      })
    ).rejects.toThrow("STRIPE_SECRET_KEY is not configured.");
  });
});
