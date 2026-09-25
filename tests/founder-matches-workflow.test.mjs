/**
 * Founder raise workflow contract.
 *
 * Canonical hops:
 *   URL submit → /matches?url= → Save my matches → /signup/founder?intent=matches
 *   → /account?saved=1  (never /newsletter, never /app/radar, never /activate)
 *
 * This script flags malformed destinations in the live source so a CTA
 * cannot silently dump founders onto the brief or the old wizard hub.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

function matchesPreviewPath(url) {
  const trimmed = String(url || '').trim();
  const normalized = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
  return `/matches?url=${encodeURIComponent(normalized)}`;
}

function founderSignupPath({ startupId, url, intent = 'matches' } = {}) {
  const params = new URLSearchParams();
  if (startupId) params.set('startup_id', startupId);
  if (url) params.set('url', url);
  if (intent) params.set('intent', intent);
  return `/signup/founder?${params.toString()}`;
}

function buildLoginRedirectForSearch(url) {
  const next = matchesPreviewPath(url);
  const params = new URLSearchParams({ redirect: next, reason: 'second_search' });
  return `/login?${params.toString()}`;
}

function resolveLoginRedirect(search) {
  const params = new URLSearchParams(search);
  const redirect = params.get('redirect') || params.get('next');
  if (redirect?.startsWith('/') && !redirect.startsWith('//')) return redirect;
  return '/account';
}

function loginAccountHandoffPath(search) {
  const next = resolveLoginRedirect(search);
  if (!next || next === '/account') return '/account';
  return `/account?next=${encodeURIComponent(next)}`;
}

const FORBIDDEN_SAVE_HOPS = [
  '/newsletter',
  '/app/radar',
  '/signals',
  'Get daily matches',
  'Get my daily matches',
];

test('path builders keep the URL attached through save and login', () => {
  assert.equal(
    matchesPreviewPath('orbital-ai.io'),
    '/matches?url=https%3A%2F%2Forbital-ai.io',
  );
  assert.equal(
    matchesPreviewPath('https://orbital-ai.io'),
    '/matches?url=https%3A%2F%2Forbital-ai.io',
  );

  const signup = founderSignupPath({
    startupId: 'e2c984e5-96b2-4ddd-bc11-c9d866443984',
    url: 'https://orbital-ai.io',
  });
  const signupParams = new URLSearchParams(signup.slice(signup.indexOf('?')));
  assert.equal(signup.startsWith('/signup/founder?'), true);
  assert.equal(signupParams.get('intent'), 'matches');
  assert.equal(signupParams.get('url'), 'https://orbital-ai.io');
  assert.equal(signupParams.get('startup_id'), 'e2c984e5-96b2-4ddd-bc11-c9d866443984');

  const login = buildLoginRedirectForSearch('https://orbital-ai.io');
  const loginParams = new URLSearchParams(login.slice(login.indexOf('?')));
  assert.equal(login.startsWith('/login?'), true);
  assert.equal(loginParams.get('reason'), 'second_search');
  assert.equal(loginParams.get('redirect'), '/matches?url=https%3A%2F%2Forbital-ai.io');
  assert.equal(
    resolveLoginRedirect(login.slice(login.indexOf('?'))),
    '/matches?url=https%3A%2F%2Forbital-ai.io',
  );
  assert.equal(
    loginAccountHandoffPath(login.slice(login.indexOf('?'))),
    '/account?next=%2Fmatches%3Furl%3Dhttps%253A%252F%252Forbital-ai.io',
  );
  assert.equal(loginAccountHandoffPath(''), '/account');
  assert.equal(resolveLoginRedirect('?redirect=https://evil.example'), '/account');
});

test('homepage and find-investors submit only open /matches?url=', () => {
  const home = read('site/Home.tsx');
  const find = read('site/pages/FindInvestors.tsx');
  const helper = read('site/lib/openFirstMatches.ts');
  assert.match(helper, /function persistJoinPreview/);
  assert.match(helper, /return matchesPreviewPath\(normalized\)/);
  assert.doesNotMatch(helper, /\/newsletter/);
  assert.doesNotMatch(helper, /\/signup\/founder/);
  assert.match(home, /persistJoinPreview\(url, email\)/);
  assert.match(home, /revealMatches/);
  assert.doesNotMatch(home, /signup\/founder\?intent=matches/);
  assert.match(find, /navigate\(`\/matches\?url=\$\{encodeURIComponent\(normalized\)\}`\)/);
});

test('Save my matches stays on founder signup — never the newsletter', () => {
  const preview = read('site/components/InstantMatchPreview.tsx');
  const safe = read('site/lib/safeUrl.ts');
  const gate = read('site/lib/founderSignupGate.ts');
  const signup = read('site/pages/FounderSignup.tsx');

  assert.match(preview, /Start this raise/);
  assert.match(preview, /handleSignup\('save'\)/);
  assert.match(preview, /founderSignupPath\(\{ startupId: startupIdForGate, url, intent: 'matches' \}\)/);
  assert.match(preview, /ANON_IMPROVE_LIMIT/);
  assert.match(preview, /recordImproveCompletion/);
  assert.match(preview, /optOutOfImprove/);
  assert.match(preview, /Skip — save my matches/);
  assert.match(preview, /finishAuthenticatedSave/);
  assert.match(preview, /navigate\(savedMatchesPath\(\)\)/);
  assert.match(preview, /sendSavedMatchesEmail/);
  assert.doesNotMatch(preview, /PaidRaisePanel/);
  assert.doesNotMatch(preview, /Start Scout/);
  for (const hop of FORBIDDEN_SAVE_HOPS) {
    assert.doesNotMatch(preview, new RegExp(hop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(preview, /href=["']\/newsletter["']/);
  assert.doesNotMatch(preview, /href=["']\/activate["']/);

  assert.match(safe, /intent\?: 'matches'/);
  assert.match(safe, /return `\/signup\/founder/);

  assert.match(gate, /\/matches\?url=/);
  assert.match(gate, /export function savedMatchesPath/);
  assert.match(gate, /action === 'save'\) return savedMatchesPath/);
  assert.doesNotMatch(gate, /force_wizard=1&tab=round/);
  assert.match(signup, /navigate\(savedMatchesPath\(\)\)/);
  assert.match(signup, /readQueryParam\('intent'\) === 'matches'/);
  assert.doesNotMatch(signup, /href=["']\/newsletter["']/);
});

test('login must keep a matches redirect when finishing OAuth', () => {
  const login = read('site/pages/Login.tsx');
  const oauth = read('site/lib/supabaseOAuth.ts');
  assert.match(oauth, /export function loginAccountHandoffPath/);
  assert.match(oauth, /export function resolveLoginRedirect/);
  assert.match(login, /loginAccountHandoffPath\(\)/);
  assert.match(login, /resolveLoginRedirect\(\)/);
  assert.doesNotMatch(login, /replace\(["']\/account["']\)/);
});

test('wizard returns to the account profile, not /activate or a save loop', () => {
  const wizard = read('site/pages/Wizard.tsx');
  assert.match(wizard, /navigate\(savedMatchesPath\(\)\)/);
  assert.match(wizard, /Back to your account/);
  assert.match(wizard, /Return to your account/);
  assert.doesNotMatch(wizard, /Back to my full match list/);
  assert.doesNotMatch(
    wizard,
    /Return to your account[\s\S]{0,80}href=["']\/activate["']/,
  );
  assert.doesNotMatch(
    wizard,
    /Back to your account[\s\S]{0,200}navigate\(`\/activate/,
  );
});

test('app router still mounts the live founder hops', () => {
  const app = read('site/App.tsx');
  assert.match(app, /path=\{\s*["']\/matches["']\s*\}/);
  assert.match(app, /path=\{\s*["']\/signup\/founder["']\s*\}/);
  assert.match(app, /path=\{\s*["']\/newsletter\/:date["']\s*\}/);
  assert.doesNotMatch(app, /path=\{\s*["']\/app\/radar["']\s*\}/);
});

test('legacy playwright workflow spec must not be the live contract', () => {
  const stale = read('tests/pythh-workflow.spec.ts');
  assert.match(stale, /\/app\/radar/);
  assert.doesNotMatch(read('site/App.tsx'), /\/app\/radar/);
});
