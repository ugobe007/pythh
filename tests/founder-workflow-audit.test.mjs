/**
 * Founder hop audit — after Save, one destination and one CTA.
 *
 * Canonical path:
 *   URL → /matches?url= → Save → /account?saved=1
 *   Account reviews the shortlist. Upgrade to Oracle is the only next hop.
 *   /matches must not re-offer Save after the shortlist is already saved.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

function extractDomain(url) {
  if (!url) return '';
  let s = String(url).trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
  return s;
}

function urlsShareDomain(a, b) {
  const left = extractDomain(a);
  const right = extractDomain(b);
  if (!left || !right) return false;
  return left === right || left.endsWith(`.${right}`) || right.endsWith(`.${left}`);
}

function startupAlreadyOnAccount(opts) {
  const previewId = String(opts.previewStartupId || '').trim();
  if (previewId && opts.profileStartupId === previewId) {
    return true;
  }
  const previewUrl = String(opts.previewUrl || '').trim();
  if (!previewUrl) return false;
  return urlsShareDomain(previewUrl, opts.profileUrl);
}

test('account hub has one CTA after save — Upgrade to Oracle', () => {
  const hub = read('site/components/FounderOnboardingHub.tsx');
  assert.match(hub, /Upgrade to Oracle/);
  assert.match(hub, /Start Scout/);
  assert.match(hub, /Pending opportunities/);
  assert.match(hub, /Startup profile/);
  assert.match(hub, /showUpgrade/);
  assert.doesNotMatch(hub, /Open full match list/);
  assert.doesNotMatch(hub, /Open outreach drafts/);
  assert.doesNotMatch(hub, /Optional Oracle improvements/);
  assert.doesNotMatch(hub, /Learn how matching works/);
  assert.doesNotMatch(hub, /outreachPath\(/);
  assert.doesNotMatch(hub, /improvementsPath\(/);
  assert.match(hub, /!hasPinnedStartup && \(/);
});

test('saved preview does not re-offer Save or bounce back to itself', () => {
  const preview = read('site/components/InstantMatchPreview.tsx');
  const account = read('site/Account.tsx');
  const signup = read('site/pages/FounderSignup.tsx');
  const nav = read('site/components/SharedNavbar.tsx');
  const gate = read('site/lib/founderSignupGate.ts');
  const founderAccount = read('site/lib/founderAccount.ts');

  assert.match(preview, /alreadySaved/);
  assert.match(preview, /alreadyOnAccount/);
  assert.match(preview, /startupAlreadyOnAccount/);
  assert.match(preview, /Review your account/);
  assert.match(preview, /href=\{savedMatchesPath\(\)\}/);
  assert.match(preview, /navigate\(savedMatchesPath\(\)\)/);
  assert.match(preview, /if \(isAuthenticated\) \{/);
  assert.match(preview, /if \(alreadyOnAccount\)/);
  assert.doesNotMatch(preview, /Open your saved matches/);
  assert.doesNotMatch(preview, /Open full match list/);
  assert.doesNotMatch(preview, /Confirm your round/);

  assert.match(gate, /export function startupAlreadyOnAccount/);
  assert.match(gate, /if \(!left \|\| !right\) return false/);
  assert.match(founderAccount, /pinActiveStartup\(opts\.startupId/);

  assert.match(account, /onSavedAccount/);
  assert.match(account, /do not bounce a just-saved founder back to \/matches/);
  assert.match(account, /showUpgrade=\{!subscription\}/);
  assert.match(account, /keep visible after Save/);
  assert.doesNotMatch(account, /!showSaved && subscription && \(/);
  assert.match(signup, /navigate\(savedMatchesPath\(\)\)/);
  assert.doesNotMatch(signup, /navigate\(matchesPathForUrl/);

  assert.match(nav, /href="\/account\?saved=1"/);
  assert.match(nav, /!isAuthenticated && !hidePrimaryCta/);
  assert.doesNotMatch(nav, /StartupCTA href="\/matches"/);
});

test('activation email and wizard do not reopen the three-CTA save loop', () => {
  const email = read('server/lib/founderActivationEmail.js');
  const wizard = read('site/pages/Wizard.tsx');
  assert.match(email, /\/account\?saved=1/);
  assert.doesNotMatch(email, /Open outreach drafts/);
  assert.doesNotMatch(email, /Optional Oracle improvements/);
  assert.match(wizard, /savedMatchesPath\(\)/);
  assert.doesNotMatch(wizard, /Back to my full match list/);
});

test('signed-in preview CTA is a real /account link, never a dead Save or signup', () => {
  const preview = read('site/components/InstantMatchPreview.tsx');
  assert.match(preview, /href=\{savedMatchesPath\(\)\}/);
  assert.match(preview, /These matches are on your account/);
  assert.match(preview, /const alreadySaved = Boolean\(isAuthenticated\)/);
  assert.match(preview, /if \(isAuthenticated\) \{/);
  assert.match(preview, /openAccount\(\)/);
  assert.doesNotMatch(preview, /canConfirmRound/);
});

test('saved-startup identity requires an id or a real domain, never an empty URL', () => {
  assert.equal(startupAlreadyOnAccount({ previewUrl: 'https://neon.tech' }), false);
  assert.equal(
    startupAlreadyOnAccount({ previewStartupId: 'a', profileStartupId: 'a' }),
    true,
  );
  assert.equal(
    startupAlreadyOnAccount({
      previewUrl: 'https://neon.tech',
      profileUrl: 'https://www.neon.tech',
    }),
    true,
  );
  assert.equal(
    startupAlreadyOnAccount({
      previewUrl: 'https://neon.tech',
      pinnedUrl: 'neon.tech',
    }),
    false,
  );
  assert.equal(
    startupAlreadyOnAccount({
      previewUrl: 'https://neon.tech',
      profileUrl: '',
      pinnedUrl: '',
    }),
    false,
  );
  assert.equal(
    startupAlreadyOnAccount({
      previewStartupId: 'a',
      profileStartupId: 'b',
      previewUrl: 'https://neon.tech',
      profileUrl: 'https://other.com',
    }),
    false,
  );
});
