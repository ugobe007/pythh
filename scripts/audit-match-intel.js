#!/usr/bin/env node
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

(async () => {
  // ── MATCH TABLE ─────────────────────────────────────────────────────────
  const { count: total } = await sb.from('startup_investor_matches').select('*', { count: 'exact', head: true });
  const { count: viewed } = await sb.from('startup_investor_matches').select('*', { count: 'exact', head: true }).not('viewed_at', 'is', null);
  const { count: intro } = await sb.from('startup_investor_matches').select('*', { count: 'exact', head: true }).not('intro_requested_at', 'is', null);
  const { count: contacted } = await sb.from('startup_investor_matches').select('*', { count: 'exact', head: true }).not('contacted_at', 'is', null);
  const { count: feedback } = await sb.from('startup_investor_matches').select('*', { count: 'exact', head: true }).not('feedback_received', 'is', null);

  console.log('=== MATCH TABLE ===');
  console.log('Total matches:      ', total);
  console.log('Viewed:             ', viewed, viewed ? '(' + Math.round(viewed / total * 100) + '%)' : '');
  console.log('Intro requested:    ', intro);
  console.log('Contacted:          ', contacted);
  console.log('Feedback received:  ', feedback);

  // ── MATCH QUALITY ────────────────────────────────────────────────────────
  const { data: sample } = await sb.from('startup_investor_matches')
    .select('match_score,confidence_level,similarity_score,success_score,reasoning,fit_analysis,why_you_match')
    .limit(3000);

  const scores = sample.map(r => r.match_score).filter(Boolean);
  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

  console.log('\n=== MATCH QUALITY SIGNALS ===');
  console.log('Avg match_score:', avg(scores).toFixed(1));
  const b = { elite: 0, high: 0, mid: 0, low: 0 };
  scores.forEach(s => { if (s >= 85) b.elite++; else if (s >= 70) b.high++; else if (s >= 55) b.mid++; else b.low++; });
  console.log('Score buckets  85+:', b.elite, ' | 70-84:', b.high, ' | 55-69:', b.mid, ' | <55:', b.low);
  const confLevels = [...new Set(sample.map(r => r.confidence_level).filter(Boolean))];
  console.log('Confidence levels:', confLevels.join(', '));
  console.log('Has reasoning text:', sample.filter(r => r.reasoning && r.reasoning.length > 10).length);
  console.log('Has fit_analysis JSON:', sample.filter(r => r.fit_analysis && Object.keys(r.fit_analysis).length > 0).length);
  console.log('Has why_you_match text:', sample.filter(r => r.why_you_match && r.why_you_match.length > 10).length);

  // Sample a fit_analysis to see its structure
  const sampleFit = sample.find(r => r.fit_analysis && Object.keys(r.fit_analysis).length > 0);
  if (sampleFit) console.log('fit_analysis keys:', Object.keys(sampleFit.fit_analysis).join(', '));

  // ── INVESTOR SIGNALS ─────────────────────────────────────────────────────
  const { data: invs } = await sb.from('investors')
    .select('sectors,stage,geography_focus,check_size_min,check_size_max,dry_powder_estimate,deployment_velocity_index,last_investment_date,investor_tier,capital_power_score,investment_pace_per_year,fund_size_estimate_usd,signals,score_signals')
    .limit(1000);

  console.log('\n=== INVESTOR INTELLIGENCE FIELDS ===');
  console.log('Total investors:               ', invs.length);
  console.log('w/ dry_powder_estimate:        ', invs.filter(r => r.dry_powder_estimate).length);
  console.log('w/ deployment_velocity_index:  ', invs.filter(r => r.deployment_velocity_index).length);
  console.log('w/ investment_pace_per_year:   ', invs.filter(r => r.investment_pace_per_year).length);
  console.log('w/ fund_size_estimate_usd:     ', invs.filter(r => r.fund_size_estimate_usd).length);
  console.log('w/ last_investment_date:       ', invs.filter(r => r.last_investment_date).length);
  console.log('w/ signals object:             ', invs.filter(r => r.signals && Object.keys(r.signals).length > 0).length);
  console.log('w/ score_signals object:       ', invs.filter(r => r.score_signals && Object.keys(r.score_signals).length > 0).length);
  console.log('w/ capital_power_score:        ', invs.filter(r => r.capital_power_score).length);

  const sectorMap = {};
  invs.forEach(r => {
    const s = Array.isArray(r.sectors) ? r.sectors : [r.sectors];
    s.forEach(sec => { if (sec) sectorMap[sec] = (sectorMap[sec] || 0) + 1; });
  });
  const top10 = Object.entries(sectorMap).sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('Top 10 sectors:', top10.map(([k, v]) => `${k}(${v})`).join(', '));

  const sampleInvSignals = invs.find(r => r.signals && Object.keys(r.signals).length > 0);
  if (sampleInvSignals) console.log('signals keys sample:', Object.keys(sampleInvSignals.signals).join(', '));

  const sampleScoreSignals = invs.find(r => r.score_signals && Object.keys(r.score_signals).length > 0);
  if (sampleScoreSignals) console.log('score_signals keys sample:', Object.keys(sampleScoreSignals.score_signals).join(', '));

  // ── STARTUP INTELLIGENCE FIELDS ───────────────────────────────────────────
  const { data: startups } = await sb.from('startup_uploads')
    .select('total_god_score,team_score,traction_score,market_score,product_score,vision_score,extracted_data,market_momentum,trending_signals')
    .eq('status', 'approved')
    .limit(500);

  console.log('\n=== STARTUP INTELLIGENCE FIELDS ===');
  console.log('Startups sampled:              ', startups.length);
  console.log('w/ sector in extracted_data:   ', startups.filter(r => r.extracted_data?.sector).length);
  console.log('w/ market_momentum:            ', startups.filter(r => r.market_momentum != null).length);
  console.log('w/ trending_signals array:     ', startups.filter(r => r.trending_signals && r.trending_signals.length > 0).length);
  console.log('w/ web_signals enriched:       ', startups.filter(r => r.extracted_data?.web_signals).length);
  console.log('w/ all 5 component scores:     ', startups.filter(r => r.team_score && r.traction_score && r.market_score && r.product_score && r.vision_score).length);

  const sampleED = startups.find(r => r.extracted_data && Object.keys(r.extracted_data).length > 3);
  if (sampleED) console.log('extracted_data keys sample:', Object.keys(sampleED.extracted_data).slice(0, 15).join(', '));

  // ── STARTUP SIGNALS TABLE ─────────────────────────────────────────────────
  const { count: signalCount } = await sb.from('startup_signals').select('*', { count: 'exact', head: true });
  const { data: sigTypes } = await sb.from('startup_signals').select('signal_type').limit(1000);
  const typeMap = {};
  sigTypes?.forEach(r => { typeMap[r.signal_type] = (typeMap[r.signal_type] || 0) + 1; });
  console.log('\n=== STARTUP SIGNALS TABLE ===');
  console.log('Total signals rows:', signalCount);
  console.log('Signal types:', Object.entries(typeMap).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}(${v})`).join(', '));

})().catch(console.error);
