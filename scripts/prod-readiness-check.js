require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

(async () => {
  const [scoreData, pending, investors, matches, signals, sessions, oracleSessions] = await Promise.all([
    sb.from('startup_uploads').select('total_god_score').eq('status','approved').not('total_god_score','is',null),
    sb.from('startup_uploads').select('id',{count:'exact',head:true}).eq('status','pending'),
    sb.from('investors').select('id',{count:'exact',head:true}),
    sb.from('startup_investor_matches').select('id',{count:'exact',head:true}).gte('match_score',60),
    sb.from('investors').select('id',{count:'exact',head:true}).neq('signals','[]').not('signals','is',null),
    sb.rpc('get_platform_velocity').single(),
    sb.from('oracle_sessions').select('id',{count:'exact',head:true}),
  ]);

  const s = scoreData.data.map(r => r.total_god_score);
  const avg = (s.reduce((a,b)=>a+b,0)/s.length).toFixed(1);
  const b = {'40-49':0,'50-59':0,'60-69':0,'70-79':0,'80-89':0,'90+':0};
  s.forEach(v => {
    if (v>=90) b['90+']++;
    else if (v>=80) b['80-89']++;
    else if (v>=70) b['70-79']++;
    else if (v>=60) b['60-69']++;
    else if (v>=50) b['50-59']++;
    else b['40-49']++;
  });

  console.log('=== GOD SCORES ===');
  console.log('Scored startups:', s.length, '| Avg:', avg, '| Min:', Math.min(...s), '| Max:', Math.max(...s));
  console.log('Dist:', JSON.stringify(b));

  console.log('\n=== SCALE ===');
  console.log('Investors:', investors.count, '| w/ Oracle signals:', signals.count, `(${Math.round(signals.count/investors.count*100)}%)`);
  console.log('Quality matches (>=60):', matches.count);
  console.log('Pending startups:', pending.count);

  console.log('\n=== LIVE SQL FUNCTIONS ===');
  const vel = sessions.data;
  console.log('get_platform_velocity:', sessions.error ? 'FAIL: '+sessions.error.message : 'OK');
  if (sessions.data) console.log('  total_matches_week:', sessions.data.total_matches_week, '| discovered_today:', sessions.data.startups_discovered_today);

  const hmTest = await sb.rpc('get_hot_matches', {limit_count:3, hours_ago:168});
  console.log('get_hot_matches:', hmTest.error ? 'FAIL: '+hmTest.error.message : `OK (${hmTest.data?.length} rows)`);

  const heatTest = await sb.rpc('get_sector_heat_map', {days_ago:7});
  console.log('get_sector_heat_map:', heatTest.error ? 'FAIL: '+heatTest.error.message : `OK (${heatTest.data?.length} sectors)`, heatTest.data?.[0]?.sector || '');

  console.log('\n=== ORACLE ===');
  console.log('Oracle sessions:', oracleSessions.count);

  console.log('\n=== PRODUCTION GAPS ===');
  const pct = Math.round(signals.count/investors.count*100);
  if (pct < 50) console.log('[WARN] Oracle signal coverage only', pct+'% — match quality bullets degraded for', investors.count - signals.count, 'investors');
  if (pending.count > 50) console.log('[WARN] Large pending queue:', pending.count);
  if (matches.count < 100000) console.log('[CRIT] Match count low:', matches.count);
  if (avg < 55 || avg > 75) console.log('[WARN] GOD score avg out of target range (55-75):', avg);
  console.log('Below 60:', s.filter(v=>v<60).length, '/', s.length, 'startups');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
