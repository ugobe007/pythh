import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const { awareParse, profileSource, headlineGuards } = require('../lib/scrapeAwareness.js');
const { parseFrameFromTitle, toCapitalEvent } = require('../src/services/rss/frameParser.ts');

const SOFTBANK = 'SoftBank shares jump over 7% after $11.1 billion bond issuance to fund OpenAI bet - CNBC';
const VEGA = 'Vega raises $120 million Series B at a $700 million valuation';
const THRIVE = 'Thrive is set to raise $50M Series A';
const STUDIO = 'Northstar raises $20M for its game studio';
const TEDDY = 'Legal Services Startup Teddy AI Announces $60M Seed Round';

test('a stock move is not a fundraising signal', () => {
  const parsed = awareParse({
    title: SOFTBANK,
    feedUrl: 'https://news.google.com/rss/search?q=seed+round+startup',
    feedName: 'Google: Seed Round',
    itemUrl: 'https://news.google.com/rss/articles/CBMiabc',
  });
  assert.equal(parsed.source.source_type, 'news_aggregator');
  assert.ok(parsed.guards.includes('market_move'));
  assert.equal(parsed.actionable_fundraising, false);
  assert.equal(parsed.signal.primary_signal, 'market_move_signal');
  assert.ok(!parsed.signal.signal_classes.includes('fundraising_signal'));
});

test('a closed round on TechCrunch stays a fundraising signal', () => {
  const parsed = awareParse({
    title: VEGA,
    feedUrl: 'https://techcrunch.com/category/startups/feed/',
    feedName: 'TechCrunch Startups',
    itemUrl: 'https://techcrunch.com/2026/09/20/vega-series-b/',
  });
  assert.equal(parsed.source.source_type, 'news_article');
  assert.equal(parsed.source.reliability, 0.70);
  assert.equal(parsed.actionable_fundraising, true);
  assert.equal(parsed.signal.primary_signal, 'fundraising_signal');
  assert.equal(parsed.signal.evidence_quality === 'speculative', false);
});

test('the same raise is less trusted when it arrives through Google News', () => {
  const direct = awareParse({
    title: VEGA,
    feedUrl: 'https://techcrunch.com/category/startups/feed/',
    feedName: 'TechCrunch Startups',
    itemUrl: 'https://techcrunch.com/2026/09/20/vega-series-b/',
  });
  const aggregated = awareParse({
    title: VEGA,
    feedUrl: 'https://news.google.com/rss/search?q=startup+funding',
    feedName: 'Google: Startup Funding',
    itemUrl: 'https://news.google.com/rss/articles/CBMiVega',
  });
  assert.equal(aggregated.source.source_type, 'news_aggregator');
  assert.equal(aggregated.source.reliability, 0.50);
  assert.ok(aggregated.signal.confidence < direct.signal.confidence);
  assert.equal(aggregated.actionable_fundraising, true);
});

test('set to raise is speculative and not a closed round', () => {
  const parsed = awareParse({
    title: THRIVE,
    feedUrl: 'https://techcrunch.com/category/venture/feed/',
    feedName: 'TechCrunch Venture',
    itemUrl: 'https://techcrunch.com/2026/10/01/thrive-raise/',
  });
  assert.ok(parsed.guards.includes('rumor_fundraise'));
  assert.equal(parsed.actionable_fundraising, false);
  assert.equal(parsed.signal.evidence_quality, 'speculative');
  assert.equal(parsed.signal.primary_signal, 'fundraising_signal');
  assert.ok(parsed.signal.confidence <= 0.42);
});

test('a game studio headline is Gaming and a legal startup headline is not', () => {
  const studio = awareParse({ title: STUDIO, feedName: 'TechCrunch Startups', itemUrl: 'https://techcrunch.com/northstar' });
  const teddy = awareParse({ title: TEDDY, feedName: 'Google: Seed Round', feedUrl: 'https://news.google.com/rss/search?q=seed' });
  assert.ok(studio.sectors.includes('Gaming'));
  assert.equal(studio.sector_matched, true);
  assert.equal(teddy.sectors.includes('Gaming'), false);
});

test('wires, launch boards, blogs, and community posts get their own source class', () => {
  assert.equal(profileSource({ itemUrl: 'https://www.businesswire.com/news/acme' }).source_type, 'press_release');
  assert.equal(profileSource({ itemUrl: 'https://news.crunchbase.com/feed/' }).source_type, 'crunchbase');
  assert.equal(profileSource({ itemUrl: 'https://www.producthunt.com/posts/acme' }).source_type, 'product_launch');
  assert.equal(profileSource({ feedUrl: 'https://topstartups.substack.com/feed' }).source_type, 'blog_post');
  assert.equal(profileSource({ itemUrl: 'https://blog.acme.dev/series-a' }).source_type, 'company_blog');
  assert.equal(profileSource({ feedUrl: 'https://hnrss.org/newest?q=startup' }).source_type, 'anonymous_post');
  const viaWire = profileSource({
    title: 'Acme raises $10M seed - Business Wire',
    feedUrl: 'https://news.google.com/rss/search?q=acme',
    feedName: 'Google: Startup Funding',
    itemUrl: 'https://news.google.com/rss/articles/wire',
  });
  assert.equal(viaWire.source_type, 'press_release');
  assert.equal(viaWire.via, 'aggregator');
});

test('venture debt is not stored as a priced equity round', () => {
  const parsed = awareParse({
    title: 'Ledger raises $30M in venture debt for its treasury product',
    itemUrl: 'https://techcrunch.com/ledger-debt',
  });
  assert.ok(parsed.guards.includes('non_equity'));
  assert.equal(parsed.actionable_fundraising, false);
  assert.equal(parsed.signal.evidence_quality, 'speculative');
});

test('the frame parser stores a rumor raise but does not graph-join it', () => {
  const frame = parseFrameFromTitle(THRIVE);
  assert.ok(frame);
  const event = toCapitalEvent(frame, 'TechCrunch', 'https://techcrunch.com/thrive', THRIVE, '2026-10-01T00:00:00.000Z');
  assert.equal(event.event_type, 'FUNDING');
  assert.equal(event.extraction.graph_safe, false);
  assert.ok(event.notes.some((n) => String(n).includes('scrape_guard:rumor_fundraise')));
});

test('the frame parser drops a bond headline amount and will not graph-join it', () => {
  const frame = parseFrameFromTitle(SOFTBANK) || {
    frameType: 'UNKNOWN',
    eventType: 'OTHER',
    verbMatched: 'unknown',
    slots: { subject: 'SoftBank', object: null, tertiary: null },
    semantic_context: [],
    meta: { patternId: 'none', confidence: 0.2, notes: [] },
  };
  const event = toCapitalEvent(frame, 'CNBC', 'https://news.google.com/rss/articles/x', SOFTBANK, '2026-10-05T00:00:00.000Z');
  assert.equal(event.amounts, undefined);
  assert.equal(event.extraction.graph_safe, false);
  assert.ok(headlineGuards(SOFTBANK).includes('market_move'));
});
