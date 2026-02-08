#!/usr/bin/env node
/**
 * Quick test: Verify faith alignment scoring against real data.
 * Tests 3 AI startups vs 10 investors with faith signals.
 */

const { supabase } = require('../server/lib/supabaseClient');
const { calculateSectorMatchScore, SECTOR_SYNONYMS } = require('../server/lib/sectorTaxonomy');

// Build theme crosswalk (same logic as match-regenerator)
const THEME_TO_SECTOR = {};
for (const [canonical, synonyms] of Object.entries(SECTOR_SYNONYMS)) {
  for (const syn of synonyms) THEME_TO_SECTOR[syn] = canonical;
  THEME_TO_SECTOR[canonical.toLowerCase()] = canonical;
}
Object.assign(THEME_TO_SECTOR, {
  'climate tech': 'CleanTech', 'clean energy': 'CleanTech', 'climate adaptation': 'CleanTech',
  'carbon removal': 'CleanTech', 'environmental technology': 'CleanTech', 'cleantech': 'CleanTech',
  'rare diseases': 'Biotech', 'life sciences': 'Biotech', 'biotechnology': 'Biotech', 'biomedical': 'Biotech',
  'defense': 'Defense', 'security': 'Cybersecurity', 'blockchain': 'Crypto/Web3',
  'developer tools': 'Developer Tools', 'software development': 'Developer Tools',
  'platforms': 'Infrastructure', 'industrial innovation': 'DeepTech',
  'consumer technology': 'Consumer', 'consumer': 'Consumer', 'education': 'EdTech',
  'scalability': 'Infrastructure', 'vertical markets': 'SaaS', 'automation': 'Robotics',
});

function resolveThemeToSector(theme) {
  if (!theme) return null;
  const lower = theme.toLowerCase().trim();
  if (THEME_TO_SECTOR[lower]) return THEME_TO_SECTOR[lower];
  for (const [syn, canonical] of Object.entries(THEME_TO_SECTOR)) {
    if (lower.includes(syn) || syn.includes(lower)) return canonical;
  }
  return null;
}

(async () => {
  // Get 3 AI startups
  const { data: startups } = await supabase.from('startup_uploads')
    .select('id, name, sectors, total_god_score')
    .eq('status', 'approved')
    .contains('sectors', ['AI/ML'])
    .not('total_god_score', 'is', null)
    .order('total_god_score', { ascending: false })
    .limit(3);

  // Get investors with POPULATED faith themes (top_themes array is non-empty)
  const { data: allInv } = await supabase.from('investors')
    .select('id, name, signals, sectors')
    .not('signals', 'is', null)
    .limit(500);
  
  const investors = (allInv || []).filter(i => 
    Array.isArray(i.signals?.top_themes) && i.signals.top_themes.length > 0
  ).slice(0, 10);
  
  console.log(`Found ${investors.length} investors with faith themes (of ${allInv?.length || 0} with signals)\n`);

  console.log('\n=== FAITH ALIGNMENT TEST ===\n');
  
  let superCount = 0, strongCount = 0, signalCount = 0, noneCount = 0;
  
  for (const startup of startups) {
    console.log(`━ Startup: ${startup.name} | GOD: ${startup.total_god_score} | Sectors: ${(startup.sectors || []).join(', ')}`);
    
    for (const inv of investors) {
      const themes = Array.isArray(inv.signals?.top_themes) ? inv.signals.top_themes : [];
      const resolvedSectors = new Set();
      for (const t of themes) {
        const s = resolveThemeToSector(t);
        if (s) resolvedSectors.add(s.toLowerCase());
      }
      
      const startupNorm = (startup.sectors || []).map(s => s.toLowerCase());
      const matchingThemes = [];
      for (const faithSec of [...resolvedSectors]) {
        for (const ss of startupNorm) {
          const r = calculateSectorMatchScore([ss], [faithSec], false);
          if (r.score > 0 || faithSec.includes(ss) || ss.includes(faithSec)) {
            matchingThemes.push(faithSec);
            break;
          }
        }
      }
      
      const conviction = parseFloat(inv.signals?.avg_conviction) || 0.7;
      let score = 0;
      if (matchingThemes.length >= 3) score = conviction >= 0.85 ? 15 : conviction >= 0.7 ? 12 : 10;
      else if (matchingThemes.length === 2) score = conviction >= 0.85 ? 10 : conviction >= 0.7 ? 8 : 7;
      else if (matchingThemes.length === 1) score = conviction >= 0.85 ? 7 : conviction >= 0.7 ? 5 : 3;
      
      const isSuperMatch = score >= 12;
      const tag = isSuperMatch ? '🔥 SUPER' : score >= 7 ? '⭐ Strong' : score > 0 ? '✨ Signal' : '➖ None';
      
      if (isSuperMatch) superCount++;
      else if (score >= 7) strongCount++;
      else if (score > 0) signalCount++;
      else noneCount++;
      
      console.log(`  ${tag} | ${inv.name.padEnd(35)} | faith: +${String(score).padStart(2)}/15 | themes: ${matchingThemes.join(', ') || 'none'} | conviction: ${(conviction * 100).toFixed(0)}%`);
    }
    console.log();
  }
  
  console.log('=== SUMMARY ===');
  console.log(`  🔥 SUPER MATCHES: ${superCount}`);
  console.log(`  ⭐ Strong:        ${strongCount}`);
  console.log(`  ✨ Signal:        ${signalCount}`);
  console.log(`  ➖ None:          ${noneCount}`);
  console.log(`  Total pairs:      ${superCount + strongCount + signalCount + noneCount}`);
  
  process.exit(0);
})();
