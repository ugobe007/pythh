/**
 * SCORE EXPLANATION GENERATOR
 * Creates debugging payload for understanding why a startup got a specific GOD score
 * 
 * This is MECHANICAL, not philosophical - just exposes the math
 */

interface ComponentScore {
  name: string;
  rawValue: number;        // 0-1 (normalized)
  weight: number;          // 0-1 (component weight)
  contribution: number;    // rawValue * weight * 100 (points contributed)
}

interface SignalContribution {
  signalName: string;
  rawValue: number | string;
  normalizedValue: number;  // 0-1
  contribution: number;     // points added to total
  category: 'funding' | 'traction' | 'team' | 'product' | 'market' | 'momentum';
}

interface ScoreExplanation {
  totalScore: number;
  weightsVersion: string;
  timestamp: string;
  
  // Component breakdown
  components: ComponentScore[];
  
  // Top contributing signals (max 10 for readability)
  topSignals: SignalContribution[];
  
  // Invariant checks (defensive programming)
  invariants: {
    componentWeightSum: number;        // Should equal 1.0
    allFeaturesNormalized: boolean;   // All 0-1?
    scoreBounded: boolean;            // 0-100?
    signalCapRespected: boolean;      // Each signal < maxContribution?
  };
  
  // Base vs adjusted
  baseScore: number;          // Score before signal adjustments
  signalAdjustment: number;   // Total adjustment from signals
}

/**
 * Generate score explanation for debugging
 */
export function generateScoreExplanation(
  baseScore: number,
  componentScores: { [key: string]: number },
  componentWeights: { [key: string]: number },
  signals: SignalContribution[],
  weightsVersion: string,
  maxSignalContribution: number = 10
): ScoreExplanation {
  
  // Build component breakdown
  const components: ComponentScore[] = Object.keys(componentWeights).map(name => ({
    name,
    rawValue: componentScores[name] || 0,
    weight: componentWeights[name],
    contribution: (componentScores[name] || 0) * componentWeights[name] * 100
  }));
  
  // Calculate total signal adjustment
  const signalAdjustment = signals.reduce((sum, s) => sum + s.contribution, 0);
  
  // Sort signals by contribution (descending) and take top 10
  const topSignals = signals
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 10);
  
  // Run invariant checks
  const componentWeightSum = Object.values(componentWeights).reduce((sum, w) => sum + w, 0);
  const allFeaturesNormalized = components.every(c => c.rawValue >= 0 && c.rawValue <= 1);
  const totalScore = baseScore + signalAdjustment;
  const scoreBounded = totalScore >= 0 && totalScore <= 100;
  const signalCapRespected = signals.every(s => s.contribution <= maxSignalContribution);
  
  return {
    totalScore,
    weightsVersion,
    timestamp: new Date().toISOString(),
    components,
    topSignals,
    invariants: {
      componentWeightSum,
      allFeaturesNormalized,
      scoreBounded,
      signalCapRespected
    },
    baseScore,
    signalAdjustment
  };
}

/**
 * Validate that an explanation passes all invariants
 * Throws error if any invariant is violated
 */
export function validateExplanation(explanation: ScoreExplanation): void {
  const { invariants } = explanation;
  
  // Check component weights sum to 1.0 (±0.001 tolerance)
  if (Math.abs(invariants.componentWeightSum - 1.0) > 0.001) {
    throw new Error(
      `Component weights sum to ${invariants.componentWeightSum}, must equal 1.0`
    );
  }
  
  // Check all features normalized
  if (!invariants.allFeaturesNormalized) {
    const unnormalized = explanation.components.filter(
      c => c.rawValue < 0 || c.rawValue > 1
    );
    throw new Error(
      `Unnormalized features detected: ${unnormalized.map(c => c.name).join(', ')}`
    );
  }
  
  // Check score bounded
  if (!invariants.scoreBounded) {
    throw new Error(
      `Score ${explanation.totalScore} is outside valid range [0, 100]`
    );
  }
  
  // Check signal cap respected
  if (!invariants.signalCapRespected) {
    const violators = explanation.topSignals.filter(
      s => s.contribution > 10 // hardcoded max from config
    );
    throw new Error(
      `Signals exceed max contribution: ${violators.map(s => s.signalName).join(', ')}`
    );
  }
}

/**
 * Format explanation as human-readable string (for logs/debugging)
 */
export function formatExplanation(explanation: ScoreExplanation): string {
  const lines: string[] = [];
  
  lines.push(`=== GOD SCORE EXPLANATION ===`);
  lines.push(`Total Score: ${explanation.totalScore.toFixed(2)}`);
  lines.push(`Weights Version: ${explanation.weightsVersion}`);
  lines.push(`Base Score: ${explanation.baseScore.toFixed(2)}`);
  lines.push(`Signal Adjustment: ${explanation.signalAdjustment >= 0 ? '+' : ''}${explanation.signalAdjustment.toFixed(2)}`);
  lines.push('');
  
  lines.push('Component Breakdown:');
  explanation.components.forEach(c => {
    lines.push(`  ${c.name.padEnd(15)} | Raw: ${c.rawValue.toFixed(3)} | Weight: ${c.weight.toFixed(3)} | Contribution: ${c.contribution.toFixed(2)} pts`);
  });
  lines.push('');
  
  lines.push('Top Signals:');
  explanation.topSignals.forEach((s, i) => {
    lines.push(`  ${i + 1}. ${s.signalName.padEnd(25)} | ${s.category.padEnd(10)} | +${s.contribution.toFixed(2)} pts`);
  });
  lines.push('');
  
  lines.push('Invariants:');
  lines.push(`  Weight Sum: ${explanation.invariants.componentWeightSum.toFixed(6)} ${explanation.invariants.componentWeightSum === 1.0 ? '✓' : '✗'}`);
  lines.push(`  Features Normalized: ${explanation.invariants.allFeaturesNormalized ? '✓' : '✗'}`);
  lines.push(`  Score Bounded: ${explanation.invariants.scoreBounded ? '✓' : '✗'}`);
  lines.push(`  Signal Cap Respected: ${explanation.invariants.signalCapRespected ? '✓' : '✗'}`);
  
  return lines.join('\n');
}
