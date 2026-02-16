#!/usr/bin/env node
/**
 * Bulk fix YC bad names in startup_uploads
 * Fixes names that have city/state/USA and season/year concatenated
 * e.g., "StripeSan Francisco, CA, USAEconomic infrastructure for the internet.Summer 2009Fintech"
 * → extracts just "Stripe"
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Patterns that indicate concatenated YC directory data
const YC_CONCAT_PATTERNS = [
  /^(.+?)(San Francisco|New York|Mountain View|Palo Alto|Los Angeles|Seattle|Boston|Austin|Chicago|London|Berlin|Toronto|Mumbai|Singapore|Denver|Miami|Portland|Atlanta|Remote|Worldwide)/i,
  /^(.+?)(Summer\s+20\d{2}|Winter\s+20\d{2}|Spring\s+20\d{2}|Fall\s+20\d{2}|[SW]\d{2,4})/i,
];

// Additional pattern: name + one-liner description mashed together
// e.g., "AbsurdAI Brand and Performance Ads at ScaleFall 2025B2BMarketing"
const DESCRIPTION_CONCAT = /^([A-Z][a-z]+(?:[A-Z][a-z]+)*)\s*[A-Z][a-z].*(?:Summer|Winter|Spring|Fall)\s+20\d{2}/;

function extractCleanName(dirtyName) {
  if (!dirtyName) return null;
  
  // The YC directory concatenation pattern is:
  // CompanyNameCityName, ST, USADescription text.Season YEARCategorySubcategory
  // or: CompanyNameDescription textSeason YEARCategory
  
  // Strategy: Try to find where the actual name ends
  let name = dirtyName;
  
  // Step 1: Cut at city name (most reliable signal)
  const cities = [
    'San Francisco', 'New York', 'Mountain View', 'Palo Alto', 'Los Angeles',
    'Seattle', 'Boston', 'Austin', 'Chicago', 'London', 'Berlin', 'Toronto',
    'Mumbai', 'Singapore', 'Denver', 'Miami', 'Portland', 'Atlanta',
    'Remote', 'Worldwide', 'Bangalore', 'Tel Aviv', 'Paris', 'Amsterdam',
    'Dublin', 'Beijing', 'Shanghai', 'Hong Kong', 'Sydney', 'Melbourne',
    'Cape Town', 'Nairobi', 'Lagos', 'Sao Paulo', 'Buenos Aires',
    'Mexico City', 'Vancouver', 'Montreal', 'Ottawa', 'Calgary', 'Waterloo',
    'Philadelphia', 'Washington', 'Pittsburgh', 'Indianapolis', 'Minneapolis',
    'Salt Lake', 'Raleigh', 'Charlotte', 'Columbus', 'Phoenix', 'Dallas',
    'Houston', 'San Diego', 'San Jose', 'Sacramento', 'Redwood City',
    'Menlo Park', 'Sunnyvale', 'Santa Monica', 'Venice', 'Brooklyn',
    'Manhattan', 'Cambridge', 'Somerville', 'Silver Spring', 'Santa Clara',
    'Irvine', 'Scottsdale', 'Boise', 'Madison', 'Nashville', 'Detroit',
    'St. Louis', 'Kansas City', 'Tampa', 'Orlando', 'Las Vegas',
    'Bellevue', 'Kirkland', 'Cupertino', 'Fremont', 'Oakland', 'Berkeley',
    'Culver City', 'Pasadena', 'San Mateo', 'Burlingame', 'Foster City',
    'Half Moon Bay', 'Milpitas', 'Pleasanton', 'Walnut Creek',
  ];
  
  for (const city of cities) {
    const idx = name.indexOf(city);
    if (idx > 0) {
      name = name.substring(0, idx).trim();
      break;
    }
  }
  
  // Step 2: Cut at state abbreviation pattern (", XX,")
  const stateMatch = name.match(/^(.+?),\s*[A-Z]{2},/);
  if (stateMatch && stateMatch[1].length >= 2) {
    name = stateMatch[1].trim();
  }
  
  // Step 3: Cut at season+year pattern
  const seasonMatch = name.match(/^(.+?)(?:Summer|Winter|Spring|Fall)\s+20\d{2}/);
  if (seasonMatch && seasonMatch[1].length >= 2) {
    name = seasonMatch[1].trim();
  }
  
  // Step 4: Cut at category tags (B2B, Fintech, Consumer, etc.) that are NOT part of normal names
  // These appear at the end of concat patterns: "...B2BMarketing" or "...FintechConsumer Finance"
  const categoryMatch = name.match(/^(.+?)(?:B2B|B2C|Fintech|Consumer|Government|Healthcare|Industrials|Infrastructure|Education|Legal|Recruiting|Marketing|Analytics|Sales|Productivity|Engineering|DevOps|SaaS|Marketplace|Logistics|Insurance|Real Estate|PropTech|CleanTech|BioTech|MedTech|EdTech|AgTech|FoodTech|FinTech|RegTech|LegalTech|InsurTech|HealthTech|HRTech|AdTech)(?=[A-Z]|$)/);
  if (categoryMatch && categoryMatch[1].length >= 2) {
    name = categoryMatch[1].trim();
  }
  
  // Step 5: If name still has a description fused (detected by patterns)
  // Handle "CompanyNameDescription text" patterns
  // Case A: "SpottAI-native ATS/CRM..." → "Spott" (description contains hyphens/articles)
  // Case B: "NautilusAI platform to..." → "Nautilus" (name + "AI" then lowercase)
  // Case C: "LaurenceRL for performance..." → "Laurence" (name + category suffix then prep)
  // Case D: "SiraAI Native Rippling..." → "Sira" (name + "AI" then capitalized)
  
  // Approach: Find the first transition from name→description
  // Names are typically PascalCase (1-3 segments), descriptions start with common description patterns
  
  // Pattern: NameAI/RL/ML + description  
  const aiSuffixMatch = name.match(/^([A-Za-z]{2,}?)(AI|RL|ML)\s*([-A-Za-z].{5,})/);
  if (aiSuffixMatch) {
    const baseWord = aiSuffixMatch[1];
    const suffix = aiSuffixMatch[2];
    const afterSuffix = aiSuffixMatch[3];
    // Keep the AI/RL/ML suffix as part of the name
    if (/^[-\s]/.test(afterSuffix) || /^[a-z]/.test(afterSuffix) || /^(Native|Platform|Powered|Based|Driven|Enabled|First|for|to|the|a|an|Brand)/i.test(afterSuffix.trim())) {
      name = baseWord + suffix;
      name = name.trim();
    }
  }
  
  // Pattern: "NameDescription with lowercase or prep words"
  // e.g., "Foundation IndustriesWe supply..." 
  if (name.length > 25) {
    // Look for where description likely starts — must be at word boundary
    const descBreak = name.match(/^(.{3,30}?)\b\s*(We |Our |The |A |An |Your |It |This |That |for |to |with |by |at |in |on |Auto|Modern|Build|Help|Enable|Power|Create|Fast|Simple|Open|Smart|Making|Connect|Track|is |are )/i);
    if (descBreak && descBreak[1].length >= 3) {
      name = descBreak[1].trim();
    }
  }
  
  // Pattern: Name followed by description without space (CamelCase boundary)
  // e.g., "FoundationIndustriesWeSupply" → "Foundation Industries" or just "Foundation"
  if (name.length > 25) {
    // Take first 1-3 PascalCase words
    const pascalMatch = name.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/);
    if (pascalMatch && pascalMatch[1].length >= 3) {
      name = pascalMatch[1];
    }
  }
  
  // Step 6: Remove trailing punctuation and whitespace
  name = name.replace(/[,.\-\s]+$/, '').trim();
  
  // Reject if still too long (likely still has junk) or too short
  if (name.length < 2 || name.length > 60) return null;
  // Reject if name is same as input (no change)
  if (name === dirtyName) return null;
  // Reject if the "clean" name is just a city name (article fragment, not YC concatenation)
  const cleanLower = name.toLowerCase();
  const cityNames = ['london', 'paris', 'berlin', 'seattle', 'austin', 'chicago', 'miami',
    'shanghai', 'amsterdam', 'toronto', 'mumbai', 'singapore', 'dublin', 'sydney',
    'nairobi', 'lagos', 'boston', 'denver', 'portland', 'atlanta', 'detroit',
    'nashville', 'orlando', 'tampa', 'dallas', 'houston', 'phoenix', 'remote',
    'worldwide', 'new york', 'los angeles', 'san diego', 'san jose'];
  if (cityNames.includes(cleanLower)) return null;
  // Reject if name is truncated nonsense (under 3 chars or just initials)
  if (name.length < 3 && !/^[A-Z][A-Z0-9]$/.test(name)) return null;
  // Reject names that are clearly sentence fragments
  if (/^(a|an|in|on|at|by|for|to|with|from)\s/i.test(name) && name.split(' ').length <= 2) return null;
  // Reject if name ends with common word fragments
  if (/\b(based|startup|company|firm|platform|humanoid|robotics|management|security|duo|led)$/i.test(name)) return null;
  
  return name;
}

(async () => {
  console.log('=== YC BAD NAME CLEANUP ===\n');
  
  // Fetch all approved startups (paginate)
  let allStartups = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const { data } = await supabase.from('startup_uploads')
      .select('id, name')
      .eq('status', 'approved')
      .range(offset, offset + pageSize - 1);
    if (!data || data.length === 0) break;
    allStartups = allStartups.concat(data);
    offset += pageSize;
    if (data.length < pageSize) break;
  }
  console.log('Total approved startups:', allStartups.length);
  
  // Identify bad names
  const badNames = [];
  const cities = ['San Francisco', 'New York', 'Mountain View', 'Palo Alto', 'Los Angeles', 
    'Seattle', 'Boston', 'Austin', 'Chicago', 'London', 'Berlin', 'Toronto', 'Mumbai',
    'Singapore', 'Denver', 'Miami', 'Portland', 'Atlanta', 'Remote', 'Worldwide',
    'Bangalore', 'Tel Aviv', 'Paris', 'Amsterdam', 'Dublin', 'Beijing', 'Shanghai',
    'Hong Kong', 'Sydney', 'Melbourne', 'Cape Town', 'Nairobi', 'Lagos', 'Sao Paulo',
    'Buenos Aires', 'Mexico City', 'Vancouver', 'Montreal', 'Ottawa', 'Calgary',
    'Waterloo', 'Philadelphia', 'Washington', 'Pittsburgh', 'Indianapolis', 'Minneapolis',
    'Salt Lake', 'Raleigh', 'Charlotte', 'Columbus', 'Phoenix', 'Dallas', 'Houston',
    'San Diego', 'San Jose', 'Sacramento', 'Redwood City', 'Menlo Park', 'Sunnyvale',
    'Santa Monica', 'Venice', 'Brooklyn', 'Manhattan', 'Cambridge', 'Somerville'];
  const seasons = ['Summer 20', 'Winter 20', 'Spring 20', 'Fall 20'];
  const states = [', CA,', ', NY,', ', MA,', ', TX,', ', WA,', ', CO,', ', GA,', ', IL,', ', PA,', ', USA'];
  
  for (const s of allStartups) {
    const n = s.name || '';
    const isBad = cities.some(c => n.includes(c)) || 
                  seasons.some(se => n.includes(se)) ||
                  states.some(st => n.includes(st)) ||
                  n.includes('B2B') && n.length > 30 ||
                  n.includes('Fintech') && n.length > 30 ||
                  n.includes('Consumer') && n.length > 30;
    
    if (isBad) {
      const cleanName = extractCleanName(n);
      if (cleanName && cleanName !== n) {
        badNames.push({ id: s.id, oldName: n, newName: cleanName });
      } else {
        badNames.push({ id: s.id, oldName: n, newName: null });
      }
    }
  }
  
  console.log('Bad names found:', badNames.length);
  
  // Show samples
  console.log('\n--- FIXABLE (with extracted clean name) ---');
  const fixable = badNames.filter(b => b.newName);
  fixable.slice(0, 25).forEach(b => {
    console.log('  "' + b.oldName.substring(0, 70) + '"');
    console.log('    → "' + b.newName + '"');
  });
  console.log('  ... total fixable:', fixable.length);
  
  console.log('\n--- UNFIXABLE (need manual review) ---');
  const unfixable = badNames.filter(b => !b.newName);
  unfixable.slice(0, 10).forEach(b => {
    console.log('  "' + b.oldName.substring(0, 80) + '"');
  });
  console.log('  ... total unfixable:', unfixable.length);
  
  // DRY RUN: show what would be fixed
  if (process.argv.includes('--fix')) {
    console.log('\n=== APPLYING FIXES ===');
    let fixed = 0;
    let errors = 0;
    
    for (const item of fixable) {
      // Check for name collision
      const { data: existing } = await supabase.from('startup_uploads')
        .select('id')
        .eq('name', item.newName)
        .neq('id', item.id)
        .limit(1);
      
      if (existing && existing.length > 0) {
        // Name collision - skip, this is a duplicate
        console.log('  SKIP (duplicate): "' + item.newName + '" already exists');
        continue;
      }
      
      const { error } = await supabase.from('startup_uploads')
        .update({ name: item.newName })
        .eq('id', item.id);
      
      if (error) {
        console.log('  ERROR: ' + item.oldName.substring(0, 40) + ' → ' + error.message);
        errors++;
      } else {
        fixed++;
      }
    }
    
    console.log('\nFixed: ' + fixed + ' | Errors: ' + errors + ' | Skipped (dupes): ' + (fixable.length - fixed - errors));
  } else {
    console.log('\n⚠️  DRY RUN. Run with --fix to apply changes.');
  }
  
  console.log('\nDone');
})();
