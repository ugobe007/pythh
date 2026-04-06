#!/usr/bin/env node
/**
 * Audit: count entries that are news article URLs posing as startup websites
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { classifySuspiciousStartupWebsite } = require('../lib/suspiciousStartupWebsite');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  const { data } = await sb.from('startup_uploads')
    .select('id, name, website, total_god_score')
    .eq('status', 'approved')
    .limit(10000);

  const newsArticles = [];
  const noWebsite = [];
  const testEntries = [];

  for (const s of data) {
    // Detect test/junk names
    if (/test[-_]?[\d]{5,}|cleantest|quicktest|newstartup|^test$/i.test(s.name)) {
      testEntries.push(s);
      continue;
    }

    if (!s.website) {
      noWebsite.push(s);
      continue;
    }

    const { suspicious, reason } = classifySuspiciousStartupWebsite(s.website);
    if (suspicious) {
      newsArticles.push({
        ...s,
        reason: reason === 'news_domain' ? 'news domain' : 'article URL pattern',
      });
    }
  }

  const total = data.length;
  const junkTotal = newsArticles.length + testEntries.length;

  console.log('\n📊 DATA QUALITY AUDIT\n');
  console.log(`Total approved startups: ${total}`);
  console.log(`\n🚫 Junk entries breakdown:`);
  console.log(`  News article URLs:  ${newsArticles.length} (${Math.round(newsArticles.length/total*100)}%)`);
  console.log(`  Test/fake names:    ${testEntries.length} (${Math.round(testEntries.length/total*100)}%)`);
  console.log(`  No website at all:  ${noWebsite.length} (${Math.round(noWebsite.length/total*100)}%)`);
  console.log(`  ─────────────────────────`);
  console.log(`  Total junk:         ${junkTotal} (${Math.round(junkTotal/total*100)}%)`);

  const avgScoreFakes = newsArticles.reduce((a, b) => a + (b.total_god_score || 0), 0) / (newsArticles.length || 1);
  console.log(`\nAvg GOD score of news-article entries: ${Math.round(avgScoreFakes)}`);

  console.log('\n📰 Sample news-article entries:');
  newsArticles.slice(0, 15).forEach(s => {
    const reason = s.reason;
    console.log(`  [${s.total_god_score}] ${(s.name || '').slice(0, 38).padEnd(38)} | ${(s.website || '').slice(0, 65)} (${reason})`);
  });

  console.log('\n🧪 Sample test entries:');
  testEntries.slice(0, 10).forEach(s => {
    console.log(`  [${s.total_god_score}] ${s.name}`);
  });
})();
