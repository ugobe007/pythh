/**
 * FUND LOCK POLICY
 * ================
 * Pythh_1 is a fixed-vintage cohort. Once LOCKED, no new positions may be added
 * to that book. Auto-seeding fresh GOD≥threshold startups into Pythh_1 inflates
 * the denominator and resets new picks to 1.0× — it corrupts time-series MOIC.
 *
 * New picks go to Pythh_2. Only EXISTING Pythh_1 positions may move, and only
 * on hard evidence: press-verified funding rounds and recorded exits.
 *
 * PORTFOLIO_UNLOCK=true still opens Pythh_1 (legacy). Do not use it to mix vintages.
 */
'use strict';

const { PYTHH_1, PYTHH_2, resolveFundKey, getFund } = require('./portfolioFunds');

const FUND_LOCK_DATE = process.env.PORTFOLIO_LOCK_DATE || '2026-06-11';
const FUND_LOCKED = String(process.env.PORTFOLIO_UNLOCK || '').toLowerCase() !== 'true';

function isFundLocked(fundKey = PYTHH_1) {
  const key = resolveFundKey(fundKey);
  if (key === PYTHH_2) return Boolean(getFund(key).locked);
  return FUND_LOCKED;
}

function lockNote(fundKey = PYTHH_1) {
  const fund = getFund(fundKey);
  if (!isFundLocked(fund.key)) {
    return `${fund.name} OPEN — new positions may be added to this vintage.`;
  }
  return `${fund.name} LOCKED (vintage ${fund.lock_date || FUND_LOCK_DATE}). No new positions; existing holdings are tracked over time.`;
}

function assertFundOpen(context = 'add position', fundKey = PYTHH_1) {
  if (isFundLocked(fundKey)) {
    throw new Error(
      `${lockNote(fundKey)} Cannot ${context}. New picks belong on Pythh_2.`
    );
  }
}

module.exports = {
  FUND_LOCKED,
  FUND_LOCK_DATE,
  PYTHH_1,
  PYTHH_2,
  isFundLocked,
  lockNote,
  assertFundOpen,
};
