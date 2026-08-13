const assert = require('node:assert/strict');
const test = require('node:test');

const { validateStartupUrl } = require('../server/utils/startupUrlValidation');

test('accepts normal startup domains without changing their hostname', () => {
  assert.deepEqual(validateStartupUrl('stripe.com'), { valid: true, domain: 'stripe.com' });
  assert.deepEqual(validateStartupUrl('https://www.example.ai/product'), { valid: true, domain: 'example.ai' });
  assert.deepEqual(validateStartupUrl('https://app.company.co.uk'), { valid: true, domain: 'app.company.co.uk' });
});

test('rejects malformed inputs before Submit URL can write a startup row', () => {
  for (const input of ['', 'not-a-url', 'hello world.com', 'https://localhost', 'https://bad_domain.com']) {
    assert.equal(validateStartupUrl(input).valid, false, input);
  }
});
