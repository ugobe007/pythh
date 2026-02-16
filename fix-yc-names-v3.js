#!/usr/bin/env node
/**
 * YC Bad Name Cleanup v3 - Batch operations for efficiency
 * Phase 1: Collect all bad names and categorize (rename vs delete)
 * Phase 2: Batch delete matches for delete-targets
 * Phase 3: Batch delete startups
 * Phase 4: Batch rename fixable ones
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
  
  for (const city of CITIES) {
    const idx = name.indexOf(city);
    if (idx > 0) { name = name.substring(0, idx).trim(); break; }
    // Also handle city without space (e.g., "Hex SecuritySan Francisco")
    const noSpaceCity = city.replace(/\s+/g, '');
    if (noSpaceCity !== city) {
      const idx2 = name.indexOf(noSpaceCity);
      if (idx2 > 0) { name = name.substring(0, idx2).trim(); break; }
    }
  }
  const stateMatch = name.match(/^(.+?),\s*[A-Z]{2},/);
  if (stateMatch && stateMatch[1].length >= 2) name = stateMatch[1].trim();
  const seasonMatch = name.match(/^(.+?)(?:Summer|Winter|Spring|Fall)\s+20\d{2}/);
  if (seasonMatch && seasonMatch[1].length >= 2) name = seasonMatch[1].trim();
  const catMatch = name.match(/^(.+?)(?:B2B|B2C|Fintech|Consumer|Government|Healthcare|Industrials|Infrastructure|Education|Legal|Recruiting|Marketing|Analytics|Sales|Productivity|Engineering|DevOps|SaaS|Marketplace|Logistics|Insurance)(?=[A-Z]|$)/);
  if (catMatch && catMatch[1].length >= 2) name = catMatch[1].trim();
  const aiMatch = name.match(/^([A-Za-z]{2,}?)(AI|RL|ML)\s*([-A-Za-z].{5,})/);
  if (aiMatch) {
    const after = aiMatch[3];
    if (/^[-\s]/.test(after) || /^[a-z]/.test(after) || /^(Native|Platform|Powered|Based|Brand|for|to|the|a|an)/i.test(after.trim())) {
      name = aiMatch[1] + aiMatch[2];
    }
  }
  // Handle fused lowercase→Uppercase boundary (e.g. "AlaraProcurement" → "Alara", "throxyVertical" → "throxy")
  if (name.length > 12) {
    const fuseMatch = name.match(/^(.{2,20}?)([A-Z][a-z]{3,})/);
    if (fuseMatch) {
      const before = fuseMatch[1];
      const after = fuseMatch[2];
      const descWords = ['Procurement','Vertical','Stablecoin','Platform','Robots','Robot','Digital','Modern','Building','Telepresence','Agent','Better','Smart','Simple','Fast','Full','Data','Cloud','Real','Next','All','Account','Managed'];
      if (descWords.some(w => after.startsWith(w))) {
        name = before;
      }
    }
  }
  if (name.length > 25) {
    const descBreak = name.match(/^(.{3,30}?)\b\s*(We |Our |The |A |An |Your |It |for |to |with |by |Auto|Modern|Build|Help|Enable|Power|Create|Fast|Simple|Open|Smart|Making|Connect|Track|is |are |Procurement|Stablecoin|Platform|Agent|Digital|Real|Data|Cloud|Better|Next|Full|All|API )/i);
    if (descBreak && descBreak[1].length >= 3) name = descBreak[1].trim();
  }
  if (name.length > 25) {
    const pascalMatch = name.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/);
    if (pascalMatch && pascalMatch[1].length >= 3) name = pascalMatch[1];
  }
  
  name = name.replace(/[,.\-\s]+$/, '').trim();
  if (name.length < 2 || name.length > 60 || name === dirtyName) return null;
  const lower = name.toLowerCase();
  if (CITIES.map(c => c.toLowerCase()).includes(lower)) return null;
  if (name.length < 3 && !/^[A-Z][A-Z0-9]$/.test(name)) return null;
  if (/^(a|an|in|on|at|by|for|to|with|from)\s/i.test(name) && name.split(' ').length <= 2) return null;
  if (/\b(based|startup|company|firm|platform|humanoid|robotics|management|security|duo|led|software|banking)$/i.test(name)) return null;
  // Reject if ends with "AI" followed by more "AI" (double AI)
  if (/AI\s*AI/i.test(name)) {
    name = name.replace(/AI\s*AI.*$/i, 'AI');
  }
  if (name.length < 2) return null;
  return name;
}

(async () => {
  console.log('=== YC BAD NAME CLEANUP v3 (Batch) ===\n');
  
  // Phase 1: Load all startups
  console.log('Phase 1: Loading all startups...');
  let allStartups = [];
  let offset = 0;
  while (true) {
    const { data } = await supabase.from('startup_uploads').select('id, name').eq('status', 'approved').range(offset, offset + 999);
    if (!data || data.length === 0) break;
    allStartups = allStartups.concat(data);
    offset += 1000;
    if (data.length < 1000) break;
  }
  console.log('  Total startups loaded:', allStartups.length);
  
  // Build name lookup
  const nameSet = new Set(allStartups.map(s => s.name));
  
  // Find bad names
  const seasons = ['Summer 20', 'Winter 20', 'Spring 20', 'Fall 20'];
  const states = [', CA,', ', NY,', ', MA,', ', TX,', ', WA,', ', CO,', ', USA'];
  
  const toRename = []; // {id, oldName, newName}
  const toDelete = []; // {id, oldName, reason}
  const unfixable = []; // {id, oldName}
  
  for (const s of allStartups) {
    const n = s.name || '';
    const isBad = CITIES.some(c => n.includes(c)) || seasons.some(se => n.includes(se)) || states.some(st => n.includes(st)) ||
                  (n.includes('B2B') && n.length > 30) || (n.includes('Fintech') && n.length > 30) || (n.includes('Consumer') && n.length > 30);
    if (!isBad) continue;
    
    const cleanName = extractCleanName(n);
    if (!cleanName) {
      // Check for possessive city names FIRST (Berlin's NetBird → NetBird)
      const cityLower = CITIES.map(c => c.toLowerCase());
      const possMatch = n.match(/^([A-Z][a-z]+)[\u2018\u2019\u0027\u02BC]s\s+(.+)/);
      if (possMatch && cityLower.includes(possMatch[1].toLowerCase()) && possMatch[2].length >= 2) {
        let possName = possMatch[2].trim();
        // Take first PascalCase word(s)
        const fullMatch = possName.match(/^([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/);
        if (fullMatch) possName = fullMatch[1];
        possName = possName.replace(/[,.\-\s]+$/, '');
        if (possName.length >= 2) {
          if (nameSet.has(possName)) {
            toDelete.push({ id: s.id, oldName: n, reason: 'duplicate of ' + possName });
          } else {
            toRename.push({ id: s.id, oldName: n, newName: possName });
            nameSet.add(possName);
          }
          continue;
        }
      }
      
      // Check if it's clearly junk
      const lower = n.toLowerCase();
      const isJunk = lower.includes('-based ') || lower.includes(' startup ') || lower.includes("'s") || lower.includes('\u2019s') ||
                     lower.includes(' duo') || lower.includes(' humanoid') || n.length > 100 ||
                     lower.includes('-from-') || /^(chicago bears|kirkland|london-based)$/i.test(n) ||
                     cityLower.includes(lower) || lower.includes(' fintech ') || lower.includes(' edtech') ||
                     /^[A-Z][a-z]+-based$/i.test(n);
      if (isJunk) {
        toDelete.push({ id: s.id, oldName: n, reason: 'junk' });
      } else if (/^(Shanghai|Tampa|Miami)\s+(AI|EdTech|Tech|FinTech)$/i.test(n)) {
        toDelete.push({ id: s.id, oldName: n, reason: 'city + category junk' });
      } else {
        unfixable.push({ id: s.id, oldName: n });
      }
      continue;
    }
    
    // Check if clean name already exists
    if (nameSet.has(cleanName)) {
      toDelete.push({ id: s.id, oldName: n, reason: 'duplicate of ' + cleanName });
    } else {
      toRename.push({ id: s.id, oldName: n, newName: cleanName });
      nameSet.add(cleanName); // prevent creating duplicates among fixable set
    }
  }
  
  console.log('\nAnalysis:');
  console.log('  To rename:', toRename.length);
  console.log('  To delete (dupes/junk):', toDelete.length);
  console.log('  Unfixable (keeping):', unfixable.length);
  
  if (unfixable.length > 0) {
    console.log('\n  Sample unfixable:');
    unfixable.slice(0, 10).forEach(u => console.log('    -', u.oldName.substring(0, 80)));
  }
  
  if (!process.argv.includes('--fix')) {
    console.log('\nDry run. Use --fix to apply.');
    if (toRename.length > 0) {
      console.log('\nSample renames:');
      toRename.slice(0, 15).forEach(r => console.log('  ', r.oldName.substring(0, 50), '→', r.newName));
    }
    if (toDelete.length > 0) {
      console.log('\nSample deletes:');
      toDelete.slice(0, 15).forEach(d => console.log('  ', d.oldName.substring(0, 50), '|', d.reason));
    }
    return;
  }
  
  // Phase 2: Delete matches for delete-targets in batches
  const deleteIds = toDelete.map(d => d.id);
  if (deleteIds.length > 0) {
    console.log('\nPhase 2: Deleting matches for', deleteIds.length, 'startups...');
    const BATCH = 50;
    for (let i = 0; i < deleteIds.length; i += BATCH) {
      const batch = deleteIds.slice(i, i + BATCH);
      const { error } = await supabase.from('startup_investor_matches').delete().in('startup_id', batch);
      if (error) console.log('  Match delete error batch', i, ':', error.message);
      else process.stdout.write('.');
    }
    console.log(' done');
  }
  
  // Phase 3: Delete startups in batches
  if (deleteIds.length > 0) {
    console.log('Phase 3: Deleting', deleteIds.length, 'bad startups...');
    const BATCH = 50;
    for (let i = 0; i < deleteIds.length; i += BATCH) {
      const batch = deleteIds.slice(i, i + BATCH);
      const { error } = await supabase.from('startup_uploads').delete().in('id', batch);
      if (error) console.log('  Delete error batch', i, ':', error.message);
      else process.stdout.write('.');
    }
    console.log(' done');
  }
  
  // Phase 4: Rename in batches (individual updates since each has different name)
  if (toRename.length > 0) {
    console.log('Phase 4: Renaming', toRename.length, 'startups...');
    let renamed = 0, errors = 0;
    for (const item of toRename) {
      const { error } = await supabase.from('startup_uploads').update({ name: item.newName }).eq('id', item.id);
      if (error) { errors++; } else { renamed++; }
      if ((renamed + errors) % 50 === 0) process.stdout.write('.');
    }
    console.log(' done');
    console.log('  Renamed:', renamed, '| Errors:', errors);
  }
  
  console.log('\n=== SUMMARY ===');
  console.log('Deleted:', deleteIds.length);
  console.log('Renamed:', toRename.length);
  console.log('Unfixable (kept):', unfixable.length);
  console.log('Done!');
})();
