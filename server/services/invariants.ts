/**
 * INVARIANT VALIDATION UTILITIES
 * Mechanical checks to prevent catastrophic drift in GOD scoring
 * 
 * These are NOT philosophical - just math bounds and sanity checks
 */

interface ValidationResult {
  valid: boolean;
  violations: string[];
}

/**
 * Validate that component weights sum to 1.0 (within tolerance)
 */
export function validateWeightSum(
  weights: { [key: string]: number },
  tolerance: number = 0.001
): ValidationResult {
  const sum = Object.values(weights).reduce((acc, w) => acc + w, 0);
  const valid = Math.abs(sum - 1.0) <= tolerance;
  
  return {
    valid,
    violations: valid ? [] : [
      `Component weights sum to ${sum.toFixed(6)}, must equal 1.0 (tolerance: ±${tolerance})`
    ]
  };
}

/**
 * Validate that all normalized features are in [0, 1] range
 */
export function validateNormalizedFeatures(
  features: { [key: string]: number }
): ValidationResult {
  const violations: string[] = [];
  
  for (const [name, value] of Object.entries(features)) {
    if (value < 0 || value > 1) {
      violations.push(`Feature '${name}' has value ${value}, must be in [0, 1]`);
    }
    if (isNaN(value) || !isFinite(value)) {
      violations.push(`Feature '${name}' is ${value}, must be a finite number`);
    }
  }
  
  return {
    valid: violations.length === 0,
    violations
  };
}

/**
 * Validate that total score is in [0, 100] range
 */
export function validateScoreBounds(score: number): ValidationResult {
  const valid = score >= 0 && score <= 100 && isFinite(score);
  
  return {
    valid,
    violations: valid ? [] : [
      `Total score is ${score}, must be in [0, 100]`
    ]
  };
}

/**
 * Validate that no single signal contributes more than maxContribution
 */
export function validateSignalCap(
  signalContributions: number[],
  maxContribution: number = 10
): ValidationResult {
  const violations: string[] = [];
  
  signalContributions.forEach((contribution, i) => {
    if (contribution > maxContribution) {
      violations.push(
        `Signal #${i} contributes ${contribution.toFixed(2)} points, max is ${maxContribution}`
      );
    }
  });
  
  return {
    valid: violations.length === 0,
    violations
  };
}

/**
 * Run all invariant checks at once
 */
export function validateAllInvariants(
  componentWeights: { [key: string]: number },
  normalizedFeatures: { [key: string]: number },
  totalScore: number,
  signalContributions: number[],
  maxSignalContribution: number = 10
): ValidationResult {
  const results = [
    validateWeightSum(componentWeights),
    validateNormalizedFeatures(normalizedFeatures),
    validateScoreBounds(totalScore),
    validateSignalCap(signalContributions, maxSignalContribution)
  ];
  
  const allViolations = results.flatMap(r => r.violations);
  
  return {
    valid: allViolations.length === 0,
    violations: allViolations
  };
}

/**
 * Throw error if any invariants are violated
 * Use this in production code to fail fast
 */
export function assertInvariants(
  componentWeights: { [key: string]: number },
  normalizedFeatures: { [key: string]: number },
  totalScore: number,
  signalContributions: number[],
  maxSignalContribution: number = 10
): void {
  const result = validateAllInvariants(
    componentWeights,
    normalizedFeatures,
    totalScore,
    signalContributions,
    maxSignalContribution
  );
  
  if (!result.valid) {
    throw new Error(
      'GOD score invariant violation detected:\n' +
      result.violations.map(v => `  • ${v}`).join('\n')
    );
  }
}

/**
 * Log warnings for near-violations (within 10% of limits)
 */
export function checkInvariantWarnings(
  componentWeights: { [key: string]: number },
  totalScore: number,
  signalContributions: number[],
  maxSignalContribution: number = 10
): string[] {
  const warnings: string[] = [];
  
  // Check if weight sum is close to edge of tolerance
  const weightSum = Object.values(componentWeights).reduce((acc, w) => acc + w, 0);
  if (Math.abs(weightSum - 1.0) > 0.0005) {
    warnings.push(`Component weight sum (${weightSum.toFixed(6)}) is close to tolerance limit`);
  }
  
  // Check if score is close to bounds
  if (totalScore > 95) {
    warnings.push(`Score ${totalScore.toFixed(1)} is very high (near 100 cap)`);
  }
  if (totalScore < 5) {
    warnings.push(`Score ${totalScore.toFixed(1)} is very low (near 0 floor)`);
  }
  
  // Check if any signal is close to cap
  const nearCap = signalContributions.filter(c => c > maxSignalContribution * 0.9);
  if (nearCap.length > 0) {
    warnings.push(`${nearCap.length} signal(s) contributing near max cap (${maxSignalContribution})`);
  }
  
  return warnings;
}
