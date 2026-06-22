#!/usr/bin/env node
/**
 * Pythh Growth Agent — Claude Agent SDK loop for signup funnel optimization.
 *
 * Requires: ANTHROPIC_API_KEY, @anthropic-ai/claude-agent-sdk
 *
 * Usage:
 *   npm run growth:agent
 *   npm run growth:agent -- --dry-run
 *   npm run growth:agent -- --max-turns=25 --max-budget-usd=2
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import * as dotenv from 'dotenv';

dotenv.config();

const require = createRequire(import.meta.url);
const root = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(root, '..');

const DRY_RUN = process.argv.includes('--dry-run');
const maxTurnsArg = process.argv.find((a) => a.startsWith('--max-turns='));
const maxBudgetArg = process.argv.find((a) => a.startsWith('--max-budget-usd='));
const MAX_TURNS = maxTurnsArg ? parseInt(maxTurnsArg.split('=')[1], 10) : 30;
const MAX_BUDGET = maxBudgetArg ? parseFloat(maxBudgetArg.split('=')[1]) : 3;

const PROMPT = `You are the Pythh Growth Agent. Follow agents/growth/CLAUDE.md.

Run this growth optimization cycle now:
1. node scripts/growth-metrics-snapshot.mjs --json
2. Read agents/growth/experiment-registry.json
3. Analyze founder + investor signup experiments; compare variant performance
4. Run npm run test:wizard-smoke (skip if network fails — note in report)
5. Write reports/growth-agent-${new Date().toISOString().slice(0, 10)}.json with winners, losers, and ONE concrete proposal
6. If a registry change is warranted, edit agents/growth/experiment-registry.json (new variants as draft only)

Do not git commit or deploy. End with a 5-bullet executive summary in the report JSON.`;

async function preflight() {
  console.log('📊 Preflight: metrics snapshot…');
  const r = spawnSync(process.execPath, ['scripts/growth-metrics-snapshot.mjs'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) console.warn('   ⚠️  metrics snapshot failed (agent may still proceed)');
}

async function runAgent() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required for the growth agent loop');
  }

  let query;
  try {
    ({ query } = await import('@anthropic-ai/claude-agent-sdk'));
  } catch {
    throw new Error('Install @anthropic-ai/claude-agent-sdk: npm install @anthropic-ai/claude-agent-sdk');
  }

  const report = {
    started_at: new Date().toISOString(),
    max_turns: MAX_TURNS,
    max_budget_usd: MAX_BUDGET,
    turns: [],
    result: null,
    session_id: null,
    cost_usd: null,
    status: 'running',
  };

  console.log('\n🔄 Growth agent loop starting…');
  console.log(`   maxTurns=${MAX_TURNS} maxBudget=$${MAX_BUDGET}\n`);

  for await (const message of query({
    prompt: PROMPT,
    options: {
      cwd: repoRoot,
      allowedTools: ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash'],
      permissionMode: DRY_RUN ? 'plan' : 'acceptEdits',
      settingSources: ['project'],
      maxTurns: MAX_TURNS,
      maxBudgetUsd: MAX_BUDGET,
      systemPrompt:
        'You optimize pythh.ai founder and investor signup funnels. Be data-driven. Prefer small measurable experiments.',
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
  const outFile = path.join(outDir, `growth-agent-run-${report.started_at.slice(0, 10)}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`\n📁 Run log: ${outFile}`);

  await persistRun(report);
  return report;
}

async function persistRun(report) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    await sb.from('growth_agent_runs').insert({
      session_id: report.session_id,
      status: report.status,
      prompt_excerpt: PROMPT.slice(0, 500),
      result: { summary: report.result, turns: report.turns.length },
      cost_usd: report.cost_usd,
      num_turns: report.num_turns,
    });
  } catch (e) {
    console.warn('   ⚠️  Could not persist growth_agent_runs:', e.message);
  }
}

async function main() {
  await preflight();
  if (DRY_RUN) {
    console.log('\n🏁 Dry-run: would invoke Claude Agent SDK with plan mode (no edits).\n');
    console.log(PROMPT.slice(0, 400) + '…');
    return;
  }
  await runAgent();
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exit(1);
});
