import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  PYTHIAM_PORTFOLIO_CSV_COLUMNS,
  escapeCsvValue,
  portfolioEntriesToCsv,
  rowFromPortfolioEntry,
} from '../lib/pythiamPortfolioCsv.mjs';

test('maps a portfolio card into investor-review columns', () => {
  const row = rowFromPortfolioEntry({
    startup_id: '23dad51a-54e7-4f72-b91e-f43bf13eed08',
    startup_name: 'Addi',
    website: 'https://addi.com',
    brief_description: 'Credit for LatAm commerce',
    primary_sector: 'FinTech',
    current_stage: 'Series C',
    status: 'active',
    health_tier: 'core',
    entry_date: '2025-12-02T12:00:00.000Z',
    entry_god_score: 82,
    current_god_score: 84,
    god_delta: 2,
    moic: 4.2,
    irr_annualized: 1.25,
    entry_valuation_usd: 400000000,
    current_valuation_usd: 1680000000,
    latest_round_type: 'Series C',
    latest_round_post_money: 1680000000,
    latest_lead_investor: 'Citi',
    total_rounds_tracked: 3,
    signal_score: 7.4,
    sector_god_percentile: 88,
    days_since_last_event: 12,
    verified_funding_last_90d: 1,
    entered_late: false,
    virtual_check_usd: 100000,
  });

  assert.equal(row.name, 'Addi');
  assert.equal(row.pythh_url, 'https://pythh.ai/portfolio/23dad51a-54e7-4f72-b91e-f43bf13eed08');
  assert.equal(row.entry_date, '2025-12-02');
  assert.equal(row.irr_pct, 125);
  assert.equal(row.entered_late, 'no');
  assert.equal(row.latest_lead_investor, 'Citi');
});

test('CSV escapes commas and quotes and keeps a header row', () => {
  assert.equal(escapeCsvValue('Acme, Inc'), '"Acme, Inc"');
  assert.equal(escapeCsvValue('He said "hi"'), '"He said ""hi"""');

  const csv = portfolioEntriesToCsv([
    {
      startup_id: 'abc',
      startup_name: 'Foo, Bar',
      website: 'https://foo.bar',
      status: 'active',
      health_tier: 'review',
      entry_date: '2026-01-15T00:00:00.000Z',
      entry_god_score: 71,
    },
  ]);
  const lines = csv.trim().split('\n');
  assert.equal(lines[0], PYTHIAM_PORTFOLIO_CSV_COLUMNS.join(','));
  assert.match(lines[1], /^"Foo, Bar",/);
  assert.equal(lines.length, 2);
});

test('portfolio page and API expose the investor-review CSV', () => {
  const page = readFileSync(new URL('../site/pages/Portfolio.tsx', import.meta.url), 'utf8');
  const server = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  assert.match(page, /\/api\/portfolio\/export\.csv/);
  assert.match(server, /app\.get\('\/api\/portfolio\/export\.csv'/);
});
