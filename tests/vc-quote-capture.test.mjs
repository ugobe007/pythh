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
  assert.equal(classifySpokenLine('We invest in becomes a co-owner of the fund.'), null);
  assert.equal(classifySpokenLine('We invested in first in 2015.'), null);
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

test('decodes apostrophes and drops a sentence about LP capital', () => {
  const html = `
    <p>If we invest in an entrepreneur, we don&rsquo;t just spend time with her when she is a winner.</p>
    <p>The vast majority of the capital we invest comes from university endowments, hospitals, and charities.</p>
    <p>If we bring a corporate partner on board, we seek to help them innovate in a way that meets their business needs.</p>
  `;
  const quotes = quotesFromHtml(html, 'https://firstround.com/about', investor);
  assert.equal(quotes.length, 1);
  assert.match(quotes[0].quote, /don't/);
  assert.equal(quotes.some((quote) => /endowments|corporate partner/i.test(quote.quote)), false);
});

test('pulls one spoken sentence out of a card listing', () => {
  const html = `
    <p>Chase Lochmiller CEO and Cofounder We backed Crusoe as they turned stranded energy into AI infrastructure. Brendan Foody CEO We believe in Mercor's vision.</p>
    <p>James Detweiler The Physical World Our investment in Magentic Feyza Haskaraman Sundeep Peechu The Physical World Has No Data Stack Robots are about to become one of the largest data sources on Earth.</p>
    <p>Olivier Pomel, Datadog RTP Global invested: Series A, 2012 We invest in the ambitious founders reshaping the world through technology.</p>
  `;
  const quotes = quotesFromHtml(html, 'https://firstround.com/perspectives', investor);
  const lines = quotes.map((quote) => quote.quote);
  assert.deepEqual(lines, [
    'We backed Crusoe as they turned stranded energy into AI infrastructure.',
    'We invest in the ambitious founders reshaping the world through technology.',
  ]);
  const labeled = quotesFromHtml(
    '<p>Investment We are looking to lead seed rounds with a first check.</p><p>How we invest Stages Seed, Series A, Series B.</p>',
    'https://firstround.com/about',
    investor,
  );
  assert.deepEqual(labeled.map((quote) => quote.quote), ['We are looking to lead seed rounds with a first check.']);
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
  const kept = quotesFromHtml(
    '<p>If we invest in an entrepreneur, we don\'t just spend time with her when she is a winner.</p>',
    'https://firstround.com/about',
    investor,
  );
  assert.equal(kept[0].quote, "If we invest in an entrepreneur, we don't just spend time with her when she is a winner.");
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
