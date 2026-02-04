#!/usr/bin/env node
/**
 * Test extraction patterns to see why yield is low
 */

const https = require('https');
const http = require('http');

// Fetch an article and test extraction
const testUrl = 'https://news.google.com/rss/search?q=series+a+funding&hl=en-US';

// Full skip words from high-volume-discovery.js
const skipWords = new Set([
  'google', 'apple', 'microsoft', 'amazon', 'meta', 'openai', 'anthropic', 
  'nvidia', 'tesla', 'uber', 'airbnb', 'stripe', 'spacex', 'facebook', 'twitter',
  'linkedin', 'netflix', 'spotify', 'snapchat', 'tiktok', 'bytedance', 'alibaba',
  'slack', 'lyft', 'dropbox', 'zoom', 'shopify', 'paypal', 'square', 'doordash',
  'series', 'seed', 'round', 'funding', 'raises', 'raised', 'million', 'billion',
  'venture', 'capital', 'investor', 'startup', 'company', 'firm', 'fund',
  'the', 'a', 'an', 'and', 'or', 'new', 'top', 'best', 'first', 'last',
  'report', 'news', 'update', 'article', 'story', 'headline', 'insider',
  'tech', 'labs', 'data', 'cloud', 'app', 'pay', 'hub', 'box', 'ai', 'ml',
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'ceo', 'cto', 'cfo', 'founder', 'founders', 'executive', 'partner'
]);

function wouldPass(name) {
  if (!name || name.length < 3 || name.length > 50) return { pass: false, reason: 'length' };
  if (skipWords.has(name.toLowerCase())) return { pass: false, reason: 'skipword' };
  if (/^\d+$/.test(name)) return { pass: false, reason: 'numeric' };
  if (name === name.toLowerCase() && !/\d/.test(name) && !name.includes('.')) 
    return { pass: false, reason: 'all-lowercase' };
  if (/^[A-Z]{1,2}$/.test(name)) return { pass: false, reason: '1-2 letter code' };
  if (/^(News|Finsmes|Insider|Journal|Article|Report)\s/i.test(name)) 
    return { pass: false, reason: 'publication prefix' };
  return { pass: true, reason: 'OK' };
}

function fetchRSS(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function test() {
  console.log('Fetching RSS feed...');
  const xml = await fetchRSS(testUrl);
  
  // Extract titles
  const titles = xml.match(/<title>(.*?)<\/title>/g) || [];
  console.log(`\nFound ${titles.length} articles\n`);
  
  // Test extraction patterns
  const patterns = [
    { name: 'raises pattern', regex: /\b([A-Z][a-zA-Z0-9]+(?:[-\.][a-zA-Z0-9]+)?)\s+(?:raises?|secures?|announces?|closes?|lands?)/gi },
    { name: 'backed pattern', regex: /(?:backed|funded|invested\s+in)\s+([A-Z][a-zA-Z0-9]+)/gi },
    { name: 'dollar pattern', regex: /\$[\d,.]+[MBK]?\s+(?:for|to|into)\s+([A-Z][a-zA-Z0-9]+)/gi },
  ];
  
  let passCount = 0;
  let failCount = 0;
  
  for (const titleMatch of titles.slice(0, 15)) {
    const text = titleMatch.replace(/<[^>]*>/g, '');
    console.log('📰 ' + text.substring(0, 100));
    
    for (const { name, regex } of patterns) {
      let match;
      while ((match = regex.exec(text)) !== null) {
        const found = match[1];
        const result = wouldPass(found);
        if (result.pass) {
          console.log(`   ✅ ${name}: ${found}`);
          passCount++;
        } else {
          console.log(`   ❌ ${name}: ${found} (blocked: ${result.reason})`);
          failCount++;
        }
      }
      regex.lastIndex = 0;
    }
    console.log();
  }
  
  console.log('═══════════════════════════════════════');
  console.log(`✅ Passed: ${passCount}`);
  console.log(`❌ Blocked: ${failCount}`);
  console.log(`Pass rate: ${passCount > 0 ? ((passCount / (passCount + failCount)) * 100).toFixed(1) : 0}%`);
}

test().catch(console.error);
