#!/usr/bin/env node
/**
 * Export entity_gate_ml_events → CSV for offline ML (scikit-learn, PyTorch, etc.).
 *
 * Usage:
 *   node scripts/ml/export-entity-gate-training-csv.js
 *   node scripts/ml/export-entity-gate-training-csv.js --limit=50000 --out=./scripts/ml/exports/events.csv
 *
 * Requires: migration 20260414120000_entity_gate_ml_events.sql applied, and rows from
 *   reclassify-zero-signal-junk.js --ml-log / ENTITY_GATE_ML_LOG=1
 *   node scripts/enrich-sparse-startups.js --ml-log ...
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const argv = process.argv.slice(2);
const limitArg = argv.find((a) => a.startsWith('--limit='));
const outArg = argv.find((a) => a.startsWith('--out='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : 100000;
const outPath = outArg
  ? path.resolve(outArg.split('=')[1])
  : path.join(__dirname, 'exports', `entity_gate_ml_events_${Date.now()}.csv`);

function csvEscape(s) {
  if (s == null) return '';
  const t = String(s);
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

async function main() {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  const headers = [
    'name',
    'training_label',
    'event_source',
    'bucket',
    'enrichment_result',
    'entity_gate',
    'validator_valid',
    'validator_reason',
    'logic_track',
    'logic_reason',
    'ontology_hint',
    'created_at',
    'startup_id',
  ];

  const lines = [headers.join(',')];
  let from = 0;
  const page = 1000;

  while (lines.length - 1 < limit) {
    const take = Math.min(page, limit - (lines.length - 1));
    const { data, error } = await supabase
      .from('entity_gate_ml_events')
      .select(
        'name,training_label,event_source,bucket,enrichment_result,entity_gate,validator_valid,validator_reason,logic_track,logic_reason,ontology_hint,created_at,startup_id',
      )
      .order('created_at', { ascending: false })
      .range(from, from + take - 1);

    if (error) {
      console.error('Supabase error:', error.message);
      process.exit(1);
    }
    if (!data || data.length === 0) break;

    for (const row of data) {
      lines.push(
        [
          csvEscape(row.name),
          csvEscape(row.training_label),
          csvEscape(row.event_source),
          csvEscape(row.bucket),
          csvEscape(row.enrichment_result),
          csvEscape(row.entity_gate),
          row.validator_valid === true ? '1' : row.validator_valid === false ? '0' : '',
          csvEscape(row.validator_reason),
          csvEscape(row.logic_track),
          csvEscape(row.logic_reason),
          csvEscape(row.ontology_hint),
          csvEscape(row.created_at),
          csvEscape(row.startup_id),
        ].join(','),
      );
    }

    if (data.length < take) break;
    from += take;
  }

  fs.writeFileSync(outPath, lines.join('\n'), 'utf8');
  console.log(`Wrote ${lines.length - 1} rows to ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
