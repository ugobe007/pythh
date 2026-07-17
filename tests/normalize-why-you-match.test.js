'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeWhyYouMatch } = require('../lib/normalizeWhyYouMatch');

describe('normalizeWhyYouMatch', () => {
  it('joins DB string arrays', () => {
    assert.equal(normalizeWhyYouMatch(['Stage match', 'Sector fit']), 'Stage match · Sector fit');
  });

  it('passes through strings', () => {
    assert.equal(normalizeWhyYouMatch('Suggested for preview'), 'Suggested for preview');
  });
});
