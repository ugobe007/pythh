#!/usr/bin/env node
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1] || 1000), 1), 5000);
const pipelineKey = 'startup_events_funding_history_v1';
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

function runSync(offset, sourceMaxCreatedAt) {
  const args = [
    'scripts/sync-funding-evidence-ledger.mjs',
    '--resolved-only', '--equity-only', '--lookback-days=3650',
    `--limit=${limit}`, `--offset=${offset}`,
    `--before=${sourceMaxCreatedAt}`,
  ];
  if (apply) args.push('--apply');
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { cwd: process.cwd(), env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => {
      if (code !== 0) return reject(new Error(stderr.trim() || `funding evidence sync exited ${code}`));
      try { resolve(JSON.parse(stdout)); }
      catch { reject(new Error(`funding evidence sync returned invalid JSON: ${stdout.slice(0, 300)}`)); }
    });
  });
}

function summarizeBatch(result) {
  return {
    mode: result.mode,
    event_offset: result.event_offset,
    source_max_created_at: result.source_max_created_at,
    events_scanned: Number(result.events_scanned || 0),
    evidence_eligible: Number(result.evidence_eligible || 0),
    skipped: result.skipped || {},
    coverage: result.coverage || {},
    events_written: Number(result.events_written || 0),
    evaluation_rows: Number(result.evaluation_rows || 0),
    miss_rows: Number(result.miss_rows || 0),
  };
}

async function main() {
  const { data: checkpoint, error } = await db.from('funding_evidence_backfill_checkpoints')
    .select('pipeline_key,source_max_created_at,next_offset,events_scanned,events_written,completed,last_run_at')
    .eq('pipeline_key', pipelineKey).maybeSingle();
  if (error) throw error;
  const state = checkpoint || { next_offset: 0, events_scanned: 0, events_written: 0, completed: false };
  if (state.completed) {
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', pipeline_key: pipelineKey, status: 'complete', checkpoint: state }, null, 2));
    return;
  }
  let sourceMaxCreatedAt = state.source_max_created_at;
  if (!sourceMaxCreatedAt) {
    const { data: newest, error: newestError } = await db.from('startup_events')
      .select('created_at').in('event_type', ['FUNDING', 'INVESTMENT'])
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (newestError) throw newestError;
    sourceMaxCreatedAt = newest?.created_at || new Date().toISOString();
  }
  const result = await runSync(Number(state.next_offset || 0), sourceMaxCreatedAt);
  const batch = summarizeBatch(result);
  const scanned = Number(result.events_scanned || 0);
  const written = Number(result.events_written || 0);
  const nextOffset = Number(state.next_offset || 0) + scanned;
  const completed = scanned < limit;
  if (apply) {
    const now = new Date().toISOString();
    const { data: advanced, error: writeError } = await db.from('funding_evidence_backfill_checkpoints').update({
      source_max_created_at: sourceMaxCreatedAt,
      next_offset: nextOffset,
      events_scanned: Number(state.events_scanned || 0) + scanned,
      events_written: Number(state.events_written || 0) + written,
      completed,
      last_result: batch,
      last_run_at: now,
      updated_at: now,
    }).eq('pipeline_key', pipelineKey)
      .eq('next_offset', Number(state.next_offset || 0))
      .eq('completed', false)
      .select('next_offset');
    if (writeError) throw writeError;
    if (!advanced?.length) {
      const { data: current } = await db.from('funding_evidence_backfill_checkpoints')
        .select('next_offset,completed,last_run_at').eq('pipeline_key', pipelineKey).maybeSingle();
      console.log(JSON.stringify({
        mode: 'apply', pipeline_key: pipelineKey, status: 'checkpoint_conflict',
        message: 'Another worker advanced the cursor; evidence upserts remain idempotent.',
        attempted_checkpoint_before: Number(state.next_offset || 0), current_checkpoint: current,
        batch,
      }, null, 2));
      return;
    }
  }
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run', pipeline_key: pipelineKey,
    checkpoint_before: Number(state.next_offset || 0), checkpoint_after: nextOffset,
    source_max_created_at: sourceMaxCreatedAt,
    completed, batch,
  }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
