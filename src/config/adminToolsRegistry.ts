/**
 * Central registry of admin tools — former build had ~25 panels; most pages still exist
 * but were dropped from the dashboard nav during the Jan 2026 cleanup.
 */

export type AdminToolCategory =
  | "scoring"
  | "matching"
  | "data"
  | "pipeline"
  | "outreach"
  | "system";

export type AdminToolPriority = "vital" | "important" | "routine";

export interface AdminTool {
  id: string;
  label: string;
  description: string;
  route: string;
  category: AdminToolCategory;
  priority: AdminToolPriority;
}

export const ADMIN_TOOL_CATEGORIES: { id: AdminToolCategory; label: string }[] = [
  { id: "scoring", label: "Scoring & Weights" },
  { id: "matching", label: "Matching Logic" },
  { id: "data", label: "Data Management" },
  { id: "pipeline", label: "Pipeline & Scrapers" },
  { id: "outreach", label: "Outreach" },
  { id: "system", label: "System & Diagnostics" },
];

/** User-requested core tools first, then the rest of the former console. */
export const ADMIN_TOOLS: AdminTool[] = [
  // ── Scoring (GOD + Signal + ML) ──
  {
    id: "god-settings",
    label: "GOD Weights",
    description: "Adjust GOD algorithm component weights, preview impact, apply ML recs",
    route: "/admin/god-settings",
    category: "scoring",
    priority: "vital",
  },
  {
    id: "god-manager",
    label: "GOD Score Manager",
    description: "Score distribution, weight versions, runtime freeze guard",
    route: "/admin/god-manager",
    category: "scoring",
    priority: "vital",
  },
  {
    id: "god-scores",
    label: "GOD Scores Live",
    description: "Live score monitor, bias detection, component breakdown",
    route: "/admin/god-scores",
    category: "scoring",
    priority: "important",
  },
  {
    id: "signal-weights",
    label: "Signal Weights",
    description: "Edit dimension caps, class weights, news source weights, feed priority",
    route: "/admin/signal-weights",
    category: "scoring",
    priority: "vital",
  },
  {
    id: "signals",
    label: "Signal Scores",
    description: "5-dimension signal dashboard — founder language, news, capital, execution",
    route: "/admin/signals",
    category: "scoring",
    priority: "vital",
  },
  {
    id: "industry-rankings",
    label: "Industry Rankings",
    description: "Sector-level GOD rankings and benchmarks",
    route: "/admin/industry-rankings",
    category: "scoring",
    priority: "routine",
  },
  {
    id: "ml-dashboard",
    label: "ML Agent",
    description: "ML recommendations, training runs, weight proposals",
    route: "/admin/ml-dashboard",
    category: "scoring",
    priority: "important",
  },
  {
    id: "benchmarks",
    label: "Startup Benchmarks",
    description: "Benchmark score distributions by sector and percentile",
    route: "/admin/benchmarks",
    category: "scoring",
    priority: "routine",
  },

  // ── Matching ──
  {
    id: "matching",
    label: "Matching Engine",
    description: "Match queue, quality distribution, regenerate controls",
    route: "/admin/matching",
    category: "matching",
    priority: "vital",
  },
  {
    id: "tier-matching",
    label: "Tier Matching Logic",
    description: "VC tier bonuses, sector weights, tier-adjusted fit scores",
    route: "/admin/tier-matching",
    category: "matching",
    priority: "important",
  },
  {
    id: "signal-feed",
    label: "Signal Feed",
    description: "Live signal events and match triggers",
    route: "/admin/signal-feed",
    category: "matching",
    priority: "routine",
  },

  // ── Data ──
  {
    id: "review-queue",
    label: "Review Queue",
    description: "Approve, reject, or adjust pending startups",
    route: "/admin/review-queue",
    category: "data",
    priority: "vital",
  },
  {
    id: "edit-startups",
    label: "Edit Startups",
    description: "Browse and edit approved startup records",
    route: "/admin/edit-startups",
    category: "data",
    priority: "important",
  },
  {
    id: "junk-startups",
    label: "Junk Startup Cleanup",
    description: "Scan headline fragments and test names — bulk reject or delete junk rows",
    route: "/admin/junk-startups",
    category: "data",
    priority: "important",
  },
  {
    id: "discovered-startups",
    label: "RSS Discoveries",
    description: "Startups found via RSS and scrapers",
    route: "/admin/discovered-startups",
    category: "data",
    priority: "important",
  },
  {
    id: "discovered-investors",
    label: "Investors",
    description: "Investor database — firms, thesis, contact signals",
    route: "/admin/discovered-investors",
    category: "data",
    priority: "important",
  },
  {
    id: "investor-enrichment",
    label: "Investor Enrichment",
    description: "Bulk enrich investor partners, thesis, portfolio",
    route: "/admin/investor-enrichment",
    category: "data",
    priority: "routine",
  },
  {
    id: "bulk-upload",
    label: "Bulk Upload",
    description: "Import startups or investors from CSV",
    route: "/admin/bulk-upload",
    category: "data",
    priority: "routine",
  },
  {
    id: "portfolio",
    label: "Virtual Portfolio",
    description: "Admin portfolio picks and signal refresh",
    route: "/admin/portfolio",
    category: "data",
    priority: "routine",
  },
  {
    id: "lp-targets",
    label: "LP Targets",
    description: "LP fundraising target list",
    route: "/admin/lp-targets",
    category: "data",
    priority: "routine",
  },

  // ── Pipeline & scrapers ──
  {
    id: "scrapers",
    label: "Scraper Management",
    description: "Run, schedule, and configure data scrapers",
    route: "/admin/scrapers",
    category: "pipeline",
    priority: "vital",
  },
  {
    id: "rss-manager",
    label: "RSS Manager",
    description: "RSS feed sources — activate, deactivate, health",
    route: "/admin/rss-manager",
    category: "pipeline",
    priority: "important",
  },
  {
    id: "ai-intelligence",
    label: "AI Intelligence / Pipeline",
    description: "Pipeline monitor, enrichment status, intelligence feeds",
    route: "/admin/ai-intelligence",
    category: "pipeline",
    priority: "important",
  },
  {
    id: "agent",
    label: "AI Agent Dashboard",
    description: "Watchdog, daily reports, agent activity logs",
    route: "/admin/agent",
    category: "pipeline",
    priority: "important",
  },
  {
    id: "actions",
    label: "Bulk Actions",
    description: "Batch GOD recalc, match regen, queue operations",
    route: "/admin/actions",
    category: "pipeline",
    priority: "routine",
  },

  // ── Outreach ──
  {
    id: "outreach",
    label: "Outreach (Peter)",
    description: "VC draft review, regenerate, bulk send via Resend",
    route: "/admin/outreach",
    category: "outreach",
    priority: "important",
  },
  {
    id: "analytics",
    label: "Platform Analytics",
    description: "Signups, events, page views — last 30 days",
    route: "/admin/analytics",
    category: "outreach",
    priority: "routine",
  },
  {
    id: "metrics",
    label: "Conversion Metrics",
    description: "Upgrade funnel, email loop, daily breakdown",
    route: "/admin/metrics",
    category: "outreach",
    priority: "routine",
  },

  {
    id: "tools-hub",
    label: "All Tools",
    description: "Full admin console — every panel from the former build",
    route: "/admin/tools",
    category: "system",
    priority: "vital",
  },

  // ── System ──
  {
    id: "health",
    label: "System Health",
    description: "DB, API, scoring pipeline health checks",
    route: "/admin/health",
    category: "system",
    priority: "important",
  },
  {
    id: "diagnostic",
    label: "Diagnostic",
    description: "Deep system diagnostic runner",
    route: "/admin/diagnostic",
    category: "system",
    priority: "routine",
  },
  {
    id: "database-check",
    label: "Database Check",
    description: "Schema and row-count verification",
    route: "/admin/database-check",
    category: "system",
    priority: "routine",
  },
  {
    id: "ai-logs",
    label: "AI Logs",
    description: "AI operation and inference logs",
    route: "/admin/ai-logs",
    category: "system",
    priority: "routine",
  },
];

export function toolsByCategory(category: AdminToolCategory): AdminTool[] {
  return ADMIN_TOOLS.filter((t) => t.category === category);
}

export function vitalTools(): AdminTool[] {
  return ADMIN_TOOLS.filter((t) => t.priority === "vital");
}
