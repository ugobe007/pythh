#!/usr/bin/env node
/**
 * ADD FOUNDER-ANGELS
 * ==================
 * Seeds the investors table with the founder-angel / super-angel list (operators
 * with notable exits who write a high volume of seed/angel checks). Idempotent:
 * skips any name that already exists (case-insensitive). Dry-run by default.
 *
 *   node scripts/add-founder-angels.js            # DRY RUN — shows new vs existing
 *   node scripts/add-founder-angels.js --apply    # insert missing
 */
'use strict';
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const APPLY = process.argv.includes('--apply');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('❌ Missing Supabase credentials'); process.exit(1); }
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const US = ['US', 'Global'];
function angel(name, firm, title, tier, sectors, notable, bio) {
  return {
    name, firm, title,
    type: 'Angel', investor_type: 'Super Angel', is_individual: true,
    tier: String(tier), status: 'active', is_verified: true, public_profile: true,
    stage: ['Seed'], geography_focus: US, sectors, notable_investments: notable,
    bio, investment_thesis: bio,
    check_size_min: 25000, check_size_max: 500000,
  };
}

const ANGELS = [
  // ── Founder-angels with notable exits ──────────────────────────────────────
  angel('Immad Akhund', 'Mercury', 'Founder & CEO, Mercury', 1, ['Fintech', 'AI/ML', 'SaaS'], ['Mercury', 'Decimal', 'Bridge', 'Rye'], 'Founder/CEO of Mercury ($3.5B+). Prolific seed angel (200+ investments).'),
  angel('Scott Belsky', 'A.CAPITAL / Behance', 'Founder, Behance; ex-CPO Adobe', 1, ['Consumer', 'SaaS', 'AI/ML', 'Design'], ['Behance', 'Pinterest', 'Uber', 'Airtable', 'Carta'], 'Founder of Behance (acq. Adobe). Active consumer/design/AI angel.'),
  angel('Kevin Rose', 'True Ventures', 'Founder, Digg; Partner, True Ventures', 1, ['Consumer', 'Crypto', 'AI/ML'], ['Digg', 'Twitter', 'Square', 'Facebook'], 'Founder of Digg; True Ventures ecosystem. Consumer + crypto angel.'),
  angel('Ben Ling', 'Bling Capital', 'Founder, Bling Capital', 1, ['Consumer', 'SaaS', 'Fintech'], ['Lyft', 'Airtable', 'Square', 'Gusto', 'Opendoor'], 'Early angel in Lyft, Airtable, Square. Founder of Bling Capital.'),
  angel('David Morin', 'Slow Ventures', 'Founder, Path; angel', 1, ['Consumer', 'AI/ML'], ['Path', 'Facebook'], 'One of the most connected angels in consumer/AI.'),
  angel('Gokul Rajaram', 'Angel', 'ex-DoorDash / Square / Google exec', 1, ['Fintech', 'Consumer', 'SaaS'], ['Coinbase', 'DoorDash', 'Pinterest', 'Figma'], 'Coinbase, DoorDash, Pinterest angel. Very high check frequency.'),
  angel('Elad Gil', 'Angel', 'Founder, Color Health & MixerLabs', 1, ['AI/ML', 'SaaS', 'Healthcare'], ['Airbnb', 'Coinbase', 'Stripe', 'Figma', 'Notion', 'Color Health'], 'Founder of Color Health & MixerLabs. Top-tier AI/SaaS angel.'),
  angel('Charlie Cheever', 'Expo', 'Co-founder, Quora & Expo', 2, ['Consumer', 'Dev Tools'], ['Quora', 'Expo'], 'Co-founder of Quora and Expo. Dev-tools / consumer angel.'),
  angel('Justin Kan', 'Angel', 'Co-founder, Twitch', 1, ['Consumer', 'AI/ML', 'Gaming'], ['Twitch', 'Cruise'], 'Co-founder of Twitch (acq. Amazon). Consumer + AI angel.'),
  angel('Naval Ravikant', 'AngelList', 'Co-founder, AngelList', 1, ['Consumer', 'SaaS', 'Crypto'], ['Twitter', 'Uber', 'Notion', 'Postmates', 'Opendoor'], 'Co-founder of AngelList. One of the most prolific angels.'),
  angel('Fabrice Grinda', 'FJ Labs', 'Founder, FJ Labs; OLX', 1, ['Marketplaces', 'Consumer'], ['OLX', 'Alibaba', 'Delivery Hero', 'Flexport'], 'OLX exit; 1,000+ investments via FJ Labs. Marketplace specialist.'),
  angel('Jason Calacanis', 'LAUNCH', 'Founder, LAUNCH & Inside.com', 1, ['Consumer', 'SaaS'], ['Uber', 'Robinhood', 'Calm', 'Trello'], 'Early Uber investor. Founder of LAUNCH; very active seed angel.'),

  // ── New generation (less famous, extremely active) ─────────────────────────
  angel('Edward Lando', 'Pareto Holdings', 'Co-founder, Pareto Holdings', 1, ['Consumer', 'Marketplaces', 'AI/ML'], ['Whatnot', 'Pacaso'], '500+ startup investments. Co-founder of Pareto Holdings.'),
  angel('Hesham Zreik', 'FasterCapital', 'CEO, FasterCapital', 2, ['SaaS', 'AI/ML'], [], 'One of the highest-volume angels globally.'),
  angel('Gaurav Jain', 'Afore Capital', 'Co-founder, Afore Capital', 1, ['SaaS', 'AI/ML', 'Fintech'], ['Petal', 'Modern Health'], 'One of the most prolific pre-seed investors.'),
  angel('Nikhil Basu Trivedi', 'Footwork', 'Co-founder, Footwork VC', 1, ['Consumer', 'SaaS', 'AI/ML'], ['Canva', 'Faire', 'Mirror'], 'Top-ranked emerging seed investor.'),
  angel('Pejman Nozad', 'Pear VC', 'Founding Partner, Pear VC', 1, ['SaaS', 'AI/ML', 'Healthcare'], ['DoorDash', 'Guardant Health', 'Gusto'], 'Legendary first-check investor.'),
  angel('Aneel Ranadive', 'Soma Capital', 'Founder, Soma Capital', 1, ['AI/ML', 'SaaS', 'Marketplaces'], ['Razorpay', 'Cruise', 'Rappi'], 'Extremely active in AI.'),
  angel('Brian Reilly', 'Angel', 'Angel investor', 2, ['AI/ML'], [], 'Heavy AI focus.'),
  angel('Gaurav Garg', 'Wing Venture Capital', 'Founding Partner, Wing VC', 1, ['Infrastructure', 'AI/ML', 'Enterprise'], ['Aruba Networks', 'Cohesity'], 'Infrastructure and AI specialist.'),
  angel('Mark Goines', 'Angel', 'Angel investor; Personal Capital', 2, ['Fintech', 'SaaS'], ['Personal Capital', 'Intuit'], 'Long track record, still active.'),
  angel('Jared Kopf', 'Angel', 'Founder, AdRoll / Worklife / Serra', 1, ['SaaS', 'AI/ML'], ['AdRoll', 'HomeRun'], 'Exceptional exit statistics.'),

  // ── Robotics / Physical AI ─────────────────────────────────────────────────
  angel('Trae Stephens', 'Founders Fund / Anduril', 'Co-founder, Anduril; Partner, Founders Fund', 1, ['Robotics', 'Defense', 'AI/ML'], ['Anduril', 'Palantir'], 'Co-founder of Anduril; Partner at Founders Fund. Physical-AI / defense.'),
  angel('Palmer Luckey', 'Anduril', 'Founder, Oculus & Anduril', 1, ['Robotics', 'Defense', 'Hardware'], ['Oculus', 'Anduril'], 'Founder of Oculus and Anduril. Hardware / defense / robotics.'),
  angel('Ryan Hoover', 'Weekend Fund', 'Founder, Product Hunt; Weekend Fund', 2, ['Consumer', 'AI/ML', 'Robotics'], ['Product Hunt'], 'Founder of Product Hunt; runs Weekend Fund.'),
  angel('Ali Partovi', 'Neo', 'CEO, Neo; angel', 1, ['AI/ML', 'SaaS', 'Robotics'], ['Facebook', 'Dropbox', 'Airbnb', 'Uber'], 'CEO of Neo. Early angel in Facebook, Dropbox, Airbnb, Uber.'),
  angel('Hadi Partovi', 'Neo / Code.org', 'Founder, Code.org; angel', 1, ['AI/ML', 'EdTech', 'Robotics'], ['Facebook', 'Dropbox', 'Airbnb', 'Uber'], 'Founder of Code.org. Early angel in Facebook, Dropbox, Airbnb, Uber.'),
];

const norm = (s) => String(s || '').trim().toLowerCase();

(async () => {
  console.log('═'.repeat(66));
  console.log('  ADD FOUNDER-ANGELS   ' + (APPLY ? 'APPLY' : 'DRY-RUN'));
  console.log('═'.repeat(66));

  // Load existing names once.
  const existing = new Set();
  let off = 0; const P = 1000;
  while (true) {
    const { data, error } = await supabase.from('investors').select('name').range(off, off + P - 1);
    if (error) { console.error('fetch error:', error.message); process.exit(1); }
    if (!data || !data.length) break;
    for (const r of data) existing.add(norm(r.name));
    if (data.length < P) break;
    off += P;
  }
  console.log(`  existing investors loaded: ${existing.size}\n`);

  const toInsert = [];
  for (const a of ANGELS) {
    if (existing.has(norm(a.name))) { console.log(`  · exists  ${a.name}`); continue; }
    console.log(`  + new     ${a.name}  (${a.firm})`); toInsert.push(a);
  }

  console.log(`\n  new: ${toInsert.length} | already present: ${ANGELS.length - toInsert.length} | total in list: ${ANGELS.length}`);

  if (!APPLY) { console.log('\n  DRY RUN — no writes. Re-run with --apply.\n'); return; }
  if (!toInsert.length) { console.log('\n  Nothing to insert.\n'); return; }

  const { data, error } = await supabase.from('investors').insert(toInsert).select('id, name');
  if (error) { console.error('  insert error:', error.message); process.exit(1); }
  console.log(`\n  ✅ inserted ${data.length} investors.\n`);
})();
