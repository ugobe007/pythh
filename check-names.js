const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  // 1. Recent startup_events (SSOT scraper output)
  console.log('=== RECENT STARTUP_EVENTS ===');
  const { data: events } = await supabase.from('startup_events')
    .select('event_type, company_name, headline, source_feed, created_at')
    .order('created_at', { ascending: false })
    .limit(15);
  (events || []).forEach(e => {
    const ts = e.created_at ? e.created_at.substring(0, 16) : '?';
    console.log(ts + ' | ' + (e.event_type || '?').padEnd(15) + ' | ' + (e.company_name || '?').substring(0, 25).padEnd(25) + ' | ' + (e.source_feed || '?').substring(0, 20));
  });

  // 2. YC-sourced bad names
  console.log('\n=== YC-SOURCED BAD NAMES ===');
  const { data: ycBad } = await supabase.from('startup_uploads')
    .select('id, name, source')
    .eq('status', 'approved')
    .like('name', '%San Francisco%')
    .limit(10);
  console.log('YC concatenated names:', (ycBad || []).length);
  (ycBad || []).forEach(s => console.log('  [' + (s.source || '?') + '] ' + s.name.substring(0, 80)));

  // 3. Count all bad YC names (city in name)
  const cities = ['San Francisco', 'New York', 'Mountain View', 'Palo Alto', 'Los Angeles', 'Seattle', 'Boston', 'Austin', 'Chicago', 'London'];
  for (const city of cities) {
    const { count } = await supabase.from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved')
      .like('name', '%' + city + '%');
    if (count > 0) console.log('  Names containing "' + city + '": ' + count);
  }

  // 4. SSOT scraper name quality
  console.log('\n=== SSOT SCRAPER NAME QUALITY ===');
  const { data: eventNames } = await supabase.from('startup_events')
    .select('company_name, headline')
    .not('company_name', 'is', null)
    .order('created_at', { ascending: false })
    .limit(50);
  const badEventNames = (eventNames || []).filter(e => {
    const n = (e.company_name || '').toLowerCase();
    return n.includes('announces') || n.includes('launches') || n.includes('merge ') ||
           n.includes('nasdaq') || n.length > 40 || /^(the|a|an|new|why|how)\s/i.test(e.company_name || '');
  });
  console.log('Recent events with suspicious names: ' + badEventNames.length + '/' + (eventNames || []).length);
  badEventNames.slice(0, 10).forEach(e => console.log('  NAME: ' + e.company_name + '  |  HEADLINE: ' + (e.headline || '?').substring(0, 60)));

  console.log('\nDone');
})();
