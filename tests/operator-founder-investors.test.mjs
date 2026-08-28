import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  isKnownOperatorFounderName,
  scoreOperatorFounderInvestor,
  isOperatorFounderInvestor,
  operatorFounderGodBonus,
} = require('../lib/operatorFounderInvestors.js');
const { calculateInvestorScore } = require('../lib/investorGodScore.js');
const { calculateStageInvestorFitAdjustment } = require('../lib/stageInvestorFit.js');

{
  assert.equal(isKnownOperatorFounderName('Sam Altman'), true);
  assert.equal(isKnownOperatorFounderName('Brian Chesky'), true);
  assert.equal(isKnownOperatorFounderName('Jack Dorsey'), true);
  assert.equal(isKnownOperatorFounderName('Mark Zuckerberg'), true);
  assert.equal(isKnownOperatorFounderName('Random Partner'), false);
}

{
  const altman = scoreOperatorFounderInvestor({
    name: 'Sam Altman',
    is_individual: true,
    type: 'operator_angel',
    blog_url: 'https://blog.samaltman.com',
    investment_thesis: 'I invest in AI infrastructure founders who ship.',
    signals: { top_themes: ['ai', 'developer tools', 'infrastructure'] },
    bio: 'Founded Loopt; former president of YC.',
  });
  assert.equal(altman.isOperatorFounder, true);
  assert.equal(altman.hasPublicThesis, true);
  assert.ok(altman.score >= 10);

  const firm = scoreOperatorFounderInvestor({
    name: 'Initialized Capital',
    firm: 'Initialized Capital',
    is_individual: false,
    type: 'vc',
  });
  assert.equal(firm.isOperatorFounder, false);
}

{
  const base = calculateInvestorScore({
    name: 'Generic Angel',
    firm: 'Solo',
    type: 'angel',
    sectors: ['SaaS'],
    stage: ['Seed'],
    investment_thesis: 'short',
  });
  const operator = calculateInvestorScore({
    name: 'Brian Chesky',
    firm: 'Airbnb',
    is_individual: true,
    type: 'operator_angel',
    sectors: ['Marketplace', 'Consumer'],
    stage: ['Seed'],
    bio: 'Co-founded Airbnb. I invest in product-obsessed founders.',
    investment_thesis: 'I look for consumer products with network effects and craft.',
    blog_url: 'https://news.airbnb.com',
    linkedin_url: 'https://linkedin.com/in/brianchesky',
    signals: { top_themes: ['consumer', 'marketplace', 'design'] },
    total_investments: 20,
  });
  assert.ok(operator.total > base.total, 'operator founder should outscore thin angel profile');
  assert.ok(operator.signals.some((s) => String(s).includes('operator') || String(s).includes('Public thesis')));
}

{
  const fit = calculateStageInvestorFitAdjustment(
    { stage: 1, sectors: ['AI/ML'] },
    {
      name: 'Elad Gil',
      is_individual: true,
      type: 'angel',
      stage: ['Seed'],
      check_size_max: 500_000,
      signals: { top_themes: ['ai', 'biotech'] },
    },
  );
  assert.ok(fit.delta >= 8, `expected operator boost, got ${fit.delta}`);
  assert.match(fit.note, /operator|successful-founder|angel/i);
  assert.equal(isOperatorFounderInvestor({ name: 'Elad Gil', is_individual: true }), true);
}

{
  const bonus = operatorFounderGodBonus({
    name: 'Jack Dorsey',
    is_individual: true,
    blog_url: 'https://jack.com',
    signals: { top_themes: ['bitcoin', 'payments'] },
  });
  assert.ok(bonus.focus >= 2 || bonus.profile >= 2 || bonus.track >= 2);
}

console.log('operator-founder-investors.test.mjs: ok');
