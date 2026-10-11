import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function loadModule() {
  const require = createRequire(import.meta.url);
  const tsxBin = require.resolve('tsx/cli');
  const helperPath = path.join(process.cwd(), 'site/lib/founderMatchesCsv.ts');
  const script = `
    import { founderMatchesToCsv, founderMatchesCsvFilename } from ${JSON.stringify(
      pathToFileURL(helperPath).href,
    )};
    const matches = [{
      investor_id: 'inv-1',
      match_score: 88,
      fitness_score: 82,
      why_you_match: 'Sector overlap; stage fit',
      investor_class: 'vc',
      investor: {
        id: 'inv-1',
        name: 'Ada',
        firm: 'Acme Ventures',
        sectors: ['Robotics', 'AI/ML'],
        stage: ['Seed'],
        check_size_min: 250000,
        check_size_max: 1000000,
        contactable: true,
        website: 'https://acme.vc',
        linkedin_url: 'https://linkedin.com/in/ada',
        total_investments: 12,
        last_investment_date: '2026-01-01',
      },
    }];
    const startup = { id: 'st-1', name: 'Alpha', website: 'alpharoboticsai.com', god_score: 63 };
    const csv = founderMatchesToCsv(matches, startup);
    const fname = founderMatchesCsvFilename(startup);
    console.log(JSON.stringify({
      bom: csv.charCodeAt(0) === 0xfeff,
      hasFirm: csv.includes('Acme Ventures'),
      hasWhy: csv.includes('Sector overlap'),
      noEmailHeader: !csv.includes('email'),
      hasContactable: csv.includes('contactable'),
      fnameOk: /^pythh-matches-alpha-\\d{4}-\\d{2}-\\d{2}\\.csv$/.test(fname),
    }));
  `;
  const result = spawnSync(process.execPath, [tsxBin, '--eval', script], {
    encoding: 'utf8',
    cwd: process.cwd(),
  });
  if (result.status !== 0) {
    throw new Error(`tsx eval failed: ${result.stderr || result.stdout}`);
  }
  const line = (result.stdout || '').trim().split('\n').filter(Boolean).pop();
  return JSON.parse(line);
}

describe('founder matches CSV', () => {
  it('exports shortlist without email columns', () => {
    const out = loadModule();
    assert.equal(out.bom, true);
    assert.equal(out.hasFirm, true);
    assert.equal(out.hasWhy, true);
    assert.equal(out.noEmailHeader, true);
    assert.equal(out.hasContactable, true);
    assert.equal(out.fnameOk, true);
  });
});
