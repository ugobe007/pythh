#!/usr/bin/env node
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const apply = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

const repairs = [
  {
    id: '0824b2ac-df8f-4a61-bf8d-4e783dc9838a', expectedName: 'Addi', action: 'repair_and_rescore',
    patch: {
      website: 'https://co.addi.com/',
      description: 'Addi is a Colombian commerce and credit platform serving consumers and merchants with technology-enabled financing and payment options.',
      sectors: ['Fintech'], status: 'pending', entity_gate: 'review',
      entity_gate_reason: 'Canonical identity repaired from incorrect Village Global URL; score requires recomputation.',
    },
  },
  {
    id: '2e0e278d-90d5-4bf7-ba6c-850820bd5181', expectedName: 'FAL Learned Building', action: 'reject_scrape_artifact',
    patch: { status: 'rejected', entity_gate: 'junk', entity_gate_reason: 'Scraped SaaStr article title, not a canonical startup entity. Do not merge automatically with fal.ai.' },
  },
  {
    id: '38da2f76-0b8b-4d42-9303-a3a97e41eec0', expectedName: 'Seven', action: 'repair_and_rescore',
    patch: {
      website: 'https://www.seven.io/',
      description: 'seven.io provides developer APIs for SMS, RCS, WhatsApp, voice, email, and related business messaging workflows.',
      sectors: ['Developer Tools', 'SaaS'], status: 'pending', entity_gate: 'review',
      entity_gate_reason: 'Description and sectors were contaminated by unrelated AI-security article text; score requires recomputation.',
    },
  },
  {
    id: 'e2137323-5a0a-47d0-9f33-d00c9092a62a', expectedName: 'Alt-qq', action: 'repair_and_rescore',
    patch: {
      website: 'https://alt-qq.com/',
      description: 'Alt-QQ publishes Reel Rogue, a browser-based roguelike deckbuilder with slot-machine combat.',
      sectors: ['Gaming', 'Consumer'], status: 'pending', entity_gate: 'review',
      entity_gate_reason: 'Stored film-production AI description contradicted the canonical website; score requires recomputation.',
    },
  },
  {
    id: '84f2bc4d-4459-46fe-a3db-1a68edfaea89', expectedName: 'Ultra', action: 'hold_for_identity_review',
    patch: { status: 'pending', entity_gate: 'review', entity_gate_reason: 'ultra.com identity and generic stored description are insufficient for an auditable funding search.' },
  },
  {
    id: '06902b09-279f-4ea8-b4f5-ac0c32f3ba56', expectedName: 'PermitFlow', action: 'repair_and_rescore',
    patch: {
      website: 'https://permitflow.com/',
      description: 'PermitFlow provides software for researching, preparing, submitting, and tracking construction permits.',
      sectors: ['PropTech', 'SaaS'], status: 'pending', entity_gate: 'review',
      entity_gate_reason: 'Canonical website incorrectly pointed to investor Initialized Capital; identity repaired and score requires recomputation.',
    },
  },
  {
    id: '1ba56515-fa07-4290-8f02-3d82747e3f66', expectedName: 'Zuora', action: 'repair_and_review_universe_fit',
    patch: {
      website: 'https://www.zuora.com/',
      description: 'Zuora provides enterprise software for subscription billing, recurring revenue, usage-based pricing, payments, and revenue operations.',
      sectors: ['Fintech', 'SaaS'], status: 'pending', entity_gate: 'review',
      entity_gate_reason: 'Canonical website incorrectly pointed to Shasta Ventures; mature-company universe eligibility and score require review.',
    },
  },
  {
    id: '17048071-a6cf-47ab-94a1-0e990d584b83', expectedName: 'Pluto', action: 'repair_and_rescore',
    patch: {
      website: 'https://plutocredit.com/',
      description: 'Pluto Financial Technologies provides credit backed by private-market and alternative investment assets.',
      sectors: ['Fintech'], status: 'pending', entity_gate: 'review',
      entity_gate_reason: 'Canonical website was a funding-news article; identity repaired and score requires recomputation.',
    },
  },
  {
    id: 'c24a0f5e-5ffe-4b0b-aa28-4bc350731ff1', expectedName: 'Cast', action: 'repair_and_rescore',
    patch: {
      website: 'https://cast.ai/',
      description: 'Cast AI automates Kubernetes application performance, workload rightsizing, infrastructure scaling, GPU optimization, and cloud cost control.',
      sectors: ['Infrastructure', 'Developer Tools', 'AI/ML'], status: 'pending', entity_gate: 'review',
      entity_gate_reason: 'Description was a funding-news excerpt and sectors included unrelated e-commerce; identity repaired and score requires recomputation.',
    },
  },
];

async function main() {
  const ids = repairs.map(row => row.id);
  const { data: current, error } = await db.from('startup_uploads')
    .select('id,name,website,description,sectors,status,entity_gate,entity_gate_reason,extracted_data,total_god_score')
    .in('id', ids);
  if (error) throw error;
  const currentById = new Map((current || []).map(row => [row.id, row]));
  const results = [];
  for (const repair of repairs) {
    const row = currentById.get(repair.id);
    if (!row) { results.push({ id: repair.id, status: 'missing' }); continue; }
    if (row.name !== repair.expectedName) { results.push({ id: repair.id, status: 'identity_changed', current_name: row.name }); continue; }
    const existingReview = row.extracted_data?.identity_review;
    const audit = {
      ...(row.extracted_data || {}),
      identity_review: {
        action: repair.action,
        reviewed_at: existingReview?.reviewed_at || new Date().toISOString(),
        last_verified_at: new Date().toISOString(),
        previous: existingReview?.previous || { website: row.website, description: row.description, sectors: row.sectors, status: row.status, god_score: row.total_god_score },
      },
    };
    if (apply) {
      const { error: updateError } = await db.from('startup_uploads').update({ ...repair.patch, extracted_data: audit }).eq('id', repair.id).eq('name', repair.expectedName);
      if (updateError) throw new Error(`${repair.expectedName}: ${updateError.message}`);
    }
    results.push({ id: repair.id, name: row.name, action: repair.action, status: apply ? 'updated' : 'would_update', previous_god_score: row.total_god_score, patch: repair.patch });
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', results }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
