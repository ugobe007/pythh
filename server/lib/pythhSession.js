'use strict';

const COOKIE_NAME = 'pythh_session';

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

async function userFromSessionRaw(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed || trimmed.startsWith('s:')) return null;

  const { getUserByOpenId } = require('../../site/db.ts');
  let openId = trimmed;
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      openId = parsed?.openId;
    } catch {
      return null;
    }
  }
  if (!openId || typeof openId !== 'string') return null;

  const row = await getUserByOpenId(openId);
  if (!row) return null;
  return {
    id: row.id,
    openId: row.openId,
    name: row.name,
    email: row.email,
    role: row.role === 'admin' ? 'admin' : 'user',
  };
}

async function getAuthedUserFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return null;
  return userFromSessionRaw(raw);
}

module.exports = {
  COOKIE_NAME,
  getAuthedUserFromRequest,
  parseCookies,
};
