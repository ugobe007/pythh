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

const organizations = [
  ['Gradient Ventures', 'gradient.com', ['Gradient', 'Gradient Ventures']],
  ['Horizon', null, ['Horizon', 'Horizon Ventures']],
  ['Y Combinator', 'ycombinator.com', ['Y Combinator', 'YC']],
  ['Citius', null, ['Citius']],
  ['BTG Pactual', 'btgpactual.com', ['BTG Pactual']],
  ['GIC', 'gic.com.sg', ['GIC', "Singapore's GIC", "Singapore’s GIC"]],
  ['Temasek', 'temasek.com.sg', ['Temasek', 'Temasek Holdings', "Singapore's Temasek", "Singapore’s Temasek"]],
  ['Mubadala', 'mubadala.com', ['Mubadala', 'Mubadala Capital']],
  ['Monashees', 'monashees.com.br', ['Monashees']],
  ['Pacific Alliance Ventures', null, ['Pacific Alliance Ventures', 'PAV']],
  ['Portage', null, ['Portage', 'Portage Ventures']],
  ['Apollo Global Management', 'apollo.com', ['Apollo', 'Apollo Global Management']],
  ['Hamilton Lane', 'hamiltonlane.com', ['Hamilton Lane']],
  ['Broadhaven Ventures', null, ['Broadhaven', 'Broadhaven Ventures']],
  ['Etna Labs', 'etnalabs.co', ['Etna Labs', 'TheEtnaLabs', 'Etna', 'Etna Capital Management']],
  // Frequent Hit@5 candidate_generation_miss funders (firm aliases for resolution).
  ['Baillie Gifford', 'bailliegifford.com', ['Baillie Gifford']],
  ['Premji Invest', null, ['Premji Invest', 'PremjiInvest']],
  ['Microsoft', 'microsoft.com', ['Microsoft', 'Microsoft Corporation']],
  ['Nvidia', 'nvidia.com', ['Nvidia', 'NVIDIA', 'NVIDIA Ventures', 'Nvidia Ventures']],
  ['Uber', 'uber.com', ['Uber', 'Uber Technologies']],
  ['ICONIQ', 'iconiqcapital.com', ['ICONIQ', 'ICONIQ Capital', 'Iconiq', 'Iconiq Capital']],
  ['BoldCap', null, ['BoldCap', 'Bold Cap']],
  ['Sequoia Capital', 'sequoiacap.com', ['Sequoia', 'Sequoia Capital']],
  ['EQT', 'eqtgroup.com', ['EQT', 'EQT Ventures']],
  ['Thrive Capital', 'thrivecap.com', ['Thrive', 'Thrive Capital']],
  ['Lightspeed', 'lsvp.com', ['Lightspeed', 'Lightspeed Venture Partners']],
  ['WndrCo', 'wndrco.com', ['WndrCo']],
  ['Coatue', 'coatue.com', ['Coatue', 'Coatue Management']],
  ['Menlo Ventures', 'menlovc.com', ['Menlo Ventures', 'Menlo']],
  ['Insight Partners', 'insightpartners.com', ['Insight Partners', 'Insight']],
  ['Index Ventures', 'indexventures.com', ['Index Ventures', 'Index']],
  ['Khosla Ventures', 'khoslaventures.com', ['Khosla Ventures', 'Khosla']],
  ['Tencent', 'tencent.com', ['Tencent', 'Tencent Holdings']],
  ['Hummingbird', 'hummingbird.vc', ['Hummingbird', 'Hummingbird Ventures']],
  ['Cyberstarts', 'cyberstarts.com', ['Cyberstarts']],
  ['MarcyPen Capital Partners', null, ['MarcyPen Capital Partners', 'MarcyPen']],
  ['Lightrock', 'lightrock.com', ['Lightrock', 'Lightrock India']],
  ['Z47', 'z47.com', ['Z47', 'Matrix Partners India']],
  ['DN Capital', 'dncapital.com', ['DN Capital']],
  ['Advent International', 'adventinternational.com', ['Advent International', 'Advent']],
  ['Dabur Ventures', null, ['Dabur Ventures', 'Dabur']],
  ['Pitchdrive', 'pitchdrive.com', ['Pitchdrive']],
  ['OG Venture Partners', null, ['OG Venture Partners', 'OG Ventures']],
  ['XTX Markets', 'xtxmarkets.com', ['XTX Markets', 'XTX']],
  ['8090 Industries', null, ['8090 Industries', '8090']],
  // Post-#36 unresolved institutional backlog
  ['Aker ASA', 'akerasa.com', ['Aker ASA', 'Aker']],
  ['Morgan Stanley', 'morganstanley.com', ['Morgan Stanley']],
  ['Slauson & Co', 'slauson.co', ['Slauson & Co', 'Slauson', 'Slauson & Co.']],
  ['Fireside Ventures', 'firesideventures.com', ['Fireside Ventures', 'Fireside']],
  ['Positive Sum', 'positivesum.vc', ['Positive Sum']],
  ['Autodesk', 'autodesk.com', ['Autodesk']],
  ['Greyhound Capital', 'greyhoundcap.com', ['Greyhound Capital', 'Greyhound']],
  ['Group 11', 'group11.vc', ['Group 11', 'Group11']],
  ['2100 Ventures', '2100.vc', ['2100 Ventures']],
  ['EstBAN', 'estban.ee', ['EstBAN', 'Estonian Business Angels Network']],
  ["Wa'ed Ventures", 'waed.net', ["Wa'ed Ventures", 'Waed Ventures', "Wa’ed Ventures"]],
  ['Goodbody Capital Partners', null, ['Goodbody Capital Partners', 'Goodbody']],
  ['Snowflake Ventures', 'snowflake.com', ['Snowflake Ventures', 'Snowflake']],
  ['BANNER VC', null, ['BANNER VC', 'Banner VC', 'Banner Capital']],
  ['Icehouse Ventures', 'icehouseventures.co.nz', ['Icehouse Ventures', 'Icehouse']],
  ['Glilot Capital', 'glilotcapital.com', ['Glilot Capital', 'Glilot Capital Partners', 'Glilot']],
  ['Booz Allen Ventures', 'boozallen.com', ['Booz Allen Ventures', 'Booz Allen']],
  ['Washington Harbour Partners', 'washharbour.com', ['Washington Harbour Partners', 'Washington Harbor Partners']],
  ['Long-Z Investments', null, ['Long-Z Investments', 'Long Z Investments']],
  ['Tesi', 'tesi.fi', ['Tesi']],
  ['1789 Capital', '1789capital.com', ['1789 Capital']],
  ['Bicycle Capital', null, ['Bicycle Capital']],
  ['Reign Ventures', null, ['Reign Ventures']],
  ['Enlightenment Capital', 'enlightenment.capital', ['Enlightenment Capital']],
  ['Andreessen Horowitz', 'a16z.com', ['Andreessen Horowitz', 'a16z', 'AH Capital Management']],
  ['SoftBank', 'group.softbank', ['SoftBank', 'SoftBank Group']],
  ['SoftBank Vision Fund', 'visionfund.softbank', ['SoftBank Vision Fund', 'SoftBank Vision Fund 2']],
  ['Susquehanna', 'sig.com', ['Susquehanna', 'Susquehanna Crypto', 'SIG']],
  // Post-#37 unresolved institutional backlog
  ['Visa', 'visa.com', ['Visa', 'Visa Inc', 'Visa Inc.']],
  ['Eli Lilly', 'lilly.com', ['Eli Lilly', 'Lilly', 'Eli Lilly and Company']],
  ["Ontario Teachers' Pension Plan", 'otpp.com', ["Ontario Teachers' Pension Plan", 'OTPP', 'Ontario Teachers']],
  ['Decathlon', 'decathlon.com', ['Decathlon']],
  ['Act III Holdings', null, ['Act III Holdings', 'Act III']],
  ['Prysm Capital', 'prysm.vc', ['Prysm Capital', 'Prysm']],
  ['TIAA Ventures', 'tiaa.org', ['TIAA Ventures', 'TIAA']],
  ['CenterGate Capital', null, ['CenterGate Capital', 'CenterGate']],
  ['Diffusion', null, ['Diffusion', 'Diffusion Capital']],
  ['Redseed', null, ['Redseed']],
  ['Rhapsody Venture Partners', 'rhapsodyvp.com', ['Rhapsody Venture Partners', 'Rhapsody']],
  ['Elefund', 'elefund.com', ['Elefund']],
  ['AI2 Incubator', 'ai2incubator.com', ['AI2 Incubator', 'AI2']],
  ['EIT RawMaterials', 'eitrawmaterials.eu', ['EIT RawMaterials']],
  ['Navitas Semiconductor', 'navitassemi.com', ['Navitas Semiconductor', 'Navitas']],
  ['Banc Sabadell', 'bancsabadell.com', ['Banc Sabadell', 'Banco Sabadell', 'Sabadell']],
  ['Seaya', 'seaya.vc', ['Seaya', 'Seaya Ventures']],
  ['AT&T Ventures', 'att.com', ['AT&T Ventures', 'AT&T']],
  ['Evolution Equity Partners', 'evolutionequity.com', ['Evolution Equity Partners', 'Evolution Equity']],
  ['Odyssée Venture', null, ['Odyssée Venture', 'Odyssee Venture']],
  ['TWG Global', null, ['TWG Global', 'TWG']],
  ['TTGG Ventures', null, ['TTGG Ventures', 'TTGG']],
  ['Pegasus Capital', null, ['Pegasus Capital']],
  ['Piemonte Next Fund', null, ['Piemonte Next Fund']],
  ['Play Fund', null, ['Play Fund']],
  ['Flathead Forge', null, ['Flathead Forge']],
  ['Shrem Group', null, ['Shrem Group']],
  ['SKF', 'skf.com', ['SKF']],
  ['Ondas', 'ondas.com', ['Ondas']],
  ['PedalStart', 'pedalstart.com', ['PedalStart']],
  ['Circle Ventures', null, ['Circle Ventures']],
  ['XYZ Ventures', 'xyz.vc', ['XYZ Ventures', 'XYZ Venture Capital', 'XYZ']],
  ['Greenoaks Capital', 'greenoaks.com', ['Greenoaks Capital', 'Greenoaks']],
  ['General Atlantic', 'generalatlantic.com', ['General Atlantic']],
  ['Mirae Asset', 'miraeasset.com', ['Mirae Asset', 'Mirae', 'Mirae Asset Financial Group']],
  ['Bridgepoint', 'bridgepoint.eu', ['Bridgepoint', 'Bridgepoint Development Capital']],
  ['Rainmatter Capital', 'rainmatter.com', ['Rainmatter Capital', 'Rainmatter']],
  // Post-#38 unresolved firm + angel backlog
  ['Casdin Capital', 'casdincapital.com', ['Casdin Capital', 'Casdin']],
  ['CincyTech', 'cincytechusa.com', ['CincyTech']],
  ['FiBAN', 'fiban.org', ['FiBAN', 'Finnish Business Angels Network']],
  ['LatBAN', null, ['LatBAN']],
  ['BHP Ventures', 'bhp.com', ['BHP Ventures', 'BHP']],
  ['Ring Capital', 'ringcap.com', ['Ring Capital']],
  ['468 Capital', '468cap.com', ['468 Capital', '468']],
  ['Haatch', 'haatch.com', ['Haatch']],
  ['Gilgamesh Ventures', null, ['Gilgamesh Ventures', 'Gilgamesh']],
  ['Brightmind Partners', null, ['Brightmind Partners', 'Brightmind']],
  ['S Capital VC', null, ['S Capital VC', 'S Capital']],
  ['Noteus', null, ['Noteus']],
  ['CityRock', null, ['CityRock', 'City Rock']],
  ['Litquidity Ventures', null, ['Litquidity Ventures', 'Litquidity']],
  ['Emblem', null, ['Emblem']],
  ['Unique Capital', null, ['Unique Capital']],
  ['Placeholder', 'placeholder.vc', ['Placeholder']],
  ['Rubio Impact Ventures', null, ['Rubio Impact Ventures', 'Rubio']],
  ['Leaps by Bayer', 'leaps.bayer.com', ['Leaps by Bayer', 'Leaps']],
  ['TGC Capital', null, ['TGC Capital', 'TGC']],
  ['Forebright Concerto Capital', null, ['Forebright Concerto Capital', 'Forebright']],
  ['Collab+Currency', 'collabcurrency.com', ['Collab+Currency', 'Collab Currency']],
  ['L1D', null, ['L1D']],
  ['Atlantic Bridge', 'abven.com', ['Atlantic Bridge']],
  ['Northern Gritstone', 'northerngritstone.com', ['Northern Gritstone']],
  ['Linden Advisors', null, ['Linden Advisors']],
  ['Varma', 'varma.fi', ['Varma']],
  ['Valutia', null, ['Valutia']],
  ['Optiverder', null, ['Optiverder']],
  ['RoboStrategy', null, ['RoboStrategy']],
  ['Sunshine Lake', null, ['Sunshine Lake']],
  ['Dell Technologies Capital', 'delltechnologiescapital.com', ['Dell Technologies Capital', 'Dell', 'Dell Technologies']],
  ['Mirae Asset Venture Investments', 'miraeasset.com', ['Mirae Asset Venture Investments']],
  ['Bill Ackman', null, ['Bill Ackman']],
  ['Satya Nadella', null, ['Satya Nadella']],
  ['Omri Casspi', null, ['Omri Casspi']],
  ['Winston Weinberg', null, ['Winston Weinberg']],
  ['Jeff Wang', null, ['Jeff Wang']],
  // Post-#39 SWF protect + next unresolved firm backlog
  ['Harlem Capital', 'harlem.capital', ['Harlem Capital']],
  ['Sixth Street Growth', 'sixthstreet.com', ['Sixth Street Growth', 'Sixth Street']],
  ['Visible Hands VC', 'visiblehands.vc', ['Visible Hands VC', 'Visible Hands']],
  ['Karman Ventures', null, ['Karman Ventures', 'Karman']],
  ['Active Impact Investments', 'activeimpact.com', ['Active Impact Investments', 'Active Impact']],
  ['PSG Equity', 'psgequity.com', ['PSG Equity', 'PSG']],
  ['360 Capital', '360cap.vc', ['360 Capital']],
  ['CDP Venture Capital', 'cdpventurecapital.it', ['CDP Venture Capital', 'CDP']],
  ['JobsOhio Ventures', 'jobsohio.com', ['JobsOhio Ventures', 'JobsOhio']],
  ['Concrete VC', null, ['Concrete VC', 'Concrete']],
  ['Supernode Global', null, ['Supernode Global', 'Supernode']],
  ['Koro Capital', null, ['Koro Capital', 'Koro']],
  ['Inovo', 'inovo.vc', ['Inovo']],
  ['Medtronic', 'medtronic.com', ['Medtronic']],
  ['Lululemon', 'lululemon.com', ['Lululemon']],
  ['Fubon Financial Holding Venture Capital', null, ['Fubon Financial Holding Venture Capital', 'Fubon']],
  ['50 Partners Health', '50partners.fr', ['50 Partners Health', '50 Partners']],
  ['Galaxia', null, ['Galaxia']],
  ['Tritemius', null, ['Tritemius']],
  ['Scaleup Fund', null, ['Scaleup Fund', "EU's Scaleup Fund", "EU’s Scaleup Fund"]],
  // Post-#40 long-tail unresolved firms
  ['Alpha Fund', null, ['Alpha Fund']],
  ['ChunJia Capital', null, ['ChunJia Capital', 'Chunjia Capital']],
  ['Goldman Sachs', 'goldmansachs.com', ['Goldman Sachs', 'Goldman']],
  ['Pegasus Finvest', null, ['Pegasus Finvest']],
  ['United Ventures', 'unitedventures.it', ['United Ventures']],
  ['HongShan', 'hongshan.com', ['HongShan', 'Hongshan', 'Sequoia China']],
  ['Truelink Capital', null, ['Truelink Capital', 'Truelink']],
  ['Kinderhook', 'kinderhook.com', ['Kinderhook', 'Kinderhook Partners']],
  ['Citadel', 'citadel.com', ['Citadel', 'Citadel Securities']],
  ['Beyond Capital Ventures', null, ['Beyond Capital Ventures']],
  ['G1 Ventures', null, ['G1 Ventures']],
  ['GroundForce Capital', 'groundforce.capital', ['GroundForce Capital', 'GroundForce']],
  ['BAM Elevate', null, ['BAM Elevate']],
  ['Wise Equity', null, ['Wise Equity']],
  ['Dalus Capital', 'daluscapital.com', ['Dalus Capital', 'Dalus']],
  ['Invest-NL', 'invest-nl.nl', ['Invest-NL', 'Invest NL']],
  ['Aito Capital', null, ['Aito Capital']],
  ['Inflexion', 'inflexion.com', ['Inflexion', 'Inflexion Private Equity']],
  ['360 ONE', '360.one', ['360 ONE', '360 ONE Asset']],
  ['Nuveen', 'nuveen.com', ['Nuveen']],
  ['Green Angel Ventures', 'greenangelventures.com', ['Green Angel Ventures']],
  ['Nextech Invest', 'nextechinvest.com', ['Nextech Invest', 'Nextech']],
  ['Kleiner Perkins', 'kleinerperkins.com', ['Kleiner Perkins', 'Kleiner Perkins Caufield & Byers', 'KPCB']],
  ['Bessemer Venture Partners', 'bvp.com', ['Bessemer Venture Partners', 'Bessemer', 'Bessemer Venture Partners LP']],
  ['Bain Capital', 'baincapital.com', ['Bain Capital', 'Bain']],
  ['Hidden Capital', null, ['Hidden Capital']],
  ['Longshore', null, ['Longshore']],
  ['Tuya Smart', 'tuya.com', ['Tuya Smart', 'Tuya']],
  ['Enlightened Hospitality Investments', null, ['Enlightened Hospitality Investments']],
  ['Maverick Silicon', null, ['Maverick Silicon']],
  ['Sharrp Ventures', null, ['Sharrp Ventures']],
  ['Aqcelerator', null, ['Aqcelerator']],
  ['Found Capital', null, ['Found Capital']],
  ['WTG Ventures', null, ['WTG Ventures']],
  ['Varsity', null, ['Varsity']],
  ['Conviction Partners', 'conviction.com', ['Conviction Partners', 'Conviction']],
  ['Opera Tech Ventures', null, ['Opera Tech Ventures', "BNP Paribas' Opera Tech Ventures", "BNP Paribas’ Opera Tech Ventures"]],
  ['Balderton Capital', 'balderton.com', ['Balderton Capital', 'Balderton']],
  ['Franklin Resources', 'franklinresources.com', ['Franklin Resources', 'Franklin Templeton']],
  ['Northzone', 'northzone.com', ['Northzone']],
  ['European Innovation Council', 'eic.ec.europa.eu', ['European Innovation Council', 'EIC']],
  ['Spain State Research Agency', null, ["Spain's State Research Agency", "Spain’s State Research Agency", 'State Research Agency']],
  ['Joe Lonsdale', null, ['Joe Lonsdale']],
  ['Aaron Skonnard', null, ['Aaron Skonnard']],
  ['Ryan Anderson', null, ['Ryan Anderson']],
  ['Manu Lecomte', null, ['Manu Lecomte']],
  ['Georges Harik', null, ['Georges Harik']],
  // Post-#41 claim-rectify loose ends
  ['3one4 Capital', '3one4.com', ['3one4 Capital', '3one4']],
  ['450 Ventures', null, ['450 Ventures']],
  ['216 Capital', '216capital.com', ['216 Capital']],
  ['4impact Capital', null, ['4impact Capital', '4impact capital']],
  ['Pentathlon Ventures', null, ['Pentathlon Ventures', 'Pentathlon']],
  ['Ethereal Ventures', null, ['Ethereal Ventures']],
  ['Zoho', 'zoho.com', ['Zoho', 'Zoho Corporation']],
  ['CIBC Innovation Banking', 'cibc.com', ['CIBC Innovation Banking', 'CIBC']],
  ['KPS Capital', null, ['KPS Capital']],
  ['Bpifrance Amorçage Industriel', 'bpifrance.fr', ['Bpifrance Amorçage Industriel', 'Bpifrance']],
  ['MPCi', null, ['MPCi']],
  ['Unbound', null, ['Unbound']],
  ['Varrock', null, ['Varrock']],
  ['Coalesce', null, ['Coalesce']],
  ['Tayeh Capital', null, ['Tayeh Capital']],
  ['GordonMD Global Investments', null, ['GordonMD Global Investments', 'GordonMD Global Investments LP', 'GordonMD Global Investments® LP']],
  ['PC Rettig Impact & Co', null, ['PC Rettig Impact & Co', 'PC Rettig Impact', 'PC Rettig']],
];

// Reviewed from the read-only reference audit. Do not infer organization membership
// merely because a noisy investor row happens to contain the same firm text.
const reviewedMemberIds = new Set([
  '16be1301-e649-4fd4-b57a-047f6b528255', // Wen-Wen Lam / Gradient Ventures; 649 matches
  '6bfdd2c0-b583-4b0f-848d-d96d4655d049', // Gradient Ventures organization row
  '1725b4a5-ca22-452d-b96b-ce80a6fec6b8', // Michael Seibel / YC; verified, 1000 matches
  '5e2fc5ff-af06-4823-929c-5b78fc83ebec', // Y Combinator organization row
  '62799323-ce23-4c8c-b43d-fc9509e477ce', // GIC organization row (gic.com.sg)
  'b0180672-dce1-43cf-bcd5-c08d1c6801b6', // Temasek Holdings (temasek.com.sg)
  '027a42d1-bf63-4642-b366-4e8399a11bf8', // Mubadala
  '35e2664c-2c7e-4442-829c-4f53af872d1f', // Monashees organization row
  '1eb3c02a-d8e9-4495-91e8-07d669218f1b', // Portage Ventures; referenced by matches
  '65662c8c-410a-4357-b896-122422cc670a', // Apollo Global Management; referenced by matches
  // Frequent Hit@5 miss funders — firm rows only (reviewed).
  '4e58f118-67c3-40a6-936b-28c03423241a', // Baillie Gifford
  'c8a13763-caf9-4872-9b1c-f3c1f71fea82', // Premji Invest
  '2c3d282e-b994-406f-bc31-b302c287bb2b', // Microsoft
  '033d0b37-2721-4917-8887-b4414baa67ef', // Nvidia
  'a07fb4a8-c30c-4c2e-a127-af34f5e893e8', // Uber (corporate firm; not person angels)
  '246335d7-eb1e-43f6-b990-02c2258683cd', // ICONIQ Capital
  '53cf1206-3a24-4ada-90a8-32326e7dcd9f', // BoldCap
  // Duplicate firm rows that must share Insight Partners org for Hit@5 identity.
  '8ecacb33-103a-4b2f-9f99-dc6cee151c68', // Insight Partners (prediction-side profile)
  '82e4da34-7f6c-43af-af72-5ea6b5c1d160', // Insightpartners (outcome-side profile)
]);

async function allRows(table, select) {
  const rows = [];
  for (let offset = 0; offset < 50000; offset += 1000) {
    const { data, error } = await db.from(table).select(select).range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows;
}

async function main() {
  const [investors, participants] = await Promise.all([
    allRows('investors', 'id,name,firm,url'),
    allRows('funding_evidence_participants', 'id,investor_name_raw,investor_id,investor_organization_id'),
  ]);
  const plan = organizations.map(([canonicalName, websiteDomain, aliases]) => {
    const normalizedAliases = new Set(aliases.map(normalizeEntityName));
    const aliasCandidates = investors.filter(row =>
      [row.name, row.firm].some(value => normalizedAliases.has(normalizeEntityName(value)))
    );
    const members = aliasCandidates.filter(row => reviewedMemberIds.has(row.id));
    const evidenceParticipants = participants.filter(row =>
      normalizedAliases.has(normalizeEntityName(row.investor_name_raw))
    );
    const withheldCandidates = aliasCandidates.filter(row => !reviewedMemberIds.has(row.id));
    return { canonicalName, websiteDomain, aliases, members, withheldCandidates, evidenceParticipants };
  });

  if (!apply) {
    console.log(JSON.stringify({ mode: 'dry-run', organizations: plan.map(item => ({
      canonical_name: item.canonicalName,
      aliases: item.aliases,
      investor_rows_to_link: item.members.map(row => ({ id: row.id, name: row.name, firm: row.firm })),
      unreviewed_rows_withheld: item.withheldCandidates.map(row => ({ id: row.id, name: row.name, firm: row.firm })),
      evidence_participants_to_link: item.evidenceParticipants.map(row => ({ id: row.id, investor_name_raw: row.investor_name_raw })),
    })) }, null, 2));
    return;
  }

  const results = [];
  for (const item of plan) {
    const normalizedName = normalizeEntityName(item.canonicalName);
    const { data: organization, error: organizationError } = await db.from('investor_organizations').upsert({
      canonical_name: item.canonicalName,
      normalized_name: normalizedName,
      website_domain: item.websiteDomain,
      metadata: { source: 'audited_funding_evidence', reviewed: true },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'normalized_name' }).select('id').single();
    if (organizationError) throw organizationError;

    const aliasRows = [...new Map(item.aliases.map(alias => {
      const normalizedAlias = normalizeEntityName(alias);
      return [normalizedAlias, {
        organization_id: organization.id,
        alias,
        normalized_alias: normalizedAlias,
        source: 'audited_funding_evidence',
      }];
    })).values()];
    const { error: aliasError } = await db.from('investor_organization_aliases')
      .upsert(aliasRows, { onConflict: 'normalized_alias' });
    if (aliasError) throw aliasError;

    if (item.members.length) {
      const membershipRows = item.members.map(row => ({
        investor_id: row.id,
        organization_id: organization.id,
        resolution_method: 'exact_normalized_firm_alias',
        resolution_confidence: 1,
        reviewed_at: new Date().toISOString(),
        metadata: { preserved_historical_investor_row: true },
        updated_at: new Date().toISOString(),
      }));
      const { error: membershipError } = await db.from('investor_organization_memberships')
        .upsert(membershipRows, { onConflict: 'investor_id' });
      if (membershipError) throw membershipError;
    }

    if (item.evidenceParticipants.length) {
      const participantIds = item.evidenceParticipants.map(row => row.id);
      const { error: participantError } = await db.from('funding_evidence_participants')
        .update({ investor_organization_id: organization.id, updated_at: new Date().toISOString() })
        .in('id', participantIds);
      if (participantError) throw participantError;
    }
    results.push({ canonical_name: item.canonicalName, member_rows_linked: item.members.length, evidence_participants_linked: item.evidenceParticipants.length });
  }
  console.log(JSON.stringify({ mode: 'apply', results }, null, 2));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
