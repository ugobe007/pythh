#!/usr/bin/env node
/**
 * Pythh Research Sub-Agent — market survey for founder/investor pain signals.
 *
 * Usage:
 *   npm run research:agent
 *   npm run research:agent:plan
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

const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('--plan');
const maxTurnsArg = process.argv.find((a) => a.startsWith('--max-turns='));
const maxBudgetArg = process.argv.find((a) => a.startsWith('--max-budget-usd='));
const MAX_TURNS = maxTurnsArg ? parseInt(maxTurnsArg.split('=')[1], 10) : 30;
const MAX_BUDGET = maxBudgetArg ? parseFloat(maxBudgetArg.split('=')[1]) : 3;

const date = new Date().toISOString().slice(0, 10);

const PROMPT = `You are the Pythh Research Sub-Agent. Follow agents/research/CLAUDE.md.

Survey the market and funding workflow for signals that inform Pythh product strategy.
North star: 100 signups/day (see agents/north-star.json).

Run this research cycle now:
1. node scripts/research-snapshot.mjs --json
2. Read agents/research/friction-taxonomy.json and agents/research/signal-sources.json
3. Read agents/research/findings-registry.json
4. Analyze RSS + internal startup_events for workflow friction, missing data, funding pain
5. Consider 3–5 product/service ideas that would appeal to founders AND investors
6. Update agents/research/findings-registry.json with ranked findings (max 5 new)
7. Write agents/research/briefs/${date}-market-brief.md (1-page human brief)
8. Write reports/research-agent-${date}.json with signup_velocity, top problems, market_opportunities, recommended_for_product_backlog

Do not git commit or deploy. Hand off high-confidence items to Product Agent via handoff block in findings.`;

async function preflight() {
  console.log('🔭 Preflight: research snapshot…');
  const r = spawnSync(process.execPath, ['scripts/research-snapshot.mjs'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
  if (r.status !== 0) console.warn('   ⚠️  research snapshot failed (agent may still proceed)');
}

async function runAgent() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is required for the research agent loop');
  }

  let query;
  try {
    ({ query } = await import('@anthropic-ai/claude-agent-sdk'));
  } catch {
    throw new Error('Install @anthropic-ai/claude-agent-sdk');
  }

  fs.mkdirSync(path.join(repoRoot, 'agents/research/briefs'), { recursive: true });

  const report = {
    started_at: new Date().toISOString(),
    agent: 'research',
    max_turns: MAX_TURNS,
    max_budget_usd: MAX_BUDGET,
    turns: [],
    result: null,
    session_id: null,
    cost_usd: null,
    status: 'running',
  };

  console.log('\n🔭 Research agent loop starting…');
  console.log(`   maxTurns=${MAX_TURNS} maxBudget=$${MAX_BUDGET}\n`);

  for await (const message of query({
    prompt: PROMPT,
    options: {
      cwd: repoRoot,
      allowedTools: ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash', 'WebSearch'],
      permissionMode: DRY_RUN ? 'plan' : 'acceptEdits',
      settingSources: ['project'],
      maxTurns: MAX_TURNS,
      maxBudgetUsd: MAX_BUDGET,
      systemPrompt:
        'You survey the fundraising market for founder and investor pain. Connect every finding to Pythh signup growth toward 100/day. Cite evidence.',
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
        console.log('\n✅ Research agent finished:', message.result?.slice(0, 500));
      } else {
        console.log(`\n⚠️  Agent stopped: ${message.subtype}`);
      }
    }
  }

  report.finished_at = new Date().toISOString();
  const outDir = path.join(repoRoot, 'reports');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `research-agent-run-${report.started_at.slice(0, 10)}.json`);
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  console.log(`\n📁 Run log: ${outFile}`);

  await persistRun(report, outFile);
  await syncFindings();
  return report;
}

async function persistRun(report, reportPath) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    await sb.from('research_agent_runs').insert({
      session_id: report.session_id,
      status: report.status,
      prompt_excerpt: PROMPT.slice(0, 500),
      result: { summary: report.result, turns: report.turns.length },
      cost_usd: report.cost_usd,
      num_turns: report.num_turns,
      report_path: reportPath,
    });
  } catch (e) {
    console.warn('   ⚠️  Could not persist research_agent_runs:', e.message);
  }
}

async function syncFindings() {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const { syncFindingsToDb } = require('../server/lib/marketResearch.js');
    const sb = createClient(
      process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
    const { synced } = await syncFindingsToDb(sb);
    if (synced) console.log(`   ✅ Synced ${synced} research findings to DB`);
  } catch (e) {
    console.warn('   ⚠️  findings sync skipped:', e.message);
  }
}

async function main() {
  await preflight();
  if (DRY_RUN) {
    console.log('\n🏁 Plan mode: would invoke Research Agent (no edits).\n');
    console.log(PROMPT.slice(0, 500) + '…');
    return;
  }
  await runAgent();
}

main().catch((e) => {
  console.error('Fatal:', e.message || e);
  process.exit(1);
});
