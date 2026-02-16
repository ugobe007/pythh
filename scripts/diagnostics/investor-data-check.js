#!/usr/bin/env node
require('dotenv').config();
const sb = require('@supabase/supabase-js').createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function main() {
  const { data: sample } = await sb.from('investors')
    .select('total_investments, successful_exits, active_fund_size, check_size_min, check_size_max, investment_thesis, bio, leads_rounds, stage, sectors, geography_focus, type, signals')
    .limit(500);
  
  const fields = ['total_investments','successful_exits','active_fund_size','check_size_min','check_size_max','investment_thesis','bio','leads_rounds','stage','sectors','geography_focus','type','signals'];
  
  console.log('=== INVESTOR DATA COMPLETENESS (sample of', sample.length, ') ===');
  fields.forEach(f => {
    const filled = sample.filter(r => {
      const v = r[f];
      if (v === null || v === undefined) return false;
      if (typeof v === 'string' && v.trim() === '') return false;
      if (Array.isArray(v) && v.length === 0) return false;
      if (typeof v === 'number' && v === 0) return false;
      return true;
    }).length;
    console.log(f.padEnd(25), (filled/sample.length*100).toFixed(0) + '%', '(' + filled + '/' + sample.length + ')');
  });
  
  // Check where the scoring bottleneck is
  // The scoring needs: total_investments, successful_exits, investment_pace, last_investment_date, active_fund_size, dry_powder, sectors, investment_thesis, leads_rounds, avg_response_time, decision_maker
  // Most of these will be 0 → score near 0
  
  // What data DO most investors have?
  console.log('\n=== WHAT INVESTORS HAVE (nonzero) ===');
  const invWithInvestments = sample.filter(r => r.total_investments > 0);
  console.log('Has total_investments > 0:', invWithInvestments.length);
  if (invWithInvestments.length > 0) {
    const vals = invWithInvestments.map(r => r.total_investments).sort((a,b) => a-b);
    console.log('  Median:', vals[Math.floor(vals.length/2)], 'Max:', vals[vals.length-1]);
  }
  
  const invWithFund = sample.filter(r => r.active_fund_size > 0);
  console.log('Has fund_size > 0:', invWithFund.length);
  
  const invWithExits = sample.filter(r => r.successful_exits > 0);
  console.log('Has exits > 0:', invWithExits.length);
  
  const invWithThesis = sample.filter(r => r.investment_thesis && r.investment_thesis.length > 50);
  console.log('Has thesis (>50 chars):', invWithThesis.length);
  
  const invWithSectors = sample.filter(r => r.sectors && r.sectors.length > 0);
  console.log('Has sectors:', invWithSectors.length);
  
  const invWithStage = sample.filter(r => r.stage && r.stage.length > 0);
  console.log('Has stage:', invWithStage.length);
}

main().catch(console.error);
