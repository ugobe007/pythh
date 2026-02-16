/**
 * Tiered Extraction System
 * 
 * Tier 0: Structured sources (RSS, APIs, sitemaps)
 * Tier 1: Lightweight HTML/JSON extraction
 * Tier 2: Browser + AI extraction (using DynamicParser - Parse.bot style)
 * 
 * INTEGRATES:
 * - DynamicParser (lib/dynamic-parser.js) - Your Parse.bot-style dynamic API
 * - Inference Engine - Your intellectual property for gap filling
 */

const { StartupContract, FieldConfidence } = require('./data-contracts');
const { DynamicParser } = require('./dynamic-parser'); // YOUR DYNAMIC API
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * TIER 0: Structured Sources
 */
class Tier0Extractor {
  /**
   * Extract from RSS feed
   * Uses extractCompanyName from simple-rss-scraper.js to extract actual company names
   */
  static async fromRSS(feedUrl, item) {
    const contract = new StartupContract();
    
    // IMPORTANT: Extract company name from title, don't use title directly
    // Use the same extraction logic as simple-rss-scraper.js
    let companyName;
    try {
      const { extractCompanyName } = require('../simple-rss-scraper.js');
      companyName = extractCompanyName(item.title);
    } catch (error) {
      // Fallback to inline extraction
      companyName = this._extractCompanyName(item.title);
    }
    
    if (!companyName) {
      // No company name found in title, skip this item
      return null;
    }
    
    contract.setField('name', companyName, 0.7, {
      source: feedUrl,
      extraction_method: 'rss',
      selector: 'title-extraction'
    });
    
    contract.setField('one_liner', item.contentSnippet || item.description, 0.7, {
      source: feedUrl,
      extraction_method: 'rss',
      selector: 'description'
    });
    
    contract.addEvidence(item.link, item.contentSnippet || item.description);
    
    // Try to extract website from link or content
    const website = this._extractWebsiteFromRSS(item);
    if (website) {
      contract.setField('website', website, 0.9, {
        source: feedUrl,
        extraction_method: 'rss',
        selector: 'link'
      });
      contract.startup_id = this._canonicalizeDomain(website);
    }
    
    return contract;
  }
  
  /**
   * Fallback company name extraction (simplified version)
   */
  static _extractCompanyName(title) {
    if (!title || title.length < 5) return null;
    
    // Strong patterns for funding announcements
    const patterns = [
      // "CompanyName raises $XM"
      /^([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})\s+(?:raises|secures|closes|announces|launches)\s+\$/i,
      // "$XM for CompanyName"
      /\$[\d.]+[MBK]?\s+(?:for|to|in|at)\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,2})/i,
      // "Our investment in CompanyName"
      /(?:our\s+)?investment\s+in\s+([A-Z][a-zA-Z0-9]+(?:\s+[A-Z][a-zA-Z0-9]+){0,3})/i,
    ];
    
    for (const pattern of patterns) {
      const match = title.match(pattern);
      if (match && match[1]) {
        let name = match[1].trim();
        // Remove trailing verbs that may have been captured
        name = name.replace(/\s+(raises?|secures?|lands?|closes?|bags?|launches?|announces?|merges?|acquires?|says?|adds?|calls?|names?).*$/i, '');
        // Remove common English word prefixes
        name = name.replace(/^(?:the|a|an|new|top|big|merge|report|update)\s+/i, '');
        name = name.trim();
        if (name.length >= 3 && name.length <= 50) {
          return name;
        }
      }
    }
    
    return null;
  }
  
  static _extractWebsiteFromRSS(item) {
    // Don't use article URLs as company websites
    // Article domains that should NOT be treated as company websites
    const articleDomains = ['techcrunch.com', 'medium.com', 'venturebeat.com', 'crunchbase.com',
                            'axios.com', 'strictlyvc.com', 'avc.com', 'mattermark.com', 'dealroom.com',
                            'news.ycombinator.com', 'hnrss.org'];
    
    if (!item.link) return null;
    
    // Check if link is an article URL
    const isArticleUrl = articleDomains.some(domain => item.link.includes(domain));
    if (isArticleUrl) {
      // This is an article URL, not a company website
      // Try to extract company website from content instead
      return null;
    }
    
    // If it's not an article URL, it might be a company website
    return item.link;
  }
  
  static _canonicalizeDomain(url) {
    try {
      const { URL } = require('url');
      const parsed = new URL(url);
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return null;
    }
  }
}

/**
 * TIER 1: Lightweight HTML/JSON Extraction
 */
class Tier1Extractor {
  /**
   * Extract from HTML page (no browser)
   */
  static async fromHTML(url) {
    try {
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; HotMatchBot/1.0)'
        }
      });
      
      const $ = cheerio.load(response.data);
      const contract = new StartupContract();
      
      // Extract from OpenGraph
      const ogTitle = $('meta[property="og:title"]').attr('content');
      const ogDescription = $('meta[property="og:description"]').attr('content');
      const ogUrl = $('meta[property="og:url"]').attr('content') || url;
      
      if (ogTitle) {
        contract.setField('name', ogTitle, 0.9, {
          source: url,
          extraction_method: 'html',
          selector: 'og:title'
        });
      }
      
      if (ogDescription) {
        contract.setField('one_liner', ogDescription, 0.8, {
          source: url,
          extraction_method: 'html',
          selector: 'og:description'
        });
      }
      
      contract.setField('website', ogUrl, 0.95, {
        source: url,
        extraction_method: 'html',
        selector: 'og:url'
      });
      contract.startup_id = Tier0Extractor._canonicalizeDomain(ogUrl);
      
      // Extract from schema.org JSON-LD
      const jsonLd = this._extractJSONLD($);
      if (jsonLd) {
        this._mergeJSONLD(contract, jsonLd, url);
      }
      
      // Extract embedded JSON (Next.js, Apollo, etc.)
      const embeddedJSON = this._extractEmbeddedJSON($);
      if (embeddedJSON) {
        this._mergeEmbeddedJSON(contract, embeddedJSON, url);
      }
      
      // Extract category from meta tags
      const category = this._extractCategory($);
      if (category) {
        contract.setField('category', [category], 0.7, {
          source: url,
          extraction_method: 'html',
          selector: 'meta/category'
        });
      }
      
      contract.addEvidence(url, $('body').text().substring(0, 500));
      
      return contract;
    } catch (error) {
      console.error(`Tier1 HTML extraction failed for ${url}:`, error.message);
      return null;
    }
  }
  
  /**
   * Extract JSON-LD structured data
   */
  static _extractJSONLD($) {
    const scripts = $('script[type="application/ld+json"]');
    for (let i = 0; i < scripts.length; i++) {
      try {
        const json = JSON.parse($(scripts[i]).html());
        if (json['@type'] === 'Organization' || json['@type'] === 'Corporation') {
          return json;
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
    return null;
  }
  
  /**
   * Extract embedded JSON (Next.js __NEXT_DATA__, Apollo, etc.)
   */
  static _extractEmbeddedJSON($) {
    const scripts = $('script');
    for (let i = 0; i < scripts.length; i++) {
      const content = $(scripts[i]).html();
      if (!content) continue;
      
      // Try __NEXT_DATA__
      const nextDataMatch = content.match(/__NEXT_DATA__\s*=\s*({[\s\S]*?});/);
      if (nextDataMatch) {
        try {
          return JSON.parse(nextDataMatch[1]);
        } catch (e) {}
      }
      
      // Try Apollo state
      const apolloMatch = content.match(/__APOLLO_STATE__\s*=\s*({[\s\S]*?});/);
      if (apolloMatch) {
        try {
          return JSON.parse(apolloMatch[1]);
        } catch (e) {}
      }
    }
    return null;
  }
  
  /**
   * Merge JSON-LD data into contract
   */
  static _mergeJSONLD(contract, jsonLd, url) {
    if (jsonLd.name && !contract.name) {
      contract.setField('name', jsonLd.name, 0.95, {
        source: url,
        extraction_method: 'json-ld',
        selector: 'name'
      });
    }
    
    if (jsonLd.description && !contract.one_liner) {
      contract.setField('one_liner', jsonLd.description, 0.9, {
        source: url,
        extraction_method: 'json-ld',
        selector: 'description'
      });
    }
    
    if (jsonLd.url && !contract.website) {
      contract.setField('website', jsonLd.url, 0.95, {
        source: url,
        extraction_method: 'json-ld',
        selector: 'url'
      });
      contract.startup_id = Tier0Extractor._canonicalizeDomain(jsonLd.url);
    }
  }
  
  /**
   * Merge embedded JSON data
   */
  static _mergeEmbeddedJSON(contract, json, url) {
    // Extract company info from Next.js props or Apollo state
    // This is source-specific, but general pattern:
    if (json.props?.pageProps?.company) {
      const company = json.props.pageProps.company;
      if (company.name && !contract.name) {
        contract.setField('name', company.name, 0.9, {
          source: url,
          extraction_method: 'embedded-json',
          selector: 'props.pageProps.company.name'
        });
      }
    }
  }
  
  /**
   * Extract category from meta tags or page content
   */
  static _extractCategory($) {
    // Try meta keywords
    const keywords = $('meta[name="keywords"]').attr('content');
    if (keywords) {
      const techKeywords = ['AI', 'SaaS', 'Fintech', 'HealthTech', 'EdTech'];
      for (const keyword of techKeywords) {
        if (keywords.toLowerCase().includes(keyword.toLowerCase())) {
          return keyword;
        }
      }
    }
    return null;
  }
}

/**
 * TIER 2: Browser + Dynamic Parser (YOUR Parse.bot-style API)
 */
class Tier2Extractor {
  /**
   * Extract using DynamicParser (your Parse.bot-style implementation)
   * This uses natural language schemas - no hardcoded selectors!
   */
  static async fromDynamicParser(url, { useBrowser = false } = {}) {
    const contract = new StartupContract();
    const parser = new DynamicParser();
    
    try {
      // Use YOUR DynamicParser with natural language schema
      const schema = {
        description: 'Extract startup information',
        fields: {
          name: 'Company name',
          tagline: 'One-line description or tagline',
          description: 'Full description (max 500 chars)',
          sectors: 'Array of industry sectors',
          stage: 'Funding stage (Pre-Seed, Seed, Series A, etc.)',
          website: 'Company website URL',
          location: 'Headquarters location',
          funding_amount: 'Latest funding amount if mentioned',
          team_size: 'Number of employees if mentioned',
          founders: 'Array of founder names',
          traction: 'Any metrics mentioned (users, revenue, growth)',
        }
      };
      
      console.log(`   🔮 Using DynamicParser (Parse.bot style) for ${url}`);
      const result = await parser.parseAs(url, 'startup');
      
      // Map DynamicParser results to contract
      if (result.name) {
        contract.setField('name', result.name, 0.9, {
          source: url,
          extraction_method: 'dynamic-parser',
          selector: 'natural-language-schema'
        });
      }
      
      if (result.website) {
        contract.setField('website', result.website, 0.95, {
          source: url,
          extraction_method: 'dynamic-parser',
          selector: 'natural-language-schema'
        });
        contract.startup_id = Tier0Extractor._canonicalizeDomain(result.website);
      }
      
      if (result.tagline || result.description) {
        contract.setField('one_liner', result.tagline || result.description?.substring(0, 200), 0.85, {
          source: url,
          extraction_method: 'dynamic-parser',
          selector: 'natural-language-schema'
        });
      }
      
      if (result.sectors && result.sectors.length > 0) {
        contract.setField('category', result.sectors, 0.9, {
          source: url,
          extraction_method: 'dynamic-parser',
          selector: 'natural-language-schema'
        });
      }
      
      if (result.stage) {
        contract.setField('stage', result.stage, 0.8, {
          source: url,
          extraction_method: 'dynamic-parser',
          selector: 'natural-language-schema'
        });
      }
      
      // Add traction signals
      if (result.traction) {
        contract.addTractionSignal(result.traction, url, 0.8);
      }
      
      // Add team signals
      if (result.founders && Array.isArray(result.founders)) {
        result.founders.forEach(founder => {
          contract.addTeamSignal('Founder', null, url, 0.7);
        });
      }
      
      contract.addEvidence(url, JSON.stringify(result).substring(0, 200));
      
      return contract;
    } catch (error) {
      console.error(`DynamicParser extraction failed for ${url}:`, error.message);
      
      // Fallback to browser if DynamicParser fails
      if (useBrowser) {
        return await this._fromBrowser(url);
      }
      
      return null;
    }
  }
  
  /**
   * Fallback: Extract using Playwright (when DynamicParser fails)
   */
  static async _fromBrowser(url) {
    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(2000);
      
      const contract = new StartupContract();
      const html = await page.content();
      const $ = cheerio.load(html);
      
      // Basic extraction from rendered HTML
      const title = await page.title();
      if (title) {
        contract.setField('name', title.split('|')[0].trim(), 0.7, {
          source: url,
          extraction_method: 'browser',
          selector: 'title'
        });
      }
      
      await browser.close();
      return contract;
    } catch (error) {
      await browser.close();
      console.error(`Browser extraction failed for ${url}:`, error.message);
      return null;
    }
  }
  
  /**
   * Merge two contracts (DynamicParser results into base)
   */
  static _mergeContracts(base, dynamic) {
    // Merge fields, preferring higher confidence
    for (const field of ['name', 'website', 'one_liner', 'category', 'stage']) {
      if (dynamic[field] && (!base[field] || dynamic.confidence_scores[field] > base.confidence_scores[field])) {
        base.setField(field, dynamic[field], dynamic.confidence_scores[field], dynamic.provenance);
      }
    }
    
    // Merge signals
    base.traction_signals.push(...dynamic.traction_signals);
    base.team_signals.push(...dynamic.team_signals);
    base.investor_signals.push(...dynamic.investor_signals);
    base.source_evidence.push(...dynamic.source_evidence);
  }
  
  /**
   * Merge two contracts (AI results into base)
   */
  static _mergeContracts(base, ai) {
    // Merge fields, preferring higher confidence
    for (const field of ['name', 'website', 'one_liner', 'category', 'stage']) {
      if (ai[field] && (!base[field] || ai.confidence_scores[field] > base.confidence_scores[field])) {
        base.setField(field, ai[field], ai.confidence_scores[field], ai.provenance);
      }
    }
    
    // Merge signals
    base.traction_signals.push(...ai.traction_signals);
    base.team_signals.push(...ai.team_signals);
    base.investor_signals.push(...ai.investor_signals);
    base.source_evidence.push(...ai.source_evidence);
  }
}

/**
 * Smart extraction router
 * Tries Tier 0 → Tier 1 → Tier 2 (DynamicParser) → Browser fallback
 * 
 * USES YOUR INTELLECTUAL PROPERTY:
 * - DynamicParser (Parse.bot-style natural language schemas)
 * - Inference Engine (for gap filling)
 */
class SmartExtractor {
  static async extract(url, source = 'unknown') {
    // Try Tier 1 first (cheapest)
    let contract = await Tier1Extractor.fromHTML(url);
    
    // If Tier 1 fails or confidence is low, try YOUR DynamicParser (Tier 2)
    if (!contract || contract.confidence_scores.overall < 0.6) {
      console.log(`   ⚠️  Tier 1 confidence low (${contract?.confidence_scores.overall || 0}), trying DynamicParser...`);
      const tier2Contract = await Tier2Extractor.fromDynamicParser(url, {
        useBrowser: contract?.confidence_scores.overall < 0.3 // Only use browser as last resort
      });
      
      if (tier2Contract) {
        if (contract) {
          Tier2Extractor._mergeContracts(contract, tier2Contract);
        } else {
          contract = tier2Contract;
        }
      }
    }
    
    if (contract) {
      contract.provenance.source = source;
    }
    
    return contract;
  }
}

module.exports = {
  Tier0Extractor,
  Tier1Extractor,
  Tier2Extractor,
  SmartExtractor
};

