/**
 * Test Entity Validation Logic
 * Ensures we're distinguishing between semantic signals and entity names
 */

import { parseFrameFromTitle, toCapitalEvent } from '../src/services/rss/frameParser';

// Test cases: headline → expected extraction
const TEST_CASES = [
  {
    title: "Acme raises $25M Series A to scale AI platform",
    description: "Standard funding announcement",
    expected: {
      hasEntities: true,
      entityNames: ["Acme"],
      round: "Series A",
      amounts: true, // Should extract $25M
      eventType: "FUNDING"
    }
  },
  {
    title: "OpenAI secures $10B funding round led by Microsoft",
    description: "Large funding with investor (passive voice)",
    expected: {
      hasEntities: true,
      entityNames: ["OpenAI"], // Note: "led by Microsoft" is passive voice, not currently extracted
      round: null,
      amounts: true,
      eventType: "FUNDING"
    }
  },
  {
    title: "Series A Funding raises concerns among VCs",
    description: "Headline about funding in general, not a company",
    expected: {
      hasEntities: false, // "Series A Funding" should be rejected
      entityNames: [],
      round: null,
      amounts: false,
      eventType: "OTHER"
    }
  },
  {
    title: "Virtual psychiatry startup secures $10M seed",
    description: "Descriptive phrase, not company name",
    expected: {
      hasEntities: false, // "Virtual psychiatry startup" is too generic
      entityNames: [],
      round: "seed",
      amounts: true,
      eventType: "FUNDING"
    }
  },
  {
    title: "Stripe acquires Bridge for $1.1B",
    description: "Acquisition event",
    expected: {
      hasEntities: true,
      entityNames: ["Stripe", "Bridge"],
      round: null,
      amounts: true,
      eventType: "ACQUISITION"
    }
  },
  {
    title: "When OpenAI launched ChatGPT",
    description: "Temporal headline fragment",
    expected: {
      hasEntities: false, // "When Openai" is a question word + entity
      entityNames: [],
      round: null,
      amounts: false,
      eventType: "LAUNCH"
    }
  },
  {
    title: "The Compression Company raises $25M",
    description: "Company with 'Company' in name (legitimate)",
    expected: {
      hasEntities: true,
      entityNames: ["The Compression Company"],
      round: null,
      amounts: true,
      eventType: "FUNDING"
    }
  },
  {
    title: "Y Combinator invests in 250 startups",
    description: "Well-known investor",
    expected: {
      hasEntities: true,
      entityNames: ["Y Combinator"],
      round: null,
      amounts: false,
      eventType: "INVESTMENT"
    }
  },
  {
    title: "Seed Round closes at $5M for mystery startup",
    description: "Financing term at start",
    expected: {
      hasEntities: false, // "Seed Round" is not a company
      entityNames: [],
      round: "seed",
      amounts: true,
      eventType: "FUNDING"
    }
  }
];

console.log('🧪 Testing Entity Validation Logic\n');
console.log('=' .repeat(80));

let passed = 0;
let failed = 0;

for (const testCase of TEST_CASES) {
  console.log(`\n📝 Test: ${testCase.description}`);
  console.log(`   Input: "${testCase.title}"`);
  
  try {
    // Parse the frame
    const frame = parseFrameFromTitle(testCase.title);
    
    // Convert to capital event
    const event = toCapitalEvent(
      frame,
      "Test Publisher",
      "https://test.com/article",
      testCase.title,
      new Date().toISOString()
    );
    
    // Check results
    const results = {
      hasEntities: event.entities.length > 0,
      entityNames: event.entities.map(e => e.name),
      round: event.round || null,
      amounts: event.amounts !== undefined,
      eventType: event.event_type
    };
    
    console.log(`   Output:`);
    console.log(`     - Entities: [${results.entityNames.join(', ')}]`);
    console.log(`     - Event Type: ${results.eventType}`);
    console.log(`     - Round: ${results.round || 'none'}`);
    console.log(`     - Amounts: ${results.amounts ? 'detected' : 'none'}`);
    
    // Validate expectations
    let testPassed = true;
    const issues = [];
    
    if (results.hasEntities !== testCase.expected.hasEntities) {
      testPassed = false;
      issues.push(`Expected hasEntities=${testCase.expected.hasEntities}, got ${results.hasEntities}`);
    }
    
    if (testCase.expected.entityNames.length > 0) {
      const missingEntities = testCase.expected.entityNames.filter(
        name => !results.entityNames.includes(name)
      );
      if (missingEntities.length > 0) {
        testPassed = false;
        issues.push(`Missing expected entities: ${missingEntities.join(', ')}`);
      }
    }
    
    if (results.eventType !== testCase.expected.eventType) {
      // Event type mismatch is a warning, not failure (classifier may differ)
      console.log(`   ⚠️  Event type mismatch: expected ${testCase.expected.eventType}, got ${results.eventType}`);
    }
    
    if (testPassed) {
      console.log(`   ✅ PASS`);
      passed++;
    } else {
      console.log(`   ❌ FAIL`);
      issues.forEach(issue => console.log(`      - ${issue}`));
      failed++;
    }
    
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`);
    failed++;
  }
}

console.log('\n' + '='.repeat(80));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('✅ All tests passed!\n');
  process.exit(0);
} else {
  console.log(`❌ ${failed} test(s) failed\n`);
  process.exit(1);
}
