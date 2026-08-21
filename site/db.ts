import { and, asc, count, desc, eq, gte, inArray, isNotNull, like, or, sql, SQL } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  founderProfiles,
  fundraisingOutcomes,
  fundraisingEvidenceReviews,
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
  type User,
} from "./schema";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ENV } from "./env";

let pool: Pool | null = null;
let _db: ReturnType<typeof drizzle> | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

/** Supabase REST fallback when direct Postgres (DATABASE_URL) is unreachable (e.g. IPv6-only db host). */
function getSupabaseAdmin(): SupabaseClient | null {
  if (_supabaseAdmin) return _supabaseAdmin;
  const url = String(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").trim();
  const key = String(
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  ).trim();
  if (!url || !key) return null;
  _supabaseAdmin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _supabaseAdmin;
}

/** Reject placeholder DATABASE_URL hosts (Fly had hostname literally "base" → ENOTFOUND). */
function isUsableDatabaseUrl(connectionString: string): boolean {
  try {
    const normalized = String(connectionString || "")
      .replace(/^postgresql:/i, "http:")
      .replace(/^postgres:/i, "http:");
    const host = new URL(normalized).hostname.toLowerCase();
    if (!host || host === "base" || host === "hostname" || host === "your-db-host") return false;
    if (
      (process.env.FLY_APP_NAME || process.env.NODE_ENV === "production") &&
      (host === "localhost" || host === "127.0.0.1")
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export { getSupabaseAdmin };

function mapRestUserRow(data: Record<string, unknown>): User {
  return {
    id: data.id as number,
    openId: data.open_id as string,
    name: (data.name as string | null) ?? null,
    email: (data.email as string | null) ?? null,
    loginMethod: (data.login_method as string | null) ?? null,
    role: (data.role as string) ?? "user",
    createdAt: new Date(String(data.created_at)),
    updatedAt: new Date(String(data.updated_at)),
    lastSignedIn: new Date(String(data.last_signed_in)),
  };
}

async function upsertUserViaRest(user: InsertUser): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb || !user.openId) {
    throw new Error("Supabase REST unavailable for user upsert");
  }
  const row: Record<string, unknown> = {
    open_id: user.openId,
    last_signed_in: (user.lastSignedIn ?? new Date()).toISOString(),
  };
  if (user.email !== undefined) row.email = user.email ?? null;
  if (user.name !== undefined) row.name = user.name ?? null;
  if (user.loginMethod !== undefined) row.login_method = user.loginMethod ?? null;
  if (user.role !== undefined) {
    row.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    row.role = "admin";
  }
  const { error } = await sb.from("pythh_users").upsert(row, { onConflict: "open_id" });
  if (error) throw error;
}

async function getUserByOpenIdViaRest(openId: string): Promise<User | undefined> {
  const sb = getSupabaseAdmin();
  if (!sb) return undefined;
  const { data, error } = await sb
    .from("pythh_users")
    .select("*")
    .eq("open_id", openId)
    .limit(1)
    .maybeSingle();
  if (error || !data) return undefined;
  return mapRestUserRow(data as Record<string, unknown>);
}

/** Run a raw parameterised SQL query. Used by admin tRPC procedures that need
 *  tables outside the Drizzle schema (god_weight_versions, rss_sources, etc.). */
export async function rawQuery<T = Record<string, unknown>>(
  text: string,
  values?: unknown[],
): Promise<T[]> {
  await getDb(); // ensure pool is initialised
  if (!pool) return [];
  try {
    const result = await pool.query(text, values);
    return result.rows as T[];
  } catch (err) {
    console.warn(
      "[Database] rawQuery failed:",
      err instanceof Error ? err.message : err,
      "| sql:",
      text.slice(0, 80).replace(/\s+/g, " "),
    );
    return [];
  }
}

/** Run a raw write (INSERT/UPDATE/DELETE) and return affected-row count. */
export async function rawExecute(text: string, values?: unknown[]): Promise<number> {
  await getDb();
  if (!pool) return 0;
  try {
    const result = await pool.query(text, values);
    return result.rowCount ?? 0;
  } catch {
    return 0;
  }
}

/** Postgres (Supabase) — use `DATABASE_URL` (pooler or direct). */
export async function getDb() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url || !isUsableDatabaseUrl(url)) {
    if (url && !isUsableDatabaseUrl(url)) {
      console.warn(
        "[Database] DATABASE_URL host is unusable (e.g. placeholder \"base\") — using Supabase REST fallbacks for admin stats",
      );
    }
    return null;
  }
  if (!_db) {
    try {
      const isSupabase =
        url.includes("supabase.co") || url.includes("pooler.supabase.com");
      pool = new Pool({
        connectionString: url,
        max: isSupabase ? 8 : 12,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 8_000,
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
    console.warn("[Database] Postgres unavailable — upserting user via Supabase REST");
    await upsertUserViaRest(user);
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
    console.warn("[Database] Postgres upsert failed — trying Supabase REST:", (error as Error)?.message);
    await upsertUserViaRest(user);
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    return getUserByOpenIdViaRest(openId);
  }

  try {
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    if (result.length > 0) return result[0];
  } catch (error) {
    console.warn("[Database] Postgres getUser failed — trying Supabase REST:", (error as Error)?.message);
  }

  return getUserByOpenIdViaRest(openId);
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
  const investor = rows[0] ?? undefined;
  if (!investor) return undefined;

  // Enrich with vc_intelligence thesis data (main Supabase, bridged by firm name)
  let vcIntel: {
    thesisSummary: string | null;
    sectorPreferences: string[];
    personalityProfile: string | null;
    communicationStyle: string | null;
    bestOutreachHook: string | null;
    keyThemes: string[];
    redFlags: string[];
  } | null = null;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const sbKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (sbUrl && sbKey) {
      const sb = createClient(sbUrl, sbKey);
      const { data } = await sb
        .from("vc_intelligence")
        .select("thesis_summary, sector_preferences, personality_profile, communication_style, best_outreach_hook, key_themes, red_flags")
        .ilike("firm_name", investor.firm)
        .limit(1)
        .maybeSingle();
      if (data) {
        vcIntel = {
          thesisSummary: data.thesis_summary ?? null,
          sectorPreferences: Array.isArray(data.sector_preferences) ? data.sector_preferences : [],
          personalityProfile: data.personality_profile ?? null,
          communicationStyle: data.communication_style ?? null,
          bestOutreachHook: data.best_outreach_hook ?? null,
          keyThemes: Array.isArray(data.key_themes) ? data.key_themes : [],
          redFlags: Array.isArray(data.red_flags) ? data.red_flags : [],
        };
      }
    }
  } catch {
    // Non-fatal — modal still works without thesis data
  }

  return { ...investor, vcIntel };
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
  startupId?: string | null;
  investorId?: string | null;
  investorName: string;
  investorFirm: string;
  toEmail?: string;
  subject: string;
  body: string;
}) {
  const db = await getDb();
  if (!db) return undefined;
  const { userId, runId, startupId, investorId, investorName, investorFirm, toEmail, subject, body } = opts;
  const [inserted] = await db
    .insert(outreachEmails)
    .values({
      userId,
      runId,
      startupId: startupId ?? null,
      investorId: investorId ?? null,
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
  startupId?: string | null;
  startupUrl: string;
  summary: string;
  matches: unknown[];
  status?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const { userId, runId, startupId, startupUrl, summary, matches, status = "completed" } = opts;
  await db.insert(pipelineRuns).values({
    userId,
    runId,
    startupId: startupId ?? null,
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
    startupId: string | null;
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
  startupId?: string | null;
  investorId?: string | null;
  outreachEmailId: number;
  investorName: string;
  investorFirm: string;
  proposedTimes: unknown[];
}) {
  const db = await getDb();
  if (!db) return undefined;
  const { userId, runId, startupId, investorId, outreachEmailId, investorName, investorFirm, proposedTimes } = opts;
  const [inserted] = await db
    .insert(meetings)
    .values({
      userId,
      runId,
      startupId: startupId ?? null,
      investorId: investorId ?? null,
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

export const FUNDRAISING_OUTCOME_TYPES = [
  "outreach_sent",
  "reply_received",
  "meeting_proposed",
  "meeting_confirmed",
  "meeting_declined",
  "diligence_started",
  "term_sheet_received",
  "capital_committed",
] as const;

export type FundraisingOutcomeType = (typeof FUNDRAISING_OUTCOME_TYPES)[number];

/** Append a real fundraising transition once. Duplicate provider/user callbacks are harmless. */
export async function recordFundraisingOutcome(opts: {
  userId: number;
  runId: string;
  startupId?: string | null;
  investorId?: string | null;
  eventType: FundraisingOutcomeType;
  source: "founder_action" | "pythia" | "resend" | "calendar" | "system";
  idempotencyKey: string;
  verified: boolean;
  outreachEmailId?: number | null;
  meetingId?: number | null;
  occurredAt?: Date;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) return undefined;
  const key = opts.idempotencyKey.trim();
  if (key.length < 8 || key.length > 240) throw new Error("Invalid fundraising outcome idempotency key");
  const [inserted] = await db
    .insert(fundraisingOutcomes)
    .values({
      userId: opts.userId,
      runId: opts.runId,
      startupId: opts.startupId ?? null,
      investorId: opts.investorId ?? null,
      eventType: opts.eventType,
      source: opts.source,
      verified: opts.verified ? 1 : 0,
      idempotencyKey: key,
      outreachEmailId: opts.outreachEmailId ?? null,
      meetingId: opts.meetingId ?? null,
      occurredAt: opts.occurredAt ?? new Date(),
      metadata: opts.metadata ?? {},
    })
    .onConflictDoNothing({ target: fundraisingOutcomes.idempotencyKey })
    .returning({ id: fundraisingOutcomes.id });
  return inserted ? { id: inserted.id, duplicate: false } : { duplicate: true };
}

export async function getFundraisingOutcomeMetrics(userId: number, runId: string) {
  const db = await getDb();
  const empty = {
    outreachSent: 0, repliesReceived: 0, meetingsProposed: 0, meetingsConfirmed: 0,
    diligenceStarted: 0, termSheetsReceived: 0, capitalCommitted: 0,
  };
  if (!db) return empty;
  const rows = await db
    .select({ eventType: fundraisingOutcomes.eventType, n: count() })
    .from(fundraisingOutcomes)
    .where(and(eq(fundraisingOutcomes.userId, userId), eq(fundraisingOutcomes.runId, runId)))
    .groupBy(fundraisingOutcomes.eventType);
  const counts = new Map(rows.map((row) => [row.eventType, Number(row.n)]));
  return {
    outreachSent: counts.get("outreach_sent") ?? 0,
    repliesReceived: counts.get("reply_received") ?? 0,
    meetingsProposed: counts.get("meeting_proposed") ?? 0,
    meetingsConfirmed: counts.get("meeting_confirmed") ?? 0,
    diligenceStarted: counts.get("diligence_started") ?? 0,
    termSheetsReceived: counts.get("term_sheet_received") ?? 0,
    capitalCommitted: counts.get("capital_committed") ?? 0,
  };
}

export async function listPendingFundraisingEvidence(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fundraisingOutcomes)
    .where(and(
      eq(fundraisingOutcomes.verified, 0),
      sql`${fundraisingOutcomes.eventType} in ('diligence_started','term_sheet_received','capital_committed')`,
      sql`${fundraisingOutcomes.metadata}->>'verification_status' = 'pending_review'`,
    ))
    .orderBy(asc(fundraisingOutcomes.occurredAt)).limit(limit);
}

export async function reviewFundraisingEvidence(opts: { outcomeId: number; reviewerUserId: number; decision: "verified" | "rejected"; reviewNote?: string }) {
  const db = await getDb();
  if (!db) return undefined;
  return db.transaction(async (tx) => {
    const [outcome] = await tx.select().from(fundraisingOutcomes).where(eq(fundraisingOutcomes.id, opts.outcomeId)).limit(1);
    if (!outcome || !["diligence_started", "term_sheet_received", "capital_committed"].includes(outcome.eventType)) return undefined;
    const [review] = await tx.insert(fundraisingEvidenceReviews).values({ outcomeId: outcome.id, reviewerUserId: opts.reviewerUserId, decision: opts.decision, reviewNote: opts.reviewNote ?? null }).onConflictDoNothing({ target: fundraisingEvidenceReviews.outcomeId }).returning({ id: fundraisingEvidenceReviews.id });
    if (!review) return { duplicate: true, decision: (outcome.metadata?.verification_status as string | undefined) ?? "reviewed" };
    await tx.update(fundraisingOutcomes).set({
      verified: opts.decision === "verified" ? 1 : 0,
      metadata: { ...outcome.metadata, verification_status: opts.decision, review_note: opts.reviewNote ?? null, reviewer_user_id: opts.reviewerUserId },
    }).where(eq(fundraisingOutcomes.id, outcome.id));
    return { duplicate: false, decision: opts.decision };
  });
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
    return getAdminAggregateStatsViaSupabase();
  }
  try {
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
      source: "postgres" as const,
    };
  } catch (err) {
    console.warn(
      "[Database] getAdminAggregateStats postgres failed, using Supabase:",
      err instanceof Error ? err.message : err,
    );
    return getAdminAggregateStatsViaSupabase();
  }
}

async function getAdminAggregateStatsViaSupabase() {
  const sb = getSupabaseAdmin();
  if (!sb) {
    return {
      totalUsers: 0,
      activeSubscribers: 0,
      pipelineRunsToday: 0,
      emailsSentToday: 0,
      source: "unavailable" as const,
    };
  }
  const startIso = new Date(utcStartOfTodayMs()).toISOString();
  const [usersQ, subsQ, runsQ, emailsQ] = await Promise.all([
    sb.from("pythh_users").select("id", { count: "exact", head: true }),
    sb
      .from("subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("plan", "oracle")
      .in("status", ["active", "trialing", "paused"]),
    sb.from("pipeline_runs").select("id", { count: "exact", head: true }).gte("created_at", startIso),
    sb
      .from("outreach_emails")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent")
      .gte("sent_at", startIso),
  ]);
  return {
    totalUsers: usersQ.count ?? 0,
    activeSubscribers: subsQ.count ?? 0,
    pipelineRunsToday: runsQ.count ?? 0,
    emailsSentToday: emailsQ.count ?? 0,
    source: "supabase" as const,
  };
}

/** Matching admin summary — uses platform_stats_cache when Postgres is down. */
export async function getAdminMatchSummary() {
  const db = await getDb();
  if (db) {
    const viaPg = await rawQuery<{
      total: string;
      high_score: string;
      strong_fit: string;
      recent7d: string;
      avg_score: string;
    }>(`
      SELECT
        COUNT(*)::text AS total,
        COUNT(*) FILTER (WHERE match_score >= 75)::text AS high_score,
        COUNT(*) FILTER (WHERE match_score >= 85)::text AS strong_fit,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::text AS recent7d,
        ROUND(AVG(match_score)::numeric, 1)::text AS avg_score
      FROM startup_investor_matches
    `);
    const buckets = await rawQuery<{ bucket: string; cnt: string }>(`
      SELECT
        CASE
          WHEN match_score IS NULL THEN 'unscored'
          WHEN match_score < 50  THEN '0–49'
          WHEN match_score < 70  THEN '50–69'
          WHEN match_score < 85  THEN '70–84'
          ELSE '85–100'
        END AS bucket,
        COUNT(*)::text AS cnt
      FROM startup_investor_matches
      GROUP BY 1
      ORDER BY 1
    `);

    const row = viaPg[0];
    if (row && Number(row.total) > 0) {
      return {
        total: row.total ?? "0",
        highScore: row.high_score ?? "0",
        strongFit: row.strong_fit ?? "0",
        recent7d: row.recent7d ?? "0",
        avgScore: row.avg_score ?? null,
        buckets,
        source: "postgres" as const,
      };
    }
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return {
      total: "0",
      highScore: "0",
      strongFit: "0",
      recent7d: "0",
      avgScore: null,
      buckets: [] as { bucket: string; cnt: string }[],
      source: "unavailable" as const,
    };
  }

  const { data: cache } = await sb.from("platform_stats_cache").select("*").eq("id", 1).maybeSingle();

  // Skip filtered exact counts on startup_investor_matches via PostgREST — they time out
  // on ~3.8M rows. Totals/7d come from platform_stats_cache; high/strong need Postgres.
  return {
    total: String(cache?.matches ?? 0),
    highScore: "—",
    strongFit: "—",
    recent7d: String(cache?.matches_new_7d ?? 0),
    avgScore: null as string | null,
    buckets: [] as { bucket: string; cnt: string }[],
    source: "supabase_cache" as const,
    cacheUpdatedAt: cache?.updated_at ?? null,
  };
}

/** ML admin panel — Supabase when Postgres rawQuery returns empty. */
export async function getAdminMlRecommendations() {
  const db = await getDb();
  if (db) {
    const [pending, recent, entityGateStats] = await Promise.all([
      rawQuery(`
        SELECT id, weights_version, recommendation_type, confidence, reasoning,
               expected_improvement, status, requires_manual_approval,
               current_weights, recommended_weights, created_at
        FROM ml_recommendations
        WHERE status = 'pending'
        ORDER BY created_at DESC
        LIMIT 20
      `),
      rawQuery(`
        SELECT id, recommendation_type, confidence, status, reviewed_at, rejection_reason, created_at
        FROM ml_recommendations
        WHERE status != 'pending'
        ORDER BY created_at DESC
        LIMIT 20
      `),
      rawQuery<{ gate: string; cnt: string }>(`
        SELECT COALESCE(entity_gate, 'unset') AS gate, COUNT(*) AS cnt
        FROM startup_uploads
        GROUP BY entity_gate
        ORDER BY cnt DESC
      `),
    ]);

    if (pending.length || recent.length || entityGateStats.length) {
      return { pending, recent, entityGateStats, source: "postgres" as const };
    }
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return { pending: [], recent: [], entityGateStats: [], source: "unavailable" as const };
  }

  const [pendingSb, recentSb] = await Promise.all([
    sb
      .from("ml_recommendations")
      .select(
        "id, weights_version, recommendation_type, confidence, reasoning, expected_improvement, status, requires_manual_approval, current_weights, recommended_weights, created_at",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
    sb
      .from("ml_recommendations")
      .select("id, recommendation_type, confidence, status, reviewed_at, rejection_reason, created_at")
      .neq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const gateKeys = ["qualified", "needs_url", "junk", "review"] as const;
  const gateCounts = await Promise.all([
    sb.from("startup_uploads").select("id", { count: "exact", head: true }).is("entity_gate", null),
    ...gateKeys.map((g) =>
      sb.from("startup_uploads").select("id", { count: "exact", head: true }).eq("entity_gate", g),
    ),
  ]);

  const entityGateStatsSb = [
    { gate: "unset", cnt: String(gateCounts[0].count ?? 0) },
    ...gateKeys.map((g, i) => ({ gate: g, cnt: String(gateCounts[i + 1].count ?? 0) })),
  ].filter((r) => Number(r.cnt) > 0);

  return {
    pending: pendingSb.data ?? [],
    recent: recentSb.data ?? [],
    entityGateStats: entityGateStatsSb,
    source: "supabase" as const,
  };
}

/** Analytics admin — Supabase aggregation when Postgres is down. */
export async function getAdminAnalytics() {
  const db = await getDb();
  if (db) {
    const [eventBreakdown, dailySignups, pageViews, usageStats] = await Promise.all([
      rawQuery<{ event_name: string; cnt: string }>(`
        SELECT event_name, COUNT(*) AS cnt
        FROM events
        WHERE created_at > now() - interval '30 days'
        GROUP BY event_name
        ORDER BY cnt DESC
        LIMIT 25
      `),
      rawQuery<{ day: string; cnt: string }>(`
        SELECT TO_CHAR(DATE(created_at), 'YYYY-MM-DD') AS day, COUNT(*) AS cnt
        FROM pythh_users
        WHERE created_at > now() - interval '30 days'
        GROUP BY 1
        ORDER BY 1
      `),
      rawQuery<{ page: string; cnt: string }>(`
        SELECT page, COUNT(*) AS cnt
        FROM events
        WHERE event_name = 'page_viewed'
          AND created_at > now() - interval '30 days'
        GROUP BY page
        ORDER BY cnt DESC
        LIMIT 20
      `),
      rawQuery<{ total_users: string; avg_analysis_count: string; active_30d: string }>(`
        SELECT
          COUNT(*) AS total_users,
          ROUND(AVG(analysis_count)::numeric, 1) AS avg_analysis_count,
          COUNT(*) FILTER (WHERE updated_at > now() - interval '30 days') AS active_30d
        FROM profiles
      `),
    ]);

    if (eventBreakdown.length || dailySignups.length || usageStats[0]) {
      return {
        eventBreakdown,
        dailySignups,
        pageViews,
        usageStats: usageStats[0] ?? null,
        source: "postgres" as const,
      };
    }
  }

  const sb = getSupabaseAdmin();
  if (!sb) {
    return {
      eventBreakdown: [],
      dailySignups: [],
      pageViews: [],
      usageStats: null,
      source: "unavailable" as const,
    };
  }

  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const [{ data: eventRows }, { data: userRows }, { count: totalUsers }, { count: active30d }] =
    await Promise.all([
      sb.from("events").select("event_name, page, created_at").gte("created_at", since).limit(5000),
      sb.from("pythh_users").select("created_at").gte("created_at", since).limit(5000),
      sb.from("profiles").select("id", { count: "exact", head: true }),
      sb
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gte("updated_at", since),
    ]);

  const eventMap = new Map<string, number>();
  const pageMap = new Map<string, number>();
  for (const row of eventRows || []) {
    const name = String((row as { event_name?: string }).event_name || "unknown");
    eventMap.set(name, (eventMap.get(name) || 0) + 1);
    if (name === "page_viewed") {
      const page = String((row as { page?: string }).page || "/");
      pageMap.set(page, (pageMap.get(page) || 0) + 1);
    }
  }
  const dayMap = new Map<string, number>();
  for (const row of userRows || []) {
    const day = String((row as { created_at?: string }).created_at || "").slice(0, 10);
    if (!day) continue;
    dayMap.set(day, (dayMap.get(day) || 0) + 1);
  }

  return {
    eventBreakdown: [...eventMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 25)
      .map(([event_name, cnt]) => ({ event_name, cnt: String(cnt) })),
    dailySignups: [...dayMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, cnt]) => ({ day, cnt: String(cnt) })),
    pageViews: [...pageMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([page, cnt]) => ({ page, cnt: String(cnt) })),
    usageStats: {
      total_users: String(totalUsers ?? 0),
      avg_analysis_count: "—",
      active_30d: String(active30d ?? 0),
    },
    source: "supabase" as const,
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

// ─── Animation Feed ───────────────────────────────────────────────────────────

export interface AnimationInvestor {
  name: string;
  firm: string;
  sectors: string[];
  investorScore: number;
  recentActivity: string | null;
}

const ANIMATION_SIGNAL_LABELS = [
  "New fund deploy", "Thesis match", "Portfolio gap", "Stage alignment",
  "Fund cycle: early", "LP update signal", "New vertical focus",
  "Recent co-invest signal", "Optics: strong fit", "Thesis update detected",
  "Check-writing velocity", "Sector conviction signal",
];

/**
 * Returns a random sample of top qualified investors from the main `investors`
 * table for use in the home page animation. Picks a random page offset so each
 * load shows a different mix of investors.
 */
export async function getAnimationFeed(limit = 20): Promise<AnimationInvestor[]> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
    const sbKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!sbUrl || !sbKey) return [];

    const sb = createClient(sbUrl, sbKey);

    // Pick a random offset within the top-2000 qualified investors so every
    // page load surfaces a different cohort.
    const POOL_SIZE = 1800;
    const maxOffset = Math.max(0, POOL_SIZE - limit);
    const randomOffset = Math.floor(Math.random() * maxOffset);

    const { data, error } = await sb
      .from("investors")
      .select("name, firm, sectors, investor_score, investment_thesis")
      .eq("entity_gate", "qualified")
      .gte("investor_score", 50)
      .order("investor_score", { ascending: false })
      .range(randomOffset, randomOffset + limit - 1);

    if (error || !data?.length) return [];

    return data.map((r, i) => ({
      name: r.name || r.firm || "Anonymous",
      firm: r.firm || r.name || "VC Fund",
      sectors: Array.isArray(r.sectors) ? r.sectors : [],
      investorScore: typeof r.investor_score === "number" ? r.investor_score : 60,
      recentActivity: r.investment_thesis
        ? (r.investment_thesis as string).slice(0, 50) + "…"
        : ANIMATION_SIGNAL_LABELS[i % ANIMATION_SIGNAL_LABELS.length],
    }));
  } catch {
    return [];
  }
}
