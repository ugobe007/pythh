/**
 * Faith Alignment Matching Service
 * 
 * Matches VC faith signals to startup vision signals
 * Creates psychology-based matches independent of GOD scores
 * 
 * This is the magic engine - belief to belief alignment
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Extract vision signals from startup
 */
async function extractStartupVisionSignals(startup) {
  const visionSignals = [];
  const founderBackgrounds = [];
  const marketPositioning = [];

  // Extract from mission text
  if (startup.value_proposition) {
    const proposition = startup.value_proposition.toLowerCase();
    
    // Detect vision signals
    if (proposition.includes('infrastructure') || proposition.includes('platform')) {
      visionSignals.push('infrastructure_play');
    }
    if (proposition.includes('ai') || proposition.includes('ml')) {
      visionSignals.push('ai_technology');
    }
    if (proposition.includes('b2b') || proposition.includes('enterprise')) {
      marketPositioning.push('enterprise_focus');
    }
    if (proposition.includes('billion') || proposition.includes('scale')) {
      marketPositioning.push('large_market_ambition');
    }
  }

  // Extract from problem statement
  if (startup.problem) {
    const problem = startup.problem.toLowerCase();
    if (problem.includes('inefficient') || problem.includes('broken')) {
      visionSignals.push('fix_broken_system');
    }
  }

  // Detect founder psychology from team signals
  if (startup.team_companies && startup.team_companies.length > 0) {
    const companyNames = startup.team_companies.join(' ').toLowerCase();
    if (companyNames.includes('google') || companyNames.includes('stanford') || companyNames.includes('mit')) {
      founderBackgrounds.push('elite_pedigree');
    }
  }

  return {
    visionSignals,
    founderBackgrounds,
    marketPositioning,
  };
}

/**
 * Calculate semantic similarity between two texts
 * Returns 0-1 score
 */
function semanticSimilarity(text1, text2) {
  if (!text1 || !text2) return 0;

  // Simple token-based similarity
  const tokens1 = new Set(text1.toLowerCase().split(/\s+/));
  const tokens2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

/**
 * Match VC faith signal to startup vision
 */
function matchSignalToVision(signal, visionSignals, startup) {
  const signalText = signal.signal_text.toLowerCase();

  // Determine which vision signals this faith signal matches
  const matchingReasons = [];
  let score = 0;

  // Infrastructure/platform plays
  if (signalText.includes('infrastructure') && visionSignals.includes('infrastructure_play')) {
    matchingReasons.push('Both believe infrastructure plays create value');
    score = Math.max(score, 0.85);
  }

  // AI technology
  if (signalText.includes('ai') && visionSignals.includes('ai_technology')) {
    matchingReasons.push('Both believe in AI technology potential');
    score = Math.max(score, 0.82);
  }

  // Domain expertise
  if (signalText.includes('domain expert') && visionSignals.includes('fix_broken_system')) {
    matchingReasons.push('Domain expertise meets problem-solving focus');
    score = Math.max(score, 0.80);
  }

  // Billion-person markets
  if (signalText.includes('billion') && visionSignals.includes('large_market_ambition')) {
    matchingReasons.push('Both target large, transformative markets');
    score = Math.max(score, 0.88);
  }

  // Semantic similarity fallback
  if (score === 0) {
    score = semanticSimilarity(signalText, startup.value_proposition || '');
    if (score > 0.3) {
      matchingReasons.push(`Thematic alignment (${(score * 100).toFixed(0)}%)`);
    }
  }

  return {
    score: score > 0 ? score : 0,
    matchingReasons,
  };
}

/**
 * Calculate faith alignment between VC and startup
 */
async function calculateFaithAlignment(vcId, startup) {
  try {
    // Get all faith signals for this VC
    const { data: signals, error: signalError } = await supabase
      .from('vc_faith_signals')
      .select('*')
      .eq('vc_id', vcId)
      .eq('is_active', true)
      .gt('confidence', 0.7); // Only high-confidence signals

    if (signalError) {
      console.log(`Error fetching signals: ${signalError.message}`);
      return null;
    }

    if (!signals || signals.length === 0) {
      return null;
    }

    // Extract startup vision signals
    const visionSignals = await extractStartupVisionSignals(startup);

    // Match each signal to startup vision
    const matches = [];
    for (const signal of signals) {
      const match = matchSignalToVision(signal, visionSignals.visionSignals, startup);
      if (match.score > 0.5) {
        matches.push({
          signal_id: signal.id,
          signal_name: signal.signal_name,
          signal_category: signal.signal_category,
          match_score: match.score,
          signal_confidence: signal.confidence,
          reasons: match.matchingReasons,
        });
      }
    }

    if (matches.length === 0) {
      return null;
    }

    // Calculate overall faith alignment score
    const overallScore = matches.reduce((sum, m) => sum + (m.match_score * m.signal_confidence), 0) / matches.length;
    const overallConfidence = Math.min(...matches.map(m => m.signal_confidence));

    return {
      faith_alignment_score: overallScore,
      matching_signals: matches.map(m => m.signal_name),
      matching_reasons: [
        ...new Set(matches.flatMap(m => m.reasons)),
      ],
      confidence: overallConfidence,
      num_signals_matched: matches.length,
    };

  } catch (error) {
    console.log(`Error calculating alignment: ${error.message}`);
    return null;
  }
}

/**
 * Store psychology match
 */
async function storePsychologyMatch(vcId, startup, alignment, godScore) {
  try {
    const { error } = await supabase
      .from('psychology_matches')
      .insert({
        vc_id: vcId,
        startup_id: startup.id,
        faith_alignment_score: alignment.faith_alignment_score,
        matching_signals: alignment.matching_signals,
        matching_reasons: alignment.matching_reasons,
        confidence: alignment.confidence,
        faith_signal_confidence: alignment.confidence,
        startup_signal_confidence: 0.75,
        god_score: godScore || 0,
        faith_vs_data_alignment: 'aligned',
      });

    if (error) {
      console.log(`Error storing match: ${error.message}`);
      return false;
    }

    return true;

  } catch (error) {
    console.log(`Error: ${error.message}`);
    return false;
  }
}

/**
 * Generate human-readable explanation for why this is a good match
 */
function generateMatchExplanation(alignment) {
  if (!alignment) return 'No alignment detected';

  const reasons = alignment.matching_reasons.slice(0, 3);
  const scorePercent = Math.round(alignment.faith_alignment_score * 100);

  return `${scorePercent}% alignment: ${reasons.join(' • ')}`;
}

// Export for use in matching service
module.exports = {
  extractStartupVisionSignals,
  calculateFaithAlignment,
  storePsychologyMatch,
  generateMatchExplanation,
};
