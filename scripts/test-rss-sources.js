#!/usr/bin/env node
/**
 * Test RSS sources to identify which are working, blocked, or dead
 */

const https = require('https');
const http = require('http');

const sources = [
  { name: "500 Startups", url: "https://500.co/feed/" },
  { name: "Accel", url: "https://www.accel.com/noteworthy/feed" },
  { name: "Benchmark", url: "https://www.benchmark.com/feed/" },
  { name: "BVP", url: "https://www.bvp.com/atlas/feed" },
  { name: "BetaList", url: "https://betalist.com/feed.xml" },
  { name: "Canary Media", url: "https://www.canarymedia.com/feed" },
  { name: "Climate Tech VC", url: "https://www.climatetechvc.com/feed" },
  { name: "GGV Capital", url: "https://www.ggvc.com/blog-feed.xml" },
  { name: "GreenBiz", url: "https://www.greenbiz.com/feed" },
  { name: "Index Ventures", url: "https://www.indexventures.com/perspectives/feed" },
  { name: "KrASIA", url: "https://kr-asia.com/feed" },
  { name: "LocalGlobe", url: "https://localglobe.vc/feed/" },
  { name: "Matrix Partners", url: "https://www.matrixpartners.com/feed/" },
  { name: "Product Hunt Blog", url: "https://blog.producthunt.com/feed" },
  { name: "TechCrunch Japan", url: "https://jp.techcrunch.com/feed/" },
  { name: "Term Sheet", url: "https://fortune.com/section/term-sheet/feed/" },
  { name: "Wired UK", url: "https://www.wired.co.uk/feed/rss" },
  { name: "WSJ VC", url: "https://www.wsj.com/xml/rss/3_7014.xml" },
];

async function testUrl(name, url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => { 
        data += chunk; 
        if (data.length > 2000) res.destroy(); 
      });
      res.on('end', () => {
        const hasRss = data.includes('<rss') || data.includes('<feed') || data.includes('<channel');
        resolve({ name, url, status: res.statusCode, hasRss, size: data.length });
      });
    });
    req.on('error', (e) => resolve({ name, url, status: 'ERR', error: e.code || e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ name, url, status: 'TIMEOUT' }); });
  });
}

(async () => {
  console.log('Testing failing RSS sources...\n');
  console.log('NAME'.padEnd(22), 'STATUS'.padEnd(8), 'RSS?'.padEnd(6), 'VERDICT');
  console.log('-'.repeat(65));
  
  const working = [];
  const blocked = [];
  const dead = [];
  
  for (const { name, url } of sources) {
    const r = await testUrl(name, url);
    let verdict = 'DEAD';
    let icon = '❌';
    
    if (r.status === 200 && r.hasRss) { verdict = 'WORKING'; icon = '✅'; working.push(r); }
    else if (r.status === 200) { verdict = 'NO_RSS'; icon = '⚠️'; dead.push(r); }
    else if (r.status === 403) { verdict = 'BLOCKED'; icon = '🚫'; blocked.push(r); }
    else if (r.status === 404) { verdict = 'NOT_FOUND'; icon = '❌'; dead.push(r); }
    else if (r.status === 301 || r.status === 302) { verdict = 'REDIRECT'; icon = '↪️'; dead.push(r); }
    else if (r.status === 'TIMEOUT') { verdict = 'TIMEOUT'; icon = '⏰'; blocked.push(r); }
    else { dead.push(r); }
    
    console.log(icon, name.padEnd(20), String(r.status).padEnd(8), String(r.hasRss || '-').padEnd(6), verdict);
  }
  
  console.log('\n' + '='.repeat(65));
  console.log('SUMMARY:');
  console.log(`  ✅ Working: ${working.length}`);
  console.log(`  🚫 Blocked (need proxy): ${blocked.length}`);
  console.log(`  ❌ Dead (remove): ${dead.length}`);
  
  if (working.length > 0) {
    console.log('\n✅ WORKING (should scrape fine):');
    working.forEach(r => console.log(`   - ${r.name}`));
  }
  
  if (blocked.length > 0) {
    console.log('\n🚫 BLOCKED (need proxy or alternative):');
    blocked.forEach(r => console.log(`   - ${r.name}: ${r.status}`));
  }
})();
