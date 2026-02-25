require('dotenv').config({ path: '/Users/leguplabs/Desktop/hot-honey/.env' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const NEWS_DOMAINS = ['techcrunch.com','contxto.com','euronews.com','decrypt.co','venturebeat.com','forbes.com','bloomberg.com','reuters.com','cnbc.com','wsj.com','nytimes.com','theverge.com','wired.com','businessinsider.com','inc.com','crunchbase.com','axios.com','sifted.eu','startupnews.fyi','techeu.eu','silicon.co.uk','theregister.com','analyticsindiamag.com','pymnts.com','news.ycombinator.com','producthunt.com','medium.com','substack.com','businesswire.com','prnewswire.com','globenewswire.com'];

async function main() {
  const { data } = await sb.from('startup_uploads').select('id, name, website').eq('status','approved').not('website','is',null).limit(2000);
  let junk = 0, valid = 0, domainOnly = 0;
  const junkExamples = [];
  for (const s of data) {
    const url = s.website || '';
    try {
      const u = new URL(url.startsWith('http') ? url : 'https://' + url);
      const isNews = NEWS_DOMAINS.some(d => u.hostname.includes(d));
      const hasPath = u.pathname.length > 1;
      if (isNews) {
        junk++;
        if (junkExamples.length < 8) junkExamples.push('"' + s.name + '" -> ' + url.substring(0, 80));
      } else if (!hasPath) {
        domainOnly++;
      } else {
        valid++;
      }
    } catch(e) {
      junk++;
    }
  }
  console.log('Total approved with website: ' + data.length);
  console.log('  Valid startup URLs (with path): ' + valid);
  console.log('  Domain-only URLs (likely real): ' + domainOnly);
  console.log('  Junk/news article URLs: ' + junk + ' (' + Math.round(junk/data.length*100) + '%)');
  console.log('\nJunk examples:');
  junkExamples.forEach(e => console.log('  ' + e));
}
main().catch(console.error);
