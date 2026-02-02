/**
 * GOLDEN SET REGRESSION TEST RUNNER
 * Ensures no copilot or developer can silently break the GOD scoring system
 * 
 * Usage:
 *   npm test                          // Run all tests
 *   npx tsx tests/god-score-regression.test.ts  // Run standalone
 *   CI: Add to .github/workflows/test.yml
 */

import { calculateHotScore } from '../server/services/startupScoringService';
import goldenSet from './god-score-golden-set.json' assert { type: 'json' };
import fs from 'fs';
import path from 'path';

interface TestResult {
  exampleId: string;
  passed: boolean;
  actualScore: number;
  expectedRange: [number, number];
  scoreDelta: number;
  topComponents: string[];
  expectedComponents: string[];
  componentMatchCount: number;
  weightsVersion: string;
  errors: string[];
}

/**
 * Run golden set regression tests
 */
function runGoldenSetTests(): TestResult[] {
  const results: TestResult[] = [];
  
  for (const example of goldenSet.goldenExamples) {
    const errors: string[] = [];
    
    // Run scoring
    const score = calculateHotScore(example.testData as any);
    const actualScore = score.total * 10; // Convert to 0-100 scale
    
    // Extract top 3 component names
    const componentEntries = Object.entries(score.breakdown)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name]) => name.replace('_', ''));
    
    // Check 1: Score in expected range
    const [minScore, maxScore] = example.expectedScoreRange;
    const scoreInRange = actualScore >= minScore && actualScore <= maxScore;
    if (!scoreInRange) {
      errors.push(
        `Score ${actualScore.toFixed(1)} outside expected range [${minScore}, ${maxScore}]`
      );
    }
    
    // Check 2: At least 2 of 3 top components match
    const expectedComponents = example.expectedTopComponents;
    const matchCount = componentEntries.filter(c => 
      expectedComponents.some(exp => c.includes(exp))
    ).length;
    
    if (matchCount < 2) {
      errors.push(
        `Only ${matchCount}/3 top components match. Expected: ${expectedComponents.join(', ')}, Got: ${componentEntries.join(', ')}`
      );
    }
    
    // Check 3: Weights version matches (if we store it)
    // For now, we assume version is correct
    
    const scoreDelta = actualScore - (minScore + maxScore) / 2;
    
    results.push({
      exampleId: example.id,
      passed: errors.length === 0,
      actualScore,
      expectedRange: example.expectedScoreRange as [number, number],
      scoreDelta,
      topComponents: componentEntries,
      expectedComponents,
      componentMatchCount: matchCount,
      weightsVersion: example.weightsVersion,
      errors
    });
  }
  
  return results;
}

/**
 * Format test results as human-readable report
 */
function formatTestReport(results: TestResult[]): string {
  const lines: string[] = [];
  
  lines.push('=== GOD SCORE GOLDEN SET REGRESSION TEST ===\n');
  
  const passed = results.filter(r => r.passed).length;
  const failed = results.length - passed;
  
  lines.push(`Results: ${passed}/${results.length} passed, ${failed} failed\n`);
  
  if (failed > 0) {
    lines.push('FAILURES:');
    results.filter(r => !r.passed).forEach(r => {
      lines.push(`\n❌ ${r.exampleId}`);
      lines.push(`   Score: ${r.actualScore.toFixed(1)} (expected: ${r.expectedRange[0]}-${r.expectedRange[1]})`);
      lines.push(`   Top Components: ${r.topComponents.join(', ')} (${r.componentMatchCount}/3 match)`);
      r.errors.forEach(err => lines.push(`   • ${err}`));
    });
    lines.push('');
  }
  
  lines.push('\nPASSED:');
  results.filter(r => r.passed).forEach(r => {
    lines.push(`✓ ${r.exampleId}: ${r.actualScore.toFixed(1)} (${r.scoreDelta >= 0 ? '+' : ''}${r.scoreDelta.toFixed(1)})`);
  });
  
  return lines.join('\n');
}

/**
 * Main test runner
 */
function main() {
  console.log('Running GOD score golden set regression tests...\n');
  
  const results = runGoldenSetTests();
  const report = formatTestReport(results);
  
  console.log(report);
  
  // Save report to file
  const reportPath = path.join(process.cwd(), 'tests', 'last-regression-report.txt');
  fs.writeFileSync(reportPath, report, 'utf-8');
  console.log(`\nReport saved to: ${reportPath}`);
  
  // Exit with error code if any tests failed
  const failed = results.filter(r => !r.passed).length;
  if (failed > 0) {
    console.error(`\n❌ ${failed} test(s) failed. DO NOT MERGE.`);
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { runGoldenSetTests, formatTestReport };
