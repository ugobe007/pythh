/**
 * Vitest tests for the outreach tRPC router.
 *
 * Covers:
 *  - generateDeck: auth gate, idempotency, LLM mock, empty-slides error, invalid URL
 *  - uploadDeck: auth gate, S3 upload, placeholder slides
 *  - updateDeck: auth gate, slides saved, invalid deckId
 *  - generateEmailPitch: auth gate, per-investor generation, idempotency
 *  - updateEmail: auth gate, subject/body/toEmail update, validation
 *  - approveEmail: auth gate, status set to approved
 *  - sendEmail: auth gate, NOT_FOUND, already-sent, no-recipient, Resend call, Resend error
 *  - getOutreachStatus: auth gate, deck + emails returned, null deck
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TRPCError } from "@trpc/server";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    key: "decks/u1/run1/deck.pdf",
    url: "/manus-storage/decks/u1/run1/deck.pdf",
  }),
}));

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createPitchDeck: vi.fn(),
    updatePitchDeckSlides: vi.fn(),
    getPitchDeckByRunId: vi.fn(),
    getPitchDeckById: vi.fn(),
    createOutreachEmail: vi.fn(),
    updateOutreachEmailStatus: vi.fn(),
    getOutreachEmailsByRunId: vi.fn(),
    getInvestorById: vi.fn(),
    getInvestorRankings: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    getSubscriptionByUserId: vi.fn().mockResolvedValue(null),
    upsertSubscription: vi.fn(),
    upsertPipelineFeedback: vi.fn(),
    getPipelineFeedbackByRunId: vi.fn().mockResolvedValue(null),
  };
});

import { invokeLLM } from "./_core/llm";
import {
  createPitchDeck,
  updatePitchDeckSlides,
  getPitchDeckByRunId,
  getPitchDeckById,
  createOutreachEmail,
  updateOutreachEmailStatus,
  getOutreachEmailsByRunId,
} from "./db";
import { appRouter } from "./routers";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AUTHED_USER = {
  id: 1,
  openId: "oid_1",
  name: "Alice",
  email: "alice@example.com",
  role: "user" as const,
};

function makeCaller(user?: typeof AUTHED_USER | null) {
  return appRouter.createCaller({
    user: user ?? null,
    req: {} as any,
    res: {} as any,
  });
}

const MOCK_SLIDES = [
  { id: "slide-1", title: "Problem", content: "The problem", notes: "Speak slowly" },
  { id: "slide-2", title: "Solution", content: "Our solution", notes: "" },
];

const MOCK_LLM_DECK_RESPONSE = {
  choices: [{ message: { content: JSON.stringify({ slides: MOCK_SLIDES }) } }],
};

const MOCK_LLM_EMAIL_RESPONSE = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          subject: "Quick intro — Acme AI",
          body: "Hi Sarah,\n\nI wanted to reach out...\n\nBest,\nAlice",
        }),
      },
    },
  ],
};

// ─── generateDeck ─────────────────────────────────────────────────────────────

describe("outreach.generateDeck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPitchDeckByRunId).mockResolvedValue(undefined);
    vi.mocked(invokeLLM).mockResolvedValue(MOCK_LLM_DECK_RESPONSE as any);
    vi.mocked(createPitchDeck).mockResolvedValue({ id: 42, slides: MOCK_SLIDES } as any);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const caller = makeCaller(null);
    await expect(
      caller.outreach.generateDeck({ runId: "run-1", startupUrl: "https://acme.ai" })
    ).rejects.toThrow(TRPCError);
  });

  it("calls LLM and creates a deck for a new runId", async () => {
    const caller = makeCaller(AUTHED_USER);
    const result = await caller.outreach.generateDeck({
      runId: "run-1",
      startupUrl: "https://acme.ai",
      startupSummary: "AI-powered analytics",
    });

    expect(invokeLLM).toHaveBeenCalledOnce();
    expect(createPitchDeck).toHaveBeenCalledOnce();
    expect(result.deckId).toBe(42);
    expect(result.slides).toHaveLength(2);
    expect(result.sourceType).toBe("generated");
  });

  it("returns existing deck without calling LLM (idempotent)", async () => {
    vi.mocked(getPitchDeckByRunId).mockResolvedValue({
      id: 7,
      slides: MOCK_SLIDES,
      sourceType: "generated",
    } as any);

    const caller = makeCaller(AUTHED_USER);
    const result = await caller.outreach.generateDeck({
      runId: "run-1",
      startupUrl: "https://acme.ai",
    });

    expect(invokeLLM).not.toHaveBeenCalled();
    expect(createPitchDeck).not.toHaveBeenCalled();
    expect(result.deckId).toBe(7);
  });

  it("throws INTERNAL_SERVER_ERROR when LLM returns empty slides", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ slides: [] }) } }],
    } as any);

    const caller = makeCaller(AUTHED_USER);
    await expect(
      caller.outreach.generateDeck({ runId: "run-2", startupUrl: "https://acme.ai" })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });

  it("rejects an invalid URL", async () => {
    const caller = makeCaller(AUTHED_USER);
    await expect(
      caller.outreach.generateDeck({ runId: "run-1", startupUrl: "not-a-url" })
    ).rejects.toThrow();
  });
});

// ─── uploadDeck ───────────────────────────────────────────────────────────────

describe("outreach.uploadDeck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createPitchDeck).mockResolvedValue({ id: 55, slides: [] } as any);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const caller = makeCaller(null);
    await expect(
      caller.outreach.uploadDeck({
        runId: "run-1",
        fileName: "deck.pdf",
        fileBase64: Buffer.from("fake").toString("base64"),
        mimeType: "application/pdf",
      })
    ).rejects.toThrow(TRPCError);
  });

  it("stores file to S3 and returns placeholder slides", async () => {
    const { storagePut } = await import("./storage");
    const caller = makeCaller(AUTHED_USER);
    const result = await caller.outreach.uploadDeck({
      runId: "run-1",
      fileName: "deck.pdf",
      fileBase64: Buffer.from("fake pdf content").toString("base64"),
      mimeType: "application/pdf",
    });

    expect(storagePut).toHaveBeenCalledOnce();
    expect(createPitchDeck).toHaveBeenCalledOnce();
    expect(result.sourceType).toBe("uploaded");
    expect(result.slides.length).toBeGreaterThan(0);
    expect(result.slides[0].title).toBe("Problem");
  });
});

// ─── updateDeck ───────────────────────────────────────────────────────────────

describe("outreach.updateDeck", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updatePitchDeckSlides).mockResolvedValue(undefined as any);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const caller = makeCaller(null);
    await expect(
      caller.outreach.updateDeck({ deckId: 1, slides: MOCK_SLIDES })
    ).rejects.toThrow(TRPCError);
  });

  it("saves slides and returns success", async () => {
    const caller = makeCaller(AUTHED_USER);
    const result = await caller.outreach.updateDeck({
      deckId: 42,
      slides: MOCK_SLIDES,
      status: "approved",
    });

    expect(updatePitchDeckSlides).toHaveBeenCalledWith({
      id: 42,
      userId: 1,
      slides: MOCK_SLIDES,
      status: "approved",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-positive deckId", async () => {
    const caller = makeCaller(AUTHED_USER);
    await expect(caller.outreach.updateDeck({ deckId: 0, slides: [] })).rejects.toThrow();
  });
});

// ─── generateEmailPitch ───────────────────────────────────────────────────────

describe("outreach.generateEmailPitch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOutreachEmailsByRunId).mockResolvedValue([]);
    vi.mocked(invokeLLM).mockResolvedValue(MOCK_LLM_EMAIL_RESPONSE as any);
    vi.mocked(createOutreachEmail).mockResolvedValue({ id: 10 } as any);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const caller = makeCaller(null);
    await expect(
      caller.outreach.generateEmailPitch({
        runId: "run-1",
        startupUrl: "https://acme.ai",
        investors: [{ name: "Sarah Guo", firm: "Conviction", sector: "AI/ML" }],
      })
    ).rejects.toThrow(TRPCError);
  });

  it("generates one email per investor", async () => {
    const caller = makeCaller(AUTHED_USER);
    const result = await caller.outreach.generateEmailPitch({
      runId: "run-1",
      startupUrl: "https://acme.ai",
      investors: [
        { name: "Sarah Guo", firm: "Conviction", sector: "AI/ML" },
        { name: "Elad Gil", firm: "Color Capital", sector: "BioTech" },
      ],
    });

    expect(invokeLLM).toHaveBeenCalledTimes(2);
    expect(createOutreachEmail).toHaveBeenCalledTimes(2);
    expect(result.generated).toBe(2);
    expect(result.total).toBe(2);
  });

  it("skips investors that already have a draft (idempotent)", async () => {
    vi.mocked(getOutreachEmailsByRunId).mockResolvedValue([
      {
        id: 1,
        investorName: "Sarah Guo",
        investorFirm: "Conviction",
        status: "draft",
      } as any,
    ]);

    const caller = makeCaller(AUTHED_USER);
    const result = await caller.outreach.generateEmailPitch({
      runId: "run-1",
      startupUrl: "https://acme.ai",
      investors: [
        { name: "Sarah Guo", firm: "Conviction", sector: "AI/ML" },
        { name: "Elad Gil", firm: "Color Capital", sector: "BioTech" },
      ],
    });

    expect(invokeLLM).toHaveBeenCalledTimes(1); // only Elad Gil
    expect(result.generated).toBe(1);
  });
});

// ─── updateEmail ─────────────────────────────────────────────────────────────

describe("outreach.updateEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateOutreachEmailStatus).mockResolvedValue(undefined as any);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const caller = makeCaller(null);
    await expect(
      caller.outreach.updateEmail({ emailId: 1, subject: "New subject" })
    ).rejects.toThrow(TRPCError);
  });

  it("updates subject and body", async () => {
    const caller = makeCaller(AUTHED_USER);
    const result = await caller.outreach.updateEmail({
      emailId: 7,
      subject: "Updated subject",
      body: "Updated body",
    });

    expect(updateOutreachEmailStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 7,
        userId: 1,
        status: "draft",
        subject: "Updated subject",
        body: "Updated body",
        toEmail: undefined,
      })
    );
    expect(result.success).toBe(true);
  });

  it("updates toEmail only", async () => {
    const caller = makeCaller(AUTHED_USER);
    await caller.outreach.updateEmail({
      emailId: 7,
      toEmail: "newemail@vc.com",
    });

    expect(updateOutreachEmailStatus).toHaveBeenCalledWith(
      expect.objectContaining({ toEmail: "newemail@vc.com" })
    );
  });

  it("rejects an invalid toEmail address", async () => {
    const caller = makeCaller(AUTHED_USER);
    await expect(
      caller.outreach.updateEmail({ emailId: 7, toEmail: "not-an-email" })
    ).rejects.toThrow();
  });

  it("rejects a subject longer than 256 chars", async () => {
    const caller = makeCaller(AUTHED_USER);
    await expect(
      caller.outreach.updateEmail({ emailId: 7, subject: "x".repeat(257) })
    ).rejects.toThrow();
  });
});

// ─── approveEmail ─────────────────────────────────────────────────────────────

describe("outreach.approveEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(updateOutreachEmailStatus).mockResolvedValue(undefined as any);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const caller = makeCaller(null);
    await expect(caller.outreach.approveEmail({ emailId: 1 })).rejects.toThrow(TRPCError);
  });

  it("sets status to approved", async () => {
    const caller = makeCaller(AUTHED_USER);
    const result = await caller.outreach.approveEmail({ emailId: 5 });

    expect(updateOutreachEmailStatus).toHaveBeenCalledWith({
      id: 5,
      userId: 1,
      status: "approved",
    });
    expect(result.success).toBe(true);
  });
});

// ─── sendEmail ────────────────────────────────────────────────────────────────

describe("outreach.sendEmail", () => {
  const DRAFT_EMAIL = {
    id: 99,
    investorName: "Sarah Guo",
    investorFirm: "Conviction",
    toEmail: "sarah@conviction.vc",
    subject: "Quick intro",
    body: "Hi Sarah,\n\nBest,\nAlice",
    status: "draft",
    sentAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOutreachEmailsByRunId).mockResolvedValue([DRAFT_EMAIL] as any);
    vi.mocked(updateOutreachEmailStatus).mockResolvedValue(undefined as any);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: "resend-msg-123" }),
      })
    );
    process.env.RESEND_API_KEY = "re_test_key";
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const caller = makeCaller(null);
    await expect(caller.outreach.sendEmail({ emailId: 99, runId: "run-1" })).rejects.toThrow(TRPCError);
  });

  it("throws NOT_FOUND when email doesn't belong to the user's run", async () => {
    vi.mocked(getOutreachEmailsByRunId).mockResolvedValue([]);
    const caller = makeCaller(AUTHED_USER);
    await expect(
      caller.outreach.sendEmail({ emailId: 99, runId: "run-1" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("throws BAD_REQUEST when email is already sent", async () => {
    vi.mocked(getOutreachEmailsByRunId).mockResolvedValue([
      { ...DRAFT_EMAIL, status: "sent" },
    ] as any);
    const caller = makeCaller(AUTHED_USER);
    await expect(
      caller.outreach.sendEmail({ emailId: 99, runId: "run-1" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("throws BAD_REQUEST when no recipient email is set", async () => {
    vi.mocked(getOutreachEmailsByRunId).mockResolvedValue([
      { ...DRAFT_EMAIL, toEmail: null },
    ] as any);
    const caller = makeCaller(AUTHED_USER);
    await expect(
      caller.outreach.sendEmail({ emailId: 99, runId: "run-1" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("calls Resend API and marks email as sent", async () => {
    const caller = makeCaller(AUTHED_USER);
    const result = await caller.outreach.sendEmail({
      emailId: 99,
      runId: "run-1",
      fromName: "Alice Founder",
      replyTo: "alice@acme.ai",
    });

    expect(fetch).toHaveBeenCalledOnce();
    const [url, opts] = (fetch as any).mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const body = JSON.parse(opts.body);
    expect(body.to).toContain("sarah@conviction.vc");
    expect(body.reply_to).toBe("alice@acme.ai");

    expect(updateOutreachEmailStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 99,
        status: "sent",
        resendMessageId: "resend-msg-123",
      })
    );
    expect(result.success).toBe(true);
    expect(result.messageId).toBe("resend-msg-123");
  });

  it("throws INTERNAL_SERVER_ERROR when Resend returns an error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => "Invalid from address",
      })
    );

    const caller = makeCaller(AUTHED_USER);
    await expect(
      caller.outreach.sendEmail({ emailId: 99, runId: "run-1" })
    ).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
  });
});

// ─── getOutreachStatus ────────────────────────────────────────────────────────

describe("outreach.getOutreachStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPitchDeckByRunId).mockResolvedValue({
      id: 1,
      slides: MOCK_SLIDES,
      sourceType: "generated",
      status: "ready",
    } as any);
    vi.mocked(getOutreachEmailsByRunId).mockResolvedValue([
      {
        id: 10,
        investorName: "Sarah Guo",
        investorFirm: "Conviction",
        status: "draft",
      } as any,
    ]);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const caller = makeCaller(null);
    await expect(caller.outreach.getOutreachStatus({ runId: "run-1" })).rejects.toThrow(TRPCError);
  });

  it("returns deck and emails for a runId", async () => {
    const caller = makeCaller(AUTHED_USER);
    const result = await caller.outreach.getOutreachStatus({ runId: "run-1" });

    expect(result.deck).toBeTruthy();
    expect(result.deck?.id).toBe(1);
    expect(result.emails).toHaveLength(1);
    expect(result.emails[0].investorName).toBe("Sarah Guo");
  });

  it("returns null deck when none exists", async () => {
    vi.mocked(getPitchDeckByRunId).mockResolvedValue(undefined);
    vi.mocked(getOutreachEmailsByRunId).mockResolvedValue([]);

    const caller = makeCaller(AUTHED_USER);
    const result = await caller.outreach.getOutreachStatus({ runId: "run-new" });

    expect(result.deck).toBeNull();
    expect(result.emails).toHaveLength(0);
  });
});

// ─── exportDeckPdf ────────────────────────────────────────────────────────────

describe("outreach.exportDeckPdf", () => {
  const DECK_BASE = {
    createdAt: new Date(),
    updatedAt: new Date(),
    startupUrl: null as string | null,
    fileKey: null as string | null,
    slidesJson: "[]",
  };

  const DECK_WITH_SLIDES = {
    ...DECK_BASE,
    id: 42,
    userId: 1,
    runId: "run-1",
    slides: [
      { id: "slide-1", title: "Problem", content: "• Pain point A\n• Pain point B", notes: "Speak slowly" },
      { id: "slide-2", title: "Solution", content: "• Our approach\n• Key differentiator", notes: "" },
      { id: "slide-3", title: "Market", content: "• $10B TAM", notes: undefined },
    ],
    sourceType: "generated",
    status: "ready",
  } as Awaited<ReturnType<typeof getPitchDeckById>>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPitchDeckById).mockResolvedValue(DECK_WITH_SLIDES);
  });

  it("throws UNAUTHORIZED when not authenticated", async () => {
    const caller = makeCaller(null);
    await expect(caller.outreach.exportDeckPdf({ deckId: 42 })).rejects.toThrow(TRPCError);
  });

  it("throws NOT_FOUND when deck does not exist", async () => {
    vi.mocked(getPitchDeckById).mockResolvedValue(undefined);
    const caller = makeCaller(AUTHED_USER);
    await expect(caller.outreach.exportDeckPdf({ deckId: 999 })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("throws BAD_REQUEST when deck has no slides", async () => {
    vi.mocked(getPitchDeckById).mockResolvedValue({
      ...DECK_WITH_SLIDES,
      slides: [],
    } as NonNullable<Awaited<ReturnType<typeof getPitchDeckById>>>);
    const caller = makeCaller(AUTHED_USER);
    await expect(caller.outreach.exportDeckPdf({ deckId: 42 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  it("returns a non-empty base64 string and a filename", async () => {
    const caller = makeCaller(AUTHED_USER);
    const result = await caller.outreach.exportDeckPdf({ deckId: 42 });

    expect(typeof result.base64).toBe("string");
    expect(result.base64.length).toBeGreaterThan(100); // PDF has real content
    expect(result.filename).toMatch(/\.pdf$/);
  });

  it("uses the startupName in the filename", async () => {
    const caller = makeCaller(AUTHED_USER);
    const result = await caller.outreach.exportDeckPdf({ deckId: 42, startupName: "My Startup" });

    expect(result.filename).toContain("My_Startup");
  });

  it("falls back to 'Pitch_Deck' filename when no startupName provided", async () => {
    const caller = makeCaller(AUTHED_USER);
    const result = await caller.outreach.exportDeckPdf({ deckId: 42 });

    expect(result.filename).toContain("Pitch_Deck");
  });

  it("rejects a non-positive deckId", async () => {
    const caller = makeCaller(AUTHED_USER);
    await expect(caller.outreach.exportDeckPdf({ deckId: 0 })).rejects.toThrow();
  });

  it("rejects a startupName longer than 120 chars", async () => {
    const caller = makeCaller(AUTHED_USER);
    await expect(
      caller.outreach.exportDeckPdf({ deckId: 42, startupName: "x".repeat(121) })
    ).rejects.toThrow();
  });

  it("base64 decodes to a valid PDF (starts with %PDF)", async () => {
    const caller = makeCaller(AUTHED_USER);
    const result = await caller.outreach.exportDeckPdf({ deckId: 42 });

    const bytes = Buffer.from(result.base64, "base64");
    expect(bytes.slice(0, 4).toString("ascii")).toBe("%PDF");
  });
});
