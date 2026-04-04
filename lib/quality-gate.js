/**
 * QUALITY GATE
 * 
 * Validates startup data before saving to database
 * Prevents garbage names, duplicates, and low-quality entries
 */

class QualityGate {
  /**
   * Validate startup contract before database save
   * Returns { valid: boolean, reason?: string, score: number }
   */
  static validate(contract) {
    // Minimum requirements
    if (!contract.name || contract.name.length < 2) {
      return { valid: false, reason: 'name_too_short', score: 0 };
    }
    
    if (contract.name.length > 100) {
      return { valid: false, reason: 'name_too_long', score: 0 };
    }
    
    // Check for garbage names
    if (this.isGarbageName(contract.name)) {
      return { valid: false, reason: 'garbage_name', score: 0 };
    }
    
    // Check confidence
    if (contract.confidence_scores.overall < 0.3) {
      return { valid: false, reason: 'confidence_too_low', score: contract.confidence_scores.overall };
    }
    
    // Calculate quality score
    let score = 0;
    
    // Name quality (0-30 points)
    if (contract.name && contract.name.length >= 3) {
      score += 20;
      if (this.isValidCompanyName(contract.name)) {
        score += 10;
      }
    }
    
    // Website quality (0-25 points)
    if (contract.website && this.isValidWebsite(contract.website)) {
      score += 25;
    } else if (contract.startup_id) {
      score += 15; // Has domain but no full URL
    }
    
    // Description quality (0-20 points)
    if (contract.one_liner && contract.one_liner.length > 20) {
      score += 20;
    } else if (contract.one_liner && contract.one_liner.length > 10) {
      score += 10;
    }
    
    // Category/Sector (0-15 points)
    if (contract.category && contract.category.length > 0) {
      score += 15;
    }
    
    // Stage (0-10 points)
    if (contract.stage !== null && contract.stage !== undefined) {
      score += 10;
    }
    
    // Minimum quality threshold
    const minScore = 40; // Must have at least name + website OR name + description
    
    if (score < minScore) {
      return { 
        valid: false, 
        reason: 'quality_score_too_low', 
        score,
        minRequired: minScore
      };
    }
    
    return { valid: true, score };
  }
  
  /**
   * Check if name is garbage
   */
  static isGarbageName(name) {
    if (!name) return true;
    
    const lower = name.toLowerCase().trim();
    
    // Known garbage patterns
    const garbagePatterns = [
      'much', 'slc', 'team culture', 'investor updates', 'launches',
      'european', 'software', 'tin can', 'investments', 'battlefield',
      'and', 'coveted', 'startup', 'era', 'sandbar', 'stand', 'wars',
      'break', 'power', 'bank', 'finnish', 'swedish', 'estonian', 'danish',
      'lessons for', 'curate content for', 'powered incident management',
      'venture fund', 'backed group', 'alongside its', 'residence',
      'tactical advice for', 'details and delegation', 'based venture capital',
      'not remain as', 'investing about our', 'events private equity',
      'investors who were', 'run this', 'team of former', 'and joint ventures',
      'investing network for', 'new investor', 'mercury and more',
      'liu view profile', 'assistant', 're former', 'are built by',
      'insights webinar', 'bezos playbook', 'the management', 'from our',
      'access additional capital', 'legal compliance operations',
      'with participation from'
    ];
    
    for (const pattern of garbagePatterns) {
      if (lower.includes(pattern)) return true;
    }
    
    // US states — single word or two-word; extracted from news headlines but never a company
    const US_STATES = new Set([
      'alabama','alaska','arizona','arkansas','california','colorado','connecticut',
      'delaware','florida','georgia','hawaii','idaho','illinois','indiana','iowa',
      'kansas','kentucky','louisiana','maine','maryland','massachusetts','michigan',
      'minnesota','mississippi','missouri','montana','nebraska','nevada',
      'ohio','oklahoma','oregon','pennsylvania','tennessee','texas','utah',
      'vermont','virginia','washington','wisconsin','wyoming',
      // Two-word states (exact match)
      'west virginia','new york','new mexico','new hampshire','new jersey',
      'north carolina','north dakota','south carolina','south dakota',
      'rhode island',
    ]);
    if (US_STATES.has(lower)) return true;

    // Major US cities that slip through as headline subjects
    const US_CITIES = new Set([
      'orlando','atlanta','denver','dallas','houston','chicago','miami','seattle',
      'boston','phoenix','portland','detroit','nashville','memphis','baltimore',
      'milwaukee','minneapolis','cleveland','pittsburgh','cincinnati','sacramento',
      'fresno','tucson','omaha','raleigh','charlotte','richmond','louisville',
      'indianapolis','columbus','kansas city','salt lake city','las vegas',
      'san diego','san jose','san francisco','los angeles','new orleans',
      'jacksonville','tampa','oklahoma city','albuquerque','tucson','aurora',
    ]);
    if (US_CITIES.has(lower)) return true;

    // Well-known non-startup companies that RSS extractors often surface
    const KNOWN_NON_STARTUPS = new Set([
      'grindr','fastly','statista','d-wave','cash app','google pay','apple pay',
      'venmo','zelle','paypal','coinbase','robinhood','chime','stripe',
      'twilio','sendgrid','okta','cloudflare','datadog','newrelic','splunk',
      'elastic','hashicorp','confluent','dbt labs','fivetran','airbyte',
      'databricks','snowflake','palantir','c3.ai','uipath','automation anywhere',
      'servicenow','workday','sap','oracle','salesforce','hubspot','zendesk',
      'intercom','freshworks','zoho','atlassian','jira','confluence',
      'shopify','woocommerce','magento','bigcommerce','squarespace','wix',
    ]);
    if (KNOWN_NON_STARTUPS.has(lower)) return true;

    // Check for generic single words
    const genericWords = new Set([
      'startup', 'company', 'business', 'firm', 'corporation', 'inc',
      'llc', 'ltd', 'group', 'team', 'network', 'platform', 'system',
      'solution', 'service', 'product', 'app', 'application',
      'chef', 'motion', 'signal', 'flow', 'loop', 'bridge', 'canvas',
      'pulse', 'orbit', 'node', 'edge', 'core', 'hub', 'base',
    ]);
    
    const words = lower.split(/\s+/).filter(w => w.length > 2);
    if (words.length === 1 && genericWords.has(words[0])) return true;

    // Phrase fragments: multi-word phrases that are clearly not company names
    if (/\bit also\b|\bit was\b|\bit is\b|\bthey are\b|\bwe are\b/.test(lower)) return true;
    
    // Check for numbers only
    if (/^\d+$/.test(name.trim())) return true;
    
    // Check for too many special characters
    const specialCharRatio = (name.match(/[^a-zA-Z0-9\s]/g) || []).length / name.length;
    if (specialCharRatio > 0.3) return true;
    
    return false;
  }
  
  /**
   * Check if name looks like a valid company name
   */
  static isValidCompanyName(name) {
    if (!name || name.length < 2) return false;
    
    // Must start with capital letter or number
    if (!/^[A-Z0-9]/.test(name)) {
      return false;
    }
    
    // Must have at least one letter
    if (!/[a-zA-Z]/.test(name)) {
      return false;
    }
    
    // Not all caps (unless short acronym)
    if (name.length > 4 && name === name.toUpperCase() && !name.includes(' ')) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Check if website URL is valid
   */
  static isValidWebsite(url) {
    if (!url) return false;
    
    try {
      const { URL } = require('url');
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      
      // Must have valid domain
      if (!parsed.hostname || parsed.hostname.length < 3) {
        return false;
      }
      
      // Must not be localhost or IP
      if (parsed.hostname === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(parsed.hostname)) {
        return false;
      }
      
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Check for duplicates (by name similarity)
   * IMPORTANT: Only matches on company websites, NOT article URLs
   */
  static async checkDuplicate(supabase, contract) {
    if (!contract.name) return { isDuplicate: false };
    
    // Skip duplicate check if website is an article URL (techcrunch.com, medium.com, etc.)
    const articleDomains = ['techcrunch.com', 'medium.com', 'venturebeat.com', 'crunchbase.com', 
                            'axios.com', 'strictlyvc.com', 'avc.com', 'mattermark.com', 'dealroom.com'];
    
    let isArticleUrl = false;
    if (contract.website) {
      const domain = this.extractDomain(contract.website);
      if (domain && articleDomains.some(ad => domain.includes(ad))) {
        isArticleUrl = true; // This is an article URL, not a company website
      } else if (domain) {
        // This is a company website - check domain match
        const { data: domainMatch } = await supabase
          .from('startup_uploads')
          .select('id, name, website')
          .or(`website.ilike.%${domain}%,website.ilike.%www.${domain}%`)
          .limit(1);
        
        if (domainMatch && domainMatch.length > 0) {
          return { isDuplicate: true, matchType: 'domain', existingId: domainMatch[0].id };
        }
      }
    }
    
    // Check exact name match (only if name looks like a real company name)
    if (this.isValidCompanyName(contract.name)) {
      const { data: exact } = await supabase
        .from('startup_uploads')
        .select('id, name')
        .ilike('name', contract.name)
        .limit(1);
      
      if (exact && exact.length > 0) {
        return { isDuplicate: true, matchType: 'exact', existingId: exact[0].id };
      }
    }
    
    return { isDuplicate: false };
  }
  
  static extractDomain(url) {
    try {
      const { URL } = require('url');
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.replace(/^www\./, '').toLowerCase();
    } catch {
      return null;
    }
  }
}

module.exports = QualityGate;

