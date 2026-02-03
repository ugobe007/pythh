#!/usr/bin/env node
/**
 * TEST IMPROVED FILTERS
 * ======================
 * Tests the impact of source quality filtering and non-event patterns
 */

const eventClassifier = require('../lib/event-classifier');
const sourceFilter = require('../lib/source-quality-filter');

console.log('\n🧪 TESTING IMPROVED FILTERS\n');
console.log('═══════════════════════════════════════════════════════════\n');

// Real "OTHER" events from production (sample from earlier analysis)
const testCases = [
  // Non-events (should be FILTERED)
  { title: 'Ask HN: What are the immediate/near/long-term non-corporate benefits of AI?', shouldFilter: true },
  { title: 'How LLM Orchestration Works and Why Developers Use LangChain', shouldFilter: true },
  { title: 'What to know about Catherine O\'Hara\'s rare heart condition, dextrocardia', shouldFilter: true },
  
  // Future tense (should be FILTERED)
  { title: '$15 billion tech CEO says she doesn\'t know what jobs will look like in 2 years', shouldFilter: true },
  { title: 'Startup plans to raise $50M Series B', shouldFilter: true },
  { title: 'Company aims to launch new platform', shouldFilter: true },
  
  // Established companies (should be FILTERED unless acquisition)
  { title: 'Apple Releases iPhone Software Update To Address Emergency Call Issue', shouldFilter: true },
  { title: 'Google announces new AI features', shouldFilter: true },
  { title: 'Microsoft acquires AI startup for $2B', shouldFilter: false }, // Acquisition = keep
  
  // Actual startup events (should PASS)
  { title: 'QuantumLight bags $50M Series B funding', shouldFilter: false },
  { title: 'AI startup lands $20M investment from Sequoia', shouldFilter: false },
  { title: 'TechCorp acquires machine learning startup for $100M', shouldFilter: false },
  { title: 'Fintech startup launches new payment platform', shouldFilter: false },
  
  // Edge cases
  { title: 'Colorists reveal the one shade women over 50 should never ask for', shouldFilter: true },
  { title: 'AC/DC 2026 tour: Full Power Up tour schedule', shouldFilter: true },
  { title: 'xAI joins SpaceX', shouldFilter: true }, // Established companies
];

console.log('📊 CLASSIFICATION RESULTS:\n');

let passed = 0;
let failed = 0;
const failures = [];

testCases.forEach((test, i) => {
  const classification = eventClassifier.classifyEvent(test.title);
  const isFiltered = classification.type === 'FILTERED';
  const isOther = classification.type === 'OTHER';
  const isActualEvent = !isFiltered && !isOther;
  
  const expectedResult = test.shouldFilter ? 'FILTERED/OTHER' : 'EVENT';
  const actualResult = isFiltered ? 'FILTERED' : (isOther ? 'OTHER' : classification.type);
  
  const success = test.shouldFilter ? (isFiltered || isOther) : isActualEvent;
  
  if (success) {
    passed++;
    console.log(`✅ ${i + 1}. ${actualResult} - ${test.title.slice(0, 60)}...`);
  } else {
    failed++;
    failures.push({ test, classification });
    console.log(`❌ ${i + 1}. ${actualResult} (expected ${expectedResult}) - ${test.title.slice(0, 60)}...`);
  }
});

console.log('\n═══════════════════════════════════════════════════════════\n');
console.log(`📈 RESULTS: ${passed}/${testCases.length} passed (${(passed/testCases.length*100).toFixed(1)}%)\n`);

if (failures.length > 0) {
  console.log('❌ FAILURES:\n');
  failures.forEach(({ test, classification }) => {
    console.log(`  Title: ${test.title}`);
    console.log(`  Expected: ${test.shouldFilter ? 'FILTERED' : 'EVENT'}`);
    console.log(`  Got: ${classification.type} (confidence: ${classification.confidence.toFixed(2)})`);
    console.log(`  Reasoning: ${classification.reasoning}`);
    console.log('');
  });
}

console.log('═══════════════════════════════════════════════════════════\n');
console.log('💡 IMPACT ESTIMATE:\n');
console.log('  • Non-event patterns: Will filter ~10-15% of OTHER events');
console.log('  • Future tense filter: Will filter ~5% of OTHER events');
console.log('  • Established companies: Will filter ~5-10% of OTHER events');
console.log('  • Total estimated reduction: 20-30% of current OTHER events');
console.log('  • Remaining OTHER: ~40-55% (down from 70-75%)');
console.log('\n');
