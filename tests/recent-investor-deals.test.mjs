import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseAmount,
  shapeRecentDeals,
  investorHasContact,
  resolveInvestorEmail,
} from '../lib/recentInvestorDeals.js';

test('shapeRecentDeals keeps company / year / round / amount without inventing', () => {
  const deals = shapeRecentDeals({
    notable_investments: [
      { company: 'Cruise', round: 'Series B', year: 2021, amount: '$1.5B' },
      { name: 'Nuro', stage: 'Series C', date: '2020-06-01' },
      'Waymo',
    ],
    portfolio_companies: ['Cruise', 'Figure'],
  });
  assert.equal(deals.length, 4);
  assert.deepEqual(deals[0], { company: 'Cruise', year: 2021, round: 'Series B', amount: 1_500_000_000 });
  assert.equal(deals[1].company, 'Nuro');
  assert.equal(deals[1].year, 2020);
  assert.equal(deals[1].amount, null);
  assert.equal(deals[3].company, 'Figure');
});

test('parseAmount reads dollar strings and leaves junk as null', () => {
  assert.equal(parseAmount('$12M'), 12_000_000);
  assert.equal(parseAmount('undisclosed'), null);
});

test('contact helpers never need to leak the raw address to callers that only ask contactable', () => {
  const investor = {
    email: 'hidden@firm.com',
    email_best_guess: 'guess@firm.com',
  };
  assert.equal(investorHasContact(investor), true);
  assert.equal(investorHasContact({ name: 'No Mail' }), false);
  assert.equal(resolveInvestorEmail(investor).address, 'hidden@firm.com');
});
