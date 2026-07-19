'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { getLimitsForPlan, PLAN_LIMITS } = require('../server/lib/campaignQuotaService');

describe('campaignQuotaService.getLimitsForPlan', () => {
  it('returns scout limits', () => {
    const limits = getLimitsForPlan('scout');
    assert.equal(limits.campaigns, PLAN_LIMITS.scout.campaigns);
    assert.equal(limits.investorsPerCampaign, 50);
  });

  it('returns oracle limits', () => {
    const limits = getLimitsForPlan('oracle');
    assert.equal(limits.campaigns, 10);
  });

  it('returns zero for unsubscribed', () => {
    const limits = getLimitsForPlan(null);
    assert.equal(limits.campaigns, 0);
  });
});
