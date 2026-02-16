require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  try {
    // 1. discovered_startups (RSS stream)
    const { data: rss, count: rssCount } = await supabase
      .from('discovered_startups')
      .select('id, company_name, source, created_at, sector, funding_amount, status', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(5);
    console.log('=== RSS/DISCOVERED STARTUPS ===');
    console.log('Total:', rssCount);
    console.log('Latest:', JSON.stringify(rss, null, 2));

    // 2. rss_sources
    const { data: sources, count: srcCount } = await supabase
      .from('rss_sources')
      .select('id, name, url, status', { count: 'exact' })
      .limit(5);
    console.log('\n=== RSS SOURCES ===');
    console.log('Total:', srcCount);
    console.log('Sources:', JSON.stringify(sources, null, 2));

    // 3. ai_logs
    const { data: logs, count: logCount } = await supabase
      .from('ai_logs')
      .select('id, type, message, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(5);
    console.log('\n=== AI LOGS ===');
    console.log('Total:', logCount);
    console.log('Latest:', JSON.stringify(logs, null, 2));

    // 4. Top GOD scores
    const { data: scores } = await supabase
      .from('startup_uploads')
      .select('name, total_god_score, momentum_score')
      .eq('status', 'approved')
      .order('total_god_score', { ascending: false })
      .limit(5);
    console.log('\n=== TOP GOD SCORES ===');
    console.log(JSON.stringify(scores, null, 2));

    // 5. Match stats
    const { count: matchCount } = await supabase
      .from('startup_investor_matches')
      .select('*', { count: 'exact', head: true });
    console.log('\n=== MATCHES ===');
    console.log('Total matches:', matchCount);

    // 6. Approved startups count
    const { count: approvedCount } = await supabase
      .from('startup_uploads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'approved');
    console.log('Approved startups:', approvedCount);

    // 7. Investor count
    const { count: investorCount } = await supabase
      .from('investors')
      .select('*', { count: 'exact', head: true });
    console.log('Investors:', investorCount);

    // 8. Score history
    const { data: scoreHist, count: histCount } = await supabase
      .from('score_history')
      .select('id, startup_id, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(3);
    console.log('\n=== SCORE HISTORY ===');
    console.log('Total:', histCount);
    console.log('Latest:', JSON.stringify(scoreHist, null, 2));

    // 9. Recent startups (today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayCount } = await supabase
      .from('discovered_startups')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    console.log('\nDiscovered today:', todayCount);

    // 10. PM2 / ML training check
    const { data: mlLogs } = await supabase
      .from('ai_logs')
      .select('type, message, created_at')
      .or('type.ilike.%ml%,type.ilike.%train%,message.ilike.%training%')
      .order('created_at', { ascending: false })
      .limit(5);
    console.log('\n=== ML TRAINING LOGS ===');
    console.log(JSON.stringify(mlLogs, null, 2));

    // 11. Check discovered_startups columns
    const { data: sampleDisc } = await supabase
      .from('discovered_startups')
      .select('*')
      .limit(1);
    if (sampleDisc && sampleDisc[0]) {
      console.log('\n=== DISCOVERED_STARTUPS COLUMNS ===');
      console.log(Object.keys(sampleDisc[0]).join(', '));
    }

  } catch (err) {
    console.error('Error:', err);
  }
})();
