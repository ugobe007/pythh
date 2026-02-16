#!/usr/bin/env node
/**
 * RSS FEED HEALTH AUDIT
 * Tests all active RSS sources and reports which ones work vs broken
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Parser = require('rss-parser');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
];

async function auditFeeds() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  RSS FEED HEALTH AUDIT');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const { data: sources, error } = await supabase
    .from('rss_sources')
    .select('id, name, url, category, active, last_scraped')
    .order('name');

  if (error) {
    console.error('Error fetching sources:', error);
    return;
  }

  console.log(`Total RSS sources: ${sources.length}`);
  console.log(`Active: ${sources.filter(s => s.active).length}`);
  console.log(`Inactive: ${sources.filter(s => !s.active).length}\n`);

  const results = {
    working: [],
    broken_404: [],
    broken_403: [],
    broken_401: [],
    broken_timeout: [],
    broken_dns: [],
    broken_parse: [],
    broken_other: [],
  };

  const activeSources = sources.filter(s => s.active);
  
  for (let i = 0; i < activeSources.length; i++) {
    const source = activeSources[i];
    process.stdout.write(`  [${i+1}/${activeSources.length}] ${source.name}... `);
    
    try {
      const parser = new Parser({
        timeout: 15000,
        headers: {
          'User-Agent': USER_AGENTS[0],
          'Accept': 'application/rss+xml, application/xml, text/xml, */*',
        }
      });

      const feed = await Promise.race([
        parser.parseURL(source.url),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 15000))
      ]);

      const itemCount = feed.items?.length || 0;
      const latestDate = feed.items?.[0]?.pubDate || feed.items?.[0]?.isoDate || 'unknown';
      console.log(`✅ ${itemCount} items (latest: ${latestDate})`);
      results.working.push({ ...source, itemCount, latestDate });
    } catch (err) {
      const msg = err.message || '';
      let category = 'broken_other';
      let label = 'OTHER';
      
      if (msg.includes('404') || msg.includes('Not Found')) { category = 'broken_404'; label = '404'; }
      else if (msg.includes('403') || msg.includes('Forbidden')) { category = 'broken_403'; label = '403'; }
      else if (msg.includes('401') || msg.includes('Unauthorized')) { category = 'broken_401'; label = '401'; }
      else if (msg.includes('Timeout') || msg.includes('timeout') || msg.includes('ETIMEDOUT')) { category = 'broken_timeout'; label = 'TIMEOUT'; }
      else if (msg.includes('ENOTFOUND') || msg.includes('getaddrinfo')) { category = 'broken_dns'; label = 'DNS'; }
      else if (msg.includes('XML') || msg.includes('parse') || msg.includes('Invalid')) { category = 'broken_parse'; label = 'PARSE'; }
      
      console.log(`❌ ${label}: ${msg.slice(0, 80)}`);
      results[category].push({ ...source, error: msg });
    }
    
    // Small delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  AUDIT RESULTS');
  console.log('═══════════════════════════════════════════════════════════════\n');

  console.log(`  ✅ Working:    ${results.working.length}`);
  console.log(`  ❌ 404:        ${results.broken_404.length}`);
  console.log(`  ❌ 403:        ${results.broken_403.length}`);  
  console.log(`  ❌ 401:        ${results.broken_401.length}`);
  console.log(`  ❌ Timeout:    ${results.broken_timeout.length}`);
  console.log(`  ❌ DNS:        ${results.broken_dns.length}`);
  console.log(`  ❌ Parse:      ${results.broken_parse.length}`);
  console.log(`  ❌ Other:      ${results.broken_other.length}`);

  // List broken feeds with URLs
  const allBroken = [
    ...results.broken_404.map(s => ({ ...s, reason: '404' })),
    ...results.broken_403.map(s => ({ ...s, reason: '403' })),
    ...results.broken_401.map(s => ({ ...s, reason: '401' })),
    ...results.broken_timeout.map(s => ({ ...s, reason: 'TIMEOUT' })),
    ...results.broken_dns.map(s => ({ ...s, reason: 'DNS' })),
    ...results.broken_parse.map(s => ({ ...s, reason: 'PARSE' })),
    ...results.broken_other.map(s => ({ ...s, reason: 'OTHER' })),
  ];
  
  if (allBroken.length > 0) {
    console.log('\n📋 BROKEN FEEDS (need fix or removal):');
    allBroken.forEach(s => {
      console.log(`  ${s.reason.padEnd(7)} | ${s.name.padEnd(35)} | ${s.url}`);
    });
  }

  // List working feeds
  if (results.working.length > 0) {
    console.log('\n✅ WORKING FEEDS:');
    results.working.forEach(s => {
      console.log(`  ${String(s.itemCount).padStart(3)} items | ${s.name.padEnd(35)} | ${s.url}`);
    });
  }

  // Save results for programmatic use
  const summary = {
    total: activeSources.length,
    working: results.working.length,
    broken: allBroken.length,
    brokenFeeds: allBroken.map(s => ({ id: s.id, name: s.name, url: s.url, reason: s.reason })),
    workingFeeds: results.working.map(s => ({ id: s.id, name: s.name, url: s.url, items: s.itemCount })),
  };

  require('fs').writeFileSync('/tmp/rss-audit-results.json', JSON.stringify(summary, null, 2));
  console.log('\n📄 Full results saved to /tmp/rss-audit-results.json');

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  AUDIT COMPLETE');
  console.log('═══════════════════════════════════════════════════════════════');
}

auditFeeds().catch(console.error);
