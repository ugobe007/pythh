#!/usr/bin/env node
/**
 * Quick test of the fund size inference engine with representative investors
 */
const { runInferencePipeline, computeCapitalPower, formatAmount } = require('./fund-size-inference');

const tests = [
  {
    name: 'Sofinnova Partners', firm: 'Sofinnova Partners',
    active_fund_size: 4000000000, total_investments: 500, successful_exits: 100,
    check_size_min: 1000000, check_size_max: 50000000,
    stage: ['Seed', 'Series A', 'Growth'], geography_focus: ['Europe', 'US'], type: 'VC',
  },
  {
    name: 'British Design Fund', firm: '',
    active_fund_size: 0, total_investments: 0, successful_exits: 0,
    check_size_min: 25000, check_size_max: 150000,
    stage: ['Early-stage'], geography_focus: ['UK'], type: 'VC',
  },
  {
    name: 'McKesson Ventures', firm: '',
    active_fund_size: 0, total_investments: 0, successful_exits: 0,
    check_size_min: 0, check_size_max: 0,
    stage: ['Series A', 'Series B'], geography_focus: ['US'], type: 'VC',
    investment_thesis: 'Corporate venture arm investing in healthcare',
  },
  {
    name: 'Qatar wealth fund', firm: '',
    active_fund_size: 0, total_investments: 0, successful_exits: 0,
    stage: ['Growth'], geography_focus: ['Global'], type: 'VC',
  },
  {
    name: 'Kickstart Ventures', firm: 'Kickstart Ventures',
    active_fund_size: 250000000, total_investments: 40, successful_exits: 6,
    check_size_min: 250000, check_size_max: 5000000,
    stage: ['Seed', 'Series A', 'Growth'], geography_focus: ['Philippines', 'Southeast Asia'], type: 'VC',
  },
  {
    name: 'Sauce.vc', firm: '',
    active_fund_size: 25000000, total_investments: 30, successful_exits: 3,
    check_size_min: 100000, check_size_max: 1000000,
    stage: ['Seed'], geography_focus: ['India'], type: 'VC',
  },
  {
    name: 'PayPal', firm: '',
    active_fund_size: 0, total_investments: 0, successful_exits: 0,
    stage: [], geography_focus: ['US'], type: 'VC',
    investment_thesis: 'PayPal corporate investment activities',
  },
  {
    name: 'GV', firm: 'Google Ventures',
    active_fund_size: 0, total_investments: 0, successful_exits: 0,
    check_size_min: 500000, check_size_max: 50000000,
    stage: ['Seed', 'Series A', 'Growth'], geography_focus: ['US', 'Europe'], type: 'VC',
  },
];

console.log('═══════════════════════════════════════════════════════════════');
console.log('  FUND SIZE INFERENCE ENGINE — UNIT TESTS');
console.log('═══════════════════════════════════════════════════════════════\n');

for (const t of tests) {
  const r = runInferencePipeline(t);
  const knownStr = t.active_fund_size ? formatAmount(t.active_fund_size) : 'unknown';
  console.log(`▸ ${t.name} (known: ${knownStr})`);
  console.log(`  Capital Type  : ${r.capital_type} (${(r.capital_type_confidence * 100).toFixed(0)}%)`);
  console.log(`  Reason        : ${r.capital_type_reason}`);
  console.log(`  Estimated Size: ${r.fund_size_estimate_usd ? formatAmount(r.fund_size_estimate_usd) : 'N/A'} (${(r.fund_size_confidence * 100).toFixed(0)}% conf)`);
  console.log(`  Method        : ${r.estimation_method}`);
  console.log(`  Capital Power : ${r.capital_power_score.toFixed(2)}/5.0`);
  if (r.estimation_signals) {
    r.estimation_signals.forEach(s => console.log(`  📐 ${s}`));
  }
  console.log('');
}

// Capital power scale validation
console.log('═══ CAPITAL POWER SCALE VALIDATION ═══');
const testAmounts = [10e6, 20e6, 50e6, 75e6, 100e6, 150e6, 250e6, 500e6, 1e9, 2.5e9, 5e9, 10e9];
for (const amt of testAmounts) {
  const score = computeCapitalPower(amt);
  console.log(`  ${formatAmount(amt).padEnd(10)} → ${score.toFixed(2)}/5.0`);
}
