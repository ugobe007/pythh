#!/usr/bin/env node
// Test enhanced ontology-aware parser

const { parseFrameFromTitle, toCapitalEvent } = require('../src/services/rss/frameParser.ts');

const testCases = [
  // Should PASS (real startups)
  { title: "Waymo Launches New Self-Driving Service", expect: "PASS", reason: "Real company, LAUNCH event" },
  { title: "Harvey Raises $100M Series C", expect: "PASS", reason: "Real startup, FUNDING event" },
  { title: "Sequoia Invests In Cheersy", expect: "PASS (Cheersy)", reason: "Investment - OBJECT is startup" },
  
  // Should FAIL (junk via enhanced ontology)
  { title: "MIT Researchers Discover New Battery Tech", expect: "FAIL", reason: "Generic term - MIT Researchers" },
  { title: "Washington Invests In Climate Tech", expect: "FAIL", reason: "Ambiguous - place/person" },
  { title: "Africa Sees Startup Boom", expect: "FAIL", reason: "Geographic entity" },
  { title: "Big VCs Eye Indian Startups", expect: "FAIL", reason: "Generic categories" },
  { title: "Former USDS Leaders Launch Initiative", expect: "FAIL", reason: "Government entity pattern" },
  { title: "Your Startup Is So Cool", expect: "FAIL", reason: "Possessive pronoun" },
  { title: "I Found A Startup For You", expect: "FAIL", reason: "Prepositional phrase" },
  { title: "Business Means Protecting Your Data Gets Funding", expect: "FAIL", reason: "Long statement (>6 words)" },
  
  // Edge cases
  { title: "Apple Launches New iPhone", expect: "PASS", reason: "Known company despite ambiguity" },
  { title: "Google Ventures Invests In Figma", expect: "PASS (Figma)", reason: "Investor in SUBJECT, startup in OBJECT" },
];

console.log('🧪 ONTOLOGY-ENHANCED PARSER TEST\n');
console.log('Testing Tier 1 + Tier 2 semantic classification\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, i) => {
  const frame = parseFrameFromTitle(test.title);
  if (!frame) {
    console.log(`${i+1}. ${test.expect === 'FAIL' ? '✓' : '❌'} "${test.title}"`);
    console.log(`   Reason: ${test.reason}`);
    console.log(`   Result: No frame match\n`);
    if (test.expect === 'FAIL') passed++; else failed++;
    return;
  }
  
  const event = toCapitalEvent(
    frame,
    'Test Publisher',
    'https://test.com/article',
    test.title,
    new Date().toISOString()
  );
  
  const graphSafe = event.extraction.graph_safe;
  const entities = event.entities.map(e => e.name).join(', ');
  
  const shouldPass = test.expect.startsWith('PASS');
  const actualPass = graphSafe;
  const correct = shouldPass === actualPass;
  
  console.log(`${i+1}. ${correct ? '✓' : '❌'} "${test.title}"`);
  console.log(`   Expected: ${test.expect}`);
  console.log(`   Actual: graph_safe=${graphSafe}, entities=[${entities}]`);
  console.log(`   Reason: ${test.reason}\n`);
  
  if (correct) passed++; else failed++;
});

console.log(`\n📊 Results: ${passed}/${testCases.length} tests passed (${((passed/testCases.length)*100).toFixed(0)}%)`);

if (failed > 0) {
  console.log(`\n⚠️  ${failed} tests failed - parser needs more tuning`);
} else {
  console.log('\n🎉 All tests passed! Parser is ontology-aware.');
}
