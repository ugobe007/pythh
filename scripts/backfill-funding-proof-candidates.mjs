#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isGarbageInvestorName, isHardJunkInvestorName } = require('../lib/investorNameHeuristics.js');
const {
  isPlausibleInvestorEntityName,
  isPredictionGradeStartupIdentity,
  normalizeEntityName,
} = require('../server/lib/fundingEvidenceLedger.js');
const {
  calculateMatch,
  fetchAllInvestors,
  loadVerifiedHistoricalFeatures,
  selectTopInvestorCandidates,
} = require('./matching/generate-matches.js');

const apply = process.argv.includes('--apply');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const scanArg = process.argv.find(arg => arg.startsWith('--scan-limit='));
const offsetArg = process.argv.find(arg => arg.startsWith('--scan-offset='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1] || 30), 1), 250);
const scanLimit = Math.min(Math.max(Number(scanArg?.split('=')[1] || 1000), limit), 25000);
const scanOffset = Math.min(Math.max(Number(offsetArg?.split('=')[1] || 0), 0), 100000);
const cutoffAt = new Date();
const cutoffIso = cutoffAt.toISOString();
const algorithmVersion = 'v3.4-proof-coverage';
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

function isDirectUrlStartup(row) {
  return row.status === 'approved'
    && row.entity_gate !== 'junk'
    && isPredictionGradeStartupIdentity(row);
}

function isEligibleFirm(row) {
  const label = String(row.firm || row.name || '').trim();
  const type = `${row.type || ''} ${row.investor_type || ''}`;
  return row.is_individual !== true
    && !/\b(?:angel|individual|person|founder)\b/i.test(type)
    && isPlausibleInvestorEntityName(label)
    && !isGarbageInvestorName(label)
    && !isHardJunkInvestorName(label);
}

async function fetchPaged(table, columns, configure = query => query, pageSize = 1000) {
  const rows = [];
  for (let offset = 0; ; offset += pageSize) {
    const query = configure(db.from(table).select(columns)).range(offset, offset + pageSize - 1);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

async function fetchMemberships(investorIds) {
  const rows = [];
  const batches = [];
  for (let offset = 0; offset < investorIds.length; offset += 200) {
    batches.push(investorIds.slice(offset, offset + 200));
  }
  for (let offset = 0; offset < batches.length; offset += 8) {
    const results = await Promise.all(batches.slice(offset, offset + 8).map(async ids => {
      const { data, error } = await db.from('investor_organization_memberships')
        .select('investor_id,organization_id').in('investor_id', ids);
      if (error) throw error;
      return data || [];
    }));
    rows.push(...results.flat());
  }
  return rows;
}

async function fetchMatches(startupIds) {
  const rows = [];
  for (let offset = 0; offset < startupIds.length; offset += 20) {
    const { data, error } = await db.from('startup_investor_matches')
      .select('startup_id,investor_id,match_score')
      .in('startup_id', startupIds.slice(offset, offset + 20));
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

async function fetchStartupScan() {
  const rows = [];
  for (let offset = 0; offset < scanLimit; offset += 1000) {
    const lower = scanOffset + offset;
    const upper = scanOffset + Math.min(offset + 999, scanLimit - 1);
    const { data, error } = await db.from('startup_uploads')
      .select('id,name,description,sectors,stage,total_god_score,team_score,traction_score,market_score,product_score,vision_score,location,website,company_domain,source_type,status,entity_gate,raise_amount,mrr,arr,growth_rate_monthly,customer_count,team_size,extracted_data')
      .eq('status', 'approved')
      .eq('source_type', 'url')
      .not('total_god_score', 'is', null)
      .gt('total_god_score', 0)
      .order('total_god_score', { ascending: false })
      .range(lower, upper);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < upper - lower + 1) break;
  }
  return rows;
}

function addAliasMemberships(investors, memberships, aliases) {
  const membershipByInvestor = new Map(memberships.map(row => [row.investor_id, row.organization_id]));
  const organizationByAlias = new Map((aliases || []).map(row => [row.normalized_alias, row.organization_id]));
  for (const investor of investors) {
    if (membershipByInvestor.has(investor.id)) continue;
    const organizationId = [investor.firm, investor.name]
      .map(normalizeEntityName).filter(Boolean)
      .map(value => organizationByAlias.get(value)).find(Boolean);
    if (organizationId) membershipByInvestor.set(investor.id, organizationId);
  }
  return membershipByInvestor;
}

function eligibleFirmCount(matches, investorById, membershipByInvestor) {
  const seen = new Set();
  let count = 0;
  for (const match of matches) {
    const investor = investorById.get(match.investor_id);
    if (!investor || !isEligibleFirm(investor)) continue;
    const firmKeys = [
      membershipByInvestor.get(investor.id) ? `organization:${membershipByInvestor.get(investor.id)}` : null,
      `label:${normalizeEntityName(investor.firm || investor.name)}`,
    ].filter(Boolean);
    if (!firmKeys.length || firmKeys.some(key => seen.has(key))) continue;
    firmKeys.forEach(key => seen.add(key));
    count += 1;
  }
  return count;
}

async function main() {
  // Formal prediction candidates must be created without reading outcome/evaluation
  // tables. Only verified history observable before this fixed cutoff is available.
  const [snapshotRows, startupRows, investors, aliases] = await Promise.all([
    fetchPaged('funding_prediction_snapshots', 'startup_id'),
    fetchStartupScan(),
    fetchAllInvestors(db, 'id,name,firm,url,type,investor_type,is_individual,sectors,stage,check_size_min,check_size_max,geography_focus,investor_score,investor_tier,last_investment_date,investment_pace_per_year,leads_rounds,follows_rounds,portfolio_companies,notable_investments,investment_thesis'),
    fetchPaged('investor_organization_aliases', 'organization_id,normalized_alias'),
  ]);

  const snapshottedStartupIds = new Set(snapshotRows.map(row => row.startup_id));
  const candidateStartups = startupRows
    .filter(row => isDirectUrlStartup(row) && !snapshottedStartupIds.has(row.id))
    .slice(0, scanLimit);
  const firmInvestors = investors.filter(isEligibleFirm);
  const investorById = new Map(investors.map(row => [row.id, row]));
  const memberships = await fetchMemberships(investors.map(row => row.id));
  const membershipByInvestor = addAliasMemberships(investors, memberships, aliases);
  const existingMatches = await fetchMatches(candidateStartups.map(row => row.id));
  const matchesByStartup = new Map();
  for (const row of existingMatches) {
    matchesByStartup.set(row.startup_id, [...(matchesByStartup.get(row.startup_id) || []), row]);
  }

  let historicalFeatures = new Map();
  try {
    historicalFeatures = await loadVerifiedHistoricalFeatures(db, membershipByInvestor, cutoffAt);
  } catch (error) {
    console.warn(`Verified pre-cutoff history unavailable; continuing without it: ${error.message}`);
  }
  for (const investor of firmInvestors) {
    const organizationId = membershipByInvestor.get(investor.id);
    investor.historical_features = historicalFeatures.get(
      organizationId ? `organization:${organizationId}` : `investor:${investor.id}`,
    ) || null;
  }

  const selectedStartups = [];
  for (const startup of candidateStartups) {
    const currentEligibleFirms = eligibleFirmCount(
      matchesByStartup.get(startup.id) || [], investorById, membershipByInvestor,
    );
    if (currentEligibleFirms >= 5) continue;
    const startupAtCutoff = { ...startup, feature_cutoff_at: cutoffIso };
    const scored = firmInvestors.map(investor => ({ investor, match: calculateMatch(startupAtCutoff, investor) }))
      .filter(item => item.match.investor_fit_score > 0);
    const selected = selectTopInvestorCandidates(scored, membershipByInvestor, 50);
    if (selected.length < 5) continue;
    selectedStartups.push({ startup, currentEligibleFirms, selected });
    if (selectedStartups.length >= limit) break;
  }

  const rows = selectedStartups.flatMap(({ startup, selected }) => selected.map(({ investor, match }, index) => ({
    startup_id: startup.id,
    investor_id: investor.id,
    match_score: match.score,
    confidence_level: match.confidence,
    reasoning: match.reason,
    status: 'suggested',
    algorithm_version: algorithmVersion,
    feature_snapshot: {
      methodology: 'full_universe_firm_only_no_outcome_labels',
      feature_cutoff_at: cutoffIso,
      candidate_rank: index + 1,
      investor_fit_score: match.investor_fit_score,
      startup_quality_score: match.startup_quality_score,
      legacy_raw_score: match.legacy_raw_score,
      investor_fit_components: match.investor_fit_components,
      stage_fit: match.stage_fit,
      sector_fit: match.sector_fit,
    },
  })));

  if (apply && rows.length) {
    for (let offset = 0; offset < rows.length; offset += 500) {
      const { error } = await db.from('startup_investor_matches')
        .upsert(rows.slice(offset, offset + 500), { onConflict: 'startup_id,investor_id', ignoreDuplicates: false });
      if (error) throw error;
    }
  }

  const preview = selectedStartups.slice(0, 50).map(({ startup, currentEligibleFirms, selected }) => ({
    startup: startup.name,
    god_score: startup.total_god_score,
    current_eligible_firms: currentEligibleFirms,
    proposed_top_five: selected.slice(0, 5).map(({ investor, match }) => ({
      investor: investor.firm || investor.name,
      score: match.score,
      investor_fit: match.investor_fit_score,
    })),
  }));
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    methodology: 'full_universe_firm_only_no_outcome_labels',
    fixed_feature_cutoff_at: cutoffIso,
    algorithm_version: algorithmVersion,
    startup_scan_limit: scanLimit,
    startup_scan_offset: scanOffset,
    direct_url_unsnapshotted_scanned: candidateStartups.length,
    full_investor_universe: investors.length,
    eligible_firm_universe: firmInvestors.length,
    startups_backfilled: selectedStartups.length,
    matches_upserted: apply ? rows.length : 0,
    matches_would_upsert: rows.length,
    startups_that_become_snapshot_ready: selectedStartups.length,
    preview,
  }, null, 2));
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
