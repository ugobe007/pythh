require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

(async () => {
  try {
    // Get Nowports startup
    const { data: startup, error: startupError } = await supabase
      .from('startup_uploads')
      .select('*')
      .ilike('website', '%nowports%')
      .single();
    
    if (startupError) {
      console.error('Error fetching startup:', startupError);
      return;
    }
    
    console.log('\n=== NOWPORTS STARTUP ===');
    console.log('ID:', startup.id);
    console.log('Name:', startup.name);
    console.log('Website:', startup.website);
    console.log('Sectors:', startup.sectors);
    console.log('Stage:', startup.stage);
    console.log('Location:', startup.location);
    console.log('GOD Score:', startup.total_god_score);
    console.log('Status:', startup.status);
    console.log('Description:', startup.description?.substring(0, 100) + '...');
    
    // Get matches
    const { data: matches, error: matchError } = await supabase
      .from('startup_investor_matches')
      .select('match_score, investor_id')
      .eq('startup_id', startup.id)
      .order('match_score', { ascending: false });
    
    if (matchError) {
      console.error('Error fetching matches:', matchError);
      return;
    }
    
    console.log('\n=== MATCH DATA ===');
    console.log('Total matches:', matches.length);
    console.log('Above 50:', matches.filter(m => m.match_score >= 50).length);
    console.log('Above 40:', matches.filter(m => m.match_score >= 40).length);
    console.log('Above 30:', matches.filter(m => m.match_score >= 30).length);
    console.log('\nTop 10 scores:', matches.slice(0, 10).map(m => m.match_score));
    
    // Check investor count
    const { count: investorCount } = await supabase
      .from('investors')
      .select('*', { count: 'exact', head: true })
      .or('status.is.null,status.eq.active');
    
    console.log('\n=== INVESTOR DATASET ===');
    console.log('Total active investors:', investorCount);
    
    // Check logistics investors
    const { count: logisticsCount } = await supabase
      .from('investors')
      .select('*', { count: 'exact', head: true })
      .contains('sectors', ['Logistics'])
      .or('status.is.null,status.eq.active');
    
    console.log('Logistics investors:', logisticsCount);
    
    // Check seed stage investors
    const { count: seedCount } = await supabase
      .from('investors')
      .select('*', { count: 'exact', head: true })
      .contains('stage', ['Seed'])
      .or('status.is.null,status.eq.active');
    
    console.log('Seed stage investors:', seedCount);
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
})();
