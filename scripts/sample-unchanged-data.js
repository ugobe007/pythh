#!/usr/bin/env node
/**
 * SAMPLE UNCHANGED STARTUP DATA
 * =============================
 * Fetches a random sample of approved startups to review data shape and variables.
 * Use this to understand what the ~12k "unchanged" startups look like and
 * develop better scraper intelligence.
 *
 * Run: node scripts/sample-unchanged-data.js [--count=100] [--examples=15] [--json=output.json]
 *       node scripts/sample-unchanged-data.js --floor-only   # Focus on score=40 (typical "unchanged")
 *
 * Outputs:
 *   1. Column population rates (% non-null/non-empty)
 *   2. Value distributions for key fields
 *   3. Random example records (full or summarized)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const countArg = process.argv.find(a => a.startsWith('--count='));
const examplesArg = process.argv.find(a => a.startsWith('--examples='));
const jsonArg = process.argv.find(a => a.startsWith('--json='));
const FLOOR_ONLY = process.argv.includes('--floor-only');
const COUNT = countArg ? parseInt(countArg.split('=')[1]) : 150;
const NUM_EXAMPLES = examplesArg ? parseInt(examplesArg.split('=')[1]) : 15;
const JSON_OUT = jsonArg ? jsonArg.split('=')[1] : null;


// Key columns for scoring/enrichment (prioritize these in output)
const KEY_COLUMNS = [
  'name', 'website', 'tagline', 'pitch', 'description',
  'sectors', 'stage', 'total_god_score',
  'has_revenue', 'has_customers', 'is_launched', 'has_demo',
  'customer_count', 'mrr', 'arr', 'team_size',
  'last_round_amount_usd', 'total_funding_usd', 'raise_amount',
  'lead_investor', 'backed_by',
  'has_technical_cofounder', 'founders',
  'extracted_data', 'enrichment_status',
  'created_at', 'updated_at',
];

function isPopulated(val) {
  if (val == null) return false;
  if (typeof val === 'string' && val.trim().length === 0) return false;
  if (Array.isArray(val) && val.length === 0) return false;
  if (typeof val === 'object' && Object.keys(val).length === 0) return false;
  return true;
}

function summarizeValue(val, maxLen = 80) {
  if (val == null) return null;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val;
  if (Array.isArray(val)) {
    if (val.length === 0) return '[]';
    const sample = val.slice(0, 3).map(v => (typeof v === 'object' ? JSON.stringify(v).slice(0, 30) : String(v)));
    return `[${sample.join(', ')}${val.length > 3 ? ` ...+${val.length - 3}` : ''}]`;
  }
  if (typeof val === 'object') {
    const keys = Object.keys(val).slice(0, 5);
    const str = JSON.stringify(val).slice(0, maxLen);
    return str.length >= maxLen ? str + '...' : str;
  }
  const s = String(val);
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}

async function main() {
  console.log('\n📊 SAMPLE UNCHANGED STARTUP DATA\n');
  console.log('═'.repeat(70));
  console.log(`Fetching ${COUNT} approved startups${FLOOR_ONLY ? ' (score=40 floor only)' : ''}...\n`);

  let query = supabase
    .from('startup_uploads')
    .select('id,name,website,tagline,pitch,description,sectors,stage,total_god_score,has_revenue,has_customers,is_launched,has_demo,customer_count,mrr,arr,team_size,extracted_data,enrichment_status,created_at,source_type', { count: 'exact' })
    .eq('status', 'approved');
  if (FLOOR_ONLY) query = query.eq('total_god_score', 40);

  const { data, count: total, error } = await query
    .order('created_at', { ascending: true })
    .limit(COUNT);

  if (error) {
    console.error('❌ Query error:', error.message);
    console.error('   Code:', error.code, '| Details:', error.details);
    process.exit(1);
  }

  const all = data || [];

  console.log(`Loaded ${all.length} startups${total != null ? ` (of ${total} total)` : ''}\n`);

  // 1) Column population
  const cols = all.length > 0 ? Object.keys(all[0]) : [];
  const pop = {};
  for (const c of cols) {
    let n = 0;
    for (const row of all) {
      if (isPopulated(row[c])) n++;
    }
    pop[c] = { count: n, pct: ((n / all.length) * 100).toFixed(1) };
  }

  console.log('📐 COLUMN POPULATION (% non-null/non-empty)\n');
  const sorted = cols
    .filter(c => pop[c].count > 0)
    .sort((a, b) => pop[b].count - pop[a].count);

  // Group: key columns first, then rest
  const keySet = new Set(KEY_COLUMNS);
  const keyCols = sorted.filter(c => keySet.has(c));
  const otherCols = sorted.filter(c => !keySet.has(c));

  console.log('Key columns (scoring/enrichment):');
  console.log('─'.repeat(50));
  for (const c of keyCols.slice(0, 35)) {
    console.log(`  ${c.padEnd(28)} ${String(pop[c].pct).padStart(6)}%  (${pop[c].count}/${all.length})`);
  }

  console.log('\nOther columns:');
  console.log('─'.repeat(50));
  for (const c of otherCols.slice(0, 25)) {
    console.log(`  ${c.padEnd(28)} ${String(pop[c].pct).padStart(6)}%  (${pop[c].count}/${all.length})`);
  }

  // 2) Value distributions for key categorical/numeric fields
  console.log('\n\n📈 VALUE DISTRIBUTIONS (sample)\n');
  const distCols = ['total_god_score', 'sectors', 'stage', 'enrichment_status'];
  for (const c of distCols) {
    if (!cols.includes(c)) continue;
    const counts = {};
    for (const row of all) {
      const v = row[c];
      let key;
      if (Array.isArray(v)) key = v.length === 0 ? '(empty)' : v.slice(0, 2).join(', ');
      else key = v == null || v === '' ? '(null)' : String(v);
      counts[key] = (counts[key] || 0) + 1;
    }
    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log(`  ${c}:`);
    for (const [k, n] of entries) {
      console.log(`    ${k.slice(0, 50).padEnd(52)} ${n}`);
    }
    console.log('');
  }

  // 3) extracted_data shape (nested keys)
  const extKeys = new Set();
  let extPopulated = 0;
  for (const row of all) {
    const ed = row.extracted_data;
    if (ed && typeof ed === 'object') {
      extPopulated++;
      for (const k of Object.keys(ed)) extKeys.add(k);
    }
  }
  console.log(`extracted_data: ${extPopulated}/${all.length} have it. Top-level keys: ${[...extKeys].sort().join(', ')}\n`);

  // 4) Random examples (limit extracted_data size in display)
  const shuffled = [...all].sort(() => Math.random() - 0.5);
  const examples = shuffled.slice(0, Math.min(NUM_EXAMPLES, all.length));

  console.log(`\n📋 RANDOM EXAMPLES (${NUM_EXAMPLES} full records)\n`);
  console.log('═'.repeat(70));

  for (let i = 0; i < examples.length; i++) {
    const s = examples[i];
    console.log(`\n--- Example ${i + 1}: ${(s.name || '(unnamed)').slice(0, 50)} ---`);
    for (const c of KEY_COLUMNS) {
      if (!(c in s)) continue;
      const v = s[c];
      if (!isPopulated(v)) continue;
      const summary = c === 'extracted_data' ? JSON.stringify(v).slice(0, 120) + (JSON.stringify(v).length > 120 ? '...' : '') : summarizeValue(v, 100);
      console.log(`  ${c}: ${summary}`);
    }
  }

  if (JSON_OUT) {
    const out = {
      meta: { total_sampled: all.length, examples: NUM_EXAMPLES, columns: cols.length },
      population: pop,
      examples: examples.map(s => {
        const o = {};
        for (const c of KEY_COLUMNS) {
          if (c in s && isPopulated(s[c])) o[c] = s[c];
        }
        return o;
      }),
    };
    fs.writeFileSync(JSON_OUT, JSON.stringify(out, null, 2));
    console.log(`\n\n✅ Wrote full sample + examples to ${JSON_OUT}\n`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
