import test from 'node:test';
import assert from 'node:assert/strict';
import { urlsFromDuckDuckGoHtml, normalizeOfficialUrl } from '../lib/urlSearchService.mjs';
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

test('paid AI credit errors are the signal to use inference and URL search', () => {
  assert.equal(isPaidAiUnavailable(new Error('Credit balance is too low')), true);
  assert.equal(isPaidAiUnavailable('Claude Code returned an error result: Credit balance is too low'), true);
  assert.equal(isPaidAiUnavailable(new Error('startup row missing')), false);
});
