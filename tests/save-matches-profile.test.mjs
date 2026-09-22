/**
 * Save / improve contract after the match preview:
 *   - Scout upsell stays off the match page
 *   - anonymous founders get two improve passes
 *   - Save lands on /account?saved=1 (and emails the shortlist — never the newsletter page)
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
  assert.match(quota, /export function optOutOfImprove/);
  assert.match(quota, /export function hasOptedOutOfImprove/);
  assert.match(quota, /pythh_improve_matches_count/);
  assert.match(quota, /pythh_improve_matches_opt_out/);
});

test('match preview lets founders improve twice, then save to their profile', () => {
  const preview = read('site/components/InstantMatchPreview.tsx');
  assert.match(preview, /ANON_IMPROVE_LIMIT/);
  assert.match(preview, /canImproveAnonymously/);
  assert.match(preview, /recordImproveCompletion/);
  assert.match(preview, /Improve my matches/);
  assert.match(preview, /Save my matches/);
  assert.match(preview, /Skip — save my matches/);
  assert.match(preview, /skipImprove/);
  assert.match(preview, /optOutOfImprove/);
  assert.match(preview, /finishAuthenticatedSave/);
  assert.match(preview, /navigate\(savedMatchesPath\(\)\)/);
  assert.match(preview, /sendSavedMatchesEmail/);
  assert.match(preview, /IMPROVE_CTA_STYLE/);
  assert.match(preview, /PURPLE_ACCENT/);
  assert.match(preview, /savedMatchesPath\(\)/);
  assert.doesNotMatch(preview, /PaidRaisePanel/);
  assert.doesNotMatch(preview, /Start Scout/);
  assert.match(preview, /emails this shortlist/);
});

test('improve and automate outreach use different CTA colors', () => {
  const preview = read('site/components/InstantMatchPreview.tsx');
  const round = read('site/components/wizard/RoundAutomation.tsx');
  const panel = read('site/components/ImproveMatchesPanel.tsx');
  assert.match(preview, /IMPROVE_CTA_STYLE/);
  assert.match(preview, /PURPLE_ACCENT/);
  assert.match(preview, /NEXT_STEP_CTA_STYLE/);
  assert.match(round, /Improve matches →/);
  assert.match(round, /Automate outreach →/);
  assert.match(round, /oklch\(0\.72 0\.16 305\)/);
  assert.match(round, /oklch\(0\.696 0\.17 162\.48\)/);
  assert.match(round, /Skip improve — keep these matches/);
  assert.match(panel, /Skip — keep these matches/);
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
  assert.match(signup, /we email the ranked list/);
  assert.match(signup, /sendSavedMatchesEmail/);
  assert.match(hub, /Review them here/);
  assert.match(hub, /Your saved matches — \$\{companyLabel\}/);
  assert.match(hub, /source=account_saved/);
  assert.doesNotMatch(hub, /Open full match list/);
  assert.doesNotMatch(hub, /Open outreach drafts/);
  assert.doesNotMatch(hub, /Optional Oracle improvements/);
  assert.match(account, /get\("saved"\) === "1"/);
  assert.match(account, /Your saved matches/);
  assert.match(nav, /href="\/account\?saved=1"/);
  assert.match(nav, /My matches/);
  assert.doesNotMatch(signup, /href=["']\/newsletter["']/);
});
