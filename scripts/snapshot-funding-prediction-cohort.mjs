#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isGarbageInvestorName, isHardJunkInvestorName } = require('../lib/investorNameHeuristics.js');
const { isPlausibleInvestorEntityName, isPredictionGradeStartupIdentity } = require('../server/lib/fundingEvidenceLedger.js');

const apply = process.argv.includes('--apply');
const newOnly = process.argv.includes('--new-only');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const scanArg = process.argv.find(arg => arg.startsWith('--scan-limit='));
const offsetArg = process.argv.find(arg => arg.startsWith('--scan-offset='));
const cohortArg = process.argv.find(arg => arg.startsWith('--cohort-key='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1] || 25), 1), 250);
const scanLimit = Math.min(Math.max(Number(scanArg?.split('=')[1] || 5000), limit), 25000);
const scanOffset = Math.min(Math.max(Number(offsetArg?.split('=')[1] || 0), 0), 100000);
const cohortKey = cohortArg?.slice('--cohort-key='.length) || `god-desc-${new Date().toISOString().slice(0, 10)}`;
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

function canonicalFirm(row) {
  return String(row.firm || row.name || '').toLowerCase().replace(/\b(?:ventures?|capital|partners?|management|fund|holdings?)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
}

function isEligibleInvestor(row) {
  const label = String(row.firm || row.name || '').trim();
  const type = `${row.type || ''} ${row.investor_type || ''}`;
  return row.is_individual !== true
    && !/\b(?:angel|individual|person|founder)\b/i.test(type)
    && isPlausibleInvestorEntityName(label)
    && !isGarbageInvestorName(label)
    && !isHardJunkInvestorName(label);
}

async function fetchInvestors(ids) {
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await db.from('investors').select('id,name,firm,type,investor_type,is_individual').in('id', ids.slice(offset, offset + 200));
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

async function fetchMemberships(ids) {
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await db.from('investor_organization_memberships')
      .select('investor_id,organization_id').in('investor_id', ids.slice(offset, offset + 200));
    if (error) throw error;
    rows.push(...(data || []));
  }
  return rows;
}

async function fetchAllSnapshotStartupIds() {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('funding_prediction_snapshots')
      .select('startup_id').range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return new Set(rows.map(row => row.startup_id));
}

async function fetchStartupCandidates() {
  const rows = [];
  const desired = newOnly ? scanLimit : limit;
  for (let offset = 0; offset < desired; offset += 1000) {
    const lower = scanOffset + offset;
    const upper = scanOffset + Math.min(offset + 999, desired - 1);
    const { data, error } = await db.from('startup_uploads')
      .select('id,name,description,total_god_score,status,entity_gate,source_type,website,company_domain')
      .eq('status', 'approved').eq('source_type', 'url').not('total_god_score', 'is', null)
      .order('total_god_score', { ascending: false }).range(lower, upper);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < upper - lower + 1) break;
  }
  return rows;
}

async function main() {
  const predictedAt = new Date().toISOString();
  let previouslySnapshotted = new Set();
  if (newOnly) {
    previouslySnapshotted = await fetchAllSnapshotStartupIds();
  }
  const startupCandidates = await fetchStartupCandidates();
  const eligibleStartups = (startupCandidates || []).filter(row =>
    row.entity_gate !== 'junk'
    && isPredictionGradeStartupIdentity(row)
    && (!newOnly || !previouslySnapshotted.has(row.id))
  );
  const startups = newOnly ? eligibleStartups : eligibleStartups.slice(0, limit);
  const startupIds = (startups || []).map(row => row.id);
  const matches = [];
  for (let offset = 0; offset < startupIds.length; offset += 20) {
    const { data, error } = await db.from('startup_investor_matches')
      .select('id,startup_id,investor_id,match_score,algorithm_version,updated_at')
      .in('startup_id', startupIds.slice(offset, offset + 20)).order('match_score', { ascending: false });
    if (error) throw error;
    matches.push(...(data || []));
  }
  const matchedInvestorIds = [...new Set((matches || []).map(row => row.investor_id))];
  const [investors, memberships] = await Promise.all([
    fetchInvestors(matchedInvestorIds),
    fetchMemberships(matchedInvestorIds),
  ]);
  const investorById = new Map(investors.map(row => [row.id, row]));
  const organizationByInvestor = new Map(memberships.map(row => [row.investor_id, row.organization_id]));
  const startupById = new Map((startups || []).map(row => [row.id, row]));
  const grouped = new Map();
  for (const match of matches || []) grouped.set(match.startup_id, [...(grouped.get(match.startup_id) || []), match]);

  const snapshots = [];
  for (const startup of startups || []) {
    if (newOnly && snapshots.length >= limit * 5) break;
    const seenFirms = new Set();
    const unique = (grouped.get(startup.id) || []).filter(match => {
      const investor = investorById.get(match.investor_id) || {};
      if (!isEligibleInvestor(investor)) return false;
      const firmKeys = [
        organizationByInvestor.get(match.investor_id) ? `organization:${organizationByInvestor.get(match.investor_id)}` : null,
        `label:${canonicalFirm(investor)}`,
      ].filter(key => key && key !== 'label:');
      if (!firmKeys.length || firmKeys.some(key => seenFirms.has(key))) return false;
      firmKeys.forEach(key => seenFirms.add(key));
      return true;
    }).slice(0, 5);
    if (unique.length !== 5) continue;
    unique.forEach((match, index) => snapshots.push({
      cohort_key: cohortKey,
      startup_id: startup.id,
      investor_id: match.investor_id,
      source_match_id: match.id,
      god_score_at_prediction: startup.total_god_score,
      match_score_at_prediction: match.match_score,
      rank_position: index + 1,
      model_version: match.algorithm_version || 'legacy-current-unknown',
      predicted_at: predictedAt,
      prediction_kind: 'prospective_shadow',
      context: {
        startup_name: startup.name,
        startup_identity_source: startup.source_type,
        startup_identity_url: startup.website || startup.company_domain,
        investor_name: investorById.get(match.investor_id)?.firm || investorById.get(match.investor_id)?.name || null,
        investor_organization_id: organizationByInvestor.get(match.investor_id) || null,
        source_match_updated_at: match.updated_at,
      },
    }));
  }
  if (apply && snapshots.length) {
    const { error } = await db.from('funding_prediction_snapshots').upsert(snapshots, { onConflict: 'cohort_key,startup_id,investor_id', ignoreDuplicates: true });
    if (error) throw error;
  }
  const completedStartupIds = new Set(snapshots.map(row => row.startup_id));
  const incomplete = (startups || []).filter(row => !completedStartupIds.has(row.id)).map(row => row.name);
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', selection: newOnly ? 'never_previously_snapshotted_prediction_grade_startups' : 'top_god_score_prediction_grade_startups', cohort_key: cohortKey, predicted_at: predictedAt, startup_scan_limit: scanLimit, startup_scan_offset: scanOffset, startups_scanned: startups?.length || 0, snapshots: snapshots.length, complete_top_five_sets: completedStartupIds.size, incomplete_startups_count: incomplete.length, incomplete_startups_preview: incomplete.slice(0, 50), preview: snapshots.slice(0, 15).map(row => ({ startup: startupById.get(row.startup_id)?.name, investor: row.context.investor_name, rank: row.rank_position, god_score: row.god_score_at_prediction, match_score: row.match_score_at_prediction, model_version: row.model_version })) }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
