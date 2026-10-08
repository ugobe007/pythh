/**
 * Word-boundary contract for infer_sectors_from_text.
 * The live parser is the SQL function in
 * supabase/migrations/20261008033000_fix_infer_sectors_word_boundaries.sql.
 * This test reads those sector patterns so a headline like
 * "Legal Services Startup …" cannot regress to Gaming.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const SQL_PATH = new URL(
  '../supabase/migrations/20261008033000_fix_infer_sectors_word_boundaries.sql',
  import.meta.url,
);

function sectorPatterns(sql) {
  const out = {};
  const re = /-- sector:([^\n]+)\n\s*IF v_text_lower ~ '([^']+)'/g;
  let m;
  while ((m = re.exec(sql))) out[m[1].trim()] = m[2];
  return out;
}

/** Postgres \m / \M on ASCII, after the function lowercases the text. */
function pgMatch(text, pattern) {
  const js = pattern
    .replace(/\\m/g, '(?<![a-z0-9_])')
    .replace(/\\M/g, '(?![a-z0-9_])');
  return new RegExp(js, 'i').test(String(text).toLowerCase());
}

const sql = readFileSync(SQL_PATH, 'utf8');
const patterns = sectorPatterns(sql);

test('migration publishes the three tightened sector patterns', () => {
  assert.ok(patterns.Gaming);
  assert.ok(patterns['Climate Tech']);
  assert.ok(patterns.PropTech);
  assert.match(patterns.Gaming, /\\m\(vr\|ar\)\\M/);
  assert.doesNotMatch(patterns.Gaming, /\|ar\|/);
  assert.match(patterns['Climate Tech'], /\\m\(ev\|evs\|green\|wind\)\\M/);
  assert.doesNotMatch(patterns.PropTech, /building/);
});

test('startup headlines are not Gaming', () => {
  const gaming = patterns.Gaming;
  const misses = [
    'Legal Services Startup Teddy AI Announces $60M Seed Round - Law.com',
    'BioRender launches AI agent for building scientific research images',
    'Edmonton Unlimited announces Deep Tech Foundry program at Startup Week',
    'Robot data startup Mecka AI nabs $60M from Sequoia',
    'Secur3D raises $128K as it expands Sentry coverage to 27 marketplaces',
    'Mike Karadimas on Turning Family History Into a Crime Thriller',
  ];
  for (const line of misses) {
    assert.equal(pgMatch(line, gaming), false, line);
  }
});

test('real game language is still Gaming', () => {
  const gaming = patterns.Gaming;
  for (const line of [
    'Northstar raises $20M for its game studio',
    'esports platform hosts a tournament',
    'AR headset startup ships a VR game',
    'virtual reality gaming company',
  ]) {
    assert.equal(pgMatch(line, gaming), true, line);
  }
});

test('revenue and developer are not Climate Tech; a real EV line is', () => {
  const climate = patterns['Climate Tech'];
  assert.equal(pgMatch('developer revenue every quarter', climate), false);
  assert.equal(pgMatch('window washing service', climate), false);
  assert.equal(pgMatch('climate tech startup raises for carbon capture', climate), true);
  assert.equal(pgMatch('EV charging network raises a seed round', climate), true);
  assert.equal(pgMatch('offshore wind project', climate), true);
});

test('building an image is not PropTech; real estate is', () => {
  const prop = patterns.PropTech;
  assert.equal(
    pgMatch('BioRender launches AI agent for building scientific research images', prop),
    false,
  );
  assert.equal(pgMatch('real estate mortgage startup', prop), true);
});
