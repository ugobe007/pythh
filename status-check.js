require('dotenv').config({ path: '/Users/leguplabs/Desktop/hot-honey/.env' });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // GOD scores
  const { data } = await sb.from('startup_uploads')
    .select('total_god_score,team_score,traction_score,market_score,product_score,vision_score,data_completeness,psychological_score,momentum_score,signal_score')
    .eq('status','approved').limit(10000);

  const scores = data.map(s=>s.total_god_score).filter(s=>s!=null);
  const avg = arr => arr.length ? (arr.reduce((a,b)=>a+b,0)/arr.length).toFixed(1) : 'N/A';

  console.log('\n=== [1] GOD SCORES ===');
  console.log('Count:', scores.length, '| Avg:', avg(scores), '| Min:', Math.min(...scores), '| Max:', Math.max(...scores));
  const b = {'90+':0,'80-89':0,'70-79':0,'60-69':0,'50-59':0,'40-49':0,'<40':0};
  scores.forEach(s=>{
    if(s>=90)b['90+']++;else if(s>=80)b['80-89']++;else if(s>=70)b['70-79']++;
    else if(s>=60)b['60-69']++;else if(s>=50)b['50-59']++;else if(s>=40)b['40-49']++;else b['<40']++;
  });
  Object.entries(b).forEach(([k,v])=>console.log('  '+k+':',v,'('+(v/scores.length*100).toFixed(1)+'%)'));
  console.log('Component avgs:',
    'Team='+avg(data.map(s=>s.team_score).filter(s=>s!=null)),
    'Traction='+avg(data.map(s=>s.traction_score).filter(s=>s!=null)),
    'Market='+avg(data.map(s=>s.market_score).filter(s=>s!=null)),
    'Product='+avg(data.map(s=>s.product_score).filter(s=>s!=null)),
    'Vision='+avg(data.map(s=>s.vision_score).filter(s=>s!=null))
  );

  console.log('\n=== [2] SIGNAL SCORES ===');
  const sigs = data.map(s=>s.signal_score).filter(s=>s!=null);
  const psych = data.map(s=>s.psychological_score).filter(s=>s!=null);
  const mom = data.map(s=>s.momentum_score).filter(s=>s!=null);
  console.log('signal_score:       count='+sigs.length+' avg='+avg(sigs));
  console.log('psychological_score: count='+psych.length+' avg='+avg(psych));
  console.log('momentum_score:      count='+mom.length+' avg='+avg(mom));

  console.log('\n=== [4] ENRICHMENT STATUS ===');
  const comp = data.map(s=>s.data_completeness).filter(s=>s!=null);
  console.log('data_completeness: '+comp.length+'/'+data.length+' scored | avg='+avg(comp)+'%');
  const needsEnrich = data.filter(s=>(s.data_completeness||0)<30).length;
  const sparse = data.filter(s=>s.total_god_score < 70).length;
  console.log('Startups with completeness < 30%:', needsEnrich);
  console.log('Startups with GOD score < 70:', sparse, '(enrichment targets)');

  // Check enrichment log
  const fs = require('fs');
  const logPaths = ['/tmp/enrichment-run.log', '/tmp/enrich-full.log'];
  let found = false;
  for(const lp of logPaths) {
    try {
      const log = fs.readFileSync(lp,'utf8');
      const lines = log.trim().split('\n');
      const enriched = lines.filter(l=>l.includes('Enriched') || l.includes('enriched') || l.includes('Added') || l.includes('✓')).length;
      console.log('Log ('+lp+'): '+lines.length+' lines, ~'+enriched+' processed');
      console.log('Last:', lines[lines.length-1].substring(0,120));
      found = true; break;
    } catch(e) {}
  }
  if(!found) console.log('No enrichment log found');

  // Goldilocks check
  const { data: gl, error: gle } = await sb.from('startup_investor_matches').select('score_breakdown').limit(3);
  console.log('\n=== [3] GOLDILOCKS / OTHER SCORES ===');
  if(gle) { console.log('match table error:', gle.message); }
  else {
    const hasGL = gl.filter(m=>m.score_breakdown && m.score_breakdown.goldilocks!=null).length;
    console.log('score_breakdown present:', gl.filter(m=>m.score_breakdown).length, '/3 sampled');
    console.log('Sample:', JSON.stringify(gl[0]?.score_breakdown));
  }

  // Check for Goldilocks table
  const { data: glRows, error: glErr } = await sb.from('goldilocks_candidates').select('id').limit(1);
  if(glErr) console.log('goldilocks_candidates table: NOT FOUND -', glErr.message);
  else console.log('goldilocks_candidates table: EXISTS');

  process.exit(0);
})();
