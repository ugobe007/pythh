/**
 * Seed script — populates pythh_investors with curated signal records.
 * Run from repo root: npx tsx NEW_pythh_site/seed-investors.mjs
 *
 * Signal fields are stored as integers × 10 (e.g. 86 → 8.6 displayed).
 */
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { investors } from "./schema.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes("supabase.co") || url.includes("pooler.supabase.com")
    ? { rejectUnauthorized: false }
    : undefined,
});
const db = drizzle(pool);

const SEED = [
  // ── AI / ML ──────────────────────────────────────────────────────────────
  { name: "Niko Bonatsos",      role: "Managing Director",  firm: "General Catalyst",       sector: "AI/ML",    sector2: "SaaS",     signal: 86, delta: -2,  god: 79, vcpp: 90, checkSize: "$5–20M",  stage: "Series A/B",  geo: "US",     recentActivity: "New fund deploy",       isPublic: 1 },
  { name: "Sarah Guo",          role: "Founder & GP",       firm: "Conviction Partners",    sector: "AI/ML",    sector2: null,       signal: 73, delta:  4,  god: 67, vcpp: 77, checkSize: "$2–10M",  stage: "Seed/A",      geo: "US",     recentActivity: "Thesis match",          isPublic: 1 },
  { name: "Michael Chen",       role: "General Partner",    firm: "Andreessen Horowitz",    sector: "AI/ML",    sector2: "DeepTech", signal: 77, delta: -1,  god: 71, vcpp: 81, checkSize: "$10–50M", stage: "Series A/B",  geo: "US",     recentActivity: "Portfolio expansion",   isPublic: 1 },
  { name: "Tomasz Tunguz",      role: "General Partner",    firm: "Theory Ventures",        sector: "AI/ML",    sector2: "SaaS",     signal: 75, delta:  5,  god: 69, vcpp: 79, checkSize: "$3–15M",  stage: "Seed/A",      geo: "US",     recentActivity: "Fund cycle: early",     isPublic: 1 },
  { name: "Elad Gil",           role: "Founder",            firm: "Color Capital",          sector: "AI/ML",    sector2: "BioTech",  signal: 71, delta:  1,  god: 65, vcpp: 75, checkSize: "$5–25M",  stage: "Series A/B",  geo: "US",     recentActivity: "Sector pivot",          isPublic: 0 },
  { name: "Jared Friedman",     role: "Partner",            firm: "Y Combinator",           sector: "AI/ML",    sector2: "SaaS",     signal: 82, delta:  3,  god: 76, vcpp: 87, checkSize: "$500K",   stage: "Pre-seed",    geo: "US",     recentActivity: "Batch intake",          isPublic: 0 },
  { name: "Misha Esipov",       role: "CEO & Co-founder",   firm: "Nova Credit",            sector: "AI/ML",    sector2: "FinTech",  signal: 68, delta:  2,  god: 62, vcpp: 72, checkSize: "$2–8M",   stage: "Seed",        geo: "US",     recentActivity: "New LP close",          isPublic: 0 },
  { name: "Lan Xuezhao",        role: "Founding Partner",   firm: "Basis Set Ventures",     sector: "AI/ML",    sector2: null,       signal: 70, delta:  0,  god: 64, vcpp: 74, checkSize: "$1–5M",   stage: "Seed",        geo: "US",     recentActivity: "Active sourcing",       isPublic: 0 },

  // ── SaaS ─────────────────────────────────────────────────────────────────
  { name: "Rebecca Kaden",      role: "Managing Partner",   firm: "Union Square Ventures",  sector: "SaaS",     sector2: "FinTech",  signal: 79, delta: -1,  god: 73, vcpp: 83, checkSize: "$5–20M",  stage: "Series A/B",  geo: "US",     recentActivity: "Portfolio gap",         isPublic: 1 },
  { name: "Jason Lemkin",       role: "Founder & GP",       firm: "SaaStr Fund",            sector: "SaaS",     sector2: null,       signal: 74, delta:  2,  god: 68, vcpp: 78, checkSize: "$1–5M",   stage: "Seed/A",      geo: "US",     recentActivity: "Active sourcing",       isPublic: 1 },
  { name: "David Sacks",        role: "General Partner",    firm: "Craft Ventures",         sector: "SaaS",     sector2: "AI/ML",    signal: 76, delta: -3,  god: 70, vcpp: 80, checkSize: "$5–20M",  stage: "Series A/B",  geo: "US",     recentActivity: "New fund deploy",       isPublic: 0 },
  { name: "Christoph Janz",     role: "Managing Partner",   firm: "Point Nine Capital",     sector: "SaaS",     sector2: null,       signal: 72, delta:  1,  god: 66, vcpp: 76, checkSize: "$500K–3M", stage: "Seed",       geo: "EU",     recentActivity: "Thesis match",          isPublic: 0 },
  { name: "Bessemer Ventures",  role: "Partner",            firm: "Bessemer Venture Partners", sector: "SaaS", sector2: "FinTech",  signal: 80, delta:  2,  god: 74, vcpp: 84, checkSize: "$10–50M", stage: "Series B/C",  geo: "US",     recentActivity: "Fund cycle: growth",    isPublic: 0 },

  // ── FinTech ───────────────────────────────────────────────────────────────
  { name: "Kirsten Green",      role: "Founder & Managing Partner", firm: "Forerunner Ventures", sector: "FinTech", sector2: "SaaS", signal: 79, delta: 3, god: 73, vcpp: 83, checkSize: "$5–20M", stage: "Series A/B", geo: "US", recentActivity: "Fund cycle: early", isPublic: 1 },
  { name: "Angela Strange",     role: "General Partner",    firm: "Andreessen Horowitz",    sector: "FinTech",  sector2: null,       signal: 77, delta:  1,  god: 71, vcpp: 81, checkSize: "$10–50M", stage: "Series A/B",  geo: "US",     recentActivity: "Portfolio expansion",   isPublic: 1 },
  { name: "Hans Morris",        role: "Managing Partner",   firm: "Nyca Partners",          sector: "FinTech",  sector2: null,       signal: 69, delta: -1,  god: 63, vcpp: 73, checkSize: "$3–15M",  stage: "Series A",    geo: "US",     recentActivity: "New LP close",          isPublic: 0 },
  { name: "Nigel Morris",       role: "Co-founder & Partner", firm: "QED Investors",        sector: "FinTech",  sector2: null,       signal: 73, delta:  2,  god: 67, vcpp: 77, checkSize: "$5–25M",  stage: "Series A/B",  geo: "US",     recentActivity: "Thesis match",          isPublic: 0 },
  { name: "Nik Milanovic",      role: "Founder",            firm: "The Fintech Fund",       sector: "FinTech",  sector2: "AI/ML",    signal: 66, delta:  4,  god: 60, vcpp: 70, checkSize: "$250K–1M", stage: "Pre-seed",   geo: "US",     recentActivity: "Active sourcing",       isPublic: 0 },

  // ── DeepTech ──────────────────────────────────────────────────────────────
  { name: "Stephanie Zhan",     role: "Partner",            firm: "Sequoia Capital",        sector: "DeepTech", sector2: "AI/ML",    signal: 74, delta: -2,  god: 68, vcpp: 78, checkSize: "$10–50M", stage: "Series A/B",  geo: "US",     recentActivity: "Sector pivot",          isPublic: 1 },
  { name: "Zavain Dar",         role: "Partner",            firm: "Lux Capital",            sector: "DeepTech", sector2: null,       signal: 71, delta:  0,  god: 65, vcpp: 75, checkSize: "$5–20M",  stage: "Series A",    geo: "US",     recentActivity: "New fund deploy",       isPublic: 0 },
  { name: "Josh Wolfe",         role: "Co-founder & Managing Partner", firm: "Lux Capital", sector: "DeepTech", sector2: "BioTech",  signal: 75, delta:  3,  god: 69, vcpp: 79, checkSize: "$5–25M",  stage: "Series A/B",  geo: "US",     recentActivity: "Portfolio expansion",   isPublic: 0 },
  { name: "Dakin Sloss",        role: "Founding Partner",   firm: "Prime Movers Lab",       sector: "DeepTech", sector2: "SpaceTech", signal: 68, delta: 1, god: 62, vcpp: 72, checkSize: "$3–15M",  stage: "Series A",    geo: "US",     recentActivity: "Thesis match",          isPublic: 0 },

  // ── BioTech ───────────────────────────────────────────────────────────────
  { name: "Jorge Conde",        role: "General Partner",    firm: "Andreessen Horowitz",    sector: "BioTech",  sector2: null,       signal: 72, delta:  2,  god: 66, vcpp: 76, checkSize: "$10–50M", stage: "Series A/B",  geo: "US",     recentActivity: "Fund cycle: early",     isPublic: 1 },
  { name: "Vineeta Singh",      role: "Partner",            firm: "ARCH Venture Partners",  sector: "BioTech",  sector2: "DeepTech", signal: 70, delta: -1,  god: 64, vcpp: 74, checkSize: "$5–25M",  stage: "Series A",    geo: "US",     recentActivity: "Active sourcing",       isPublic: 0 },
  { name: "Polina Marinovitch", role: "Managing Director",  firm: "Pfizer Ventures",        sector: "BioTech",  sector2: null,       signal: 65, delta:  0,  god: 59, vcpp: 69, checkSize: "$5–20M",  stage: "Series A/B",  geo: "US",     recentActivity: "New LP close",          isPublic: 0 },
  { name: "Atlas Venture",      role: "Partner",            firm: "Atlas Venture",          sector: "BioTech",  sector2: null,       signal: 67, delta:  1,  god: 61, vcpp: 71, checkSize: "$5–25M",  stage: "Series A",    geo: "US",     recentActivity: "Portfolio expansion",   isPublic: 0 },

  // ── SpaceTech ─────────────────────────────────────────────────────────────
  { name: "Steve Jurvetson",    role: "Co-founder & Partner", firm: "Future Ventures",      sector: "SpaceTech", sector2: "DeepTech", signal: 73, delta: 2, god: 67, vcpp: 77, checkSize: "$5–25M",  stage: "Series A/B",  geo: "US",     recentActivity: "Thesis match",          isPublic: 1 },
  { name: "Chad Anderson",      role: "Managing Partner",   firm: "Space Capital",          sector: "SpaceTech", sector2: null,       signal: 69, delta: 3, god: 63, vcpp: 73, checkSize: "$2–10M",  stage: "Seed/A",      geo: "US",     recentActivity: "New fund deploy",       isPublic: 0 },
  { name: "Meagan Crawford",    role: "General Partner",    firm: "Space Capital",          sector: "SpaceTech", sector2: "DeepTech", signal: 67, delta: 1, god: 61, vcpp: 71, checkSize: "$1–5M",   stage: "Seed",        geo: "US",     recentActivity: "Active sourcing",       isPublic: 0 },

  // ── Climate ───────────────────────────────────────────────────────────────
  { name: "Abe Yokell",         role: "Co-founder & Managing Partner", firm: "Congruent Ventures", sector: "Climate", sector2: null, signal: 70, delta: 4, god: 64, vcpp: 74, checkSize: "$1–5M", stage: "Seed/A", geo: "US", recentActivity: "Fund cycle: early", isPublic: 1 },
  { name: "Carmichael Roberts", role: "Managing Partner",   firm: "Breakthrough Energy",    sector: "Climate",  sector2: "DeepTech", signal: 74, delta:  2,  god: 68, vcpp: 78, checkSize: "$10–50M", stage: "Series A/B",  geo: "US",     recentActivity: "Portfolio expansion",   isPublic: 0 },
  { name: "Shaun Abrahamson",   role: "Managing Partner",   firm: "Urban.us",               sector: "Climate",  sector2: null,       signal: 65, delta:  1,  god: 59, vcpp: 69, checkSize: "$250K–2M", stage: "Pre-seed",   geo: "US",     recentActivity: "Active sourcing",       isPublic: 0 },
  { name: "Emily Kirsch",       role: "Founder & Managing Partner", firm: "Powerhouse Ventures", sector: "Climate", sector2: null, signal: 63, delta: 3, god: 57, vcpp: 67, checkSize: "$500K–3M", stage: "Seed", geo: "US", recentActivity: "New LP close", isPublic: 0 },

  // ── Consumer ──────────────────────────────────────────────────────────────
  { name: "Hunter Walk",        role: "Co-founder & Partner", firm: "Homebrew",             sector: "Consumer", sector2: "SaaS",     signal: 68, delta: -1,  god: 62, vcpp: 72, checkSize: "$500K–2M", stage: "Seed",       geo: "US",     recentActivity: "Thesis match",          isPublic: 1 },
  { name: "Aileen Lee",         role: "Founder & Managing Partner", firm: "Cowboy Ventures", sector: "Consumer", sector2: null,      signal: 72, delta:  1,  god: 66, vcpp: 76, checkSize: "$1–5M",   stage: "Seed/A",      geo: "US",     recentActivity: "Portfolio gap",         isPublic: 1 },
  { name: "Eurie Kim",          role: "Partner",            firm: "Forerunner Ventures",    sector: "Consumer", sector2: "FinTech",  signal: 70, delta:  2,  god: 64, vcpp: 74, checkSize: "$5–20M",  stage: "Series A/B",  geo: "US",     recentActivity: "Active sourcing",       isPublic: 0 },

  // ── Enterprise ────────────────────────────────────────────────────────────
  { name: "Byron Deeter",       role: "Partner",            firm: "Bessemer Venture Partners", sector: "Enterprise", sector2: "SaaS", signal: 78, delta: 0, god: 72, vcpp: 82, checkSize: "$10–50M", stage: "Series B/C", geo: "US", recentActivity: "Fund cycle: growth", isPublic: 1 },
  { name: "Peter Levine",       role: "General Partner",    firm: "Andreessen Horowitz",    sector: "Enterprise", sector2: null,     signal: 76, delta: -1,  god: 70, vcpp: 80, checkSize: "$10–50M", stage: "Series A/B",  geo: "US",     recentActivity: "Portfolio expansion",   isPublic: 0 },
  { name: "Mamoon Hamid",       role: "Partner",            firm: "Kleiner Perkins",        sector: "Enterprise", sector2: "SaaS",   signal: 77, delta:  2,  god: 71, vcpp: 81, checkSize: "$10–50M", stage: "Series A/B",  geo: "US",     recentActivity: "New fund deploy",       isPublic: 0 },

  // ── Europe / Global ───────────────────────────────────────────────────────
  { name: "Suranga Chandratillake", role: "General Partner", firm: "Balderton Capital",    sector: "AI/ML",    sector2: "SaaS",     signal: 74, delta:  3,  god: 68, vcpp: 78, checkSize: "$5–25M",  stage: "Series A/B",  geo: "EU",     recentActivity: "Thesis match",          isPublic: 1 },
  { name: "Luciana Lixandru",   role: "Partner",            firm: "Sequoia Capital EU",     sector: "SaaS",     sector2: "FinTech",  signal: 72, delta:  1,  god: 66, vcpp: 76, checkSize: "$5–20M",  stage: "Series A/B",  geo: "EU",     recentActivity: "Active sourcing",       isPublic: 0 },
  { name: "Reshma Sohoni",      role: "Co-founder & Partner", firm: "Seedcamp",             sector: "SaaS",     sector2: "AI/ML",    signal: 69, delta:  2,  god: 63, vcpp: 73, checkSize: "$200K–1M", stage: "Pre-seed",   geo: "EU",     recentActivity: "Batch intake",          isPublic: 0 },
  { name: "Peng T. Ong",        role: "Co-founder & Partner", firm: "Monk's Hill Ventures", sector: "AI/ML",   sector2: "SaaS",     signal: 67, delta:  1,  god: 61, vcpp: 71, checkSize: "$1–5M",   stage: "Seed/A",      geo: "SEA",    recentActivity: "New fund deploy",       isPublic: 0 },
  { name: "Karan Mohla",        role: "Partner",            firm: "Chiratae Ventures",      sector: "AI/ML",    sector2: "FinTech",  signal: 65, delta:  2,  god: 59, vcpp: 69, checkSize: "$1–5M",   stage: "Seed/A",      geo: "India",  recentActivity: "Active sourcing",       isPublic: 0 },
];

// Clear existing rows then insert fresh
await db.delete(investors);
await db.insert(investors).values(SEED);

console.log(`✓ Seeded ${SEED.length} investor records`);
await pool.end();
