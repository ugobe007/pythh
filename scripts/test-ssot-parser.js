#!/usr/bin/env npx tsx
/**
 * Test SSOT RSS Scraper - Validate Parser is SSOT
 * 
 * Tests headlines that were previously failing with "No company name extracted"
 * 
 * Run with: npx tsx scripts/test-ssot-parser.js
 */

import { parseFrameFromTitle, toCapitalEvent } from '../src/services/rss/frameParser';

// Headlines that were failing in production
const testHeadlines = [
  "The Rippling/Deel corporate spying scandal may have taken another wild...",
  "Fintech firm Marquis alerts dozens of US banks and credit unions of a ...",
  "Capital One To Buy Fintech Startup Brex At Less Than Half Its Peak Val...",
  "Inside Apple's AI Shake-Up and Its Plans for Two New Versions of Siri...",
  "How coal mine waste could power America's next clean energy movement...",
  "How the Australian Open became a tech incubator...",
  "Domain Name Stat: the number of .ai domains has surpassed 1M; data sug...",
  "Turning locked up data into collective knowledge: Supper's agentic dat...",
  "Fintech firm Betterment confirms data breach after hackers send fake c...",
  "Hackers stole over $2.7B in crypto in 2025, data shows...",
  "2026 Demo Day Dates...",
  "The Race to Run Businesses Autonomously: Cofounder by The General Inte...",
  "Abundant Intelligence...",
  "🌎 US' climate retreat leaves a $10bn hole in carbon markets #278...",
];

console.log('🔬 SSOT Parser Validation Tests');
console.log('='.repeat(80));
console.log(`Testing ${testHeadlines.length} headlines that previously failed\n`);

let passed = 0;
let failed = 0;

for (const title of testHeadlines) {
  const frame = parseFrameFromTitle(title);
  
  if (!frame) {
    console.log(`❌ NO FRAME: ${title}`);
    failed++;
    continue;
  }
  
  const event = toCapitalEvent(
    frame, 
    "TechCrunch", 
    `https://example.com/${Date.now()}`, 
    title, 
    new Date().toISOString()
  );
  
  // Truncate title for display
  const displayTitle = title.length > 65 ? title.slice(0, 62) + '...' : title;
  
  console.log(`\n✅ ${displayTitle}`);
  console.log(`   Type: ${event.event_type.padEnd(12)} | Confidence: ${(event.frame_confidence * 100).toFixed(0)}%`);
  console.log(`   Decision: ${event.extraction.decision.padEnd(6)} | Graph Safe: ${event.extraction.graph_safe}`);
  
  if (event.entities.length > 0) {
    console.log(`   Entities: ${event.entities.map(e => `${e.name} [${e.role}]`).join(', ')}`);
  } else {
    console.log(`   Entities: NONE`);
  }
  
  if (event.extraction.filtered_reason) {
    console.log(`   Filtered: ${event.extraction.filtered_reason}`);
  }
  
  passed++;
}

console.log('\n' + '='.repeat(80));
console.log(`📊 Results: ${passed}/${testHeadlines.length} produced events (${((passed/testHeadlines.length)*100).toFixed(1)}%)`);
console.log('='.repeat(80));

if (failed > 0) {
  console.log(`\n⚠️  ${failed} headlines failed to parse - parser needs more patterns`);
} else {
  console.log(`\n🎉 All headlines produced events - parser is working as SSOT!`);
}
