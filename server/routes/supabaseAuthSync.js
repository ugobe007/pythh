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

function requestHost(req) {
  const forwarded = req.headers['x-forwarded-host'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim().split(':')[0].toLowerCase();
  }
  return String(req.headers?.host || '').split(':')[0].toLowerCase();
}

function sessionCookieDomain(req) {
  const host = requestHost(req);
  if (host === 'pythh.ai' || host.endsWith('.pythh.ai')) return '.pythh.ai';
  const appUrl = String(process.env.APP_URL || process.env.APP_BASE_URL || '');
  if (appUrl.includes('pythh.ai')) return '.pythh.ai';
  return undefined;
}

function sessionCookieOptions(req) {
  const secure = process.env.NODE_ENV === 'production' || !!process.env.FLY_APP_NAME;
  const domain = sessionCookieDomain(req);
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    ...(domain ? { domain } : {}),
  };
}

function clearPkceCookie(res, req) {
  const opts = { path: '/', sameSite: 'lax' };
  const domain = sessionCookieDomain(req);
  if (domain) {
    res.clearCookie(PKCE_COOKIE, { ...opts, domain });
  }
  res.clearCookie(PKCE_COOKIE, opts);
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

    const verifier = String(cookies[PKCE_COOKIE] || '').trim();
    const { sbUrl, anonKey, serviceKey } = supabaseConfig();

    if (sbUrl && anonKey && serviceKey && verifier.length >= 43) {
      try {
        const storage = {
          getItem: (key) => {
            if (key.includes('code-verifier') || key.includes('verifier')) {
              return verifier;
            }
            return null;
          },
          setItem: () => {},
          removeItem: () => {},
        };

        const sbClient = createClient(sbUrl, anonKey, {
          auth: {
            flowType: 'pkce',
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
            storage,
          },
        });

        const { data, error } = await sbClient.auth.exchangeCodeForSession(code);
        if (!error && data?.session?.access_token) {
          await establishPythhSession(req, res, data.session.access_token);
          clearPkceCookie(res, req);
          return res.redirect(302, nextPath);
        }
        console.error(
          '[auth/supabase/callback] server exchange:',
          error?.message,
          `(verifier ${verifier.length} chars)`,
        );
      } catch (err) {
        console.error('[auth/supabase/callback] server exchange:', err?.message || err);
      }
    } else if (code && verifier.length > 0 && verifier.length < 43) {
      console.warn('[auth/supabase/callback] sb_pkce cookie too short — SPA fallback');
    }

    // Fallback: SPA exchanges PKCE from sessionStorage/localStorage.
    clearPkceCookie(res, req);
    const forward = new URLSearchParams({ code, oauth_handoff: '1' });
    if (nextPath !== '/account') forward.set('next', nextPath);
    return res.redirect(302, `/account?${forward.toString()}`);
  });

  app.post('/api/auth/sync-supabase', async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const fromBearer =
      typeof req.headers.authorization === 'string' &&
      req.headers.authorization.startsWith('Bearer ')
        ? req.headers.authorization.slice(7).trim()
        : '';
    const accessToken = String(
      body.access_token ||
        body.json?.access_token ||
        fromBearer ||
        '',
    ).trim();
    if (!accessToken) {
      return res.status(400).json({
        error:
          'access_token required (send JSON body { "access_token": "..." } or Authorization: Bearer)',
      });
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
