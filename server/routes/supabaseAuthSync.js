/**
 * POST /api/auth/sync-supabase
 * Sets pythh_session after Supabase OAuth (browser sends access_token).
 * REST (not tRPC) so Set-Cookie survives Vercel → Fly rewrites reliably.
 */
const { createClient } = require('@supabase/supabase-js');

const COOKIE_NAME = 'pythh_session';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function sessionCookieOptions(req) {
  const secure = process.env.NODE_ENV === 'production' || !!process.env.FLY_APP_NAME;
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  };
}

async function upsertUser(row) {
  const { upsertUser: fn } = require('../../NEW_pythh_site/db.ts');
  return fn(row);
}

function mountSupabaseAuthSync(app) {
  app.post('/api/auth/sync-supabase', async (req, res) => {
    const accessToken = String(req.body?.access_token || '').trim();
    if (!accessToken) {
      return res.status(400).json({ error: 'access_token required' });
    }

    const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
    const sbKey =
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      '';
    if (!sbUrl || !sbKey) {
      return res.status(503).json({ error: 'OAuth sign-in is not configured on the server.' });
    }

    try {
      const sbAdmin = createClient(sbUrl, sbKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data: { user }, error } = await sbAdmin.auth.getUser(accessToken);
      if (error || !user) {
        return res.status(401).json({
          error: error?.message || 'Invalid or expired sign-in session.',
        });
      }

      const email = user.email?.trim().toLowerCase() ?? null;
      const openId = `supabase:${user.id}`;
      const provider =
        user.app_metadata?.provider ||
        user.identities?.[0]?.provider ||
        'oauth';
      const displayName =
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        null;

      const ownerEmails = String(process.env.OWNER_EMAILS || '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);
      const isOwner = email ? ownerEmails.includes(email) : false;

      await upsertUser({
        openId,
        email,
        name: displayName,
        loginMethod: provider,
        role: isOwner ? 'admin' : 'user',
      });

      res.cookie(COOKIE_NAME, JSON.stringify({ openId }), {
        ...sessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });
      return res.json({ success: true, openId });
    } catch (err) {
      console.error('[auth/sync-supabase]', err?.message || err);
      return res.status(500).json({ error: 'Sign-in failed on server.' });
    }
  });
}

module.exports = { mountSupabaseAuthSync, COOKIE_NAME };
