#!/usr/bin/env npx tsx
// src/services/rss/entityExtractor.regressionHarness.ts

import { extractEntitiesFromTitle } from "./entityExtractor";
import * as fs from "fs";
import * as path from "path";

const regressionTests = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, "entityExtractor.regression.json"),
    "utf-8"
  )
);

console.log("🔬 Entity Extractor Regression Test Harness - Frame Engine");
console.log("=".repeat(80));
console.log();

let passed = 0;
let failed = 0;

for (const test of regressionTests) {
  const result = extractEntitiesFromTitle(test.title);
  
  const gotPrimary = result.primaryEntity;
  const gotEntities = result.entities.map(e => e.entity).sort();
  const expectEntities = test.expectEntities.sort();
  
  const primaryMatch = gotPrimary === test.expectPrimary;
  const entitiesMatch = 
    gotEntities.length === expectEntities.length &&
    gotEntities.every((e, i) => e === expectEntities[i]);
  
  const testPassed = primaryMatch && entitiesMatch;
  
  if (testPassed) {
    console.log(`✅ PASS: ${test.title}`);
    if (result.frame) {
      console.log(`   Frame: ${result.frame.frameType} (${result.frame.verbMatched}) [confidence: ${result.frame.meta.confidence}]`);
      if (result.frame.meta.notes?.length) {
        console.log(`   Notes: ${result.frame.meta.notes.join(", ")}`);
      }
    }
    passed++;
  } else {
    console.log(`❌ FAIL: ${test.title}`);
    console.log(`   Expected primary: ${test.expectPrimary}`);
    console.log(`   Got primary: ${gotPrimary}`);
    console.log(`   Expected entities: [${expectEntities.join(", ")}]`);
    console.log(`   Got entities: [${gotEntities.join(", ")}]`);
    if (result.frame) {
      console.log(`   Frame: ${result.frame.frameType} (${result.frame.verbMatched})`);
      console.log(`   Slots: ${JSON.stringify(result.frame.slots)}`);
      console.log(`   Notes: ${result.frame.meta.notes?.join(", ") || "none"}`);
    }
    console.log(`   Note: ${test.notes}`);
    failed++;
  }
  console.log();
}

console.log("=".repeat(80));
console.log(`📊 Results: ${passed}/${regressionTests.length} passed (${((passed / regressionTests.length) * 100).toFixed(1)}%)`);
console.log();

if (failed > 0) {
  console.log(`❌ ${failed} test(s) failed`);
  process.exit(1);
} else {
  console.log(`✅ All tests passed!`);
  process.exit(0);
}
