/**
 * outreach tRPC router
 *
 * Procedures:
 *  - generateDeck       LLM generates a pitch deck from startup profile data
 *  - uploadDeck         User uploads an existing deck (PDF/PPTX) → stored in S3
 *  - updateDeck         Save edited slide content back to the database
 *  - generateEmailPitch LLM generates per-investor outreach email drafts
 *  - updateEmail        Edit subject/body/toEmail of a draft
 *  - approveEmail       Mark an email as approved (ready to send)
 *  - sendEmail          Send via Resend, update status to 'sent'
 *  - getOutreachStatus  Return deck + emails for a runId
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { outreachProcedure, protectedProcedure, router } from "./_core/trpc";
import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import PDFDocument from "pdfkit";
import {
  createMeetingProposal,
  createPitchDeck,
  createOutreachEmail,
  getMeetingByIdForUser,
  getOutreachEmailsByRunId,
  getPitchDeckById,
  getPitchDeckByRunId,
  listMeetingsForOutreachEmail,
  updateMeetingStatus,
  updateOutreachEmailStatus,
  updatePitchDeckSlides,
  type Slide,
} from "./db";

// ─── Slide schema ─────────────────────────────────────────────────────────────

const slideSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  notes: z.string().optional(),
});

// ─── LLM helpers ─────────────────────────────────────────────────────────────

async function llmGenerateDeck(startupUrl: string, startupSummary?: string): Promise<Slide[]> {
  const context = startupSummary
    ? `Startup URL: ${startupUrl}\nSummary: ${startupSummary}`
    : `Startup URL: ${startupUrl}`;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are PYTHIA, an expert pitch deck writer for early-stage startups.
Generate a compelling 10-slide investor pitch deck in JSON format.
Each slide must have: id (string), title (string), content (string with bullet points separated by \\n), notes (optional speaker notes).
Standard slide order: Problem, Solution, Market Size, Product Demo, Business Model, Traction, Team, Competition, Financials, Ask.
Return ONLY a valid JSON array of slide objects. No markdown, no explanation.`,
      },
      {
        role: "user",
        content: `Create a pitch deck for this startup:\n${context}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "pitch_deck",
        strict: true,
        schema: {
          type: "object",
          properties: {
            slides: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  title: { type: "string" },
                  content: { type: "string" },
                  notes: { type: "string" },
                },
                required: ["id", "title", "content", "notes"],
                additionalProperties: false,
              },
            },
          },
          required: ["slides"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = (response.choices ?? [])[0]?.message?.content ?? "{}";
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  const slides: Slide[] = (parsed.slides ?? []).map((s: any, i: number) => ({
    id: s.id || `slide-${i + 1}`,
    title: s.title || `Slide ${i + 1}`,
    content: s.content || "",
    notes: s.notes || undefined,
  }));
  if (slides.length === 0) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "LLM returned empty deck" });
  return slides;
}

async function llmGenerateEmailPitch(opts: {
  startupUrl: string;
  startupSummary?: string;
  investorName: string;
  investorFirm: string;
  investorSector: string;
  matchReason?: string;
}): Promise<{ subject: string; body: string }> {
  const { startupUrl, startupSummary, investorName, investorFirm, investorSector, matchReason } = opts;

  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: `You are PYTHIA, an expert fundraising assistant. Write a concise, personalised cold outreach email from a startup founder to a VC investor.
The email should be 3–4 short paragraphs, professional but warm, and end with a clear ask (15-min call).
Return JSON with "subject" (string) and "body" (string, plain text with \\n for line breaks).`,
      },
      {
        role: "user",
        content: `Write an outreach email to ${investorName} at ${investorFirm} (focuses on ${investorSector}).
Startup: ${startupUrl}
${startupSummary ? `Summary: ${startupSummary}` : ""}
${matchReason ? `Why this investor: ${matchReason}` : ""}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "outreach_email",
        strict: true,
        schema: {
          type: "object",
          properties: {
            subject: { type: "string" },
            body: { type: "string" },
          },
          required: ["subject", "body"],
          additionalProperties: false,
        },
      },
    },
  });

  const raw = (response.choices ?? [])[0]?.message?.content ?? "{}";
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  return {
    subject: parsed.subject || `Introduction — ${startupUrl}`,
    body: parsed.body || "",
  };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const outreachRouter = router({
  /**
   * Generate a 10-slide pitch deck from the startup URL and optional summary.
   * Stores the deck in the database and returns it.
   */
  generateDeck: protectedProcedure
    .input(
      z.object({
        runId: z.string().min(1).max(64),
        startupUrl: z.string().url(),
        startupSummary: z.string().max(2000).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if a deck already exists for this run
      const existing = await getPitchDeckByRunId(ctx.user.id, input.runId);
      if (existing) {
        return { deckId: existing.id, slides: existing.slides, sourceType: existing.sourceType };
      }

      const slides = await llmGenerateDeck(input.startupUrl, input.startupSummary);
      const deck = await createPitchDeck({
        userId: ctx.user.id,
        runId: input.runId,
        startupUrl: input.startupUrl,
        sourceType: "generated",
        slides,
        status: "ready",
      });
      if (!deck) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save deck" });
      return { deckId: deck.id, slides, sourceType: "generated" as const };
    }),

  /**
   * Upload a pitch deck file (base64-encoded). Stores to S3 and creates a DB record.
   * For uploaded decks, we create placeholder slides that the user can edit.
   */
  uploadDeck: protectedProcedure
    .input(
      z.object({
        runId: z.string().min(1).max(64),
        startupUrl: z.string().url().optional(),
        fileName: z.string().max(256),
        fileBase64: z.string(), // base64-encoded file content
        mimeType: z.string().max(128),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { runId, startupUrl, fileName, fileBase64, mimeType } = input;

      // Upload to S3
      const fileBuffer = Buffer.from(fileBase64, "base64");
      const fileKey = `decks/${ctx.user.id}/${runId}/${fileName}`;
      const { key } = await storagePut(fileKey, fileBuffer, mimeType);

      // Create placeholder slides — user will edit these
      const placeholderSlides: Slide[] = [
        { id: "slide-1", title: "Problem", content: "Edit this slide to describe the problem you solve." },
        { id: "slide-2", title: "Solution", content: "Edit this slide to describe your solution." },
        { id: "slide-3", title: "Market Size", content: "Edit this slide to describe your market." },
        { id: "slide-4", title: "Product", content: "Edit this slide to showcase your product." },
        { id: "slide-5", title: "Business Model", content: "Edit this slide to explain how you make money." },
        { id: "slide-6", title: "Traction", content: "Edit this slide to show your traction." },
        { id: "slide-7", title: "Team", content: "Edit this slide to introduce your team." },
        { id: "slide-8", title: "Ask", content: "Edit this slide to state your fundraising ask." },
      ];

      const deck = await createPitchDeck({
        userId: ctx.user.id,
        runId,
        startupUrl: startupUrl ?? undefined,
        sourceType: "uploaded",
        fileKey: key,
        slides: placeholderSlides,
        status: "draft",
      });
      if (!deck) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to save deck" });
      return { deckId: deck.id, slides: placeholderSlides, sourceType: "uploaded" as const, fileKey: key };
    }),

  /**
   * Save edited slide content back to the database.
   */
  updateDeck: protectedProcedure
    .input(
      z.object({
        deckId: z.number().int().positive(),
        slides: z.array(slideSchema),
        status: z.enum(["draft", "ready", "approved"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await updatePitchDeckSlides({
        id: input.deckId,
        userId: ctx.user.id,
        slides: input.slides,
        status: input.status,
      });
      return { success: true };
    }),

  /**
   * Generate per-investor outreach email drafts for all matched investors.
   * Idempotent — skips investors that already have a draft for this runId.
   */
  generateEmailPitch: outreachProcedure
    .input(
      z.object({
        runId: z.string().min(1).max(64),
        startupUrl: z.string().url(),
        startupSummary: z.string().max(2000).optional(),
        investors: z.array(
          z.object({
            name: z.string(),
            firm: z.string(),
            sector: z.string(),
            matchReason: z.string().optional(),
            email: z.string().email().optional(),
          })
        ).max(10),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { runId, startupUrl, startupSummary, investors } = input;

      // Get existing emails to avoid duplicates
      const existing = await getOutreachEmailsByRunId(ctx.user.id, runId);
      const existingNames = new Set(existing.map((e) => `${e.investorName}::${e.investorFirm}`));

      const results: Array<{ investorName: string; investorFirm: string; emailId: number }> = [];

      for (const inv of investors) {
        const key = `${inv.name}::${inv.firm}`;
        if (existingNames.has(key)) continue;

        const { subject, body } = await llmGenerateEmailPitch({
          startupUrl,
          startupSummary,
          investorName: inv.name,
          investorFirm: inv.firm,
          investorSector: inv.sector,
          matchReason: inv.matchReason,
        });

        const email = await createOutreachEmail({
          userId: ctx.user.id,
          runId,
          investorName: inv.name,
          investorFirm: inv.firm,
          toEmail: inv.email,
          subject,
          body,
        });
        if (email) {
          results.push({ investorName: inv.name, investorFirm: inv.firm, emailId: email.id });
        }
      }

      return { generated: results.length, total: investors.length };
    }),

  /**
   * Edit the subject, body, or recipient of a draft email.
   */
  updateEmail: protectedProcedure
    .input(
      z.object({
        emailId: z.number().int().positive(),
        subject: z.string().max(256).optional(),
        body: z.string().max(5000).optional(),
        toEmail: z.string().email().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await updateOutreachEmailStatus({
        id: input.emailId,
        userId: ctx.user.id,
        status: "draft",
        subject: input.subject,
        body: input.body,
        toEmail: input.toEmail,
      });
      return { success: true };
    }),

  /**
   * Mark an email as approved (ready to send).
   */
  approveEmail: outreachProcedure
    .input(z.object({ emailId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      await updateOutreachEmailStatus({
        id: input.emailId,
        userId: ctx.user.id,
        status: "approved",
      });
      return { success: true };
    }),

  /**
   * Send an outreach email via Resend.
   * Requires RESEND_API_KEY to be set.
   */
  sendEmail: outreachProcedure
    .input(
      z.object({
        emailId: z.number().int().positive(),
        runId: z.string().min(1).max(64),
        /** Sender name shown in the From field */
        fromName: z.string().max(128).optional(),
        /** Reply-to address (user's own email) */
        replyTo: z.string().email().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const emails = await getOutreachEmailsByRunId(ctx.user.id, input.runId);
      const email = emails.find((e) => e.id === input.emailId);
      if (!email) throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
      if (email.status === "sent") throw new TRPCError({ code: "BAD_REQUEST", message: "Email already sent" });
      if (!email.toEmail) throw new TRPCError({ code: "BAD_REQUEST", message: "No recipient email address" });

      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Resend API key not configured" });

      const fromName = input.fromName || "PYTHIA via pythh.ai";
      const fromAddress = `pythia@pythh.ai`;

      const resendPayload = {
        from: `${fromName} <${fromAddress}>`,
        to: [email.toEmail],
        reply_to: input.replyTo || undefined,
        subject: email.subject,
        text: email.body,
      };

      const resendResp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(resendPayload),
      });

      if (!resendResp.ok) {
        const errBody = await resendResp.text();
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Resend error: ${resendResp.status} ${errBody}`,
        });
      }

      const resendData = (await resendResp.json()) as { id?: string };
      const messageId = resendData.id ?? "";

      await updateOutreachEmailStatus({
        id: email.id,
        userId: ctx.user.id,
        status: "sent",
        sentAt: Date.now(),
        resendMessageId: messageId,
      });

      return { success: true, messageId };
    }),

  /**
   * After an email is sent, propose 3 meeting slots and optionally email the investor.
   */
  proposeMeeting: outreachProcedure
    .input(
      z.object({
        runId: z.string().min(1).max(64),
        emailId: z.number().int().positive(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const emails = await getOutreachEmailsByRunId(ctx.user.id, input.runId);
      const email = emails.find((e) => e.id === input.emailId);
      if (!email) throw new TRPCError({ code: "NOT_FOUND", message: "Email not found" });
      if (email.status !== "sent") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Send the email before proposing a meeting." });
      }
      const slots: { label: string; startMs: number }[] = [];
      const base = new Date();
      base.setUTCHours(0, 0, 0, 0);
      for (let i = 1; i <= 5 && slots.length < 3; i++) {
        const d = new Date(base);
        d.setUTCDate(d.getUTCDate() + i);
        const wd = d.getUTCDay();
        if (wd === 0 || wd === 6) continue;
        d.setUTCHours(15, 0, 0, 0);
        slots.push({ label: d.toUTCString(), startMs: d.getTime() });
      }
      const row = await createMeetingProposal({
        userId: ctx.user.id,
        runId: input.runId,
        outreachEmailId: email.id,
        investorName: email.investorName,
        investorFirm: email.investorFirm,
        proposedTimes: slots,
      });
      const apiKey = process.env.RESEND_API_KEY;
      if (apiKey && email.toEmail) {
        const lines = slots.map((s, idx) => `${idx + 1}. ${s.label} (reply with ${idx + 1} to confirm)`).join("\n");
        const body = `Hi ${email.investorName},\n\nFollowing up on my note — here are a few times that work for a 30-minute intro:\n\n${lines}\n\nBest`;
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "PYTHIA via pythh.ai <pythia@pythh.ai>",
            to: [email.toEmail],
            subject: `Meeting times — ${email.investorFirm}`,
            text: body,
          }),
        });
      }
      return { meetingId: row?.id ?? null, proposedTimes: slots };
    }),

  listMeetingsForEmail: protectedProcedure
    .input(
      z.object({
        runId: z.string().min(1).max(64),
        emailId: z.number().int().positive(),
      }),
    )
    .query(async ({ input, ctx }) => {
      const rows = await listMeetingsForOutreachEmail(ctx.user.id, input.runId, input.emailId);
      return rows.map((r) => ({
        id: r.id,
        status: r.status,
        proposedTimes: (() => {
          try {
            return JSON.parse(r.proposedTimesJson || "[]");
          } catch {
            return [];
          }
        })(),
        confirmedTime: r.confirmedTime ?? null,
        calendarLink: r.calendarLink ?? null,
      }));
    }),

  confirmMeeting: protectedProcedure
    .input(
      z.object({
        meetingId: z.number().int().positive(),
        slotIndex: z.number().int().min(0).max(5),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const m = await getMeetingByIdForUser(ctx.user.id, input.meetingId);
      if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
      let slots: { startMs: number; label?: string }[] = [];
      try {
        slots = JSON.parse(m.proposedTimesJson || "[]");
      } catch {
        slots = [];
      }
      const chosen = slots[input.slotIndex];
      if (!chosen?.startMs) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid slot" });
      await updateMeetingStatus({
        userId: ctx.user.id,
        meetingId: input.meetingId,
        status: "confirmed",
        confirmedTime: chosen.startMs,
      });
      return { ok: true as const };
    }),

  declineMeeting: protectedProcedure
    .input(z.object({ meetingId: z.number().int().positive() }))
    .mutation(async ({ input, ctx }) => {
      const m = await getMeetingByIdForUser(ctx.user.id, input.meetingId);
      if (!m) throw new TRPCError({ code: "NOT_FOUND", message: "Meeting not found" });
      await updateMeetingStatus({ userId: ctx.user.id, meetingId: input.meetingId, status: "declined" });
      return { ok: true as const };
    }),

  /**
   * Generate a PDF of the pitch deck and return it as a base64-encoded string.
   * The client decodes it and triggers a browser download.
   */
  exportDeckPdf: protectedProcedure
    .input(
      z.object({
        deckId: z.number().int().positive(),
        startupName: z.string().max(120).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const deck = await getPitchDeckById(ctx.user.id, input.deckId);
      if (!deck) throw new TRPCError({ code: "NOT_FOUND", message: "Deck not found" });

      const slides = deck.slides;
      if (!slides.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Deck has no slides" });

      const startupName = input.startupName ?? "Pitch Deck";

      // Build PDF in memory
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        const doc = new PDFDocument({
          size: "LETTER",
          margins: { top: 60, bottom: 60, left: 72, right: 72 },
          info: { Title: startupName, Author: "PYTHIA — pythh.ai" },
        });

        doc.on("data", (chunk: Buffer) => chunks.push(chunk));
        doc.on("end", resolve);
        doc.on("error", reject);

        const W = doc.page.width;
        const EMERALD = "#10b981";
        const AMBER = "#f59e0b";
        const DARK = "#0f1117";
        const MUTED = "#6b7280";
        const WHITE = "#ffffff";

        const drawPageBg = () => {
          doc.rect(0, 0, doc.page.width, doc.page.height).fill(DARK);
        };

        const drawFooter = (slideNum: number, total: number) => {
          const y = doc.page.height - 40;
          doc.fontSize(8).fillColor(MUTED).text(
            `pythh.ai — PYTHIA  ·  Slide ${slideNum} of ${total}`,
            72, y, { width: W - 144, align: "left" }
          );
        };

        // Cover slide
        drawPageBg();
        doc.rect(0, 0, 6, doc.page.height).fill(EMERALD);
        doc.fontSize(36).fillColor(WHITE).font("Helvetica-Bold")
          .text(startupName, 90, 200, { width: W - 180, align: "left" });
        doc.fontSize(14).fillColor(EMERALD).font("Helvetica")
          .text("Investor Pitch Deck", 90, doc.y + 12, { width: W - 180 });
        const divY0 = doc.y + 24;
        doc.moveTo(90, divY0).lineTo(W - 90, divY0).strokeColor(EMERALD).lineWidth(1).stroke();
        doc.fontSize(10).fillColor(MUTED)
          .text("Prepared by PYTHIA · pythh.ai", 90, divY0 + 16, { width: W - 180 });
        drawFooter(1, slides.length + 1);

        // Content slides
        slides.forEach((slide, idx) => {
          doc.addPage();
          drawPageBg();
          doc.rect(0, 0, 6, doc.page.height).fill(EMERALD);

          // Slide number chip
          doc.fontSize(8).fillColor(AMBER).font("Helvetica-Bold")
            .text(`${String(idx + 1).padStart(2, "0")} / ${String(slides.length).padStart(2, "0")}`, 90, 68);

          // Title
          doc.fontSize(26).fillColor(WHITE).font("Helvetica-Bold")
            .text(slide.title || "Untitled", 90, 90, { width: W - 180 });

          // Divider under title
          const divY = doc.y + 10;
          doc.moveTo(90, divY).lineTo(W - 90, divY).strokeColor(EMERALD).lineWidth(0.5).stroke();

          // Content body
          const contentLines = (slide.content || "").split("\n").filter(Boolean);
          let curY = divY + 20;
          contentLines.forEach((line) => {
            const isBullet = line.startsWith("•") || line.startsWith("-");
            doc.fontSize(11)
              .fillColor(isBullet ? WHITE : MUTED)
              .font(isBullet ? "Helvetica" : "Helvetica-Oblique")
              .text(line, isBullet ? 100 : 90, curY, { width: W - 200, lineGap: 2 });
            curY = doc.y + 4;
          });

          // Speaker notes
          if (slide.notes && slide.notes.trim()) {
            const notesY = doc.page.height - 110;
            doc.moveTo(90, notesY).lineTo(W - 90, notesY).strokeColor(MUTED).lineWidth(0.5).stroke();
            doc.fontSize(8).fillColor(MUTED).font("Helvetica-Bold")
              .text("SPEAKER NOTES", 90, notesY + 8);
            doc.fontSize(8).fillColor(MUTED).font("Helvetica")
              .text(slide.notes.trim(), 90, doc.y + 4, { width: W - 180, lineBreak: true });
          }

          drawFooter(idx + 2, slides.length + 1);
        });

        doc.end();
      });

      const pdfBuffer = Buffer.concat(chunks);
      return {
        base64: pdfBuffer.toString("base64"),
        filename: `${startupName.replace(/[^a-z0-9]/gi, "_")}_pitch_deck.pdf`,
      };
    }),

  /**
   * Return the current deck and all email drafts for a runId.
   */
  getOutreachStatus: protectedProcedure
    .input(z.object({ runId: z.string().min(1).max(64) }))
    .query(async ({ input, ctx }) => {
      const [deck, emails] = await Promise.all([
        getPitchDeckByRunId(ctx.user.id, input.runId),
        getOutreachEmailsByRunId(ctx.user.id, input.runId),
      ]);
      return {
        deck: deck
          ? {
              id: deck.id,
              sourceType: deck.sourceType,
              status: deck.status,
              slides: deck.slides,
              fileKey: deck.fileKey ?? null,
            }
          : null,
        emails: emails.map((e) => ({
          id: e.id,
          investorName: e.investorName,
          investorFirm: e.investorFirm,
          toEmail: e.toEmail ?? null,
          subject: e.subject,
          body: e.body,
          status: e.status,
          sentAt: e.sentAt ?? null,
        })),
      };
    }),
});
