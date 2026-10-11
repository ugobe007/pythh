import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('pricing Sign-in preserves plan and auto-starts checkout after auth', () => {
  const pricing = read('site/Pricing.tsx');
  assert.match(pricing, /pythh_pricing_auto_checkout/);
  assert.match(pricing, /pricingReturnPath/);
  assert.match(pricing, /params\.set\("checkout", "1"\)/);
  assert.match(pricing, /auto_checkout: true/);
  assert.match(pricing, /handleCheckout\(requestedPlan, \{ auto: true \}\)/);
  assert.match(pricing, /checkout_started/);
});

test('match unlock plan gates keep oracle plan + use-to-paid source', () => {
  const preview = read('site/components/InstantMatchPreview.tsx');
  const hub = read('site/components/FounderOnboardingHub.tsx');
  assert.match(preview, /\/pricing\?plan=oracle&source=match_lead_use_to_paid/);
  assert.match(hub, /\/pricing\?plan=oracle&source=match_lead_use_to_paid/);
  assert.doesNotMatch(preview, /onNeedPlan=\{\(\) => navigate\('\/pricing'\)\}/);
  assert.doesNotMatch(hub, /onNeedPlan=\{\(\) => navigate\('\/pricing'\)\}/);
});
