#!/usr/bin/env node
'use strict';

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { searchInvestorNews, extractInvestorDataFromArticles } = require('../server/services/investorInferenceService');

const apply = process.argv.includes('--apply');
const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1] || 20), 1), 100);
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

function safeProfileUpdate(investor, enrichedData) {
  const update = {};
  if (!investor.sectors?.length && enrichedData.sectors?.length) update.sectors = enrichedData.sectors;
  if (!investor.stage?.length && enrichedData.stage?.length) update.stage = enrichedData.stage;
  if (!investor.geography_focus?.length && enrichedData.geography_focus?.length) update.geography_focus = enrichedData.geography_focus;
  if (!investor.portfolio_companies?.length && enrichedData.portfolio_companies?.length) update.portfolio_companies = enrichedData.portfolio_companies;
  if (!investor.check_size_min && !investor.check_size_max
      && enrichedData.check_size_min && enrichedData.check_size_max) {
    update.check_size_min = enrichedData.check_size_min;
    update.check_size_max = enrichedData.check_size_max;
  }
  return update;
}

function missingFields(investor) {
  return [
    !investor.sectors?.length && 'sectors',
    !investor.stage?.length && 'stage',
    !investor.geography_focus?.length && 'geography_focus',
    !investor.portfolio_companies?.length && 'portfolio_companies',
    (!investor.check_size_min || !investor.check_size_max) && 'check_size',
    !investor.investment_thesis && 'investment_thesis_first_party_only',
  ].filter(Boolean);
}

async function main() {
  const { data: events, error: eventError } = await db.from('funding_evidence_events')
    .select('id').eq('metadata->>audited', 'true').in('verification_status', ['verified', 'corroborated']);
  if (eventError) throw eventError;
  const eventIds = (events || []).map(row => row.id);
  if (!eventIds.length) {
    console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', investors_reviewed: 0, results: [] }, null, 2));
    return;
  }

  const { data: participantRows, error: participantError } = await db.from('funding_evidence_participants')
    .select('id,funding_event_id,investor_id,investor_name_raw,participant_role,participation_relation,resolution_status,evidence')
    .in('funding_event_id', eventIds);
  if (participantError) throw participantError;
  const participants = (participantRows || []).filter(row => row.investor_id
    && row.participation_relation && row.participant_role !== 'unknown' && row.resolution_status === 'resolved');
  const participationCount = new Map();
  for (const row of participants) participationCount.set(row.investor_id, (participationCount.get(row.investor_id) || 0) + 1);
  const investorIds = [...participationCount.keys()];
  const investors = [];
  for (let offset = 0; offset < investorIds.length; offset += 200) {
    const { data, error } = await db.from('investors')
      .select('id,name,firm,sectors,stage,check_size_min,check_size_max,portfolio_companies,investment_thesis,bio,geography_focus,last_enrichment_date')
      .in('id', investorIds.slice(offset, offset + 200));
    if (error) throw error;
    investors.push(...(data || []));
  }
  const cohort = investors.filter(investor => missingFields(investor).length)
    .sort((a, b) => (participationCount.get(b.id) || 0) - (participationCount.get(a.id) || 0)
      || String(a.firm || a.name).localeCompare(String(b.firm || b.name)))
    .slice(0, limit);

  const results = [];
  for (const investor of cohort) {
    const articles = await searchInvestorNews(investor.name, investor.firm);
    const { enrichedData, evidence } = extractInvestorDataFromArticles(articles, investor);
    const update = safeProfileUpdate(investor, enrichedData);
    const fields = Object.keys(update);
    let writeStatus = fields.length ? 'preview' : 'no_eligible_evidence';

    if (apply && fields.length) {
      const collectedAt = new Date().toISOString();
      const { error: updateError } = await db.from('investors').update({
        ...update,
        last_enrichment_date: collectedAt,
      }).eq('id', investor.id);
      if (updateError) throw updateError;
      for (const participant of participants.filter(row => row.investor_id === investor.id)) {
        const { error: evidenceError } = await db.from('funding_evidence_participants').update({
          evidence: {
            ...(participant.evidence || {}),
            investor_profile_enrichment: {
              version: 'funding-outcome-investor-enrichment-v1',
              collected_at: collectedAt,
              fields,
              values: update,
              sources: evidence,
            },
          },
          updated_at: collectedAt,
        }).eq('id', participant.id);
        if (evidenceError) throw evidenceError;
      }
      writeStatus = 'updated';
    }

    results.push({
      investor_id: investor.id,
      investor: investor.firm || investor.name,
      proven_participations: participationCount.get(investor.id) || 0,
      missing_before: missingFields(investor),
      eligible_sources: evidence,
      proposed_update: update,
      write_status: writeStatus,
    });
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    audited_events: eventIds.length,
    proven_resolved_participants: participants.length,
    investors_reviewed: cohort.length,
    investors_with_eligible_updates: results.filter(row => Object.keys(row.proposed_update).length).length,
    results,
  }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });

