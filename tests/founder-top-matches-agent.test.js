const assert = require('node:assert/strict');
const test = require('node:test');

const { TOP_MATCH_COUNT, uniqueTopMatches, normalizeMatchReason, unsubscribeToken } = require('../lib/founderTopMatchesAgent');

test('selects exactly three canonical matches in score order with unique firms', () => {
  const rows = [
    { investor_id: 'a', match_score: 91, investors: { id: 'a', name: 'A', firm: 'Alpha' } },
    { investor_id: 'b', match_score: 95, investors: { id: 'b', name: 'B', firm: 'Beta' } },
    { investor_id: 'c', match_score: 90, investors: { id: 'c', name: 'C', firm: 'Alpha' } },
    { investor_id: 'd', match_score: 89, investors: { id: 'd', name: 'D', firm: 'Delta' } },
    { investor_id: 'e', match_score: 88, investors: { id: 'e', name: 'E', firm: 'Echo' } },
  ];
  const matches = uniqueTopMatches(rows);
  assert.equal(TOP_MATCH_COUNT, 3);
  assert.deepEqual(matches.map((m) => m.id), ['b', 'a', 'd']);
});

test('accepts investor or investors join shape for in-app drafts', () => {
  const { selectUniqueTopMatchRows, IN_APP_MATCH_COUNT } = require('../lib/founderTopMatchesAgent');
  const rows = [
    { investor_id: 'a', match_score: 70, investor: { id: 'a', name: 'A', firm: 'Alpha' } },
    { investor_id: 'b', match_score: 88, investors: { id: 'b', name: 'B', firm: 'Beta' } },
    { investor_id: 'c', match_score: 80, investor: [{ id: 'c', name: 'C', firm: 'Gamma' }] },
  ];
  const selected = selectUniqueTopMatchRows(rows, { limit: IN_APP_MATCH_COUNT });
  assert.equal(IN_APP_MATCH_COUNT, 5);
  assert.deepEqual(selected.map(({ investor }) => investor.id), ['b', 'c', 'a']);
});

test('unsubscribe tokens are deterministic and email-specific', () => {
  assert.equal(unsubscribeToken('Founder@Example.com', 'secret'), unsubscribeToken('founder@example.com', 'secret'));
  assert.notEqual(unsubscribeToken('one@example.com', 'secret'), unsubscribeToken('two@example.com', 'secret'));
});

test('wizard and draft API share the canonical match loader', async () => {
  const { readFile } = require('node:fs/promises');
  const path = require('node:path');
  const wizard = await readFile(path.join(__dirname, '..', 'server/routes/wizardRoute.js'), 'utf8');
  const drafts = await readFile(path.join(__dirname, '..', 'server/routes/outreachDraft.js'), 'utf8');
  const loader = require('../lib/loadCanonicalOutreachMatches');
  assert.equal(typeof loader.loadCanonicalOutreachMatches, 'function');
  assert.match(wizard, /loadCanonicalOutreachMatches/);
  assert.match(drafts, /draft-from-matches/);
  assert.match(drafts, /canonical-matches/);
});

test('normalizes structured canonical match reasons for email copy', () => {
  assert.equal(normalizeMatchReason(['Sector fit', 'Seed-stage fit']), 'Sector fit. Seed-stage fit');
  assert.equal(normalizeMatchReason(null), 'Matched by sector, stage, and investment thesis.');
});
