/**
 * FUND LOCK POLICY
 * ================
 * The Pythh virtual fund is a fixed-vintage cohort, measured over time like a real
 * venture firm. Once LOCKED, NO new positions may be added to virtual_portfolio by
 * any path. Auto-seeding fresh GOD≥threshold startups every day silently inflates
 * the denominator and resets new picks to 1.0× cost — it corrupts time-series
 * performance (MOIC/TVPI/IRR) the same way adding an extra deck mid-hand would.
 *
 * Only EXISTING positions may move, and only on hard evidence: press-verified
 * funding rounds (mark-ups) and recorded exits. No new entries.
 *
 * LOCKED BY DEFAULT. A future fund vintage must be opened deliberately by setting
 * PORTFOLIO_UNLOCK=true (and ideally bumping the vintage date) — never implicitly.
 */
'use strict';

const FUND_LOCK_DATE = process.env.PORTFOLIO_LOCK_DATE || '2026-06-11';
const FUND_LOCKED = String(process.env.PORTFOLIO_UNLOCK || '').toLowerCase() !== 'true';

function isFundLocked() {
  return FUND_LOCKED;
}

/** Human-readable status line for logs and dashboards. */
function lockNote() {
  return FUND_LOCKED
    ? `Fund LOCKED (vintage ${FUND_LOCK_DATE}). No new positions; existing holdings are tracked over time.`
    : 'Fund OPEN (PORTFOLIO_UNLOCK=true) — new positions may be added.';
}

/** Throws if the fund is locked. Use to hard-block add paths in services/routes. */
function assertFundOpen(context = 'add position') {
  if (FUND_LOCKED) {
    throw new Error(
      `Fund is LOCKED (vintage ${FUND_LOCK_DATE}); cannot ${context}. ` +
      `Set PORTFOLIO_UNLOCK=true to open a new vintage.`
    );
  }
}

module.exports = { FUND_LOCKED, FUND_LOCK_DATE, isFundLocked, lockNote, assertFundOpen };
