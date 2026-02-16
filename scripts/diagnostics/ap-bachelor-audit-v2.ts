/**
 * AP Bachelor Audit v2
 * Analyze Bachelor-tier startups (45-59) to understand what data is available
 * for detecting "Advanced Placement" signals — premium startups not yet at Masters.
 * 
 * AP Dimensions:
 *   1. Product-Thesis × Customer Demand alignment
 *   2. Speed of funding (funding velocity)
 *   3. Rock star team additions
 *   4. High quality advisors/investors ("smart money")
 *   5. Composite AP score
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Tier 1 investors that signal "smart money"
const TIER1_INVESTORS = [
  'y combinator', 'yc', 'sequoia', 'a16z', 'andreessen horowitz', 'founders fund',
  'benchmark', 'greylock', 'accel', 'kleiner perkins', 'lightspeed', 'index ventures',
  'general catalyst', 'bessemer', 'insight partners', 'tiger global', 'coatue',
  'ribbit capital', 'paradigm', 'thrive capital', 'lux capital', 'first round',
  'khosla ventures', 'redpoint', 'spark capital', 'union square', 'craft ventures',
  'softbank', 'dragoneer', 'flagship pioneering', 'nea', 'ivp', 'felicis',
  'initialized capital', 'slow ventures', 'floodgate', 'sv angel', 'techstars', '500 startups'
];

// Top-tier company backgrounds
const ROCKSTAR_COMPANIES = [
  'google', 'meta', 'facebook', 'apple', 'amazon', 'microsoft', 'tesla', 'spacex',
  'openai', 'stripe', 'airbnb', 'uber', 'netflix', 'palantir', 'coinbase',
  'databricks', 'snowflake', 'figma', 'notion', 'vercel', 'anthropic'
];

const ROCKSTAR_SCHOOLS = [
  'stanford', 'mit', 'harvard', 'yale', 'princeton', 'caltech', 'carnegie mellon',
  'berkeley', 'oxford', 'cambridge', 'wharton', 'columbia', 'cornell'
];

async function audit() {
  console.log('=== AP BACHELOR AUDIT v2 ===\n');

  // Get ALL Bachelor-tier startups with all relevant columns
  const allBachelors: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, extracted_data, pitch, description, tagline, website, stage, sectors, is_launched, has_demo, has_revenue, has_customers, growth_rate, team_signals, execution_signals, credential_signals, lead_investor, latest_funding_amount, latest_funding_round, latest_funding_date, created_at, followon_investors, is_oversubscribed, fomo_signal_strength, conviction_signal_strength, urgency_signal_strength, advisors, strategic_partners, founders, founder_avg_age, has_technical_cofounder, customer_count, arr, mrr, contrarian_belief, why_now, unfair_advantage')
      .eq('status', 'approved')
      .gte('total_god_score', 45)
      .lte('total_god_score', 59)
      .order('total_god_score', { ascending: false })
      .range(from, from + batchSize - 1);
    
    if (error) { console.error('Query error:', error); break; }
    if (!data || data.length === 0) break;
    allBachelors.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  console.log(`Total Bachelors (45-59): ${allBachelors.length}\n`);
  if (allBachelors.length === 0) return;

  const total = allBachelors.length;

  // === SECTION 1: Data field availability ===
  console.log('=== DATA FIELD AVAILABILITY ===');
  
  const checks = [
    { label: 'pitch', fn: (s: any) => s.pitch && s.pitch.length > 10 },
    { label: 'tagline', fn: (s: any) => s.tagline && s.tagline.length > 5 },
    { label: 'description', fn: (s: any) => s.description && s.description.length > 10 },
    { label: 'sectors', fn: (s: any) => s.sectors && s.sectors.length > 0 },
    { label: 'website', fn: (s: any) => !!s.website },
    { label: 'is_launched', fn: (s: any) => !!s.is_launched },
    { label: 'has_revenue', fn: (s: any) => !!s.has_revenue },
    { label: 'has_customers', fn: (s: any) => !!s.has_customers },
    { label: 'has_technical_cofounder', fn: (s: any) => !!s.has_technical_cofounder },
    { label: 'team_signals', fn: (s: any) => s.team_signals && s.team_signals.length > 0 },
    { label: 'credential_signals', fn: (s: any) => s.credential_signals && s.credential_signals.length > 0 },
    { label: 'execution_signals', fn: (s: any) => s.execution_signals && s.execution_signals.length > 0 },
    { label: 'lead_investor', fn: (s: any) => !!s.lead_investor },
    { label: 'latest_funding_amount', fn: (s: any) => !!s.latest_funding_amount },
    { label: 'latest_funding_round', fn: (s: any) => !!s.latest_funding_round },
    { label: 'followon_investors', fn: (s: any) => s.followon_investors && s.followon_investors.length > 0 },
    { label: 'advisors', fn: (s: any) => s.advisors && s.advisors.length > 0 },
    { label: 'strategic_partners', fn: (s: any) => s.strategic_partners && s.strategic_partners.length > 0 },
    { label: 'founders', fn: (s: any) => s.founders && s.founders.length > 0 },
    { label: 'is_oversubscribed', fn: (s: any) => !!s.is_oversubscribed },
    { label: 'fomo_signal_strength', fn: (s: any) => s.fomo_signal_strength > 0 },
    { label: 'conviction_signal_strength', fn: (s: any) => s.conviction_signal_strength > 0 },
    { label: 'growth_rate', fn: (s: any) => s.growth_rate > 0 },
    { label: 'customer_count', fn: (s: any) => s.customer_count > 0 },
    { label: 'contrarian_belief', fn: (s: any) => s.contrarian_belief && s.contrarian_belief.length > 10 },
    { label: 'why_now', fn: (s: any) => s.why_now && s.why_now.length > 10 },
    { label: 'unfair_advantage', fn: (s: any) => s.unfair_advantage && s.unfair_advantage.length > 10 },
    { label: 'ed.value_proposition', fn: (s: any) => (s.extracted_data?.value_proposition || '').length > 10 },
    { label: 'ed.problem', fn: (s: any) => (s.extracted_data?.problem || '').length > 10 },
    { label: 'ed.solution', fn: (s: any) => (s.extracted_data?.solution || '').length > 10 },
    { label: 'ed.funding_amount', fn: (s: any) => !!s.extracted_data?.funding_amount },
    { label: 'ed.funding_stage', fn: (s: any) => !!s.extracted_data?.funding_stage },
    { label: 'ed.investors_mentioned', fn: (s: any) => (s.extracted_data?.investors_mentioned || []).length > 0 },
    { label: 'ed.team.founders', fn: (s: any) => (s.extracted_data?.team?.founders || []).length > 0 },
    { label: 'ed.has_revenue', fn: (s: any) => !!s.extracted_data?.has_revenue },
    { label: 'ed.is_launched', fn: (s: any) => !!s.extracted_data?.is_launched },
  ];

  for (const c of checks) {
    const count = allBachelors.filter(c.fn).length;
    if (count > 0) {
      console.log(`  ${c.label}: ${count} (${(count/total*100).toFixed(1)}%)`);
    }
  }

  // === SECTION 2: AP SIGNAL DETECTION ===
  console.log('\n=== AP SIGNAL DETECTION ===');
  
  let productThesisCount = 0;
  let customerDemandCount = 0;
  let fundingVelocityCount = 0;
  let rockstarTeamCount = 0;
  let advisorCount = 0;
  let smartMoneyCount = 0;
  let multiAPCount = 0;

  const apCandidates: any[] = [];

  for (const s of allBachelors) {
    const ed = s.extracted_data || {};
    const allText = [
      s.pitch || '', s.tagline || '', s.description || '',
      ed.value_proposition || '', ed.problem || '', ed.solution || '',
      s.name || '', ...(ed.fivePoints || [])
    ].join(' ').toLowerCase();
    
    let apSignals = 0;
    const flags: string[] = [];

    // ── AP1: Product-Thesis Alignment ──
    // Does the startup have a clear product thesis aligned with a customer problem?
    const hasProduct = s.is_launched || s.has_demo || 
      allText.match(/\b(launched|live|mvp|beta|product|platform|tool|software|app)\b/);
    const hasCustomerProblem = (ed.problem && ed.problem.length > 20) ||
      allText.match(/\b(customer|user|client|patient|business|enterprise)\b.*\b(problem|pain|challenge|need|demand)/);
    const hasSolution = (ed.solution && ed.solution.length > 20) ||
      allText.match(/\b(solution|solv|address|automat|streamlin|simplif)\b/);
    
    if (hasProduct && (hasCustomerProblem || hasSolution)) {
      productThesisCount++;
      apSignals++;
      flags.push('📋Thesis');
    }

    // ── AP2: Customer Demand Signals ──
    // Evidence customers actually want this
    const hasDemand = s.has_customers || s.has_revenue || s.customer_count > 0 ||
      s.is_oversubscribed || (s.fomo_signal_strength && s.fomo_signal_strength > 0) ||
      (s.growth_rate && s.growth_rate > 0) ||
      allText.match(/\b(demand|waitlist|pre-order|oversubscribed|inbound|organic|paying|subscribers)\b/) ||
      allText.match(/\b(revenue|mrr|arr|sales|contract|deal)\b/);
    
    if (hasDemand) {
      customerDemandCount++;
      apSignals++;
      flags.push('📈Demand');
    }

    // ── AP3: Funding Velocity ──
    // How fast they raised / evidence of being funded
    const fundingAmount = s.latest_funding_amount || ed.funding_amount;
    const fundingRound = s.latest_funding_round || ed.funding_stage || ed.funding_round;
    const hasFunding = fundingAmount || fundingRound ||
      allText.match(/\b(raised|funded|seed|series\s*[a-d]|pre-seed|angel|round)\b/i);
    
    if (hasFunding) {
      fundingVelocityCount++;
      apSignals++;
      flags.push('💰Funded');
    }

    // ── AP4: Rock Star Team ──
    // FAANG/top-tier backgrounds, serial founders, PhDs
    const teamText = [
      JSON.stringify(s.team_signals || []),
      JSON.stringify(s.credential_signals || []),
      JSON.stringify(s.founders || []),
      JSON.stringify(ed.team || {}),
      JSON.stringify(ed.founders || []),
      JSON.stringify(ed.team_signals || []),
      JSON.stringify(ed.credential_signals || [])
    ].join(' ').toLowerCase();
    
    const hasRockstar = ROCKSTAR_COMPANIES.some(c => teamText.includes(c)) ||
      ROCKSTAR_SCHOOLS.some(s => teamText.includes(s)) ||
      teamText.match(/\b(serial founder|ex-founder|exited|ipo|acquisition|cto|ceo.*former)\b/) ||
      s.has_technical_cofounder;
    
    if (hasRockstar) {
      rockstarTeamCount++;
      apSignals++;
      flags.push('⭐Team');
    }

    // ── AP5: High Quality Advisors/Investors (Smart Money) ──
    const investorText = [
      s.lead_investor || '',
      JSON.stringify(s.followon_investors || []),
      JSON.stringify(ed.investors_mentioned || []),
      JSON.stringify(s.advisors || []),
      JSON.stringify(ed.advisors || [])
    ].join(' ').toLowerCase();
    
    const hasSmartMoney = TIER1_INVESTORS.some(inv => investorText.includes(inv)) ||
      (s.conviction_signal_strength && s.conviction_signal_strength > 0);
    
    if (hasSmartMoney) {
      smartMoneyCount++;
      apSignals++;
      flags.push('🏆SmartMoney');
    }
    
    // Also check for any advisors at all
    const hasAdvisors = (s.advisors && s.advisors.length > 0) ||
      (ed.advisors && ed.advisors.length > 0) ||
      investorText.match(/\b(advisor|mentor|board member)\b/);
    if (hasAdvisors && !hasSmartMoney) {
      advisorCount++;
      apSignals++;
      flags.push('🎓Advisors');
    }

    if (apSignals >= 2) {
      multiAPCount++;
      apCandidates.push({
        name: s.name,
        god: s.total_god_score,
        signals: apSignals,
        flags
      });
    }
  }

  console.log(`  📋 Product-Thesis Aligned: ${productThesisCount} (${(productThesisCount/total*100).toFixed(1)}%)`);
  console.log(`  📈 Customer Demand: ${customerDemandCount} (${(customerDemandCount/total*100).toFixed(1)}%)`);
  console.log(`  💰 Funding Velocity: ${fundingVelocityCount} (${(fundingVelocityCount/total*100).toFixed(1)}%)`);
  console.log(`  ⭐ Rock Star Team: ${rockstarTeamCount} (${(rockstarTeamCount/total*100).toFixed(1)}%)`);
  console.log(`  🏆 Smart Money (Tier 1): ${smartMoneyCount} (${(smartMoneyCount/total*100).toFixed(1)}%)`);
  console.log(`  🎓 Advisors (non-T1): ${advisorCount} (${(advisorCount/total*100).toFixed(1)}%)`);
  console.log(`\n  Multi-AP (2+ signals): ${multiAPCount} (${(multiAPCount/total*100).toFixed(1)}%)`);

  // === SECTION 3: Distribution of AP signal counts ===
  console.log('\n=== AP SIGNAL COUNT DISTRIBUTION ===');
  for (let i = 6; i >= 0; i--) {
    const count = i >= 2 
      ? apCandidates.filter(c => c.signals === i).length 
      : allBachelors.length - apCandidates.length; // 0-1 signals
    if (i === 0) {
      console.log(`  0-1 signals: ${count} (${(count/total*100).toFixed(1)}%)`);
    } else if (count > 0) {
      console.log(`  ${i} signals: ${count} (${(count/total*100).toFixed(1)}%)`);
    }
  }

  // === SECTION 4: Top AP Candidates ===
  console.log('\n=== TOP AP CANDIDATES (3+ signals, top 25) ===');
  const top = apCandidates
    .filter(c => c.signals >= 3)
    .sort((a: any, b: any) => b.signals - a.signals || b.god - a.god)
    .slice(0, 25);
  
  for (const c of top) {
    console.log(`  ${c.name} | GOD: ${c.god} | Signals: ${c.signals} | ${c.flags.join(' ')}`);
  }

  // === SECTION 5: Bachelor sub-bracket analysis ===
  console.log('\n=== BACHELOR SUB-BRACKET ANALYSIS ===');
  const brackets = [
    { label: '55-59 (near-Masters)', min: 55, max: 59 },
    { label: '50-54 (mid-Bachelor)', min: 50, max: 54 },
    { label: '45-49 (low-Bachelor)', min: 45, max: 49 }
  ];
  
  for (const b of brackets) {
    const bracketStartups = allBachelors.filter(s => s.total_god_score >= b.min && s.total_god_score <= b.max);
    const bracketAP = apCandidates.filter(c => c.god >= b.min && c.god <= b.max);
    const ap3plus = bracketAP.filter(c => c.signals >= 3);
    console.log(`  ${b.label}: ${bracketStartups.length} total, ${bracketAP.length} AP (2+), ${ap3plus.length} AP (3+)`);
  }

  // === SECTION 6: Impact simulation ===
  console.log('\n=== AP BONUS IMPACT SIMULATION ===');
  console.log('Formula: apBonus = min(signalCount × 2, 8) points');
  console.log('Only applied to startups with 2+ AP signals\n');
  
  let wouldPromoteToMasters = 0;
  let wouldStayBachelor = 0;
  const promotions: any[] = [];
  
  for (const c of apCandidates) {
    const apBonus = Math.min(c.signals * 2, 8);
    const newScore = c.god + apBonus;
    if (newScore >= 60) {
      wouldPromoteToMasters++;
      promotions.push({ name: c.name, from: c.god, to: Math.min(newScore, 100), bonus: apBonus, signals: c.signals });
    } else {
      wouldStayBachelor++;
    }
  }
  
  console.log(`  Would promote to Masters (60+): ${wouldPromoteToMasters}`);
  console.log(`  Would stay Bachelor (improved): ${wouldStayBachelor}`);
  console.log(`  Unaffected (0-1 AP signals): ${total - apCandidates.length}`);
  
  if (promotions.length > 0) {
    console.log('\n  Sample Promotions:');
    promotions.sort((a, b) => b.to - a.to).slice(0, 15).forEach(p => {
      console.log(`    ${p.name}: ${p.from} → ${p.to} (+${p.bonus}, ${p.signals} signals)`);
    });
  }
}

audit().catch(console.error);
