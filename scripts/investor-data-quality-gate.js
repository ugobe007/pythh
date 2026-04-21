#!/usr/bin/env node
/**
 * INVESTOR DATA QUALITY GATE
 * ==========================
 * Validates investor entities before creation and identifies garbage records.
 * 
 * This implements the "Investor Promotion Gate" to prevent creating entities
 * from sentence fragments, article titles, and other non-investor text.
 * 
 * Usage:
 *   node scripts/investor-data-quality-gate.js --validate <investor_data>
 *   node scripts/investor-data-quality-gate.js --cleanup-db
 *   node scripts/investor-data-quality-gate.js --quarantine
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { isGarbageInvestorName } = require('../lib/investorNameHeuristics');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================================================================
// VALIDATION RULES
// ============================================================================

// Article/metadata prefixes to strip
const ARTICLE_PREFIXES = [
  /^article\s+/i,
  /^min\s+read/i,
  /^day\s+ago\s+/i,
  /^how\s+/i,
  /^why\s+/i,
  /^what\s+/i,
  /^\d+\s+min\s+read/i,
];

// Job titles that indicate non-investor context
const JOB_TITLES = [
  /Managing/i,
  /Senior\s+Finance/i,
  /Senior\s+Research/i,
  /Finance/i,
  /Research/i,
  /Design/i,
  /Operations/i,
  /Policy/i,
  /Council/i,
];

// Firm name suffixes (valid indicators)
const FIRM_SUFFIXES = [
  /Capital$/i,
  /Ventures$/i,
  /Partners$/i,
  /Fund$/i,
  /Investments$/i,
  /Group$/i,
  /Equity$/i,
  /Holdings$/i,
];

// Funding verbs (indicate investment context)
const FUNDING_VERBS = [
  'backed',
  'led',
  'invested',
  'participated',
  'round',
  'seed',
  'series',
  'funding',
  'raised',
  'closed',
];

// Stopwords that indicate garbage
const STOPWORDS = [
  'and',
  'or',
  'but',
  'the',
  'a',
  'an',
  'as',
  'with',
  'for',
  'to',
  'of',
  'in',
  'on',
  'at',
  'by',
  'from',
];

// Known legitimate firm names (to reduce false positives)
const KNOWN_FIRM_NAMES = new Set([
  // Well-known VC firms (abbreviations and full names)
  'a16z', 'andreessen horowitz', 'andreesen horowitz',
  '500 startups', '500 global',
  'y combinator', 'yc',
  'sequoia capital', 'sequoia',
  'accel', 'accel partners',
  'greylock', 'greylock partners',
  'benchmark', 'benchmark capital',
  'first round', 'firstround', 'first round capital',
  'lightspeed', 'lightspeed venture partners',
  'kleiner perkins', 'kp', 'kleiner perkins caufield byers',
  'nea', 'new enterprise associates',
  'bessemer', 'bessemer venture partners',
  'insight partners', 'insight',
  'tiger global', 'tiger',
  'softbank', 'softbank vision fund',
  'general catalyst',
  'index ventures', 'index',
  'redpoint', 'redpoint ventures',
  'matrix partners', 'matrix',
  'spark capital', 'spark',
  'union square ventures', 'usv',
  'founders fund',
  'thrive capital', 'thrive',
  'coatue',
  'd1 capital',
  'gv', 'google ventures',
  'microsoft ventures',
  'salesforce ventures',
  'intel capital',
  'corporate venture capital', 'cvc',
  
  // Angel groups
  'angellist', 'angel list',
  'syndicate',
  'super angel',
  
  // Accelerators
  'techstars',
  'masschallenge',
  'startx',
  'alchemist',
  'er accelerator',
  
  // Numbers + common patterns (legitimate firms)
  '122west ventures',
  '1up ventures',
  '406 ventures',
  '645 ventures',
  '25madison',
]);

// Known legitimate investor patterns
const KNOWN_INVESTOR_PATTERNS = [
  /^[A-Z][a-z]+\s+[A-Z][a-z]+$/i, // First Last
  /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+\([^)]+\)$/i, // First Last (Firm)
  /^[A-Z][a-z]+\s+[A-Z][a-z]+\s+@\s+[A-Z]/i, // First Last @ Firm
];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Strip article metadata prefixes
 */
function stripArticlePrefixes(text) {
  let cleaned = text.trim();
  for (const prefix of ARTICLE_PREFIXES) {
    cleaned = cleaned.replace(prefix, '').trim();
  }
  return cleaned;
}

/**
 * Check if text contains job titles (non-investor context)
 */
function hasJobTitle(text) {
  return JOB_TITLES.some(pattern => pattern.test(text));
}

/**
 * Check if text has firm suffix
 */
function hasFirmSuffix(text) {
  return FIRM_SUFFIXES.some(pattern => pattern.test(text));
}

/**
 * Check if text has proper name (capitalized tokens)
 */
function hasProperName(text) {
  const tokens = text.trim().split(/\s+/);
  const capitalized = tokens.filter(t => /^[A-Z]/.test(t));
  return capitalized.length >= 2;
}

/**
 * Check if text matches known investor pattern
 */
function matchesKnownPattern(text) {
  return KNOWN_INVESTOR_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Check if text contains funding verb (in context)
 */
function hasFundingContext(text, context = '') {
  const combined = `${text} ${context}`.toLowerCase();
  return FUNDING_VERBS.some(verb => combined.includes(verb));
}

/**
 * Check if text starts with stopword
 */
function startsWithStopword(text) {
  const firstWord = text.trim().split(/\s+/)[0]?.toLowerCase();
  return STOPWORDS.includes(firstWord);
}

/**
 * Check if text is a known firm name
 */
function isKnownFirmName(text) {
  const normalized = text.toLowerCase().trim();
  return KNOWN_FIRM_NAMES.has(normalized) || 
         Array.from(KNOWN_FIRM_NAMES).some(firm => normalized.includes(firm) || firm.includes(normalized));
}

/**
 * Check if text is a sentence fragment
 */
function isSentenceFragment(text) {
  const cleaned = stripArticlePrefixes(text);
  
  // Known firm names are never fragments
  if (isKnownFirmName(cleaned)) return false;
  
  // Too short
  if (cleaned.length < 3) return true;
  
  // Starts with stopword and no firm suffix
  if (startsWithStopword(cleaned) && !hasFirmSuffix(cleaned)) {
    return true;
  }
  
  // No proper name and no firm suffix
  if (!hasProperName(cleaned) && !hasFirmSuffix(cleaned)) {
    return true;
  }
  
  return false;
}

/**
 * Check if text is article/metadata leakage
 */
function isArticleMetadata(text) {
  return ARTICLE_PREFIXES.some(pattern => pattern.test(text));
}

/**
 * Check if text is role-based hallucination
 */
function isRoleBasedHallucination(text) {
  if (!hasJobTitle(text)) return false;
  
  // If it has a job title but no funding verb, it's likely a hallucination
  return !hasFundingContext(text);
}

/**
 * Check if text is firm-name echo without investor context
 */
function isFirmEcho(text, context = '') {
  // Patterns like "founded Greylock (Greylock)"
  if (/founded\s+[A-Z]+\s*\([A-Z]+\)/i.test(text)) return true;
  if (/with\s+his\s+founding\s*\([A-Z]+\)/i.test(text)) return true;
  
  // No funding verb nearby
  if (!hasFundingContext(text, context)) {
    // Check if it's just a firm name repeated
    const match = text.match(/\(([^)]+)\)/);
    if (match && text.includes(match[1])) {
      return true;
    }
  }
  
  return false;
}

/**
 * Investor Promotion Gate
 * Returns { valid: boolean, reason: string, confidence: number }
 */
function validateInvestorEntity(name, firm = null, context = '', sourceUrl = '') {
  const cleanedName = stripArticlePrefixes(name);

  if (isGarbageInvestorName(cleanedName)) {
    return {
      valid: false,
      reason: 'name_heuristic_junk',
      confidence: 0.05,
      message: 'Name matches headline/team-page junk heuristics (titles, concat, program tags)',
    };
  }

  // Failure Mode 1: Sentence fragment
  if (isSentenceFragment(cleanedName)) {
    return {
      valid: false,
      reason: 'sentence_fragment',
      confidence: 0.1,
      message: 'Text appears to be a sentence fragment, not an investor name'
    };
  }
  
  // Failure Mode 2: Article/metadata leakage
  if (isArticleMetadata(name)) {
    return {
      valid: false,
      reason: 'article_metadata',
      confidence: 0.2,
      message: 'Text contains article metadata prefixes'
    };
  }
  
  // Failure Mode 3: Role-based hallucination
  if (isRoleBasedHallucination(cleanedName)) {
    return {
      valid: false,
      reason: 'role_based_hallucination',
      confidence: 0.3,
      message: 'Text contains job titles without investment context'
    };
  }
  
  // Failure Mode 4: Firm-name echo
  if (isFirmEcho(cleanedName, context)) {
    return {
      valid: false,
      reason: 'firm_echo',
      confidence: 0.4,
      message: 'Text appears to be biographical, not an investment event'
    };
  }
  
  // Special case: Known firm names get automatic pass (high confidence)
  if (isKnownFirmName(cleanedName)) {
    return {
      valid: true,
      reason: 'known_firm',
      confidence: 0.9,
      message: 'Known firm name - automatically validated'
    };
  }
  
  // Promotion Gate: Require at least 2 of 4
  let score = 0;
  const reasons = [];
  
  // 1. Canonical name OR known firm name
  if (matchesKnownPattern(cleanedName) || hasProperName(cleanedName) || isKnownFirmName(cleanedName)) {
    score++;
    reasons.push('canonical_name');
  }
  
  // 2. Context verb
  if (hasFundingContext(cleanedName, context)) {
    score++;
    reasons.push('funding_context');
  }
  
  // 3. Source alignment (portfolio page, funding article, startup site)
  const isPortfolioPage = /portfolio|investments|companies/i.test(sourceUrl);
  const isFundingArticle = /funding|raised|round|seed|series/i.test(sourceUrl);
  const isStartupSite = /\.com|\.io|\.ai/.test(sourceUrl);
  if (isPortfolioPage || isFundingArticle || isStartupSite) {
    score++;
    reasons.push('source_alignment');
  }
  
  // 4. Cross-reference (would need to check database - simplified here)
  // In production, check if same name appears >= 2 times across sources
  if (firm && hasFirmSuffix(firm)) {
    score++;
    reasons.push('firm_validation');
  }
  
  if (score < 2) {
    return {
      valid: false,
      reason: 'promotion_gate_failed',
      confidence: score * 0.25,
      message: `Failed promotion gate (${score}/4 criteria met). Reasons: ${reasons.join(', ') || 'none'}`
    };
  }
  
  return {
    valid: true,
    reason: 'promoted',
    confidence: 0.5 + (score * 0.125),
    message: `Passed promotion gate (${score}/4 criteria met). Reasons: ${reasons.join(', ')}`
  };
}

// ============================================================================
// DATABASE CLEANUP
// ============================================================================

/**
 * Identify garbage investor records
 */
async function identifyGarbageInvestors() {
  console.log('\n' + '='.repeat(80));
  console.log('🔍 IDENTIFYING GARBAGE INVESTOR RECORDS');
  console.log('='.repeat(80) + '\n');
  
  const { data: investors, error } = await supabase
    .from('investors')
    .select('id, name, firm, url, linkedin_url, bio, sectors, stage')
    .order('name', { ascending: true });
  
  if (error) {
    console.error('❌ Error fetching investors:', error);
    return;
  }
  
  console.log(`📊 Analyzing ${investors.length} investors...\n`);
  
  const garbage = [];
  const valid = [];
  
  for (const investor of investors) {
    const validation = validateInvestorEntity(
      investor.name,
      investor.firm,
      investor.bio || '',
      investor.url || ''
    );
    
    // Additional checks for existing records
    const missingCount = [
      !investor.bio || investor.bio.length < 50,
      !investor.url,
      !investor.linkedin_url,
      !investor.sectors || (Array.isArray(investor.sectors) && investor.sectors.length === 0),
      !investor.stage || (Array.isArray(investor.stage) && investor.stage.length === 0),
    ].filter(Boolean).length;
    
    // Quarantine criteria
    const shouldQuarantine = 
      !validation.valid ||
      (missingCount >= 7 && !investor.url && !investor.linkedin_url && (
        startsWithStopword(investor.name) ||
        isArticleMetadata(investor.name) ||
        isSentenceFragment(investor.name)
      ));
    
    if (shouldQuarantine) {
      garbage.push({
        ...investor,
        validation,
        missingCount,
      });
    } else {
      valid.push(investor);
    }
  }
  
  console.log('📈 RESULTS:');
  console.log(`   Valid investors: ${valid.length} (${(valid.length / investors.length * 100).toFixed(1)}%)`);
  console.log(`   Garbage records: ${garbage.length} (${(garbage.length / investors.length * 100).toFixed(1)}%)`);
  
  console.log('\n🔴 TOP 20 GARBAGE RECORDS:');
  console.log('─'.repeat(80));
  garbage.slice(0, 20).forEach((inv, idx) => {
    console.log(`${(idx + 1).toString().padStart(3)}. ${inv.name}${inv.firm ? ` @ ${inv.firm}` : ''}`);
    console.log(`     Reason: ${inv.validation.reason} | Confidence: ${inv.validation.confidence.toFixed(2)}`);
    console.log(`     Missing: ${inv.missingCount} fields | ID: ${inv.id}`);
    console.log('');
  });
  
  return { garbage, valid };
}

/**
 * Quarantine garbage records
 */
async function quarantineGarbageInvestors(dryRun = true) {
  const { garbage } = await identifyGarbageInvestors();
  
  if (!garbage || garbage.length === 0) {
    console.log('✅ No garbage records found');
    return;
  }
  
  console.log(`\n${dryRun ? '🔍 DRY RUN' : '🚨 QUARANTINING'} ${garbage.length} garbage records...\n`);
  
  // Create quarantine table if it doesn't exist
  if (!dryRun) {
    const { error: createError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS investor_mentions_raw (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          original_investor_id UUID REFERENCES investors(id),
          mention_text TEXT NOT NULL,
          firm TEXT,
          source_url TEXT,
          validation_reason TEXT,
          validation_confidence NUMERIC,
          missing_count INTEGER,
          quarantined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          original_data JSONB
        );
      `
    }).catch(() => {
      // Table might already exist, that's okay
    });
  }
  
  // Move to quarantine
  let moved = 0;
  for (const record of garbage) {
    if (dryRun) {
      console.log(`   Would quarantine: ${record.name} (${record.id})`);
    } else {
      // Insert into quarantine
      const { error: insertError } = await supabase
        .from('investor_mentions_raw')
        .insert({
          original_investor_id: record.id,
          mention_text: record.name,
          firm: record.firm,
          validation_reason: record.validation.reason,
          validation_confidence: record.validation.confidence,
          missing_count: record.missingCount,
          original_data: record,
        });
      
      if (!insertError) {
        // Delete from investors table
        const { error: deleteError } = await supabase
          .from('investors')
          .delete()
          .eq('id', record.id);
        
        if (!deleteError) {
          moved++;
        }
      }
    }
  }
  
  if (!dryRun) {
    console.log(`\n✅ Quarantined ${moved} records`);
  } else {
    console.log(`\n💡 Run with --execute to actually quarantine these records`);
  }
}

// ============================================================================
// MAIN
// ============================================================================

const args = process.argv.slice(2);

if (args.includes('--cleanup-db') || args.includes('--quarantine')) {
  const dryRun = !args.includes('--execute');
  quarantineGarbageInvestors(dryRun).catch(console.error);
} else if (args.includes('--validate')) {
  // Validate a single investor
  const name = args[args.indexOf('--validate') + 1];
  const firm = args[args.indexOf('--firm') + 1] || null;
  const context = args[args.indexOf('--context') + 1] || '';
  
  if (!name) {
    console.error('Usage: node scripts/investor-data-quality-gate.js --validate "Name" [--firm "Firm"] [--context "context"]');
    process.exit(1);
  }
  
  const result = validateInvestorEntity(name, firm, context);
  console.log('\n' + '='.repeat(80));
  console.log('VALIDATION RESULT');
  console.log('='.repeat(80));
  console.log(`Name: ${name}`);
  if (firm) console.log(`Firm: ${firm}`);
  if (context) console.log(`Context: ${context}`);
  console.log(`\nValid: ${result.valid ? '✅ YES' : '❌ NO'}`);
  console.log(`Reason: ${result.reason}`);
  console.log(`Confidence: ${result.confidence.toFixed(2)}`);
  console.log(`Message: ${result.message}`);
  console.log('');
} else {
  identifyGarbageInvestors().catch(console.error);
}

// Export validation function for use in other scripts
module.exports = {
  validateInvestorEntity,
  isKnownFirmName,
  stripArticlePrefixes,
  isSentenceFragment,
  isArticleMetadata,
  isRoleBasedHallucination,
  isFirmEcho,
};

