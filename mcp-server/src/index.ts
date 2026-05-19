/**
 * Pythh Connect MCP Server — index.ts
 *
 * Transport: StreamableHTTP (stateless, one transport per request).
 * Endpoint:  POST /mcp  — MCP JSON-RPC
 *            GET  /     — health check + server info
 *            GET  /tools — human-readable tool catalog (for /developers page)
 *
 * Auth: Bearer token in Authorization header (API key).
 *       Anonymous access allowed with rate limiting.
 *
 * Deploy: fly deploy --config fly.mcp.toml → mcp.pythh.ai
 */

import "dotenv/config";
import express, { type Request, type Response } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerAllTools } from "./tools.js";
import { resolveAuth, RateLimitError, AuthorizationError } from "./auth.js";
import type { AuthContext } from "./auth.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";

const PORT = parseInt(process.env.PORT ?? "8080", 10);
const SERVER_NAME = process.env.MCP_SERVER_NAME ?? "pythh-connect";
const SERVER_VERSION = process.env.MCP_SERVER_VERSION ?? "1.0.0";

// ─── Per-request auth context ─────────────────────────────────────────────────
// We pass auth resolution into tools via closure so each request resolves once.

let _currentReq: Request | null = null;
let _currentAuth: AuthContext | null = null;

async function getAuth(req: Request): Promise<AuthContext> {
  if (!_currentAuth || _currentReq !== req) {
    _currentReq = req;
    _currentAuth = await resolveAuth(req);
  }
  return _currentAuth;
}

function getReq(): Request {
  if (!_currentReq) throw new Error("No active request context");
  return _currentReq;
}

// ─── Express app ──────────────────────────────────────────────────────────────

const app = express();

app.use(express.json({ limit: "2mb" }));

// CORS — allow all origins (MCP clients vary widely)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get("/", (_req: Request, res: Response) => {
  res.json({
    service: "Pythh Connect MCP",
    version: SERVER_VERSION,
    status: "live",
    mcp_endpoint: "/mcp",
    docs: "https://pythh.ai/developers",
    tools: 9,
    tiers: ["anonymous (5/hr)", "free (20/day)", "pro (unlimited)", "enterprise (unlimited)"],
    get_key: "https://pythh.ai/developers",
    icon: "https://pythh.ai/icons/pythh-connect.svg",
  });
});

// Human-readable tool catalog for embedding in /developers page
app.get("/tools", (_req: Request, res: Response) => {
  res.json({
    tools: [
      {
        name: "get_network_status",
        tier: "anonymous",
        description: "Live Pythh network stats: startups scored, investors qualified, active matches",
      },
      {
        name: "get_rankings",
        tier: "anonymous",
        description: "Top startups by GOD score, optionally filtered by sector",
      },
      {
        name: "search_startups",
        tier: "anonymous",
        description: "Search 33,000+ startups by name, sector, stage, or GOD score range",
      },
      {
        name: "search_investors",
        tier: "free",
        description: "Search 6,250+ investors by name, firm, sector thesis, or GOD score",
      },
      {
        name: "get_market_signals",
        tier: "free",
        description: "Sector signal heat map: top sectors by startup count and average GOD score",
      },
      {
        name: "match_investors",
        tier: "free",
        description: "Investors ranked by sector thesis fit for a specific startup domain",
      },
      {
        name: "get_startup_profile",
        tier: "pro",
        description: "Full GOD breakdown (7 dimensions) for a specific startup",
      },
      {
        name: "get_investor_profile",
        tier: "pro",
        description: "Full investor dossier: stage preference, check size, portfolio count",
      },
      {
        name: "score_startup_url",
        tier: "pro",
        description: "Submit a URL to PYTHIA Oracle — returns GOD score + matched investors in ~20s",
      },
    ],
  });
});

// ─── MCP endpoint (stateless StreamableHTTP) ──────────────────────────────────

/**
 * Each POST /mcp creates a fresh McpServer + StreamableHTTPServerTransport.
 * This is the stateless model — no session management needed, scales
 * horizontally across Fly.io instances without shared state.
 */
app.post("/mcp", async (req: Request, res: Response) => {
  _currentReq = req;
  _currentAuth = null;

  // Pre-resolve auth so it's available to all tools in this request
  try {
    _currentAuth = await resolveAuth(req);
  } catch (err) {
    if (err instanceof RateLimitError) {
      res.status(429).json({ error: err.message });
      return;
    }
    // Auth errors other than rate limit: fall through as anonymous
    _currentAuth = { tier: "anonymous", keyRecord: null, includeBreakdown: false };
  }

  const mcpServer = new McpServer(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      icons: [{ src: "https://pythh.ai/icons/pythh-connect.svg", sizes: ["512x512"], mimeType: "image/svg+xml" }],
      websiteUrl: "https://pythh.ai/developers",
    },
    { capabilities: { logging: {} } }
  );

  registerAllTools(mcpServer, getAuth, getReq);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless — no session tracking
    enableJsonResponse: false,      // use SSE streaming for tool calls
  });

  try {
    await mcpServer.connect(transport);

    const body = req.body;

    // Validate that this is a proper MCP initialize request or subsequent message
    if (isInitializeRequest(body)) {
      await transport.handleRequest(req, res, body);
    } else {
      await transport.handleRequest(req, res, body);
    }
  } catch (err) {
    if (err instanceof AuthorizationError) {
      if (!res.headersSent) {
        res.status(403).json({ error: err.message });
      }
      return;
    }
    if (err instanceof RateLimitError) {
      if (!res.headersSent) {
        res.status(429).json({ error: err.message });
      }
      return;
    }
    console.error("[MCP] Unhandled error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  } finally {
    await mcpServer.close().catch(() => {});
  }
});

// Handle GET for SSE-based clients (some MCP clients prefer GET /mcp for streaming)
app.get("/mcp", async (req: Request, res: Response) => {
  _currentReq = req;
  _currentAuth = null;

  try {
    _currentAuth = await resolveAuth(req);
  } catch {
    _currentAuth = { tier: "anonymous", keyRecord: null, includeBreakdown: false };
  }

  const mcpServer = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { logging: {} } }
  );

  registerAllTools(mcpServer, getAuth, getReq);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: false,
  });

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res);
  } finally {
    await mcpServer.close().catch(() => {});
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║          Pythh Connect MCP Server v${SERVER_VERSION}          ║
╠═══════════════════════════════════════════════════════╣
║  Endpoint:  http://localhost:${PORT}/mcp               ║
║  Health:    http://localhost:${PORT}/                  ║
║  Tools:     http://localhost:${PORT}/tools             ║
║  Docs:      https://pythh.ai/developers               ║
╚═══════════════════════════════════════════════════════╝
`);
});
