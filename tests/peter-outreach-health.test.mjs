import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { searchDomainEmails, isHunterUnavailable, resetHunterForTests } from '../lib/hunterIo.mjs';

const require = createRequire(import.meta.url);
const { getOutreachFromAddress, getOutreachFromHeader } = require('../lib/outreachFrom.js');
const { isCleanInvestorNameForFeed } = require('../server/lib/feedNameGuards.js');

test('Peter sends as Pythh from pythia@pythh.ai', () => {
  const saved = {
    domain: process.env.OUTREACH_USE_PYTHH_DOMAIN,
    from: process.env.OUTREACH_FROM,
  };
  process.env.OUTREACH_USE_PYTHH_DOMAIN = 'true';
  process.env.OUTREACH_FROM = 'pythia@pythh.ai';
  assert.equal(getOutreachFromAddress(), 'pythia@pythh.ai');
  assert.equal(getOutreachFromHeader(), 'Peter at Pythh <pythia@pythh.ai>');
  for (const [key, value] of Object.entries({
    OUTREACH_USE_PYTHH_DOMAIN: saved.domain,
    OUTREACH_FROM: saved.from,
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
