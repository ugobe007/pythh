#!/usr/bin/env node
/**
 * Seed curated individual angels from funding-news discovery.
 *
 * Identity-only: creates is_individual=true Angel rows without inventing
 * sector/stage/thesis from a single headline. Skips founders-of-the-startup
 * false leads and firm-like Title Case misclassified as people.
 *
 * Usage:
 *   node scripts/seed-discovered-angels.mjs
 *   node scripts/seed-discovered-angels.mjs --apply
 */
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

/**
 * Reviewed person angels from 90d discovery (person_name_shape + investor roster
 * context). Intentionally identity-only.
 *
 * SKIPPED (not angels / not investors):
 * - Karaoke Club, Scenic Management, Tribute Technology, Brydge Club (firms)
 * - Contemporary Amperex, Enterprise Ireland, Business Finland, Truist, …
 * - Krishnan Raghavan, Jesse Proudman (startup founder “led by” false lead)
 * - Industrial Brines, Oilfield Wastewater, New Fare (headline debris)
 */
const angels = [
  {
    name: 'Alex Pall',
    title: 'Co-founder, The Chainsmokers / investor',
    note: 'Participant in Pure round with MaC, Ludlow, Goodwater, SignalFire',
    evidence_urls: [],
  },
  {
    name: 'Jake Brooks',
    title: 'Angel investor',
    note: 'Participant in Pure round roster',
    evidence_urls: [],
  },
  {
    name: 'Ankush Gera',
    title: 'Angel investor',
    note: 'Participant in Portal round with Tim Ferriss, Matt Mullenweg, et al.',
    evidence_urls: [],
  },
  {
    name: 'Michael Fishman',
    title: 'Angel investor',
    note: 'Participant in Portal round roster',
    evidence_urls: [],
  },
  {
    name: 'Ravi Bhojwani',
    title: 'Angel investor',
    note: 'Participant in Portal round roster',
    evidence_urls: [],
  },
  {
    name: 'JP Newman',
    title: 'Angel investor',
    note: 'Named in Portal round roster (with Ankush Gera / Fishman / Bhojwani)',
    evidence_urls: [],
  },
  {
    name: 'Guillaume Despagne',
    title: 'Co-founder, ARIADNEXT (angel)',
    note: 'Invested alongside Seventure in Wultra',
    evidence_urls: [],
  },
  {
    name: 'Jan Enhager',
    title: 'Co-founder, Vitamin Well (angel)',
    note: 'Participant in Millow round led by Magnus Emilson',
    evidence_urls: [],
  },
  {
    name: 'Sheryl Sandberg',
    title: 'Angel investor',
    note: 'Participant in Omen AI financing with CRV et al.',
    evidence_urls: [],
  },
  {
    name: 'Mike Mattacola',
    title: 'Angel investor',
    note: 'Participant in Omen AI financing',
    evidence_urls: [],
  },
  {
    name: 'Nikesh Arora',
    title: 'CEO, Palo Alto Networks (angel)',
    note: 'Participant in Valarian round',
    evidence_urls: [],
  },
  {
    name: 'Julius Genachowski',
    title: 'Angel investor',
    note: 'Named among Brinc backers',
    evidence_urls: [],
  },
  {
    name: 'Patrick Shanahan',
    title: 'Angel investor',
    note: 'Named among Brinc backers',
    evidence_urls: [],
  },
  {
    name: 'Shyam Sankar',
    title: 'CTO, Palantir (angel)',
    note: 'Named among Brinc backers',
    evidence_urls: [],
  },
  {
    name: 'Moaffak Ahmed',
    title: 'Angel investor',
    note: 'Participant in Rotomate pre-seed (Helsinki)',
    evidence_urls: [],
  },
];

async function findIndividual(name) {
  const { data, error } = await db
    .from('investors')
    .select('id,name,firm,status,type,is_individual,entity_gate')
    .ilike('name', name)
    .limit(10);
  if (error) throw error;
  const exact = (data || []).filter(
    (r) => String(r.name || '').toLowerCase() === name.toLowerCase(),
  );
  const individual = exact.find((r) => r.is_individual === true);
  if (individual) return individual;
  // Prefer not reusing a firm row with the same display name
  if (exact.length === 1 && exact[0].is_individual !== true) return { ...exact[0], _firmCollision: true };
  return exact[0] || null;
}

async function main() {
  const plan = [];
  for (const a of angels) {
    const existing = await findIndividual(a.name);
    let action = 'create';
    if (existing?._firmCollision) action = 'skip_firm_collision';
    else if (existing?.is_individual) {
      action =
        existing.status === 'active' && existing.entity_gate === 'qualified'
          ? 'already_active'
          : 'reactivate';
    } else if (existing) {
      action = 'skip_ambiguous';
    }
    plan.push({ ...a, existing, action, normalized: normalizeEntityName(a.name) });
  }

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry-run',
          counts: {
            create: plan.filter((p) => p.action === 'create').length,
            reactivate: plan.filter((p) => p.action === 'reactivate').length,
            already_active: plan.filter((p) => p.action === 'already_active').length,
            skipped: plan.filter((p) => p.action.startsWith('skip')).length,
          },
          plan: plan.map((p) => ({
            name: p.name,
            action: p.action,
            existing_id: p.existing?.id || null,
            note: p.note,
          })),
          rejected_examples: [
            'Karaoke Club / Scenic Management / Tribute Technology (firms)',
            'Enterprise Ireland / Business Finland / Truist (institutions)',
            'Krishnan Raghavan / Jesse Proudman (startup founder false leads)',
            'Industrial Brines / Oilfield Wastewater (headline debris)',
          ],
        },
        null,
        2,
      ),
    );
    console.log('\nDry-run only. Re-run with --apply to write.');
    return;
  }

  const results = [];
  for (const p of plan) {
    if (p.action.startsWith('skip')) {
      console.log(`↷ skip         ${p.action}  ${p.name}`);
      continue;
    }
    let investor = p.existing?.is_individual ? p.existing : null;
    if (!investor) {
      const { data, error } = await db
        .from('investors')
        .insert({
          name: p.name,
          firm: 'Angel Investor',
          title: p.title || null,
          type: 'Angel',
          investor_type: 'Angel',
          is_individual: true,
          status: 'active',
          is_verified: true,
          entity_gate: 'qualified',
          url: null,
          sectors: [],
          stage: [],
          geography_focus: [],
          check_size_min: null,
          check_size_max: null,
          investment_thesis: null,
          investor_score: 50,
          investor_tier: 'emerging',
        })
        .select('id,name')
        .single();
      if (error) throw error;
      investor = data;
    } else {
      const { error } = await db
        .from('investors')
        .update({
          status: 'active',
          entity_gate: 'qualified',
          type: 'Angel',
          investor_type: 'Angel',
          firm: 'Angel Investor',
          title: p.title || undefined,
          is_individual: true,
          is_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', investor.id);
      if (error) throw error;
    }

    // Resolve unmatched participants with exact raw name
    const { data: parts, error: pErr } = await db
      .from('funding_evidence_participants')
      .select('id,investor_name_raw,investor_id,evidence')
      .is('investor_id', null)
      .ilike('investor_name_raw', p.name);
    if (pErr) throw pErr;
    const now = new Date().toISOString();
    let linked = 0;
    for (const row of parts || []) {
      if (normalizeEntityName(row.investor_name_raw) !== p.normalized) continue;
      const { error } = await db
        .from('funding_evidence_participants')
        .update({
          investor_id: investor.id,
          resolution_status: 'resolved',
          resolution_confidence: 1,
          evidence: {
            ...(row.evidence || {}),
            identity_resolution: {
              version: 'discovered-angel-identity-v1',
              method: 'reviewed_person_angel_from_funding_news',
              reviewed_at: now,
              identity_only: true,
              note: p.note,
            },
          },
          updated_at: now,
        })
        .eq('id', row.id);
      if (error) throw error;
      linked += 1;
    }

    results.push({ name: p.name, action: p.action, investor_id: investor.id, participants_linked: linked });
    console.log(`✓ ${p.action.padEnd(14)} Angel  ${p.name}  (linked ${linked})`);
  }

  console.log(JSON.stringify({ mode: 'apply', seeded: results.length, results }, null, 2));
  console.log('\nNext: npm run funding:coverage:investors:resolve:apply');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
