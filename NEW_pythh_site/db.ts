import { and, asc, count, desc, eq, gte, inArray, isNotNull, like, or, SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  founderProfiles,
  InsertSubscription,
  InsertUser,
  investors,
  meetings,
  outreachEmails,
  pipelineFeedback,
  pipelineRuns,
  pitchDecks,
  subscriptions,
  users,
} from "./schema";
import { ENV } from "./env";

let pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;

/** Postgres (Supabase) — use `DATABASE_URL` (pooler or direct). */
export async function getDb() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return null;
  if (!_db) {
    try {
      const isSupabase =
        url.includes("supabase.co") || url.includes("pooler.supabase.com");
      pool = new Pool({
        connectionString: url,
        max: isSupabase ? 8 : 12,
        idleTimeoutMillis: 30_000,
        ssl: isSupabase ? { rejectUnauthorized: false } : undefined,
      });
      pool.on("error", (err: Error) => console.error("[Database] pg pool error:", err));
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
      pool = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db
      .insert(users)
      .values(values as typeof users.$inferInsert)
      .onConflictDoUpdate({
        target: users.openId,
        set: updateSet as Record<string, unknown>,
      });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ─── Subscription helpers ────────────────────────────────────────────────────

/**
 * Upsert a subscription row keyed by stripeSubscriptionId.
 * Called from the Stripe webhook handler on checkout.session.completed
 * and customer.subscription.updated / customer.subscription.deleted.
 */
export async function upsertSubscription(sub: InsertSubscription): Promise<void> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert subscription: database not available");
    return;
  }
  await db
    .insert(subscriptions)
    .values(sub)
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        status: sub.status,
        plan: sub.plan,
        billingCycle: sub.billingCycle,
        currentPeriodEnd: sub.currentPeriodEnd,
        stripeCustomerId: sub.stripeCustomerId,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd ?? 0,
        updatedAt: new Date(),
      },
    });
}

/**
 * Return the active subscription for a given internal user ID, or undefined.
 */
export async function getSubscriptionByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .limit(1);
  return rows[0] ?? undefined;
}

/**
 * Return a subscription by its Stripe subscription ID (sub_…).
 * Used inside the webhook to locate the row for updates.
 */
export async function getSubscriptionByStripeId(stripeSubscriptionId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .limit(1);
  return rows[0] ?? undefined;
}

// ─── Investor helpers ────────────────────────────────────────────────────────

export type InvestorSortField = "signal" | "god" | "vcpp" | "delta" | "name" | "firm";
export type SortDir = "asc" | "desc";

/**
 * Return paginated investor records with optional search, sector filter,
 * and column sort. Non-Oracle users only see rows where isPublic = 1.
 */
export async function getInvestorRankings(opts: {
  search?: string;
  sector?: string;
  sortBy?: InvestorSortField;
  sortDir?: SortDir;
  limit?: number;
  offset?: number;
  isOracle?: boolean;
}) {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };

  const {
    search,
    sector,
    sortBy = "signal",
    sortDir = "desc",
    limit = 50,
    offset = 0,
    isOracle = false,
  } = opts;

  const conditions: SQL[] = [];

  // Non-Oracle users only see public rows
  if (!isOracle) {
    conditions.push(eq(investors.isPublic, 1));
  }

  // Full-text search across name and firm
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    conditions.push(or(like(investors.name, term), like(investors.firm, term))!);
  }

  // Sector filter
  if (sector && sector !== "All") {
    conditions.push(
      or(eq(investors.sector, sector), eq(investors.sector2, sector))!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  // Column map for sorting
  const colMap = {
    signal: investors.signal,
    god: investors.god,
    vcpp: investors.vcpp,
    delta: investors.delta,
    name: investors.name,
    firm: investors.firm,
  } as const;
  const orderCol = colMap[sortBy] ?? investors.signal;
  const orderFn = sortDir === "asc" ? asc : desc;

  const rows = await db
    .select()
    .from(investors)
    .where(where)
    .orderBy(orderFn(orderCol))
    .limit(limit)
    .offset(offset);

  // Count total for pagination
  const [{ n: total }] = await db
    .select({ n: count() })
    .from(investors)
    .where(where);

  return { rows, total: total ?? 0 };
}

/**
 * Return a single investor by primary key, or undefined.
 */
export async function getInvestorById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(investors).where(eq(investors.id, id)).limit(1);
  return rows[0] ?? undefined;
}

// ─── Pipeline Feedback ────────────────────────────────────────────────────────

/**
 * Insert or update a pipeline feedback row for (userId, runId).
 * If a row already exists for this (userId, runId) pair, the rating and
 * comment are updated in-place (user changed their mind).
 */
export async function upsertPipelineFeedback(opts: {
  userId: number;
  runId: string;
  rating: "up" | "down";
  reason?: string | null;
  comment?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  const { userId, runId, rating, reason, comment } = opts;
  const existing = await db
    .select({ id: pipelineFeedback.id })
    .from(pipelineFeedback)
    .where(and(eq(pipelineFeedback.userId, userId), eq(pipelineFeedback.runId, runId)))
    .limit(1);
  if (existing.length > 0) {
    await db
      .update(pipelineFeedback)
      .set({ rating, reason: reason ?? null, comment: comment ?? null })
      .where(and(eq(pipelineFeedback.userId, userId), eq(pipelineFeedback.runId, runId)));
  } else {
    await db.insert(pipelineFeedback).values({ userId, runId, rating, reason: reason ?? null, comment: comment ?? null });
  }
}

/**
 * Return the feedback row for a given (userId, runId), or undefined.
 */
export async function getPipelineFeedbackByRunId(userId: number, runId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(pipelineFeedback)
    .where(and(eq(pipelineFeedback.userId, userId), eq(pipelineFeedback.runId, runId)))
    .limit(1);
  return rows[0] ?? undefined;
}

// ─── Pitch Decks ─────────────────────────────────────────────────────────────

/** Slide shape stored in slidesJson */
export interface Slide {
  id: string;
  title: string;
  content: string;
  notes?: string;
}

/**
 * Create a new pitch deck row. slidesJson is serialised from the slides array.
 */
export async function createPitchDeck(opts: {
  userId: number;
  runId: string;
  startupUrl?: string;
  sourceType: "uploaded" | "generated";
  fileKey?: string;
  slides: Slide[];
  status?: "draft" | "ready" | "approved";
}) {
  const db = await getDb();
  if (!db) return undefined;
  const { userId, runId, startupUrl, sourceType, fileKey, slides, status = "draft" } = opts;
  const [inserted] = await db
    .insert(pitchDecks)
    .values({
      userId,
      runId,
      startupUrl: startupUrl ?? null,
      sourceType,
      fileKey: fileKey ?? null,
      slidesJson: JSON.stringify(slides),
      status,
    })
    .returning({ id: pitchDecks.id });
  if (!inserted?.id) return undefined;
  const rows = await db.select().from(pitchDecks).where(eq(pitchDecks.id, inserted.id)).limit(1);
  return rows[0] ?? undefined;
}

/**
 * Update the slides and/or status of an existing pitch deck.
 */
export async function updatePitchDeckSlides(opts: {
  id: number;
  userId: number;
  slides?: Slide[];
  status?: "draft" | "ready" | "approved";
}) {
  const db = await getDb();
  if (!db) return;
  const { id, userId, slides, status } = opts;
  const patch: Record<string, unknown> = {};
  if (slides !== undefined) patch.slidesJson = JSON.stringify(slides);
  if (status !== undefined) patch.status = status;
  if (Object.keys(patch).length === 0) return;
  await db
    .update(pitchDecks)
    .set(patch as any)
    .where(and(eq(pitchDecks.id, id), eq(pitchDecks.userId, userId)));
}

/**
 * Return the most recent pitch deck for a (userId, runId) pair, or undefined.
 */
export async function getPitchDeckByRunId(userId: number, runId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(pitchDecks)
    .where(and(eq(pitchDecks.userId, userId), eq(pitchDecks.runId, runId)))
    .orderBy(desc(pitchDecks.createdAt))
    .limit(1);
  if (!rows[0]) return undefined;
  const row = rows[0];
  return {
    ...row,
    slides: JSON.parse(row.slidesJson || "[]") as Slide[],
  };
}

/**
 * Return a pitch deck by its primary key, scoped to the given userId.
 */
export async function getPitchDeckById(userId: number, deckId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(pitchDecks)
    .where(and(eq(pitchDecks.id, deckId), eq(pitchDecks.userId, userId)))
    .limit(1);
  if (!rows[0]) return undefined;
  const row = rows[0];
  return {
    ...row,
    slides: JSON.parse(row.slidesJson || "[]") as Slide[],
  };
}

// ─── Outreach Emails ──────────────────────────────────────────────────────────

/**
 * Insert a new outreach email draft.
 */
export async function createOutreachEmail(opts: {
  userId: number;
  runId: string;
  investorName: string;
  investorFirm: string;
  toEmail?: string;
  subject: string;
  body: string;
}) {
  const db = await getDb();
  if (!db) return undefined;
  const { userId, runId, investorName, investorFirm, toEmail, subject, body } = opts;
  const [inserted] = await db
    .insert(outreachEmails)
    .values({
      userId,
      runId,
      investorName,
      investorFirm,
      toEmail: toEmail ?? null,
      subject,
      body,
      status: "draft",
    })
    .returning({ id: outreachEmails.id });
  if (!inserted?.id) return undefined;
  const rows = await db.select().from(outreachEmails).where(eq(outreachEmails.id, inserted.id)).limit(1);
  return rows[0] ?? undefined;
}

/**
 * Update the status (and optionally sentAt / resendMessageId) of an outreach email.
 */
export async function updateOutreachEmailStatus(opts: {
  id: number;
  userId: number;
  status: "draft" | "approved" | "sent";
  sentAt?: number;
  resendMessageId?: string;
  subject?: string;
  body?: string;
  toEmail?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const { id, userId, status, sentAt, resendMessageId, subject, body, toEmail } = opts;
  const patch: Record<string, unknown> = { status };
  if (sentAt !== undefined) patch.sentAt = sentAt;
  if (resendMessageId !== undefined) patch.resendMessageId = resendMessageId;
  if (subject !== undefined) patch.subject = subject;
  if (body !== undefined) patch.body = body;
  if (toEmail !== undefined) patch.toEmail = toEmail;
  await db
    .update(outreachEmails)
    .set(patch as any)
    .where(and(eq(outreachEmails.id, id), eq(outreachEmails.userId, userId)));
}

/**
 * Return all outreach email drafts for a (userId, runId) pair.
 */
export async function getOutreachEmailsByRunId(userId: number, runId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(outreachEmails)
    .where(and(eq(outreachEmails.userId, userId), eq(outreachEmails.runId, runId)))
    .orderBy(asc(outreachEmails.createdAt));
}

// ─── Pipeline runs (persist analyzeStartup) ───────────────────────────────────

export async function createPipelineRun(opts: {
  userId: number;
  runId: string;
  startupUrl: string;
  summary: string;
  matches: unknown[];
  status?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const { userId, runId, startupUrl, summary, matches, status = "completed" } = opts;
  await db.insert(pipelineRuns).values({
    userId,
    runId,
    startupUrl,
    summary,
    matchedInvestorsJson: JSON.stringify(matches),
    status,
  });
}

export async function getPipelineRunByRunId(userId: number, runId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(pipelineRuns)
    .where(and(eq(pipelineRuns.userId, userId), eq(pipelineRuns.runId, runId)))
    .limit(1);
  return rows[0] ?? undefined;
}

export async function listRecentPipelineRunsForUser(userId: number, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(pipelineRuns)
    .where(eq(pipelineRuns.userId, userId))
    .orderBy(desc(pipelineRuns.createdAt))
    .limit(limit);
}

/** Count total pipeline runs ever created by a user (for free-tier enforcement). */
export async function countPipelineRunsForUser(userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const [row] = await db
    .select({ n: count() })
    .from(pipelineRuns)
    .where(eq(pipelineRuns.userId, userId));
  return Number(row?.n ?? 0);
}

// ─── Founder profile ─────────────────────────────────────────────────────────

export async function getFounderProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(founderProfiles).where(eq(founderProfiles.userId, userId)).limit(1);
  return rows[0] ?? undefined;
}

export async function upsertFounderProfile(
  userId: number,
  patch: Partial<{
    companyName: string | null;
    companyUrl: string | null;
    stage: string | null;
    sector: string | null;
    askAmount: string | null;
    deckFileKey: string | null;
    bio: string | null;
    linkedinUrl: string | null;
  }>,
) {
  const db = await getDb();
  if (!db) return;
  const existing = await getFounderProfile(userId);
  if (existing) {
    await db
      .update(founderProfiles)
      .set({ ...(patch as Record<string, unknown>), updatedAt: new Date() })
      .where(eq(founderProfiles.userId, userId));
  } else {
    await db
      .insert(founderProfiles)
      .values({ userId, ...(patch as Record<string, unknown>), updatedAt: new Date() });
  }
}

// ─── Meetings ────────────────────────────────────────────────────────────────

export async function createMeetingProposal(opts: {
  userId: number;
  runId: string;
  outreachEmailId: number;
  investorName: string;
  investorFirm: string;
  proposedTimes: unknown[];
}) {
  const db = await getDb();
  if (!db) return undefined;
  const { userId, runId, outreachEmailId, investorName, investorFirm, proposedTimes } = opts;
  const [inserted] = await db
    .insert(meetings)
    .values({
      userId,
      runId,
      outreachEmailId,
      investorName,
      investorFirm,
      proposedTimesJson: JSON.stringify(proposedTimes),
      status: "proposed",
    })
    .returning({ id: meetings.id });
  if (inserted?.id == null) return undefined;
  const rows = await db.select().from(meetings).where(eq(meetings.id, inserted.id)).limit(1);
  return rows[0] ?? undefined;
}

export async function getMeetingByIdForUser(userId: number, meetingId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)))
    .limit(1);
  return rows[0] ?? undefined;
}

export async function listMeetingsForOutreachEmail(userId: number, runId: string, outreachEmailId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(meetings)
    .where(
      and(
        eq(meetings.userId, userId),
        eq(meetings.runId, runId),
        eq(meetings.outreachEmailId, outreachEmailId),
      ),
    )
    .orderBy(desc(meetings.createdAt));
}

export async function updateMeetingStatus(opts: {
  userId: number;
  meetingId: number;
  status: "proposed" | "confirmed" | "declined";
  confirmedTime?: number;
  calendarLink?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  const { userId, meetingId, status, confirmedTime, calendarLink } = opts;
  const patch: Record<string, unknown> = { status };
  if (confirmedTime !== undefined) patch.confirmedTime = confirmedTime;
  if (calendarLink !== undefined) patch.calendarLink = calendarLink;
  await db.update(meetings).set(patch as never).where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)));
}

// ─── Admin aggregates ───────────────────────────────────────────────────────

function utcStartOfTodayMs() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export async function getAdminAggregateStats() {
  const db = await getDb();
  if (!db) {
    return {
      totalUsers: 0,
      activeSubscribers: 0,
      pipelineRunsToday: 0,
      emailsSentToday: 0,
    };
  }
  const startMs = utcStartOfTodayMs();
  const startDay = new Date(startMs);

  const [{ n: totalUsers }] = await db.select({ n: count() }).from(users);

  const [{ n: activeSubscribers }] = await db
    .select({ n: count() })
    .from(subscriptions)
    .where(
      and(eq(subscriptions.plan, "oracle"), inArray(subscriptions.status, ["active", "trialing", "paused"])),
    );

  const [{ n: pipelineRunsToday }] = await db
    .select({ n: count() })
    .from(pipelineRuns)
    .where(gte(pipelineRuns.createdAt, startDay));

  const [{ n: emailsSentToday }] = await db
    .select({ n: count() })
    .from(outreachEmails)
    .where(
      and(eq(outreachEmails.status, "sent"), isNotNull(outreachEmails.sentAt), gte(outreachEmails.sentAt, startMs)),
    );

  return {
    totalUsers: totalUsers ?? 0,
    activeSubscribers: activeSubscribers ?? 0,
    pipelineRunsToday: pipelineRunsToday ?? 0,
    emailsSentToday: emailsSentToday ?? 0,
  };
}

export async function getRecentFeedbackWithUsers(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: pipelineFeedback.id,
      userId: pipelineFeedback.userId,
      runId: pipelineFeedback.runId,
      rating: pipelineFeedback.rating,
      reason: pipelineFeedback.reason,
      comment: pipelineFeedback.comment,
      createdAt: pipelineFeedback.createdAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(pipelineFeedback)
    .leftJoin(users, eq(pipelineFeedback.userId, users.id))
    .orderBy(desc(pipelineFeedback.createdAt))
    .limit(limit);
}

export async function listUsersBrief(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt))
    .limit(limit);
}
