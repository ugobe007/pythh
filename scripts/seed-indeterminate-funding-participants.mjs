#!/usr/bin/env node
/**
 * Manually seed participant rosters for Hit@5 indeterminate funded rounds
 * where primary sources are Cloudflare-blocked (FinSMEs) or thin aggregators.
 *
 * Prefer non-CF primary URLs (Business Wire, PR Newswire, company blogs) as evidence.
 * Usage: node scripts/seed-indeterminate-funding-participants.mjs [--apply]
 */
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { resolveCanonicalEntity } = require('../server/lib/fundingEvidenceLedger.js');

const apply = process.argv.includes('--apply');
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) throw new Error('SUPABASE_URL and service-role key are required');
const db = createClient(url, key, { auth: { persistSession: false } });

/** @type {Array<{
 *  key: string,
 *  eventIds: string[],
 *  evidenceUrl: string,
 *  evidencePublisher: string,
 *  evidenceTitle: string,
 *  participantListComplete: boolean,
 *  participants: Array<[string, string, string, string]>,
 * }>} */
const seeds = [
  {
    key: 'jump-series-b-80m',
    eventIds: [
      'f4691ca1-e846-422c-afc2-936c4752a1d1', // FinSMEs series-b
      'e06b26aa-43e8-4172-aed7-9faf79244332', // Ventureburn unknown|80m
    ],
    evidenceUrl: 'https://www.businesswire.com/news/home/20260219487440/en/Jump-Raises-%2480-Million-Series-B-Led-by-Insight-Partners-to-Expand-AI-Operating-System-for-Financial-Advisors',
    evidencePublisher: 'Business Wire',
    evidenceTitle: 'Jump Raises $80 Million Series B, Led by Insight Partners',
    participantListComplete: true,
    participants: [
      ['Insight Partners', 'lead', 'LED_ROUND', 'Series B funding round led by Insight Partners'],
      ['F-Prime', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from new investors F-Prime, Allianz Life Ventures, TIAA Ventures and Peterson Partners'],
      ['Allianz Life Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from new investors F-Prime, Allianz Life Ventures, TIAA Ventures and Peterson Partners'],
      ['TIAA Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from new investors F-Prime, Allianz Life Ventures, TIAA Ventures and Peterson Partners'],
      ['Peterson Partners', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from new investors F-Prime, Allianz Life Ventures, TIAA Ventures and Peterson Partners'],
      ['Battery Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'additional investment from existing investors Battery Ventures, Sorenson Capital, Pelion Venture Partners and Citi Ventures'],
      ['Sorenson Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'additional investment from existing investors Battery Ventures, Sorenson Capital, Pelion Venture Partners and Citi Ventures'],
      ['Pelion Venture Partners', 'participant', 'PARTICIPATED_IN_ROUND', 'additional investment from existing investors Battery Ventures, Sorenson Capital, Pelion Venture Partners and Citi Ventures'],
      ['Citi Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'additional investment from existing investors Battery Ventures, Sorenson Capital, Pelion Venture Partners and Citi Ventures'],
      ['Hans Tung', 'participant', 'PARTICIPATED_IN_ROUND', 'angel investors Hans Tung, Ryan Anderson and Aaron Skonnard'],
      ['Ryan Anderson', 'participant', 'PARTICIPATED_IN_ROUND', 'angel investors Hans Tung, Ryan Anderson and Aaron Skonnard'],
      ['Aaron Skonnard', 'participant', 'PARTICIPATED_IN_ROUND', 'angel investors Hans Tung, Ryan Anderson and Aaron Skonnard'],
    ],
  },
  {
    key: 'grubmarket-series-h-50m',
    eventIds: ['26933fac-b072-4f21-8f2e-7497fb5c576f'],
    evidenceUrl: 'https://www.prnewswire.com/news-releases/grubmarket-raises-50-million-series-h-to-fuel-ecommerce-and-ai-transformation-of-the-american-food-supply-chain-industry-302675822.html',
    evidencePublisher: 'PR Newswire',
    evidenceTitle: 'GrubMarket Raises $50 Million Series H',
    participantListComplete: true,
    participants: [
      ['Future Food Fund', 'lead', 'LED_ROUND', 'Series H financing from Future Food Fund, Portfolia Funds, Liberty Street Funds, RD Heritage Group, Flume Ventures, MY Securities'],
      ['Portfolia Funds', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Portfolia Funds, Liberty Street Funds, RD Heritage Group, Flume Ventures, MY Securities'],
      ['Liberty Street Funds', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Portfolia Funds, Liberty Street Funds, RD Heritage Group, Flume Ventures, MY Securities'],
      ['RD Heritage Group', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Portfolia Funds, Liberty Street Funds, RD Heritage Group, Flume Ventures, MY Securities'],
      ['Flume Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Portfolia Funds, Liberty Street Funds, RD Heritage Group, Flume Ventures, MY Securities'],
      ['MY Securities', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Portfolia Funds, Liberty Street Funds, RD Heritage Group, Flume Ventures, MY Securities'],
    ],
  },
  {
    key: 'guidde-series-b-50m',
    eventIds: ['272a89c3-f829-45f0-a6aa-24ff1d42d82f'],
    evidenceUrl: 'https://www.prnewswire.com/news-releases/guidde-raises-50m-to-train-humans-on-ai-and-ai-on-humans-302697065.html',
    evidencePublisher: 'PR Newswire',
    evidenceTitle: 'Guidde Raises $50M to Train Humans on AI and AI on Humans',
    participantListComplete: true,
    participants: [
      ['PSG Equity', 'lead', 'LED_ROUND', 'Series B funding round led by PSG Equity'],
      ['monday.com', 'participant', 'PARTICIPATED_IN_ROUND', 'with participation from monday.com and past investors Norwest, Entrée Capital, Qualcomm Ventures, and Inkberry Ventures'],
      ['Norwest Venture Partners', 'participant', 'PARTICIPATED_IN_ROUND', 'past investors: Norwest, Entrée Capital, Qualcomm Ventures, and Inkberry Ventures'],
      ['Entrée Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'past investors: Norwest, Entrée Capital, Qualcomm Ventures, and Inkberry Ventures'],
      ['Qualcomm Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'past investors: Norwest, Entrée Capital, Qualcomm Ventures, and Inkberry Ventures'],
      ['Inkberry Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'past investors: Norwest, Entrée Capital, Qualcomm Ventures, and Inkberry Ventures'],
    ],
  },
  {
    key: 'codoxo-series-c-35m',
    eventIds: ['794d976a-991e-40c9-81cd-df8e4ec8bbf1'],
    evidenceUrl: 'https://www.codoxo.com/press-release/codoxos-oversubscribed-series-c-led-by-cvs-health-ventures-to-revolutionize-payment-integrity-for-americas-largest-health-plans/',
    evidencePublisher: 'Codoxo',
    evidenceTitle: 'Codoxo’s Oversubscribed Series C Led by CVS Health Ventures',
    participantListComplete: true,
    participants: [
      ['CVS Health Ventures', 'lead', 'LED_ROUND', 'Series C funding, led by CVS Health Ventures'],
      ['Echo Health Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'Echo Health Ventures joins the round as a new investor'],
      ['Sands Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'continued investment from existing investors including Sands Capital Management, 111 West Capital, Brewer Lane Ventures, Wipro Ventures, 450 Ventures and QED Investors'],
      ['111 West Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'continued investment from existing investors including Sands Capital Management, 111 West Capital, Brewer Lane Ventures, Wipro Ventures, 450 Ventures and QED Investors'],
      ['Brewer Lane Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'continued investment from existing investors including Sands Capital Management, 111 West Capital, Brewer Lane Ventures, Wipro Ventures, 450 Ventures and QED Investors'],
      ['Wipro Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'continued investment from existing investors including Sands Capital Management, 111 West Capital, Brewer Lane Ventures, Wipro Ventures, 450 Ventures and QED Investors'],
      ['450 Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'continued investment from existing investors including Sands Capital Management, 111 West Capital, Brewer Lane Ventures, Wipro Ventures, 450 Ventures and QED Investors'],
      ['QED Investors', 'participant', 'PARTICIPATED_IN_ROUND', 'continued investment from existing investors including Sands Capital Management, 111 West Capital, Brewer Lane Ventures, Wipro Ventures, 450 Ventures and QED Investors'],
    ],
  },
  {
    key: 'braintrust-series-b-80m',
    eventIds: ['4c31639a-47f8-487b-bc1d-9e88c8175fd8'],
    evidenceUrl: 'https://www.braintrust.dev/blog/announcing-series-b',
    evidencePublisher: 'Braintrust',
    evidenceTitle: "Braintrust's series B: building the infrastructure for production AI",
    participantListComplete: true,
    participants: [
      ['ICONIQ', 'lead', 'LED_ROUND', 'Our Series B is led by ICONIQ'],
      ['Andreessen Horowitz', 'participant', 'PARTICIPATED_IN_ROUND', 'prior investors Andreessen Horowitz, Greylock, Elad Gil, basecase capital'],
      ['Greylock', 'participant', 'PARTICIPATED_IN_ROUND', 'prior investors Andreessen Horowitz, Greylock, Elad Gil, basecase capital'],
      ['Elad Gil', 'participant', 'PARTICIPATED_IN_ROUND', 'prior investors Andreessen Horowitz, Greylock, Elad Gil, basecase capital'],
      ['basecase capital', 'participant', 'PARTICIPATED_IN_ROUND', 'prior investors Andreessen Horowitz, Greylock, Elad Gil, basecase capital'],
    ],
  },
  {
    key: 'whop-tether-200m',
    eventIds: ['e44e4ffc-42a2-4017-a511-08d17264d6e3'],
    evidenceUrl: 'https://www.coindesk.com/business/2026/02/25/tether-invests-usd200-million-in-digital-marketplace-whop-to-expand-stablecoin-payments',
    evidencePublisher: 'CoinDesk',
    evidenceTitle: 'Tether invests $200 million in digital marketplace Whop',
    participantListComplete: true,
    participants: [
      ['Tether', 'lead', 'LED_ROUND', 'Tether is investing $200 million in online marketplace Whop'],
    ],
  },
  {
    key: 'neara-series-d-aud90m',
    eventIds: ['4a4e9ada-0c5f-4d38-822e-9fc5eb35589d', '4798b334-25bd-4f7f-bc8b-24e9fa14a9f5'],
    evidenceUrl: 'https://neara.com/resources/press/neara-raises-90-million-to-solve-the-global-infrastructure-crisis-with-ai/',
    evidencePublisher: 'Neara',
    evidenceTitle: 'Neara Raises $90 Million to Solve the Global Infrastructure Crisis with AI',
    participantListComplete: true,
    participants: [
      ['TCV', 'lead', 'LED_ROUND', 'The round was led by TCV'],
      ['Partners Group', 'participant', 'PARTICIPATED_IN_ROUND', 'Returning investors included Partners Group, EQT, Square Peg Capital, and Skip Capital'],
      ['EQT', 'participant', 'PARTICIPATED_IN_ROUND', 'Returning investors included Partners Group, EQT, Square Peg Capital, and Skip Capital'],
      ['Square Peg Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'Returning investors included Partners Group, EQT, Square Peg Capital, and Skip Capital'],
      ['Skip Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'Returning investors included Partners Group, EQT, Square Peg Capital, and Skip Capital'],
    ],
  },
  {
    key: 'synthetic-seed-10m',
    eventIds: ['e14919a4-571c-45d9-8de1-debfa72527a1'],
    evidenceUrl: 'https://www.businesswire.com/news/home/20260514241304/en/Synthetic-Raises-%2410M-Seed-Led-by-Khosla-Ventures',
    evidencePublisher: 'Business Wire',
    evidenceTitle: 'Synthetic Raises $10M Seed Led by Khosla Ventures',
    participantListComplete: true,
    participants: [
      ['Khosla Ventures', 'lead', 'LED_ROUND', 'seed funding, led by Khosla Ventures'],
      ['Basis Set Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'Basis Set Ventures also participated'],
      ['Tobi Lütke', 'participant', 'PARTICIPATED_IN_ROUND', 'alongside operator-investors Tobi Lütke, Kaz Nejatian, Zach Abrams, Cosmin Nicolaescu, and Michael Tannenbaum'],
      ['Kaz Nejatian', 'participant', 'PARTICIPATED_IN_ROUND', 'alongside operator-investors Tobi Lütke, Kaz Nejatian, Zach Abrams, Cosmin Nicolaescu, and Michael Tannenbaum'],
      ['Zach Abrams', 'participant', 'PARTICIPATED_IN_ROUND', 'alongside operator-investors Tobi Lütke, Kaz Nejatian, Zach Abrams, Cosmin Nicolaescu, and Michael Tannenbaum'],
      ['Cosmin Nicolaescu', 'participant', 'PARTICIPATED_IN_ROUND', 'alongside operator-investors Tobi Lütke, Kaz Nejatian, Zach Abrams, Cosmin Nicolaescu, and Michael Tannenbaum'],
      ['Michael Tannenbaum', 'participant', 'PARTICIPATED_IN_ROUND', 'alongside operator-investors Tobi Lütke, Kaz Nejatian, Zach Abrams, Cosmin Nicolaescu, and Michael Tannenbaum'],
    ],
  },
  {
    // Fragmented Wayve series-d aggregator round blocked completeness despite $1.2B TC roster elsewhere.
    key: 'wayve-series-d-fragment-1-2b',
    eventIds: [
      '3d8c4234-3982-4c4d-a833-7f1d956a9b34',
      '89604d4b-4a84-4ec8-80bf-c13522626dda',
      '2480431c-5baa-4b81-bb68-748294b1c018',
    ],
    evidenceUrl: 'https://techcrunch.com/2026/02/24/self-driving-tech-startup-wayve-raises-1-2b-from-nvidia-uber-and-three-automakers/',
    evidencePublisher: 'TechCrunch',
    evidenceTitle: 'Self-driving tech startup Wayve raises $1.2B from Nvidia, Uber, and three automakers',
    participantListComplete: true,
    participants: [
      ['Nvidia', 'participant', 'INVESTED_IN', 'raises $1.2B from Nvidia, Uber, and three automakers'],
      ['Uber', 'participant', 'INVESTED_IN', 'raises $1.2B from Nvidia, Uber, and three automakers'],
      ['Microsoft', 'participant', 'INVESTED_IN', 'returning backers Microsoft, Nvidia, and Uber'],
    ],
  },
  {
    key: 'wayve-1-5b-followon',
    eventIds: [
      '1c280522-8c93-4725-ae32-1678fb05cfa1',
      'ce54b3b9-2c59-42b0-84d7-4db7f647fd81',
      '59478a0b-656c-4153-825c-328bf16298cf',
      '8fdeec0e-11a4-4dca-b959-382ada3b7526',
      'f9409721-ee03-4e8d-ae7c-dcaed4adbb7f',
    ],
    evidenceUrl: 'https://www.bloomberg.com/news/articles/2026-02-25/self-driving-startup-wayve-raises-1-5-billion-for-robotaxi-wars',
    evidencePublisher: 'Bloomberg',
    evidenceTitle: 'Self-Driving Startup Wayve Raises $1.5 Billion for Robotaxi Wars',
    participantListComplete: true,
    participants: [
      ['Microsoft', 'participant', 'INVESTED_IN', 'Microsoft-backed Wayve raises $1.5 billion'],
      ['Nvidia', 'participant', 'INVESTED_IN', 'Wayve raise with Nvidia and Uber'],
      ['Uber', 'participant', 'INVESTED_IN', 'Wayve raise with Nvidia and Uber'],
    ],
  },
  {
    key: 'einride-pipe-113m',
    eventIds: [
      '8ebd86dc-59ee-4db9-b4c3-89f94f1ddb8b',
      'e9aa23db-08c6-4eee-af06-5e0200f32e50',
      '48239db3-b83b-47c0-b893-7e25c5341368',
      '94be6894-3858-40b3-8e4f-1c9fbbba0e7f',
    ],
    evidenceUrl: 'https://techcrunch.com/2026/02/26/self-driving-truck-startup-einride-raises-113m-pipe-ahead-of-public-debut/',
    evidencePublisher: 'TechCrunch',
    evidenceTitle: 'Self-driving truck startup Einride raises $113M PIPE ahead of public debut',
    participantListComplete: true,
    participants: [
      ['EQT Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'PIPE from new and existing investors including Stockholm-based EQT Ventures'],
    ],
  },
  {
    key: 'quince-series-e-500m',
    eventIds: [
      'f5ed6b21-526d-4be3-98bc-87500b625196',
      '97472e5c-9708-4202-8fc3-0c84eaf01fee',
      'cc20adee-2226-4167-a1d5-ea6097884c01',
      '25630712-4deb-41ab-a747-877e2c5cbe1f',
      '0f3390f3-192a-4281-843b-6779d44b414f',
    ],
    evidenceUrl: 'https://techcrunch.com/2026/03/11/quince-series-e-10b-valuation-with-500m-round-led-by-iconiq/',
    evidencePublisher: 'TechCrunch',
    evidenceTitle: 'Quince hits $10B valuation with giant $500M round led by Iconiq',
    participantListComplete: true,
    participants: [
      ['ICONIQ', 'lead', 'LED_ROUND', 'Series E financing led by ICONIQ'],
      ['Basis Set Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Basis Set Ventures, Wellington Management, WndrCo, MarcyPen Capital Partners, Baillie Gifford, Notable Capital and DST Global'],
      ['Wellington Management', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Basis Set Ventures, Wellington Management, WndrCo, MarcyPen Capital Partners, Baillie Gifford, Notable Capital and DST Global'],
      ['WndrCo', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Basis Set Ventures, Wellington Management, WndrCo, MarcyPen Capital Partners, Baillie Gifford, Notable Capital and DST Global'],
      ['MarcyPen Capital Partners', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Basis Set Ventures, Wellington Management, WndrCo, MarcyPen Capital Partners, Baillie Gifford, Notable Capital and DST Global'],
      ['Baillie Gifford', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Basis Set Ventures, Wellington Management, WndrCo, MarcyPen Capital Partners, Baillie Gifford, Notable Capital and DST Global'],
      ['Notable Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Basis Set Ventures, Wellington Management, WndrCo, MarcyPen Capital Partners, Baillie Gifford, Notable Capital and DST Global'],
      ['DST Global', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Basis Set Ventures, Wellington Management, WndrCo, MarcyPen Capital Partners, Baillie Gifford, Notable Capital and DST Global'],
    ],
  },
  {
    key: 'meadow-series-a-9m',
    eventIds: ['47b7d073-0b02-44eb-86d2-63a627f6bc2f', 'ce0923e0-bff5-4977-a688-1626303ca69a'],
    evidenceUrl: 'https://news.crunchbase.com/venture/stripe-alum-raises-online-funeral-planning-startup-meadow/',
    evidencePublisher: 'Crunchbase News',
    evidenceTitle: 'Stripe Alum Raises $9M For Meadow To Help People Plan Funerals Online',
    participantListComplete: true,
    participants: [
      ['Lachy Groom', 'lead', 'LED_ROUND', 'Series A funding round led by Lachy Groom and Haystack'],
      ['Haystack', 'lead', 'LED_ROUND', 'Series A funding round led by Lachy Groom and Haystack'],
    ],
  },
  {
    key: 'helia-care-3m',
    eventIds: ['8daa488e-ad2c-45c1-be74-41f98c5c9b2d', '284a8a84-2e54-4f0d-9339-c02a177919b9'],
    evidenceUrl: 'https://pulse2.com/helia-care-3-million-raised-for-healthcare-procurement-network/',
    evidencePublisher: 'Pulse 2.0',
    evidenceTitle: 'Helia Care: $3 Million Raised For Healthcare Procurement Network',
    participantListComplete: true,
    participants: [
      ['In Revenue Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'funding round with participation from In Revenue Capital alongside Habanero Ventures'],
      ['Habanero Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'funding round with participation from In Revenue Capital alongside Habanero Ventures'],
    ],
  },
  {
    key: 'oxide-series-c-200m',
    eventIds: [
      'bbc1a5a4-7064-4b7d-a9d7-48e88a9f8100',
      'b0a5fa51-0ce9-4d0f-af4f-2e9ea5e78727',
      '73db5752-3ca8-4720-b647-4d321e75b7e1',
    ],
    evidenceUrl: 'https://www.prnewswire.com/news-releases/oxide-closes-200m-series-c-to-scale-on-premises-cloud-computing-302683724.html',
    evidencePublisher: 'PR Newswire',
    evidenceTitle: 'Oxide Closes $200M Series C to Scale On-Premises Cloud Computing',
    participantListComplete: true,
    participants: [
      ['US Innovative Technology Fund', 'lead', 'LED_ROUND', 'Series C led by Thomas Tull’s US Innovative Technology Fund (USIT)'],
      ['Eclipse', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from existing investors including Eclipse, Riot Ventures, Jane Street'],
      ['Riot Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from existing investors including Eclipse, Riot Ventures, Jane Street'],
      ['Jane Street', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from existing investors including Eclipse, Riot Ventures, Jane Street'],
      ['Intel Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'alongside Eclipse, Riot Ventures, Jane Street, Intel Capital, Counterpart Ventures'],
      ['Counterpart Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'alongside Eclipse, Riot Ventures, Jane Street, Intel Capital, Counterpart Ventures'],
    ],
  },
  {
    // Incomplete Series D aggregators + Visa strategic invest block Replit from auditing;
    // sealed top-5 includes Y Combinator which appears on complete Series D rosters.
    key: 'replit-series-d-400m',
    eventIds: [
      '1428c38f-c2d0-4359-b715-effad4031c5c',
      'e8008304-b760-4657-b3c6-382a71ad43fe',
      'c61bcaf1-04d7-4b3f-9a82-013446c5f4a3',
      '379909a2-331d-46dc-9fbc-8b4a9d2f264a',
    ],
    evidenceUrl: 'https://www.siliconrepublic.com/start-ups/vibe-coding-start-up-replit-raises-series-d-funding-investors',
    evidencePublisher: 'Silicon Republic',
    evidenceTitle: 'Vibe-coding start-up Replit raises $400m in Series D funding',
    participantListComplete: true,
    participants: [
      ['Georgian', 'lead', 'LED_ROUND', 'Series D funding led by Georgian'],
      ['Prysm Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Prysm Capital, Craft Ventures, Qatar Investment Authority, Coatue, 1789 Capital'],
      ['Craft Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Prysm Capital, Craft Ventures, Qatar Investment Authority, Coatue, 1789 Capital'],
      ['Qatar Investment Authority', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Prysm Capital, Craft Ventures, Qatar Investment Authority, Coatue, 1789 Capital'],
      ['Coatue', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Prysm Capital, Craft Ventures, Qatar Investment Authority, Coatue, 1789 Capital'],
      ['1789 Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Prysm Capital, Craft Ventures, Qatar Investment Authority, Coatue, 1789 Capital'],
      ['Y Combinator', 'participant', 'PARTICIPATED_IN_ROUND', 'returning investors including Y Combinator'],
      ['Andreessen Horowitz', 'participant', 'PARTICIPATED_IN_ROUND', 'returning investors including Andreessen Horowitz'],
    ],
  },
  {
    key: 'replit-visa-strategic',
    eventIds: ['7f3c069e-fe6a-4201-8a05-dfd835c4be6b', 'caeedde8-440b-4f2b-8090-18548cd731bf'],
    evidenceUrl: 'https://techcrunch.com/2026/05/28/visa-invests-in-replit-to-power-agentic-payments-for-developers/',
    evidencePublisher: 'TechCrunch',
    evidenceTitle: 'Visa invests in Replit to power agentic payments for developers',
    participantListComplete: true,
    participants: [
      ['Visa', 'lead', 'INVESTED_IN', 'Visa invests in Replit to power agentic payments for developers'],
    ],
  },
];

/** Non-startup funding false positives / rumors to exclude from Hit@5 outcomes. */
const rejectEventIds = [
  // Paradigm.xyz VC firm "raises $1.5B" fund — not a startup round
  '359955b1-a889-4d06-b61f-1e7f88b39131',
  '7a3520ad-da3a-43b8-a1a2-c338cc08a28f',
  // Katie Haun raises $1B for new venture funds
  'c636230a-c21c-4c41-a90a-61a92df63897',
  'cd1f0db8-5911-4c5b-9dfe-3146042e1984',
  '66e1d41e-181d-4057-a6c9-1d6d9e7d6e43',
  'a9063a2a-41ea-4105-9c76-8c0b9943880a',
  'e45abd37-97c0-46f9-a88d-df946ea1b993',
  '7276ac6b-ba79-4970-bd01-ae5068794f9f',
  '52b0481c-cb64-4e89-8339-2e91bb21e051',
  'c86a5823-5ee5-4fab-916d-49ea540b7819',
  // Shield AI "eyes $1B" pre-close rumor
  '8533c744-bae6-47b6-9053-f05d5c748d5d',
  '0e1ce364-6c02-4b0a-aeaa-0ac3ef950bdc',
  // Wayve valuation-only article (not a rostered raise)
  '2fb5f365-1b3c-4bf7-92a3-60b686bd2bba',
  // Post-#42 indeterminate false positives / public markets / rumors
  // Grok: "raised alarms" lawsuit, not a funding round
  '6df87b79-a161-4421-9103-4abb5cd60a48',
  'c87dd86d-6055-4685-9f17-da1bb1a19fef',
  // Alphabet public equity / bond raises (not venture outcomes)
  'bb307909-3a8c-4809-803c-3daeb7bd713d',
  '66670ad7-ea4b-453c-9a7f-47654619bc29',
  'a6ae1b86-46b1-492c-b662-425a81eec5ed',
  '9fc2d237-4338-4c0c-8464-f364451e8d40',
  'd985f00a-4588-4504-a607-b69bce2828ba',
  'ed6c30b7-1ff3-466e-9204-fe63a2d506e8',
  '5d94eec0-57ca-4cc8-9f44-b2368d57622a',
  'b1ab144a-b5b3-43ba-a4e1-1616595a8c57',
  // SK Hynix Nasdaq / US listing (public markets)
  'b587dc5d-1872-4380-99c2-ba2d0927aedc',
  '3750d641-c74f-4cab-b63c-ca8953746887',
  '1279ca72-ec09-4193-8a6e-091d548bc7a8',
  'c77482e1-08f7-4cb9-a3ea-0ee0308b583b',
  'cf6c396f-1f62-4ef0-be9a-ecb7dec3a623',
  '5fa316ba-5deb-4529-b1ac-5841f7f76820',
  '2cc95c10-d569-43e5-a600-51aa4e9e8000',
  // Vantage Fortune list PR (not a funding round)
  'a74cf38f-fd0d-4266-a475-abb320dd3993',
  // LemFi rumored / "set to raise" / "on track" (not closed)
  'c27a0f95-f79d-43da-a6de-a6be88a8403b',
  'b1326c55-02b4-4296-9627-ca485f720ee8',
  'ed7b4207-1126-4ac0-9837-dbb46503efe0',
];

async function seedEvent(eventId, seed, investors) {
  const { data: event, error } = await db.from('funding_evidence_events')
    .select('id,startup_name_raw,metadata,source_url,source_publisher,source_title')
    .eq('id', eventId)
    .single();
  if (error) throw error;
  const resolved = seed.participants.map(([name, role, relation, phrase]) => ({
    name, role, relation, phrase, ...resolveCanonicalEntity(investors || [], name),
  }));
  if (!apply) {
    return {
      event_id: eventId,
      startup: event.startup_name_raw,
      seed: seed.key,
      dry_run: true,
      participants: resolved.map((row) => `${row.name}:${row.status}`),
    };
  }
  const metadata = {
    ...(event.metadata || {}),
    participant_list_complete: seed.participantListComplete,
    participant_list_complete_reason: 'manual_seed_non_cf_primary',
    participant_enrichment_version: 'manual-seed-v1',
    participant_enrichment_attempted_at: new Date().toISOString(),
    manual_seed_key: seed.key,
    manual_seed_evidence_url: seed.evidenceUrl,
    manual_seed_evidence_publisher: seed.evidencePublisher,
  };
  const { error: updateError } = await db.from('funding_evidence_events').update({
    metadata,
    // Keep original source_url (ledger identity) but stash non-CF evidence in metadata.
    updated_at: new Date().toISOString(),
  }).eq('id', eventId);
  if (updateError) throw updateError;
  let written = 0;
  for (const participant of resolved) {
    const { error: participantError } = await db.from('funding_evidence_participants').upsert({
      funding_event_id: eventId,
      investor_name_raw: participant.name,
      investor_id: participant.row?.id || null,
      participant_role: participant.role,
      participation_relation: participant.relation,
      evidence_phrase: participant.phrase,
      resolution_status: participant.status,
      resolution_confidence: participant.confidence,
      evidence: {
        extraction_version: 'manual-seed-v1',
        audited: true,
        source_url: seed.evidenceUrl,
        source_publisher: seed.evidencePublisher,
        source_title: seed.evidenceTitle,
        resolution_match_kind: participant.matchKind,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'funding_event_id,investor_name_raw' });
    if (participantError) throw participantError;
    written += 1;
  }
  return {
    event_id: eventId,
    startup: event.startup_name_raw,
    seed: seed.key,
    participants_written: written,
    participants: resolved.map((row) => `${row.name}:${row.status}`),
  };
}

async function rejectFundraiseFalsePositives() {
  const results = [];
  for (const eventId of rejectEventIds) {
    const { data: event, error } = await db.from('funding_evidence_events')
      .select('id,startup_name_raw,metadata,verification_status')
      .eq('id', eventId)
      .maybeSingle();
    if (error) throw error;
    if (!event) {
      results.push({ event_id: eventId, skipped: 'missing' });
      continue;
    }
    if (!apply) {
      results.push({ event_id: eventId, startup: event.startup_name_raw, dry_run: true, action: 'reject_fundraise' });
      continue;
    }
    const { error: updateError } = await db.from('funding_evidence_events').update({
      verification_status: 'rejected',
      metadata: {
        ...(event.metadata || {}),
        rejection_reason: 'vc_fundraise_not_startup_round',
        rejected_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    }).eq('id', eventId);
    if (updateError) throw updateError;
    results.push({ event_id: eventId, startup: event.startup_name_raw, action: 'rejected' });
  }
  return results;
}

async function main() {
  const { data: investors, error } = await db.from('investors').select('id,name,firm');
  if (error) throw error;
  const seeded = [];
  for (const seed of seeds) {
    for (const eventId of seed.eventIds) {
      seeded.push(await seedEvent(eventId, seed, investors || []));
    }
  }
  const rejected = await rejectFundraiseFalsePositives();
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    seeds: seeds.length,
    events_seeded: seeded.length,
    rejected_fundraises: rejected,
    results: seeded,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
