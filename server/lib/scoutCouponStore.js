'use strict';

const { pool } = require('../db');
const {
  assertCouponSpec,
  generateCode,
  normalizeCode,
  expiresAtFromRedeem,
  couponRedeemBlock,
  grantView,
  accessSummary,
  consumeDecision,
} = require('../../lib/scoutCoupons');

class ScoutCouponError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'ScoutCouponError';
    this.statusCode = statusCode;
  }
}

function isMissingTable(err) {
  return err?.code === '42P01' || /pythh_scout_coupon/i.test(String(err?.message || ''));
}

function setupError() {
  return new ScoutCouponError('Scout codes are not set up yet.');
}

async function withClient(fn) {
  const client = await pool.connect();
  try {
    return await fn(client);
  } catch (err) {
    if (isMissingTable(err)) throw setupError();
    throw err;
  } finally {
    client.release();
  }
}

const GRANT_SELECT = `
  SELECT g.id, g.coupon_id, g.user_id, g.match_limit, g.matches_used,
         g.expires_at, g.redeemed_at, c.code, c.label
  FROM pythh_scout_coupon_grants g
  JOIN pythh_scout_coupons c ON c.id = g.coupon_id
`;

function publicAccess(row, now = new Date()) {
  const view = grantView(row, now);
  return {
    active: view.active,
    expired: view.expired,
    exhausted: view.exhausted,
    code: row?.code || null,
    label: row?.label || null,
    grantId: row?.id || null,
    matchLimit: view.matchLimit,
    matchesUsed: view.matchesUsed,
    matchesRemaining: view.matchesRemaining,
    expiresAt: view.expiresAt ? view.expiresAt.toISOString() : null,
    summary: accessSummary(view, now),
  };
}

function emptyAccess() {
  return publicAccess(null);
}

function pickRow(rows, now) {
  if (!rows?.length) return null;
  return rows.find((row) => grantView(row, now).active) || rows[0];
}

async function loadGrants(client, whereSql, values, now) {
  const { rows } = await client.query(
    `${GRANT_SELECT} WHERE ${whereSql} ORDER BY g.redeemed_at DESC LIMIT 8`,
    values,
  );
  return pickRow(rows, now);
}

async function getAccess(userId) {
  if (!userId) return emptyAccess();
  try {
    return await withClient(async (client) => {
      const row = await loadGrants(client, 'g.user_id = $1', [userId], new Date());
      return row ? publicAccess(row) : emptyAccess();
    });
  } catch (err) {
    if (err instanceof ScoutCouponError) return emptyAccess();
    console.warn('[scout-coupon] access lookup failed:', err.message);
    return emptyAccess();
  }
}

async function planForEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  try {
    return await withClient(async (client) => {
      const { rows } = await client.query(
        `${GRANT_SELECT}
         JOIN pythh_users u ON u.id = g.user_id
         WHERE lower(u.email) = $1
         ORDER BY g.redeemed_at DESC
         LIMIT 8`,
        [normalized],
      );
      const row = pickRow(rows, new Date());
      return row && grantView(row).active ? 'scout' : null;
    });
  } catch (err) {
    if (!(err instanceof ScoutCouponError)) {
      console.warn('[scout-coupon] plan lookup failed:', err.message);
    }
    return null;
  }
}

function mapCoupon(row) {
  return {
    id: row.id,
    code: row.code,
    label: row.label,
    matchLimit: row.match_limit,
    durationDays: row.duration_days,
    maxRedemptions: row.max_redemptions,
    redemptionCount: row.redemption_count,
    redeemBy: row.redeem_by ? new Date(row.redeem_by).toISOString() : null,
    active: row.active,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null,
    sharePath: `/account?coupon=${encodeURIComponent(row.code)}`,
  };
}

async function createCoupon(input) {
  let spec;
  try {
    spec = assertCouponSpec({
      ...input,
      code: input.code ? input.code : generateCode(),
    });
  } catch (err) {
    throw new ScoutCouponError(err.message);
  }

  return withClient(async (client) => {
    try {
      const { rows } = await client.query(
        `INSERT INTO pythh_scout_coupons
           (code, label, match_limit, duration_days, max_redemptions, redeem_by, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          spec.code,
          spec.label,
          spec.matchLimit,
          spec.durationDays,
          spec.maxRedemptions,
          spec.redeemBy,
          input.createdBy || null,
        ],
      );
      return mapCoupon(rows[0]);
    } catch (err) {
      if (err.code === '23505') throw new ScoutCouponError('That code is already in use.', 409);
      throw err;
    }
  });
}

async function listCoupons() {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `SELECT * FROM pythh_scout_coupons ORDER BY created_at DESC LIMIT 100`,
    );
    return rows.map(mapCoupon);
  });
}

async function setCouponActive(id, active) {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `UPDATE pythh_scout_coupons SET active = $2 WHERE id = $1 RETURNING *`,
      [id, Boolean(active)],
    );
    if (!rows[0]) throw new ScoutCouponError('Code not found.', 404);
    return mapCoupon(rows[0]);
  });
}

async function redeemCoupon({ userId, code }) {
  const normalized = normalizeCode(code);
  if (!normalized) throw new ScoutCouponError('Enter a valid code.');
  if (!userId) throw new ScoutCouponError('Sign in to redeem a code.');

  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const { rows: coupons } = await client.query(
        `SELECT * FROM pythh_scout_coupons WHERE code = $1 FOR UPDATE`,
        [normalized],
      );
      const coupon = coupons[0];
      if (!coupon) throw new ScoutCouponError('That code was not found.');

      const { rows: same } = await client.query(
        `${GRANT_SELECT} WHERE g.user_id = $1 AND g.coupon_id = $2 LIMIT 1`,
        [userId, coupon.id],
      );
      if (same[0]) {
        await client.query('COMMIT');
        return publicAccess(same[0]);
      }

      const block = couponRedeemBlock(coupon);
      if (block) throw new ScoutCouponError(block);

      const { rows: existing } = await client.query(
        `${GRANT_SELECT} WHERE g.user_id = $1 ORDER BY g.redeemed_at DESC LIMIT 8`,
        [userId],
      );
      const active = existing.find((row) => grantView(row).active);
      if (active) {
        throw new ScoutCouponError('You already have Scout access from a code.');
      }

      const now = new Date();
      const expiresAt = expiresAtFromRedeem(coupon.duration_days, now);
      const { rows: inserted } = await client.query(
        `INSERT INTO pythh_scout_coupon_grants
           (coupon_id, user_id, match_limit, expires_at, redeemed_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, coupon_id, user_id, match_limit, matches_used, expires_at, redeemed_at`,
        [coupon.id, userId, coupon.match_limit, expiresAt, now],
      );
      await client.query(
        `UPDATE pythh_scout_coupons SET redemption_count = redemption_count + 1 WHERE id = $1`,
        [coupon.id],
      );
      await client.query('COMMIT');
      return publicAccess({
        ...inserted[0],
        code: coupon.code,
        label: coupon.label,
      });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err instanceof ScoutCouponError) throw err;
      if (err.code === '23505') throw new ScoutCouponError('You already redeemed this code.', 409);
      throw err;
    }
  });
}

async function consumeMatch({ userId, startupId, investorId }) {
  if (!userId || !startupId || !investorId) {
    return { ok: false, reason: 'missing' };
  }
  return withClient(async (client) => {
    await client.query('BEGIN');
    try {
      const { rows } = await client.query(
        `${GRANT_SELECT} WHERE g.user_id = $1 ORDER BY g.redeemed_at DESC LIMIT 8 FOR UPDATE OF g`,
        [userId],
      );
      const row = pickRow(rows, new Date());
      const view = grantView(row);
      if (!row || !view.active) {
        await client.query('ROLLBACK');
        return { ok: false, reason: view.exhausted ? 'exhausted' : 'inactive' };
      }
      const { rows: prior } = await client.query(
        `SELECT id FROM pythh_scout_coupon_match_uses
         WHERE grant_id = $1 AND startup_id = $2 AND investor_id = $3
         LIMIT 1`,
        [row.id, startupId, investorId],
      );
      const decision = consumeDecision({
        matchLimit: view.matchLimit,
        matchesUsed: view.matchesUsed,
        alreadyUsed: Boolean(prior[0]),
      });
      if (!decision.ok) {
        await client.query('ROLLBACK');
        return { ok: false, reason: 'exhausted' };
      }
      if (decision.increment) {
        await client.query(
          `INSERT INTO pythh_scout_coupon_match_uses (grant_id, startup_id, investor_id)
           VALUES ($1, $2, $3)`,
          [row.id, startupId, investorId],
        );
        await client.query(
          `UPDATE pythh_scout_coupon_grants
           SET matches_used = matches_used + 1
           WHERE id = $1`,
          [row.id],
        );
      }
      await client.query('COMMIT');
      return { ok: true, matchesUsed: decision.matchesUsed, matchLimit: view.matchLimit };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  });
}

module.exports = {
  ScoutCouponError,
  getAccess,
  planForEmail,
  createCoupon,
  listCoupons,
  setCouponActive,
  redeemCoupon,
  consumeMatch,
};
