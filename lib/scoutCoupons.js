'use strict';

/**
 * Scout access codes — pure rules.
 * A code grants Scout features until the match count or the time window runs out.
 * Either limit can be omitted. At least one is required.
 */

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeCode(raw) {
  const code = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (code.length < 4 || code.length > 32) return null;
  if (!/[A-Z0-9]/.test(code)) return null;
  return code;
}

function generateCode(length = 8) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function optionalPositiveInt(value, label, max) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isInteger(n) || n < 1 || n > max) {
    throw new Error(`${label} must be a whole number from 1 to ${max}.`);
  }
  return n;
}

function parseRedeemBy(value) {
  if (value == null || value === '') return null;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date(`${raw}T23:59:59.999Z`);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error('Redeem-by date is not valid.');
  return date;
}

function assertCouponSpec(input) {
  const code = normalizeCode(input.code);
  if (!code) throw new Error('Code must be 4–32 letters or numbers.');
  const matchLimit = optionalPositiveInt(input.matchLimit, 'Match limit', 10000);
  const durationDays = optionalPositiveInt(input.durationDays, 'Time window', 3650);
  const maxRedemptions = optionalPositiveInt(input.maxRedemptions, 'Redemption cap', 100000);
  if (matchLimit == null && durationDays == null) {
    throw new Error('Set a match limit, a time window, or both.');
  }
  const label = String(input.label || '').trim().slice(0, 160) || null;
  const redeemBy = parseRedeemBy(input.redeemBy);
  return { code, label, matchLimit, durationDays, maxRedemptions, redeemBy };
}

function expiresAtFromRedeem(durationDays, now = new Date()) {
  if (durationDays == null) return null;
  return new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);
}

function couponRedeemBlock(coupon, now = new Date()) {
  if (!coupon || coupon.active === false) return 'This code is no longer active.';
  const redeemBy = toDate(coupon.redeem_by ?? coupon.redeemBy);
  if (redeemBy && redeemBy.getTime() <= now.getTime()) return 'This code has expired.';
  const max = coupon.max_redemptions ?? coupon.maxRedemptions;
  const used = coupon.redemption_count ?? coupon.redemptionCount ?? 0;
  if (max != null && used >= max) return 'This code has been fully claimed.';
  return null;
}

function grantView(grant, now = new Date()) {
  if (!grant) {
    return {
      active: false,
      expired: false,
      exhausted: false,
      matchLimit: null,
      matchesUsed: 0,
      matchesRemaining: null,
      expiresAt: null,
    };
  }
  const expiresAt = toDate(grant.expires_at ?? grant.expiresAt);
  const matchLimit = grant.match_limit ?? grant.matchLimit ?? null;
  const matchesUsed = Number(grant.matches_used ?? grant.matchesUsed ?? 0);
  const expired = Boolean(expiresAt && expiresAt.getTime() <= now.getTime());
  const exhausted = matchLimit != null && matchesUsed >= matchLimit;
  const matchesRemaining = matchLimit == null ? null : Math.max(0, matchLimit - matchesUsed);
  return {
    active: !expired && !exhausted,
    expired,
    exhausted,
    matchLimit,
    matchesUsed,
    matchesRemaining,
    expiresAt,
  };
}

function accessSummary(view, now = new Date()) {
  if (!view) return null;
  if (!view.active) {
    if (view.exhausted) return 'This Scout code has used all of its matches.';
    if (view.expired) return 'This Scout code has expired.';
    return null;
  }
  const parts = ['Scout access'];
  if (view.matchesRemaining != null) {
    parts.push(
      `${view.matchesRemaining} match${view.matchesRemaining === 1 ? '' : 'es'} left`,
    );
  }
  if (view.expiresAt) {
    const ms = view.expiresAt.getTime() - now.getTime();
    const days = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    parts.push(days <= 1 ? 'ends within a day' : `${days} days left`);
  }
  return parts.join(' · ');
}

function consumeDecision({ matchLimit, matchesUsed, alreadyUsed }) {
  const used = Number(matchesUsed || 0);
  if (matchLimit == null) return { ok: true, increment: false, matchesUsed: used };
  if (alreadyUsed) return { ok: true, increment: false, matchesUsed: used };
  if (used >= matchLimit) return { ok: false, reason: 'exhausted', matchesUsed: used };
  return { ok: true, increment: true, matchesUsed: used + 1 };
}

function founderSharePath(code) {
  return `/signup/founder?coupon=${encodeURIComponent(code)}`;
}

function limitLabel({ matchLimit, durationDays }) {
  const parts = [];
  if (matchLimit != null) parts.push(`${matchLimit} match${matchLimit === 1 ? '' : 'es'}`);
  if (durationDays != null) parts.push(`${durationDays} day${durationDays === 1 ? '' : 's'}`);
  return parts.join(' or ');
}

module.exports = {
  normalizeCode,
  generateCode,
  assertCouponSpec,
  expiresAtFromRedeem,
  couponRedeemBlock,
  grantView,
  accessSummary,
  consumeDecision,
  founderSharePath,
  limitLabel,
  toDate,
};
