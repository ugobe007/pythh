'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { quotesFromInvestor } = require('../lib/investorQuotes');

describe('quotesFromInvestor', () => {
  it('keeps investing, portfolio, and looking-for lines', () => {
    const quotes = quotesFromInvestor({
      id: '11111111-1111-1111-1111-111111111111',
      name: 'Sequoia Capital',
      firm: 'Sequoia Capital',
      investment_thesis: 'We invest in seed-stage software companies with a working product. We are looking for founders who already sell to developers.',
      notable_investments: ['Stripe', 'Airbnb', 'DoorDash'],
    });
    const kinds = quotes.map((quote) => quote.kind).sort();
    assert.deepEqual(kinds, ['invested_in', 'investing_in', 'looking_for']);
    assert.match(quotes.find((quote) => quote.kind === 'invested_in').quote, /Stripe/);
  });

  it('drops category portfolio labels and generic firms', () => {
    const quotes = quotesFromInvestor({
      id: 'b',
      name: 'MaC Venture',
      firm: 'MaC Venture',
      notable_investments: ['Tech Innovators', 'SaaS Solutions', 'AI Startups'],
    });
    assert.equal(quotes.length, 0);
    const angel = quotesFromInvestor({
      id: 'c',
      name: 'Angel Investor',
      firm: 'Angel Investor',
      notable_investments: ['Nest', 'Ring'],
    });
    assert.equal(angel.length, 0);
  });

  it('keeps a focus line and drops inferred blurbs', () => {
    const quotes = quotesFromInvestor({
      id: 'd',
      name: 'Bull City Venture Partners',
      firm: 'Bull City Venture Partners',
      investment_thesis: 'Focus on early-stage technology companies that leverage AI and SaaS to disrupt traditional industries. [Inferred from news] Recfindr secures a pre-seed round.',
    });
    assert.equal(quotes.length, 1);
    assert.equal(quotes[0].kind, 'investing_in');
    assert.match(quotes[0].quote, /^Focus on early-stage/);
  });

  it('drops personal firm labels and short blurbs', () => {
    assert.deepEqual(quotesFromInvestor({
      id: '22222222-2222-2222-2222-222222222222',
      name: 'John Doerr',
      firm: 'John Doerr Personal',
      investment_thesis: 'We invest in climate.',
    }), []);
  });
});
