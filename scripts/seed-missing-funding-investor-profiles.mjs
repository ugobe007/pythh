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
  {
    canonicalName: 'Etna Labs', firm: 'Etna Labs', displayName: 'TheEtnaLabs', url: 'https://etnalabs.co/',
    sectors: ['AI/ML', 'Robotics', 'DeepTech', 'Software', 'Data Infrastructure'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['United States', 'Global'],
    thesis: 'Research-driven VC backing frontier AI and robotics; thesis emphasis on real-world robot interaction / data-collection flywheels that compound physical intelligence.',
    source: 'https://etnalabs.co/',
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'Baillie Gifford', firm: 'Baillie Gifford', url: 'https://www.bailliegifford.com/',
    sectors: ['AI/ML', 'Consumer', 'Healthcare', 'Technology', 'SaaS'],
    stage: ['Series B', 'Series C', 'Growth'], geography: ['Global', 'United Kingdom'],
    thesis: 'Long-horizon growth investor known for concentrated public and late-stage private technology positions.',
    source: 'https://www.bailliegifford.com/',
    type: 'VC',
    investorType: 'Growth',
  },
  {
    canonicalName: 'Premji Invest', firm: 'Premji Invest', url: 'https://www.premjiinvest.com/',
    sectors: ['AI/ML', 'SaaS', 'Consumer', 'Fintech'],
    stage: ['Series B', 'Series C', 'Growth'], geography: ['India', 'Global'],
    thesis: 'Growth investor backing category-defining technology companies across India and global markets.',
    source: 'https://www.premjiinvest.com/',
    type: 'VC',
    investorType: 'Growth',
  },
  {
    canonicalName: 'Microsoft', firm: 'Microsoft', url: 'https://www.microsoft.com/',
    sectors: ['AI/ML', 'Enterprise', 'Cloud', 'SaaS'],
    stage: ['Seed', 'Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Corporate strategic investor across cloud, AI, and enterprise software ecosystems.',
    source: 'https://www.microsoft.com/',
    type: 'Corporate',
    investorType: 'Corporate',
  },
  {
    canonicalName: 'Nvidia', firm: 'Nvidia', displayName: 'Nvidia', url: 'https://www.nvidia.com/',
    sectors: ['AI/ML', 'DeepTech', 'Robotics', 'Semiconductors'],
    stage: ['Seed', 'Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Corporate strategic investor in AI infrastructure, robotics, and semiconductor-adjacent platforms.',
    source: 'https://www.nvidia.com/',
    type: 'Corporate',
    investorType: 'Corporate',
  },
  {
    canonicalName: 'Uber', firm: 'Uber', url: 'https://www.uber.com/',
    sectors: ['AI/ML', 'Mobility', 'Logistics', 'Robotics'],
    stage: ['Seed', 'Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Corporate strategic investor in mobility, logistics, and marketplace platforms.',
    source: 'https://www.uber.com/',
    type: 'Corporate',
    investorType: 'Corporate',
  },
  {
    canonicalName: 'ICONIQ', firm: 'ICONIQ Capital', displayName: 'ICONIQ Capital', url: 'https://www.iconiqcapital.com/',
    sectors: ['Consumer', 'Fintech', 'HealthTech', 'SaaS', 'AI/ML'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['United States', 'Global'],
    thesis: 'Growth-oriented technology investor partnering with category leaders across software and consumer.',
    source: 'https://www.iconiqcapital.com/',
    type: 'VC',
    investorType: 'VC',
  },
  {
    canonicalName: 'BoldCap', firm: 'BoldCap', url: null,
    sectors: ['Fintech', 'SaaS', 'AI/ML', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage investor appearing frequently in post-prediction funding ledgers.',
    source: null,
    type: 'VC',
    investorType: 'VC',
  },
];

async function allInvestors() {
  const rows = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    const { data, error } = await db.from('investors')
      .select('id,name,firm,url,sectors,stage,status,is_verified,type,is_individual,investor_score')
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function main() {
  const [investors, { data: organizations, error: organizationError }] = await Promise.all([
    allInvestors(),
    db.from('investor_organizations').select('id,canonical_name,normalized_name'),
  ]);
  if (organizationError) throw organizationError;
  const organizationByName = new Map((organizations || []).map(row => [row.normalized_name, row]));
  const plan = profiles.map(profile => {
    const normalized = normalizeEntityName(profile.canonicalName);
    const displayNormalized = normalizeEntityName(profile.displayName || profile.canonicalName);
    const firmNormalized = normalizeEntityName(profile.firm);
    const candidates = (investors || []).filter(row =>
      [row.name, row.firm].some(value => {
        const n = normalizeEntityName(value);
        return n === normalized || n === displayNormalized || n === firmNormalized;
      })
    );
    // Prefer exact firm display name, then non-person rows, then first match.
    const existing = [...candidates].sort((a, b) => {
      const aDisplay = Number(normalizeEntityName(a.name) === displayNormalized);
      const bDisplay = Number(normalizeEntityName(b.name) === displayNormalized);
      if (bDisplay !== aDisplay) return bDisplay - aDisplay;
      const aExact = Number(normalizeEntityName(a.name) === normalized);
      const bExact = Number(normalizeEntityName(b.name) === normalized);
      if (bExact !== aExact) return bExact - aExact;
      const aPerson = Number(/\bangel\b/i.test(String(a.type || '')) || a.is_individual === true);
      const bPerson = Number(/\bangel\b/i.test(String(b.type || '')) || b.is_individual === true);
      if (aPerson !== bPerson) return aPerson - bPerson;
      return (Number(b.investor_score) || 0) - (Number(a.investor_score) || 0);
    });
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
        name: profile.displayName || profile.canonicalName,
        firm: profile.firm,
        url: profile.url,
        sectors: profile.sectors,
        stage: profile.stage,
        geography_focus: profile.geography,
        check_size_min: profile.checkMin || null,
        check_size_max: profile.checkMax || null,
        investment_thesis: profile.thesis,
        type: profile.type || 'VC',
        investor_type: profile.investorType || profile.type || 'VC',
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
