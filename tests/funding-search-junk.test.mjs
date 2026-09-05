import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  EXACT_NON_STARTUP_SEARCH_NAMES,
  isJunkStartupName,
} from '../lib/fundingSearchJunk.mjs';

test('suffix and publisher-site rows stay junk', () => {
  assert.equal(isJunkStartupName('Olin Corporation', 'https://olin.com'), true);
  assert.equal(isJunkStartupName('London Stock Exchange', 'https://lseg.com'), true);
  assert.equal(isJunkStartupName('Whoop', 'https://venturefizz.com/job/whoop-senior'), true);
  assert.equal(isJunkStartupName('Acme', ''), true);
});

test('exact public-company and non-startup hunt-queue names are junk', () => {
  for (const name of [
    'Tim Hortons',
    'Teladoc',
    'PagerDuty',
    'Malwarebytes',
    'Miss Universe',
    'SPIR-V',
    'GLSL',
    'Brent Kovar',
    'Gavin Potenza',
    'Senior',
    'Dogecoin',
    'Formulary Financial',
    'Setting Boundaries',
  ]) {
    assert.equal(EXACT_NON_STARTUP_SEARCH_NAMES.has(name.toLowerCase()), true, name);
    assert.equal(isJunkStartupName(name, `https://${name.replace(/\s+/g, '').toLowerCase()}.com`), true, name);
  }
});

test('real startups used in OpenAI waves are not junk', () => {
  assert.equal(isJunkStartupName('Atorie', 'https://atorie.com'), false);
  assert.equal(isJunkStartupName('Transfyr', 'https://transfyr.com'), false);
  assert.equal(isJunkStartupName('Lupin Dental', 'https://lupindental.com'), false);
  assert.equal(isJunkStartupName('Mintlify', 'https://mintlify.com'), false);
  assert.equal(isJunkStartupName('Curaa', 'https://curaa.com'), false);
});

test('entity_gate=junk parks even a plausible name', () => {
  assert.equal(isJunkStartupName('Plausible', 'https://plausible.example', { entityGate: 'junk' }), true);
});
