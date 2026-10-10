import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Load the TypeScript CSV helper via tsx (same runtime as the Vite app).
 */
function loadCsvModule() {
  const require = createRequire(import.meta.url);
  const tsxBin = require.resolve('tsx/cli');
  const helperPath = path.join(process.cwd(), 'site/lib/targetedMatchesCsv.ts');
  const script = `
    import { matchesToCsv, csvEscape, targetedMatchesCsvFilename } from ${JSON.stringify(
      pathToFileURL(helperPath).href,
    )};
    const matches = [{
      rank: 1,
      investor_id: 'inv-1',
      match_score: 88.5,
      fit_rank: 1,
      confidence_level: 'high',
      strategy: {
        why_you_match: ['Sector overlap', 'Stage fit'],
        why_you_match_text: 'Sector overlap',
        reasoning: 'Strong infra thesis',
        investment_thesis: 'Bets on developer tools',
      },
      contact: {
        email: 'a@example.com',
        email_type: 'personal',
        email_status: 'verified',
        email_source: 'hunter',
        hunter_confidence: 92,
        hunter_position: 'Partner',
        person_name: 'Ada',
        zero_bounce_status: 'valid',
        linkedin_url: 'https://linkedin.com/in/ada',
        twitter_url: null,
        website: 'https://firm.example',
        contactable: true,
      },
      investor: {
        id: 'inv-1',
        name: 'Ada Lovelace',
        firm: 'Acme Ventures',
        type: 'vc',
        sectors: ['SaaS', 'AI'],
        stage: ['Seed', 'Series A'],
        check_size_min: 500000,
        check_size_max: 2000000,
        investor_tier: 'A',
        total_investments: 40,
        last_investment_date: '2026-01-01',
      },
    }];
    const startup = {
      id: 'st-1',
      name: 'Neon',
      website: 'neon.tech',
      total_god_score: 72.4,
      sectors: ['Developer Tools'],
      stage: 'Series A',
    };
    const csv = matchesToCsv(matches, startup);
    const fname = targetedMatchesCsvFilename(startup);
    console.log(JSON.stringify({
      bom: csv.charCodeAt(0) === 0xfeff,
      hasCrlf: csv.includes('\\r\\n'),
      hasEmail: csv.includes('a@example.com'),
      hasFirm: csv.includes('Acme Ventures'),
      hasWhy: csv.includes('Sector overlap | Stage fit'),
      hasStartup: csv.includes('Neon'),
      escapedQuote: csvEscape('say "hi"') === '"say ""hi"""',
      fnameOk: /^targeted-matches-neon-\\d{4}-\\d{2}-\\d{2}\\.csv$/.test(fname),
      headerOk: csv.includes('startup_name,startup_website'),
    }));
  `;
  const result = spawnSync(process.execPath, [tsxBin, '--eval', script], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  if (result.status !== 0) {
    throw new Error(`tsx eval failed: ${result.stderr || result.stdout}`);
  }
  const line = (result.stdout || '')
    .trim()
    .split('\n')
    .filter(Boolean)
    .pop();
  return JSON.parse(line);
}

describe('targeted matches CSV', () => {
  it('builds Excel-friendly CSV with strategy + contact columns', () => {
    const out = loadCsvModule();
    assert.equal(out.bom, true);
    assert.equal(out.hasCrlf, true);
    assert.equal(out.hasEmail, true);
    assert.equal(out.hasFirm, true);
    assert.equal(out.hasWhy, true);
    assert.equal(out.hasStartup, true);
    assert.equal(out.escapedQuote, true);
    assert.equal(out.fnameOk, true);
    assert.equal(out.headerOk, true);
  });
});
