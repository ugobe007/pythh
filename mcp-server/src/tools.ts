/**
 * tools.ts — All 8 Pythh Connect MCP tool implementations
 *
 * Each tool registration returns a CallToolResult (content array).
 * Tools are structured with:
 *   - Descriptive inputSchema (z.object fields with .describe())
 *   - Auth tier check before data fetch
 *   - data_as_of timestamp on every successful response
 *   - Friendly error messages that guide users toward upgrading
 *
 * Tool list:
 *   1. get_network_status    — live Pythh network stats (all tiers)
 *   2. get_rankings          — top startups by GOD score (all tiers)
 *   3. search_startups       — filter startup database (all tiers)
 *   4. search_investors      — filter investor database (free+)
 *   5. get_market_signals    — sector signal heat map (free+)
 *   6. match_investors       — sector-matched investor list (free+)
 *   7. get_startup_profile   — full GOD breakdown for a startup (pro+)
 *   8. get_investor_profile  — full investor dossier (pro+)
 *   9. score_startup_url     — submit URL to Oracle, get GOD score (pro+)
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  getNetworkStatus, getRankings, searchStartups, searchInvestors,
  getMarketSignals, matchInvestors, getStartupProfile, getInvestorProfile,
} from "./db.js";
import { isToolAllowed, checkAnonRateLimit, AuthorizationError, RateLimitError } from "./auth.js";
import type { AuthContext } from "./auth.js";
import type { Request } from "express";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ok(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function json(data: unknown) {
  return ok(JSON.stringify(data, null, 2));
}

function guardTool(tool: string, auth: AuthContext, req: Request) {
  if (!isToolAllowed(tool, auth.tier)) {
    throw new AuthorizationError(tool, auth.tier);
  }
  if (auth.tier === "anonymous") {
    const { allowed, remaining } = checkAnonRateLimit(req);
    if (!allowed) {
      throw new RateLimitError(
        `Anonymous rate limit reached (${5} calls/hour). ` +
          `Get a free API key at https://pythh.ai/developers for 20 calls/day.`
      );
    }
    void remaining; // could add to response headers in a future version
  }
}

function godTier(score: number): string {
  if (score >= 80) return "Elite";
  if (score >= 60) return "Strong";
  if (score >= 40) return "Solid";
  if (score >= 20) return "Emerging";
  return "Pre-signal";
}

// ─── Tool registration ────────────────────────────────────────────────────────

export function registerAllTools(
  server: McpServer,
  getAuth: (req: Request) => Promise<AuthContext>,
  getReq: () => Request
) {
  // ── 1. get_network_status ─────────────────────────────────────────────────
  server.registerTool(
    "get_network_status",
    {
      title: "Pythh Network Status",
      description:
        "Returns live statistics about the Pythh network: total startups scored, qualified investors, " +
        "active startup-investor matches, and how many startups were updated in the last 24 hours. " +
        "Use this to understand the freshness and scale of the Pythh dataset.",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => {
      const auth = await getAuth(getReq());
      guardTool("get_network_status", auth, getReq());
      const status = await getNetworkStatus();
      return json({
        pythh_connect: {
          message: "Pythh network is live. Data updates continuously from daily scraping runs.",
          ...status,
        },
      });
    }
  );

  // ── 2. get_rankings ───────────────────────────────────────────────────────
  server.registerTool(
    "get_rankings",
    {
      title: "Startup Rankings",
      description:
        "Returns the top startups ranked by GOD score — Pythh's 0–100 composite across Team, Traction, " +
        "Market, Product, Vision, Grit, and Momentum. Optionally filter by sector. " +
        "Use this to discover which startups are gaining the strongest signals right now.",
      inputSchema: {
        sector: z.string().optional().describe(
          "Filter by sector (e.g. 'Fintech', 'AI/ML', 'SaaS', 'HealthTech', 'Climate')"
        ),
        limit: z.number().min(1).max(50).optional().describe("Number of results (default 20, max 50)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ sector, limit }) => {
      const auth = await getAuth(getReq());
      guardTool("get_rankings", auth, getReq());
      const result = await getRankings({ sector, limit });
      const rows = result.startups.map((s) => ({
        rank: s.rank,
        name: s.name,
        god_score: s.god_score,
        tier: godTier(s.god_score),
        sectors: s.sectors,
        stage: s.stage,
        website: s.website,
        data_as_of: s.data_as_of,
      }));
      return json({
        total_qualified_startups: result.total,
        sector_filter: result.sector_filter,
        showing: rows.length,
        rankings: rows,
        data_as_of: result.data_as_of,
        note: "Scores update daily as new signals are scraped. Upgrade to Pro to access full GOD dimension breakdowns.",
      });
    }
  );

  // ── 3. search_startups ────────────────────────────────────────────────────
  server.registerTool(
    "search_startups",
    {
      title: "Search Startups",
      description:
        "Search Pythh's database of 33,000+ startups. Filter by sector, stage, GOD score range, or name. " +
        "Only returns startups that have passed the entity resolution gate (qualified). " +
        "Returns name, sectors, stage, GOD score, and website for each result.",
      inputSchema: {
        name: z.string().optional().describe("Partial startup name to search for"),
        sector: z.string().optional().describe(
          "Sector to filter by (e.g. 'Fintech', 'AI/ML', 'SaaS', 'Developer Tools', 'HealthTech')"
        ),
        stage: z.string().optional().describe(
          "Funding stage (e.g. 'pre-seed', 'seed', 'series-a', 'series-b')"
        ),
        min_god_score: z.number().min(0).max(100).optional().describe(
          "Minimum GOD score (0–100). Use 60+ for investment-grade, 80+ for elite."
        ),
        max_god_score: z.number().min(0).max(100).optional().describe("Maximum GOD score"),
        limit: z.number().min(1).max(50).optional().describe("Number of results (default 10, max 50)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ name, sector, stage, min_god_score, max_god_score, limit }) => {
      const auth = await getAuth(getReq());
      guardTool("search_startups", auth, getReq());
      const results = await searchStartups({ name, sector, stage, min_god_score, max_god_score, limit });
      return json({
        count: results.length,
        startups: results.map((s) => ({
          name: s.name,
          sectors: s.sectors,
          stage: s.stage,
          god_score: s.god_score,
          tier: godTier(s.god_score),
          website: s.website,
          data_as_of: s.data_as_of,
        })),
        tip: "Use get_startup_profile (Pro) to see the full GOD dimension breakdown for any startup.",
      });
    }
  );

  // ── 4. search_investors ───────────────────────────────────────────────────
  server.registerTool(
    "search_investors",
    {
      title: "Search Investors",
      description:
        "Search Pythh's database of 6,250+ investors. Filter by sector thesis, minimum GOD score, or name/firm. " +
        "Only returns investors that have passed the entity resolution gate (qualified). " +
        "Returns name, firm, sectors, GOD score, and website.",
      inputSchema: {
        name: z.string().optional().describe("Investor name (partial match)"),
        firm: z.string().optional().describe("VC firm name (partial match, e.g. 'Sequoia', 'a16z')"),
        sector: z.string().optional().describe("Sector thesis filter (e.g. 'Fintech', 'AI/ML')"),
        min_score: z.number().min(0).max(100).optional().describe(
          "Minimum investor GOD score (default 30; use 70+ for top-tier)"
        ),
        limit: z.number().min(1).max(50).optional().describe("Number of results (default 10, max 50)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ name, firm, sector, min_score, limit }) => {
      const auth = await getAuth(getReq());
      guardTool("search_investors", auth, getReq());
      const results = await searchInvestors({ name, firm, sector, min_score, limit });
      return json({
        count: results.length,
        investors: results.map((inv) => ({
          name: inv.name,
          firm: inv.firm,
          sectors: inv.sectors,
          investor_score: inv.investor_score,
          tier: godTier(inv.investor_score),
          website: inv.website,
          data_as_of: inv.data_as_of,
        })),
        tip: "Use get_investor_profile (Pro) for stage preference, check size, and portfolio details.",
      });
    }
  );

  // ── 5. get_market_signals ─────────────────────────────────────────────────
  server.registerTool(
    "get_market_signals",
    {
      title: "Market Signals",
      description:
        "Returns Pythh's live sector signal heat map: which sectors have the most investment-grade startups, " +
        "average GOD scores by sector, and the top momentum startups. Updated daily from scraped data. " +
        "Use this to understand where deal flow is concentrating right now.",
      inputSchema: {
        sector: z.string().optional().describe("Focus on a specific sector (optional)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ sector }) => {
      const auth = await getAuth(getReq());
      guardTool("get_market_signals", auth, getReq());
      const signals = await getMarketSignals({ sector });
      return json({
        top_sectors: signals.top_sectors,
        high_momentum_startups: signals.high_momentum_startups.map((s) => ({
          name: s.name,
          god_score: s.god_score,
          tier: godTier(s.god_score),
          sectors: s.sectors,
          stage: s.stage,
          website: s.website,
        })),
        network_last_updated: signals.network_last_updated,
        data_as_of: signals.data_as_of,
      });
    }
  );

  // ── 6. match_investors ────────────────────────────────────────────────────
  server.registerTool(
    "match_investors",
    {
      title: "Match Investors to Sector",
      description:
        "Returns investors best matched to a specific sector, ranked by thesis fit and investor GOD score. " +
        "Fit is classified as 'strong' (direct sector match) or 'adjacent' (related sector). " +
        "Use this to build a targeted investor list for a startup's fundraise.",
      inputSchema: {
        sector: z.string().describe(
          "Primary sector of the startup (e.g. 'Fintech', 'AI/ML', 'SaaS', 'HealthTech', 'Climate')"
        ),
        stage: z.string().optional().describe(
          "Funding stage of the startup (e.g. 'seed', 'series-a')"
        ),
        min_investor_score: z.number().min(0).max(100).optional().describe(
          "Minimum investor GOD score (default 50)"
        ),
        limit: z.number().min(1).max(50).optional().describe("Number of matches (default 15, max 50)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ sector, stage, min_investor_score, limit }) => {
      const auth = await getAuth(getReq());
      guardTool("match_investors", auth, getReq());
      const matches = await matchInvestors({ sector, stage, min_investor_score, limit });
      return json({
        sector,
        stage: stage ?? "any",
        matches: matches.map((m) => ({
          name: m.name,
          firm: m.firm,
          sectors: m.sectors,
          investor_score: m.investor_score,
          tier: godTier(m.investor_score),
          sector_fit: m.sector_fit,
          website: m.website,
          data_as_of: m.data_as_of,
        })),
        total_matches: matches.length,
        tip: "Use score_startup_url (Pro) to get a startup-specific match with personalized investor ranking.",
      });
    }
  );

  // ── 7. get_startup_profile (Pro+) ─────────────────────────────────────────
  server.registerTool(
    "get_startup_profile",
    {
      title: "Startup Full Profile",
      description:
        "Returns the complete GOD score breakdown for a startup: all 7 dimensions (Team, Traction, Market, " +
        "Product, Vision, Grit, Momentum), composite score, sector tags, stage, and data freshness. " +
        "Requires a Pro API key. Get yours at https://pythh.ai/developers",
      inputSchema: {
        startup_id: z.string().optional().describe("Pythh startup ID (from search_startups results)"),
        name: z.string().optional().describe("Startup name to look up (partial match)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ startup_id, name }) => {
      const auth = await getAuth(getReq());
      guardTool("get_startup_profile", auth, getReq());

      let id = startup_id;
      if (!id && name) {
        const results = await searchStartups({ name, limit: 1 });
        id = results[0]?.id;
      }
      if (!id) return ok("No startup found. Try search_startups first to get a startup ID.");

      const profile = await getStartupProfile(id);
      if (!profile) return ok(`Startup with ID "${id}" not found in the Pythh database.`);

      const dimensions = auth.includeBreakdown
        ? {
            god_team: profile.god_team,
            god_traction: profile.god_traction,
            god_market: profile.god_market,
            god_product: profile.god_product,
            god_vision: profile.god_vision,
            god_grit: profile.god_grit,
            god_momentum: profile.god_momentum,
          }
        : {
            note: "GOD dimension breakdown requires a Pro API key. Upgrade at https://pythh.ai/developers",
          };

      return json({
        name: profile.name,
        god_score: profile.god_score,
        tier: godTier(profile.god_score),
        sectors: profile.sectors,
        stage: profile.stage,
        website: profile.website,
        dimensions,
        match_status: profile.match_gen_status,
        data_as_of: profile.data_as_of,
      });
    }
  );

  // ── 8. get_investor_profile (Pro+) ────────────────────────────────────────
  server.registerTool(
    "get_investor_profile",
    {
      title: "Investor Full Profile",
      description:
        "Returns the complete investor dossier: GOD score, sector thesis, stage preference, check size range, " +
        "portfolio count, and website. Use after match_investors to deep-dive on a specific investor. " +
        "Requires a Pro API key.",
      inputSchema: {
        investor_id: z.string().optional().describe("Pythh investor ID (from search_investors or match_investors)"),
        name: z.string().optional().describe("Investor name (partial match)"),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ investor_id, name }) => {
      const auth = await getAuth(getReq());
      guardTool("get_investor_profile", auth, getReq());
      const profile = await getInvestorProfile({ id: investor_id, name });
      if (!profile) return ok("Investor not found. Try search_investors first.");
      return json({
        name: profile.name,
        firm: profile.firm,
        investor_score: profile.investor_score,
        tier: godTier(profile.investor_score),
        sectors: profile.sectors,
        stage_preference: profile.stage_preference,
        check_size: profile.check_size_min && profile.check_size_max
          ? `$${(profile.check_size_min / 1000).toFixed(0)}K – $${(profile.check_size_max / 1e6).toFixed(1)}M`
          : null,
        portfolio_count: profile.portfolio_count,
        website: profile.website ?? profile.url,
        data_as_of: profile.data_as_of,
      });
    }
  );

  // ── 9. score_startup_url (Pro+) ───────────────────────────────────────────
  server.registerTool(
    "score_startup_url",
    {
      title: "Score Startup URL (Oracle)",
      description:
        "Submit a startup's website URL to PYTHIA Oracle for instant analysis. " +
        "The Oracle extracts 40+ behavioral and structural signals, computes the GOD score across 7 dimensions, " +
        "and returns matched investors ranked by thesis fit. Takes 10–30 seconds. " +
        "Requires a Pro API key.",
      inputSchema: {
        url: z.string().url().describe("The startup's website URL (e.g. https://acme.com)"),
        email: z.string().email().optional().describe("Contact email for the analysis report"),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ url, email }) => {
      const auth = await getAuth(getReq());
      guardTool("score_startup_url", auth, getReq());

      const apiBase = process.env.PYTHH_API_URL ?? "https://hot-honey.fly.dev";
      const response = await fetch(`${apiBase}/api/instant/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, email: email ?? "mcp@pythh.ai" }),
        signal: AbortSignal.timeout(60_000),
      });

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        return ok(`Oracle analysis failed (${response.status}): ${text.slice(0, 200)}`);
      }

      const result = await response.json() as Record<string, unknown>;
      const startup = result.startup as Record<string, unknown> | undefined;
      const matches = result.matches as unknown[] | undefined;

      const godScore = Number(result.god_score ?? startup?.total_god_score ?? 0);

      return json({
        url,
        startup_name: String(startup?.name ?? result.startup_name ?? ""),
        god_score: godScore,
        tier: godTier(godScore),
        sectors: startup?.sectors ?? [],
        stage: startup?.stage ?? null,
        top_investor_matches: Array.isArray(matches) ? matches.slice(0, 5).map((m: unknown) => {
          const match = m as Record<string, unknown>;
          return {
            investor: match.name ?? match.investor_name,
            firm: match.firm,
            match_score: match.match_score ?? match.score,
            sector_fit: match.sector_fit,
          };
        }) : [],
        gen_status: result.gen_status ?? result.match_gen_status ?? "complete",
        data_as_of: new Date().toISOString(),
        note: "For full GOD dimension breakdown, call get_startup_profile with the startup name.",
      });
    }
  );
}
