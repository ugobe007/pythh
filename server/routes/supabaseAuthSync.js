/**
 * Supabase Google/GitHub OAuth — server callback + token sync.
 * GET  /api/auth/supabase/callback?code=…  — PKCE exchange + Set-Cookie + redirect (primary)
 * POST /api/auth/sync-supabase             — legacy browser token sync (fallback)
 */
const { createClient } = require('@supabase/supabase-js');

const COOKIE_NAME = 'pythh_session';
const PKCE_COOKIE = 'sb_pkce';
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    let val = part.slice(idx + 1).trim();
    try {
      val = decodeURIComponent(val);
    } catch {
      /* keep raw */
    }
    out[key] = val;
  }
  return out;
}

function sessionCookieOptions(req) {
  const secure = process.env.NODE_ENV === 'production' || !!process.env.FLY_APP_NAME;
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
  };
}

function clearPkceCookie(res) {
  res.clearCookie(PKCE_COOKIE, { path: '/', sameSite: 'lax' });
}

function supabaseConfig() {
  const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey =
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    '';
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    '';
  return { sbUrl, serviceKey, anonKey };
}

async function upsertUser(row) {
  const { upsertUser: fn } = require('../../NEW_pythh_site/db.ts');
  return fn(row);
}

async function establishPythhSession(req, res, accessToken) {
  const { sbUrl, serviceKey } = supabaseConfig();
  if (!sbUrl || !serviceKey) {
    throw new Error('OAuth sign-in is not configured on the server.');
  }

  const sbAdmin = createClient(sbUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error } = await sbAdmin.auth.getUser(accessToken);
  if (error || !user) {
    throw new Error(error?.message || 'Invalid or expired sign-in session.');
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

  const ownerEmails = String(process.env.OWNER_EMAILS || 'ugobe07@gmail.com')
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

  return { openId, email };
}

function mountSupabaseAuthSync(app) {
  /** Primary OAuth return URL — exchange PKCE code on server, set cookie, redirect. */
  app.get('/api/auth/supabase/callback', async (req, res) => {
    const oauthErr =
      (typeof req.query.error_description === 'string' && req.query.error_description) ||
      (typeof req.query.error === 'string' && req.query.error) ||
      null;
    const cookies = parseCookies(req.headers.cookie);
    const nextFromCookie = cookies.pythh_oauth_next || '';
    const nextPath =
      (typeof req.query.next === 'string' && req.query.next.startsWith('/')
        ? req.query.next
        : null) ||
      (nextFromCookie.startsWith('/') ? nextFromCookie : null) ||
      '/account';

    if (oauthErr) {
      return res.redirect(
        `/login?oauth_error=${encodeURIComponent(oauthErr)}`,
      );
    }

    const code = typeof req.query.code === 'string' ? req.query.code : null;
    if (!code) {
      const qs = new URLSearchParams(req.query).toString();
      if (qs) return res.redirect(302, `/account?${qs}`);
      return res.redirect(302, nextPath);
    }

    // PKCE verifier lives in browser localStorage — forward ?code= to SPA; client exchanges + syncs.
    clearPkceCookie(res);
    const forward = new URLSearchParams({ code });
    if (nextPath !== '/account') forward.set('next', nextPath);
    return res.redirect(302, `/account?${forward.toString()}`);
  });

  app.post('/api/auth/sync-supabase', async (req, res) => {
    const accessToken = String(req.body?.access_token || '').trim();
    if (!accessToken) {
      return res.status(400).json({ error: 'access_token required' });
    }

    try {
      const { openId } = await establishPythhSession(req, res, accessToken);
      return res.json({ success: true, openId });
    } catch (err) {
      console.error('[auth/sync-supabase]', err?.message || err);
      const msg = err?.message || 'Sign-in failed on server.';
      const status = msg.includes('not configured') ? 503 : msg.includes('Invalid') ? 401 : 500;
      return res.status(status).json({ error: msg });
    }
  });
}

module.exports = { mountSupabaseAuthSync, COOKIE_NAME, PKCE_COOKIE };
