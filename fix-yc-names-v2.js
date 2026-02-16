#!/usr/bin/env node
/**
 * YC Bad Name Cleanup v2 - Handles duplicates by deleting bad versions
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const CITIES = [
  'San Francisco', 'New York', 'Mountain View', 'Palo Alto', 'Los Angeles',
  'Seattle', 'Boston', 'Austin', 'Chicago', 'London', 'Berlin', 'Toronto',
  'Mumbai', 'Singapore', 'Denver', 'Miami', 'Portland', 'Atlanta',
  'Remote', 'Worldwide', 'Bangalore', 'Tel Aviv', 'Paris', 'Amsterdam',
  'Dublin', 'Beijing', 'Shanghai', 'Hong Kong', 'Sydney', 'Melbourne',
  'Cape Town', 'Nairobi', 'Lagos', 'Silver Spring', 'Santa Clara',
  'Irvine', 'Scottsdale', 'Boise', 'Madison', 'Nashville', 'Detroit',
  'Bellevue', 'Kirkland', 'Cupertino', 'Fremont', 'Oakland', 'Berkeley',
  'Culver City', 'Pasadena', 'San Mateo', 'Burlingame', 'San Diego',
  'San Jose', 'Sacramento', 'Redwood City', 'Menlo Park', 'Sunnyvale',
  'Santa Monica', 'Brooklyn', 'Manhattan', 'Cambridge', 'Somerville',
  'Philadelphia', 'Washington', 'Pittsburgh', 'Minneapolis', 'Phoenix',
  'Dallas', 'Houston', 'Raleigh', 'Charlotte', 'Columbus', 'Salt Lake',
  'Las Vegas', 'Tampa', 'Orlando', 'Indianapolis', 'Kansas City',
  'St. Louis', 'Vancouver', 'Montreal', 'Ottawa', 'Calgary', 'Waterloo',
  'Mexico City', 'Sao Paulo', 'Buenos Aires',
];

function extractCleanName(dirtyName) {
  if (!dirtyName) return null;
  let name = dirtyName;
  
  // Cut at city name
  for (const city of CITIES) {
    const idx = name.indexOf(city);
    if (idx > 0) { name = name.substring(0, idx).trim(); break; }
  }
  // Cut at state abbreviation
  const stateMatch = name.match(/^(.+?),\s*[A-Z]{2},/);
  if (stateMatch && stateMatch[1].length >= 2) name = stateMatch[1].trim();
  // Cut at season+year
  const seasonMatch = name.match(/^(.+?)(?:Summer|Winter|Spring|Fall)\s+20\d{2}/);
  if (seasonMatch && seasonMatch[1].length >= 2) name = seasonMatch[1].trim();
  // Cut at category tags
  const catMatch = name.match(/^(.+?)(?:B2B|B2C|Fintech|Consumer|Government|Healthcare|Industrials|Infrastructure|Education|Legal|Recruiting|Marketing|Analytics|Sales|Productivity|Engineering|DevOps|SaaS|Marketplace|Logistics|Insurance)(?=[A-Z]|$)/);
  if (catMatch && catMatch[1].length >= 2) name = catMatch[1].trim();
  // AI/RL/ML suffix handling
  const aiMatch = name.match(/^([A-Za-z]{2,}?)(AI|RL|ML)\s*([-A-Za-z].{5,})/);
  if (aiMatch) {
    const after = aiMatch[3];
    if (/^[-\s]/.test(after) || /^[a-z]/.test(after) || /^(Native|Platform|Powered|Based|Brand|for|to|the|a|an)/i.test(after.trim())) {
      name = aiMatch[1] + aiMatch[2];
    }
  }
  // Description word boundary
  if (name.length > 25) {
    const descBreak = name.match(/^(.{3,30}?)\b\s*(We |Our |The |A |An |Your |It |for |to |with |by |Auto|Modern|Build|Help|Enable|Power|Create|Fast|Simple|Open|Smart|Making|Connect|Track|is |are )/i);
    if (descBreak && descBreak[1].length >= 3) name = descBreak[1].trim();
  }
  if (name.length > 25) {
    const pascalMatch = name.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/);
    if (pascalMatch && pascalMatch[1].length >= 3) name = pascalMatch[1];
  }
  
  name = name.replace(/[,.\-\s]+$/, '').trim();
  if (name.length < 2 || name.length > 60 || name === dirtyName) return null;
  // Reject city names, fragments
  const lower = name.toLowerCase();
  const cityLower = CITIES.map(c => c.toLowerCase());
  if (cityLower.includes(lower)) return null;
  if (name.length < 3 && !/^[A-Z][A-Z0-9]$/.test(name)) return null;
  if (/^(a|an|in|on|at|by|for|to|with|from)\s/i.test(name) && name.split(' ').length <= 2) return null;
  if (/\b(based|startup|company|firm|platform|humanoid|robotics|management|security|duo|led)$/i.test(name)) return null;
  return name;
}

(async () => {
  console.log('=== YC BAD NAME CLEANUP v2 ===\n');
  
  let allStartups = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase.from('startup_uploads').select('id, name').eq('status', 'approved').range(offset, offset + 999);
    if (!data || data.length === 0) break;
    allStartups = allStartups.concat(data);
    offset += 1000;
    if (data.length < 1000) break;
  }
  
  const badNames = [];
  const seasons = ['Summer 20', 'Winter 20', 'Spring 20', 'Fall 20'];
  const states = [', CA,', ', NY,', ', MA,', ', TX,', ', WA,', ', CO,', ', USA'];
  
  for (const s of allStartups) {
    const n = s.name || '';
    const isBad = CITIES.some(c => n.includes(c)) || seasons.some(se => n.includes(se)) || states.some(st => n.includes(st)) ||
                  (n.includes('B2B') && n.length > 30) || (n.includes('Fintech') && n.length > 30) || (n.includes('Consumer') && n.length > 30);
    if (isBad) {
      const cleanName = extractCleanName(n);
      badNames.push({ id: s.id, oldName: n, newName: cleanName });
    }
  }
  
  console.log('Total bad names:', badNames.length);
  const fixable = badNames.filter(b => b.newName);
  const unfixable = badNames.filter(b => !b.newName);
  console.log('Fixable:', fixable.length, '| Unfixable:', unfixable.length);
  
  if (!process.argv.includes('--fix')) {
    console.log('\nDry run. Use --fix to apply.');
    return;
  }
  
  let renamed = 0, deleted = 0, skipped = 0, errors = 0;
  
  for (const item of fixable) {
    // Check if clean name already exists
    const { data: existing } = await supabase.from('startup_uploads')
      .select('id').eq('name', item.newName).neq('id', item.id).limit(1);
    
    if (existing && existing.length > 0) {
      // Duplicate — delete the bad-name version and its matches
      const { error: matchErr } = await supabase.from('startup_investor_matches').delete().eq('startup_id', item.id);
      const { error: delErr } = await supabase.from('startup_uploads').delete().eq('id', item.id);
      if (delErr) { errors++; } else { deleted++; }
    } else {
      // Rename
      const { error } = await supabase.from('startup_uploads').update({ name: item.newName }).eq('id', item.id);
      if (error) { errors++; } else { renamed++; }
    }
  }
  
  // Also delete unfixable ones (they're article fragments, not real startups)
  for (const item of unfixable) {
    const n = (item.oldName || '').toLowerCase();
    // Only delete clearly bad ones
    if (n.includes('-based ') || n.includes(' startup ') || n.includes("'s") || n === "chicago bears" || n.includes(' duo') || n.includes(' humanoid')) {
      const { error: matchErr } = await supabase.from('startup_investor_matches').delete().eq('startup_id', item.id);
      const { error: delErr } = await supabase.from('startup_uploads').delete().eq('id', item.id);
      if (!delErr) deleted++;
    } else {
      skipped++;
    }
  }
  
  console.log('\nResults:');
  console.log('  Renamed:', renamed);
  console.log('  Deleted (duplicates + junk):', deleted);
  console.log('  Skipped:', skipped);
  console.log('  Errors:', errors);
  console.log('\nDone');
})();
