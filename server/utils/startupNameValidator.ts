/**
 * Startup Name Validator
 * Validates startup names to prevent junk entries like "Weekly Firgun"
 * 
 * Usage:
 *   import { isValidStartupName } from './utils/startupNameValidator';
 *   if (!isValidStartupName(name)) {
 *     throw new Error('Invalid startup name');
 *   }
 */

// Patterns that indicate junk names (from RSS scraping, article titles, etc.)
const JUNK_PATTERNS = [
  // Article title patterns
  /^Weekly\s+/i,                    // "Weekly Firgun", "Weekly Roundup"
  /^Daily\s+/i,                     // "Daily Digest"
  /^Monthly\s+/i,                    // "Monthly Report"
  /^This\s+Week/i,                   // "This Week in..."
  /^Top\s+\d+/i,                     // "Top 10", "Top 5"
  /^\d+\s+Ways/i,                    // "5 Ways", "10 Ways"
  /^\d+\s+Startups/i,                // "10 Startups"
  /^How\s+/i,                        // "How to...", "How X..."
  /^Why\s+/i,                        // "Why X..."
  /^What\s+/i,                       // "What is..."
  /^The\s+Best/i,                    // "The Best..."
  /^Best\s+/i,                       // "Best of..."
  /^Latest\s+/i,                     // "Latest News"
  /^News\s+/i,                        // "News from..."
  /^Update\s+/i,                     // "Update on..."
  /^Roundup/i,                       // "Roundup of..."
  /^Digest/i,                        // "Digest..."
  /^Highlights/i,                    // "Highlights..."
  /^Summary/i,                       // "Summary..."
  
  // Generic single words (not company names)
  /^(Building|Modern|Inside|Show|Clicks|Click|Wellbeing|Healthcare|Fintech|Tech|AI|ML|SaaS|Data|Digital|Benefits|Tips|MVPs|MVP|Resource|Constraints|Leadership|Transit|Equity|Fusion|Dropout|Moved|Out|In|On|At|For|With|About|From|To|Hard|Invest|Successful|Reinforcement|American|Everything|Researchers|Pur|Please|Fund|Era|With|Competing|Building|Modern|Inside|Tips|Data|Digital|Tech|Build|Every|Equity|Fusion|Dropout|Team|Culture|Updates|Launch|Software|European|Finnish|Swedish|Estonian|Danish|Indian|German|French|British|Transit|Healthcare|Benefits|College|University|Click|Power|Bank|Sandbar|Stand|Wars|Break|Much|Most|Coveted|Golden|Investor|Battlefield|And|Moved|Out|Clicks|SLC|Zork)$/i,
  
  // Article verb patterns
  /\b(raises?|raised|drive|drives|drove|acquires?|acquired|launches?|launched|partnered|secures?|secured|announces?|announced|expands?|expanded|closes?|closed|wins?|won|names?|named|hires?|hired|cuts?|cut|lays?\s+off|layoffs?|files?\s+for|ipo|spac|goes?\s+public)\b/i,
  
  // Location-based patterns (not cleaned properly)
  /\b(based|from|in|at)\s+[A-Z][a-z]+/i,  // "based in NYC", "from London"
  
  // Test/placeholder patterns
  /^test/i,
  /^demo/i,
  /^sample/i,
  /^placeholder/i,
  /^untitled/i,
  /^new startup/i,
  /^startup \d+/i,
  /^temp/i,
  /^draft/i,
  /^pending/i,
  /^unknown/i,
  /^unnamed/i,
  /^n\/a$/i,
  /^tbd$/i,
  
  // Too short or too long
  /^.{0,1}$/,                        // 0-1 characters
  /^.{100,}$/,                       // 100+ characters (likely article title)
  
  // Starts with lowercase (likely article fragment)
  /^[a-z]\s+[a-z]/i,                 // "weekly firgun", "this week"
  
  // Contains common article words
  /\b(article|post|blog|newsletter|email|digest|roundup|summary|highlights|update|announcement)\b/i,
];

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
}

/**
 * Validates a startup name to ensure it's not junk
 * @param name - The startup name to validate
 * @returns ValidationResult with isValid flag and optional reason
 */
export function isValidStartupName(name: string | null | undefined): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { isValid: false, reason: 'empty_or_null' };
  }
  
  const trimmed = name.trim();
  
  // Too short
  if (trimmed.length < 2) {
    return { isValid: false, reason: 'too_short' };
  }
  
  // Too long (likely article title)
  if (trimmed.length > 80) {
    return { isValid: false, reason: 'too_long' };
  }
  
  // Check against junk patterns
  for (const pattern of JUNK_PATTERNS) {
    if (pattern.test(trimmed)) {
      return { isValid: false, reason: `matches_pattern: ${pattern}` };
    }
  }
  
  // All special characters (no alphanumeric)
  if (!/[a-zA-Z0-9]/.test(trimmed)) {
    return { isValid: false, reason: 'no_alphanumeric' };
  }
  
  // Excessive special characters (>50% of name)
  const specialChars = trimmed.match(/[^a-zA-Z0-9\s]/g) || [];
  if (specialChars.length > trimmed.length / 2) {
    return { isValid: false, reason: 'excessive_special_chars' };
  }
  
  // Word count check (too many words = likely article title)
  const wordCount = trimmed.split(/\s+/).filter(w => w.length > 0).length;
  if (wordCount > 8) {
    return { isValid: false, reason: `too_many_words (${wordCount})` };
  }
  
  // Starts with lowercase and has multiple words (article fragment)
  if (wordCount >= 2 && /^[a-z]/.test(trimmed) && !trimmed.includes('.')) {
    return { isValid: false, reason: 'lowercase_phrase' };
  }
  
  // Single word "Weekly" or similar generic terms
  const singleWordLower = trimmed.toLowerCase();
  if (wordCount === 1 && ['weekly', 'daily', 'monthly', 'roundup', 'digest', 'summary', 'update', 'news', 'report'].includes(singleWordLower)) {
    return { isValid: false, reason: 'generic_single_word' };
  }
  
  // Contains "Funding" or "Report" in multi-word names (likely article titles)
  if (wordCount >= 2 && /\b(funding|report|wrap|news|digest|roundup|summary|update|announcement)\b/i.test(trimmed)) {
    return { isValid: false, reason: 'contains_article_keyword' };
  }
  
  return { isValid: true };
}

/**
 * Sanitizes a startup name by removing common prefixes/suffixes
 * This is a best-effort cleanup, but validation should still be used
 */
export function sanitizeStartupName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  
  let cleaned = name.trim();
  
  // Remove "Location-based" prefix
  cleaned = cleaned.replace(/^[A-Za-z][A-Za-z.\s]{0,30}?[- ]based\s+/i, '');
  
  // Remove nationality/regional adjective prefix
  const NATIONALITY_RE = /^(?:norwegian|swedish|finnish|danish|dutch|belgian|swiss|austrian|polish|czech|hungarian|romanian|bulgarian|greek|portuguese|spanish|italian|french|german|british|irish|slovak|slovenian|american|canadian|australian|singaporean|indian|chinese|japanese|korean|taiwanese|thai|vietnamese|indonesian|malaysian|philippine|israeli|turkish|nigerian|kenyan|ghanaian|egyptian|moroccan|emirati|saudi|brazilian|argentinian|chilean|colombian|peruvian|mexican|latvian|lithuanian|estonian|ukrainian|russian|georgian)\s+/i;
  if (NATIONALITY_RE.test(cleaned) && cleaned.replace(NATIONALITY_RE, '').trim().length >= 2) {
    cleaned = cleaned.replace(NATIONALITY_RE, '');
  }
  
  // Remove category + "startup/company/firm" prefix
  cleaned = cleaned.replace(/^(?:[A-Za-z][A-Za-z0-9\-/]+\s+){0,3}(?:startup|company|firm|platform|chipmaker|provider|maker|developer|builder|unicorn|venture)\s+/i, '');
  
  return cleaned.trim();
}
