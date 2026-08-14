const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

const read = (file) => readFile(path.join(__dirname, '..', file), 'utf8');

test('scheduled founder outreach explicitly enables sending and preserves the cap', async () => {
  const workflow = await read('.github/workflows/outreach-peter-weekly.yml');
  assert.match(workflow, /cron: '0 13 \* \* \*'/);
  assert.match(workflow, /ARGS="\$ARGS --send"/);
  assert.match(workflow, /default: '20'/);
  assert.match(
    workflow,
    /Peter founder outreach[\s\S]*EMAIL_SECRET: \$\{\{ secrets\.EMAIL_SECRET \}\}[\s\S]*HUNTER_API_KEY/
  );
});

test('local scheduler explicitly enables founder sends outside draft mode', async () => {
  const scheduler = await read('scripts/cron/outreach-scheduler.js');
  assert.match(scheduler, /DRAFT_ONLY \? \[\] : \["--send"\]/);
});

test('complaints suppress future founder prospecting', async () => {
  const webhook = await read('server/routes/outreachWebhook.js');
  assert.match(webhook, /pythh_prospecting_log[\s\S]*status: 'unsubscribed'/);
  assert.match(webhook, /email_unsubscribes[\s\S]*reason: 'resend_complaint'/);
});
