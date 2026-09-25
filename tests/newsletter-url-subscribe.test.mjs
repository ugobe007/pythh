import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeEmail, normalizeStartupUrl, isValidEmail } = require('../server/lib/newsletterSubscribe.js');
const { sendSubscriberWelcome } = require('../server/lib/newsletterWelcome.js');
const {
  buildBriefEmailHtml,
  buildBriefEmailText,
  buildWelcomeEmailHtml,
  buildWelcomeEmailText,
  welcomeSubject,
  publicSiteUrl,
} = require('../server/lib/newsletterEmail.js');

test('subscribe helpers normalize email and startup URL', () => {
  assert.equal(normalizeEmail('  Founder@Startup.COM '), 'founder@startup.com');
  assert.equal(isValidEmail('founder@startup.com'), true);
  assert.equal(isValidEmail('nope'), false);
  assert.equal(normalizeStartupUrl('neon.tech'), 'https://neon.tech');
  assert.equal(normalizeStartupUrl('https://www.neon.tech/'), 'https://neon.tech');
});

test('daily brief puts personal matches above market news and deep-links to inspect', () => {
  const html = buildBriefEmailHtml(
    { date: '2026-09-09', moneyMoves: [{ company: 'Acme', amount: '$10M', stage: 'Seed' }] },
    {
      siteUrl: 'https://pythh.ai',
      personal: {
        startupName: 'Neon',
        inspectUrl: 'https://neon.tech',
        matches: [{ match_score: 88, investor: { firm_name: 'Accel' }, reasoning: 'Stage fit' }],
        pending: false,
      },
    },
  );
  assert.match(html, /Your matches · Neon/);
  assert.match(html, /Accel/);
  assert.match(html, /matches\?url=/);
  assert.match(html, /Inspect your matches on pythh.ai/);
  const idxPersonal = html.indexOf('Your matches');
  const idxMoney = html.indexOf('Money Moves');
  assert.ok(idxPersonal >= 0 && idxMoney > idxPersonal);

  const text = buildBriefEmailText(
    { date: '2026-09-09' },
    { personal: { startupName: 'Neon', inspectUrl: 'https://neon.tech', matches: [], pending: true } },
  );
  assert.match(text, /YOUR MATCHES · Neon/);
  assert.match(text, /Inspect: https:\/\/pythh.ai\/matches\?url=/);
});

test('join form and subscribe API collect URL with email', () => {
  const form = readFileSync(new URL('../site/components/NewsletterJoinForm.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../server/index.js', import.meta.url), 'utf8');
  const send = readFileSync(new URL('../scripts/send-daily-brief.js', import.meta.url), 'utf8');
  assert.match(form, /Get the daily brief/);
  assert.doesNotMatch(form, /Get daily matches/);
  assert.doesNotMatch(form, /Get my daily matches/);
  assert.match(form, /Automate my raise/);
  assert.match(form, /https:\/\/yourstartup.com/);
  assert.match(form, /Paste your startup URL/);
  assert.match(form, /text-\[30px\]/);
  assert.match(form, /Where should we send the raise/);
  assert.match(form, /Your first ranked matches arrive in your inbox/);
  assert.match(form, /Build my raise/);
  assert.match(form, /Opening your raise campaign/);
  assert.match(form, /Homepage \/ reveal: URL is enough/);
  assert.match(form, /if \(revealMatches\)/);
  assert.match(form, /onJoined\?\.\(joined\)/);
  assert.match(form, /apiUrl\("\/api\/newsletter\/subscribe"\)/);
  const app = readFileSync(new URL('../site/App.tsx', import.meta.url), 'utf8');
  const newsletterPage = readFileSync(new URL('../site/pages/Newsletter.tsx', import.meta.url), 'utf8');
  assert.match(app, /path=\{\s*["']\/newsletter\/:date["']\s*\}/);
  assert.match(newsletterPage, /\/api\/newsletter\/\$\{date\}/);
  assert.match(api, /upsertNewsletterSubscriber/);
  assert.match(api, /kickoffSubscriberUrlScore/);
  assert.match(api, /sendSubscriberWelcome/);
  assert.match(send, /loadSubscriberMatches/);
  assert.match(send, /startup_url/);
});

test('welcome email leads with the shortlist and never links localhost', () => {
  assert.equal(publicSiteUrl('http://localhost:5173'), 'https://pythh.ai');
  const personal = {
    startupName: 'Neon',
    inspectUrl: 'https://neon.tech',
    matches: [{ match_score: 88, investor: { firm_name: 'Accel' }, reasoning: 'Stage fit' }],
    pending: false,
  };
  assert.equal(welcomeSubject(personal), 'Your first matches for Neon');
  const html = buildWelcomeEmailHtml({ personal, siteUrl: 'http://localhost:5173' });
  assert.match(html, /Your matches · Neon/);
  assert.match(html, /Accel/);
  assert.match(html, /https:\/\/pythh\.ai\/matches\?url=/);
  assert.doesNotMatch(html, /localhost/);
  assert.match(html, /Inspect your matches/);
  const text = buildWelcomeEmailText({
    personal: { startupName: 'Neon', inspectUrl: 'https://neon.tech', matches: [], pending: true },
  });
  assert.match(text, /scoring your URL/i);
  assert.match(text, /Inspect: https:\/\/pythh.ai\/matches\?url=/);
});

test('welcome send does not stamp when the shortlist is still pending', async () => {
  const updates = [];
  const supabase = {
    from(table) {
      return {
        select() { return this; },
        eq() { return this; },
        update(payload) {
          updates.push({ table, payload });
          return this;
        },
        maybeSingle: async () => ({
          data: {
            unsubscribe_token: 'tok',
            welcome_sent_at: null,
            startup_url: 'https://neon.tech',
            startup_id: 'abc',
          },
          error: null,
        }),
      };
    },
  };
  const originalFetch = globalThis.fetch;
  process.env.RESEND_API_KEY = 're_test';
  process.env.NEWSLETTER_WELCOME_POLLS = '0';
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ id: 'msg_pending' }),
  });
  try {
    const out = await sendSubscriberWelcome(supabase, {
      email: 'founder@startup.com',
      startupUrl: 'https://neon.tech',
      startupId: 'abc',
    });
    assert.equal(out.sent, true);
    assert.equal(out.pending, true);
    assert.equal(updates.some((u) => u.payload?.welcome_sent_at), false);
  } finally {
    globalThis.fetch = originalFetch;
    delete process.env.RESEND_API_KEY;
    delete process.env.NEWSLETTER_WELCOME_POLLS;
  }
});

test('welcome send skips when welcome_sent_at is already stamped', async () => {
  const supabase = {
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle: async () => ({
          data: {
            unsubscribe_token: 'tok',
            welcome_sent_at: '2026-09-09T00:00:00Z',
            startup_url: 'https://neon.tech',
            startup_id: 'abc',
          },
          error: null,
        }),
      };
    },
  };
  const out = await sendSubscriberWelcome(supabase, { email: 'founder@startup.com' });
  assert.equal(out.sent, false);
  assert.equal(out.reason, 'already_sent');
});
