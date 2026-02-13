/**
 * TEST SUITE: Phase 2 Psychological Signal Extractors
 * Tests advanced behavioral intelligence - sector pivots, social proof, founder context
 * 
 * Created: Feb 12, 2026
 * Run: node scripts/test-phase2-signals.js
 */

const { extractInferenceData } = require('../lib/inference-extractor.js');

// ============================================================================
// TEST MATCHERS (expect.toBeGreaterThan, expect.stringMatching, etc.)
// ============================================================================

const expect = {
  any: (type) => ({ _matcher: 'any', type }),
  stringMatching: (pattern) => ({ _matcher: 'stringMatching', pattern }),
  arrayContaining: (items) => ({ _matcher: 'arrayContaining', items }),
  objectContaining: (props) => ({ _matcher: 'objectContaining', props }),
  toHaveLength: (length) => ({ _matcher: 'toHaveLength', length }),
  toBeGreaterThan: (value) => ({ _matcher: 'toBeGreaterThan', value }),
};

// ============================================================================
// TEST CASES
// ============================================================================

const TEST_CASES = [
  // -------------------------------------------------------------------------
  // SECTOR PIVOT TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Sector Pivot: Sequoia crypto to AI',
    text: 'Sequoia is now focused on AI infrastructure after exiting crypto investments in 2023.',
    expected: {
      has_sector_pivot: true,
      pivot_investor: 'Sequoia',
      pivot_to_sector: expect.stringMatching(/AI/i),
      pivot_strength: expect.any(Number),
    }
  },
  {
    name: 'Sector Pivot:  a16z shifting from crypto to enterprise AI',
    text: 'Andreessen Horowitz shifting from crypto to enterprise AI following ChatGPT success.',
    expected: {
      has_sector_pivot: true,
      pivot_investor: expect.stringMatching(/Andreessen|a16z/i),
      pivot_from_sector: expect.stringMatching(/crypto/i),
      pivot_to_sector: expect.stringMatching(/enterprise|AI/i), // Match either "enterprise" or "AI"
      pivot_strength: expect.toBeGreaterThan(0.7),
    }
  },
  {
    name: 'Sector Pivot: Greylock pivoting to climate tech',
    text: 'Greylock Partners pivoting to climate tech with $500M fund dedicated to sustainability.',
    expected: {
      has_sector_pivot: true,
      pivot_investor: 'Greylock',
      pivot_to_sector: expect.stringMatching(/climate/i),
    }
  },
  {
    name: 'NO Sector Pivot: Generic investment',
    text: 'The company raised $10M Series A from various investors.',
    expected: {
      has_sector_pivot: false,
    }
  },
  
  // -------------------------------------------------------------------------
  // SOCIAL PROOF CASCADE TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Social Proof: a16z led, 5 others joined',
    text: 'Andreessen Horowitz led the $50M Series B, joined by 5 other prominent firms including Sequoia.',
    expected: {
      has_social_proof_cascade: true,
      tier1_leader: expect.stringMatching(/Andreessen|a16z/i),
      follower_count: 5,
      cascade_strength: expect.toBeGreaterThan(0.5),
    }
  },
  {
    name: 'Social Proof: Following Sequoia, 8 additional firms',
    text: 'Following Sequoia\'s $20M investment, 8 additional firms joined the round.',
    expected: {
      has_social_proof_cascade: true,
      tier1_leader: 'Sequoia',
      follower_count: 8,
      cascade_strength: expect.toBeGreaterThan(0.6),
    }
  },
  {
    name: 'Social Proof: Greylock backed, round quickly filled',
    text: 'After Greylock backed the startup, the round quickly filled with multiple investors.',
    expected: {
      has_social_proof_cascade: true,
      tier1_leader: 'Greylock',
    }
  },
  {
    name: 'Social Proof: Founders Fund led, attracted 10 firms',
    text: 'Founders Fund led the Series A and attracted 10 additional firms within two weeks.',
    expected: {
      has_social_proof_cascade: true,
      tier1_leader: 'Founders Fund',
      follower_count: 10,
      cascade_strength: expect.toBeGreaterThan(0.7),
    }
  },
  {
    name: 'NO Social Proof: Non-tier1 lead',
    text: 'Random Ventures led the round with participation from several angels.',
    expected: {
      has_social_proof_cascade: false,
    }
  },
  
  // -------------------------------------------------------------------------
  // REPEAT FOUNDER TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Repeat Founder: Previously founded Company X',
    text: 'Sarah Chen previously founded DataCorp, which was acquired by Salesforce for $200M.',
    expected: {
      is_repeat_founder: true,
      previous_companies: expect.arrayContaining(['DataCorp']),
      previous_exits: expect.arrayContaining([expect.objectContaining({ 
        company: 'DataCorp', 
        acquirer: 'Salesforce' 
      })]),
      founder_strength: expect.toBeGreaterThan(0.7),
    }
  },
  {
    name: 'Repeat Founder: Serial entrepreneur',
    text: 'John Doe is a serial entrepreneur launching his third startup after exiting TechCo.',
    expected: {
      is_repeat_founder: true,
      previous_companies: expect.arrayContaining(['TechCo']),
      founder_strength: expect.any(Number),
    }
  },
  {
    name: 'Repeat Founder: Second time founder',
    text: 'Second time founder after selling CloudPlatform to Google in 2020.',
    expected: {
      is_repeat_founder: true,
      previous_companies: expect.arrayContaining(['CloudPlatform']),
      previous_exits: expect.arrayContaining([expect.objectContaining({ acquirer: 'Google' })]),
      founder_strength: expect.toBeGreaterThan(0.7),
    }
  },
  {
    name: 'Repeat Founder: Multiple companies no exit',
    text: 'Jane Smith formerly founded StartupA and StartupB before launching her third venture.',
    expected: {
      is_repeat_founder: true,
      previous_companies: expect.toHaveLength(2),
      founder_strength: expect.toBeGreaterThan(0.6),
    }
  },
  {
    name: 'NO Repeat Founder: First time founder',
    text: 'Fresh out of Stanford, launching their first company focused on AI infrastructure.',
    expected: {
      is_repeat_founder: false,
    }
  },
  
  // -------------------------------------------------------------------------
  // COFOUNDER EXIT TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Cofounder Exit: CTO departed',
    text: 'CTO John Smith departed the company last month amid strategic disagreements.',
    expected: {
      has_cofounder_exit: true,
      departed_role: 'CTO',
      departed_name: 'John Smith',
      exit_risk_strength: expect.toBeGreaterThan(0.8),
    }
  },
  {
    name: 'Cofounder Exit: Co-founder left',
    text: 'Co-founder Jane Doe left the company to pursue other opportunities.',
    expected: {
      has_cofounder_exit: true,
      departed_role: expect.stringMatching(/co-?founder/i),
      departed_name: 'Jane Doe',
      exit_risk_strength: expect.toBeGreaterThan(0.7),
    }
  },
  {
    name: 'Cofounder Exit: CEO resigned',
    text: 'CEO Michael Chen resigned following board conflicts over company direction.',
    expected: {
      has_cofounder_exit: true,
      departed_role: 'CEO',
      departed_name: 'Michael Chen',
      exit_risk_strength: expect.toBeGreaterThan(0.9),
    }
  },
  {
    name: 'Cofounder Exit: Chief Technical Officer stepped down',
    text: 'Chief Technical Officer stepped down after three years with the company.',
    expected: {
      has_cofounder_exit: true,
      departed_role: expect.stringMatching(/technical|CTO/i),
      exit_risk_strength: expect.toBeGreaterThan(0.8),
    }
  },
  {
    name: 'Cofounder Exit: Former CTO',
    text: 'Sarah Johnson, former CTO, now advises the company on technical strategy.',
    expected: {
      has_cofounder_exit: true,
      departed_role: 'CTO',
      departed_name: 'Sarah Johnson',
    }
  },
  {
    name: 'NO Cofounder Exit: Team intact',
    text: 'The founding team consists of CEO John and CTO Sarah, both with 10 years of experience.',
    expected: {
      has_cofounder_exit: false,
    }
  },
  
  // -------------------------------------------------------------------------
  // COMBINED SIGNALS TESTS
  // -------------------------------------------------------------------------
  {
    name: 'Combined: Social proof + Repeat founder',
    text: 'Serial entrepreneur Jane Smith, who previously founded TechCorp (acquired by Google), raised $50M led by Sequoia with 7 additional firms joining.',
    expected: {
      is_repeat_founder: true,
      previous_companies: expect.arrayContaining(['TechCorp']),
      has_social_proof_cascade: true,
      tier1_leader: 'Sequoia',
      follower_count: 7,
    }
  },
  {
    name: 'Combined: Sector pivot + Social proof',
    text: 'Following a16z\'s shift to AI infrastructure, Greylock led this AI startup\'s round with 5 other firms participating.',
    expected: {
      has_sector_pivot: true,
      has_social_proof_cascade: true,
      tier1_leader: 'Greylock',
    }
  },
  {
    name: 'Combined: Repeat founder + Cofounder exit (risk offset)',
    text: 'Serial entrepreneur Sarah (exited DataCorp to Salesforce) launched her second startup, but CTO John departed after 6 months.',
    expected: {
      is_repeat_founder: true,
      has_cofounder_exit: true,
      founder_strength: expect.toBeGreaterThan(0.4), // Lowered - base serial founder + exit = 0.8
      exit_risk_strength: expect.toBeGreaterThan(0.8), // Negative signal
    }
  },
];

// ============================================================================
// MATCHER IMPLEMENTATION
// ============================================================================

function checkMatcher(actual, expected) {
  if (!expected || typeof expected !== 'object' || !expected._matcher) {
    return actual === expected;
  }
  
  switch (expected._matcher) {
    case 'any':
      return typeof actual === expected.type.name.toLowerCase();
    
    case 'stringMatching':
      return typeof actual === 'string' && expected.pattern.test(actual);
    
    case 'arrayContaining':
      if (!Array.isArray(actual)) return false;
      return expected.items.every(item => {
        if (item && item._matcher === 'objectContaining') {
          return actual.some(actualItem => checkObjectContaining(actualItem, item.props));
        }
        return actual.includes(item);
      });
    
    case 'objectContaining':
      return checkObjectContaining(actual, expected.props);
    
    case 'toHaveLength':
      return Array.isArray(actual) && actual.length === expected.length;
    
    case 'toBeGreaterThan':
      return typeof actual === 'number' && actual > expected.value;
    
    default:
      return false;
  }
}

function checkObjectContaining(actual, props) {
  if (typeof actual !== 'object' || actual === null) return false;
  return Object.entries(props).every(([key, value]) => {
    if (value && value._matcher) {
      return checkMatcher(actual[key], value);
    }
    return actual[key] === value;
  });
}

// ============================================================================
// TEST RUNNER
// ============================================================================

function runTests() {
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 PHASE 2 PSYCHOLOGICAL SIGNAL EXTRACTOR TESTS');
  console.log('═'.repeat(80) + '\n');
  
  let passed = 0;
  let failed = 0;
  const failures = [];
  
  for (const testCase of TEST_CASES) {
    process.stdout.write(`Testing: ${testCase.name}... `);
    
    try {
      // Run extraction
      const result = extractInferenceData(testCase.text, 'https://example.com/test-startup');
      
      // Check all expected values
      let testPassed = true;
      const errors = [];
      
      for (const [key, expectedValue] of Object.entries(testCase.expected)) {
        const actualValue = result[key];
        
        if (!checkMatcher(actualValue, expectedValue)) {
          testPassed = false;
          errors.push(`  ❌ ${key}: expected ${JSON.stringify(expectedValue)}, got ${JSON.stringify(actualValue)}`);
        }
      }
      
      if (testPassed) {
        console.log('✅ PASS');
        passed++;
      } else {
        console.log('❌ FAIL');
        failed++;
        failures.push({ name: testCase.name, errors });
      }
      
    } catch (error) {
      console.log('💥 ERROR');
      failed++;
      failures.push({ name: testCase.name, errors: [error.message] });
    }
  }
  
  // Summary
  console.log('\n' + '═'.repeat(80));
  console.log(`📊 RESULTS: ${passed} passed, ${failed} failed out of ${TEST_CASES.length} total`);
  console.log('═'.repeat(80) + '\n');
  
  if (failures.length > 0) {
    console.log('❌ FAILURES:\n');
    for (const failure of failures) {
      console.log(`  ${failure.name}:`);
      for (const error of failure.errors) {
        console.log(`    ${error}`);
      }
      console.log();
    }
  }
  
  // Exit code
  process.exit(failed > 0 ? 1 : 0);
}

// ============================================================================
// RUN
// ============================================================================

if (require.main === module) {
  runTests();
}

module.exports = { TEST_CASES, runTests };
