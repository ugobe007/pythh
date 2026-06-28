#!/usr/bin/env node
/**
 * Pythh Product Agent — Claude Agent SDK loop for cross-domain product decisions.
 *
 * Requires: ANTHROPIC_API_KEY, @anthropic-ai/claude-agent-sdk
 *
 * Usage:
 *   npm run product:agent
 *   npm run product:agent:plan
 *   npm run product:agent -- --max-turns=35 --max-budget-usd=4
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import * as dotenv from 'dotenv';
import { buildAgentPrioritiesBlock } from './lib/agentContext.mjs';

dotenv.config();

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(root, '..');

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--plan');
const maxTurnsArg = process.argv.find((a) => a.startsWith('--max-turns='));
const maxBudgetArg = process.argv.find((a) => a.startsWith('--max-budget-usd='));
const MAX_TURNS = maxTurnsArg ? parseInt(maxTurnsArg.split('=')[1], 10) : 35;
const MAX_BUDGET = maxBudgetArg ? parseFloat(maxBudgetArg.split('=')[1]) : 4;

const date = new Date().toISOString().slice(0, 10);

const PROMPT = `You are the Pythh Product Agent. Follow agents/ORCHESTRATOR.md and agents/product/CLAUDE.md.

Read reports/orchestrator-brief-${date}.json (or latest orchestrator-brief-*.json) FIRST.

Run this product improvement cycle now:
0. Read latest reports/research-agent-*.json and agents/research/briefs/ if present
1. node scripts/product-metrics-snapshot.mjs --json
2. Read agents/product/opportunity-registry.json and agents/product/domains.json
3. Read agents/growth/experiment-registry.json
4. Pick the single highest-leverage gap — prioritize weakest orchestrator funnel stage + habit loops + analytics blind spots
5. Produce ONE deliverable: feature spec (with engagement loop + voice example), service design, experiment proposal, pipeline action, or analytics fix
   - If spec: write agents/product/specs/<opportunity-id>.md
6. Update opportunity-registry.json statuses/next_step (max one new opportunity)
7. Write reports/product-agent-${date}.json with summary, decision, deliverable, backlog_changes, active_engagement
8. npm run test:wizard-smoke (skip if network fails — note in report)

Voice: picky + skeptical + motivating. No passive specs.

Do not git commit or deploy. End with executive summary in the report JSON.`;

async function preflight() {
  console.log('💓 Preflight: funnel heartbeat…');
  const hb = spawnSync(process.execPath, ['scripts/funnel-heartbeat-probe.mjs', '--no-fail'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (hb.status !== 0) console.warn('   ⚠️  funnel heartbeat reported gaps (agent may still proceed)');

  console.log('📊 Preflight: product metrics snapshot…');
  const r = spawnSync(process.execPath, ['scripts/product-metrics-snapshot.mjs'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) console.warn('   ⚠️  product metrics snapshot failed (agent may still proceed)');
}

async function runAgent() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required for the product agent loop');
  }

  let query;
  try {
    ({ query } = await import('@anthropic-ai/claude-agent-sdk'));
  } catch {
    throw new Error('Install @anthropic-ai/claude-agent-sdk: npm install @anthropic-ai/claude-agent-sdk');
  }

  fs.mkdirSync(path.join(repoRoot, 'agents/product/specs'), { recursive: true });

  const report = {
    started_at: new Date().toISOString(),
    agent: 'product',
    max_turns: MAX_TURNS,
    max_budget_usd: MAX_BUDGET,
    turns: [],
    result: null,
    session_id: null,
    cost_usd: null,
    status: 'running',
  };

  console.log('\n🧠 Product agent loop starting…');
  console.log(`   maxTurns=${MAX_TURNS} maxBudget=$${MAX_BUDGET}\n`);

  for await (const message of query({
    prompt: PROMPT + buildAgentPrioritiesBlock(repoRoot),
    options: {
      cwd: repoRoot,
      allowedTools: ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash'],
      permissionMode: DRY_RUN ? 'plan' : 'acceptEdits',
      settingSources: ['project'],
      maxTurns: MAX_TURNS,
      maxBudgetUsd: MAX_BUDGET,
      systemPrompt:
        'You are the chief product agent for pythh.ai. Be data-driven. One shippable decision per run. Prefer instrumentation before new features when metrics are blind.',
    },
  })) {
    if (message.type === 'assistant' && message.message?.content) {
      for (const block of message.message.content) {
        if ('text' in block && block.text?.trim()) {
          report.turns.push({ type: 'text', preview: block.text.slice(0, 240) });
          if (!DRY_RUN) process.stdout.write(block.text);
        } else if ('name' in block) {
          report.turns.push({ type: 'tool', name: block.name });
          console.log(`\n🔧 Tool: ${block.name}`);
        }
      }
    }
    if (message.type === 'system' && message.subtype === 'init') {
      report.session_id = message.session_id;
    }
    if (message.type === 'result') {
      report.status = message.subtype;
      report.cost_usd = message.total_cost_usd;
      report.num_turns = message.num_turns;
      report.session_id = message.session_id || report.session_id;
      if (message.subtype === 'success') {
        report.result = message.result;
        console.log('\n✅ Agent finished:', message.result?.slice(0, 500));
      } else {
        console.log(`\n⚠️  Agent stopped: ${message.subtype}`);
      }
    }
  }

  report.finished_at = new Date().toISOString();
  const outDir = path.join(repoRoot, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `product-agent-run-${report.started_at.slice(0, 10)}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`\n📁 Run log: ${outFile}`);

  await persistRun(report, outFile);
  return report;
}

async function persistRun(report, reportPath) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    await sb.from('product_agent_runs').insert({
      session_id: report.session_id,
      status: report.status,
      prompt_excerpt: PROMPT.slice(0, 500),
      result: { summary: report.result, turns: report.turns.length },
      cost_usd: report.cost_usd,
      num_turns: report.num_turns,
      report_path: reportPath,
    });
  } catch (e) {
    console.warn('   ⚠️  Could not persist product_agent_runs:', e.message);
  }
}

async function main() {
  await preflight();
  if (DRY_RUN) {
    console.log('\n🏁 Plan mode: would invoke Claude Agent SDK (no edits).\n');
    console.log(PROMPT.slice(0, 500) + '…');
    return;
  }
  await runAgent();
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exit(1);
});
