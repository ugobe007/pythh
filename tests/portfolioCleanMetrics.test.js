const test = require('node:test');
const assert = require('node:assert/strict');

const { applyCleanPortfolioMetrics } = require('../server/lib/portfolioTrackRecord');

test('headline portfolio metrics exclude quarantined positions and their events', () => {
  const positions = [
    { id: 'clean-funded', status: 'active', entry_date: '2026-01-01', entity_quarantined: false, entered_late: false, virtual_check_usd: 100000 },
    { id: 'clean-exit', status: 'acquired', entry_date: '2026-01-01', entity_quarantined: false, entered_late: false, virtual_check_usd: 100000 },
    { id: 'bad-exit', status: 'acquired', entry_date: '2026-01-01', entity_quarantined: true, entered_late: false, virtual_check_usd: 100000 },
    { id: 'late-funded', status: 'active', entry_date: '2026-02-01', entity_quarantined: false, entered_late: true, virtual_check_usd: 100000 },
  ];
  const events = [
    { portfolio_id: 'clean-funded', event_date: '2026-03-01', verified: true },
    { portfolio_id: 'bad-exit', event_date: '2026-03-01', verified: true },
    { portfolio_id: 'late-funded', event_date: '2026-03-01', verified: true },
    { portfolio_id: 'clean-exit', event_date: '2025-12-01', verified: true },
  ];

  const metrics = applyCleanPortfolioMetrics({}, positions, events);

  assert.equal(metrics.all_picks, 4);
  assert.equal(metrics.total_picks, 2);
  assert.equal(metrics.excluded_picks, 2);
  assert.equal(metrics.quarantined_picks, 1);
  assert.equal(metrics.entered_late_picks, 1);
  assert.equal(metrics.acquisitions, 1);
  assert.equal(metrics.verified_funded_picks, 1);
  assert.equal(metrics.verified_funded_rate_pct, 50);
  assert.equal(metrics.win_rate_pct, 100);
  assert.equal(metrics.total_virtual_deployed_usd, 200000);
});
