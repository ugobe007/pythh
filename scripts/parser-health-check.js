#!/usr/bin/env node
/**
 * SSOT Parser Health Check
 * Comprehensive test suite to validate parser semantic ontology system
 * Run this frequently to ensure parser quality remains high
 */

const { parseFrameFromTitle, toCapitalEvent } = require('../src/services/rss/frameParser.ts');

// Test categories
const TEST_CATEGORIES = {
  VALID_STARTUPS: {
    name: '✅ Valid Startups (Should PASS)',
    tests: [
      { title: "Waymo Launches New Self-Driving Service", expected: true, entity: "Waymo" },
      { title: "Harvey Raises $100M Series C", expected: true, entity: "Harvey" },
      { title: "Stripe Partners With Shopify", expected: true, entity: "Stripe" },
      { title: "Figma Unveils New Design Tools", expected: true, entity: "Figma" },
      { title: "Notion Announces AI Features", expected: true, entity: "Notion" },
      { title: "Anthropic Secures $450M Funding", expected: true, entity: "Anthropic" },
      { title: "Databricks Files For IPO", expected: true, entity: "Databricks" },
      { title: "Canva Valued At $40B", expected: true, entity: "Canva" },
      { title: "Ramp Closes Series D", expected: true, entity: "Ramp" },
      { title: "Scale AI Hits $7B Valuation", expected: true, entity: "Scale AI" },
    ],
  },
  
  INVESTMENT_EVENTS: {
    name: '💰 Investment Events (Extract OBJECT as startup)',
    tests: [
      { title: "Sequoia Invests In Cheersy", expected: true, entity: "Cheersy" },
      { title: "Accel Leads Round For TravelPerk", expected: true, entity: "TravelPerk" },
      { title: "Y Combinator Backs Lattice", expected: true, entity: "Lattice" },
      { title: "Andreessen Horowitz Takes Stake In Retool", expected: true, entity: "Retool" },
      { title: "General Catalyst Invests In Merge", expected: true, entity: "Merge" },
    ],
  },
  
  GENERIC_TERMS: {
    name: '❌ Generic Terms (Should FAIL)',
    tests: [
      { title: "Researchers Discover New Technology", expected: false, entity: "Researchers" },
      { title: "MIT Researchers Develop AI System", expected: false, entity: "MIT Researchers" },
      { title: "Stanford Scientists Create Battery", expected: false, entity: "Stanford Scientists" },
      { title: "Founders Share Insights", expected: false, entity: "Founders" },
      { title: "Startups Face Challenges", expected: false, entity: "Startups" },
      { title: "Indian Startups See Growth", expected: false, entity: "Indian Startups" },
      { title: "Big VCs Eye Market", expected: false, entity: "Big VCs" },
      { title: "Top Investors Discuss Trends", expected: false, entity: "Top Investors" },
      { title: "SMEs Adopt New Tools", expected: false, entity: "SMEs" },
    ],
  },
  
  GEOGRAPHIC_ENTITIES: {
    name: '🌍 Geographic Entities (Should FAIL)',
    tests: [
      { title: "Africa Sees Tech Boom", expected: false, entity: "Africa" },
      { title: "India Launches Initiative", expected: false, entity: "India" },
      { title: "UK Announces Policy", expected: false, entity: "UK" },
      { title: "Europe Expands Program", expected: false, entity: "Europe" },
      { title: "China Unveils Strategy", expected: false, entity: "China" },
      { title: "Silicon Valley Attracts Talent", expected: false, entity: "Silicon Valley" },
    ],
  },
  
  POSSESSIVE_PHRASES: {
    name: '🔒 Possessive/Prepositional (Should FAIL)',
    tests: [
      { title: "Your Startup Is Amazing", expected: false, entity: "Your Startup" },
      { title: "My Company Launches Product", expected: false, entity: "My Company" },
      { title: "Their Team Raises Funding", expected: false, entity: "Their Team" },
      { title: "I Found A Startup For You", expected: false, entity: "For You" },
      { title: "We Built This Tool To Help You", expected: false, entity: "To Help You" },
    ],
  },
  
  INSTITUTIONAL_ENTITIES: {
    name: '🏛️ Institutional/Government (Should FAIL)',
    tests: [
      { title: "Former USDS Leaders Launch Initiative", expected: false, entity: "Former USDS Leaders" },
      { title: "Ex-NASA Engineers Build Rocket", expected: false, entity: "Ex-NASA Engineers" },
      { title: "Pentagon Officials Announce Program", expected: false, entity: "Pentagon Officials" },
      { title: "CIA Veterans Start Consulting Firm", expected: false, entity: "CIA Veterans" },
    ],
  },
  
  LONG_STATEMENTS: {
    name: '📝 Long Statements (Should FAIL)',
    tests: [
      { title: "Business Means Protecting Your Data Raises Funding", expected: false, entity: "Business Means Protecting Your Data" },
      { title: "The New Way To Build Software Gets Investment", expected: false, entity: "The New Way To Build Software" },
      { title: "How We Are Changing The World Launches Today", expected: false, entity: "How We Are Changing The World" },
    ],
  },
  
  AMBIGUOUS_ENTITIES: {
    name: '⚠️ Ambiguous Entities (Context-dependent)',
    tests: [
      { title: "Apple Launches New iPhone", expected: true, entity: "Apple", note: "Known company" },
      { title: "Google Announces Feature", expected: true, entity: "Google", note: "Known company" },
      { title: "Washington Invests In Climate Tech", expected: false, entity: "Washington", note: "Person/place ambiguous" },
    ],
  },
  
  EDGE_CASES: {
    name: '🔍 Edge Cases',
    tests: [
      { title: "CEO Names New CTO", expected: false, entity: "CEO", note: "Generic role" },
      { title: "IPO Market Sees Activity", expected: false, entity: "IPO Market", note: "Generic category" },
      { title: "Series A Funding Increases", expected: false, entity: "Series A", note: "Round type" },
      { title: "VC Firm Launches Fund", expected: false, entity: "VC Firm", note: "Generic category" },
    ],
  },
};

// Run tests
function runHealthCheck() {
  console.log('🏥 SSOT PARSER HEALTH CHECK\n');
  console.log('Testing semantic ontology system (Tier 1 + Tier 2)\n');
  console.log('═'.repeat(60) + '\n');
  
  let totalTests = 0;
  let totalPassed = 0;
  let totalFailed = 0;
  const failures = [];
  
  Object.entries(TEST_CATEGORIES).forEach(([categoryKey, category]) => {
    console.log(category.name);
    console.log('─'.repeat(60));
    
    let categoryPassed = 0;
    let categoryFailed = 0;
    
    category.tests.forEach((test, idx) => {
      totalTests++;
      
      const frame = parseFrameFromTitle(test.title);
      if (!frame) {
        const passed = !test.expected;
        if (passed) {
          categoryPassed++;
          totalPassed++;
          console.log(`  ${idx + 1}. ✓ No frame (expected FAIL)`);
        } else {
          categoryFailed++;
          totalFailed++;
          console.log(`  ${idx + 1}. ✗ No frame (expected PASS)`);
          failures.push({ category: category.name, test, reason: 'No frame match' });
        }
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
      const passed = graphSafe === test.expected;
      
      if (passed) {
        categoryPassed++;
        totalPassed++;
        console.log(`  ${idx + 1}. ✓ ${test.title.slice(0, 45)}...`);
        if (test.note) {
          console.log(`      Note: ${test.note}`);
        }
      } else {
        categoryFailed++;
        totalFailed++;
        console.log(`  ${idx + 1}. ✗ ${test.title.slice(0, 45)}...`);
        console.log(`      Expected graph_safe=${test.expected}, got ${graphSafe}`);
        console.log(`      Entities: [${entities}]`);
        if (test.note) {
          console.log(`      Note: ${test.note}`);
        }
        failures.push({ 
          category: category.name, 
          test, 
          actual: graphSafe, 
          entities 
        });
      }
    });
    
    const passRate = ((categoryPassed / category.tests.length) * 100).toFixed(0);
    console.log(`\n  Category: ${categoryPassed}/${category.tests.length} passed (${passRate}%)\n`);
  });
  
  // Summary
  console.log('═'.repeat(60));
  console.log('\n📊 OVERALL RESULTS\n');
  
  const overallPassRate = ((totalPassed / totalTests) * 100).toFixed(1);
  console.log(`Total Tests: ${totalTests}`);
  console.log(`Passed: ${totalPassed} ✓`);
  console.log(`Failed: ${totalFailed} ✗`);
  console.log(`Pass Rate: ${overallPassRate}%`);
  
  // Health status
  console.log('\n🏥 HEALTH STATUS\n');
  if (overallPassRate >= 95) {
    console.log('✅ EXCELLENT - Parser is healthy');
  } else if (overallPassRate >= 85) {
    console.log('⚠️  GOOD - Minor tuning needed');
  } else if (overallPassRate >= 70) {
    console.log('⚠️  FAIR - Significant tuning needed');
  } else {
    console.log('❌ POOR - Parser requires major fixes');
  }
  
  // Failure analysis
  if (failures.length > 0) {
    console.log('\n❌ FAILURES:\n');
    failures.forEach((failure, idx) => {
      console.log(`${idx + 1}. [${failure.category}]`);
      console.log(`   "${failure.test.title}"`);
      console.log(`   Expected: graph_safe=${failure.test.expected}`);
      console.log(`   Actual: graph_safe=${failure.actual}`);
      if (failure.entities) {
        console.log(`   Entities: [${failure.entities}]`);
      }
      if (failure.reason) {
        console.log(`   Reason: ${failure.reason}`);
      }
      console.log('');
    });
  }
  
  console.log('\n💡 RECOMMENDATIONS\n');
  if (overallPassRate < 95) {
    console.log('1. Review failed test cases above');
    console.log('2. Update validateEntityQuality() in frameParser.ts');
    console.log('3. Add missing terms to entity_ontologies table');
    console.log('4. Re-run health check: npx tsx scripts/parser-health-check.js');
  } else {
    console.log('Parser is performing well! Continue monitoring regularly.');
  }
  
  console.log('\n');
  
  // Exit code based on health
  process.exit(overallPassRate >= 85 ? 0 : 1);
}

runHealthCheck();
