'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeLinkedInUrl,
  resolveInvestorLinkedInUrl,
  linkedInPeopleSearchUrl,
} = require('../lib/normalizeLinkedInUrl');

describe('normalizeLinkedInUrl', () => {
  it('adds https when missing', () => {
    assert.equal(normalizeLinkedInUrl('linkedin.com/in/jane-doe'), 'https://linkedin.com/in/jane-doe');
  });

  it('preserves existing protocol', () => {
    assert.equal(
      normalizeLinkedInUrl('https://www.linkedin.com/in/jane-doe'),
      'https://www.linkedin.com/in/jane-doe',
    );
  });
});

describe('resolveInvestorLinkedInUrl', () => {
  it('keeps valid /in/ profile URLs', () => {
    assert.equal(
      resolveInvestorLinkedInUrl({
        linkedinUrl: 'https://linkedin.com/in/nate-nickerson',
        name: 'Nate Nickerson',
        firm: 'NEA',
      }),
      'https://linkedin.com/in/nate-nickerson',
    );
  });

  it('rewrites bogus /company/person-(firm) to /in/person', () => {
    assert.equal(
      resolveInvestorLinkedInUrl({
        linkedinUrl: 'https://www.linkedin.com/company/aaron-jacobson-(nea)',
        name: 'Aaron Jacobson',
        firm: 'NEA',
      }),
      'https://www.linkedin.com/in/aaron-jacobson',
    );
  });

  it('rewrites person-as-company slug to /in/', () => {
    assert.equal(
      resolveInvestorLinkedInUrl({
        linkedinUrl: 'https://www.linkedin.com/company/jesse-powell',
        name: 'Jesse Powell',
        firm: 'Kraken',
      }),
      'https://www.linkedin.com/in/jesse-powell',
    );
  });

  it('keeps real firm company pages', () => {
    assert.equal(
      resolveInvestorLinkedInUrl({
        linkedinUrl: 'https://www.linkedin.com/company/greylock-partners',
        name: 'Greylock',
        firm: 'Greylock Partners',
      }),
      'https://www.linkedin.com/company/greylock-partners',
    );
  });

  it('falls back to people search when linkedin is missing', () => {
    assert.equal(
      resolveInvestorLinkedInUrl({ name: 'Aaron Jacobson', firm: 'NEA' }),
      linkedInPeopleSearchUrl('Aaron Jacobson', 'NEA'),
    );
  });
});
