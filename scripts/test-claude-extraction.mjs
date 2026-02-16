#!/usr/bin/env node
/**
 * TEST CLAUDE EXTRACTION FIX
 * Verify Claude can properly extract startup data without JSON errors
 */

import 'dotenv/config';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Sample HTML content (similar to what scrapers encounter)
const sampleHTML = `
<div class="portfolio">
  <div class="company">
    <h2>Acme AI</h2>
    <p>Building the future of artificial intelligence</p>
    <span>Sector: AI</span>
    <a href="https://acme.ai">Website</a>
  </div>
  <div class="company">
    <h2>FinTech Corp</h2>
    <p>Digital banking for everyone</p>
    <span>Sector: Fintech</span>
    <a href="https://fintechcorp.com">Website</a>
  </div>
  <div class="company">
    <h2>HealthData Inc</h2>
    <p>Healthcare analytics platform</p>
    <span>Sector: Healthcare</span>
  </div>
</div>
`.repeat(20); // Repeat to test large responses

async function testClaudeExtraction() {
  console.log('🧪 TESTING CLAUDE EXTRACTION FIX');
  console.log('═'.repeat(60));
  console.log('');

  const prompt = `Extract startup companies from this portfolio page.

IMPORTANT: Return ONLY a JSON array, nothing else. No markdown, no explanations, no code blocks.
Start with [ and end with ]. If you hit token limits, close the array properly with ].

PAGE TEXT:
${sampleHTML}

For each startup, extract:
- name (required)
- description (one-line)
- sector (AI/Fintech/Healthcare/Enterprise/Consumer/etc)
- website (URL if visible)

Example format (COPY THIS STRUCTURE):
[
  {"name": "Example Inc", "description": "AI platform", "sector": "AI", "website": "https://example.com"},
  {"name": "Another Co", "description": "Fintech app", "sector": "Fintech"}
]

Return empty array [] if no companies found.`;

  try {
    console.log('📤 Sending request to Claude...');
    console.log(`   Input size: ${sampleHTML.length} chars`);
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }]
    });

    let responseText = response.content[0].text.trim();
    console.log(`   Response size: ${responseText.length} chars`);
    console.log('');

    // Remove markdown code blocks if present
    responseText = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '')
      .trim();
    
    // Try to find JSON array
    let jsonMatch = responseText.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      console.error('❌ FAILED: No JSON array found');
      console.log('Response preview:', responseText.substring(0, 500));
      process.exit(1);
    }

    let jsonStr = jsonMatch[0];
    
    // Check if truncated
    if (!jsonStr.endsWith(']')) {
      console.log('⚠️  Truncated JSON detected, attempting repair...');
      
      // Find last complete object
      const lastCompleteObj = jsonStr.lastIndexOf('}');
      if (lastCompleteObj !== -1) {
        jsonStr = jsonStr.substring(0, lastCompleteObj + 1) + ']';
        console.log('   ✅ JSON repaired');
      } else {
        console.error('   ❌ Cannot repair - no complete objects found');
        process.exit(1);
      }
    }
    
    // Parse the JSON
    const startups = JSON.parse(jsonStr);
    
    if (!Array.isArray(startups)) {
      console.error('❌ FAILED: Response is not an array');
      process.exit(1);
    }

    console.log('✅ SUCCESS: JSON parsed correctly!');
    console.log('');
    console.log('📊 RESULTS:');
    console.log('   ─────────────────────────────');
    console.log(`   Startups extracted: ${startups.length}`);
    console.log(`   Valid entries: ${startups.filter(s => s && s.name).length}`);
    console.log('');
    
    // Show first 3 examples
    console.log('   First 3 examples:');
    startups.slice(0, 3).forEach((s, i) => {
      console.log(`   ${i + 1}. ${s.name || '(unnamed)'}`);
      if (s.description) console.log(`      Description: ${s.description}`);
      if (s.sector) console.log(`      Sector: ${s.sector}`);
      if (s.website) console.log(`      Website: ${s.website}`);
    });
    
    console.log('');
    console.log('✅✅✅ CLAUDE EXTRACTION FIX VERIFIED!');
    console.log('');
    console.log('The following improvements were made:');
    console.log('  • Increased max_tokens: 8000 → 16000');
    console.log('  • Added JSON repair for truncated responses');
    console.log('  • Simplified prompt (array instead of object)');
    console.log('  • Better markdown stripping');
    console.log('  • Enhanced error logging');
    console.log('');
    
  } catch (error) {
    console.error('❌ FAILED:', error.message);
    console.error('');
    console.error('Error details:', error);
    process.exit(1);
  }
}

testClaudeExtraction()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
