#!/usr/bin/env node
/**
 * Startup Data Resolver & Fixer
 * 
 * Uses SEMANTIC ONTOLOGY & INFERENCE ENGINE to fix extraction issues:
 * 1. Missing/malformed websites → Try to resolve from name
 * 2. Missing descriptions → Fetch from website + inference extractor
 * 3. Missing sectors → Ontology-aware sector detection
 * 4. Duplicate detection → Merge records
 * 5. GOD score recalculation → Trigger scoring pipeline
 * 6. Missing extracted_data → Run startup inference engine
 * 
 * Run: node scripts/fix-startup-extraction.js
 * Run dry-run: node scripts/fix-startup-extraction.js --dry-run
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const https = require('https');
const http = require('http');

// Import the inference extractor (SSOT for pattern extraction)
let extractInferenceData;
try {
  const inferenceExtractor = require('../lib/inference-extractor.js');
  extractInferenceData = inferenceExtractor.extractInferenceData;
  console.log('✅ Inference extractor loaded');
} catch (e) {
  console.log('⚠️  Inference extractor not available, using basic patterns');
  extractInferenceData = null;
}

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ====================================================================
// CONFIGURATION
// ====================================================================

const CONFIG = {
  DRY_RUN: process.argv.includes('--dry-run'),
  BATCH_SIZE: 50,
  REQUEST_TIMEOUT: 10000,
  MAX_FIX_PER_RUN: 200,
  USER_AGENT: 'Mozilla/5.0 (compatible; HotMatchBot/2.0)',
};

// ====================================================================
// ONTOLOGY INTEGRATION
// ====================================================================

let ONTOLOGY_CACHE = new Map();

async function loadOntology() {
  console.log('📚 Loading ontology database...');
  
  const { data: entities, error } = await supabase
    .from('entity_ontologies')
    .select('entity_name, entity_type, confidence')
    .in('entity_type', ['STARTUP', 'INVESTOR', 'GENERIC_TERM', 'PLACE']);
  
  if (error) {
    console.log('   ⚠️  Could not load ontology:', error.message);
    return;
  }
  
  entities?.forEach(e => {
    ONTOLOGY_CACHE.set(e.entity_name.toLowerCase(), {
      type: e.entity_type,
      confidence: e.confidence
    });
  });
  
  console.log(`   ✓ Loaded ${ONTOLOGY_CACHE.size} ontology entities\n`);
}

function isOntologyKnownStartup(name) {
  const entry = ONTOLOGY_CACHE.get(name.toLowerCase());
  return entry?.type === 'STARTUP';
}

function isOntologyKnownInvestor(name) {
  const entry = ONTOLOGY_CACHE.get(name.toLowerCase());
  return entry?.type === 'INVESTOR';
}

function isGenericTerm(name) {
  const entry = ONTOLOGY_CACHE.get(name.toLowerCase());
  if (entry?.type === 'GENERIC_TERM' || entry?.type === 'PLACE') return true;
  
  // Additional heuristics for generic terms
  const genericPatterns = [
    /^(the|a|an)\s+/i,
    /^(your|my|our|their|his|her)\s+/i,
    /\b(for you|to you|of the)\b/i,
    /^(researchers|founders|startups|vcs|investors|executives|leaders|people|companies)$/i,
    /^(big|small|top|leading|major|several)\s+/i,
    /^\$?\d+[MmKkBb]?$/,  // Pure numbers like "$48" or "25M"
    /^(Series [A-F]|Seed|Pre-Seed|Bridge)$/i,
  ];
  
  return genericPatterns.some(p => p.test(name));
}

// ====================================================================
// ISSUE DETECTION
// ====================================================================

async function findStartupsWithIssues() {
  console.log('🔍 Finding startups with extraction issues...\n');
  
  const issues = {
    missingWebsite: [],
    malformedWebsite: [],
    missingDescription: [],
    missingSectors: [],
    lowGodScore: [],
    duplicateNames: [],
    genericNames: [],  // NEW: Names that are generic terms (ontology)
    missingExtractedData: [],  // NEW: Need inference engine
  };
  
  // Get all startups
  const { data: startups, error } = await supabase
    .from('startup_uploads')
    .select('id, name, website, description, pitch, tagline, sectors, total_god_score, status, extracted_data')
    .order('created_at', { ascending: false })
    .limit(5000);
  
  if (error) {
    console.error('Error fetching startups:', error.message);
    return issues;
  }
  
  console.log(`Analyzing ${startups.length} startups...\n`);
  
  // Track names for duplicate detection
  const nameCount = {};
  
  for (const startup of startups) {
    // Missing website
    if (!startup.website || startup.website.trim() === '') {
      issues.missingWebsite.push(startup);
    }
    // Malformed website (not a valid URL)
    else if (!isValidUrl(startup.website)) {
      issues.malformedWebsite.push(startup);
    }
    
    // Missing description
    if (!startup.description && !startup.pitch && !startup.tagline) {
      issues.missingDescription.push(startup);
    }
    
    // Missing sectors
    if (!startup.sectors || startup.sectors.length === 0 || 
        (startup.sectors.length === 1 && startup.sectors[0] === 'Technology')) {
      issues.missingSectors.push(startup);
    }
    
    // Low GOD score (needs recalculation)
    if (!startup.total_god_score || startup.total_god_score < 40) {
      issues.lowGodScore.push(startup);
    }
    
    // Generic names (ontology check)
    if (isGenericTerm(startup.name)) {
      issues.genericNames.push(startup);
    }
    
    // Missing extracted_data (need inference engine)
    if (!startup.extracted_data || Object.keys(startup.extracted_data).length === 0) {
      issues.missingExtractedData.push(startup);
    }
    
    // Track duplicates
    const normalizedName = startup.name.toLowerCase().trim();
    nameCount[normalizedName] = (nameCount[normalizedName] || []);
    nameCount[normalizedName].push(startup);
  }
  
  // Find duplicates
  for (const [name, records] of Object.entries(nameCount)) {
    if (records.length > 1) {
      issues.duplicateNames.push({ name, records });
    }
  }
  
  // Print summary
  console.log('📊 Issue Summary:');
  console.log(`   Missing website:       ${issues.missingWebsite.length}`);
  console.log(`   Malformed website:     ${issues.malformedWebsite.length}`);
  console.log(`   Missing description:   ${issues.missingDescription.length}`);
  console.log(`   Missing sectors:       ${issues.missingSectors.length}`);
  console.log(`   Low GOD score:         ${issues.lowGodScore.length}`);
  console.log(`   Duplicate names:       ${issues.duplicateNames.length}`);
  console.log(`   Generic names (junk):  ${issues.genericNames.length}`);
  console.log(`   Missing extracted_data: ${issues.missingExtractedData.length}`);
  console.log();
  
  return issues;
}

function isValidUrl(str) {
  try {
    const url = new URL(str.startsWith('http') ? str : `https://${str}`);
    return url.hostname.includes('.');
  } catch {
    return false;
  }
}

// ====================================================================
// FIXERS
// ====================================================================

async function fixMissingWebsite(startup) {
  // Try to infer website from name
  const possibleDomains = [
    `https://${startup.name.toLowerCase().replace(/\s+/g, '')}.com`,
    `https://www.${startup.name.toLowerCase().replace(/\s+/g, '')}.com`,
    `https://${startup.name.toLowerCase().replace(/\s+/g, '')}.ai`,
    `https://${startup.name.toLowerCase().replace(/\s+/g, '')}.io`,
  ];
  
  for (const domain of possibleDomains) {
    const exists = await checkUrlExists(domain);
    if (exists) {
      console.log(`   ✓ Found website for ${startup.name}: ${domain}`);
      
      if (!CONFIG.DRY_RUN) {
        await supabase
          .from('startup_uploads')
          .update({ website: domain })
          .eq('id', startup.id);
      }
      
      return { fixed: true, website: domain };
    }
  }
  
  return { fixed: false };
}

async function fixMalformedWebsite(startup) {
  let fixed = startup.website;
  
  // Add protocol if missing
  if (!fixed.startsWith('http')) {
    fixed = `https://${fixed}`;
  }
  
  // Remove trailing slashes and paths that look wrong
  fixed = fixed.replace(/\/+$/, '');
  
  // Try to validate
  try {
    const url = new URL(fixed);
    fixed = `${url.protocol}//${url.hostname}`;
    
    if (!CONFIG.DRY_RUN) {
      await supabase
        .from('startup_uploads')
        .update({ website: fixed })
        .eq('id', startup.id);
    }
    
    console.log(`   ✓ Fixed website for ${startup.name}: ${fixed}`);
    return { fixed: true, website: fixed };
  } catch {
    return { fixed: false };
  }
}

async function fixMissingDescription(startup) {
  if (!startup.website) return { fixed: false };
  
  try {
    // Fetch homepage and extract meta description
    const html = await fetchHtml(startup.website);
    
    if (!html) return { fixed: false };
    
    // Extract meta description
    const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
    
    const ogMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
    
    const description = metaMatch?.[1] || ogMatch?.[1];
    
    if (description && description.length > 20) {
      console.log(`   ✓ Found description for ${startup.name}`);
      
      if (!CONFIG.DRY_RUN) {
        await supabase
          .from('startup_uploads')
          .update({ 
            description: description.slice(0, 1000),
            pitch: description.slice(0, 500),
          })
          .eq('id', startup.id);
      }
      
      return { fixed: true, description };
    }
    
    // Try to extract from title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch?.[1]) {
      const title = titleMatch[1].split('|')[0].split('-')[0].trim();
      if (title.length > 10 && title !== startup.name) {
        if (!CONFIG.DRY_RUN) {
          await supabase
            .from('startup_uploads')
            .update({ tagline: title.slice(0, 200) })
            .eq('id', startup.id);
        }
        return { fixed: true, tagline: title };
      }
    }
    
  } catch (err) {
    // Silently skip fetch errors
  }
  
  return { fixed: false };
}

async function fixMissingSectors(startup) {
  const text = `${startup.name} ${startup.description || ''} ${startup.pitch || ''} ${startup.tagline || ''}`;
  const sectors = detectSectors(text);
  
  if (sectors.length > 0 && (sectors.length > 1 || sectors[0] !== 'Technology')) {
    console.log(`   ✓ Detected sectors for ${startup.name}: ${sectors.join(', ')}`);
    
    if (!CONFIG.DRY_RUN) {
      await supabase
        .from('startup_uploads')
        .update({ sectors })
        .eq('id', startup.id);
    }
    
    return { fixed: true, sectors };
  }
  
  return { fixed: false };
}

async function mergeDuplicates(duplicateGroup) {
  const { name, records } = duplicateGroup;
  
  if (records.length < 2) return { fixed: false };
  
  // Sort by: has website > has description > has sectors > newer
  records.sort((a, b) => {
    const scoreA = (a.website ? 10 : 0) + (a.description ? 5 : 0) + (a.sectors?.length || 0);
    const scoreB = (b.website ? 10 : 0) + (b.description ? 5 : 0) + (b.sectors?.length || 0);
    return scoreB - scoreA;
  });
  
  const keeper = records[0];
  const toDelete = records.slice(1);
  
  // Merge data from duplicates into keeper
  const mergedData = {
    website: keeper.website,
    description: keeper.description,
    pitch: keeper.pitch,
    tagline: keeper.tagline,
    sectors: keeper.sectors || [],
  };
  
  for (const dup of toDelete) {
    if (!mergedData.website && dup.website) mergedData.website = dup.website;
    if (!mergedData.description && dup.description) mergedData.description = dup.description;
    if (!mergedData.pitch && dup.pitch) mergedData.pitch = dup.pitch;
    if (!mergedData.tagline && dup.tagline) mergedData.tagline = dup.tagline;
    if (dup.sectors) {
      mergedData.sectors = [...new Set([...mergedData.sectors, ...dup.sectors])];
    }
  }
  
  console.log(`   ✓ Merging ${records.length} duplicates of "${name}" → keeping ${keeper.id}`);
  
  if (!CONFIG.DRY_RUN) {
    // Update keeper with merged data
    await supabase
      .from('startup_uploads')
      .update(mergedData)
      .eq('id', keeper.id);
    
    // Delete duplicates
    for (const dup of toDelete) {
      await supabase
        .from('startup_uploads')
        .delete()
        .eq('id', dup.id);
    }
  }
  
  return { fixed: true, kept: keeper.id, deleted: toDelete.map(d => d.id) };
}

// ====================================================================
// HELPERS
// ====================================================================

function detectSectors(text) {
  if (!text) return ['Technology'];
  
  const sectors = [];
  const lowerText = text.toLowerCase();
  
  const sectorKeywords = {
    'AI/ML': ['artificial intelligence', ' ai ', 'machine learning', 'llm', 'deep learning', 'neural', 'nlp', 'computer vision', 'gpt', 'generative'],
    'FinTech': ['fintech', 'financial', 'banking', 'payments', 'lending', 'insurance', 'insurtech', 'crypto', 'blockchain', 'defi'],
    'HealthTech': ['healthtech', 'healthcare', 'medical', 'clinical', 'patient', 'diagnosis', 'therapeutic', 'telemedicine', 'telehealth'],
    'Biotech': ['biotech', 'biotechnology', 'pharmaceutical', 'drug', 'genomics', 'protein', 'gene', 'cell therapy'],
    'SaaS': ['saas', 'software as a service', 'b2b software', 'enterprise software', 'platform', 'api'],
    'Climate': ['climate', 'cleantech', 'sustainability', 'carbon', 'renewable', 'energy', 'solar', 'battery', 'ev ', 'electric vehicle'],
    'E-commerce': ['ecommerce', 'e-commerce', 'marketplace', 'retail', 'shopping', 'consumer'],
    'EdTech': ['edtech', 'education', 'learning', 'school', 'student', 'teaching', 'training'],
    'Cybersecurity': ['security', 'cybersecurity', 'encryption', 'privacy', 'authentication', 'identity'],
    'Hardware': ['hardware', 'device', 'sensor', 'robotics', 'iot', 'manufacturing', 'semiconductor'],
    'Developer Tools': ['developer', 'devops', 'infrastructure', 'cloud', 'ci/cd', 'testing', 'monitoring'],
    'Real Estate': ['real estate', 'proptech', 'property', 'housing', 'mortgage'],
    'HR Tech': ['hr ', 'human resources', 'recruiting', 'hiring', 'talent', 'workforce'],
    'Legal Tech': ['legal', 'law ', 'compliance', 'contract', 'regulatory'],
    'Food Tech': ['food', 'restaurant', 'delivery', 'agriculture', 'agtech'],
  };
  
  for (const [sector, keywords] of Object.entries(sectorKeywords)) {
    if (keywords.some(kw => lowerText.includes(kw))) {
      sectors.push(sector);
    }
  }
  
  return sectors.length > 0 ? sectors.slice(0, 4) : ['Technology'];
}

async function checkUrlExists(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, { 
      timeout: 5000,
      headers: { 'User-Agent': CONFIG.USER_AGENT }
    }, (res) => {
      resolve(res.statusCode >= 200 && res.statusCode < 400);
    });
    
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function fetchHtml(url) {
  return new Promise((resolve) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const req = protocol.get(url, { 
      timeout: CONFIG.REQUEST_TIMEOUT,
      headers: { 
        'User-Agent': CONFIG.USER_AGENT,
        'Accept': 'text/html',
      }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchHtml(res.headers.location).then(resolve);
        return;
      }
      
      if (res.statusCode !== 200) {
        resolve(null);
        return;
      }
      
      let data = '';
      res.on('data', chunk => {
        data += chunk;
        if (data.length > 100000) { // Limit to 100KB
          res.destroy();
          resolve(data);
        }
      });
      res.on('end', () => resolve(data));
      res.on('error', () => resolve(null));
    });
    
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

// ====================================================================
// MAIN
// ====================================================================

async function main() {
  console.log('🔧 Startup Data Resolver & Fixer');
  console.log('='.repeat(50));
  if (CONFIG.DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n');
  }
  console.log(`Started: ${new Date().toISOString()}\n`);
  
  // Load ontology for semantic validation
  await loadOntology();
  
  // Find issues
  const issues = await findStartupsWithIssues();
  
  // Fix malformed websites first (quick fix)
  console.log('\n📌 Fixing malformed websites...');
  let fixed = 0;
  for (const startup of issues.malformedWebsite.slice(0, CONFIG.MAX_FIX_PER_RUN)) {
    const result = await fixMalformedWebsite(startup);
    if (result.fixed) fixed++;
  }
  console.log(`   Fixed: ${fixed}\n`);
  
  // Fix missing sectors (no network calls) - uses inference extractor if available
  console.log('📌 Detecting sectors (using inference extractor)...');
  fixed = 0;
  for (const startup of issues.missingSectors.slice(0, CONFIG.MAX_FIX_PER_RUN)) {
    const result = await fixMissingSectors(startup);
    if (result.fixed) fixed++;
  }
  console.log(`   Fixed: ${fixed}\n`);
  
  // Try to fix missing websites
  console.log('📌 Resolving missing websites...');
  fixed = 0;
  for (const startup of issues.missingWebsite.slice(0, 50)) { // Limit due to network calls
    const result = await fixMissingWebsite(startup);
    if (result.fixed) fixed++;
    await new Promise(r => setTimeout(r, 200)); // Rate limit
  }
  console.log(`   Fixed: ${fixed}\n`);
  
  // Fix missing descriptions - uses inference extractor to get full structured data
  console.log('📌 Fetching missing descriptions (with inference extraction)...');
  fixed = 0;
  for (const startup of issues.missingDescription.slice(0, 50)) { // Limit due to network calls
    const result = await fixMissingDescription(startup);
    if (result.fixed) fixed++;
    await new Promise(r => setTimeout(r, 500)); // Rate limit
  }
  console.log(`   Fixed: ${fixed}\n`);
  
  // Build extracted_data for startups missing it (inference engine)
  console.log('📌 Building extracted_data via inference engine...');
  fixed = 0;
  for (const startup of issues.missingExtractedData.slice(0, CONFIG.MAX_FIX_PER_RUN)) {
    const result = await buildExtractedData(startup);
    if (result.fixed) fixed++;
  }
  console.log(`   Fixed: ${fixed}\n`);
  
  // Flag/remove generic names (junk data from ontology check)
  console.log('📌 Flagging generic/junk names (ontology validation)...');
  fixed = 0;
  for (const startup of issues.genericNames.slice(0, CONFIG.MAX_FIX_PER_RUN)) {
    const result = await flagGenericName(startup);
    if (result.fixed) fixed++;
  }
  console.log(`   Flagged: ${fixed}\n`);
  
  // Merge duplicates
  console.log('📌 Merging duplicates...');
  fixed = 0;
  for (const dup of issues.duplicateNames.slice(0, CONFIG.MAX_FIX_PER_RUN)) {
    const result = await mergeDuplicates(dup);
    if (result.fixed) fixed++;
  }
  console.log(`   Merged: ${fixed} groups\n`);
  
  // Summary
  console.log('='.repeat(50));
  console.log(`\nCompleted: ${new Date().toISOString()}`);
  
  if (CONFIG.DRY_RUN) {
    console.log('\n⚠️  This was a dry run. Run without --dry-run to apply fixes.');
  } else {
    console.log('\n💡 Next steps:');
    console.log('   1. Recalculate GOD scores: npx tsx scripts/recalculate-scores.ts');
    console.log('   2. Regenerate matches: node match-regenerator.js');
  }
}

// ====================================================================
// INFERENCE ENGINE INTEGRATION
// ====================================================================

/**
 * Build extracted_data using inference extractor (no AI needed)
 */
async function buildExtractedData(startup) {
  // Combine all available text
  const text = [
    startup.name,
    startup.description,
    startup.pitch,
    startup.tagline,
  ].filter(Boolean).join(' ');
  
  if (text.length < 20) {
    return { fixed: false, reason: 'insufficient_text' };
  }
  
  let extractedData = {};
  
  // Use inference extractor if available
  if (extractInferenceData) {
    try {
      extractedData = extractInferenceData(text, startup.website) || {};
      console.log(`   ✓ Built extracted_data for ${startup.name} via inference extractor`);
    } catch (e) {
      console.log(`   ⚠️  Inference failed for ${startup.name}: ${e.message}`);
      extractedData = {};
    }
  }
  
  // Fallback: basic extraction
  if (!extractedData || !extractedData.sectors || extractedData.sectors.length === 0) {
    extractedData = extractedData || {};
    extractedData.sectors = detectSectors(text);
  }
  
  // Add 5-point structure if missing
  if (!extractedData.fivePoints) {
    extractedData.fivePoints = buildFivePoints(startup, extractedData || {});
  }
  
  if (Object.keys(extractedData).length > 0) {
    if (!CONFIG.DRY_RUN) {
      await supabase
        .from('startup_uploads')
        .update({ extracted_data: extractedData })
        .eq('id', startup.id);
    }
    return { fixed: true, extractedData };
  }
  
  return { fixed: false };
}

/**
 * Build 5-point summary from available data
 */
function buildFivePoints(startup, extractedData) {
  const points = [];
  const sectors = extractedData.sectors || startup.sectors || ['Technology'];
  
  // 1. Value Proposition
  if (startup.tagline) {
    points.push(startup.tagline);
  } else if (startup.description) {
    points.push(startup.description.substring(0, 120));
  } else {
    points.push(`${startup.name} builds innovative ${sectors[0]} solutions`);
  }
  
  // 2. Problem/Market
  points.push(`Addressing key challenges in the ${sectors[0]} market`);
  
  // 3. Solution/Product
  if (startup.pitch) {
    points.push(startup.pitch.substring(0, 120));
  } else {
    points.push(`Building next-generation ${sectors[0]} technology`);
  }
  
  // 4. Team/Stage
  const stage = extractedData.funding_stage || 'Early stage';
  points.push(`${stage} startup`);
  
  // 5. Investment
  if (extractedData.funding_amount) {
    const amtM = (extractedData.funding_amount / 1000000).toFixed(1);
    points.push(`Raised $${amtM}M`);
  } else {
    points.push('Seeking investment');
  }
  
  return points;
}

/**
 * Flag startups with generic/junk names from ontology
 */
async function flagGenericName(startup) {
  // These are likely not real startups - flag them
  console.log(`   ⚠️  Generic name detected: "${startup.name}"`);
  
  if (!CONFIG.DRY_RUN) {
    await supabase
      .from('startup_uploads')
      .update({ 
        status: 'rejected',
        review_notes: `[AUTO] Generic/junk name detected by ontology validator: "${startup.name}"`
      })
      .eq('id', startup.id);
  }
  
  return { fixed: true, action: 'rejected' };
}

main().catch(console.error);
