import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);

test('livewire meta uses today + GOD without inventing a 60-day hold', async () => {
  const tsx = require.resolve('tsx/cjs');
  require(tsx);
  const {
    livewireTimeLabel,
    livewireMeta,
    firmLabel,
    fillTapePage,
    livewireHeaderStatus,
    livewirePageCount,
  } = require('../site/components/LivewireMatchPanel.tsx');
  const { uniqueMatchPairs } = require('../site/components/RecentMatchesFeed.tsx');

  assert.equal(livewireTimeLabel('just now'), 'today');
  assert.equal(livewireTimeLabel('12m ago'), 'today');
  assert.equal(livewireTimeLabel('3h ago'), 'today');
  assert.equal(livewireTimeLabel('2d ago'), '2d ago');

  assert.equal(livewireMeta({ time_ago: '4h ago', startup_god_score: 55 }), 'today -- 55');
  assert.equal(livewireMeta({ time_ago: '2d ago', startup_god_score: null }), '2d ago');
  assert.equal(
    firmLabel({ investor_firm: 'Headline', investor_name: 'Jane Doe' }),
    'Headline',
  );

  assert.deepEqual(fillTapePage(['a', 'b', 'c', 'd'], 1, 3), ['a', 'b', 'c']);
  assert.deepEqual(fillTapePage(['a', 'b', 'c', 'd', 'e', 'f'], 0, 6), ['a', 'b', 'c', 'd', 'e', 'f']);
  assert.deepEqual(
    fillTapePage(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'], 1, 6),
    ['g', 'h', 'i', 'j', 'k', 'l'],
  );
  assert.deepEqual(
    fillTapePage(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n'], 1, 6),
    ['g', 'h', 'i', 'j', 'k', 'l'],
  );
  assert.equal(livewirePageCount(14, 6), 2);
  assert.equal(livewirePageCount(14, 6, 2), 2);
  assert.equal(livewirePageCount(6, 6, 2), 2);
  assert.equal(livewireHeaderStatus(true, 0, 0, 2), 'Refreshing');
  assert.equal(livewireHeaderStatus(false, 6, 1, 3), '2 of 3');
  assert.equal(livewireHeaderStatus(false, 6, 0, 1), 'Live network');

  const surfaced = uniqueMatchPairs([
    { startup_name: 'AssetPlus', investor_firm: 'Headline', investor_name: 'A', match_score: 50 },
    { startup_name: 'Summit Wealth', investor_firm: 'Headline', investor_name: 'B', match_score: 55 },
    { startup_name: 'Scotch', investor_firm: 'Coinbase Ventures', investor_name: 'C', match_score: 65 },
    { startup_name: 'AssetPlus', investor_firm: 'Headline', investor_name: 'A', match_score: 50 },
  ], 18);
  assert.deepEqual(surfaced.map((m) => m.startup_name), ['AssetPlus', 'Scotch']);
  assert.deepEqual(surfaced.map((m) => m.investor_firm), ['Headline', 'Coinbase Ventures']);
});

test('feedInvestorKey collapses Headline name and firm to one tape slot', () => {
  const { feedInvestorKey } = require('../server/lib/feedNameGuards.js');
  assert.equal(feedInvestorKey('Headline', 'Headline'), 'headline');
  assert.equal(feedInvestorKey('Jane Doe', 'Headline'), 'headline');
  assert.equal(feedInvestorKey('Coinbase Ventures', '-'), 'coinbase ventures');
});

test('live tape renders two filled livewire match panels', () => {
  const tape = readFileSync(new URL('../site/components/HomeLiveNetwork.tsx', import.meta.url), 'utf8');
  assert.match(tape, /id="live-matches"/);
  assert.match(tape, /id="live-matches-next"/);
  assert.match(tape, /nextPage/);
  assert.match(tape, /showSecond/);
  assert.match(tape, /livewirePageCount/);
  assert.doesNotMatch(tape, /showFunding/);
});

test('recent-matches is one slim query, not an 800-row scan', () => {
  const src = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  const start = src.indexOf("app.get('/api/recent-matches'");
  const end = src.indexOf("app.get('/api/live-pairings'");
  assert.ok(start > 0 && end > start);
  const handler = src.slice(start, end);
  assert.match(handler, /SCAN = 1000/);
  assert.match(handler, /select\('id, startup_id, investor_id, match_score, created_at'\)/);
  assert.match(handler, /startupsById/);
  assert.match(handler, /investorsById/);
  assert.doesNotMatch(handler, /MAX_SCAN/);
  assert.doesNotMatch(handler, /PAGE\s*=\s*80/);
  assert.doesNotMatch(handler, /startup_uploads!startup_id/);
  assert.doesNotMatch(handler, /reasoning,\s*why_you_match/);
  assert.match(handler, /seenFirms/);
  assert.match(handler, /one-firm/);
});

test('livewire first paint fetches recent-matches only', () => {
  const src = readFileSync(new URL('../site/components/RecentMatchesFeed.tsx', import.meta.url), 'utf8');
  assert.match(src, /peekCachedMatches/);
  assert.match(src, /pythh_livewire_matches/);
  assert.match(src, /if \(inflight\) return inflight/);
  assert.match(src, /if \(recent\.length > 0\) return recent/);
  assert.doesNotMatch(src, /Promise\.all\(/);
  assert.doesNotMatch(src, /const hotPromise = fetchHotMatches/);
});
