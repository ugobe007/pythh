'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  classifyStartup,
  startupUrlResolutionPending,
} = require('../lib/entityResolutionGate');

test('classifyStartup defers junk until URL resolution attempted', () => {
  const headlineRow = {
    name: 'Fintech Startup Statement Raises',
    website: null,
    company_website: null,
    enrichment_attempts: 0,
  };
  assert.equal(classifyStartup(headlineRow).gate, 'needs_url');
  assert.equal(classifyStartup(headlineRow).reason, 'pending_url_before_junk');

  const afterEnrich = { ...headlineRow, enrichment_attempts: 1 };
  assert.equal(classifyStartup(afterEnrich).gate, 'junk');

  const validNoUrl = {
    name: 'Acme Robotics',
    website: null,
    enrichment_attempts: 0,
  };
  assert.equal(classifyStartup(validNoUrl).gate, 'needs_url');
  assert.equal(classifyStartup(validNoUrl).reason, 'no_website');

  const validWithUrl = {
    name: 'Acme Robotics',
    website: 'acmerobotics.com',
    enrichment_attempts: 0,
  };
  assert.equal(classifyStartup(validWithUrl).gate, 'qualified');
});

test('startupUrlResolutionPending respects enrichment_attempts', () => {
  assert.equal(startupUrlResolutionPending({ enrichment_attempts: 0 }), true);
  assert.equal(startupUrlResolutionPending({ enrichment_attempts: 1 }), false);
  assert.equal(startupUrlResolutionPending({ enrichment_attempts: null }), true);
});
