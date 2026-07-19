/**
 * Tests for investors.getRankings tRPC procedure.
 *
 * The procedure is a publicProcedure that:
 * - Returns all investors for Oracle subscribers (isOracle = true)
 * - Returns only public investors for non-subscribers (isOracle = false)
 * - Supports search, sector filter, sortBy, sortDir, limit, offset
 * - Returns { investors, total, isOracle }
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();

  const publicInvestors = [
    { id: 1, name: "Alice Zhao", firm: "Sequoia Capital", sector: "AI/ML", sector2: null, signal: 86, delta: 2, god: 79, vcpp: 90, checkSize: "$500K–$5M", stage: "Seed", geo: "US", recentActivity: "Led Series A", isPublic: 1, createdAt: new Date(), updatedAt: new Date() },
    { id: 2, name: "Bob Park", firm: "a16z", sector: "SaaS", sector2: null, signal: 79, delta: -1, god: 73, vcpp: 83, checkSize: "$1M–$10M", stage: "Series A", geo: "US", recentActivity: "New fund", isPublic: 1, createdAt: new Date(), updatedAt: new Date() },
    { id: 3, name: "Carol Reyes", firm: "Forerunner", sector: "FinTech", sector2: null, signal: 79, delta: 3, god: 73, vcpp: 83, checkSize: "$250K–$2M", stage: "Pre-seed", geo: "US", recentActivity: null, isPublic: 1, createdAt: new Date(), updatedAt: new Date() },
  ];

  const privateInvestors = [
    { id: 4, name: "Dave Kim", firm: "Theory Ventures", sector: "DeepTech", sector2: "AI/ML", signal: 75, delta: 5, god: 69, vcpp: 79, checkSize: "$2M–$20M", stage: "Series B", geo: "US", recentActivity: "Active", isPublic: 0, createdAt: new Date(), updatedAt: new Date() },
    { id: 5, name: "Eve Torres", firm: "Conviction Partners", sector: "AI/ML", sector2: null, signal: 73, delta: 4, god: 67, vcpp: 77, checkSize: "$500K–$5M", stage: "Seed", geo: "US", recentActivity: null, isPublic: 0, createdAt: new Date(), updatedAt: new Date() },
  ];

  return {
    ...actual,
    getInvestorRankings: vi.fn(async (opts: {
      search?: string;
      sector?: string;
      sortBy?: string;
      sortDir?: string;
      limit?: number;
      offset?: number;
      isOracle?: boolean;
    }) => {
      let pool = opts.isOracle ? [...publicInvestors, ...privateInvestors] : [...publicInvestors];

      if (opts.search) {
        const term = opts.search.toLowerCase();
        pool = pool.filter(
          (inv) => inv.name.toLowerCase().includes(term) || inv.firm.toLowerCase().includes(term)
        );
      }

      if (opts.sector && opts.sector !== "All") {
        pool = pool.filter(
          (inv) => inv.sector === opts.sector || inv.sector2 === opts.sector
        );
      }

      const total = pool.length;
      const offset = opts.offset ?? 0;
      const limit = opts.limit ?? 50;
      const rows = pool.slice(offset, offset + limit);

      return { rows, total };
    }),
    getSubscriptionByUserId: vi.fn(async () => undefined),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCaller(user?: { id: number; openId: string; name: string; email: string; role: "user" | "admin" }) {
  return appRouter.createCaller({
    user: user ?? null,
    req: {} as any,
    res: {} as any,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("investors.getRankings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only public investors for unauthenticated callers", async () => {
    const caller = makeCaller();
    const result = await caller.investors.getRankings({});
    expect(result.isOracle).toBe(false);
    expect(result.investors.every((inv) => inv.isPublic === 1)).toBe(true);
    expect(result.total).toBe(3);
  });

  it("returns all investors for Oracle subscribers", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce({
      id: 1,
      userId: 42,
      stripeSubscriptionId: "sub_test",
      stripeCustomerId: "cus_test",
      plan: "oracle",
      billingCycle: "monthly",
      status: "active",
      currentPeriodEnd: Date.now() + 30 * 86400000,
      cancelAtPeriodEnd: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = makeCaller({ id: 42, openId: "oid_42", name: "Oracle User", email: "oracle@test.com", role: "user" });
    const result = await caller.investors.getRankings({});
    expect(result.isOracle).toBe(true);
    expect(result.total).toBe(5);
  });

  it("filters by search term across name and firm", async () => {
    const caller = makeCaller();
    const result = await caller.investors.getRankings({ search: "sequoia" });
    expect(result.investors.length).toBe(1);
    expect(result.investors[0].name).toBe("Alice Zhao");
  });

  it("filters by sector", async () => {
    const caller = makeCaller();
    const result = await caller.investors.getRankings({ sector: "FinTech" });
    expect(result.investors.every((inv) => inv.sector === "FinTech" || inv.sector2 === "FinTech")).toBe(true);
  });

  it("returns empty array when search matches nothing", async () => {
    const caller = makeCaller();
    const result = await caller.investors.getRankings({ search: "zzznomatch" });
    expect(result.investors).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it("respects limit and offset for pagination", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce({
      id: 1,
      userId: 42,
      stripeSubscriptionId: "sub_test",
      stripeCustomerId: "cus_test",
      plan: "oracle",
      billingCycle: "monthly",
      status: "active",
      currentPeriodEnd: Date.now() + 30 * 86400000,
      cancelAtPeriodEnd: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = makeCaller({ id: 42, openId: "oid_42", name: "Oracle User", email: "oracle@test.com", role: "user" });
    const result = await caller.investors.getRankings({ limit: 2, offset: 0 });
    expect(result.investors).toHaveLength(2);
    expect(result.total).toBe(5);
  });

  it("sorts by signal descending by default", async () => {
    const caller = makeCaller();
    const result = await caller.investors.getRankings({ sortBy: "signal", sortDir: "desc" });
    const signals = result.investors.map((inv) => inv.signal);
    // Verify descending order: each element should be >= the next
    for (let i = 0; i < signals.length - 1; i++) {
      expect(signals[i]).toBeGreaterThanOrEqual(signals[i + 1]);
    }
  });

  it("sorts by name ascending when requested", async () => {
    const caller = makeCaller();
    const result = await caller.investors.getRankings({ sortBy: "name", sortDir: "asc" });
    const names = result.investors.map((inv) => inv.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it("pagination returns correct slice and total", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    const oracleSub = {
      id: 1,
      userId: 42,
      stripeSubscriptionId: "sub_test",
      stripeCustomerId: "cus_test",
      plan: "oracle" as const,
      billingCycle: "monthly" as const,
      status: "active" as const,
      currentPeriodEnd: Date.now() + 30 * 86400000,
      cancelAtPeriodEnd: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    // Two calls need two mocks — each useQuery call checks subscription independently
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce(oracleSub);
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce(oracleSub);
    const caller = makeCaller({ id: 42, openId: "oid_42", name: "Oracle User", email: "oracle@test.com", role: "user" });
    const page1 = await caller.investors.getRankings({ limit: 2, offset: 0 });
    const page2 = await caller.investors.getRankings({ limit: 2, offset: 2 });
    // Total should be the same across pages
    expect(page1.total).toBe(5);
    expect(page2.total).toBe(5);
    // Pages should not overlap
    const page1Ids = page1.investors.map((inv) => inv.id);
    const page2Ids = page2.investors.map((inv) => inv.id);
    const overlap = page1Ids.filter((id) => page2Ids.includes(id));
    expect(overlap).toHaveLength(0);
  });

  it("returns isOracle true for active Scout subscribers (full rankings)", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce({
      id: 2,
      userId: 99,
      stripeSubscriptionId: "sub_scout",
      stripeCustomerId: "cus_scout",
      plan: "scout" as any,
      billingCycle: "monthly",
      status: "active",
      currentPeriodEnd: Date.now() + 30 * 86400000,
      cancelAtPeriodEnd: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = makeCaller({ id: 99, openId: "oid_99", name: "Scout User", email: "scout@test.com", role: "user" });
    const result = await caller.investors.getRankings({});
    expect(result.isOracle).toBe(true);
  });

  it("returns isOracle true for trialing Oracle subscribers", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce({
      id: 3,
      userId: 77,
      stripeSubscriptionId: "sub_trial",
      stripeCustomerId: "cus_trial",
      plan: "oracle",
      billingCycle: "annual",
      status: "trialing",
      currentPeriodEnd: Date.now() + 7 * 86400000,
      cancelAtPeriodEnd: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = makeCaller({ id: 77, openId: "oid_77", name: "Trial User", email: "trial@test.com", role: "user" });
    const result = await caller.investors.getRankings({});
    expect(result.isOracle).toBe(true);
  });
});
