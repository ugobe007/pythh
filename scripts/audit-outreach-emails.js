#!/usr/bin/env node
'use strict';
/**
 * Audit investor email quality for outreach campaigns.
 *
 * Usage:
 *   node scripts/audit-outreach-emails.js
 *   node scripts/audit-outreach-emails.js --csv   # export sample rows
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { INTAKE_SLUGS } = require('../lib/investorEmailInfer');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const EXPORT_CSV = process.argv.includes('--csv');

const INTAKE_SET = new Set(INTAKE_SLUGS);

function classifyEmail(email, investorName) {
  if (!email) return 'missing';
  const local = String(email).split('@')[0].toLowerCase().trim();
  if (INTAKE_SET.has(local)) return 'intake';
  if (local.includes('.')) return 'personal';
  if (/^[a-z]+$/.test(local) && local.length >= 3 && looksLikePersonName(investorName)) return 'personal';
  return 'generic';
}

function looksLikePersonName(name) {
  if (!name) return false;
  const parts = String(name).trim().split(/\s+/);
  if (parts.length < 2) return false;
  const firmWords = new Set([
    'capital', 'ventures', 'venture', 'partners', 'fund', 'associates', 'investments',
    'enterprises', 'enterprise', 'group', 'holdings', 'advisory', 'advisors',
  ]);
  const last = parts[parts.length - 1].toLowerCase();
  return !firmWords.has(last);
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const db = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data: rows, error } = await db
    .from('investors')
    .select('id, name, firm, email_best_guess, email_status, investor_score')
    .not('email_best_guess', 'is', null)
    .in('email_status', ['inferred', 'verified'])
    .order('investor_score', { ascending: false, nullsFirst: false });

  if (error) {
    console.error(error.message);
    process.exit(1);
  }

  const counts = { personal: 0, intake: 0, generic: 0, missing: 0 };
  const samples = { personal: [], intake: [], generic: [] };

  for (const row of rows || []) {
    const kind = classifyEmail(row.email_best_guess, row.name);
    counts[kind]++;
    if (samples[kind] && samples[kind].length < 8) {
      samples[kind].push({
        name: row.name,
        firm: row.firm,
        email: row.email_best_guess,
        status: row.email_status,
        score: row.investor_score,
      });
    }
  }

  const total = rows?.length || 0;
  const pct = (n) => (total ? ((n / total) * 100).toFixed(1) : '0.0');

  console.log('\n=== Pythh Outreach Email Audit ===\n');
  console.log(`Total sendable investor emails: ${total}`);
  console.log(`  Personal (name-based):  ${counts.personal}  (${pct(counts.personal)}%)`);
  console.log(`  Intake (pitch@, etc.):  ${counts.intake}  (${pct(counts.intake)}%)`);
  console.log(`  Generic (other):        ${counts.generic}  (${pct(counts.generic)}%)`);
  console.log('\nRecommendation:');
  console.log('  • Personal → partner-level oracle preview, use first name');
  console.log('  • Intake   → firm-level signal digest, use "Hi team at {firm}"');
  console.log('  • Generic  → treat as intake until verified\n');

  for (const kind of ['personal', 'intake', 'generic']) {
    console.log(`--- Sample ${kind} ---`);
    for (const s of samples[kind]) {
      console.log(`  ${s.name} @ ${s.firm} → ${s.email} (${s.status}, score ${s.score ?? '—'})`);
    }
    console.log('');
  }

  if (EXPORT_CSV) {
    console.log('name,firm,email,email_type,email_status,investor_score');
    for (const row of rows || []) {
      const kind = classifyEmail(row.email_best_guess, row.name);
      console.log(
        `"${(row.name || '').replace(/"/g, '""')}","${(row.firm || '').replace(/"/g, '""')}",${row.email_best_guess},${kind},${row.email_status},${row.investor_score ?? ''}`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
