import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { publicUnlockPayload } from '../server/routes/matchLeadRelay.js';

test('unlock payload never includes an investor email field', () => {
  const payload = publicUnlockPayload({
    investorId: '11111111-1111-1111-1111-111111111111',
    contactable: true,
  });
  assert.equal(payload.contactable, true);
  assert.equal(payload.unlocked, true);
  assert.equal('email' in payload, false);
  assert.doesNotMatch(JSON.stringify(payload), /@/);
});

test('relay route sends through Resend and does not return outreach_email', () => {
  const source = readFileSync(new URL('../server/routes/matchLeadRelay.js', import.meta.url), 'utf8');
  assert.match(source, /resend\.emails\.send/);
  assert.match(source, /reply_to: replyTo/);
  assert.match(source, /getAuthedUserFromRequest/);
  assert.doesNotMatch(source, /email_to:\s*resolved/);
  assert.match(source, /contactable: true/);
  assert.match(source, /Their address stays private|founder_reply_to/);
});

test('preview leads expand all five and unlock without showing addresses', () => {
  const preview = readFileSync(new URL('../site/components/InstantMatchPreview.tsx', import.meta.url), 'utf8');
  const lead = readFileSync(new URL('../site/components/MatchInvestorLead.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../lib/canonicalMatchApi.js', import.meta.url), 'utf8');
  assert.match(preview, /MatchInvestorLead/);
  assert.doesNotMatch(preview, /i === 0 && why/);
  assert.match(lead, /Unlock to email through Pythh/);
  assert.match(lead, /Email, calls, and the deck outline are on Scout/);
  assert.match(lead, /Recent deals/);
  assert.match(lead, /Fit \$\{fitness\}\/100/);
  assert.doesNotMatch(lead, /likely to invest|% likely|probability/);
  assert.match(api, /contactable: investorHasContact/);
  assert.doesNotMatch(api, /email: investor\.email/);
});
