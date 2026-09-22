/**
 * Account profile contract:
 *   startup description + team from preview data (never invented)
 *   saved matches stay on /account
 *   pending intros prompt Scout or Oracle — not the old 3-button loop
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

function readStartupDescription(startup) {
  if (!startup) return null;
  const ex = startup.extracted_data && typeof startup.extracted_data === 'object' ? startup.extracted_data : {};
  const candidates = [
    startup.description,
    startup.tagline,
    ex.description,
    ex.product_description,
    ex.value_proposition,
    typeof ex.pitch === 'string' ? ex.pitch : null,
  ];
  for (const value of candidates) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return null;
}

function asMember(raw) {
  if (typeof raw === 'string') {
    const name = raw.trim();
    return name ? { name } : null;
  }
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || raw.full_name || raw.founder_name || '').trim();
  if (!name) return null;
  const role = String(raw.role || raw.title || raw.position || '').trim() || undefined;
  const linkedin = String(raw.linkedin_url || raw.linkedin || '').trim() || undefined;
  return { name, role, linkedin };
}

function readStartupTeam(extracted) {
  if (!extracted || typeof extracted !== 'object') return [];
  const buckets = [extracted.founders, extracted.founding_team, extracted.team, extracted.people, extracted.team_members];
  const out = [];
  const seen = new Set();
  for (const bucket of buckets) {
    const list = Array.isArray(bucket) ? bucket : [];
    for (const item of list) {
      const member = asMember(item);
      if (!member) continue;
      const key = member.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(member);
    }
  }
  return out.slice(0, 8);
}

test('account hub builds a startup profile, saved matches, and Scout/Oracle intros', () => {
  const hub = read('site/components/FounderOnboardingHub.tsx');
  const helper = read('site/lib/founderAccountProfile.ts');
  const account = read('site/Account.tsx');

  assert.match(helper, /export function readStartupTeam/);
  assert.match(helper, /export function readStartupDescription/);
  assert.match(hub, /readStartupTeam/);
  assert.match(hub, /readStartupDescription/);
  assert.match(hub, /Startup profile/);
  assert.match(hub, /Your saved matches — \{companyLabel\}/);
  assert.match(hub, /Pending opportunities/);
  assert.match(hub, /Start Scout/);
  assert.match(hub, /Upgrade to Oracle/);
  assert.match(hub, /\/pricing\?plan=scout&source=account_connect/);
  assert.match(hub, /\/pricing\?plan=oracle&source=account_connect/);
  assert.match(hub, /Intro pending/);
  assert.doesNotMatch(hub, /Open full match list/);
  assert.doesNotMatch(hub, /Open outreach drafts/);
  assert.match(account, /pending investor intros/);
});

test('team and description readers do not invent people or copy', () => {
  assert.equal(readStartupDescription({}), null);
  assert.equal(
    readStartupDescription({ description: 'Serverless Postgres' }),
    'Serverless Postgres',
  );
  assert.equal(
    readStartupDescription({ extracted_data: { value_proposition: 'Branch your database' } }),
    'Branch your database',
  );
  assert.deepEqual(readStartupTeam(null), []);
  assert.deepEqual(readStartupTeam({ founders: ['', { name: '  ' }] }), []);
  assert.deepEqual(
    readStartupTeam({
      founders: [{ name: 'Nikita Shamgunov', title: 'CEO', linkedin: 'https://linkedin.com/in/nikita' }],
      team: [{ name: 'Nikita Shamgunov', role: 'Founder' }],
    }),
    [{ name: 'Nikita Shamgunov', role: 'CEO', linkedin: 'https://linkedin.com/in/nikita' }],
  );
});
