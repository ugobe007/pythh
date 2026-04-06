#!/usr/bin/env node
/**
 * Baseline logistic model on match_feedback + feature_snapshot + match_score.
 *
 *   node scripts/train-match-feedback-baseline.js --from-db --limit=5000
 *   node scripts/train-match-feedback-baseline.js --file=matches.jsonl
 *   node scripts/train-match-feedback-baseline.js --from-db --drift-sample=200
 *
 * Labels: positive = strong positive feedback types or feedback_value > 0.5;
 *         negative = passed / reported or feedback_value < -0.1.
 * Rows without snapshot are skipped with a count (backfill first).
 */

require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const {
  featureVectorFromSnapshot,
  FEATURE_NAMES,
} = require('../lib/matchFeatureSnapshot');

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const POS_TYPES = new Set(['contacted', 'meeting_scheduled', 'invested', 'saved']);
const NEG_TYPES = new Set(['passed', 'reported']);

function parseArgs(argv) {
  const out = {
    fromDb: false,
    file: null,
    limit: 8000,
    driftSample: 0,
    epochs: 80,
    lr: 0.15,
  };
  for (const a of argv) {
    if (a === '--from-db') out.fromDb = true;
    else if (a.startsWith('--file=')) out.file = a.slice('--file='.length) || null;
    else if (a.startsWith('--limit=')) out.limit = Math.max(10, parseInt(a.slice('--limit='.length), 10) || 8000);
    else if (a.startsWith('--drift-sample='))
      out.driftSample = Math.max(0, parseInt(a.slice('--drift-sample='.length), 10) || 0);
    else if (a.startsWith('--epochs=')) out.epochs = Math.max(5, parseInt(a.slice('--epochs='.length), 10) || 80);
    else if (a.startsWith('--lr=')) out.lr = Math.max(0.001, parseFloat(a.slice('--lr='.length)) || 0.15);
  }
  return out;
}

function sigmoid(z) {
  if (z > 35) return 1;
  if (z < -35) return 0;
  return 1 / (1 + Math.exp(-z));
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function labelFromFeedback(row) {
  const t = String(row.feedback_type || '').toLowerCase();
  const v = Number(row.feedback_value);
  if (NEG_TYPES.has(t)) return 0;
  if (POS_TYPES.has(t)) return 1;
  if (Number.isFinite(v)) {
    if (v > 0.5) return 1;
    if (v < -0.1) return 0;
  }
  return null;
}

function trainLogistic(X, y, lr, epochs) {
  const d = X[0].length;
  const w = new Array(d).fill(0);
  const n = X.length;
  for (let e = 0; e < epochs; e++) {
    for (let i = 0; i < n; i++) {
      const pred = sigmoid(dot(X[i], w));
      const err = pred - y[i];
      for (let j = 0; j < d; j++) w[j] -= (lr / n) * err * X[i][j];
    }
  }
  return w;
}

function metrics(X, y, w) {
  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0;
  for (let i = 0; i < X.length; i++) {
    const p = sigmoid(dot(X[i], w)) >= 0.5 ? 1 : 0;
    if (y[i] === 1 && p === 1) tp++;
    else if (y[i] === 0 && p === 1) fp++;
    else if (y[i] === 0 && p === 0) tn++;
    else if (y[i] === 1 && p === 0) fn++;
  }
  const acc = (tp + tn) / (tp + tn + fp + fn || 1);
  return { tp, fp, tn, fn, acc };
}

async function loadFromDb(limit) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: fb, error } = await supabase
    .from('match_feedback')
    .select('match_id, feedback_type, feedback_value, startup_id, investor_id')
    .not('match_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  const rows = fb || [];
  const matchIds = [...new Set(rows.map((r) => r.match_id).filter(Boolean))];
  const matchById = new Map();
  const chunk = 150;
  for (let i = 0; i < matchIds.length; i += chunk) {
    const slice = matchIds.slice(i, i + chunk);
    const { data: ms, error: mErr } = await supabase
      .from('startup_investor_matches')
      .select('id, match_score, feature_snapshot, startup_id, created_at')
      .in('id', slice);
    if (mErr) throw new Error(mErr.message);
    for (const m of ms || []) matchById.set(m.id, m);
  }
  const out = [];
  let skippedNoSnapshot = 0;
  let skippedLabel = 0;
  for (const f of rows) {
    const m = matchById.get(f.match_id);
    if (!m || !m.feature_snapshot) {
      skippedNoSnapshot++;
      continue;
    }
    const y = labelFromFeedback(f);
    if (y === null) {
      skippedLabel++;
      continue;
    }
    const x = featureVectorFromSnapshot(m.feature_snapshot, m.match_score);
    out.push({ x, y, match_id: m.id, startup_id: m.startup_id });
  }
  return {
    samples: out,
    skippedNoSnapshot,
    skippedLabel,
    feedback_row_count: rows.length,
  };
}

function loadFromFile(filePath) {
  const text = fs.readFileSync(path.resolve(filePath), 'utf8');
  const lines = text.split('\n').filter((l) => l.trim());
  const samples = [];
  let skippedNoSnapshot = 0;
  let skippedLabel = 0;
  for (const line of lines) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      continue;
    }
    const fb = row.feedback && row.feedback.length ? row.feedback[0] : null;
    if (!fb) {
      skippedLabel++;
      continue;
    }
    if (!row.feature_snapshot) {
      skippedNoSnapshot++;
      continue;
    }
    const y = labelFromFeedback(fb);
    if (y === null) {
      skippedLabel++;
      continue;
    }
    const x = featureVectorFromSnapshot(row.feature_snapshot, row.match_score);
    samples.push({ x, y, match_id: row.match_id });
  }
  return { samples, skippedNoSnapshot, skippedLabel, feedback_row_count: lines.length };
}

async function driftSample(n) {
  if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase env');
  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: ms, error } = await supabase
    .from('startup_investor_matches')
    .select('id, startup_id, match_score, feature_snapshot, created_at')
    .not('feature_snapshot', 'is', null)
    .order('created_at', { ascending: false })
    .limit(n);
  if (error) throw new Error(error.message);
  const rows = ms || [];
  const startupIds = [...new Set(rows.map((r) => r.startup_id))];
  const cur = new Map();
  const PAGE = 200;
  for (let i = 0; i < startupIds.length; i += PAGE) {
    const slice = startupIds.slice(i, i + PAGE);
    const { data: su, error: e2 } = await supabase
      .from('startup_uploads')
      .select('id, total_god_score, stage, data_completeness, maturity_level')
      .in('id', slice);
    if (e2) throw new Error(e2.message);
    for (const s of su || []) cur.set(s.id, s);
  }
  let dGod = 0;
  let nComp = 0;
  for (const m of rows) {
    const snap = m.feature_snapshot?.startup;
    const now = cur.get(m.startup_id);
    if (!snap || now == null || snap.total_god_score == null || now.total_god_score == null) continue;
    dGod += Math.abs(Number(now.total_god_score) - Number(snap.total_god_score));
    nComp++;
  }
  console.log(
    JSON.stringify(
      {
        drift_sample_size: rows.length,
        pairs_with_god_both: nComp,
        mean_abs_god_drift: nComp ? Math.round((dGod / nComp) * 100) / 100 : null,
        note: 'Higher drift suggests match-time features diverged from current profile (expected over weeks/months).',
      },
      null,
      2,
    ),
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.driftSample > 0) {
    await driftSample(args.driftSample);
    return;
  }

  let samples;
  let skippedNoSnapshot = 0;
  let skippedLabel = 0;

  let feedbackRowCount = 0;

  if (args.file) {
    ({ samples, skippedNoSnapshot, skippedLabel, feedback_row_count: feedbackRowCount } = loadFromFile(args.file));
  } else if (args.fromDb) {
    if (!supabaseUrl || !supabaseKey) {
      console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY');
      process.exit(1);
    }
    ({
      samples,
      skippedNoSnapshot,
      skippedLabel,
      feedback_row_count: feedbackRowCount,
    } = await loadFromDb(args.limit));
  } else {
    console.error('Usage: node scripts/train-match-feedback-baseline.js --from-db [--limit=8000]');
    console.error('   or: npm run ml:train-match-feedback');
    console.error('       node scripts/train-match-feedback-baseline.js --file=matches.jsonl');
    console.error('       node scripts/train-match-feedback-baseline.js --drift-sample=200');
    console.error('Tip: Use ASCII hyphen (-) in shell commands, not an em dash (—).');
    process.exit(1);
  }

  if (samples.length < 20) {
    const hint =
      feedbackRowCount === 0
        ? 'No match_feedback rows returned (empty table, RLS blocking service role in your env, or all rows lack match_id). Product: record swipes/saves/contacts so rows exist.'
        : skippedNoSnapshot > 0 && samples.length === 0
          ? 'Matches lack feature_snapshot. Run: npm run ml:backfill-match-snapshot -- --apply --limit=2000 (after migration), or wait for new matches from instant submit / queue.'
          : skippedLabel >= feedbackRowCount && feedbackRowCount > 0
            ? 'feedback_type / feedback_value values do not map to labels (see POS_TYPES/NEG_TYPES in this script).'
            : 'Collect more labeled feedback rows with feature_snapshot on the linked match.';

    console.log(
      JSON.stringify(
        {
          error: 'too_few_samples',
          n: samples.length,
          feedback_rows_considered: feedbackRowCount,
          skipped_no_snapshot: skippedNoSnapshot,
          skipped_unlabeled: skippedLabel,
          hint,
        },
        null,
        2,
      ),
    );
    process.exit(0);
  }

  const X = samples.map((s) => s.x);
  const y = samples.map((s) => s.y);
  const w = trainLogistic(X, y, args.lr, args.epochs);
  const m = metrics(X, y, w);

  const weights = {};
  for (let j = 0; j < w.length; j++) weights[FEATURE_NAMES[j] || `f${j}`] = Math.round(w[j] * 10000) / 10000;

  console.log(
    JSON.stringify(
      {
        n_samples: samples.length,
        skipped_no_snapshot: skippedNoSnapshot,
        skipped_unlabeled: skippedLabel,
        accuracy_in_sample: Math.round(m.acc * 1000) / 1000,
        confusion: { tp: m.tp, fp: m.fp, tn: m.tn, fn: m.fn },
        epochs: args.epochs,
        lr: args.lr,
        weights,
        caveat: 'In-sample accuracy only; use time-based splits for real evaluation.',
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
