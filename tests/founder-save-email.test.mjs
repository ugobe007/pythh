/**
 * Founder save + email contract:
 *   1. Matches are emailed via /api/preview/email-shortlist (not the newsletter page)
 *   2. Authenticated Save persists the profile and advances to /account?saved=1
 *   3. Homepage join cannot trap the hop if subscribe fails
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('save emails the shortlist and advances to the profile', () => {
  const preview = read('site/components/InstantMatchPreview.tsx');
  const account = read('site/lib/founderAccount.ts');
  const db = read('site/db.ts');

  assert.match(account, /export async function sendSavedMatchesEmail/);
  assert.match(account, /\/api\/preview\/email-shortlist/);
  assert.match(preview, /sendSavedMatchesEmail/);
  assert.match(preview, /finishAuthenticatedSave/);
  assert.match(preview, /navigate\(savedMatchesPath\(\)\)/);
  assert.match(preview, /Save matches/);
  assert.match(preview, /Inbox \+ profile/);
  assert.match(preview, /else void finishAuthenticatedSave\(\)/);
  assert.match(preview, /Email my 5 matches/);
  assert.match(preview, /Emailed these 5 matches to/);
  assert.match(preview, /brief@pythh\.ai/);
  assert.match(preview, /Send again/);
  assert.match(account, /force: Boolean\(opts\.force\)/);
  assert.doesNotMatch(preview, /We do not email the list unless you subscribed separately/);

  const shortlist = read('server/routes/previewRoute.js');
  assert.match(shortlist, /Your \$\{listed\.length\} investor matches/);
  assert.match(shortlist, /\.slice\(0, 5\)/);
  assert.match(shortlist, /inspectMatchesUrl/);
  assert.match(shortlist, /\/matches\?url=/);
  assert.match(shortlist, /MATCHES_EMAIL_FROM/);
  assert.match(shortlist, /brief@pythh\.ai/);
  assert.match(shortlist, /if \(!force && recent/);
  assert.doesNotMatch(shortlist, /\.slice\(0, 3\)/);

  assert.match(db, /upsertFounderProfileViaRest/);
  assert.match(db, /getFounderProfileViaRest/);
  assert.match(db, /from\("pythh_founder_profiles"\)/);
  assert.match(db, /Postgres unavailable — upserting founder profile via Supabase REST/);
});

test('homepage join still opens matches when subscribe fails', () => {
  const form = read('site/components/NewsletterJoinForm.tsx');
  assert.match(form, /apiUrl\("\/api\/newsletter\/subscribe"\)/);
  assert.match(form, /onJoined\?\.\(joined\)/);
  assert.match(form, /subscribe\/email is best-effort/);
  assert.doesNotMatch(form, /We could not save that\. Please try again\./);
});

test('welcome leaves welcome_sent_at empty while matches are pending', () => {
  const welcome = read('server/lib/newsletterWelcome.js');
  assert.match(welcome, /NEWSLETTER_WELCOME_POLLS/);
  assert.match(welcome, /if \(supabase && !personal\?\.pending\)/);
  assert.match(welcome, /pending: Boolean\(personal\?\.pending\)/);
});
