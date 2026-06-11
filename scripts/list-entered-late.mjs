#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const THRESHOLD = 500_000_000;
const MAX = 15_000_000_000;
const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: ev } = await supabase
  .from('portfolio_events')
  .select('startup_id, post_money_usd')
  .eq('event_type', 'funding_round')
  .eq('verified', true)
  .gte('post_money_usd', THRESHOLD)
  .lte('post_money_usd', MAX);

const best = new Map();
for (const e of ev || []) {
  const v = Number(e.post_money_usd);
  if (!e.startup_id || !(v > 0)) continue;
  if (!best.has(e.startup_id) || v > best.get(e.startup_id)) best.set(e.startup_id, v);
}

const ids = [...best.keys()];
const { data: names } = await supabase.from('startup_uploads').select('id, name').in('id', ids);
const nm = new Map((names || []).map((r) => [r.id, r.name]));

const rows = ids
  .map((id) => ({ name: nm.get(id) || id, val: best.get(id) }))
  .sort((a, b) => b.val - a.val);

console.log(`Entered-late picks (verified round ≥ $${THRESHOLD / 1e6}M): ${rows.length}\n`);
for (const r of rows) {
  console.log(`  ${r.name.padEnd(28)} $${(r.val / 1e9).toFixed(2)}B  → 50× (capped, on $12M assumed entry)`);
}
