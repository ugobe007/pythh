/**
 * Tests for pipeline.submitFeedback and pipeline.getFeedback tRPC procedures.
 *
 * submitFeedback:
 * - Requires authentication (protectedProcedure)
 * - Accepts rating "up" | "down", optional reason enum, optional comment (max 500 chars)
 * - Calls upsertPipelineFeedback with userId, runId, rating, reason, comment
 * - Returns { success: true }
 *
 * getFeedback:
 * - Requires authentication (protectedProcedure)
 * - Returns { rating, reason, comment } for the given (userId, runId), or null
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    upsertPipelineFeedback: vi.fn(async () => undefined),
    getPipelineFeedbackByRunId: vi.fn(async () => undefined),
    getSubscriptionByUserId: vi.fn(async () => undefined),
  };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEST_USER = {
  id: 42,
  openId: "oid_42",
  name: "Test User",
  email: "test@example.com",
  role: "user" as const,
};

const TEST_RUN_ID = "550e8400-e29b-41d4-a716-446655440000";

function makeCaller(user?: typeof TEST_USER | null) {
  return appRouter.createCaller({
    user: user ?? null,
    req: {} as any,
    res: {} as any,
  });
}

// ─── submitFeedback tests ─────────────────────────────────────────────────────

describe("pipeline.submitFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  });

  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = makeCaller(null);
    await expect(
      caller.pipeline.submitFeedback({ runId: TEST_RUN_ID, rating: "up" })
    ).rejects.toThrow();
  });

  it("returns { success: true } for a thumbs-up rating", async () => {
    const caller = makeCaller(TEST_USER);
    const result = await caller.pipeline.submitFeedback({
      runId: TEST_RUN_ID,
      rating: "up",
    });
    expect(result).toEqual({ success: true });
  });

  it("returns { success: true } for a thumbs-down rating", async () => {
    const caller = makeCaller(TEST_USER);
    const result = await caller.pipeline.submitFeedback({
      runId: TEST_RUN_ID,
      rating: "down",
    });
    expect(result).toEqual({ success: true });
  });

  it("calls upsertPipelineFeedback with correct userId and runId", async () => {
    const { upsertPipelineFeedback } = await import("./db");
    const caller = makeCaller(TEST_USER);
    await caller.pipeline.submitFeedback({ runId: TEST_RUN_ID, rating: "up" });

    expect(upsertPipelineFeedback).toHaveBeenCalledOnce();
    expect(upsertPipelineFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: TEST_USER.id,
        runId: TEST_RUN_ID,
        rating: "up",
      })
    );
  });

  it("passes comment to upsertPipelineFeedback when provided", async () => {
    const { upsertPipelineFeedback } = await import("./db");
    const caller = makeCaller(TEST_USER);
    const comment = "Great investor matches!";
    await caller.pipeline.submitFeedback({ runId: TEST_RUN_ID, rating: "up", comment });

    expect(upsertPipelineFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ comment })
    );
  });

  it("passes null comment when no comment is provided", async () => {
    const { upsertPipelineFeedback } = await import("./db");
    const caller = makeCaller(TEST_USER);
    await caller.pipeline.submitFeedback({ runId: TEST_RUN_ID, rating: "down" });

    expect(upsertPipelineFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ comment: null })
    );
  });

  it("rejects a comment longer than 500 characters", async () => {
    const caller = makeCaller(TEST_USER);
    const longComment = "x".repeat(501);
    await expect(
      caller.pipeline.submitFeedback({ runId: TEST_RUN_ID, rating: "up", comment: longComment })
    ).rejects.toThrow();
  });

  it("accepts a comment of exactly 500 characters", async () => {
    const caller = makeCaller(TEST_USER);
    const maxComment = "x".repeat(500);
    const result = await caller.pipeline.submitFeedback({
      runId: TEST_RUN_ID,
      rating: "up",
      comment: maxComment,
    });
    expect(result).toEqual({ success: true });
  });

  it("rejects an empty runId", async () => {
    const caller = makeCaller(TEST_USER);
    await expect(
      caller.pipeline.submitFeedback({ runId: "", rating: "up" })
    ).rejects.toThrow();
  });

  it("rejects a runId longer than 64 characters", async () => {
    const caller = makeCaller(TEST_USER);
    const longRunId = "a".repeat(65);
    await expect(
      caller.pipeline.submitFeedback({ runId: longRunId, rating: "up" })
    ).rejects.toThrow();
  });

  it("rejects an invalid rating value", async () => {
    const caller = makeCaller(TEST_USER);
    await expect(
      caller.pipeline.submitFeedback({ runId: TEST_RUN_ID, rating: "neutral" as any })
    ).rejects.toThrow();
  });

  it("allows the same user to update their rating (upsert semantics)", async () => {
    const { upsertPipelineFeedback } = await import("./db");
    const caller = makeCaller(TEST_USER);

    await caller.pipeline.submitFeedback({ runId: TEST_RUN_ID, rating: "up" });
    await caller.pipeline.submitFeedback({ runId: TEST_RUN_ID, rating: "down" });

    expect(upsertPipelineFeedback).toHaveBeenCalledTimes(2);
    const secondCall = vi.mocked(upsertPipelineFeedback).mock.calls[1][0];
    expect(secondCall.rating).toBe("down");
  });

  it("isolates feedback by userId — different users can rate the same runId", async () => {
    const { upsertPipelineFeedback } = await import("./db");

    const user1 = { ...TEST_USER, id: 1 };
    const user2 = { ...TEST_USER, id: 2 };

    await makeCaller(user1).pipeline.submitFeedback({ runId: TEST_RUN_ID, rating: "up" });
    await makeCaller(user2).pipeline.submitFeedback({ runId: TEST_RUN_ID, rating: "down" });

    const calls = vi.mocked(upsertPipelineFeedback).mock.calls;
    expect(calls[0][0].userId).toBe(1);
    expect(calls[1][0].userId).toBe(2);
    expect(calls[0][0].rating).toBe("up");
    expect(calls[1][0].rating).toBe("down");
  });

  // ── Reason field tests ─────────────────────────────────────────────────────

  it("accepts a valid reason enum value with thumbs-down", async () => {
    const caller = makeCaller(TEST_USER);
    const result = await caller.pipeline.submitFeedback({
      runId: TEST_RUN_ID,
      rating: "down",
      reason: "wrong_investors",
    });
    expect(result).toEqual({ success: true });
  });

  it("passes reason to upsertPipelineFeedback", async () => {
    const { upsertPipelineFeedback } = await import("./db");
    const caller = makeCaller(TEST_USER);
    await caller.pipeline.submitFeedback({
      runId: TEST_RUN_ID,
      rating: "down",
      reason: "inaccurate_scores",
    });

    expect(upsertPipelineFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ reason: "inaccurate_scores" })
    );
  });

  it("passes null reason when no reason is provided", async () => {
    const { upsertPipelineFeedback } = await import("./db");
    const caller = makeCaller(TEST_USER);
    await caller.pipeline.submitFeedback({ runId: TEST_RUN_ID, rating: "down" });

    expect(upsertPipelineFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ reason: null })
    );
  });

  it("accepts all six valid reason values", async () => {
    const caller = makeCaller(TEST_USER);
    const validReasons = [
      "wrong_investors",
      "inaccurate_scores",
      "missing_sectors",
      "poor_summary",
      "wrong_stage",
      "other",
    ] as const;

    for (const r of validReasons) {
      const result = await caller.pipeline.submitFeedback({
        runId: TEST_RUN_ID,
        rating: "down",
        reason: r,
      });
      expect(result).toEqual({ success: true });
    }
  });

  it("rejects an unknown reason value", async () => {
    const caller = makeCaller(TEST_USER);
    await expect(
      caller.pipeline.submitFeedback({
        runId: TEST_RUN_ID,
        rating: "down",
        reason: "bad_vibes" as any,
      })
    ).rejects.toThrow();
  });

  it("accepts a reason together with a comment", async () => {
    const { upsertPipelineFeedback } = await import("./db");
    const caller = makeCaller(TEST_USER);
    await caller.pipeline.submitFeedback({
      runId: TEST_RUN_ID,
      rating: "down",
      reason: "poor_summary",
      comment: "The summary missed our B2B angle.",
    });

    expect(upsertPipelineFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "poor_summary",
        comment: "The summary missed our B2B angle.",
      })
    );
  });

  it("allows reason to be omitted for thumbs-up", async () => {
    const { upsertPipelineFeedback } = await import("./db");
    const caller = makeCaller(TEST_USER);
    await caller.pipeline.submitFeedback({ runId: TEST_RUN_ID, rating: "up" });

    expect(upsertPipelineFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ reason: null })
    );
  });
});

// ─── getFeedback tests ────────────────────────────────────────────────────────

describe("pipeline.getFeedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
  });

  it("throws UNAUTHORIZED when called without authentication", async () => {
    const caller = makeCaller(null);
    await expect(
      caller.pipeline.getFeedback({ runId: TEST_RUN_ID })
    ).rejects.toThrow();
  });

  it("returns null when no feedback exists for the runId", async () => {
    const { getPipelineFeedbackByRunId } = await import("./db");
    vi.mocked(getPipelineFeedbackByRunId).mockResolvedValueOnce(undefined);

    const caller = makeCaller(TEST_USER);
    const result = await caller.pipeline.getFeedback({ runId: TEST_RUN_ID });
    expect(result).toBeNull();
  });

  it("returns { rating, reason, comment } when feedback exists with a reason", async () => {
    const { getPipelineFeedbackByRunId } = await import("./db");
    vi.mocked(getPipelineFeedbackByRunId).mockResolvedValueOnce({
      id: 1,
      userId: TEST_USER.id,
      runId: TEST_RUN_ID,
      rating: "down",
      reason: "wrong_investors",
      comment: "Focused on consumer, we're B2B.",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = makeCaller(TEST_USER);
    const result = await caller.pipeline.getFeedback({ runId: TEST_RUN_ID });
    expect(result).toEqual({
      rating: "down",
      reason: "wrong_investors",
      comment: "Focused on consumer, we're B2B.",
    });
  });

  it("returns null reason when feedback has no reason", async () => {
    const { getPipelineFeedbackByRunId } = await import("./db");
    vi.mocked(getPipelineFeedbackByRunId).mockResolvedValueOnce({
      id: 2,
      userId: TEST_USER.id,
      runId: TEST_RUN_ID,
      rating: "up",
      reason: null,
      comment: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = makeCaller(TEST_USER);
    const result = await caller.pipeline.getFeedback({ runId: TEST_RUN_ID });
    expect(result).toEqual({ rating: "up", reason: null, comment: null });
  });

  it("returns null comment when feedback has no comment", async () => {
    const { getPipelineFeedbackByRunId } = await import("./db");
    vi.mocked(getPipelineFeedbackByRunId).mockResolvedValueOnce({
      id: 3,
      userId: TEST_USER.id,
      runId: TEST_RUN_ID,
      rating: "down",
      reason: "missing_sectors",
      comment: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const caller = makeCaller(TEST_USER);
    const result = await caller.pipeline.getFeedback({ runId: TEST_RUN_ID });
    expect(result).toEqual({ rating: "down", reason: "missing_sectors", comment: null });
  });

  it("calls getPipelineFeedbackByRunId with correct userId and runId", async () => {
    const { getPipelineFeedbackByRunId } = await import("./db");
    vi.mocked(getPipelineFeedbackByRunId).mockResolvedValueOnce(undefined);

    const caller = makeCaller(TEST_USER);
    await caller.pipeline.getFeedback({ runId: TEST_RUN_ID });

    expect(getPipelineFeedbackByRunId).toHaveBeenCalledWith(TEST_USER.id, TEST_RUN_ID);
  });

  it("rejects an empty runId", async () => {
    const caller = makeCaller(TEST_USER);
    await expect(
      caller.pipeline.getFeedback({ runId: "" })
    ).rejects.toThrow();
  });
});
