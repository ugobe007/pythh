#!/usr/bin/env node
/**
 * Seed curated capital providers from funding-news discovery
 * (npm run funding:discover:missing-providers).
 *
 * Creates/reactivates investor_organizations + investors with correct type
 * (Family Office vs VC), then you should run:
 *   npm run funding:coverage:investors:resolve:apply
 *
 * Usage:
 *   node scripts/seed-discovered-capital-providers.mjs
 *   node scripts/seed-discovered-capital-providers.mjs --apply
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
 * Curated from 2026-08-31 discovery report.
 * Skipped: Morgan Stanley Wealth (bank desk), Cecure/Constantin/Vincent/Lanai
 * (ambiguous), person-angels, SVB debt, parse debris.
 */
const profiles = [
  {
    canonicalName: 'Spectrum Impact Family Office',
    firm: 'Spectrum Impact',
    aliases: ['Spectrum Impact', 'Spectrum Impact Family Office'],
    url: 'https://spectrum-impact.org/',
    sectors: ['Climate Tech', 'Healthcare', 'EdTech', 'Impact'],
    stage: ['Seed', 'Series A', 'Series B', 'Growth'],
    geography: ['India', 'Asia', 'Global'],
    thesis:
      'Single-family office (Gogri family / Aarti Industries) allocating for-profit and philanthropic capital into climate, health, and education with a founder-first, early-support approach.',
    source: 'https://spectrum-impact.org/',
    type: 'Family Office',
    investorType: 'Family Office',
  },
  {
    canonicalName: 'Designer Fund',
    firm: 'Designer Fund',
    aliases: ['Designer Fund'],
    url: 'https://designerfund.com/',
    sectors: ['AI/ML', 'Healthcare', 'Fintech', 'Climate Tech', 'SaaS', 'Consumer'],
    stage: ['Pre-Seed', 'Seed'],
    geography: ['United States', 'Global'],
    checkMin: 100000,
    checkMax: 1000000,
    thesis:
      'Early-stage venture firm backing design-led tech companies improving health, sustainability, and prosperity; design value-add alongside capital.',
    source: 'https://designerfund.com/',
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'Jeito Capital',
    firm: 'Jeito Capital',
    aliases: ['Jeito', 'Jeito Capital'],
    url: 'https://www.jeito.life/',
    sectors: ['Healthcare', 'Biotech', 'Biopharma', 'Life Sciences'],
    stage: ['Series A', 'Series B', 'Growth'],
    geography: ['Europe', 'United States', 'Global'],
    thesis:
      'Independent European growth-equity investor dedicated to clinical-stage biopharma; continuity of capital from development through market access.',
    source: 'https://www.jeito.life/en/about/',
    type: 'VC',
    investorType: 'Growth',
  },
  {
    canonicalName: 'Ludlow Ventures',
    firm: 'Ludlow Ventures',
    aliases: ['Ludlow Ventures', 'Ludlow'],
    url: 'https://www.ludlowventures.com/',
    sectors: ['SaaS', 'AI/ML', 'Consumer', 'Fintech', 'Technology'],
    stage: ['Pre-Seed', 'Seed', 'Series A'],
    geography: ['United States', 'Global'],
    thesis: 'Early-stage venture firm prioritizing founder trust and authentic relationships from pre-seed through Series A.',
    source: 'https://www.ludlowventures.com/',
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'PixelSky Capital',
    firm: 'PixelSky Capital',
    aliases: ['PixelSky Capital', 'PixelSky'],
    url: null,
    sectors: ['Climate Tech', 'Energy', 'Infrastructure', 'Technology'],
    stage: ['Series B', 'Series C', 'Growth'],
    geography: ['India', 'Global'],
    thesis: 'Growth investor appearing as lead in Indian climate/bioenergy financings (e.g. GPS Renewables Series C).',
    source: 'https://pulse2.com/gps-renewables-raises-%e2%82%b9635-crore-about-74-1-million-in-series-c-funding-to-expand-bioenergy-infrastructure/',
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'Apollo Health Ventures',
    firm: 'Apollo Health Ventures',
    aliases: ['Apollo Health Ventures'],
    url: 'https://www.apollo.vc/',
    sectors: ['Healthcare', 'Biotech', 'Longevity', 'AI/ML'],
    stage: ['Seed', 'Series A', 'Series B'],
    geography: ['Europe', 'United States', 'Global'],
    thesis: 'Health and longevity-focused venture firm backing science-driven companies.',
    source: 'https://www.apollo.vc/',
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'Humba Ventures',
    firm: 'Humba Ventures',
    aliases: ['Humba Ventures', 'Humba'],
    url: 'https://www.humba.vc/',
    sectors: ['AI/ML', 'DeepTech', 'Hardware', 'Technology'],
    stage: ['Seed', 'Series A'],
    geography: ['United States', 'Global'],
    thesis: 'Early-stage venture firm backing technical founders in deep tech and applied AI.',
    source: 'https://www.humba.vc/',
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'JAL Ventures',
    firm: 'JAL Ventures',
    aliases: ['JAL Ventures'],
    url: null,
    sectors: ['Technology', 'SaaS', 'AI/ML'],
    stage: ['Seed', 'Series A'],
    geography: ['Global'],
    thesis: 'Venture firm appearing in recent funding evidence ledgers as a round participant.',
    source: null,
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'Linea Ventures',
    firm: 'Linea Ventures',
    aliases: ['Linea Ventures', 'Linea'],
    url: null,
    sectors: ['Technology', 'SaaS', 'AI/ML'],
    stage: ['Seed', 'Series A'],
    geography: ['Global'],
    thesis: 'Early-stage venture firm appearing in recent funding evidence ledgers.',
    source: null,
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'Sixty Degree Capital',
    firm: 'Sixty Degree Capital',
    aliases: ['Sixty Degree Capital', '60 Degree Capital'],
    url: 'https://www.sixtydegree.com/',
    sectors: ['Healthcare', 'Technology', 'SaaS'],
    stage: ['Seed', 'Series A', 'Series B'],
    geography: ['Canada', 'Global'],
    thesis: 'Canadian venture firm investing across technology and healthcare.',
    source: 'https://www.sixtydegree.com/',
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'Triple A Venture Capital',
    firm: 'Triple A Venture Capital',
    aliases: ['Triple A Venture Capital', 'Triple A Ventures'],
    url: null,
    sectors: ['Technology', 'SaaS', 'AI/ML'],
    stage: ['Seed', 'Series A'],
    geography: ['Global'],
    thesis: 'Venture firm appearing in recent funding evidence ledgers as a round participant.',
    source: null,
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'Light Street Capital',
    firm: 'Light Street Capital',
    aliases: ['Light Street Capital', 'Light Street'],
    url: 'https://www.lightstreet.com/',
    sectors: ['Technology', 'Consumer', 'SaaS', 'AI/ML'],
    stage: ['Series B', 'Growth'],
    geography: ['United States', 'Global'],
    thesis: 'Public/private technology investor; appears as lead in growth-stage private financings.',
    source: 'https://www.lightstreet.com/',
    type: 'VC',
    investorType: 'Growth',
  },
  {
    canonicalName: 'Sandberg Bernthal Venture Partners',
    firm: 'Sandberg Bernthal Venture Partners',
    aliases: ['Sandberg Bernthal Venture Partners', 'Sandberg Bernthal'],
    url: 'https://www.sbandco.com/',
    sectors: ['Technology', 'SaaS', 'Consumer', 'AI/ML'],
    stage: ['Seed', 'Series A', 'Series B'],
    geography: ['United States', 'Global'],
    thesis: 'Venture partnership associated with operator-investors; appears as lead in recent financings.',
    source: 'https://www.sbandco.com/',
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'Agent Capital',
    firm: 'Agent Capital',
    aliases: ['Agent Capital'],
    url: 'https://www.agentcapital.com/',
    sectors: ['Healthcare', 'Biotech', 'Life Sciences'],
    stage: ['Seed', 'Series A', 'Series B'],
    geography: ['United States', 'Global'],
    thesis: 'Healthcare-focused venture firm investing in biotech and life sciences.',
    source: 'https://www.agentcapital.com/',
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'Alta Park Capital',
    firm: 'Alta Park Capital',
    aliases: ['Alta Park Capital', 'Alta Park'],
    url: 'https://www.altapark.com/',
    sectors: ['Technology', 'SaaS', 'AI/ML', 'Enterprise'],
    stage: ['Series B', 'Growth'],
    geography: ['United States', 'Global'],
    thesis: 'Growth-oriented technology investor.',
    source: 'https://www.altapark.com/',
    type: 'VC',
    investorType: 'Growth',
  },
  {
    canonicalName: 'Anamcara Capital',
    firm: 'Anamcara Capital',
    aliases: ['Anamcara Capital', 'Anamcara'],
    url: null,
    sectors: ['Technology', 'SaaS', 'AI/ML'],
    stage: ['Seed', 'Series A'],
    geography: ['Global'],
    thesis: 'Venture firm appearing in recent funding evidence ledgers.',
    source: null,
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'Boxer Capital',
    firm: 'Boxer Capital',
    aliases: ['Boxer Capital'],
    url: 'https://www.boxercapital.com/',
    sectors: ['Healthcare', 'Biotech', 'Life Sciences'],
    stage: ['Series A', 'Series B', 'Growth'],
    geography: ['United States', 'Global'],
    thesis: 'Healthcare-focused investment firm active in biotech financings.',
    source: 'https://www.boxercapital.com/',
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'Essence Venture Capital',
    firm: 'Essence Venture Capital',
    aliases: ['Essence Venture Capital', 'Essence Ventures'],
    url: null,
    sectors: ['Technology', 'SaaS', 'AI/ML'],
    stage: ['Seed', 'Series A'],
    geography: ['Global'],
    thesis: 'Venture firm appearing in recent funding evidence ledgers.',
    source: null,
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'Airstream Capital',
    firm: 'Airstream Capital',
    aliases: ['Airstream Capital'],
    url: null,
    sectors: ['Technology', 'SaaS', 'AI/ML'],
    stage: ['Seed', 'Series A'],
    geography: ['Global'],
    thesis: 'Venture firm appearing in recent funding evidence ledgers.',
    source: null,
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'Borusan Ventures',
    firm: 'Borusan Ventures',
    aliases: ['Borusan Ventures'],
    url: null,
    sectors: ['Technology', 'Industrial', 'AI/ML'],
    stage: ['Seed', 'Series A'],
    geography: ['Turkey', 'Europe', 'Global'],
    thesis: 'Corporate/venture investor appearing in recent funding evidence ledgers.',
    source: null,
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'Cartan Capital',
    firm: 'Cartan Capital',
    aliases: ['Cartan Capital'],
    url: null,
    sectors: ['Technology', 'SaaS', 'AI/ML'],
    stage: ['Seed', 'Series A'],
    geography: ['Global'],
    thesis: 'Venture firm appearing in recent funding evidence ledgers.',
    source: null,
    type: 'VC',
    investorType: 'VC',
  },
];

async function findInvestor(name, firm) {
  const targets = [...new Set([name, firm].filter(Boolean))];
  for (const t of targets) {
    const { data: byName, error: e1 } = await db
      .from('investors')
      .select('id,name,firm,status,type,entity_gate,is_individual')
      .ilike('name', t)
      .limit(5);
    if (e1) throw e1;
    const { data: byFirm, error: e2 } = await db
      .from('investors')
      .select('id,name,firm,status,type,entity_gate,is_individual')
      .ilike('firm', t)
      .limit(5);
    if (e2) throw e2;
    const rows = [...(byName || []), ...(byFirm || [])];
    const exact = rows.find(
      (r) =>
        r.is_individual === false &&
        (String(r.name || '').toLowerCase() === t.toLowerCase() ||
          String(r.firm || '').toLowerCase() === t.toLowerCase()),
    );
    if (exact) return exact;
  }
  return null;
}

async function main() {
  const plan = [];
  for (const profile of profiles) {
    const existing = await findInvestor(profile.canonicalName, profile.firm);
    plan.push({
      ...profile,
      normalized: normalizeEntityName(profile.canonicalName),
      existing,
      action: existing
        ? existing.status === 'active' && existing.entity_gate === 'qualified'
          ? 'already_active'
          : 'reactivate'
        : 'create',
    });
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
          },
          plan: plan.map((p) => ({
            name: p.canonicalName,
            type: p.type,
            action: p.action,
            existing_id: p.existing?.id || null,
            existing_status: p.existing?.status || null,
          })),
        },
        null,
        2,
      ),
    );
    console.log('\nDry-run only. Re-run with --apply to write.');
    return;
  }

  const results = [];
  for (const profile of plan) {
    const normalized = profile.normalized;
    const { data: organization, error: orgError } = await db
      .from('investor_organizations')
      .upsert(
        {
          canonical_name: profile.canonicalName,
          normalized_name: normalized,
          website_domain: profile.url
            ? String(profile.url)
                .replace(/^https?:\/\//, '')
                .replace(/\/$/, '')
                .split('/')[0]
            : null,
          metadata: {
            source: 'funding_news_discovery',
            provider_type: profile.type === 'Family Office' ? 'family_office' : 'vc',
            reviewed: true,
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'normalized_name' },
      )
      .select('id')
      .single();
    if (orgError) throw orgError;

    const aliasRows = [...new Set([profile.canonicalName, profile.firm, ...(profile.aliases || [])])]
      .map((alias) => ({
        organization_id: organization.id,
        alias,
        normalized_alias: normalizeEntityName(alias),
        source: 'funding_news_discovery',
      }))
      .filter((row, i, arr) => arr.findIndex((x) => x.normalized_alias === row.normalized_alias) === i);

    if (aliasRows.length) {
      const { error: aliasError } = await db
        .from('investor_organization_aliases')
        .upsert(aliasRows, { onConflict: 'normalized_alias' });
      if (aliasError) throw aliasError;
    }

    let investor = profile.existing;
    if (!investor) {
      const { data, error } = await db
        .from('investors')
        .insert({
          name: profile.canonicalName,
          firm: profile.firm,
          url: profile.url,
          sectors: profile.sectors,
          stage: profile.stage,
          geography_focus: profile.geography,
          check_size_min: profile.checkMin || null,
          check_size_max: profile.checkMax || null,
          investment_thesis: profile.thesis,
          type: profile.type,
          investor_type: profile.investorType || profile.type,
          investor_score: profile.type === 'Family Office' ? 60 : 55,
          investor_tier: 'emerging',
          entity_gate: 'qualified',
          status: 'active',
          is_verified: true,
          is_individual: false,
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
          type: profile.type,
          investor_type: profile.investorType || profile.type,
          firm: profile.firm,
          url: profile.url || undefined,
          sectors: profile.sectors,
          stage: profile.stage,
          geography_focus: profile.geography,
          investment_thesis: profile.thesis,
          is_individual: false,
          is_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', investor.id);
      if (error) throw error;
    }

    const { error: membershipError } = await db.from('investor_organization_memberships').upsert(
      {
        investor_id: investor.id,
        organization_id: organization.id,
        resolution_method: 'funding_news_discovery_seed',
        resolution_confidence: 1,
        reviewed_at: new Date().toISOString(),
        metadata: { source_url: profile.source },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'investor_id' },
    );
    if (membershipError) throw membershipError;

    results.push({
      name: profile.canonicalName,
      type: profile.type,
      action: profile.action,
      investor_id: investor.id,
      organization_id: organization.id,
    });
    console.log(`✓ ${profile.action.padEnd(12)} ${profile.type.padEnd(14)} ${profile.canonicalName}`);
  }

  console.log(JSON.stringify({ mode: 'apply', seeded: results.length, results }, null, 2));
  console.log('\nNext: npm run funding:coverage:investors:resolve:apply');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
