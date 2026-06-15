#!/usr/bin/env node
/**
 * Semantic Context Demo - Test enhanced frame extraction with additive descriptors
 */

import { parseFrameFromTitle } from '../src/services/rss/frameParser';

console.log('🧠 Semantic Context Extraction Demo\n');
console.log('='.repeat(80));

const testHeadlines = [
  "Sam Altman invests in Coco Robotics since they solved the hard problem of fluid motion controls",
  "Julie sets up distribution into Wholefoods stores for Julie's Jelly",
  "Stripe partners with Mastercard after achieving 100M user milestone",
  "OpenAI acquires Rockset following their breakthrough in real-time analytics",
  "YC-backed Metaview raises $7M Series A because founders cracked the hiring interview problem",
  "Revolut launches crypto trading working with Chainlink for price feeds",
  "Databricks Names Ali Ghodsi As CEO post-$43B valuation round",
  "General Catalyst merges with Venture Highway having built complementary portfolios",
];

for (const headline of testHeadlines) {
  console.log(`\n📝 ${headline}`);
  console.log('-'.repeat(80));
  
  const frame = parseFrameFromTitle(headline);
  
  console.log(`🎯 Frame: ${frame.frameType} → ${frame.eventType} (${frame.verbMatched})`);
  console.log(`   Subject: ${frame.slots.subject || 'N/A'}`);
  if (frame.slots.object) console.log(`   Object:  ${frame.slots.object}`);
  if (frame.slots.tertiary) console.log(`   Tertiary: ${frame.slots.tertiary}`);
  if (frame.slots.person) console.log(`   Person:  ${frame.slots.person}`);
  
  if (frame.semantic_context?.length) {
    console.log(`\n   💡 Semantic Context (${frame.semantic_context.length} evidence):`);
    frame.semantic_context.forEach((ev, i) => {
      console.log(
        `      [${i + 1}] ${ev.type}: ${ev.text} (${(ev.confidence * 100).toFixed(0)}%)`
      );
    });
  }
  
  console.log(`   Confidence: ${(frame.meta.confidence * 100).toFixed(0)}%`);
}

console.log('\n' + '='.repeat(80));
console.log('✅ Semantic context extraction operational');
console.log('   • Captures additive descriptors (achievements, problems solved, milestones)');
console.log('   • Extracts tertiary targets (multi-hop patterns)');
console.log('   • Preserves primary verb/action semantics');
