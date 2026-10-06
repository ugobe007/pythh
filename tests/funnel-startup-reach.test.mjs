import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  funnelStartupKey,
  humanPreviewReach,
  normalizeFunnelStartupUrl,
} = require('../server/lib/funnelTelemetry.js');

test('startup keys collapse protocol and www onto one domain', () => {
  assert.equal(normalizeFunnelStartupUrl('https://www.Stripe.com/about'), 'stripe.com');
  assert.equal(
    funnelStartupKey({ startup_url: 'https://stripe.com', startup_id: 'abc' }),
    'stripe.com',
  );
  assert.equal(funnelStartupKey({ url: 'neon.tech' }), 'neon.tech');
  assert.equal(funnelStartupKey({ startup_id: 'only-id' }), 'id:only-id');
  assert.equal(funnelStartupKey(null), null);
});

test('repeat submits of the same startup do not look like a preview leak', () => {
  const human = [
    'stripe.com',
    'https://stripe.com',
    'https://www.stripe.com/pricing',
    'neon.tech',
    'neon.tech',
  ].map((url) => funnelStartupKey({ url }));
  const preview = ['https://stripe.com', 'https://neon.tech'].map((url) => funnelStartupKey({ startup_url: url }));
  const reach = humanPreviewReach(human, preview);
  assert.equal(reach.distinct_human_startups, 2);
  assert.equal(reach.distinct_preview_startups, 2);
  assert.equal(reach.preview_startup_per_human_startup, 100);
});

test('a startup that never renders a preview counts as a miss', () => {
  const reach = humanPreviewReach(
    ['alpha.com', 'beta.com', 'gamma.com', 'delta.com', 'epsilon.com'].map((url) => funnelStartupKey({ url })),
    ['alpha.com', 'beta.com'].map((url) => funnelStartupKey({ url })),
  );
  assert.equal(reach.distinct_human_startups, 5);
  assert.equal(reach.distinct_preview_startups, 2);
  assert.equal(reach.preview_startup_per_human_startup, 40);
});
