require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY);
(async () => {
  const { data: investors, error } = await sb.from('investors')
    .select('id,name,sectors,stage,investment_thesis,portfolio_companies,check_size_min,check_size_max,tier,total_investments,recent_investments,preferred_sectors,preferred_stages,lead_investor,extracted_data')
    .limit(5000);
  if (error) { console.error('ERR investors', error.message); return; }
  const total = investors.length;
  const pct = n => (n/total*100).toFixed(0)+'%';
  const f = {
    sectors: investors.filter(i=>i.sectors&&i.sectors.length>0).length,
    stage: investors.filter(i=>i.stage).length,
    investment_thesis: investors.filter(i=>i.investment_thesis&&i.investment_thesis.length>10).length,
    portfolio_companies: investors.filter(i=>i.portfolio_companies&&i.portfolio_companies.length>0).length,
    check_size: investors.filter(i=>i.check_size_min||i.check_size_max).length,
    total_investments: investors.filter(i=>i.total_investments>0).length,
    recent_investments: investors.filter(i=>i.recent_investments&&i.recent_investments.length>0).length,
    preferred_sectors: investors.filter(i=>i.preferred_sectors&&i.preferred_sectors.length>0).length,
    preferred_stages: investors.filter(i=>i.preferred_stages&&i.preferred_stages.length>0).length,
    lead_investor: investors.filter(i=>i.lead_investor!=null).length,
    extracted_data: investors.filter(i=>i.extracted_data&&Object.keys(i.extracted_data).length>0).length,
  };
  console.log('=== INVESTOR FIELD COVERAGE ('+total+' total) ===');
  Object.entries(f).forEach(([k,v])=>console.log(' ',k+':',v,'('+pct(v)+')'));

  // Signal events
  const { data: sigRows, error: se } = await sb.from('signal_events').select('signal_type,entity_type').limit(10000);
  if (sigRows) {
    const types = {}; const entityTypes = {};
    sigRows.forEach(s=>{types[s.signal_type]=(types[s.signal_type]||0)+1; entityTypes[s.entity_type]=(entityTypes[s.entity_type]||0)+1;});
    console.log('\n=== SIGNAL_EVENTS (sample 10k) ===');
    console.log('Total sampled:',sigRows.length);
    Object.entries(types).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(' ',k+':',v));
    console.log('Entity types:', JSON.stringify(entityTypes));
  }

  // Startup signal scores dominant signals
  const { data: ss } = await sb.from('startup_signal_scores').select('dominant_signal,signal_count').limit(5000);
  if (ss) {
    const dom = {}; let totalSig=0;
    ss.forEach(s=>{dom[s.dominant_signal||'none']=(dom[s.dominant_signal||'none']||0)+1; totalSig+=(s.signal_count||0);});
    console.log('\n=== STARTUP SIGNAL SCORES ('+ss.length+' entries) ===');
    console.log('Avg signals/startup:', (totalSig/ss.length).toFixed(1));
    Object.entries(dom).sort((a,b)=>b[1]-a[1]).slice(0,10).forEach(([k,v])=>console.log(' ',k+':',v));
  }
})().catch(e=>console.error('ERR',e.message));
