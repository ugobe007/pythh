#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { canonicalRoundKey, resolveCanonicalEntity } = require('../server/lib/fundingEvidenceLedger.js');
const apply = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

const audited = [
  {
    key: 'audited:nango:seed:2026-04-01:7500000', startupId: '43a0cb7e-3a25-4c54-86ba-7e837d8753fd', startupName: 'Nango',
    roundType: 'Seed', amountUsd: 7_500_000, announcedAt: '2026-04-01T00:00:00Z', participantListComplete: false,
    sourceUrl: 'https://nango.dev/blog/nango-raises-7-5m-led-by-gradient', sourcePublisher: 'Nango',
    sourceTitle: 'Nango raises $7.5M led by Gradient', verificationStatus: 'verified',
    participants: [
      ['Gradient', 'lead', 'LED_ROUND', 'raised $7.5M in seed funding, led by Gradient'],
      ['Horizon', 'participant', 'PARTICIPATED_IN_ROUND', 'with participation from Horizon, Y Combinator'],
      ['Y Combinator', 'participant', 'PARTICIPATED_IN_ROUND', 'with participation from Horizon, Y Combinator'],
    ],
  },
  {
    key: 'audited:addi:series-d:2026-07-01:85000000', startupId: '0824b2ac-df8f-4a61-bf8d-4e783dc9838a', startupName: 'Addi',
    roundType: 'Series D', amountUsd: 85_000_000, announcedAt: '2026-07-01T00:00:00Z', participantListComplete: false,
    sourceUrl: 'https://www.streetinsider.com/Business%2BWire/Addi%2BAnnounces%2B%2485%2BMillion%2BSeries%2BD%2BLed%2Bby%2BCitius%2Band%2BCo-led%2Bby%2BBTG%2BPactual/26718231.html', sourcePublisher: 'Business Wire',
    sourceTitle: 'Addi Announces $85 Million Series D Led by Citius and Co-led by BTG Pactual', verificationStatus: 'corroborated',
    participants: [
      ['Citius', 'lead', 'LED_ROUND', 'Series D Led by Citius'],
      ['BTG Pactual', 'co_lead', 'CO_LED_ROUND', 'Co-led by BTG Pactual'],
      ['GIC', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from GIC and Monashees'],
      ['Monashees', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from GIC and Monashees'],
    ],
  },
  {
    key: 'audited:cast-ai:strategic:2026-01-12:unknown', startupId: 'c24a0f5e-5ffe-4b0b-aa28-4bc350731ff1', startupName: 'Cast AI',
    roundType: 'Strategic', amountUsd: null, announcedAt: '2026-01-12T00:00:00Z', participantListComplete: true,
    sourceUrl: 'https://siliconangle.com/2026/01/12/cast-ai-raises-funds-pacific-alliance-ventures-1b-valuation-launch-unified-gpu-marketplace/', sourcePublisher: 'SiliconANGLE',
    sourceTitle: 'Cast AI raises funds from Pacific Alliance Ventures at $1B valuation', verificationStatus: 'corroborated',
    participants: [['Pacific Alliance Ventures', 'participant', 'INVESTED_IN', 'raised new funding from Pacific Alliance Ventures']],
  },
  {
    key: 'audited:pluto:seed:2026-01-06:8600000', startupId: '17048071-a6cf-47ab-94a1-0e990d584b83', startupName: 'Pluto Financial Technologies',
    roundType: 'Seed', amountUsd: 8_600_000, announcedAt: '2026-01-06T00:00:00Z', participantListComplete: true,
    sourceUrl: 'https://www.hamiltonlane.com/en-us/news/pluto-financial-tech-investment', sourcePublisher: 'Hamilton Lane',
    sourceTitle: 'Pluto Financial Technologies Investment', verificationStatus: 'verified',
    participants: [
      ['Motive Ventures', 'participant', 'PARTICIPATED_IN_ROUND', '$8.6 million in seed funding from Motive Ventures, Portage, Apollo, and Hamilton Lane'],
      ['Portage', 'participant', 'PARTICIPATED_IN_ROUND', '$8.6 million in seed funding from Motive Ventures, Portage, Apollo, and Hamilton Lane'],
      ['Apollo Global Management', 'participant', 'PARTICIPATED_IN_ROUND', 'backed by Motive Ventures, Portage, Apollo Global Management, Hamilton Lane, Tectonic Ventures, and Broadhaven Ventures'],
      ['Hamilton Lane', 'participant', 'PARTICIPATED_IN_ROUND', '$8.6 million in seed funding from Motive Ventures, Portage, Apollo, and Hamilton Lane'],
      ['Tectonic Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'backed by Motive Ventures, Portage, Apollo Global Management, Hamilton Lane, Tectonic Ventures, and Broadhaven Ventures'],
      ['Broadhaven Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'backed by Motive Ventures, Portage, Apollo Global Management, Hamilton Lane, Tectonic Ventures, and Broadhaven Ventures'],
    ],
  },
];

async function main() {
  const { data: investors, error } = await db.from('investors').select('id,name,firm');
  if (error) throw error;
  const preview = [];
  for (const event of audited) {
    const roundKey = canonicalRoundKey({ startupId: event.startupId, startupName: event.startupName, roundType: event.roundType, amountUsd: event.amountUsd, announcedAt: event.announcedAt });
    const resolved = event.participants.map(([name, role, relation, phrase]) => ({ name, role, relation, phrase, ...resolveCanonicalEntity(investors || [], name) }));
    preview.push({ startup: event.startupName, announced_at: event.announcedAt, participants: resolved.map(row => `${row.name}:${row.status}`) });
    if (!apply) continue;
    const { data: evidence, error: eventError } = await db.from('funding_evidence_events').upsert({
      source_event_key: event.key, startup_id: event.startupId, startup_name_raw: event.startupName,
      financing_type: 'equity', round_type: event.roundType, amount_usd: event.amountUsd,
      announced_at: event.announcedAt, occurred_at: event.announcedAt, occurred_at_precision: 'day',
      canonical_round_key: roundKey, source_url: event.sourceUrl, source_publisher: event.sourcePublisher,
      source_title: event.sourceTitle, evidence_confidence: 0.98, verification_status: event.verificationStatus,
      extraction_version: 'audited-manual-v1', metadata: { participant_list_complete: event.participantListComplete, audited: true }, updated_at: new Date().toISOString(),
    }, { onConflict: 'source_event_key' }).select('id').single();
    if (eventError) throw eventError;
    for (const participant of resolved) {
      const { error: participantError } = await db.from('funding_evidence_participants').upsert({
        funding_event_id: evidence.id, investor_name_raw: participant.name, investor_id: participant.row?.id || null,
        participant_role: participant.role, participation_relation: participant.relation, evidence_phrase: participant.phrase,
        resolution_status: participant.status, resolution_confidence: participant.confidence,
        evidence: { source_url: event.sourceUrl, audited: true, resolution_match_kind: participant.matchKind }, updated_at: new Date().toISOString(),
      }, { onConflict: 'funding_event_id,investor_name_raw' });
      if (participantError) throw participantError;
    }
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', events: audited.length, preview }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
