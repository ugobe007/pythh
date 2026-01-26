#!/usr/bin/env node
/**
 * VC Faith Signal Validator
 * 
 * Validates extracted faith signals by checking them against actual portfolio data
 * 
 * Algorithm:
 * For each faith signal:
 *   1. Query portfolio investments for this VC
 *   2. Score each investment against the signal
 *   3. Calculate validation confidence
 *   4. Update signal confidence based on portfolio validation
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Analyze portfolio to validate a faith signal
 */
async function validateSignalByPortfolio(vcId, signal) {
  try {
    // Fetch portfolio investments for this VC
    const { data: portfolio, error: portfolioError } = await supabase
      .from('vc_portfolio_exhaust')
      .select('*')
      .eq('vc_id', vcId)
      .order('investment_date', { ascending: false })
      .limit(100);

    if (portfolioError) {
      console.log(`    ⚠️ Error fetching portfolio: ${portfolioError.message}`);
      return {
        matches: 0,
        total: 0,
        confidence: 0,
      };
    }

    if (!portfolio || portfolio.length === 0) {
      console.log(`    ⚠️ No portfolio data found`);
      return {
        matches: 0,
        total: 0,
        confidence: 0,
      };
    }

    // Score portfolio companies against this signal
    let matches = 0;

    for (const company of portfolio) {
      const score = scoreCompanyAgainstSignal(company, signal);
      if (score > 0.5) {
        matches++;
      }
    }

    const validationConfidence = matches / portfolio.length;

    return {
      matches,
      total: portfolio.length,
      confidence: validationConfidence,
    };

  } catch (error) {
    console.log(`    ❌ Error: ${error.message}`);
    return {
      matches: 0,
      total: 0,
      confidence: 0,
    };
  }
}

/**
 * Score a company against a faith signal
 * Returns 0-1 score
 */
function scoreCompanyAgainstSignal(company, signal) {
  const category = signal.signal_category;
  const text = signal.signal_text.toLowerCase();

  // Scoring logic for different signal categories
  switch (category) {
    case 'sector_belief':
      // Check if company sectors match the signal
      if (!company.sectors) return 0;
      const keywords = extractKeywords(text);
      const matches = company.sectors.filter(s => 
        keywords.some(k => s.toLowerCase().includes(k))
      );
      return matches.length > 0 ? 0.8 : 0;

    case 'founder_psychology':
      // Check if signal mentions technical/expert founders
      if (text.includes('domain expert') || text.includes('technical')) {
        // We can't know from portfolio data alone, but assume tech founders in tech companies
        return 0.6;
      }
      return 0;

    case 'timing_thesis':
      // Check investment recency against signal
      if (text.includes('ai') || text.includes('artificial intelligence')) {
        // Recent AI investments score higher
        const investmentDate = new Date(company.investment_date);
        const ageMonths = (Date.now() - investmentDate) / (1000 * 60 * 60 * 24 * 30);
        return ageMonths < 24 ? 0.7 : 0.3;
      }
      return 0;

    case 'market_sizing':
      // Check for large market indicators
      if (text.includes('billion') || text.includes('large market')) {
        // Large funding amounts suggest large market ambitions
        return company.investment_amount > 5000000 ? 0.7 : 0.4;
      }
      return 0;

    case 'technology_bet':
      // Check sectors for technology focus
      if (company.sectors && company.sectors.some(s => 
        ['AI', 'Software', 'Infrastructure', 'Platform'].includes(s)
      )) {
        return 0.75;
      }
      return 0;

    default:
      return 0.5;
  }
}

/**
 * Extract keywords from signal text
 */
function extractKeywords(text) {
  const stopwords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'at', 'to', 'for', 'of', 'we', 'are', 'is'];
  return text
    .split(/\s+/)
    .filter(word => !stopwords.includes(word.toLowerCase()) && word.length > 3)
    .slice(0, 5);
}

/**
 * Update signal with portfolio validation confidence
 */
async function updateSignalValidation(signal, validation) {
  try {
    const { error } = await supabase
      .from('vc_faith_signals')
      .update({
        portfolio_validation_count: validation.matches,
        portfolio_total_count: validation.total,
        portfolio_confidence: validation.confidence,
      })
      .eq('id', signal.id);

    if (error) {
      console.log(`    ⚠️ Error updating signal: ${error.message}`);
      return false;
    }

    return true;

  } catch (error) {
    console.log(`    ❌ Error: ${error.message}`);
    return false;
  }
}

/**
 * Validate all faith signals
 */
async function validateAllSignals() {
  console.log('\n✅ VC Faith Signal Validator');
  console.log('===========================\n');

  // Fetch all faith signals
  const { data: signals, error: signalError } = await supabase
    .from('vc_faith_signals')
    .select('*')
    .eq('is_active', true);

  if (signalError) {
    console.log(`❌ Error fetching signals: ${signalError.message}`);
    return;
  }

  if (!signals || signals.length === 0) {
    console.log('⚠️ No signals found to validate');
    return;
  }

  // Group by VC
  const byVc = {};
  signals.forEach(s => {
    if (!byVc[s.vc_id]) byVc[s.vc_id] = [];
    byVc[s.vc_id].push(s);
  });

  let totalValidated = 0;

  // Validate signals for each VC
  for (const [vcId, vcSignals] of Object.entries(byVc)) {
    const vcName = vcSignals[0]?.vc_name || vcId;
    console.log(`\n🏢 ${vcName}`);

    for (const signal of vcSignals) {
      console.log(`  📌 ${signal.signal_category}: ${signal.signal_name}`);

      const validation = await validateSignalByPortfolio(vcId, signal);

      if (validation.total > 0) {
        console.log(`    Portfolio validation: ${validation.matches}/${validation.total} companies matched`);
        console.log(`    Confidence: ${(validation.confidence * 100).toFixed(0)}%`);

        const updated = await updateSignalValidation(signal, validation);
        if (updated) {
          console.log(`    ✅ Signal updated`);
          totalValidated++;
        }
      }
    }
  }

  console.log(`\n📊 Summary`);
  console.log(`==========`);
  console.log(`Total signals validated: ${totalValidated}`);
  console.log(`\n✅ Validation complete`);
  console.log(`\nNext step: Extract startup vision signals and match`);
}

// Run validation
validateAllSignals().catch(console.error);
