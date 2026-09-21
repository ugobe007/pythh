'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  vcOpening,
  vcMethodology,
  vcSubject,
  vcHeadline,
  PETER_SYSTEM_PROMPT,
} = require('../lib/pythiaVoice.js');
const { pickMarketObservation } = require('../lib/outreachMarketIntel.js');

const JARGON = /signal|deploy|conviction|orbit|category labels/i;

describe('Peter VC opening', () => {
  it('uses the analyst intro and a featured startup, not signals or deploy jargon', () => {
    const text = vcOpening({
      greeting: 'Hi Jason,',
      firm: 'LAUNCH',
      isPersonal: true,
      featuredStartup: 'Softr',
    });

    assert.match(text, /^Hi Jason, my name is Peter\. I am an investment analyst for Pythh\.AI\./);
    assert.match(text, /I scout for startups that match investor thesis for review and consideration\./);
    assert.match(text, /One startup, Softr fits LAUNCH's thesis and narrative that may interest you\./);
    assert.match(text, /I included a short list of curated startups that match your thesis for review — see below\./);
    assert.match(text, /Let me know if any of these look interesting and worth your attention\./);
    assert.doesNotMatch(text, JARGON);
    assert.doesNotMatch(text, /I noticed something you may want to see/);
    assert.doesNotMatch(text, /how you actually deploy/);
  });

  it('uses the firm name for team inboxes', () => {
    const text = vcOpening({
      greeting: 'Hi team at Accel,',
      firm: 'Accel',
      isPersonal: false,
      featuredStartup: 'Neon',
    });
    assert.match(text, /match Accel's thesis for review/);
    assert.doesNotMatch(text, JARGON);
  });
});

describe('Peter VC methodology and subject', () => {
  it('explains ranking with 24 algorithms, not conviction signals', () => {
    assert.equal(
      vcMethodology(),
      'We use 24 algorithms to identify possible candidates for investment including thesis, traction, timing and team.',
    );
    assert.doesNotMatch(vcMethodology(), JARGON);
    assert.equal(vcSubject({ emailType: 'personal', count: 10 }), '10 startups that match your thesis');
    assert.equal(vcHeadline({ count: 10 }), '10 curated startups for review');
    assert.doesNotMatch(PETER_SYSTEM_PROMPT, /deployment patterns/);
    assert.doesNotMatch(PETER_SYSTEM_PROMPT, /conviction signals, not category labels/);
  });
});

describe('market observation leftover templates', () => {
  it('no longer invents raise-to-work-on tagline sentences', () => {
    const line = pickMarketObservation({
      investor: { id: 'inv-1', firm: 'LAUNCH', sectors: ['SaaS'] },
      leads: [{ id: 's1', name: 'Softr', tagline: 'Most AI app-builders stop at the shiny demo stage' }],
      usedCompanies: new Set(),
      campaign: 'test',
      rate: 1,
    });
    assert.equal(line, "One startup, Softr fits LAUNCH's thesis and narrative that may interest you.");
    assert.doesNotMatch(line, /raised|to work on|participate|deploy/i);
  });
});
