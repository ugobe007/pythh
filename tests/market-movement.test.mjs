import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  classifyMarketMovement,
  curatedMarketMovements,
  curatedDiscoveryRows,
  mergeShowcase,
} from '../lib/marketMovement.mjs';

const discovery = readFileSync(new URL('../scripts/intelligence/discover-hot-startups.js', import.meta.url), 'utf8');
const server = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
const home = readFileSync(new URL('../site/Home.tsx', import.meta.url), 'utf8');
const viteConfig = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8');

test('revenue breakouts name the company and outrank a normal round', () => {
  const movement = classifyMarketMovement(
    'AI Video Platform Higgsfield Says It Has Gone From $1 Million ARR To $1 Billion ARR Faster Than Anthropic',
  );
  assert.equal(movement.kind, 'revenue_breakout');
  assert.equal(movement.companyName, 'Higgsfield');
  assert.ok(movement.heat >= 98);
  assert.equal(movement.sector, 'AI video');
});

test('mega-acquisitions keep the startup, not the buyer', () => {
  const announced = classifyMarketMovement('SpaceX to acquire Cursor for $60B in stock');
  assert.equal(announced.kind, 'acquisition');
  assert.equal(announced.companyName, 'Cursor');
  assert.equal(announced.counterparty, 'SpaceX');
  assert.equal(announced.heat, 99);

  const closed = classifyMarketMovement('SpaceX officially closes its Cursor acquisition');
  assert.equal(closed.companyName, 'Cursor');
  assert.equal(closed.counterparty, 'SpaceX');

  const joined = classifyMarketMovement('Cursor is now a part of SpaceX');
  assert.equal(joined.companyName, 'Cursor');
  assert.equal(joined.counterparty, 'SpaceX');
});

test('stealth energy companies count as growth, not a missed headline', () => {
  const movement = classifyMarketMovement(
    'Parallax is emerging from stealth today with $117 million to build turbines for AI data centers',
  );
  assert.equal(movement.kind, 'growth');
  assert.equal(movement.companyName, 'Parallax');
  assert.equal(movement.sector, 'Energy for AI');
  assert.ok(movement.signals.includes('funding'));
  assert.ok(movement.heat >= 93);
});

test('a new venture fund is investor movement, not a startup round', () => {
  const movement = classifyMarketMovement(
    'The ARK Venture Fund seeks to democratize venture capital across private and public companies',
  );
  assert.equal(movement.kind, 'new_fund');
  assert.equal(movement.companyName, 'ARK Venture');
  assert.equal(movement.sector, 'Crossover fund');
});

test('ordinary product news is not market movement', () => {
  assert.equal(classifyMarketMovement('Apple announces the new iPhone'), null);
  assert.equal(classifyMarketMovement('customer acquisition cost improved this quarter'), null);
});

test('showcase catalog sources the four movements the feeds missed', () => {
  const cards = curatedMarketMovements();
  assert.deepEqual(cards.map((card) => card.name), ['Higgsfield', 'Parallax', 'Cursor', 'ARK Venture']);
  for (const card of cards) {
    assert.match(card.sourceUrl, /^https:\/\//);
    assert.match(card.detail, /\S/);
    assert.match(card.caveat, /\S/);
  }
  assert.match(cards[0].detail, /not audited annual revenue/);
  assert.match(cards[2].detail, /\$60 billion/);
  assert.match(cards[3].detail, /\$1\.3 billion/);

  const rows = curatedDiscoveryRows();
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((row) => row.signals[0]), [
    'revenue_breakout',
    'growth',
    'acquisition',
    'new_fund',
  ]);
  assert.equal(rows[1].company_url, null);
});

test('live discoveries append without duplicating a curated company', () => {
  const merged = mergeShowcase(curatedMarketMovements(), [
    {
      company_name: 'Higgsfield',
      headline: 'duplicate',
      signals: ['revenue_breakout'],
      heat_score: 99,
    },
    {
      company_name: 'Cellares',
      headline: 'ARK joins a $277 million Series D',
      summary: 'Crossover check into cell-therapy manufacturing.',
      signals: ['funding_round'],
      sector_guess: 'Biotech',
      heat_score: 86,
      source_url: 'https://www.cellares.com/news/cathie-woods-ark-invest-joins-cellares-277-million-series-d/',
    },
  ]);
  assert.equal(merged.filter((card) => card.name === 'Higgsfield').length, 1);
  assert.equal(merged.at(-1).name, 'Cellares');
  assert.equal(merged.at(-1).kind, 'funding_round');
});

test('discovery and the homepage both use the movement catalog', () => {
  assert.match(discovery, /classifyMarketMovement/);
  assert.match(discovery, /curatedDiscoveryRows/);
  assert.match(discovery, /signals\?\.includes\('acquisition'\)/);
  assert.match(discovery, /signals\?\.includes\('new_fund'\)/);
  assert.match(server, /\/api\/market\/movement/);
  assert.match(server, /mergeShowcase/);
  assert.match(home, /MarketMovementShowcase/);
  assert.match(viteConfig, /@marketMovement/);
});
