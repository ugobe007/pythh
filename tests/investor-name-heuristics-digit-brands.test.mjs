import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isHardJunkInvestorName, isGarbageInvestorName } = require('../lib/investorNameHeuristics.js');

{
  // Digit-leading real VC brands must not be hard-junk (blocked rematch force-include).
  for (const name of ['468 Capital', '360 Capital', '8VC', '500 Global', '360 ONE']) {
    assert.equal(isHardJunkInvestorName(name), false, `${name} should not be hard junk`);
    assert.equal(isGarbageInvestorName(name), false, `${name} should not be garbage`);
  }
  assert.equal(isHardJunkInvestorName('TechCrunch raises Series A'), true);
  assert.equal(isHardJunkInvestorName('xx'), true);
}

console.log('investor-name-heuristics-digit-brands.test.mjs: ok');
