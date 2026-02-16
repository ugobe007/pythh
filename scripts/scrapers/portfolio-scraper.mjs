#!/usr/bin/env node
/**
 * PORTFOLIO SCRAPER - Multi-Source Startup Discovery
 * ═══════════════════════════════════════════════════
 * Scrapes startup portfolios from accelerators and VCs:
 * 
 * ACCELERATORS:
 *   - Y Combinator (ALL companies, not just recent batches)
 *   - Citris Foundry (Berkeley deep-tech)
 *   - SkyDeck Berkeley
 * 
 * VC PORTFOLIOS:
 *   - Alsop Louie Partners (enterprise, cybersecurity)
 *   - Bee Partners (SaaS, fintech, AI/ML)
 *   - SkyDeck VC Fund
 * 
 * Usage:
 *   node portfolio-scraper.mjs yc           # Y Combinator (all companies)
 *   node portfolio-scraper.mjs citris       # Citris Foundry
 *   node portfolio-scraper.mjs skydeck      # SkyDeck Berkeley
 *   node portfolio-scraper.mjs alsop        # Alsop Louie
 *   node portfolio-scraper.mjs bee          # Bee Partners
 *   node portfolio-scraper.mjs skydeckvc    # SkyDeck VC
 *   node portfolio-scraper.mjs all          # All sources
 *   node portfolio-scraper.mjs test         # Test mode (1 page each)
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';

// Import quality filter (CommonJS module)
const require = createRequire(import.meta.url);
const { isValidStartup, validateStartup, getQualityScore } = require('./quality-filter.js');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SOURCES = {
  yc: {
    name: 'Y Combinator',
    url: 'https://www.ycombinator.com/companies',
    type: 'accelerator',
    priority: 'high'
  },
  citris: {
    name: 'Citris Foundry',
    url: 'https://citrisfoundry.org/portfolio/',
    type: 'accelerator',
    priority: 'high'
  },
  skydeck: {
    name: 'SkyDeck Berkeley',
    url: 'https://skydeck.berkeley.edu/portfolio/',
    type: 'accelerator',
    priority: 'high'
  },
  alsop: {
    name: 'Alsop Louie Partners',
    url: 'https://www.alsop-louie.com/portfolio',
    type: 'vc',
    priority: 'medium'
  },
  bee: {
    name: 'Bee Partners',
    url: 'https://beepartners.vc/portfolio',
    type: 'vc',
    priority: 'medium'
  },
  skydeckvc: {
    name: 'SkyDeck VC',
    url: 'https://skydeck.vc/portfolio',
    type: 'vc',
    priority: 'medium'
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY: CLAUDE EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════

async function extractStartupsWithClaude(text, source, metadata = {}) {
  // Limit text to avoid hitting context limits
  const maxChars = 30000;
  const truncatedText = text.slice(0, maxChars);
  
  const prompt = `Extract startup companies from this ${source} portfolio page.

IMPORTANT: Return ONLY a JSON array, nothing else. No markdown, no explanations, no code blocks.
Start with [ and end with ]. If you hit token limits, close the array properly with ].

PAGE TEXT:
${truncatedText}

For each startup, extract:
- name (required)
- description (one-line)
- sector (AI/Fintech/Healthcare/Enterprise/Consumer/etc)
- website (URL if visible)
- location (city/country if visible)

Example format (COPY THIS STRUCTURE):
[
  {"name": "Example Inc", "description": "AI platform", "sector": "AI", "website": "https://example.com", "location": "SF"},
  {"name": "Another Co", "description": "Fintech app", "sector": "Fintech"}
]

Return empty array [] if no companies found.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,  // Increased from 8000
      temperature: 0,      // Deterministic output
      messages: [{ role: 'user', content: prompt }]
    });

    let responseText = response.content[0].text.trim();
    
    // Remove markdown code blocks if present
    responseText = responseText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/```\s*$/, '')
      .trim();
    
    // Try to find JSON array
    let jsonMatch = responseText.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      console.log(`   ⚠️  No JSON array found in Claude response`);
      return [];
    }

    let jsonStr = jsonMatch[0];
    
    // Attempt to repair incomplete JSON (common when truncated)
    if (!jsonStr.endsWith(']')) {
      console.log(`   ⚠️  Truncated JSON detected, attempting repair...`);
      
      // Find last complete object
      const lastCompleteObj = jsonStr.lastIndexOf('}');
      if (lastCompleteObj !== -1) {
        jsonStr = jsonStr.substring(0, lastCompleteObj + 1) + ']';
      } else {
        jsonStr = '[]';  // Completely broken, return empty
      }
    }
    
    // Parse the repaired JSON
    const startups = JSON.parse(jsonStr);
    
    if (!Array.isArray(startups)) {
      console.log(`   ⚠️  Response is not an array`);
      return [];
    }

    // Add metadata to each startup
    return startups
      .filter(s => s && s.name)  // Filter out invalid entries
      .map(s => ({
        ...s,
        source: source,
        source_type: SOURCES[source]?.type || 'unknown',
        scraped_at: new Date().toISOString(),
        ...metadata
      }));

  } catch (error) {
    console.error(`   ❌ Claude extraction error: ${error.message}`);
    
    // Show a sample of the response for debugging
    if (error.message.includes('JSON')) {
      console.error(`   📄 Response preview: ${responseText?.substring(0, 200)}...`);
    }
    
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCRAPER: Y COMBINATOR (COMPREHENSIVE)
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeYCombinator(testMode = false) {
  console.log('\n🟠 SCRAPING Y COMBINATOR (ALL COMPANIES)');
  console.log('═'.repeat(60));
  
  const browser = await chromium.launch({ 
    headless: true,
    timeout: 120000 // Increase browser timeout
  });
  const page = await browser.newPage();
  const allStartups = [];
  
  try {
    // YC filters: All companies, sorted by newest
    const baseUrl = 'https://www.ycombinator.com/companies';
    
    console.log(`📍 Loading YC companies page...`);
    
    // Load initial page with longer timeout and less strict wait condition
    try {
      await page.goto(baseUrl, { 
        waitUntil: 'domcontentloaded', // Less strict than 'networkidle'
        timeout: 120000 // 2 minute timeout
      });
      console.log(`   ✅ Page loaded`);
    } catch (error) {
      console.error(`   ❌ Failed to load page: ${error.message}`);
      throw error;
    }
    
    // Wait for initial content to render
    await page.waitForTimeout(5000);
    
    // In test mode, only limited scrolling
    const scrollIterations = testMode ? 3 : 50; // ~50 scrolls = ~4,000 companies
    
    console.log(`\n📜 Scrolling to load companies (${scrollIterations} iterations)...`);
    let lastHeight = 0;
    let unchangedCount = 0;
    
    for (let i = 0; i < scrollIterations; i++) {
      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500); // Wait for content to load
      
      // Check if we've stopped loading new content
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === lastHeight) {
        unchangedCount++;
        if (unchangedCount >= 3) {
          console.log(`   ✅ Reached end of content at iteration ${i + 1}`);
          break;
        }
      } else {
        unchangedCount = 0;
      }
      lastHeight = currentHeight;
      
      // Progress update every 10 scrolls
      if ((i + 1) % 10 === 0) {
        const currentCount = await page.evaluate(() => 
          document.querySelectorAll('a[href^="/companies/"]').length
        );
        console.log(`   📊 Iteration ${i + 1}/${scrollIterations}: ${currentCount} companies found`);
      }
    }
    
    // After scrolling, extract all company data
    console.log(`\n🔍 Extracting company data from DOM...`);
    
    // Extract company cards from DOM
    const companies = await page.evaluate(() => {
      const cards = [];
      
      // YC uses links to company detail pages
      const links = document.querySelectorAll('a[href^="/companies/"]');
      const seen = new Set();
      
      links.forEach(el => {
        const name = el.textContent?.split('\n')[0]?.trim() || '';
        const href = el.getAttribute('href') || '';
        const fullText = el.textContent?.trim() || '';
        
        // Avoid duplicates
        if (name && name.length > 2 && name.length < 100 && !seen.has(name)) {
          seen.add(name);
          
          // Try to extract description from card
          const lines = fullText.split('\n').filter(l => l.trim().length > 10);
          const description = lines[1] || lines[0] || '';
          
          cards.push({ 
            name, 
            href,
            description: description.slice(0, 200)
          });
        }
      });
      
      return cards;
    });
    
    console.log(`   🏢 Found ${companies.length} companies in DOM`);
    
    // Get page text for Claude extraction (first 30k chars)
    const textContent = await page.evaluate(() => document.body.innerText);
    console.log(`   📄 Page text: ${textContent.length} chars`);
    
    // Extract with Claude for better data quality
    console.log(`\n🤖 Extracting startup data with Claude...`);
    const extracted = await extractStartupsWithClaude(textContent, 'yc');
    
    // Use Claude results if available, otherwise fall back to DOM scraping
    const startups = extracted.length > 0 ? extracted : companies.map(c => ({
      name: c.name,
      description: c.description,
      website: c.href.startsWith('http') ? c.href : `https://www.ycombinator.com${c.href}`,
      source: 'yc',
      source_type: 'accelerator',
      scraped_at: new Date().toISOString()
    }));
    
    console.log(`\n✅ Y Combinator: ${startups.length} startups`);
    
    await browser.close();
    return startups;
    
  } catch (error) {
    console.error(`❌ YC scraping error: ${error.message}`);
    try { await browser.close(); } catch {}
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCRAPER: CITRIS FOUNDRY
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeCitris() {
  console.log('\n🔬 SCRAPING CITRIS FOUNDRY (BERKELEY DEEP-TECH)');
  console.log('═'.repeat(60));
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://citrisfoundry.org/portfolio/', { 
      waitUntil: 'networkidle', 
      timeout: 60000 
    });
    
    console.log('   ⏳ Loading portfolio...');
    await page.waitForTimeout(5000);
    
    // Scroll to load all content
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
    }
    
    const textContent = await page.evaluate(() => document.body.innerText);
    console.log(`   📄 Page text: ${textContent.length} chars`);
    
    const startups = await extractStartupsWithClaude(textContent, 'citris');
    
    await browser.close();
    console.log(`\n✅ Citris Foundry: ${startups.length} startups`);
    return startups;
    
  } catch (error) {
    console.error(`❌ Citris error: ${error.message}`);
    try { await browser.close(); } catch {}
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCRAPER: SKYDECK BERKELEY
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeSkydeck() {
  console.log('\n🐻 SCRAPING SKYDECK BERKELEY');
  console.log('═'.repeat(60));
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://skydeck.berkeley.edu/portfolio/', { 
      waitUntil: 'networkidle', 
      timeout: 60000 
    });
    
    console.log('   ⏳ Loading portfolio...');
    await page.waitForTimeout(5000);
    
    // Scroll to load all
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
    }
    
    const textContent = await page.evaluate(() => document.body.innerText);
    console.log(`   📄 Page text: ${textContent.length} chars`);
    
    const startups = await extractStartupsWithClaude(textContent, 'skydeck');
    
    await browser.close();
    console.log(`\n✅ SkyDeck: ${startups.length} startups`);
    return startups;
    
  } catch (error) {
    console.error(`❌ SkyDeck error: ${error.message}`);
    try { await browser.close(); } catch {}
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCRAPER: ALSOP LOUIE PARTNERS
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeAlsop() {
  console.log('\n🔐 SCRAPING ALSOP LOUIE PARTNERS (ENTERPRISE/CYBER)');
  console.log('═'.repeat(60));
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://www.alsop-louie.com/portfolio', { 
      waitUntil: 'networkidle', 
      timeout: 60000 
    });
    
    console.log('   ⏳ Loading portfolio...');
    await page.waitForTimeout(5000);
    
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
    }
    
    const textContent = await page.evaluate(() => document.body.innerText);
    console.log(`   📄 Page text: ${textContent.length} chars`);
    
    const startups = await extractStartupsWithClaude(textContent, 'alsop', {
      investor_focus: 'enterprise, cybersecurity, infrastructure'
    });
    
    await browser.close();
    console.log(`\n✅ Alsop Louie: ${startups.length} startups`);
    return startups;
    
  } catch (error) {
    console.error(`❌ Alsop error: ${error.message}`);
    try { await browser.close(); } catch {}
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCRAPER: BEE PARTNERS
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeBee() {
  console.log('\n🐝 SCRAPING BEE PARTNERS (SAAS/FINTECH/AI)');
  console.log('═'.repeat(60));
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://beepartners.vc/portfolio', { 
      waitUntil: 'networkidle', 
      timeout: 60000 
    });
    
    console.log('   ⏳ Loading portfolio...');
    await page.waitForTimeout(5000);
    
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
    }
    
    const textContent = await page.evaluate(() => document.body.innerText);
    console.log(`   📄 Page text: ${textContent.length} chars`);
    
    const startups = await extractStartupsWithClaude(textContent, 'bee', {
      investor_focus: 'SaaS, fintech, AI/ML'
    });
    
    await browser.close();
    console.log(`\n✅ Bee Partners: ${startups.length} startups`);
    return startups;
    
  } catch (error) {
    console.error(`❌ Bee Partners error: ${error.message}`);
    try { await browser.close(); } catch {}
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SCRAPER: SKYDECK VC
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeSkydeck_VC() {
  console.log('\n🦅 SCRAPING SKYDECK VC');
  console.log('═'.repeat(60));
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto('https://skydeck.vc/portfolio', { 
      waitUntil: 'networkidle', 
      timeout: 60000 
    });
    
    console.log('   ⏳ Loading portfolio...');
    await page.waitForTimeout(5000);
    
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1500);
    }
    
    const textContent = await page.evaluate(() => document.body.innerText);
    console.log(`   📄 Page text: ${textContent.length} chars`);
    
    const startups = await extractStartupsWithClaude(textContent, 'skydeckvc', {
      investor_focus: 'Berkeley-affiliated startups'
    });
    
    await browser.close();
    console.log(`\n✅ SkyDeck VC: ${startups.length} startups`);
    return startups;
    
  } catch (error) {
    console.error(`❌ SkyDeck VC error: ${error.message}`);
    try { await browser.close(); } catch {}
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE: SAVE TO SUPABASE
// ═══════════════════════════════════════════════════════════════════════════

async function saveToDatabase(startups) {
  console.log(`\n💾 Processing ${startups.length} startups...`);
  
  if (startups.length === 0) {
    console.log('   ⚠️  No startups to save');
    return { saved: 0, skipped: 0, rejected: 0 };
  }
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 1: QUALITY FILTERING
  // ═══════════════════════════════════════════════════════════════════════
  console.log('\n🔍 Step 1: Quality Filtering...');
  console.log('   Applying ontological filter to remove junk data');
  console.log('');
  
  const qualityResults = startups.map(startup => ({
    startup,
    validation: validateStartup({
      name: startup.name,
      description: startup.description,
      pitch: startup.pitch,
      website: startup.website,
      sector: startup.sector,
      stage: startup.stage,
      location: startup.location,
      team_size: startup.team_size,
      founded_year: startup.founded_year
    })
  }));
  
  const passed = qualityResults.filter(r => r.validation.isValid);
  const rejected = qualityResults.filter(r => !r.validation.isValid);
  
  // Show rejection reasons
  if (rejected.length > 0) {
    console.log(`   ❌ Rejected ${rejected.length} low-quality entries:`);
    rejected.slice(0, 5).forEach(r => {
      const { startup, validation } = r;
      console.log(`      • ${startup.name} (score: ${validation.scores.overall})`);
      if (validation.flags.looksLikePerson) console.log(`        → Looks like person name`);
      if (validation.flags.hasRedFlags) console.log(`        → Contains red flag keywords`);
    });
    if (rejected.length > 5) {
      console.log(`      ... and ${rejected.length - 5} more`);
    }
    console.log('');
  }
  
  console.log(`   ✅ Passed quality filter: ${passed.length}/${startups.length}`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════
  // STEP 2: DEDUPLICATION & SAVING
  // ═══════════════════════════════════════════════════════════════════════
  console.log('💾 Step 2: Saving to database...');
  
  let saved = 0;
  let skipped = 0;
  
  for (const { startup, validation } of passed) {
    // Check if already exists
    const { data: existing } = await supabase
      .from('discovered_startups')
      .select('id')
      .eq('name', startup.name)
      .limit(1);
    
    if (existing && existing.length > 0) {
      skipped++;
      continue;
    }
    
    // Insert new startup with quality score
    const { error } = await supabase
      .from('discovered_startups')
      .insert({
        name: startup.name,
        description: startup.description || null,
        website: startup.website || null,
        article_url: SOURCES[startup.source]?.url || null,  // Fixed: source_url → article_url
        rss_source: startup.source,  // Fixed: discovered_via → rss_source
        discovered_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error(`   ❌ Error saving ${startup.name}: ${error.message}`);
    } else {
      saved++;
    }
  }
  
  console.log(`   ✅ Saved: ${saved}, Skipped (duplicates): ${skipped}`);
  console.log('');
  
  // ═══════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════
  console.log('📊 QUALITY FILTER SUMMARY:');
  console.log('   ─────────────────────────────────');
  console.log(`   Total processed:    ${startups.length}`);
  console.log(`   Quality passed:     ${passed.length}`);
  console.log(`   Quality rejected:   ${rejected.length}`);
  console.log(`   Saved (new):        ${saved}`);
  console.log(`   Skipped (existing): ${skipped}`);
  console.log('');
  
  return { saved, skipped, rejected: rejected.length };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  const args = process.argv.slice(2);
  const source = args[0] || 'all';
  const testMode = source === 'test';
  
  console.log('\n'.repeat(2));
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║          PORTFOLIO SCRAPER - STARTUP DISCOVERY SYSTEM            ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log(`\n🎯 Mode: ${testMode ? 'TEST (1 page each)' : source.toUpperCase()}`);
  
  const allStartups = [];
  
  try {
    if (source === 'yc' || source === 'all' || testMode) {
      const yc = await scrapeYCombinator(testMode);
      allStartups.push(...yc);
    }
    
    if (source === 'citris' || source === 'all' || testMode) {
      const citris = await scrapeCitris();
      allStartups.push(...citris);
    }
    
    if (source === 'skydeck' || source === 'all' || testMode) {
      const skydeck = await scrapeSkydeck();
      allStartups.push(...skydeck);
    }
    
    if (source === 'alsop' || source === 'all' || testMode) {
      const alsop = await scrapeAlsop();
      allStartups.push(...alsop);
    }
    
    if (source === 'bee' || source === 'all' || testMode) {
      const bee = await scrapeBee();
      allStartups.push(...bee);
    }
    
    if (source === 'skydeckvc' || source === 'all' || testMode) {
      const skydeckvc = await scrapeSkydeck_VC();
      allStartups.push(...skydeckvc);
    }
    
    // Save to database
    const stats = await saveToDatabase(allStartups);
    
    console.log('\n'.repeat(2));
    console.log('╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║                         SCRAPING COMPLETE                         ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝');
    console.log(`\n📊 Total scraped:  ${allStartups.length}`);
    console.log(`💾 Saved to DB:    ${stats.saved}`);
    console.log(`⏭️  Skipped:        ${stats.skipped}`);
    console.log('\n✅ Done!\n');
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
