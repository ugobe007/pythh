#!/usr/bin/env node
'use strict';

/**
 * Boot smoke test — catches module-load crashes before deploy.
 * Run: node scripts/smoke-boot.js
 */

const checks = [
  {
    name: 'instantSubmit module load',
    run: () => {
      require('../server/routes/instantSubmit.js');
    },
  },
  {
    name: 'SUPABASE_URL defined in instantSubmit',
    run: () => {
      const fs = require('fs');
      const path = require('path');
      const src = fs.readFileSync(
        path.join(__dirname, '../server/routes/instantSubmit.js'),
        'utf8',
      );
      if (!/const SUPABASE_URL\s*=/.test(src)) {
        throw new Error('instantSubmit.js missing const SUPABASE_URL');
      }
      const firstChunk = src.slice(0, 2500);
      if (!/const SUPABASE_URL\s*=/.test(firstChunk)) {
        throw new Error('SUPABASE_URL must be declared near top of file (before boot guard)');
      }
      const constIdx = src.indexOf('const SUPABASE_URL');
      const guardIdx = src.indexOf('if (!SUPABASE_URL');
      if (guardIdx >= 0 && constIdx > guardIdx) {
        throw new Error('SUPABASE_URL guard runs before const declaration');
      }
    },
  },
  {
    name: 'sector inference (ReadyForRobots)',
    run: () => {
      const { extractInferenceData, reconcileSectors } = require('../lib/inference-extractor.js');
      const text = 'ReadyForRobots — SCOUT';
      const url = 'https://readyforrobots.com';
      const sectors = extractInferenceData(text, url)?.sectors;
      if (!sectors || sectors[0] !== 'Robotics') {
        throw new Error(`expected Robotics, got ${JSON.stringify(sectors)}`);
      }
      const rec = reconcileSectors(['HealthTech', 'Robotics'], url, 'ReadyForRobots', text);
      if (rec[0] !== 'Robotics' || rec.includes('HealthTech')) {
        throw new Error(`reconcile failed: ${JSON.stringify(rec)}`);
      }
    },
  },
  {
    name: 'sector reconcile (ReadyForRobots cached DB row)',
    run: () => {
      const { reconcileSectors } = require('../lib/inference-extractor.js');
      const rec = reconcileSectors(
        ['HealthTech', 'Robotics'],
        'https://readyforrobots.com',
        'Readyforrobots',
        '',
      );
      if (rec[0] !== 'Robotics' || rec.includes('HealthTech')) {
        throw new Error(`expected Robotics-only, got ${JSON.stringify(rec)}`);
      }
    },
  },
];

let failed = 0;
for (const c of checks) {
  try {
    c.run();
    console.log(`PASS ${c.name}`);
  } catch (err) {
    failed += 1;
    console.error(`FAIL ${c.name}: ${err.message || err}`);
  }
}

if (failed > 0) {
  process.exit(1);
}
console.log(`\nAll ${checks.length} boot smoke checks passed.`);
