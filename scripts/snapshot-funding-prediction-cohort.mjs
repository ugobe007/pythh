#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { isGarbageInvestorName, isHardJunkInvestorName } = require('../lib/investorNameHeuristics.js');
const { isPlausibleInvestorEntityName } = require('../server/lib/fundingEvidenceLedger.js');

const apply = process.argv.includes('--apply');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const cohortArg = process.argv.find(arg => arg.startsWith('--cohort-key='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1] || 25), 1), 250);
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
  return isPlausibleInvestorEntityName(label) && !isGarbageInvestorName(label) && !isHardJunkInvestorName(label);
}

async function fetchInvestors(ids) {
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await db.from('investors').select('id,name,firm').in('id', ids.slice(offset, offset + 200));
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

async function main() {
  const predictedAt = new Date().toISOString();
  const { data: startups, error: startupError } = await db.from('startup_uploads')
    .select('id,name,total_god_score,status,entity_gate')
    .eq('status', 'approved').not('total_god_score', 'is', null)
    .order('total_god_score', { ascending: false }).limit(limit);
  if (startupError) throw startupError;
  const startupIds = (startups || []).map(row => row.id);
  const { data: matches, error: matchError } = await db.from('startup_investor_matches')
    .select('id,startup_id,investor_id,match_score,algorithm_version,updated_at')
    .in('startup_id', startupIds).order('match_score', { ascending: false });
  if (matchError) throw matchError;
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
    const seenFirms = new Set();
    const unique = (grouped.get(startup.id) || []).filter(match => {
      const investor = investorById.get(match.investor_id) || {};
      if (!isEligibleInvestor(investor)) return false;
      const firmKey = organizationByInvestor.get(match.investor_id) || canonicalFirm(investor);
      if (!firmKey || seenFirms.has(firmKey)) return false;
      seenFirms.add(firmKey);
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
  const incomplete = (startups || []).filter(row => snapshots.filter(item => item.startup_id === row.id).length < 5).map(row => row.name);
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', cohort_key: cohortKey, predicted_at: predictedAt, startups: startups?.length || 0, snapshots: snapshots.length, complete_top_five_sets: (startups?.length || 0) - incomplete.length, incomplete_startups: incomplete, preview: snapshots.slice(0, 15).map(row => ({ startup: startupById.get(row.startup_id)?.name, investor: row.context.investor_name, rank: row.rank_position, god_score: row.god_score_at_prediction, match_score: row.match_score_at_prediction, model_version: row.model_version })) }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
