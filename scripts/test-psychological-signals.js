#!/usr/bin/env node
/**
 * TEST: Psychological Signal Extraction (Phase 1)
 * ===============================================
 * Tests oversubscription, follow-on, competitive, and bridge financing detection
 * 
 * Run: node scripts/test-psychological-signals.js
 */

const {
  extractOversubscriptionSignals,
  extractFollowOnSignals,
  extractCompetitiveSignals,
  extractBridgeFinancingSignals,
  extractInferenceData,
} = require('../lib/inference-extractor');

// Test cases for each psychological signal type
const TEST_CASES = {
  oversubscription: [
    {
      text: "Acme AI raises $25M Series A, oversubscribed by 3x",
      expected: { is_oversubscribed: true, multiple: 3, fomo_strength: 0.6 }
    },
    {
      text: "The round was 2.5x oversubscribed with strong demand from VCs",
      expected: { is_oversubscribed: true, multiple: 2.5, fomo_strength: 0.5 }
    },
    {
      text: "Oversubscribed round closes with participation from top firms",
      expected: { is_oversubscribed: true, multiple: null, fomo_strength: 0.5 }
    },
    {
      text: "Normal Series A round with no mention of oversubscription",
      expected: { is_oversubscribed: false }
    }
  ],
  
  followOn: [
    {
      text: "Series B led by Sequoia with participation from existing investors including Andreessen Horowitz",
      expected: { has_followon: true, count: 1 }
    },
    {
      text: "Benchmark Capital is doubling down with a $50M Series B investment",
      expected: { has_followon: true, investor: "Benchmark Capital" }
    },
    {
      text: "New round led by Accel Partners with no previous investors participating",
      expected: { has_followon: false }
    },
    {
      text: "Greylock Partners and Index Ventures both reinvesting in Series C",
      expected: { has_followon: true, count: 2 }
    }
  ],
  
  competitive: [
    {
      text: "Startup receives 3 term sheets in competitive bidding war",
      expected: { is_competitive: true, term_sheets: 3, urgency: 0.6 }
    },
    {
      text: "Multiple investors fought over the deal in a highly competitive process",
      expected: { is_competitive: true, urgency: 0.6 }
    },
    {
      text: "Founder had 5 term sheets to choose from",
      expected: { is_competitive: true, term_sheets: 5, urgency: 1.0 }
    },
    {
      text: "Series A round closes with single lead investor",
      expected: { is_competitive: false }
    }
  ],
  
  bridge: [
    {
      text: "Company raises $2M bridge round to extend runway",
      expected: { is_bridge: true, risk: 0.7 }
    },
    {
      text: "Extension round provides interim financing ahead of Series B",
      expected: { is_bridge: true, risk: 0.7 }
    },
    {
      text: "Normal Series A funding round from tier-1 VCs",
      expected: { is_bridge: false }
    },
    {
      text: "Stopgap funding secures runway until product launch",
      expected: { is_bridge: true, risk: 0.7 }
    }
  ],
};

// Full integration tests
const INTEGRATION_TESTS = [
  {
    name: "Hot deal with multiple psychological signals",
    text: `TechCrunch: AutoOps AI raises $40M Series A led by Sequoia Capital. 
           The round was oversubscribed by 3x with 4 term sheets from top-tier VCs. 
           Existing investors Andreessen Horowitz and Greylock Partners participated 
           in the competitive process.`,
    expected: {
      is_oversubscribed: true,
      is_competitive: true,
      has_followon: true,
      is_bridge_round: false
    }
  },
  {
    name: "Bridge round with risk signals",
    text: `Startup secures $3M bridge financing to extend runway. The extension 
           round was needed after Series A fundraising took longer than expected.`,
    expected: {
      is_bridge_round: true,
      is_oversubscribed: false,
      is_competitive: false,
      has_followon: false
    }
  },
  {
    name: "Standard round with no special signals",
    text: `Company raises $10M Series A led by Index Ventures to expand 
           engineering team and accelerate product development.`,
    expected: {
      is_oversubscribed: false,
      is_competitive: false,
      has_followon: false,
      is_bridge_round: false
    }
  }
];

// Test runner
function runTests() {
  console.log('🧠 PSYCHOLOGICAL SIGNAL EXTRACTION TESTS');
  console.log('═══════════════════════════════════════════\n');
  
  let totalTests = 0;
  let passedTests = 0;
  
  // Test 1: Oversubscription signals
  console.log('1️⃣  OVERSUBSCRIPTION DETECTION');
  console.log('─────────────────────────────────');
  TEST_CASES.oversubscription.forEach((test, i) => {
    totalTests++;
    const result = extractOversubscriptionSignals(test.text);
    const passed = result.is_oversubscribed === test.expected.is_oversubscribed;
    
    if (passed) {
      passedTests++;
      console.log(`✅ Test ${i+1}: PASS`);
    } else {
      console.log(`❌ Test ${i+1}: FAIL`);
      console.log(`   Expected: ${JSON.stringify(test.expected)}`);
      console.log(`   Got: ${JSON.stringify(result)}`);
    }
  });
  console.log('');
  
  // Test 2: Follow-on signals
  console.log('2️⃣  FOLLOW-ON INVESTMENT DETECTION');
  console.log('─────────────────────────────────');
  TEST_CASES.followOn.forEach((test, i) => {
    totalTests++;
    const result = extractFollowOnSignals(test.text);
    const passed = result.has_followon === test.expected.has_followon;
    
    if (passed) {
      passedTests++;
      console.log(`✅ Test ${i+1}: PASS`);
      if (result.followon_investors.length > 0) {
        console.log(`   Found: ${result.followon_investors.join(', ')}`);
      }
    } else {
      console.log(`❌ Test ${i+1}: FAIL`);
      console.log(`   Expected has_followon: ${test.expected.has_followon}`);
      console.log(`   Got: ${JSON.stringify(result)}`);
    }
  });
  console.log('');
  
  // Test 3: Competitive signals
  console.log('3️⃣  COMPETITIVE SOURCING DETECTION');
  console.log('─────────────────────────────────');
  TEST_CASES.competitive.forEach((test, i) => {
    totalTests++;
    const result = extractCompetitiveSignals(test.text);
    const passed = result.is_competitive === test.expected.is_competitive;
    
    if (passed) {
      passedTests++;
      console.log(`✅ Test ${i+1}: PASS`);
      if (result.term_sheet_count) {
        console.log(`   Term sheets: ${result.term_sheet_count}`);
      }
    } else {
      console.log(`❌ Test ${i+1}: FAIL`);
      console.log(`   Expected: ${JSON.stringify(test.expected)}`);
      console.log(`   Got: ${JSON.stringify(result)}`);
    }
  });
  console.log('');
  
  // Test 4: Bridge financing signals
  console.log('4️⃣  BRIDGE FINANCING DETECTION');
  console.log('─────────────────────────────────');
  TEST_CASES.bridge.forEach((test, i) => {
    totalTests++;
    const result = extractBridgeFinancingSignals(test.text);
    const passed = result.is_bridge_round === test.expected.is_bridge;
    
    if (passed) {
      passedTests++;
      console.log(`✅ Test ${i+1}: PASS`);
    } else {
      console.log(`❌ Test ${i+1}: FAIL`);
      console.log(`   Expected: ${JSON.stringify(test.expected)}`);
      console.log(`   Got: ${JSON.stringify(result)}`);
    }
  });
  console.log('');
  
  // Test 5: Full integration
  console.log('5️⃣  FULL INTEGRATION TESTS');
  console.log('─────────────────────────────────');
  INTEGRATION_TESTS.forEach((test, i) => {
    totalTests++;
    const result = extractInferenceData(test.text, 'https://techcrunch.com/test');
    
    const passed = 
      result.is_oversubscribed === test.expected.is_oversubscribed &&
      result.is_competitive === test.expected.is_competitive &&
      result.has_followon === test.expected.has_followon &&
      result.is_bridge_round === test.expected.is_bridge_round;
    
    if (passed) {
      passedTests++;
      console.log(`✅ Test ${i+1}: ${test.name} - PASS`);
      console.log(`   Signals detected:`);
      if (result.is_oversubscribed) console.log(`   - Oversubscribed: ${result.oversubscription_multiple}x (FOMO: ${result.fomo_signal_strength.toFixed(2)})`);
      if (result.is_competitive) console.log(`   - Competitive: ${result.term_sheet_count || 'yes'} (Urgency: ${result.urgency_signal_strength.toFixed(2)})`);
      if (result.has_followon) console.log(`   - Follow-on: ${result.followon_investors.join(', ')} (Conviction: ${result.conviction_signal_strength.toFixed(2)})`);
      if (result.is_bridge_round) console.log(`   - Bridge round (Risk: ${result.risk_signal_strength.toFixed(2)})`);
    } else {
      console.log(`❌ Test ${i+1}: ${test.name} - FAIL`);
      console.log(`   Expected:`, test.expected);
      console.log(`   Got:`, {
        is_oversubscribed: result.is_oversubscribed,
        is_competitive: result.is_competitive,
        has_followon: result.has_followon,
        is_bridge_round: result.is_bridge_round
      });
    }
  });
  console.log('');
  
  // Summary
  console.log('═══════════════════════════════════════════');
  console.log(`📊 Results: ${passedTests}/${totalTests} tests passed`);
  console.log('═══════════════════════════════════════════\n');
  
  if (passedTests === totalTests) {
    console.log('✅ All tests passed! Psychological signal extraction is working.\n');
    process.exit(0);
  } else {
    console.log(`⚠️  ${totalTests - passedTests} test(s) failed. Review output above.\n`);
    process.exit(1);
  }
}

// Run tests
runTests();
