/**
 * auth.ts — API key validation and tier enforcement for Pythh Connect MCP
 *
 * Tiers:
 *   anonymous  — no key; 5 calls/hour, read-only tools only (rankings, search)
 *   free       — issued key; 20 calls/day, all search tools, no GOD breakdown
 *   pro        — $149/mo; unlimited calls, all 8 tools, full GOD dimensions
 *   enterprise — $999+/mo; unlimited, all tools, white-label endpoint eligible
 *
 * Rate limiting is in-memory per process with a sliding 24h window.
 * For multi-instance deployments, swap the in-memory map for Redis.
 */

import type { Request } from "express";
import { lookupApiKey, incrementKeyUsage } from "./db.js";
import type { ApiTier, ApiKeyRecord } from "./db.js";

// ─── Tool access matrix ───────────────────────────────────────────────────────

/** Tools accessible without any key (anonymous tier) */
const ANONYMOUS_TOOLS = new Set([
  "get_network_status",
  "get_rankings",
  "search_startups",
  "search_investors",
]);

/** Tools that require at minimum a free key */
const FREE_TOOLS = new Set([
  ...ANONYMOUS_TOOLS,
  "get_market_signals",
  "match_investors",
]);

/** Tools that require a pro/enterprise key */
const PRO_TOOLS = new Set([
  ...FREE_TOOLS,
  "get_startup_profile",
  "get_investor_profile",
  "score_startup_url",
]);

export function isToolAllowed(tool: string, tier: ApiTier | "anonymous"): boolean {
  if (tier === "enterprise" || tier === "pro") return PRO_TOOLS.has(tool);
  if (tier === "free") return FREE_TOOLS.has(tool);
  return ANONYMOUS_TOOLS.has(tool);
}

/** Whether this tier gets full GOD dimension scores (not just the composite) */
export function includeGodBreakdown(tier: ApiTier | "anonymous"): boolean {
  return tier === "pro" || tier === "enterprise";
}

// ─── In-memory rate limiter (anonymous + free tier) ──────────────────────────

const ANONYMOUS_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const ANONYMOUS_LIMIT = 5;

// ip → { count, window_start }
const anonBuckets = new Map<string, { count: number; windowStart: number }>();

function getClientIp(req: Request): string {
  return (
    (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

export function checkAnonRateLimit(req: Request): { allowed: boolean; remaining: number } {
  const ip = getClientIp(req);
  const now = Date.now();
  const bucket = anonBuckets.get(ip);

  if (!bucket || now - bucket.windowStart > ANONYMOUS_WINDOW_MS) {
    anonBuckets.set(ip, { count: 1, windowStart: now });
    return { allowed: true, remaining: ANONYMOUS_LIMIT - 1 };
  }

  if (bucket.count >= ANONYMOUS_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count++;
  return { allowed: true, remaining: ANONYMOUS_LIMIT - bucket.count };
}

// ─── Auth context ─────────────────────────────────────────────────────────────

export interface AuthContext {
  tier: ApiTier | "anonymous";
  keyRecord: ApiKeyRecord | null;
  includeBreakdown: boolean;
}

/**
 * Extracts and validates the API key from the Authorization header.
 * Returns an AuthContext representing the caller's access level.
 *
 * Clients send: Authorization: Bearer pc_live_xxx
 */
export async function resolveAuth(req: Request): Promise<AuthContext> {
  const header = req.headers.authorization ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);

  if (!match) {
    return { tier: "anonymous", keyRecord: null, includeBreakdown: false };
  }

  const rawKey = match[1].trim();
  const record = await lookupApiKey(rawKey);

  if (!record) {
    // Unknown key — treat as anonymous but don't leak details
    return { tier: "anonymous", keyRecord: null, includeBreakdown: false };
  }

  // Daily limit enforcement for free tier (pro/enterprise is unlimited)
  if (record.tier === "free" && record.calls_today >= record.daily_limit) {
    throw new RateLimitError(
      `Daily limit of ${record.daily_limit} calls reached. Upgrade to Pro for unlimited access.`
    );
  }

  // Increment usage counter (fire-and-forget, non-blocking)
  incrementKeyUsage(record.id).catch(() => {});

  return {
    tier: record.tier,
    keyRecord: record,
    includeBreakdown: includeGodBreakdown(record.tier),
  };
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export class AuthorizationError extends Error {
  constructor(tool: string, tier: string) {
    super(
      `Tool "${tool}" requires a ${tier === "anonymous" ? "free API key" : "Pro"} plan. ` +
        `Get your key at https://pythh.ai/developers`
    );
    this.name = "AuthorizationError";
  }
}
