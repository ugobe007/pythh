const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  // Get startup_events columns
  const { data: sample } = await supabase.from('startup_events').select('*').limit(3);
  if (sample && sample.length > 0) {
    console.log('=== STARTUP_EVENTS COLUMNS ===');
    console.log(Object.keys(sample[0]).join(', '));
    console.log('\nSample row:');
    console.log(JSON.stringify(sample[0], null, 2));
  } else {
    console.log('startup_events: no data returned (table may be empty or RLS blocking)');
  }

  // Get the YC bad names pattern
  console.log('\n=== YC BAD NAME PATTERN ===');
  const { data: ycBad } = await supabase.from('startup_uploads')
    .select('id, name, source, website')
    .eq('status', 'approved')
    .ilike('name', '%San Francisco%')
    .limit(5);
  (ycBad || []).forEach(s => {
    console.log('ID: ' + s.id);
    console.log('NAME: ' + s.name);
    console.log('SOURCE: ' + s.source);
    console.log('WEBSITE: ' + s.website);
    console.log('---');
  });

  // Count all bad-format YC names (name contains comma + state abbreviation pattern)
  const { count: totalBadYC } = await supabase.from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')
    .ilike('name', '%, %, USA%');
  console.log('\nTotal names containing city+state+USA pattern: ' + totalBadYC);
  
  // Also check for names with batch seasons
  const { count: seasonNames } = await supabase.from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')
    .ilike('name', '%Summer 20%');
  const { count: seasonNames2 } = await supabase.from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')
    .ilike('name', '%Winter 20%');
  const { count: seasonNames3 } = await supabase.from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')
    .ilike('name', '%Spring 20%');
  const { count: seasonNames4 } = await supabase.from('startup_uploads')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'approved')
    .ilike('name', '%Fall 20%');
  console.log('Names with season+year: Summer=' + seasonNames + ' Winter=' + seasonNames2 + ' Spring=' + seasonNames3 + ' Fall=' + seasonNames4);
  
  console.log('\nDone');
})();
