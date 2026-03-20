#!/usr/bin/env node
/**
 * P3: Extract phrases from startup pitch/description and investor thesis
 * Populates phrase_ontology for matching, clustering, trend detection.
 *
 * Run: node scripts/extract-phrase-ontology.js [--limit=500] [--dry-run]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Known founder/investor phrase patterns (rule-based extraction)
const FOUNDER_PATTERNS = [
  { re: /\bwe're?\s+building\s+(?:the\s+)?(\w+(?:\s+\w+){0,2})\s+for\s+(\w+)/gi, phrase: "we're building the X for Y", context: 'founder' },
  { re: /\bpre-?product\b/gi, phrase: 'pre-product', context: 'founder' },
  { re: /\bstealth\b/gi, phrase: 'stealth', context: 'founder' },
  { re: /\bearly\s+stage\b/gi, phrase: 'early stage', context: 'founder' },
  { re: /\bproduct-?market\s+fit\b/gi, phrase: 'product-market fit', context: 'founder' },
  { re: /\bfounder-?market\s+fit\b/gi, phrase: 'founder-market fit', context: 'founder' },
  { re: /\btraction\b/gi, phrase: 'traction', context: 'founder' },
  { re: /\barr\b/gi, phrase: 'ARR', context: 'founder' },
  { re: /\bmrr\b/gi, phrase: 'MRR', context: 'founder' },
  { re: /\bplg\b/gi, phrase: 'PLG', context: 'founder' },
  { re: /\bb2b\b/gi, phrase: 'B2B', context: 'founder' },
  { re: /\bb2c\b/gi, phrase: 'B2C', context: 'founder' },
  { re: /\bsaas\b/gi, phrase: 'SaaS', context: 'founder' },
  { re: /\bai-?powered\b/gi, phrase: 'AI-powered', context: 'founder' },
  { re: /\bseed\s+stage\b/gi, phrase: 'seed stage', context: 'founder' },
  { re: /\bseries\s+[abc]\b/gi, phrase: 'series round', context: 'founder' },
];

const INVESTOR_PATTERNS = [
  { re: /\bconviction\b/gi, phrase: 'conviction', context: 'investor' },
  { re: /\bcontrarian\b/gi, phrase: 'contrarian', context: 'investor' },
  { re: /\bthesis\b/gi, phrase: 'thesis', context: 'investor' },
  { re: /\bcheck\s+size\b/gi, phrase: 'check size', context: 'investor' },
  { re: /\blead\s+(?:or\s+)?follow\b/gi, phrase: 'lead or follow', context: 'investor' },
  { re: /\bhands-?on\b/gi, phrase: 'hands-on', context: 'investor' },
  { re: /\boperator\s+led\b/gi, phrase: 'operator led', context: 'investor' },
  { re: /\bpattern\s+matching\b/gi, phrase: 'pattern matching', context: 'investor' },
  { re: /\bfounder-?market\s+fit\b/gi, phrase: 'founder-market fit', context: 'investor' },
  { re: /\bproduct-?market\s+fit\b/gi, phrase: 'product-market fit', context: 'investor' },
];

function extractPhrases(text, patterns) {
  if (!text || typeof text !== 'string') return [];
  const seen = new Set();
  const out = [];
  for (const { re, phrase, context } of patterns) {
    const matches = text.match(re);
    if (matches) {
      const key = `${phrase}|${context}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.push({ phrase, context, count: matches.length });
      }
    }
  }
  return out;
}

async function main() {
  const limit = parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '500', 10);
  const dryRun = process.argv.includes('--dry-run');

  console.log('\n📚 P3 Phrase Ontology Extraction');
  console.log('═'.repeat(50));

  const phraseCounts = new Map(); // "phrase|context" -> { phrase, context, frequency }

  // 1. Startup pitch/description/tagline
  const { data: startups, error: se } = await supabase
    .from('startup_uploads')
    .select('id, pitch, description, tagline, sectors, stage, extracted_data')
    .eq('status', 'approved')
    .not('pitch', 'is', null)
    .limit(limit);

  if (se) {
    console.error('Startup fetch error:', se.message);
    process.exit(1);
  }

  for (const s of startups || []) {
    const text = [s.pitch, s.description, s.tagline, s.extracted_data?.pitch, s.extracted_data?.description]
      .filter(Boolean)
      .join(' ');
    const sector = Array.isArray(s.sectors) ? s.sectors[0] : null;
    const stage = s.stage ? (s.stage <= 2 ? 'seed' : s.stage <= 4 ? 'series-a' : 'growth') : null;
    for (const { phrase, context, count } of extractPhrases(text, FOUNDER_PATTERNS)) {
      const key = `${phrase}|${context}`;
      const cur = phraseCounts.get(key) || { phrase, context, frequency: 0, sector, stage };
      cur.frequency += count;
      if (sector && !cur.sector) cur.sector = sector;
      if (stage && !cur.stage) cur.stage = stage;
      phraseCounts.set(key, cur);
    }
  }
  console.log(`   Processed ${(startups || []).length} startups`);

  // 2. Investor description/thesis (firm_description_normalized, investment_thesis, investment_firm_description)
  const { data: investors } = await supabase
    .from('investors')
    .select('id, firm_description_normalized, investment_thesis, investment_firm_description, sectors')
    .or('firm_description_normalized.not.is.null,investment_thesis.not.is.null,investment_firm_description.not.is.null')
    .limit(limit);

  for (const i of investors || []) {
    const text = [i.firm_description_normalized, i.investment_thesis, i.investment_firm_description].filter(Boolean).join(' ');
    const sector = Array.isArray(i.sectors) ? (typeof i.sectors[0] === 'string' ? i.sectors[0] : i.sectors[0]?.name) : null;
    for (const { phrase, context, count } of extractPhrases(text, INVESTOR_PATTERNS)) {
      const key = `${phrase}|${context}`;
      const cur = phraseCounts.get(key) || { phrase, context, frequency: 0, sector, stage: null };
      cur.frequency += count;
      if (sector && !cur.sector) cur.sector = sector;
      phraseCounts.set(key, cur);
    }
  }
  console.log(`   Processed ${(investors || []).length} investors`);

  const rows = [...phraseCounts.values()].filter(r => r.frequency >= 1);

  if (dryRun) {
    console.log(`\n   [DRY RUN] Would upsert ${rows.length} phrases`);
    rows.slice(0, 10).forEach(r => console.log(`     - ${r.phrase} (${r.context}): ${r.frequency}`));
    return;
  }

  let upserted = 0;
  for (const r of rows) {
    const phrase = String(r.phrase).toLowerCase().trim();
    const { error } = await supabase.from('phrase_ontology').upsert(
      {
        phrase,
        context: r.context,
        sector: r.sector || null,
        stage: r.stage || null,
        frequency: r.frequency,
        source: 'extraction',
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'phrase,context', ignoreDuplicates: false }
    );
    if (!error) upserted++;
  }

  console.log(`\n   ✅ Upserted ${upserted} phrase entries`);
}

main().catch(console.error);
