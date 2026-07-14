#!/usr/bin/env node
/**
 * Agent loop status — prove agents ran, what they produced, and whether fixes shipped.
 *
 * Usage:
 *   npm run agents:status
 *   node scripts/agent-status.mjs --json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSON_OUT = process.argv.includes('--json');

const TABLES = [
  { agent: 'Growth', table: 'growth_agent_runs' },
  { agent: 'Research', table: 'research_agent_runs' },
  { agent: 'Product', table: 'product_agent_runs' },
];

function excerpt(val, max = 200) {
  if (!val) return '';
  const text = typeof val === 'string' ? val : val.summary || JSON.stringify(val);
  return String(text).replace(/\s+/g, ' ').slice(0, max);
}

function latestReport(prefix) {
  const dir = path.join(repoRoot, 'reports');
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith(prefix) && f.endsWith('.json'))
    .sort()
    .reverse();
  return files[0] || null;
}

async function fetchGithubRuns() {
  try {
    const res = await fetch(
      'https://api.github.com/repos/ugobe007/pythh/actions/workflows/300580906/runs?per_page=5',
      { headers: { Accept: 'application/vnd.github+json' } },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.workflow_runs || []).map((r) => ({
      at: r.created_at,
      conclusion: r.conclusion,
      sha: r.head_sha?.slice(0, 7),
      url: r.html_url,
    }));
  } catch {
    return [];
  }
}

async function fetchAgentRuns(sb) {
  const out = [];
  for (const { agent, table } of TABLES) {
    const { data, error } = await sb
      .from(table)
      .select('created_at,status,num_turns,cost_usd,result')
      .order('created_at', { ascending: false })
      .limit(3);
    if (error) {
      out.push({ agent, error: error.message });
      continue;
    }
    out.push({
      agent,
      runs: (data || []).map((r) => ({
        at: r.created_at,
        status: r.status,
        turns: r.num_turns,
        cost_usd: r.cost_usd,
        summary: excerpt(r.result, 280),
        unshipped: /not commit|not pushed|no `--ship`|no --ship/i.test(excerpt(r.result, 500)),
      })),
    });
  }
  return out;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  const status = {
    generated_at: new Date().toISOString(),
    github_autopilot_runs: await fetchGithubRuns(),
    local_reports: {
      conversion_funnel: latestReport('conversion-funnel-'),
      orchestrator_brief: latestReport('orchestrator-brief-'),
      agent_daily_report: latestReport('agent-daily-report-'),
      growth_agent: latestReport('growth-agent-'),
      agent_autopilot_ship: latestReport('agent-autopilot-ship-'),
    },
    ship_policy_on_main: fs
      .readFileSync(path.join(repoRoot, '.github/workflows/agents-autopilot-daily.yml'), 'utf8')
      .includes('AGENT_ALLOW_SHIP'),
    agent_runs: url && key ? await fetchAgentRuns(createClient(url, key)) : [],
  };

  if (JSON_OUT) {
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  console.log('\n🤖 Pythh agent loop status\n');
  console.log('GitHub Actions — Agent Autopilot Daily (last 5):');
  for (const r of status.github_autopilot_runs) {
    console.log(`  ${r.at}  ${r.conclusion}  ${r.sha}  ${r.url}`);
  }
  console.log('\nLocal reports/ (gitignored — run autopilot locally to refresh):');
  for (const [k, v] of Object.entries(status.local_reports)) {
    console.log(`  ${k}: ${v || '—'}`);
  }
  console.log(`\nShip policy in workflow: ${status.ship_policy_on_main ? 'ON' : 'OFF'}`);

  if (!status.agent_runs.length) {
    console.log('\nSupabase agent runs: skipped (no SUPABASE_URL/SERVICE_KEY)\n');
    return;
  }

  console.log('\nSupabase agent runs (source of truth for LLM cycles):');
  for (const block of status.agent_runs) {
    if (block.error) {
      console.log(`  ${block.agent}: ERROR ${block.error}`);
      continue;
    }
    for (const r of block.runs) {
      const flag = r.unshipped ? ' ⚠️ UNSHIPPED' : '';
      console.log(`  ${block.agent} ${r.at}  ${r.status}  ${r.turns} turns  $${Number(r.cost_usd || 0).toFixed(2)}${flag}`);
      console.log(`    ${r.summary}`);
    }
  }
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
