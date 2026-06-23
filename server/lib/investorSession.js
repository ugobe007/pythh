/**
 * Signed tokens for investor magic-link login (no Supabase auth required).
 */

const crypto = require('crypto');

const MAGIC_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function sessionSecret() {
  return (
    process.env.INVESTOR_SESSION_SECRET ||
    process.env.EMAIL_SECRET ||
    process.env.SUPABASE_SERVICE_KEY ||
    'dev-investor-session-secret'
  );
}

function signPayload(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  return `${body}.${sig}`;
}

function verifySignedToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', sessionSecret()).update(body).digest('base64url');
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload?.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function createMagicLinkToken(investorId, email) {
  return signPayload({
    typ: 'magic',
    sub: investorId,
    email: String(email).trim().toLowerCase(),
    exp: Date.now() + MAGIC_TTL_MS,
  });
}

function createSessionToken(investorId, email) {
  return signPayload({
    typ: 'session',
    sub: investorId,
    email: String(email).trim().toLowerCase(),
    exp: Date.now() + SESSION_TTL_MS,
  });
}

function verifyMagicLinkToken(token) {
  const payload = verifySignedToken(token);
  if (!payload || payload.typ !== 'magic' || !payload.sub || !payload.email) return null;
  return { investorId: payload.sub, email: payload.email };
}

function verifySessionToken(token) {
  const payload = verifySignedToken(token);
  if (!payload || payload.typ !== 'session' || !payload.sub || !payload.email) return null;
  return { investorId: payload.sub, email: payload.email };
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== 'string') return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

function requireInvestorSession(req, res, next) {
  const token = getBearerToken(req);
  const session = token ? verifySessionToken(token) : null;
  if (!session) {
    return res.status(401).json({ error: 'Investor sign-in required' });
  }
  req.investorSession = session;
  return next();
}

async function sendInvestorMagicLinkEmail({ to, magicUrl }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn('[investor-auth] RESEND_API_KEY not configured');
    return { success: false, error: 'Email service unavailable' };
  }

  const from = process.env.EMAIL_FROM || 'Pythh <alerts@pythh.ai>';
  const subject = 'Sign in to your Pythh investor profile';
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <p style="color:#111;font-size:16px;">Sign in to view or edit your Pythh investor profile.</p>
      <p><a href="${magicUrl}" style="display:inline-block;background:#10b981;color:#000;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Sign in to Pythh</a></p>
      <p style="color:#666;font-size:13px;">This link expires in 15 minutes. If you didn't request it, you can ignore this email.</p>
    </div>`;
  const text = `Sign in to your Pythh investor profile: ${magicUrl}\n\nExpires in 15 minutes.`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, html, text }),
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('[investor-auth] Resend error:', data);
      return { success: false, error: data.message || 'Failed to send email' };
    }
    return { success: true, id: data.id };
  } catch (err) {
    console.error('[investor-auth] send failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  createMagicLinkToken,
  createSessionToken,
  verifyMagicLinkToken,
  verifySessionToken,
  getBearerToken,
  requireInvestorSession,
  sendInvestorMagicLinkEmail,
};
