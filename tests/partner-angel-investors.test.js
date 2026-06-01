'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  isJunkInvestorName,
  looksLikePersonName,
  scorePartnerAngelInvestor,
  isPartnerAngelInvestor,
} = require('../lib/partnerAngelInvestors');

describe('partnerAngelInvestors', () => {
  it('flags junk scraped names', () => {
    assert.equal(isJunkInvestorName('PartnerMichael WolfeVenture'), true);
    assert.equal(isJunkInvestorName('from our Team (Nea)'), true);
  });

  it('recognizes person names', () => {
    assert.equal(looksLikePersonName('Nick Rubin (First Round)'), true);
    assert.equal(looksLikePersonName('Bessemer Venture Partners'), false);
  });

  it('scores First Round partners as partner angels', () => {
    const result = scorePartnerAngelInvestor({
      name: 'Nick Rubin (First Round)',
      firm: 'First Round Capital',
      is_individual: true,
      check_size_max: 3000000,
      stage: ['Seed'],
    });
    assert.equal(result.isPartnerAngel, true);
  });

  it('rejects mega-fund firm-only rows', () => {
    const result = scorePartnerAngelInvestor({
      name: 'New Enterprise Associates (NEA)',
      firm: 'New Enterprise Associates',
      is_individual: true,
      check_size_max: 100000000,
    });
    assert.equal(result.isPartnerAngel, false);
  });

  it('isPartnerAngelInvestor helper', () => {
    assert.equal(
      isPartnerAngelInvestor({
        name: 'Jason Calacanis',
        firm: 'LAUNCH',
        type: 'VC',
        check_size_max: 500000,
        stage: ['Pre-Seed', 'Seed'],
        is_individual: true,
      }),
      true
    );
  });
});
