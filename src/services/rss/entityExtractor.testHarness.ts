/* src/services/rss/entityExtractor.testHarness.ts */

import { extractEntitiesFromTitle } from "./entityExtractor";

const tests = [
  // Multi-entity titles
  {
    title: "General Catalyst merges with Venture Highway in record-breaking deal",
    expectedPrimary: "General Catalyst",
    expectedEntities: ["General Catalyst", "Venture Highway"],
  },
  {
    title: "Sakana AI Announces Strategic Partnership With Google",
    expectedPrimary: "Sakana AI",
    expectedEntities: ["Sakana AI", "Google"],
  },
  {
    title: "Harvey Acquires Hexus in major consolidation move",
    expectedPrimary: "Harvey",
    expectedEntities: ["Harvey", "Hexus"],
  },
  
  // Invests-in title
  {
    title: "Google invests $350M in Indian e-commerce giant Flipkart",
    expectedPrimary: "Flipkart",
    expectedEntities: ["Flipkart", "Google"],
  },
  
  // Names-as-exec titles (NEW)
  {
    title: "Barrick Mining Names Helen Cai As CFO",
    expectedPrimary: "Barrick Mining",
    expectedEntities: ["Barrick Mining"],
  },
  {
    title: "Catalyst Acoustics Group Names Charles Merrimon As CEO",
    expectedPrimary: "Catalyst Acoustics Group",
    expectedEntities: ["Catalyst Acoustics Group"],
  },
  
  // Baseline single-entity
  {
    title: "KPay raises $55M Series A from top VCs",
    expectedPrimary: "KPay",
    expectedEntities: ["KPay"],
  },
  
  // No-company title
  {
    title: "India scraps 'angel tax' for startups in major policy shift",
    expectedPrimary: null,
    expectedEntities: [],
  },
  
  // Person name rejection
  {
    title: "TikTok forms joint venture, names Adam Presser CEO of new unit",
    expectedPrimary: "TikTok",
    expectedEntities: ["TikTok"],
  },
];

console.log("🧪 Entity Extractor Test Harness - Multi-Entity Version\n");
console.log("=".repeat(80) + "\n");

let passed = 0;
let failed = 0;

for (let i = 0; i < tests.length; i++) {
  const t = tests[i];
  const result = extractEntitiesFromTitle(t.title);
  
  console.log(`Test ${i + 1}: ${t.title}`);
  console.log(`Expected primary: ${t.expectedPrimary}`);
  console.log(`Got primary: ${result.primaryEntity}`);
  console.log(`Expected entities: [${t.expectedEntities.join(", ")}]`);
  console.log(`Got entities: [${result.entities.map((e) => e.entity).join(", ")}]`);
  console.log(`Confidence: ${result.confidence.toFixed(3)}`);
  
  const primaryMatch = result.primaryEntity === t.expectedPrimary;
  const entitiesMatch =
    t.expectedEntities.length === result.entities.length &&
    t.expectedEntities.every((exp) =>
      result.entities.some((e) => e.entity.toLowerCase() === exp.toLowerCase())
    );
  
  const success = primaryMatch && entitiesMatch;
  
  if (success) {
    console.log("✅ PASS\n");
    passed++;
  } else {
    console.log("❌ FAIL");
    if (!primaryMatch) console.log(`  - Primary mismatch`);
    if (!entitiesMatch) {
      console.log(`  - Entities mismatch`);
      console.log(`    Missing: ${t.expectedEntities.filter((exp) => !result.entities.some((e) => e.entity.toLowerCase() === exp.toLowerCase())).join(", ")}`);
      console.log(`    Extra: ${result.entities.filter((e) => !t.expectedEntities.some((exp) => exp.toLowerCase() === e.entity.toLowerCase())).map((e) => e.entity).join(", ")}`);
    }
    console.log("");
    failed++;
  }
  
  // Show rejected candidates for debugging
  if (result.rejected.length > 0) {
    console.log(`  Rejected: ${result.rejected.slice(0, 3).map((r) => `${r.text} (${r.reason})`).join(", ")}`);
    console.log("");
  }
}

console.log("=".repeat(80));
console.log(`\n📊 Results: ${passed}/${tests.length} passed (${((passed / tests.length) * 100).toFixed(1)}%)\n`);

if (failed > 0) {
  console.log(`❌ ${failed} test(s) failed\n`);
  process.exit(1);
} else {
  console.log("✅ All tests passed!\n");
  process.exit(0);
}
