import { supabase } from './src/lib/supabase.js';

async function getCounts() {
  const [startups, investors, discovered, matches] = await Promise.all([
    supabase.from('startup_uploads').select('*', { count: 'exact', head: true }),
    supabase.from('investors').select('*', { count: 'exact', head: true }),
    supabase.from('discovered_startups').select('*', { count: 'exact', head: true }),
    supabase.from('startup_investor_matches').select('*', { count: 'exact', head: true })
  ]);
  
  console.log('\n📊 DATABASE COUNTS:');
  console.log('==================');
  console.log('Startups (approved):', startups.count || 0);
  console.log('Investors:', investors.count || 0);
  console.log('Discovered (pending):', discovered.count || 0);
  console.log('Matches:', matches.count || 0);
  
  // Get recent scraper activity
  const { data: recentStartups } = await supabase
    .from('startup_uploads')
    .select('name, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('\n🆕 RECENT STARTUPS:');
  console.log('==================');
  recentStartups?.forEach(s => {
    const date = new Date(s.created_at);
    console.log(`- ${s.name} (${date.toLocaleDateString()} ${date.toLocaleTimeString()})`);
  });
  
  // Get recent discovered
  const { data: recentDiscovered } = await supabase
    .from('discovered_startups')
    .select('name, source, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
    
  console.log('\n🔍 RECENT DISCOVERED:');
  console.log('=====================');
  recentDiscovered?.forEach(s => {
    const date = new Date(s.created_at);
    console.log(`- ${s.name} from ${s.source} (${date.toLocaleDateString()})`);
  });
}

getCounts().catch(console.error);
