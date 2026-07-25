const test = require('node:test');
const assert = require('node:assert/strict');

const { applyCleanPortfolioMetrics } = require('../server/lib/portfolioTrackRecord');

test('headline portfolio metrics exclude quarantined positions and their events', () => {
  const positions = [
    { id: 'clean-funded', status: 'active', entity_quarantined: false, virtual_check_usd: 100000 },
    { id: 'clean-exit', status: 'acquired', entity_quarantined: false, virtual_check_usd: 100000 },
    { id: 'bad-exit', status: 'acquired', entity_quarantined: true, virtual_check_usd: 100000 },
  ];
  const events = [
    { portfolio_id: 'clean-funded', verified: true },
    { portfolio_id: 'bad-exit', verified: true },
  ];

  const metrics = applyCleanPortfolioMetrics({}, positions, events);

  assert.equal(metrics.all_picks, 3);
  assert.equal(metrics.total_picks, 2);
  assert.equal(metrics.quarantined_picks, 1);
  assert.equal(metrics.acquisitions, 1);
  assert.equal(metrics.verified_funded_picks, 1);
  assert.equal(metrics.verified_funded_rate_pct, 50);
  assert.equal(metrics.win_rate_pct, 100);
  assert.equal(metrics.total_virtual_deployed_usd, 200000);
});
