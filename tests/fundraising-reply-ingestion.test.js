'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { inboundReplyReference, secureEqual } = require('../server/routes/outreachWebhook');

test('attributes inbound replies by signed reply alias', () => {
  assert.deepEqual(inboundReplyReference({ data: {
    email_id: 'inbound-1',
    to: ['reply+42@replies.pythh.ai'],
  }}), {
    inboundId: 'inbound-1',
    normalizedReference: '',
    outreachEmailId: 42,
  });
});

test('calendar callback secrets use constant-time equality semantics', () => {
  assert.equal(secureEqual('calendar-secret', 'calendar-secret'), true);
  assert.equal(secureEqual('calendar-secret', 'wrong-secret'), false);
  assert.equal(secureEqual('', ''), false);
});

test('attributes inbound replies by RFC In-Reply-To header', () => {
  assert.deepEqual(inboundReplyReference({ data: {
    message_id: 'inbound-2',
    headers: { 'in-reply-to': '<original-resend-id>' },
  }}), {
    inboundId: 'inbound-2',
    normalizedReference: 'original-resend-id',
    outreachEmailId: null,
  });
});
