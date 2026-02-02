#!/usr/bin/env node
/**
 * Test entity extraction with Phase-Change fallback
 */

const path = require('path');

// Load the scraper module
const scraperPath = path.join(__dirname, 'scripts/core/simple-rss-scraper.js');
const { extractCompanyName } = require(scraperPath);

// Test headlines that were previously failing
const testHeadlines = [
  "The Rippling/Deel corporate spying scandal may have taken another wild...",
  "Fintech firm Marquis alerts dozens of US banks and credit unions of a ...",
  "Capital One To Buy Fintech Startup Brex At Less Than Half Its Peak Val...",
  "The Race to Run Businesses Autonomously: Cofounder by The General Inte...",
  "Turning locked up data into collective knowledge: Supper's agentic dat...",
  "Fintech firm Betterment confirms data breach after hackers send fake c...",
  "Inside Apple's AI Shake-Up and Its Plans for Two New Versions of Siri...",
  "Hackers stole over $2.7B in crypto in 2025, data shows...", // Should be FILTERED (no company)
  "2026 Demo Day Dates...", // Should be FILTERED (no company)
  "Abundant Intelligence...", // Topic headline, may extract "Abundant Intelligence"
];

console.log("🧪 Testing Enhanced Entity Extraction with Phase-Change Fallback");
console.log("=".repeat(80));
console.log();

let passed = 0;
let failed = 0;

for (const headline of testHeadlines) {
  console.log(`📰 ${headline}`);
  const extracted = extractCompanyName(headline);
  
  if (extracted) {
    console.log(`   ✅ Extracted: "${extracted}"`);
    passed++;
  } else {
    console.log(`   ❌ No company name extracted`);
    failed++;
  }
  console.log();
}

console.log("=".repeat(80));
console.log(`📊 Results: ${passed}/${testHeadlines.length} extracted`);
console.log();

if (passed >= 7) {
  console.log("✅ Entity extraction significantly improved!");
  process.exit(0);
} else {
  console.log("⚠️  Entity extraction still needs work");
  process.exit(1);
}
