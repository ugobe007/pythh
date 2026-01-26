#!/usr/bin/env node
/**
 * VC Portfolio Scraper - Phase 2
 * 
 * Scrapes VC portfolio pages to discover startups
 * Architecture:
 * 1. Load VC configs with custom selectors
 * 2. Use Puppeteer to scrape portfolio pages
 * 3. Extract company data (name, website, description, logo)
 * 4. Store to discovered_startups table for review
 * 5. Schedule weekly via PM2
 */

require('dotenv').config();
const puppeteer = require('puppeteer');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// VC Portfolio Configurations
// Each VC has custom selectors for their portfolio page structure
const VC_CONFIGS = [
  {
    name: 'Sequoia Capital',
    url: 'https://www.sequoiacap.com/companies/',
    selectors: {
      companyCards: '.company-card, [class*="portfolio-company"]',
      name: 'h3, .company-name, [class*="name"]',
      description: 'p, .company-description, [class*="description"]',
      website: 'a[href]',
      logo: 'img'
    }
  },
  {
    name: 'Andreessen Horowitz (a16z)',
    url: 'https://a16z.com/portfolio/',
    selectors: {
      companyCards: '[class*="portfolio"], [class*="company-card"]',
      name: 'h3, h4, [class*="title"]',
      description: 'p, [class*="description"]',
      website: 'a[href]',
      logo: 'img'
    }
  },
  {
    name: 'Accel',
    url: 'https://www.accel.com/companies',
    selectors: {
      companyCards: '.company, [class*="portfolio-item"]',
      name: 'h3, h4, .name',
      description: 'p, .description',
      website: 'a',
      logo: 'img'
    }
  },
  {
    name: 'Bessemer Venture Partners',
    url: 'https://www.bvp.com/atlas',
    selectors: {
      companyCards: '[class*="company"], [class*="portfolio"]',
      name: 'h3, h4',
      description: 'p',
      website: 'a',
      logo: 'img'
    }
  },
  {
    name: 'Index Ventures',
    url: 'https://www.indexventures.com/portfolio',
    selectors: {
      companyCards: '[class*="company"], [class*="card"]',
      name: 'h3, h4',
      description: 'p',
      website: 'a',
      logo: 'img'
    }
  },
  {
    name: 'Benchmark',
    url: 'https://www.benchmark.com/portfolio/',
    selectors: {
      companyCards: '.portfolio-company, [class*="company"]',
      name: 'h3, .company-name',
      description: 'p, .description',
      website: 'a',
      logo: 'img'
    }
  },
  {
    name: 'Lightspeed Venture Partners',
    url: 'https://lsvp.com/portfolio/',
    selectors: {
      companyCards: '.company, [class*="portfolio"]',
      name: 'h3, h4',
      description: 'p',
      website: 'a',
      logo: 'img'
    }
  },
  {
    name: 'Greylock Partners',
    url: 'https://greylock.com/portfolio/',
    selectors: {
      companyCards: '[class*="company"], [class*="portfolio"]',
      name: 'h3, h4',
      description: 'p',
      website: 'a',
      logo: 'img'
    }
  },
  {
    name: 'NEA',
    url: 'https://www.nea.com/portfolio',
    selectors: {
      companyCards: '.company-card, [class*="portfolio"]',
      name: 'h3, h4',
      description: 'p',
      website: 'a',
      logo: 'img'
    }
  },
  {
    name: 'GGV Capital',
    url: 'https://www.ggvc.com/portfolio/',
    selectors: {
      companyCards: '.portfolio-company, [class*="company"]',
      name: 'h3, h4',
      description: 'p',
      website: 'a',
      logo: 'img'
    }
  }
];

// Metrics tracking
const metrics = {
  vcs_scraped: 0,
  companies_found: 0,
  companies_new: 0,
  companies_existing: 0,
  errors: 0
};

/**
 * Extract website URL from various formats
 */
function extractWebsite(href, baseUrl) {
  if (!href) return null;
  
  // Skip internal links, anchors, mailto
  if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) {
    return null;
  }
  
  // Convert relative URLs to absolute
  if (href.startsWith('/')) {
    const base = new URL(baseUrl);
    return `${base.protocol}//${base.host}${href}`;
  }
  
  // Return as-is if already absolute
  if (href.startsWith('http')) {
    return href;
  }
  
  return null;
}

/**
 * Clean and normalize company name
 */
function cleanName(name) {
  if (!name) return null;
  return name.trim().replace(/\s+/g, ' ').slice(0, 100);
}

/**
 * Scrape a single VC portfolio page
 */
async function scrapeVCPortfolio(vcConfig) {
  console.log(`\n🏢 ${vcConfig.name}`);
  console.log(`   ${vcConfig.url}`);
  
  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set user agent to avoid blocking
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to portfolio page
    await page.goto(vcConfig.url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Extract company data
    const companies = await page.evaluate((selectors) => {
      const results = [];
      
      // Find all company cards
      const cards = document.querySelectorAll(selectors.companyCards);
      
      cards.forEach(card => {
        // Extract name
        const nameEl = card.querySelector(selectors.name);
        const name = nameEl ? nameEl.textContent.trim() : null;
        
        // Extract description
        const descEl = card.querySelector(selectors.description);
        const description = descEl ? descEl.textContent.trim() : null;
        
        // Extract website
        const linkEl = card.querySelector(selectors.website);
        const website = linkEl ? linkEl.href : null;
        
        // Extract logo
        const logoEl = card.querySelector(selectors.logo);
        const logo = logoEl ? logoEl.src : null;
        
        if (name || website) {
          results.push({ name, description, website, logo });
        }
      });
      
      return results;
    }, vcConfig.selectors);
    
    console.log(`   Found ${companies.length} companies`);
    
    // Process and store each company
    let newCount = 0;
    let existingCount = 0;
    
    for (const company of companies) {
      metrics.companies_found++;
      
      // Clean data
      const cleanedName = cleanName(company.name);
      const cleanedWebsite = extractWebsite(company.website, vcConfig.url);
      const cleanedDescription = company.description ? company.description.slice(0, 500) : null;
      
      if (!cleanedName && !cleanedWebsite) continue;
      
      try {
        // Check if company already exists
        let existingQuery = supabase
          .from('discovered_startups')
          .select('id');
        
        if (cleanedWebsite) {
          existingQuery = existingQuery.eq('website', cleanedWebsite);
        } else {
          existingQuery = existingQuery.ilike('name', cleanedName);
        }
        
        const { data: existing } = await existingQuery.single();
        
        if (existing) {
          existingCount++;
          metrics.companies_existing++;
          continue;
        }
        
        // Insert new company
        const { error } = await supabase
          .from('discovered_startups')
          .insert({
            name: cleanedName || 'Unknown',
            description: cleanedDescription,
            website: cleanedWebsite,
            rss_source: `vc-portfolio: ${vcConfig.name}`,
            article_url: vcConfig.url,
            lead_investor: vcConfig.name,
            discovered_at: new Date().toISOString()
          });
        
        if (error) {
          if (!error.message.includes('duplicate key')) {
            console.log(`   ⚠️  Error inserting ${cleanedName}: ${error.message}`);
          }
          existingCount++;
        } else {
          newCount++;
          metrics.companies_new++;
        }
        
      } catch (err) {
        // Silently skip duplicates
        existingCount++;
      }
    }
    
    console.log(`   ✅ New: ${newCount} | Existing: ${existingCount}`);
    metrics.vcs_scraped++;
    
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    metrics.errors++;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * Main scraper function
 */
async function scrapeAllPortfolios() {
  console.log('🚀 VC Portfolio Scraper - Phase 2');
  console.log(`📊 Target: ${VC_CONFIGS.length} VCs`);
  console.log('');
  
  for (const vcConfig of VC_CONFIGS) {
    await scrapeVCPortfolio(vcConfig);
    
    // Rate limit: wait 5 seconds between VCs
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  // Print summary
  console.log('');
  console.log('📊 SUMMARY');
  console.log('='.repeat(60));
  console.log(`VCs Scraped:         ${metrics.vcs_scraped}/${VC_CONFIGS.length}`);
  console.log(`Companies Found:     ${metrics.companies_found}`);
  console.log(`New Companies:       ${metrics.companies_new}`);
  console.log(`Existing Companies:  ${metrics.companies_existing}`);
  console.log(`Errors:              ${metrics.errors}`);
  console.log('');
  
  if (metrics.companies_new > 0) {
    console.log(`🎯 Next steps:`);
    console.log(`  1. Review new companies in discovered_startups table`);
    console.log(`  2. Approve high-quality startups → startup_uploads`);
    console.log(`  3. GOD scoring will run automatically`);
    console.log('');
    console.log(`Expected impact: +${metrics.companies_new} startups this run`);
    console.log(`Weekly impact: ~${metrics.companies_new * 1} startups/week (if run weekly)`);
  }
}

// Run scraper
scrapeAllPortfolios().catch(console.error);
