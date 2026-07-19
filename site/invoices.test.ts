/**
 * Tests for the stripe.getInvoices tRPC procedure and the
 * notifyOwner call added to handleCheckoutSessionCompleted.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock Stripe ──────────────────────────────────────────────────────────────

const mockInvoicesList = vi.fn();

vi.mock("stripe", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      invoices: { list: mockInvoicesList },
    })),
  };
});

// ─── Mock DB helpers ──────────────────────────────────────────────────────────

const mockGetSubscriptionByUserId = vi.fn();
const mockGetSubscriptionByStripeId = vi.fn();
const mockGetUserByOpenId = vi.fn();
const mockUpsertSubscription = vi.fn();

vi.mock("./db", () => ({
  getSubscriptionByUserId: (...args: unknown[]) => mockGetSubscriptionByUserId(...args),
  getSubscriptionByStripeId: (...args: unknown[]) => mockGetSubscriptionByStripeId(...args),
  getUserByOpenId: (...args: unknown[]) => mockGetUserByOpenId(...args),
  upsertSubscription: (...args: unknown[]) => mockUpsertSubscription(...args),
}));

// ─── Mock notifyOwner ─────────────────────────────────────────────────────────

const mockNotifyOwner = vi.fn().mockResolvedValue(true);

vi.mock("./_core/notification", () => ({
  notifyOwner: (...args: unknown[]) => mockNotifyOwner(...args),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

import { appRouter } from "./routers";

function makeCaller() {
  return appRouter.createCaller({
    user: {
      id: 1,
      openId: "open-1",
      name: "Test User",
      email: "test@example.com",
      role: "user" as const,
    },
    req: {} as never,
    res: {} as never,
  });
}

// ─── getInvoices ──────────────────────────────────────────────────────────────

describe("stripe.getInvoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  });

  it("returns an empty array when the user has no subscription", async () => {
    mockGetSubscriptionByUserId.mockResolvedValue(null);
    const caller = makeCaller();
    const result = await caller.stripe.getInvoices();
    expect(result).toEqual([]);
    expect(mockInvoicesList).not.toHaveBeenCalled();
  });

  it("returns an empty array when subscription has no stripeCustomerId", async () => {
    mockGetSubscriptionByUserId.mockResolvedValue({
      id: 1,
      userId: "user-1",
      stripeCustomerId: null,
      stripeSubscriptionId: "sub_123",
      plan: "oracle",
      billingCycle: "monthly",
      status: "active",
      currentPeriodEnd: null,
      createdAt: new Date(),
    });
    const caller = makeCaller();
    const result = await caller.stripe.getInvoices();
    expect(result).toEqual([]);
  });

  it("returns mapped invoices when Stripe returns data", async () => {
    mockGetSubscriptionByUserId.mockResolvedValue({
      id: 1,
      userId: "user-1",
      stripeCustomerId: "cus_abc123",
      stripeSubscriptionId: "sub_123",
      plan: "oracle",
      billingCycle: "monthly",
      status: "active",
      currentPeriodEnd: null,
      createdAt: new Date(),
    });

    const fakeInvoice = {
      id: "in_001",
      number: "INV-001",
      amount_paid: 29900,
      currency: "usd",
      status: "paid",
      created: 1700000000,
      invoice_pdf: "https://stripe.com/invoice.pdf",
      hosted_invoice_url: "https://stripe.com/invoice",
    };

    mockInvoicesList.mockResolvedValue({ data: [fakeInvoice] });

    const caller = makeCaller();
    const result = await caller.stripe.getInvoices();

    expect(mockInvoicesList).toHaveBeenCalledWith({
      customer: "cus_abc123",
      limit: 10,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "in_001",
      number: "INV-001",
      amountPaid: 29900,
      currency: "usd",
      status: "paid",
      created: 1700000000 * 1000,
      invoicePdf: "https://stripe.com/invoice.pdf",
      hostedInvoiceUrl: "https://stripe.com/invoice",
    });
  });

  it("returns multiple invoices in the order Stripe returns them", async () => {
    mockGetSubscriptionByUserId.mockResolvedValue({
      id: 1,
      userId: "user-1",
      stripeCustomerId: "cus_abc123",
      stripeSubscriptionId: "sub_123",
      plan: "oracle",
      billingCycle: "annual",
      status: "active",
      currentPeriodEnd: null,
      createdAt: new Date(),
    });

    const fakeInvoices = [
      { id: "in_002", number: "INV-002", amount_paid: 298800, currency: "usd", status: "paid", created: 1710000000, invoice_pdf: null, hosted_invoice_url: null },
      { id: "in_001", number: "INV-001", amount_paid: 298800, currency: "usd", status: "paid", created: 1700000000, invoice_pdf: null, hosted_invoice_url: null },
    ];

    mockInvoicesList.mockResolvedValue({ data: fakeInvoices });

    const caller = makeCaller();
    const result = await caller.stripe.getInvoices();

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("in_002");
    expect(result[1].id).toBe("in_001");
  });

  it("falls back to invoice id as number when number field is null", async () => {
    mockGetSubscriptionByUserId.mockResolvedValue({
      id: 1,
      userId: "user-1",
      stripeCustomerId: "cus_abc123",
      stripeSubscriptionId: "sub_123",
      plan: "oracle",
      billingCycle: "monthly",
      status: "active",
      currentPeriodEnd: null,
      createdAt: new Date(),
    });

    mockInvoicesList.mockResolvedValue({
      data: [{
        id: "in_draft",
        number: null,
        amount_paid: 0,
        currency: "usd",
        status: "draft",
        created: 1700000000,
        invoice_pdf: null,
        hosted_invoice_url: null,
      }],
    });

    const caller = makeCaller();
    const result = await caller.stripe.getInvoices();
    expect(result[0].number).toBe("in_draft");
  });
});

// ─── notifyOwner in webhook ───────────────────────────────────────────────────

import { handleCheckoutSessionCompleted } from "./stripeWebhook";
import Stripe from "stripe";

describe("handleCheckoutSessionCompleted — notifyOwner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_fake";
  });

  it("calls notifyOwner with subscriber details after provisioning", async () => {
    const fakeUser = { id: 1, openId: "open-1", name: "Alice", email: "alice@example.com" };
    mockGetUserByOpenId.mockResolvedValue(fakeUser);
    mockUpsertSubscription.mockResolvedValue(undefined);

    const fakeStripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_123",
          current_period_end: 1_800_000_000,
          metadata: { plan: "oracle" },
          items: {
            data: [{ price: { recurring: { interval: "month" } } }],
          },
        }),
      },
    } as unknown as Stripe;

    const fakeSession = {
      client_reference_id: "open-1",
      subscription: "sub_123",
      customer: "cus_abc",
      metadata: { plan: "oracle" },
    } as unknown as Stripe.Checkout.Session;

    await handleCheckoutSessionCompleted(fakeSession, fakeStripe);

    expect(mockNotifyOwner).toHaveBeenCalledOnce();
    const message = mockNotifyOwner.mock.calls[0][0] as string;
    expect(message).toContain("New Oracle subscriber");
    expect(message).toContain("Monthly");
    expect(message).toContain("Alice");
    expect(message).toContain("alice@example.com");
    expect(message).toContain("$49/mo");
  });

  it("does not throw if notifyOwner rejects (non-critical)", async () => {
    const fakeUser = { id: 2, openId: "open-2", name: "Bob", email: "bob@example.com" };
    mockGetUserByOpenId.mockResolvedValue(fakeUser);
    mockUpsertSubscription.mockResolvedValue(undefined);
    mockNotifyOwner.mockRejectedValue(new Error("Notification service down"));

    const fakeStripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_456",
          current_period_end: 1_900_000_000,
          items: {
            data: [{ price: { recurring: { interval: "year" } } }],
          },
        }),
      },
    } as unknown as Stripe;

    const fakeSession = {
      client_reference_id: "open-2",
      subscription: "sub_456",
      customer: "cus_xyz",
    } as unknown as Stripe.Checkout.Session;

    // Should not throw even though notifyOwner rejects
    await expect(
      handleCheckoutSessionCompleted(fakeSession, fakeStripe)
    ).resolves.toBeUndefined();
  });

  it("includes Annual label and $2,988/yr price for annual billing", async () => {
    const fakeUser = { id: 3, openId: "open-3", name: "Carol", email: "carol@example.com" };
    mockGetUserByOpenId.mockResolvedValue(fakeUser);
    mockUpsertSubscription.mockResolvedValue(undefined);
    mockNotifyOwner.mockResolvedValue(true);

    const fakeStripe = {
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_789",
          current_period_end: 1_900_000_000,
          items: {
            data: [{ price: { recurring: { interval: "year" } } }],
          },
        }),
      },
    } as unknown as Stripe;

    const fakeSession = {
      client_reference_id: "open-3",
      subscription: "sub_789",
      customer: "cus_annual",
    } as unknown as Stripe.Checkout.Session;

    await handleCheckoutSessionCompleted(fakeSession, fakeStripe);

    const message = mockNotifyOwner.mock.calls[0][0] as string;
    expect(message).toContain("Annual");
    expect(message).toContain("$492/yr");
  });
});
