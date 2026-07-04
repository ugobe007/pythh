#!/usr/bin/env node
/**
 * Derive rolling firm thesis from recent investor_investments (default 90d).
 *
 * Usage:
 *   node scripts/refresh-firm-thesis-from-investments.mjs
 *   node scripts/refresh-firm-thesis-from-investments.mjs --apply --limit=200
 *   node scripts/refresh-firm-thesis-from-investments.mjs --apply --days=120
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import {
  fetchInvestorUniverse,
  parseLimitArg,
  parseCohortArg,
} from '../lib/investorUniverse.mjs';

dotenv.config();

const APPLY = process.argv.includes('--apply');
const LIMIT = parseLimitArg(process.argv.slice(2), { defaultZero: true });
const COHORT = parseCohortArg(process.argv.slice(2));
const daysArg = process.argv.find((a) => a.startsWith('--days='));
const DAYS = daysArg ? parseInt(daysArg.split('=')[1], 10) : 90;

const sb = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const STAGE_ORDER = ['pre-seed', 'seed', 'series a', 'series b', 'series c', 'growth'];

function normStage(raw) {
  if (!raw) return null;
  const s = String(raw).toLowerCase();
  if (s.includes('pre')) return 'pre-seed';
  if (s.includes('seed')) return 'seed';
  if (s.includes('series a') || s === 'a') return 'series a';
  if (s.includes('series b') || s === 'b') return 'series b';
  if (s.includes('series c') || s === 'c') return 'series c';
  if (s.includes('growth') || s.includes('late')) return 'growth';
  return s.slice(0, 24);
}

function topN(freq, n = 5) {
  return Object.entries(freq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([k]) => k);
}

function buildThesis(investor, deals) {
  const sectorFreq = {};
  const stageFreq = {};
  const companies = [];

  for (const d of deals) {
    if (d.company_name) companies.push(d.company_name);
    const industries = Array.isArray(d.industries) ? d.industries : [];
    for (const ind of industries) {
      const k = String(ind).trim().toLowerCase();
      if (k) sectorFreq[k] = (sectorFreq[k] || 0) + 1;
    }
    const stage = normStage(d.round_type);
    if (stage) stageFreq[stage] = (stageFreq[stage] || 0) + 1;
  }

  const sectors = topN(sectorFreq, 6);
  const stages = topN(stageFreq, 4).sort(
    (a, b) => STAGE_ORDER.indexOf(a) - STAGE_ORDER.indexOf(b)
  );

  const firm = investor.firm || investor.name;
  const recent = companies.slice(0, 5).join(', ');
  const sectorText = sectors.length ? sectors.join(', ') : 'mixed sectors';
  const stageText = stages.length ? stages.join(', ') : 'multi-stage';

  const summary =
    `${firm} — last ${DAYS}d: ${deals.length} deal(s). ` +
    `Focus: ${sectorText}. Stages: ${stageText}.` +
    (recent ? ` Recent: ${recent}.` : '');

  return { summary: summary.slice(0, 1200), sectors, stages };
}

async function main() {
  const cutoff = new Date(Date.now() - DAYS * 86400000).toISOString().slice(0, 10);
  console.log(`\n📊 Rolling firm thesis refresh (${DAYS}d)`);
  console.log(`   mode: ${APPLY ? 'APPLY' : 'dry-run'} · cohort ${COHORT} · limit ${LIMIT > 0 ? LIMIT : 'ALL'} · cutoff ${cutoff}\n`);

  const investors = await fetchInvestorUniverse(sb, { limit: LIMIT, cohort: COHORT });

  if (!investors.length) {
    console.log('No investors to process.');
    return;
  }

  let updated = 0;
  for (const inv of investors) {
    const { data: deals } = await sb
      .from('investor_investments')
      .select('company_name, round_type, industries, investment_date')
      .eq('investor_id', inv.id)
      .gte('investment_date', cutoff)
      .order('investment_date', { ascending: false })
      .limit(40);

    if (!deals?.length) continue;

    const thesis = buildThesis(inv, deals);
    console.log(`  ${inv.name}: ${deals.length} deals → ${thesis.sectors.join(', ') || '—'}`);

    if (APPLY) {
      const { error: upErr } = await sb
        .from('investors')
        .update({
          rolling_thesis_summary: thesis.summary,
          rolling_thesis_sectors: thesis.sectors,
          rolling_thesis_stages: thesis.stages,
          rolling_thesis_updated_at: new Date().toISOString(),
        })
        .eq('id', inv.id);
      if (!upErr) updated++;
    } else {
      updated++;
    }
  }

  console.log(`\n✅ ${APPLY ? 'Updated' : 'Would update'} ${updated} investors\n`);
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
