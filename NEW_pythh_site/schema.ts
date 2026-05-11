import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// TODO: Add your tables here

/**
 * Tracks Oracle plan subscriptions provisioned via Stripe.
 * One row per user; updated on renewal, upgrade, or cancellation.
 */
export const subscriptions = mysqlTable("subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → users.id */
  userId: int("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Stripe customer ID (cus_…) */
  stripeCustomerId: varchar("stripeCustomerId", { length: 64 }).notNull(),
  /** Stripe subscription ID (sub_…) */
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 64 }).notNull().unique(),
  /** Which plan the user is on */
  plan: mysqlEnum("plan", ["oracle", "scout"]).default("oracle").notNull(),
  /** Billing cadence */
  billingCycle: mysqlEnum("billingCycle", ["monthly", "annual"]).notNull(),
  /** Stripe subscription status */
  status: mysqlEnum("status", ["active", "past_due", "canceled", "unpaid", "trialing", "paused"])
    .default("active")
    .notNull(),
  /** Unix ms timestamp of the current period end (from Stripe) */
  currentPeriodEnd: bigint("currentPeriodEnd", { mode: "number" }),
  /**
   * True when the subscription is scheduled to cancel at the end of the
   * current period (set by downgradeToScout). Access remains active until
   * currentPeriodEnd; the webhook sets status='canceled' when it fires.
   */
  cancelAtPeriodEnd: int("cancelAtPeriodEnd", { unsigned: true }).default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

/**
 * Investor signal intelligence table.
 * Populated by seed script; updated periodically by the data pipeline.
 */
export const investors = mysqlTable("investors", {
  id: int("id").autoincrement().primaryKey(),
  /** Full name */
  name: varchar("name", { length: 128 }).notNull(),
  /** Firm / fund name */
  firm: varchar("firm", { length: 128 }).notNull(),
  /** Title / role at the firm */
  role: varchar("role", { length: 64 }),
  /** Primary investment sector */
  sector: varchar("sector", { length: 64 }).notNull(),
  /** Secondary sector (optional) */
  sector2: varchar("sector2", { length: 64 }),
  /** PYTHIA signal score 0–10 (composite activity + thesis alignment) */
  signal: int("signal").notNull(),        // stored as integer × 10, e.g. 86 = 8.6
  /** Week-over-week signal delta × 10 (e.g. -2 = -0.2) */
  delta: int("delta").notNull().default(0),
  /** GOD score 0–100 (Growth, Opportunity, Deployment) */
  god: int("god").notNull(),
  /** VCPP score 0–100 (VC Pattern Proximity) */
  vcpp: int("vcpp").notNull(),
  /** Typical check size label */
  checkSize: varchar("checkSize", { length: 32 }),
  /** Investment stage preference */
  stage: varchar("stage", { length: 64 }),
  /** Geographic focus */
  geo: varchar("geo", { length: 64 }),
  /** Recent activity label shown in the feed */
  recentActivity: varchar("recentActivity", { length: 128 }),
  /** LinkedIn / profile URL */
  profileUrl: varchar("profileUrl", { length: 256 }),
  /** Whether this row is visible to Scout (free) users */
  isPublic: int("isPublic", { unsigned: true }).default(0).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Investor = typeof investors.$inferSelect;
export type InsertInvestor = typeof investors.$inferInsert;

/**
 * Stores thumbs-up / thumbs-down feedback on a PYTHIA analysis run.
 * One row per (userId, runId) pair — upserted so users can change their rating.
 */
export const pipelineFeedback = mysqlTable("pipelineFeedback", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → users.id */
  userId: int("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /**
   * Client-generated UUID identifying a single analyzeStartup run.
   * The frontend generates this before calling the mutation so the
   * feedback widget can reference the same run.
   */
  runId: varchar("runId", { length: 64 }).notNull(),
  /** User's rating of the PYTHIA analysis quality */
  rating: mysqlEnum("rating", ["up", "down"]).notNull(),
  /**
   * Pre-defined reason for a thumbs-down rating.
   * One of the known issue categories shown in the reason chip selector.
   */
  reason: varchar("reason", { length: 64 }),
  /** Optional free-text comment (max 500 chars) */
  comment: varchar("comment", { length: 500 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PipelineFeedback = typeof pipelineFeedback.$inferSelect;
export type InsertPipelineFeedback = typeof pipelineFeedback.$inferInsert;

/**
 * Stores pitch decks associated with a PYTHIA analysis run.
 * Slides are stored as a JSON array of { title, content, notes? } objects.
 * Source can be 'uploaded' (user provided) or 'generated' (LLM created).
 */
export const pitchDecks = mysqlTable("pitchDecks", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → users.id */
  userId: int("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Client-generated UUID identifying the analysis run */
  runId: varchar("runId", { length: 64 }).notNull(),
  /** Startup domain / URL this deck is for */
  startupUrl: varchar("startupUrl", { length: 512 }),
  /** How the deck was created */
  sourceType: mysqlEnum("sourceType", ["uploaded", "generated"]).notNull().default("generated"),
  /** S3 key for the original uploaded file (null for generated decks) */
  fileKey: varchar("fileKey", { length: 256 }),
  /**
   * JSON array of slide objects:
   * [{ id: string, title: string, content: string, notes?: string }]
   * Stored as text; parsed on read.
   */
  slidesJson: text("slidesJson").notNull(),
  /** Deck status */
  status: mysqlEnum("status", ["draft", "ready", "approved"]).notNull().default("draft"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PitchDeck = typeof pitchDecks.$inferSelect;
export type InsertPitchDeck = typeof pitchDecks.$inferInsert;

/**
 * Stores per-investor outreach emails generated by PYTHIA.
 * One row per (userId, runId, investorId) — regenerated on demand.
 */
export const outreachEmails = mysqlTable("outreachEmails", {
  id: int("id").autoincrement().primaryKey(),
  /** FK → users.id */
  userId: int("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  /** Client-generated UUID identifying the analysis run */
  runId: varchar("runId", { length: 64 }).notNull(),
  /** Investor name (denormalised for easy display) */
  investorName: varchar("investorName", { length: 128 }).notNull(),
  /** Investor firm (denormalised) */
  investorFirm: varchar("investorFirm", { length: 128 }).notNull(),
  /** Recipient email address (inferred or provided) */
  toEmail: varchar("toEmail", { length: 256 }),
  /** Email subject line */
  subject: varchar("subject", { length: 256 }).notNull(),
  /** Full email body (plain text / markdown) */
  body: text("body").notNull(),
  /** Email status */
  status: mysqlEnum("status", ["draft", "approved", "sent"]).notNull().default("draft"),
  /** Unix ms timestamp when the email was sent */
  sentAt: bigint("sentAt", { mode: "number" }),
  /** Resend message ID (for tracking) */
  resendMessageId: varchar("resendMessageId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OutreachEmail = typeof outreachEmails.$inferSelect;
export type InsertOutreachEmail = typeof outreachEmails.$inferInsert;

/** Persisted PYTHIA analyzeStartup runs (handoff §6.3). */
export const pipelineRuns = mysqlTable("pipelineRuns", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  runId: varchar("runId", { length: 64 }).notNull().unique(),
  startupUrl: varchar("startupUrl", { length: 512 }).notNull(),
  summary: text("summary"),
  matchedInvestorsJson: text("matchedInvestorsJson"),
  status: varchar("status", { length: 32 }).default("completed").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PipelineRun = typeof pipelineRuns.$inferSelect;

/** Meeting proposals after outreach (handoff §6.4). */
export const meetings = mysqlTable("meetings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  runId: varchar("runId", { length: 64 }).notNull(),
  outreachEmailId: int("outreachEmailId"),
  investorName: varchar("investorName", { length: 128 }).notNull(),
  investorFirm: varchar("investorFirm", { length: 128 }).notNull(),
  proposedTimesJson: text("proposedTimesJson"),
  status: mysqlEnum("meetingStatus", ["proposed", "confirmed", "declined"]).notNull().default("proposed"),
  confirmedTime: bigint("confirmedTime", { mode: "number" }),
  calendarLink: varchar("calendarLink", { length: 512 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Meeting = typeof meetings.$inferSelect;

/** One row per user — founder profile for pipeline prefill (handoff §6.5). */
export const founderProfiles = mysqlTable("founderProfiles", {
  userId: int("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  companyName: varchar("companyName", { length: 256 }),
  companyUrl: varchar("companyUrl", { length: 512 }),
  stage: varchar("stage", { length: 64 }),
  sector: varchar("sector", { length: 128 }),
  askAmount: varchar("askAmount", { length: 64 }),
  deckFileKey: varchar("deckFileKey", { length: 256 }),
  bio: text("bio"),
  linkedinUrl: varchar("linkedinUrl", { length: 512 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type FounderProfile = typeof founderProfiles.$inferSelect;