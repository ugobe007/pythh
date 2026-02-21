require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
(async () => {
  const { data: dist, error } = await sb.from('startup_uploads')
    .select('total_god_score,data_completeness,enrichment_status')
    .eq('status','approved')
    .limit(15000);
  if (error) { console.error('ERR', error.message); process.exit(1); }
  const scores = dist.map(s=>s.total_god_score).filter(v=>v!=null);
  const avg = (scores.reduce((a,b)=>a+b,0)/scores.length).toFixed(1);
  const b = {'90+':0,'80-89':0,'70-79':0,'60-69':0,'50-59':0,'40-49':0,'<40':0};
  scores.forEach(s=>{if(s>=90)b['90+']++;else if(s>=80)b['80-89']++;else if(s>=70)b['70-79']++;else if(s>=60)b['60-69']++;else if(s>=50)b['50-59']++;else if(s>=40)b['40-49']++;else b['<40']++;});
  const estatus = {};
  dist.forEach(s=>{const k=s.enrichment_status||'null'; estatus[k]=(estatus[k]||0)+1;});
  const ca = dist.map(s=>s.data_completeness).filter(c=>c!=null);
  const cavg = ca.length ? (ca.reduce((a,c)=>a+c,0)/ca.length).toFixed(1) : 'N/A';
  const cb = {c0:ca.filter(c=>c===0).length,c1_20:ca.filter(c=>c>0&&c<=20).length,c21_40:ca.filter(c=>c>20&&c<=40).length,c41_60:ca.filter(c=>c>40&&c<=60).length,c61_80:ca.filter(c=>c>60&&c<=80).length,c81p:ca.filter(c=>c>80).length};
  console.log('=== GOD SCORE DISTRIBUTION ===');
  console.log('Total:',scores.length,'Avg:',avg,'Min:',Math.min(...scores),'Max:',Math.max(...scores));
  Object.entries(b).forEach(([k,v])=>console.log(' ',k+':',v,'('+(v/scores.length*100).toFixed(1)+'%)'));
  console.log('\n=== DATA COMPLETENESS ===');
  console.log('Avg:',cavg+'%','|',ca.length,'have data');
  console.log('  0%:',cb.c0,' 1-20%:',cb.c1_20,' 21-40%:',cb.c21_40,' 41-60%:',cb.c41_60,' 61-80%:',cb.c61_80,' 81-100%:',cb.c81p);
  console.log('\n=== ENRICHMENT STATUS ===');
  Object.entries(estatus).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(' ',k+':',v));
})().catch(e=>console.error('ERR',e.message));
