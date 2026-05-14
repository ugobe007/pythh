/**
 * Tests for pipeline.analyzeStartup tRPC procedure.
 *
 * The procedure is a protectedProcedure that:
 * - Requires an active Oracle subscription (active | trialing | paused)
 * - Fetches all investors from the DB (isOracle = true)
 * - Calls invokeLLM with a structured JSON schema
 * - Parses the LLM response and enriches matches with full investor data
 * - Returns { summary, matches } — up to 6 enriched investor matches
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();

  const allInvestors = [
    { id: 1, name: "Alice Zhao", role: "Partner", firm: "Sequoia Capital", sector: "AI/ML", sector2: null, signal: 86, delta: 2, god: 79, vcpp: 90, checkSize: "$5–20M", stage: "Series A/B", geo: "US", recentActivity: "Led Series A", isPublic: 1, createdAt: new Date(), updatedAt: new Date() },
    { id: 2, name: "Bob Park", role: "GP", firm: "a16z", sector: "SaaS", sector2: "AI/ML", signal: 79, delta: -1, god: 73, vcpp: 83, checkSize: "$10–50M", stage: "Series A/B", geo: "US", recentActivity: "New fund", isPublic: 1, createdAt: new Date(), updatedAt: new Date() },
    { id: 3, name: "Carol Reyes", role: "Managing Partner", firm: "Forerunner", sector: "FinTech", sector2: null, signal: 79, delta: 3, god: 73, vcpp: 83, checkSize: "$2–10M", stage: "Seed/A", geo: "US", recentActivity: null, isPublic: 1, createdAt: new Date(), updatedAt: new Date() },
    { id: 4, name: "Dave Kim", role: "Founding Partner", firm: "Theory Ventures", sector: "DeepTech", sector2: "AI/ML", signal: 75, delta: 5, god: 69, vcpp: 79, checkSize: "$3–15M", stage: "Series A", geo: "US", recentActivity: "Active", isPublic: 0, createdAt: new Date(), updatedAt: new Date() },
    { id: 5, name: "Eve Torres", role: "General Partner", firm: "Conviction Partners", sector: "AI/ML", sector2: null, signal: 73, delta: 4, god: 67, vcpp: 77, checkSize: "$1–5M", stage: "Seed", geo: "US", recentActivity: null, isPublic: 0, createdAt: new Date(), updatedAt: new Date() },
    { id: 6, name: "Frank Liu", role: "Partner", firm: "Lux Capital", sector: "DeepTech", sector2: null, signal: 71, delta: 0, god: 65, vcpp: 75, checkSize: "$5–20M", stage: "Series A", geo: "US", recentActivity: "New fund", isPublic: 0, createdAt: new Date(), updatedAt: new Date() },
    { id: 7, name: "Grace Patel", role: "Managing Director", firm: "GV", sector: "AI/ML", sector2: "SaaS", signal: 70, delta: 1, god: 64, vcpp: 74, checkSize: "$5–25M", stage: "Series A/B", geo: "US", recentActivity: "Portfolio expansion", isPublic: 0, createdAt: new Date(), updatedAt: new Date() },
  ];

  return {
    ...actual,
    createPipelineRun: vi.fn().mockResolvedValue(undefined),
    getFounderProfile: vi.fn().mockResolvedValue(undefined),
    getInvestorRankings: vi.fn(async (opts: { isOracle?: boolean; limit?: number; offset?: number }) => {
      // When isOracle=true, return all investors; otherwise only public
      const rows = opts.isOracle ? allInvestors : allInvestors.filter((i) => i.isPublic === 1);
      return { rows, total: rows.length };
    }),
    getSubscriptionByUserId: vi.fn(async () => undefined),
  };
});

// ─── Mock LLM helper ──────────────────────────────────────────────────────────

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ORACLE_USER = { id: 42, openId: "oid_42", name: "Oracle User", email: "oracle@test.com", role: "user" as const };

function makeCaller(user?: typeof ORACLE_USER | null) {
  return appRouter.createCaller({
    user: user ?? null,
    req: {} as any,
    res: {} as any,
  });
}

const ORACLE_SUB = {
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

/** Build a valid LLM response JSON string for the given investor IDs */
function makeLLMResponse(investorIds: number[], summary = "Strong AI infrastructure thesis alignment.") {
  return JSON.stringify({
    summary,
    matches: investorIds.map((id, i) => ({
      investorId: id,
      matchScore: 95 - i * 3,
      reason: `Investor ${id} is a strong fit for this startup.`,
    })),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("pipeline.analyzeStartup", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Set required env vars
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  });

  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = makeCaller(null);
    await expect(
      caller.pipeline.analyzeStartup({ url: "https://example.com" })
    ).rejects.toThrow();
  });

  it("throws FORBIDDEN when user has no subscription", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce(undefined);

    const caller = makeCaller(ORACLE_USER);
    await expect(
      caller.pipeline.analyzeStartup({ url: "https://example.com" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when user has a non-oracle subscription", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce({
      ...ORACLE_SUB,
      plan: "scout" as any,
    });

    const caller = makeCaller(ORACLE_USER);
    await expect(
      caller.pipeline.analyzeStartup({ url: "https://example.com" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("throws FORBIDDEN when subscription is canceled", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce({
      ...ORACLE_SUB,
      status: "canceled" as any,
    });

    const caller = makeCaller(ORACLE_USER);
    await expect(
      caller.pipeline.analyzeStartup({ url: "https://example.com" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows access for trialing Oracle subscribers", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce({
      ...ORACLE_SUB,
      status: "trialing",
    });

    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { content: makeLLMResponse([1, 2, 3]) } }],
    } as any);

    const caller = makeCaller(ORACLE_USER);
    const result = await caller.pipeline.analyzeStartup({ url: "https://example.com" });
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it("allows access for paused Oracle subscribers", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce({
      ...ORACLE_SUB,
      status: "paused",
    });

    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { content: makeLLMResponse([1, 2]) } }],
    } as any);

    const caller = makeCaller(ORACLE_USER);
    const result = await caller.pipeline.analyzeStartup({ url: "https://example.com" });
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it("returns enriched investor matches with correct fields", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce(ORACLE_SUB);

    const { invokeLLM } = await import("./_core/llm");
    const summary = "Your AI infrastructure angle is compelling.";
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { content: makeLLMResponse([1, 2, 4], summary) } }],
    } as any);

    const caller = makeCaller(ORACLE_USER);
    const result = await caller.pipeline.analyzeStartup({ url: "https://startup.io" });

    expect(result.summary).toBe(summary);
    expect(result.runId).toMatch(/^[0-9a-f-]{36}$/i);
    const { createPipelineRun } = await import("./db");
    expect(vi.mocked(createPipelineRun)).toHaveBeenCalledTimes(1);
    expect(result.matches).toHaveLength(3);

    const first = result.matches[0];
    expect(first.id).toBe(1);
    expect(first.name).toBe("Alice Zhao");
    expect(first.firm).toBe("Sequoia Capital");
    expect(first.sector).toEqual(["AI/ML"]);  // sector2 is null → filtered out
    expect(first.stage).toBe("Series A/B");
    expect(first.checkSize).toBe("$5–20M");
    expect(first.geo).toBe("US");
    expect(first.signalScore).toBe(8.6);  // 86 / 10
    expect(first.matchScore).toBe(95);
    expect(first.reason).toContain("Investor 1");
  });

  it("caps matches at 6 even if LLM returns more", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce(ORACLE_SUB);

    const { invokeLLM } = await import("./_core/llm");
    // Return 7 matches — should be capped at 6
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { content: makeLLMResponse([1, 2, 3, 4, 5, 6, 7]) } }],
    } as any);

    const caller = makeCaller(ORACLE_USER);
    const result = await caller.pipeline.analyzeStartup({ url: "https://example.com" });
    expect(result.matches.length).toBeLessThanOrEqual(6);
  });

  it("filters out matches with unknown investor IDs", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce(ORACLE_SUB);

    const { invokeLLM } = await import("./_core/llm");
    // Include investor IDs 999 and 1000 which don't exist in the DB
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { content: makeLLMResponse([1, 999, 2, 1000]) } }],
    } as any);

    const caller = makeCaller(ORACLE_USER);
    const result = await caller.pipeline.analyzeStartup({ url: "https://example.com" });
    // Only IDs 1 and 2 should appear
    expect(result.matches).toHaveLength(2);
    expect(result.matches.map((m) => m.id)).toEqual([1, 2]);
  });

  it("includes sector2 in the sector array when present", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce(ORACLE_SUB);

    const { invokeLLM } = await import("./_core/llm");
    // Investor 2 (Bob Park) has sector="SaaS", sector2="AI/ML"
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { content: makeLLMResponse([2]) } }],
    } as any);

    const caller = makeCaller(ORACLE_USER);
    const result = await caller.pipeline.analyzeStartup({ url: "https://example.com" });
    expect(result.matches[0].sector).toEqual(["SaaS", "AI/ML"]);
  });

  it("throws INTERNAL_SERVER_ERROR when LLM returns empty content", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce(ORACLE_SUB);

    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { content: null } }],
    } as any);

    const caller = makeCaller(ORACLE_USER);
    await expect(
      caller.pipeline.analyzeStartup({ url: "https://example.com" })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("throws INTERNAL_SERVER_ERROR when LLM returns malformed JSON", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce(ORACLE_SUB);

    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { content: "not valid json {{" } }],
    } as any);

    const caller = makeCaller(ORACLE_USER);
    await expect(
      caller.pipeline.analyzeStartup({ url: "https://example.com" })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("validates that url input must be a valid URL", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce(ORACLE_SUB);

    const caller = makeCaller(ORACLE_USER);
    await expect(
      caller.pipeline.analyzeStartup({ url: "not-a-url" })
    ).rejects.toThrow();
  });

  it("passes founderEmail to the mutation when provided", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce(ORACLE_SUB);

    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { content: makeLLMResponse([1]) } }],
    } as any);

    const caller = makeCaller(ORACLE_USER);
    const result = await caller.pipeline.analyzeStartup({
      url: "https://startup.io",
      founderEmail: "founder@startup.io",
    });
    expect(result.matches.length).toBeGreaterThan(0);
  });

  it("normalizes signalScore to one decimal place", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce(ORACLE_SUB);

    const { invokeLLM } = await import("./_core/llm");
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { content: makeLLMResponse([1, 2, 3]) } }],
    } as any);

    const caller = makeCaller(ORACLE_USER);
    const result = await caller.pipeline.analyzeStartup({ url: "https://example.com" });

    for (const match of result.matches) {
      // signalScore should be a number with at most 1 decimal place
      const str = String(match.signalScore);
      const decimals = str.includes(".") ? str.split(".")[1].length : 0;
      expect(decimals).toBeLessThanOrEqual(1);
    }
  });

  it("clamps matchScore to 0–100 range", async () => {
    const { getSubscriptionByUserId } = await import("./db");
    vi.mocked(getSubscriptionByUserId).mockResolvedValueOnce(ORACLE_SUB);

    const { invokeLLM } = await import("./_core/llm");
    // Return out-of-range scores
    vi.mocked(invokeLLM).mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({
        summary: "Test",
        matches: [
          { investorId: 1, matchScore: 150, reason: "Too high" },
          { investorId: 2, matchScore: -10, reason: "Too low" },
        ],
      }) } }],
    } as any);

    const caller = makeCaller(ORACLE_USER);
    const result = await caller.pipeline.analyzeStartup({ url: "https://example.com" });

    for (const match of result.matches) {
      expect(match.matchScore).toBeGreaterThanOrEqual(0);
      expect(match.matchScore).toBeLessThanOrEqual(100);
    }
  });
});
