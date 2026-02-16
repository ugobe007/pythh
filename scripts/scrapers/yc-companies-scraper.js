#!/usr/bin/env node
/**
 * Y Combinator Company Directory Scraper
 * 
 * Scrapes YC company directory pages:
 * - All companies: https://www.ycombinator.com/companies
 * - By batch: https://www.ycombinator.com/companies?batch=Summer%202025
 * - By industry: https://www.ycombinator.com/companies/industry/collaboration
 * 
 * Usage:
 *   node yc-companies-scraper.js                    # Scrape all companies
 *   node yc-companies-scraper.js --batch=Summer2025 # Scrape specific batch
 *   node yc-companies-scraper.js --industry=collaboration # Scrape by industry
 */

require('dotenv').config();
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk').default;

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Anthropic is optional now — only used for enrichment, not extraction
let anthropic;
try {
  anthropic = process.env.ANTHROPIC_API_KEY 
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;
} catch { anthropic = null; }

// URLs to scrape
const YC_URLS = [
  'https://www.ycombinator.com/companies',
  'https://www.ycombinator.com/companies?batch=Summer%202025',
  'https://www.ycombinator.com/companies/industry/collaboration'
];

/**
 * Validate a company name before saving.
 * Returns { valid: true } or { valid: false, reason: string }
 */
function validateCompanyName(name) {
  if (!name || typeof name !== 'string') return { valid: false, reason: 'empty' };
  const trimmed = name.trim();
  if (trimmed.length < 2) return { valid: false, reason: 'too_short' };
  if (trimmed.length > 60) return { valid: false, reason: `too_long_${trimmed.length}` };
  // Batch/season contamination (e.g., "AcmeCo W2024")
  if (/\b(W|S|F|Winter|Summer|Fall|Spring)\s*\d{2,4}\b/i.test(trimmed)) return { valid: false, reason: 'batch_season' };
  // Excessive camelcase (concatenated names like "AcmeCoNextGenPlatform")
  if ((trimmed.match(/[a-z][A-Z]/g) || []).length >= 3) return { valid: false, reason: 'camelcase_concat' };
  // Contains description fragments
  if (/\b(platform for|helps? |enables?|automates?|provides?|delivers?)\b/i.test(trimmed) && trimmed.length > 30) {
    return { valid: false, reason: 'description_fragment' };
  }
  return { valid: true };
}

async function scrapeYCDirectory(url) {
  console.log(`\n🔍 Scraping: ${url}`);
  console.log('─'.repeat(60));
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000); // Wait for dynamic content
    
    // Scroll to load more companies (lazy-loaded)
    console.log('   📜 Scrolling to load all companies...');
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
    }
    
    // ============================================================================
    // PHASE 1: STRUCTURED DOM EXTRACTION (replaces document.body.innerText)
    // Try multiple CSS selector strategies for the YC company directory
    // ============================================================================
    console.log('   🔧 Phase 1: Structured DOM extraction...');
    
    const companies = await page.evaluate(() => {
      const results = [];
      
      // Strategy 1: Look for company card links (YC uses <a> wrappers for company cards)
      // YC directory uses links like /companies/company-slug
      const companyLinks = document.querySelectorAll('a[href^="/companies/"]');
      const processedSlugs = new Set();
      
      for (const link of companyLinks) {
        const href = link.getAttribute('href') || '';
        // Skip non-company links (e.g., /companies?batch=...)
        if (href.includes('?') || href === '/companies' || href === '/companies/') continue;
        
        const slug = href.replace('/companies/', '').split('/')[0];
        if (!slug || processedSlugs.has(slug)) continue;
        processedSlugs.add(slug);
        
        // Extract text from the card element
        const cardText = link.textContent?.trim() || '';
        const lines = cardText.split('\n').map(l => l.trim()).filter(Boolean);
        
        // First non-empty line is usually the company name
        const name = lines[0] || '';
        // Second line is usually the tagline/description
        const description = lines[1] || '';
        // Look for batch info (W2024, S2025, etc.)
        const batchMatch = cardText.match(/\b(W|S|F)\d{4}\b/);
        const batch = batchMatch ? batchMatch[0] : null;
        // Look for location info
        const locationMatch = cardText.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*,\s*[A-Z]{2})/);
        const location = locationMatch ? locationMatch[1] : null;
        
        if (name && name.length >= 2 && name.length <= 60) {
          results.push({ name, description, batch, location, slug });
        }
      }
      
      // Strategy 2: If Strategy 1 found nothing, try generic card selectors
      if (results.length === 0) {
        // Common patterns: divs with class containing "company", "card", "list-item"
        const cardSelectors = [
          '[class*="CompanyCard"]', '[class*="company-card"]', '[class*="companyCard"]',
          '[class*="ycdc-card"]', '[data-company]', '[class*="startup-card"]',
          '.company', '.card', 'li[class*="company"]'
        ];
        
        for (const selector of cardSelectors) {
          const cards = document.querySelectorAll(selector);
          if (cards.length > 5) {
            for (const card of cards) {
              const text = card.textContent?.trim() || '';
              const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
              const name = lines[0] || '';
              const description = lines[1] || '';
              if (name && name.length >= 2 && name.length <= 60) {
                results.push({ name, description, batch: null, location: null, slug: null });
              }
            }
            break; // Stop after first successful selector
          }
        }
      }
      
      return results;
    });
    
    console.log(`   🏢 DOM extraction found ${companies.length} companies`);
    
    // ============================================================================
    // PHASE 2: FALLBACK — Only use Claude if DOM extraction fails
    // ============================================================================
    let finalCompanies = companies;
    
    if (companies.length < 5 && anthropic) {
      console.log('   ⚠️  DOM extraction found < 5 companies, falling back to Claude...');
      
      // Even in fallback, extract structured text per-element instead of body.innerText
      const structuredText = await page.evaluate(() => {
        const elements = [];
        // Get all text nodes that look like company names (short, no HTML)
        document.querySelectorAll('h1, h2, h3, h4, h5, h6, strong, b, [class*="name"], [class*="title"]').forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length >= 2 && text.length <= 80 && !text.includes('<')) {
            elements.push(text);
          }
        });
        return elements.join('\n');
      });
      
      try {
        const response = await Promise.race([
          anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 8000,
            messages: [{
              role: 'user',
              content: `Extract startup company names from this Y Combinator directory page.

STRUCTURED TEXT (extracted from headings and name elements):
${structuredText.slice(0, 15000)}

CRITICAL RULES:
1. Each company name must be a SINGLE entity (2-50 chars)
2. Do NOT concatenate adjacent items
3. Do NOT include batch codes (W2024, S2025), cities, or descriptions in the name
4. If unsure about a name boundary, prefer shorter over longer

Return ONLY valid JSON:
{"companies": [{"name": "Company Name", "description": "One-line description", "sector": "AI/Fintech/etc", "website": null, "location": null, "batch": null}]}`
            }]
          }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('API timeout')), 60000))
        ]);
        
        const responseText = response.content[0].text;
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const data = JSON.parse(jsonMatch[0]);
          finalCompanies = data.companies || [];
        }
      } catch (apiError) {
        console.error(`   ❌ Claude fallback failed: ${apiError.message}`);
      }
    }
    
    // ============================================================================
    // PHASE 3: Name validation — reject bad names before saving
    // ============================================================================
    const validated = [];
    let rejected = 0;
    for (const company of finalCompanies) {
      const check = validateCompanyName(company.name);
      if (check.valid) {
        validated.push({
          ...company,
          source: 'yc_directory',
          source_url: url,
          scraped_at: new Date().toISOString()
        });
      } else {
        rejected++;
        if (rejected <= 10) {
          console.log(`   🚫 Rejected: "${company.name}" — ${check.reason}`);
        }
      }
    }
    if (rejected > 10) console.log(`   🚫 ... and ${rejected - 10} more rejected`);
    
    console.log(`   ✅ ${validated.length} valid companies (${rejected} rejected)`);
    
    await browser.close();
    return validated;
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    try { await browser.close(); } catch {}
    return [];
  }
}

async function saveCompanies(companies) {
  console.log('\n💾 SAVING TO DATABASE');
  console.log('═'.repeat(60));
  
  let saved = 0;
  let skipped = 0;
  let errors = 0;
  
  // BATCH DEDUP: Check all names at once instead of N sequential queries
  const allNames = companies.map(c => c.name.toLowerCase());
  const existingNames = new Set();
  
  // Query in batches of 100 (Supabase .in() limit)
  for (let i = 0; i < allNames.length; i += 100) {
    const batch = allNames.slice(i, i + 100);
    const { data: existing } = await supabase
      .from('discovered_startups')
      .select('name')
      .in('name', batch);
    if (existing) {
      existing.forEach(e => existingNames.add(e.name.toLowerCase()));
    }
  }
  
  console.log(`   📋 Found ${existingNames.size} existing companies (skipping)`);
  
  // Insert only new companies
  const toInsert = [];
  for (const company of companies) {
    if (existingNames.has(company.name.toLowerCase())) {
      skipped++;
      continue;
    }
    
    toInsert.push({
      name: company.name,
      description: company.description || '',
      website: company.website || null,
      sectors: company.sector ? [company.sector] : ['Technology'],
      rss_source: 'Y Combinator Directory',
      article_url: company.source_url,
      article_title: `YC Company: ${company.name}`,
      discovered_at: new Date().toISOString()
    });
  }
  
  // Batch insert in groups of 50
  for (let i = 0; i < toInsert.length; i += 50) {
    const batch = toInsert.slice(i, i + 50);
    const { error } = await supabase
      .from('discovered_startups')
      .insert(batch);
    
    if (error) {
      // Fall back to individual inserts for this batch
      for (const record of batch) {
        const { error: singleErr } = await supabase
          .from('discovered_startups')
          .insert(record);
        if (singleErr) {
          console.error(`   ❌ ${record.name}: ${singleErr.message}`);
          errors++;
        } else {
          console.log(`   ✅ ${record.name}`);
          saved++;
        }
      }
    } else {
      saved += batch.length;
      batch.forEach(r => console.log(`   ✅ ${r.name}`));
    }
  }
  
  console.log(`\n📊 Results: ${saved} saved, ${skipped} skipped, ${errors} errors`);
  return { saved, skipped, errors };
}

async function main() {
  console.log('🚀 Y Combinator Company Directory Scraper');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const allCompanies = [];
  
  for (const url of YC_URLS) {
    try {
      const companies = await scrapeYCDirectory(url);
      if (companies && companies.length > 0) {
        allCompanies.push(...companies);
      }
      // Rate limiting between URLs
      await new Promise(r => setTimeout(r, 3000));
    } catch (error) {
      console.error(`❌ Failed to scrape ${url}: ${error.message}`);
      // Continue to next URL even if one fails
      continue;
    }
  }
  
  // Deduplicate
  const uniqueCompanies = [];
  const seen = new Set();
  for (const company of allCompanies) {
    const key = company.name.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCompanies.push(company);
    }
  }
  
  console.log(`\n📊 Total unique companies: ${uniqueCompanies.length}`);
  
  if (uniqueCompanies.length > 0) {
    await saveCompanies(uniqueCompanies);
  }
}

main().catch(console.error);

