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

const profiles = [
  {
    canonicalName: 'Horizon', firm: 'Horizon', url: 'https://www.horizon.vc/',
    sectors: ['B2B SaaS', 'AI/ML', 'Software', 'Developer Tools'], stage: ['Pre-Seed', 'Seed'], geography: ['Global'],
    checkMin: 250000, checkMax: 1500000,
    thesis: 'Software investor backing technical, product-obsessed founders at pre-seed and seed; frequently follows on.',
    source: 'https://www.horizon.vc/',
  },
  {
    canonicalName: 'Citius', firm: 'Citius', url: 'https://citius.vc/',
    sectors: ['Technology', 'Technology-enabled'], stage: [], geography: ['Global'],
    thesis: 'Investment firm funding technology-enabled companies.', source: 'https://citius.vc/',
  },
  {
    canonicalName: 'BTG Pactual', firm: 'BTG Pactual', url: 'https://www.btgpactual.com/',
    sectors: ['Technology', 'FinTech', 'Financial Services', 'Healthcare', 'Education', 'Logistics'], stage: ['Venture', 'Growth'], geography: ['Latin America', 'Global'],
    thesis: 'Private-capital platform investing across venture capital, private equity, infrastructure and impact, including technology.',
    source: 'https://www.btgpactual.com/capital-privado/bdiv11/private-capital',
  },
  {
    canonicalName: 'Pacific Alliance Ventures', firm: 'Pacific Alliance Ventures', url: 'https://www.pav.vc/',
    sectors: ['Technology', 'AI/ML', 'Infrastructure'], stage: [], geography: ['Global'],
    thesis: 'Backs founders building enduring technology companies with disciplined, long-term partnership.', source: 'https://www.pav.vc/',
  },
  {
    canonicalName: 'Hamilton Lane', firm: 'Hamilton Lane', url: 'https://www.hamiltonlane.com/',
    sectors: ['Technology', 'AI/ML', 'Software', 'FinTech'], stage: ['Venture', 'Growth'], geography: ['Global'],
    thesis: 'Venture and growth strategy spanning direct deals, fund investments and secondaries in high-growth technology companies.',
    source: 'https://www.hamiltonlane.com/en-us/strategies/vc-growth-equity-investments',
  },
  {
    canonicalName: 'Broadhaven Ventures', firm: 'Broadhaven Ventures', url: 'https://www.broadhaven.com/investment',
    sectors: ['FinTech', 'Financial Services'], stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage investor at the intersection of financial services and technology, primarily Seed and Series A with follow-on reserves.',
    source: 'https://www.broadhaven.com/investment',
  },
];

async function main() {
  const [{ data: investors, error: investorError }, { data: organizations, error: organizationError }] = await Promise.all([
    db.from('investors').select('id,name,firm,url,sectors,stage,status,is_verified'),
    db.from('investor_organizations').select('id,canonical_name,normalized_name'),
  ]);
  if (investorError) throw investorError;
  if (organizationError) throw organizationError;
  const organizationByName = new Map((organizations || []).map(row => [row.normalized_name, row]));
  const plan = profiles.map(profile => {
    const normalized = normalizeEntityName(profile.canonicalName);
    const existing = (investors || []).filter(row => [row.name, row.firm].some(value => normalizeEntityName(value) === normalized));
    return { ...profile, normalized, organization: organizationByName.get(normalized), existing };
  });
  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', profiles: plan.map(row => ({
      canonical_name: row.canonicalName,
      organization_id: row.organization?.id || null,
      existing_candidates: row.existing.map(item => ({ id: item.id, name: item.name, firm: item.firm, url: item.url })),
      proposed: { url: row.url, sectors: row.sectors, stage: row.stage, geography_focus: row.geography, check_size_min: row.checkMin || null, check_size_max: row.checkMax || null, source: row.source },
    })) }, null, 2));
    return;
  }

  const results = [];
  for (const profile of plan) {
    if (!profile.organization) throw new Error(`Missing canonical organization for ${profile.canonicalName}`);
    let investor = profile.existing[0] || null;
    if (!investor) {
      const { data, error } = await db.from('investors').insert({
        name: profile.canonicalName,
        firm: profile.firm,
        url: profile.url,
        sectors: profile.sectors,
        stage: profile.stage,
        geography_focus: profile.geography,
        check_size_min: profile.checkMin || null,
        check_size_max: profile.checkMax || null,
        investment_thesis: profile.thesis,
        investor_score: 50,
        investor_tier: 'emerging',
        status: 'active',
        is_verified: true,
      }).select('id,name,firm').single();
      if (error) throw error;
      investor = data;
    }
    const { error: membershipError } = await db.from('investor_organization_memberships').upsert({
      investor_id: investor.id,
      organization_id: profile.organization.id,
      resolution_method: 'first_party_profile_review',
      resolution_confidence: 1,
      reviewed_at: new Date().toISOString(),
      metadata: { source_url: profile.source, conservative_unknowns_preserved: true },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'investor_id' });
    if (membershipError) throw membershipError;
    results.push({ canonical_name: profile.canonicalName, investor_id: investor.id, created: profile.existing.length === 0 });
  }
  console.log(JSON.stringify({ mode: 'apply', results }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
