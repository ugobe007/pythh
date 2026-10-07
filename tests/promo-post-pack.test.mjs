import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { pickQuotes, pickFundingNews, pickTrending, buildPromoText } = require('../lib/promoPostPack.js');

test('picks ten spoken quotes, one firm each, funding lines before advice', () => {
  const rows = [];
  for (let i = 0; i < 8; i += 1) {
    rows.push({
      firm: `Fund ${i}`,
      speaker: `Fund ${i}`,
      kind: 'investing_in',
      quote: `We invest in seed tools for market number ${i} with a working product.`,
      source: 'https://example.com/fund',
    });
  }
  rows.push({
    firm: 'Kleiner Perkins',
    speaker: 'Kleiner Perkins',
    kind: 'invested_in',
    quote: 'Our investment in Google delivered exceptional returns and transformed how the world accesses information.',
    source: 'https://kleinerperkins.com',
  });
  rows.push({
    firm: 'Blurbs',
    kind: 'investing_in',
    quote: 'Focus on early-stage technology companies that leverage AI and SaaS to disrupt traditional industries.',
  });
  rows.push({
    firm: 'Kleiner Perkins',
    kind: 'invested_in',
    quote: 'We led Nest and stayed on the board through the sale to a strategic buyer.',
  });
  const quotes = pickQuotes(rows, 10);
  assert.equal(quotes.length, 9);
  assert.equal(quotes.filter((quote) => quote.firm === 'Kleiner Perkins').length, 1);
  assert.equal(quotes.some((quote) => /leverage AI/i.test(quote.quote)), false);
  assert.equal(quotes[0].kind, 'investing_in');
  assert.equal(quotes[1].kind, 'invested_in');
});

test('keeps three to five funding headlines and drops lawsuits', () => {
  const rows = [
    { name: 'Acme', article_title: 'Acme raises $20M Series A', article_url: 'https://news.example/acme', funding_amount: '$20M', funding_stage: 'Series A' },
    { name: 'Acme', article_title: 'Acme raises $20M Series A again', article_url: 'https://news.example/acme-2', funding_amount: '$20M' },
    { name: 'Nova', article_title: 'Nova faces a class action lawsuit', article_url: 'https://news.example/nova', funding_amount: '$1M' },
    { name: 'Advanced ZEISS Telephoto Lens', article_title: 'vivo X500 Series Debuts with a new lens', article_url: 'https://news.example/vivo' },
    { name: 'America Nomura', article_title: 'Capitolis, which develops tech for banks, raised $220M Series E', article_url: 'https://news.example/capitolis', funding_amount: '220000000', funding_stage: 'Series E' },
    { name: 'America Nomura', article_title: 'Capitolis, which develops tech for banks, raised $220M Series E', article_url: 'https://news.example/capitolis-2', funding_amount: '220000000' },
    { name: 'Bolt', article_title: 'Bolt secures $8M seed round', article_url: 'https://news.example/bolt', funding_amount: '$8M', funding_stage: 'Seed' },
    { name: 'Pine', article_title: 'Pine closes $40M Series B', article_url: 'https://news.example/pine', funding_amount: '$40M' },
    { name: 'Quill', article_title: 'Quill lands $12M Series A', article_url: 'https://news.example/quill' },
  ];
  const news = pickFundingNews(rows);
  assert.equal(news.length, 5);
  assert.equal(news.some((item) => /lawsuit|vivo|Acme again/i.test(item.title)), false);
  assert.equal(news[0].company, 'Acme');
  assert.equal(news.some((item) => item.company === 'Capitolis' && item.amount === '$220M'), true);
});

test('the post pack names the thesis and a paste line', () => {
  const pack = {
    date: '2026-10-07',
    quotes: pickQuotes([
      {
        firm: 'Paradigm',
        speaker: 'Fred Ehrsam',
        kind: 'investing_in',
        quote: 'We invest in areas with the greatest rates of technological change, including crypto and AI.',
        source: 'https://www.paradigm.xyz/about',
      },
    ], 10),
    funding: pickFundingNews([
      { name: 'Acme', article_title: 'Acme raises $20M Series A', article_url: 'https://news.example/acme', funding_amount: '$20M', funding_stage: 'Series A' },
    ]),
    trending: pickTrending([
      { name: 'Neon', tagline: 'Serverless Postgres', website: 'https://neon.tech', sectors: ['AI/ML', 'Devtools'], total_god_score: 89 },
      { name: 'Other', tagline: 'Tools', sectors: ['AI/ML'], total_god_score: 81 },
    ], 5),
  };
  const text = buildPromoText(pack);
  assert.match(text, /1\. Investor quotes \(1\)/);
  assert.match(text, /Fred Ehrsam, Paradigm/);
  assert.match(text, /https:\/\/www\.paradigm\.xyz\/about/);
  assert.match(text, /Acme raises \$20M Series A/);
  assert.match(text, /Thesis focus among the hottest: AI\/ML \(2\), Devtools \(1\)/);
  assert.match(text, /Neon — score 89/);
});
