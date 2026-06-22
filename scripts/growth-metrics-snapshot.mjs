#!/usr/bin/env node
/**
 * Funnel + experiment metrics for the growth agent.
 *
 * Usage:
 *   node scripts/growth-metrics-snapshot.mjs
 *   node scripts/growth-metrics-snapshot.mjs --json --days=14
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import * as dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const { createClient } = require('@supabase/supabase-js');
const { loadRegistry, getMetricsSnapshot } = require('../server/lib/growthExperiments.js');

const JSON_OUT = process.argv.includes('--json');
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const days = daysArg ? parseInt(daysArg.split('=')[1], 10) : 7;

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function main() {
  const registry = loadRegistry();
  let metrics = { funnel_from_ai_logs: {}, experiment_variants: [], growth_event_count: 0 };
  try {
    metrics = await getMetricsSnapshot(sb, { days });
  } catch (e) {
    metrics.error = e.message;
  }

  const report = {
    generated_at: new Date().toISOString(),
    window_days: days,
    registry_experiments: (registry.experiments || []).map((e) => ({
      id: e.id,
      audience: e.audience,
      status: e.status,
      variants: (e.variants || []).map((v) => v.key),
      primary_metric: e.metrics?.primary,
    })),
    ...metrics,
  };

  const root = path.dirname(fileURLToPath(import.meta.url));
  const outDir = path.join(root, '..', 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `growth-metrics-${report.generated_at.slice(0, 10)}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2));

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`📊 Growth metrics (${days}d)`);
    console.log(`   ai_logs funnel:`, report.funnel_from_ai_logs);
    console.log(`   experiment events: ${report.growth_event_count}`);
    console.log(`   variants tracked: ${(report.experiment_variants || []).length}`);
    console.log(`📁 ${file}`);
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exit(1);
});
