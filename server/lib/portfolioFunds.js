/**
 * Named virtual vintages. Pythh_1 is the locked first book.
 * Pythh_2 is the open second book — new picks must not dilute Pythh_1.
 */
'use strict';

const PYTHH_1 = 'pythh_1';
const PYTHH_2 = 'pythh_2';

const FUNDS = {
  [PYTHH_1]: {
    key: PYTHH_1,
    name: 'Pythh_1',
    locked: true,
    lock_date: process.env.PORTFOLIO_LOCK_DATE || '2026-06-11',
    inception: '2025-11-25',
    check_usd: 100000,
    thesis: 'First virtual vintage. Fixed cohort. Marks move only on press-verified evidence.',
  },
  [PYTHH_2]: {
    key: PYTHH_2,
    name: 'Pythh_2',
    locked: false,
    lock_date: null,
    inception: '2026-09-13',
    check_usd: 100000,
    thesis: 'Second virtual vintage. New picks after Pythh_1 lock. Empty until a pick is added here.',
  },
};

function resolveFundKey(raw) {
  const key = String(raw || PYTHH_1).trim().toLowerCase().replace(/-/g, '_');
  if (key === '1' || key === 'fund1' || key === 'pythh1') return PYTHH_1;
  if (key === '2' || key === 'fund2' || key === 'pythh2') return PYTHH_2;
  if (FUNDS[key]) return key;
  return PYTHH_1;
}

function getFund(raw) {
  return FUNDS[resolveFundKey(raw)];
}

function listFunds() {
  return Object.values(FUNDS);
}

function matchesFundKey(rowFundKey, wanted) {
  const want = resolveFundKey(wanted);
  const have = String(rowFundKey || PYTHH_1).trim().toLowerCase() || PYTHH_1;
  return have === want;
}

function filterByFund(rows, wanted) {
  const want = resolveFundKey(wanted);
  return (rows || []).filter((row) => matchesFundKey(row.fund_key, want));
}

module.exports = {
  PYTHH_1,
  PYTHH_2,
  FUNDS,
  resolveFundKey,
  getFund,
  listFunds,
  matchesFundKey,
  filterByFund,
};
