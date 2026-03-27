#!/usr/bin/env node
'use strict';

/**
 * Weekly lookup funnel report from ai_logs analytics events.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/lookup-funnel-report.js
 */

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!url || !key) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);
const LOOKBACK_DAYS = Number(process.env.LOOKBACK_DAYS || 7);
const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

const FUNNEL_EVENTS = [
  'lookup_industry_selected',
  'lookup_top10_generated',
  'lookup_signup_cta_clicked',
  'lookup_signup_completed',
  'lookup_first_outreach_started',
];

async function main() {
  // Production schema: log_type, action_type, input_data (see match_queue_trigger etc.)
  const { data, error } = await supabase
    .from('ai_logs')
    .select('action_type, created_at')
    .eq('log_type', 'analytics')
    .in('action_type', FUNNEL_EVENTS)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const counts = Object.fromEntries(FUNNEL_EVENTS.map((e) => [e, 0]));
  for (const row of data || []) {
    const key = row.action_type;
    if (key && counts[key] !== undefined) counts[key] += 1;
  }

  const selected = counts.lookup_industry_selected || 0;
  const top10 = counts.lookup_top10_generated || 0;
  const cta = counts.lookup_signup_cta_clicked || 0;
  const signup = counts.lookup_signup_completed || 0;
  const outreach = counts.lookup_first_outreach_started || 0;

  const pct = (a, b) => (b > 0 ? ((a / b) * 100).toFixed(1) : '0.0');

  console.log(`\nPYTHH LOOKUP FUNNEL (${LOOKBACK_DAYS}d)\n`);
  console.log(`Industry selected:       ${selected}`);
  console.log(`Top10 generated:         ${top10} (${pct(top10, selected)}% of selected)`);
  console.log(`Signup CTA clicked:      ${cta} (${pct(cta, top10)}% of generated)`);
  console.log(`Signup completed:        ${signup} (${pct(signup, cta)}% of CTA clicks)`);
  console.log(`First outreach started:  ${outreach} (${pct(outreach, signup)}% of signups)`);
  console.log('');
}

main().catch((err) => {
  console.error('[lookup-funnel-report] failed:', err.message || err);
  process.exit(1);
});
