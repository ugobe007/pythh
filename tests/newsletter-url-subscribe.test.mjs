import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeEmail, normalizeStartupUrl, isValidEmail } = require('../server/lib/newsletterSubscribe.js');
const { buildBriefEmailHtml, buildBriefEmailText } = require('../server/lib/newsletterEmail.js');

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
  assert.match(form, /Get daily matches/);
  assert.match(form, /Your startup website/);
  assert.match(api, /upsertNewsletterSubscriber/);
  assert.match(api, /kickoffSubscriberUrlScore/);
  assert.match(send, /loadSubscriberMatches/);
  assert.match(send, /startup_url/);
});
