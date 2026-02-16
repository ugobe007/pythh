/**
 * AP Bachelor Audit
 * Analyze Bachelor-tier startups (45-59) to understand what data is available
 * for detecting "Advanced Placement" signals — premium startups not yet at Masters
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
  'initialized capital', 'slow ventures', 'floodgate', 'sv angel'
];

// Notable advisors/angels
const NOTABLE_PEOPLE_KEYWORDS = [
  'ceo', 'cto', 'cfo', 'founder', 'co-founder', 'partner', 'vp', 'director',
  'professor', 'phd', 'stanford', 'mit', 'harvard', 'google', 'meta', 'apple',
  'amazon', 'microsoft', 'tesla', 'spacex', 'openai', 'stripe', 'airbnb'
];

async function audit() {
  console.log('=== AP BACHELOR AUDIT ===\n');

  // Get ALL Bachelor-tier startups
  const allBachelors: any[] = [];
  let from = 0;
  const batchSize = 1000;
  
  while (true) {
    const { data, error } = await supabase
      .from('startup_uploads')
      .select('id, name, total_god_score, extracted_data, value_proposition, problem, solution, team, tagline, pitch, industries, website, funding_stage, founded_date, created_at')
      .eq('status', 'approved')
      .gte('total_god_score', 45)
      .lte('total_god_score', 59)
      .order('total_god_score', { ascending: false })
      .range(from, from + batchSize - 1);
    
    if (error) { console.error(error); break; }
    if (!data || data.length === 0) break;
    allBachelors.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }

  console.log(`Total Bachelors (45-59): ${allBachelors.length}\n`);

  // === SECTION 1: Data availability audit ===
  console.log('=== DATA AVAILABILITY ===');
  const fieldCounts: Record<string, number> = {};
  const apRelevantFields = [
    'value_proposition', 'problem', 'solution', 'team', 'pitch', 'tagline',
    'industries', 'website', 'funding_stage', 'founded_date'
  ];
  const edRelevantFields = [
    'backed_by', 'investors', 'advisors', 'team', 'funding_amount', 'funding_stage',
    'revenue', 'mrr', 'customers', 'active_users', 'growth_rate',
    'has_revenue', 'has_customers', 'launched', 'is_launched',
    'market_size', 'demo_available', 'has_demo',
    'contrarian_insight', 'why_now', 'unfair_advantage',
    'fomo_signal_strength', 'conviction_signal_strength',
    'urgency_signal_strength', 'risk_signal_strength',
    'team_companies', 'strategic_partners', 'unique_ip', 'defensibility'
  ];

  for (const f of apRelevantFields) {
    const count = allBachelors.filter(s => s[f] && String(s[f]).length > 0).length;
    fieldCounts[`direct.${f}`] = count;
  }

  for (const f of edRelevantFields) {
    const count = allBachelors.filter(s => {
      const ed = s.extracted_data || {};
      return ed[f] !== undefined && ed[f] !== null && ed[f] !== '';
    }).length;
    fieldCounts[`ed.${f}`] = count;
  }

  console.log('\nDirect fields:');
  for (const f of apRelevantFields) {
    const k = `direct.${f}`;
    const pct = ((fieldCounts[k] / allBachelors.length) * 100).toFixed(1);
    console.log(`  ${f}: ${fieldCounts[k]} (${pct}%)`);
  }
  
  console.log('\nExtracted_data fields:');
  for (const f of edRelevantFields) {
    const k = `ed.${f}`;
    const pct = ((fieldCounts[k] / allBachelors.length) * 100).toFixed(1);
    if (fieldCounts[k] > 0) {
      console.log(`  ${f}: ${fieldCounts[k]} (${pct}%)`);
    }
  }

  // === SECTION 2: AP Signal Detection ===
  console.log('\n=== AP SIGNAL DETECTION ===');
  
  let productThesisAligned = 0;
  let hasFundingSignals = 0;
  let hasTeamSignals = 0;
  let hasAdvisorSignals = 0;
  let hasSmartMoney = 0;
  let hasCustomerDemand = 0;
  let hasMultipleAP = 0;

  const apCandidates: any[] = [];

  for (const s of allBachelors) {
    const ed = s.extracted_data || {};
    const allText = [
      s.value_proposition || '', s.problem || '', s.solution || '',
      s.pitch || '', s.tagline || '', ed.description || '',
      s.name || ''
    ].join(' ').toLowerCase();
    
    let apSignals = 0;

    // 1. Product-Thesis Alignment: Does the product solve a clearly stated customer problem?
    const hasProduct = allText.match(/\b(launched|live|mvp|beta|product|platform|app|tool|software)\b/i);
    const hasCustomerProblem = allText.match(/\b(customer|user|client|patient|business|enterprise)\b/i) &&
                                allText.match(/\b(problem|pain|challenge|struggle|need|demand|gap)\b/i);
    const hasDemandSignal = allText.match(/\b(demand|waitlist|pre-order|oversubscribed|inbound|organic)\b/i) ||
                             allText.match(/\b(growing|traction|adoption|engagement)\b/i);
    
    if (hasProduct && hasCustomerProblem) {
      productThesisAligned++;
      apSignals++;
    }
    if (hasDemandSignal) {
      hasCustomerDemand++;
      apSignals++;
    }

    // 2. Funding velocity / speed
    const fundingText = allText + ' ' + JSON.stringify(ed.backed_by || []).toLowerCase() + ' ' + JSON.stringify(ed.investors || []).toLowerCase();
    const hasFunding = allText.match(/\b(funded|raised|seed|series|pre-seed|round|capital|investment)\b/i) ||
                        ed.funding_amount || ed.funding_stage || s.funding_stage;
    if (hasFunding) {
      hasFundingSignals++;
      apSignals++;
    }

    // 3. Rock star team members
    const teamText = JSON.stringify(s.team || []).toLowerCase() + ' ' + JSON.stringify(ed.team || []).toLowerCase() + ' ' + (ed.team_companies || []).join(' ').toLowerCase();
    const hasRockstarTeam = NOTABLE_PEOPLE_KEYWORDS.some(k => teamText.includes(k));
    if (hasRockstarTeam) {
      hasTeamSignals++;
      apSignals++;
    }

    // 4. High quality advisors
    const advisorText = JSON.stringify(ed.advisors || []).toLowerCase();
    const hasAdvisors = advisorText.length > 5;
    if (hasAdvisors) {
      hasAdvisorSignals++;
      apSignals++;
    }

    // 5. Smart money (tier 1 investors)
    const investorText = fundingText + ' ' + advisorText;
    const hasTier1 = TIER1_INVESTORS.some(inv => investorText.includes(inv));
    if (hasTier1) {
      hasSmartMoney++;
      apSignals++;
    }

    if (apSignals >= 2) {
      hasMultipleAP++;
      apCandidates.push({
        name: s.name,
        god: s.total_god_score,
        signals: apSignals,
        productThesis: !!(hasProduct && hasCustomerProblem),
        demand: !!hasDemandSignal,
        funding: !!hasFunding,
        rockstarTeam: hasRockstarTeam,
        advisors: hasAdvisors,
        smartMoney: hasTier1
      });
    }
  }

  const total = allBachelors.length;
  console.log(`  Product-Thesis Aligned: ${productThesisAligned} (${(productThesisAligned/total*100).toFixed(1)}%)`);
  console.log(`  Customer Demand Signals: ${hasCustomerDemand} (${(hasCustomerDemand/total*100).toFixed(1)}%)`);
  console.log(`  Funding Signals: ${hasFundingSignals} (${(hasFundingSignals/total*100).toFixed(1)}%)`);
  console.log(`  Rock Star Team: ${hasTeamSignals} (${(hasTeamSignals/total*100).toFixed(1)}%)`);
  console.log(`  Advisor Signals: ${hasAdvisorSignals} (${(hasAdvisorSignals/total*100).toFixed(1)}%)`);
  console.log(`  Smart Money (Tier 1): ${hasSmartMoney} (${(hasSmartMoney/total*100).toFixed(1)}%)`);
  console.log(`\n  Multi-AP (2+ signals): ${hasMultipleAP} (${(hasMultipleAP/total*100).toFixed(1)}%)`);

  // === SECTION 3: Top AP Candidates ===
  console.log('\n=== TOP AP CANDIDATES (3+ signals) ===');
  const top = apCandidates
    .filter(c => c.signals >= 3)
    .sort((a, b) => b.signals - a.signals || b.god - a.god)
    .slice(0, 25);
  
  for (const c of top) {
    const flags = [];
    if (c.productThesis) flags.push('📋Thesis');
    if (c.demand) flags.push('📈Demand');
    if (c.funding) flags.push('💰Funded');
    if (c.rockstarTeam) flags.push('⭐Team');
    if (c.advisors) flags.push('🎓Advisors');
    if (c.smartMoney) flags.push('🏆SmartMoney');
    console.log(`  ${c.name} | GOD: ${c.god} | Signals: ${c.signals} | ${flags.join(' ')}`);
  }

  // === SECTION 4: Score distribution within Bachelors ===
  console.log('\n=== BACHELOR SCORE DISTRIBUTION ===');
  const brackets = [
    { label: '55-59 (near-Masters)', min: 55, max: 59 },
    { label: '50-54 (mid-Bachelor)', min: 50, max: 54 },
    { label: '45-49 (low-Bachelor)', min: 45, max: 49 }
  ];
  
  for (const b of brackets) {
    const count = allBachelors.filter(s => s.total_god_score >= b.min && s.total_god_score <= b.max).length;
    const apCount = apCandidates.filter(c => c.god >= b.min && c.god <= b.max).length;
    console.log(`  ${b.label}: ${count} total, ${apCount} AP candidates (${(apCount/count*100).toFixed(1)}%)`);
  }

  // === SECTION 5: Impact simulation ===
  console.log('\n=== AP BONUS IMPACT SIMULATION ===');
  console.log('If AP bonus = +3 to +8 pts (based on signal count):');
  
  let wouldPromoteToMasters = 0;
  let wouldStayBachelor = 0;
  
  for (const c of apCandidates) {
    const apBonus = Math.min(c.signals * 2, 8); // 2 pts per signal, max 8
    const newScore = c.god + apBonus;
    if (newScore >= 60) {
      wouldPromoteToMasters++;
    } else {
      wouldStayBachelor++;
    }
  }
  
  console.log(`  Would promote to Masters (60+): ${wouldPromoteToMasters}`);
  console.log(`  Would stay Bachelor (improved): ${wouldStayBachelor}`);
  console.log(`  Unaffected (0-1 AP signals): ${total - apCandidates.length}`);
}

audit().catch(console.error);
