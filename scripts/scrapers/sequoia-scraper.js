#!/usr/bin/env node
/**
 * Sequoia Capital Scraper
 * 
 * Scrapes Sequoia Capital stories and news pages:
 * - Stories: https://sequoiacap.com/stories/
 * - News: https://sequoiacap.com/stories/?_story-category=news
 * 
 * Usage:
 *   node sequoia-scraper.js
 */

require('dotenv').config();
const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const Anthropic = require('@anthropic-ai/sdk').default;
const { insertDiscovered, setSupabase } = require('../../lib/startupInsertGate');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SEQUOIA_URLS = [
  'https://sequoiacap.com/stories/',
  'https://sequoiacap.com/stories/?_story-category=news'
];

async function scrapeSequoiaPage(url) {
  console.log(`\n🔍 Scraping: ${url}`);
  console.log('─'.repeat(60));
  
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(5000);
    
    // Scroll to load more content
    console.log('   📜 Scrolling to load content...');
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(2000);
    }
    
    const textContent = await page.evaluate(() => document.body.innerText);
    console.log(`   📄 Page text: ${textContent.length} chars`);
    
    // First, try to extract company links from DOM
    const companyLinks = await page.evaluate(() => {
      const links = [];
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href');
        const text = a.textContent?.trim() || '';
        // Company website patterns
        if (href && (
          href.startsWith('http') && 
          !href.includes('sequoiacap.com') &&
          !href.includes('linkedin.com') &&
          !href.includes('twitter.com') &&
          !href.includes('github.com') &&
          (text.length > 2 || href.match(/\.(com|io|co|ai|app|dev|tech)$/i))
        )) {
          links.push({ text, href });
        }
      });
      return links.slice(0, 100);
    });
    
    console.log(`   🔗 Found ${companyLinks.length} potential company links in DOM`);
    
    // Extract with Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: `Extract ALL startup companies mentioned in this Sequoia Capital page.

PAGE TEXT (first 60000 chars):
${textContent.slice(0, 60000)}

${companyLinks.length > 0 ? `POTENTIAL COMPANY LINKS FOUND:
${companyLinks.slice(0, 50).map(l => `- "${l.text}" -> ${l.href}`).join('\n')}
` : ''}

CRITICAL: For each company, you MUST extract the website URL if it's visible on the page or in the links above.
Look for:
- Direct website links (http:// or https://)
- Company names that match link text
- Links near company descriptions
- Portfolio company links

Return ONLY valid JSON (no markdown, no code blocks):
{"companies": [{"name": "Company Name", "description": "What they do", "sector": "AI/Fintech/etc", "website": "FULL URL including https:// if found, otherwise null", "funding_stage": "Series A/etc if mentioned"}]}

If you find NO companies, return: {"companies": []}`
      }]
    });
    
    let data;
    try {
      const responseText = response.content[0].text;
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        data = JSON.parse(jsonMatch[0]);
      } else {
        data = { companies: [] };
      }
    } catch (parseError) {
      console.log(`   ⚠️  JSON parse error: ${parseError.message}`);
      data = { companies: [] };
    }
    
    const companies = (data.companies || []).map(c => ({
      ...c,
      source: 'sequoia',
      source_url: url,
      scraped_at: new Date().toISOString()
    }));
    
    console.log(`   ✅ Found ${companies.length} companies`);
    
    await browser.close();
    return companies;
    
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    await browser.close();
    return [];
  }
}

async function saveCompanies(companies) {
  console.log('\n💾 SAVING TO DATABASE');
  console.log('═'.repeat(60));
  
  let saved = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const company of companies) {
    try {
      // Check if already exists
      const { data: existing } = await supabase
        .from('discovered_startups')
        .select('id')
        .ilike('name', company.name)
        .limit(1);
      
      if (existing && existing.length > 0) {
        skipped++;
        continue;
      }
      
      setSupabase(supabase);
      const r = await insertDiscovered({
        name: company.name,
        description: company.description || '',
        website: company.website || null,
        sectors: company.sector ? [company.sector] : ['Technology'],
        funding_stage: company.funding_stage || null,
        rss_source: 'Sequoia Capital',
        article_url: company.source_url,
        article_title: `Sequoia Portfolio: ${company.name}`,
        discovered_at: new Date().toISOString(),
      });

      if (r.ok && !r.skipped) {
        console.log(`   ✅ ${company.name}`);
        saved++;
      } else if (r.ok && r.skipped) {
        skipped++;
      } else {
        if (!r.error?.startsWith('invalid_name:')) {
          console.error(`   ❌ ${company.name}: ${r.error}`);
        }
        errors++;
      }
      
    } catch (err) {
      console.error(`   ❌ ${company.name}: ${err.message}`);
      errors++;
    }
  }
  
  console.log(`\n📊 Results: ${saved} saved, ${skipped} skipped, ${errors} errors`);
  return { saved, skipped, errors };
}

async function main() {
  console.log('🚀 Sequoia Capital Scraper');
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  const allCompanies = [];
  
  for (const url of SEQUOIA_URLS) {
    const companies = await scrapeSequoiaPage(url);
    allCompanies.push(...companies);
    await new Promise(r => setTimeout(r, 3000));
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

