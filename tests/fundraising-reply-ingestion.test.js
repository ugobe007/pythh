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

test('handleBounced updates outreach tables and records email suppression', async () => {
  const updates = [];
  const upserts = [];
  const mockClient = {
    from(table) {
      return {
        update(data) {
          return {
            eq(col, val) {
              updates.push({ table, data, col, val });
              return Promise.resolve({ error: null });
            },
            or(condition) {
              updates.push({ table, data, condition });
              return Promise.resolve({ error: null });
            },
          };
        },
        upsert(data, opts) {
          upserts.push({ table, data, opts });
          return Promise.resolve({ error: null });
        },
      };
    },
  };

  const { handleBounced } = require('../server/routes/outreachWebhook');
  await handleBounced({
    data: {
      email_id: 'resend-msg-123',
      to: ['bounced@example.com'],
      bounce: { type: 'hard_bounce', message: 'Address does not exist' },
    },
  }, mockClient);

  assert.equal(updates.some(u => u.table === 'pythh_outreach_emails' && u.data.status === 'bounced' && u.val === 'resend-msg-123'), true);
  assert.equal(updates.some(u => u.table === 'investor_outreach' && u.data.status === 'bounced' && u.val === 'resend-msg-123'), true);
  assert.equal(updates.some(u => u.table === 'pythh_prospecting_log' && u.data.status === 'bounced' && u.val === 'resend-msg-123'), true);
  assert.equal(updates.some(u => u.table === 'investors' && u.data.email_status === 'bounced'), true);
  assert.equal(upserts.some(u => u.table === 'email_unsubscribes' && u.data.email === 'bounced@example.com'), true);
});

test('isBlockedOutreachEmail suppresses role prefixes like facilities, energy, and voperations', () => {
  const { isBlockedOutreachEmail } = require('../lib/investorEmailInfer.js');
  assert.equal(isBlockedOutreachEmail('energy@loves.com'), true);
  assert.equal(isBlockedOutreachEmail('facilities@pilotflyingj.com'), true);
  assert.equal(isBlockedOutreachEmail('facilities@haascnc.com'), true);
  assert.equal(isBlockedOutreachEmail('voperations@allegiantstadium.com'), true);
  assert.equal(isBlockedOutreachEmail('billing@company.com'), true);
  assert.equal(isBlockedOutreachEmail('founder@innovate.ai'), false);
  assert.equal(isBlockedOutreachEmail('marc@a16z.com'), false);
});

