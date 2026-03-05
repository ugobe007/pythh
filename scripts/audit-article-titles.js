#!/usr/bin/env node
/**
 * Find article-title entries posing as startups
 * Pattern: names ending in "Has", "Raises", "Secures", "Launches", "Closes", etc.
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Article headline verb patterns that indicate a name came from an article title
const ARTICLE_VERB_PATTERNS = [
  /\b(has|have)\s+(raised|secured|closed|launched|announced|partnered|acquired|hired|expanded|won|received|signed)/i,
  /\b(raises?|raised)\b/i,
  /\b(secures?|secured)\b/i,
  /\b(closes?|closed)\s+(funding|round|deal|series)/i,
  /\b(launches?|launched)\b/i,
  /\b(announces?|announced)\b/i,
  /\b(acquires?|acquired)\b/i,
  /\b(expands?)\b/i,
  /\b(partners?)\s+with\b/i,
  /\b(receives?|received)\b/i,
  /^(the|a|an)\s+/i,  // names starting with "The", "A", "An"
  /\b(new|latest|first|nextgen)\b/i,
  /\b(funding|investors?|venture|capital|backed|funded)\b/i,
  /\b(startup|company|firm|platform)\b/i,  // "startup" in name = probably article desc
];

(async () => {
  const { data } = await sb.from('startup_uploads')
    .select('id, name, website, total_god_score, status')
    .eq('status', 'approved')
    .limit(10000);

  const articleTitles = [];
  const tooShort = [];
  const tooGeneric = [];

  for (const s of data) {
    const name = (s.name || '').trim();
    
    // Check article verb patterns
    if (ARTICLE_VERB_PATTERNS.some(p => p.test(name))) {
      articleTitles.push(s);
      continue;
    }
    
    // Too short (1 word, less than 3 chars)
    if (name.length < 3) {
      tooShort.push(s);
      continue;
    }
    
    // Numeric test IDs
    if (/test[-_]?\d{5,}|cleantest|quicktest|^test-|^test_/i.test(name)) {
      tooGeneric.push(s);
    }
  }

  const total = data.length;
  console.log('\n🔬 ARTICLE TITLE & JUNK ENTRY AUDIT\n');
  console.log(`Total approved: ${total}`);
  console.log(`\nArticle-title names: ${articleTitles.length} (${Math.round(articleTitles.length/total*100)}%)`);
  console.log(`Test/junk entries:   ${tooGeneric.length} (${Math.round(tooGeneric.length/total*100)}%)`);
  console.log(`Too short names:     ${tooShort.length} (${Math.round(tooShort.length/total*100)}%)`);
  
  const totalJunk = articleTitles.length + tooGeneric.length + tooShort.length;
  console.log(`\nTotal removable junk: ~${totalJunk} (${Math.round(totalJunk/total*100)}%)`);

  const avgScore = articleTitles.reduce((a, b) => a + (b.total_god_score || 0), 0) / (articleTitles.length || 1);
  console.log(`Avg score of article-title entries: ${Math.round(avgScore)}`);

  console.log('\n📰 Sample article-title entries:');
  articleTitles.slice(0, 20).forEach(s => {
    console.log(`  [${s.total_god_score}] ${s.name}`);
  });

  console.log('\n🧹 To clean these up, run:');
  console.log('  node scripts/cleanup-junk-entries.js --dry-run');
  console.log('  node scripts/cleanup-junk-entries.js  (to actually reject them)');
})();
