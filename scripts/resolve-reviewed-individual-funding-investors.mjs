#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { normalizeEntityName } = require('../server/lib/fundingEvidenceLedger.js');
const apply = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

// Identity-only repairs. Outcome evidence proves that the person invested, but
// is deliberately not used to infer sector, stage, check size, or thesis.
const reviewedIndividuals = [
  {
    canonical_name: 'John Kim',
    firm: 'Angel Investor',
    title: 'CEO & Co-Founder of Sendbird',
    type: 'Angel',
    investor_type: 'Angel',
    identity_url: 'https://sendbird.com/blog/our-new-sendbird-mission',
    evidence_urls: [
      'https://nango.dev/blog/nango-raises-7-5m-led-by-gradient',
      'https://syncly.app/blog/syncly-secures-3m-in-seed-funding',
      'https://sendbird.com/blog/our-new-sendbird-mission',
    ],
  },
];

async function main() {
  const names = reviewedIndividuals.map(row => row.canonical_name);
  const [{ data: participants, error: participantError }, { data: investors, error: investorError }] = await Promise.all([
    db.from('funding_evidence_participants')
      .select('id,investor_name_raw,investor_id,resolution_status,resolution_confidence,evidence')
      .in('investor_name_raw', names),
    db.from('investors')
      .select('id,name,firm,is_individual,created_at')
      .in('name', names),
  ]);
  if (participantError) throw participantError;
  if (investorError) throw investorError;

  const plans = reviewedIndividuals.map(review => {
    const normalized = normalizeEntityName(review.canonical_name);
    const matchingParticipants = (participants || []).filter(row => normalizeEntityName(row.investor_name_raw) === normalized);
    const existing = (investors || []).filter(row => normalizeEntityName(row.name) === normalized);
    let action = 'withhold';
    let reason = 'no audited unresolved participant';
    if (matchingParticipants.some(row => !row.investor_id) && existing.length === 0) {
      action = 'create_identity_and_resolve';
      reason = 'two first-party funding announcements plus first-party person identity';
    } else if (matchingParticipants.some(row => !row.investor_id) && existing.length === 1 && existing[0].is_individual === true) {
      action = 'resolve_existing_identity';
      reason = 'unique exact individual profile';
    } else if (existing.length > 1) {
      reason = 'multiple exact investor profiles require manual review';
    } else if (matchingParticipants.every(row => row.investor_id)) {
      reason = 'participants already resolved';
    }
    return { review, participants: matchingParticipants, existing, action, reason };
  });

  const applied = [];
  if (apply) {
    for (const plan of plans.filter(row => row.action !== 'withhold')) {
      let investor = plan.existing[0] || null;
      if (!investor) {
        const { data, error } = await db.from('investors').insert({
          name: plan.review.canonical_name,
          firm: plan.review.firm,
          title: plan.review.title,
          type: plan.review.type,
          investor_type: plan.review.investor_type,
          is_individual: true,
          status: 'active',
          is_verified: true,
          url: plan.review.identity_url,
          sectors: [],
          stage: [],
          geography_focus: [],
          check_size_min: null,
          check_size_max: null,
          investment_thesis: null,
          investor_score: 50,
          investor_tier: 'emerging',
        }).select('id,name,firm,is_individual,created_at').single();
        if (error) throw error;
        investor = data;
      }
      const now = new Date().toISOString();
      for (const participant of plan.participants.filter(row => !row.investor_id)) {
        const { error } = await db.from('funding_evidence_participants').update({
          investor_id: investor.id,
          resolution_status: 'resolved',
          resolution_confidence: 1,
          evidence: {
            ...(participant.evidence || {}),
            identity_resolution: {
              version: 'reviewed-individual-funding-identity-v1',
              method: 'reviewed_first_party_person_identity',
              reviewed_at: now,
              source_urls: plan.review.evidence_urls,
              identity_only: true,
              matching_attributes_inferred: false,
              historical_candidate_profile_preserved_as_missing: true,
            },
          },
          updated_at: now,
        }).eq('id', participant.id);
        if (error) throw error;
      }
      applied.push({ investor_id: investor.id, participant_ids: plan.participants.map(row => row.id), created_at: investor.created_at });
    }
  }

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    plans: plans.map(plan => ({
      canonical_name: plan.review.canonical_name,
      action: plan.action,
      reason: plan.reason,
      participant_ids: plan.participants.map(row => row.id),
      existing_profiles: plan.existing.map(row => ({ id: row.id, is_individual: row.is_individual, created_at: row.created_at })),
      proposed_profile: {
        firm: plan.review.firm,
        title: plan.review.title,
        type: plan.review.type,
        sectors: [],
        stage: [],
        check_sizes: null,
        thesis: null,
        sources: plan.review.evidence_urls,
      },
    })),
    applied,
  }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
