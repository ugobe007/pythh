import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  loadFundingEvidenceLedger,
  loadFundingParticipationOntology,
  unwrapCjs,
} from '../lib/loadFundingLibs.mjs';

test('unwrapCjs reads functions from a default-wrapped CJS module', () => {
  const inner = {
    canonicalRoundKey: () => 'id:x|seed|1|2026-01',
    extractKnownInvestorMentions: () => [],
  };
  const wrapped = { default: inner };
  const ledger = unwrapCjs(wrapped, 'wrapped-ledger', ['canonicalRoundKey']);
  assert.equal(typeof ledger.canonicalRoundKey, 'function');
  assert.equal(ledger.canonicalRoundKey(), 'id:x|seed|1|2026-01');
  const ont = unwrapCjs(wrapped, 'wrapped-ontology', ['extractKnownInvestorMentions']);
  assert.equal(ont.extractKnownInvestorMentions().length, 0);
});

test('unwrapCjs names the missing helper instead of calling undefined', () => {
  assert.throws(
    () => unwrapCjs({ default: { other: 1 } }, 'broken-ledger', ['canonicalRoundKey']),
    /canonicalRoundKey is not a function \(broken-ledger keys:/,
  );
});

test('funding CJS helpers load as functions from ESM', () => {
  const ledger = loadFundingEvidenceLedger();
  assert.equal(typeof ledger.canonicalRoundKey, 'function');
  assert.equal(typeof ledger.resolveCanonicalEntity, 'function');
  const key = ledger.canonicalRoundKey({
    startupId: 'startup-1',
    startupName: 'Acme',
    roundType: 'Series A',
    amountUsd: 10_000_000,
    announcedAt: '2026-05-22',
  });
  assert.equal(key, 'id:startup-1|series-a|10000000|2026-05');

  const ont = loadFundingParticipationOntology();
  assert.equal(typeof ont.extractKnownInvestorMentions, 'function');
  const mentions = ont.extractKnownInvestorMentions(
    'Acme raised $10M led by Accel.',
    [{ id: 'accel', name: 'Accel', firm: 'Accel' }],
  );
  assert.ok(mentions.length >= 1);
});
