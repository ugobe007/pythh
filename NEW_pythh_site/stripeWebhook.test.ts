/**
 * Unit tests for the Stripe webhook handler logic.
 *
 * We test the three exported handler functions in isolation by mocking the
 * database helpers and the Stripe SDK so no real network calls are made.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

// ─── Mock database helpers ────────────────────────────────────────────────────

const mockUpsertSubscription = vi.fn().mockResolvedValue(undefined);
const mockGetSubscriptionByStripeId = vi.fn();
const mockGetUserByOpenId = vi.fn();

vi.mock("./db", () => ({
  upsertSubscription: (...args: unknown[]) => mockUpsertSubscription(...args),
  getSubscriptionByStripeId: (...args: unknown[]) =>
    mockGetSubscriptionByStripeId(...args),
  getUserByOpenId: (...args: unknown[]) => mockGetUserByOpenId(...args),
}));

// ─── Import handlers after mocks are registered ───────────────────────────────

import {
  handleCheckoutSessionCompleted,
  handleSubscriptionDeleted,
  handleSubscriptionUpdated,
} from "./stripeWebhook";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const MOCK_USER = { id: 42, openId: "user_abc123", email: "founder@startup.com" };

const MOCK_SUBSCRIPTION_ITEM = {
  price: { recurring: { interval: "month" } },
  current_period_end: 1_800_000_000, // Unix seconds
} as unknown as Stripe.SubscriptionItem;

const MOCK_STRIPE_SUB: Partial<Stripe.Subscription> = {
  id: "sub_test123",
  status: "active",
  items: { data: [MOCK_SUBSCRIPTION_ITEM] } as Stripe.ApiList<Stripe.SubscriptionItem>,
};

/** Minimal mock Stripe client with subscriptions.retrieve */
function makeMockStripe(sub = MOCK_STRIPE_SUB) {
  return {
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue(sub),
    },
  } as unknown as Stripe;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("handleCheckoutSessionCompleted", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUserByOpenId.mockResolvedValue(MOCK_USER);
  });

  it("provisions an active monthly subscription for a known user", async () => {
    const session: Partial<Stripe.Checkout.Session> = {
      client_reference_id: MOCK_USER.openId,
      subscription: "sub_test123",
      customer: "cus_test456",
    };

    await handleCheckoutSessionCompleted(
      session as Stripe.Checkout.Session,
      makeMockStripe()
    );

    expect(mockGetUserByOpenId).toHaveBeenCalledWith(MOCK_USER.openId);
    expect(mockUpsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: MOCK_USER.id,
        stripeCustomerId: "cus_test456",
        stripeSubscriptionId: "sub_test123",
        plan: "oracle",
        billingCycle: "monthly",
        status: "active",
        currentPeriodEnd: MOCK_SUBSCRIPTION_ITEM.current_period_end * 1000,
      })
    );
  });

  it("provisions an annual subscription when interval is 'year'", async () => {
    const annualItem = {
      price: { recurring: { interval: "year" } },
      current_period_end: 1_900_000_000,
    } as unknown as Stripe.SubscriptionItem;

    const annualSub = {
      ...MOCK_STRIPE_SUB,
      items: { data: [annualItem] } as Stripe.ApiList<Stripe.SubscriptionItem>,
    };

    const session: Partial<Stripe.Checkout.Session> = {
      client_reference_id: MOCK_USER.openId,
      subscription: "sub_annual",
      customer: "cus_annual",
    };

    await handleCheckoutSessionCompleted(
      session as Stripe.Checkout.Session,
      makeMockStripe(annualSub)
    );

    expect(mockUpsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ billingCycle: "annual" })
    );
  });

  it("does nothing when client_reference_id is missing", async () => {
    const session: Partial<Stripe.Checkout.Session> = {
      client_reference_id: null,
      subscription: "sub_test123",
    };

    await handleCheckoutSessionCompleted(
      session as Stripe.Checkout.Session,
      makeMockStripe()
    );

    expect(mockGetUserByOpenId).not.toHaveBeenCalled();
    expect(mockUpsertSubscription).not.toHaveBeenCalled();
  });

  it("does nothing when user is not found in the database", async () => {
    mockGetUserByOpenId.mockResolvedValue(undefined);

    const session: Partial<Stripe.Checkout.Session> = {
      client_reference_id: "unknown_openid",
      subscription: "sub_test123",
      customer: "cus_test456",
    };

    await handleCheckoutSessionCompleted(
      session as Stripe.Checkout.Session,
      makeMockStripe()
    );

    expect(mockUpsertSubscription).not.toHaveBeenCalled();
  });

  it("does nothing when session has no subscription ID", async () => {
    const session: Partial<Stripe.Checkout.Session> = {
      client_reference_id: MOCK_USER.openId,
      subscription: null,
      customer: "cus_test456",
    };

    await handleCheckoutSessionCompleted(
      session as Stripe.Checkout.Session,
      makeMockStripe()
    );

    expect(mockUpsertSubscription).not.toHaveBeenCalled();
  });
});

describe("handleSubscriptionUpdated", () => {
  const EXISTING_ROW = {
    id: 1,
    userId: MOCK_USER.id,
    stripeCustomerId: "cus_test456",
    stripeSubscriptionId: "sub_test123",
    plan: "oracle" as const,
    billingCycle: "monthly" as const,
    status: "active" as const,
    currentPeriodEnd: 1_700_000_000_000,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSubscriptionByStripeId.mockResolvedValue(EXISTING_ROW);
  });

  it("updates status and period end for a known subscription", async () => {
    const updatedSub = {
      ...MOCK_STRIPE_SUB,
      status: "past_due",
      items: {
        data: [
          {
            price: { recurring: { interval: "month" } },
            current_period_end: 1_850_000_000,
          },
        ],
      },
    } as unknown as Stripe.Subscription;

    await handleSubscriptionUpdated(updatedSub);

    expect(mockUpsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "past_due",
        currentPeriodEnd: 1_850_000_000 * 1000,
      })
    );
  });

  it("does nothing for an unknown subscription ID", async () => {
    mockGetSubscriptionByStripeId.mockResolvedValue(undefined);

    await handleSubscriptionUpdated(MOCK_STRIPE_SUB as Stripe.Subscription);

    expect(mockUpsertSubscription).not.toHaveBeenCalled();
  });
});

describe("handleSubscriptionDeleted", () => {
  const EXISTING_ROW = {
    id: 1,
    userId: MOCK_USER.id,
    stripeCustomerId: "cus_test456",
    stripeSubscriptionId: "sub_test123",
    plan: "oracle" as const,
    billingCycle: "monthly" as const,
    status: "active" as const,
    currentPeriodEnd: 1_700_000_000_000,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSubscriptionByStripeId.mockResolvedValue(EXISTING_ROW);
  });

  it("marks the subscription as canceled", async () => {
    await handleSubscriptionDeleted(MOCK_STRIPE_SUB as Stripe.Subscription);

    expect(mockUpsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ status: "canceled" })
    );
  });

  it("does nothing for an unknown subscription ID", async () => {
    mockGetSubscriptionByStripeId.mockResolvedValue(undefined);

    await handleSubscriptionDeleted(MOCK_STRIPE_SUB as Stripe.Subscription);

    expect(mockUpsertSubscription).not.toHaveBeenCalled();
  });
});
