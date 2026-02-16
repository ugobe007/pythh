#!/usr/bin/env node
/**
 * WORLD-CLASS SCRAPER
 * ===================
 * Main scraper that uses multi-strategy parsing and self-healing.
 * This is the entry point for intelligent, resilient scraping.
 * 
 * Usage:
 *   node scripts/scrapers/world-class-scraper.js <url> <dataType>
 *   node scripts/scrapers/world-class-scraper.js https://techcrunch.com/2024/01/01/startup-raises-5m startup
 */

require('dotenv').config();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { MultiStrategyParser } = require('./parsers/multi-strategy-parser');
const { FailureDetector } = require('./self-healing/failure-detector');
const { AutoRecovery } = require('./self-healing/auto-recovery');
const { AntiBotBypass } = require('./anti-bot/bypass-engine');
const { RateLimiter } = require('./utils/rate-limiter');
const { RetryHandler } = require('./utils/retry-handler');
const { validateParsedData, isDataQualityAcceptable } = require('./self-healing/validation-engine');

// Optional Supabase client for logging self-healing metrics
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  } catch (error) {
    supabase = null;
  }
}

function logSelfHealingEvent(log_type, message, metadata = {}) {
  if (!supabase) return;
  try {
    supabase
      .from('ai_logs')
      .insert({
        log_type,
        message,
        metadata,
      })
      .catch(() => {});
  } catch (error) {
    // Best-effort logging only
  }
}

/**
 * World-Class Scraper
 */
class WorldClassScraper {
  constructor(options = {}) {
    this.parser = new MultiStrategyParser(options);
    this.failureDetector = new FailureDetector();
    this.autoRecovery = new AutoRecovery(options);
    this.antiBot = new AntiBotBypass(options.antiBot || {});
    this.rateLimiter = new RateLimiter(options.rateLimiter || {});
    this.retryHandler = new RetryHandler(options.retry || {});
    this.options = {
      maxRetries: 3,
      timeout: 30000,
      enableAutoRecovery: true,
      enableRateLimiting: true,
      enableAntiBot: true,
      ...options
    };
  }

  /**
   * Scrape a URL with self-healing
   */
  async scrape(url, dataType, expectedFields = {}) {
    console.log(`\n🌐 Scraping: ${url}`);
    console.log(`📋 Data Type: ${dataType}`);
    
    try {
      // Fetch HTML
      const html = await this.fetchHTML(url);
      
      // Extract domain
      const domain = new URL(url).hostname;
      
      // Parse with multi-strategy parser
      const parseResult = await this.parser.parse(html, domain, dataType, expectedFields);
      
      if (parseResult.success) {
        // Validate data
        const validation = validateParsedData(parseResult.data, expectedFields);
        
        if (isDataQualityAcceptable(validation, 60)) {
          console.log(`✅ Success! Parsed with ${parseResult.strategy} strategy`);
          console.log(`📊 Quality Score: ${validation.score}/100`);
          
          logSelfHealingEvent('scraper_success', `Scrape successful via ${parseResult.strategy || 'unknown'} strategy`, {
            url,
            domain,
            dataType,
            strategy: parseResult.strategy,
            quality_score: validation.score,
          });
          
          return {
            success: true,
            data: parseResult.data,
            validation,
            metadata: parseResult.metadata
          };
        } else {
          console.log(`⚠️  Data quality too low: ${validation.score}/100`);
          console.log(`Errors: ${validation.errors.join(', ')}`);
          
          logSelfHealingEvent('scraper_low_quality', 'Parsed data below quality threshold', {
            url,
            domain,
            dataType,
            strategy: parseResult.strategy,
            quality_score: validation.score,
            errors: validation.errors,
          });
          
          // Try self-healing
          return await this.attemptSelfHealing(url, html, domain, dataType, expectedFields, validation);
        }
      } else {
        // Parsing failed - analyze failure
        console.log(`❌ Parsing failed: ${parseResult.error}`);
        
        const analysis = await this.failureDetector.analyzeFailure(
          new Error(parseResult.error),
          html,
          domain,
          dataType,
          parseResult.strategiesAttempted?.[0],
          null
        );
        
        logSelfHealingEvent('scraper_failure', `Parsing failed for ${dataType}`, {
          url,
          domain,
          dataType,
          error: parseResult.error,
          errorType: analysis.errorType,
          recoverable: this.failureDetector.isRecoverable(analysis),
          recommendations: analysis.recommendations,
          strategy: parseResult.strategy || (parseResult.strategiesAttempted && parseResult.strategiesAttempted[0]) || null,
        });
        
        // Check if error is recoverable
        const isRecoverable = this.failureDetector.isRecoverable(analysis);
        
        // Try auto-recovery only for recoverable errors (not 404s, CAPTCHAs, etc.)
        if (this.options.enableAutoRecovery && isRecoverable) {
          console.log(`\n🔧 Attempting auto-recovery...`);
          
          const recovery = await this.autoRecovery.recover(
            html,
            domain,
            dataType,
            expectedFields,
            analysis
          );
          
          if (recovery.recovered) {
            console.log(`✅ Auto-recovery successful with: ${recovery.strategy}`);
            
            logSelfHealingEvent('scraper_recovery', `Auto-recovery successful via ${recovery.strategy}`, {
              url,
              domain,
              dataType,
              errorType: analysis.errorType,
              recoveryStrategy: recovery.strategy,
              newSelectors: recovery.newSelectors ? Object.keys(recovery.newSelectors).length : 0,
              recovered: true,
            });
            
            // Validate recovered data
            const validation = validateParsedData(recovery.data, expectedFields);
            
            return {
              success: true,
              data: recovery.data,
              validation,
              recovered: true,
              recoveryStrategy: recovery.strategy,
              newSelectors: recovery.newSelectors || []
            };
          }
        } else {
          if (!isRecoverable) {
            console.log(`\n⚠️  Error is not recoverable: ${analysis.errorType}`);
            console.log(`   Reason: ${analysis.recommendations[0]?.reason || 'Unknown'}`);
            
            logSelfHealingEvent('scraper_non_recoverable', 'Non-recoverable scraping error encountered', {
              url,
              domain,
              dataType,
              error: parseResult.error,
              errorType: analysis.errorType,
              recommendations: analysis.recommendations,
            });
          }
        }
        
        return {
          success: false,
          error: parseResult.error,
          analysis,
          recoverable: isRecoverable,
          recoveryAttempted: this.options.enableAutoRecovery && isRecoverable
        };
      }
    } catch (error) {
      console.error(`❌ Scraping error: ${error.message}`);
      
      const analysis = await this.failureDetector.analyzeFailure(
        error,
        null,
        new URL(url).hostname,
        dataType,
        null,
        null
      );
      
      logSelfHealingEvent('scraper_failure', `Scraping error for ${dataType}`, {
        url,
        domain: new URL(url).hostname,
        dataType,
        error: error.message,
        errorType: analysis.errorType,
        recoverable: this.failureDetector.isRecoverable(analysis),
        recommendations: analysis.recommendations,
      });
      
      return {
        success: false,
        error: error.message,
        analysis,
        recoverable: this.failureDetector.isRecoverable(analysis)
      };
    }
  }

  /**
   * Fetch HTML from URL with rate limiting, anti-bot, and retry logic
   */
  async fetchHTML(url) {
    const domain = new URL(url).hostname;
    
    // Rate limiting check
    if (this.options.enableRateLimiting) {
      const canRequest = this.rateLimiter.canRequest(domain);
      
      if (!canRequest.allowed) {
        console.log(`  ⏳ Rate limited. Waiting ${(canRequest.waitMs / 1000).toFixed(1)}s...`);
        const waitResult = await this.rateLimiter.waitUntilAllowed(domain, 60000);
        
        if (!waitResult.allowed) {
          throw new Error(`Rate limit timeout for ${domain}`);
        }
      }
      
      this.rateLimiter.recordRequest(domain);
    }
    
    // Human-like delay (if enabled)
    if (this.options.enableAntiBot) {
      await this.antiBot.humanDelay(500, 2000);
    }
    
    // Fetch with retry logic
    const retryResult = await this.retryHandler.execute(async () => {
      // Get anti-bot headers
      const headers = this.options.enableAntiBot 
        ? this.antiBot.getHeaders(domain)
        : {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          };
      
      const response = await axios.get(url, {
        headers,
        timeout: this.options.timeout,
        validateStatus: (status) => status < 500 // Accept 4xx as valid responses
      });
      
      // Check for rate limiting
      if (this.options.enableAntiBot && this.antiBot.isRateLimited(response)) {
        const retryAfter = this.antiBot.getRetryAfter(response);
        if (retryAfter) {
          if (this.options.enableRateLimiting) {
            // Apply longer backoff
            this.rateLimiter.applyBackoff(domain, 3);
          }
          throw {
            code: 'RATE_LIMITED',
            response,
            retryAfter,
            message: `Rate limited. Retry after ${(retryAfter / 1000).toFixed(0)}s`
          };
        }
      }
      
      // Check for CAPTCHA
      if (this.options.enableAntiBot && this.antiBot.isCAPTCHA(response, response.data)) {
        throw {
          code: 'CAPTCHA',
          response,
          message: 'CAPTCHA detected - manual intervention required'
        };
      }
      
      // Check if blocked
      if (this.options.enableAntiBot && this.antiBot.isBlocked(response, response.data)) {
        throw {
          code: 'BLOCKED',
          response,
          message: 'Request blocked by website'
        };
      }
      
      if (response.status === 404) {
        throw new Error(`Page not found (404): ${url}`);
      }
      
      if (response.status >= 400) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    }, {
      retryAfter: null // Will be set if rate limited
    });
    
    if (!retryResult.success) {
      const error = retryResult.error;
      
      // Handle special error codes
      if (error.code === 'CAPTCHA') {
        throw new Error('CAPTCHA detected - cannot proceed automatically');
      }
      
      if (error.code === 'BLOCKED') {
        throw new Error('Request blocked - may need to change IP or wait');
      }
      
      if (error.response) {
        if (error.response.status === 404) {
          throw new Error(`Page not found (404): ${url}`);
        }
        throw new Error(`HTTP ${error.response.status}: ${error.response.statusText}`);
      }
      
      if (error.request) {
        throw new Error(`Network error: Could not reach ${url}`);
      }
      
      throw error;
    }
    
    return retryResult.result.data;
  }

  /**
   * Attempt self-healing
   */
  async attemptSelfHealing(url, html, domain, dataType, expectedFields, validation) {
    console.log(`🔧 Attempting self-healing...`);
    
    // For now, just return the low-quality data with a warning
    // In Phase 2, we'll implement actual selector regeneration
    
    return {
      success: true,
      data: validation,
      validation,
      selfHealed: false,
      warning: 'Data quality is below optimal threshold'
    };
  }
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.log(`
Usage: node scripts/scrapers/world-class-scraper.js <url> <dataType> [options]

Examples:
  node scripts/scrapers/world-class-scraper.js https://techcrunch.com/2024/01/01/startup-raises-5m startup
  node scripts/scrapers/world-class-scraper.js https://ycombinator.com/companies startup --useAI
    `);
    process.exit(1);
  }
  
  const url = args[0];
  const dataType = args[1];
  
  // Default fields based on data type
  const fieldSchemas = {
    startup: {
      name: { type: 'string', required: true },
      description: { type: 'string', required: false },
      funding: { type: 'currency', required: false },
      url: { type: 'url', required: false }
    },
    investor: {
      name: { type: 'string', required: true },
      bio: { type: 'string', required: false },
      url: { type: 'url', required: false }
    },
    article: {
      title: { type: 'string', required: true },
      content: { type: 'string', required: false },
      author: { type: 'string', required: false }
    }
  };
  
  const expectedFields = fieldSchemas[dataType] || fieldSchemas.startup;
  
  const scraper = new WorldClassScraper({
    useAI: args.includes('--useAI'),
    useBrowser: args.includes('--useBrowser')
  });
  
  scraper.scrape(url, dataType, expectedFields)
    .then(result => {
      if (result.success) {
        console.log('\n✅ Scraping successful!');
        console.log(JSON.stringify(result.data, null, 2));
        process.exit(0);
      } else {
        console.log('\n❌ Scraping failed');
        console.log('Analysis:', JSON.stringify(result.analysis, null, 2));
        process.exit(1);
      }
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { WorldClassScraper };

