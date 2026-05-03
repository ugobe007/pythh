require('dotenv').config();
const s = require('@supabase/supabase-js').createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const newSources = [
  { name: 'Axios Pro Rata', url: 'https://www.axios.com/feeds/feed.rss', category: 'funding', active: true },
  { name: 'The Information', url: 'https://www.theinformation.com/feed', category: 'funding', active: true },
  { name: 'PitchBook News', url: 'https://pitchbook.com/news/feed', category: 'funding', active: true },
  { name: 'Silicon Valley Business Journal', url: 'https://www.bizjournals.com/sanjose/news/feed', category: 'funding', active: true },
  { name: 'Dealroom', url: 'https://dealroom.co/blog/feed', category: 'funding', active: true },
  { name: 'VC Journal', url: 'https://vcjournal.com/feed', category: 'funding', active: true },
  { name: 'Pulse 2.0', url: 'https://pulse2.com/feed/', category: 'funding', active: true },
  { name: 'Startups.com Blog', url: 'https://www.startups.com/library/rss', category: 'funding', active: true },
  { name: 'VentureFizz', url: 'https://venturefizz.com/rss.xml', category: 'funding', active: true },
];

async function add() {
  let added = 0;
  for (const src of newSources) {
    const { data: ex } = await s.from('rss_sources').select('id').eq('name', src.name).limit(1);
    if (!ex || ex.length === 0) {
      await s.from('rss_sources').insert(src);
      console.log('Added:', src.name);
      added++;
    } else {
      console.log('Exists:', src.name);
    }
  }
  const { count } = await s.from('rss_sources').select('id', { count: 'exact', head: true }).eq('active', true);
  console.log('\nTotal active sources:', count);
}
add();
