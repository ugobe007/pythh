#!/usr/bin/env node
/**
 * TEST QUALITY FILTER
 * 
 * Purpose: Verify ontological filter correctly identifies good vs bad startup entries
 * Tests: Person names, junk data, legitimate startups, edge cases
 */

const { validateStartup, isValidStartup, getQualityScore } = require('./scrapers/quality-filter.js');

console.log('🧪 TESTING QUALITY FILTER');
console.log('═'.repeat(70));
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// TEST CASES
// ═══════════════════════════════════════════════════════════════════════════

const testCases = [
  // ─────────────────────────────────────────────────────────────────────────
  // SHOULD REJECT (Person Names)
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "Jeff Bezos",
    description: "Founder of Amazon",
    expected: false,
    reason: "Person name"
  },
  {
    name: "Elon Musk",
    description: "CEO of Tesla and SpaceX",
    expected: false,
    reason: "Person name"
  },
  {
    name: "Nvidia's Huang",
    description: "CEO of Nvidia",
    expected: false,
    reason: "Possessive person name"
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // SHOULD REJECT (Junk Data)
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "Winter Continues",
    description: "",
    expected: false,
    reason: "Nonsensical name, no data"
  },
  {
    name: "XYZ",
    description: "",
    expected: false,
    reason: "Too short, no description"
  },
  {
    name: "Sequoia Capital",
    description: "Venture capital firm investing in startups",
    expected: false,
    reason: "VC firm, not a startup"
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // SHOULD ACCEPT (Good Startups)
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "OpenAI",
    description: "AI research and deployment company building safe artificial intelligence",
    pitch: "Creating safe AGI that benefits all of humanity",
    website: "https://openai.com",
    sector: ["AI", "Research"],
    expected: true,
    reason: "Legitimate AI startup"
  },
  {
    name: "Stripe",
    description: "Payment processing platform for internet businesses",
    pitch: "Online payment infrastructure for the internet",
    website: "https://stripe.com",
    sector: ["Fintech", "Payments"],
    expected: true,
    reason: "Well-known fintech startup"
  },
  {
    name: "Acme Corp",
    description: "Building enterprise SaaS tools for modern B2B companies",
    pitch: "Streamline your business operations with our cloud-based platform",
    website: "https://acme.com",
    expected: true,
    reason: "Generic but valid startup"
  },
  {
    name: "DataViz Labs",
    description: "Data visualization and analytics platform for data scientists",
    website: "https://datavizlabs.com",
    expected: true,
    reason: "Tech suffix + good keywords"
  },
  
  // ─────────────────────────────────────────────────────────────────────────
  // EDGE CASES
  // ─────────────────────────────────────────────────────────────────────────
  {
    name: "Smith & Co",
    description: "Legal tech startup automating contract review with AI",
    pitch: "Transform legal workflows with machine learning",
    website: "https://smithandco.com",
    expected: true,
    reason: "Person-like name, but clear startup description"
  },
  {
    name: "TechStartup",
    description: "",
    expected: false,
    reason: "Good name, but no description"
  },
  {
    name: "CloudSync",
    description: "Cloud storage and file synchronization service",
    website: "https://cloudsync.io",
    expected: true,
    reason: "Minimal but sufficient data"
  }
];

// ═══════════════════════════════════════════════════════════════════════════
// RUN TESTS
// ═══════════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`   Expected: ${testCase.expected ? 'ACCEPT ✅' : 'REJECT ❌'}`);
  console.log(`   Reason: ${testCase.reason}`);
  
  const validation = validateStartup(testCase);
  const actualResult = validation.isValid;
  
  console.log(`   Actual: ${actualResult ? 'ACCEPT ✅' : 'REJECT ❌'}`);
  console.log(`   Scores: Overall ${validation.scores.overall}, Completeness ${validation.scores.completeness}, Semantic ${validation.scores.semantic}`);
  console.log(`   Recommendation: ${validation.recommendation}`);
  
  if (actualResult === testCase.expected) {
    console.log(`   ✅ PASS\n`);
    passed++;
  } else {
    console.log(`   ❌ FAIL - Expected ${testCase.expected}, got ${actualResult}\n`);
    failed++;
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════

console.log('═'.repeat(70));
console.log('📊 TEST RESULTS');
console.log('═'.repeat(70));
console.log(`Total tests: ${testCases.length}`);
console.log(`Passed: ${passed} ✅`);
console.log(`Failed: ${failed} ❌`);
console.log(`Success rate: ${Math.round(passed / testCases.length * 100)}%`);
console.log('');

if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED! Quality filter is working correctly.');
} else {
  console.log('⚠️  Some tests failed. Review the logic in quality-filter.js');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLES OF EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════

console.log('');
console.log('═'.repeat(70));
console.log('💡 EDGE CASE EXAMPLES');
console.log('═'.repeat(70));
console.log('');

const edgeCases = [
  {
    name: "John's AI",
    description: "AI-powered marketing automation platform for small businesses",
    pitch: "Scale your marketing efforts with intelligent automation"
  },
  {
    name: "Bezos Inc",
    description: "E-commerce logistics optimization using machine learning"
  },
  {
    name: "Tesla Energy Labs", 
    description: "Clean energy research and battery technology development"
  }
];

console.log('Testing edge cases (person-like names with startup context):');
console.log('');

edgeCases.forEach(edge => {
  const val = validateStartup(edge);
  console.log(`${edge.name}: ${val.isValid ? 'ACCEPT ✅' : 'REJECT ❌'} (score: ${val.scores.overall})`);
  console.log(`   Completeness: ${val.scores.completeness}, Semantic: ${val.scores.semantic}`);
  console.log(`   Person name flag: ${val.flags.looksLikePerson ? 'YES' : 'NO'}`);
  console.log(`   Startup keywords: ${val.flags.hasStartupKeywords ? 'YES' : 'NO'}`);
  console.log('');
});
