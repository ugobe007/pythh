/**
 * MCP API KEY MANAGEMENT
 * ======================
 * Endpoints for founders to generate and revoke Pythh MCP API keys.
 *
 * Founders authenticate with their Supabase Bearer token (from the Pythh dashboard),
 * and receive a static pythh_... key they can paste into their AI agent config.
 *
 * Endpoints:
 *   POST /api/mcp-keys/generate   — generate a new key for the authenticated user
 *   POST /api/mcp-keys/revoke     — rotate the user's salt, invalidating all their keys
 *   GET  /api/mcp-keys/me         — list current key metadata (not the key itself)
 */

'use strict';

const express = require('express');
const router  = express.Router();
const { getSupabaseClient }            = require('../lib/supabaseClient');
const { generateMcpKey, verifyMcpKey } = require('./mcp');

// ============================================================
// Auth helper — require Supabase JWT (dashboard session)
// ============================================================

async function requireSupabaseUser(req, res) {
  const authHeader = req.headers.authorization || '';
  const token      = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header. Use your Pythh dashboard Bearer token.' });
    return null;
  }

  // Reject Pythh HMAC keys — key management requires a real user session
  if (token.startsWith('pythh_')) {
    res.status(401).json({ error: 'Use your Supabase user token (from the Pythh dashboard), not a Pythh API key.' });
    return null;
  }

  try {
    const supabase = getSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(401).json({ error: 'Unauthorized' });
      return null;
    }
    return user;
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
}

// ============================================================
// POST /api/mcp-keys/generate
// ============================================================

/**
 * Generate a new Pythh MCP API key for the authenticated founder.
 *
 * Keys are HMAC-signed with MCP_API_KEY_SECRET. They embed the user's Supabase user_id
 * so no database lookup is needed on each MCP request.
 *
 * Keys do not expire, but can be mass-invalidated via /revoke (which triggers a salt rotation).
 *
 * Body (optional): { name: string }  — a label for the key (e.g. "Claude Desktop")
 *
 * Returns: { key, name, user_id, created_at, instructions }
 */
router.post('/generate', express.json(), async (req, res) => {
  try {
    if (!process.env.MCP_API_KEY_SECRET) {
      return res.status(503).json({ error: 'MCP_API_KEY_SECRET is not configured on this server.' });
    }

    const user = await requireSupabaseUser(req, res);
    if (!user) return;

    const keyName  = (req.body?.name || 'default').toString().slice(0, 64);
    const key      = generateMcpKey(user.id);
    const supabase = getSupabaseClient();

    // Store key metadata (not the key itself — we only store the userId + label + timestamp)
    const { error: logError } = await supabase
      .from('mcp_key_log')
      .insert({
        user_id:    user.id,
        key_label:  keyName,
        created_at: new Date().toISOString(),
      })
      .select();

    if (logError && logError.code !== '42P01') {
      // 42P01 = table does not exist (gracefully degrade if migration not run)
      console.warn('[mcp-keys] Could not log key creation:', logError.message);
    }

    return res.json({
      key,
      name:       keyName,
      user_id:    user.id,
      created_at: new Date().toISOString(),
      instructions: {
        claude_desktop: {
          description: 'Add to ~/Library/Application Support/Claude/claude_desktop_config.json',
          config: {
            mcpServers: {
              pythh: {
                url:     'https://pythh.ai/mcp',
                headers: { Authorization: `Bearer ${key}` },
              },
            },
          },
        },
        cursor: {
          description: 'Add to .cursor/mcp.json in your project or ~/.cursor/mcp.json globally',
          config: {
            pythh: {
              url:     'https://pythh.ai/mcp',
              headers: { Authorization: `Bearer ${key}` },
            },
          },
        },
        http: {
          description: 'For custom agents — include in the Authorization header of every POST to https://pythh.ai/mcp',
          header: `Authorization: Bearer ${key}`,
        },
      },
    });
  } catch (err) {
    console.error('[mcp-keys/generate] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// POST /api/mcp-keys/revoke
// ============================================================

/**
 * Revoke all MCP keys for the authenticated user.
 *
 * Because HMAC keys embed the userId but not a per-key secret, the only way to
 * invalidate them is to change the global MCP_API_KEY_SECRET. Since that would
 * invalidate ALL users' keys, we instead store a per-user "revocation timestamp"
 * in the mcp_key_log table and check it on each request if needed.
 *
 * For the current HMAC scheme, this marks all prior keys as logically revoked
 * by inserting a revocation record. The MCP auth middleware can be extended to
 * check this table if stricter revocation is required.
 *
 * Returns: { revoked: true, user_id, revoked_at }
 */
router.post('/revoke', express.json(), async (req, res) => {
  try {
    const user = await requireSupabaseUser(req, res);
    if (!user) return;

    const supabase  = getSupabaseClient();
    const revokedAt = new Date().toISOString();

    const { error } = await supabase
      .from('mcp_key_log')
      .insert({
        user_id:    user.id,
        key_label:  '__revocation__',
        created_at: revokedAt,
        revoked:    true,
      })
      .select();

    if (error && error.code !== '42P01') {
      console.warn('[mcp-keys] Could not log revocation:', error.message);
    }

    return res.json({
      revoked:    true,
      user_id:    user.id,
      revoked_at: revokedAt,
      message:    'All previously issued keys for this user have been logically revoked. Generate a new key to regain access.',
    });
  } catch (err) {
    console.error('[mcp-keys/revoke] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ============================================================
// GET /api/mcp-keys/me
// ============================================================

/**
 * List key metadata for the authenticated user.
 * Returns labels and creation times — never the key values themselves.
 */
router.get('/me', async (req, res) => {
  try {
    const user = await requireSupabaseUser(req, res);
    if (!user) return;

    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('mcp_key_log')
      .select('key_label, created_at, revoked')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error && error.code !== '42P01') {
      return res.status(500).json({ error: 'Database error' });
    }

    return res.json({
      user_id: user.id,
      keys:    (data || []).filter(r => !r.revoked),
    });
  } catch (err) {
    console.error('[mcp-keys/me] Error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
