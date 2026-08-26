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
  // Post-#44 mature stuck single-source raises unlocked via issuer wires / audited ingest.
  {
    key: 'audited:paper:series-a:2026-07-23:34000000', startupId: '55416fbb-a4a8-4243-ae2d-db433fc547c4', startupName: 'Paper',
    roundType: 'Series A', amountUsd: 34_000_000, announcedAt: '2026-07-23T00:00:00Z', participantListComplete: true,
    sourceUrl: 'https://www.businesswire.com/news/home/20260723608438/en/Paper-Raises-34-Million-Series-A-with-Accel-and-ICONIQ-to-Build-the-Design-Platform-for-the-Agentic-Era',
    sourcePublisher: 'Business Wire',
    sourceTitle: 'Paper Raises $34 Million Series A with Accel and ICONIQ', verificationStatus: 'verified',
    participants: [
      ['Accel', 'lead', 'LED_ROUND', 'Series A with Accel and ICONIQ'],
      ['ICONIQ', 'lead', 'LED_ROUND', 'Series A with Accel and ICONIQ'],
      ['Designer Fund', 'participant', 'PARTICIPATED_IN_ROUND', 'Investors participating include Designer Fund'],
    ],
  },
  {
    key: 'audited:rork:seed:2026-04-09:15000000', startupId: '6a3c23c4-42b9-44ae-9b8a-ec2ce26bf2cf', startupName: 'Rork',
    roundType: 'Seed', amountUsd: 15_000_000, announcedAt: '2026-04-09T00:00:00Z', participantListComplete: true,
    sourceUrl: 'https://www.prnewswire.com/news-releases/rork-raises-15m-to-power-the-next-generation-of-app-store-entrepreneurs-302736638.html',
    sourcePublisher: 'PR Newswire',
    sourceTitle: 'Rork Raises $15M to Power the Next Generation of App Store Entrepreneurs', verificationStatus: 'verified',
    participants: [
      ['Left Lane Capital', 'lead', 'LED_ROUND', 'Seed funding round led by Left Lane Capital'],
      ['Peak XV', 'participant', 'PARTICIPATED_IN_ROUND', 'with participation from Peak XV, True Ventures, Goodwater'],
      ['True Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'with participation from Peak XV, True Ventures, Goodwater'],
      ['Goodwater Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'with participation from Peak XV, True Ventures, Goodwater'],
      ['Andreessen Horowitz', 'participant', 'PARTICIPATED_IN_ROUND', 'existing investor a16z Speedrun'],
    ],
  },
  {
    key: 'audited:phia:series-a:2026-06-06:35500000', startupId: '204e0ef2-c303-4568-9d93-ac8bc6ff925f', startupName: 'Phia',
    roundType: 'Series A', amountUsd: 35_500_000, announcedAt: '2026-06-06T00:00:00Z', participantListComplete: true,
    sourceUrl: 'https://pulse2.com/phia-raises-35-5-million-series-a-and-reveals-star-studded-investor-roster-to-expand-ai-powered-shopping-platform/',
    sourcePublisher: 'Pulse 2.0',
    sourceTitle: 'Phia Raises $35.5 Million Series A And Reveals Star-Studded Investor Roster', verificationStatus: 'verified',
    participants: [
      ['Notable Capital', 'lead', 'LED_ROUND', 'financing led by Notable Capital, Khosla Ventures, and Kleiner Perkins'],
      ['Khosla Ventures', 'lead', 'LED_ROUND', 'financing led by Notable Capital, Khosla Ventures, and Kleiner Perkins'],
      ['Kleiner Perkins', 'lead', 'LED_ROUND', 'financing led by Notable Capital, Khosla Ventures, and Kleiner Perkins'],
    ],
  },
  {
    key: 'audited:arcade:series-a:2026-06-15:60000000', startupId: '41858b38-34f5-4c17-a374-cf856c9acf49', startupName: 'Arcade',
    roundType: 'Series A', amountUsd: 60_000_000, announcedAt: '2026-06-15T00:00:00Z', participantListComplete: true,
    sourceUrl: 'https://www.businesswire.com/news/home/20260615229631/en/Arcade-Raises-60M-to-Become-the-Secure-Action-Layer-Behind-Every-Production-AI-Agent',
    sourcePublisher: 'Business Wire',
    sourceTitle: 'Arcade Raises $60M Series A led by SYN Ventures', verificationStatus: 'verified',
    participants: [
      ['SYN Ventures', 'lead', 'LED_ROUND', 'Series A funding led by SYN Ventures'],
      ['Morgan Stanley', 'participant', 'PARTICIPATED_IN_ROUND', 'strategic investment from Morgan Stanley and Wipro'],
      ['Wipro', 'participant', 'PARTICIPATED_IN_ROUND', 'strategic investment from Morgan Stanley and Wipro'],
    ],
  },
  // Post-#47 Pulse2-complete issuer-wire unlock batch (pair with seed-indeterminate + corroborate).
  {
    key: 'audited:attention:series-b:2026-06-24:30000000', startupId: 'a77885fb-fe13-4d7d-af45-ca9b97d9445f', startupName: 'Attention',
    roundType: 'Series B', amountUsd: 30_000_000, announcedAt: '2026-06-24T15:34:14Z', participantListComplete: true,
    sourceUrl: 'https://www.prnewswire.com/news-releases/attention-raises-30m-series-b-to-build-the-ai-system-that-runs-revenue-teams--not-just-records-them-302808821.html',
    sourcePublisher: 'PR Newswire',
    sourceTitle: 'Attention Raises $30M Series B to Build the AI System That Runs Revenue Teams', verificationStatus: 'verified',
    participants: [
      ['RTP Global', 'lead', 'LED_ROUND', 'Series B led by RTP Global'],
      ['Aglaé Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'returning investors Aglaé Ventures, Eniac, and Alven'],
      ['Eniac', 'participant', 'PARTICIPATED_IN_ROUND', 'returning investors Aglaé Ventures, Eniac, and Alven'],
      ['Alven', 'participant', 'PARTICIPATED_IN_ROUND', 'returning investors Aglaé Ventures, Eniac, and Alven'],
      ['Linea Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'new investor Linea Ventures'],
    ],
  },
  {
    key: 'audited:wealthreach:seed:2026-06-10:1000000', startupId: '56bf6bfc-9734-4107-9312-8b185f92f2fd', startupName: 'WealthReach',
    roundType: 'Seed', amountUsd: 1_000_000, announcedAt: '2026-06-10T16:01:56Z', participantListComplete: true,
    sourceUrl: 'https://www.businesswire.com/news/home/20260610930482/en/WealthReach-Raises-1M-Seed-Round-Forms-Strategic-Advisory-Board-to-Drive-Expansion-of-Its-Organic-Growth-Platform',
    sourcePublisher: 'Business Wire',
    sourceTitle: 'WealthReach Raises $1M Seed Round, Forms Strategic Advisory Board', verificationStatus: 'verified',
    participants: [
      ['Cecure Corporation', 'lead', 'LED_ROUND', 'round was led by Cecure Corporation'],
    ],
  },
  {
    key: 'audited:portal:unknown:2026-06-09:5000000', startupId: 'd00870da-96fa-4a88-b178-a3b35ed3cb72', startupName: 'Portal',
    roundType: null, amountUsd: 5_000_000, announcedAt: '2026-06-09T19:48:49Z', participantListComplete: true,
    sourceUrl: 'https://www.businesswire.com/news/home/20260608695242/en/The-Portal-Raises-5-Million-to-Launch-Austin-Flagship-for-Members-Club-Dedicated-to-Human-Flourishing',
    sourcePublisher: 'Business Wire',
    sourceTitle: 'The Portal Raises $5 Million to Launch Austin Flagship', verificationStatus: 'verified',
    participants: [
      ['Tim Ferriss', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Tim Ferriss, Matt Mullenweg, Ankush Gera, JP Newman, Michael Fishman, and Ravi Bhojwani'],
      ['Matt Mullenweg', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Tim Ferriss, Matt Mullenweg, Ankush Gera, JP Newman, Michael Fishman, and Ravi Bhojwani'],
      ['Ankush Gera', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Tim Ferriss, Matt Mullenweg, Ankush Gera, JP Newman, Michael Fishman, and Ravi Bhojwani'],
      ['JP Newman', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Tim Ferriss, Matt Mullenweg, Ankush Gera, JP Newman, Michael Fishman, and Ravi Bhojwani'],
      ['Michael Fishman', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Tim Ferriss, Matt Mullenweg, Ankush Gera, JP Newman, Michael Fishman, and Ravi Bhojwani'],
      ['Ravi Bhojwani', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Tim Ferriss, Matt Mullenweg, Ankush Gera, JP Newman, Michael Fishman, and Ravi Bhojwani'],
    ],
  },
  {
    key: 'audited:critical-energy:seed:2026-06-19:22000000', startupId: '4dbef889-d546-47de-8737-d0c2b750498a', startupName: 'Critical Energy',
    roundType: 'Seed', amountUsd: 22_000_000, announcedAt: '2026-06-19T04:09:24Z', participantListComplete: true,
    sourceUrl: 'https://techcrunch.com/2026/06/17/spacex-alum-nabs-22m-to-turn-rocket-engines-into-geothermal-power-plants/',
    sourcePublisher: 'TechCrunch',
    sourceTitle: 'Critical Energy raises $22 million in seed funding', verificationStatus: 'verified',
    participants: [
      ['Susa Ventures', 'lead', 'LED_ROUND', 'seed rounds were led by Susa Ventures and Upfront Ventures'],
      ['Upfront Ventures', 'lead', 'LED_ROUND', 'seed rounds were led by Susa Ventures and Upfront Ventures'],
      ['MaC Venture Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from MaC Venture Capital, Susquehanna Sustainable Investments, Humba Ventures, Scribble Ventures, and Underground Ventures'],
      ['Susquehanna Sustainable Investments', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from MaC Venture Capital, Susquehanna Sustainable Investments, Humba Ventures, Scribble Ventures, and Underground Ventures'],
      ['Humba Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from MaC Venture Capital, Susquehanna Sustainable Investments, Humba Ventures, Scribble Ventures, and Underground Ventures'],
      ['Scribble Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from MaC Venture Capital, Susquehanna Sustainable Investments, Humba Ventures, Scribble Ventures, and Underground Ventures'],
      ['Underground Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from MaC Venture Capital, Susquehanna Sustainable Investments, Humba Ventures, Scribble Ventures, and Underground Ventures'],
      ['Silicon Valley Bank', 'participant', 'PARTICIPATED_IN_ROUND', '$3 million in venture debt from Silicon Valley Bank'],
    ],
  },
  {
    key: 'audited:tonada:pre-seed:2026-06-19:3000000', startupId: '13cb6334-7d6f-4f45-b162-e51160ba6c8e', startupName: 'Tonada',
    roundType: 'Pre-Seed', amountUsd: 3_000_000, announcedAt: '2026-06-19T00:37:38Z', participantListComplete: true,
    sourceUrl: 'https://www.tonada.com/blog/tonada-preseed',
    sourcePublisher: 'Tonada',
    sourceTitle: 'Tonada raises $3M in pre-seed founding to give every brand its own sound', verificationStatus: 'verified',
    participants: [
      ['Antler', 'lead', 'LED_ROUND', 'funding round was led by Antler'],
      ['Spintop Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'joined by Spintop Ventures, RTP Global, Triple A VC, and Karaoke Club'],
      ['RTP Global', 'participant', 'PARTICIPATED_IN_ROUND', 'joined by Spintop Ventures, RTP Global, Triple A VC, and Karaoke Club'],
      ['Triple A VC', 'participant', 'PARTICIPATED_IN_ROUND', 'joined by Spintop Ventures, RTP Global, Triple A VC, and Karaoke Club'],
      ['Karaoke Club', 'participant', 'PARTICIPATED_IN_ROUND', 'joined by Spintop Ventures, RTP Global, Triple A VC, and Karaoke Club'],
    ],
  },
  {
    key: 'audited:pure:seed:2026-07-16:8000000', startupId: 'c1679f76-c687-4051-b888-4b1c2ee35855', startupName: 'Pure',
    roundType: null, amountUsd: 8_000_000, announcedAt: '2026-07-16T03:01:07Z', participantListComplete: true,
    sourceUrl: 'https://www.finsmes.com/2026/07/pure-raises-8m-in-seed-funding.html',
    sourcePublisher: 'FinSMEs',
    sourceTitle: 'Pure Raises $8M in Seed Funding', verificationStatus: 'verified',
    participants: [
      ['Hidden Capital', 'lead', 'LED_ROUND', 'round was led by Hidden Capital'],
      ['MaC Venture Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'MaC Venture Capital, Ludlow Ventures, Goodwater Capital, SignalFire, Z Fellows, Jake Brooks, and Alex Pall'],
      ['Ludlow Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'MaC Venture Capital, Ludlow Ventures, Goodwater Capital, SignalFire, Z Fellows, Jake Brooks, and Alex Pall'],
      ['Goodwater Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'MaC Venture Capital, Ludlow Ventures, Goodwater Capital, SignalFire, Z Fellows, Jake Brooks, and Alex Pall'],
      ['SignalFire', 'participant', 'PARTICIPATED_IN_ROUND', 'MaC Venture Capital, Ludlow Ventures, Goodwater Capital, SignalFire, Z Fellows, Jake Brooks, and Alex Pall'],
      ['Z Fellows', 'participant', 'PARTICIPATED_IN_ROUND', 'MaC Venture Capital, Ludlow Ventures, Goodwater Capital, SignalFire, Z Fellows, Jake Brooks, and Alex Pall'],
      ['Jake Brooks', 'participant', 'PARTICIPATED_IN_ROUND', 'MaC Venture Capital, Ludlow Ventures, Goodwater Capital, SignalFire, Z Fellows, Jake Brooks, and Alex Pall'],
      ['Alex Pall', 'participant', 'PARTICIPATED_IN_ROUND', 'MaC Venture Capital, Ludlow Ventures, Goodwater Capital, SignalFire, Z Fellows, Jake Brooks, and Alex Pall'],
    ],
  },
  {
    key: 'audited:werize:pre-series-c:2026-06-04:7000000', startupId: '5a5b0673-335f-4949-950f-3ab8257daf42', startupName: 'Werize',
    roundType: null, amountUsd: 7_000_000, announcedAt: '2026-06-04T00:30:25Z', participantListComplete: true,
    sourceUrl: 'https://economictimes.indiatimes.com/tech/funding/fintech-werize-raises-7-million-led-by-sony-innovation-fund/articleshow/131488872.cms',
    sourcePublisher: 'The Economic Times',
    sourceTitle: 'Fintech WeRize raises $7 million led by Sony Innovation Fund', verificationStatus: 'verified',
    participants: [
      ['Sony Innovation Fund', 'lead', 'LED_ROUND', 'round led by Sony Innovation Fund'],
      ['3one4 Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from existing investor 3one4 Capital'],
    ],
  },
  {
    key: 'audited:aligned:series-b:2026-07-01:60000000', startupId: '3fd35ae6-f6c5-4201-a6a0-7f7da92340e5', startupName: 'Aligned',
    roundType: 'Series B', amountUsd: 60_000_000, announcedAt: '2026-07-01T14:40:01Z', participantListComplete: true,
    sourceUrl: 'https://www.globenewswire.com/news-release/2026/07/01/3320495/0/en/Aligned-Closes-60M-Series-B-to-Solidify-Leadership-Position-as-the-System-of-Action-for-B2B-Sales.html',
    sourcePublisher: 'Globe Newswire',
    sourceTitle: 'Aligned Closes $60M Series B to Solidify Leadership Position as the System of Action for B2B Sales', verificationStatus: 'verified',
    participants: [
      ['PeakSpan Capital', 'lead', 'LED_ROUND', 'round was led by PeakSpan Capital'],
      ['Hetz Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from all existing investors, Hetz Ventures, JAL Ventures and NFX'],
      ['JAL Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from all existing investors, Hetz Ventures, JAL Ventures and NFX'],
      ['NFX', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from all existing investors, Hetz Ventures, JAL Ventures and NFX'],
    ],
  },
  // Post-#48 mature unfunded unlock batch.
  {
    key: 'audited:titan:seed:2026-06-09:3000000', startupId: 'c1fd6c23-c2c5-40c8-81bc-4a13c96cad7b', startupName: 'Titan',
    roundType: 'Seed', amountUsd: 3_000_000, announcedAt: '2026-06-09T19:48:49Z', participantListComplete: true,
    sourceUrl: 'https://www.businesswire.com/news/home/20260609605347/en/Titan-Secures-3M-in-New-Funding-to-Further-Scale-Its-Banking-Native-AI-Platform-for-Financial-Services',
    sourcePublisher: 'Business Wire',
    sourceTitle: 'Titan Secures $3M in New Funding to Further Scale Its Banking Native AI Platform', verificationStatus: 'verified',
    participants: [
      ['Entropy Ventures', 'lead', 'LED_ROUND', 'new funding, led by Entropy Ventures'],
    ],
  },
  {
    key: 'audited:traversal:strategic:2026-03-05:5000000', startupId: 'c1f37131-cdb7-4b36-999a-0163854341ac', startupName: 'Traversal',
    roundType: 'Strategic', amountUsd: 5_000_000, announcedAt: '2026-03-05T06:28:10Z', participantListComplete: true,
    sourceUrl: 'https://siliconangle.com/2026/03/04/exclusive-american-express-partners-invests-ai-operations-startup-traversal/',
    sourcePublisher: 'SiliconANGLE',
    sourceTitle: 'Traversal Announces Strategic Investment from Amex Ventures', verificationStatus: 'verified',
    participants: [
      ['Amex Ventures', 'lead', 'LED_ROUND', 'strategic investment from Amex Ventures'],
    ],
  },
  {
    key: 'audited:rizon:pre-seed:2026-02-19:2000000', startupId: 'dac10255-df41-404d-8f21-224466672fbd', startupName: 'Rizon',
    roundType: 'Pre-Seed', amountUsd: 2_000_000, announcedAt: '2026-02-19T10:44:31Z', participantListComplete: true,
    sourceUrl: 'https://www.finsmes.com/2026/02/rizon-raises-2m-in-pre-seed-funding.html',
    sourcePublisher: 'FinSMEs',
    sourceTitle: 'Rizon Raises $2M in Pre-Seed Funding', verificationStatus: 'verified',
    participants: [
      ['Market One Capital', 'lead', 'LED_ROUND', 'investment from Market One Capital'],
    ],
  },
  {
    key: 'audited:coderabbit:series-c:2026-08-12:143000000', startupId: '2c6467e5-9f5b-4f87-a48c-bb281b8fc77b', startupName: 'Coderabbit',
    roundType: 'Series C', amountUsd: 143_000_000, announcedAt: '2026-08-12T00:00:00Z', participantListComplete: true,
    sourceUrl: 'https://siliconangle.com/2026/08/12/coderabbit-bags-143m-help-companies-get-grip-explosion-ai-generated-code/',
    sourcePublisher: 'SiliconANGLE',
    sourceTitle: 'CodeRabbit raises $143M in Series C funding', verificationStatus: 'verified',
    participants: [
      ['Atomico', 'lead', 'LED_ROUND', 'round was co-led by Atomico and Smash Capital'],
      ['Smash Capital', 'co_lead', 'CO_LED_ROUND', 'round was co-led by Atomico and Smash Capital'],
      ['BMW i Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from BMW i Ventures, Datadog, Hirtle Callaghan, SineWave Ventures, and Scenic Management'],
      ['Datadog', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from BMW i Ventures, Datadog, Hirtle Callaghan, SineWave Ventures, and Scenic Management'],
      ['Hirtle Callaghan', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from BMW i Ventures, Datadog, Hirtle Callaghan, SineWave Ventures, and Scenic Management'],
      ['SineWave Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from BMW i Ventures, Datadog, Hirtle Callaghan, SineWave Ventures, and Scenic Management'],
      ['Scenic Management', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from BMW i Ventures, Datadog, Hirtle Callaghan, SineWave Ventures, and Scenic Management'],
      ['CRV', 'participant', 'PARTICIPATED_IN_ROUND', 'existing investors including CRV, Scale Venture Partners, and Flex Capital'],
      ['Scale Venture Partners', 'participant', 'PARTICIPATED_IN_ROUND', 'existing investors including CRV, Scale Venture Partners, and Flex Capital'],
      ['Flex Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'existing investors including CRV, Scale Venture Partners, and Flex Capital'],
      ['Pelion Venture Partners', 'participant', 'PARTICIPATED_IN_ROUND', 'existing investors Pelion Venture Partners, Harmony Partners, and Engineering Capital'],
      ['Harmony Partners', 'participant', 'PARTICIPATED_IN_ROUND', 'existing investors Pelion Venture Partners, Harmony Partners, and Engineering Capital'],
      ['Engineering Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'existing investors Pelion Venture Partners, Harmony Partners, and Engineering Capital'],
    ],
  },
  // Post-#49 mature unfunded gap batch.
  {
    key: 'audited:kinfolk:seed:2026-03-09:7000000', startupId: 'e7dfb45d-60cf-4ebd-a26c-1adcb4a29925', startupName: 'Kinfolk',
    roundType: 'Seed', amountUsd: 7_000_000, announcedAt: '2026-03-09T15:49:19Z', participantListComplete: true,
    sourceUrl: 'https://tech.eu/2026/02/25/kinfolk-closes-7m-seed-round-for-ai-driven-hr-platform/',
    sourcePublisher: 'Tech.eu',
    sourceTitle: 'Kinfolk raises $7M in seed funding led by AlbionVC', verificationStatus: 'verified',
    participants: [
      ['AlbionVC', 'lead', 'LED_ROUND', 'seed round led by AlbionVC'],
      ['PROfounders Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from PROfounders Capital, Ascension, and Emerge'],
      ['Ascension', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from PROfounders Capital, Ascension, and Emerge'],
      ['Emerge', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from PROfounders Capital, Ascension, and Emerge'],
    ],
  },
  {
    key: 'audited:beycome:seed:2026-02-06:2500000', startupId: 'f8856c77-bc5b-4741-ba91-89345df4960d', startupName: 'Beycome',
    roundType: 'Seed', amountUsd: 2_500_000, announcedAt: '2026-02-06T05:15:00Z', participantListComplete: true,
    sourceUrl: 'https://www.prnewswire.com/news-releases/beycome-closes-2-5m-seed-round-led-by-insurtech-fund-302647050.html',
    sourcePublisher: 'PR Newswire',
    sourceTitle: 'Beycome raises $2.5 million in seed funding led by InsurTech Fund', verificationStatus: 'verified',
    participants: [
      ['InsurTech Fund', 'lead', 'LED_ROUND', 'round is led by InsurTech Fund'],
      ['Pivot Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Pivot Ventures, the Florida Opportunity Fund, RedShift Capital, Neer Venture Capital, Kima Ventures, Ignite Venture, and Founders Future'],
      ['Florida Opportunity Fund', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Pivot Ventures, the Florida Opportunity Fund, RedShift Capital, Neer Venture Capital, Kima Ventures, Ignite Venture, and Founders Future'],
      ['RedShift Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Pivot Ventures, the Florida Opportunity Fund, RedShift Capital, Neer Venture Capital, Kima Ventures, Ignite Venture, and Founders Future'],
      ['Neer Venture Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Pivot Ventures, the Florida Opportunity Fund, RedShift Capital, Neer Venture Capital, Kima Ventures, Ignite Venture, and Founders Future'],
      ['Kima Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Pivot Ventures, the Florida Opportunity Fund, RedShift Capital, Neer Venture Capital, Kima Ventures, Ignite Venture, and Founders Future'],
      ['Ignite Venture', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Pivot Ventures, the Florida Opportunity Fund, RedShift Capital, Neer Venture Capital, Kima Ventures, Ignite Venture, and Founders Future'],
      ['Founders Future', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Pivot Ventures, the Florida Opportunity Fund, RedShift Capital, Neer Venture Capital, Kima Ventures, Ignite Venture, and Founders Future'],
    ],
  },
  {
    key: 'audited:novee:series-a:2026-02-11:51500000', startupId: '6ab716c2-c04b-4719-b162-e861568466cd', startupName: 'Novee',
    roundType: 'Series A', amountUsd: 51_500_000, announcedAt: '2026-02-11T07:30:12Z', participantListComplete: true,
    sourceUrl: 'https://novee.security/blog/novee-raises-51-5m-to-transform-offensive-security/',
    sourcePublisher: 'Novee',
    sourceTitle: 'Novee raises $51.5 million in Series A funding', verificationStatus: 'verified',
    participants: [
      ['YL Ventures', 'lead', 'LED_ROUND', 'rounds led by YL Ventures, Canaan Partners, and Oren Zeev'],
      ['Canaan Partners', 'co_lead', 'CO_LED_ROUND', 'rounds led by YL Ventures, Canaan Partners, and Oren Zeev'],
      ['Zeev Ventures', 'co_lead', 'CO_LED_ROUND', 'rounds led by YL Ventures, Canaan Partners, and investor Oren Zeev through Zeev Ventures'],
      ['Cyber Club London', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Cyber Club London and Squared Circle Ventures'],
      ['Squared Circle Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Cyber Club London and Squared Circle Ventures'],
    ],
  },
  {
    key: 'audited:claroty:series-f:2026-02-22:150000000', startupId: '9c9ac577-4e59-4765-b293-dc55b0446aee', startupName: 'Claroty',
    roundType: 'Series F', amountUsd: 150_000_000, announcedAt: '2026-02-22T22:36:58Z', participantListComplete: true,
    sourceUrl: 'https://www.prnewswire.com/news-releases/claroty-secures-150-million-in-series-f-funding-to-lead-charge-on-securing-the-worlds-mission-critical-infrastructure-302667496.html',
    sourcePublisher: 'PR Newswire',
    sourceTitle: 'Claroty secures $150 million in Series F funding led by Golub Growth', verificationStatus: 'verified',
    participants: [
      ['Golub Growth', 'lead', 'LED_ROUND', 'Series F funding led by Golub Growth, an affiliate of Golub Capital'],
    ],
  },
  {
    key: 'audited:skeleton:series-f:2026-05-08:39000000', startupId: '316aee87-33d3-4d59-a878-2ab44f4c2f1d', startupName: 'Skeleton',
    roundType: 'Series F', amountUsd: 39_000_000, announcedAt: '2026-05-08T10:55:07Z', participantListComplete: true,
    sourceUrl: 'https://www.skeletontech.com/news/skeleton-announces-first-close-of-pre-ipo-funding-round',
    sourcePublisher: 'Skeleton Technologies',
    sourceTitle: 'Skeleton Technologies raises €33 million in Series F funding', verificationStatus: 'verified',
    participants: [
      ['Axon Partners Group', 'participant', 'PARTICIPATED_IN_ROUND', 'addition of Axon Partners Group, SmartCap, and Taiwania Capital'],
      ['SmartCap', 'participant', 'PARTICIPATED_IN_ROUND', 'addition of Axon Partners Group, SmartCap, and Taiwania Capital'],
      ['Taiwania Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'addition of Axon Partners Group, SmartCap, and Taiwania Capital'],
      ['CBMM', 'participant', 'PARTICIPATED_IN_ROUND', 'Existing investor CBMM also joined the round'],
    ],
  },
  {
    key: 'audited:airmo:seed:2026-04-13:5400000', startupId: '2e4d721f-6f1c-4b60-b5d0-7cb4d1064ed5', startupName: 'AIRMO',
    roundType: 'Seed', amountUsd: 5_400_000, announcedAt: '2026-04-13T10:31:57Z', participantListComplete: true,
    sourceUrl: 'https://www.airmo.io/newsroom/airmo-raises-eu5m-seed-funding',
    sourcePublisher: 'AIRMO',
    sourceTitle: 'AIRMO raises €5 million in seed funding led by Ananda Impact Ventures', verificationStatus: 'verified',
    participants: [
      ['Ananda Impact Ventures', 'lead', 'LED_ROUND', 'funding round was led by Ananda Impact Ventures'],
      ['Unconventional Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Unconventional Ventures, kopa ventures, Desai Ventures, and Hypernova'],
      ['kopa ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Unconventional Ventures, kopa ventures, Desai Ventures, and Hypernova'],
      ['Desai Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Unconventional Ventures, kopa ventures, Desai Ventures, and Hypernova'],
      ['Antler', 'participant', 'PARTICIPATED_IN_ROUND', 'Existing investors Antler, Findus Ventures, E2MC, and Pi Labs also participated'],
      ['Findus Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'Existing investors Antler, Findus Ventures, E2MC, and Pi Labs also participated'],
      ['E2MC', 'participant', 'PARTICIPATED_IN_ROUND', 'Existing investors Antler, Findus Ventures, E2MC, and Pi Labs also participated'],
      ['Pi Labs', 'participant', 'PARTICIPATED_IN_ROUND', 'Existing investors Antler, Findus Ventures, E2MC, and Pi Labs also participated'],
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

main().catch((error) => {
  console.error(error.stack || error.message);
  if (error?.cause) console.error('Cause:', error.cause);
  if (/fetch failed/i.test(String(error?.message))) {
    console.error('Hint: transient Supabase/network — run node scripts/supabase-probe.mjs then retry');
  }
  process.exitCode = 1;
});
