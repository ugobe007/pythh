import test from 'node:test';
import assert from 'node:assert/strict';
import {
  urlsFromDuckDuckGoHtml,
  urlsFromGoogleWebHtml,
  urlsFromMojeekHtml,
  normalizeOfficialUrl,
  googleWebSearchUrl,
} from '../lib/urlSearchService.mjs';
import { isPaidAiUnavailable } from '../scripts/lib/paidAiFallback.mjs';

test('URL search service keeps official hosts and drops publishers', () => {
  const html = [
    'uddg=https%3A%2F%2Fexample.com%2Fabout',
    'uddg=https%3A%2F%2Fwww.linkedin.com%2Fin%2Fsomeone',
    'uddg=https%3A%2F%2Ftechcrunch.com%2F2026%2F01%2F01%2Fstory',
  ].join(' ');
  assert.deepEqual(urlsFromDuckDuckGoHtml(html), ['https://example.com']);
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
