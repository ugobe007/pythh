/** Admin tools for pythh.ai (site/ production build). */

export type AdminToolCategory = "scoring" | "matching" | "data" | "pipeline" | "outreach" | "system";

export interface AdminTool {
  id: string;
  label: string;
  description: string;
  route: string;
  category: AdminToolCategory;
  vital?: boolean;
}

export const ADMIN_TOOL_CATEGORIES: { id: AdminToolCategory; label: string }[] = [
  { id: "scoring", label: "Scoring & Weights" },
  { id: "matching", label: "Matching Logic" },
  { id: "data", label: "Data & Discovery" },
  { id: "pipeline", label: "Pipeline & Scrapers" },
  { id: "outreach", label: "Outreach" },
  { id: "system", label: "System" },
];

export const ADMIN_TOOLS: AdminTool[] = [
  { id: "god", label: "GOD Score Manager", description: "Distribution, freeze guard, weight history", route: "/admin/god", category: "scoring", vital: true },
  { id: "god-weights", label: "GOD Weights", description: "Adjust GOD algorithm component weights", route: "/admin/god/weights", category: "scoring", vital: true },
  { id: "signals", label: "Signal Scores", description: "5-dimension signal dashboard", route: "/admin/signals", category: "scoring", vital: true },
  { id: "signal-weights", label: "Signal Weights", description: "Dimension caps, class weights, feed priority", route: "/admin/signal-weights", category: "scoring", vital: true },
  { id: "ml", label: "ML Agent", description: "Training runs and weight proposals", route: "/admin/ml", category: "scoring" },
  { id: "matching", label: "Matching Engine", description: "Match queue stats and regeneration", route: "/admin/matching", category: "matching", vital: true },
  { id: "scrapers", label: "Scraper Management", description: "Run and monitor data scrapers", route: "/admin/scrapers", category: "pipeline", vital: true },
  { id: "rss", label: "RSS Manager", description: "Feed sources — activate, health, refresh", route: "/admin/rss", category: "pipeline" },
  { id: "junk-startups", label: "Junk Startup Cleanup", description: "Scan headline fragments and test names — bulk reject or delete", route: "/admin/junk-startups", category: "data", vital: true },
  { id: "explore", label: "Startups", description: "Browse startup database", route: "/explore", category: "data" },
  { id: "investors", label: "Investors", description: "Investor intelligence table", route: "/investors", category: "data" },
  { id: "rankings", label: "Rankings", description: "VC lens signal rankings", route: "/rankings", category: "data" },
  { id: "matches", label: "Matches", description: "Public matches surface", route: "/matches", category: "matching" },
  { id: "outreach", label: "Outreach (Peter)", description: "VC draft review and bulk send", route: "/admin/outreach", category: "outreach" },
  { id: "analytics", label: "Platform Analytics", description: "Signups, events, page views", route: "/admin/analytics", category: "outreach" },
  { id: "calendar", label: "Meeting Pipeline", description: "Calendar and meeting flow", route: "/admin/calendar", category: "outreach" },
  { id: "tools", label: "All Tools", description: "Full admin console index", route: "/admin/tools", category: "system", vital: true },
  { id: "dashboard", label: "Dashboard", description: "Platform stats and users", route: "/admin", category: "system" },
];
