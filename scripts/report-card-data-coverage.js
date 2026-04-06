#!/usr/bin/env node
/**
 * Report how much "card + scoring" data exists for approved startups and investors.
 *
 * Maps to:
 *   - Startup: StartupProfileCard + get_startup_context + recalculate-scores `toScoringProfile`
 *   - Investor: investor cards / reveal + `server/services/investorScoringService.ts`
 *
 * Usage:
 *   node scripts/report-card-data-coverage.js
 *   node scripts/report-card-data-coverage.js --json
 *   node scripts/report-card-data-coverage.js --status=all
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ quiet: true });

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

/** Supabase PostgREST commonly returns at most 1000 rows per request — page by actual batch size. */
const PAGE = 1000;

const STARTUP_SELECT = [
  'id',
  'status',
  'website',
  'tagline',
  'description',
  'pitch',
  'stage',
  'sectors',
  'extracted_data',
  'arr_usd',
  'revenue_usd',
  'arr',
  'revenue_annual',
  'mrr',
  'customer_count',
  'parsed_customers',
  'parsed_users',
  'growth_rate_monthly',
  'growth_rate',
  'arr_growth_rate',
  'total_funding_usd',
  'last_round_amount_usd',
  'funding_confidence',
  'traction_confidence',
  'burn_monthly_usd',
  'runway_months',
  'team_size',
  'founders',
  'founder_education',
  'credential_signals',
  'has_technical_cofounder',
  'is_launched',
  'has_demo',
  'has_revenue',
  'has_customers',
  'execution_signals',
  'deck_filename',
  'deck_url',
  'maturity_level',
  'lead_investor',
  'latest_funding_round',
  'latest_funding_amount',
].join(',');

const INVESTOR_SELECT = [
  'id',
  'name',
  'firm',
  'bio',
  'check_size_min',
  'check_size_max',
  'stage',
  'sectors',
  'geography_focus',
  'investment_thesis',
  'total_investments',
  'successful_exits',
  'notable_investments',
  'active_fund_size',
  'dry_powder_estimate',
  'investment_pace_per_year',
  'leads_rounds',
  'follows_rounds',
  'linkedin_url',
  'twitter_url',
  'twitter_handle',
  'photo_url',
  'portfolio_companies',
  'is_verified',
  'email',
].join(',');

function nz(v) {
  if (v == null) return false;
  if (typeof v === 'number') return Number.isFinite(v) && v > 0;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.trim().length > 0;
  return false;
}

function numPos(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0;
}

function arrLen(v) {
  return Array.isArray(v) && v.length > 0;
}

function startupExtracted(s) {
  return s && typeof s.extracted_data === 'object' && s.extracted_data ? s.extracted_data : {};
}

/** @param {any} s */
function evalStartupDimensions(s) {
  const e = startupExtracted(s);
  const ex = e.execution_signals;
  const execArr = Array.isArray(ex) ? ex : [];
  const web = e.web_signals || {};

  return {
    funding_rounds:
      numPos(s.total_funding_usd) ||
      numPos(s.last_round_amount_usd) ||
      nz(s.latest_funding_round) ||
      nz(s.latest_funding_amount) ||
      numPos(e.funding_amount) ||
      numPos(e.previous_funding),
    revenue_mrr_arr:
      numPos(s.arr_usd) ||
      numPos(s.revenue_usd) ||
      numPos(s.arr) ||
      numPos(s.revenue_annual) ||
      numPos(s.mrr) ||
      numPos(e.revenue) ||
      numPos(e.arr) ||
      numPos(e.mrr) ||
      s.has_revenue === true ||
      (nz(e.has_revenue) && e.has_revenue !== false),
    customers_users:
      numPos(s.customer_count) ||
      numPos(s.parsed_customers) ||
      numPos(s.parsed_users) ||
      numPos(e.customer_count) ||
      numPos(e.customers) ||
      numPos(e.active_users) ||
      s.has_customers === true,
    growth_velocity:
      numPos(s.growth_rate_monthly) ||
      numPos(s.arr_growth_rate) ||
      (typeof s.growth_rate === 'string' && s.growth_rate.trim().length > 0) ||
      nz(e.growth_rate),
    team_founder_pedigree:
      numPos(s.team_size) ||
      arrLen(s.founders) ||
      arrLen(s.founder_education) ||
      arrLen(s.credential_signals) ||
      s.has_technical_cofounder === true ||
      arrLen(e.team) ||
      numPos(e.founders_count),
    product_velocity:
      s.is_launched === true ||
      s.has_demo === true ||
      execArr.length > 0 ||
      nz(e.is_launched) ||
      nz(e.demo_available) ||
      nz(e.mvp_stage),
    narrative_identity:
      nz(s.description) ||
      nz(s.tagline) ||
      nz(s.pitch) ||
      nz(e.value_proposition) ||
      nz(e.product_description) ||
      (nz(e.problem) && nz(e.solution)),
    stage_sector_fit:
      s.stage != null ||
      arrLen(s.sectors) ||
      arrLen(e.sectors) ||
      arrLen(e.industries),
    investor_backing_signal:
      nz(s.lead_investor) ||
      arrLen(e.investors) ||
      arrLen(e.backed_by) ||
      nz(e.backed_by),
    maturity_trajectory: nz(s.maturity_level),
    parser_confidence_gate:
      (Number(s.funding_confidence) >= 0.35) || (Number(s.traction_confidence) >= 0.35),
    deck_materials: nz(s.deck_url) || nz(s.deck_filename),
    burn_runway_planning:
      numPos(s.burn_monthly_usd) || numPos(s.runway_months) || numPos(e.burn_rate) || numPos(e.runway_months),
    web_press_signals:
      !!(web.blog && (web.blog.found || web.blog.post_count_estimate > 0)) ||
      !!(web.press_tier && (web.press_tier.tier1_count > 0 || web.press_tier.total > 0)),
  };
}

/** @param {any} inv */
function evalInvestorDimensions(inv) {
  const bio = inv.bio || '';
  const thesis = inv.investment_thesis || '';
  const notable = inv.notable_investments;
  const notableOk =
    (Array.isArray(notable) && notable.length > 0) ||
    (notable && typeof notable === 'object' && Object.keys(notable).length > 0);

  return {
    identity_name_firm: nz(inv.name) && nz(inv.firm),
    bio_substantive: bio.length > 50,
    check_size_range: numPos(inv.check_size_min) || numPos(inv.check_size_max),
    stage_focus: arrLen(inv.stage),
    sector_focus: arrLen(inv.sectors),
    investment_thesis: thesis.trim().length > 20,
    geography_focus: arrLen(inv.geography_focus),
    track_record_counts:
      numPos(inv.total_investments) || numPos(inv.successful_exits) || notableOk,
    fund_dry_powder: numPos(inv.active_fund_size) || numPos(inv.dry_powder_estimate),
    round_leadership_style: inv.leads_rounds === true || inv.follows_rounds === true,
    investment_pace: numPos(inv.investment_pace_per_year),
    social_presence:
      nz(inv.linkedin_url) || nz(inv.twitter_url) || nz(inv.twitter_handle) || nz(inv.photo_url),
    portfolio_hook: arrLen(inv.portfolio_companies),
    verified: inv.is_verified === true,
    direct_contact: nz(inv.email),
  };
}

function finalize(counts, total) {
  return Object.entries(counts).map(([id, present]) => {
    const p = present;
    const missing = total - p;
    return {
      id,
      present: p,
      missing,
      pct_present: total ? Math.round((p / total) * 1000) / 1000 : 0,
      pct_missing: total ? Math.round((missing / total) * 1000) / 1000 : 0,
    };
  });
}

async function paginateStartups(supabase, statusFilter) {
  let from = 0;
  const rows = [];
  for (;;) {
    let q = supabase.from('startup_uploads').select(STARTUP_SELECT).order('id', { ascending: true }).range(from, from + PAGE - 1);
    if (statusFilter !== 'all') {
      q = q.eq('status', statusFilter);
    }
    const { data, error } = await q;
    if (error) throw new Error(`startup_uploads: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += data.length;
  }
  return rows;
}

async function paginateInvestors(supabase) {
  let from = 0;
  const rows = [];
  for (;;) {
    const { data, error } = await supabase
      .from('investors')
      .select(INVESTOR_SELECT)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`investors: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
    from += data.length;
  }
  return rows;
}

async function main() {
  const argv = process.argv.slice(2);
  const wantJson = argv.includes('--json');
  let statusFilter = 'approved';
  const statusArg = argv.find((a) => a.startsWith('--status='));
  if (statusArg) statusFilter = statusArg.split('=')[1] || 'approved';

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_KEY / VITE_SUPABASE_ANON_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const startups = await paginateStartups(supabase, statusFilter);
  const invRows = await paginateInvestors(supabase);

  const startupCounts = Object.fromEntries(
    Object.keys(evalStartupDimensions(startups[0] || {})).map((k) => [k, 0]),
  );

  for (const s of startups) {
    const dim = evalStartupDimensions(s);
    for (const [k, ok] of Object.entries(dim)) {
      if (ok) startupCounts[k] += 1;
    }
  }

  const invCounts = {};
  for (const inv of invRows) {
    const dim = evalInvestorDimensions(inv);
    for (const [k, ok] of Object.entries(dim)) {
      if (!invCounts[k]) invCounts[k] = 0;
      if (ok) invCounts[k] += 1;
    }
  }

  const startupLabels = {
    funding_rounds: 'Funding (parsed columns + extracted round amounts)',
    revenue_mrr_arr: 'Revenue / ARR / MRR (numeric or has_revenue)',
    customers_users: 'Customers or users (counts or has_customers)',
    growth_velocity: 'Growth rate (monthly, string, or extracted)',
    team_founder_pedigree: 'Team / founders / credentials / technical cofounder',
    product_velocity: 'Launch, demo, execution_signals, MVP',
    narrative_identity: 'Description, tagline, pitch, or value prop',
    stage_sector_fit: 'Stage and/or sectors',
    investor_backing_signal: 'Lead investor or notable backers in enrichment',
    maturity_trajectory: 'maturity_level (trajectory band)',
    parser_confidence_gate: 'funding_confidence or traction_confidence ≥ 0.35',
    deck_materials: 'deck_url or deck_filename',
    burn_runway_planning: 'Burn or runway (columns or extracted)',
    web_press_signals: 'extracted_data.web_signals (blog or press)',
  };

  const investorLabels = {
    identity_name_firm: 'Both name and firm present',
    bio_substantive: 'Bio length > 50 chars (scoring rewards >200)',
    check_size_range: 'check_size_min and/or max',
    stage_focus: 'stage[] non-empty',
    sector_focus: 'sectors[] non-empty',
    investment_thesis: 'investment_thesis > 20 chars',
    geography_focus: 'geography_focus[] non-empty',
    track_record_counts: 'total_investments, exits, or notable_investments',
    fund_dry_powder: 'active_fund_size or dry_powder_estimate',
    round_leadership_style: 'leads_rounds or follows_rounds set true',
    investment_pace: 'investment_pace_per_year',
    social_presence: 'LinkedIn, Twitter, photo',
    portfolio_hook: 'portfolio_companies non-empty',
    verified: 'is_verified',
    direct_contact: 'email present',
  };

  const out = {
    generated_at: new Date().toISOString(),
    scope: {
      startup_status: statusFilter,
      startup_rows: startups.length,
      investor_rows: invRows.length,
    },
    startup_dimensions: finalize(startupCounts, startups.length).map((row) => ({
      ...row,
      label: startupLabels[row.id] || row.id,
    })),
    investor_dimensions: finalize(invCounts, invRows.length).map((row) => ({
      ...row,
      label: investorLabels[row.id] || row.id,
    })),
    notes: [
      'Presence = at least one signal in the bucket; rows can still be weak if only a single sparse field is set.',
      'GOD / match quality also use language_analysis, faith_alignment, RSS, and time-series momentum — not all are reflected here.',
      'Compare with scripts/print-enrichment-stats.js and npm run dq:measure for RSS pipeline quality.',
    ],
  };

  if (wantJson) {
    console.log(JSON.stringify(out, null, 2));
    return;
  }

  console.log('\n📇 Card + scoring data coverage\n');
  console.log(`Startups (${statusFilter}): ${startups.length} rows`);
  console.log(`Investors (all): ${invRows.length} rows\n`);
  console.log('── Startup dimensions (% with ≥1 signal) ──');
  for (const r of out.startup_dimensions.sort((a, b) => a.pct_present - b.pct_present)) {
    console.log(
      `  ${String(Math.round(r.pct_present * 100)).padStart(3)}%  ${r.id.padEnd(28)} ${r.label}`,
    );
  }
  console.log('\n── Investor dimensions (% with ≥1 signal) ──');
  for (const r of out.investor_dimensions.sort((a, b) => a.pct_present - b.pct_present)) {
    console.log(
      `  ${String(Math.round(r.pct_present * 100)).padStart(3)}%  ${r.id.padEnd(28)} ${r.label}`,
    );
  }
  console.log('\nTips:', out.notes.join(' '));
  console.log('\nJSON: node scripts/report-card-data-coverage.js --json\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
