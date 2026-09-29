import test from 'node:test';
import assert from 'node:assert/strict';
import {
  urlsFromDuckDuckGoHtml,
  urlsFromGoogleWebHtml,
  urlsFromMojeekHtml,
  urlsFromNewsRss,
  normalizeOfficialUrl,
  googleWebSearchUrl,
} from '../lib/urlSearchService.mjs';
import { isPaidAiUnavailable } from '../scripts/lib/paidAiFallback.mjs';

test('URL search service keeps official hosts and drops publishers', () => {
  const html = [
    'uddg=https%3A%2F%2Fexample.com%2Fabout',
    '<a class="result__a" href="https://www.sequoiacap.com/">Sequoia</a>',
    'uddg=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fsomeone',
    'uddg=https%3A%2F%2Ftechcrunch.com%2F2026%2F01%2F01%2Fstory',
  ].join(' ');
  assert.deepEqual(urlsFromDuckDuckGoHtml(html), ['https://example.com', 'https://sequoiacap.com']);
  assert.equal(normalizeOfficialUrl('https://www.crunchbase.com/organization/x'), null);
});

test('Google Web search starts with ?udm=14', () => {
  const url = googleWebSearchUrl('sequoia%20capital');
  assert.match(url, /^https:\/\/www\.google\.com\/search\?udm=14&q=/);
  assert.equal(url.includes('&udm=14'), false);
});

test('Google Web ?udm=14 results keep the target and drop the redirect host', () => {
  const html = [
    '<a href="/url?q=https://sequoiacap.com/&amp;sa=U">',
    '<a href="/url?q=https://www.google.com/search%3Fq%3Dsequoia">',
    '<a href="/url?q=https://techcrunch.com/story">',
  ].join('');
  assert.deepEqual(urlsFromGoogleWebHtml(html), ['https://sequoiacap.com']);
});

test('Google News RSS keeps the firm site and drops publishers', () => {
  const xml = [
    '<source url="https://www.bloomberg.com">Bloomberg</source>',
    '<source url="https://sequoiacap.com">Sequoia Capital</source>',
    '<source url="https://techcrunch.com">TechCrunch</source>',
  ].join('');
  assert.deepEqual(urlsFromNewsRss(xml), ['https://sequoiacap.com']);
  const named = [
    '<source url="https://techfundingnews.com">techfundingnews.com</source>',
    '<source url="https://www.bvp.com">Bessemer Venture Partners</source>',
  ].join('');
  assert.deepEqual(urlsFromNewsRss(named, 'Bessemer Venture Partners'), ['https://bvp.com']);
  const loose = [
    '<source url="https://www.bowrivercapital.com">Bow River Capital</source>',
    '<source url="https://angelinvestorforum.com">Alex Pall</source>',
    '<source url="https://tfr.faa.gov">Nicolas Berggruen</source>',
  ].join('');
  assert.deepEqual(urlsFromNewsRss(loose, 'River Capital'), []);
  assert.deepEqual(urlsFromNewsRss(loose, 'Alex Pall'), []);
  assert.equal(normalizeOfficialUrl('https://tfr.faa.gov/'), null);
});

test('Mojeek results drop the engine itself', () => {
  const html = [
    '<a href="https://www.mojeek.com/about/">About</a>',
    '<a href="https://sequoiacap.com/">Sequoia</a>',
  ].join('');
  assert.deepEqual(urlsFromMojeekHtml(html), ['https://sequoiacap.com']);
});

test('paid AI credit errors are the signal to use inference and URL search', () => {
  assert.equal(isPaidAiUnavailable(new Error('Credit balance is too low')), true);
  assert.equal(isPaidAiUnavailable('Claude Code returned an error result: Credit balance is too low'), true);
  assert.equal(isPaidAiUnavailable(new Error('startup row missing')), false);
});
