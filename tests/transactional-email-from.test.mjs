import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadFrom() {
  delete require.cache[require.resolve('../server/lib/transactionalEmailFrom.js')];
  return require('../server/lib/transactionalEmailFrom.js');
}

test('overrides brief@ until pythh.ai DNS is marked ok', () => {
  const prevDns = process.env.PYTHH_FROM_DNS_OK;
  const prevMatches = process.env.MATCHES_EMAIL_FROM;
  const prevEmail = process.env.EMAIL_FROM;
  delete process.env.PYTHH_FROM_DNS_OK;
  process.env.MATCHES_EMAIL_FROM = 'Pythh Daily Brief <brief@pythh.ai>';
  process.env.EMAIL_FROM = 'Pythh Daily Brief <brief@pythh.ai>';
  try {
    const mail = loadFrom();
    assert.equal(mail.resolveTransactionalFrom(), 'Pythh Daily Brief <hello@orbital-ai.io>');
    assert.equal(mail.resolveTransactionalReplyTo('brief@pythh.ai'), 'hello@orbital-ai.io');
  } finally {
    if (prevDns == null) delete process.env.PYTHH_FROM_DNS_OK;
    else process.env.PYTHH_FROM_DNS_OK = prevDns;
    if (prevMatches == null) delete process.env.MATCHES_EMAIL_FROM;
    else process.env.MATCHES_EMAIL_FROM = prevMatches;
    if (prevEmail == null) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = prevEmail;
  }
});

test('keeps a non-pythh From and honors the DNS gate', () => {
  const prevDns = process.env.PYTHH_FROM_DNS_OK;
  delete process.env.PYTHH_FROM_DNS_OK;
  try {
    const mail = loadFrom();
    assert.equal(
      mail.resolveTransactionalFrom('Pythh <hello@orbital-ai.io>'),
      'Pythh <hello@orbital-ai.io>',
    );
    process.env.PYTHH_FROM_DNS_OK = '1';
    const allowed = loadFrom();
    assert.equal(
      allowed.resolveTransactionalFrom('Pythh Daily Brief <brief@pythh.ai>'),
      'Pythh Daily Brief <brief@pythh.ai>',
    );
  } finally {
    if (prevDns == null) delete process.env.PYTHH_FROM_DNS_OK;
    else process.env.PYTHH_FROM_DNS_OK = prevDns;
  }
});
