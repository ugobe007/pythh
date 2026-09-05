import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  BROKEN_FIRST_PARTY_CORE_FEEDS,
  CORE_FUNDING_INFERENCE_SITE_QUERY,
  CORE_FUNDING_RSS_SOURCES,
} from '../lib/coreFundingRssSources.mjs';

test('core funding RSS sources cover the operator news homepages', () => {
  const homepages = CORE_FUNDING_RSS_SOURCES.map((s) => s.homepage);
  assert.ok(homepages.includes('https://news.crunchbase.com'));
  assert.ok(homepages.includes('https://techcrunch.com/category/startups/'));
  assert.ok(homepages.includes('https://dealroom.co/news/'));
  assert.ok(homepages.includes('https://www.angellist.com'));
  assert.ok(homepages.includes('https://www.producthunt.com'));
  assert.equal(CORE_FUNDING_RSS_SOURCES.filter((s) => s.firstParty).length, 3);
  assert.ok(CORE_FUNDING_RSS_SOURCES.some((s) => s.url.includes('news.crunchbase.com/feed')));
  assert.ok(CORE_FUNDING_RSS_SOURCES.some((s) => s.url.includes('techcrunch.com/category/startups/feed')));
  assert.ok(CORE_FUNDING_RSS_SOURCES.some((s) => s.url.includes('producthunt.com/feed')));
});

test('broken first-party Dealroom and AngelList feeds stay off', () => {
  assert.ok(BROKEN_FIRST_PARTY_CORE_FEEDS.includes('https://dealroom.co/blog/feed'));
  assert.ok(BROKEN_FIRST_PARTY_CORE_FEEDS.includes('https://www.angellist.com/blog/rss.xml'));
  for (const url of BROKEN_FIRST_PARTY_CORE_FEEDS) {
    assert.equal(CORE_FUNDING_RSS_SOURCES.some((s) => s.url === url), false);
  }
});

test('high-volume discovery and inference hunt the core publishers', () => {
  const highVolume = readFileSync(new URL('../scripts/high-volume-discovery.js', import.meta.url), 'utf8');
  assert.match(highVolume, /news\.crunchbase\.com\/feed/);
  assert.match(highVolume, /techcrunch\.com\/category\/startups\/feed/);
  assert.match(highVolume, /producthunt\.com\/feed/);
  assert.match(highVolume, /site:dealroom\.co/);
  assert.match(highVolume, /site:angellist\.com/);

  const search = readFileSync(new URL('../scripts/search-startup-funding-evidence.mjs', import.meta.url), 'utf8');
  assert.match(search, /CORE_FUNDING_INFERENCE_SITE_QUERY/);

  assert.match(CORE_FUNDING_INFERENCE_SITE_QUERY, /site:news\.crunchbase\.com/);
  assert.match(CORE_FUNDING_INFERENCE_SITE_QUERY, /site:techcrunch\.com/);
  assert.match(CORE_FUNDING_INFERENCE_SITE_QUERY, /site:dealroom\.co/);
  assert.match(CORE_FUNDING_INFERENCE_SITE_QUERY, /site:producthunt\.com/);
  assert.match(CORE_FUNDING_INFERENCE_SITE_QUERY, /site:angellist\.com/);
  assert.match(CORE_FUNDING_INFERENCE_SITE_QUERY, /site:wellfound\.com/);
});
