import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
require('tsx/cjs');
const { buildRaiseCampaign } = require('../site/lib/raiseCampaign.ts');

test('a URL preview becomes a five-stage raise campaign', () => {
  const campaign = buildRaiseCampaign({
    startupName: 'Pixero',
    sectors: ['Advertising'],
    stage: 'seed',
    godScore: 71.4,
    vcCount: 3,
    angelCount: 2,
    topInvestorName: 'First Round',
    why: 'They back tools that turn a URL into a finished campaign.',
  });

  assert.deepEqual(campaign.stages.map((stage) => stage.id), [
    'strategy',
    'deck',
    'messaging',
    'meetings',
    'term_sheet',
  ]);
  assert.match(campaign.stages[0].body, /3 VCs and 2 angels/);
  assert.match(campaign.stages[0].body, /First Round/);
  assert.match(campaign.stages[0].body, /Readiness score 71/);
  assert.match(campaign.stages[1].body, /Advertising/);
  assert.match(campaign.stages[2].body, /finished campaign/);
  assert.match(campaign.stages[3].body, /until you approve/);
  assert.match(campaign.stages[4].body, /term sheet/);
  assert.equal(campaign.stages[0].label, 'Positioning');
  assert.equal(campaign.stages[0].paid, false);
  assert.equal(campaign.stages[0].timing, 'Next');
  assert.equal(campaign.stages[1].label, 'Pitch deck');
  assert.equal(campaign.stages[1].timing, 'After positioning');
  assert.equal(campaign.stages[1].paid, true);
  assert.equal(
    buildRaiseCampaign({ startupName: 'Orbital', stage: '1' }).stages[0].title,
    'Who should fund this round',
  );
  assert.doesNotMatch(
    buildRaiseCampaign({ startupName: 'Orbital', stage: '1' }).stages[0].body,
    /1 round/,
  );
});
