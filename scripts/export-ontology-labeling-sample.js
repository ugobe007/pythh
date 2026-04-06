#!/usr/bin/env node
/**
 * Export a stratified sample of startup text + structured parser fields for
 * ontology / pattern-library work and parsing improvements (separate from GOD-ML).
 *
 * Stratification (4 buckets, default): traction_confidence ≥ 0.35 × tagline ≥ 8 chars
 *   — surfaces diverse cases for labeling without loading only high-GOD rows.
 *
 * Usage:
 *   node scripts/export-ontology-labeling-sample.js > sample.jsonl
 *   node scripts/export-ontology-labeling-sample.js --out sample.jsonl --limit=800
 *   node scripts/export-ontology-labeling-sample.js --format=csv --out sample.csv
 *   node scripts/export-ontology-labeling-sample.js --no-stratify --limit=200
 *
 * Env: VITE_SUPABASE_URL + SUPABASE_SERVICE_KEY (or VITE_SUPABASE_ANON_KEY)
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ quiet: true });

const PAGE = 1000;
const MIN_TAGLINE = 8;
const TRACTION_HIGH = 0.35;

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const SELECT = [
  'id',
  'name',
  'website',
  'status',
  'tagline',
  'description',
  'pitch',
  'sectors',
  'stage',
  'extracted_data',
  'execution_signals',
  'team_signals',
  'grit_signals',
  'funding_confidence',
  'traction_confidence',
  'maturity_level',
  'total_god_score',
  'source_type',
].join(',');

const BUCKET_LABELS = [
  'high_traction_conf+has_tagline',
  'high_traction_conf+no_tagline',
  'low_traction_conf+has_tagline',
  'low_traction_conf+no_tagline',
];

function parseArgs(argv) {
  const out = {
    limit: 400,
    status: 'approved',
    format: 'jsonl',
    outPath: null,
    stratify: true,
  };
  for (const a of argv) {
    if (a.startsWith('--limit=')) out.limit = Math.max(1, parseInt(a.slice('--limit='.length), 10) || 400);
    else if (a.startsWith('--status=')) out.status = a.slice('--status='.length) || 'approved';
    else if (a.startsWith('--format=')) {
      const f = a.slice('--format='.length).toLowerCase();
      out.format = f === 'csv' ? 'csv' : 'jsonl';
    } else if (a.startsWith('--out=')) out.outPath = a.slice('--out='.length) || null;
    else if (a === '--no-stratify') out.stratify = false;
  }
  return out;
}

function taglineLen(row) {
  const ed = row.extracted_data && typeof row.extracted_data === 'object' ? row.extracted_data : {};
  const raw = [row.tagline, ed.tagline].filter((x) => typeof x === 'string' && x.trim()).join(' ');
  return raw.trim().length;
}

function bucketIndex(row) {
  const tc = Number(row.traction_confidence);
  const highT = Number.isFinite(tc) ? tc >= TRACTION_HIGH : false;
  const hasTag = taglineLen(row) >= MIN_TAGLINE;
  if (highT && hasTag) return 0;
  if (highT && !hasTag) return 1;
  if (!highT && hasTag) return 2;
  return 3;
}

function truncate(s, max) {
  if (s == null || typeof s !== 'string') return '';
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function slimRecord(row) {
  const ed = row.extracted_data && typeof row.extracted_data === 'object' ? row.extracted_data : {};
  return {
    startup_id: row.id,
    name: row.name,
    status: row.status,
    website: row.website,
    source_type: row.source_type,
    tagline: truncate(row.tagline, 400),
    tagline_extracted: truncate(typeof ed.tagline === 'string' ? ed.tagline : '', 400),
    pitch: truncate(row.pitch, 600),
    description_snippet: truncate(row.description, 800),
    value_proposition_snippet: truncate(
      typeof ed.value_proposition === 'string' ? ed.value_proposition : '',
      600,
    ),
    problem_snippet: truncate(typeof ed.problem === 'string' ? ed.problem : '', 500),
    solution_snippet: truncate(typeof ed.solution === 'string' ? ed.solution : '', 500),
    execution_signals_column: Array.isArray(row.execution_signals) ? row.execution_signals : [],
    execution_signals_extracted: Array.isArray(ed.execution_signals) ? ed.execution_signals : [],
    team_signals_column: Array.isArray(row.team_signals) ? row.team_signals : [],
    team_signals_extracted: Array.isArray(ed.team_signals) ? ed.team_signals : [],
    grit_signals_column: Array.isArray(row.grit_signals) ? row.grit_signals : [],
    sectors: Array.isArray(row.sectors) ? row.sectors : [],
    stage: row.stage,
    maturity_level: row.maturity_level,
    funding_confidence: row.funding_confidence,
    traction_confidence: row.traction_confidence,
    total_god_score: row.total_god_score,
    label_notes: '',
    label_ontology_suggestions: '',
  };
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function sampleFromBuckets(buckets, totalLimit, stratify) {
  if (!stratify) {
    const flat = buckets.flat();
    shuffleInPlace(flat);
    return flat.slice(0, totalLimit).map((row) => {
      const rec = slimRecord(row);
      rec.stratum = 'flat';
      rec.stratum_label = 'no_stratify';
      return rec;
    });
  }

  const per = Math.ceil(totalLimit / 4);
  const out = [];
  for (let b = 0; b < 4; b++) {
    const pool = [...buckets[b]];
    shuffleInPlace(pool);
    const take = Math.min(per, pool.length);
    for (let i = 0; i < take; i++) {
      const rec = slimRecord(pool[i]);
      rec.stratum = b;
      rec.stratum_label = BUCKET_LABELS[b];
      out.push(rec);
    }
  }

  if (out.length < totalLimit) {
    const used = new Set(out.map((r) => r.startup_id));
    const rest = buckets.flat().filter((row) => !used.has(row.id));
    shuffleInPlace(rest);
    for (const row of rest) {
      if (out.length >= totalLimit) break;
      const rec = slimRecord(row);
      const bi = bucketIndex(row);
      rec.stratum = bi;
      rec.stratum_label = BUCKET_LABELS[bi];
      out.push(rec);
    }
  }

  shuffleInPlace(out);
  return out.slice(0, totalLimit);
}

async function fetchAll(supabase, statusFilter) {
  let from = 0;
  const rows = [];
  for (;;) {
    let q = supabase.from('startup_uploads').select(SELECT).order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (statusFilter !== 'all') q = q.eq('status', statusFilter);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += data.length;
  }
  return rows;
}

function csvEscape(v) {
  if (v == null) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows) {
  const keys = Object.keys(rows[0] || {});
  const lines = [keys.join(',')];
  for (const r of rows) {
    lines.push(keys.map((k) => csvEscape(r[k])).join(','));
  }
  return lines.join('\n');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY / VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  console.error('Fetching startup_uploads…');
  const rows = await fetchAll(supabase, args.status);
  console.error(`Loaded ${rows.length} rows (status=${args.status})`);

  const buckets = [[], [], [], []];
  for (const row of rows) {
    buckets[bucketIndex(row)].push(row);
  }
  console.error(
    `Strata sizes: ${BUCKET_LABELS.map((l, i) => `${l}=${buckets[i].length}`).join(' | ')}`,
  );

  const sampled = sampleFromBuckets(buckets, args.limit, args.stratify);
  console.error(`Sampled ${sampled.length} rows (limit=${args.limit}, stratify=${args.stratify})`);

  const payload =
    args.format === 'csv' ? toCsv(sampled) : sampled.map((r) => JSON.stringify(r)).join('\n');

  if (args.outPath) {
    const dir = path.dirname(args.outPath);
    if (dir && dir !== '.') fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(args.outPath, payload, 'utf8');
    console.error(`Wrote ${args.outPath}`);
  } else {
    process.stdout.write(payload + (payload.endsWith('\n') ? '' : '\n'));
  }

  console.error('\nColumns include label_notes / label_ontology_suggestions for human review.');
  console.error('Use for: ontology expansion, parser regex/LLM prompts, source-quality patterns — not GOD weight training.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
