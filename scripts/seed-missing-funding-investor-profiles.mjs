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
  // Frequent not_in_universe / partner-only collisions (post-#35 unresolved backlog).
  {
    canonicalName: 'Index Ventures', firm: 'Index Ventures', url: 'https://www.indexventures.com/',
    sectors: ['AI/ML', 'SaaS', 'Fintech', 'Consumer', 'Enterprise'],
    stage: ['Seed', 'Series A', 'Series B', 'Growth'], geography: ['Europe', 'United States', 'Global'],
    thesis: 'Stage-agnostic venture firm backing transformative technology companies across Europe and the US.',
    source: 'https://www.indexventures.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Khosla Ventures', firm: 'Khosla Ventures', url: 'https://www.khoslaventures.com/',
    sectors: ['AI/ML', 'Climate Tech', 'Healthcare', 'DeepTech', 'SaaS'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['United States', 'Global'],
    thesis: 'Early-stage venture firm investing in technology breakthroughs across AI, climate, and health.',
    source: 'https://www.khoslaventures.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Tencent', firm: 'Tencent', url: 'https://www.tencent.com/',
    sectors: ['AI/ML', 'Consumer', 'Gaming', 'Fintech', 'Enterprise'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global', 'China'],
    thesis: 'Corporate strategic investor across consumer internet, gaming, fintech, and enterprise software.',
    source: 'https://www.tencent.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Hummingbird', firm: 'Hummingbird Ventures', displayName: 'Hummingbird Ventures', url: 'https://hummingbird.vc/',
    sectors: ['AI/ML', 'SaaS', 'Fintech', 'Consumer'],
    stage: ['Seed', 'Series A'], geography: ['Europe', 'Global'],
    thesis: 'Early-stage venture firm backing ambitious founders across Europe and beyond.',
    source: 'https://hummingbird.vc/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Cyberstarts', firm: 'Cyberstarts', url: 'https://www.cyberstarts.com/',
    sectors: ['Cybersecurity', 'Enterprise', 'AI/ML'],
    stage: ['Seed', 'Series A'], geography: ['Israel', 'United States', 'Global'],
    thesis: 'Cybersecurity-focused early-stage venture firm.',
    source: 'https://www.cyberstarts.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'MarcyPen Capital Partners', firm: 'MarcyPen Capital Partners', url: null,
    sectors: ['AI/ML', 'SaaS', 'Fintech', 'Technology'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['Global'],
    thesis: 'Venture investor appearing frequently in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Lightrock', firm: 'Lightrock', url: 'https://www.lightrock.com/',
    sectors: ['Climate Tech', 'Fintech', 'Healthcare', 'Technology'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global', 'India', 'Europe'],
    thesis: 'Impact-oriented growth investor backing sustainable and technology-enabled businesses.',
    source: 'https://www.lightrock.com/', type: 'VC', investorType: 'Growth',
  },
  {
    canonicalName: 'Z47', firm: 'Z47', url: 'https://z47.com/',
    sectors: ['AI/ML', 'SaaS', 'Fintech', 'Consumer'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['India', 'Global'],
    thesis: 'India-focused venture firm (formerly Matrix Partners India) backing category-defining startups.',
    source: 'https://z47.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'DN Capital', firm: 'DN Capital', url: 'https://www.dncapital.com/',
    sectors: ['SaaS', 'Fintech', 'AI/ML', 'Marketplace'],
    stage: ['Seed', 'Series A'], geography: ['Europe', 'United States', 'Global'],
    thesis: 'Early-stage venture firm investing in software and marketplace businesses.',
    source: 'https://www.dncapital.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Advent International', firm: 'Advent International', url: 'https://www.adventinternational.com/',
    sectors: ['Technology', 'Healthcare', 'Financial Services', 'Industrial'],
    stage: ['Growth', 'Buyout'], geography: ['Global'],
    thesis: 'Global private equity firm with growth and buyout strategies across technology and services.',
    source: 'https://www.adventinternational.com/', type: 'PE', investorType: 'PE',
  },
  {
    canonicalName: 'Dabur Ventures', firm: 'Dabur Ventures', url: null,
    sectors: ['Consumer', 'Healthcare', 'Fintech', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['India', 'Global'],
    thesis: 'Corporate venture arm investing in consumer and technology startups.',
    source: null, type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Pitchdrive', firm: 'Pitchdrive', url: 'https://www.pitchdrive.com/',
    sectors: ['SaaS', 'AI/ML', 'Fintech', 'Marketplace'],
    stage: ['Pre-Seed', 'Seed'], geography: ['Europe', 'Global'],
    thesis: 'European early-stage venture firm backing ambitious technical founders.',
    source: 'https://www.pitchdrive.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'OG Venture Partners', firm: 'OG Venture Partners', url: null,
    sectors: ['AI/ML', 'SaaS', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'XTX Markets', firm: 'XTX Markets', url: 'https://www.xtxmarkets.com/',
    sectors: ['Fintech', 'AI/ML', 'Technology'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Quantitative trading firm investing strategically in technology and markets infrastructure.',
    source: 'https://www.xtxmarkets.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: '8090 Industries', firm: '8090 Industries', url: null,
    sectors: ['AI/ML', 'DeepTech', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage investor appearing frequently in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  // Post-#36 unresolved backlog — institutional / CVC firms (reactivate or create).
  {
    canonicalName: 'Aker ASA', firm: 'Aker ASA', url: 'https://www.akerasa.com/',
    sectors: ['Industrial', 'Energy', 'Technology', 'Maritime'],
    stage: ['Growth', 'Venture'], geography: ['Nordics', 'Global'],
    thesis: 'Industrial holding company investing across energy, maritime, and technology platforms.',
    source: 'https://www.akerasa.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Morgan Stanley', firm: 'Morgan Stanley', url: 'https://www.morganstanley.com/',
    sectors: ['Fintech', 'Technology', 'Healthcare', 'Enterprise'],
    stage: ['Growth', 'Series B', 'Series C'], geography: ['Global'],
    thesis: 'Global investment bank and growth investor across technology and financial services.',
    source: 'https://www.morganstanley.com/', type: 'Corporate', investorType: 'Growth',
  },
  {
    canonicalName: 'Monashees', firm: 'Monashees', url: 'https://www.monashees.com/',
    sectors: ['AI/ML', 'SaaS', 'Fintech', 'Consumer', 'Marketplace'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['Latin America', 'Global'],
    thesis: 'Latin America–focused venture firm backing category-defining technology companies.',
    source: 'https://www.monashees.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Slauson & Co', firm: 'Slauson & Co', displayName: 'Slauson & Co.', url: 'https://www.slauson.co/',
    sectors: ['Consumer', 'Fintech', 'Marketplace', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['United States', 'Global'],
    thesis: 'Early-stage venture firm investing in founders building for overlooked communities and markets.',
    source: 'https://www.slauson.co/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Fireside Ventures', firm: 'Fireside Ventures', url: 'https://www.firesideventures.com/',
    sectors: ['Consumer', 'D2C', 'Healthcare', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['India', 'Global'],
    thesis: 'India-focused early-stage consumer and brand investor.',
    source: 'https://www.firesideventures.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Positive Sum', firm: 'Positive Sum', url: 'https://positivesum.vc/',
    sectors: ['Crypto', 'Fintech', 'AI/ML', 'Infrastructure'],
    stage: ['Seed', 'Series A'], geography: ['United States', 'Global'],
    thesis: 'Early-stage investor focused on crypto, fintech, and infrastructure platforms.',
    source: 'https://positivesum.vc/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Autodesk', firm: 'Autodesk', url: 'https://www.autodesk.com/',
    sectors: ['AI/ML', 'Design', 'Construction', 'Manufacturing', 'Software'],
    stage: ['Seed', 'Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Corporate strategic investor across design, construction, and manufacturing software ecosystems.',
    source: 'https://www.autodesk.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Greyhound Capital', firm: 'Greyhound Capital', displayName: 'Greyhound', url: 'https://www.greyhoundcap.com/',
    sectors: ['Consumer', 'Fintech', 'Marketplace', 'Technology'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global', 'Emerging Markets'],
    thesis: 'Growth investor backing consumer and fintech platforms in high-growth markets.',
    source: 'https://www.greyhoundcap.com/', type: 'VC', investorType: 'Growth',
  },
  {
    canonicalName: 'Group 11', firm: 'Group 11', url: 'https://www.group11.vc/',
    sectors: ['AI/ML', 'Enterprise', 'Cybersecurity', 'SaaS'],
    stage: ['Seed', 'Series A'], geography: ['Israel', 'United States', 'Global'],
    thesis: 'Early-stage venture firm backing enterprise and cybersecurity founders.',
    source: 'https://www.group11.vc/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: '2100 Ventures', firm: '2100 Ventures', url: 'https://2100.vc/',
    sectors: ['AI/ML', 'SaaS', 'Fintech', 'Technology'],
    stage: ['Pre-Seed', 'Seed'], geography: ['Europe', 'Global'],
    thesis: 'European pre-seed and seed investor backing technical founding teams.',
    source: 'https://2100.vc/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'EstBAN', firm: 'EstBAN', url: 'https://estban.ee/',
    sectors: ['Technology', 'SaaS', 'DeepTech'],
    stage: ['Pre-Seed', 'Seed'], geography: ['Estonia', 'Nordics', 'Europe'],
    thesis: 'Estonian business angel network co-investing in early-stage technology startups.',
    source: 'https://estban.ee/', type: 'Angel', investorType: 'Angel',
  },
  {
    canonicalName: "Wa'ed Ventures", firm: "Wa'ed Ventures", url: 'https://waed.net/',
    sectors: ['Technology', 'Energy', 'Industrial', 'SaaS'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['Saudi Arabia', 'MENA', 'Global'],
    thesis: 'Saudi Aramco’s corporate venture arm investing in energy and technology startups.',
    source: 'https://waed.net/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Goodbody Capital Partners', firm: 'Goodbody Capital Partners', url: null,
    sectors: ['Technology', 'Fintech', 'Healthcare'],
    stage: ['Seed', 'Series A', 'Growth'], geography: ['Europe', 'Global'],
    thesis: 'Investment firm appearing in post-prediction European funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Snowflake Ventures', firm: 'Snowflake Ventures', displayName: 'Snowflake Ventures', url: 'https://www.snowflake.com/',
    sectors: ['AI/ML', 'Data Infrastructure', 'Enterprise', 'SaaS'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['Global'],
    thesis: 'Corporate venture arm of Snowflake investing in data and AI ecosystem companies.',
    source: 'https://www.snowflake.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'BANNER VC', firm: 'BANNER VC', displayName: 'BANNER VC', url: null,
    sectors: ['AI/ML', 'SaaS', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage venture firm appearing frequently in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Icehouse Ventures', firm: 'Icehouse Ventures', url: 'https://www.icehouseventures.co.nz/',
    sectors: ['AI/ML', 'SaaS', 'DeepTech', 'Climate Tech'],
    stage: ['Seed', 'Series A'], geography: ['New Zealand', 'Australia', 'Global'],
    thesis: 'New Zealand early-stage venture firm backing ambitious technical founders.',
    source: 'https://www.icehouseventures.co.nz/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Glilot Capital', firm: 'Glilot Capital', url: 'https://www.glilotcapital.com/',
    sectors: ['Enterprise', 'Cybersecurity', 'AI/ML', 'SaaS'],
    stage: ['Seed', 'Series A'], geography: ['Israel', 'United States', 'Global'],
    thesis: 'Israel-focused early-stage venture firm investing in enterprise software and security.',
    source: 'https://www.glilotcapital.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Booz Allen Ventures', firm: 'Booz Allen Ventures', url: 'https://www.boozallen.com/',
    sectors: ['Defense', 'Cybersecurity', 'AI/ML', 'Government Tech'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['United States', 'Global'],
    thesis: 'Corporate venture arm investing in national-security and government-technology startups.',
    source: 'https://www.boozallen.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Washington Harbour Partners', firm: 'Washington Harbour Partners', url: 'https://www.washharbour.com/',
    sectors: ['Enterprise', 'Cybersecurity', 'Government Tech', 'SaaS'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['United States', 'Global'],
    thesis: 'Growth-oriented investor focused on enterprise and national-security technology.',
    source: 'https://www.washharbour.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Long-Z Investments', firm: 'Long-Z Investments', url: null,
    sectors: ['Technology', 'AI/ML', 'Consumer'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Investment firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Tesi', firm: 'Tesi', url: 'https://www.tesi.fi/',
    sectors: ['Technology', 'Industrial', 'Healthcare', 'Climate Tech'],
    stage: ['Seed', 'Series A', 'Growth'], geography: ['Finland', 'Nordics', 'Europe'],
    thesis: 'Finnish state-owned investment company backing growth and venture companies.',
    source: 'https://www.tesi.fi/', type: 'Corporate', investorType: 'Growth',
  },
  {
    canonicalName: '1789 Capital', firm: '1789 Capital', url: 'https://www.1789capital.com/',
    sectors: ['Technology', 'Defense', 'Energy', 'Fintech'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['United States', 'Global'],
    thesis: 'Venture firm investing in technology aligned with American industry and defense.',
    source: 'https://www.1789capital.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Bicycle Capital', firm: 'Bicycle Capital', url: null,
    sectors: ['Technology', 'Fintech', 'SaaS'],
    stage: ['Seed', 'Series A'], geography: ['Latin America', 'Global'],
    thesis: 'Early-stage investor appearing in Latin American post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Reign Ventures', firm: 'Reign Ventures', url: null,
    sectors: ['AI/ML', 'SaaS', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Enlightenment Capital', firm: 'Enlightenment Capital', url: 'https://www.enlightenment.capital/',
    sectors: ['Defense', 'Aerospace', 'Government Tech', 'Cybersecurity'],
    stage: ['Growth', 'Buyout'], geography: ['United States'],
    thesis: 'Private equity firm investing in aerospace, defense, and government technology.',
    source: 'https://www.enlightenment.capital/', type: 'PE', investorType: 'PE',
  },
  {
    canonicalName: 'Andreessen Horowitz', firm: 'Andreessen Horowitz', displayName: 'Andreessen Horowitz', url: 'https://a16z.com/',
    sectors: ['AI/ML', 'Crypto', 'SaaS', 'Consumer', 'Enterprise', 'Fintech'],
    stage: ['Seed', 'Series A', 'Series B', 'Growth'], geography: ['United States', 'Global'],
    thesis: 'Stage-agnostic venture firm backing software, crypto, and American dynamism companies.',
    source: 'https://a16z.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'SoftBank', firm: 'SoftBank', url: 'https://group.softbank/',
    sectors: ['AI/ML', 'Consumer', 'Fintech', 'Enterprise', 'DeepTech'],
    stage: ['Series B', 'Series C', 'Growth'], geography: ['Global'],
    thesis: 'Global technology investor across growth-stage software and consumer platforms.',
    source: 'https://group.softbank/', type: 'Corporate', investorType: 'Growth',
  },
  {
    canonicalName: 'SoftBank Vision Fund', firm: 'SoftBank Vision Fund', url: 'https://visionfund.softbank/',
    sectors: ['AI/ML', 'Consumer', 'Fintech', 'Enterprise'],
    stage: ['Series B', 'Series C', 'Growth'], geography: ['Global'],
    thesis: 'Large-scale growth fund investing in transformative technology companies worldwide.',
    source: 'https://visionfund.softbank/', type: 'Corporate', investorType: 'Growth',
  },
  {
    canonicalName: 'Susquehanna', firm: 'Susquehanna', url: 'https://sig.com/',
    sectors: ['Fintech', 'Crypto', 'Technology', 'AI/ML'],
    stage: ['Seed', 'Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Trading and investment firm with venture and growth strategies across technology.',
    source: 'https://sig.com/', type: 'Corporate', investorType: 'Corporate',
  },
  // Post-#37 unresolved institutional / CVC backlog
  {
    canonicalName: 'Visa', firm: 'Visa', url: 'https://www.visa.com/',
    sectors: ['Fintech', 'Payments', 'Enterprise'],
    stage: ['Seed', 'Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Corporate strategic investor across payments and fintech ecosystems.',
    source: 'https://www.visa.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Eli Lilly', firm: 'Eli Lilly', url: 'https://www.lilly.com/',
    sectors: ['Healthcare', 'Biotech', 'Life Sciences'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Corporate strategic investor in healthcare and life-sciences innovation.',
    source: 'https://www.lilly.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: "Ontario Teachers' Pension Plan", firm: "Ontario Teachers' Pension Plan", url: 'https://www.otpp.com/',
    sectors: ['Technology', 'Infrastructure', 'Healthcare', 'Fintech'],
    stage: ['Growth'], geography: ['Global', 'Canada'],
    thesis: 'Large Canadian pension plan investing in growth-stage technology and infrastructure.',
    source: 'https://www.otpp.com/', type: 'PE', investorType: 'Growth',
  },
  {
    canonicalName: 'Decathlon', firm: 'Decathlon', url: 'https://www.decathlon.com/',
    sectors: ['Consumer', 'Sports', 'Retail', 'Technology'],
    stage: ['Seed', 'Series A', 'Growth'], geography: ['Europe', 'Global'],
    thesis: 'Corporate strategic investor in sports, retail, and consumer technology.',
    source: 'https://www.decathlon.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Act III Holdings', firm: 'Act III Holdings', url: null,
    sectors: ['Technology', 'Media', 'Consumer'],
    stage: ['Seed', 'Series A', 'Growth'], geography: ['Global'],
    thesis: 'Investment holding appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Prysm Capital', firm: 'Prysm Capital', url: 'https://www.prysm.vc/',
    sectors: ['AI/ML', 'Enterprise', 'SaaS'],
    stage: ['Seed', 'Series A'], geography: ['United States', 'Global'],
    thesis: 'Early-stage venture firm investing in enterprise software and AI.',
    source: 'https://www.prysm.vc/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'TIAA Ventures', firm: 'TIAA Ventures', url: 'https://www.tiaa.org/',
    sectors: ['Fintech', 'Healthcare', 'Enterprise', 'Climate Tech'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['United States', 'Global'],
    thesis: 'Corporate venture arm investing in fintech, healthcare, and enterprise technology.',
    source: 'https://www.tiaa.org/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'CenterGate Capital', firm: 'CenterGate Capital', url: null,
    sectors: ['Technology', 'Enterprise', 'SaaS'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Growth investor appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'Growth',
  },
  {
    canonicalName: 'Diffusion', firm: 'Diffusion', displayName: 'Diffusion Capital', url: null,
    sectors: ['AI/ML', 'DeepTech', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Europe', 'Global'],
    thesis: 'Early-stage investor appearing in European post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Redseed', firm: 'Redseed', url: null,
    sectors: ['Technology', 'SaaS', 'Fintech'],
    stage: ['Pre-Seed', 'Seed'], geography: ['Global'],
    thesis: 'Early-stage investor appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Rhapsody Venture Partners', firm: 'Rhapsody Venture Partners', url: 'https://www.rhapsodyvp.com/',
    sectors: ['DeepTech', 'Industrial', 'Climate Tech', 'Materials'],
    stage: ['Seed', 'Series A'], geography: ['United States', 'Global'],
    thesis: 'Early-stage deep-tech investor focused on materials and industrial innovation.',
    source: 'https://www.rhapsodyvp.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Elefund', firm: 'Elefund', url: 'https://www.elefund.com/',
    sectors: ['AI/ML', 'DeepTech', 'Enterprise'],
    stage: ['Seed', 'Series A'], geography: ['Europe', 'Global'],
    thesis: 'European early-stage venture firm backing deep-tech and AI founders.',
    source: 'https://www.elefund.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'AI2 Incubator', firm: 'AI2 Incubator', url: 'https://www.ai2incubator.com/',
    sectors: ['AI/ML', 'DeepTech'],
    stage: ['Pre-Seed', 'Seed'], geography: ['United States'],
    thesis: 'AI2’s startup incubator investing in early-stage artificial intelligence companies.',
    source: 'https://www.ai2incubator.com/', type: 'Accelerator', investorType: 'Accelerator',
  },
  {
    canonicalName: 'EIT RawMaterials', firm: 'EIT RawMaterials', url: 'https://eitrawmaterials.eu/',
    sectors: ['Materials', 'Climate Tech', 'Industrial', 'DeepTech'],
    stage: ['Seed', 'Series A'], geography: ['Europe'],
    thesis: 'EU innovation community investing in raw-materials and circular-economy startups.',
    source: 'https://eitrawmaterials.eu/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Navitas Semiconductor', firm: 'Navitas Semiconductor', url: 'https://navitassemi.com/',
    sectors: ['Semiconductors', 'Energy', 'DeepTech'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Corporate strategic investor in power-semiconductor and energy platforms.',
    source: 'https://navitassemi.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Banc Sabadell', firm: 'Banc Sabadell', url: 'https://www.bancsabadell.com/',
    sectors: ['Fintech', 'Enterprise', 'Technology'],
    stage: ['Seed', 'Series A', 'Growth'], geography: ['Spain', 'Europe'],
    thesis: 'Spanish bank investing strategically in fintech and technology startups.',
    source: 'https://www.bancsabadell.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Seaya', firm: 'Seaya', displayName: 'Seaya Ventures', url: 'https://seaya.vc/',
    sectors: ['SaaS', 'Fintech', 'Climate Tech', 'Consumer'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['Spain', 'Europe', 'Latin America'],
    thesis: 'European venture firm backing technology companies across Southern Europe and LatAm.',
    source: 'https://seaya.vc/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'AT&T Ventures', firm: 'AT&T Ventures', url: 'https://www.att.com/',
    sectors: ['Telecom', 'Enterprise', 'AI/ML', 'Cybersecurity'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['United States', 'Global'],
    thesis: 'Corporate venture arm investing in telecom-adjacent technology startups.',
    source: 'https://www.att.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Evolution Equity Partners', firm: 'Evolution Equity Partners', url: 'https://www.evolutionequity.com/',
    sectors: ['Cybersecurity', 'Enterprise', 'AI/ML'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['United States', 'Europe', 'Global'],
    thesis: 'Growth investor focused on cybersecurity and enterprise software.',
    source: 'https://www.evolutionequity.com/', type: 'VC', investorType: 'Growth',
  },
  {
    canonicalName: 'Odyssée Venture', firm: 'Odyssée Venture', url: null,
    sectors: ['Technology', 'SaaS', 'Industrial'],
    stage: ['Seed', 'Series A'], geography: ['France', 'Europe'],
    thesis: 'French early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'TWG Global', firm: 'TWG Global', url: null,
    sectors: ['Technology', 'AI/ML', 'Enterprise'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Investment firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'Growth',
  },
  {
    canonicalName: 'TTGG Ventures', firm: 'TTGG Ventures', url: null,
    sectors: ['Technology', 'SaaS', 'AI/ML'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Pegasus Capital', firm: 'Pegasus Capital', url: null,
    sectors: ['Technology', 'Climate Tech', 'Energy'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Investment firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'Growth',
  },
  {
    canonicalName: 'Piemonte Next Fund', firm: 'Piemonte Next Fund', url: null,
    sectors: ['Technology', 'Industrial', 'DeepTech'],
    stage: ['Seed', 'Series A'], geography: ['Italy', 'Europe'],
    thesis: 'Regional Italian fund investing in technology and industrial innovation.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Play Fund', firm: 'Play Fund', url: null,
    sectors: ['Gaming', 'Consumer', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage fund investing in gaming and interactive entertainment.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Flathead Forge', firm: 'Flathead Forge', url: null,
    sectors: ['DeepTech', 'Defense', 'Industrial'],
    stage: ['Seed', 'Series A'], geography: ['United States'],
    thesis: 'Early-stage investor appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Shrem Group', firm: 'Shrem Group', url: null,
    sectors: ['Technology', 'Real Estate', 'Fintech'],
    stage: ['Seed', 'Series A', 'Growth'], geography: ['Global'],
    thesis: 'Investment group appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'SKF', firm: 'SKF', url: 'https://www.skf.com/',
    sectors: ['Industrial', 'Manufacturing', 'DeepTech'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Europe', 'Global'],
    thesis: 'Industrial corporate investor in manufacturing and engineering technology.',
    source: 'https://www.skf.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Ondas', firm: 'Ondas', url: 'https://www.ondas.com/',
    sectors: ['Industrial', 'Telecom', 'DeepTech'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Corporate strategic investor in industrial wireless and autonomy platforms.',
    source: 'https://www.ondas.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'PedalStart', firm: 'PedalStart', url: 'https://www.pedalstart.com/',
    sectors: ['Consumer', 'Fintech', 'SaaS', 'Marketplace'],
    stage: ['Pre-Seed', 'Seed'], geography: ['India', 'Global'],
    thesis: 'India-focused early-stage accelerator and venture investor.',
    source: 'https://www.pedalstart.com/', type: 'Accelerator', investorType: 'Accelerator',
  },
  {
    canonicalName: 'Circle Ventures', firm: 'Circle Ventures', url: null,
    sectors: ['Crypto', 'Fintech', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Crypto/fintech investment vehicle distinct from Circle Partners.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'XYZ Ventures', firm: 'XYZ Venture Capital', displayName: 'XYZ Ventures', url: 'https://www.xyz.vc/',
    sectors: ['AI/ML', 'SaaS', 'Consumer', 'Enterprise'],
    stage: ['Seed', 'Series A'], geography: ['United States', 'Global'],
    thesis: 'Early-stage venture firm (XYZ Venture Capital) backing technical founding teams.',
    source: 'https://www.xyz.vc/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Greenoaks Capital', firm: 'Greenoaks Capital', url: 'https://www.greenoaks.com/',
    sectors: ['Consumer', 'SaaS', 'Marketplace', 'Fintech'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Growth-oriented venture firm backing category-defining technology companies.',
    source: 'https://www.greenoaks.com/', type: 'VC', investorType: 'Growth',
  },
  {
    canonicalName: 'General Atlantic', firm: 'General Atlantic', url: 'https://www.generalatlantic.com/',
    sectors: ['Technology', 'Healthcare', 'Fintech', 'Consumer'],
    stage: ['Growth'], geography: ['Global'],
    thesis: 'Global growth equity firm investing in technology and related sectors.',
    source: 'https://www.generalatlantic.com/', type: 'PE', investorType: 'Growth',
  },
  {
    canonicalName: 'Mirae Asset', firm: 'Mirae Asset Financial Group', displayName: 'Mirae Asset Financial Group', url: 'https://www.miraeasset.com/',
    sectors: ['Fintech', 'Technology', 'Healthcare'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global', 'Asia'],
    thesis: 'Global financial group investing across technology and growth companies.',
    source: 'https://www.miraeasset.com/', type: 'Corporate', investorType: 'Growth',
  },
  {
    canonicalName: 'Bridgepoint', firm: 'Bridgepoint Development Capital', displayName: 'Bridgepoint Development Capital', url: 'https://www.bridgepoint.eu/',
    sectors: ['Technology', 'Healthcare', 'Business Services'],
    stage: ['Growth', 'Buyout'], geography: ['Europe', 'Global'],
    thesis: 'European mid-market private equity investor including technology platforms.',
    source: 'https://www.bridgepoint.eu/', type: 'PE', investorType: 'PE',
  },
  {
    canonicalName: 'Rainmatter Capital', firm: 'Rainmatter Capital', url: 'https://rainmatter.com/',
    sectors: ['Fintech', 'Climate Tech', 'Healthcare', 'Consumer'],
    stage: ['Seed', 'Series A'], geography: ['India', 'Global'],
    thesis: 'Zerodha’s early-stage investment arm backing fintech and India-first startups.',
    source: 'https://rainmatter.com/', type: 'VC', investorType: 'VC',
  },
  // Post-#38 unresolved firm + angel backlog
  {
    canonicalName: 'Casdin Capital', firm: 'Casdin Capital', url: 'https://www.casdincapital.com/',
    sectors: ['Healthcare', 'Biotech', 'Life Sciences'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['United States', 'Global'],
    thesis: 'Life-sciences specialist investor across biotech and healthcare technology.',
    source: 'https://www.casdincapital.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'CincyTech', firm: 'CincyTech', url: 'https://www.cincytechusa.com/',
    sectors: ['Healthcare', 'DeepTech', 'SaaS'],
    stage: ['Seed', 'Series A'], geography: ['United States'],
    thesis: 'Midwest early-stage investor backing technology and healthcare startups.',
    source: 'https://www.cincytechusa.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'FiBAN', firm: 'FiBAN', url: 'https://fiban.org/',
    sectors: ['Technology', 'SaaS', 'DeepTech'],
    stage: ['Pre-Seed', 'Seed'], geography: ['Finland', 'Nordics', 'Europe'],
    thesis: 'Finnish business angel network co-investing in early-stage startups.',
    source: 'https://fiban.org/', type: 'Angel', investorType: 'Angel',
  },
  {
    canonicalName: 'LatBAN', firm: 'LatBAN', url: null,
    sectors: ['Technology', 'SaaS'],
    stage: ['Pre-Seed', 'Seed'], geography: ['Latvia', 'Europe'],
    thesis: 'Latvian business angel network co-investing in early-stage startups.',
    source: null, type: 'Angel', investorType: 'Angel',
  },
  {
    canonicalName: 'BHP Ventures', firm: 'BHP Ventures', url: 'https://www.bhp.com/',
    sectors: ['Mining', 'Climate Tech', 'Industrial', 'DeepTech'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['Global'],
    thesis: 'Corporate venture arm of BHP investing in resources and industrial technology.',
    source: 'https://www.bhp.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Ring Capital', firm: 'Ring Capital', url: 'https://www.ringcap.com/',
    sectors: ['SaaS', 'Fintech', 'Climate Tech'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Europe', 'Global'],
    thesis: 'European growth investor backing software and impact-oriented companies.',
    source: 'https://www.ringcap.com/', type: 'VC', investorType: 'Growth',
  },
  {
    canonicalName: '468 Capital', firm: '468 Capital', url: 'https://www.468cap.com/',
    sectors: ['AI/ML', 'SaaS', 'DeepTech'],
    stage: ['Seed', 'Series A'], geography: ['Europe', 'Global'],
    thesis: 'European early-stage venture firm backing technical founding teams.',
    source: 'https://www.468cap.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Haatch', firm: 'Haatch', url: 'https://www.haatch.com/',
    sectors: ['SaaS', 'Fintech', 'Marketplace'],
    stage: ['Pre-Seed', 'Seed'], geography: ['United Kingdom', 'Europe'],
    thesis: 'UK early-stage investor and accelerator backing ambitious founders.',
    source: 'https://www.haatch.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Gilgamesh Ventures', firm: 'Gilgamesh Ventures', url: null,
    sectors: ['AI/ML', 'SaaS', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Brightmind Partners', firm: 'Brightmind Partners', url: null,
    sectors: ['AI/ML', 'SaaS', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'S Capital VC', firm: 'S Capital VC', url: null,
    sectors: ['AI/ML', 'SaaS', 'Enterprise'],
    stage: ['Seed', 'Series A'], geography: ['Israel', 'Global'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Noteus', firm: 'Noteus', url: null,
    sectors: ['Technology', 'SaaS'],
    stage: ['Seed', 'Series A'], geography: ['Europe', 'Global'],
    thesis: 'Early-stage investor appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'CityRock', firm: 'CityRock', url: null,
    sectors: ['Technology', 'Consumer', 'Marketplace'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage investor appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Litquidity Ventures', firm: 'Litquidity Ventures', url: null,
    sectors: ['Fintech', 'Crypto', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['United States', 'Global'],
    thesis: 'Early-stage investor appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Emblem', firm: 'Emblem', url: null,
    sectors: ['AI/ML', 'SaaS', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Europe', 'Global'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Unique Capital', firm: 'Unique Capital', url: null,
    sectors: ['Technology', 'SaaS', 'Fintech'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage investor appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Placeholder', firm: 'Placeholder', url: 'https://placeholder.vc/',
    sectors: ['Crypto', 'Fintech', 'Infrastructure'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Crypto-focused early-stage venture firm.',
    source: 'https://placeholder.vc/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Rubio Impact Ventures', firm: 'Rubio Impact Ventures', url: null,
    sectors: ['Climate Tech', 'Impact', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Europe', 'Global'],
    thesis: 'Impact-oriented early-stage venture firm.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Leaps by Bayer', firm: 'Leaps by Bayer', url: 'https://leaps.bayer.com/',
    sectors: ['Healthcare', 'Biotech', 'Agriculture', 'DeepTech'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Bayer’s impact investment unit backing breakthrough health and agriculture science.',
    source: 'https://leaps.bayer.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'TGC Capital', firm: 'TGC Capital', url: null,
    sectors: ['Technology', 'SaaS', 'Fintech'],
    stage: ['Seed', 'Series A'], geography: ['India', 'Global'],
    thesis: 'India-focused early-stage investor appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Forebright Concerto Capital', firm: 'Forebright Concerto Capital', url: null,
    sectors: ['Technology', 'Healthcare', 'Industrial'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Asia', 'Global'],
    thesis: 'Growth investor appearing in Asian post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'Growth',
  },
  {
    canonicalName: 'Collab+Currency', firm: 'Collab+Currency', url: 'https://www.collabcurrency.com/',
    sectors: ['Crypto', 'Consumer', 'Fintech'],
    stage: ['Seed', 'Series A'], geography: ['United States', 'Global'],
    thesis: 'Early-stage investor at the intersection of culture, crypto, and consumer.',
    source: 'https://www.collabcurrency.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'L1D', firm: 'L1D', url: null,
    sectors: ['Crypto', 'Fintech', 'Infrastructure'],
    stage: ['Seed', 'Series A'], geography: ['Europe', 'Global'],
    thesis: 'Crypto-focused early-stage investor appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Atlantic Bridge', firm: 'Atlantic Bridge', url: 'https://www.abven.com/',
    sectors: ['Enterprise', 'DeepTech', 'SaaS'],
    stage: ['Series A', 'Series B'], geography: ['Europe', 'United States', 'Global'],
    thesis: 'Transatlantic venture firm investing in enterprise and deep technology.',
    source: 'https://www.abven.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Northern Gritstone', firm: 'Northern Gritstone', url: 'https://northerngritstone.com/',
    sectors: ['DeepTech', 'University Spinouts', 'Healthcare'],
    stage: ['Seed', 'Series A'], geography: ['United Kingdom'],
    thesis: 'UK investor backing university spinouts and deep-tech companies in Northern England.',
    source: 'https://northerngritstone.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Linden Advisors', firm: 'Linden Advisors', url: null,
    sectors: ['Technology', 'Healthcare', 'Fintech'],
    stage: ['Growth'], geography: ['Global'],
    thesis: 'Investment advisor appearing in post-prediction funding ledgers.',
    source: null, type: 'PE', investorType: 'Growth',
  },
  {
    canonicalName: 'Varma', firm: 'Varma', url: 'https://www.varma.fi/',
    sectors: ['Technology', 'Healthcare', 'Industrial'],
    stage: ['Growth'], geography: ['Finland', 'Nordics', 'Europe'],
    thesis: 'Finnish pension insurer investing in growth-stage companies.',
    source: 'https://www.varma.fi/', type: 'Corporate', investorType: 'Growth',
  },
  {
    canonicalName: 'Valutia', firm: 'Valutia', url: null,
    sectors: ['Technology', 'Fintech'],
    stage: ['Seed', 'Series A'], geography: ['Europe', 'Global'],
    thesis: 'Early-stage investor appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Optiverder', firm: 'Optiverder', url: null,
    sectors: ['Technology', 'Fintech'],
    stage: ['Seed', 'Series A'], geography: ['Europe', 'Global'],
    thesis: 'Investment vehicle appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'RoboStrategy', firm: 'RoboStrategy', url: null,
    sectors: ['Robotics', 'AI/ML', 'DeepTech'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Robotics-focused investor appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Sunshine Lake', firm: 'Sunshine Lake', url: null,
    sectors: ['Technology', 'Healthcare'],
    stage: ['Seed', 'Series A', 'Growth'], geography: ['Global'],
    thesis: 'Investment firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'PC Rettig Impact & Co', firm: 'PC Rettig Impact & Co', url: null,
    sectors: ['Impact', 'Climate Tech', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Impact investment firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Dell Technologies Capital', firm: 'Dell Technologies Capital', url: 'https://www.delltechnologiescapital.com/',
    sectors: ['Enterprise', 'AI/ML', 'Infrastructure', 'SaaS'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['Global'],
    thesis: 'Corporate venture arm of Dell Technologies investing in enterprise infrastructure.',
    source: 'https://www.delltechnologiescapital.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Mirae Asset Venture Investments', firm: 'Mirae Asset Venture Investments', displayName: 'Mirae Asset Venture Investments', url: 'https://www.miraeasset.com/',
    sectors: ['Fintech', 'Technology', 'Healthcare'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global', 'Asia'],
    thesis: 'Venture investment arm of Mirae Asset Financial Group.',
    source: 'https://www.miraeasset.com/', type: 'Corporate', investorType: 'Growth',
  },
  {
    canonicalName: 'Bill Ackman', firm: 'Pershing Square', url: null,
    sectors: ['Technology', 'Consumer', 'Healthcare'],
    stage: ['Growth'], geography: ['United States', 'Global'],
    thesis: 'Public-markets investor occasionally participating in private rounds.',
    source: null, type: 'Angel', investorType: 'Angel', isIndividual: true,
  },
  {
    canonicalName: 'Satya Nadella', firm: 'Microsoft', url: null,
    sectors: ['AI/ML', 'Enterprise', 'Cloud'],
    stage: ['Seed', 'Series A', 'Growth'], geography: ['Global'],
    thesis: 'Individual strategic participant appearing in post-prediction funding ledgers.',
    source: null, type: 'Angel', investorType: 'Angel', isIndividual: true,
  },
  {
    canonicalName: 'Omri Casspi', firm: 'Omri Casspi', url: null,
    sectors: ['Technology', 'Consumer', 'Sports'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Angel investor appearing in post-prediction funding ledgers.',
    source: null, type: 'Angel', investorType: 'Angel', isIndividual: true,
  },
  {
    canonicalName: 'Winston Weinberg', firm: 'Winston Weinberg', url: null,
    sectors: ['AI/ML', 'Legal Tech', 'Enterprise'],
    stage: ['Seed', 'Series A'], geography: ['United States'],
    thesis: 'Angel investor appearing in post-prediction funding ledgers.',
    source: null, type: 'Angel', investorType: 'Angel', isIndividual: true,
  },
  {
    canonicalName: 'Jeff Wang', firm: 'Jeff Wang', url: null,
    sectors: ['Technology', 'AI/ML'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Angel investor appearing in post-prediction funding ledgers.',
    source: null, type: 'Angel', investorType: 'Angel', isIndividual: true,
  },
  // Sovereign wealth funds — keep country-associated brands (do not geo-delete).
  {
    canonicalName: 'GIC', firm: 'GIC', url: 'https://www.gic.com.sg/',
    sectors: ['Technology', 'Healthcare', 'Fintech', 'Infrastructure', 'Consumer'],
    stage: ['Series B', 'Series C', 'Growth'], geography: ['Global', 'Singapore', 'Asia'],
    thesis: 'Singapore sovereign wealth fund investing globally across private and public markets.',
    source: 'https://www.gic.com.sg/', type: 'VC', investorType: 'Growth',
  },
  {
    canonicalName: 'Temasek', firm: 'Temasek Holdings', displayName: 'Temasek', url: 'https://www.temasek.com.sg/',
    sectors: ['Technology', 'Healthcare', 'Fintech', 'Consumer', 'Infrastructure'],
    stage: ['Series B', 'Series C', 'Growth'], geography: ['Global', 'Singapore', 'Asia'],
    thesis: 'Singapore investment company investing globally across private and public markets.',
    source: 'https://www.temasek.com.sg/en/index', type: 'VC', investorType: 'Growth',
  },
  {
    canonicalName: 'Mubadala', firm: 'Mubadala', url: 'https://www.mubadala.com/',
    sectors: ['Technology', 'Healthcare', 'Energy', 'Infrastructure'],
    stage: ['Series B', 'Series C', 'Growth'], geography: ['Global', 'Middle East'],
    thesis: 'Abu Dhabi sovereign investor participating in late-stage technology and growth rounds.',
    source: 'https://www.mubadala.com/', type: 'VC', investorType: 'Growth',
  },
  // Post-#39 unresolved firm backlog (next Hit@5 unlock batch).
  {
    canonicalName: 'Harlem Capital', firm: 'Harlem Capital', url: 'https://www.harlem.capital/',
    sectors: ['SaaS', 'Fintech', 'Consumer', 'Healthcare'],
    stage: ['Pre-Seed', 'Seed', 'Series A'], geography: ['United States'],
    thesis: 'Early-stage venture firm investing in diverse founding teams.',
    source: 'https://www.harlem.capital/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Sixth Street Growth', firm: 'Sixth Street Growth', url: 'https://sixthstreet.com/',
    sectors: ['Technology', 'Healthcare', 'Fintech'],
    stage: ['Growth', 'Series B', 'Series C'], geography: ['Global'],
    thesis: 'Growth investment platform within Sixth Street.',
    source: 'https://sixthstreet.com/', type: 'Growth', investorType: 'Growth',
  },
  {
    canonicalName: 'Visible Hands VC', firm: 'Visible Hands', url: 'https://visiblehands.vc/',
    sectors: ['SaaS', 'Fintech', 'Consumer', 'Marketplace'],
    stage: ['Pre-Seed', 'Seed'], geography: ['United States'],
    thesis: 'Early-stage venture firm and accelerator for underrepresented founders.',
    source: 'https://visiblehands.vc/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Karman Ventures', firm: 'Karman Ventures', url: null,
    sectors: ['AI/ML', 'SaaS', 'DeepTech'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Active Impact Investments', firm: 'Active Impact Investments', url: 'https://activeimpact.com/',
    sectors: ['Climate Tech', 'CleanTech', 'Sustainability'],
    stage: ['Seed', 'Series A'], geography: ['Canada', 'Global'],
    thesis: 'Climate-focused early-stage venture firm.',
    source: 'https://activeimpact.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'PSG Equity', firm: 'PSG Equity', displayName: 'PSG', url: 'https://www.psgequity.com/',
    sectors: ['SaaS', 'Software', 'Enterprise'],
    stage: ['Growth', 'Series B', 'Series C'], geography: ['Global'],
    thesis: 'Growth equity firm focused on software and technology-enabled services.',
    source: 'https://www.psgequity.com/', type: 'PE', investorType: 'Growth',
  },
  {
    canonicalName: '360 Capital', firm: '360 Capital', url: 'https://www.360cap.vc/',
    sectors: ['AI/ML', 'SaaS', 'DeepTech', 'Fintech'],
    stage: ['Seed', 'Series A'], geography: ['Europe', 'Global'],
    thesis: 'European early-stage venture firm.',
    source: 'https://www.360cap.vc/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'CDP Venture Capital', firm: 'CDP Venture Capital', url: 'https://www.cdpventurecapital.it/',
    sectors: ['AI/ML', 'DeepTech', 'SaaS', 'Climate Tech'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['Italy', 'Europe'],
    thesis: 'Italian venture capital platform investing across technology stages.',
    source: 'https://www.cdpventurecapital.it/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'JobsOhio Ventures', firm: 'JobsOhio Ventures', url: 'https://www.jobsohio.com/',
    sectors: ['Technology', 'Manufacturing', 'Healthcare'],
    stage: ['Seed', 'Series A', 'Growth'], geography: ['United States'],
    thesis: 'Ohio economic-development venture investor.',
    source: 'https://www.jobsohio.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Concrete VC', firm: 'Concrete VC', url: null,
    sectors: ['PropTech', 'Fintech', 'SaaS'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Supernode Global', firm: 'Supernode Global', url: null,
    sectors: ['AI/ML', 'SaaS', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage investor appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Koro Capital', firm: 'Koro Capital', url: null,
    sectors: ['Technology', 'AI/ML'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Inovo', firm: 'Inovo', url: 'https://inovo.vc/',
    sectors: ['SaaS', 'AI/ML', 'Enterprise'],
    stage: ['Seed', 'Series A'], geography: ['Europe', 'CEE'],
    thesis: 'Central and Eastern Europe–focused early-stage venture firm.',
    source: 'https://inovo.vc/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Medtronic', firm: 'Medtronic', url: 'https://www.medtronic.com/',
    sectors: ['Healthcare', 'MedTech', 'AI/ML'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Corporate strategic investor in medtech and health technology.',
    source: 'https://www.medtronic.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Lululemon', firm: 'Lululemon', url: 'https://corporate.lululemon.com/',
    sectors: ['Consumer', 'Retail', 'Health'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Corporate strategic investor in consumer and wellness brands.',
    source: 'https://corporate.lululemon.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Fubon Financial Holding Venture Capital', firm: 'Fubon Financial Holding Venture Capital', url: null,
    sectors: ['Fintech', 'Technology', 'Healthcare'],
    stage: ['Seed', 'Series A', 'Growth'], geography: ['Asia', 'Global'],
    thesis: 'Corporate venture arm of Fubon Financial Holding.',
    source: null, type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: '50 Partners Health', firm: '50 Partners Health', url: 'https://www.50partners.fr/',
    sectors: ['Healthcare', 'HealthTech', 'AI/ML'],
    stage: ['Pre-Seed', 'Seed'], geography: ['France', 'Europe'],
    thesis: 'French accelerator and early-stage investor focused on health startups.',
    source: 'https://www.50partners.fr/', type: 'Accelerator', investorType: 'Accelerator',
  },
  {
    canonicalName: 'Galaxia', firm: 'Galaxia', url: null,
    sectors: ['AI/ML', 'DeepTech', 'Space'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage investor appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Tritemius', firm: 'Tritemius', url: null,
    sectors: ['Technology', 'AI/ML'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage investor appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Scaleup Fund', firm: 'Scaleup Fund', url: null,
    sectors: ['Technology', 'SaaS', 'Growth'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Europe', 'Global'],
    thesis: 'European scale-up investment vehicle appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'Growth',
  },
  // Post-#40 long-tail unresolved firms + angels
  {
    canonicalName: 'Alpha Fund', firm: 'Alpha Fund', url: null,
    sectors: ['Technology', 'AI/ML', 'SaaS'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage fund appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'ChunJia Capital', firm: 'ChunJia Capital', url: null,
    sectors: ['Technology', 'AI/ML', 'Consumer'],
    stage: ['Seed', 'Series A'], geography: ['Asia', 'Global'],
    thesis: 'Asia-focused early-stage venture firm.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Goldman Sachs', firm: 'Goldman Sachs', url: 'https://www.goldmansachs.com/',
    sectors: ['Fintech', 'Technology', 'Healthcare', 'Enterprise'],
    stage: ['Growth', 'Series B', 'Series C'], geography: ['Global'],
    thesis: 'Global investment bank and growth investor.',
    source: 'https://www.goldmansachs.com/', type: 'Corporate', investorType: 'Growth',
  },
  {
    canonicalName: 'Pegasus Finvest', firm: 'Pegasus Finvest', url: null,
    sectors: ['Fintech', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Investment firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'United Ventures', firm: 'United Ventures', url: 'https://www.unitedventures.it/',
    sectors: ['SaaS', 'Fintech', 'AI/ML'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['Europe', 'Italy'],
    thesis: 'Italian venture firm investing in digital and technology companies.',
    source: 'https://www.unitedventures.it/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'HongShan', firm: 'HongShan', url: 'https://www.hongshan.com/',
    sectors: ['AI/ML', 'Consumer', 'Enterprise', 'Healthcare'],
    stage: ['Seed', 'Series A', 'Series B', 'Growth'], geography: ['China', 'Asia', 'Global'],
    thesis: 'China-focused venture firm (formerly Sequoia China).',
    source: 'https://www.hongshan.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Truelink Capital', firm: 'Truelink Capital', url: null,
    sectors: ['Technology', 'Healthcare', 'Industrial'],
    stage: ['Growth'], geography: ['Global'],
    thesis: 'Growth investment firm appearing in post-prediction funding ledgers.',
    source: null, type: 'PE', investorType: 'Growth',
  },
  {
    canonicalName: 'Kinderhook', firm: 'Kinderhook Partners', displayName: 'Kinderhook', url: 'https://www.kinderhook.com/',
    sectors: ['Technology', 'Healthcare', 'Consumer'],
    stage: ['Growth'], geography: ['United States', 'Global'],
    thesis: 'Private equity firm investing in growth-stage companies.',
    source: 'https://www.kinderhook.com/', type: 'PE', investorType: 'PE',
  },
  {
    canonicalName: 'Citadel', firm: 'Citadel', url: 'https://www.citadel.com/',
    sectors: ['Fintech', 'Technology', 'AI/ML'],
    stage: ['Growth', 'Series B', 'Series C'], geography: ['Global'],
    thesis: 'Global investment firm participating in late-stage technology rounds.',
    source: 'https://www.citadel.com/', type: 'Corporate', investorType: 'Growth',
  },
  {
    canonicalName: 'Beyond Capital Ventures', firm: 'Beyond Capital Ventures', url: null,
    sectors: ['Technology', 'Impact', 'Fintech'],
    stage: ['Seed', 'Series A'], geography: ['Global', 'Emerging Markets'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'G1 Ventures', firm: 'G1 Ventures', url: null,
    sectors: ['SaaS', 'Fintech', 'AI/ML'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'GroundForce Capital', firm: 'GroundForce Capital', url: 'https://www.groundforce.capital/',
    sectors: ['Consumer', 'Retail', 'Food'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['United States'],
    thesis: 'Growth investor focused on consumer and retail brands.',
    source: 'https://www.groundforce.capital/', type: 'VC', investorType: 'Growth',
  },
  {
    canonicalName: 'BAM Elevate', firm: 'BAM Elevate', url: null,
    sectors: ['Technology', 'Enterprise', 'SaaS'],
    stage: ['Growth'], geography: ['Global'],
    thesis: 'Growth investment vehicle appearing in post-prediction funding ledgers.',
    source: null, type: 'Growth', investorType: 'Growth',
  },
  {
    canonicalName: 'Wise Equity', firm: 'Wise Equity', url: null,
    sectors: ['Technology', 'Industrial', 'Healthcare'],
    stage: ['Growth'], geography: ['Europe', 'Italy'],
    thesis: 'European private equity firm.',
    source: null, type: 'PE', investorType: 'PE',
  },
  {
    canonicalName: 'Dalus Capital', firm: 'Dalus Capital', url: 'https://www.daluscapital.com/',
    sectors: ['Fintech', 'SaaS', 'Marketplace'],
    stage: ['Seed', 'Series A'], geography: ['Latin America', 'Global'],
    thesis: 'Latin America–focused early-stage venture firm.',
    source: 'https://www.daluscapital.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Invest-NL', firm: 'Invest-NL', url: 'https://www.invest-nl.nl/',
    sectors: ['Climate Tech', 'DeepTech', 'Healthcare', 'Technology'],
    stage: ['Seed', 'Series A', 'Growth'], geography: ['Netherlands', 'Europe'],
    thesis: 'Dutch impact and innovation investor.',
    source: 'https://www.invest-nl.nl/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Aito Capital', firm: 'Aito Capital', url: null,
    sectors: ['Technology', 'AI/ML'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Inflexion', firm: 'Inflexion', url: 'https://www.inflexion.com/',
    sectors: ['Technology', 'Healthcare', 'Business Services'],
    stage: ['Growth', 'Buyout'], geography: ['Europe', 'United Kingdom'],
    thesis: 'European private equity firm.',
    source: 'https://www.inflexion.com/', type: 'PE', investorType: 'PE',
  },
  {
    canonicalName: '360 ONE', firm: '360 ONE', url: 'https://www.360.one/',
    sectors: ['Fintech', 'Technology', 'Wealth'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['India', 'Global'],
    thesis: 'India wealth and alternative asset platform investing in technology.',
    source: 'https://www.360.one/', type: 'Corporate', investorType: 'Growth',
  },
  {
    canonicalName: 'Nuveen', firm: 'Nuveen', url: 'https://www.nuveen.com/',
    sectors: ['Technology', 'Infrastructure', 'Healthcare'],
    stage: ['Growth'], geography: ['Global'],
    thesis: 'Global asset manager participating in private markets.',
    source: 'https://www.nuveen.com/', type: 'Corporate', investorType: 'Growth',
  },
  {
    canonicalName: 'Green Angel Ventures', firm: 'Green Angel Ventures', url: 'https://www.greenangelventures.com/',
    sectors: ['Climate Tech', 'CleanTech', 'Energy'],
    stage: ['Pre-Seed', 'Seed'], geography: ['United Kingdom', 'Europe'],
    thesis: 'UK angel network focused on climate and clean technology.',
    source: 'https://www.greenangelventures.com/', type: 'Angel', investorType: 'Angel',
  },
  {
    canonicalName: 'Nextech Invest', firm: 'Nextech Invest', url: 'https://www.nextechinvest.com/',
    sectors: ['Healthcare', 'Biotech', 'AI/ML'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Growth investor focused on oncology and healthcare technology.',
    source: 'https://www.nextechinvest.com/', type: 'VC', investorType: 'Growth',
  },
  {
    canonicalName: 'Kleiner Perkins', firm: 'Kleiner Perkins', url: 'https://www.kleinerperkins.com/',
    sectors: ['AI/ML', 'SaaS', 'Healthcare', 'Consumer', 'Climate Tech'],
    stage: ['Seed', 'Series A', 'Series B', 'Growth'], geography: ['United States', 'Global'],
    thesis: 'Stage-agnostic venture firm investing across technology and healthcare.',
    source: 'https://www.kleinerperkins.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Bessemer Venture Partners', firm: 'Bessemer Venture Partners', url: 'https://www.bvp.com/',
    sectors: ['SaaS', 'AI/ML', 'Fintech', 'Healthcare', 'Consumer'],
    stage: ['Seed', 'Series A', 'Series B', 'Growth'], geography: ['Global'],
    thesis: 'Global multi-stage venture firm.',
    source: 'https://www.bvp.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Bain Capital', firm: 'Bain Capital', url: 'https://www.baincapital.com/',
    sectors: ['Technology', 'Healthcare', 'Fintech', 'Industrial'],
    stage: ['Growth', 'Buyout', 'Series B', 'Series C'], geography: ['Global'],
    thesis: 'Global alternative investment firm including venture and growth strategies.',
    source: 'https://www.baincapital.com/', type: 'PE', investorType: 'PE',
  },
  {
    canonicalName: 'Hidden Capital', firm: 'Hidden Capital', url: null,
    sectors: ['Technology', 'AI/ML'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Longshore', firm: 'Longshore', url: null,
    sectors: ['Technology', 'SaaS'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage investor appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Tuya Smart', firm: 'Tuya Smart', url: 'https://www.tuya.com/',
    sectors: ['IoT', 'Consumer', 'AI/ML'],
    stage: ['Series A', 'Series B', 'Growth'], geography: ['Global', 'Asia'],
    thesis: 'Corporate strategic investor in IoT and connected-device ecosystems.',
    source: 'https://www.tuya.com/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Enlightened Hospitality Investments', firm: 'Enlightened Hospitality Investments', url: null,
    sectors: ['Consumer', 'Hospitality', 'Food'],
    stage: ['Growth'], geography: ['United States'],
    thesis: 'Hospitality-focused investment vehicle.',
    source: null, type: 'PE', investorType: 'Growth',
  },
  {
    canonicalName: 'Maverick Silicon', firm: 'Maverick Silicon', url: null,
    sectors: ['Semiconductor', 'AI/ML', 'DeepTech'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Semiconductor and deep-tech investor.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Sharrp Ventures', firm: 'Sharrp Ventures', url: null,
    sectors: ['Technology', 'Consumer'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Aqcelerator', firm: 'Aqcelerator', url: null,
    sectors: ['Technology', 'SaaS'],
    stage: ['Pre-Seed', 'Seed'], geography: ['Global'],
    thesis: 'Accelerator / early-stage investor appearing in post-prediction funding ledgers.',
    source: null, type: 'Accelerator', investorType: 'Accelerator',
  },
  {
    canonicalName: 'Found Capital', firm: 'Found Capital', url: null,
    sectors: ['Technology', 'SaaS'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'WTG Ventures', firm: 'WTG Ventures', url: null,
    sectors: ['Technology', 'AI/ML'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage venture firm appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Varsity', firm: 'Varsity', url: null,
    sectors: ['Technology', 'EdTech', 'SaaS'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Early-stage investor appearing in post-prediction funding ledgers.',
    source: null, type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Conviction Partners', firm: 'Conviction', displayName: 'Conviction Partners', url: 'https://conviction.com/',
    sectors: ['AI/ML', 'SaaS', 'Enterprise'],
    stage: ['Seed', 'Series A'], geography: ['United States', 'Global'],
    thesis: 'Early-stage AI-focused venture firm.',
    source: 'https://conviction.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Opera Tech Ventures', firm: 'Opera Tech Ventures', url: null,
    sectors: ['Fintech', 'AI/ML', 'Enterprise'],
    stage: ['Seed', 'Series A'], geography: ['Europe', 'Global'],
    thesis: 'Corporate venture arm associated with BNP Paribas.',
    source: null, type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Balderton Capital', firm: 'Balderton Capital', url: 'https://www.balderton.com/',
    sectors: ['SaaS', 'AI/ML', 'Fintech', 'Consumer'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['Europe', 'Global'],
    thesis: 'European early-stage venture firm.',
    source: 'https://www.balderton.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'Franklin Resources', firm: 'Franklin Resources', url: 'https://www.franklinresources.com/',
    sectors: ['Fintech', 'Technology', 'Healthcare'],
    stage: ['Growth'], geography: ['Global'],
    thesis: 'Global asset manager (Franklin Templeton) participating in private rounds.',
    source: 'https://www.franklinresources.com/', type: 'Corporate', investorType: 'Growth',
  },
  {
    canonicalName: 'Northzone', firm: 'Northzone', url: 'https://northzone.com/',
    sectors: ['SaaS', 'AI/ML', 'Fintech', 'Consumer'],
    stage: ['Seed', 'Series A', 'Series B'], geography: ['Europe', 'Global'],
    thesis: 'European multi-stage venture firm.',
    source: 'https://northzone.com/', type: 'VC', investorType: 'VC',
  },
  {
    canonicalName: 'European Innovation Council', firm: 'European Innovation Council', url: 'https://eic.ec.europa.eu/',
    sectors: ['DeepTech', 'Climate Tech', 'Healthcare', 'AI/ML'],
    stage: ['Seed', 'Series A'], geography: ['Europe'],
    thesis: 'EU innovation funding body investing in breakthrough technologies.',
    source: 'https://eic.ec.europa.eu/', type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Spain State Research Agency', firm: 'Spain State Research Agency', url: null,
    sectors: ['DeepTech', 'Science', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Spain', 'Europe'],
    thesis: 'Spanish public research funding agency appearing in funding ledgers.',
    source: null, type: 'Corporate', investorType: 'Corporate',
  },
  {
    canonicalName: 'Joe Lonsdale', firm: '8VC', url: null,
    sectors: ['AI/ML', 'Defense', 'Enterprise', 'Fintech'],
    stage: ['Seed', 'Series A'], geography: ['United States', 'Global'],
    thesis: 'Founder and investor participating in early-stage technology rounds.',
    source: null, type: 'Angel', investorType: 'Angel', isIndividual: true,
  },
  {
    canonicalName: 'Aaron Skonnard', firm: 'Aaron Skonnard', url: null,
    sectors: ['Enterprise', 'SaaS', 'EdTech'],
    stage: ['Seed', 'Series A'], geography: ['United States'],
    thesis: 'Angel investor appearing in post-prediction funding ledgers.',
    source: null, type: 'Angel', investorType: 'Angel', isIndividual: true,
  },
  {
    canonicalName: 'Ryan Anderson', firm: 'Ryan Anderson', url: null,
    sectors: ['Technology', 'SaaS'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Angel investor appearing in post-prediction funding ledgers.',
    source: null, type: 'Angel', investorType: 'Angel', isIndividual: true,
  },
  {
    canonicalName: 'Manu Lecomte', firm: 'Manu Lecomte', url: null,
    sectors: ['Technology', 'Consumer'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Angel investor appearing in post-prediction funding ledgers.',
    source: null, type: 'Angel', investorType: 'Angel', isIndividual: true,
  },
  {
    canonicalName: 'Georges Harik', firm: 'Georges Harik', url: null,
    sectors: ['AI/ML', 'Technology'],
    stage: ['Seed', 'Series A'], geography: ['Global'],
    thesis: 'Angel investor appearing in post-prediction funding ledgers.',
    source: null, type: 'Angel', investorType: 'Angel', isIndividual: true,
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
      const aPerson = Number(
        /\([^)]+\)/.test(String(a.name || ''))
        || /\bangel\b/i.test(String(a.type || ''))
        || a.is_individual === true,
      );
      const bPerson = Number(
        /\([^)]+\)/.test(String(b.name || ''))
        || /\bangel\b/i.test(String(b.type || ''))
        || b.is_individual === true,
      );
      if (aPerson !== bPerson) return aPerson - bPerson;
      // Prefer name===firm org rows over partner names sharing the firm field.
      const aOrg = Number(normalizeEntityName(a.name) === normalizeEntityName(a.firm));
      const bOrg = Number(normalizeEntityName(b.name) === normalizeEntityName(b.firm));
      if (bOrg !== aOrg) return bOrg - aOrg;
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
    const displayNormalized = normalizeEntityName(profile.displayName || profile.canonicalName);
    let investor = profile.existing[0] || null;
    const desiredName = profile.displayName || profile.canonicalName;
    // Prefer an existing row that already has the desired display name to avoid
    // unique-constraint renames (e.g. Iconiq → ICONIQ Capital when both exist).
    if (profile.existing?.length) {
      const exactDisplay = profile.existing.find(
        (row) => String(row.name || '').trim().toLowerCase() === String(desiredName).trim().toLowerCase(),
      );
      if (exactDisplay) investor = exactDisplay;
    }
    // Angels must never reuse a firm row matched only via firm-field alias
    // (e.g. Satya Nadella firm=Microsoft must not overwrite Microsoft).
    if (investor && profile.isIndividual === true) {
      const nameNorm = normalizeEntityName(investor.name);
      if (nameNorm !== displayNormalized && nameNorm !== profile.normalized) {
        investor = null;
      }
    } else if (investor) {
      // If the best candidate is still a partner/person row, create a dedicated firm profile.
      const nameNorm = normalizeEntityName(investor.name);
      const personLike = investor.is_individual === true
        || /\([^)]+\)/.test(String(investor.name || ''))
        || (nameNorm !== displayNormalized && nameNorm !== profile.normalized);
      if (personLike) investor = null;
    }
    if (!investor) {
      const insertName = desiredName;
      const { data, error } = await db.from('investors').insert({
        name: insertName,
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
        investor_score: 55,
        investor_tier: 'emerging',
        entity_gate: 'qualified',
        status: 'active',
        is_verified: true,
        is_individual: profile.isIndividual === true,
      }).select('id,name,firm').single();
      if (error) {
        // Name unique constraint: reuse the existing row instead of failing the batch.
        const msg = `${error.message || ''} ${error.details || ''} ${error.hint || ''}`;
        if (msg.includes('investors_name_unique') || error.code === '23505') {
          const { data: existingByName, error: lookupError } = await db.from('investors')
            .select('id,name,firm')
            .eq('name', insertName)
            .limit(1)
            .maybeSingle();
          if (lookupError) throw lookupError;
          if (!existingByName) {
            console.error(JSON.stringify({ stage: 'unique_lookup_miss', canonical: profile.canonicalName, insertName, error }));
            throw error;
          }
          investor = existingByName;
          const { error: activateError } = await db.from('investors').update({
            status: 'active',
            entity_gate: 'qualified',
            type: profile.type || 'VC',
            investor_type: profile.investorType || profile.type || 'VC',
            firm: profile.firm,
            url: profile.url || undefined,
            sectors: profile.sectors,
            stage: profile.stage,
            investment_thesis: profile.thesis,
            is_individual: profile.isIndividual === true,
            updated_at: new Date().toISOString(),
          }).eq('id', investor.id);
          if (activateError) throw activateError;
        } else {
          console.error(JSON.stringify({ stage: 'insert_error', canonical: profile.canonicalName, insertName, error }));
          throw error;
        }
      } else {
        investor = data;
      }
    } else {
      let nameToSet = investor.name;
      if (desiredName && desiredName !== investor.name) {
        const { data: nameClash, error: clashError } = await db.from('investors')
          .select('id')
          .eq('name', desiredName)
          .neq('id', investor.id)
          .limit(1)
          .maybeSingle();
        if (clashError) throw clashError;
        if (!nameClash) nameToSet = desiredName;
      }
      const { error: activateError } = await db.from('investors').update({
        name: nameToSet,
        status: 'active',
        entity_gate: 'qualified',
        type: profile.type || 'VC',
        investor_type: profile.investorType || profile.type || 'VC',
        firm: profile.firm,
        url: profile.url || undefined,
        sectors: profile.sectors,
        stage: profile.stage,
        investment_thesis: profile.thesis,
        is_individual: profile.isIndividual === true,
        updated_at: new Date().toISOString(),
      }).eq('id', investor.id);
      if (activateError) {
        console.error(JSON.stringify({ stage: 'update_error', canonical: profile.canonicalName, investor_id: investor.id, desiredName, nameToSet, activateError }));
        throw activateError;
      }
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
    results.push({
      canonical_name: profile.canonicalName,
      investor_id: investor.id,
      created: !profile.existing[0] || profile.existing[0].id !== investor.id,
    });
  }
  console.log(JSON.stringify({ mode: 'apply', results }, null, 2));
}

main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
