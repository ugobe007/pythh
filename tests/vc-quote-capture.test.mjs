import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { quotesFromHtml, classifySpokenLine } = require('../lib/vcQuoteCapture.js');
const { quotesForCard } = require('../lib/investorQuotes.js');

const investor = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'First Round',
  firm: 'First Round',
  url: 'https://firstround.com',
};

test('classifies funding, a named investment, and founder advice', () => {
  assert.equal(classifySpokenLine('We invest in seed-stage developer tools with a working product.'), 'investing_in');
  assert.equal(classifySpokenLine("We led Stripe's seed round because the product was already in use."), 'invested_in');
  assert.equal(classifySpokenLine('Founders should talk to customers before they raise a round.'), 'founder_advice');
  assert.equal(classifySpokenLine('Sequoia focuses on investing in cutting-edge technology sectors.'), null);
});

test('keeps spoken lines from the firm site and drops a founder testimonial', () => {
  const html = `
    <p>We invest in pre-seed founders who already ship.</p>
    <p>We led Notion's seed because the team had a product people used every day.</p>
    <p>Founders should get to product-market fit before they hire a big team.</p>
    <p>"They recruited amazing people into two of our key early roles." Marta Bralic Kerns · Pomelo</p>
    <p>Copyright all rights reserved. Past performance is not indicative of future results.</p>
  `;
  const quotes = quotesFromHtml(html, 'https://firstround.com/how-we-work', investor);
  const kinds = quotes.map((quote) => quote.kind).sort();
  assert.deepEqual(kinds, ['founder_advice', 'invested_in', 'investing_in']);
  assert.equal(quotes.some((quote) => /Pomelo|recruited amazing/i.test(quote.quote)), false);
  assert.equal(quotes.every((quote) => quote.source_url === 'https://firstround.com/how-we-work'), true);
});

test('drops date listings and co-founder headlines', () => {
  assert.equal(classifySpokenLine('March 28, 2024 · Investment Announcements · Our investment in Stress-Free Auto Care.'), null);
  assert.equal(classifySpokenLine('DUOS Co-Founder & CEO Karl Ulfers: We Need to Reinvent Caregiving for families.'), null);
  assert.equal(classifySpokenLine('We focus on early-stage technology companies that leverage AI and SaaS to drive innovation and efficiency.'), null);
  const html = `
    <p>March 28, 2024 · Investment Announcements · Our investment in Stress-Free Auto Care.</p>
    <p>DUOS Co-Founder &amp; CEO Karl Ulfers: We Need to Reinvent Caregiving for families.</p>
    <p>We invest in areas with the greatest rates of technological change, including crypto and AI.</p>
  `;
  const quotes = quotesFromHtml(html, 'https://firstround.com/perspectives', investor);
  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].kind, 'investing_in');
});

test('a card shows one line each for funding, investments, and advice', () => {
  const card = quotesForCard([
    { kind: 'investing_in', quote: 'We invest in seed-stage tools.', firm: 'First Round' },
    { kind: 'looking_for', quote: 'We are looking for technical founders.', firm: 'First Round' },
    { kind: 'invested_in', quote: "We led Notion's seed.", firm: 'First Round' },
    { kind: 'founder_advice', quote: 'Founders should talk to customers first.', firm: 'First Round' },
  ]);
  assert.deepEqual(card.map((quote) => quote.kind), ['investing_in', 'invested_in', 'founder_advice']);
  assert.equal(card[0].kind_label, 'What they fund');
  assert.equal(card[2].kind_label, 'Advice to founders');
});
