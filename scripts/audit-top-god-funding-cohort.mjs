#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const limitArg = process.argv.find(arg => arg.startsWith('--limit='));
const minGodArg = process.argv.find(arg => arg.startsWith('--min-god='));
const limit = Math.min(Math.max(Number(limitArg?.split('=')[1] || 25), 1), 250);
const minGod = Number(minGodArg?.split('=')[1] || 0);
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

function topFiveByStartup(rows, timestampField) {
  const grouped = new Map();
  for (const row of rows || []) {
    const existing = grouped.get(row.startup_id) || [];
    existing.push({ ...row, prediction_at: row[timestampField] });
    grouped.set(row.startup_id, existing);
  }
  for (const [startupId, matches] of grouped) {
    grouped.set(startupId, matches.sort((a, b) =>
      (Number(a.rank_position || Infinity) - Number(b.rank_position || Infinity)) ||
      (Number(b.score || b.match_score || 0) - Number(a.score || a.match_score || 0))
    ).slice(0, 5));
  }
  return grouped;
}

function canonicalInvestorLabel(row, investorById) {
  const investor = investorById.get(row.investor_id);
  return String(investor?.firm || investor?.name || row.investor_id || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function uniqueLegacyTopFive(rows, investorById) {
  const seen = new Set();
  return [...rows].sort((a, b) => Number(b.match_score || 0) - Number(a.match_score || 0)).filter(row => {
    const key = canonicalInvestorLabel(row, investorById);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5).map(row => ({ ...row, prediction_at: null }));
}

async function fetchInvestors(ids) {
  const rows = [];
  for (let offset = 0; offset < ids.length; offset += 200) {
    const { data, error } = await db.from('investors').select('id,name,firm').in('id', ids.slice(offset, offset + 200));
    if (error) return { data: null, error };
    rows.push(...(data || []));
  }
  return { data: rows, error: null };
}

async function main() {
  const { data: startups, error: startupError } = await db.from('startup_uploads')
    .select('id,name,website,description,sectors,source_type,discovery_event_id,total_god_score,status,created_at,extracted_data')
    .not('total_god_score', 'is', null)
    .eq('status', 'approved')
    .gte('total_god_score', minGod)
    .order('total_god_score', { ascending: false })
    .limit(limit);
  if (startupError) throw new Error(`startup cohort: ${startupError.message}`);
  const startupIds = (startups || []).map(row => row.id);
  if (!startupIds.length) return console.log(JSON.stringify({ cohort: [] }, null, 2));

  const [{ data: impressions, error: impressionError }, { data: legacyMatches, error: matchError }, { data: evidenceEvents, error: eventError }] = await Promise.all([
    db.from('ranking_impressions').select('id,startup_id,investor_id,session_id,model_version,rank_position,score,shown_at').in('startup_id', startupIds).lte('rank_position', 5).order('shown_at', { ascending: false }),
    db.from('startup_investor_matches').select('id,startup_id,investor_id,match_score,algorithm_version,created_at').in('startup_id', startupIds).order('match_score', { ascending: false }),
    db.from('funding_evidence_events').select('id,startup_id,canonical_round_key,round_type,amount_usd,announced_at,occurred_at,source_url,verification_status').in('startup_id', startupIds).order('announced_at'),
  ]);
  if (impressionError) throw new Error(`ranking impressions: ${impressionError.message}`);
  if (matchError) throw new Error(`legacy matches: ${matchError.message}`);
  if (eventError) throw new Error(`funding events: ${eventError.message}`);

  const eventIds = (evidenceEvents || []).map(row => row.id);
  const investorIds = [...new Set([...(impressions || []), ...(legacyMatches || [])].map(row => row.investor_id).filter(Boolean))];
  const [{ data: investors, error: investorError }, participantResult] = await Promise.all([
    investorIds.length ? fetchInvestors(investorIds) : Promise.resolve({ data: [], error: null }),
    eventIds.length ? db.from('funding_evidence_participants').select('id,funding_event_id,investor_id,investor_name_raw,participant_role,participation_relation,resolution_status,evidence_phrase').in('funding_event_id', eventIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (investorError) throw new Error(`investors: ${investorError.message}`);
  if (participantResult.error) throw new Error(`participants: ${participantResult.error.message}`);

  const investorById = new Map((investors || []).map(row => [row.id, row]));
  const participantsByEvent = new Map();
  for (const participant of participantResult.data || []) participantsByEvent.set(participant.funding_event_id, [...(participantsByEvent.get(participant.funding_event_id) || []), participant]);
  const impressionGroups = topFiveByStartup(impressions, 'shown_at');
  const legacyRowsByStartup = new Map();
  for (const row of legacyMatches || []) legacyRowsByStartup.set(row.startup_id, [...(legacyRowsByStartup.get(row.startup_id) || []), row]);
  const eventsByStartup = new Map();
  for (const event of evidenceEvents || []) eventsByStartup.set(event.startup_id, [...(eventsByStartup.get(event.startup_id) || []), event]);

  const cohort = (startups || []).map(startup => {
    const strong = impressionGroups.get(startup.id) || [];
    const legacyRows = legacyRowsByStartup.get(startup.id) || [];
    const predictions = strong.length ? strong : uniqueLegacyTopFive(legacyRows, investorById);
    const provenance = strong.length ? 'ranking_impression' : predictions.length ? 'legacy_current_state_not_historical_impression' : 'no_prediction_record';
    const predictionAt = strong.length ? strong.map(row => row.prediction_at).filter(Boolean).sort()[0] || null : null;
    const legacyTimes = legacyRows.map(row => row.created_at).filter(Boolean).sort();
    const matches = predictions.map((row, index) => ({
      rank: row.rank_position || index + 1,
      investor_id: row.investor_id,
      investor_name: investorById.get(row.investor_id)?.firm || investorById.get(row.investor_id)?.name || null,
      score: row.score ?? row.match_score ?? null,
      prediction_at: row.prediction_at,
    }));
    const matchedIds = new Set(matches.map(row => row.investor_id));
    const fundingEvents = (eventsByStartup.get(startup.id) || []).map(event => {
      const participants = participantsByEvent.get(event.id) || [];
      const postPrediction = Boolean(predictionAt && new Date(event.announced_at) >= new Date(predictionAt));
      return {
        ...event,
        post_prediction: postPrediction,
        participants,
        predicted_investor_hits: postPrediction ? participants.filter(row => row.investor_id && matchedIds.has(row.investor_id)).map(row => row.investor_name_raw) : [],
      };
    });
    return {
      startup_id: startup.id,
      startup_name: startup.name,
      startup_website: startup.website || null,
      startup_description: startup.description || null,
      startup_sectors: startup.sectors || [],
      identity_evidence: {
        source_type: startup.source_type || null,
        discovery_event_id: startup.discovery_event_id || null,
        aliases: Array.isArray(startup.extracted_data?.aliases) ? startup.extracted_data.aliases : [],
      },
      god_score: startup.total_god_score,
      prediction_provenance: provenance,
      prediction_at: predictionAt,
      legacy_match_record_window: legacyTimes.length ? { first_created_at: legacyTimes[0], last_created_at: legacyTimes.at(-1) } : null,
      top_five: matches,
      funding_events: fundingEvents,
    };
  });

  console.log(JSON.stringify({ generated_at: new Date().toISOString(), ordering: 'total_god_score_desc', cohort }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
