#!/usr/bin/env node
/**
 * TRACE DATA PIPELINE — How startups get into startup_uploads
 * ===========================================================
 * Answers: What is the "hook"? Where do names come from? Real startups or garbage?
 *
 * Run: node scripts/trace-data-pipeline.js [--sample=20]
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

const sampleArg = process.argv.find(a => a.startsWith('--sample='));
const SAMPLE = sampleArg ? parseInt(sampleArg.split('=')[1]) : 20;

console.log('\n🔍 DATA PIPELINE TRACE\n');
console.log('═'.repeat(70));

console.log(`
HOOKS (Entry points that INSERT into startup_uploads):
─────────────────────────────────────────────────────
1. RSS SCRAPER (ssot-rss-scraper.js)
   - Reads TechCrunch, VentureBeat, etc.
   - Parses article → entity extraction (subject/object/entities)
   - primaryEntity.name = entity with role SUBJECT from event
   - Validates: isValidStartupName() before insert
   - Name can be: "Acme Inc", "By Anthropic", headline fragments
   - Risk: Parser extracts wrong thing → "Techcrunch Bluesky", "Doug Burgum"

2. DISCOVER-MORE-STARTUPS.js
   - Extracts company name from headline via regex: "X raises $YM"
   - extractCompanyName() — patterns like "Company raises $", "Company:"
   - Less entity extraction, more regex — can miss or misparse

3. MANUAL / API (startupResolver, investorService)
   - User submits URL or form → name from website/domain
   - status: 'approved' or 'pending'

4. OTHER SCRAPERS (ph-scraper, hn-scraper, funding-scraper, auto-ingest)
   - Product Hunt, Hacker News, funding sites
   - Name from scrape context (varies by scraper)

5. AUTO-IMPORT-PIPELINE
   - discovered_startups → startup_uploads
   - Name from discovery source

VALIDATION (What tries to catch garbage):
────────────────────────────────────────
- isValidStartupName() in ssot-rss-scraper (before insert)
- JUNK_ENTITY_WORDS / JUNK_ENTITY_PATTERNS in enrich-from-rss-news (skips match)
- cleanup-garbage.js — GARBAGE_PATTERNS, isGarbage() — identifies but doesn't auto-remove
- No validation on manual/API submissions beyond basic checks
`);

async function main() {
  // Source type distribution
  const { data: srcDist, error: e1 } = await supabase
    .from('startup_uploads')
    .select('source_type')
    .eq('status', 'approved');

  if (e1) {
    console.error('Query error:', e1.message);
    return;
  }

  const bySource = {};
  (srcDist || []).forEach(r => {
    const s = r.source_type || '(null)';
    bySource[s] = (bySource[s] || 0) + 1;
  });

  console.log('\nSOURCE TYPE DISTRIBUTION (approved startups):');
  console.log('─'.repeat(50));
  Object.entries(bySource)
    .sort((a, b) => b[1] - a[1])
    .forEach(([k, n]) => console.log(`  ${k.padEnd(30)} ${n}`));

  // Sample names that look suspicious (headline-like, generic)
  const SUSPICIOUS_PATTERNS = [
    /^(the|a|an|by|and|or|in|to)\s+/i,
    /^(techcrunch|forbes|bloomberg|reuters|wsj)\b/i,
    /(raises?|secured|closes?|announces?)\s*$/i,
    /\b(startup|company|fund|round)\s*$/i,
    /^\d+-/,
    /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+[A-Z][a-z]+/, // "First Last Name" — could be person
    /(introduced|joins|hits|seeks|gets|today|yesterday)/i,
  ];

  const { data: samples } = await supabase
    .from('startup_uploads')
    .select('id, name, source_type, website, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(500);

  const suspicious = (samples || []).filter(s => {
    const n = (s.name || '').trim();
    if (n.length < 4) return true;
    return SUSPICIOUS_PATTERNS.some(p => p.test(n));
  });

  console.log(`\n\nSUSPICIOUS NAMES (sample of 500, pattern-matched): ${suspicious.length}`);
  console.log('─'.repeat(50));
  suspicious.slice(0, SAMPLE).forEach(s => {
    console.log(`  ${(s.name || '').slice(0, 45).padEnd(46)} | ${s.source_type || '?'} | ${(s.website || 'no url').slice(0, 35)}`);
  });

  // Names that look like real companies (have website, reasonable length)
  const likelyReal = (samples || []).filter(s => {
    const n = (s.name || '').trim();
    return n.length >= 4 && n.length <= 40 && s.website && !SUSPICIOUS_PATTERNS.some(p => p.test(n));
  });
  console.log(`\n\nLIKELY REAL (have website, clean name): ${likelyReal.length} in sample`);
  console.log('─'.repeat(50));
  likelyReal.slice(0, 8).forEach(s => {
    console.log(`  ${(s.name || '').slice(0, 40).padEnd(42)} | ${(s.website || '').slice(0, 40)}`);
  });

  console.log('\n');
}

main().catch(console.error);
