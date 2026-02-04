#!/usr/bin/env node
/**
 * VC TEAM PAGE SCRAPER
 * 
 * Discovers new investors by scraping VC firm "Team" pages.
 * This finds individual partners/principals from VC firms.
 * 
 * Goal: 100+ investors/day
 * 
 * Run: node scripts/vc-team-scraper.js
 * PM2: See ecosystem.config.js for scheduling
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const cheerio = require('cheerio');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
);

// NO OPENAI - Using pattern-based extraction instead!

// ============================================================================
// VC FIRMS WITH TEAM PAGES
// ============================================================================
const VC_TEAM_PAGES = [
  // Tier 1 VCs
  { firm: 'Andreessen Horowitz', url: 'https://a16z.com/about/team/', region: 'US' },
  { firm: 'Sequoia Capital', url: 'https://www.sequoiacap.com/people/', region: 'US' },
  { firm: 'Benchmark', url: 'https://www.benchmark.com/team', region: 'US' },
  { firm: 'Greylock', url: 'https://greylock.com/team/', region: 'US' },
  { firm: 'Lightspeed', url: 'https://lsvp.com/team/', region: 'US' },
  { firm: 'Accel', url: 'https://www.accel.com/people', region: 'US' },
  { firm: 'Index Ventures', url: 'https://www.indexventures.com/team', region: 'EU' },
  { firm: 'General Catalyst', url: 'https://www.generalcatalyst.com/team', region: 'US' },
  { firm: 'Founders Fund', url: 'https://foundersfund.com/team/', region: 'US' },
  { firm: 'Bessemer Venture Partners', url: 'https://www.bvp.com/team', region: 'US' },
  { firm: 'Insight Partners', url: 'https://www.insightpartners.com/team/', region: 'US' },
  { firm: 'NEA', url: 'https://www.nea.com/team', region: 'US' },
  { firm: 'Battery Ventures', url: 'https://www.battery.com/our-team/', region: 'US' },
  { firm: 'IVP', url: 'https://www.ivp.com/team/', region: 'US' },
  { firm: 'Spark Capital', url: 'https://www.sparkcapital.com/team', region: 'US' },
  
  // Seed Stage
  { firm: 'Y Combinator', url: 'https://www.ycombinator.com/people', region: 'US' },
  { firm: 'First Round', url: 'https://firstround.com/team/', region: 'US' },
  { firm: 'Initialized', url: 'https://initialized.com/team', region: 'US' },
  { firm: 'SV Angel', url: 'https://svangel.com/team', region: 'US' },
  { firm: 'Precursor Ventures', url: 'https://precursorvc.com/team/', region: 'US' },
  { firm: 'Hustle Fund', url: 'https://www.hustlefund.vc/team', region: 'US' },
  { firm: 'Soma Capital', url: 'https://www.somacap.com/team', region: 'US' },
  
  // European VCs
  { firm: 'Balderton Capital', url: 'https://www.balderton.com/team/', region: 'EU' },
  { firm: 'Atomico', url: 'https://atomico.com/team', region: 'EU' },
  { firm: 'Northzone', url: 'https://northzone.com/team/', region: 'EU' },
  { firm: 'EQT Ventures', url: 'https://eqtventures.com/team/', region: 'EU' },
  { firm: 'Lakestar', url: 'https://www.lakestar.com/team', region: 'EU' },
  { firm: 'Creandum', url: 'https://www.creandum.com/team', region: 'EU' },
  { firm: 'Point Nine', url: 'https://www.pointnine.com/team', region: 'EU' },
  { firm: 'Felix Capital', url: 'https://www.felixcap.com/team', region: 'EU' },
  
  // Asia VCs
  { firm: 'Sequoia India', url: 'https://www.sequoiacap.com/india/people/', region: 'IN' },
  { firm: 'Accel India', url: 'https://www.accel.com/india/people', region: 'IN' },
  { firm: 'Matrix Partners India', url: 'https://www.matrixpartners.in/team', region: 'IN' },
  { firm: 'Blume Ventures', url: 'https://blume.vc/team', region: 'IN' },
  { firm: 'GGV Capital', url: 'https://www.ggvc.com/team/', region: 'APAC' },
  { firm: 'GSR Ventures', url: 'https://www.gsrventures.com/team', region: 'APAC' },
  
  // Growth Stage
  { firm: 'Tiger Global', url: 'https://www.tigerglobal.com/team', region: 'US' },
  { firm: 'Coatue', url: 'https://www.coatue.com/team', region: 'US' },
  { firm: 'Addition', url: 'https://www.addition.com/team', region: 'US' },
  { firm: 'DST Global', url: 'https://dst.com/team', region: 'US' },
  
  // Fintech Focused
  { firm: 'Ribbit Capital', url: 'https://ribbitcap.com/team/', region: 'US' },
  { firm: 'QED Investors', url: 'https://www.qedinvestors.com/team', region: 'US' },
  { firm: 'Nyca Partners', url: 'https://www.nyca.com/team', region: 'US' },
  
  // Healthcare
  { firm: 'a16z Bio', url: 'https://a16z.com/bio/team/', region: 'US' },
  { firm: 'General Atlantic Healthcare', url: 'https://www.generalatlantic.com/team/', region: 'US' },
  
  // Climate
  { firm: 'Breakthrough Energy', url: 'https://www.breakthroughenergy.org/our-team', region: 'US' },
  { firm: 'Lowercarbon Capital', url: 'https://lowercarboncapital.com/team/', region: 'US' },
  { firm: 'Congruent Ventures', url: 'https://congruentvc.com/team/', region: 'US' },
];

// ============================================================================
// FETCH WITH RETRY
// ============================================================================
async function fetchWithRetry(url, retries = 3) {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(timeout);
      
      if (response.ok) {
        return await response.text();
      }
      
      // Don't retry client errors
      if (response.status >= 400 && response.status < 500) {
        return null;
      }
    } catch (error) {
      if (i === retries - 1) return null;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  return null;
}

// ============================================================================
// INVESTMENT ROLE PATTERNS (for pattern-based extraction)
// ============================================================================
const INVESTMENT_TITLES = [
  'partner', 'general partner', 'managing partner', 'founding partner',
  'principal', 'vice president', 'vp', 
  'associate', 'senior associate', 'investment associate',
  'director', 'managing director',
  'investor', 'venture partner'
];

const SKIP_TITLES = [
  'operations', 'hr', 'human resources', 'marketing', 'communications',
  'legal', 'counsel', 'admin', 'finance', 'accounting', 'recruiting',
  'office manager', 'executive assistant', 'platform', 'talent'
];

const FOCUS_KEYWORDS = {
  'ai': 'AI/ML', 'ml': 'AI/ML', 'artificial intelligence': 'AI/ML', 'machine learning': 'AI/ML',
  'fintech': 'Fintech', 'financial': 'Fintech', 'payments': 'Fintech', 'banking': 'Fintech',
  'health': 'Healthcare', 'healthcare': 'Healthcare', 'biotech': 'Healthcare', 'medtech': 'Healthcare',
  'saas': 'SaaS', 'enterprise': 'Enterprise', 'b2b': 'Enterprise', 'software': 'SaaS',
  'consumer': 'Consumer', 'marketplace': 'Consumer', 'e-commerce': 'Consumer',
  'climate': 'Climate', 'cleantech': 'Climate', 'sustainability': 'Climate', 'energy': 'Climate',
  'crypto': 'Crypto/Web3', 'web3': 'Crypto/Web3', 'blockchain': 'Crypto/Web3',
  'security': 'Cybersecurity', 'cybersecurity': 'Cybersecurity',
  'developer': 'DevTools', 'infrastructure': 'Infrastructure', 'cloud': 'Infrastructure'
};

// ============================================================================
// EXTRACT TEAM MEMBERS WITH PATTERNS (NO AI - Zero cost!)
// ============================================================================
function extractTeamWithPatterns(html, firm) {
  if (!html) return [];
  
  const $ = cheerio.load(html);
  $('script, style, nav, footer, header').remove();
  
  const investors = [];
  const seenNames = new Set();
  
  // Strategy 1: Look for team cards with structured data
  const cardSelectors = [
    '.team-member', '.person', '.team-card', '.member', '.staff',
    '[class*="team-member"]', '[class*="person-card"]', '[class*="bio"]',
    '.grid > div', '.team-grid > div', 'article'
  ];
  
  for (const selector of cardSelectors) {
    $(selector).each((i, el) => {
      const card = $(el);
      const text = card.text();
      
      // Look for name (h2, h3, h4, or strong/bold)
      let name = card.find('h2, h3, h4').first().text().trim() ||
                 card.find('strong, b').first().text().trim();
      
      // Look for title
      let title = '';
      const titleEl = card.find('.title, .role, .position, [class*="title"], [class*="role"]').first();
      if (titleEl.length) {
        title = titleEl.text().trim();
      } else {
        // Try to find title in text
        const titleMatch = text.match(/(?:^|\n)\s*((?:General |Managing |Founding )?Partner|Principal|VP|Associate|Director)\b/i);
        if (titleMatch) title = titleMatch[1];
      }
      
      // Validate
      if (!name || name.length < 4 || name.length > 50) return;
      if (seenNames.has(name.toLowerCase())) return;
      
      // Check if investment role
      const titleLower = title.toLowerCase();
      const isInvestmentRole = INVESTMENT_TITLES.some(t => titleLower.includes(t));
      const isSkipRole = SKIP_TITLES.some(t => titleLower.includes(t));
      
      if (!title || (!isInvestmentRole && !isSkipRole)) return;
      if (isSkipRole) return;
      
      // Extract focus from bio
      let focus = null;
      const bioText = card.find('p').text().toLowerCase();
      for (const [keyword, sector] of Object.entries(FOCUS_KEYWORDS)) {
        if (bioText.includes(keyword)) {
          focus = sector;
          break;
        }
      }
      
      seenNames.add(name.toLowerCase());
      investors.push({
        name: name,
        title: title,
        focus: focus,
        bio_snippet: null
      });
    });
    
    if (investors.length >= 5) break; // Found enough with cards
  }
  
  // Strategy 2: If no cards found, try regex on full text
  if (investors.length === 0) {
    const fullText = $('body').text();
    
    // Pattern: "Name, Title" or "Name Title"
    const namePatterns = [
      /([A-Z][a-z]+ [A-Z][a-z]+(?:-[A-Z][a-z]+)?)\s*[,\n]\s*((?:General |Managing |Founding )?Partner|Principal|VP|Director|Associate)/gi,
      /([A-Z][a-z]+ [A-Z][a-z]+(?:-[A-Z][a-z]+)?)\s+(Partner|Principal)\b/gi
    ];
    
    for (const pattern of namePatterns) {
      let match;
      while ((match = pattern.exec(fullText)) !== null) {
        const name = match[1].trim();
        const title = match[2].trim();
        
        if (name.length < 4 || name.length > 50) continue;
        if (seenNames.has(name.toLowerCase())) continue;
        
        seenNames.add(name.toLowerCase());
        investors.push({
          name: name,
          title: title,
          focus: null,
          bio_snippet: null
        });
        
        if (investors.length >= 20) break;
      }
      if (investors.length >= 20) break;
    }
  }
  
  console.log(`  📋 Pattern extraction found ${investors.length} investors for ${firm}`);
  return investors.slice(0, 20); // Max 20
}

// ============================================================================
// SAVE INVESTOR
// ============================================================================
async function saveInvestor(investor, firm, region) {
  if (!investor.name || investor.name.length < 3) return null;
  
  // Skip if name looks invalid
  if (investor.name.includes('@') || investor.name.length > 60) return null;

  try {
    // Check if exists (by name + firm combo)
    const { data: existing } = await supabase
      .from('investors')
      .select('id')
      .ilike('name', investor.name)
      .ilike('firm', firm)
      .maybeSingle();
    
    if (existing) return null;

    // Map title to type
    const titleLower = (investor.title || '').toLowerCase();
    let type = 'VC';
    if (titleLower.includes('angel') || titleLower.includes('scout')) type = 'Angel';
    if (titleLower.includes('growth') || titleLower.includes('pe')) type = 'Growth';
    
    // Determine stage from firm characteristics
    const stageLower = firm.toLowerCase();
    let stage = ['Seed'];
    if (stageLower.includes('growth') || stageLower.includes('tiger') || stageLower.includes('coatue')) {
      stage = ['Growth'];
    } else if (stageLower.includes('series') || stageLower.includes('late')) {
      stage = ['Series A'];
    }

    // Insert with correct column names (no source/source_url in investors)
    const { data, error } = await supabase
      .from('investors')
      .insert({
        name: investor.name,
        firm: firm,
        title: investor.title || null,
        type: type,
        bio: investor.bio_snippet || null,
        sectors: investor.focus ? [investor.focus] : [],
        stage: stage,
        geography_focus: [region],
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      if (!error.message?.includes('duplicate')) {
        console.error(`  DB error for ${investor.name}:`, error.message);
      }
      return null;
    }
    
    return data?.id;
  } catch (err) {
    return null;
  }
}

// ============================================================================
// MAIN
// ============================================================================
async function main() {
  const startTime = Date.now();
  console.log('\n' + '═'.repeat(70));
  console.log('💼 VC TEAM PAGE SCRAPER (Pattern-based - NO AI!)');
  console.log('   Goal: 100+ new investors/day');
  console.log('═'.repeat(70));
  console.log(`⏰ Started: ${new Date().toISOString()}\n`);
  
  // Get starting count
  const { count: before } = await supabase
    .from('investors')
    .select('*', { count: 'exact', head: true });
  
  console.log(`📊 BEFORE: ${before} investors in database\n`);
  console.log('━'.repeat(70));
  
  let totalAdded = 0;
  let firmsProcessed = 0;
  
  for (const vc of VC_TEAM_PAGES) {
    process.stdout.write(`  ${vc.firm.padEnd(30)}... `);
    
    const html = await fetchWithRetry(vc.url);
    if (!html) {
      console.log('⚠️ Blocked/Timeout');
      continue;
    }
    
    // Use pattern-based extraction (NO AI - zero cost!)
    const team = extractTeamWithPatterns(html, vc.firm);
    let added = 0;
    
    for (const member of team) {
      const saved = await saveInvestor(member, vc.firm, vc.region);
      if (saved) added++;
    }
    
    console.log(`${team.length} found, +${added} new`);
    totalAdded += added;
    firmsProcessed++;
    
    // Rate limit - be nice to websites
    await new Promise(r => setTimeout(r, 3000));
  }
  
  // Final count
  const { count: after } = await supabase
    .from('investors')
    .select('*', { count: 'exact', head: true });
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  
  console.log('\n' + '═'.repeat(70));
  console.log('📊 RESULTS');
  console.log('═'.repeat(70));
  console.log(`  Firms scraped: ${firmsProcessed}/${VC_TEAM_PAGES.length}`);
  console.log(`  Investors:     ${before} → ${after} (+${after - before})`);
  console.log(`  Duration:      ${duration}s`);
  console.log('═'.repeat(70));
  
  // Log to database
  await supabase.from('ai_logs').insert({
    type: 'discovery',
    action: 'vc_team_scraper',
    status: 'success',
    output: {
      investors_added: after - before,
      firms_scraped: firmsProcessed,
      duration_seconds: parseFloat(duration)
    }
  });
  
  console.log('\n✅ Done!\n');
}

main().catch(console.error);
