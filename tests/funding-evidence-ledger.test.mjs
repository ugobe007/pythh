import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequire } from 'node:module';
import ledger from '../server/lib/fundingEvidenceLedger.js';

const require = createRequire(import.meta.url);
const { buildInvestorHistoricalFeatures, scoreHistoricalFit, scoreRecentActivity } = require('../server/lib/investorHistoricalFeatures.js');
const { assessFundingSource } = require('../server/lib/fundingSourceTrust.js');
const { classifyNamedInvestorParticipation, extractExplicitParticipantMentions } = require('../server/lib/fundingParticipationOntology.js');

const {
  normalizeEntityName,
  stripInvestorHeadlineNoise,
  normalizeStartupName,
  normalizeRoundType,
  canonicalRoundKey,
  clusterCompatibleRoundEvents,
  groupSourceOutcomesByRoundCluster,
  resolveCanonicalEntity,
  resolveCanonicalStartup,
  isPlausibleStartupName,
  isPromotionSafeStartupName,
  isPredictionGradeStartupIdentity,
  isPlausibleInvestorEntityName,
  startupNameCandidates,
  participantNamesFromEvent,
  classifyFundingEvidence,
  startupNameFromFundingEvent,
  evaluateRecommendationSet,
  metricsForEvaluations,
} = ledger;

test('normalizes common investor firm suffixes for deterministic resolution', () => {
  assert.equal(normalizeEntityName('Acme Ventures, LLC'), 'acme llc');
  assert.equal(normalizeEntityName('Acme Capital Partners'), 'acme');
  // Weak remainders keep the corporate token (Founders Fund ≠ "founders")
  assert.equal(normalizeEntityName('Founders Fund'), 'founders fund');
});

test('strips RSS/headline publisher suffixes and possessive person prefixes', () => {
  assert.equal(stripInvestorHeadlineNoise('General Catalyst - Entrackr'), 'General Catalyst');
  assert.equal(stripInvestorHeadlineNoise('Accel - Capital Brief'), 'Accel');
  assert.equal(stripInvestorHeadlineNoise('Thrive Capital - marketscreener'), 'Thrive Capital');
  assert.equal(stripInvestorHeadlineNoise('Peter Thiel’s Founders Fund - Moneycontrol'), 'Founders Fund');
  assert.equal(stripInvestorHeadlineNoise('Peter Thiel\'s Founders Fund'), 'Founders Fund');
  // Hyphenated firm tokens without spaces must not strip
  assert.equal(stripInvestorHeadlineNoise('F-Prime'), 'F-Prime');
  assert.equal(stripInvestorHeadlineNoise('Long-Z Investments'), 'Long-Z Investments');
  // Generic remainder after possessive stays intact
  assert.equal(
    stripInvestorHeadlineNoise('Reddit co-founder Alexis Ohanian’s venture firm'),
    "Reddit co-founder Alexis Ohanian's venture firm",
  );
  assert.equal(stripInvestorHeadlineNoise('Figma’s CEO'), "Figma's CEO");
  assert.equal(stripInvestorHeadlineNoise('Shlomo Kramer’s Skinos Ventures'), 'Skinos Ventures');
  // Unicode whitespace + program / sub-vehicle suffixes
  assert.equal(stripInvestorHeadlineNoise('EQT\u202FVentures'), 'EQT Ventures');
  assert.equal(stripInvestorHeadlineNoise('Andreessen Horowitz Speedrun'), 'Andreessen Horowitz');
  assert.equal(stripInvestorHeadlineNoise('SoftBank Vision Fund 2'), 'SoftBank Vision Fund');
  assert.equal(stripInvestorHeadlineNoise('Susquehanna Crypto'), 'Susquehanna');
  assert.equal(stripInvestorHeadlineNoise('And a16z Scout Fund'), 'a16z');
  assert.equal(stripInvestorHeadlineNoise('Wa\u2019ed Ventures'), "Wa'ed Ventures");
  assert.equal(stripInvestorHeadlineNoise('Nvidia Corp'), 'Nvidia');
  assert.equal(stripInvestorHeadlineNoise('Visa Inc.'), 'Visa');
  assert.equal(stripInvestorHeadlineNoise('Rainmatter by Zerodha'), 'Rainmatter');
  assert.equal(stripInvestorHeadlineNoise('PedalStart To Expand - BW Disrupt'), 'PedalStart');
  // Keep ASA as part of the canonical name
  assert.equal(stripInvestorHeadlineNoise('Aker ASA'), 'Aker ASA');
  assert.equal(stripInvestorHeadlineNoise('India-based TGC Capital'), 'TGC Capital');
  assert.equal(stripInvestorHeadlineNoise('Susquehanna Asia VC - Mint'), 'Susquehanna Asia Venture Capital');
  assert.equal(stripInvestorHeadlineNoise('Leaps by Bayer'), 'Leaps by Bayer');
  assert.equal(stripInvestorHeadlineNoise('Rainmatter by Zerodha'), 'Rainmatter');
  assert.equal(stripInvestorHeadlineNoise('BSV Ventures joint by Beamline'), 'BSV Ventures');
  // Country possessives on sovereign wealth funds — keep the SWF, drop the country label.
  assert.equal(stripInvestorHeadlineNoise("Singapore's GIC"), 'GIC');
  assert.equal(stripInvestorHeadlineNoise('Singapore’s GIC'), 'GIC');
  assert.equal(stripInvestorHeadlineNoise("Singapore's Temasek"), 'Temasek');
  assert.equal(stripInvestorHeadlineNoise("Spain's State Research Agency"), 'State Research Agency');
  assert.equal(isPlausibleInvestorEntityName('Singapore'), false);
  assert.equal(isPlausibleInvestorEntityName('GIC'), true);
  assert.equal(isPlausibleInvestorEntityName('Temasek'), true);
  // Long-tail roster / legal / marketing debris
  assert.equal(stripInvestorHeadlineNoise('Franklin Resources Inc also participating'), 'Franklin Resources');
  assert.equal(stripInvestorHeadlineNoise('Northzone For AI-Native Private Social Platform'), 'Northzone');
  assert.equal(stripInvestorHeadlineNoise('Balderton & Others - BW Disrupt'), 'Balderton');
  assert.equal(stripInvestorHeadlineNoise('Bessemer Venture Partners LP'), 'Bessemer Venture Partners');
  assert.equal(stripInvestorHeadlineNoise('Kleiner Perkins Caufield & Byers'), 'Kleiner Perkins');
  assert.equal(stripInvestorHeadlineNoise('Sarah Guo of Conviction Partners'), 'Conviction Partners');
  assert.equal(stripInvestorHeadlineNoise("BNP Paribas' Opera Tech Ventures"), 'Opera Tech Ventures');
  assert.equal(isPlausibleInvestorEntityName('SAFE'), false);
  assert.equal(isPlausibleInvestorEntityName('Japan Government'), false);
  assert.equal(isPlausibleInvestorEntityName('GPUs'), false);
  assert.equal(stripInvestorHeadlineNoise('Monashees to Build an AI Investment Advisor'), 'Monashees');
  assert.equal(stripInvestorHeadlineNoise('Firms Including Mirae Asset'), 'Mirae Asset');
  assert.equal(stripInvestorHeadlineNoise('SCVC to fix gene therapy’s costly flaw'), 'SCVC');
  assert.equal(stripInvestorHeadlineNoise('Others'), '');
  assert.equal(stripInvestorHeadlineNoise('Ackman for AI identity defence'), 'Ackman');
  assert.equal(stripInvestorHeadlineNoise('Eclipse in October 2025'), 'Eclipse');
  assert.equal(stripInvestorHeadlineNoise('Greenoaks Capital - Entrackr'), 'Greenoaks Capital');
  assert.equal(isPlausibleInvestorEntityName('500 new users per day'), false);
  assert.equal(isPlausibleInvestorEntityName('Wayve said in a statement'), false);
  assert.equal(isPlausibleInvestorEntityName('Resiliency Initiative'), false);
});

test('resolves country-possessive sovereign wealth fund names', () => {
  const rows = [
    { id: 'gic', name: 'GIC', firm: 'GIC', is_individual: false },
    { id: 'tem', name: 'Temasek', firm: 'Temasek Holdings', is_individual: false },
  ];
  const gic = resolveCanonicalEntity(rows, "Singapore's GIC");
  assert.equal(gic.status, 'resolved');
  assert.equal(gic.row.id, 'gic');
  const tem = resolveCanonicalEntity(rows, "Singapore's Temasek");
  assert.equal(tem.status, 'resolved');
  assert.equal(tem.row.id, 'tem');
});

test('resolves geo-prefix and VC-abbreviation investor names', () => {
  const rows = [
    { id: 'tgc', name: 'TGC Capital', firm: 'TGC Capital', is_individual: false },
    { id: 'asia', name: 'Susquehanna Asia Venture Capital', firm: 'Susquehanna Asia Venture Capital', is_individual: false },
    { id: 'leaps', name: 'Leaps by Bayer', firm: 'Leaps by Bayer', is_individual: false },
  ];
  const geo = resolveCanonicalEntity(rows, 'India-based TGC Capital');
  assert.equal(geo.status, 'resolved');
  assert.equal(geo.row.id, 'tgc');

  const vc = resolveCanonicalEntity(rows, 'Susquehanna Asia VC - Mint');
  assert.equal(vc.status, 'resolved');
  assert.equal(vc.row.id, 'asia');

  const leaps = resolveCanonicalEntity(rows, 'Leaps by Bayer');
  assert.equal(leaps.status, 'resolved');
  assert.equal(leaps.row.id, 'leaps');
});

test('resolves corp-suffix and by-parent investor names', () => {
  const rows = [
    { id: 'nv', name: 'Nvidia', firm: 'Nvidia', is_individual: false },
    { id: 'rain', name: 'Rainmatter Capital', firm: 'Rainmatter Capital', is_individual: false },
    { id: 'pedal', name: 'PedalStart', firm: 'PedalStart', is_individual: false },
  ];
  const corp = resolveCanonicalEntity(rows, 'Nvidia Corp');
  assert.equal(corp.status, 'resolved');
  assert.equal(corp.row.id, 'nv');
  assert.match(corp.matchKind, /headline_cleaned_/);

  const byParent = resolveCanonicalEntity(rows, 'Rainmatter by Zerodha');
  assert.equal(byParent.status, 'resolved');
  assert.equal(byParent.row.id, 'rain');

  const pedal = resolveCanonicalEntity(rows, 'PedalStart To Expand - BW Disrupt');
  assert.equal(pedal.status, 'resolved');
  assert.equal(pedal.row.id, 'pedal');
});

test('resolves program-suffix and unicode-normalized investor names', () => {
  const rows = [
    { id: 'a16z', name: 'Andreessen Horowitz', firm: 'Andreessen Horowitz', is_individual: false },
    { id: 'sbvf', name: 'SoftBank Vision Fund', firm: 'SoftBank Vision Fund', is_individual: false },
    { id: 'susq', name: 'Susquehanna', firm: 'Susquehanna', is_individual: false },
    { id: 'eqt', name: 'EQT', firm: 'EQT', is_individual: false },
    { id: 'eqtv', name: 'EQT Ventures', firm: 'EQT', is_individual: false },
  ];
  const speedrun = resolveCanonicalEntity(rows, 'Andreessen Horowitz Speedrun');
  assert.equal(speedrun.status, 'resolved');
  assert.equal(speedrun.row.id, 'a16z');
  assert.match(speedrun.matchKind, /headline_cleaned_/);

  const vision = resolveCanonicalEntity(rows, 'SoftBank Vision Fund 2');
  assert.equal(vision.status, 'resolved');
  assert.equal(vision.row.id, 'sbvf');

  const crypto = resolveCanonicalEntity(rows, 'Susquehanna Crypto');
  assert.equal(crypto.status, 'resolved');
  assert.equal(crypto.row.id, 'susq');

  const nbsp = resolveCanonicalEntity(rows, 'EQT\u202FVentures');
  assert.equal(nbsp.status, 'resolved');
  assert.ok(['eqt', 'eqtv'].includes(nbsp.row.id));
});

test('resolves headline-glued investor names to firm profiles', () => {
  const rows = [
    { id: 'gc', name: 'General Catalyst', firm: 'General Catalyst', is_individual: false },
    { id: 'ff', name: 'Founders Fund', firm: 'Founders Fund', is_individual: false },
    { id: 'accel', name: 'Accel', firm: 'Accel', is_individual: false },
    { id: 'a16z', name: 'Andreessen Horowitz', firm: 'Andreessen Horowitz', is_individual: false },
  ];
  const gc = resolveCanonicalEntity(rows, 'General Catalyst - Entrackr');
  assert.equal(gc.status, 'resolved');
  assert.equal(gc.row.id, 'gc');
  assert.match(gc.matchKind, /headline_cleaned_/);

  const ff = resolveCanonicalEntity(rows, 'Peter Thiel’s Founders Fund - Moneycontrol');
  assert.equal(ff.status, 'resolved');
  assert.equal(ff.row.id, 'ff');

  const accel = resolveCanonicalEntity(rows, 'Accel - Capital Brief');
  assert.equal(accel.status, 'resolved');
  assert.equal(accel.row.id, 'accel');

  const a16z = resolveCanonicalEntity(rows, 'Andreessen Horowitz - Fintech Finance');
  assert.equal(a16z.status, 'resolved');
  assert.equal(a16z.row.id, 'a16z');
});

test('prefers exact canonical investor names and exposes normalization collisions', () => {
  const rows = [
    { id: '1', name: 'OpenAI', firm: 'OpenAI Startup Fund' },
    { id: '2', name: 'OpenAI Startup Fund', firm: 'OpenAI' },
    { id: '3', name: 'True Ventures', firm: 'True Ventures' },
  ];
  assert.equal(resolveCanonicalEntity(rows, 'True Ventures').row.id, '3');
  // OpenAI vs OpenAI Startup Fund: prefer the exact-name firm row.
  const openai = resolveCanonicalEntity(rows, 'OpenAI');
  assert.equal(openai.status, 'resolved');
  assert.equal(openai.row.id, '1');
  assert.equal(resolveCanonicalEntity([{ id: '1', name: 'VaynerFund' }], 'Vayner Fund').confidence, 0.92);
});

test('prefers firm profile over partner rows sharing the same firm field', () => {
  const rows = [
    { id: 'gc', name: 'General Catalyst', firm: 'General Catalyst', is_individual: false },
    { id: 'p1', name: 'Hemant Taneja (General Catalyst)', firm: 'General Catalyst', is_individual: true },
    { id: 'p2', name: 'Joel Cutler (General Catalyst)', firm: 'General Catalyst', is_individual: true },
    { id: 'ff', name: 'Founders Fund', firm: 'Founders Fund', is_individual: false },
    { id: 'pt', name: 'Peter Thiel', firm: 'Founders Fund', is_individual: false },
    { id: 'accel', name: 'Accel', firm: 'Accel', is_individual: false },
    { id: 'ap', name: 'Andrew Braccia (Accel)', firm: 'Accel', is_individual: true },
    { id: 'peak', name: 'Peak XV', firm: null, is_individual: false },
    { id: 'peak-p', name: 'Peak XV Partners', firm: 'Peak XV', is_individual: false },
    { id: 'wing', name: 'Wing Venture Capital', firm: 'Wing VC', is_individual: false },
    { id: 'wing-p', name: 'Zach DeWitt', firm: 'Wing VC', is_individual: false },
    { id: 'prosus', name: 'Prosus', firm: null, is_individual: false },
    { id: 'prosus-v', name: 'Prosus Ventures', firm: 'Prosus', is_individual: false },
  ];
  const gc = resolveCanonicalEntity(rows, 'General Catalyst');
  assert.equal(gc.status, 'resolved');
  assert.equal(gc.row.id, 'gc');
  assert.equal(gc.matchKind, 'exact_firm_preferred');
  const ff = resolveCanonicalEntity(rows, 'Founders Fund');
  assert.equal(ff.status, 'resolved');
  assert.equal(ff.row.id, 'ff');
  const accel = resolveCanonicalEntity(rows, 'Accel');
  assert.equal(accel.status, 'resolved');
  assert.equal(accel.row.id, 'accel');
  const peak = resolveCanonicalEntity(rows, 'Peak XV');
  assert.equal(peak.status, 'resolved');
  assert.equal(peak.row.id, 'peak');
  const wing = resolveCanonicalEntity(rows, 'Wing VC');
  assert.equal(wing.status, 'resolved');
  assert.equal(wing.row.id, 'wing');
  const prosus = resolveCanonicalEntity(rows, 'Prosus');
  assert.equal(prosus.status, 'resolved');
  assert.equal(prosus.row.id, 'prosus');
});

test('rejects generic funding stages masquerading as canonical investors', () => {
  assert.equal(isPlausibleInvestorEntityName('Seed'), false);
  assert.equal(isPlausibleInvestorEntityName('Series A'), false);
  assert.equal(isPlausibleInvestorEntityName('Investing'), false);
  assert.equal(isPlausibleInvestorEntityName('Sound Ventures'), true);
  assert.equal(isPlausibleInvestorEntityName('a16z'), true);
  assert.equal(isPlausibleInvestorEntityName('EU-Startups reports'), false);
  assert.equal(isPlausibleInvestorEntityName('Wellness Into AI In-Person Service Economy'), false);
  assert.equal(isPlausibleInvestorEntityName('Z Venture Capital in Japan'), false);
  assert.equal(isPlausibleInvestorEntityName('TechCrunch has exclusively learned'), false);
  assert.equal(isPlausibleInvestorEntityName('Statistics - IndexBox'), false);
  assert.equal(isPlausibleInvestorEntityName('QED For AI Assistant'), false);
  assert.equal(isPlausibleInvestorEntityName('King co-founders Sebastian Knutsson'), false);
  assert.equal(isPlausibleInvestorEntityName('Growth Equity'), false);
  assert.equal(isPlausibleInvestorEntityName('Uber contingent on deploying robotaxis'), false);
  assert.equal(isPlausibleInvestorEntityName('Fortune learned exclusively'), false);
});

test('builds stable candidate round keys without collapsing distinct months or amounts', () => {
  assert.equal(normalizeRoundType('Series A financing'), 'series-a');
  const base = { startupId: 'startup-1', roundType: 'Series A', amountUsd: 30000000 };
  assert.equal(canonicalRoundKey({ ...base, announcedAt: '2026-05-22' }), 'id:startup-1|series-a|30000000|2026-05');
  assert.notEqual(canonicalRoundKey({ ...base, announcedAt: '2026-06-01' }), canonicalRoundKey({ ...base, announcedAt: '2026-05-22' }));
});

test('normalizes startup aliases without stripping meaningful investor-like words', () => {
  assert.equal(normalizeStartupName('Acme Capital, Inc.'), 'acme capital');
  assert.deepEqual(startupNameCandidates({ source_title: 'Defense tech Hadrian raises $100M', subject: 'Hadrian' }, 'Hadrian'), ['Hadrian']);
  assert.equal(isPlausibleStartupName('Gradient Labs'), true);
  assert.equal(isPlausibleStartupName('New Study'), false);
  assert.equal(isPlausibleStartupName('Startup'), false);
  assert.equal(isPromotionSafeStartupName('Edtech platform'), false);
  assert.equal(isPromotionSafeStartupName('Sam Altman’s biometric startup World'), false);
  assert.equal(isPromotionSafeStartupName('Sam Altman-backed World Network'), false);
  assert.equal(isPromotionSafeStartupName('Four former DOGE staffers'), false);
  assert.equal(isPromotionSafeStartupName('Lazada founder'), false);
  assert.equal(isPromotionSafeStartupName('Corgi reportedly'), false);
  assert.equal(isPromotionSafeStartupName('Ex-DeepMind researchers'), false);
  assert.equal(isPromotionSafeStartupName('Sources'), false);
  assert.equal(isPromotionSafeStartupName('STAT+'), false);
  assert.equal(isPromotionSafeStartupName('World Foundation'), true);
  assert.equal(isPlausibleStartupName('This startup used to raise $10 million'), false);
});

test('resolves canonical startups conservatively and exposes collisions', () => {
  const rows = [
    { id: '1', name: 'Passionfroot', extracted_data: { aliases: ['Passion Froot'] } },
    { id: '2', name: 'Enigma', extracted_data: {} },
    { id: '3', name: 'Enigma', extracted_data: {} },
  ];
  assert.deepEqual(resolveCanonicalStartup(rows, 'Passionfroot'), {
    row: rows[0], status: 'resolved', confidence: 1, matchKind: 'exact_name',
  });
  assert.equal(resolveCanonicalStartup(rows, 'Passion Froot').matchKind, 'exact_alias');
  assert.equal(resolveCanonicalStartup(rows, 'Enigma').status, 'ambiguous');
  assert.equal(resolveCanonicalStartup(rows, 'Insurance startup reportedly').status, 'unresolved');
});

test('prediction-grade startup identity requires a coherent first-party domain and company description', () => {
  assert.equal(isPredictionGradeStartupIdentity({
    name: 'Cheiron', source_type: 'url', website: 'https://cheiron.com',
    description: 'Cheiron has raised $8 million to develop its operating system.',
  }), true);
  assert.equal(isPredictionGradeStartupIdentity({
    name: 'QuickFlips', source_type: 'url', company_domain: 'quickflips.app',
    description: 'QuickFlips, a platform for collectors, has paid customers over $5 million.',
  }), false);
  assert.equal(isPredictionGradeStartupIdentity({
    name: 'Kanurra', source_type: 'url', company_domain: 'kanurra.com',
    description: 'Kanurra, a pharmacy benefit platform, is raising $6.35 million to build its product.',
  }), true);
  assert.equal(isPredictionGradeStartupIdentity({
    name: 'Trind VC', source_type: 'url', website: 'https://trindvc.com',
    description: 'Trind VC led the round in Ringy.',
  }), false);
  assert.equal(isPredictionGradeStartupIdentity({
    name: 'Start Firing', source_type: 'url', website: 'https://saastr.com/start-firing',
    description: 'Our agents are about to start firing vendors.',
  }), false);
  assert.equal(isPredictionGradeStartupIdentity({
    name: 'Ashton', source_type: 'url', website: 'https://ashton.com',
    description: 'Caleb Ashton is the owner and founder of QuickFlips.',
  }), false);
  assert.equal(isPredictionGradeStartupIdentity({
    name: 'AvePoint', source_type: 'url', website: 'https://avepoint.com',
    description: 'AvePoint announced record ARR after its Nasdaq listing.',
  }), false);
  assert.equal(isPredictionGradeStartupIdentity({
    name: 'First Advantage', source_type: 'url', website: 'https://firstadvantage.com',
    description: 'First Advantage raised its full-year 2026 outlook after record second-quarter results.',
  }), false);
  assert.equal(isPredictionGradeStartupIdentity({
    name: 'Apollo', source_type: 'url', website: 'https://apollo.io', description: 'Apollo offers B2B solutions.',
  }), false);
  assert.equal(isPredictionGradeStartupIdentity({
    name: 'Gray', source_type: 'url', website: 'https://gray.com',
    description: 'Ropes & Gray announced that a new partner joined the firm.',
  }), false);
  assert.equal(isPredictionGradeStartupIdentity({
    name: 'HCLTech', source_type: 'url', website: 'https://hcltech.com',
    description: 'HCLTech announced it signed a definitive agreement to acquire Finergic.',
  }), false);
  assert.equal(isPredictionGradeStartupIdentity({
    name: 'NextSlide', source_type: 'url', website: 'https://nextslide.ai',
    description: 'OpenAI has acquired NextSlide, a startup that develops presentations.',
  }), false);
  assert.equal(isPredictionGradeStartupIdentity({
    name: 'Ulrich', source_type: 'url', website: 'https://ulrich.ai',
    description: "Greg Ulrich, the company's chief AI officer, discussed payment fraud.",
  }), false);
  assert.equal(isPredictionGradeStartupIdentity({
    name: 'Imagion Biosystems', source_type: 'url', website: 'https://imagionbiosystems.com',
    description: 'Imagion Biosystems announced firm commitments for a capital raise after FDA clearance.',
  }), false);
  assert.equal(isPredictionGradeStartupIdentity({
    name: 'Orange Juice', source_type: 'url', website: 'https://orangejuice.com',
    description: 'Orange Juice raised $40 million to launch a permanent capital company.',
  }), false);
});

test('serve-grade identity allows pre-raise startups with URL↔name alignment', () => {
  const { isServeGradeStartupIdentity } = ledger;
  assert.equal(isServeGradeStartupIdentity({
    name: 'Acme Robotics',
    source_type: 'url',
    website: 'https://acmerobotics.com',
    description: 'Acme Robotics builds autonomous warehouse robots for mid-market logistics teams worldwide.',
  }), true);
  assert.equal(isServeGradeStartupIdentity({
    name: 'Acme Robotics',
    source_type: 'url',
    website: 'https://acmerobotics.com',
    description: 'short',
  }), false);
  assert.equal(isServeGradeStartupIdentity({
    name: 'Acme Robotics',
    source_type: 'url',
    website: 'https://totallyunrelated.io',
    description: 'Acme Robotics builds autonomous warehouse robots for mid-market logistics teams worldwide.',
  }), false);
});

test('reverses directional investment headlines into investor and funded company', () => {
  const event = { source_title: 'HongShan invests in ZXMOTO as Chinese motorcycle maker expands' };
  assert.equal(startupNameFromFundingEvent(event), 'ZXMOTO');
  assert.equal(startupNameCandidates(event, 'in')[0], 'ZXMOTO');
  assert.deepEqual(participantNamesFromEvent(event), ['HongShan']);
});

test('strips article descriptors from funded-company identities', () => {
  assert.equal(startupNameFromFundingEvent({ source_title: 'Diplo invests in Seattle startup Copper' }), 'Copper');
  assert.equal(startupNameFromFundingEvent({ source_title: 'Sam Altman-backed World Network raises $52.5M' }), 'World Network');
  assert.equal(startupNameFromFundingEvent({ source_title: 'New Unicorn! Humanoid secures $133M' }), 'Humanoid');
  assert.equal(startupNameFromFundingEvent({ source_title: 'Zürich-based Immitra Bio raises €2.58M' }), 'Immitra Bio');
  assert.equal(startupNameFromFundingEvent({ source_title: 'Insurance startup Corgi reportedly raised more money' }), 'Corgi');
  assert.equal(startupNameFromFundingEvent({ source_title: 'Kinderhook invests in aerospace components maker American Aero' }), 'American Aero');
  assert.equal(startupNameFromFundingEvent({ source_title: 'Lumin Digital raises $115M to further invest in product innovation' }), 'Lumin Digital');
  assert.equal(startupNameFromFundingEvent({ source_title: 'Citadel Securities invests $400M in Crypto.com at a $20B valuation' }), 'Crypto.com');
  assert.equal(startupNameFromFundingEvent({ source_title: 'STAT+: Cadence raises $100 million for regulated AI care' }), 'Cadence');
  assert.equal(startupNameFromFundingEvent({ source_title: 'Sources: APEC, a derivatives exchange, raised $30M' }), 'APEC');
  assert.equal(startupNameFromFundingEvent({ source_title: 'Ex-DeepMind researchers raise $50m for AI science startup Inherent' }), 'Inherent');
  assert.equal(startupNameFromFundingEvent({ source_title: 'Tether invests $50M in sleep technology startup Eight Sleep' }), 'Eight Sleep');
  assert.deepEqual(startupNameCandidates({ source_title: 'Diplo invests in Seattle startup Copper', subject: 'Diplo' }, 'Diplo'), ['Copper']);
});

test('uses the immediate investor subject in directional headlines', () => {
  const event = { source_title: 'Two female-led UK FinTechs join forces as Cashflows invests in Blackpool’s Tap & Go' };
  assert.deepEqual(participantNamesFromEvent(event), ['Cashflows']);
});

test('recovers the company before raises instead of accepting a currency subject', () => {
  assert.equal(startupNameFromFundingEvent({ source_title: 'ideaForge raises Rs 500 Cr via QIP', subject: 'Rs' }), 'ideaForge');
  assert.equal(startupNameFromFundingEvent({ source_title: 'Rs raises expectations', subject: 'Rs' }), null);
});

test('extracts and deduplicates funding participants from scraper evidence', () => {
  const names = participantNamesFromEvent({
    entities: [
      { role: 'SUBJECT', name: 'Startup One' },
      { role: 'COUNTERPARTY', name: 'Acme Ventures' },
    ],
    semantic_context: { resolver: { lead_investor: 'Acme Ventures', investors: ['Beta Capital'] } },
  });
  assert.deepEqual(names, ['Acme Ventures', 'Beta Capital']);
});

test('keeps ampersands inside firm names and rejects location-like participants', () => {
  const mentions = extractExplicitParticipantMentions('The round was led by Plug & Play, with participation from Netherlands and Australia.');
  assert.deepEqual(mentions.map(row => row.investorNameRaw), ['Plug & Play']);
});

test('extracts only locally proven participants from funding-from headlines', () => {
  const mentions = extractExplicitParticipantMentions('Level99 secures an additional $50 million from Act III Holdings, bringing its growth equity commitment to $100 million.');
  assert.deepEqual(mentions.map(row => [row.investorNameRaw, row.relation]), [['Act III Holdings', 'INVESTED_IN']]);
  assert.deepEqual(extractExplicitParticipantMentions('Street Group secures Hg investment at a valuation of $250 million.')
    .map(row => [row.investorNameRaw, row.relation]), [['Hg', 'INVESTED_IN']]);
  assert.equal(classifyNamedInvestorParticipation('Level99 secures $50 million from Act III Holdings.', 'Act III Holdings').relation, 'INVESTED_IN');
  assert.deepEqual(extractExplicitParticipantMentions('Helsing raises $1.8B from Dragoneer and Lightspeed to scale defence.')
    .map(row => row.investorNameRaw), ['Dragoneer', 'Lightspeed']);
});

test('rejects unsafe or non-financing scraper classifications and separates debt', () => {
  const base = { event_type: 'FUNDING', frame_confidence: 0.9, extraction_meta: { decision: 'ACCEPT', graph_safe: true } };
  assert.deepEqual(classifyFundingEvidence({ ...base, source_title: 'Acme wins an order for 50 aircraft' }), {
    eligible: false, reason: 'non_financing_headline', financingType: 'unknown',
  });
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme receives three industry recognitions' }).eligible, false);
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Roku raises streaming device prices by 60 percent' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'GCM raises $1.2 billion for inaugural credit secondaries fund' }).reason, 'outside_venture_outcome_scope');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme secures 31,826 orders in 24 hours' }).eligible, false);
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Investor said to be in talks to invest in Acme' }).reason, 'unconfirmed_transaction');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme raises Rs 500 Cr via QIP' }).reason, 'outside_venture_outcome_scope');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Example Fund III reaches final close' }).reason, 'outside_venture_outcome_scope');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Accel raises $800M for ninth early-stage Europe fund' }).reason, 'outside_venture_outcome_scope');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Accel raises enlarged $800M early-stage fund' }).reason, 'outside_venture_outcome_scope');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Addi announces $85M Series D led by Citius' }).eligible, true);
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Cast AI raises funds from Pacific Alliance Ventures at $1B valuation' }).eligible, true);
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme raises annual revenue guidance' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme seeks to raise $20M next year' }).reason, 'unconfirmed_transaction');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'LemFi reportedly on track to raise €30m Series B extension' }).reason, 'unconfirmed_transaction');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Scoop: LemFi set to raise a €30M Series B extension' }).reason, 'unconfirmed_transaction');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'xAI fired an engineer who raised alarms about Grok safety, new lawsuit claims' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Vantage Secures Position on the Fortune Crypto Innovators List' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Alphabet to Raise $80 Billion in Equity for AI Spending' }).reason, 'outside_venture_outcome_scope');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Alphabet Raises $80 Billion in AI Equity Raise as Berkshire Backs Expansion' }).reason, 'outside_venture_outcome_scope');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Chipmaker SK Hynix raises $26.5bn in US stock market debut' }).reason, 'outside_venture_outcome_scope');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'SK Hynix Raises $26.5 Billion In Record US Listing As AI Chip Demand Supercharges' }).reason, 'outside_venture_outcome_scope');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme raises its stake in Beta Corp' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme acquisition backed by $20M financing' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Boiler room raised $74M while reaping hidden fees, SEC claims' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'MongoDB invests €74M into Irish operations' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Maersk invests $100M in Boston fulfillment hub' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Bitget secures license for New Zealand expansion' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Fiuu secures JCB payment license in three markets' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Ola Electric Secures BIS Certification For Its LFP Cell' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Four AI giants just raised $188 billion' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Companion Labs, nailinit, and Wholeleaf Raise Early-Stage Funding' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Intrinsic Foundries and LocalHost Raise Early-Stage Funding' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'A founder who went from pressure washing just raised $40 million' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Senator Smith\'s son just raised $30 million for a trading venue' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'AI provider Baseten reportedly raising $1.5B' }).reason, 'unconfirmed_transaction');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Kalshi seeks funding at a $40B valuation' }).reason, 'unconfirmed_transaction');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Tezos raised $232 million in an ICO' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Krea, which has raised $83M, releases its new image model' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Ex-Pritzker execs raise $50M SNAK fund for B2B marketplaces' }).reason, 'outside_venture_outcome_scope');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Inside Physical Intelligence, a startup that has raised $1B' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: '85% of funding goes to the US. AVP and Earlybird raised €500M' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'SandboxAQ Secures $500 Million CHIPS Award' }).financingType, 'grant');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Wispr could secure $260M funding at $2B valuation' }).reason, 'unconfirmed_transaction');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Uforce targeting a $4B valuation in new raise, sources say' }).reason, 'unconfirmed_transaction');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Paradigm raises $1.2 billion fund as crypto VC pushes into AI' }).reason, 'outside_venture_outcome_scope');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Blue Origin is expected to raise private capital' }).reason, 'unconfirmed_transaction');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Crusoe is in active talks to raise $3B' }).reason, 'unconfirmed_transaction');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Wisk Aero manager raised safety concerns' }).reason, 'non_financing_headline');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'We gamble, invest, and cling to what we own' }).reason, 'missing_financing_action');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Citadel Securities invests $400M in Crypto.com' }).eligible, true);
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Citadel Securities to invest $400M in Crypto.com' }).reason, 'unconfirmed_transaction');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Evernorth announces AI specialty pharmacy program' }).reason, 'missing_financing_action');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Phoenix announces secured notes with 7% interest' }).financingType, 'debt');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme secures a $20M debt facility' }).financingType, 'debt');
  assert.equal(classifyFundingEvidence({ ...base, source_title: 'Acme raises a $20M Series A led by Example Ventures' }).financingType, 'equity');
  assert.equal(classifyFundingEvidence({ ...base, extraction_meta: { graph_safe: false } }).eligible, false);
});

test('trusted funding sources can verify one report while unreviewed sources require corroboration', () => {
  assert.deepEqual(assessFundingSource({ source_url: 'https://techcrunch.com/example' }), {
    trusted: true, tier: 'specialist_editorial', identity: 'techcrunch.com', basis: 'domain',
  });
  assert.equal(assessFundingSource({ source_url: 'https://news.google.com/rss/articles/x', source_publisher: 'Reuters' }).trusted, true);
  assert.equal(assessFundingSource({ source_url: 'https://random-blog.example/post' }).trusted, false);
  assert.deepEqual(assessFundingSource({ source_url: 'https://thenextweb.com/news/example' }), {
    trusted: true, tier: 'specialist_editorial', identity: 'thenextweb.com', basis: 'domain',
  });
  assert.deepEqual(assessFundingSource({ source_url: 'https://tech.eu/2026/05/05/example/' }), {
    trusted: true, tier: 'specialist_editorial', identity: 'tech.eu', basis: 'domain',
  });
  assert.deepEqual(assessFundingSource({ source_url: 'https://siliconangle.com/2026/06/25/runpod-raises-100m/' }), {
    trusted: true, tier: 'specialist_editorial', identity: 'siliconangle.com', basis: 'domain',
  });
  assert.equal(assessFundingSource({ source_url: 'https://pulse2.com/example' }).trusted, false);
});

test('soft-merges unknown vs typed round keys for corroboration clusters', () => {
  const clusters = clusterCompatibleRoundEvents([
    { id: 'a', canonical_round_key: 'id:s1|unknown|60000000|2026-06' },
    { id: 'b', canonical_round_key: 'id:s1|series-a|60000000|2026-06' },
    { id: 'c', canonical_round_key: 'id:s1|seed|5000000|2026-03' },
    { id: 'd', canonical_round_key: 'id:s1|unknown|5000000|2026-03' },
    { id: 'e', canonical_round_key: 'id:s1|series-e|unknown|2026-06' },
    { id: 'f', canonical_round_key: 'id:s1|series-e|250000000|2026-06' },
    { id: 'g', canonical_round_key: 'id:s1|unknown|unknown|2026-06' },
  ]);
  const byIds = clusters.map((cluster) => cluster.events.map((row) => row.id).sort().join('+')).sort();
  assert.ok(byIds.includes('a+b'), `expected a+b, got ${byIds.join(',')}`);
  assert.ok(byIds.includes('c+d'), `expected c+d, got ${byIds.join(',')}`);
  assert.ok(byIds.includes('e+f'), `expected e+f, got ${byIds.join(',')}`);
  assert.ok(byIds.includes('g'), 'fully unknown amount+round stays alone');
  assert.equal(byIds.some((row) => row.includes('a') && row.includes('e')), false);
});

test('groups Hit@5 source outcomes by soft-merged round cluster keys', () => {
  const eventA = { id: 'a', canonical_round_key: 'id:s1|series-b|45000000|2026-04' };
  const eventB = { id: 'b', canonical_round_key: 'id:s1|unknown|45000000|2026-04' };
  const eventC = { id: 'c', canonical_round_key: 'id:s1|seed|5000000|2026-03' };
  const groups = groupSourceOutcomesByRoundCluster([
    { event: eventA, outcome: 'miss' },
    { event: eventB, outcome: 'miss' },
    { event: eventC, outcome: 'miss' },
  ]);
  assert.equal(groups.size, 2);
  const merged = [...groups.values()].find((rows) => rows.some((row) => row.event.id === 'a'));
  assert.equal(merged?.length, 2);
  assert.ok(merged?.some((row) => row.event.id === 'b'));
});

test('funding amount extraction separates the raise from valuation semantics', () => {
  const { extractFunding } = require('../lib/inference-extractor.js');
  assert.equal(extractFunding('Lovable valued at $13.3B with $400M raise').funding_amount, 400_000_000);
  assert.equal(extractFunding('Cast AI raises funds from Pacific Alliance Ventures at $1B valuation').funding_amount, null);
  assert.equal(extractFunding('Moment: $78 Million Raised for AI infrastructure').funding_amount, 78_000_000);
  assert.equal(extractFunding('Etched raises $300M at a $10.3B valuation').funding_amount, 300_000_000);
  assert.equal(extractFunding('Gradient Labs raises fresh $13M').funding_amount, 13_000_000);
  assert.equal(extractFunding('Crystalys raises $130M to bring late-stage gout drug to market').funding_stage, null);
});

test('scores top-five hits, non-hits, misses, and time horizons without causal overclaiming', () => {
  const impressions = [
    { id: 'i1', session_id: 's1', investor_id: 'a', model_version: 'm1', rank_position: 1, shown_at: '2026-01-01T00:00:00Z', context: { predicted_probability: 0.4, predicted_horizon_days: 90 } },
    { id: 'i2', session_id: 's1', investor_id: 'b', model_version: 'm1', rank_position: 2, shown_at: '2026-01-01T00:00:00Z' },
    { id: 'i3', session_id: 's1', investor_id: 'c', model_version: 'm1', rank_position: 6, shown_at: '2026-01-01T00:00:00Z' },
  ];
  const participants = [{ id: 'p1', investor_id: 'a' }, { id: 'p2', investor_id: 'z' }];
  const result = evaluateRecommendationSet({ impressions, participants, eventAt: '2026-03-01T00:00:00Z' });
  assert.equal(result.recommendations.length, 2);
  assert.equal(result.recommendations[0].attribution_kind, 'predicted_participant');
  assert.equal(result.recommendations[0].predicted_probability, 0.4);
  assert.equal(result.recommendations[1].attribution_kind, 'recommended_non_participant');
  assert.deepEqual(result.recommendations[0].horizons, [90, 180, 365]);
  assert.deepEqual(result.misses.map(row => row.investor_id), ['z']);
  assert.deepEqual(metricsForEvaluations(result.recommendations), {
    recommendations: 2,
    hits: 1,
    precision_at_k: 0.5,
    median_days_to_investment: 59,
  });
});

test('schema preserves evidence provenance and false negatives', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260817030000_funding_evidence_prediction_ledger.sql', import.meta.url), 'utf8');
  assert.match(sql, /announced_at TIMESTAMPTZ NOT NULL/);
  assert.match(sql, /occurred_at_precision/);
  assert.match(sql, /financing_type/);
  assert.match(sql, /discovered_at TIMESTAMPTZ NOT NULL/);
  assert.match(sql, /funding_prediction_misses/);
  assert.match(sql, /precision_at_5/);
  assert.match(sql, /brier_score/);
  assert.match(sql, /REVOKE ALL ON public\.funding_evidence_events FROM anon, authenticated/);
});

test('canonical round migration preserves source evidence and participation relations', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260817034000_funding_canonical_rounds.sql', import.meta.url), 'utf8');
  assert.match(sql, /canonical_round_key/);
  assert.match(sql, /participation_relation/);
  assert.match(sql, /evidence_phrase/);
  assert.match(sql, /PARTICIPATED_IN_SYNDICATE/);
});

test('backend service role can access the private ledger while browser roles cannot', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260817031000_funding_evidence_service_role_grants.sql', import.meta.url), 'utf8');
  assert.match(sql, /TO service_role/);
  assert.match(sql, /FROM anon, authenticated/);
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
});

test('PostgREST visibility repair grants schema usage and reports effective privileges', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260817032000_funding_evidence_postgrest_visibility.sql', import.meta.url), 'utf8');
  assert.match(sql, /GRANT USAGE ON SCHEMA public TO service_role/);
  assert.match(sql, /has_table_privilege\('service_role'/);
  assert.match(sql, /has_table_privilege\('anon'/);
  assert.match(sql, /NOTIFY pgrst, 'reload schema'/);
});

test('sync withholds evaluation for partial participant lists and supports resolved-only cohorts', () => {
  const sync = readFileSync(new URL('../scripts/sync-funding-evidence-ledger.mjs', import.meta.url), 'utf8');
  assert.match(sync, /process\.argv\.includes\('--resolved-only'\)/);
  assert.match(sync, /process\.argv\.includes\('--equity-only'\)/);
  assert.match(sync, /magnitude === 'b'/);
  assert.match(sync, /inferredFunding\.funding_amount/);
  assert.match(sync, /participantListComplete && \['equity', 'mixed'\]/);
  assert.match(sync, /participant_list_complete/);
  assert.match(sync, /async function fetchFundingEvents/);
  assert.match(sync, /\.range\(start, end\)/);
  assert.match(sync, /resolved_preview: resolvedPreview/);
  assert.match(sync, /--event-ids=/);
  assert.match(sync, /--offset=/);
  assert.match(sync, /--before=/);
  assert.match(sync, /\.lte\('created_at', before\)/);
  assert.match(sync, /async function fetchAllRows/);
  assert.match(sync, /classifyNamedInvestorParticipation/);
  assert.match(sync, /extractExplicitParticipantMentions/);
  assert.match(sync, /filter\(mention => mention\.relation && mention\.role !== 'unknown'\)/);
  assert.match(sync, /funding_evidence_excerpt/);
  assert.match(sync, /existing\?\.verification_status \|\| 'observed'/);
  assert.match(sync, /\.\.\.\(existing\?\.metadata \|\| \{\}\)/);
  assert.match(sync, /existingEvidenceByKey/);
});

test('scheduled scraper pipeline feeds the evidence ledger non-fatally', () => {
  const pipeline = readFileSync(new URL('../scripts/cron/signal-pipeline.js', import.meta.url), 'utf8');
  assert.match(pipeline, /sync-funding-evidence-ledger\.mjs/);
  assert.match(pipeline, /funding-evidence-ledger',[\s\S]*fatal: false/);
  assert.match(pipeline, /FUNDING_EVIDENCE_RESOLVER_ENABLED/);
  assert.match(pipeline, /scripts\/event-resolver\.js/);
  assert.match(pipeline, /enrich-funding-ledger-participants\.mjs/);
  assert.match(pipeline, /scrub-funding-participant-chronology\.mjs/);
  assert.match(pipeline, /resolve-funding-startup-coverage\.mjs/);
  assert.match(pipeline, /resolve-funding-investor-coverage\.mjs/);
  assert.match(pipeline, /backfill-funding-evidence-history\.mjs/);
  assert.match(pipeline, /reconcile-historical-funding-matches\.mjs/);
});

test('historical backfill is resumable and locked to a stable source watermark', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260818161000_funding_history_backfill_checkpoint.sql', import.meta.url), 'utf8');
  const indexSql = readFileSync(new URL('../supabase/migrations/20260818183000_startup_events_funding_backfill_index.sql', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../scripts/backfill-funding-evidence-history.mjs', import.meta.url), 'utf8');
  assert.match(sql, /source_max_created_at timestamptz/);
  assert.match(sql, /REVOKE ALL .* FROM anon, authenticated/);
  assert.match(script, /source_max_created_at/);
  assert.match(script, /--before=\$\{sourceMaxCreatedAt\}/);
  assert.match(script, /checkpoint_after/);
  assert.match(script, /scanned < limit/);
  assert.match(script, /checkpoint_conflict/);
  assert.match(script, /\.eq\('next_offset'/);
  assert.match(script, /summarizeBatch/);
  assert.match(indexSql, /startup_events \(created_at DESC, id DESC\)/);
  assert.match(indexSql, /WHERE event_type IN \('FUNDING', 'INVESTMENT'\)/);
  const applyIndex = readFileSync(new URL('../scripts/apply-funding-backfill-index.mjs', import.meta.url), 'utf8');
  assert.match(applyIndex, /exec_sql_modify/);
  assert.match(applyIndex, /idx_startup_events_funding_backfill_order/);
});

test('article evidence backfill is bounded, SSRF-aware, and dry-run by default', () => {
  const script = readFileSync(new URL('../scripts/enrich-funding-evidence-excerpts.mjs', import.meta.url), 'utf8');
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
  assert.match(script, /isPrivateIp/);
  assert.match(script, /redirect: 'error'/);
  assert.match(script, /2_000_000/);
  assert.match(script, /funding_evidence_excerpt_source: 'source_page'/);
});

test('GOD-score audit starts at the top and distinguishes impressions from legacy matches', () => {
  const script = readFileSync(new URL('../scripts/audit-top-god-funding-cohort.mjs', import.meta.url), 'utf8');
  assert.match(script, /order\('total_god_score', \{ ascending: false \}\)/);
  assert.match(script, /\.lte\('rank_position', 5\)/);
  assert.match(script, /ranking_impression/);
  assert.match(script, /legacy_current_state_not_historical_impression/);
  assert.match(script, /uniqueLegacyTopFive/);
  assert.match(script, /post_prediction/);
  assert.match(script, /predicted_investor_hits/);
  assert.match(script, /\.eq\('status', 'approved'\)/);
});

test('high-GOD identity repair is guarded, reversible in metadata, and dry-run first', () => {
  const script = readFileSync(new URL('../scripts/repair-top-god-identity-cohort.mjs', import.meta.url), 'utf8');
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
  assert.match(script, /expectedName/);
  assert.match(script, /identity_changed/);
  assert.match(script, /previous: existingReview\?\.previous \|\| \{ website:/);
  assert.match(script, /existingReview\?\.previous \|\|/);
  assert.match(script, /Do not merge automatically with fal\.ai/);
});

test('startup insertion gate rejects publisher and investor URLs as canonical websites', () => {
  const gate = readFileSync(new URL('../lib/startupInsertGate.js', import.meta.url), 'utf8');
  const urls = readFileSync(new URL('../lib/junk-url-config.js', import.meta.url), 'utf8');
  assert.match(gate, /isJunkUrl\(data\.website\)/);
  assert.match(gate, /isJunkUrl\(record\.website\)/);
  assert.match(urls, /initialized\.com/);
  assert.match(urls, /fintechnews\.org/);
  assert.match(urls, /saastr\.com/);
});

test('prospective snapshots freeze approved top-five sets without changing live ranking', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260817035000_funding_prediction_snapshots.sql', import.meta.url), 'utf8');
  const script = readFileSync(new URL('../scripts/snapshot-funding-prediction-cohort.mjs', import.meta.url), 'utf8');
  assert.match(sql, /god_score_at_prediction/);
  assert.match(sql, /rank_position INTEGER NOT NULL CHECK \(rank_position BETWEEN 1 AND 5\)/);
  assert.match(sql, /prospective_shadow/);
  assert.match(sql, /REVOKE ALL .* FROM anon, authenticated/);
  assert.match(script, /\.eq\('status', 'approved'\)/);
  assert.match(script, /seenFirms/);
  assert.match(script, /isEligibleFirmInvestor/);
  assert.match(script, /freezeFundingPredictionSnapshot/);
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
  assert.match(script, /process\.argv\.includes\('--new-only'\)/);
  assert.match(script, /previouslySnapshotted/);
  assert.match(script, /isServeGradeStartupIdentity/);
  assert.match(script, /offset \+= 20/);
  assert.match(script, /snapshots\.length >= limit \* 5/);
  assert.match(script, /description,total_god_score/);
  assert.match(script, /fetchAllSnapshotStartupIds/);
  assert.match(script, /\.eq\('source_type', 'url'\)/);
  assert.match(script, /--scan-limit=/);
  assert.match(script, /--scan-offset=/);
});

test('prospective evaluator uses startup-level any-of-five hits and separates pending horizons', () => {
  const script = readFileSync(new URL('../scripts/evaluate-funding-hit-at-five.mjs', import.meta.url), 'utf8');
  assert.match(script, /predictions\.length !== 5/);
  assert.match(script, /matchedInvestorIds\.has/);
  assert.match(script, /matchedOrganizationIds\.has/);
  assert.match(script, /investor_organization_id/);
  assert.match(script, /hit_at_5_among_funded/);
  assert.match(script, /pending_snapshot_sets/);
  assert.match(script, /eventAt > predictedAt && eventAt <= horizonEnd/);
  assert.match(script, /participation_relation && row\.participant_role !== 'unknown'/);
});

test('funding prediction claim gate uses Wilson confidence and audited startup-level outcomes', () => {
  const claim = require('../server/lib/fundingPredictionClaim.js');
  const empty = claim.buildClaimReadiness();
  assert.equal(empty.claim_ready, false);
  assert.ok(empty.blockers.includes('no_audited_outcomes'));
  const weakSample = claim.buildClaimReadiness({ confirmedHits: 20, confirmedMisses: 0, minimumAuditedOutcomes: 100 });
  assert.equal(weakSample.claim_ready, false);
  assert.ok(weakSample.blockers.some(blocker => blocker.startsWith('needs_')));
  const defensible = claim.buildClaimReadiness({ confirmedHits: 100, confirmedMisses: 0, minimumAuditedOutcomes: 100 });
  assert.equal(defensible.claim_ready, true);
  assert.ok(defensible.confidence_95.lower >= 0.85);
});

test('claim-readiness report prevents temporal leakage and separates accuracy definitions', () => {
  const script = readFileSync(new URL('../scripts/report-funding-prediction-claim-readiness.mjs', import.meta.url), 'utf8');
  assert.match(script, /discoveredAt >= predictedAt/);
  assert.match(script, /at > predictedAt && at <= horizonEnd/);
  assert.match(script, /participant_list_complete === true/);
  assert.match(script, /per_investor_precision_at_5/);
  assert.match(script, /actual_investor_recall_at_5/);
  assert.match(script, /confirmed_hit_startups/);
  assert.match(script, /indeterminate_funded_startups/);
  assert.match(script, /firstByStartup/);
  assert.match(script, /canonical_round_key/);
  assert.match(script, /classifyFundingEvidence/);
  assert.match(script, /source_title/);
  assert.match(script, /excluded_prediction_sets_without_prediction_grade_identity/);
  assert.match(script, /isServeGradeStartupIdentity/);
  assert.match(script, /rowsByIds/);
  assert.match(script, /hasFiveDistinctInvestorFirms/);
  assert.match(script, /excluded_prediction_sets_with_duplicate_or_unresolved_firms/);
});

test('prospective cohort monitor is free-search-first and cannot backdate evidence', () => {
  const monitor = readFileSync(new URL('../scripts/monitor-funding-prediction-cohort.mjs', import.meta.url), 'utf8');
  assert.match(monitor, /searchStartupNews/);
  assert.match(monitor, /inference_engine_free_news_search/);
  assert.match(monitor, /isPredictionGradeStartupIdentity/);
  assert.match(monitor, /publishedAt > new Date\(predictedAt\)/);
  assert.match(monitor, /all_active_365_day_cohorts/);
  assert.match(monitor, /cohortKeys: new Set/);
  assert.match(monitor, /predictionGradeStartupIds/);
  assert.match(monitor, /verification_status: 'observed'/);
  assert.match(monitor, /extractKnownInvestorMentions/);
  assert.doesNotMatch(monitor, /OpenAI|Anthropic/);
});

test('historical funding search defaults to inference engine, not Gemini', () => {
  const script = readFileSync(new URL('../scripts/search-startup-funding-evidence.mjs', import.meta.url), 'utf8');
  assert.match(script, /searchStartupNews/);
  assert.match(script, /findMatchedInvestorsInText/);
  assert.match(script, /fetchArticleText/);
  assert.match(script, /--requeue-empty/);
  assert.match(script, /--requeue-priority-empty/);
  assert.match(script, /min-requeue-priority=/);
  assert.match(script, /requeued_high_priority_empty/);
  assert.match(script, /NO_FUNDING_JSON_RE/);
  assert.match(script, /If you find no completed post-cutoff rounds/);
  assert.match(script, /startupMentionedInText/);
  assert.match(script, /extractKnownInvestorMentions/);
  assert.match(script, /providerArg === 'gemini'/);
  assert.match(script, /providerArg === 'openai'/);
  assert.match(script, /providerArg === 'ontology'/);
  assert.match(script, /openai_web_search/);
  assert.match(script, /processOpenAIJob/);
  assert.match(script, /inference_engine_free_news_search/);
  assert.match(script, /source_provider: 'inference_engine'/);
  assert.doesNotMatch(script, /throw new Error\('Missing GEMINI_API_KEY'\)/);
});

test('ledger quality audit measures formal evaluability without mutating evidence', () => {
  const audit = readFileSync(new URL('../scripts/audit-funding-ledger-quality.mjs', import.meta.url), 'utf8');
  assert.match(audit, /formally_evaluable_events/);
  assert.match(audit, /no_resolved_proven_participants/);
  assert.match(audit, /complete_top_five_sets/);
  assert.doesNotMatch(audit, /\.update\(|\.delete\(|\.upsert\(/);
});

test('derived-field repair unlinks directional and unsafe startup identities reversibly', () => {
  const script = readFileSync(new URL('../scripts/repair-funding-ledger-derived-fields.mjs', import.meta.url), 'utf8');
  assert.match(script, /directional_startup_mislink/);
  assert.match(script, /descriptive_affiliation_mislink/);
  assert.match(script, /headline_startup_mislink/);
  assert.match(script, /unsafe_canonical_startup_unlinked/);
  assert.match(script, /non_funding_evidence_rejected/);
  assert.match(script, /patch\.verification_status = 'rejected'/);
  assert.match(script, /classifier_quarantine_recovered/);
  assert.match(script, /quarantine_previous/);
  assert.match(script, /--full-preview/);
  assert.match(script, /startup_label_replaced_from_canonical/);
  assert.match(script, /patch\.startup_id = null/);
});

test('verified participant enrichment is bounded, source-grounded, and preserves incomplete lists', () => {
  const script = readFileSync(new URL('../scripts/enrich-funding-ledger-participants.mjs', import.meta.url), 'utf8');
  assert.match(script, /verification_status', \['verified', 'corroborated'\]/);
  assert.match(script, /extractKnownInvestorMentions/);
  assert.match(script, /participant_list_complete/);
  assert.match(script, /explicit_roster_extracted|hasExplicitRoster/);
  assert.match(script, /participant_enrichment_version: 'v3'/);
  assert.match(script, /isPrivateIp/);
  assert.match(script, /redirect: 'error'/);
  assert.match(script, /focusedEvidenceExcerpt/);
  assert.match(script, /slice\(0, 4500\)/);
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
  assert.match(script, /process\.argv\.includes\('--retry-failed'\)/);
  assert.match(script, /metadata->>participant_enrichment_version/);
  assert.match(script, /participant_enrichment_attempted_at/);
  const scrub = readFileSync(new URL('../scripts/scrub-funding-participant-chronology.mjs', import.meta.url), 'utf8');
  assert.match(scrub, /oversized_article_tail_extraction/);
  assert.match(scrub, /implausible_investor_entity/);
  assert.match(scrub, /directional_subject_duplicate/);
});

test('audited event importer preserves explicit roles, evidence phrases, and incomplete lists', () => {
  const script = readFileSync(new URL('../scripts/ingest-audited-funding-events.mjs', import.meta.url), 'utf8');
  assert.match(script, /participantListComplete: false/);
  assert.match(script, /LED_ROUND/);
  assert.match(script, /CO_LED_ROUND/);
  assert.match(script, /evidence_phrase: participant\.phrase/);
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
});

test('delta analysis separates identity, candidate-generation, ranking, and temporal failures', () => {
  const script = readFileSync(new URL('../scripts/analyze-funding-match-deltas.mjs', import.meta.url), 'utf8');
  assert.match(script, /missing_from_investor_universe/);
  assert.match(script, /ambiguous_canonical_identity/);
  assert.match(script, /ranked_outside_top_five/);
  assert.match(script, /candidate_generation_miss/);
  assert.match(script, /!row\.participation_relation \|\| row\.participant_role === 'unknown'/);
  assert.match(script, /!participant\.investor_id && participant\.resolution_status === 'not_in_universe'/);
  assert.match(script, /partial_top_five_pre_event/);
  assert.match(script, /comparison_is_formal: false/);
  assert.match(script, /canonical_profile/);
});

test('historical reconciliation uses only pre-event matches and never claims prospective accuracy', () => {
  const script = readFileSync(new URL('../scripts/reconcile-historical-funding-matches.mjs', import.meta.url), 'utf8');
  assert.match(script, /new Date\(row\.created_at\) < cutoff/);
  assert.match(script, /post_event_match_not_prediction/);
  assert.match(script, /ranked_outside_top_five/);
  assert.match(script, /candidate_generation_miss/);
  assert.match(script, /Legacy scores may have been updated later/);
  assert.match(script, /participant_list_complete \? 'auditable_miss_at_5'/);
  assert.match(script, /firmLevelParticipant/);
  assert.doesNotMatch(script, /\.update\(|\.delete\(|\.upsert\(/);
});

test('candidate generation paginates the full investor universe before ranking and firm deduplication', () => {
  const batchMatcher = readFileSync(new URL('../scripts/matching/generate-matches.js', import.meta.url), 'utf8');
  const worker = readFileSync(new URL('../server/matchWorker.ts', import.meta.url), 'utf8');
  assert.match(batchMatcher, /fetchAllInvestors/);
  assert.match(batchMatcher, /\.range\(offset, offset \+ pageSize - 1\)/);
  assert.match(batchMatcher, /selectTopInvestorCandidates\(/);
  assert.match(batchMatcher, /forceInvestorIds/);
  assert.match(batchMatcher, /Documented prior investor relationship/);
  assert.match(batchMatcher, /b\.match\.score - a\.match\.score/);
  assert.match(batchMatcher, /organization:\$\{organizationId\}/);
  assert.match(batchMatcher, /firmKeys\.some/);
  assert.match(batchMatcher, /replace\(\/\^at\\s\+\/i, ''\)/);
  assert.match(batchMatcher, /Documented prior investor relationship \(\+20\)/);
  assert.match(batchMatcher, /investorFitPercent/);
  assert.match(batchMatcher, /startup_quality_score/);
  assert.match(batchMatcher, /relationshipWasObservable/);
  assert.match(batchMatcher, /portfolioWasObservable/);
  assert.doesNotMatch(batchMatcher, /startupMatchCount < 50/);
  assert.match(worker, /\.range\(offset, offset \+ 999\)/);
  assert.match(worker, /toLowerCase\(\)\.trim\(\)/);
});

test('funding-outcome investor enrichment is source-gated, additive, and dry-run by default', () => {
  const script = readFileSync(new URL('../scripts/enrich-funding-outcome-investors.js', import.meta.url), 'utf8');
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
  assert.match(script, /participant_role !== 'unknown'/);
  assert.match(script, /resolution_status === 'resolved'/);
  assert.match(script, /safeProfileUpdate/);
  assert.match(script, /investor_profile_enrichment/);
  assert.match(script, /eligible_sources: evidence/);
  assert.doesNotMatch(script, /update\.investment_thesis/);
});

test('funding outcome organization repair is exact, conflict-aware, and dry-run by default', () => {
  const script = readFileSync(new URL('../scripts/repair-funding-outcome-organization-links.mjs', import.meta.url), 'utf8');
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
  assert.match(script, /profileMatchesOrganization/);
  assert.match(script, /conflicting existing organization membership/);
  assert.match(script, /exact non-individual firm profile/);
  assert.match(script, /organization_resolution/);
  assert.match(script, /funding-outcome-organization-repair-v1/);
});

test('reviewed individual repair is identity-only and preserves the historical miss', () => {
  const script = readFileSync(new URL('../scripts/resolve-reviewed-individual-funding-investors.mjs', import.meta.url), 'utf8');
  const audit = readFileSync(new URL('../scripts/shadow-audit-funding-candidate-ranks.mjs', import.meta.url), 'utf8');
  const profileAudit = readFileSync(new URL('../scripts/audit-funding-investor-profile-fragmentation.mjs', import.meta.url), 'utf8');
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
  assert.match(script, /matching_attributes_inferred: false/);
  assert.match(script, /historical_candidate_profile_preserved_as_missing: true/);
  assert.match(script, /sectors: \[\]/);
  assert.match(script, /check_size_min: null/);
  assert.match(script, /investment_thesis: null/);
  assert.doesNotMatch(script, /investor_organization_memberships/);
  assert.match(audit, /historically_missing_candidate_profile/);
  assert.match(audit, /profileExistedAtCutoff/);
  assert.match(profileAudit, /!row\.investor_organization_id && !row\.investor_id/);
});

test('historical investor features exclude events at or after the prediction cutoff', () => {
  const events = [
    { id: 'before', canonical_round_key: 'round-1', startup_id: 's1', round_type: 'Seed', announced_at: '2025-01-01', verification_status: 'verified' },
    { id: 'before-copy', canonical_round_key: 'round-1', startup_id: 's1', round_type: 'Seed', announced_at: '2025-01-02', verification_status: 'corroborated' },
    { id: 'after', startup_id: 's2', round_type: 'Series A', announced_at: '2025-07-01', verification_status: 'verified' },
    { id: 'weak', startup_id: 's1', round_type: 'Seed', announced_at: '2024-01-01', verification_status: 'observed' },
  ];
  const participants = events.map(event => ({
    funding_event_id: event.id,
    investor_organization_id: 'org1',
    participant_role: 'lead',
    participation_relation: 'LED_ROUND',
  }));
  const features = buildInvestorHistoricalFeatures({
    events,
    participants,
    startups: [{ id: 's1', sectors: ['SaaS'], stage: 'Seed' }, { id: 's2', sectors: ['FinTech'], stage: 'Series A' }],
    cutoffAt: '2025-06-01',
  });
  const feature = features.get('organization:org1');
  assert.equal(feature.deal_count, 1);
  assert.deepEqual(feature.evidence_event_ids, ['before']);
  assert.equal(feature.sectors.saas, 1);
  assert.ok(scoreHistoricalFit({ sectors: ['SaaS'], stage: 'Seed' }, feature, '2025-06-01').points > 0);
});

test('recent investor activity is evaluated relative to the prediction cutoff without future leakage', () => {
  assert.equal(scoreRecentActivity('2025-05-01', '2025-06-01').points, 3);
  assert.equal(scoreRecentActivity('2024-01-01', '2025-06-01').points, 0);
  assert.equal(scoreRecentActivity('2025-07-01', '2025-06-01').points, 0);
  assert.equal(scoreRecentActivity('not-a-date', '2025-06-01').points, 0);
});

test('Hit@5 pending triage script measures horizon maturity and hunts untrusted funding gaps', () => {
  const script = readFileSync(new URL('../scripts/triage-hit5-pending-horizons.mjs', import.meta.url), 'utf8');
  assert.match(script, /canonical_round_key/);
  assert.match(script, /groupSourceOutcomesByRoundCluster/);
  assert.match(script, /untrusted_observed/);
  assert.match(script, /near_term_maturity_soon/);
  assert.match(script, /duplicate_firm_excluded_startups/);
});

test('corroboration requires two independent sources or one reviewed trusted source', () => {
  const script = readFileSync(new URL('../scripts/corroborate-funding-evidence-rounds.mjs', import.meta.url), 'utf8');
  assert.match(script, /domains\.length < 2/);
  assert.match(script, /trusted\.length === 0/);
  assert.match(script, /trusted_single_source/);
  assert.match(script, /alreadyCurrent/);
  assert.match(script, /Promise\.all\(batch\.map/);
  assert.match(script, /canonical_round_key/);
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
});

test('missing funding investors are seeded only from reviewed first-party profiles', () => {
  const script = readFileSync(new URL('../scripts/seed-missing-funding-investor-profiles.mjs', import.meta.url), 'utf8');
  assert.match(script, /first_party_profile_review/);
  assert.match(script, /conservative_unknowns_preserved/);
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
  assert.match(script, /existing_candidates/);
  assert.doesNotMatch(script, /\.delete\(/);
});

test('investor coverage resolve accepts headline-cleaned firm matches', () => {
  const script = readFileSync(new URL('../scripts/resolve-funding-investor-coverage.mjs', import.meta.url), 'utf8');
  assert.match(script, /headline_cleaned_/);
  assert.match(script, /exact_firm_preferred/);
  assert.match(script, /isFirmSafeNormalized/);
});

test('investor canonical audit checks aliases and downstream references before merging', () => {
  const script = readFileSync(new URL('../scripts/audit-funding-investor-canonicalization.mjs', import.meta.url), 'utf8');
  assert.match(script, /normalizeEntityName/);
  assert.match(script, /startup_investor_matches/);
  assert.match(script, /funding_evidence_participants/);
  assert.match(script, /funding_prediction_snapshots/);
  assert.doesNotMatch(script, /\.delete\(/);
  assert.doesNotMatch(script, /\.update\(/);
});

test('event resolver supports Anthropic with deterministic inference hints', () => {
  const resolver = readFileSync(new URL('../server/lib/eventResolver.js', import.meta.url), 'utf8');
  const runner = readFileSync(new URL('../scripts/event-resolver.js', import.meta.url), 'utf8');
  assert.match(resolver, /api\.anthropic\.com\/v1\/messages/);
  assert.match(resolver, /Deterministic inference hints/);
  assert.match(runner, /--provider/);
  assert.match(runner, /InferenceExtractor\.extractFunding/);
  assert.match(runner, /provider must be openai, anthropic, or inference/);
  assert.match(runner, /FUNDING_ONLY \? \['FUNDING', 'INVESTMENT'\]/);
  assert.match(runner, /INFERENCE_FIRST = !has\('--llm-all'\)/);
  assert.match(runner, /paid_fallback/);
});

test('funding proof candidate backfill is bounded, firm-only, leakage-safe, and dry-run by default', () => {
  const script = readFileSync(new URL('../scripts/backfill-funding-proof-candidates.mjs', import.meta.url), 'utf8');
  assert.match(script, /process\.argv\.includes\('--apply'\)/);
  assert.match(script, /Math\.min\(Math\.max\(Number\(limitArg/);
  assert.match(script, /fetchAllInvestors/);
  assert.match(script, /isPredictionGradeStartupIdentity/);
  assert.match(script, /\.eq\('source_type', 'url'\)/);
  assert.match(script, /snapshottedStartupIds\.has/);
  assert.match(script, /row\.is_individual !== true/);
  assert.match(script, /firmTyped/);
  assert.match(script, /personTyped/);
  assert.match(script, /feature_cutoff_at: cutoffIso/);
  assert.match(script, /full_universe_firm_only_no_outcome_labels/);
  assert.match(script, /\.upsert\(/);
  assert.doesNotMatch(script, /funding_prediction_evaluations/);
  assert.doesNotMatch(script, /funding_prediction_misses/);
  assert.doesNotMatch(script, /\.delete\(/);
});

test('signal pipeline backfills firm candidates before freezing predictions', () => {
  const pipeline = readFileSync(new URL('../scripts/cron/signal-pipeline.js', import.meta.url), 'utf8');
  const backfillAt = pipeline.indexOf('backfill-funding-proof-candidates.mjs');
  const snapshotAt = pipeline.indexOf('snapshot-funding-prediction-cohort.mjs');
  assert.ok(backfillAt >= 0);
  assert.ok(snapshotAt > backfillAt);
  assert.match(pipeline, /backfill-funding-proof-candidates\.mjs', '--apply', '--limit=25/);
});
