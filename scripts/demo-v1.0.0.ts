// Demo script for Phase-Change v1.0.0 canonical contract
// Tests: amount extraction, round extraction, semantic evidence scoring, entity roles

import { parseFrameFromTitle, toCapitalEvent } from '../src/services/rss/frameParser';
import { validateCapitalEvent, EVENT_WEIGHTS } from '../src/services/rss/frameParser';

const testHeadlines = [
  // Amount + Round extraction
  {
    title: "QuantumLight raises $55M Series B from Sequoia",
    expected: {
      amounts: { value: 55, magnitude: "M", currency: "USD" },
      round: "Series B",
      event_type: "FUNDING",
    }
  },
  
  // Multi-currency amounts
  {
    title: "HongKong FinTech secures HK$2.5B in growth funding",
    expected: {
      amounts: { value: 2.5, magnitude: "B", currency: "HKD" },
      event_type: "FUNDING",
    }
  },
  
  // Semantic evidence: problem_solved
  {
    title: "Sam Altman invests in Coco Robotics since they solved the hard problem of fluid motion controls",
    expected: {
      event_type: "INVESTMENT",
      semantic_context: [
        { type: "problem_solved", confidence: 0.9 }
      ]
    }
  },
  
  // Semantic evidence: achievement
  {
    title: "Stripe partners with Mastercard after achieving 100M user milestone",
    expected: {
      event_type: "PARTNERSHIP",
      semantic_context: [
        { type: "achievement", confidence: 0.85 }
      ]
    }
  },
  
  // Semantic evidence: milestone (FIXED - should NOT trigger on Series rounds)
  {
    title: "Notion launches AI features following their Series C",
    expected: {
      event_type: "LAUNCH",
      semantic_context: [] // No milestone expected (Series C is a round, not a milestone)
    }
  },
  
  // CHANNEL role test (FIXED - distribution deal is now CONTRACT, not PARTNERSHIP)
  {
    title: "Julie's Jelly signs distribution deal with Whole Foods",
    expected: {
      event_type: "CONTRACT",
      entities: [
        { name: "Julie's Jelly", role: "SUBJECT" },
        { name: "Whole Foods", role: "CHANNEL" }
      ]
    }
  },
  
  // Topic headline (should be FILTERED)
  {
    title: "VC's 2026 Predictions for AI Startups",
    expected: {
      event_type: "FILTERED",
    }
  },
  
  // Low-quality entity (should be filtered or OTHER)
  {
    title: "It raises funding",
    expected: {
      event_type: "FILTERED",
    }
  },
  
  // ========== REGRESSION TESTS (3 Patches) ==========
  
  // Patch 1: HK$ magnitude detection (B vs M)
  {
    title: "HongKong AI Labs raises HK$2.5B Series D",
    expected: {
      amounts: { value: 2.5, magnitude: "B", currency: "HKD" },
      event_type: "FUNDING",
    }
  },
  
  // Patch 2: Milestone false positive on Series mentions
  {
    title: "Datadog acquires CloudTech following their Series E",
    expected: {
      event_type: "ACQUISITION",
      semantic_context: [] // Should NOT have milestone context
    }
  },
  
  // Patch 2b: Real milestone with substantive tokens
  {
    title: "Stripe launches payment API after achieving 50M customers",
    expected: {
      event_type: "LAUNCH",
      semantic_context: [
        { type: "achievement", confidence: 0.85 }
      ]
    }
  },
  
  // Patch 3: Distribution deal patterns
  {
    title: "FreshBrew signs distribution deal with Target",
    expected: {
      event_type: "CONTRACT",
      entities: [
        { name: "FreshBrew", role: "SUBJECT" },
        { name: "Target", role: "CHANNEL" }
      ]
    }
  },
];

async function runDemo() {
  console.log("=".repeat(80));
  console.log("🚀 Phase-Change v1.0.0 Canonical Contract Demo");
  console.log("=".repeat(80));
  console.log();
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testHeadlines) {
    console.log(`📰 ${test.title}`);
    console.log();
    
    // Parse the headline to ParsedFrame
    const frame = parseFrameFromTitle(test.title);
    
    if (!frame) {
      console.log("   ❌ No frame parsed");
      failed++;
      console.log();
      continue;
    }
    
    // Convert to CapitalEvent with v1.0.0 contract
    const parsed = toCapitalEvent(
      frame,
      "TechCrunch",
      `https://example.com/article/${Date.now()}`,
      test.title,
      new Date().toISOString()
    );
    
    // Display schema versioning
    console.log(`   📋 Schema: ${parsed.schema_version} | Engine: ${parsed.frame_engine_version}`);
    
    // Display event type and confidence
    console.log(`   🎯 Event Type: ${parsed.event_type} (${(parsed.frame_confidence * 100).toFixed(0)}% confidence)`);
    console.log(`   ⚖️  Event Weight: ${EVENT_WEIGHTS[parsed.event_type]}`);
    
    // Check amounts
    if (parsed.amounts) {
      console.log(`   💰 Amount: ${parsed.amounts.raw} → ${parsed.amounts.currency} ${parsed.amounts.value}${parsed.amounts.magnitude}`);
    }
    
    // Check round
    if (parsed.round) {
      console.log(`   🎲 Round: ${parsed.round}`);
    }
    
    // Check semantic evidence
    if (parsed.semantic_context && parsed.semantic_context.length > 0) {
      console.log(`   💡 Semantic Evidence:`);
      for (const evidence of parsed.semantic_context) {
        console.log(`      • ${evidence.type} (${(evidence.confidence * 100).toFixed(0)}% conf)`);
        console.log(`        "${evidence.text}"`);
      }
    }
    
    // Check entities and roles
    if (parsed.entities && parsed.entities.length > 0) {
      console.log(`   👥 Entities (${parsed.entities.length}):`);
      for (const entity of parsed.entities) {
        console.log(`      • ${entity.name} [${entity.role}] (${(entity.confidence * 100).toFixed(0)}%)`);
      }
    }
    
    // Validate invariants
    const validation = validateCapitalEvent(parsed);
    if (!validation.valid) {
      console.log(`   ⚠️  Invariant Violations:`);
      for (const error of validation.errors) {
        console.log(`      • ${error}`);
      }
    } else {
      console.log(`   ✅ All invariants valid`);
    }
    
    // Check expectations
    let testPassed = true;
    
    if (test.expected.event_type && parsed.event_type !== test.expected.event_type) {
      console.log(`   ❌ Expected event_type ${test.expected.event_type}, got ${parsed.event_type}`);
      testPassed = false;
    }
    
    if (test.expected.amounts) {
      if (!parsed.amounts) {
        console.log(`   ❌ Expected amounts, got none`);
        testPassed = false;
      } else {
        if (parsed.amounts.value !== test.expected.amounts.value) {
          console.log(`   ❌ Amount value mismatch: ${parsed.amounts.value} vs ${test.expected.amounts.value}`);
          testPassed = false;
        }
        if (parsed.amounts.magnitude !== test.expected.amounts.magnitude) {
          console.log(`   ❌ Amount magnitude mismatch: ${parsed.amounts.magnitude} vs ${test.expected.amounts.magnitude}`);
          testPassed = false;
        }
      }
    }
    
    if (test.expected.round && parsed.round !== test.expected.round) {
      console.log(`   ❌ Expected round ${test.expected.round}, got ${parsed.round}`);
      testPassed = false;
    }
    
    if (test.expected.semantic_context !== undefined) {
      // Handle explicit empty array expectation (milestone patch validation)
      if (test.expected.semantic_context.length === 0) {
        if (parsed.semantic_context && parsed.semantic_context.length > 0) {
          console.log(`   ❌ Expected NO semantic context, got ${parsed.semantic_context.length} items`);
          testPassed = false;
        }
      } else {
        // Check for expected semantic contexts
        if (!parsed.semantic_context || parsed.semantic_context.length === 0) {
          console.log(`   ❌ Expected semantic context, got none`);
          testPassed = false;
        } else {
          for (const expectedEvidence of test.expected.semantic_context) {
            const found = parsed.semantic_context.find(e => e.type === expectedEvidence.type);
            if (!found) {
              console.log(`   ❌ Expected semantic evidence type ${expectedEvidence.type}, not found`);
              testPassed = false;
            }
          }
        }
      }
    }
    
    if (testPassed) {
      console.log(`   ✅ Test PASSED`);
      passed++;
    } else {
      failed++;
    }
    
    console.log();
  }
  
  console.log("=".repeat(80));
  console.log(`📊 Results: ${passed}/${testHeadlines.length} passed`);
  console.log("=".repeat(80));
  console.log();
  
  // Display event weight table
  console.log("⚖️  Event Weights (for GOD score integration):");
  console.log();
  Object.entries(EVENT_WEIGHTS).forEach(([eventType, weight]) => {
    const bar = "█".repeat(Math.floor(weight * 20));
    console.log(`   ${eventType.padEnd(15)} ${weight.toFixed(1)} ${bar}`);
  });
}

runDemo().catch(console.error);
