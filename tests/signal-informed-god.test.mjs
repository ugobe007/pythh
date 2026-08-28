import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { mergeSignalDimsIntoStartup } = require('../lib/signalInformedGod.js');

test('mergeSignalDimsIntoStartup boosts press and psych from dims', () => {
  const startup = {
    name: 'Acme',
    extracted_data: {
      social_signals: { news_count: 0 },
      web_signals: { press_tier: { total: 0 } },
      execution_signals: [],
    },
  };
  const merged = mergeSignalDimsIntoStartup(startup, {
    founder_language_shift: 2.0,
    investor_receptivity: 1.8,
    news_momentum: 2.0,
    capital_convergence: 1.5,
    execution_velocity: 1.5,
  });

  assert.equal(merged.extracted_data.signal_informed.source, 'signal_before_god');
  assert.ok(merged.extracted_data.social_signals.news_count >= 6);
  assert.ok(merged.extracted_data.web_signals.press_tier.total >= 8);
  assert.ok(merged.extracted_data.execution_signals.includes('signal_informed_velocity'));
  assert.ok(merged.extracted_data.execution_signals.includes('signal_informed_capital'));
  assert.ok(merged.extracted_data.psychological_signals.conviction >= 0.6);
  assert.ok(merged.extracted_data.psychological_signals.fomo >= 0.5);
});

test('mergeSignalDimsIntoStartup is a no-op without dims', () => {
  const startup = { name: 'Acme', extracted_data: { x: 1 } };
  assert.equal(mergeSignalDimsIntoStartup(startup, null), startup);
});
