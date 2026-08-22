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
  // Post-#44 mature stuck raises — seed clean rosters from issuer / specialist primaries.
  {
    key: 'arcade-series-a-60m',
    eventIds: [
      '208a8392-6ef3-4dc1-80ec-8233a05137ed', // TNW
      '5642f868-c340-454d-b56d-fd0534411400', // Pulse2
    ],
    evidenceUrl: 'https://www.businesswire.com/news/home/20260615229631/en/Arcade-Raises-60M-to-Become-the-Secure-Action-Layer-Behind-Every-Production-AI-Agent',
    evidencePublisher: 'Business Wire',
    evidenceTitle: 'Arcade Raises $60M to Become the Secure Action Layer Behind Every Production AI Agent',
    participantListComplete: true,
    participants: [
      ['SYN Ventures', 'lead', 'LED_ROUND', 'Series A funding led by SYN Ventures'],
      ['Morgan Stanley', 'participant', 'PARTICIPATED_IN_ROUND', 'with strategic investment from Morgan Stanley and Wipro'],
      ['Wipro', 'participant', 'PARTICIPATED_IN_ROUND', 'with strategic investment from Morgan Stanley and Wipro'],
    ],
  },
  {
    key: 'taya-seed-5m',
    eventIds: [
      '456179c5-b166-4e66-b0bc-8c6c61a4614b', // Pulse2 complete
      '3dc237ba-775f-403e-81f2-969d92edb0fa', // FinSMEs
    ],
    evidenceUrl: 'https://pulse2.com/taya-5-million-seed-funding/',
    evidencePublisher: 'Pulse 2.0',
    evidenceTitle: 'Taya: $5 Million Raised For AI Jewelry Designed To Capture Personal Thoughts',
    participantListComplete: true,
    participants: [
      ['MaC Venture Capital', 'lead', 'LED_ROUND', 'The round was led by MaC Venture Capital and Female Founders Fund'],
      ['Female Founders Fund', 'lead', 'LED_ROUND', 'The round was led by MaC Venture Capital and Female Founders Fund'],
      ['Andreessen Horowitz', 'participant', 'PARTICIPATED_IN_ROUND', 'with participation from a16z speedrun'],
    ],
  },
  {
    key: 'corvera-seed-4-2m',
    eventIds: [
      'dab3bb96-7791-4a37-b6ed-09b1179afb43', // Tech.eu complete
      'eed48c57-2836-4a74-882d-450fa097b613', // Google News / FinSMEs
      'a4172aef-60a9-493a-a0d0-f18ecbe629f8',
    ],
    evidenceUrl: 'https://tech.eu/2026/05/05/london-founded-corvera-raises-42m-to-bring-agentic-ai-to-cpg-supply-chains/',
    evidencePublisher: 'Tech.eu',
    evidenceTitle: 'London-founded Corvera raises $4.2M to bring agentic AI to CPG supply chains',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['6 Degrees Capital', 'lead', 'LED_ROUND', 'The round was led by 6 Degrees Capital'],
      ['Y Combinator', 'participant', 'PARTICIPATED_IN_ROUND', 'backed by Y Combinator'],
      ['Rebel Fund', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Rebel Fund, Duke Capital Partners, and Multimodal Ventures'],
      ['Duke Capital Partners', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Rebel Fund, Duke Capital Partners, and Multimodal Ventures'],
      ['Multimodal Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Rebel Fund, Duke Capital Partners, and Multimodal Ventures'],
    ],
  },
  {
    key: 'paper-series-a-34m',
    eventIds: ['f00ae427-5bd7-4751-b1b4-9e5f8da26063'],
    evidenceUrl: 'https://www.businesswire.com/news/home/20260723608438/en/Paper-Raises-34-Million-Series-A-with-Accel-and-ICONIQ-to-Build-the-Design-Platform-for-the-Agentic-Era',
    evidencePublisher: 'Business Wire',
    evidenceTitle: 'Paper Raises $34 Million Series A with Accel and ICONIQ',
    participantListComplete: true,
    participants: [
      ['Accel', 'lead', 'LED_ROUND', 'Series A with Accel and ICONIQ'],
      ['ICONIQ', 'lead', 'LED_ROUND', 'Series A with Accel and ICONIQ'],
      ['Designer Fund', 'participant', 'PARTICIPATED_IN_ROUND', 'Investors participating include Designer Fund'],
    ],
  },
  {
    key: 'rork-seed-15m',
    eventIds: ['193365c6-5648-4a40-b561-4bd70b3a8732'],
    evidenceUrl: 'https://www.prnewswire.com/news-releases/rork-raises-15m-to-power-the-next-generation-of-app-store-entrepreneurs-302736638.html',
    evidencePublisher: 'PR Newswire',
    evidenceTitle: 'Rork Raises $15M to Power the Next Generation of App Store Entrepreneurs',
    participantListComplete: true,
    participants: [
      ['Left Lane Capital', 'lead', 'LED_ROUND', 'Seed funding round led by Left Lane Capital'],
      ['Peak XV', 'participant', 'PARTICIPATED_IN_ROUND', 'with participation from Peak XV, True Ventures, Goodwater, and existing investor a16z Speedrun'],
      ['True Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'with participation from Peak XV, True Ventures, Goodwater, and existing investor a16z Speedrun'],
      ['Goodwater Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'with participation from Peak XV, True Ventures, Goodwater, and existing investor a16z Speedrun'],
      ['Andreessen Horowitz', 'participant', 'PARTICIPATED_IN_ROUND', 'existing investor a16z Speedrun'],
    ],
  },
  {
    key: 'phia-series-a-35-5m',
    eventIds: ['7bb2c96b-1150-4736-94ac-a30e9c9fb2f9'],
    evidenceUrl: 'https://pulse2.com/phia-raises-35-5-million-series-a-and-reveals-star-studded-investor-roster-to-expand-ai-powered-shopping-platform/',
    evidencePublisher: 'Pulse 2.0',
    evidenceTitle: 'Phia Raises $35.5 Million Series A And Reveals Star-Studded Investor Roster',
    participantListComplete: true,
    participants: [
      ['Notable Capital', 'lead', 'LED_ROUND', 'financing led by Notable Capital, Khosla Ventures, and Kleiner Perkins'],
      ['Khosla Ventures', 'lead', 'LED_ROUND', 'financing led by Notable Capital, Khosla Ventures, and Kleiner Perkins'],
      ['Kleiner Perkins', 'lead', 'LED_ROUND', 'financing led by Notable Capital, Khosla Ventures, and Kleiner Perkins'],
    ],
  },
  {
    key: 'flutterwave-series-e-ripple',
    eventIds: [
      'bacf6396-4086-4612-8294-1e91adb61ad8',
      '6009221d-2d84-4a6a-8d21-0f395b4292f8',
      'ac88a708-047c-4416-a82c-96a7a0c2a7c7',
    ],
    evidenceUrl: 'https://www.coindesk.com/business/2026/06/16/ripple-invests-in-flutterwave-pushing-its-stablecoin-and-xrp-ledger-into-payments-across-africa',
    evidencePublisher: 'CoinDesk',
    evidenceTitle: 'Ripple invests in Flutterwave, pushing its stablecoin and XRP Ledger into payments across Africa',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['Ripple', 'lead', 'INVESTED_IN', 'Ripple has made a strategic investment in Flutterwave as part of its Series E'],
    ],
  },
  {
    key: 'nebius-nvidia-2b',
    eventIds: ['26ffba69-8afa-491e-a4e4-1a836a0a9679'],
    evidenceUrl: 'https://thenextweb.com/news/nvidia-invests-2-billion-in-nebius',
    evidencePublisher: 'The Next Web',
    evidenceTitle: 'NVIDIA invests $2 billion in Nebius',
    participantListComplete: true,
    participants: [
      ['NVIDIA', 'lead', 'INVESTED_IN', 'NVIDIA invests $2 billion in Nebius'],
    ],
  },
  // Post-#45 indeterminate drain — complete rosters + fix split round keys.
  {
    key: 'actively-series-b-45m',
    eventIds: [
      '36518d33-9189-4325-ac4a-a029094f21e4', // Google News / FinSMEs typed Series B
      'd125b528-d429-43e8-b8e5-ea59269d13f1', // Pulse2 complete (fix Capital Ventures typo)
    ],
    evidenceUrl: 'https://www.businesswire.com/news/home/20260428810008/en/Actively-Raises-45M-Series-B-to-Scale-Intelligence-Led-Revenue-Platform',
    evidencePublisher: 'Business Wire',
    evidenceTitle: 'Actively Raises $45M Series B to Scale Intelligence-Led Revenue Platform',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['TCV', 'co_lead', 'CO_LED_ROUND', 'co-led by TCV and First Harmonic'],
      ['First Harmonic', 'co_lead', 'CO_LED_ROUND', 'co-led by TCV and First Harmonic'],
      ['Bain Capital Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Bain Capital Ventures, First Round Capital, and Alkeon'],
      ['First Round Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Bain Capital Ventures, First Round Capital, and Alkeon'],
      ['Alkeon', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Bain Capital Ventures, First Round Capital, and Alkeon'],
    ],
  },
  {
    key: 'bionyra-series-a-165m',
    eventIds: [
      'cff413d2-cdf9-4db0-b51d-933bd854bb55',
      '8b44fc9e-bec2-4a06-92cd-77eed33d2e86',
    ],
    evidenceUrl: 'https://www.biospace.com/press-releases/bionyra-pharma-launches-with-165-million-oversubscribed-series-a-to-advance-clinical-stage-pipeline-of-next-generation-biologics-for-immune-mediated-inflammatory-diseases',
    evidencePublisher: 'BioSpace',
    evidenceTitle: 'Bionyra Pharma Launches with $165 million Oversubscribed Series A',
    participantListComplete: true,
    participants: [
      ['Jeito Capital', 'lead', 'LED_ROUND', 'Series A co-led by Jeito Capital and Sofinnova Partners'],
      ['Sofinnova Partners', 'lead', 'LED_ROUND', 'Series A co-led by Jeito Capital and Sofinnova Partners'],
      ['Arkin Bio', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Arkin Bio, Sanofi Ventures, Sixty Degree Capital, Vives Partners and Apollo Health Ventures'],
      ['Sanofi Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Arkin Bio, Sanofi Ventures, Sixty Degree Capital, Vives Partners and Apollo Health Ventures'],
      ['Sixty Degree Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Arkin Bio, Sanofi Ventures, Sixty Degree Capital, Vives Partners and Apollo Health Ventures'],
      ['Vives Partners', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Arkin Bio, Sanofi Ventures, Sixty Degree Capital, Vives Partners and Apollo Health Ventures'],
      ['Apollo Health Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Arkin Bio, Sanofi Ventures, Sixty Degree Capital, Vives Partners and Apollo Health Ventures'],
    ],
  },
  {
    key: 'convey-series-a-38m',
    eventIds: [
      '148b2a7b-3e7d-49bd-84cb-9f846d4158d3', // Business Insider
      '724aabc3-db7d-47f9-a479-43ca08417129', // Pulse2
    ],
    evidenceUrl: 'https://pulse2.com/convey-raises-38-million-series-a-to-automate-enterprise-operations-with-ai-teammates/',
    evidencePublisher: 'Pulse 2.0',
    evidenceTitle: 'Convey Raises $38 Million Series A To Automate Enterprise Operations With AI Teammates',
    participantListComplete: true,
    participants: [
      ['Andreessen Horowitz', 'lead', 'LED_ROUND', 'Series A financing led by Andreessen Horowitz'],
    ],
  },
  {
    key: 'nava-series-a-22m',
    eventIds: [
      '414ea857-7761-4ab8-b366-2fb0a77f984a',
      '74d4cb0e-9a8d-47dd-9fbe-705873ba699b',
      '71537495-a7ec-458d-8914-9140c18823ee',
      '87730e07-0b6c-43b6-88ab-68945d550e5d',
      'c3e010fd-e7c7-4f77-b36e-4f24c6bf5ec0',
      '52c0a821-9461-4fe6-a5e1-b9b865b172c9',
      '8c6ba23d-e527-41ae-b469-245f5407565c',
      '8739ab64-9f39-4118-9d08-95109656a0bc',
      '43b7a3fa-cc25-4e14-a862-d67ec1262146',
      '1fd14032-b810-445b-93f8-08a63b7909fb',
    ],
    evidenceUrl: 'https://techcrunch.com/2026/04/09/nava-raises-22-million-series-a-led-by-greenoaks-capital/',
    evidencePublisher: 'TechCrunch',
    evidenceTitle: 'Nava raises $22 million Series A led by Greenoaks Capital',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['Greenoaks Capital', 'lead', 'LED_ROUND', 'Series A led by Greenoaks Capital'],
      ['RTP Global', 'participant', 'PARTICIPATED_IN_ROUND', 'with participation from RTP Global and Unicorn India Ventures'],
      ['Unicorn India Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'with participation from RTP Global and Unicorn India Ventures'],
    ],
  },
  {
    key: 'nava-seed-archetype-8-3m',
    eventIds: [
      '20f293b7-ffe7-4180-ba72-9ac87e4249d5',
      '4a54e69d-9658-4e92-a90d-a1384620e79a',
      '887fb34d-91db-4f88-b86a-42c655240091',
      'a2e42977-3fe0-4c2f-a8f2-4784b3bbbbb2',
      'd091a643-1854-4abb-834b-8453852c6062',
      'd7e8cb3f-7982-48a0-a344-7504bc62fc55',
    ],
    evidenceUrl: 'https://startupsamadhan.com/nava-ai-startup-raises-22-million-greenoaks-capital-series-a/',
    evidencePublisher: 'Startup Samadhan',
    evidenceTitle: 'Nava AI Startup Raises $22M Led by Greenoaks Capital',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['Archetype', 'lead', 'LED_ROUND', 'Archetype co-led seed round'],
      ['RTP Global', 'participant', 'PARTICIPATED_IN_ROUND', 'prior seed from RTP Global, Unicorn India Ventures, Blume Founders Fund, and Climber Capital'],
      ['Unicorn India Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'prior seed from RTP Global, Unicorn India Ventures, Blume Founders Fund, and Climber Capital'],
      ['Blume Founders Fund', 'participant', 'PARTICIPATED_IN_ROUND', 'prior seed from RTP Global, Unicorn India Ventures, Blume Founders Fund, and Climber Capital'],
      ['Climber Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'prior seed from RTP Global, Unicorn India Ventures, Blume Founders Fund, and Climber Capital'],
    ],
  },
  {
    key: 'slate-series-c-650m',
    eventIds: [
      'c879bdd4-aeca-46e3-98b3-2cb724a343e9',
    ],
    evidenceUrl: 'https://www.prnewswire.com/news-releases/slate-raises-650-million-in-series-c-round-302739884.html',
    evidencePublisher: 'PR Newswire',
    evidenceTitle: 'Slate Raises $650 Million in Series C Round',
    participantListComplete: true,
    participants: [
      ['TWG Global', 'lead', 'LED_ROUND', 'Series C round led by TWG Global'],
    ],
  },
  // Post-#47 Pulse2-complete roster batch — pair with issuer-wire ingest + corroborate.
  {
    key: 'attention-series-b-30m',
    eventIds: ['431ab8ea-fbb1-4461-a50c-e65c3adecad5'],
    evidenceUrl: 'https://www.prnewswire.com/news-releases/attention-raises-30m-series-b-to-build-the-ai-system-that-runs-revenue-teams--not-just-records-them-302808821.html',
    evidencePublisher: 'PR Newswire',
    evidenceTitle: 'Attention Raises $30M Series B to Build the AI System That Runs Revenue Teams',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['RTP Global', 'lead', 'LED_ROUND', 'Series B led by RTP Global'],
      ['Aglaé Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'returning investors Aglaé Ventures, Eniac, and Alven'],
      ['Eniac', 'participant', 'PARTICIPATED_IN_ROUND', 'returning investors Aglaé Ventures, Eniac, and Alven'],
      ['Alven', 'participant', 'PARTICIPATED_IN_ROUND', 'returning investors Aglaé Ventures, Eniac, and Alven'],
      ['Linea Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'new investor Linea Ventures'],
    ],
  },
  {
    key: 'wealthreach-seed-1m',
    eventIds: ['4a95579a-616b-429c-867c-48a77810be95'],
    evidenceUrl: 'https://www.businesswire.com/news/home/20260610930482/en/WealthReach-Raises-1M-Seed-Round-Forms-Strategic-Advisory-Board-to-Drive-Expansion-of-Its-Organic-Growth-Platform',
    evidencePublisher: 'Business Wire',
    evidenceTitle: 'WealthReach Raises $1M Seed Round, Forms Strategic Advisory Board',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['Cecure Corporation', 'lead', 'LED_ROUND', 'round was led by Cecure Corporation'],
    ],
  },
  {
    key: 'portal-seed-5m',
    eventIds: ['5f7014e6-3229-49cd-bb0f-a0ac40c7a8c0'],
    evidenceUrl: 'https://www.businesswire.com/news/home/20260608695242/en/The-Portal-Raises-5-Million-to-Launch-Austin-Flagship-for-Members-Club-Dedicated-to-Human-Flourishing',
    evidencePublisher: 'Business Wire',
    evidenceTitle: 'The Portal Raises $5 Million to Launch Austin Flagship',
    participantListComplete: true,
    replaceParticipants: true,
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
    key: 'critical-energy-seed-22m',
    eventIds: ['6cbc7c19-0631-46ad-b8e1-0f2df597c384'],
    evidenceUrl: 'https://techcrunch.com/2026/06/17/spacex-alum-nabs-22m-to-turn-rocket-engines-into-geothermal-power-plants/',
    evidencePublisher: 'TechCrunch',
    evidenceTitle: 'SpaceX alum nabs $22M to turn rocket engines into geothermal power plants',
    participantListComplete: true,
    replaceParticipants: true,
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
    key: 'tonada-pre-seed-3m',
    eventIds: ['81c88da1-2267-4df4-b942-a891b861bb60'],
    evidenceUrl: 'https://www.tonada.com/blog/tonada-preseed',
    evidencePublisher: 'Tonada',
    evidenceTitle: 'Tonada raises $3M in pre-seed founding to give every brand its own sound',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['Antler', 'lead', 'LED_ROUND', 'funding round was led by Antler'],
      ['Spintop Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'joined by Spintop Ventures, RTP Global, Triple A VC, and Karaoke Club'],
      ['RTP Global', 'participant', 'PARTICIPATED_IN_ROUND', 'joined by Spintop Ventures, RTP Global, Triple A VC, and Karaoke Club'],
      ['Triple A VC', 'participant', 'PARTICIPATED_IN_ROUND', 'joined by Spintop Ventures, RTP Global, Triple A VC, and Karaoke Club'],
      ['Karaoke Club', 'participant', 'PARTICIPATED_IN_ROUND', 'joined by Spintop Ventures, RTP Global, Triple A VC, and Karaoke Club'],
    ],
  },
  {
    key: 'pure-seed-8m',
    eventIds: ['5f1dff51-c26c-4708-b9bc-9269d7757e7c'],
    evidenceUrl: 'https://www.finsmes.com/2026/07/pure-raises-8m-in-seed-funding.html',
    evidencePublisher: 'FinSMEs',
    evidenceTitle: 'Pure Raises $8M in Seed Funding',
    participantListComplete: true,
    replaceParticipants: true,
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
    key: 'werize-pre-series-c-7m',
    eventIds: ['d77b7baa-5f62-4e94-ac6e-b93ff85f4fb5'],
    evidenceUrl: 'https://economictimes.indiatimes.com/tech/funding/fintech-werize-raises-7-million-led-by-sony-innovation-fund/articleshow/131488872.cms',
    evidencePublisher: 'The Economic Times',
    evidenceTitle: 'Fintech WeRize raises $7 million led by Sony Innovation Fund',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['Sony Innovation Fund', 'lead', 'LED_ROUND', 'round led by Sony Innovation Fund'],
      ['3one4 Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from existing investor 3one4 Capital'],
    ],
  },
  {
    key: 'aligned-series-b-60m',
    eventIds: ['482f4794-c3cf-4c89-b84c-83566edb9ddc'],
    evidenceUrl: 'https://www.globenewswire.com/news-release/2026/07/01/3320495/0/en/Aligned-Closes-60M-Series-B-to-Solidify-Leadership-Position-as-the-System-of-Action-for-B2B-Sales.html',
    evidencePublisher: 'Globe Newswire',
    evidenceTitle: 'Aligned Closes $60M Series B to Solidify Leadership Position as the System of Action for B2B Sales',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['PeakSpan Capital', 'lead', 'LED_ROUND', 'round was led by PeakSpan Capital'],
      ['Hetz Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from all existing investors, Hetz Ventures, JAL Ventures and NFX'],
      ['JAL Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from all existing investors, Hetz Ventures, JAL Ventures and NFX'],
      ['NFX', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from all existing investors, Hetz Ventures, JAL Ventures and NFX'],
    ],
  },
  // Post-#48 mature unfunded unlock batch (issuer wires + roster seeds).
  {
    key: 'titan-seed-3m',
    eventIds: ['14c5f249-8908-4602-93f9-e916cb4f7819'],
    evidenceUrl: 'https://www.businesswire.com/news/home/20260609605347/en/Titan-Secures-3M-in-New-Funding-to-Further-Scale-Its-Banking-Native-AI-Platform-for-Financial-Services',
    evidencePublisher: 'Business Wire',
    evidenceTitle: 'Titan Secures $3M in New Funding to Further Scale Its Banking Native AI Platform',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['Entropy Ventures', 'lead', 'LED_ROUND', 'new funding, led by Entropy Ventures'],
    ],
  },
  {
    key: 'traversal-amex-strategic-5m',
    eventIds: ['53756ea8-45f3-4e90-9d0b-c726929753ed'],
    evidenceUrl: 'https://www.businesswire.com/news/home/20260304551167/en/Traversal-Announces-Strategic-Investment-from-Amex-Ventures',
    evidencePublisher: 'Business Wire',
    evidenceTitle: 'Traversal Announces Strategic Investment from Amex Ventures',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['Amex Ventures', 'lead', 'LED_ROUND', 'strategic investment from Amex Ventures'],
    ],
  },
  {
    key: 'rizon-pre-seed-2m',
    eventIds: ['3c925e78-eed1-49e3-8155-28311b8d7083'],
    evidenceUrl: 'https://www.finsmes.com/2026/02/rizon-raises-2m-in-pre-seed-funding.html',
    evidencePublisher: 'FinSMEs',
    evidenceTitle: 'Rizon Raises $2M in Pre-Seed Funding',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['Market One Capital', 'lead', 'LED_ROUND', 'investment from Market One Capital'],
    ],
  },
  {
    key: 'coderabbit-series-c-143m',
    eventIds: ['dde5c914-1063-494b-8fef-739b9664d688'],
    evidenceUrl: 'https://siliconangle.com/2026/08/12/coderabbit-bags-143m-help-companies-get-grip-explosion-ai-generated-code/',
    evidencePublisher: 'SiliconANGLE',
    evidenceTitle: 'CodeRabbit bags $143M to help companies get a grip on the explosion of AI-generated code',
    participantListComplete: true,
    replaceParticipants: true,
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
  // Post-#49 mature unfunded gap batch (untrusted observed → roster seed + audited ingest).
  {
    key: 'kinfolk-seed-7m',
    eventIds: ['3be33a42-5e03-411f-87bd-454f21fde3bc'],
    evidenceUrl: 'https://tech.eu/2026/02/25/kinfolk-closes-7m-seed-round-for-ai-driven-hr-platform/',
    evidencePublisher: 'Tech.eu',
    evidenceTitle: 'Kinfolk closes $7M seed round for AI-driven HR platform',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['AlbionVC', 'lead', 'LED_ROUND', 'seed round led by AlbionVC'],
      ['PROfounders Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from PROfounders Capital, Ascension, and Emerge'],
      ['Ascension', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from PROfounders Capital, Ascension, and Emerge'],
      ['Emerge', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from PROfounders Capital, Ascension, and Emerge'],
    ],
  },
  {
    key: 'beycome-seed-2-5m',
    eventIds: ['2143922e-888c-49ec-a382-9f7fe074f09a'],
    evidenceUrl: 'https://www.prnewswire.com/news-releases/beycome-closes-2-5m-seed-round-led-by-insurtech-fund-302647050.html',
    evidencePublisher: 'PR Newswire',
    evidenceTitle: 'Beycome Closes $2.5M Seed Round Led by InsurTech Fund',
    participantListComplete: true,
    replaceParticipants: true,
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
    key: 'novee-series-a-51-5m',
    eventIds: ['a4005cf4-2c1c-4280-9f8f-901747a495d9'],
    evidenceUrl: 'https://novee.security/blog/novee-raises-51-5m-to-transform-offensive-security/',
    evidencePublisher: 'Novee',
    evidenceTitle: 'Novee raises $51.5M to transform offensive security',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['YL Ventures', 'lead', 'LED_ROUND', 'rounds led by YL Ventures, Canaan Partners, and Oren Zeev'],
      ['Canaan Partners', 'co_lead', 'CO_LED_ROUND', 'rounds led by YL Ventures, Canaan Partners, and Oren Zeev'],
      ['Zeev Ventures', 'co_lead', 'CO_LED_ROUND', 'rounds led by YL Ventures, Canaan Partners, and investor Oren Zeev through Zeev Ventures'],
      ['Cyber Club London', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Cyber Club London and Squared Circle Ventures'],
      ['Squared Circle Ventures', 'participant', 'PARTICIPATED_IN_ROUND', 'participation from Cyber Club London and Squared Circle Ventures'],
    ],
  },
  {
    key: 'claroty-series-f-150m',
    eventIds: ['6868c2ee-c6c6-460e-b507-2f8ce3e5d94e'],
    evidenceUrl: 'https://www.prnewswire.com/news-releases/claroty-secures-150-million-in-series-f-funding-to-lead-charge-on-securing-the-worlds-mission-critical-infrastructure-302667496.html',
    evidencePublisher: 'PR Newswire',
    evidenceTitle: 'Claroty Secures $150 Million in Series F Funding to Lead Charge on Securing the World\'s Mission Critical Infrastructure',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['Golub Growth', 'lead', 'LED_ROUND', 'Series F funding led by Golub Growth, an affiliate of Golub Capital'],
    ],
  },
  {
    key: 'skeleton-series-f-33m-eur',
    eventIds: ['1da8e940-4399-4b00-ac60-88ab9192be05'],
    evidenceUrl: 'https://www.skeletontech.com/news/skeleton-announces-first-close-of-pre-ipo-funding-round',
    evidencePublisher: 'Skeleton Technologies',
    evidenceTitle: 'Skeleton Technologies Announces First Close of Pre-IPO Funding Round with Initial €33 Million Investment',
    participantListComplete: true,
    replaceParticipants: true,
    participants: [
      ['Axon Partners Group', 'participant', 'PARTICIPATED_IN_ROUND', 'addition of Axon Partners Group, SmartCap, and Taiwania Capital'],
      ['SmartCap', 'participant', 'PARTICIPATED_IN_ROUND', 'addition of Axon Partners Group, SmartCap, and Taiwania Capital'],
      ['Taiwania Capital', 'participant', 'PARTICIPATED_IN_ROUND', 'addition of Axon Partners Group, SmartCap, and Taiwania Capital'],
      ['CBMM', 'participant', 'PARTICIPATED_IN_ROUND', 'Existing investor CBMM also joined the round'],
    ],
  },
  {
    key: 'airmo-seed-5m-eur',
    eventIds: ['6bf373b3-cd89-4b6a-bce5-f0bad3c0c5b0'],
    evidenceUrl: 'https://www.airmo.io/newsroom/airmo-raises-eu5m-seed-funding',
    evidencePublisher: 'AIRMO',
    evidenceTitle: 'AIRMO Raises €5M Seed Funding to Power Advanced Greenhouse Gas Monitoring System',
    participantListComplete: true,
    replaceParticipants: true,
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

/** Reject every event on a canonical_round_key (valuation noise / duplicate mis-amount). */
const bulkRejectRoundKeys = [
  {
    canonical_round_key: 'id:569df921-aa17-4b63-9e07-eea3eeb36157|unknown|unknown|2026-03',
    reason: 'nscale_valuation_liquidity_noise',
  },
  {
    canonical_round_key: 'id:569df921-aa17-4b63-9e07-eea3eeb36157|unknown|unknown|2026-07',
    reason: 'nscale_valuation_noise',
  },
  {
    canonical_round_key: 'id:569df921-aa17-4b63-9e07-eea3eeb36157|growth|unknown|2026-06',
    reason: 'unrostered_growth_rumor',
  },
  {
    canonical_round_key: 'id:569df921-aa17-4b63-9e07-eea3eeb36157|unknown|1400000000|2026-02',
    reason: 'nscale_roundup_liquidity_not_rostered_raise',
  },
  {
    canonical_round_key: 'id:569df921-aa17-4b63-9e07-eea3eeb36157|unknown|1400000000|2026-07',
    reason: 'nscale_roundup_liquidity_not_rostered_raise',
  },
];

/** Non-startup funding false positives / rumors to exclude from Hit@5 outcomes. */
const rejectEventIds = [
  // Paradigm.xyz VC firm "raises $1.5B" fund — not a startup round
  '359955b1-a889-4d06-b61f-1e7f88b39131',
  '7a3520ad-da3a-43b8-a1a2-c338cc08a28f',
  'fb878359-1675-4ae2-a647-448cb87e9b9e', // Paradigm fourth fund Pulse2
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
  // Post-#44 mature stuck false positives
  '0dc283b6-e2ea-4c28-9e35-4258f000c645', // Rain VARA license, not a raise
  '8775db12-779d-4cda-8c80-77f27bf71dac', // Starlink mislinked Univity article
  'b487e3b7-8b6d-4201-aa18-1765e5b2f5d1', // Steps Dev.to tutorial, not funding
  'e3663092-52be-4d3c-b976-8370c7152cfa', // Nava mis-extracted $21.7M duplicate
  // Whop stablecoin strategic investment (separate from $200M Tether round)
  '82fd189e-6c02-4b0a-aeaa-0ac3ef950bdc',
  // "Three" junk: roundup / conference / grant (not a single startup round)
  'ac57d878-eb7b-42e6-b208-3372856d55a9',
  '1349012e-de89-4acf-84f6-8ef318d199c3',
  'f9406692-8308-4534-aadf-488f31ce568d',
  // Post-#47 Pulse2 batch: mislinked Fortune Peregrine article on World Cup startup identity
  '50eb38d9-babc-4ab3-9de7-42968e67f3fc',
  'd301b505-b55a-46b1-be3a-affaf6ff18ec',
  // Werize $28M total-capital headline (duplicate wrong amount vs $7M pre-Series C)
  '274ebaa2-d803-485f-8113-d7bc395a506e',
  // Post-#52 junk / non-venture gap events (triage untrusted_observed)
  'cc044243-85af-4eab-96af-59b5e930613a', // Malwarebytes product review, not a raise
  '03d7a650-172e-4f4e-98c4-da791365382d', // Thrive Holdings "set to raise" rumor
  'deffd4cd-0a84-4534-a32d-710f222114c8', // Swiggy AoA shareholder vote, not funding
  '9c080e40-c50b-428f-abb6-ff10de7913dc', // Tencent block trade selldown
  'a6212e52-1784-4bb0-a478-b5194dc46f25', // OpenPayd Nasdaq listing path, not VC round
  'e2c33bac-1080-4c7e-aea9-e0a6a38cbcb0', // VC roundup (SiteVue line only)
  'e4a56afe-5b03-4c0b-8f72-8cd221ca4b0c', // VC roundup (Alloy line only)
  '5b4f513a-88d0-448c-a07b-7d1d7d322513', // Meridian Google News duplicate (issuer wires exist)
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
    // Never downgrade an already-resolved investor_id to null when re-seeding.
    const { data: existing, error: existingError } = await db.from('funding_evidence_participants')
      .select('id,investor_id,investor_organization_id,resolution_status,resolution_confidence')
      .eq('funding_event_id', eventId)
      .eq('investor_name_raw', participant.name)
      .maybeSingle();
    if (existingError) throw existingError;
    const resolvedId = participant.row?.id || null;
    const keepExisting = Boolean(existing?.investor_id) && !resolvedId;
    const investorId = resolvedId || existing?.investor_id || null;
    const resolutionStatus = resolvedId
      ? participant.status
      : (keepExisting ? (existing.resolution_status || 'resolved') : participant.status);
    const resolutionConfidence = resolvedId
      ? participant.confidence
      : (keepExisting ? (existing.resolution_confidence || 1) : participant.confidence);
    const { error: participantError } = await db.from('funding_evidence_participants').upsert({
      funding_event_id: eventId,
      investor_name_raw: participant.name,
      investor_id: investorId,
      investor_organization_id: keepExisting ? existing.investor_organization_id : null,
      participant_role: participant.role,
      participation_relation: participant.relation,
      evidence_phrase: participant.phrase,
      resolution_status: resolutionStatus,
      resolution_confidence: resolutionConfidence,
      evidence: {
        extraction_version: 'manual-seed-v1',
        audited: true,
        source_url: seed.evidenceUrl,
        source_publisher: seed.evidencePublisher,
        source_title: seed.evidenceTitle,
        resolution_match_kind: participant.matchKind || (keepExisting ? 'preserved_existing_resolution' : null),
        preserved_existing_resolution: keepExisting || undefined,
      },
      updated_at: new Date().toISOString(),
    }, { onConflict: 'funding_event_id,investor_name_raw' });
    if (participantError) throw participantError;
    written += 1;
  }
  if (seed.replaceParticipants) {
    const keep = new Set(seed.participants.map(([name]) => name));
    const { data: existingRows, error: listError } = await db.from('funding_evidence_participants')
      .select('id,investor_name_raw')
      .eq('funding_event_id', eventId);
    if (listError) throw listError;
    const toDelete = (existingRows || []).filter((row) => !keep.has(row.investor_name_raw)).map((row) => row.id);
    for (let offset = 0; offset < toDelete.length; offset += 50) {
      const { error: deleteError } = await db.from('funding_evidence_participants')
        .delete()
        .in('id', toDelete.slice(offset, offset + 50));
      if (deleteError) throw deleteError;
    }
  }
  return {
    event_id: eventId,
    startup: event.startup_name_raw,
    seed: seed.key,
    participants_written: written,
    participants_replaced: Boolean(seed.replaceParticipants),
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

async function rejectBulkRoundKeys() {
  const results = [];
  for (const entry of bulkRejectRoundKeys) {
    const { data: events, error } = await db.from('funding_evidence_events')
      .select('id,startup_name_raw,metadata,verification_status')
      .eq('canonical_round_key', entry.canonical_round_key)
      .neq('verification_status', 'rejected');
    if (error) throw error;
    for (const event of events || []) {
      if (!apply) {
        results.push({ event_id: event.id, startup: event.startup_name_raw, dry_run: true, action: 'reject_round_key', reason: entry.reason });
        continue;
      }
      const { error: updateError } = await db.from('funding_evidence_events').update({
        verification_status: 'rejected',
        metadata: {
          ...(event.metadata || {}),
          rejection_reason: entry.reason,
          rejected_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      }).eq('id', event.id);
      if (updateError) throw updateError;
      results.push({ event_id: event.id, startup: event.startup_name_raw, action: 'rejected', reason: entry.reason });
    }
  }
  return results;
}

async function allInvestors() {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await db.from('investors')
      .select('id,name,firm,url,is_individual,type,status')
      .range(offset, offset + 999);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 1000) break;
  }
  return rows.filter((row) => !['inactive', 'rejected', 'deleted'].includes(String(row.status || '').toLowerCase()));
}

async function main() {
  const investors = await allInvestors();
  const seeded = [];
  for (const seed of seeds) {
    for (const eventId of seed.eventIds) {
      seeded.push(await seedEvent(eventId, seed, investors));
    }
  }
  const rejected = await rejectFundraiseFalsePositives();
  const bulkRejected = await rejectBulkRoundKeys();
  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    investor_universe: investors.length,
    seeds: seeds.length,
    events_seeded: seeded.length,
    rejected_fundraises: rejected,
    bulk_rejected_round_keys: bulkRejected,
    results: seeded,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
