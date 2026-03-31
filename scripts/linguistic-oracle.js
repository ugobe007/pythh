/**
 * LINGUISTIC ORACLE - Founder Language Analysis
 * Uses pattern-based inference (no API costs)
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function analyzeFounderLanguage(text, startupName) {
  console.log(`🔮 Analyzing: ${startupName}`);
  
  const textLower = text.toLowerCase();
  
  // 1. VISION CLARITY
  const visionHigh = ['discovered', 'realized', 'noticed', 'insight', 'saw', 'identified'].filter(w => textLower.includes(w)).length;
  const visionLow = ['trial and error', 'tested', 'pivoted', 'experimented'].filter(w => textLower.includes(w)).length;
  const vision_clarity = Math.min(100, Math.max(0, 50 + (visionHigh * 15) - (visionLow * 10)));
  
  // 2. PRONOUN BALANCE (I vs We)
  const iCount = (text.match(/\bI\b/g) || []).length;
  const weCount = (text.match(/\b[Ww]e\b/g) || []).length;
  const total = iCount + weCount;
  const ratio = total > 0 ? iCount / total : 0.5;
  // Ideal balance: 40% I, 60% We (0.4 ratio)
  const pronoun_balance = Math.max(0, Math.min(100, 100 - Math.abs(ratio - 0.4) * 200));
  
  // 3. CUSTOMER INTIMACY
  const custHigh = ['customer told us', 'user feedback', 'interviewed', 'they said', 'customers want', 'users need'].filter(w => textLower.includes(w)).length;
  const customer_intimacy = Math.min(100, Math.max(0, 50 + (custHigh * 20)));
  
  // 4. MARKET POSITIONING
  const posHigh = ['unlike', 'competitor', 'different', 'unique', 'only', 'first'].filter(w => textLower.includes(w)).length;
  const market_positioning = Math.min(100, Math.max(0, 50 + (posHigh * 15)));
  
  // 5. PROOF POINTS
  const hasNumbers = (text.match(/\d+%|\d+x|\$\d+|\d+\s*(million|billion|thousand)/gi) || []).length;
  const hasNames = (text.match(/\b[A-Z][a-z]+\s+[A-Z][a-z]+/g) || []).length; // Named people/companies
  const proof_points = Math.min(100, Math.max(0, 40 + (hasNumbers * 10) + (hasNames * 5)));
  
  // 6. CONVICTION LANGUAGE
  const conviction = ['will', 'certain', 'confident', 'definitely', 'absolutely', 'know'].filter(w => textLower.includes(w)).length;
  const hedges = ['might', 'maybe', 'hopefully', 'perhaps', 'possibly', 'think'].filter(w => textLower.includes(w)).length;
  const conviction_language = Math.min(100, Math.max(0, 50 + (conviction * 10) - (hedges * 15)));
  
  // 7. BUZZWORD DENSITY (inverse - lower buzzwords = higher score)
  const buzzwords = ['synergy', 'paradigm', 'disruptive', 'revolutionary', 'game-changer', 'bleeding edge'].filter(w => textLower.includes(w)).length;
  const buzzword_density = Math.max(0, Math.min(100, 100 - (buzzwords * 15)));
  
  // 8. SPECIFICITY SCORE
  const specificWords = (text.match(/\d+/g) || []).length;
  const hasDates = (text.match(/\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4}/g) || []).length;
  const specificity_score = Math.min(100, Math.max(0, 30 + (specificWords * 5) + (hasDates * 10)));
  
  // Calculate overall score (average of all 8 components)
  const overall_score = Math.round(
    (vision_clarity + pronoun_balance + customer_intimacy + market_positioning + 
     proof_points + conviction_language + buzzword_density + specificity_score) / 8
  );
  
  // Generate flags
  const green_flags = [];
  const red_flags = [];
  
  if (specificity_score > 70) green_flags.push('Highly specific');
  if (pronoun_balance > 70) green_flags.push('Good team dynamic');
  if (vision_clarity > 70) green_flags.push('Strong vision');
  if (customer_intimacy > 70) green_flags.push('Customer focus');
  if (conviction_language < 40) red_flags.push('Uncertain language');
  if (buzzword_density < 50) red_flags.push('Too many buzzwords');
  
  console.log(`✅ Score: ${overall_score}/100`);
  if (green_flags.length) console.log(`   🟢 ${green_flags.join(', ')}`);
  if (red_flags.length) console.log(`   🔴 ${red_flags.join(', ')}`);
  
  return {
    vision_clarity: Math.round(vision_clarity),
    pronoun_balance: Math.round(pronoun_balance),
    customer_intimacy: Math.round(customer_intimacy),
    market_positioning: Math.round(market_positioning),
    proof_points: Math.round(proof_points),
    conviction_language: Math.round(conviction_language),
    buzzword_density: Math.round(buzzword_density),
    specificity_score: Math.round(specificity_score),
    overall_score,
    key_phrases: [],
    green_flags,
    red_flags,
    analysis_summary: `${overall_score}/100 - ${green_flags.length > 0 ? green_flags[0] : 'Standard analysis'}`
  };
}

async function scoreAllStartups({ limit = 100, dryRun = false } = {}) {
  console.log('\n🔮 LINGUISTIC ORACLE — Founder Language Scoring');
  console.log('═'.repeat(60));
  console.log(`Mode:  ${dryRun ? '🔍 DRY-RUN' : '✍️  APPLY'}`);
  console.log(`Limit: ${limit} startups`);
  console.log('═'.repeat(60) + '\n');
  
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, description, pitch, tagline')
    .eq('status', 'approved')
    .not('description', 'is', null)
    .limit(limit);
  
  if (error) {
    console.error('❌ Error:', error);
    return;
  }
  
  console.log(`📊 Analyzing ${startups.length} startups\n`);
  
  let scored = 0;
  
  for (const startup of startups) {
    const text = [startup.description, startup.pitch, startup.tagline]
      .filter(Boolean).join(' ');
    
    if (text.length < 50) continue;
    
    const analysis = analyzeFounderLanguage(text, startup.name);
    
    if (analysis) {
      if (!dryRun) {
        await supabase
          .from('startup_uploads')
          .update({
            founder_voice_score: analysis.overall_score,
            language_analysis: analysis,
          })
          .eq('id', startup.id);
      } else {
        console.log(`  [DRY] ${startup.name}: ${analysis.overall_score}/100`);
      }
      scored++;
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`✅ Scored: ${scored} / ${startups.length} startups`);
  if (dryRun) console.log('💡 Run with --apply to write scores to the database.');
  console.log('═'.repeat(60));
}

async function generateRegressionReport() {
  console.log('\n📊 REGRESSION REPORT\n');
  
  const { data } = await supabase
    .from('startup_uploads')
    .select('name, founder_voice_score, total_god_score')
    .not('founder_voice_score', 'is', null)
    .order('founder_voice_score', { ascending: false })
    .limit(10);
  
  if (!data || data.length === 0) {
    console.log('❌ No data yet - run: npm run oracle:score');
    return;
  }
  
  console.log('🏆 TOP 10 BY LANGUAGE:\n');
  data.forEach((s, i) => {
    console.log(`${i+1}. ${s.name}: ${s.founder_voice_score}/100`);
  });
}

// ── CLI ───────────────────────────────────────────────────────────────────────
const args  = process.argv.slice(2);
const cmd   = args.find(a => !a.startsWith('-')) || 'score';
const APPLY = args.includes('--apply');
const DRY   = !APPLY;
const LIMIT = (() => {
  const i = args.indexOf('--limit');
  return i !== -1 ? +(args[i + 1] || '100') : 200;
})();

if (cmd === 'score') scoreAllStartups({ limit: LIMIT, dryRun: DRY });
else if (cmd === 'report') generateRegressionReport();
else console.log('Usage: node scripts/linguistic-oracle.js score [--apply] [--limit N]');
