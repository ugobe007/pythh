import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { scoreboardForFund } = require('../server/lib/portfolioTrackRecord.js');
const { PYTHH_1, PYTHH_2, getFund } = require('../server/lib/portfolioFunds.js');

test('scoreboard counts verified funded and MOIC per vintage', () => {
  const positions = [
    { id: 'a', fund_key: PYTHH_1, status: 'active', entry_date: '2025-12-01', entity_quarantined: false, entered_late: false, virtual_check_usd: 100000, moic: 3 },
    { id: 'b', fund_key: PYTHH_1, status: 'active', entry_date: '2025-12-01', entity_quarantined: false, entered_late: false, virtual_check_usd: 100000, moic: 1 },
  ];
  const events = [
    { portfolio_id: 'a', event_type: 'funding_round', event_date: '2026-03-01', verified: true },
    { portfolio_id: 'b', event_type: 'funding_round', event_date: '2025-11-01', verified: true },
  ];
  const board = scoreboardForFund(getFund(PYTHH_1), positions, events, {
    isFundLocked: () => true,
    lockNote: () => 'LOCKED',
  });
  assert.equal(board.positions, 2);
  assert.equal(board.verified_funded_picks, 1);
  assert.equal(board.verified_avg_moic, 3);
  assert.equal(board.verified_early_picks, 1);
  assert.equal(board.verified_moic_sum, 3);
  assert.equal(board.early_picks, 2);
  assert.equal(board.avg_moic, 2);
});

test('Pythh_2 scoreboard stays at 1.0× without post-entry verified rounds', () => {
  const positions = [
    { id: 'c', fund_key: PYTHH_2, status: 'active', entry_date: '2026-09-13', entity_quarantined: false, entered_late: false, virtual_check_usd: 100000, moic: 31.58 },
  ];
  const board = scoreboardForFund(getFund(PYTHH_2), positions, [], {
    isFundLocked: () => false,
    lockNote: () => 'OPEN',
  });
  assert.equal(board.locked, false);
  assert.equal(board.verified_funded_picks, 0);
  assert.equal(board.verified_avg_moic, null);
});
