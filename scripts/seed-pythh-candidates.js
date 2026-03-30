#!/usr/bin/env node
/**
 * SEED PYTHH CANDIDATES
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads existing investors table → maps to pythh_candidates schema.
 * Also seeds a small set of key vendor/partner/advisor archetypes.
 *
 * Usage:
 *   node scripts/seed-pythh-candidates.js              # dry-run
 *   node scripts/seed-pythh-candidates.js --apply
 *   node scripts/seed-pythh-candidates.js --apply --investors-only
 *   node scripts/seed-pythh-candidates.js --apply --limit 500
 */
'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const REQUIRED_ENV = ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_KEY'];
for (const k of REQUIRED_ENV) {
  if (!process.env[k]) { console.error(`❌ Missing ${k}`); process.exit(1); }
}
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

function argVal(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
}
const DRY_RUN        = !process.argv.includes('--apply');
const INVESTORS_ONLY = process.argv.includes('--investors-only');
const LIMIT          = +(argVal('--limit', '3000'));
const BATCH_SZ       = 100;

// ── Stage mapping: investor stage string → candidate stages array ─────────────
function mapStages(stage) {
  if (!stage) return ['any'];
  const s = String(stage).toLowerCase();
  if (s.includes('pre-seed') || s.includes('preseed')) return ['pre_seed', 'seed'];
  if (s.includes('seed')) return ['seed', 'series_a'];
  if (s.includes('series a')) return ['seed', 'series_a'];
  if (s.includes('series b')) return ['series_a', 'series_b'];
  if (s.includes('series c') || s.includes('growth') || s.includes('late')) return ['series_b', 'growth'];
  if (s.includes('any') || s.includes('all')) return ['any'];
  return [s.replace(/\s+/g, '_')];
}

// ── Sector normalization ──────────────────────────────────────────────────────
function normalizeSectors(sectors) {
  if (!sectors) return [];
  const arr = Array.isArray(sectors) ? sectors : [sectors];
  return arr
    .map(s => String(s).toLowerCase().trim())
    .filter(Boolean)
    .slice(0, 10);
}

// ── Geography normalization ───────────────────────────────────────────────────
function normalizeGeo(geo) {
  if (!geo) return ['global'];
  const g = String(geo).toLowerCase().trim();
  if (!g || g === 'global' || g === 'worldwide' || g === 'any') return ['global'];
  return g.split(/[,;|]+/).map(s => s.trim()).filter(Boolean).slice(0, 5);
}

// ── Infer need classes from investor focus areas / thesis ────────────────────
function toArr(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') return v.split(/[,;|]+/).map(s => s.trim()).filter(Boolean);
  return [];
}

function inferNeedClasses(investor) {
  const needs = new Set();
  const text = [
    investor.investment_thesis || '',
    toArr(investor.focus_areas).join(' '),
    toArr(investor.sectors).join(' '),
  ].join(' ').toLowerCase();

  if (/enterprise|saas|b2b/.test(text))       needs.add('series_a_capital');
  if (/seed|early|pre-seed/.test(text))        needs.add('seed_capital');
  if (/growth|series [bc]|late/.test(text))    needs.add('growth_capital');
  if (/climate|clean|energy/.test(text))       needs.add('growth_capital');
  if (/health|bio|medtech/.test(text))         needs.add('compliance_tools');
  needs.add('series_a_capital');
  needs.add('series_b_capital');
  return [...needs].slice(0, 8);
}

// ── Infer trajectory preferences from investor profile ───────────────────────
function inferTrajectoryPrefs(investor) {
  const prefs = new Set(['fundraising', 'growth', 'expansion']);
  const text = [investor.investment_thesis || '', toArr(investor.focus_areas).join(' ')].join(' ').toLowerCase();
  if (/enterprise|b2b/.test(text))  prefs.add('fundraising_active');
  if (/growth|scale/.test(text))    prefs.add('gtm_expansion');
  if (/deep|bio|climate/.test(text)) prefs.add('regulatory_enterprise');
  return [...prefs];
}

// ── Vendor/Advisor archetypes ─────────────────────────────────────────────────
// These represent categories of vendors relevant to the needs we detected
const VENDOR_ARCHETYPES = [
  {
    name: 'Enterprise CRM / Sales Engagement (e.g. Salesforce, HubSpot)',
    candidate_type: 'vendor', sectors: ['enterprise software', 'saas', 'b2b'],
    stages: ['any'], geographies: ['global'],
    need_classes_supported: ['revops_tools', 'enterprise_sales_support', 'lead_generation'],
    buying_signals_supported: ['gtm_signal', 'enterprise_signal', 'hiring_signal', 'revenue_signal'],
    trajectory_preferences: ['gtm_expansion', 'expansion', 'growth'],
  },
  {
    name: 'Cloud Infrastructure (e.g. AWS, GCP, Azure)',
    candidate_type: 'vendor', sectors: ['cloud', 'infrastructure', 'enterprise software'],
    stages: ['any'], geographies: ['global'],
    need_classes_supported: ['infra_tools', 'dev_tools', 'data_tools'],
    buying_signals_supported: ['product_signal', 'growth_signal', 'demand_signal', 'expansion_signal'],
    trajectory_preferences: ['product_maturation', 'gtm_expansion', 'expansion'],
  },
  {
    name: 'Security & Compliance (e.g. Vanta, Drata, Secureframe)',
    candidate_type: 'vendor', sectors: ['security', 'compliance', 'saas'],
    stages: ['any'], geographies: ['global'],
    need_classes_supported: ['compliance_tools', 'infra_tools'],
    buying_signals_supported: ['enterprise_signal', 'regulatory_signal', 'product_signal'],
    trajectory_preferences: ['product_maturation', 'regulatory_enterprise', 'gtm_expansion'],
  },
  {
    name: 'Data & Analytics (e.g. Snowflake, Databricks, Fivetran)',
    candidate_type: 'vendor', sectors: ['data', 'analytics', 'ai', 'saas'],
    stages: ['any'], geographies: ['global'],
    need_classes_supported: ['data_tools', 'infra_tools'],
    buying_signals_supported: ['product_signal', 'growth_signal', 'revenue_signal'],
    trajectory_preferences: ['product_maturation', 'growth'],
  },
  {
    name: 'Implementation & Systems Integration Partner',
    candidate_type: 'partner', sectors: ['enterprise software', 'consulting'],
    stages: ['any'], geographies: ['global'],
    need_classes_supported: ['implementation_support', 'systems_integrator'],
    buying_signals_supported: ['buyer_signal', 'buyer_budget_signal', 'enterprise_signal'],
    trajectory_preferences: ['buyer_procurement', 'gtm_expansion'],
  },
  {
    name: 'M&A / Investment Banking Advisory',
    candidate_type: 'advisor', sectors: ['finance', 'investment banking'],
    stages: ['any'], geographies: ['global'],
    need_classes_supported: ['banker_advisor', 'strategic_partner'],
    buying_signals_supported: ['fundraising_signal', 'exit_signal', 'acquisition_signal', 'distress_signal'],
    trajectory_preferences: ['fundraising_active', 'exit_preparation', 'distress_survival'],
  },
  {
    name: 'Turnaround / Restructuring Advisory',
    candidate_type: 'advisor', sectors: ['finance', 'consulting', 'restructuring'],
    stages: ['any'], geographies: ['global'],
    need_classes_supported: ['turnaround_support', 'banker_advisor'],
    buying_signals_supported: ['distress_signal', 'efficiency_signal', 'exit_signal'],
    trajectory_preferences: ['distress_survival', 'exit_preparation', 'repositioning'],
  },
  {
    name: 'Enterprise Executive Search (e.g. Spencer Stuart, Egon Zehnder)',
    candidate_type: 'recruiter', sectors: ['enterprise software', 'technology', 'finance'],
    stages: ['any'], geographies: ['global'],
    need_classes_supported: ['executive_search', 'sales_talent', 'engineering_talent'],
    buying_signals_supported: ['hiring_signal', 'gtm_signal', 'enterprise_signal'],
    trajectory_preferences: ['gtm_expansion', 'fundraising_active', 'growth'],
  },
  {
    name: 'Warehouse / Fulfillment Automation Vendor',
    candidate_type: 'vendor', sectors: ['logistics', 'robotics', 'automation', 'supply chain'],
    stages: ['any'], geographies: ['us', 'global'],
    need_classes_supported: ['automation_vendor', 'robotics_vendor', 'systems_integrator'],
    buying_signals_supported: ['buyer_pain_signal', 'buyer_signal', 'buyer_budget_signal'],
    trajectory_preferences: ['buyer_procurement'],
  },
  {
    name: 'Corporate / Strategic Acquirer (Tech)',
    candidate_type: 'acquirer', sectors: ['enterprise software', 'ai', 'saas'],
    stages: ['any'], geographies: ['global'],
    need_classes_supported: ['acquirer_interest'],
    buying_signals_supported: ['exit_signal', 'acquisition_signal', 'distress_signal', 'revenue_signal'],
    trajectory_preferences: ['exit_preparation', 'distress_survival'],
  },
];

const FORCE = process.argv.includes('--force');

async function main() {
  console.log('\n🌱 SEED PYTHH CANDIDATES');
  console.log('═'.repeat(60));
  console.log(`Mode:    ${DRY_RUN ? '🔍 DRY-RUN' : '✍️  APPLY'}`);
  console.log(`Limit:   ${LIMIT} investors`);
  console.log('═'.repeat(60) + '\n');

  const stats = { investors: 0, vendors: 0, errors: 0, skipped: 0 };

  // Check if already seeded
  if (!DRY_RUN && !FORCE) {
    const { count } = await supabase.from('pythh_candidates').select('*', { count: 'exact', head: true });
    if ((count || 0) > 0) {
      console.log(`⚠️  pythh_candidates already has ${count} rows.`);
      console.log('   Pass --force to wipe and re-seed, or run with --apply only to skip this check.\n');
      console.log('   Exiting without changes.');
      process.exit(0);
    }
  }

  // Wipe on --force
  if (!DRY_RUN && FORCE) {
    console.log('🗑️  Clearing existing candidates (--force)…');
    await supabase.from('pythh_candidates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('   Cleared.\n');
  }

  // ── 1. Seed investors ───────────────────────────────────────────────────────
  console.log('📥 Loading investors from DB…');
  const { data: investors, error } = await supabase
    .from('investors')
    .select('id, name, firm, type, investor_type, stage, sectors, geography_focus, check_size_min, check_size_max, investment_thesis, focus_areas, is_verified, status, investor_tier')
    .in('status', ['approved', 'active', 'verified'])
    .order('investor_tier', { ascending: true, nullsFirst: false })
    .limit(LIMIT);

  if (error) { console.error('❌ Investor fetch failed:', error.message); process.exit(1); }
  console.log(`   Found ${investors?.length ?? 0} active investors\n`);

  for (let i = 0; i < (investors || []).length; i += BATCH_SZ) {
    const batch = (investors || []).slice(i, i + BATCH_SZ);
    const rows = batch.map(inv => ({
      name:                    inv.firm || inv.name || 'Unknown Investor',
      candidate_type:          'investor',
      description:             (inv.investment_thesis || '').slice(0, 500) || null,
      sectors:                 normalizeSectors(toArr(inv.sectors)),
      geographies:             normalizeGeo(inv.geography_focus),
      stages:                  mapStages(inv.stage),
      check_size_min:          inv.check_size_min   || null,
      check_size_max:          inv.check_size_max   || null,
      check_size_label:        inv.check_size_min && inv.check_size_max
                                 ? `$${Math.round(inv.check_size_min/1e6)}M–$${Math.round(inv.check_size_max/1e6)}M`
                                 : null,
      need_classes_supported:  inferNeedClasses(inv),
      buying_signals_supported: ['fundraising_signal', 'investor_interest_signal', 'revenue_signal', 'growth_signal'],
      trajectory_preferences:  inferTrajectoryPrefs(inv),
      negative_filters:        [],
      business_model_fit:      ['saas', 'marketplace', 'hardware', 'services', 'any'],
      is_active:               true,
      is_verified:             inv.is_verified || false,
      metadata:                { source_investor_id: inv.id, tier: inv.investor_tier },
    }));

    if (!DRY_RUN) {
      const { error: insErr } = await supabase
        .from('pythh_candidates')
        .insert(rows);
      if (insErr) { console.error('  Batch error:', insErr.message); stats.errors++; }
      else stats.investors += rows.length;
    } else {
      stats.investors += rows.length;
    }

    const pct = Math.round(((i + batch.length) / investors.length) * 100);
    process.stdout.write(`\r  Investors: ${i + batch.length}/${investors.length} (${pct}%)  `);
  }
  console.log('');

  // ── 2. Seed vendor/advisor archetypes ────────────────────────────────────────
  if (!INVESTORS_ONLY) {
    console.log('\n🔧 Seeding vendor/advisor archetypes…');
    for (const archetype of VENDOR_ARCHETYPES) {
      if (!DRY_RUN) {
        const { error: insErr } = await supabase
          .from('pythh_candidates')
          .insert({
            ...archetype,
            is_active: true, is_verified: true,
            negative_filters: [], business_model_fit: ['any'],
            metadata: { archetype: true },
          });
        if (insErr) { console.error(`  Error seeding ${archetype.name}:`, insErr.message); stats.errors++; }
        else { console.log(`  ✓ ${archetype.name}`); stats.vendors++; }
      } else {
        console.log(`  → [dry] ${archetype.name} (${archetype.candidate_type})`);
        stats.vendors++;
      }
    }
  }

  // ── Report ──────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RESULTS');
  console.log('═'.repeat(60));
  console.log(`Investors seeded: ${DRY_RUN ? '(dry-run)' : stats.investors}`);
  console.log(`Vendors/advisors: ${DRY_RUN ? '(dry-run)' : stats.vendors}`);
  console.log(`Errors:           ${stats.errors}`);
  if (DRY_RUN) console.log('\n💡 Run with --apply to write to pythh_candidates.');
  else console.log('\n✅ Candidates seeded. Run compute-matches.js next.');
  console.log('═'.repeat(60));
}

main().catch(err => { console.error('❌ Fatal:', err.message); process.exit(1); });
