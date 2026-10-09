import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  clampLimit,
  shapeAdminMatch,
  MAX_LIMIT,
  DEFAULT_LIMIT,
} from '../server/lib/runAdminTargetedMatch.js';

describe('admin targeted match helpers', () => {
  it('clamps limit to 1..25', () => {
    assert.equal(clampLimit(undefined), DEFAULT_LIMIT);
    assert.equal(clampLimit(0), 1);
    assert.equal(clampLimit(3.9), 3);
    assert.equal(clampLimit(100), MAX_LIMIT);
    assert.equal(clampLimit(25), 25);
  });

  it('shapes strategy + contact including resolved email', () => {
    const shaped = shapeAdminMatch(
      {
        investor_id: 'inv-1',
        match_score: 88.4,
        fit_rank: 91,
        confidence_level: 'high',
        why_you_match: ['Sector fit', 'Stage fit'],
        reasoning: 'Strong thesis overlap.',
        fit_analysis: { sector: 20, stage: 18 },
        investors: {
          id: 'inv-1',
          name: 'Ada',
          firm: 'Example Cap',
          email: 'ada@example.com',
          email_status: 'verified',
          linkedin_url: 'https://linkedin.com/in/ada',
          investment_thesis: 'B2B infra',
          sectors: ['SaaS'],
          stage: ['Seed'],
          url: 'https://example.com',
        },
      },
      1,
    );
    assert.equal(shaped.rank, 1);
    assert.equal(shaped.contact.email, 'ada@example.com');
    assert.equal(shaped.contact.email_type, 'verified');
    assert.equal(shaped.contact.linkedin_url, 'https://linkedin.com/in/ada');
    assert.deepEqual(shaped.strategy.why_you_match, ['Sector fit', 'Stage fit']);
    assert.match(shaped.strategy.why_you_match_text, /Sector fit/);
    assert.equal(shaped.strategy.investment_thesis, 'B2B infra');
    assert.equal(shaped.investor.firm, 'Example Cap');
  });
});
