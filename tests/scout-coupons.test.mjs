import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const {
  normalizeCode,
  assertCouponSpec,
  couponRedeemBlock,
  grantView,
  accessSummary,
  consumeDecision,
  expiresAtFromRedeem,
} = require('../lib/scoutCoupons.js');

const now = new Date('2026-09-26T12:00:00.000Z');

test('normalizes shareable codes', () => {
  assert.equal(normalizeCode(' robot-5 '), 'ROBOT-5');
  assert.equal(normalizeCode('ab'), null);
  assert.equal(normalizeCode('----'), null);
});

test('requires a match limit or a time window', () => {
  assert.throws(() => assertCouponSpec({ code: 'ROBOT5' }), /match limit|time window/);
  const spec = assertCouponSpec({ code: 'robot5', matchLimit: 10, durationDays: 14, label: 'office hours' });
  assert.equal(spec.code, 'ROBOT5');
  assert.equal(spec.matchLimit, 10);
  assert.equal(spec.durationDays, 14);
  assert.equal(spec.label, 'office hours');
});

test('blocks expired, paused, and fully claimed codes', () => {
  assert.equal(couponRedeemBlock({ active: false }, now), 'This code is no longer active.');
  assert.match(
    couponRedeemBlock({ active: true, redeem_by: '2026-09-01T00:00:00.000Z', redemption_count: 0 }, now),
    /expired/,
  );
  assert.match(
    couponRedeemBlock({ active: true, max_redemptions: 2, redemption_count: 2 }, now),
    /fully claimed/,
  );
  assert.equal(couponRedeemBlock({ active: true, max_redemptions: 2, redemption_count: 1 }, now), null);
});

test('grant stays active until the first limit hits', () => {
  const open = grantView({ match_limit: 5, matches_used: 2, expires_at: '2026-10-10T00:00:00.000Z' }, now);
  assert.equal(open.active, true);
  assert.equal(open.matchesRemaining, 3);
  assert.match(accessSummary(open, now), /3 matches left/);

  const exhausted = grantView({ match_limit: 5, matches_used: 5, expires_at: '2026-10-10T00:00:00.000Z' }, now);
  assert.equal(exhausted.active, false);
  assert.equal(exhausted.exhausted, true);

  const expired = grantView({ match_limit: null, matches_used: 0, expires_at: '2026-09-01T00:00:00.000Z' }, now);
  assert.equal(expired.active, false);
  assert.equal(expired.expired, true);

  const timeOnly = grantView({ match_limit: null, matches_used: 9, expires_at: '2026-10-01T00:00:00.000Z' }, now);
  assert.equal(timeOnly.active, true);
  assert.equal(timeOnly.matchesRemaining, null);
});

test('counts each investor match once', () => {
  assert.deepEqual(consumeDecision({ matchLimit: 2, matchesUsed: 1, alreadyUsed: false }), {
    ok: true,
    increment: true,
    matchesUsed: 2,
  });
  assert.equal(consumeDecision({ matchLimit: 2, matchesUsed: 1, alreadyUsed: true }).increment, false);
  assert.equal(consumeDecision({ matchLimit: 2, matchesUsed: 2, alreadyUsed: false }).ok, false);
  assert.equal(consumeDecision({ matchLimit: null, matchesUsed: 4, alreadyUsed: false }).increment, false);
});

test('share link opens founder signup with the code attached', () => {
  const { founderSharePath } = require('../lib/scoutCoupons.js');
  assert.equal(founderSharePath('ROBOT5'), '/signup/founder?coupon=ROBOT5');
});

test('time window starts at redemption', () => {
  const end = expiresAtFromRedeem(14, now);
  assert.equal(end.toISOString(), '2026-10-10T12:00:00.000Z');
  assert.equal(expiresAtFromRedeem(null, now), null);
});
