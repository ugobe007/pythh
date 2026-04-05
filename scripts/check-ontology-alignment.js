#!/usr/bin/env node
/**
 * Validates that lib/ontologyCrosswalk.js grammar targets exist in needsInference.SIGNAL_NEED_MAP
 * and reports colloquial coverage vs lib/signal-ontology.js SIGNALS.
 *
 * Run: node scripts/check-ontology-alignment.js
 * Exit 0 always (warnings only) — use in CI as advisory.
 */

'use strict';

const { COLLOQUIAL_TO_GRAMMAR } = require('../lib/ontologyCrosswalk');
const { SIGNAL_NEED_MAP } = require('../lib/needsInference');
const { SIGNALS } = require('../lib/signal-ontology');

let warn = 0;

console.log('Ontology alignment check');
console.log('═'.repeat(50));

for (const [colloquial, grammar] of Object.entries(COLLOQUIAL_TO_GRAMMAR)) {
  if (!SIGNAL_NEED_MAP[grammar]) {
    console.warn(`⚠️  Crosswalk maps "${colloquial}" → "${grammar}" but SIGNAL_NEED_MAP has no such key`);
    warn++;
  }
}

const colloquialSet = new Set(Object.keys(COLLOQUIAL_TO_GRAMMAR));
let uncovered = 0;
for (const s of SIGNALS) {
  if (['FUNDRAISING', 'ROUND_DYNAMICS', 'ROUND_STAGE', 'TRACTION'].includes(s.category)) {
    if (!colloquialSet.has(s.signal)) uncovered++;
  }
}

console.log(`Colloquial signals in crosswalk: ${colloquialSet.size}`);
console.log(`signal-ontology SIGNALS rows: ${SIGNALS.length}`);
console.log(`(Sample categories) Uncovered high-signal labels (informational): ${uncovered}`);
if (warn > 0) console.log(`Warnings: ${warn}`);
console.log('Done.');
