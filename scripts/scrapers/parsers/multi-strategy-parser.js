#!/usr/bin/env node
/**
 * MULTI-STRATEGY PARSER
 * =====================
 * Intelligent parser that tries multiple strategies until one succeeds:
 * 1. CSS Selector (fastest, preferred)
 * 2. AI Parser (intelligent fallback)
 * 3. Pattern Matching (regex/heuristics)
 * 4. Browser Automation (for JS-heavy sites)
 */

const cheerio = require('cheerio');
const { getSelectorDB } = require('../database/selector-db');
const { validateParsedData } = require('../self-healing/validation-engine');

/**
 * Multi-Strategy Parser
 */
class MultiStrategyParser {
  constructor(options = {}) {
    this.options = {
      useAI: true, // Enable AI fallback
      useBrowser: false, // Browser automation (slower, only if needed)
      maxRetries: 3,
      timeout: 30000,
      ...options
    };
    
    this.selectorDB = getSelectorDB();
    this.strategies = [
      'css',
      'json-ld',
      'ai',
      'pattern',
      ...(this.options.useBrowser ? ['browser'] : [])
    ];
  }

  /**
   * Parse data from HTML using multiple strategies
   */
  async parse(html, domain, dataType, fields = {}) {
    const url = `https://${domain}`;
    let lastError = null;

    // Try each strategy in order
    for (const strategy of this.strategies) {
      try {
        console.log(`  🔄 Trying ${strategy} strategy...`);
        
        let result;
        switch (strategy) {
          case 'css':
            result = await this.parseWithCSS(html, domain, dataType, fields);
            break;
          case 'json-ld':
            result = await this.parseWithJSONLD(html, domain, dataType);
            break;
          case 'ai':
            if (this.options.useAI) {
              result = await this.parseWithAI(html, domain, dataType, fields);
            } else {
              continue; // Skip if AI disabled
            }
            break;
          case 'pattern':
            result = await this.parseWithPattern(html, domain, dataType, fields);
            break;
          case 'browser':
            if (this.options.useBrowser) {
              result = await this.parseWithBrowser(url, domain, dataType, fields);
            } else {
              continue; // Skip if browser disabled
            }
            break;
        }

        const validation = result ? validateParsedData(result, fields) : null;

        if (result && validation && validation.valid) {
          // Success! Save selector for future use
          if (strategy === 'css' && result.selector) {
            await this.selectorDB.saveSelector(
              domain,
              dataType,
              result.selector,
              strategy,
              result.field
            );
          }
          
          console.log(`  ✅ Success with ${strategy} strategy`);
          return {
            success: true,
            strategy,
            data: result.data || result,
            metadata: {
              strategy,
              domain,
              dataType,
              timestamp: new Date().toISOString(),
              validation,
            }
          };
        }
      } catch (error) {
        lastError = error;
        console.log(`  ❌ ${strategy} strategy failed: ${error.message}`);
        continue; // Try next strategy
      }
    }

    // All strategies failed
    return {
      success: false,
      error: lastError?.message || 'All parsing strategies failed',
      strategiesAttempted: this.strategies,
      metadata: {
        domain,
        dataType,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Strategy 1: CSS Selector Parsing (fastest)
   */
  async parseWithCSS(html, domain, dataType, fields) {
    const $ = cheerio.load(html);
    
    // Get known selectors from database
    const knownSelectors = await this.selectorDB.getSelectors(domain, dataType);
    
    const result = {};
    
    // Try each field
    for (const [fieldName, fieldConfig] of Object.entries(fields)) {
      const fieldType = typeof fieldConfig === 'string' ? fieldConfig : fieldConfig.type;
      const required = typeof fieldConfig === 'object' ? fieldConfig.required : false;
      
      let value = null;
      
      // Try known selectors first (ordered by success rate)
      for (const knownSelector of knownSelectors.filter(s => s.field === fieldName || s.field === 'general')) {
        try {
          const elements = $(knownSelector.selector);
          if (elements.length > 0) {
            value = this.extractValue(elements, fieldType);
            if (value) {
              result[fieldName] = value;
              result.selector = knownSelector.selector; // Track which selector worked
              result.field = fieldName;
              break; // Found it, move to next field
            }
          }
        } catch (error) {
          // Selector might be invalid, try next one
          continue;
        }
      }
      
      // If not found, try domain-specific selectors first
      if (!value) {
        const domainSpecificSelectors = this.getDomainSpecificSelectors(domain, fieldName, fieldType);
        for (const selector of domainSpecificSelectors) {
          try {
            const elements = $(selector);
            if (elements.length > 0) {
              value = this.extractValue(elements, fieldType);
              if (value) {
                result[fieldName] = value;
                result.selector = selector;
                result.field = fieldName;
                // Save successful selector for future use
                await this.selectorDB.saveSelector(domain, dataType, fieldName, selector, 'css');
                break;
              }
            }
          } catch (error) {
            continue;
          }
        }
      }
      
      // If still not found, try common selectors
      if (!value) {
        const commonSelectors = this.getCommonSelectors(fieldName, fieldType);
        for (const selector of commonSelectors) {
          try {
            const elements = $(selector);
            if (elements.length > 0) {
              value = this.extractValue(elements, fieldType);
              if (value) {
                result[fieldName] = value;
                result.selector = selector;
                result.field = fieldName;
                // Save successful selector for future use
                await this.selectorDB.saveSelector(domain, dataType, fieldName, selector, 'css');
                break;
              }
            }
          } catch (error) {
            continue;
          }
        }
      }
      
      // Special handling for description: try meta tags if not found
      if (!value && fieldName === 'description') {
        const metaDesc = $('meta[name="description"]').attr('content') || 
                        $('meta[property="og:description"]').attr('content');
        if (metaDesc) {
          value = metaDesc.trim();
          result[fieldName] = value;
          result.selector = 'meta[name="description"]';
          result.field = fieldName;
        }
      }
      
      // Special handling for URL: try multiple sources
      if (!value && fieldName === 'url') {
        // Try canonical URL first
        const canonical = $('link[rel="canonical"]').attr('href') ||
                         $('meta[property="og:url"]').attr('content');
        if (canonical && canonical.startsWith('http')) {
          value = canonical;
          result[fieldName] = value;
          result.selector = 'link[rel="canonical"]';
          result.field = fieldName;
        } else {
          // Try to find external links (not YC domain)
          const externalLinks = $('a[href^="http"]').filter((i, el) => {
            const href = $(el).attr('href');
            return href && !href.includes('ycombinator.com');
          });
          if (externalLinks.length > 0) {
            value = externalLinks.first().attr('href');
            result[fieldName] = value;
            result.selector = 'a[href^="http"]:not([href*="ycombinator"])';
            result.field = fieldName;
          }
        }
      }
      
      // If required field is missing, throw error
      if (!value && required) {
        throw new Error(`Required field '${fieldName}' not found`);
      }
      
      result[fieldName] = value;
    }
    
    return result;
  }

  /**
   * Strategy 2: JSON-LD Structured Data
   */
  async parseWithJSONLD(html, domain, dataType) {
    const $ = cheerio.load(html);
    const jsonLdScripts = $('script[type="application/ld+json"]');
    
    const result = {};
    
    jsonLdScripts.each((i, el) => {
      try {
        const jsonLd = JSON.parse($(el).html());
        
        // Handle different JSON-LD types
        if (Array.isArray(jsonLd)) {
          jsonLd.forEach(item => this.extractFromJSONLD(item, result));
        } else {
          this.extractFromJSONLD(jsonLd, result);
        }
      } catch (error) {
        // Invalid JSON, skip
        return;
      }
    });
    
    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Strategy 3: AI Parser (intelligent fallback)
   */
  async parseWithAI(html, domain, dataType, fields) {
    // Check if Anthropic API key is available
    if (!process.env.ANTHROPIC_API_KEY && !process.env.VITE_ANTHROPIC_API_KEY) {
      throw new Error('Anthropic API key not found');
    }

    const { Anthropic } = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ 
      apiKey: process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY 
    });

    // Clean HTML (remove scripts, styles)
    const $ = cheerio.load(html);
    $('script, style, nav, footer, header, aside, iframe, noscript').remove();
    const cleanHtml = $.html().substring(0, 100000); // Limit to ~100KB

    // Build prompt
    const fieldsDescription = Object.entries(fields).map(([name, config]) => {
      const desc = typeof config === 'object' ? config.description || name : config;
      const required = typeof config === 'object' ? config.required : false;
      return `- ${name}: ${desc}${required ? ' (required)' : ''}`;
    }).join('\n');

    const prompt = `You are analyzing the HTML from ${domain} to extract structured data.

EXTRACT THESE FIELDS:
${fieldsDescription}

HTML CONTENT:
${cleanHtml}

Return ONLY valid JSON with the extracted fields. If a field is not found, use null.
Example: {"name": "Company Name", "description": "...", "funding": 5000000}

JSON:`;

    try {
      const response = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const content = response.content[0];
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed;
        }
      }
      
      throw new Error('AI response did not contain valid JSON');
    } catch (error) {
      throw new Error(`AI parsing failed: ${error.message}`);
    }
  }

  /**
   * Strategy 4: Pattern Matching (regex/heuristics)
   */
  async parseWithPattern(html, domain, dataType, fields) {
    const result = {};
    
    // Pattern matching for common fields
    for (const [fieldName, fieldConfig] of Object.entries(fields)) {
      const patterns = this.getPatterns(fieldName, typeof fieldConfig === 'object' ? fieldConfig.type : fieldConfig);
      
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          result[fieldName] = this.cleanValue(match[1], fieldConfig);
          break;
        }
      }
    }
    
    return Object.keys(result).length > 0 ? result : null;
  }

  /**
   * Strategy 5: Browser Automation (for JS-heavy sites)
   */
  async parseWithBrowser(url, domain, dataType, fields) {
    // This would use Puppeteer/Playwright
    // Placeholder for now
    throw new Error('Browser automation not yet implemented');
  }

  // Helper methods

  extractValue(elements, type) {
    if (!elements || elements.length === 0) return null;
    
    switch (type) {
      case 'url':
        // For URLs, prefer href attribute
        const href = elements.first().attr('href');
        if (href && (href.startsWith('http') || href.startsWith('//'))) {
          return href.startsWith('//') ? `https:${href}` : href;
        }
        // Fallback to text if it looks like a URL
        const urlText = elements.first().text().trim();
        if (urlText.match(/^https?:\/\//)) {
          return urlText;
        }
        return href || null;
      case 'number':
      case 'currency':
        const text = elements.first().text().trim();
        const numberMatch = text.match(/[\d,]+/);
        if (numberMatch) {
          return parseInt(numberMatch[0].replace(/,/g, ''));
        }
        // Try to extract from data attributes
        const dataValue = elements.first().attr('data-value') || 
                         elements.first().attr('data-amount');
        if (dataValue) {
          const numMatch = dataValue.match(/[\d,]+/);
          return numMatch ? parseInt(numMatch[0].replace(/,/g, '')) : null;
        }
        return null;
      case 'date':
        const dateText = elements.first().text().trim();
        const dateAttr = elements.first().attr('datetime') || 
                        elements.first().attr('data-date');
        return dateAttr || new Date(dateText).toISOString();
      case 'array':
        return elements.map((i, el) => cheerio.load(el).text().trim()).get();
      default:
        const content = elements.first().text().trim();
        // For description, try to get more text (join multiple paragraphs)
        if (type === 'string' && elements.length > 1) {
          return elements.map((i, el) => cheerio.load(el).text().trim())
                         .get()
                         .filter(t => t.length > 0)
                         .join(' ');
        }
        return content || null;
    }
  }

  /**
   * Get domain-specific selectors (e.g., YC has specific HTML structure)
   */
  getDomainSpecificSelectors(domain, fieldName, type) {
    const domainLower = domain.toLowerCase();
    
    // YC-specific selectors
    if (domainLower.includes('ycombinator.com')) {
      const ycSelectors = {
        name: [
          'h1', 
          '.company-name', 
          '[data-testid="company-name"]',
          'h1.text-2xl',
          '.text-3xl.font-bold'
        ],
        description: [
          '.company-description',
          '[data-testid="company-description"]',
          '.prose p',
          '.markdown p',
          'p:contains("description")',
          '.about p',
          'p.text-gray-600',
          'div[class*="description"] p',
          'article p',
          'main p',
          'p:first-of-type',
          '.content p:first-of-type',
          'div[role="main"] p',
          '.text-lg p'
        ],
        funding: [
          '[data-testid="funding"]',
          '.funding-amount',
          '.raised',
          '.text-2xl.font-bold:contains("$")',
          'div:contains("raised")',
          '[class*="funding"]',
          '.amount'
        ],
        url: [
          'a[href^="http"]:not([href*="ycombinator"])',
          'a.company-website',
          '[data-testid="company-website"]',
          'a[href^="http"]:not([href*="ycombinator.com"])',
          'a:has(.website)',
          '.website-link',
          'a[target="_blank"]',
          'a.external-link',
          'a:contains("website")',
          'a:contains("visit")'
        ],
        stage: [
          '.stage',
          '.batch',
          '[data-testid="batch"]',
          '.yc-batch'
        ],
        sectors: [
          '.tags a',
          '.sectors a',
          '.categories a',
          '[data-testid="sectors"] a'
        ]
      };
      
      return ycSelectors[fieldName] || [];
    }
    
    // Add more domain-specific selectors as needed
    return [];
  }

  getCommonSelectors(fieldName, type) {
    const common = {
      name: [
        'h1', 'h2.title', '.name', '[itemprop="name"]', 'title',
        '.company-name', '.startup-name', '.product-name',
        'h1.company-name', 'h1[class*="name"]'
      ],
      description: [
        'p.description', '.description', '[itemprop="description"]', 
        'meta[name="description"]', '.summary', '.about', '.intro',
        '.tagline', '[class*="description"]', 'p[class*="about"]',
        'div.description', 'section.description',
        'p:first-of-type', // Often first paragraph is description
        'article p:first-of-type',
        '.content p:first-of-type'
      ],
      funding: [
        '.funding', '[data-funding]', '.raised', '.investment',
        '[class*="fund"]', '[class*="raise"]', '.amount-raised',
        '[data-amount]', '[data-valuation]',
        '*:contains("$")', // Any element with dollar sign
        'strong:contains("$")'
      ],
      url: [
        'a[href^="http"]:not([href*="current-domain"])',
        'link[rel="canonical"]',
        'meta[property="og:url"]',
        'meta[property="og:website"]',
        'a.company-url',
        'a[href*="website"]',
        '.website-link',
        'a[target="_blank"]' // Often external links
      ],
      stage: [
        '.stage', '[data-stage]', '[class*="stage"]', '.round'
      ],
      sectors: [
        '.sectors', '.categories', '.tags', '[class*="sector"]',
        '[class*="category"]', '.vertical'
      ]
    };
    
    return common[fieldName] || [`.${fieldName}`, `#${fieldName}`, `[data-${fieldName}]`];
  }

  getPatterns(fieldName, type) {
    const patterns = {
      name: [/<title>(.*?)<\/title>/i, /<h1[^>]*>(.*?)<\/h1>/i],
      description: [/<meta[^>]*name=["']description["'][^>]*content=["'](.*?)["']/i],
      funding: /\$([\d,]+)\s*(?:million|M|billion|B|thousand|K)/i,
      url: /https?:\/\/[^\s<>"]+/gi,
    };
    
    return patterns[fieldName] || [];
  }

  cleanValue(value, config) {
    if (typeof value !== 'string') return value;
    
    const type = typeof config === 'object' ? config.type : config;
    
    if (type === 'number' || type === 'currency') {
      return parseInt(value.replace(/[^0-9]/g, ''));
    }
    
    return value.trim();
  }

  extractFromJSONLD(item, result) {
    if (item['@type']) {
      if (item.name) result.name = item.name;
      if (item.description) result.description = item.description;
      if (item.url) result.url = item.url;
      if (item.fundingAmount) result.funding = item.fundingAmount;
      if (item.foundingDate) result.founded = item.foundingDate;
    }
  }
}

module.exports = { MultiStrategyParser };

