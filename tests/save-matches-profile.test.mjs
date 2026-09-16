/**
 * Save / improve contract after the match preview:
 *   - Scout upsell stays off the match page
 *   - anonymous founders get two improve passes
 *   - Save lands on /account?saved=1, not an email or the newsletter
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('anonymous improve quota is two per startup', () => {
  const quota = read('site/lib/improveMatchesQuota.ts');
  assert.match(quota, /export const ANON_IMPROVE_LIMIT = 2/);
  assert.match(quota, /export function recordImproveCompletion/);
  assert.match(quota, /export function canImproveAnonymously/);
  assert.match(quota, /pythh_improve_matches_count/);
});

test('match preview lets founders improve twice, then save to their profile', () => {
  const preview = read('site/components/InstantMatchPreview.tsx');
  assert.match(preview, /ANON_IMPROVE_LIMIT/);
  assert.match(preview, /canImproveAnonymously/);
  assert.match(preview, /recordImproveCompletion/);
  assert.match(preview, /Improve my matches/);
  assert.match(preview, /Save my matches/);
  assert.match(preview, /savedMatchesPath\(\)/);
  assert.doesNotMatch(preview, /PaidRaisePanel/);
  assert.doesNotMatch(preview, /Start Scout/);
  assert.match(preview, /We do not email the list unless you subscribed separately/);
});

test('save signup lands on the account profile, not the newsletter', () => {
  const gate = read('site/lib/founderSignupGate.ts');
  const signup = read('site/pages/FounderSignup.tsx');
  const hub = read('site/components/FounderOnboardingHub.tsx');
  const account = read('site/Account.tsx');
  const nav = read('site/components/SharedNavbar.tsx');

  assert.match(gate, /export function savedMatchesPath\(\): string \{\n  return '\/account\?saved=1';/);
  assert.match(signup, /navigate\(savedMatchesPath\(\)\)/);
  assert.match(signup, /Saved on your profile/);
  assert.match(signup, /We do not email the list unless you subscribed separately/);
  assert.match(hub, /Your saved matches — \$\{companyLabel\}/);
  assert.match(hub, /source=account_saved/);
  assert.match(account, /get\("saved"\) === "1"/);
  assert.match(account, /Your saved matches/);
  assert.match(nav, /href="\/account\?saved=1"/);
  assert.match(nav, /My matches/);
  assert.doesNotMatch(signup, /href=["']\/newsletter["']/);
});
