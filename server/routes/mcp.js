/**
 * PYTHH MCP SERVER
 * ================
 * Model Context Protocol server — Streamable HTTP transport
 * Allows AI agents (Claude, Cursor, custom agents) to call Pythh tools directly.
 *
 * Transport:  POST /mcp  (stateless Streamable HTTP)
 * Auth:       Bearer pythh_<base64url-signed-token>
 *
 * Tools exposed:
 *   submit_startup          — Score and match a startup by URL
 *   get_matches             — Top investor matches for a startup
 *   get_match_insights      — Pattern analysis and portfolio fit
 *   get_investor_alignment  — Reflection/tension/direction for an investor pairing
 *   get_founder_profile     — 5-dimension founder profile + copy blocks
 *   get_god_score           — Full 23-criteria GOD score breakdown
 *   get_oracle_insights     — Coaching insights and recommended actions
 *   get_investor_predictions — What sectors/themes investors are funding now
 *   get_live_signals        — Real-time signal activity
 *
 * Resources:
 *   pythh://signals/live
 *   pythh://investors/predictions
 *   pythh://platform/status
 *
 * Prompts:
 *   fundraising_readiness
 *   investor_research
 *   pitch_coaching
 */

'use strict';

const express = require('express');
const crypto  = require('crypto');
const axios   = require('axios');
const { McpServer }                     = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { z }                             = require('zod');
const { getSupabaseClient }             = require('../lib/supabaseClient');

const router = express.Router();

// ============================================================
// AUTH — HMAC Signed API Keys
// ============================================================

const KEY_PREFIX = 'pythh_';

/**
 * Generate a signed MCP API key for a user.
 * Format: pythh_<base64url( userId.timestamp.hmac )>
 */
function generateMcpKey(userId) {
  const secret = process.env.MCP_API_KEY_SECRET;
  if (!secret) throw new Error('MCP_API_KEY_SECRET is not configured');
  const payload = `${userId}.${Date.now()}`;
  const hmac    = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const raw     = `${payload}.${hmac}`;
  return `${KEY_PREFIX}${Buffer.from(raw).toString('base64url')}`;
}

/**
 * Verify a signed MCP API key.
 * Returns userId if valid, null otherwise.
 */
function verifyMcpKey(key) {
  if (!key || !key.startsWith(KEY_PREFIX)) return null;
  const secret = process.env.MCP_API_KEY_SECRET;
  if (!secret) return null;
  try {
    const raw   = Buffer.from(key.slice(KEY_PREFIX.length), 'base64url').toString('utf8');
    const parts = raw.split('.');
    if (parts.length !== 3) return null;
    const [userId, timestamp, providedHmac] = parts;
    if (!userId || !timestamp || !providedHmac) return null;
    const payload      = `${userId}.${timestamp}`;
    const expectedHmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    // Constant-time comparison
    const a = Buffer.from(expectedHmac, 'hex');
    const b = Buffer.from(providedHmac.padEnd(expectedHmac.length, '0'), 'hex');
    if (a.length !== b.length) return null;
    if (!crypto.timingSafeEqual(a, b)) return null;
    return userId;
  } catch {
    return null;
  }
}

/**
 * Auth middleware — extracts and verifies Bearer token.
 * Also allows Supabase JWTs for logged-in founders (backwards compat).
 */
async function mcpAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  // Try Pythh HMAC key first
  if (token.startsWith(KEY_PREFIX)) {
    const userId = verifyMcpKey(token);
    if (!userId) {
      return res.status(401).json({ error: 'Invalid or expired Pythh API key' });
    }
    req.mcpUserId = userId;
    return next();
  }

  // Fall back to Supabase JWT (for founders using their dashboard token)
  try {
    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.mcpUserId = user.id;
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

// ============================================================
// INTERNAL HELPERS — direct Supabase + HTTP to self
// ============================================================

/** Base URL for internal HTTP calls (avoids going out to the internet) */
function internalBase() {
  const port = process.env.PORT || 3002;
  return `http://localhost:${port}`;
}

/** Safe JSON text for MCP tool content */
function toText(data) {
  return { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] };
}

/** Wrap tool call in consistent error handling */
async function safeCall(fn) {
  try {
    return await fn();
  } catch (err) {
    return { content: [{ type: 'text', text: JSON.stringify({ error: err.message }) }], isError: true };
  }
}

// ============================================================
// MCP SERVER FACTORY — new instance per request (stateless)
// ============================================================

function buildMcpServer(userId) {
  const server = new McpServer({
    name:    'Pythh',
    version: '1.0.0',
  });

  const supabase = getSupabaseClient();

  // ----------------------------------------------------------
  // TOOL 1: submit_startup
  // ----------------------------------------------------------
  server.tool(
    'submit_startup',
    'Submit a startup website URL to Pythh. Returns the startup profile, GOD score (0-100), and begins investor match generation. Use this as the first step for any founder analysis.',
    {
      url:           z.string().url().describe('The startup website URL (e.g. https://acme.ai)'),
      force_regen:   z.boolean().optional().describe('Force regeneration of matches even if cached. Defaults to false.'),
    },
    async ({ url, force_regen }) => safeCall(async () => {
      const resp = await axios.post(
        `${internalBase()}/api/instant/submit`,
        { url, session_id: `mcp_${userId}`, force_generate: force_regen || false },
        { timeout: 30000, validateStatus: () => true },
      );
      return toText(resp.data);
    }),
  );

  // ----------------------------------------------------------
  // TOOL 2: get_matches
  // ----------------------------------------------------------
  server.tool(
    'get_matches',
    'Get the top investor matches for a startup. Returns a ranked list of investors with match scores, reasoning, and fit explanations.',
    {
      startup_id: z.string().describe('The startup UUID (from submit_startup or get_god_score)'),
      limit:      z.number().int().min(1).max(50).optional().describe('Number of matches to return. Defaults to 20.'),
      page:       z.number().int().min(1).optional().describe('Page number for pagination. Defaults to 1.'),
    },
    async ({ startup_id, limit = 20, page = 1 }) => safeCall(async () => {
      const { data, error } = await supabase
        .from('startup_investor_matches')
        .select(`
          match_score,
          confidence_level,
          reasoning,
          investors (
            id, name, firm, stage, sectors,
            investment_thesis, check_size_min, check_size_max,
            location, website
          )
        `)
        .eq('startup_id', startup_id)
        .order('match_score', { ascending: false })
        .range((page - 1) * limit, page * limit - 1);

      if (error) throw new Error(error.message);

      const matches = (data || []).map(m => ({
        investor_id:       m.investors?.id,
        investor_name:     m.investors?.name,
        firm:              m.investors?.firm,
        match_score:       m.match_score,
        confidence_level:  m.confidence_level,
        stage:             m.investors?.stage,
        sectors:           m.investors?.sectors,
        check_size_min:    m.investors?.check_size_min,
        check_size_max:    m.investors?.check_size_max,
        location:          m.investors?.location,
        website:           m.investors?.website,
        reasoning:         m.reasoning,
      }));

      return toText({ startup_id, matches, count: matches.length, page, limit });
    }),
  );

  // ----------------------------------------------------------
  // TOOL 3: get_match_insights
  // ----------------------------------------------------------
  server.tool(
    'get_match_insights',
    'Get pattern analysis and portfolio fit insights for a startup\'s investor matches. Returns themes, sector trends, and top-level strategic observations.',
    {
      startup_id: z.string().describe('The startup UUID'),
    },
    async ({ startup_id }) => safeCall(async () => {
      const resp = await axios.get(
        `${internalBase()}/api/matches/startup/${startup_id}/insights`,
        { timeout: 15000, validateStatus: () => true },
      );
      return toText(resp.data);
    }),
  );

  // ----------------------------------------------------------
  // TOOL 4: get_investor_alignment
  // ----------------------------------------------------------
  server.tool(
    'get_investor_alignment',
    'Get the detailed alignment differential between a specific startup and investor. Returns: reflection (how the market reads them), tension (where belief breaks), direction (what changes outcome), and next_proof (what evidence to show).',
    {
      startup_id:  z.string().describe('The startup UUID'),
      investor_id: z.string().describe('The investor UUID (from get_matches)'),
    },
    async ({ startup_id, investor_id }) => safeCall(async () => {
      const resp = await axios.get(
        `${internalBase()}/api/intel/match-deltas`,
        {
          params:         { startup_id, investor_id },
          timeout:        15000,
          validateStatus: () => true,
        },
      );
      return toText(resp.data);
    }),
  );

  // ----------------------------------------------------------
  // TOOL 5: get_founder_profile
  // ----------------------------------------------------------
  server.tool(
    'get_founder_profile',
    'Get the 5-dimension founder intelligence profile for a startup. Returns: narrative_coherence, obsession_density, conviction_evidence_ratio, fragility_index, trajectory_momentum, plus AI-generated copy blocks the founder can use.',
    {
      startup_id: z.string().describe('The startup UUID'),
    },
    async ({ startup_id }) => safeCall(async () => {
      const resp = await axios.get(
        `${internalBase()}/api/intel/founder-profile`,
        {
          params:         { startup_id },
          timeout:        15000,
          validateStatus: () => true,
        },
      );
      return toText(resp.data);
    }),
  );

  // ----------------------------------------------------------
  // TOOL 6: get_god_score
  // ----------------------------------------------------------
  server.tool(
    'get_god_score',
    'Get the full GOD Score breakdown for a startup. The GOD Score (0-100) evaluates 23 VC criteria across team, traction, market, product, and vision. Returns component scores and weight explanations.',
    {
      startup_id:      z.string().describe('The startup UUID'),
      weights_version: z.string().optional().describe('Optional weights version override (uses active version by default)'),
    },
    async ({ startup_id, weights_version }) => safeCall(async () => {
      const { data, error } = await supabase.rpc('get_god_explain', {
        p_startup_id:       startup_id,
        p_weights_version:  weights_version || null,
      });
      if (error) throw new Error(error.message);
      return toText(data);
    }),
  );

  // ----------------------------------------------------------
  // TOOL 7: get_oracle_insights
  // ----------------------------------------------------------
  server.tool(
    'get_oracle_insights',
    'Get coaching insights and recommended actions for a startup. Returns strengths, gaps, next actions, and fundraising readiness signals based on Pythh\'s Oracle intelligence engine.',
    {
      startup_id: z.string().describe('The startup UUID'),
      limit:      z.number().int().min(1).max(20).optional().describe('Max insights to return. Defaults to 10.'),
    },
    async ({ startup_id, limit = 10 }) => safeCall(async () => {
      // Fetch existing oracle insights for this startup
      const { data: insights, error } = await supabase
        .from('oracle_insights')
        .select('id, insight_type, title, content, confidence, severity, category, source, created_at')
        .eq('startup_id', startup_id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw new Error(error.message);

      // Also fetch recommended actions
      const { data: actions } = await supabase
        .from('oracle_actions')
        .select('id, title, category, description, priority, impact_score, effort_estimate, status')
        .eq('startup_id', startup_id)
        .eq('status', 'pending')
        .order('impact_score', { ascending: false })
        .limit(5);

      return toText({
        startup_id,
        insights:         insights || [],
        actions:          actions  || [],
        insight_count:    (insights || []).length,
        action_count:     (actions  || []).length,
        note:             (insights || []).length === 0
          ? 'No oracle insights generated yet. Submit the startup URL first via submit_startup to trigger full analysis.'
          : undefined,
      });
    }),
  );

  // ----------------------------------------------------------
  // TOOL 8: get_investor_predictions
  // ----------------------------------------------------------
  server.tool(
    'get_investor_predictions',
    'Get what sectors and themes investors are actively funding right now. Based on live signal data and investor focus areas. Useful for market timing and pitch positioning.',
    {
      sector: z.string().optional().describe('Filter by sector (e.g. "AI", "SaaS", "FinTech")'),
      theme:  z.string().optional().describe('Filter by theme keyword'),
      limit:  z.number().int().min(1).max(100).optional().describe('Number of predictions to return. Defaults to 20.'),
    },
    async ({ sector, theme, limit = 20 }) => safeCall(async () => {
      const resp = await axios.get(
        `${internalBase()}/api/oracle/investor-predictions`,
        {
          params:         { sector, theme, limit },
          timeout:        15000,
          validateStatus: () => true,
        },
      );
      return toText(resp.data);
    }),
  );

  // ----------------------------------------------------------
  // TOOL 9: get_live_signals
  // ----------------------------------------------------------
  server.tool(
    'get_live_signals',
    'Get real-time signal activity from recent investor-startup matches and market events. Shows who is moving and what signals are trending.',
    {
      limit: z.number().int().min(1).max(50).optional().describe('Number of signals to return. Defaults to 20.'),
    },
    async ({ limit = 20 }) => safeCall(async () => {
      const resp = await axios.get(
        `${internalBase()}/api/live-signals`,
        {
          params:         { limit },
          timeout:        10000,
          validateStatus: () => true,
        },
      );
      return toText(resp.data);
    }),
  );

  // ----------------------------------------------------------
  // RESOURCES
  // ----------------------------------------------------------

  server.resource(
    'pythh://signals/live',
    'Live Signal Feed',
    { mimeType: 'application/json', description: 'Current real-time signal activity from investor-startup matches (refreshed continuously).' },
    async () => {
      try {
        const { data, error } = await supabase
          .from('startup_investor_matches')
          .select(`
            match_score,
            updated_at,
            investors ( name, firm ),
            startup_uploads ( name )
          `)
          .gte('match_score', 80)
          .order('updated_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        return { contents: [{ uri: 'pythh://signals/live', mimeType: 'application/json', text: JSON.stringify(data || []) }] };
      } catch (err) {
        return { contents: [{ uri: 'pythh://signals/live', mimeType: 'application/json', text: JSON.stringify({ error: err.message }) }] };
      }
    },
  );

  server.resource(
    'pythh://investors/predictions',
    'Investor Predictions',
    { mimeType: 'application/json', description: 'Current snapshot of what sectors and themes investors are actively funding, derived from live signals.' },
    async () => {
      try {
        const resp = await axios.get(`${internalBase()}/api/oracle/investor-predictions`, { params: { limit: 50 }, timeout: 10000, validateStatus: () => true });
        return { contents: [{ uri: 'pythh://investors/predictions', mimeType: 'application/json', text: JSON.stringify(resp.data) }] };
      } catch (err) {
        return { contents: [{ uri: 'pythh://investors/predictions', mimeType: 'application/json', text: JSON.stringify({ error: err.message }) }] };
      }
    },
  );

  server.resource(
    'pythh://platform/status',
    'Platform Status',
    { mimeType: 'application/json', description: 'Pythh platform health — active investor count, signal counts, and scoring system status.' },
    async () => {
      try {
        const [investorsResult, signalsResult, godResult] = await Promise.all([
          supabase.from('investors').select('id', { count: 'exact', head: true }),
          supabase.from('pythh_signal_events').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
          supabase.rpc('get_god_runtime'),
        ]);
        return {
          contents: [{
            uri:      'pythh://platform/status',
            mimeType: 'application/json',
            text:     JSON.stringify({
              active_investors:     investorsResult.count || 0,
              signals_last_24h:     signalsResult.count  || 0,
              god_runtime:          godResult.data?.[0]  || null,
              timestamp:            new Date().toISOString(),
            }),
          }],
        };
      } catch (err) {
        return { contents: [{ uri: 'pythh://platform/status', mimeType: 'application/json', text: JSON.stringify({ error: err.message }) }] };
      }
    },
  );

  // ----------------------------------------------------------
  // PROMPTS
  // ----------------------------------------------------------

  server.prompt(
    'fundraising_readiness',
    'End-to-end fundraising readiness workflow: submit startup → score → generate matches → oracle coaching → deliver a full report to the founder.',
    {
      url:        z.string().url().describe('The startup website URL'),
      top_n:      z.number().int().min(1).max(20).optional().describe('How many top investor matches to include. Defaults to 10.'),
    },
    async ({ url, top_n = 10 }) => ({
      messages: [{
        role:    'user',
        content: {
          type: 'text',
          text: `You are a world-class venture analyst using Pythh intelligence. Execute this fundraising readiness analysis for ${url}:

Step 1 — Submit and Score
Call submit_startup with url="${url}". Wait for the result. Extract startup_id.

Step 2 — GOD Score Breakdown
Call get_god_score with the startup_id. Identify the 3 strongest and 3 weakest components.

Step 3 — Investor Matches
Call get_matches with startup_id and limit=${top_n}. Note top matches and confidence levels.

Step 4 — Founder Intelligence
Call get_founder_profile with startup_id. Identify narrative gaps and fragility hotspots.

Step 5 — Oracle Coaching
Call get_oracle_insights with startup_id. Extract the highest-priority action items.

Step 6 — Deliver Report
Synthesize all results into a concise Fundraising Readiness Report with:
- Overall readiness score (GOD score context)
- Top 3 investor matches with why they fit
- 3 things working in the founder's favor
- 3 things to fix before outreach
- Concrete next actions (from oracle)

Be direct, actionable, and use Pythh's exact scores and insights.`,
        },
      }],
    }),
  );

  server.prompt(
    'investor_research',
    'Research which investors are currently active in a specific sector and analyze their alignment with a startup.',
    {
      sector:     z.string().describe('The sector to research (e.g. "AI infrastructure", "FinTech", "HealthTech")'),
      startup_id: z.string().optional().describe('Optional startup UUID to analyze alignment against specific investors'),
    },
    async ({ sector, startup_id }) => ({
      messages: [{
        role:    'user',
        content: {
          type: 'text',
          text: `You are a venture intelligence analyst using Pythh. Research active investors in the "${sector}" sector:

Step 1 — Market Signals
Call get_investor_predictions with sector="${sector}". Note active themes and investment velocity.

Step 2 — Live Signals
Call get_live_signals. Filter for any signals relevant to "${sector}".

${startup_id ? `Step 3 — Alignment Analysis
Call get_matches with startup_id="${startup_id}". Find investors in or adjacent to "${sector}".
For the top 3 matches, call get_investor_alignment with startup_id="${startup_id}" and each investor_id.

Step 4 — Synthesis
Deliver:
- Which investors are most active in "${sector}" right now
- Specific alignment analysis for the top 3 matches
- Recommended outreach order with rationale
- Signals the founder should emphasize for this sector` : `Step 3 — Synthesis
Deliver:
- Which investors are most active in "${sector}" right now
- Key themes and signals driving investment
- What a startup in "${sector}" needs to show to get meetings`}`,
        },
      }],
    }),
  );

  server.prompt(
    'pitch_coaching',
    'Generate a coaching session for a founder: GOD score breakdown + fragility analysis + oracle actions + a prioritized pitch improvement plan.',
    {
      startup_id: z.string().describe('The startup UUID'),
    },
    async ({ startup_id }) => ({
      messages: [{
        role:    'user',
        content: {
          type: 'text',
          text: `You are Pythh Oracle — a direct, insight-driven startup coach. Run a full coaching session for startup ${startup_id}:

Step 1 — Score Diagnosis
Call get_god_score with startup_id="${startup_id}". Identify which of the 23 criteria are dragging the score.

Step 2 — Founder Profile
Call get_founder_profile with startup_id="${startup_id}". Assess narrative coherence, conviction-evidence ratio, and fragility hotspots.

Step 3 — Coaching Insights
Call get_oracle_insights with startup_id="${startup_id}". Extract the top 5 insights sorted by priority.

Step 4 — Coaching Session Output
Deliver a pitch coaching report with:

**Where you are**
- GOD score and what it signals to investors
- Your strongest and weakest dimensions

**What investors see**
- How your narrative reads right now (from founder profile)
- Where belief breaks (fragility hotspots)

**What to do this week**
- Top 3 highest-impact actions (specific, measurable)
- What to say differently in your pitch

**What changes the outcome**
- The single biggest lever to pull before your next investor conversation

Be direct. Use the exact numbers. Do not sugarcoat.`,
        },
      }],
    }),
  );

  return server;
}

// ============================================================
// EXPRESS ROUTE HANDLERS
// ============================================================

/**
 * POST /mcp — Main MCP endpoint (stateless Streamable HTTP)
 * Every request creates a fresh McpServer instance with the authenticated userId in scope.
 */
router.post(
  '/',
  express.json(),
  mcpAuthMiddleware,
  async (req, res) => {
    const server    = buildMcpServer(req.mcpUserId);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on('close', () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('[mcp] Transport error:', err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'MCP transport error', details: err.message });
      }
    }
  },
);

/**
 * GET /mcp — SSE stream endpoint (optional; returns 405 for stateless-only deployments)
 * Included to avoid confusing error messages from MCP clients that probe GET first.
 */
router.get('/', (req, res) => {
  res.status(405).json({
    error:   'Method Not Allowed',
    message: 'This Pythh MCP server runs in stateless mode. Use POST /mcp for all tool calls.',
  });
});

/**
 * DELETE /mcp — Session termination (no-op in stateless mode)
 */
router.delete('/', (req, res) => {
  res.status(200).json({ ok: true, message: 'Stateless mode — no session to terminate.' });
});

// ============================================================
// EXPORTS (used by mcpKeys.js and server-card handler)
// ============================================================

module.exports = router;
module.exports.generateMcpKey = generateMcpKey;
module.exports.verifyMcpKey   = verifyMcpKey;
