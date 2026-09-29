import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { searchDomainEmails, isHunterUnavailable, resetHunterForTests } from '../lib/hunterIo.mjs';

const require = createRequire(import.meta.url);
const { getOutreachFromAddress, getOutreachFromHeader } = require('../lib/outreachFrom.js');
const { isCleanInvestorNameForFeed } = require('../server/lib/feedNameGuards.js');

test('Peter sends from the deliverable mailbox until pythh.ai DNS is ready', () => {
  const saved = {
    domain: process.env.OUTREACH_USE_PYTHH_DOMAIN,
    from: process.env.OUTREACH_FROM,
    dns: process.env.PYTHH_FROM_DNS_OK,
  };
  process.env.OUTREACH_USE_PYTHH_DOMAIN = 'true';
  process.env.OUTREACH_FROM = 'pythia@pythh.ai';
  delete process.env.PYTHH_FROM_DNS_OK;
  assert.equal(getOutreachFromAddress(), 'hello@orbital-ai.io');
  assert.equal(getOutreachFromHeader(), 'Peter at Pythh <hello@orbital-ai.io>');
  process.env.PYTHH_FROM_DNS_OK = '1';
  assert.equal(getOutreachFromAddress(), 'pythia@pythh.ai');
  for (const [key, value] of Object.entries({
    OUTREACH_USE_PYTHH_DOMAIN: saved.domain,
    OUTREACH_FROM: saved.from,
    PYTHH_FROM_DNS_OK: saved.dns,
  })) {
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
});

test('scraped Personal firm labels are not outreach targets', () => {
  assert.equal(isCleanInvestorNameForFeed('John Doerr', 'John Doerr Personal'), false);
  assert.equal(isCleanInvestorNameForFeed('John Doerr', 'Kleiner Perkins'), true);
});

test('a restricted Hunter account does not abort the next lookup', async () => {
  resetHunterForTests();
  const savedKey = process.env.HUNTER_API_KEY;
  const originalFetch = global.fetch;
  process.env.HUNTER_API_KEY = 'test-key';
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    return {
      ok: false,
      status: 429,
      json: async () => ({
        errors: [{ details: 'Your account was restricted. Please log in to Hunter for more information.' }],
      }),
    };
  };
  try {
    assert.deepEqual(await searchDomainEmails('example.com'), []);
    assert.equal(isHunterUnavailable(), 'restricted');
    assert.deepEqual(await searchDomainEmails('example.com'), []);
    assert.equal(calls, 1);
  } finally {
    global.fetch = originalFetch;
    if (savedKey == null) delete process.env.HUNTER_API_KEY;
    else process.env.HUNTER_API_KEY = savedKey;
    resetHunterForTests();
  }
});
