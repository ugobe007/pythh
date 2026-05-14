/**
 * Drizzle schema — Postgres (Supabase). Tables use `pythh_*` prefix + snake_case columns.
 * Apply: supabase/migrations/*_pythh_drizzle_postgres_tables.sql
 */
import { bigint, integer, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const users = pgTable("pythh_users", {
  id: serial("id").primaryKey(),
  openId: varchar("open_id", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("login_method", { length: 64 }),
  role: varchar("role", { length: 32 }).default("user").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignedIn: timestamp("last_signed_in", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const subscriptions = pgTable("pythh_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  stripeCustomerId: varchar("stripe_customer_id", { length: 64 }).notNull(),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 64 }).notNull().unique(),
  plan: varchar("plan", { length: 32 }).default("oracle").notNull(),
  billingCycle: varchar("billing_cycle", { length: 32 }).notNull(),
  status: varchar("status", { length: 32 }).default("active").notNull(),
  currentPeriodEnd: bigint("current_period_end", { mode: "number" }),
  cancelAtPeriodEnd: integer("cancel_at_period_end").default(0).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = typeof subscriptions.$inferInsert;

export const investors = pgTable("pythh_investors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  firm: varchar("firm", { length: 128 }).notNull(),
  role: varchar("role", { length: 64 }),
  sector: varchar("sector", { length: 64 }).notNull(),
  sector2: varchar("sector2", { length: 64 }),
  signal: integer("signal").notNull(),
  delta: integer("delta").notNull().default(0),
  god: integer("god").notNull(),
  vcpp: integer("vcpp").notNull(),
  checkSize: varchar("check_size", { length: 32 }),
  stage: varchar("stage", { length: 64 }),
  geo: varchar("geo", { length: 64 }),
  recentActivity: varchar("recent_activity", { length: 128 }),
  profileUrl: varchar("profile_url", { length: 256 }),
  isPublic: integer("is_public").default(0).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type Investor = typeof investors.$inferSelect;
export type InsertInvestor = typeof investors.$inferInsert;

export const pipelineFeedback = pgTable("pythh_pipeline_feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  runId: varchar("run_id", { length: 64 }).notNull(),
  rating: varchar("rating", { length: 8 }).notNull(),
  reason: varchar("reason", { length: 64 }),
  comment: varchar("comment", { length: 500 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type PipelineFeedback = typeof pipelineFeedback.$inferSelect;
export type InsertPipelineFeedback = typeof pipelineFeedback.$inferInsert;

export const pitchDecks = pgTable("pythh_pitch_decks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  runId: varchar("run_id", { length: 64 }).notNull(),
  startupUrl: varchar("startup_url", { length: 512 }),
  sourceType: varchar("source_type", { length: 32 }).notNull().default("generated"),
  fileKey: varchar("file_key", { length: 256 }),
  slidesJson: text("slides_json").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
export type PitchDeck = typeof pitchDecks.$inferSelect;
export type InsertPitchDeck = typeof pitchDecks.$inferInsert;

export const outreachEmails = pgTable("pythh_outreach_emails", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  runId: varchar("run_id", { length: 64 }).notNull(),
  investorName: varchar("investor_name", { length: 128 }).notNull(),
  investorFirm: varchar("investor_firm", { length: 128 }).notNull(),
  toEmail: varchar("to_email", { length: 256 }),
  subject: varchar("subject", { length: 256 }).notNull(),
  body: text("body").notNull(),
  status: varchar("status", { length: 32 }).notNull().default("draft"),
  sentAt: bigint("sent_at", { mode: "number" }),
  resendMessageId: varchar("resend_message_id", { length: 128 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
export type OutreachEmail = typeof outreachEmails.$inferSelect;
export type InsertOutreachEmail = typeof outreachEmails.$inferInsert;

export const pipelineRuns = pgTable("pythh_pipeline_runs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  runId: varchar("run_id", { length: 64 }).notNull().unique(),
  startupUrl: varchar("startup_url", { length: 512 }).notNull(),
  summary: text("summary"),
  matchedInvestorsJson: text("matched_investors_json"),
  status: varchar("status", { length: 32 }).default("completed").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export type PipelineRun = typeof pipelineRuns.$inferSelect;

export const meetings = pgTable("pythh_meetings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  runId: varchar("run_id", { length: 64 }).notNull(),
  outreachEmailId: integer("outreach_email_id"),
  investorName: varchar("investor_name", { length: 128 }).notNull(),
  investorFirm: varchar("investor_firm", { length: 128 }).notNull(),
  proposedTimesJson: text("proposed_times_json"),
  status: varchar("status", { length: 32 }).notNull().default("proposed"),
  confirmedTime: bigint("confirmed_time", { mode: "number" }),
  calendarLink: varchar("calendar_link", { length: 512 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export type Meeting = typeof meetings.$inferSelect;

export const founderProfiles = pgTable("pythh_founder_profiles", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  companyName: varchar("company_name", { length: 256 }),
  companyUrl: varchar("company_url", { length: 512 }),
  stage: varchar("stage", { length: 64 }),
  sector: varchar("sector", { length: 128 }),
  askAmount: varchar("ask_amount", { length: 64 }),
  deckFileKey: varchar("deck_file_key", { length: 256 }),
  bio: text("bio"),
  linkedinUrl: varchar("linkedin_url", { length: 512 }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});

export type FounderProfile = typeof founderProfiles.$inferSelect;
