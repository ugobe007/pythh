#!/usr/bin/env node
/**
 * Match Outcome Agent — continual reconciliation loop
 *
 *   recover missing URLs → triage (timestamps + cohort) → promote ledger → search → Slack
 *
 * Usage:
 *   npm run outcomes:agent -- --apply --limit=400 --delay=400
 *   npm run outcomes:agent -- --apply --skip-recover --limit=100
 *   npm run outcomes:agent -- --notify-only
 *
 * After recover-urls prints JSON, triage + search can take 10–40+ minutes with little
 * output — that is NOT a hang. Wait for [search] / final progress JSON. Do not paste
 * JSON fragments into zsh (causes `parse error near '}'`).
 */
import 'dotenv/config';
import { spawn } from 'node:child_process';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';
import { fetchCohortProgress, RESOLUTION_TARGET } from '../lib/cohortProgress.mjs';

const require = createRequire(import.meta.url);
const { sourceTier } = require('../../server/lib/matchEvidenceSourceTier.js');

const apply = process.argv.includes('--apply');
const notifyOnly = process.argv.includes('--notify-only');
const skipRecover = process.argv.includes('--skip-recover');
const limit = Math.max(1, Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] || 400));
const delay = Math.max(0, Number(process.argv.find((a) => a.startsWith('--delay='))?.split('=')[1] || 400));
const recoverLimit = Math.max(
  1,
  Number(
    process.argv.find((a) => a.startsWith('--recover-limit='))?.split('=')[1] ||
      Math.min(Math.max(limit, 50), 80),
  ),
);
const TARGET = RESOLUTION_TARGET;

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('Missing Supabase service environment');
const db = createClient(url, serviceKey, { auth: { persistSession: false } });

function phase(msg) {
  console.log(`\n⏱  ${new Date().toISOString()} — ${msg}`);
}

async function slackNotify(title, message) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return false;
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: `*${title}*\n${message}` }),
      signal: AbortSignal.timeout(10000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function listHighTierPending(limitRows = 25) {
  const { data, error } = await db
    .from('match_validation_evidence')
    .select('id, source_url, source_provider, event_at, startup_id, investor_id, review_status')
    .eq('review_status', 'pending')
    .order('event_at', { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data || [])
    .filter((row) => sourceTier(row.source_url) === 'high')
    .slice(0, limitRows);
}

function runNodeScript(scriptPath, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const args = [scriptPath, ...extraArgs];
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      process.stdout.write(chunk);
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
      process.stderr.write(chunk);
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${scriptPath} exited ${code}: ${stderr.slice(0, 400)}`));
        return;
      }
      resolve(stdout);
    });
  });
}

const highBefore = await listHighTierPending(50);

if (!notifyOnly) {
  if (!skipRecover) {
    // [1] Recover missing/publisher websites — scoring + matching + search need a real URL
    phase(`[1/4] recover-urls (limit=${recoverLimit}) — then triage/search continue; do not Ctrl+C on recover JSON`);
    await runNodeScript('scripts/recover-startup-urls.mjs', [
      ...(apply ? ['--apply'] : []),
      `--limit=${recoverLimit}`,
      '--delay=250',
    ]);
  } else {
    phase('[1/4] recover-urls skipped (--skip-recover)');
  }

  // [2] Rectify earliest_match_at + boost qualified cohort / issuer-ledger
  phase('[2/4] triage-queue (can take several minutes; silent is normal)');
  await runNodeScript('scripts/triage-funding-evidence-queue.mjs', [
    ...(apply ? ['--apply', '--park-weak', `--target=${TARGET}`] : [`--target=${TARGET}`]),
  ]);

  // [3] Search priority>0 — ontology public sources (SEC Form D, NSF/SBIR, USASpending) + news
  phase(`[3/4] ontology search (limit=${limit}, delay=${delay}ms) — wait for [search] lines`);
  await runNodeScript('scripts/search-startup-funding-evidence.mjs', [
    ...(apply ? ['--apply'] : []),
    '--provider=ontology',
    `--limit=${limit}`,
    `--delay=${delay}`,
  ]);

  // Verify issuer-primary hits found/seeded by search
  phase('[4/4] promote-ledger');
  await runNodeScript('scripts/promote-ledger-funding-evidence.mjs', [
    ...(apply ? ['--apply', '--reject-low-pending'] : []),
    `--limit=${Math.max(limit, 100)}`,
  ]);
}

const highAfter = await listHighTierPending(50);
const beforeIds = new Set(highBefore.map((r) => r.id));
const newlyHigh = highAfter.filter((r) => !beforeIds.has(r.id));
const progress = await fetchCohortProgress({ target: TARGET });

const SITE_ORIGIN = (
  process.env.APP_URL ||
  process.env.APP_BASE_URL ||
  process.env.PUBLIC_SITE_URL ||
  'https://pythh.ai'
).replace(/\/$/, '');

const summary = {
  mode: notifyOnly ? 'notify-only' : apply ? 'apply' : 'dry-run',
  limit,
  recover_limit: skipRecover ? 0 : recoverLimit,
  skip_recover: skipRecover,
  high_tier_pending: highAfter.length,
  newly_high_tier: newlyHigh.length,
  progress,
  // Always absolute — bare paths get treated as hostnames (ENOTFOUND) in some terminals/agents
  review_url: `${SITE_ORIGIN}/admin/match-outcomes`,
};

if (newlyHigh.length || (notifyOnly && highAfter.length)) {
  const lines = (newlyHigh.length ? newlyHigh : highAfter)
    .slice(0, 10)
    .map((r) => `• ${r.id.slice(0, 8)}… ${r.source_provider} ${String(r.source_url || '').slice(0, 80)}`);
  await slackNotify(
    'Pythh match outcomes — high-tier evidence ready',
    `${summary.high_tier_pending} high-tier pending (new this run: ${summary.newly_high_tier})\n` +
      `Resolved toward ${TARGET}: ${progress?.resolved_count ?? '?'}/${TARGET} (${progress?.pct ?? '?'}%)\n` +
      `Review: ${summary.review_url}\n${lines.join('\n')}`,
  );
}

phase('match-outcome agent complete');
console.log(JSON.stringify(summary, null, 2));
