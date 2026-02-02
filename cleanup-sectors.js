require('dotenv').config();
const s = require('@supabase/supabase-js').createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

// Better sector inference based on keywords
const SECTOR_RULES = [
  { keywords: ['nuclear', 'fusion', 'reactor', 'energy', 'power', 'grid', 'solar', 'battery', 'bess'], sector: 'Energy' },
  { keywords: ['health', 'medical', 'patient', 'clinic', 'pharma', 'drug', 'therapeut', 'bio'], sector: 'HealthTech' },
  { keywords: ['fintech', 'payment', 'bank', 'lending', 'insur', 'trading', 'wealth', 'invest'], sector: 'FinTech' },
  { keywords: ['robot', 'drone', 'automat', 'manufact'], sector: 'Robotics' },
  { keywords: ['space', 'satellite', 'rocket', 'aerospace', 'orbit'], sector: 'SpaceTech' },
  { keywords: ['defense', 'military', 'security', 'cyber'], sector: 'Defense' },
  { keywords: ['climate', 'carbon', 'green', 'sustain', 'clean'], sector: 'Climate' },
  { keywords: ['semiconductor', 'chip', 'hardware', 'device'], sector: 'DeepTech' },
  { keywords: ['quantum', 'nano', 'material'], sector: 'DeepTech' },
  { keywords: ['retail', 'ecommerce', 'shop', 'store', 'consumer', 'food', 'delivery'], sector: 'Consumer' },
  { keywords: ['enterprise', 'b2b', 'business', 'corporate'], sector: 'Enterprise' },
  { keywords: ['developer', 'api', 'devops', 'infrastructure', 'cloud'], sector: 'Developer Tools' },
  { keywords: ['edtech', 'education', 'learning', 'school', 'student'], sector: 'EdTech' },
  { keywords: ['proptech', 'real estate', 'property', 'home'], sector: 'PropTech' },
  { keywords: ['crypto', 'blockchain', 'web3', 'defi', 'token'], sector: 'Crypto' },
  // FIXED: 'game' alone is too broad (matches "game-changing", "game plan", etc.)
  // Use specific gaming keywords only
  { keywords: ['gaming company', 'game studio', 'game developer', 'video game', 'esports', 'game platform', 'game engine'], sector: 'Gaming' },
];

// Garbage patterns - these are not real startups
const GARBAGE_PATTERNS = [
  'top stories', 'read more', 'learn more', 'famous example', 'cinema focuses',
  'first atlantic', 'bill.com technology', 'news', 'pick europe'
];

async function cleanup() {
  console.log('CLEANING UP SECTOR DATA\n');
  
  const { data } = await s.from('startup_uploads')
    .select('id, name, sectors, tagline, description')
    .eq('status', 'approved');
  
  let fixed = 0;
  let deleted = 0;
  
  for (const startup of data) {
    const name = (startup.name || '').toLowerCase();
    const text = (name + ' ' + (startup.tagline || '') + ' ' + (startup.description || '')).toLowerCase();
    
    // Check if garbage
    if (GARBAGE_PATTERNS.some(p => name.includes(p))) {
      await s.from('startup_uploads').update({ status: 'rejected' }).eq('id', startup.id);
      deleted++;
      console.log('REJECTED (garbage):', startup.name);
      continue;
    }
    
    // Check if needs sector fix
    const currentSectors = (startup.sectors || []).map(sec => sec.toLowerCase());
    const isOverAssigned = currentSectors.length <= 2 && 
      currentSectors.every(sec => ['ai/ml', 'saas', 'ai', 'ml', 'technology'].includes(sec));
    
    if (!isOverAssigned) continue;
    
    // Infer better sectors
    const newSectors = new Set();
    
    for (const rule of SECTOR_RULES) {
      if (rule.keywords.some(kw => text.includes(kw))) {
        newSectors.add(rule.sector);
      }
    }
    
    // If still empty, keep original but remove generic ones
    if (newSectors.size === 0) {
      // Keep SaaS if it was there, but not AI/ML unless there's evidence
      if (currentSectors.includes('saas')) newSectors.add('SaaS');
      if (text.includes('ai') || text.includes('machine') || text.includes('model')) {
        newSectors.add('AI/ML');
      }
    }
    
    // Only update if we found something different
    if (newSectors.size > 0) {
      const finalSectors = [...newSectors];
      await s.from('startup_uploads').update({ sectors: finalSectors }).eq('id', startup.id);
      fixed++;
      if (fixed <= 30) {
        console.log('Fixed:', startup.name, '|', currentSectors.join(', '), '->', finalSectors.join(', '));
      }
    }
  }
  
  console.log('\n\nTotal fixed:', fixed);
  console.log('Total rejected:', deleted);
  
  // Show new distribution
  const { data: updated } = await s.from('startup_uploads')
    .select('sectors')
    .eq('status', 'approved');
  
  const counts = {};
  updated.forEach(x => {
    (x.sectors || []).forEach(sec => {
      const n = sec.toLowerCase();
      counts[n] = (counts[n] || 0) + 1;
    });
  });
  
  console.log('\n\nNEW SECTOR DISTRIBUTION:');
  Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([sec, count]) => {
    console.log('  ', count.toString().padStart(4), sec);
  });
}

cleanup();
