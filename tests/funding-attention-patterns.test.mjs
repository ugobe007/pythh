import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  classifyCapitalRole,
  classifyCheckVehicle,
  detectFollowTheLead,
  buildPatternReport,
  isWellKnownFirm,
} from '../lib/fundingAttentionPatterns.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.join(here, rel), 'utf8');

test('classifies founder-angels vs firm partners vs institutions', () => {
  assert.equal(classifyCapitalRole({ name: 'Sam Altman', firm: 'Apollo Projects', is_individual: true }).role, 'founder_angel');
  assert.equal(classifyCapitalRole({
    name: 'Jane Smith',
    firm: 'Accel',
    is_individual: true,
    title: 'Partner',
    type: 'Angel',
    check_size_max: 250_000,
  }).role, 'partner_angel');
  assert.equal(classifyCapitalRole({ name: 'Accel', firm: 'Accel', is_individual: false }).role, 'firm');
  assert.equal(classifyCapitalRole({ name: 'Y Combinator', firm: 'Y Combinator', type: 'Accelerator' }).role, 'firm');
  assert.equal(classifyCapitalRole({ name: 'Y Combinator', firm: 'Y Combinator' }).role, 'firm');
  assert.equal(classifyCapitalRole({ name: 'IVP', firm: 'Institutional Venture Partners' }).role, 'firm');
  assert.equal(isWellKnownFirm({ name: 'Sequoia Capital', firm: 'Sequoia' }), true);
});

test('partner without the firm on the roster is a personal angel check', () => {
  const partner = {
    id: 'p1',
    name: 'Jane Smith',
    firm: 'Accel',
    is_individual: true,
    title: 'Partner',
    type: 'Angel',
    check_size_max: 250_000,
  };
  const sidecar = classifyCheckVehicle(partner, [partner], { round_type: 'seed' });
  assert.equal(sidecar.vehicle, 'personal_angel');

  const withFirm = classifyCheckVehicle(partner, [
    partner,
    { id: 'f1', name: 'Accel', firm: 'Accel', is_individual: false },
  ], { round_type: 'series-b' });
  assert.equal(withFirm.vehicle, 'firm');
});

test('follow-the-lead only counts later events after a well-known firm', () => {
  const sameRound = detectFollowTheLead([{
    id: 'e1',
    startup_name: 'Nova',
    announced_at: '2026-01-01',
    investors: [
      { id: 's', name: 'Sequoia', firm: 'Sequoia' },
      { id: 'i', name: 'Index Ventures', firm: 'Index Ventures' },
    ],
  }]);
  assert.equal(sameRound.followed, false);

  const later = detectFollowTheLead([
    {
      id: 'e1',
      startup_name: 'Nova',
      announced_at: '2026-01-01',
      investors: [{ id: 's', name: 'Sequoia', firm: 'Sequoia' }],
    },
    {
      id: 'e2',
      startup_name: 'Nova',
      announced_at: '2026-06-01',
      investors: [
        { id: 's', name: 'Sequoia', firm: 'Sequoia' },
        { id: 'i', name: 'Index Ventures', firm: 'Index Ventures' },
      ],
    },
  ]);
  assert.equal(later.followed, true);
  assert.equal(later.leader.firm, 'Sequoia');
  assert.ok(later.followers[0].names.includes('Index Ventures'));
});

test('pattern report rolls trigger and sidecar counts without writing thesis', () => {
  const investorsById = new Map([
    ['s', { id: 's', name: 'Sequoia', firm: 'Sequoia', is_individual: false }],
    ['p', {
      id: 'p', name: 'Jane Smith', firm: 'Accel', is_individual: true,
      title: 'Partner', type: 'Angel', check_size_max: 250_000,
    }],
  ]);
  const report = buildPatternReport({
    investorsById,
    events: [
      {
        id: 'e1',
        startup_id: 'su1',
        startup_name_raw: 'Nova',
        announced_at: '2026-01-01',
        aspects: ['revenue_growth'],
        participants: [
          { investor_id: 's', investor_name_raw: 'Sequoia', resolution_status: 'resolved' },
        ],
      },
      {
        id: 'e2',
        startup_id: 'su1',
        startup_name_raw: 'Nova',
        announced_at: '2026-06-01',
        aspects: ['product_market_fit'],
        participants: [
          { investor_id: 'p', investor_name_raw: 'Jane Smith', resolution_status: 'resolved' },
        ],
      },
    ],
  });
  assert.equal(report.trigger_counts.revenue_growth, 1);
  assert.equal(report.follow_the_lead.startups_with_follow, 1);
  assert.ok(report.personal_angel_sidecars.count >= 1);
  assert.equal(report.investment_thesis, undefined);
});

test('pattern helpers never retune GOD weights or write investment_thesis', () => {
  const lib = read('../lib/fundingAttentionPatterns.mjs');
  const script = read('../scripts/report-funding-attention-patterns.mjs');
  const weights = JSON.parse(read('../server/config/god-score-weights.json'));
  assert.doesNotMatch(lib, /investment_thesis:/);
  assert.match(script, /investment_thesis is never written/);
  assert.doesNotMatch(script, /GOD_SCORE_CONFIG\s*=/);
  assert.equal(weights.weights.componentWeights.team, 0.22);
  assert.equal(weights.weights.componentWeights.traction, 0.3);
});
